import { BadRequestException, ForbiddenException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, puede } from '../comun/permiso';
import { contextoActual } from '../contexto/contexto';
import { uuid, uuidOpcional, texto, textoOpcional, fecha, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['pendiente', 'en_curso', 'hecha', 'cancelada'] as const;

/**
 * Tareas · el trabajo interno con dueño y fecha.
 *
 * «Mis tareas» primero: lo que alguien tiene que hacer hoy no puede estar
 * enterrado debajo de lo de toda la sede. Quien tiene la tarea puede
 * marcarla aunque su rol no edite tareas: es suya.
 */
@Controller('api/v1/tareas')
export class TareasController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 1, 'ver las tareas');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tareas', 'ver');
      const yo = contextoActual().personaId;
      const { rows } = await c.query(
        `SELECT t.id, se.codigo AS sede, t.titulo, t.prioridad, t.estado, a.nombre_completo AS asignada,
                t.asignada_a = $1 AS es_mia, to_char(t.vence_en,'YYYY-MM-DD') AS vence,
                (t.estado IN ('pendiente','en_curso') AND t.vence_en < CURRENT_DATE) AS vencida,
                t.origen_modulo
           FROM plataforma.tareas t
           JOIN org.sedes se ON se.id = t.sede_id
           LEFT JOIN nucleo.v_personas a ON a.id = t.asignada_a
          WHERE ($2::boolean IS NOT TRUE OR t.asignada_a = $1)
            AND ($3::text IS NULL OR t.estado = $3)
            AND ($4::boolean IS NOT TRUE OR t.estado IN ('pendiente','en_curso'))
          ORDER BY (t.asignada_a = $1) DESC NULLS LAST, (t.estado IN ('hecha','cancelada')),
                   t.vence_en NULLS LAST, array_position(ARRAY['alta','normal','baja'], t.prioridad)
          LIMIT $5 OFFSET $6`,
        [yo, q?.mias === 'si', q?.estado ? unoDe(q.estado, 'estado', ESTADOS) : null, q?.abiertas === 'si', limite, desde]);
      const vencidas = rows.filter(r => r.vencida).length;
      return {
        total_filas: rows.length, desde, tareas: rows,
        aviso: vencidas > 0 ? `${vencidas} tarea(s) vencidas.` : null,
      };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 1, 'crear una tarea');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tareas', 'crear');
      const asignada = uuidOpcional(b?.asignadaA, 'asignadaA');
      if (asignada) {
        const { rows: [v] } = await c.query(`SELECT 1 FROM nucleo.v_personas WHERE id = $1`, [asignada]);
        if (!v) throw new ForbiddenException('Esa persona no está en su alcance.');
      }
      try {
        const { rows: [t] } = await c.query(
          `INSERT INTO plataforma.tareas (sede_id, titulo, detalle, asignada_a, vence_en, prioridad, origen_modulo, origen_id)
           VALUES ($1,$2,$3,$4,$5,COALESCE($6,'normal'),$7,$8) RETURNING id, estado`,
          [uuid(b?.sedeId, 'sedeId'), texto(b?.titulo, 'titulo', { min: 3, max: 160 }),
           textoOpcional(b?.detalle, 'detalle', { max: 4000 }), asignada, b?.venceEn ? fecha(b.venceEn, 'venceEn') : null,
           b?.prioridad ? unoDe(b.prioridad, 'prioridad', ['baja', 'normal', 'alta'] as const) : null,
           textoOpcional(b?.origenModulo, 'origenModulo', { max: 40 }), textoOpcional(b?.origenId, 'origenId', { max: 80 })]);
        return { ...t, mensaje: 'Tarea creada.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La sede o la persona no existen.');
        throw e;
      }
    });
  }

  @Post(':id/estado')
  estado(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 1, 'actualizar una tarea');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tareas', 'ver');
      const t = uuid(id, 'id');
      const { rows: [actual] } = await c.query(`SELECT asignada_a FROM plataforma.tareas WHERE id = $1`, [t]);
      if (!actual) throw new NotFoundException('Esa tarea no existe o no está a su alcance.');
      if (actual.asignada_a !== contextoActual().personaId && !(await puede(c, 'tareas', 'editar'))) {
        throw new ForbiddenException('Solo quien tiene la tarea, o quien edita tareas, puede cambiarla.');
      }
      const { rows: [r] } = await c.query(
        `UPDATE plataforma.tareas SET estado = $2 WHERE id = $1 RETURNING estado, to_char(hecha_en,'YYYY-MM-DD HH24:MI') AS hecha_en`,
        [t, unoDe(b?.estado, 'estado', ESTADOS)]);
      return { ...r, mensaje: r.estado === 'hecha' ? 'Tarea hecha.' : 'Tarea actualizada.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [TareasController] })
export class TareasModule {}
