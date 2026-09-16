import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Personas y su ficha 360.
 *
 * ⭐ La ficha NO consulta once esquemas. Lee `crm.linea_tiempo`, donde
 * cada módulo deja su hecho (migración 0036). Por eso un módulo nuevo
 * aparece aquí solo, sin tocar este archivo: es toda la razón de que la
 * línea de tiempo exista.
 *
 * ⛔ Y no se filtra por nivel a mano: la RLS de la línea compara el nivel
 * DEL HECHO con el techo del lector. Un aporte (N3) no le llega a un
 * líder (N2) aunque pida la ficha completa.
 */
@Injectable()
export class PersonasService {
  async buscar(c: PoolClient, q: string | undefined, limite: number) {
    const { rows } = await c.query(
      `SELECT id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              email_principal, telefono_movil, estado, sede_id
         FROM nucleo.personas
        WHERE eliminado_en IS NULL
          AND ($1::text IS NULL OR
               (primer_nombre||' '||coalesce(primer_apellido,'')) ILIKE '%'||$1||'%' OR
               email_principal ILIKE '%'||$1||'%' OR
               numero_documento = regexp_replace(coalesce($1,''), '[^0-9A-Za-z]', '', 'g'))
        ORDER BY primer_apellido, primer_nombre
        LIMIT $2`, [q?.trim() || null, limite]);
    return rows;
  }

  async ficha(c: PoolClient, id: string) {
    const { rows } = await c.query(
      `SELECT id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              tipo_documento, numero_documento, fecha_nacimiento, email_principal,
              telefono_movil, direccion, estado, genero, estado_civil,
              nivel_compromiso, ha_sido_bautizado, fecha_bautismo, sede_id, creado_en
         FROM nucleo.personas WHERE id = $1 AND eliminado_en IS NULL`, [id]);
    if (!rows.length) throw new NotFoundException('No existe esa persona, o no está a su alcance.');
    return rows[0];
  }

  /** ⭐ La línea de tiempo: todo lo que le ha pasado, venga del módulo que venga. */
  async lineaTiempo(c: PoolClient, id: string, limite: number) {
    const { rows } = await c.query(
      `SELECT l.ocurrido_en, l.tipo, t.nombre AS tipo_nombre, t.nivel,
              l.entidad_modulo, l.entidad_tipo, l.entidad_id, l.resumen, l.detalle
         FROM crm.linea_tiempo l
         LEFT JOIN crm.tipos_hecho t ON t.codigo = l.tipo
        WHERE l.persona_id = $1
        ORDER BY l.ocurrido_en DESC
        LIMIT $2`, [id, limite]);
    return rows;
  }

  /** Las casillas que la iglesia añadió sin migración (0037). */
  async atributos(c: PoolClient, id: string) {
    const { rows } = await c.query(
      `SELECT codigo, etiqueta, modulo, tipo_dato, nivel_dato, valor, actualizado_en
         FROM nucleo.v_persona_atributos WHERE persona_id = $1
        ORDER BY modulo, codigo`, [id]);
    return rows;
  }

  async fijarAtributo(c: PoolClient, id: string, codigo: string, valor: any) {
    const { rows: [attr] } = await c.query(
      `SELECT id, tipo_dato, opciones FROM sistema.atributos WHERE codigo = $1 AND vigente`, [codigo]);
    if (!attr) throw new NotFoundException(`No existe la casilla «${codigo}».`);

    /* ⛔ Si la casilla es de opción cerrada, el valor tiene que estar en
       la lista. Un desplegable que acepta texto libre deja de ser un
       desplegable y nadie podrá agrupar por él después. */
    if (['opcion','multiopcion'].includes(attr.tipo_dato) && attr.opciones) {
      const permitidos: string[] = attr.opciones;
      const vs = Array.isArray(valor) ? valor : [valor];
      const malo = vs.find(v => !permitidos.includes(v));
      if (malo !== undefined) {
        throw new BadRequestException(
          `«${malo}» no es una opción de esta casilla. Las válidas son: ${permitidos.join(', ')}.`);
      }
    }
    const { rows } = await c.query(
      `INSERT INTO nucleo.persona_atributos (persona_id, atributo_id, valor, actualizado_en)
       VALUES ($1,$2,$3::jsonb, now())
       ON CONFLICT (persona_id, atributo_id)
       DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()
       RETURNING valor, actualizado_en`,
      [id, attr.id, JSON.stringify(valor)]);
    if (!rows.length) {
      throw new BadRequestException('Esa casilla está por encima de su nivel de acceso.');
    }
    return rows[0];
  }

  /** «Tráeme todos los que…»: el arrastre que pidió Daniel. */
  async porAtributo(c: PoolClient, codigo: string, valor: any) {
    const { rows } = await c.query(
      `SELECT pa.persona_id, p.primer_nombre, p.primer_apellido, p.sede_id, pa.valor
         FROM sistema.personas_con_atributo($1, $2::jsonb) pa
         JOIN nucleo.personas p ON p.id = pa.persona_id
        WHERE p.eliminado_en IS NULL
        ORDER BY p.primer_apellido`,
      [codigo, valor === undefined ? null : JSON.stringify(valor)]);
    return rows;
  }
}
