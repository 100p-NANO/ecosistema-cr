import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, exigirUna, puede } from '../comun/permiso';
import { uuid, uuidOpcional, texto, textoOpcional, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['nuevo', 'asignado', 'en_curso', 'resuelto', 'cerrado', 'cancelado'] as const;
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const;

/**
 * Requerimientos · la mesa de servicio entre las sedes y la gerencia.
 *
 * ⛔ Lo que protege: que la consola de sonido que se cayó el domingo no se
 * olvide el lunes. El plazo lo pone la base según la prioridad (urgente
 * 4 h, alta 24 h, media 72 h, baja 7 días) y la lista ordena por lo que
 * vence primero. Lo vencido se dice arriba, no se descubre.
 */
@Controller('api/v1/requerimientos')
export class RequerimientosController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 1, 'ver los requerimientos');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'requerimientos', 'ver');
      const { rows } = await c.query(
        `SELECT r.id, se.codigo AS sede, r.categoria, cv.etiqueta AS categoria_nombre, r.asunto, r.prioridad, r.estado,
                a.nombre_completo AS asignado, rp.nombre_completo AS reportado_por,
                to_char(r.creado_en,'YYYY-MM-DD HH24:MI') AS reportado, to_char(r.vence_en,'YYYY-MM-DD HH24:MI') AS vence,
                (r.estado NOT IN ('resuelto','cerrado','cancelado') AND r.vence_en < now()) AS vencido
           FROM sistema.requerimientos r
           JOIN org.sedes se ON se.id = r.sede_id
           LEFT JOIN nucleo.v_personas a ON a.id = r.asignado_a
           LEFT JOIN nucleo.v_personas rp ON rp.id = r.reportado_por
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'categoria_requerimiento' AND cv.codigo = r.categoria
          WHERE ($1::text IS NULL OR r.estado = $1)
            AND ($2::boolean IS NOT TRUE OR r.estado NOT IN ('resuelto','cerrado','cancelado'))
          ORDER BY (r.estado IN ('resuelto','cerrado','cancelado')), r.vence_en
          LIMIT $3 OFFSET $4`,
        [q?.estado ? unoDe(q.estado, 'estado', ESTADOS) : null, q?.abiertos === 'si', limite, desde]);
      const vencidos = rows.filter(r => r.vencido).length;
      return {
        total_filas: rows.length, desde, requerimientos: rows,
        puede_atender: await puede(c, 'requerimientos', 'ATENDER_REQUERIMIENTO'),
        aviso: vencidos > 0 ? `${vencidos} requerimiento(s) vencidos sin resolver.` : null,
      };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 1, 'reportar un requerimiento');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'requerimientos', 'crear');
      try {
        const { rows: [r] } = await c.query(
          `INSERT INTO sistema.requerimientos (sede_id, categoria, asunto, detalle, prioridad)
           VALUES ($1,$2,$3,$4,COALESCE($5,'media'))
           RETURNING id, estado, prioridad, to_char(vence_en,'YYYY-MM-DD HH24:MI') AS vence`,
          [uuid(b?.sedeId, 'sedeId'), texto(b?.categoria, 'categoria', { min: 2, max: 40 }),
           texto(b?.asunto, 'asunto', { min: 5, max: 160 }), textoOpcional(b?.detalle, 'detalle', { max: 4000 }),
           b?.prioridad ? unoDe(b.prioridad, 'prioridad', PRIORIDADES) : null]);
        return { ...r, mensaje: `Requerimiento reportado. Vence el ${r.vence}.` };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('Esa sede no existe.');
        throw e;
      }
    });
  }

  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 1, 'ver un requerimiento');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'requerimientos', 'ver');
      const { rows: [r] } = await c.query(
        `SELECT r.*, se.codigo AS sede, a.nombre_completo AS asignado, rp.nombre_completo AS reportado_por_nombre,
                cv.etiqueta AS categoria_nombre,
                (r.estado NOT IN ('resuelto','cerrado','cancelado') AND r.vence_en < now()) AS vencido
           FROM sistema.requerimientos r
           JOIN org.sedes se ON se.id = r.sede_id
           LEFT JOIN nucleo.v_personas a ON a.id = r.asignado_a
           LEFT JOIN nucleo.v_personas rp ON rp.id = r.reportado_por
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'categoria_requerimiento' AND cv.codigo = r.categoria
          WHERE r.id = $1`, [uuid(id, 'id')]);
      if (!r) throw new NotFoundException('Ese requerimiento no existe o no está a su alcance.');
      return { requerimiento: r, puede_atender: await puede(c, 'requerimientos', 'ATENDER_REQUERIMIENTO') };
    });
  }

  /** Atender: asignar, avanzar, resolver (con solución), cerrar o cancelar. */
  @Post(':id/atender')
  atender(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 1, 'atender un requerimiento');
    return conSesion(this.db, req, async (c) => {
      const estado = unoDe(b?.estado, 'estado', ESTADOS);
      /* Cancelar lo puede quien lo reportó; lo demás, quien atiende. */
      if (estado === 'cancelado') await exigirUna(c, 'requerimientos', ['ATENDER_REQUERIMIENTO', 'editar']);
      else await exigir(c, 'requerimientos', 'ATENDER_REQUERIMIENTO');
      const asignado = uuidOpcional(b?.asignadoA, 'asignadoA');
      const solucion = textoOpcional(b?.solucion, 'solucion', { min: 3, max: 4000 });
      if (['resuelto', 'cerrado'].includes(estado) && !solucion) {
        const { rows: [ya] } = await c.query(`SELECT solucion FROM sistema.requerimientos WHERE id = $1`, [uuid(id, 'id')]);
        if (!ya?.solucion) throw new BadRequestException('Para resolverlo, escriba qué se hizo.');
      }
      const { rows: [r] } = await c.query(
        `UPDATE sistema.requerimientos
            SET estado = $2, asignado_a = COALESCE($3, asignado_a), solucion = COALESCE($4, solucion),
                prioridad = COALESCE($5, prioridad)
          WHERE id = $1 RETURNING estado, to_char(vence_en,'YYYY-MM-DD HH24:MI') AS vence`,
        [uuid(id, 'id'), estado, asignado, solucion, b?.prioridad ? unoDe(b.prioridad, 'prioridad', PRIORIDADES) : null]);
      if (!r) throw new NotFoundException('Ese requerimiento no existe o no está a su alcance.');
      return { ...r, mensaje: `Requerimiento ${r.estado.replace('_', ' ')}.` };
    });
  }
}

@Module({ imports: [DbModule], controllers: [RequerimientosController] })
export class RequerimientosModule {}
