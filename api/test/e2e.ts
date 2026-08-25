/**
 * Prueba de extremo a extremo del Módulo de Nuevos.
 *
 * Lo que de verdad demuestra: que el aislamiento entre sedes SOBREVIVE
 * al pasar por la API. Un esquema con RLS impecable no sirve de nada si
 * la capa de aplicación abre una conexión sin contexto — y ese fallo no
 * se ve mirando el SQL.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Client } from 'pg';

const R: Array<{ n: number; nombre: string; esperado: string; obtenido: string; paso: boolean }> = [];
const reg = (n: number, nombre: string, esperado: string, obtenido: string, paso: boolean) =>
  R.push({ n, nombre, esperado, obtenido, paso });

async function main() {
  process.env.PGUSER ||= 'casaroca_api_dev';
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1').replace(/\/$/, '') + '/';

  // Identidades reales de la base de desarrollo.
  const admin = new Client({
    host: process.env.PGHOST ?? '/tmp', port: Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? 'casaroca_dev', user: 'postgres',
  });
  await admin.connect();
  const q = async (sql: string, p: any[] = []) => (await admin.query(sql, p)).rows;

  const [{ id: pastorBog }] = await q(
    `SELECT a.persona_id AS id FROM identidad.asignaciones a
     JOIN org.sedes s ON s.id=a.alcance_id
     WHERE a.rol='PASTOR_CONGREGACIONAL' AND s.codigo='BOG-NORTE' LIMIT 1`);
  const [{ id: pastorMed }] = await q(
    `SELECT a.persona_id AS id FROM identidad.asignaciones a
     JOIN org.sedes s ON s.id=a.alcance_id
     WHERE a.rol='PASTOR_CONGREGACIONAL' AND s.codigo='MED' LIMIT 1`);

  const pedir = (ruta: string, opts: RequestInit = {}, persona?: string) =>
    fetch(base + ruta, {
      ...opts,
      headers: {
        'content-type': 'application/json',
        ...(persona ? { 'X-Persona-Id': persona } : {}),
        ...(opts.headers ?? {}),
      },
    });

  // ── E1 · registro público ──────────────────────────────────────────
  const marca = 'Prueba' + Date.now().toString().slice(-6);
  let r = await pedir('publico/registro', {
    method: 'POST',
    body: JSON.stringify({
      sede_codigo: 'BOG-NORTE', primer_nombre: 'Nuevo', primer_apellido: marca,
      email: `nuevo.${marca.toLowerCase()}@example.org`, autoriza: ['email', 'whatsapp'],
      puerta_entrada: 'formulario web',
    }),
  });
  const creado = await r.json() as any;
  reg(1, 'Registro publico crea la persona', '201 + etapa conoce',
      `${r.status} ${creado.etapa ?? ''}`.trim(), r.status === 201 && creado.etapa === 'conoce');

  // ── E2 · el consentimiento quedó por canal, con su fecha ───────────
  const cons = await q(
    `SELECT canal, acto FROM plataforma.consentimientos WHERE persona_id=$1 ORDER BY canal`, [creado.id]);
  reg(2, 'Consentimiento guardado por canal', 'email + whatsapp',
      cons.map((c: any) => c.canal).join(' + '), cons.length === 2);

  // ── E3 · sin identidad, la API no responde datos ───────────────────
  r = await pedir('nuevos');
  reg(3, 'Peticion sin identidad', '401', String(r.status), r.status === 401);

  // ── E4 · el pastor de Bogota SI lo ve ──────────────────────────────
  r = await pedir('nuevos', {}, pastorBog);
  const listaBog = await r.json() as any[];
  const loVeBog = listaBog.some((x) => x.primer_apellido === marca);
  reg(4, 'El pastor de su sede lo ve', 'true', String(loVeBog), loVeBog);

  // ── E5 · el pastor de Medellin NO lo ve ────────────────────────────
  r = await pedir('nuevos', {}, pastorMed);
  const listaMed = await r.json() as any[];
  const loVeMed = listaMed.some((x) => x.primer_apellido === marca);
  reg(5, 'El pastor de OTRA sede no lo ve', 'false', String(loVeMed), !loVeMed);

  // ── E6 · ni siquiera pidiendo la ficha directa ─────────────────────
  r = await pedir('nuevos/' + creado.id, {}, pastorMed);
  reg(6, 'Ficha directa desde otra sede', '404', String(r.status), r.status === 404);

  // ── E7 · el contexto no se filtra entre peticiones del pool ────────
  // Se alternan a propósito para forzar la reutilización de conexiones.
  let fuga = false;
  for (let i = 0; i < 6; i++) {
    const persona = i % 2 === 0 ? pastorMed : pastorBog;
    const res = await pedir('nuevos', {}, persona);
    const lista = await res.json() as any[];
    if (persona === pastorMed && lista.some((x) => x.primer_apellido === marca)) fuga = true;
  }
  reg(7, 'El contexto no se filtra entre peticiones', 'sin fuga',
      fuga ? 'HUBO FUGA' : 'sin fuga', !fuga);

  // ── E8 · contacto de seguimiento ───────────────────────────────────
  r = await pedir(`nuevos/${creado.id}/contacto`, {
    method: 'POST',
    body: JSON.stringify({ tipo: 'LLAMADA', resumen: 'Primera llamada de bienvenida.' }),
  }, pastorBog);
  reg(8, 'Registrar contacto de seguimiento', '201', String(r.status), r.status === 201);

  // ── E9 · avanzar de etapa cierra la anterior ───────────────────────
  r = await pedir(`nuevos/${creado.id}/etapa`, {
    method: 'POST', body: JSON.stringify({ etapa: 'conectate', nota: 'Entró a un grupo' }),
  }, pastorBog);
  const abiertas = await q(
    `SELECT count(*)::int AS n FROM crm.recorrido WHERE persona_id=$1 AND salio_en IS NULL`, [creado.id]);
  reg(9, 'Al avanzar queda UNA sola etapa abierta', '1',
      String(abiertas[0].n), r.status === 201 && abiertas[0].n === 1);

  // ── E10 · la ficha trae la memoria completa ────────────────────────
  r = await pedir('nuevos/' + creado.id, {}, pastorBog);
  const ficha = await r.json() as any;
  reg(10, 'La ficha 360 trae recorrido y linea de tiempo', '>=2 hechos y 2 etapas',
      `${ficha.linea_tiempo?.length ?? 0} hechos, ${ficha.recorrido?.length ?? 0} etapas`,
      (ficha.linea_tiempo?.length ?? 0) >= 2 && (ficha.recorrido?.length ?? 0) === 2);

  // ── E11 · la API no puede saltarse RLS ─────────────────────────────
  const [{ bypass }] = await q(`SELECT rolbypassrls AS bypass FROM pg_roles WHERE rolname='casaroca_api_dev'`);
  reg(11, 'El rol de conexion de la API no puede saltar RLS', 'false', String(bypass), bypass === false);

  await admin.end();
  await app.close();

  console.log('\n===== API · MODULO DE NUEVOS (extremo a extremo) =====');
  const ancho = Math.max(...R.map((x) => x.nombre.length));
  for (const x of R) {
    console.log(
      ` ${String(x.n).padStart(2)} | ${x.nombre.padEnd(ancho)} | ${x.obtenido.padEnd(22)} | ` +
      (x.paso ? 'PASA' : 'FALLA'),
    );
  }
  const pasan = R.filter((x) => x.paso).length;
  console.log(`\n pasan | fallan | total\n ${pasan}     | ${R.length - pasan}      | ${R.length}\n`);
  process.exit(pasan === R.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
