import { BadRequestException, ForbiddenException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, puede } from '../comun/permiso';
import { uuid, uuidOpcional, texto, textoOpcional, entero, fecha, monto, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['planeada', 'en_curso', 'suspendida', 'terminada', 'cancelada'] as const;

/**
 * Construcción · las obras físicas de cada sede.
 *
 * El avance y lo ejecutado salen de los HITOS: nadie los escribe a mano en
 * dos sitios. Lo que importa ver de un vistazo es cuánto va contra cuánto
 * se presupuestó, y la lista lo trae calculado.
 */
@Controller('api/v1/construccion')
export class ConstruccionController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 1, 'ver las obras');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'construccion', 'ver');
      const { rows } = await c.query(
        `SELECT o.id, se.codigo AS sede, o.nombre, o.tipo, cv.etiqueta AS tipo_nombre, o.estado, o.avance_pct,
                o.presupuesto, o.ejecutado, o.moneda,
                CASE WHEN o.presupuesto > 0 THEN round(100 * o.ejecutado / o.presupuesto) END AS ejecutado_pct,
                to_char(o.termina_estimado,'YYYY-MM-DD') AS termina_estimado,
                r.nombre_completo AS responsable
           FROM org.obras o
           JOIN org.sedes se ON se.id = o.sede_id
           LEFT JOIN nucleo.v_personas r ON r.id = o.responsable_id
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_obra' AND cv.codigo = o.tipo
          WHERE ($1::text IS NULL OR o.estado = $1)
          ORDER BY (o.estado IN ('terminada','cancelada')), o.creado_en DESC
          LIMIT $2 OFFSET $3`,
        [q?.estado ? unoDe(q.estado, 'estado', ESTADOS) : null, limite, desde]);
      const pasadas = rows.filter(r => r.ejecutado_pct !== null && Number(r.ejecutado_pct) > Number(r.avance_pct) + 15).length;
      return { total_filas: rows.length, desde, obras: rows, puede_crear: await puede(c, 'construccion', 'crear'),
               aviso: pasadas > 0 ? `${pasadas} obra(s) gastan más de lo que avanzan (más de 15 puntos de diferencia).` : null };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 1, 'registrar una obra');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'construccion', 'crear');
      const responsable = uuidOpcional(b?.responsableId, 'responsableId');
      if (responsable) {
        const { rows: [v] } = await c.query(`SELECT 1 FROM nucleo.v_personas WHERE id = $1`, [responsable]);
        if (!v) throw new ForbiddenException('Esa persona no está en su alcance.');
      }
      try {
        const { rows: [o] } = await c.query(
          `INSERT INTO org.obras (sede_id, nombre, tipo, presupuesto, moneda, inicia, termina_estimado, responsable_id, descripcion)
           VALUES ($1,$2,$3,$4,COALESCE($5,'COP'),$6,$7,$8,$9) RETURNING id, estado`,
          [uuid(b?.sedeId, 'sedeId'), texto(b?.nombre, 'nombre', { min: 3, max: 160 }), texto(b?.tipo, 'tipo', { min: 2, max: 40 }),
           b?.presupuesto === undefined || b?.presupuesto === '' ? null : monto(b.presupuesto, 'presupuesto'),
           b?.moneda ? texto(b.moneda, 'moneda', { patron: /^[A-Z]{3}$/ }) : null,
           b?.inicia ? fecha(b.inicia, 'inicia') : null, b?.terminaEstimado ? fecha(b.terminaEstimado, 'terminaEstimado') : null,
           responsable, textoOpcional(b?.descripcion, 'descripcion', { max: 4000 })]);
        return { ...o, mensaje: 'Obra registrada.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La sede o el responsable no existen.');
        throw e;
      }
    });
  }

  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 1, 'ver una obra');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'construccion', 'ver');
      const o = uuid(id, 'id');
      const { rows: [obra] } = await c.query(
        `SELECT o.*, se.codigo AS sede, r.nombre_completo AS responsable, cv.etiqueta AS tipo_nombre
           FROM org.obras o JOIN org.sedes se ON se.id = o.sede_id
           LEFT JOIN nucleo.v_personas r ON r.id = o.responsable_id
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_obra' AND cv.codigo = o.tipo
          WHERE o.id = $1`, [o]);
      if (!obra) throw new NotFoundException('Esa obra no existe o no está a su alcance.');
      const { rows: hitos } = await c.query(
        `SELECT to_char(h.fecha,'YYYY-MM-DD') AS fecha, h.descripcion, h.avance_pct, h.gasto,
                COALESCE(x.nombre_completo,'sin dato') AS registro
           FROM org.obras_hitos h LEFT JOIN nucleo.v_personas x ON x.id = h.registrado_por
          WHERE h.obra_id = $1 ORDER BY h.fecha, h.registrado_en`, [o]);
      return { obra, hitos, puede_editar: await puede(c, 'construccion', 'editar') };
    });
  }

  @Post(':id/hitos')
  hito(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 1, 'registrar un hito');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'construccion', 'editar');
      const { rows: [h] } = await c.query(
        `INSERT INTO org.obras_hitos (obra_id, sede_id, fecha, descripcion, avance_pct, gasto)
         SELECT o.id, o.sede_id, $2, $3, $4, $5 FROM org.obras o WHERE o.id = $1 RETURNING id`,
        [uuid(id, 'id'), fecha(b?.fecha, 'fecha'), texto(b?.descripcion, 'descripcion', { min: 5, max: 2000 }),
         b?.avancePct === undefined || b?.avancePct === '' ? null : entero(b.avancePct, 'avancePct', { min: 0, max: 100 }),
         b?.gasto === undefined || b?.gasto === '' ? null : monto(b.gasto, 'gasto')]);
      if (!h) throw new NotFoundException('Esa obra no existe o no está a su alcance.');
      const { rows: [o] } = await c.query(`SELECT avance_pct, ejecutado, estado FROM org.obras WHERE id = $1`, [uuid(id, 'id')]);
      return { id: h.id, obra: o, mensaje: `Hito registrado. La obra va en ${o.avance_pct} %.` };
    });
  }

  @Post(':id/estado')
  estado(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 1, 'cambiar el estado de una obra');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'construccion', 'editar');
      const estado = unoDe(b?.estado, 'estado', ESTADOS);
      const { rows: [o] } = await c.query(
        `UPDATE org.obras SET estado = $2,
                avance_pct = CASE WHEN $2 = 'terminada' THEN 100 ELSE avance_pct END,
                terminada_en = CASE WHEN $2 = 'terminada' THEN CURRENT_DATE ELSE terminada_en END
          WHERE id = $1 RETURNING estado`, [uuid(id, 'id'), estado]);
      if (!o) throw new NotFoundException('Esa obra no existe o no está a su alcance.');
      return { estado: o.estado, mensaje: 'Obra actualizada.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [ConstruccionController] })
export class ConstruccionModule {}
