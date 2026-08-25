import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { almacen, type Contexto } from '../contexto/contexto';

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
export class DbService implements OnModuleDestroy {
  private readonly log = new Logger('DbService');
  private readonly pool = new Pool({
    host: process.env.PGHOST ?? '/tmp',
    port: Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? 'casaroca_dev',
    user: process.env.PGUSER ?? 'casaroca_app',
    password: process.env.PGPASSWORD || undefined,
    max: 10,
    idle_in_transaction_session_timeout: 10_000,
  } as any);

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
