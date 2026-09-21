import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, puede } from '../comun/permiso';
import { contextoActual } from '../contexto/contexto';
import { uuid, uuidOpcional, texto, booleano, unoDe, paginacion } from '../comun/validar';

const FINALIDADES = ['convocatoria', 'pastoral', 'emergencia'] as const;
const DESTINOS = ['miembros_sede', 'grupo', 'servidores'] as const;

/**
 * Comunicaciones · envíos a grupos de personas.
 *
 * ⛔ Estación 27 del manual: nada masivo sale sin que lo apruebe OTRA
 * persona, y con un freno que lo detiene todo. Las tres reglas viven en la
 * base (cuatro ojos, texto congelado al aprobar, «enviada» solo por la
 * función que encola) y el filtro de consentimiento se aplica persona por
 * persona: a quien no autorizó no se le escribe, se le cuenta.
 */
@Controller('api/v1/comunicaciones')
export class ComunicacionesController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 2, 'ver las comunicaciones');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'ver');
      const yo = contextoActual().personaId;
      const { rows } = await c.query(
        `SELECT k.id, se.codigo AS sede, k.asunto, k.finalidad, k.destinatarios, g.nombre AS grupo, k.estado,
                a.nombre_completo AS autor, ap.nombre_completo AS aprobo, k.creada_por = $1 AS es_mia,
                to_char(k.creada_en,'YYYY-MM-DD') AS creada, to_char(k.enviada_en,'YYYY-MM-DD HH24:MI') AS enviada,
                k.encolados, k.omitidos_sin_consentimiento
           FROM crm.comunicaciones k
           JOIN org.sedes se ON se.id = k.sede_id
           LEFT JOIN grupos.grupos g ON g.id = k.grupo_id
           LEFT JOIN nucleo.v_personas a ON a.id = k.creada_por
           LEFT JOIN nucleo.v_personas ap ON ap.id = k.aprobada_por
          ORDER BY array_position(ARRAY['borrador','aprobada','enviada','cancelada'], k.estado), k.creada_en DESC
          LIMIT $2 OFFSET $3`, [yo, limite, desde]);
      const { rows: [freno] } = await c.query(`SELECT activo, motivo FROM sistema.frenos WHERE codigo = 'comunicaciones_masivas'`);
      return {
        total_filas: rows.length, desde, comunicaciones: rows, freno: freno ?? null,
        puede_aprobar: await puede(c, 'comunicaciones', 'APROBAR_COMUNICACION'),
        aviso: freno?.activo ? `El freno de envíos masivos está puesto: ${freno.motivo}. No sale nada.` : null,
      };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 2, 'escribir una comunicación');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'crear');
      const destinatarios = unoDe(b?.destinatarios, 'destinatarios', DESTINOS);
      const grupo = uuidOpcional(b?.grupoId, 'grupoId');
      if (destinatarios === 'grupo' && !grupo) throw new BadRequestException('Elija el grupo al que va el envío.');
      try {
        const { rows: [k] } = await c.query(
          `INSERT INTO crm.comunicaciones (sede_id, finalidad, asunto, cuerpo, destinatarios, grupo_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, estado`,
          [uuid(b?.sedeId, 'sedeId'), unoDe(b?.finalidad, 'finalidad', FINALIDADES),
           texto(b?.asunto, 'asunto', { min: 5, max: 160 }), texto(b?.cuerpo, 'cuerpo', { min: 20, max: 5000 }),
           destinatarios, destinatarios === 'grupo' ? grupo : null]);
        return { ...k, mensaje: 'Borrador guardado. Para enviarlo, lo aprueba otra persona.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La sede o el grupo no existen.');
        throw e;
      }
    });
  }

  /** La ficha trae el ALCANCE: a cuántos les llegaría y cuántos se quedan fuera por no haber autorizado. */
  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver una comunicación');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'ver');
      const k = uuid(id, 'id');
      const { rows: [com] } = await c.query(
        `SELECT k.*, se.codigo AS sede, g.nombre AS grupo, a.nombre_completo AS autor, ap.nombre_completo AS aprobo
           FROM crm.comunicaciones k
           JOIN org.sedes se ON se.id = k.sede_id
           LEFT JOIN grupos.grupos g ON g.id = k.grupo_id
           LEFT JOIN nucleo.v_personas a ON a.id = k.creada_por
           LEFT JOIN nucleo.v_personas ap ON ap.id = k.aprobada_por
          WHERE k.id = $1`, [k]);
      if (!com) throw new NotFoundException('Esa comunicación no existe o no está a su alcance.');
      const { rows: [alc] } = await c.query(`SELECT crm.alcance_de_comunicacion($1) AS alcance`, [k]);
      const yo = contextoActual().personaId;
      return {
        comunicacion: com, alcance: alc.alcance,
        puede_aprobar: com.creada_por !== yo && await puede(c, 'comunicaciones', 'APROBAR_COMUNICACION'),
        es_mia: com.creada_por === yo,
      };
    });
  }

  @Post(':id/aprobar')
  aprobar(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'aprobar una comunicación');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'APROBAR_COMUNICACION');
      const { rows: [k] } = await c.query(
        `UPDATE crm.comunicaciones SET estado = 'aprobada', aprobada_por = $2 WHERE id = $1 RETURNING estado`,
        [uuid(id, 'id'), contextoActual().personaId]);
      if (!k) throw new NotFoundException('Esa comunicación no existe o no está a su alcance.');
      return { estado: k.estado, mensaje: 'Aprobada. Ya se puede enviar.' };
    });
  }

  /** Devolver a borrador: para corregir el texto. La aprobación se pierde. */
  @Post(':id/devolver')
  devolver(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'devolver una comunicación a borrador');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'editar');
      const { rows: [k] } = await c.query(
        `UPDATE crm.comunicaciones SET estado = 'borrador' WHERE id = $1 RETURNING estado`, [uuid(id, 'id')]);
      if (!k) throw new NotFoundException('Esa comunicación no existe o no está a su alcance.');
      return { estado: k.estado, mensaje: 'Devuelta a borrador. Tendrá que aprobarse de nuevo.' };
    });
  }

  @Post(':id/editar')
  editar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'editar una comunicación');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'editar');
      const { rows: [k] } = await c.query(
        `UPDATE crm.comunicaciones SET asunto = $2, cuerpo = $3 WHERE id = $1 RETURNING estado`,
        [uuid(id, 'id'), texto(b?.asunto, 'asunto', { min: 5, max: 160 }), texto(b?.cuerpo, 'cuerpo', { min: 20, max: 5000 })]);
      if (!k) throw new NotFoundException('Esa comunicación no existe o no está a su alcance.');
      return { estado: k.estado, mensaje: 'Borrador actualizado.' };
    });
  }

  @Post(':id/cancelar')
  cancelar(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'cancelar una comunicación');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'editar');
      const { rows: [k] } = await c.query(
        `UPDATE crm.comunicaciones SET estado = 'cancelada' WHERE id = $1 RETURNING estado`, [uuid(id, 'id')]);
      if (!k) throw new NotFoundException('Esa comunicación no existe o no está a su alcance.');
      return { estado: k.estado, mensaje: 'Comunicación cancelada.' };
    });
  }

  @Post(':id/enviar')
  enviar(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'enviar una comunicación');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'comunicaciones', 'crear');
      const { rows: [r] } = await c.query(`SELECT crm.enviar_comunicacion($1) AS r`, [uuid(id, 'id')]);
      const x = r.r;
      return {
        ...x,
        mensaje: `En cola para ${x.encolados} persona(s).` +
          (x.omitidos_sin_consentimiento ? ` ${x.omitidos_sin_consentimiento} no autorizaron este tipo de comunicación y no la reciben.` : '') +
          (x.sin_correo ? ` ${x.sin_correo} no tienen correo registrado.` : ''),
      };
    });
  }

  /** El freno: lo pone o lo quita quien administra, con motivo. */
  @Post('freno')
  freno(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 2, 'cambiar el freno de envíos');
    return conSesion(this.db, req, async (c) => {
      const activo = booleano(b?.activo, 'activo');
      await c.query(`SELECT sistema.cambiar_freno('comunicaciones_masivas', $1, $2)`,
        [activo, texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
      return { activo, mensaje: activo ? 'Freno puesto: no sale ningún envío masivo.' : 'Freno quitado.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [ComunicacionesController] })
export class ComunicacionesModule {}
