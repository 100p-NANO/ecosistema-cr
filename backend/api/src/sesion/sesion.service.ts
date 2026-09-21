import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';

/**
 * Quién entró y qué alcanza. Es la primera pregunta de cualquier panel.
 *
 * ⛔ El prototipo respondía esto leyendo localStorage; aquí lo responde la
 * BASE, a partir de las asignaciones vigentes. Es la diferencia entre un
 * permiso que se puede editar con el inspector del navegador y uno que no.
 */
@Injectable()
export class SesionService {
  async yo(c: PoolClient) {
    const ctx = contextoActual();

    const persona = await c.query(
      `SELECT id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              email_principal, tipo_documento, numero_documento
         FROM nucleo.personas WHERE id = $1`, [ctx.personaId]);

    /* ⛔ Antes leía las asignaciones PERSONALES sin mirar la revocación:
       un rol revocado esta mañana seguía pintado como vigente, los que
       llegan por un equipo no aparecían, y las pestañas no sabían del
       interruptor de módulos por sede. Las dos listas salen ahora de la
       misma fuente que decide el permiso real (migración 0070). */
    const asignaciones = await c.query(`SELECT * FROM identidad.mis_accesos()`);
    const modulos = await c.query(`SELECT * FROM identidad.mis_modulos()`);

    const p = persona.rows[0] ?? {};
    return {
      persona: {
        id: ctx.personaId,
        nombre: [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
          .filter(Boolean).join(' '),
        correo: p.email_principal ?? null,
        documento: p.numero_documento ? `${p.tipo_documento} ${p.numero_documento}` : null,
      },
      alcance: {
        sedes: ctx.sedeIds,
        todaLaRed: ctx.alcanceGlobal,
        nivelMax: ctx.nivelMax,
      },
      asignaciones: asignaciones.rows,
      /* Lo que ESTA persona alcanza. El panel pinta contra esto y no
         contra su propia lista cableada, que es lo que permitía abrir
         una pestaña que el permiso ya negaba. */
      modulos: modulos.rows,
    };
  }
}
