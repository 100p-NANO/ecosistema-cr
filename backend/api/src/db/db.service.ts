import { ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { almacen, type Contexto } from '../contexto/contexto';
import { MAX_NEGOCIO, TOTAL_POR_INSTANCIA } from './pozos';

/**
 * Acceso a datos. Una petición = una transacción = un contexto.
 *
 * Nada consulta la base fuera de `enTransaccion`. Esa es la regla que
 * hace que la doble cerradura funcione: si alguien abre una conexión
 * suelta del pool, esa conexión no tiene `app.sede_ids` fijado y la
 * base no le devuelve filas — el sistema falla de forma visible en vez
 * de filtrar datos en silencio.
 */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('DbService');
  private readonly pool = new Pool({
    host: process.env.PGHOST ?? '/tmp',
    port: Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? 'casaroca_dev',
    user: process.env.PGUSER ?? 'casaroca_app',
    password: process.env.PGPASSWORD || undefined,
    max: MAX_NEGOCIO,
    idle_in_transaction_session_timeout: 10_000,
  } as any);

  /**
   * ⛔ LA API NO ARRANCA COMO SUPERUSUARIO.
   *
   * El 19 de septiembre de 2026 el banco de extremo a extremo se puso en
   * rojo dentro de la compuerta y verde a mano: la diferencia era que la
   * compuerta exportaba PGUSER de administrador y la API se conectaba con
   * el. Un superusuario (o cualquier rol con BYPASSRLS) SALTA todas las
   * politicas: la doble cerradura queda de adorno y Medellin ve la bandeja
   * de Bogota sin que nada falle a la vista.
   *
   * No es un aviso: el proceso se niega a levantar. Un arranque que no
   * ocurre se nota; una fuga silenciosa, no.
   */
  async onModuleInit() {
    const { rows: [r] } = await this.pool.query(
      `SELECT current_user AS usuario, rolsuper, rolbypassrls
         FROM pg_roles WHERE rolname = current_user`);
    if (r?.rolsuper || r?.rolbypassrls) {
      throw new Error(
        `La API esta conectada como «${r.usuario}», que ` +
        `${r.rolsuper ? 'es superusuario' : 'puede saltarse RLS'}. ` +
        'Con ese rol el aislamiento entre sedes NO se aplica. ' +
        'Use casaroca_app (o casaroca_api_dev en desarrollo) y vuelva a arrancar.');
    }
    this.log.log(`base conectada como ${r.usuario} · sin privilegio para saltar RLS`);

    /* ⛔ Cuántas conexiones caben. El auditor de rendimiento lo midió para
       el domingo de 9 a 11: si (pozos x instancias) se acerca a
       `max_connections`, las peticiones no fallan, se ENCOLAN, y lo hacen
       justo en la pantalla de check-in con la fila de niños delante.
       Un aviso al arrancar cuesta nada; enterarse el domingo, mucho. */
    try {
      const { rows: [c] } = await this.pool.query(`SHOW max_connections`);
      const tope = Number(c?.max_connections);
      if (Number.isFinite(tope)) {
        const caben = Math.floor((tope - 10) / TOTAL_POR_INSTANCIA);
        const msg = `pozos: ${TOTAL_POR_INSTANCIA} conexiones por instancia · `
          + `max_connections=${tope} · caben ${caben} instancia(s) con 10 de margen`;
        if (caben < 2) this.log.warn(`${msg} ⚠️ menos de dos: no se puede escalar para el domingo`);
        else this.log.log(msg);
      }
    } catch { /* si no se puede leer, no es motivo para no arrancar */ }
  }

  async onModuleDestroy() { await this.pool.end(); }

  /**
   * Abre la transacción, fija el contexto con SET LOCAL y ejecuta.
   *
   * `SET LOCAL` es deliberado: el valor muere al terminar la
   * transacción. Con `SET` a secas quedaría pegado a la conexión y la
   * siguiente petición que reutilizara esa conexión del pool heredaría
   * la sede del usuario anterior. Es el fallo clásico de multi-sede, y
   * hay una prueba en el banco que lo cubre.
   */
  async enTransaccion<T>(ctx: Contexto, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query('SELECT set_config($1,$2,true)', ['app.persona_id', ctx.personaId ?? '']);
      await cliente.query('SELECT set_config($1,$2,true)', [
        'app.sede_ids',
        ctx.sedeIds.length ? `{${ctx.sedeIds.join(',')}}` : '',
      ]);
      await cliente.query('SELECT set_config($1,$2,true)', ['app.nivel_max', String(ctx.nivelMax)]);
      await cliente.query('SELECT set_config($1,$2,true)', ['app.alcance_global', String(ctx.alcanceGlobal)]);
      await cliente.query('SELECT set_config($1,$2,true)', ['app.ip', ctx.ip ?? '']);
      if (process.env.APP_LLAVE_N4) {
        await cliente.query('SELECT set_config($1,$2,true)', ['app.llave_n4', process.env.APP_LLAVE_N4]);
      }

      /* ⛔ EL INTERRUPTOR DE MÓDULOS POR SEDE, APLICADO.
         La consola dejaba apagar RocaKids en Panamá y no pasaba nada: el
         pastor de Panamá seguía viendo la pestaña, entraba, y se le ofrecían
         salas de otra sede. `sistema.modulos_sede` no se consultaba en
         ninguna parte fuera de la consola.
         Ahora, en las rutas de un módulo, las sedes donde está APAGADO salen
         del contexto de la transacción. No hace falta tocar una sola política:
         el RLS ya no ve esas sedes, ni para leer ni para escribir. Quien
         alcanza toda la red pierde la marca de «global» solo si el módulo
         está apagado en alguna sede; si está encendido en todas, nada cambia. */
      if (ctx.modulo) {
        const { rows: [m] } = await cliente.query(
          `SELECT sistema.sedes_con_modulo($1) AS sedes,
                  (SELECT count(*) FROM org.sedes s WHERE s.activa)::int AS activas,
                  (SELECT nombre FROM sistema.modulos WHERE codigo = $1) AS nombre`, [ctx.modulo]);
        const encendidas: string[] = m?.sedes ?? [];
        let global = ctx.alcanceGlobal;
        let sedes = ctx.sedeIds;
        if (ctx.alcanceGlobal) {
          if (encendidas.length < Number(m?.activas ?? 0)) { global = false; sedes = encendidas; }
        } else {
          sedes = ctx.sedeIds.filter((x) => encendidas.includes(x));
        }
        if (!global && sedes.length === 0) {
          throw new ForbiddenException(
            `El módulo «${m?.nombre ?? ctx.modulo}» está apagado en ` +
            `${ctx.sedeIds.length === 1 ? 'su sede' : 'las sedes que usted alcanza'}. ` +
            'Lo enciende la central desde «Qué ve cada iglesia».');
        }
        if (global !== ctx.alcanceGlobal || sedes !== ctx.sedeIds) {
          await cliente.query('SELECT set_config($1,$2,true)', ['app.sede_ids', sedes.length ? `{${sedes.join(',')}}` : '']);
          await cliente.query('SELECT set_config($1,$2,true)', ['app.alcance_global', String(global)]);
          ctx = { ...ctx, sedeIds: sedes, alcanceGlobal: global };
        }
      }

      const salida = await almacen.run({ ...ctx, cliente }, () => fn(cliente));
      await cliente.query('COMMIT');
      return salida;
    } catch (e) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      cliente.release();
    }
  }

  /**
   * Deriva el contexto de una persona desde la propia base: sus sedes y
   * su techo de sensibilidad salen de las asignaciones vigentes, no de
   * lo que diga el cliente. Corre con una conexión sin contexto a
   * propósito, porque las funciones que consulta no dependen de RLS.
   */
  async contextoDe(personaId: string, ip: string | null): Promise<Contexto> {
    const c = await this.pool.connect();
    try {
      // Una sola llamada a la puerta de arranque. No se leen tablas: la
      // función SECURITY DEFINER es lo único que puede resolver esto
      // antes de que exista contexto, y solo responde sobre esta persona.
      const { rows } = await c.query(
        `SELECT sedes, nivel_max, es_global, tiene_acceso FROM identidad.contexto_de($1)`,
        [personaId],
      );
      const r = rows[0];
      if (!r?.tiene_acceso) {
        // Sin asignación vigente no hay acceso. Se devuelve un contexto
        // vacío en vez de lanzar: la base tampoco le daría ninguna fila,
        // y así el error se ve en la capa que sabe explicarlo.
        return { personaId, sedeIds: [], nivelMax: 0, alcanceGlobal: false, ip };
      }
      return {
        personaId,
        sedeIds: r.sedes ?? [],
        nivelMax: r.nivel_max ?? 0,
        alcanceGlobal: r.es_global ?? false,
        ip,
      };
    } finally { c.release(); }
  }
}
