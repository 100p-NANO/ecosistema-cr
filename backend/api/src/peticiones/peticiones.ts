import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, puede } from '../comun/permiso';
import { contextoActual } from '../contexto/contexto';
import { uuid, uuidOpcional, texto, textoOpcional, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['enviada', 'en_revision', 'aprobada', 'rechazada', 'cancelada'] as const;
const PRIORIDADES = ['baja', 'normal', 'alta', 'urgente'] as const;

/**
 * Peticiones internas · lo que una sede o un equipo le pide a la dirección.
 *
 * ⛔ Lo que protege: que una petición no se quede en un chat. Cada una
 * tiene quién la pidió, cuándo, en qué estado va y quién la decidió. Y la
 * regla que la base no deja saltar: nadie decide lo que él mismo pidió.
 */
@Controller('api/v1/peticiones')
export class PeticionesController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 2, 'ver las peticiones internas');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'peticiones', 'ver');
      const { rows } = await c.query(
        `SELECT pi.id, se.codigo AS sede, pi.tipo, cv.etiqueta AS tipo_nombre, pi.asunto, pi.prioridad, pi.estado,
                s.nombre_completo AS solicitante, u.nombre AS dirigida_a,
                to_char(pi.creado_en,'YYYY-MM-DD') AS fecha, CURRENT_DATE - pi.creado_en::date AS dias,
                d.nombre_completo AS decidida_por, to_char(pi.decidida_en,'YYYY-MM-DD') AS decidida_en,
                pi.solicitante_id = $1 AS es_mia
           FROM sistema.peticiones_internas pi
           JOIN org.sedes se ON se.id = pi.sede_id
           LEFT JOIN nucleo.v_personas s ON s.id = pi.solicitante_id
           LEFT JOIN nucleo.v_personas d ON d.id = pi.decidida_por
           LEFT JOIN org.unidades u ON u.id = pi.dirigida_a
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_peticion_interna' AND cv.codigo = pi.tipo
          WHERE ($2::text IS NULL OR pi.estado = $2)
            AND ($3::boolean IS NOT TRUE OR pi.solicitante_id = $1)
          ORDER BY (pi.estado IN ('enviada','en_revision')) DESC,
                   array_position(ARRAY['urgente','alta','normal','baja'], pi.prioridad), pi.creado_en
          LIMIT $4 OFFSET $5`,
        [contextoActual().personaId, q?.estado ? unoDe(q.estado, 'estado', ESTADOS) : null,
         q?.mias === 'si', limite, desde]);
      const esperando = rows.filter(r => ['enviada', 'en_revision'].includes(r.estado) && r.dias > 7).length;
      return {
        total_filas: rows.length, desde, peticiones: rows,
        puede_decidir: await puede(c, 'peticiones', 'DECIDIR_PETICION'),
        aviso: esperando > 0 ? `${esperando} petición(es) llevan más de una semana sin decisión.` : null,
      };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 2, 'enviar una petición interna');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'peticiones', 'crear');
      try {
        const { rows: [p] } = await c.query(
          `INSERT INTO sistema.peticiones_internas (sede_id, tipo, asunto, detalle, prioridad, dirigida_a)
           VALUES ($1,$2,$3,$4,COALESCE($5,'normal'),$6) RETURNING id, estado`,
          [uuid(b?.sedeId, 'sedeId'), texto(b?.tipo, 'tipo', { min: 2, max: 40 }),
           texto(b?.asunto, 'asunto', { min: 5, max: 160 }), texto(b?.detalle, 'detalle', { min: 10, max: 4000 }),
           b?.prioridad ? unoDe(b.prioridad, 'prioridad', PRIORIDADES) : null, uuidOpcional(b?.dirigidaA, 'dirigidaA')]);
        return { ...p, mensaje: 'Petición enviada a la dirección.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La sede o la unidad de destino no existen.');
        throw e;
      }
    });
  }

  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver una petición interna');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'peticiones', 'ver');
      const { rows: [p] } = await c.query(
        `SELECT pi.*, se.codigo AS sede, s.nombre_completo AS solicitante, d.nombre_completo AS decidida_por_nombre,
                u.nombre AS dirigida_a_nombre, cv.etiqueta AS tipo_nombre
           FROM sistema.peticiones_internas pi
           JOIN org.sedes se ON se.id = pi.sede_id
           LEFT JOIN nucleo.v_personas s ON s.id = pi.solicitante_id
           LEFT JOIN nucleo.v_personas d ON d.id = pi.decidida_por
           LEFT JOIN org.unidades u ON u.id = pi.dirigida_a
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_peticion_interna' AND cv.codigo = pi.tipo
          WHERE pi.id = $1`, [uuid(id, 'id')]);
      if (!p) throw new NotFoundException('Esa petición no existe o no está a su alcance.');
      return { peticion: p, es_mia: p.solicitante_id === contextoActual().personaId,
               puede_decidir: await puede(c, 'peticiones', 'DECIDIR_PETICION') };
    });
  }

  /** Decidir: revisar, aprobar o rechazar. La decisión se escribe; lo propio no se decide. */
  @Post(':id/decidir')
  decidir(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'decidir una petición interna');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'peticiones', 'DECIDIR_PETICION');
      const estado = unoDe(b?.estado, 'estado', ['en_revision', 'aprobada', 'rechazada'] as const);
      const decision = textoOpcional(b?.decision, 'decision', { min: 3, max: 2000 });
      if (estado !== 'en_revision' && !decision) throw new BadRequestException('Escriba la decisión: quien pidió tiene que saber por qué.');
      const yo = contextoActual().personaId;
      const { rows: [p] } = await c.query(
        `UPDATE sistema.peticiones_internas
            SET estado = $2, decision = COALESCE($3, decision),
                decidida_por = CASE WHEN $2 IN ('aprobada','rechazada') THEN $4::uuid ELSE decidida_por END
          WHERE id = $1 RETURNING estado`, [uuid(id, 'id'), estado, decision, yo]);
      if (!p) throw new NotFoundException('Esa petición no existe o no está a su alcance.');
      return { estado: p.estado, mensaje: estado === 'en_revision' ? 'Marcada en revisión.' : `Petición ${p.estado}.` };
    });
  }

  /** Quien pidió puede retirar su petición mientras no se haya decidido. */
  @Post(':id/cancelar')
  cancelar(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'cancelar una petición interna');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'peticiones', 'crear');
      const { rows: [p] } = await c.query(
        `UPDATE sistema.peticiones_internas SET estado = 'cancelada'
          WHERE id = $1 AND solicitante_id = $2 RETURNING estado`, [uuid(id, 'id'), contextoActual().personaId]);
      if (!p) throw new NotFoundException('Solo quien pidió puede retirar su petición.');
      return { estado: p.estado, mensaje: 'Petición retirada.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [PeticionesController] })
export class PeticionesModule {}
