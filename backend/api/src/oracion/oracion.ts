import { BadRequestException, ForbiddenException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel, ipDe } from '../comun/identidad.helper';
import { exigir, exigirUna, puede } from '../comun/permiso';
import { contextoPublico } from '../contexto/contexto';
import { verificarRecaptcha } from '../comun/recaptcha';
import { limitarPorClave } from '../comun/limite';
import { uuid, uuidOpcional, texto, textoOpcional, booleano, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['abierta', 'en_oracion', 'respondida', 'cerrada'] as const;

/**
 * Oración · N3.
 *
 * ⛔ Lo que este módulo protege: que lo que alguien confía al pedir oración
 * no circule. Tres puertas, y las tres están en la base, no aquí:
 *  · lo CONFIDENCIAL solo lo ven quien lo registró y quien tenga
 *    VER_CONFIDENCIAL_ORACION (los pastores de la sede);
 *  · lo que no se COMPARTIÓ con los intercesores solo lo ve quien atiende
 *    oración; el intercesor ve lo que se le compartió;
 *  · toda lectura (lista o ficha) deja rastro en la bitácora de lectura.
 * La lista no trae el detalle ni el contacto: eso solo sale en la ficha.
 */
@Controller('api/v1/oracion')
export class OracionController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 3, 'ver las peticiones de oración');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'oracion', 'ver');
      const { rows } = await c.query(
        `SELECT o.id, se.codigo AS sede, o.categoria, cv.etiqueta AS categoria_nombre, o.resumen,
                COALESCE(p.nombre_completo, o.nombre_contacto) AS quien, o.confidencial,
                o.compartir_con_intercesores AS compartida, o.estado, o.origen,
                to_char(o.creado_en,'YYYY-MM-DD') AS fecha,
                (SELECT count(*) FROM crm.oraciones_hechas h WHERE h.peticion_id = o.id)::int AS veces_orada,
                (SELECT to_char(max(h.oro_en),'YYYY-MM-DD') FROM crm.oraciones_hechas h WHERE h.peticion_id = o.id) AS ultima_oracion
           FROM crm.peticiones_oracion o
           JOIN org.sedes se ON se.id = o.sede_id
           LEFT JOIN nucleo.v_personas p ON p.id = o.persona_id
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'categoria_oracion' AND cv.codigo = o.categoria
          WHERE ($1::text IS NULL OR o.estado = $1)
            AND ($2::uuid IS NULL OR o.sede_id = $2)
            AND ($3::text IS NULL OR o.categoria = $3)
          ORDER BY (o.estado IN ('abierta','en_oracion')) DESC, o.creado_en DESC
          LIMIT $4 OFFSET $5`,
        [q?.estado ? unoDe(q.estado, 'estado', ESTADOS) : null, uuidOpcional(q?.sede_id, 'sede_id'),
         textoOpcional(q?.categoria, 'categoria', { max: 40 }), limite, desde]);
      /* La lista de un dato N3 también es una lectura: se registra cuántas. */
      if (rows.length) {
        await c.query(`SELECT plataforma.registrar_lectura('crm','peticiones_oracion','lista',3::smallint,$1,$2)`,
          ['lista de peticiones de oración', rows.length]);
      }
      const sinOrar = rows.filter(r => ['abierta', 'en_oracion'].includes(r.estado) && r.veces_orada === 0).length;
      return {
        total_filas: rows.length, desde, peticiones: rows,
        puede_registrar: await puede(c, 'oracion', 'crear') || await puede(c, 'oracion', 'REGISTRAR_PETICION_ORACION'),
        aviso: sinOrar > 0 ? `${sinOrar} petición(es) abiertas por las que nadie ha registrado oración todavía.` : null,
      };
    });
  }

  @Post()
  registrar(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 3, 'registrar una petición de oración');
    return conSesion(this.db, req, async (c) => {
      await exigirUna(c, 'oracion', ['crear', 'REGISTRAR_PETICION_ORACION']);
      const personaId = uuidOpcional(b?.personaId, 'personaId');
      const nombre = textoOpcional(b?.nombreContacto, 'nombreContacto', { min: 2, max: 120 });
      if (!personaId && !nombre) throw new BadRequestException('Diga quién pide la oración: elija a la persona o escriba su nombre.');
      if (personaId) {
        const { rows: [v] } = await c.query(`SELECT 1 FROM nucleo.v_personas WHERE id = $1`, [personaId]);
        if (!v) throw new ForbiddenException('Esa persona no está en su alcance.');
      }
      const confidencial = b?.confidencial === undefined ? false : booleano(b.confidencial, 'confidencial');
      const compartir = b?.compartir === undefined ? false : booleano(b.compartir, 'compartir');
      if (confidencial && compartir) throw new BadRequestException('Una petición confidencial no se comparte con el equipo de intercesión.');
      const id = randomUUID();
      try {
        await c.query(
          `INSERT INTO crm.peticiones_oracion
             (id, sede_id, persona_id, nombre_contacto, contacto, categoria, resumen, detalle, confidencial, compartir_con_intercesores)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, uuid(b?.sedeId, 'sedeId'), personaId, nombre, textoOpcional(b?.contacto, 'contacto', { max: 160 }),
           texto(b?.categoria, 'categoria', { min: 2, max: 40 }), texto(b?.resumen, 'resumen', { min: 3, max: 140 }),
           textoOpcional(b?.detalle, 'detalle', { max: 4000 }), confidencial, compartir]);
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La sede o la persona no existen o no están en su alcance.');
        throw e;
      }
      return { id, mensaje: confidencial ? 'Petición registrada como confidencial: solo la ven los pastores.' : 'Petición registrada.' };
    });
  }

  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 3, 'ver una petición de oración');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'oracion', 'ver');
      const p = uuid(id, 'id');
      const { rows: [pet] } = await c.query(
        `SELECT o.id, o.sede_id, se.codigo AS sede, o.persona_id, COALESCE(pp.nombre_completo, o.nombre_contacto) AS quien,
                o.contacto, o.categoria, cv.etiqueta AS categoria_nombre, o.resumen, o.detalle, o.confidencial,
                o.compartir_con_intercesores AS compartida, o.origen, o.estado, o.respuesta,
                to_char(o.creado_en,'YYYY-MM-DD HH24:MI') AS creada, to_char(o.respondida_en,'YYYY-MM-DD') AS respondida_en,
                to_char(o.cerrada_en,'YYYY-MM-DD') AS cerrada_en, rp.nombre_completo AS registrada_por
           FROM crm.peticiones_oracion o
           JOIN org.sedes se ON se.id = o.sede_id
           LEFT JOIN nucleo.v_personas pp ON pp.id = o.persona_id
           LEFT JOIN nucleo.v_personas rp ON rp.id = o.creado_por
           LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'categoria_oracion' AND cv.codigo = o.categoria
          WHERE o.id = $1`, [p]);
      if (!pet) throw new NotFoundException('Esa petición no existe o no está a su alcance.');
      /* ⛔ Rastro ANTES de devolver: si no se puede dejar huella, no se entrega. */
      await c.query(`SELECT plataforma.registrar_lectura('crm','peticiones_oracion',$1,3::smallint,$2)`,
        [p, 'ficha de la petición, con detalle y contacto']);
      const { rows: oraciones } = await c.query(
        `SELECT to_char(h.oro_en,'YYYY-MM-DD HH24:MI') AS cuando, COALESCE(x.nombre_completo,'Intercesor') AS quien, h.nota
           FROM crm.oraciones_hechas h LEFT JOIN nucleo.v_personas x ON x.id = h.persona_id
          WHERE h.peticion_id = $1 ORDER BY h.oro_en DESC LIMIT 20`, [p]);
      const puedeResponder = await puede(c, 'oracion', 'REPORTAR_RESPUESTA_ORACION') || await puede(c, 'oracion', 'editar');
      return { peticion: pet, oraciones, puede_responder: puedeResponder };
    });
  }

  /** «Oré por esto»: el intercesor deja constancia. Es lo que convierte una lista en un ministerio. */
  @Post(':id/orar')
  orar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'registrar una oración');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'oracion', 'ver');
      const p = uuid(id, 'id');
      const { rows: [pet] } = await c.query(`SELECT estado, sede_id FROM crm.peticiones_oracion WHERE id = $1`, [p]);
      if (!pet) throw new NotFoundException('Esa petición no existe o no está a su alcance.');
      if (pet.estado === 'cerrada') throw new BadRequestException('Esa petición ya está cerrada.');
      await c.query(`INSERT INTO crm.oraciones_hechas (peticion_id, sede_id, nota) VALUES ($1,$2,$3)`,
        [p, pet.sede_id, textoOpcional(b?.nota, 'nota', { max: 300 })]);
      if (pet.estado === 'abierta' && await puede(c, 'oracion', 'editar')) {
        await c.query(`UPDATE crm.peticiones_oracion SET estado = 'en_oracion' WHERE id = $1 AND estado = 'abierta'`, [p]);
      }
      return { mensaje: 'Quedó registrado que oró por esta petición.' };
    });
  }

  @Post(':id/estado')
  estado(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'cambiar el estado de una petición');
    return conSesion(this.db, req, async (c) => {
      await exigirUna(c, 'oracion', ['editar', 'REPORTAR_RESPUESTA_ORACION']);
      const nuevo = unoDe(b?.estado, 'estado', ESTADOS);
      const respuesta = textoOpcional(b?.respuesta, 'respuesta', { min: 3, max: 4000 });
      if (nuevo === 'respondida' && !respuesta) throw new BadRequestException('Para marcarla respondida, escriba la respuesta: es el testimonio.');
      const { rows: [r] } = await c.query(
        `UPDATE crm.peticiones_oracion SET estado = $2, respuesta = COALESCE($3, respuesta)
          WHERE id = $1 RETURNING estado`, [uuid(id, 'id'), nuevo, respuesta]);
      if (!r) throw new NotFoundException('Esa petición no existe o no está a su alcance.');
      return { estado: r.estado, mensaje: nuevo === 'respondida' ? 'Respondida. El testimonio queda con la petición.' : 'Estado actualizado.' };
    });
  }

  /**
   * Puerta pública: el formulario «¿Por qué podemos orar?» del sitio.
   * Sin sesión, con reCAPTCHA y con límite por dirección. La sede tiene
   * que tener el módulo encendido. Se guarda y NO se devuelve: sin sesión,
   * la base no deja leer lo que se acaba de escribir, y así debe ser.
   */
  @Post('publica')
  async publica(@Req() req: Request, @Body() b: any) {
    const ip = ipDe(req);
    limitarPorClave(`oracion-publica:${ip}`, 5, 10 * 60_000,
      'Recibimos varias peticiones seguidas desde esta conexión. Intente de nuevo en unos minutos.');
    const nombre = texto(b?.nombre, 'nombre', { min: 2, max: 120 });
    const resumen = texto(b?.resumen, 'resumen', { min: 3, max: 140 });
    const categoria = texto(b?.categoria, 'categoria', { min: 2, max: 40 });
    const detalle = textoOpcional(b?.detalle, 'detalle', { max: 4000 });
    const contacto = textoOpcional(b?.contacto, 'contacto', { max: 160 });
    const confidencial = b?.confidencial === undefined ? false : booleano(b.confidencial, 'confidencial');
    await verificarRecaptcha(b?.recaptcha_token, ip);
    const codigo = texto(b?.sede, 'sede', { min: 2, max: 20 });
    const sedeId = await this.db.enTransaccion({ personaId: null, sedeIds: [], nivelMax: 1, alcanceGlobal: false, ip: null },
      async (c) => {
        const { rows } = await c.query(`SELECT id FROM org.sedes WHERE codigo = $1 AND activa`, [codigo]);
        if (!rows.length) throw new BadRequestException(`La sede «${codigo}» no existe o está inactiva.`);
        return rows[0].id as string;
      });
    const id = randomUUID();
    await this.db.enTransaccion({ ...contextoPublico(sedeId, ip), modulo: 'oracion' }, async (c) => {
      await c.query(
        `INSERT INTO crm.peticiones_oracion (id, sede_id, nombre_contacto, contacto, categoria, resumen, detalle, confidencial, origen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'formulario_publico')`,
        [id, sedeId, nombre, contacto, categoria, resumen, detalle, confidencial]);
    });
    return {
      recibida: true,
      mensaje: confidencial
        ? 'Recibimos su petición. Solo la leerán los pastores de su sede. Estamos orando.'
        : 'Recibimos su petición. Nuestro equipo de oración ya la tiene. Estamos orando.',
    };
  }
}

@Module({ imports: [DbModule], controllers: [OracionController] })
export class OracionModule {}
