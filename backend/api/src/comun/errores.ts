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
  // ⛔ Un identificador mal formado es un error DEL CLIENTE. Antes caía al
  //    500 genérico, y un escáner probando rutas se registraba como «error
  //    inesperado del servidor», tapando incidentes reales entre el ruido.
  '22P02': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Un identificador o un valor no tiene el formato esperado.' },
  '22001': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Un texto es más largo de lo que admite el campo.' },
  '22003': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Un número está fuera del rango admitido.' },
  '40001': { estado: HttpStatus.CONFLICT,    mensaje: 'Otra persona cambió lo mismo al mismo tiempo. Inténtelo otra vez.' },
  '40P01': { estado: HttpStatus.CONFLICT,    mensaje: 'Dos operaciones se bloquearon entre sí. Inténtelo otra vez.' },
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

    /* Cuerpo demasiado grande: 413, no 500. */
    if ((e as any)?.type === 'entity.too.large' || (e as any)?.status === 413) {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        error: true, mensaje: 'El contenido enviado es demasiado grande.', peticionId: id });
    }
    /* JSON mal formado: 400. */
    if (e instanceof SyntaxError && 'body' in (e as any)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: true, mensaje: 'El contenido enviado no es un JSON válido.', peticionId: id });
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
