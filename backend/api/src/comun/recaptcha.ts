import { BadRequestException, Logger } from '@nestjs/common';
import { llamarTercero } from './saliente';

const log = new Logger('reCAPTCHA');
let avisado = false;

/**
 * El formulario público de casaroca.org no tiene sesión: el reCAPTCHA es
 * lo único que separa a una persona de un robot llenando la bandeja.
 *
 * ⛔ Sin `RECAPTCHA_SECRET` NO se valida, y se dice en el log una vez.
 *    Es el modo de desarrollo; en producción el secreto sale de Secret
 *    Manager (ver infra/gcp). Fallar cerrado aquí dejaría al equipo sin
 *    poder probar el formulario en su equipo.
 */
export async function verificarRecaptcha(token: string | undefined, ip: string | null): Promise<void> {
  const secreto = process.env.RECAPTCHA_SECRET;
  if (!secreto) {
    if (!avisado) {
      log.warn('RECAPTCHA_SECRET no está configurado: el formulario público NO se está validando.');
      avisado = true;
    }
    return;
  }
  if (!token) throw new BadRequestException('Falta la verificación reCAPTCHA.');

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip) cuerpo.set('remoteip', ip);
  const r = await llamarTercero('recaptcha', 'https://www.google.com/recaptcha/api/siteverify',
    { method: 'POST', body: cuerpo }, { esperaMs: 5_000 });
  /* ⛔ MODO DEGRADADO, decidido y escrito (estación 23 del manual): si
     Google no responde, el formulario de «soy nuevo» NO se cierra. Una
     persona que visitó la iglesia y deja su contacto vale más que el riesgo
     de un robot, y los robots siguen frenados por el límite de peticiones
     por IP (`limite.ts`). Queda en el log para revisarlo. Un «no es
     humano» de Google, en cambio, sí se rechaza. */
  if (!r.ok) {
    if (r.pasajero) {
      log.warn(`reCAPTCHA sin respuesta (${r.error}): se acepta en modo degradado. IP ${ip ?? '-'}`);
      return;
    }
    throw new BadRequestException({ error: 'No pudimos verificar que no es un robot.', codigo_error: 'RECAPTCHA' });
  }
  const d = await r.respuesta.json().catch(() => ({})) as { success?: boolean; score?: number };

  // reCAPTCHA v3 devuelve un puntaje; v2 solo `success`. 0.5 es el umbral que recomienda Google.
  const umbral = Number(process.env.RECAPTCHA_UMBRAL ?? 0.5);
  if (!d.success || (typeof d.score === 'number' && d.score < umbral)) {
    throw new BadRequestException({ error: 'No pudimos verificar que no es un robot.', codigo_error: 'RECAPTCHA' });
  }
}
