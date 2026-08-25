import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { contextoActual, contextoPublico } from '../contexto/contexto';
import type { RegistrarNuevo, RegistrarContacto, ConvertirMiembro } from './dto';

/**
 * Módulo de Nuevos · M-Nuevos.
 *
 * Trabaja sobre la BANDEJA (`crm.nuevos_registros`), no sobre el registro
 * maestro. Quien llena el formulario público no es todavía una persona
 * verificada; entra al maestro en la conversión, y solo ahí.
 *
 * Ninguna de las reglas del negocio se valida aquí: viven en la base.
 * Si falta el contacto, si la sede no existe, si ya fue convertido — la
 * base lo rechaza y el error sube traducido.
 */
@Injectable()
export class NuevosService {
  constructor(private readonly db: DbService) {}

  /** Puerta pública: sin identidad, con el contexto de la sede del formulario. */
  async registrar(datos: RegistrarNuevo, ip: string | null) {
    if (!datos.nombre?.trim()) throw new BadRequestException('El nombre es obligatorio.');
    if (!datos.email && !datos.telefono) {
      throw new BadRequestException('Hace falta un correo o un teléfono para poder contactarle.');
    }
    const sedeId = await this.sedePorCodigo(datos.sede);

    return this.db.enTransaccion(contextoPublico(sedeId, ip), async (c) => {
      let nuevo;
      try {
        ({ rows: [nuevo] } = await c.query(
          `INSERT INTO crm.nuevos_registros
             (sede_id, nombre, email, telefono, como_supo, es_cristiano, comentarios, fuente, ip_registro)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'web',$8)
           RETURNING id, estado, registrado_en`,
          [sedeId, datos.nombre.trim(), datos.email ?? null, datos.telefono ?? null,
           datos.como_supo ?? null, datos.es_cristiano ?? null, datos.comentarios ?? null, ip],
        ));
      } catch (e: any) {
        if (e.code === '23505') {
          throw new ConflictException({
            error: 'Ya recibimos un registro con ese correo y todavía lo estamos atendiendo.',
            codigo_error: 'EMAIL_DUPLICADO',
          });
        }
        throw e;
      }

      // El consentimiento se ancla a una PERSONA, y en la bandeja todavía
      // no hay persona. Se guarda aquí con SU MOMENTO, y la conversión lo
      // traslada a la tabla de consentimientos con esa misma fecha: es lo
      // que exige la Ley 1581, porque un consentimiento recapturado más
      // tarde no cubre el tratamiento anterior.
      if (datos.autoriza?.length) {
        await c.query(
          `UPDATE crm.nuevos_registros
              SET canales_autorizados = $2::plataforma.canal_contacto[],
                  autorizado_en = now()
            WHERE id = $1`,
          [nuevo.id, `{${datos.autoriza.join(',')}}`],
        );
      }

      return {
        id: nuevo.id,
        estado: 'registrado',
        mensaje: '¡Bienvenido! Pronto nos contactaremos',
        registrado_en: nuevo.registrado_en,
      };
    });
  }

  /** Tablero del coordinador. El filtro de sede no se escribe: lo pone RLS. */
  async dashboard(estado?: string, limite = 50) {
    return this.db.enTransaccion(contextoActual(), async (c) => {
      const { rows } = await c.query(
        `SELECT id, nombre, email, telefono, como_supo, es_cristiano, estado, prioridad,
                registrado_en, proximo_contacto, contactos, ultimo_contacto, proxima_accion
         FROM crm.v_bandeja_nuevos
         WHERE ($1::text IS NULL OR estado = $1::crm.estado_nuevo)
         ORDER BY (proxima_accion = 'ATRASADO') DESC, registrado_en DESC
         LIMIT $2`,
        [estado ?? null, limite],
      );
      return { total: rows.length, nuevos: rows };
    });
  }

  /** Historial completo de un registro de la bandeja. */
  async historial(id: string) {
    return this.db.enTransaccion(contextoActual(), async (c) => {
      const { rows: [n] } = await c.query(
        `SELECT id, nombre, email, telefono, como_supo, es_cristiano, comentarios,
                estado, prioridad, registrado_en, persona_id, convertido_en
         FROM crm.nuevos_registros WHERE id = $1`, [id]);
      if (!n) throw new NotFoundException('No existe ese registro, o no pertenece a su sede.');

      const { rows: contactos } = await c.query(
        `SELECT ocurrido_en, tipo, resumen, reaccion, siguiente_paso, coordinador_id
         FROM crm.contactos_nuevos WHERE nuevo_id = $1 ORDER BY ocurrido_en DESC`, [id]);

      let linea: any[] = [];
      if (n.persona_id) {
        ({ rows: linea } = await c.query(
          `SELECT ocurrido_en, tipo, resumen FROM crm.linea_tiempo
           WHERE persona_id = $1 ORDER BY ocurrido_en DESC LIMIT 50`, [n.persona_id]));
      }
      return { ...n, historial_contactos: contactos, linea_tiempo: linea };
    });
  }

