import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { contextoActual, contextoPublico } from '../contexto/contexto';
import type { RegistroPublico, RegistroContacto, CambioEtapa } from './dto';

/**
 * Módulo de Nuevos.
 *
 * Es la tesis del proyecto: alguien llega por primera vez y el sistema
 * lo acompaña. Todo lo que hace este servicio se apoya en garantías que
 * ya vive la base — la sede obligatoria, el consentimiento por canal, la
 * etapa única del recorrido 4C — así que aquí no se re-valida nada de
 * eso. Si la base lo rechaza, el error sube.
 */
@Injectable()
export class NuevosService {
  constructor(private readonly db: DbService) {}

  /** Puerta pública. No hay usuario: el contexto es el de la sede del formulario. */
  async registrar(datos: RegistroPublico, ip: string | null) {
    if (!datos.primer_nombre?.trim() || !datos.primer_apellido?.trim()) {
      throw new BadRequestException('El nombre y el apellido son obligatorios.');
    }
    const sedeId = await this.sedePorCodigo(datos.sede_codigo);

    return this.db.enTransaccion(contextoPublico(sedeId, ip), async (c) => {
      const { rows: [persona] } = await c.query(
        `INSERT INTO nucleo.personas
           (sede_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
            email_principal, telefono_movil, fecha_nacimiento, source_system)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'registro_publico')
         RETURNING id`,
        [sedeId, datos.primer_nombre.trim(), datos.segundo_nombre ?? null,
         datos.primer_apellido.trim(), datos.segundo_apellido ?? null,
         datos.email ?? null, datos.telefono ?? null, datos.fecha_nacimiento ?? null],
      );

      // El consentimiento se guarda por canal y con su fecha original.
      // Un canal no marcado NO se registra: la ausencia no es un no,
      // es la ausencia, y puede_contactar() ya devuelve falso sin fila.
      for (const canal of datos.autoriza ?? []) {
        await c.query(
          `INSERT INTO plataforma.consentimientos
             (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
           VALUES ($1,$2,'convocatoria',$3,'otorgado', now(), 'formulario_web', $4)`,
          [persona.id, sedeId, canal, `registro-publico:${persona.id}`],
        );
      }

      await c.query(
        `INSERT INTO crm.recorrido (persona_id, sede_id, etapa, puerta_entrada)
         VALUES ($1,$2,'conoce',$3)`,
        [persona.id, sedeId, datos.puerta_entrada ?? 'formulario web'],
      );

      await c.query(
        `INSERT INTO crm.linea_tiempo
           (persona_id, sede_id, ocurrido_en, tipo, entidad_modulo, entidad_tipo, entidad_id, resumen)
         VALUES ($1,$2, now(), 'PRIMERA_VISITA','nuevos','persona',$1::text,
                 'Se registró por el formulario público')`,
        [persona.id, sedeId],
      );

      return { id: persona.id, etapa: 'conoce' };
    });
  }

  /** Los nuevos de MI sede. El filtro de sede no se escribe: lo pone RLS. */
  async listar(limite = 50) {
    const ctx = contextoActual();
    return this.db.enTransaccion(ctx, async (c) => {
      const { rows } = await c.query(
        `SELECT p.id, p.primer_nombre, p.primer_apellido, p.email_principal,
                p.telefono_movil, r.etapa, r.entro_en, r.puerta_entrada
         FROM crm.recorrido r
         JOIN nucleo.personas p ON p.id = r.persona_id
         WHERE r.salio_en IS NULL AND r.etapa IN ('conoce','conectate')
         ORDER BY r.entro_en DESC
         LIMIT $1`,
        [limite],
      );
      return rows;
    });
  }

  /** Ficha 360: la persona, su etapa y su memoria. */
  async ficha(id: string) {
    const ctx = contextoActual();
    return this.db.enTransaccion(ctx, async (c) => {
      const { rows: [p] } = await c.query(
        `SELECT id, nombre_completo, edad, es_menor, email_principal, telefono_movil, sede_id
         FROM nucleo.v_personas WHERE id = $1`, [id]);
      if (!p) throw new NotFoundException('No existe esa persona, o su sede no es la suya.');

      const { rows: recorrido } = await c.query(
        `SELECT etapa, entro_en, salio_en, puerta_entrada FROM crm.recorrido
         WHERE persona_id=$1 ORDER BY entro_en DESC`, [id]);
      const { rows: linea } = await c.query(
        `SELECT ocurrido_en, tipo, resumen FROM crm.linea_tiempo
         WHERE persona_id=$1 ORDER BY ocurrido_en DESC LIMIT 50`, [id]);
      const { rows: [cons] } = await c.query(
        `SELECT plataforma.puede_contactar($1,'email','convocatoria')    AS email,
                plataforma.puede_contactar($1,'whatsapp','convocatoria') AS whatsapp,
                plataforma.puede_contactar($1,'llamada','convocatoria')  AS llamada`, [id]);

      return { persona: p, recorrido, linea_tiempo: linea, se_puede_contactar: cons };
    });
  }

