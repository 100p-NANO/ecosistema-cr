import { Controller, Headers, Injectable, Logger, Module, Post, Query,
         ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { PLANTILLAS } from './plantillas';
import { circuitoAbierto, llamarTercero } from '../comun/saliente';

/**
 * El trabajador de la bandeja de salida (`plataforma.notificaciones`).
 *
 * La base ENCOLA los avisos en la misma transacción que el hecho que los
 * causa; este trabajador los toma y los envía por SendGrid (el proveedor
 * que eligió el plan de costos GCP). En producción lo llama un Cloud Run
 * Job o Cloud Scheduler cada minuto; en desarrollo, un curl.
 *
 * ⛔ Sin `SENDGRID_API_KEY` no toma nada: los avisos se quedan pendientes
 *    y no gastan intentos. Así ningún correo sale por error desde un
 *    equipo de desarrollo, y nada se pierde el día que se configure.
 * ⛔ La ruta no tiene sesión de persona (la llama una máquina): la protege
 *    `NOTIFICACIONES_TOKEN`, comparado en tiempo constante.
 */
@Injectable()
export class NotificacionesService {
  private readonly log = new Logger('Notificaciones');
  constructor(private readonly db: DbService) {}

  async procesar(limite: number) {
    const clave = process.env.SENDGRID_API_KEY;
    if (!clave) {
      return { enviadas: 0, fallidas: 0, motivo: 'SENDGRID_API_KEY no configurada: los avisos quedan pendientes.' };
    }
    const remitente = process.env.CORREO_REMITENTE ?? 'no-responder@casaroca.org';
    const ctx = { personaId: null, sedeIds: [], nivelMax: 1, alcanceGlobal: false, ip: null };

    const lote = await this.db.enTransaccion(ctx, async (c) =>
      (await c.query(`SELECT * FROM plataforma.tomar_notificaciones($1)`, [limite])).rows);

    let enviadas = 0, fallidas = 0, devueltas = 0;
    for (const n of lote) {
      let ok = false, error: string | null = null, proveedorId: string | null = null;
      let definitivo = false, esperar: number | null = null;
      if (n.canal !== 'email') {
        error = `Canal ${n.canal} sin proveedor configurado`; definitivo = true;
      } else if (!PLANTILLAS[n.plantilla]) {
        error = `Plantilla desconocida: ${n.plantilla}`; definitivo = true;
      } else if (circuitoAbierto('sendgrid')) {
        /* ⛔ Modo degradado: con el proveedor caído no se gasta un intento
           por aviso. Lo que queda del lote vuelve a la cola con espera. */
        error = 'SendGrid en cortacircuitos: se reintenta más tarde';
        esperar = 120;
        devueltas++;
      } else {
        const { asunto, html } = PLANTILLAS[n.plantilla](n.datos ?? {});
        const r = await llamarTercero('sendgrid', 'https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: n.destinatario }] }],
            from: { email: remitente, name: 'Casa Sobre la Roca' },
            subject: asunto,
            content: [{ type: 'text/html', value: html }],
          }),
        }, { esperaMs: 10_000 });
        if (r.ok) {
          ok = r.estado === 202;
          proveedorId = r.respuesta.headers.get('x-message-id');
          if (!ok) { error = `SendGrid respondió ${r.estado} (se esperaba 202)`; }
        } else {
          error = r.error;
          /* Un 4xx que no es 429 (dirección inválida, remitente no
             verificado) no se arregla repitiéndolo: muere de una vez. */
          definitivo = !r.pasajero;
          esperar = r.esperarSegundos;
        }
      }
      await this.db.enTransaccion(ctx, (c) => c.query(
        `SELECT plataforma.marcar_notificacion($1, $2, $3, $4, $5, $6)`,
        [n.id, ok, error, proveedorId, definitivo, esperar]));
      ok ? enviadas++ : fallidas++;
      if (!ok) this.log.warn(`Aviso ${n.id} (${n.plantilla}) no salió${definitivo ? ' (definitivo)' : ''}: ${error}`);
    }
    return { enviadas, fallidas, devueltas_por_cortacircuitos: devueltas, tomadas: lote.length };
  }
}

@Controller('api/v1/notificaciones')
export class NotificacionesController {
  constructor(private readonly svc: NotificacionesService) {}

  @Post('procesar')
  procesar(@Headers('x-tarea-token') token: string | undefined, @Query('limite') limite?: string) {
    const esperado = process.env.NOTIFICACIONES_TOKEN;
    if (!esperado) throw new ServiceUnavailableException('NOTIFICACIONES_TOKEN no configurado.');
    const a = Buffer.from(token ?? ''), b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return this.svc.procesar(Math.min(Number(limite) || 50, 100));
  }
}

@Module({ imports: [DbModule], controllers: [NotificacionesController], providers: [NotificacionesService] })
export class NotificacionesModule {}
