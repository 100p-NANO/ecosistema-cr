import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Manejo central de errores.
 *
 * ⛔ Dos reglas. Primera: el usuario recibe un mensaje en castellano y el
 * identificador de su petición, nunca la estructura interna. Un error de
 * la base que dice «violates foreign key constraint casos_topico_fkey» le
 * regala a quien ataca el nombre de las tablas y sus relaciones.
 * Segunda: el detalle técnico se registra completo, del lado del servidor.
 */
const log = new Logger('Error');

const TRADUCCIONES: Record<string, { estado: number; mensaje: string }> = {
  '23505': { estado: HttpStatus.CONFLICT,   mensaje: 'Ese registro ya existe.' },
  '23503': { estado: HttpStatus.BAD_REQUEST, mensaje: 'El registro hace referencia a algo que no existe o que ya no está vigente.' },
  '23514': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Los datos no cumplen una regla del sistema.' },
  '23502': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Falta un dato obligatorio.' },
  '42501': { estado: HttpStatus.FORBIDDEN,  mensaje: 'No tiene permiso para esta operación.' },
  '57014': { estado: HttpStatus.GATEWAY_TIMEOUT, mensaje: 'La consulta tardó demasiado y se canceló.' },
};

@Catch()
export class FiltroDeErrores implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const id = (req as any).peticionId ?? 'sin-id';

    if (e instanceof HttpException) {
      const cuerpo = e.getResponse();
      const mensaje = typeof cuerpo === 'string' ? cuerpo : (cuerpo as any)?.mensaje ?? (cuerpo as any)?.message ?? 'Error';
      return res.status(e.getStatus()).json({ error: true, mensaje, peticionId: id });
    }

    const codigo = (e as any)?.code as string | undefined;
    const t = codigo ? TRADUCCIONES[codigo] : undefined;

    /* El mensaje que escribe la propia base con RAISE EXCEPTION sí está
       redactado para humanos: ese se devuelve tal cual. Se reconoce porque
       lleva el código de una restricción de negocio, no del motor. */
    const mensajeDeLaBase = (e as any)?.message as string | undefined;
    const esMensajeRedactado = !!mensajeDeLaBase &&
      /^(La |El |Un |Una |No se |Se |Toda |Falta |Sacar|Retirar|Revocar|Origen)/.test(mensajeDeLaBase) &&
      !mensajeDeLaBase.includes('violates');

    log.error(`${id} ${req.method} ${req.path} · ${codigo ?? 'sin-codigo'} · ${mensajeDeLaBase ?? e}`);

    if (t && esMensajeRedactado) {
      return res.status(t.estado).json({ error: true, mensaje: mensajeDeLaBase, peticionId: id });
    }
    if (t) return res.status(t.estado).json({ error: true, mensaje: t.mensaje, peticionId: id });

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: true,
      mensaje: 'Ocurrió un error inesperado. Si vuelve a pasar, reporte este código al soporte.',
      peticionId: id,
    });
  }
}
