import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, puede } from '../comun/permiso';
import { uuid, texto, textoOpcional, fecha, booleano, unoDe, paginacion } from '../comun/validar';

/**
 * Temáticas y enseñanza · qué se predica y se enseña, serie por serie.
 *
 * Es contenido, no personas. Una serie de la red (la que dirige la sede
 * principal) la ven todas las sedes para predicar alineadas; cada sede
 * lleva sus propias enseñanzas dentro de sus series.
 */
@Controller('api/v1/tematicas')
export class TematicasController {
  constructor(private readonly db: DbService) {}

  @Get()
  series(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 1, 'ver las temáticas');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tematicas', 'ver');
      const { rows } = await c.query(
        `SELECT s.id, se.codigo AS sede, s.alcance_red, s.titulo, s.descripcion, s.estado,
                to_char(s.inicia,'YYYY-MM-DD') AS inicia, to_char(s.termina,'YYYY-MM-DD') AS termina,
                (SELECT count(*) FROM formacion.ensenanzas e WHERE e.serie_id = s.id)::int AS ensenanzas,
                (SELECT to_char(max(e.fecha),'YYYY-MM-DD') FROM formacion.ensenanzas e WHERE e.serie_id = s.id) AS ultima
           FROM formacion.series s JOIN org.sedes se ON se.id = s.sede_id
          ORDER BY (s.estado = 'en_curso') DESC, s.inicia DESC NULLS LAST
          LIMIT $1 OFFSET $2`, [limite, desde]);
      return { total_filas: rows.length, desde, series: rows, puede_crear: await puede(c, 'tematicas', 'crear') };
    });
  }

  @Post()
  crearSerie(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 1, 'crear una serie');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tematicas', 'crear');
      try {
        const { rows: [s] } = await c.query(
          `INSERT INTO formacion.series (sede_id, alcance_red, titulo, descripcion, inicia, termina)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, estado`,
          [uuid(b?.sedeId, 'sedeId'), b?.alcanceRed === undefined ? false : booleano(b.alcanceRed, 'alcanceRed'),
           texto(b?.titulo, 'titulo', { min: 3, max: 160 }), textoOpcional(b?.descripcion, 'descripcion', { max: 4000 }),
           b?.inicia ? fecha(b.inicia, 'inicia') : null, b?.termina ? fecha(b.termina, 'termina') : null]);
        return { ...s, mensaje: 'Serie creada.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('Esa sede no existe.');
        throw e;
      }
    });
  }

  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 1, 'ver una serie');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tematicas', 'ver');
      const s = uuid(id, 'id');
      const { rows: [serie] } = await c.query(
        `SELECT s.*, se.codigo AS sede FROM formacion.series s JOIN org.sedes se ON se.id = s.sede_id WHERE s.id = $1`, [s]);
      if (!serie) throw new NotFoundException('Esa serie no existe o no está a su alcance.');
      const { rows: ensenanzas } = await c.query(
        `SELECT e.id, e.titulo, to_char(e.fecha,'YYYY-MM-DD') AS fecha, e.predicador, e.pasaje, e.resumen, e.recursos,
                se.codigo AS sede
           FROM formacion.ensenanzas e JOIN org.sedes se ON se.id = e.sede_id
          WHERE e.serie_id = $1 ORDER BY e.fecha`, [s]);
      return { serie, ensenanzas, puede_editar: await puede(c, 'tematicas', 'editar') };
    });
  }

  @Post(':id/ensenanzas')
  agregar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 1, 'agregar una enseñanza');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tematicas', 'crear');
      const { rows: [e] } = await c.query(
        `INSERT INTO formacion.ensenanzas (serie_id, sede_id, titulo, fecha, predicador, pasaje, resumen, recursos)
         SELECT s.id, s.sede_id, $2, $3, $4, $5, $6, $7 FROM formacion.series s WHERE s.id = $1
         RETURNING id`,
        [uuid(id, 'id'), texto(b?.titulo, 'titulo', { min: 3, max: 160 }), fecha(b?.fecha, 'fecha'),
         textoOpcional(b?.predicador, 'predicador', { max: 120 }), textoOpcional(b?.pasaje, 'pasaje', { max: 120 }),
         textoOpcional(b?.resumen, 'resumen', { max: 4000 }), textoOpcional(b?.recursos, 'recursos', { max: 1000 })]);
      if (!e) throw new NotFoundException('Esa serie no existe o no está a su alcance.');
      return { id: e.id, mensaje: 'Enseñanza agregada a la serie.' };
    });
  }

  @Post(':id/estado')
  estado(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 1, 'cambiar el estado de una serie');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'tematicas', 'editar');
      const { rows: [s] } = await c.query(
        `UPDATE formacion.series SET estado = $2 WHERE id = $1 RETURNING estado`,
        [uuid(id, 'id'), unoDe(b?.estado, 'estado', ['planeada', 'en_curso', 'terminada'] as const)]);
      if (!s) throw new NotFoundException('Esa serie no existe o no es de su sede.');
      return { estado: s.estado, mensaje: 'Serie actualizada.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [TematicasController] })
export class TematicasModule {}
