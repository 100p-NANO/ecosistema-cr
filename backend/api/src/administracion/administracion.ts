import { BadRequestException, Body, Controller, ForbiddenException, Get, Module,
         NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { randomInt } from 'node:crypto';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel, sesionDe } from '../comun/identidad.helper';
import { uuid, texto, textoOpcional, booleano, entero, fecha } from '../comun/validar';
import { derivarClave } from '../auth/clave';
import { JERGA } from '../comun/errores';
import { estadoDeTerceros } from '../comun/saliente';

/**
 * Administración de la solución.
 *
 * ⛔ 20 de septiembre de 2026. Hasta hoy esto NO EXISTÍA. El primer Pastor
 * Director General se creaba con un comando en la terminal y los roles de
 * las 36 sedes se otorgaban por SQL o con `curl`. Para una red de 36
 * iglesias eso no es operable: significa que una sola persona, con acceso
 * a un portátil, es la única que puede dar de alta a alguien.
 *
 * ⛔ Y antes de exponer nada se cerró un hueco: `identidad.crear_cuenta`
 * era SECURITY DEFINER y no comprobaba quién llamaba. No era explotable
 * porque ninguna ruta la exponía; la primera ruta de administración la
 * habría convertido en «cualquier sesión crea una cuenta con N4 sobre
 * toda la red». La comprobación vive ahora DENTRO (migración 0059), que es
 * donde no se puede olvidar.
 *
 * Aquí no hay ni una regla de permiso: todas las funciones que se llaman
 * exigen por dentro administrar `identidad` Y que la persona afectada esté
 * en el alcance de quien llama.
 */

/** Contraseña provisional legible por teléfono: cuatro palabras y un número.
    ⛔ No se inventan «claves seguras» impronunciables: la persona que la
    recibe la va a copiar a mano de un papel o de un mensaje, y una clave
    que se copia mal se acaba escribiendo en una nota pegada al monitor. */
const PALABRAS = [
  'ancla','brisa','cedro','duna','enero','faro','grano','hilo','isla','jarra',
  'lazo','monte','nido','ola','pino','quila','rama','sauce','trigo','uva',
  'valle','yunque','zorro','barro','cielo','dedal','espiga','fuente',
];
function claveProvisional(): string {
  const p = Array.from({ length: 4 }, () => PALABRAS[randomInt(PALABRAS.length)]);
  return `${p.join(' ')} ${randomInt(10, 100)}`;
}

/**
 * Traduce lo que la base ya explicó.
 *
 * ⛔ 20 de septiembre de 2026. Cada una de las doce rutas de este archivo
 * tenía SU PROPIA lista de códigos de error, y cada lista era distinta.
 * Desplegar una iglesia con una plantilla mal escrita devolvía «Ocurrió
 * un error inesperado. Reporte este código al soporte» porque `P0002` no
 * estaba en la lista de ESA ruta, mientras la base ya había dicho, en
 * español y con el nombre del dato: «La plantilla PLANTA no existe o no
 * tiene módulos». El operador veía un código de incidencia; la respuesta
 * estaba a un `catch` de distancia.
 *
 * Las reglas del negocio viven en la base (funciones con RAISE,
 * restricciones, disparadores) justo para que no se puedan saltar. Si
 * esos mensajes se pierden al subir, el sistema queda mudo. Esto los
 * sube TODOS, en un solo sitio, para que ninguna ruta pueda olvidarse de
 * uno.
 */
function traducir(e: any, propios: Record<string, string> = {}): never {
  const codigo = String(e?.code ?? '');
  if (propios[codigo]) throw new BadRequestException(propios[codigo]);

  /* Lo que se negó a propósito: no es un fallo, es la regla funcionando. */
  if (codigo === '42501') throw new ForbiddenException(limpiar(e.message));

  const delNegocio = [
    'P0001',  // RAISE EXCEPTION nuestro
    'P0002',  // no encontrado, lanzado por una función nuestra
    '02000',  // sin datos
    '23514',  // restricción CHECK
    '23505',  // repetido
    '23503',  // apunta a algo que no existe
    '23502',  // falta un dato obligatorio en la tabla
    '22P02',  // un valor con una forma que la columna no acepta
    '22003',  // fuera de rango
    '23P01',  // se cruza con otro periodo
  ];
  if (delNegocio.includes(codigo)) throw new BadRequestException(limpiar(e.message));
  throw e;
}

/**
 * El mensaje que ve un operador, sin la jerga del motor.
 *
 * ⛔ 21 sep 2026. Cuatro mensajes comprobados salían con el nombre interno
 * de una restricción o en inglés: el filtro `JERGA` de `errores.ts` los
 * habría tapado, pero `traducir()` los envolvía ANTES y ese filtro ya no
 * los veía. Ahora el mismo filtro corre aquí.
 */
