import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';

/**
 * Identidad + transacción, en UN solo paso, para toda la API.
 *
 * ⛔ Por qué van juntas y no separadas. El patrón original eran dos
 * llamadas: resolver la identidad y luego abrir la transacción. Con un
 * módulo funcionaba; con seis, olvidar la segunda es abrir una conexión
 * SIN contexto, y una conexión sin `app.sede_ids` no ve ninguna fila.
 * El sistema fallaría de forma rara en vez de fallar claro. Aquí no se
 * puede olvidar: o hay sesión y transacción, o no hay consulta.
 *
 * ⛔ Y el punto de sustitución de Keycloak es ESTA función, la única. Las
 * sedes y el nivel NO llegan del cliente: se derivan de las asignaciones
 * vigentes en la base. Si vinieran en la petición, cualquiera vería otra
 * sede escribiendo una cabecera.
 */
export async function conSesion<T>(
  db: DbService, req: Request, fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const personaId = req.header('X-Persona-Id');
  if (!personaId) {
    throw new UnauthorizedException(
      'Falta la identidad de la sesión. En desarrollo va en X-Persona-Id; ' +
      'en producción, en el token de Keycloak.',
    );
  }
  const ctx = await db.contextoDe(personaId, ipDe(req));
  return db.enTransaccion(ctx, fn);
}

export function ipDe(req: Request): string | null {
  const x = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return x || req.socket.remoteAddress || null;
}
