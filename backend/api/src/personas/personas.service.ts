import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';
import { exigir, puede } from '../comun/permiso';

/**
 * Personas y su ficha 360.
 *
 * ⭐ La ficha NO consulta once esquemas. Lee `crm.linea_tiempo`, donde
 * cada módulo deja su hecho (migración 0036). Por eso un módulo nuevo
 * aparece aquí solo, sin tocar este archivo: es toda la razón de que la
 * línea de tiempo exista.
 *
 * ⛔ Y no se filtra por nivel a mano: la RLS de la línea compara el nivel
 * DEL HECHO con el techo del lector. Un aporte (N3) no le llega a un
 * líder (N2) aunque pida la ficha completa.
 */
@Injectable()
export class PersonasService {
  /**
   * Buscar personas.
   *
   * ⛔ 19 sep 2026 · Esto era un `ILIKE '%texto%'`. Con eso, quien buscaba
   * «Jon Chavez» no encontraba a «Jhon Chávez» y creaba el duplicado; y con
   * 25.000 personas llegando de 36 fuentes, los duplicados no son un riesgo,
   * son una certeza. Ahora llama a `nucleo.buscar_personas`, que tolera
   * erratas y tildes (trigramas) y además busca por documento, teléfono y
   * correo en el mismo cuadro.
   *
   * La función es STABLE y NO es SECURITY DEFINER a propósito: corre como el
   * invocador, así que la seguridad por fila se aplica igual. Una búsqueda
   * que se salta el aislamiento es la forma más cómoda de leer otra sede.
   */
  async buscar(c: PoolClient, q: string | undefined, limite: number) {
    if (!q || q.trim().length < 2) {
      const { rows } = await c.query(
        `SELECT p.id,
                trim(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre,
                nullif(concat_ws(' ', p.tipo_documento, p.numero_documento), ' ') AS documento,
                s.codigo AS sede_codigo, p.estado::text AS estado, NULL::real AS parecido,
                'listado'::text AS por_que
           FROM nucleo.personas p
           LEFT JOIN org.sedes s ON s.id = p.sede_id
          WHERE p.eliminado_en IS NULL
          ORDER BY p.primer_apellido, p.primer_nombre
          LIMIT $1`, [limite]);
      return rows;
    }
    const { rows } = await c.query(
      `SELECT * FROM nucleo.buscar_personas($1, $2)`, [q.trim(), limite]);
    return rows;
  }

  /** Candidatos a ser la misma persona registrada dos veces. */
  async duplicados(c: PoolClient, personaId: string) {
    await exigir(c, 'personas', 'ver');
    await this.alcanzar(c, personaId);
    const { rows } = await c.query(
      `SELECT * FROM nucleo.candidatos_duplicado($1)`, [personaId]);
    return rows;
  }

  /**
   * ⛔ 21 sep 2026 · La SEGUNDA cerradura de la ficha (migración 0077).
   *
   * La base aísla por sede, y cada alcance fino se vuelve la sede entera:
   * un líder de grupo con un grupo vacío abría la ficha completa de las 35
   * personas de su sede. Aquí se pregunta si quien pide ALCANZA a esa
   * persona con su grupo, su segmento, su ministerio, su caso o sus
   * menores a cargo. Si no, la respuesta es la misma que si no existiera:
   * decir «existe pero no es suya» ya es contar algo.
   */
  private async alcanzar(c: PoolClient, id: string): Promise<void> {
    const { rows: [r] } = await c.query(
      `SELECT identidad.alcanza_persona($1, $2) AS si`, [contextoActual().personaId, id]);
    if (!r?.si) throw new NotFoundException('No existe esa persona, o no está a su alcance.');
  }

  /**
   * El nivel de cada columna de la ficha, tal como lo declara la base
   * (`plataforma.clasificacion_columna`). ⛔ El contrato de la ruta decía
   * «los campos por encima del nivel de la sesión no se devuelven, y la
   * lectura de N3 o N4 queda en la bitácora», y no se hacía ninguna de las
   * dos: la fe y el bautismo (N3) salían para cualquiera que viera la sede.
   */
  private async nivelesDeColumna(c: PoolClient): Promise<Map<string, number>> {
    const { rows } = await c.query(
      `SELECT columna, nivel FROM plataforma.clasificacion_columna
        WHERE esquema = 'nucleo' AND tabla = 'personas'`);
    return new Map(rows.map((r: any) => [r.columna, Number(r.nivel)]));
  }

  /** Si es menor, cada lectura de su ficha o de su historia queda con nombre y hora. */
  private async registrarSiEsMenor(c: PoolClient, id: string, tabla: string, motivo: string, filas: number) {
    const { rows: [m] } = await c.query(
      `SELECT nucleo.es_menor(fecha_nacimiento) AS menor FROM nucleo.personas WHERE id = $1`, [id]);
    if (m?.menor) {
      await c.query(`SELECT plataforma.registrar_lectura($1,$2,$3,$4::smallint,$5,$6)`,
        [tabla === 'linea_tiempo' ? 'crm' : 'nucleo', tabla, id, 4, motivo, filas]);
    }
    return Boolean(m?.menor);
  }

