import { BadRequestException, ForbiddenException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir, puede } from '../comun/permiso';
import { uuid, uuidOpcional, texto, textoOpcional, fecha, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['abierto', 'en_tramite', 'cerrado'] as const;

/**
 * Legal · N3 · contratos, arriendos, derechos de petición, tutelas.
 *
 * ⛔ Lo que protege: que un término no se venza por olvido y que lo que se
 * hizo quede escrito sin poder reescribirse. Las actuaciones se AGREGAN:
 * la base no deja editarlas ni borrarlas. Toda lectura de la ficha queda
 * en la bitácora, porque aquí vive información de terceros.
 */
@Controller('api/v1/legal')
export class LegalController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 3, 'ver los asuntos legales');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'legal', 'ver');
      const { rows } = await c.query(
        `SELECT a.id, se.codigo AS sede, a.tipo, cv.etiqueta AS tipo_nombre, a.titulo, a.estado,
                r.nombre_completo AS responsable, to_char(a.vence_en,'YYYY-MM-DD') AS vence,
                (a.estado <> 'cerrado' AND a.vence_en IS NOT NULL AND a.vence_en <= CURRENT_DATE + 15) AS vence_pronto,
                (SELECT count(*) FROM plataforma.asuntos_legales_notas n WHERE n.asunto_id = a.id)::int AS actuaciones
           FROM plataforma.asuntos_legales a
           JOIN org.sedes se ON se.id = a.sede_id
           LEFT JOIN nucleo.v_personas r ON r.id = a.responsable_id
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_asunto_legal' AND cv.codigo = a.tipo
          WHERE ($1::text IS NULL OR a.estado = $1)
          ORDER BY (a.estado = 'cerrado'), a.vence_en NULLS LAST, a.creado_en DESC
          LIMIT $2 OFFSET $3`,
        [q?.estado ? unoDe(q.estado, 'estado', ESTADOS) : null, limite, desde]);
      if (rows.length) {
        await c.query(`SELECT plataforma.registrar_lectura('plataforma','asuntos_legales','lista',3::smallint,$1,$2)`,
          ['lista de asuntos legales', rows.length]);
      }
      const pronto = rows.filter(r => r.vence_pronto).length;
      return { total_filas: rows.length, desde, asuntos: rows, puede_crear: await puede(c, 'legal', 'crear'),
               aviso: pronto > 0 ? `${pronto} asunto(s) con término en los próximos 15 días o ya vencido.` : null };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 3, 'abrir un asunto legal');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'legal', 'crear');
      for (const campo of ['personaId', 'responsableId'] as const) {
        const p = uuidOpcional(b?.[campo], campo);
        if (p) {
          const { rows: [v] } = await c.query(`SELECT 1 FROM nucleo.v_personas WHERE id = $1`, [p]);
          if (!v) throw new ForbiddenException('Esa persona no está en su alcance.');
        }
      }
      try {
        const { rows: [a] } = await c.query(
          `INSERT INTO plataforma.asuntos_legales (sede_id, tipo, titulo, contraparte, persona_id, responsable_id, vence_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, estado`,
          [uuid(b?.sedeId, 'sedeId'), texto(b?.tipo, 'tipo', { min: 2, max: 40 }), texto(b?.titulo, 'titulo', { min: 5, max: 200 }),
           textoOpcional(b?.contraparte, 'contraparte', { max: 200 }), uuidOpcional(b?.personaId, 'personaId'),
           uuidOpcional(b?.responsableId, 'responsableId'), b?.venceEn ? fecha(b.venceEn, 'venceEn') : null]);
        return { ...a, mensaje: 'Asunto legal abierto.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La sede o la persona no existen.');
        throw e;
      }
    });
  }

  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 3, 'ver un asunto legal');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'legal', 'ver');
      const a = uuid(id, 'id');
      const { rows: [asunto] } = await c.query(
        `SELECT a.*, se.codigo AS sede, r.nombre_completo AS responsable, p.nombre_completo AS persona,
                cv.etiqueta AS tipo_nombre
           FROM plataforma.asuntos_legales a
           JOIN org.sedes se ON se.id = a.sede_id
           LEFT JOIN nucleo.v_personas r ON r.id = a.responsable_id
           LEFT JOIN nucleo.v_personas p ON p.id = a.persona_id
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_asunto_legal' AND cv.codigo = a.tipo
          WHERE a.id = $1`, [a]);
      if (!asunto) throw new NotFoundException('Ese asunto no existe o no está a su alcance.');
      await c.query(`SELECT plataforma.registrar_lectura('plataforma','asuntos_legales',$1,3::smallint,$2)`,
        [a, 'ficha del asunto legal con sus actuaciones']);
      const { rows: actuaciones } = await c.query(
        `SELECT to_char(n.escrita_en,'YYYY-MM-DD HH24:MI') AS cuando, COALESCE(x.nombre_completo,'Otra sede') AS autor, n.contenido
           FROM plataforma.asuntos_legales_notas n LEFT JOIN nucleo.v_personas x ON x.id = n.autor_id
          WHERE n.asunto_id = $1 ORDER BY n.escrita_en`, [a]);
      return { asunto, actuaciones, puede_editar: await puede(c, 'legal', 'editar') };
    });
  }

  /** Una actuación se agrega; no se edita ni se borra. */
  @Post(':id/actuaciones')
  actuar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'registrar una actuación');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'legal', 'editar');
      const { rows: [n] } = await c.query(
        `INSERT INTO plataforma.asuntos_legales_notas (asunto_id, sede_id, contenido)
         SELECT a.id, a.sede_id, $2 FROM plataforma.asuntos_legales a WHERE a.id = $1 RETURNING id`,
        [uuid(id, 'id'), texto(b?.contenido, 'contenido', { min: 5, max: 4000 })]);
      if (!n) throw new NotFoundException('Ese asunto no existe o no está a su alcance.');
      return { id: n.id, mensaje: 'Actuación registrada. No se puede editar después.' };
    });
  }

  @Post(':id/estado')
  estado(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'cambiar el estado de un asunto legal');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'legal', 'editar');
      const estado = unoDe(b?.estado, 'estado', ESTADOS);
      const resultado = textoOpcional(b?.resultado, 'resultado', { min: 5, max: 4000 });
      if (estado === 'cerrado' && !resultado) throw new BadRequestException('Para cerrar el asunto, escriba cómo terminó.');
      const { rows: [a] } = await c.query(
        `UPDATE plataforma.asuntos_legales SET estado = $2, resultado = COALESCE($3, resultado),
                vence_en = COALESCE($4, vence_en)
          WHERE id = $1 RETURNING estado`,
        [uuid(id, 'id'), estado, resultado, b?.venceEn ? fecha(b.venceEn, 'venceEn') : null]);
      if (!a) throw new NotFoundException('Ese asunto no existe o no está a su alcance.');
      return { estado: a.estado, mensaje: 'Asunto actualizado.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [LegalController] })
export class LegalModule {}