function limpiar(mensaje: string): string {
  const m = String(mensaje ?? '').trim();
  if (/^new row violates row-level security policy/i.test(m)) {
    return 'Eso está fuera de su alcance: no se escribe sobre personas ni datos de otra sede.';
  }
  const chk = /^new row for relation "[^"]+" violates check constraint "([^"]+)"$/.exec(m);
  if (chk) return `Ese dato no cumple la regla «${chk[1]}» del sistema.`;
  if (/^duplicate key value violates unique constraint/.test(m)) return 'Ya existe un registro con ese mismo valor.';
  if (JERGA.test(m)) {
    return 'La operación no cumple una regla del sistema. Revise los datos; si el problema sigue, reporte el código de la petición.';
  }
  return m || 'La operación no se pudo completar.';
}

/** Un usuario es un correo: es lo que la persona sabe escribir y lo que se puede verificar. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

@Controller('api/v1/administracion')
export class AdministracionController {
  constructor(private readonly db: DbService) {}

  /** Las cuentas que uno alcanza, con lo que hace falta para atenderlas. */
  @Get('cuentas')
  cuentas(@Req() req: Request, @Query('q') q?: string, @Query('limite') limite?: string) {
    exigirNivel(req, 4, 'administrar cuentas');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT * FROM identidad.listar_cuentas($1,$2)`,
        [textoOpcional(q, 'q', { max: 80 }),
         limite ? entero(limite, 'limite', { min: 1, max: 500 }) : 100]);
      /* ⛔ Los KPI eran el TAMAÑO DE LA PÁGINA: con `?limite=5` la
         pantalla decía «5 cuentas y 1 necesita atención» cuando eran 27 y
         4. El total sale de la base, con el mismo alcance. */
      const { rows: [t] } = await c.query(`SELECT * FROM identidad.resumen_cuentas()`);
      return {
        total_filas: rows.length, total: t.total, necesitan_atencion: t.necesitan_atencion,
        cuentas: rows,
        aviso: t.necesitan_atencion
          ? `${t.necesitan_atencion} de ${t.total} cuenta(s) necesitan atención: bloqueadas, suspendidas o con el segundo factor sin activar.`
          : null,
      };
    });
  }

  /**
   * Crear una cuenta. Devuelve la contraseña provisional UNA VEZ.
   * ⛔ No se guarda en ninguna parte legible ni se vuelve a mostrar: si se
   * pierde, se reinicia. Enviarla por correo desde el sistema sería peor:
   * quedaría en un buzón para siempre.
   */
  @Post('cuentas')
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear una cuenta');
    return conSesion(this.db, req, async (c) => {
      const clave = claveProvisional();
      try {
        const { rows: [r] } = await c.query(
          `SELECT identidad.crear_cuenta($1,$2,$3) AS id`,
          [uuid(b?.personaId, 'personaId'),
           /* ⛔ Solo el navegador exigía forma de correo: con una petición
              directa entraba cualquier texto como usuario. */
           texto(b?.usuario, 'usuario', { min: 5, max: 120, patron: CORREO }),
           derivarClave(clave)]);
        return {
          id: r.id, usuario: b.usuario, clave_provisional: clave,
          mensaje: 'Cuenta creada. Entregue esta contraseña en persona o por un canal seguro: '
                 + 'no se vuelve a mostrar y el sistema obligará a cambiarla al entrar.',
        };
      } catch (e: any) {
        traducir(e, {
          '23505': 'Ya existe una cuenta con ese usuario, o esa persona ya tiene cuenta.',
          '23503': 'Esa persona no existe.',
        });
        throw e;
      }
    });
  }

  @Post('cuentas/:id/reiniciar-clave')
  reiniciarClave(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'reiniciar una contraseña');
    return conSesion(this.db, req, async (c) => {
      const clave = claveProvisional();
      await c.query(`SELECT identidad.reiniciar_clave($1,$2)`, [uuid(id, 'id'), derivarClave(clave)]);
      return {
        clave_provisional: clave,
        mensaje: 'Contraseña reiniciada y TODAS sus sesiones cerradas. '
               + 'Entréguela por un canal seguro: no se vuelve a mostrar.',
      };
    });
  }

  @Post('cuentas/:id/desbloquear')
  desbloquear(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'desbloquear una cuenta');
    return conSesion(this.db, req, async (c) => {
      await c.query(`SELECT identidad.desbloquear($1)`, [uuid(id, 'id')]);
      return { mensaje: 'Cuenta desbloqueada.' };
    });
  }

  @Post('cuentas/:id/reiniciar-segundo-factor')
  reiniciarMfa(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'reiniciar el segundo factor');
    return conSesion(this.db, req, async (c) => {
      await c.query(`SELECT identidad.reiniciar_segundo_factor($1)`, [uuid(id, 'id')]);
      return {
        mensaje: 'Segundo factor reiniciado y sesiones cerradas. La persona lo volverá a configurar '
               + 'al entrar. NO se le quitó la exigencia: su rol lo sigue necesitando.',
      };
    });
  }

  /** Quién está dentro ahora mismo. */
  @Get('sesiones')
  sesiones(@Req() req: Request) {
    exigirNivel(req, 4, 'ver las sesiones abiertas');
    return conSesion(this.db, req, async (c) => {
      /* ⛔ Por función, no por SELECT directo: `identidad.sesiones` está
         cerrada a la aplicación y tiene que seguir estándolo. */
      const { rows } = await c.query(`SELECT * FROM identidad.ver_sesiones_activas(200)`);
      return { total_filas: rows.length, sesiones: rows };
    });
  }

  /** Quién está probando contraseñas. */
  @Get('alertas')
  alertas(@Req() req: Request) {
    exigirNivel(req, 4, 'ver las alertas de acceso');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(`SELECT * FROM identidad.ver_alertas_acceso(100)`);
      return {
        total_filas: rows.length, alertas: rows,
        aviso: rows.length ? `${rows.length} usuario(s) o dirección(es) con intentos fallidos agrupados.` : null,
      };
    });
  }

  /** Accesos que llevan demasiado sin revisarse. */
  /**
   * La lista de trabajo del comité trimestral.
   *
   * ⛔ 20 de septiembre de 2026. Esto devolvía TODOS los accesos vigentes
   * de la red y la consola los pintaba bajo la etiqueta «Por
   * recertificar», mientras este mismo aviso afirmaba que «llevan más del
   * plazo sin revisarse». Un acceso otorgado esta mañana ya contaba. En
   * la base había 17; los vencidos de verdad eran 0. Es exactamente la
   * cifra que un auditor contrasta en treinta segundos.
   */
  @Get('recertificar')
  recertificar(@Req() req: Request, @Query('todos') todos?: string) {
    exigirNivel(req, 4, 'ver los accesos por recertificar');
    return conSesion(this.db, req, async (c) => {
      const { rows: [n] } = await c.query(
        `SELECT count(*) FILTER (WHERE vencido) AS vencidos, count(*) AS vigentes
           FROM identidad.v_accesos_por_recertificar`);
      const { rows } = await c.query(
        `SELECT * FROM identidad.v_accesos_por_recertificar
          ${todos === 'si' ? '' : 'WHERE vencido'}
          ORDER BY vencido DESC, dias_sin_revisar DESC LIMIT 200`);
      return {
        total_filas: rows.length, accesos: rows,
        vencidos: Number(n.vencidos), vigentes: Number(n.vigentes),
        alcance_de_red: sesionDe(req).alcanceGlobal,
        /* ⛔ Para quien NO alcanza la red, la vista viene recortada por su
           alcance y el contador decía «0 de 0» en verde con 28 accesos
           vivos en la red. No se da un «todo al día» que no se puede ver. */
        aviso: !sesionDe(req).alcanceGlobal
          ? `Usted ve solo los accesos de su alcance (${n.vigentes}). La recertificación de la red la firma quien alcanza toda la red.`
          : Number(n.vencidos)
            ? `${n.vencidos} acceso(s) pasaron su plazo de revisión, de ${n.vigentes} vigentes. Un permiso que nadie revisa es un permiso que nadie quitó.`
            : `Ninguno de los ${n.vigentes} accesos vigentes pasó su plazo. El plazo es de 90 días para los que tocan datos N3 o N4, y de 180 para el resto.`,
      };
    });
  }

  /**
   * Recertificar un acceso: la puerta que NO EXISTÍA.
   *
   * ⛔ `identidad.recertificaciones` estaba creada desde la migración 0045
   * y nadie escribía en ella. La pantalla del comité era una lista que no
   * se podía tachar: `dias_sin_revisar` solo podía crecer.
   */
  @Post('recertificar/:asignacionId')
  recertificarUno(@Req() req: Request, @Param('asignacionId') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'recertificar un acceso');
    return conSesion(this.db, req, async (c) => {
      try {
        const veredicto = texto(b?.veredicto, 'veredicto', { min: 8, max: 12 });
        const { rows: [r] } = await c.query(
          `SELECT identidad.recertificar($1, $2, $3, $4::smallint) AS hecho`,
          [uuid(id, 'asignacionId'), veredicto,
           texto(b?.nota, 'nota', { min: 5, max: 400 }),
           /* ⛔ «Se reduce» no reducía nada: solo reiniciaba el reloj. Ahora
              exige a qué nivel, y la base lo aplica. */
           b?.nivelNuevo === undefined || b?.nivelNuevo === null || b?.nivelNuevo === ''
             ? null : entero(b.nivelNuevo, 'nivelNuevo', { min: 0, max: 4 })]);
        const h = r.hecho;
        return { ...h, mensaje:
          veredicto === 'se_revoca' ? 'Revisado y REVOCADO. La persona pierde ese acceso ahora mismo.'
          : veredicto === 'se_reduce' ? `Revisado y REDUCIDO de N${h.nivel_antes} a N${h.nivel_despues}. Surte efecto en la próxima petición de esa persona.`
          : 'Revisado. El contador de días vuelve a cero y queda firmado con su nombre.' };
      } catch (e: any) { traducir(e); }
    });
  }

  /**
   * Cerrarle la sesión a alguien.
   *
   * ⛔ «Sesiones y alertas» era de SOLO LECTURA: se veía quién estaba
   * dentro y no había forma de echarlo. Si alguien pierde el teléfono un
   * domingo, esto es lo que hay que poder hacer sin entrar a la base.
   */
  @Post('sesiones/:id/cerrar')
  cerrarSesion(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'cerrar la sesión de otra persona');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT identidad.cerrar_sesion_de_otro($1, $2) AS hecho`,
          [uuid(id, 'id'), texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
        return { ...r.hecho, mensaje: 'Sesión cerrada. Surte efecto ahora, no cuando expire el token.' };
      } catch (e: any) { traducir(e); }
    });
  }

  /** El organigrama: central, regiones, direcciones y equipos. */
  @Get('organigrama')
  organigrama(@Req() req: Request) {
    exigirNivel(req, 2, 'ver el organigrama');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT * FROM org.v_organigrama ORDER BY ruta`);
      return { total_filas: rows.length, unidades: rows };
    });
  }

  /** Los módulos de una sede y cuáles están encendidos. */
  @Get('sedes/:id/modulos')
  modulosDeSede(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 3, 'ver los módulos de una sede');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT m.codigo, m.nombre, m.nivel_dato, m.es_nucleo, m.exige_compuerta_legal, m.depende_de,
                COALESCE(ms.activo, false) AS activo, ms.evidencia_legal_ref, ms.activado_en, ms.nota,
                ms.desactivado_en, pe.nombre_completo AS activado_por_nombre,
                pd.nombre_completo AS desactivado_por_nombre
           FROM sistema.modulos m
           LEFT JOIN sistema.modulos_sede ms ON ms.modulo = m.codigo AND ms.sede_id = $1
           LEFT JOIN nucleo.v_personas pe ON pe.id = ms.activado_por
           LEFT JOIN nucleo.v_personas pd ON pd.id = ms.desactivado_por
          ORDER BY m.es_nucleo DESC, m.nombre`, [uuid(id, 'id')]);
      const faltaEvidencia = rows.filter(r => r.activo && r.exige_compuerta_legal && !r.evidencia_legal_ref);
      return {
        total_filas: rows.length, modulos: rows,
        aviso: faltaEvidencia.length
          ? `${faltaEvidencia.length} módulo(s) encendidos con compuerta legal y sin la referencia del instrumento jurídico.`
          : null,
      };
    });
  }

  /** Encender o apagar un módulo en una sede. La base impone las reglas. */
  @Post('sedes/:id/modulos')
  habilitarModulo(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'encender o apagar un módulo');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(
          `SELECT sistema.habilitar_modulo($1,$2,$3,$4,$5)`,
          [uuid(id, 'id'), texto(b?.modulo, 'modulo', { min: 2, max: 40 }),
           booleano(b?.activo, 'activo'),
           textoOpcional(b?.evidencia, 'evidencia', { max: 200 }),
           textoOpcional(b?.nota, 'nota', { max: 400 })]);
        return { mensaje: b.activo ? 'Módulo encendido en esa sede.' : 'Módulo apagado en esa sede.' };
      } catch (e: any) {
        traducir(e);
        throw e;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     EL COMANDO CENTRAL
     ⛔ Esta es la razón de ser del módulo. El equipo de la central es
     quien despliega iglesias, personas, roles y módulos, y quien arma los
     equipos (contabilidad, tesorería, pastoral) que después administran lo
     suyo. Sin estas rutas, «administrar la red» era entrar a la base.
     ══════════════════════════════════════════════════════════════════ */

  /** Las plantillas: qué módulos trae una iglesia nueva según su tipo. */
  @Get('plantillas')
  plantillas(@Req() req: Request) {
    exigirNivel(req, 3, 'ver las plantillas de iglesia');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT p.codigo, p.nombre, p.tipo_sede, p.descripcion,
                count(pm.modulo)::int AS modulos,
                string_agg(m.nombre, ', ' ORDER BY m.orden) AS lista,
                count(*) FILTER (WHERE m.exige_compuerta_legal)::int AS con_compuerta_legal
           FROM sistema.plantillas p
           LEFT JOIN sistema.plantilla_modulos pm ON pm.plantilla = p.codigo
           LEFT JOIN sistema.modulos m ON m.codigo = pm.modulo
          GROUP BY p.codigo, p.nombre, p.tipo_sede, p.descripcion
          ORDER BY p.nombre`);
      return {
        total_filas: rows.length, plantillas: rows,
        aviso: 'Los módulos con compuerta legal nacen APAGADOS: se encienden cuando exista la evidencia jurídica.',
      };
    });
  }

  /**
   * Desplegar una iglesia.
   *
   * ⛔ Una sola llamada hace lo que antes eran seis pasos a mano: crea la
   * sede colgada de la maestra, le aplica los módulos de su plantilla,
   * deja apagados los de compuerta legal y le asigna su pastor. La base
   * exige alcance de organización: una sede no crea otra sede.
   */
  @Post('iglesias')
  crearIglesia(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'desplegar una iglesia');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT sistema.crear_iglesia($1,$2,$3::org.tipo_sede,$4::char(2),$5,$6,$7,$8::smallint,$9::smallint) AS id`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 20 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.tipo, 'tipo', { min: 4, max: 30 }),
           texto(b?.pais, 'pais', { min: 2, max: 2 }),
           texto(b?.ciudad, 'ciudad', { min: 2, max: 80 }),
           texto(b?.plantilla, 'plantilla', { min: 2, max: 30 }),
           uuid(b?.pastorId, 'pastorId'),
           b?.ola === undefined || b?.ola === null ? null : entero(b.ola, 'ola', { min: 1, max: 20 }),
           /* ⛔ El pastor nacía con N2 escrito a mano y Consejería exige N3:
              ningún pastor de una iglesia nueva abría su consejería. El nivel
              se decide al desplegar; por omisión N3. */
           b?.nivelPastor === undefined || b?.nivelPastor === null ? 3 : entero(b.nivelPastor, 'nivelPastor', { min: 2, max: 4 })]);
        return {
          id: r.id,
          mensaje: 'Iglesia desplegada con su plantilla y su pastor. '
                 + 'Los módulos con compuerta legal quedaron apagados hasta que haya evidencia jurídica.',
        };
      } catch (e: any) {
        traducir(e, { '23505': 'Ya existe una iglesia con ese código.' });
      }
    });
  }

  /**
   * Desactivar o reactivar una iglesia.
   * ⛔ Desplegar no tenía vuelta atrás: un error de dedo en el código
   * dejaba una iglesia permanente que no se podía ni borrar ni apagar. No
   * se borra (su historia se conserva): se desactiva, con motivo.
   */
  @Post('sedes/:id/estado')
  estadoSede(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'activar o desactivar una iglesia');
    return conSesion(this.db, req, async (c) => {
      try {
        const activa = booleano(b?.activa, 'activa');
        const { rows: [r] } = await c.query(`SELECT sistema.cambiar_estado_sede($1,$2,$3) AS hecho`,
          [uuid(id, 'id'), activa, texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
        return { ...r.hecho, mensaje: activa
          ? 'Iglesia reactivada. Vuelve a aparecer en los formularios.'
          : 'Iglesia desactivada. Deja de ofrecerse en los formularios; su gente y su historia se conservan.' };
      } catch (e: any) { traducir(e); }
    });
  }

  /** La puesta en marcha, contada en la base y no en el navegador. */
  @Get('arranque')
  arranque(@Req() req: Request) {
    exigirNivel(req, 4, 'ver la puesta en marcha');
    return conSesion(this.db, req, async (c) => {
      const { rows: [r] } = await c.query(`SELECT sistema.estado_de_arranque() AS e`);
      return r.e;
    });
  }

  /** Registrar a una persona. Es el otro despliegue del comando central. */
  @Post('personas')
  crearPersona(@Req() req: Request, @Body() b: any) {
    /* ⛔ La pestaña dice N4 y el paso 1 exigía N2: con N3 se registraba a
       la persona y el paso 2 respondía que hacía falta N4. Media pantalla
       inutilizable sin avisar. Se pide lo mismo desde el principio. */
    exigirNivel(req, 4, 'registrar a una persona desde el comando central');
    return conSesion(this.db, req, async (c) => {
      const fnac = b?.fechaNacimiento ? fecha(b.fechaNacimiento, 'fechaNacimiento') : null;
      /* ⛔ Registrar a un MENOR era imposible, y el mensaje mentía: la
         base exige su acudiente en la MISMA operación (regla diferida que
         salta al confirmar, fuera de cualquier try), y la pantalla decía
         «el registro hace referencia a algo que no existe». Ahora se
         pregunta ANTES y se registran juntos. */
      let menor = false;
      if (fnac) {
        const { rows: [m] } = await c.query(`SELECT nucleo.es_menor($1::date) AS menor`, [fnac]);
        menor = Boolean(m?.menor);
      }
      const acudienteId = menor ? (b?.acudienteId ? uuid(b.acudienteId, 'acudienteId') : null) : null;
      if (menor && !acudienteId) {
        throw new BadRequestException(
          'Es menor de edad: se registra junto con su acudiente. Elija al acudiente (ya registrado como adulto) y el parentesco.');
      }
      try {
        const { rows: [p] } = await c.query(
          `INSERT INTO nucleo.personas
             (sede_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              tipo_documento, numero_documento, fecha_nacimiento, email_principal, telefono_movil)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10)
           RETURNING id`,
          [uuid(b?.sedeId, 'sedeId'),
           texto(b?.primerNombre, 'primerNombre', { min: 2, max: 60 }),
           textoOpcional(b?.segundoNombre, 'segundoNombre', { max: 60 }),
           texto(b?.primerApellido, 'primerApellido', { min: 2, max: 60 }),
           textoOpcional(b?.segundoApellido, 'segundoApellido', { max: 60 }),
           textoOpcional(b?.tipoDocumento, 'tipoDocumento', { max: 10 }),
           textoOpcional(b?.numeroDocumento, 'numeroDocumento', { max: 40 }),
           fnac,
           textoOpcional(b?.email, 'email', { max: 160, patron: CORREO }),
           textoOpcional(b?.telefono, 'telefono', { max: 40 })]);
        if (menor && acudienteId) {
          const { rows: [adulto] } = await c.query(
            `SELECT NOT nucleo.es_menor(fecha_nacimiento) AS es_adulto FROM nucleo.personas WHERE id = $1`, [acudienteId]);
          if (!adulto) throw new BadRequestException('Ese acudiente no existe o no está en su alcance.');
          if (!adulto.es_adulto) throw new BadRequestException('El acudiente tiene que ser un adulto.');
          /* El parentesco es un código del catálogo de vínculos, y solo
             valen los que CONFIEREN CUSTODIA (un primo no es acudiente). */
          const parentesco = texto(b?.parentesco, 'parentesco', { min: 3, max: 40 }).toUpperCase();
          const { rows: [v] } = await c.query(
            `SELECT confiere_custodia FROM nucleo.tipos_vinculo WHERE codigo = $1`, [parentesco]);
          if (!v?.confiere_custodia) {
            const { rows: validos } = await c.query(
              `SELECT nombre FROM nucleo.tipos_vinculo WHERE confiere_custodia ORDER BY nombre`);
            throw new BadRequestException(
              `«${b?.parentesco}» no sirve como parentesco de un acudiente. Valen: ${validos.map((x: any) => x.nombre).join(', ')}.`);
          }
          await c.query(
            `INSERT INTO nucleo.acudientes (menor_id, acudiente_id, parentesco, es_principal, autoriza_retiro, vigente_desde)
             VALUES ($1,$2,$3,true,$4,CURRENT_DATE)`,
            [p.id, acudienteId, parentesco, b?.autorizaRetiro === false ? false : true]);
        }
        return { id: p.id, menor, mensaje: menor
          ? 'Menor registrado junto con su acudiente. Sus datos son N4: toda lectura queda registrada.'
          : 'Persona registrada. Ya se le puede crear cuenta y otorgar roles.' };
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        traducir(e, {
          '23505': 'Ya hay alguien con ese documento.',
          '23503': 'Esa sede no está en su alcance.',
          ...(String(e.message).includes('personas_documento_completo') ? { '23514':
            'El documento va completo o no va: si escribe el número, elija también el tipo (CC, TI, CE…), y al revés.' } : {}),
        });
      }
    });
  }

  /** Los equipos de la central: contabilidad, tesorería, pastoral, regiones. */
  @Get('unidades')
  unidades(@Req() req: Request) {
    exigirNivel(req, 2, 'ver los equipos');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT u.id, u.codigo, u.nombre, u.clase, u.padre_id, u.proposito, u.activa,
                pa.nombre AS padre, li.nombre_completo AS lider,
                (SELECT count(*) FROM org.unidad_miembros m
                  WHERE m.unidad_id = u.id AND m.hasta IS NULL AND m.revocado_en IS NULL) AS integrantes,
                (SELECT count(*) FROM identidad.asignaciones_unidad a
                  WHERE a.unidad_id = u.id AND a.revocada_en IS NULL) AS roles
           FROM org.unidades u
           LEFT JOIN org.unidades pa ON pa.id = u.padre_id
           LEFT JOIN nucleo.v_personas li ON li.id = u.lider_persona_id
          ORDER BY u.clase, u.nombre`);
      const sinRol = rows.filter(u => u.clase === 'equipo' && Number(u.roles) === 0).length;
      return {
        total_filas: rows.length, unidades: rows,
        aviso: sinRol ? `${sinRol} equipo(s) sin ningún rol otorgado: existen pero no pueden hacer nada.` : null,
      };
    });
  }

  /** Crear un equipo. */
  @Post('unidades')
  crearUnidad(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear un equipo');
    return conSesion(this.db, req, async (c) => {
      try {
        /* ⛔ Por función: `org.unidades` es de solo lectura para la
           aplicación, y tiene que seguir siéndolo. Crear una dirección de
           la central es un acto estructural, no una operación del día. */
        const { rows: [u] } = await c.query(
          `SELECT org.crear_equipo($1,$2,$3,$4,$5,$6) AS id`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 30 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.clase, 'clase', { min: 4, max: 20 }),
           /* El propósito es obligatorio y largo a propósito: un equipo
              sin propósito escrito es un equipo que nadie sabe por qué
              tiene los permisos que tiene. */
           texto(b?.proposito, 'proposito', { min: 15, max: 400 }),
           b?.padreId ? uuid(b.padreId, 'padreId') : null,
           b?.liderId ? uuid(b.liderId, 'liderId') : null]);
        return { id: u.id, mensaje: 'Equipo creado. Ahora otórguele su rol: un equipo sin rol no puede hacer nada.' };
      } catch (e: any) {
        traducir(e, { '23505': 'Ya existe un equipo con ese código.' });
        throw e;
      }
    });
  }

  /** Meter a alguien en un equipo. Hereda los roles del equipo. */
  @Post('unidades/:id/miembros')
  meterEnEquipo(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    /* ⛔ N4, no N3. Un auditor lo midió: meter a una persona en un equipo
       que ya sostiene un rol de alcance de ORGANIZACIÓN la vuelve global
       al instante, con su token vivo y sin volver a entrar. Es decir, una
       acción de N3 producía el efecto de una de N4 (la de otorgar un rol
       al equipo). Los dos caminos piden ahora lo mismo. */
    exigirNivel(req, 4, 'meter a alguien en un equipo');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(`SELECT org.meter_en_equipo($1,$2,$3)`,
          [uuid(id, 'id'), uuid(b?.personaId, 'personaId'),
           textoOpcional(b?.rolEnUnidad, 'rolEnUnidad', { max: 40 }) ?? 'integrante']);
        return {
          mensaje: 'Integrante agregado. ⛔ Hereda los roles del equipo desde este instante: '
                 + 'revise qué alcanza el equipo antes de dejarlo así.',
        };
      } catch (e: any) {
        traducir(e, {
          '23505': 'Esa persona ya está en el equipo.',
          '23503': 'El equipo o la persona no existen.',
        });
        throw e;
      }
    });
  }

  /** Sacar a alguien. Surte efecto en el instante, y exige motivo. */
  @Post('unidades/:id/miembros/:personaId/salir')
  sacarDeEquipo(@Req() req: Request, @Param('id') id: string,
                @Param('personaId') personaId: string, @Body() b: any) {
    exigirNivel(req, 3, 'sacar a alguien de un equipo');
    return conSesion(this.db, req, async (c) => {
      await c.query(`SELECT org.sacar_del_equipo($1,$2,$3)`,
        [uuid(id, 'id'), uuid(personaId, 'personaId'),
         texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
      return { mensaje: 'Fuera del equipo, y sin esperar a mañana: los permisos heredados se cortan ya.' };
    });
  }

  /** Los integrantes y los roles de un equipo. */
  @Get('unidades/:id')
  fichaUnidad(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver un equipo');
    return conSesion(this.db, req, async (c) => {
      const u = uuid(id, 'id');
      const { rows: [unidad] } = await c.query(
        `SELECT u.id, u.codigo, u.nombre, u.clase, u.proposito, u.activa,
                li.nombre_completo AS lider
           FROM org.unidades u LEFT JOIN nucleo.v_personas li ON li.id = u.lider_persona_id
          WHERE u.id = $1`, [u]);
      if (!unidad) throw new BadRequestException('Ese equipo no existe.');
      const { rows: miembros } = await c.query(
        `SELECT m.id, m.persona_id, p.nombre_completo, m.rol_en_unidad,
                to_char(m.desde,'YYYY-MM-DD') AS desde,
                to_char(m.hasta,'YYYY-MM-DD') AS hasta, m.motivo_salida
           FROM org.unidad_miembros m JOIN nucleo.v_personas p ON p.id = m.persona_id
          WHERE m.unidad_id = $1 AND m.revocado_en IS NULL
          ORDER BY m.hasta NULLS FIRST, p.nombre_completo`, [u]);
      const { rows: roles } = await c.query(
        `SELECT a.id, a.rol, r.nombre AS rol_nombre, a.alcance_tipo, a.nivel_max,
                to_char(a.vigente_desde,'YYYY-MM-DD') AS desde,
                to_char(a.vigente_hasta,'YYYY-MM-DD') AS hasta, a.acta_referencia,
                (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE) AS vigente
           FROM identidad.asignaciones_unidad a
           LEFT JOIN identidad.roles r ON r.codigo = a.rol
          WHERE a.unidad_id = $1 AND a.revocada_en IS NULL
          ORDER BY (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE) DESC, a.nivel_max DESC`, [u]);
      /* ⛔ Medía el ORGANIGRAMA (las sedes que cuelgan de la unidad), no el
         alcance del equipo: para un equipo, siempre vacío, y la pantalla
         decía «Ninguna por esta vía» justo cuando alcanzaba toda la red.
         Ahora sale de los roles vigentes del equipo. */
      const { rows: sedes } = await c.query(
        `SELECT codigo, nombre, por_rol FROM org.sedes_que_alcanza_el_equipo($1) ORDER BY codigo`, [u]);
      return {
        unidad,
        miembros: { activos: miembros.filter(m => !m.hasta).length, lista: miembros },
        roles,
        alcanza: sedes,
        aviso: roles.length === 0
          ? 'Este equipo no tiene ningún rol: existe, pero no puede hacer nada.'
          : null,
      };
    });
  }

  /**
   * Otorgarle un rol AL EQUIPO. Es la pieza que convierte «un grupo de
   * personas» en «contabilidad»: lo que se otorga aquí lo hereda cada
   * integrante mientras esté dentro, y se le cae al salir.
   */
  @Post('unidades/:id/roles')
  otorgarAEquipo(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'otorgar un rol a un equipo');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [a] } = await c.query(
          `INSERT INTO identidad.asignaciones_unidad
             (unidad_id, rol, alcance_tipo, alcance_id, nivel_max, vigente_hasta, otorgado_por, acta_referencia)
           VALUES ($1,$2,$3::identidad.tipo_alcance,$4,$5::smallint,$6::date,
                   plataforma.ctx_persona_id(),$7)
           RETURNING id, rol, alcance_tipo, nivel_max`,
          [uuid(id, 'id'),
           texto(b?.rol, 'rol', { min: 2, max: 40 }),
           texto(b?.alcanceTipo, 'alcanceTipo', { min: 4, max: 20 }),
           b?.alcanceId ? uuid(b.alcanceId, 'alcanceId') : null,
           entero(b?.nivelMax, 'nivelMax', { min: 1, max: 4 }),
           textoOpcional(b?.vigenteHasta, 'vigenteHasta', { max: 10 }),
           /* ⛔ El acta. Un permiso de red sin un papel detrás es un
              permiso que nadie puede explicar en una auditoría. */
           texto(b?.acta, 'acta', { min: 3, max: 200 })]);
        return { ...a, mensaje: 'Rol otorgado al equipo. Lo heredan sus integrantes desde ahora.' };
      } catch (e: any) {
        traducir(e, { '23503': 'El equipo, el rol o el alcance no existen.' });
        throw e;
      }
    });
  }

  /** Quitarle el rol al equipo. Se corta para todos sus integrantes. */
  @Post('unidades/roles/:asignacionId/revocar')
  revocarDeEquipo(@Req() req: Request, @Param('asignacionId') asignacionId: string, @Body() b: any) {
    exigirNivel(req, 4, 'revocar el rol de un equipo');
    return conSesion(this.db, req, async (c) => {
      /* ⛔ Función distinta: el rol de un equipo vive en
         `asignaciones_unidad`, no en `asignaciones`. La primera versión
         llamaba a la de personas y respondía «no existe». */
      await c.query(`SELECT identidad.revocar_asignacion_unidad($1,$2)`,
        [uuid(asignacionId, 'asignacionId'), texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
      return { mensaje: 'Rol revocado. Todos los integrantes lo pierden en este instante.' };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     GOBIERNO EDITABLE
     ⛔ Las cuatro tablas que definen quién puede qué estaban en SOLO
     LECTURA para la aplicación: se podían mirar y no tocar. Un comando
     central que no puede cambiar la matriz de permisos es un informe.
     ══════════════════════════════════════════════════════════════════ */

  /** El catálogo de módulos y el de acciones, para pintar las casillas. */
  @Get('catalogo')
  catalogo(@Req() req: Request) {
    exigirNivel(req, 2, 'ver el catálogo del sistema');
    return conSesion(this.db, req, async (c) => {
      const [m, a, r, n, td, vin] = await Promise.all([
        c.query(`SELECT codigo, nombre, esquema, nivel_dato, es_nucleo, exige_compuerta_legal, depende_de, orden
                   FROM sistema.modulos ORDER BY orden, nombre`),
        c.query(`SELECT codigo, nombre, orden, es_sensible, modulo, descripcion
                   FROM sistema.acciones ORDER BY orden, codigo`),
        c.query(`SELECT codigo, nombre, alcance_maximo, nivel_maximo, descripcion, activo
                   FROM identidad.roles ORDER BY nivel_maximo DESC, nombre`),
        c.query(`SELECT nivel, codigo, descripcion, exige_cifrado, exige_bitacora_lect
                   FROM plataforma.niveles_sensibilidad ORDER BY nivel`),
        /* ⛔ Los tipos de documento salen del CATÁLOGO, no de una lista
           escrita en el frontend: la central los cambia sin desplegar. */
        c.query(`SELECT codigo, etiqueta, descripcion
                   FROM sistema.catalogo_valores
                  WHERE catalogo='tipo_documento' AND vigente AND retirado_en IS NULL
                  ORDER BY orden`),
        c.query(`SELECT codigo, nombre FROM nucleo.tipos_vinculo WHERE confiere_custodia ORDER BY nombre`),
      ]);
      return { modulos: m.rows, acciones: a.rows, roles: r.rows,
               niveles: n.rows, tiposDocumento: td.rows, vinculosDeCustodia: vin.rows };
    });
  }

  /** La matriz: rol × módulo × acción, con la casilla ya marcada o no. */
  @Get('matriz')
  matriz(@Req() req: Request, @Query('rol') rol?: string) {
    exigirNivel(req, 3, 'ver la matriz de permisos');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(`SELECT * FROM sistema.ver_matriz($1)`,
        [textoOpcional(rol, 'rol', { max: 40 })]);
      const enganosos = rows.filter(r => r.marcado && r.por_encima);
      return {
        total_filas: rows.length, matriz: rows,
        aviso: enganosos.length
          ? `⛔ ${enganosos.length} permiso(s) marcados sobre módulos cuyo dato está POR ENCIMA del techo del rol. `
            + 'La casilla se puede marcar, pero la base no devolverá una sola fila: es un permiso que engaña.'
          : null,
      };
    });
  }

  /** Marcar o desmarcar UNA casilla. */
  @Post('matriz')
  marcarPermiso(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'cambiar la matriz de permisos');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT sistema.marcar_permiso($1,$2,$3,$4,$5::smallint,$6) AS marcado`,
          [texto(b?.rol, 'rol', { min: 2, max: 40 }),
           texto(b?.modulo, 'modulo', { min: 2, max: 40 }),
           texto(b?.accion, 'accion', { min: 2, max: 40 }),
           booleano(b?.marcado, 'marcado'),
           b?.nivelMax === undefined || b?.nivelMax === null ? null : entero(b.nivelMax, 'nivelMax', { min: 0, max: 4 }),
           /* ⛔ Cambiar la matriz no dejaba rastro ni acta: la consola nunca
              la mandaba. Ahora es obligatoria y va a la auditoría. */
           texto(b?.acta, 'acta', { min: 4, max: 200 })]);
        return r.marcado;
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  /** Crear o editar un rol, con su techo y su alcance máximo. */
  @Post('roles')
  guardarRol(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear o cambiar un rol');
    return conSesion(this.db, req, async (c) => {
      try {
        /* ⛔ «+ Crear un rol» era un UPSERT: escribir TESORERIA en el código
           REESCRIBÍA el rol de Tesorería de toda la red y decía «guardado».
           Crear y editar son ahora dos puertas. */
        if (b?.nuevo === true) {
          await c.query(`SELECT identidad.crear_rol($1,$2,$3,$4::smallint,$5)`,
            [texto(b?.codigo, 'codigo', { min: 3, max: 40 }),
             texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
             texto(b?.alcanceMaximo, 'alcanceMaximo', { min: 4, max: 30 }),
             entero(b?.nivelMaximo, 'nivelMaximo', { min: 0, max: 4 }),
             texto(b?.descripcion, 'descripcion', { min: 10, max: 400 })]);
          return { mensaje: 'Rol creado. Ahora márquele sus permisos en la matriz.' };
        }
        await c.query(`SELECT identidad.guardar_rol($1,$2,$3,$4::smallint,$5,$6)`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 40 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.alcanceMaximo, 'alcanceMaximo', { min: 4, max: 30 }),
           entero(b?.nivelMaximo, 'nivelMaximo', { min: 0, max: 4 }),
           textoOpcional(b?.descripcion, 'descripcion', { max: 400 }),
           /* ⛔ `undefined` viaja como NULL y la función lo entiende como
              «no lo toque». Antes se mandaba `true` por omisión, así que
              cambiarle el nombre a un rol descontinuado lo devolvía a la
              circulación sin que nadie lo pidiera. */
           typeof b?.activo === 'boolean' ? b.activo : null]);
        return { mensaje: 'Rol guardado. Los permisos que le sobren por encima del techo dejan de servir.' };
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  /** Crear o editar una plantilla de iglesia. */
  @Post('plantillas')
  guardarPlantilla(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear o cambiar una plantilla');
    return conSesion(this.db, req, async (c) => {
      try {
        const nueva = b?.nueva === true;
        await c.query(`SELECT sistema.guardar_plantilla($1,$2,$3,$4,$5)`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 30 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.tipoSede, 'tipoSede', { min: 4, max: 30 }),
           textoOpcional(b?.descripcion, 'descripcion', { max: 400 }),
           nueva]);
        return { mensaje: nueva
          ? 'Plantilla creada con los módulos de núcleo puestos. Marque los demás que debe traer una iglesia nueva.'
          : 'Plantilla guardada.' };
      } catch (e: any) {
        traducir(e, { '22P02': 'Ese tipo de sede no existe.' });
        throw e;
      }
    });
  }

  /** La casilla de un módulo dentro de una plantilla. */
  @Post('plantillas/:codigo/modulos')
  marcarModuloPlantilla(@Req() req: Request, @Param('codigo') codigo: string, @Body() b: any) {
    exigirNivel(req, 4, 'cambiar los módulos de una plantilla');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT sistema.marcar_modulo_de_plantilla($1,$2,$3) AS marcado`,
          [texto(codigo, 'codigo', { min: 2, max: 30 }),
           texto(b?.modulo, 'modulo', { min: 2, max: 40 }),
           booleano(b?.marcado, 'marcado')]);
        return { marcado: r.marcado, mensaje: r.marcado ? 'Módulo añadido a la plantilla.' : 'Módulo quitado.' };
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  @Post('plantillas/:codigo/borrar')
  borrarPlantilla(@Req() req: Request, @Param('codigo') codigo: string) {
    exigirNivel(req, 4, 'borrar una plantilla');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(`SELECT sistema.borrar_plantilla($1)`, [texto(codigo, 'codigo', { min: 2, max: 30 })]);
        return { mensaje: 'Plantilla borrada.' };
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  /** La ficha de una persona: su cuenta, sus roles y sus sesiones. */
  @Get('personas/:id')
  fichaPersona(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 3, 'ver la ficha de una persona');
    return conSesion(this.db, req, async (c) => {
      const p = uuid(id, 'id');
      const { rows: [persona] } = await c.query(
        `SELECT p.id, p.nombre_completo, p.numero_documento, p.tipo_documento,
                p.email_principal, p.telefono_movil, p.estado, p.edad, p.es_menor,
                s.codigo AS sede, s.nombre AS sede_nombre
           FROM nucleo.v_personas p LEFT JOIN org.sedes s ON s.id = p.sede_id
          WHERE p.id = $1`, [p]);
      if (!persona) throw new NotFoundException('Esa persona no existe o no está en su alcance.');
      /* ⛔ La pantalla prometía «toda lectura de un menor queda registrada
         con nombre y fecha» y NO se escribía nada. Consejería y RocaKids sí
         lo hacían. Ahora también aquí, antes de devolver un solo dato. */
      if (persona.es_menor) {
        await c.query(`SELECT plataforma.registrar_lectura($1,$2,$3,$4::smallint,$5,$6)`,
          ['nucleo', 'personas', p, 4, 'Ficha de un menor en la consola de administración', 1]);
      }
      /* ⛔ Buscaba la cuenta entre las primeras 500 con `.find()`: con más
         cuentas decía «no tiene cuenta» a quien sí la tenía. */
      let cuenta: any = null;
      try {
        const { rows: [cu] } = await c.query(`SELECT * FROM identidad.cuenta_de($1)`, [p]);
        cuenta = cu ?? null;
      } catch { cuenta = null; }
      const { rows: roles } = await c.query(
        `SELECT a.id, a.rol, r.nombre AS rol_nombre, a.alcance_tipo, a.alcance_id, a.nivel_max,
                to_char(a.vigente_desde,'YYYY-MM-DD') AS desde,
                to_char(a.vigente_hasta,'YYYY-MM-DD') AS hasta, a.acta_referencia,
                (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE) AS vigente,
                s.nombre AS sede_nombre
           FROM identidad.asignaciones a
           LEFT JOIN identidad.roles r ON r.codigo = a.rol
           LEFT JOIN org.sedes s ON a.alcance_tipo = 'sede' AND s.id = a.alcance_id
          WHERE a.persona_id = $1 AND a.revocada_en IS NULL
          ORDER BY (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE) DESC, a.nivel_max DESC`, [p]);
      const { rows: equipos } = await c.query(
        `SELECT u.id, u.nombre, u.clase, m.rol_en_unidad
           FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id
          WHERE m.persona_id = $1 AND m.hasta IS NULL AND m.revocado_en IS NULL`, [p]);
      const { rows: [tot] } = await c.query(`SELECT identidad.accesos_vigentes_de($1) AS n`, [p]);
      const vivos = roles.filter((r: any) => r.vigente).length + equipos.length;
      const fuera = Math.max(0, Number(tot?.n ?? 0) - vivos);
      return {
        persona, cuenta, roles, equipos,
        accesos_fuera_de_su_alcance: fuera,
        aviso: vivos === 0 && fuera === 0
          ? 'Esta persona no tiene ningún rol ni equipo vigente: puede entrar y no ve nada.'
          : fuera > 0 && vivos === 0
            ? `Esta persona tiene ${fuera} acceso(s) en un alcance que usted no ve: no se muestran aquí.`
            : null,
      };
    });
  }

  /** La ficha de una iglesia: qué ve, quién la atiende y quién la alcanza. */
  @Get('sedes/:id')
  fichaSede(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver la ficha de una iglesia');
    return conSesion(this.db, req, async (c) => {
      const s = uuid(id, 'id');
      const { rows: [sede] } = await c.query(
        `SELECT s.id, s.codigo, s.nombre, s.tipo, s.pais, s.ciudad, s.activa,
                pa.codigo AS sede_padre, s.ola_migracion
           FROM org.sedes s LEFT JOIN org.sedes pa ON pa.id = s.sede_padre_id
          WHERE s.id = $1`, [s]);
      if (!sede) throw new NotFoundException('Esa iglesia no existe.');
      /* ⛔ Las sedes son dato N0 (cualquiera las lista), pero lo de ADENTRO
         no: fuera del alcance, el RLS vaciaba los conteos y la ficha se
         pintaba con ceros y con una alarma roja FALSA («NO tiene pastor»).
         «No puedo ver al pastor» se convertía en «no hay pastor». */
      const { rows: [vis] } = await c.query(`SELECT plataforma.sede_visible($1) AS ve`, [s]);
      if (!vis?.ve) {
        throw new ForbiddenException('Esa iglesia no está en su alcance: su ficha la ve quien la administra o la red.');
      }
      const { rows: [conteo] } = await c.query(
        `SELECT (SELECT count(*) FROM nucleo.personas p WHERE p.sede_id = $1 AND p.eliminado_en IS NULL) AS personas,
                (SELECT count(*) FROM grupos.grupos g WHERE g.sede_id = $1 AND g.cerrado_en IS NULL) AS grupos,
                (SELECT count(*) FROM sistema.modulos_sede ms WHERE ms.sede_id = $1 AND ms.activo) AS modulos_encendidos`,
        [s]);
      const { rows: equipo } = await c.query(
        /* ⛔ Faltaban `desde` y `rol_nombre`: la columna «Desde» de
           «Quién la pastorea» salía en guion en TODAS las filas. */
        `SELECT a.persona_id, p.nombre_completo AS persona, p.nombre_completo,
                a.rol, r.nombre AS rol_nombre, a.nivel_max,
                to_char(a.vigente_desde, 'YYYY-MM-DD') AS desde
           FROM identidad.asignaciones a
           JOIN nucleo.v_personas p ON p.id = a.persona_id
           LEFT JOIN identidad.roles r ON r.codigo = a.rol
          WHERE a.alcance_tipo = 'sede' AND a.alcance_id = $1 AND a.revocada_en IS NULL
            AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
          ORDER BY a.nivel_max DESC, p.nombre_completo`, [s]);
      const { rows: unidades } = await c.query(
        `SELECT u.id, u.nombre, u.clase FROM org.unidades u
          WHERE $1 = ANY(org.sedes_de_unidad(u.id)) AND u.activa
          ORDER BY u.clase, u.nombre`, [s]);
      return {
        sede, conteo, equipo, unidades,
        aviso: equipo.some(e => e.rol === 'PASTOR_CONGREGACIONAL')
          ? null
          : '⛔ Esta iglesia NO tiene pastor congregacional asignado. Una sede sin pastor no se opera sola.',
      };
    });
  }

  /**
   * La bandeja de salida: sus cuatro números y los avisos que murieron.
   * ⛔ Antes no había forma de ver un aviso muerto sin entrar a la base.
   */
  @Get('avisos')
  avisos(@Req() req: Request, @Query('estado') estado?: string) {
    exigirNivel(req, 4, 'ver la bandeja de salida');
    return conSesion(this.db, req, async (c) => {
      const { rows: [salud] } = await c.query(`SELECT * FROM plataforma.salud_avisos()`);
      const { rows } = await c.query(`SELECT * FROM plataforma.ver_avisos($1, 200)`,
        [estado && ['fallida', 'pendiente', 'enviando', 'enviada', 'descartada'].includes(estado) ? estado : 'fallida']);
      return {
        salud, avisos: rows, total_filas: rows.length,
        aviso: Number(salud?.muertos ?? 0) > 0
          ? `${salud.muertos} aviso(s) murieron tras sus intentos. Revise el error de cada uno antes de reprocesar.`
          : null,
      };
    });
  }

  @Post('avisos/:id/reprocesar')
  reprocesarAviso(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'reprocesar un aviso');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(`SELECT plataforma.reprocesar_aviso($1, $2)`,
          [uuid(id, 'id'), texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
        return { mensaje: 'Aviso devuelto a la cola. Sale en la próxima vuelta del trabajador.' };
      } catch (e: any) { traducir(e); }
    });
  }

  /**
   * Cómo están los terceros: si están configurados, su último intento y su
   * cortacircuitos (estación 23 del manual). Sin secretos: solo SÍ o NO.
   */
  @Get('integraciones')
  integraciones(@Req() req: Request) {
    exigirNivel(req, 4, 'ver el estado de las integraciones');
    const estado = estadoDeTerceros();
    const fila = (clave: string, nombre: string, variable: string, degradado: string) => ({
      clave, nombre, configurada: Boolean(process.env[variable]), variable,
      modo_degradado: degradado,
      ultimo: estado[clave]?.ultimo ?? null,
      circuito_abierto: estado[clave]?.circuitoAbierto ?? false,
      fallos_seguidos: estado[clave]?.fallosSeguidos ?? 0,
    });
    return {
      integraciones: [
        fila('sendgrid', 'Correo (SendGrid)', 'SENDGRID_API_KEY',
          'Sin llave o con el proveedor caído, los avisos esperan en la cola: no se pierden ni gastan intentos.'),
        fila('recaptcha', 'Formulario público (reCAPTCHA)', 'RECAPTCHA_SECRET',
          'Si Google no responde, el formulario de «soy nuevo» sigue abierto; el límite por IP frena a los robots.'),
        fila('payu', 'Pagos (PayU)', 'PAYU_API_KEY',
          'Sin llave, los avisos de pago se guardan como no verificados y NO se convierten en aportes.'),
      ],
      nota: 'El estado de «último intento» es de esta instancia de la API y se reinicia al desplegar.',
    };
  }

  /**
   * La auditoría: quién hizo qué. Se busca, se filtra por tabla y se pagina.
   * ⛔ Antes: los últimos 100, sin un control, y `offset` ignorado.
   */
  @Get('auditoria')
  auditoria(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 4, 'ver la auditoría');
    const limite = q?.limite ? entero(q.limite, 'limite', { min: 1, max: 200 }) : 50;
    const desde = q?.desde ? entero(q.desde, 'desde', { min: 0, max: 10_000_000 }) : 0;
    return conSesion(this.db, req, async (c) => {
      /* ⛔ Conceder SELECT sobre la auditoría a la aplicación la haría
         legible por cualquier sesión. Se lee por función, con guardia. */
      const { rows } = await c.query(`SELECT * FROM plataforma.buscar_auditoria($1,$2,$3,$4)`,
        [textoOpcional(q?.q, 'q', { max: 80 }), textoOpcional(q?.tabla, 'tabla', { max: 60 }), limite, desde]);
      return { total: Number(rows[0]?.total ?? 0), desde, limite, movimientos: rows };
    });
  }

  /** La bitácora de lectura: quién MIRÓ los datos sensibles. */
  @Get('lecturas')
  lecturas(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 4, 'ver la bitácora de lectura');
    const limite = q?.limite ? entero(q.limite, 'limite', { min: 1, max: 200 }) : 50;
    const desde = q?.desde ? entero(q.desde, 'desde', { min: 0, max: 10_000_000 }) : 0;
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(`SELECT * FROM plataforma.buscar_lecturas($1,$2::smallint,$3,$4)`,
        [textoOpcional(q?.q, 'q', { max: 80 }),
         q?.nivel ? entero(q.nivel, 'nivel', { min: 0, max: 4 }) : null, limite, desde]);
      return {
        total: Number(rows[0]?.total ?? 0), desde, limite, lecturas: rows,
        aviso: 'Esta bitácora existe para que mirar por curiosidad tenga nombre y hora.',
      };
    });
  }
}

@Module({ imports: [DbModule], controllers: [AdministracionController] })
export class AdministracionModule {}
