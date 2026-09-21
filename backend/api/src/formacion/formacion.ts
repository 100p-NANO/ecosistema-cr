import { BadRequestException, ConflictException, ForbiddenException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { uuid, uuidOpcional, texto, textoOpcional, entero, fecha, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['inscrito', 'cursando', 'aprobado', 'reprobado', 'retirado'] as const;
const PAGOS   = ['no_aplica', 'pendiente', 'pagado', 'exonerado', 'parcial'] as const;

/**
 * Formación e Instituto.
 *
 * El catálogo (programas y cursos) es de la RED: lo define la central una
 * vez y lo usan las 36 sedes. Las COHORTES son de cada sede, porque cada
 * sede abre su grupo cuando puede y con el docente que tiene.
 *
 * ⛔ El cupo se comprueba al inscribir, no al cerrar: una cohorte de 25 con
 * 40 inscritos ya es un problema de salón, no de informe.
 */
@Controller('api/v1/formacion')
export class FormacionController {
  constructor(private readonly db: DbService) {}

  @Get('programas')
  programas(@Req() req: Request) {
    exigirNivel(req, 1, 'ver los programas');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT p.id, p.codigo, p.nombre, p.tipo, p.semestres, p.descripcion,
                (SELECT count(*) FROM formacion.cursos u WHERE u.programa_id = p.id) AS cursos
           FROM formacion.programas p ORDER BY p.nombre`);
      return { total_filas: rows.length, programas: rows };
    });
  }

  @Get('cursos')
  cursos(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 1, 'ver los cursos');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT u.id, u.codigo, u.nombre, u.semestre, u.horas, u.otorga_certificado,
                u.programa_id, p.nombre AS programa,
                pr.nombre AS prerequisito
           FROM formacion.cursos u
           JOIN formacion.programas p ON p.id = u.programa_id
           LEFT JOIN formacion.cursos pr ON pr.id = u.prerequisito_id
          WHERE ($1::uuid IS NULL OR u.programa_id = $1)
          ORDER BY p.nombre, u.semestre NULLS LAST, u.nombre`,
        [uuidOpcional(q?.programa_id, 'programa_id')]);
      return { total_filas: rows.length, cursos: rows };
    });
  }

  /** Las cohortes de la sede, con su ocupación a la vista. */
  @Get('cohortes')
  cohortes(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 2, 'ver las cohortes');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT h.id, h.codigo, h.modalidad, to_char(h.inicia,'YYYY-MM-DD') AS inicia,
                to_char(h.termina,'YYYY-MM-DD') AS termina, h.cupo, h.valor, h.moneda,
                h.sede_id, se.codigo AS sede, u.nombre AS curso, p.nombre AS programa,
                d.nombre_completo AS docente,
                (SELECT count(*) FROM formacion.inscripciones i
                  WHERE i.cohorte_id = h.id AND i.estado::text <> 'retirado') AS inscritos
           FROM formacion.cohortes h
           JOIN formacion.cursos u ON u.id = h.curso_id
           JOIN formacion.programas p ON p.id = u.programa_id
           JOIN org.sedes se ON se.id = h.sede_id
           LEFT JOIN nucleo.v_personas d ON d.id = h.docente_id
          WHERE ($1::uuid IS NULL OR h.sede_id = $1)
          ORDER BY h.inicia DESC LIMIT $2 OFFSET $3`,
        [uuidOpcional(q?.sede_id, 'sede_id'), limite, desde]);
      const llenas = rows.filter(r => r.cupo && Number(r.inscritos) > r.cupo).length;
      return {
        total_filas: rows.length, desde, cohortes: rows,
        aviso: llenas > 0 ? `${llenas} cohorte(s) por encima del cupo. Es un problema de salón, no de informe.` : null,
      };
    });
  }

  @Post('cohortes')
  crearCohorte(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 2, 'abrir una cohorte');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [h] } = await c.query(
          `INSERT INTO formacion.cohortes (curso_id, sede_id, codigo, modalidad, inicia, termina, cupo, valor, moneda, docente_id)
           VALUES ($1,$2,$3,$4,$5::date,$6::date,$7,$8,COALESCE($9,'COP'),$10)
           RETURNING id, codigo, to_char(inicia,'YYYY-MM-DD') AS inicia`,
          [uuid(b?.cursoId, 'cursoId'), uuid(b?.sedeId, 'sedeId'),
           texto(b?.codigo, 'codigo', { min: 2, max: 40 }),
           texto(b?.modalidad, 'modalidad', { min: 3, max: 30 }),
           fecha(b?.inicia, 'inicia'), b?.termina ? fecha(b.termina, 'termina') : null,
           b?.cupo === undefined || b?.cupo === null ? null : entero(b.cupo, 'cupo', { min: 1, max: 1000 }),
           b?.valor === undefined || b?.valor === null ? null : String(b.valor),
           textoOpcional(b?.moneda, 'moneda', { max: 3 }),
           uuidOpcional(b?.docenteId, 'docenteId')]);
        return { ...h, mensaje: 'Cohorte abierta.' };
      } catch (e: any) {
        if (e.code === '23505') throw new BadRequestException('Ya existe una cohorte con ese código.');
        if (e.code === '23503') throw new BadRequestException('El curso, la sede o el docente no están en su alcance.');
        throw e;
      }
    });
  }

  @Get('cohortes/:id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver una cohorte');
    return conSesion(this.db, req, async (c) => {
      const h = uuid(id, 'id');
      const { rows: [cohorte] } = await c.query(
        `SELECT h.id, h.codigo, h.modalidad, to_char(h.inicia,'YYYY-MM-DD') AS inicia,
                to_char(h.termina,'YYYY-MM-DD') AS termina, h.cupo, h.valor, h.moneda,
                u.nombre AS curso, u.horas, u.otorga_certificado, p.nombre AS programa,
                se.codigo AS sede, d.nombre_completo AS docente
           FROM formacion.cohortes h
           JOIN formacion.cursos u ON u.id = h.curso_id
           JOIN formacion.programas p ON p.id = u.programa_id
           JOIN org.sedes se ON se.id = h.sede_id
           LEFT JOIN nucleo.v_personas d ON d.id = h.docente_id
          WHERE h.id = $1`, [h]);
      if (!cohorte) throw new NotFoundException('Esa cohorte no existe o no está en su alcance.');
      const { rows: inscritos } = await c.query(
        `SELECT i.id, i.persona_id, p.nombre_completo, i.estado, i.estado_pago,
                i.valor_pagado, i.nota_final, i.inscrito_en
           FROM formacion.inscripciones i JOIN nucleo.v_personas p ON p.id = i.persona_id
          WHERE i.cohorte_id = $1 ORDER BY p.nombre_completo`, [h]);
      return {
        cohorte,
        ocupacion: { inscritos: inscritos.filter(i => i.estado !== 'retirado').length, cupo: cohorte.cupo },
        inscritos,
      };
    });
  }

  @Post('cohortes/:id/inscribir')
  inscribir(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'inscribir a alguien');
    return conSesion(this.db, req, async (c) => {
      const h = uuid(id, 'id'), p = uuid(b?.personaId, 'personaId');
      const { rows: [visible] } = await c.query(`SELECT 1 FROM nucleo.v_personas WHERE id = $1`, [p]);
      if (!visible) throw new ForbiddenException('Esa persona no está en su alcance.');
      const { rows: [ya] } = await c.query(
        `SELECT id, estado FROM formacion.inscripciones
          WHERE cohorte_id=$1 AND persona_id=$2 AND estado::text <> 'retirado'`, [h, p]);
      if (ya) return { id: ya.id, repetido: true, mensaje: 'Esa persona ya está inscrita en esta cohorte.' };
      /* ⛔ El controlador contaba distinto que la base quién ocupa asiento, y
         su comentario decía «se inscribe igual y se avisa» mientras la base
         bloqueaba en duro. Manda la base: aquí se cuenta como ella y se dice
         ANTES de intentar. */
      const { rows: [cupo] } = await c.query(
        `SELECT h.cupo, h.valor, h.moneda,
                (SELECT count(*) FROM formacion.inscripciones i
                  WHERE i.cohorte_id = h.id AND i.estado::text NOT IN ('retirado','reprobado')) AS ocupan
           FROM formacion.cohortes h WHERE h.id = $1`, [h]);
      if (!cupo) throw new NotFoundException('Esa cohorte no existe o no está en su alcance.');
      if (cupo.cupo && Number(cupo.ocupan) >= cupo.cupo) {
        throw new ConflictException(`La cohorte está llena (${cupo.ocupan} de ${cupo.cupo}). Amplíe el cupo o inscríbala en otra cohorte.`);
      }
      /* ⛔ En una cohorte con valor la base exige declarar el pago, y la
         pantalla no tenía el campo: 400 siempre. Ahora se pide y se dice. */
      const conValor = cupo.valor !== null && Number(cupo.valor) > 0;
      const estadoPago = b?.estadoPago ? unoDe(b.estadoPago, 'estadoPago', PAGOS) : null;
      if (conValor && (!estadoPago || estadoPago === 'no_aplica')) {
        throw new BadRequestException(
          `Esta cohorte cuesta ${cupo.valor} ${cupo.moneda ?? ''}`.trim() + ': diga el estado del pago (pendiente, pagado, parcial o exonerado).');
      }
      try {
        const { rows: [i] } = await c.query(
          `INSERT INTO formacion.inscripciones (cohorte_id, persona_id, estado, estado_pago)
           VALUES ($1,$2,'inscrito',COALESCE($3,'no_aplica')::formacion.estado_pago)
           RETURNING id, estado, estado_pago, inscrito_en`,
          [h, p, estadoPago]);
        return { ...i, repetido: false, mensaje: 'Inscripción registrada.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La persona no está en su alcance.');
        if (e.code === '23514') throw new BadRequestException(e.message);
        if (e.code === '42501') throw new ForbiddenException('Esa persona o esa cohorte no están en su alcance.');
        throw e;
      }
    });
  }

  /**
   * Cambiar el estado del pago de una inscripción.
   * ⛔ NO EXISTÍA: una inscripción «pendiente» no podía pasar nunca a
   * «pagado». El cambio queda en la auditoría con su referencia.
   */
  @Post('inscripciones/:id/pago')
  pago(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'registrar un pago de formación');
    const estadoPago = unoDe(b?.estadoPago, 'estadoPago', PAGOS);
    const referencia = textoOpcional(b?.referencia, 'referencia', { max: 120 });
    return conSesion(this.db, req, async (c) => {
      await c.query(`SELECT set_config('app.motivo', $1, true)`,
        [referencia ? `Pago: ${referencia}` : 'Cambio de estado de pago']);
      try {
        const { rows: [i] } = await c.query(
          `UPDATE formacion.inscripciones SET estado_pago = $2::formacion.estado_pago
            WHERE id = $1 RETURNING id, estado_pago`, [uuid(id, 'id'), estadoPago]);
        if (!i) throw new NotFoundException('Esa inscripción no existe o no está en su alcance.');
        return { ...i, mensaje: 'Estado del pago actualizado. Queda en la auditoría.' };
      } catch (e: any) {
        if (e.code === '23514') throw new BadRequestException(e.message);
        throw e;
      }
    });
  }

  @Post('inscripciones/:id/calificar')
  calificar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'calificar');
    /* ⛔ El pago se ignoraba aquí en silencio (201). Tiene su propia ruta. */
    if (b?.estadoPago !== undefined) {
      throw new BadRequestException('El pago no se cambia al calificar: use «Registrar pago» de la inscripción.');
    }
    /* ⛔ Volver a calificar dejando la nota vacía BORRABA la anterior
       (4.50 → cambiar solo el estado → vacío). Lo que no se manda, se
       conserva; borrarla es una decisión explícita. */
    const borrar = b?.borrarNota === true;
    const nota = b?.nota === undefined || b?.nota === null || b?.nota === '' ? null : String(b.nota);
    if (nota !== null && !/^\d{1,2}(\.\d{1,2})?$/.test(nota)) {
      throw new BadRequestException('«nota» debe ser un número con máximo dos decimales (por ejemplo 4.5).');
    }
    return conSesion(this.db, req, async (c) => {
      const { rows: [i] } = await c.query(
        `UPDATE formacion.inscripciones
            SET nota_final = CASE WHEN $4 THEN NULL ELSE COALESCE($2::numeric, nota_final) END,
                estado = $3::formacion.estado_inscripcion
          WHERE id = $1 RETURNING id, nota_final, estado`,
        [uuid(id, 'id'), nota, unoDe(b?.estado, 'estado', ESTADOS), borrar]);
      if (!i) throw new NotFoundException('Esa inscripción no existe o no está en su alcance.');
      return { ...i, mensaje: 'Calificación registrada.' };
    });
  }

}

@Module({ imports: [DbModule], controllers: [FormacionController] })
export class FormacionModule {}