  async ficha(c: PoolClient, id: string) {
    await exigir(c, 'personas', 'ver');
    await this.alcanzar(c, id);
    const { rows } = await c.query(
      `SELECT p.id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
              p.tipo_documento, p.numero_documento, to_char(p.fecha_nacimiento,'YYYY-MM-DD') AS fecha_nacimiento,
              p.email_principal, p.telefono_movil, p.direccion, p.estado, p.genero, p.estado_civil,
              p.nivel_compromiso, p.ha_sido_bautizado, to_char(p.fecha_bautismo,'YYYY-MM-DD') AS fecha_bautismo,
              p.sede_id, p.creado_en,
              p.telefono_fijo, to_char(p.fecha_conversion,'YYYY-MM-DD') AS fecha_conversion, p.foto_url,
              p.nombre_corto, p.nacionalidad, p.pais_residencia, p.ciudad_residencia, p.zona,
              p.email_secundario, p.telefono_emergencia, p.es_cristiano, p.iglesia_anterior,
              p.es_ministro, p.en_directorio_publico,
              date_part('year', age(p.fecha_nacimiento))::int AS edad,
              nucleo.es_menor(p.fecha_nacimiento) AS es_menor,
              s.codigo AS sede_codigo, s.nombre AS sede_nombre
         FROM nucleo.personas p LEFT JOIN org.sedes s ON s.id = p.sede_id
        WHERE p.id = $1 AND p.eliminado_en IS NULL`, [id]);
    if (!rows.length) throw new NotFoundException('No existe esa persona, o no está a su alcance.');
    const persona: Record<string, any> = rows[0];
    const techo = contextoActual().nivelMax;
    const niveles = await this.nivelesDeColumna(c);
    const ocultos: string[] = [];
    let nivelLeido = 0;
    for (const [col, nivel] of niveles) {
      if (!(col in persona)) continue;
      if (nivel > techo) { delete persona[col]; ocultos.push(col); }
      else if (persona[col] !== null && persona[col] !== undefined) nivelLeido = Math.max(nivelLeido, nivel);
    }
    /* Lo derivado se arma DESPUÉS del recorte: un nombre completo armado en
       la base llevaría el segundo apellido que la sesión no alcanza, y la
       edad diría lo que la fecha de nacimiento oculta. */
    persona.nombre = [persona.primer_nombre, persona.segundo_nombre, persona.primer_apellido, persona.segundo_apellido]
      .filter(Boolean).join(' ');
    if (!('fecha_nacimiento' in persona)) delete persona.edad;
    /* ⛔ La consola ya registraba la lectura de la ficha de un menor; esta
       ruta, que es la de las sedes, no. Antes de devolver un solo dato. */
    if (persona.es_menor) {
      await this.registrarSiEsMenor(c, id, 'personas', 'Ficha de un menor en la aplicación de la sede', 1);
    } else if (nivelLeido >= 3) {
      await c.query(`SELECT plataforma.registrar_lectura($1,$2,$3,$4::smallint,$5,$6)`,
        ['nucleo', 'personas', id, nivelLeido, 'Ficha con datos N3 (fe y bautismo) en la aplicación de la sede', 1]);
    }
    return { ...persona, nivel_de_la_sesion: techo, campos_ocultos: ocultos,
             puede_editar: await puede(c, 'personas', 'editar') };
  }

  /**
   * «Módulo de PERSONAS: mantiene datos actualizados» (documento de
   * Usuarios v1.2). Solo los campos de la lista: el cliente nunca elige
   * columnas, y la sede, el estado y el linaje no se tocan desde aquí.
   * La auditoría la escribe la base: cada campo cambiado queda con su
   * valor anterior (ver `modelo100p.auditoria_personas`).
   */
  async actualizar(c: PoolClient, id: string, d: Record<string, any>) {
    const EDITABLES = ['primer_nombre','segundo_nombre','primer_apellido','segundo_apellido',
      'tipo_documento','numero_documento','fecha_nacimiento','email_principal','telefono_movil',
      'telefono_fijo','direccion','genero','estado_civil','nivel_compromiso','fecha_conversion',
      'ha_sido_bautizado','fecha_bautismo','foto_url','nombre_corto','nacionalidad',
      'pais_residencia','ciudad_residencia','zona','email_secundario','telefono_emergencia',
      'es_cristiano','iglesia_anterior','es_ministro','en_directorio_publico'];
    /* ⛔ Editar no pedía el permiso «editar» del módulo: la política de la
       base mira la sede y nada más, y aquí no se preguntaba. Un rol de solo
       lectura con la sede a la vista corregía los datos de cualquiera. */
    await exigir(c, 'personas', 'editar');
    await this.alcanzar(c, id);
    const campos = Object.keys(d ?? {}).filter(k => EDITABLES.includes(k));
    if (!campos.length) {
      throw new BadRequestException(`Nada que actualizar. Campos permitidos: ${EDITABLES.join(', ')}.`);
    }
    /* Quien no puede leer un dato tampoco lo escribe: cambiar «bautizado»
       sin alcanzar N3 sería escribir a ciegas sobre lo que no se ve. */
    const techo = contextoActual().nivelMax;
    const niveles = await this.nivelesDeColumna(c);
    const altos = campos.filter(k => (niveles.get(k) ?? 0) > techo);
    if (altos.length) {
      throw new ForbiddenException(
        `No puede cambiar ${altos.map(k => `«${k}»`).join(', ')}: su acceso llega hasta N${techo}.`);
    }
    const sets = campos.map((k, i) => `${k} = $${i + 2}`).join(', ');
    try {
      const { rowCount } = await c.query(
        `UPDATE nucleo.personas SET ${sets}, actualizado_en = now()
          WHERE id = $1 AND eliminado_en IS NULL`,
        [id, ...campos.map(k => d[k] === '' ? null : d[k])]);
      if (!rowCount) throw new NotFoundException('No existe esa persona, o no está a su alcance.');
    } catch (e: any) {
      if (e.code === '22P02' || e.code === '23514' || e.code === '22007' || e.code === '23503') {
        throw new BadRequestException('Algún valor no es válido: ' + e.message);
      }
      if (e.code === '23505') throw new BadRequestException('Ese correo o documento ya pertenece a otra persona.');
      throw e;
    }
    return this.ficha(c, id);
  }