  /** Registrar un contacto de seguimiento. */
  async registrarContacto(id: string, datos: RegistrarContacto) {
    const ctx = contextoActual();
    if (!datos.resumen?.trim()) throw new BadRequestException('El resumen del contacto es obligatorio.');

    return this.db.enTransaccion(ctx, async (c) => {
      const { rows: [n] } = await c.query(
        `SELECT id, estado FROM crm.nuevos_registros WHERE id = $1`, [id]);
      if (!n) throw new NotFoundException('No existe ese registro, o no pertenece a su sede.');
      if (n.estado === 'convertido') {
        throw new ConflictException('Ese registro ya se convirtió: el seguimiento continúa en la ficha de la persona.');
      }

      const { rows: [contacto] } = await c.query(
        `INSERT INTO crm.contactos_nuevos
           (nuevo_id, coordinador_id, tipo, resumen, reaccion, siguiente_paso, proximo_contacto)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, ocurrido_en`,
        [id, ctx.personaId, datos.tipo_contacto, datos.resumen.trim(), datos.reaccion,
         datos.siguiente_paso ?? null, datos.fecha_siguiente_contacto ?? null],
      );

      // El estado del registro se deriva de la reacción: no se pide al
      // cliente que lo mande, porque entonces dos pantallas podrían
      // discrepar sobre en qué punto está la misma persona.
      const nuevoEstado =
        datos.reaccion === 'no_interesado' ? 'no_interesado' :
        n.estado === 'nuevo' ? 'contactado' : 'en_seguimiento';

      await c.query(
        `UPDATE crm.nuevos_registros
            SET estado = $2::crm.estado_nuevo,
                proximo_contacto = COALESCE($3::date, proximo_contacto),
                coordinador_id = COALESCE(coordinador_id, $4)
          WHERE id = $1`,
        [id, nuevoEstado, datos.fecha_siguiente_contacto ?? null, ctx.personaId],
      );

      return {
        contacto_id: contacto.id,
        estado_nuevo: nuevoEstado,
        mensaje: 'Contacto registrado',
        proxima_accion: datos.siguiente_paso ?? null,
      };
    });
  }

  /** Convertir en miembro: entra al registro maestro y arranca el 4C. */
  async convertirMiembro(id: string, datos: ConvertirMiembro) {
    const ctx = contextoActual();
    return this.db.enTransaccion(ctx, async (c) => {
      let personaId: string;
      try {
        const { rows: [r] } = await c.query(
          `SELECT crm.convertir_en_miembro($1,$2,$3) AS persona_id`,
          [id, ctx.personaId, datos.notas ?? null],
        );
        personaId = r.persona_id;
      } catch (e: any) {
        if (e.code === '02000') throw new NotFoundException('No existe ese registro en la bandeja.');
        if (e.code === '23514') throw new ConflictException('Ese registro ya fue convertido.');
        throw e;
      }

      const { rows: [p] } = await c.query(
        `SELECT nombre_completo FROM nucleo.v_personas WHERE id = $1`, [personaId]);
      const { rows: [r4c] } = await c.query(
        `SELECT etapa, entro_en FROM crm.recorrido WHERE persona_id = $1 AND salio_en IS NULL`,
        [personaId]);

      return {
        nuevo_id: id,
        persona_id: personaId,
        nombre: p?.nombre_completo,
        estado: 'convertido',
        recorrido_4c: r4c ?? null,
        mensaje: 'Nuevo miembro integrado al sistema',
      };
    });
  }

  private async sedePorCodigo(codigo: string): Promise<string> {
    if (!codigo) throw new BadRequestException('Falta la sede de destino.');
    const ctx = { personaId: null, sedeIds: [], nivelMax: 1, alcanceGlobal: false, ip: null };
    return this.db.enTransaccion(ctx, async (c) => {
      const { rows } = await c.query(`SELECT id FROM org.sedes WHERE codigo = $1 AND activa`, [codigo]);
      if (!rows.length) throw new BadRequestException(`La sede «${codigo}» no existe o está inactiva.`);
      return rows[0].id as string;
    });
  }
}
