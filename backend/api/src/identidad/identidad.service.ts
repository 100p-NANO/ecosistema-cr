import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';

/**
 * Identidad y accesos: lo que gobierna el Control Tower.
 *
 * ⛔ El permiso es de CUATRO dimensiones y las cuatro viajan juntas:
 * rol × alcance × techo × vigencia. Otorgar un rol sin decir hasta dónde
 * alcanza y hasta cuándo dura no es otorgar un permiso, es abrir una
 * puerta sin marco.
 */
@Injectable()
export class IdentidadService {
  async roles(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT codigo, nombre, alcance_maximo, nivel_maximo, descripcion
         FROM identidad.roles ORDER BY nivel_maximo DESC, nombre`);
    return rows;
  }

  async modulos(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT codigo, nombre, esquema, nivel_dato, es_nucleo, exige_compuerta_legal
         FROM sistema.modulos ORDER BY orden, nombre`);
    return rows;
  }

  /** La matriz: qué puede hacer cada rol en cada módulo. */
  async matriz(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT rol, modulo, accion, nivel_max FROM sistema.matriz_permisos
        ORDER BY rol, modulo, accion`);
    return rows;
  }

  async asignacionesDe(c: PoolClient, personaId: string) {
    const { rows } = await c.query(
      `SELECT a.id, a.rol, r.nombre AS rol_nombre, a.alcance_tipo, a.alcance_id,
              s.nombre AS sede_nombre, a.nivel_max, a.vigente_desde, a.vigente_hasta,
              a.acta_referencia,
              (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE) AS vigente
         FROM identidad.asignaciones a
         LEFT JOIN identidad.roles r ON r.codigo = a.rol
         LEFT JOIN org.sedes s ON s.id = a.alcance_id
        WHERE a.persona_id = $1
        ORDER BY vigente DESC, a.vigente_desde DESC`, [personaId]);
    return rows;
  }

  /** ⭐ Qué módulos alcanza REALMENTE una persona hoy. */
  async efectivo(c: PoolClient, personaId: string) {
    const { rows } = await c.query(
      `SELECT DISTINCT m.codigo, m.nombre, m.nivel_dato,
              min(a.nivel_max) OVER (PARTITION BY m.codigo) AS por_debajo_de
         FROM identidad.asignaciones a
         JOIN sistema.matriz_permisos p ON p.rol = a.rol
         JOIN sistema.modulos m ON m.codigo = p.modulo
        WHERE a.persona_id = $1
          AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
          AND m.nivel_dato <= a.nivel_max
        ORDER BY m.codigo`, [personaId]);
    return rows;
  }

  /**
   * Otorgar uno o varios roles EN UN SOLO ACTO.
   * ⛔ Es todo o nada. Media asignación es peor que ninguna: deja a
   * alguien con un rol y sin el otro, y nadie sabe si fue a propósito.
   * La transacción de la petición ya lo garantiza: si una falla, revierte.
   */
  async otorgar(c: PoolClient, personaId: string, lista: any[]) {
    const ctx = contextoActual();
    if (!Array.isArray(lista) || !lista.length) {
      throw new BadRequestException('No se indicó ningún rol que otorgar.');
    }
    const salida = [];
    for (const a of lista) {
      if (!a.rol) throw new BadRequestException('Falta el código del rol.');
      const { rows: [rol] } = await c.query(
        `SELECT codigo, nivel_maximo, alcance_maximo FROM identidad.roles WHERE codigo=$1`, [a.rol]);
      if (!rol) throw new BadRequestException(`No existe el rol «${a.rol}».`);

      /* ⛔ Nadie otorga por encima de su propio techo. Sin esto, quien
         tiene N2 podría nombrarse a sí mismo N4 y leer datos de menores. */
      const techo = Math.min(a.nivelMax ?? rol.nivel_maximo, rol.nivel_maximo);
      if (techo > ctx.nivelMax) {
        throw new ForbiddenException(
          `No puede otorgar nivel N${techo}: su propio techo es N${ctx.nivelMax}.`);
      }
      const { rows } = await c.query(
        `INSERT INTO identidad.asignaciones
           (persona_id, rol, alcance_tipo, alcance_id, nivel_max,
            vigente_desde, vigente_hasta, otorgado_por, acta_referencia)
         VALUES ($1,$2,$3,$4,$5,coalesce($6::date,CURRENT_DATE),$7,$8,$9)
         RETURNING id, rol, alcance_tipo, alcance_id, nivel_max, vigente_desde, vigente_hasta`,
        [personaId, a.rol, a.alcanceTipo ?? rol.alcance_maximo, a.alcanceId ?? null,
         techo, a.desde ?? null, a.hasta ?? null, ctx.personaId, a.acta ?? null]);
      salida.push(rows[0]);
    }
    return { ok: true, otorgados: salida };
  }

  /** Cerrar un acceso. ⛔ No se borra: se le pone fecha de fin. */
  async cerrar(c: PoolClient, asignacionId: string, hasta?: string) {
    const { rows } = await c.query(
      `UPDATE identidad.asignaciones
          SET vigente_hasta = coalesce($2::date, CURRENT_DATE)
        WHERE id = $1 RETURNING id, rol, vigente_hasta`, [asignacionId, hasta ?? null]);
    if (!rows.length) throw new BadRequestException('No existe esa asignación, o no está a su alcance.');
    return rows[0];
  }

  /* ---------- casillas (migración 0037) ---------- */
  async atributos(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT id, codigo, etiqueta, ayuda, modulo, tipo_dato, nivel_dato, opciones, vigente
         FROM sistema.atributos ORDER BY modulo, orden, codigo`);
    return rows;
  }

  async crearAtributo(c: PoolClient, d: any) {
    if (!d?.codigo || !d?.etiqueta) throw new BadRequestException('Falta el código o la etiqueta.');
    if (d.nivel === undefined || d.nivel === null) {
      throw new BadRequestException(
        'Falta el nivel del dato. No tiene valor por defecto a propósito: quien crea la ' +
        'casilla tiene que decidir qué tan sensible es lo que va a guardar.');
    }
    const { rows } = await c.query(
      `SELECT sistema.crear_atributo($1,$2,$3,$4::sistema.tipo_dato_atributo,$5::smallint,$6::jsonb,$7) AS id`,
      [d.codigo, d.etiqueta, d.modulo ?? 'personas', d.tipo ?? 'texto',
       d.nivel, d.opciones ? JSON.stringify(d.opciones) : null, d.ayuda ?? null]);
    return { id: rows[0].id, codigo: d.codigo };
  }

  /* ── Catálogos editables (migración 0046) ─────────────────────────
     Es la respuesta a «si mañana necesito un culto de jóvenes, debe ser
     fácil»: agregar un valor es una llamada, no un despliegue. Y las
     máquinas de estado salen marcadas como cerradas, con su motivo. */

  async catalogos(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT codigo, nombre, descripcion, editable_por_sede, cerrado, motivo_cerrado,
              valores_vigentes, valores_retirados
         FROM sistema.v_catalogos ORDER BY cerrado, codigo`);
    return rows;
  }

  async valoresDeCatalogo(c: PoolClient, catalogo: string) {
    const { rows } = await c.query(
      `SELECT codigo, etiqueta, descripcion, orden, vigente, sede_id
         FROM sistema.catalogo_valores
        WHERE catalogo = $1 ORDER BY vigente DESC, orden, etiqueta`, [catalogo]);
    return rows;
  }

  async agregarValor(c: PoolClient, catalogo: string, v: {
    codigo: string; etiqueta: string; descripcion?: string | null; sedeId?: string | null; quien: string;
  }) {
    await c.query(`SELECT sistema.agregar_valor($1,$2,$3,$4,$5,$6,$7)`,
      [catalogo, v.codigo, v.etiqueta, v.descripcion ?? null, 100, v.sedeId ?? null, v.quien]);
    return { agregado: true, aviso: 'Disponible de inmediato. No hubo que desplegar nada.' };
  }

  async retirarValor(c: PoolClient, catalogo: string, codigo: string, motivo: string) {
    await c.query(`SELECT sistema.retirar_valor($1,$2,$3)`, [catalogo, codigo, motivo]);
    return { retirado: true,
             aviso: 'Las filas que ya lo usaban siguen legibles; lo que se impide es usarlo en filas nuevas.' };
  }
}