  /** ⭐ La línea de tiempo: todo lo que le ha pasado, venga del módulo que venga. */
  async lineaTiempo(c: PoolClient, id: string, limite: number) {
    await exigir(c, 'personas', 'ver');
    await this.alcanzar(c, id);
    const { rows } = await c.query(
      `SELECT l.ocurrido_en, l.tipo, t.nombre AS tipo_nombre, t.nivel,
              l.entidad_modulo, l.entidad_tipo, l.entidad_id, l.resumen, l.detalle
         FROM crm.linea_tiempo l
         LEFT JOIN crm.tipos_hecho t ON t.codigo = l.tipo
        WHERE l.persona_id = $1
        ORDER BY l.ocurrido_en DESC
        LIMIT $2`, [id, Math.min(Math.max(limite, 1), 500)]);
    await this.registrarSiEsMenor(c, id, 'linea_tiempo', 'Historia de un menor en la aplicación de la sede', rows.length);
    return rows;
  }

  /** Las casillas que la iglesia añadió sin migración (0037). */
  async atributos(c: PoolClient, id: string) {
    await exigir(c, 'personas', 'ver');
    await this.alcanzar(c, id);
    const { rows } = await c.query(
      `SELECT codigo, etiqueta, modulo, tipo_dato, nivel_dato, valor, actualizado_en
         FROM nucleo.v_persona_atributos WHERE persona_id = $1
        ORDER BY modulo, codigo`, [id]);
    return rows;
  }

  async fijarAtributo(c: PoolClient, id: string, codigo: string, valor: any) {
    await exigir(c, 'personas', 'editar');
    await this.alcanzar(c, id);
    const { rows: [attr] } = await c.query(
      `SELECT id, tipo_dato, opciones FROM sistema.atributos WHERE codigo = $1 AND vigente`, [codigo]);
    if (!attr) throw new NotFoundException(`No existe la casilla «${codigo}».`);

    /* ⛔ Si la casilla es de opción cerrada, el valor tiene que estar en
       la lista. Un desplegable que acepta texto libre deja de ser un
       desplegable y nadie podrá agrupar por él después. */
    if (['opcion','multiopcion'].includes(attr.tipo_dato) && attr.opciones) {
      const permitidos: string[] = attr.opciones;
      const vs = Array.isArray(valor) ? valor : [valor];
      const malo = vs.find(v => !permitidos.includes(v));
      if (malo !== undefined) {
        throw new BadRequestException(
          `«${malo}» no es una opción de esta casilla. Las válidas son: ${permitidos.join(', ')}.`);
      }
    }
    const { rows } = await c.query(
      `INSERT INTO nucleo.persona_atributos (persona_id, atributo_id, valor, actualizado_en)
       VALUES ($1,$2,$3::jsonb, now())
       ON CONFLICT (persona_id, atributo_id)
       DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()
       RETURNING valor, actualizado_en`,
      [id, attr.id, JSON.stringify(valor)]);
    if (!rows.length) {
      throw new BadRequestException('Esa casilla está por encima de su nivel de acceso.');
    }
    return rows[0];
  }

  /** «Tráeme todos los que…»: el arrastre que pidió Daniel. */
  async porAtributo(c: PoolClient, codigo: string, valor: any) {
    const { rows } = await c.query(
      `SELECT pa.persona_id, p.primer_nombre, p.primer_apellido, p.sede_id, pa.valor
         FROM sistema.personas_con_atributo($1, $2::jsonb) pa
         JOIN nucleo.personas p ON p.id = pa.persona_id
        WHERE p.eliminado_en IS NULL
        ORDER BY p.primer_apellido`,
      [codigo, valor === undefined ? null : JSON.stringify(valor)]);
    return rows;
  }
}
