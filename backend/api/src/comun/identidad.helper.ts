import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';

/**
 * Identidad + transacción, en UN solo paso, para toda la API.
 *
 * ⛔ POR QUÉ VAN JUNTAS. Eran dos llamadas: resolver la identidad y abrir la
 * transacción. Con un módulo funcionaba; con nueve, olvidar la segunda abre
 * una conexión SIN contexto, y una conexión sin `app.sede_ids` no ve
 * ninguna fila: el sistema fallaría de forma rara en vez de fallar claro.
 *
 * ⛔ LO QUE CAMBIÓ EL 19 DE SEPTIEMBRE DE 2026 (hallazgo H-01). Antes:
 *
 *      const personaId = req.header('X-Persona-Id');   // ← cualquiera
 *
 * Ahora la sesión la resuelve `AuthMiddleware` verificando la firma del
 * token Y preguntándole a la base si esa sesión sigue viva. Las sedes y el
 * nivel NUNCA llegan del cliente: se derivan de las asignaciones vigentes.
 *
 * ⛔ Y el punto de sustitución de Keycloak sigue siendo UNO solo:
 * `AuthService.contextoDeToken`. Cambiar a OIDC es cambiar la verificación
 * de la firma; el resto de la API no se entera.
 */
export interface SesionDePeticion {
  personaId: string; cuentaId: string; usuario: string; jti: string;
  sedeIds: string[]; nivelMax: number; alcanceGlobal: boolean;
}

export function sesionDe(req: Request): SesionDePeticion {
  const s = (req as any).sesion as SesionDePeticion | undefined;
  if (!s) {
    throw new UnauthorizedException(
      'Necesita iniciar sesión. Envíe el token en la cabecera Authorization: Bearer ‹token›.');
  }
  return s;
}

export async function conSesion<T>(
  db: DbService, req: Request, fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const s = sesionDe(req);

  /* Sin sede alcanzable no hay nada que consultar. Se dice claro en vez de
     devolver listas vacías que parecen un error de datos. */
  if (!s.alcanceGlobal && s.sedeIds.length === 0) {
    throw new ForbiddenException(
      'Su usuario no tiene ninguna sede asignada todavía. Comuníquese con la central.');
  }

  return db.enTransaccion({
    personaId: s.personaId,
    sedeIds: s.sedeIds,
    nivelMax: s.nivelMax,
    alcanceGlobal: s.alcanceGlobal,
    ip: ipDe(req),
  }, fn);
}

/** Exige un nivel mínimo de sensibilidad antes de tocar datos N3 o N4. */
export function exigirNivel(req: Request, minimo: number, que: string): void {
  const s = sesionDe(req);
  if (s.nivelMax < minimo) {
    throw new ForbiddenException(
      `Para ${que} se necesita acceso de nivel N${minimo}; su acceso llega a N${s.nivelMax}.`);
  }
}

export function ipDe(req: Request): string | null {
  const x = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return x || req.socket.remoteAddress || null;
}