  /** Un contacto de seguimiento entra a la línea de tiempo. */
  async registrarContacto(id: string, datos: RegistroContacto) {
    const ctx = contextoActual();
    if (!datos.resumen?.trim()) throw new BadRequestException('El resumen del contacto es obligatorio.');
    return this.db.enTransaccion(ctx, async (c) => {
      const { rows: [p] } = await c.query(
        `SELECT sede_id FROM nucleo.personas WHERE id=$1`, [id]);
      if (!p) throw new NotFoundException('No existe esa persona, o su sede no es la suya.');

      const { rows: [h] } = await c.query(
        `INSERT INTO crm.linea_tiempo
           (persona_id, sede_id, ocurrido_en, tipo, entidad_modulo, entidad_tipo, entidad_id,
            resumen, registrado_por)
         VALUES ($1,$2,COALESCE($3::timestamptz, now()),$4,'nuevos','contacto',gen_random_uuid()::text,$5,$6)
         RETURNING id, ocurrido_en`,
        [id, p.sede_id, datos.ocurrido_en ?? null, datos.tipo, datos.resumen.trim(), ctx.personaId],
      );
      return h;
    });
  }

  /**
   * Avanzar en el recorrido 4C. Cierra la etapa abierta y abre la nueva
   * en la misma transacción: el índice único de la base impide que la
   * persona quede en dos etapas a la vez, aunque el código se equivoque.
   */
  async cambiarEtapa(id: string, datos: CambioEtapa) {
    const ctx = contextoActual();
    return this.db.enTransaccion(ctx, async (c) => {
      const { rows: [actual] } = await c.query(
        `SELECT id, etapa, sede_id FROM crm.recorrido
         WHERE persona_id=$1 AND salio_en IS NULL`, [id]);
      if (!actual) throw new NotFoundException('Esa persona no tiene un recorrido abierto.');
      if (actual.etapa === datos.etapa) {
        throw new BadRequestException(`Ya está en la etapa «${datos.etapa}».`);
      }

      await c.query(`UPDATE crm.recorrido SET salio_en = now() WHERE id=$1`, [actual.id]);
      const { rows: [nueva] } = await c.query(
        `INSERT INTO crm.recorrido (persona_id, sede_id, etapa, responsable_id)
         VALUES ($1,$2,$3,$4) RETURNING id, etapa, entro_en`,
        [id, actual.sede_id, datos.etapa, ctx.personaId],
      );
      await c.query(
        `INSERT INTO crm.linea_tiempo
           (persona_id, sede_id, ocurrido_en, tipo, entidad_modulo, entidad_tipo, entidad_id,
            resumen, registrado_por)
         VALUES ($1,$2, now(),'CAMBIO_ETAPA','nuevos','recorrido',$3::text,$4,$5)`,
        [id, actual.sede_id, nueva.id,
         `Pasa de «${actual.etapa}» a «${datos.etapa}»${datos.nota ? ': ' + datos.nota : ''}`,
         ctx.personaId],
      );
      return nueva;
    });
  }

  private async sedePorCodigo(codigo: string): Promise<string> {
    if (!codigo) throw new BadRequestException('Falta la sede de destino.');
    // Consulta sin contexto: el catálogo de sedes es N1 y no está bajo RLS.
    const ctx = { personaId: null, sedeIds: [], nivelMax: 1, alcanceGlobal: false, ip: null };
    return this.db.enTransaccion(ctx, async (c) => {
      const { rows } = await c.query(`SELECT id FROM org.sedes WHERE codigo=$1 AND activa`, [codigo]);
      if (!rows.length) throw new BadRequestException(`La sede «${codigo}» no existe o está inactiva.`);
      return rows[0].id as string;
    });
  }
}
