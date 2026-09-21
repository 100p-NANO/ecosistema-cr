import { BadRequestException, ForbiddenException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, puede } from '../comun/permiso';
import { uuid, uuidOpcional, texto, textoOpcional, entero, booleano, paginacion } from '../comun/validar';

const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Calendario · servicios, reuniones y eventos de cada sede y de la red.
 *
 * Un evento de la red (conferencia anual, ayuno de la red) lo publica solo
 * quien alcanza toda la red, y lo ven todas las sedes. Lo de una sede lo
 * ve esa sede. La hora se guarda con zona: Bogotá, Panamá y Barcelona no
 * comparten reloj.
 */
@Controller('api/v1/calendario')
export class CalendarioController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 1, 'ver el calendario');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'calendario', 'ver');
      const dias = q?.dias === undefined ? 60 : entero(q.dias, 'dias', { min: 1, max: 366 });
      const { rows } = await c.query(
        `SELECT e.id, se.codigo AS sede, e.alcance_red, e.tipo, cv.etiqueta AS tipo_nombre, e.titulo, e.lugar,
                to_char(e.inicia AT TIME ZONE COALESCE(se.zona_horaria,'America/Bogota'),'YYYY-MM-DD HH24:MI') AS inicia,
                to_char(e.termina AT TIME ZONE COALESCE(se.zona_horaria,'America/Bogota'),'YYYY-MM-DD HH24:MI') AS termina,
                e.estado, e.publico, e.cupo, r.nombre_completo AS responsable, e.motivo_cancelacion
           FROM org.eventos e
           JOIN org.sedes se ON se.id = e.sede_id
           LEFT JOIN nucleo.v_personas r ON r.id = e.responsable_id
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_evento' AND cv.codigo = e.tipo
          WHERE e.termina >= now() - interval '1 day' AND e.inicia <= now() + make_interval(days => $1)
            AND ($2::uuid IS NULL OR e.sede_id = $2 OR e.alcance_red)
          ORDER BY e.inicia
          LIMIT $3 OFFSET $4`,
        [dias, uuidOpcional(q?.sede_id, 'sede_id'), limite, desde]);
      return { total_filas: rows.length, desde, eventos: rows,
               puede_crear: await puede(c, 'calendario', 'crear') };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 1, 'agendar un evento');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'calendario', 'crear');
      const inicia = texto(b?.inicia, 'inicia', { patron: INSTANTE });
      const termina = texto(b?.termina, 'termina', { patron: INSTANTE });
      const sede = uuid(b?.sedeId, 'sedeId');
      const responsable = uuidOpcional(b?.responsableId, 'responsableId');
      if (responsable) {
        const { rows: [v] } = await c.query(`SELECT 1 FROM nucleo.v_personas WHERE id = $1`, [responsable]);
        if (!v) throw new ForbiddenException('Esa persona no está en su alcance.');
      }
      try {
        /* La hora llega como la escribe la sede: se interpreta en SU zona. */
        const { rows: [e] } = await c.query(
          `INSERT INTO org.eventos (sede_id, alcance_red, tipo, titulo, descripcion, lugar, inicia, termina, publico, cupo, responsable_id)
           SELECT $1, $2, $3, $4, $5, $6,
                  ($7::timestamp AT TIME ZONE COALESCE(s.zona_horaria,'America/Bogota')),
                  ($8::timestamp AT TIME ZONE COALESCE(s.zona_horaria,'America/Bogota')),
                  $9, $10, $11
             FROM org.sedes s WHERE s.id = $1
           RETURNING id, estado`,
          [sede, b?.alcanceRed === undefined ? false : booleano(b.alcanceRed, 'alcanceRed'),
           texto(b?.tipo, 'tipo', { min: 2, max: 40 }), texto(b?.titulo, 'titulo', { min: 3, max: 160 }),
           textoOpcional(b?.descripcion, 'descripcion', { max: 4000 }), textoOpcional(b?.lugar, 'lugar', { max: 200 }),
           inicia, termina, b?.publico === undefined ? false : booleano(b.publico, 'publico'),
           b?.cupo === undefined || b?.cupo === null || b?.cupo === '' ? null : entero(b.cupo, 'cupo', { min: 1, max: 100000 }),
           responsable]);
        if (!e) throw new BadRequestException('Esa sede no existe.');
        return { ...e, mensaje: 'Evento agendado.' };
      } catch (err: any) {
        if (err.code === '23503') throw new BadRequestException('La sede o el responsable no existen.');
        throw err;
      }
    });
  }

  @Post(':id/cancelar')
  cancelar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 1, 'cancelar un evento');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'calendario', 'editar');
      const motivo = texto(b?.motivo, 'motivo', { min: 5, max: 500 });
      const { rows: [e] } = await c.query(
        `UPDATE org.eventos SET estado = 'cancelado', motivo_cancelacion = $2 WHERE id = $1 RETURNING estado`,
        [uuid(id, 'id'), motivo]);
      if (!e) throw new NotFoundException('Ese evento no existe o no es de su sede.');
      return { estado: e.estado, mensaje: 'Evento cancelado. El motivo queda escrito.' };
    });
  }

  @Post(':id/realizado')
  realizado(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 1, 'marcar un evento como realizado');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'calendario', 'editar');
      const { rows: [e] } = await c.query(
        `UPDATE org.eventos SET estado = 'realizado' WHERE id = $1 RETURNING estado`, [uuid(id, 'id')]);
      if (!e) throw new NotFoundException('Ese evento no existe o no es de su sede.');
      return { estado: e.estado, mensaje: 'Evento marcado como realizado.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [CalendarioController] })
export class CalendarioModule {}
