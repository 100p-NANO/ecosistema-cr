/**
 * Prueba de extremo a extremo del Módulo de Nuevos.
 *
 * Lo que de verdad demuestra: que el aislamiento entre sedes SOBREVIVE al
 * pasar por la API. Un esquema con RLS impecable no sirve de nada si la
 * capa de aplicación abre una conexión sin contexto — y ese fallo no se
 * ve leyendo el SQL.
 *
 * Las rutas son las del documento M-Nuevos del equipo 100p.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Client } from 'pg';

const R: Array<{ n: number; nombre: string; obtenido: string; paso: boolean }> = [];
const reg = (n: number, nombre: string, obtenido: string, paso: boolean) =>
  R.push({ n, nombre, obtenido, paso });

async function main() {
  process.env.PGUSER ||= 'casaroca_api_dev';
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1').replace(/\/$/, '') + '/';

  const admin = new Client({
    host: process.env.PGHOST ?? '/tmp', port: Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? 'casaroca_dev', user: 'postgres',
  });
  await admin.connect();
  const q = async (sql: string, p: any[] = []) => (await admin.query(sql, p)).rows;

  const [{ id: pastorBog }] = await q(
    `SELECT a.persona_id AS id FROM identidad.asignaciones a JOIN org.sedes s ON s.id=a.alcance_id
      WHERE a.rol='PASTOR_CONGREGACIONAL' AND s.codigo='BOG-NORTE' LIMIT 1`);
  const [{ id: pastorMed }] = await q(
    `SELECT a.persona_id AS id FROM identidad.asignaciones a JOIN org.sedes s ON s.id=a.alcance_id
      WHERE a.rol='PASTOR_CONGREGACIONAL' AND s.codigo='MED' LIMIT 1`);

  const pedir = (ruta: string, opts: RequestInit = {}, persona?: string) =>
    fetch(base + 'api/v1/nuevos/' + ruta, {
      ...opts,
      headers: { 'content-type': 'application/json',
                 ...(persona ? { 'X-Persona-Id': persona } : {}), ...(opts.headers ?? {}) },
    });

  const marca = 'Prueba' + Date.now().toString().slice(-7);
  const correo = `nuevo.${marca.toLowerCase()}@example.org`;

  // E1 · registro público
  let r = await pedir('registrar', { method: 'POST', body: JSON.stringify({
    sede: 'BOG-NORTE', nombre: `Nuevo ${marca}`, email: correo,
    como_supo: 'amigo', es_cristiano: 'duda', autoriza: ['email', 'whatsapp'],
  })});
  const creado = await r.json() as any;
  reg(1, 'Registro publico entra a la bandeja', `${r.status} ${creado.estado ?? ''}`.trim(),
      r.status === 201 && creado.estado === 'registrado');

  // E2 · el mismo correo dos veces se rechaza con su codigo
  r = await pedir('registrar', { method: 'POST', body: JSON.stringify({
    sede: 'BOG-NORTE', nombre: 'Repetido', email: correo })});
  const dupTexto = await r.text();
  reg(2, 'Correo duplicado en la bandeja',
      `${r.status} ${dupTexto.includes('EMAIL_DUPLICADO') ? 'EMAIL_DUPLICADO' : 'sin codigo'}`,
      r.status === 409 && dupTexto.includes('EMAIL_DUPLICADO'));

  // E3 · un registro sin correo NI telefono se rechaza
  r = await pedir('registrar', { method: 'POST',
    body: JSON.stringify({ sede: 'BOG-NORTE', nombre: 'Incontactable' })});
  reg(3, 'Registro sin forma de contacto', String(r.status), r.status === 400);

  // E4 · sin identidad no hay datos
  r = await pedir('dashboard');
  reg(4, 'Peticion sin identidad', String(r.status), r.status === 401);

  // E5 · el pastor de su sede lo ve
  r = await pedir('dashboard', {}, pastorBog);
  const dashBog = await r.json() as any;
  const loVeBog = (dashBog.nuevos ?? []).some((x: any) => x.nombre.includes(marca));
  reg(5, 'El coordinador de su sede lo ve', String(loVeBog), loVeBog);

  // E6 · el de otra sede NO
  r = await pedir('dashboard', {}, pastorMed);
  const dashMed = await r.json() as any;
  const loVeMed = (dashMed.nuevos ?? []).some((x: any) => x.nombre.includes(marca));
  reg(6, 'El de OTRA sede no lo ve', String(loVeMed), !loVeMed);

  // E7 · ni pidiendo el historial directo
  r = await pedir(`${creado.id}/historial`, {}, pastorMed);
  reg(7, 'Historial directo desde otra sede', String(r.status), r.status === 404);

  // E8 · el contexto no se filtra entre peticiones del pool
  let fuga = false;
  for (let i = 0; i < 8; i++) {
    const persona = i % 2 === 0 ? pastorMed : pastorBog;
    const res = await pedir('dashboard', {}, persona);
    const d = await res.json() as any;
    if (persona === pastorMed && (d.nuevos ?? []).some((x: any) => x.nombre.includes(marca))) fuga = true;
  }
  reg(8, 'El contexto no se filtra entre peticiones', fuga ? 'HUBO FUGA' : 'sin fuga', !fuga);

  // E9 · registrar contacto, y el estado se deriva de la reaccion
  r = await pedir(`${creado.id}/registrar-contacto`, { method: 'POST', body: JSON.stringify({
    tipo_contacto: 'llamada', resumen: 'Primera llamada de bienvenida.',
    reaccion: 'interesado', siguiente_paso: 'Invitar a grupo pequeño',
  })}, pastorBog);
  const cont = await r.json() as any;
  reg(9, 'Contacto registrado y estado derivado', `${r.status} ${cont.estado_nuevo ?? ''}`.trim(),
      r.status === 201 && cont.estado_nuevo === 'contactado');

  // E10 · convertir en miembro
  r = await pedir(`${creado.id}/convertir-miembro`, { method: 'POST',
    body: JSON.stringify({ notas: 'Decidió integrarse' })}, pastorBog);
  const conv = await r.json() as any;
  reg(10, 'Conversion a miembro', `${r.status} ${conv.recorrido_4c?.etapa ?? ''}`.trim(),
      r.status === 201 && conv.recorrido_4c?.etapa === 'conoce');

  // E11 · el consentimiento viajo CON SU FECHA ORIGINAL
  const cons = await q(
    `SELECT c.canal, c.ocurrido_en, n.autorizado_en
       FROM plataforma.consentimientos c
       JOIN crm.nuevos_registros n ON n.persona_id = c.persona_id
      WHERE n.id = $1 ORDER BY c.canal`, [creado.id]);
  const fechaOk = cons.length === 2 &&
    cons.every((x: any) => new Date(x.ocurrido_en).getTime() === new Date(x.autorizado_en).getTime());
  reg(11, 'El consentimiento conserva su fecha original',
      `${cons.length} canales, fecha ${fechaOk ? 'original' : 'reescrita'}`, fechaOk);

  // E12 · convertir dos veces se rechaza
  r = await pedir(`${creado.id}/convertir-miembro`, { method: 'POST', body: '{}' }, pastorBog);
  reg(12, 'Convertir dos veces', String(r.status), r.status === 409);

  // E13 · el rol de conexion de la API no puede saltar RLS
  const [{ bypass }] = await q(`SELECT rolbypassrls AS bypass FROM pg_roles WHERE rolname=$1`,
    [process.env.PGUSER]);
  reg(13, 'El rol de la API no puede saltar RLS', String(bypass), bypass === false);

  await admin.end();
  await app.close();

  console.log('\n===== API · MODULO DE NUEVOS (extremo a extremo) =====');
  const w = Math.max(...R.map((x) => x.nombre.length));
  for (const x of R) {
    console.log(` ${String(x.n).padStart(2)} | ${x.nombre.padEnd(w)} | ${x.obtenido.padEnd(30)} | ${x.paso ? 'PASA' : 'FALLA'}`);
  }
  const p = R.filter((x) => x.paso).length;
  console.log(`\n pasan | fallan | total\n ${p}     | ${R.length - p}      | ${R.length}\n`);
  process.exit(p === R.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
