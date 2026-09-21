'use strict';
/**
 * =====================================================================
 * 20-rocakids-talento.js · ROCAKIDS Y TALENTO DE LA RED DE DEMOSTRACIÓN
 *
 * ⛔ SOLO DEMOSTRACIÓN. Todo lo que deja este archivo es inventado y
 *    jamás va a producción: la guarda de comun.js se niega a correr fuera
 *    de casaroca_dev, casaroca_test, cr_e2e_* y cr_pob_*.
 *
 * Lo que deja, por las reglas de la base y no alrededor de ellas:
 *   1. SALAS de RocaKids en cada sede donde el módulo está encendido, por
 *      edades y según el tamaño de la sede (la madre conserva las cinco
 *      de la semilla). Madrid no tiene salas: su módulo está apagado.
 *   2. VOLUNTARIADOS con su función: RocaKids, tMt (con los adolescentes
 *      de Pulso y Eco) y los demás ministerios encendidos en cada sede.
 *      Activos, suspendidos (con motivo) y terminados (con motivo).
 *   3. ANTECEDENTES de salvaguarda con su historia de renovaciones:
 *      vigentes, por vencer (a menos de 60 días), vencidos sin renovar y
 *      en trámite. Madrid espera los certificados de delitos sexuales.
 *   4. ROLES DIRECTOR_ROCAKIDS y MAESTRO_ROCAKIDS con
 *      identidad.otorgar_asignacion, solo para quien tiene los cinco
 *      antecedentes vigentes (la base lo exige), con su acta y su cuenta.
 *      Alcance «segmento»: la etapa donde la persona SIRVE (ver el informe:
 *      el alcance «ministerio» abriría las 27 sedes).
 *   5. El EQUIPO ROCAKIDS GLOBAL (EQ-KIDS) que el núcleo dejó vacío, con
 *      org.meter_en_equipo y los antecedentes que su rol exige.
 *   6. Los ÚLTIMOS OCHO DOMINGOS: quién sirvió en cada sala, ingresos con
 *      rocakids.registrar_checkin (la de 6 argumentos) y entregas con
 *      rocakids.entregar_menor y el código que devolvió el ingreso. Hay
 *      entregas a un segundo acudiente autorizado, códigos mal digitados,
 *      intentos de quien no puede retirar, salas que abrieron con un solo
 *      adulto (con su motivo escrito) y una salida que nadie registró.
 *   7. HOY: niños en sala en cuatro sedes, una entrega temprana, una sala
 *      con un solo adulto y un niño con dos intentos fallidos de retiro.
 *   8. Inscripciones por sala, autorizaciones firmadas por el acudiente
 *      principal y condiciones médicas.
 *   9. CONTRATOS de quien trabaja con la red (la central, las secretarías,
 *      los pastores de las sedes grandes, servicios generales, docentes),
 *      con los que vencen pronto y los que ya terminaron.
 *
 * ⛔ Las funciones del domingo fechan con now() y CURRENT_DATE y no reciben
 *    la fecha: los ingresos de los domingos pasados se registran con ellas
 *    y después se corrige la hora del ingreso, de la salida y de quién
 *    sirvió, por UPDATE. Lo que la base no deja corregir (la línea de
 *    tiempo, los intentos de entrega, la bitácora de lectura) queda con la
 *    fecha de la corrida: está en el informe como defecto del sistema.
 *
 * Corre en UNA transacción: o queda todo, o no queda nada.
 * Uso: PGDATABASE=cr_e2e_62 node backend/db/demostracion/20-rocakids-talento.js
 * =====================================================================
 */
const path = require('path');
const d = require('./comun');
const {
  FECHA_REFERENCIA: HOY, AYER, SALIDAS_POR_OLA, CLAVE_LABORATORIO,
  sumarDias, sumarMeses, sumarAnios, diasEntre, edad, minFecha, maxFecha, momentoLocal, insertarLote, fijarAutor,
} = d;

/* La derivación de la clave es la de la API: la misma que usan 00-red.js y token-para.js. */
const { derivarClave } = require(path.join(__dirname, '..', '..', 'api', 'dist', 'src', 'auth', 'clave.js'));

/* ─────────────────────────────────────────────────────────────────────
   CONSTANTES
   ───────────────────────────────────────────────────────────────────── */

/** La llave N4 del laboratorio: la misma que usa la API de desarrollo
    (backend/api/.env.example). Con otra, la API no podría verificar los
    códigos de entrega de los niños que quedan hoy en sala. */
const LLAVE_N4 = process.env.APP_LLAVE_N4 || 'llave-solo-de-desarrollo';

/** Los últimos ocho domingos: del 2 de agosto al 20 de septiembre de 2026. */
const DOMINGOS = d.domingosEntre(sumarDias(AYER, -49), AYER);

/** Antes de esta fecha los antecedentes vivían en carpetas y no se digitalizaron. */
const INICIO_DIGITAL = '2024-06-01';

/** Las salas por tamaño de sede. `seg` es la etapa (segmento de RocaKids)
    donde sirve quien está en esa sala: de ahí sale el alcance del maestro. */
const SALAS = {
  grande: [
    { codigo: 'CUNA', nombre: 'Cuna (0 a 1)', min: 0, max: 1, cap: 12, seg: 'BEBES', corto: 'Cuna' },
    { codigo: 'CAMINADORES', nombre: 'Caminadores (2)', min: 2, max: 2, cap: 12, seg: 'BEBES', corto: 'Caminadores' },
    { codigo: 'PEQUENOS', nombre: 'Pequeños (3 a 5)', min: 3, max: 5, cap: 25, seg: 'PEQUENOS', corto: 'Pequeños' },
    { codigo: 'EXPLORADORES', nombre: 'Exploradores (6 a 8)', min: 6, max: 8, cap: 30, seg: 'EXPLORADORES', corto: 'Exploradores' },
    { codigo: 'AVENTUREROS', nombre: 'Aventureros (9 a 11)', min: 9, max: 11, cap: 30, seg: 'AVENTUREROS', corto: 'Aventureros' },
  ],
  mediana: [
    { codigo: 'BEBES', nombre: 'Bebés (0 a 2)', min: 0, max: 2, cap: 12, seg: 'BEBES', corto: 'Bebés' },
    { codigo: 'PEQUENOS', nombre: 'Pequeños (3 a 5)', min: 3, max: 5, cap: 20, seg: 'PEQUENOS', corto: 'Pequeños' },
    { codigo: 'EXPLORADORES', nombre: 'Exploradores (6 a 8)', min: 6, max: 8, cap: 24, seg: 'EXPLORADORES', corto: 'Exploradores' },
    { codigo: 'AVENTUREROS', nombre: 'Aventureros (9 a 11)', min: 9, max: 11, cap: 24, seg: 'AVENTUREROS', corto: 'Aventureros' },
  ],
  pequena: [
    { codigo: 'BEBES', nombre: 'Bebés (0 a 2)', min: 0, max: 2, cap: 8, seg: 'BEBES', corto: 'Bebés' },
    { codigo: 'PEQUENOS', nombre: 'Pequeños (3 a 5)', min: 3, max: 5, cap: 14, seg: 'PEQUENOS', corto: 'Pequeños' },
    { codigo: 'EXPLORA_AVENTURA', nombre: 'Exploradores y Aventureros (6 a 11)', min: 6, max: 11, cap: 22, seg: 'EXPLORADORES', corto: 'Exploradores y Aventureros' },
  ],
};
/** La sala que Medellín cerró cuando tMt abrió Pulso (11 a 14): queda inactiva, con su historia. */
const SALA_CERRADA_MED = { codigo: 'PREADOLESCENTES', nombre: 'Preadolescentes (12 a 14)', min: 12, max: 14, cap: 20, seg: 'AVENTUREROS', corto: 'Preadolescentes' };
/** Las cinco salas de la semilla de la madre (seeds/019): se conservan tal cual. */
const SEMILLA_MADRE = {
  CUNA: { seg: 'BEBES', corto: 'Cuna' }, PARVULOS: { seg: 'PEQUENOS', corto: 'Párvulos' },
  EXPLORA: { seg: 'EXPLORADORES', corto: 'Exploradores' }, AVENTURA: { seg: 'AVENTUREROS', corto: 'Aventureros' },
  PREADO: { seg: 'AVENTUREROS', corto: 'Preadolescentes' },
};

/** Tamaño del equipo de RocaKids por sede (además de la dirección). */
const EQUIPO_RK = { grande: { maestros: 6, auxiliares: 10 }, mediana: { maestros: 4, auxiliares: 7 }, pequena: { maestros: 2, auxiliares: 5 } };

/** Hoy (lunes) hay niños en sala en estas sedes y salas. */
const HOY_EN_SALA = { 'BOG-CHICO': ['PARVULOS', 'EXPLORA'], 'BOG-NORTE': ['EXPLORADORES', 'AVENTUREROS'], CALI: ['PEQUENOS'], MED: ['PEQUENOS'] };
/** La salida que nadie registró el domingo 20: se cierra sola cuando el niño vuelve hoy. */
const OLVIDADOS = [{ sede: 'BOG-NORTE', sala: 'EXPLORADORES' }, { sede: 'CALI', sala: 'PEQUENOS' }];

/** Casos de salvaguarda repartidos por la red (voluntarios de RocaKids): se toman en este orden
    hasta completar cuántos (una sede sin auxiliares antiguos pasa el turno a la siguiente). */
const VENCIDO_ACTIVO = { cuantos: 4, sedes: ['BOG-SUR', 'BAQ', 'CUC', 'MIA', 'CTG', 'BOG-OCC', 'PEI'] };   // el aviso rojo de Talento
const VENCIDO_SUSPENDIDO = { cuantos: 5, sedes: ['MED', 'BOG-NORTE', 'BGA', 'PTY', 'ENV', 'IBG', 'SOACHA'] };
const EX_VOLUNTARIOS = ['BOG-CHICO', 'CALI', 'BOG-OCC', 'IBG', 'BAQ', 'VVC'];
const EN_TRAMITE = ['BOG-CHICO', 'MED', 'CALI', 'BOG-SUBA', 'CTG', 'ORL'];

/** Tipos de antecedente exigidos para estar con menores (talento.tipos_antecedente). */
const TIPOS_ANT = [
  { codigo: 'JUDICIAL', meses: 12 }, { codigo: 'DELITOS_SEXUALES', meses: 12 },
  { codigo: 'REFERENCIAS', meses: 24 }, { codigo: 'ENTREVISTA', meses: 24 }, { codigo: 'FORMACION_KIDS', meses: 24 },
];

/** Funciones por ministerio (lo que la pantalla de Talento muestra en «Función»). */
const FUNCIONES = {
  ALABANZA: ['Voz principal', 'Coros', 'Guitarra acústica', 'Guitarra eléctrica', 'Bajo', 'Batería', 'Teclado', 'Violín', 'Percusión', 'Dirección de alabanza'],
  UJIERES: ['Ujier de puerta', 'Ujier de auditorio', 'Bienvenida y orientación', 'Ofrenda y sobres', 'Parqueadero', 'Coordinación de ujieres'],
  VISA: ['Operación de sonido', 'Luces', 'Transmisión en vivo', 'Proyección de letras', 'Cámaras', 'Mantenimiento técnico'],
  NICODEMO: ['Consolidación de nuevos', 'Llamadas de bienvenida', 'Mesa de bienvenida', 'Acompañamiento en la primera visita'],
  CREATIVO: ['Diseño gráfico', 'Fotografía', 'Edición de video', 'Escenografía', 'Danza', 'Teatro'],
  COMUNICACIONES: ['Redes sociales', 'Boletín semanal', 'Carteleras', 'Anuncios del servicio'],
  SEGURIDAD: ['Seguridad del auditorio', 'Seguridad de parqueadero', 'Brigada de emergencias', 'Control de acceso'],
  AMEC: ['Primeros auxilios', 'Enfermería de turno', 'Brigada médica', 'Visitas a enfermos'],
  CASA2: ['Anfitrión de Casa2', 'Líder de Casa2', 'Coordinación de Casa2'],
  MUJER_INTEGRAL: ['Líder de Mujer Integral', 'Anfitriona de reuniones', 'Organización de retiros', 'Acompañamiento a mujeres nuevas'],
  HOMBRES_BIEN: ['Líder de Hombres de Bien', 'Desayunos de hombres', 'Mentoría de hombres jóvenes'],
  DORADOS: ['Acompañamiento a Años Dorados', 'Visitas a adultos mayores', 'Actividades recreativas'],
  CURSOS_CORTOS: ['Facilitador de ADN', 'Facilitador de Bautizo', 'Facilitador de Madurez', 'Facilitador de Llaves'],
  INSTITUTO: ['Monitor del Instituto', 'Docente voluntario', 'Biblioteca del Instituto'],
  TESORERIA: ['Conteo de ofrendas', 'Registro de sobres'],
  J25: ['Líder de J+25', 'Anfitrión de J+25', 'Eventos de J+25'],
  JOSUES: ['Líder de Josués', 'Mentoría de Josués'],
  EJECUTIVOS: ['Coordinación de Ejecutivos y Empresarios', 'Desayunos empresariales'],
  CENTURIONES: ['Capellanía de Centuriones', 'Coordinación de Centuriones'],
  CULTURA: ['Coro de la iglesia', 'Talleres de arte', 'Eventos culturales'],
  TECNOLOGIA: ['Soporte de equipos', 'Red y conectividad'],
};
const MINISTERIOS_GRANDES = ['ALABANZA', 'UJIERES', 'VISA', 'NICODEMO'];

const MOTIVOS_FIN = [
  'Se trasladó de ciudad por trabajo.', 'Pidió un tiempo de descanso para atender a su familia.',
  'Pasó a servir en otro ministerio.', 'Terminó el compromiso de un año que había hecho.',
  'Viaja mucho por su trabajo y no puede cumplir el turno.',
];
const MOTIVOS_PAUSA = [
  'Licencia de maternidad: vuelve en enero.', 'Está en recuperación de una cirugía.',
  'Viaje de trabajo de tres meses.', 'Pausa acordada con el líder del ministerio.',
];

/* ─────────────────────────────────────────────────────────────────────
   UTILIDADES LOCALES
   ───────────────────────────────────────────────────────────────────── */
const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
/** Un instante con segundos, en la zona de la sede (timestamptz). */
function instante(fecha, minutos, zona, segundos = 0) {
  const base = momentoLocal(fecha, hhmm(minutos), zona);
  return base.slice(0, 17) + pad2(segundos) + base.slice(19);
}
const entre = (az, desde, hasta) => (desde >= hasta ? hasta : az.fechaEntre(desde, hasta));
const salidaEnVivo = (s) => SALIDAS_POR_OLA[s.ola_migracion] ?? SALIDAS_POR_OLA[1];
const femenino = (p, f, m) => (p.genero === 'F' ? f : m);

/** Un código de entrega mal digitado: cambia un carácter por otro del mismo alfabeto. */
function codigoErrado(az, codigo) {
  /* Siempre dos números del azar, sea cual sea el código (que lo genera la base al azar): así el
     resto de la corrida no depende de él y el poblador sigue siendo determinista. */
  const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const i = az.entero(0, codigo.length - 1);
  const x = ALFA[(ALFA.indexOf(codigo[i]) + az.entero(1, ALFA.length - 1)) % ALFA.length];
  return codigo.slice(0, i) + x + codigo.slice(i + 1);
}

/** Referencia del documento de un antecedente, según el país de la sede. */
function referenciaDe(az, tipo, pais, expedido) {
  const n = String(az.entero(10000000, 99999999));
  switch (tipo) {
    case 'JUDICIAL':
      return pais === 'ES' ? `Certificado de antecedentes penales · Ministerio de Justicia · ${n}`
        : pais === 'US' ? `Verificación de antecedentes penales del estado · orden ${n}`
          : pais === 'PA' ? `Certificado de antecedentes penales · Dirección de Investigación Judicial · ${n}`
            : `Consulta de antecedentes judiciales · Policía Nacional · verificación ${n}`;
    case 'DELITOS_SEXUALES':
      return pais === 'ES' ? `Certificado del Registro Central de Delincuentes Sexuales · ${n}`
        : pais === 'US' ? `Consulta del registro nacional de ofensores sexuales · ${n}`
          : pais === 'PA' ? `Declaración jurada y consulta de delitos contra menores · ${n}`
            : `Consulta de inhabilidades por delitos sexuales (Ley 1918 de 2018) · radicado ${n}`;
    case 'REFERENCIAS': return 'Dos referencias personales contactadas por teléfono';
    case 'ENTREVISTA': return 'Entrevista de salvaguarda con la dirección de RocaKids';
    case 'FORMACION_KIDS': return `Curso KID-02 · Salvaguarda y protección de menores · cohorte ${expedido.slice(0, 4)}-${expedido.slice(5, 7) <= '06' ? 1 : 2}`;
    default: return null;
  }
}

/**
 * La historia de un antecedente: el último (expedido y vence) y los
 * anteriores que se renovaron antes de vencer, hasta el piso (el día en que
 * la persona empezó o el inicio de lo digital).
 */
function historia(az, meses, piso, ultimo) {
  const filas = [ultimo];
  let e = ultimo.expedido;
  for (let i = 0; i < 6; i++) {
    const vPrev = sumarDias(e, az.entero(4, 35));
    const ePrev = sumarMeses(vPrev, -meses);
    if (ePrev < piso) break;
    filas.unshift({ expedido: ePrev, vence: vPrev });
    e = ePrev;
  }
  return filas;
}

/**
 * Los antecedentes de una persona que sirve con menores, según cómo deben
 * quedar hoy. estado: 'vigente' | 'por_vencer' | 'vencido' | 'terminado' |
 * 'en_tramite' | 'madrid'. Devuelve filas y la fecha de la última
 * verificación completa (para el voluntariado).
 */
function antecedentesDe(az, p, J, estado, pais, verificador, op = {}) {
  const piso = maxFecha(sumarDias(J, -45), INICIO_DIGITAL);
  const filas = [];
  const ultimos = {};
  const tipoCritico = az.probabilidad(0.55) ? 'DELITOS_SEXUALES' : 'JUDICIAL';
  const tiposPorVencer = new Set();
  if (estado === 'por_vencer') {
    tiposPorVencer.add(J <= '2024-08-15' && az.probabilidad(0.3) ? az.elegir(['REFERENCIAS', 'ENTREVISTA', 'FORMACION_KIDS'])
      : az.elegir(['JUDICIAL', 'DELITOS_SEXUALES']));
    if (az.probabilidad(0.2)) tiposPorVencer.add(az.elegir(['JUDICIAL', 'DELITOS_SEXUALES']));
  }
  for (const t of TIPOS_ANT) {
    let ultimo;
    if (estado === 'en_tramite' || estado === 'madrid') {
      continue;   // se arman abajo
    } else if (estado === 'por_vencer' && tiposPorVencer.has(t.codigo)) {
      const vence = sumarDias(HOY, op.diasPorVencer ?? az.entero(8, 58));
      ultimo = { expedido: sumarMeses(vence, -t.meses), vence };
    } else if (estado === 'vencido' && t.codigo === tipoCritico) {
      const vence = entre(az, '2026-06-18', '2026-09-12');
      ultimo = { expedido: sumarMeses(vence, -t.meses), vence };
    } else if (estado === 'terminado') {
      const hasta = op.hasta;
      const lo = maxFecha(sumarDias(J, -40), sumarDias(sumarMeses(hasta, -t.meses), 10));
      const expedido = entre(az, lo, sumarDias(hasta, -15));
      ultimo = { expedido, vence: sumarMeses(expedido, t.meses) };
    } else {
      // Vigente: vence a más de 60 días (con margen, por si la corrida es otro día).
      const lo = maxFecha(sumarDias(J, -40), sumarDias(sumarMeses(HOY, -t.meses), 64));
      const reciente = diasEntre(J, HOY) < 240;
      const hi = reciente ? minFecha(sumarDias(AYER, -2), sumarDias(J, 6)) : sumarDias(AYER, -2);
      const expedido = entre(az, minFecha(lo, hi), hi);
      ultimo = { expedido, vence: sumarMeses(expedido, t.meses) };
    }
    ultimos[t.codigo] = ultimo;
    for (const h of historia(az, t.meses, piso, ultimo)) {
      filas.push({ tipo: t.codigo, resultado: 'apto', expedido_en: h.expedido, vence_en: h.vence });
    }
  }
  if (estado === 'en_tramite') {
    // Voluntario nuevo: tiene lo judicial, las referencias están en trámite y
    // la entrevista y el curso KID-02 todavía no.
    const e1 = entre(az, sumarDias(J, -25), minFecha(sumarDias(J, -2), sumarDias(AYER, -3)));
    filas.push({ tipo: 'JUDICIAL', resultado: 'apto', expedido_en: e1, vence_en: sumarMeses(e1, 12) });
    filas.push({ tipo: 'DELITOS_SEXUALES', resultado: 'apto', expedido_en: e1, vence_en: sumarMeses(e1, 12) });
    const e2 = entre(az, J, sumarDias(AYER, -1));
    if (az.probabilidad(0.5)) {
      filas.push({ tipo: 'REFERENCIAS', resultado: 'en_tramite', expedido_en: e2, vence_en: sumarDias(e2, 30),
        observacion: 'Se llamó a las dos referencias; falta que una devuelva la llamada.' });
    } else {
      filas.push({ tipo: 'REFERENCIAS', resultado: 'con_observacion', expedido_en: e2, vence_en: sumarMeses(e2, 24),
        observacion: 'Una de las dos referencias no respondió. Se pidió una tercera.' });
    }
    if (az.probabilidad(0.4)) {
      const e3 = entre(az, J, sumarDias(AYER, -1));
      filas.push({ tipo: 'ENTREVISTA', resultado: 'apto', expedido_en: e3, vence_en: sumarMeses(e3, 24) });
    }
  }
  if (estado === 'madrid') {
    // Madrid: todo en regla salvo el certificado de delitos sexuales, pedido
    // al Registro Central y todavía sin respuesta. Por eso RocaKids espera.
    for (const t of TIPOS_ANT) {
      if (t.codigo === 'DELITOS_SEXUALES') {
        const pedido = entre(az, '2026-07-20', '2026-09-04');
        filas.push({ tipo: t.codigo, resultado: 'en_tramite', expedido_en: pedido, vence_en: sumarDias(pedido, 60),
          observacion: 'Solicitado al Registro Central de Delincuentes Sexuales; el trámite puede tardar hasta 60 días.' });
      } else {
        const lo = maxFecha(sumarDias(J, -40), sumarDias(sumarMeses(HOY, -t.meses), 64));
        const expedido = entre(az, minFecha(lo, sumarDias(AYER, -3)), sumarDias(AYER, -3));
        filas.push({ tipo: t.codigo, resultado: 'apto', expedido_en: expedido, vence_en: sumarMeses(expedido, t.meses) });
        ultimos[t.codigo] = { expedido, vence: sumarMeses(expedido, t.meses) };
      }
    }
  }
  const verificada = Object.values(ultimos).map(x => x.expedido).sort().pop() ?? null;
  return {
    filas: filas.map(f => ({
      id: az.uuid(), persona_id: p.id, tipo: f.tipo, resultado: f.resultado, expedido_en: f.expedido_en,
      vence_en: f.vence_en, verificado_por: verificador, referencia: referenciaDe(az, f.tipo, pais, f.expedido_en),
      observacion: f.observacion ?? null, sede_id: p.sede_id,
    })),
    verificada,
  };
}

/** Fecha en que alguien empezó a servir: antiguos, recientes o nuevos. */
function inicioServicio(az, p, clase) {
  const desde = clase === 'antiguo' ? az.fechaEntre('2018-02-04', '2025-05-25')
    : clase === 'reciente' ? az.fechaEntre('2025-06-01', '2026-05-31')
      : az.fechaEntre('2026-06-07', '2026-09-06');
  const piso = maxFecha(sumarDias(p.miembro_desde, 60), sumarAnios(p.fnac, 18));
  return minFecha(maxFecha(desde, piso), '2026-09-10');
}

/* ─────────────────────────────────────────────────────────────────────
   EL POBLADOR
   ───────────────────────────────────────────────────────────────────── */
d.ejecutar({ archivo: 20, tema: 'RocaKids y talento: salas, voluntariados, antecedentes, roles, domingos y contratos' }, async (c, azar) => {
  // Solo este archivo registra ingresos de RocaKids y antecedentes: si ya hay, ya corrió.
  if (await d.yaPoblado(c,
    `SELECT (SELECT count(*) FROM rocakids.checkins) + (SELECT count(*) FROM talento.antecedentes)`, [], 'RocaKids y talento')) return;

  const t0 = Date.now();
  const paso = (m) => console.log(`   · ${m} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const hashClave = derivarClave(CLAVE_LABORATORIO);
  const resumenHoy = [];
  const cuentas = { creadas: 0 };

  await d.enTransaccion(c, async () => {
    await c.query(`SELECT set_config('app.llave_n4', $1, true)`, [LLAVE_N4]);
    const { rows: [{ hoy: hoyReal }] } = await c.query(`SELECT CURRENT_DATE::text AS hoy`);

    /* ── 0 · Lo que ya hay en la base ─────────────────────────────── */
    const [dg] = await d.direccionGeneral(c);
    const sedesRK = await d.sedes(c, { conModulo: 'rocakids' });
    const sedesTalento = await d.sedes(c, { conModulo: 'talento' });
    const S = Object.fromEntries(sedesTalento.map(s => [s.codigo, s]));
    for (const s of sedesRK) S[s.codigo] = s;
    const esRK = new Set(sedesRK.map(s => s.codigo));
    const madrid = sedesTalento.find(s => s.codigo === 'MAD' && s.ministerios.includes('ROCAKIDS'));

    const { rows: minis } = await c.query(`SELECT codigo, id FROM org.ministerios`);
    const MIN = Object.fromEntries(minis.map(m => [m.codigo, m.id]));
    const { rows: segs } = await c.query(
      `SELECT g.id, g.codigo, g.sede_id FROM org.segmentos g JOIN org.ministerios m ON m.id = g.ministerio_id
        WHERE m.codigo = 'ROCAKIDS' AND g.activo`);
    const segmentoDe = new Map(segs.map(g => [`${g.sede_id}|${g.codigo}`, g.id]));

    const pastoresPorSede = {};
    for (const x of await d.conRol(c, 'PASTOR_CONGREGACIONAL')) {
      if (x.alcance_tipo !== 'sede') continue;
      (pastoresPorSede[x.sede_codigo] ??= []).push(x);
    }
    for (const lista of Object.values(pastoresPorSede)) lista.sort((a, b) => (a.genero === 'M' ? 0 : 1) - (b.genero === 'M' ? 0 : 1));
    const pastorDe = (codigo) => pastoresPorSede[codigo]?.[0];
    const pastoraDe = (codigo) => pastoresPorSede[codigo]?.[1] ?? pastoresPorSede[codigo]?.[0];
    // Las parejas pastorales y la dirección general: dirigen; no figuran como voluntarios ni reciben cargos de RocaKids.
    const { rows: pastRows } = await c.query(
      `SELECT DISTINCT persona_id FROM identidad.asignaciones
        WHERE rol IN ('PASTOR_CONGREGACIONAL', 'PASTOR_DIRECTOR_GENERAL') AND revocada_en IS NULL`);
    const pastorales = new Set(pastRows.map(r => r.persona_id));
    const eqTH = await d.equipo(c, 'EQ-TH');
    const liderTH = eqTH.find(x => x.rol_en_unidad === 'lider') ?? eqTH[0];
    const { rows: [eqKids] } = await c.query(`SELECT id FROM org.unidades WHERE codigo = 'EQ-KIDS'`);

    // Todos los adultos que pueden servir (miembros y líderes activos), con lo que hace falta para elegir.
    const { rows: adultos } = await c.query(
      `SELECT p.id, p.primer_nombre, p.primer_apellido, p.genero::text AS genero,
              to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fnac, p.sede_id, s.codigo AS sede,
              p.nivel_compromiso AS nivel, COALESCE(p.ha_sido_bautizado, false) AS bautizado,
              p.email_principal::text AS email, p.telefono_movil AS telefono,
              to_char(COALESCE((SELECT min(m.desde) FROM nucleo.membresias_sede m
                                 WHERE m.persona_id = p.id AND m.sede_id = p.sede_id), p.creado_en::date), 'YYYY-MM-DD') AS miembro_desde,
              EXISTS (SELECT 1 FROM identidad.v_permiso_efectivo pe WHERE pe.persona_id = p.id AND pe.vigente) AS con_rol,
              EXISTS (SELECT 1 FROM identidad.cuentas cu WHERE cu.persona_id = p.id) AS con_cuenta,
              EXISTS (SELECT 1 FROM identidad.cuentas cu WHERE cu.persona_id = p.id AND cu.estado = 'activa') AS cuenta_activa,
              EXISTS (SELECT 1 FROM grupos.hogar_miembros hm JOIN grupos.hogares h ON h.id = hm.hogar_id
                       WHERE hm.persona_id = p.id AND hm.hasta IS NULL AND h.source_id LIKE 'hogar-%-0001') AS familia_pastoral
         FROM nucleo.personas p JOIN org.sedes s ON s.id = p.sede_id
        WHERE p.eliminado_en IS NULL AND p.estado = 'activa' AND p.fecha_nacimiento IS NOT NULL
          AND p.nivel_compromiso IN ('miembro', 'lider')
          AND age($1::date, p.fecha_nacimiento) >= interval '18 years'
          AND COALESCE(p.source_id, '') NOT LIKE 'duplicado-%'
        ORDER BY s.codigo, p.source_id NULLS FIRST, p.id`, [hoyReal]);
    for (const p of adultos) p.edad = edad(p.fnac, hoyReal);
    const adultosDe = {};
    for (const p of adultos) (adultosDe[p.sede] ??= []).push(p);
    paso(`${adultos.length} adultos que pueden servir en ${Object.keys(adultosDe).length} sedes`);

    /* ── 1 · Salas de RocaKids por sede ───────────────────────────── */
    const azS = azar.derivar('salas');
    // Cuántos niños de cada edad tiene cada sede: la capacidad de la sala se decide con eso.
    const { rows: porEdad } = await c.query(
      `SELECT s.codigo, date_part('year', age($1::date, p.fecha_nacimiento))::int AS edad, count(*)::int AS n
         FROM nucleo.personas p JOIN org.sedes s ON s.id = p.sede_id
        WHERE p.eliminado_en IS NULL AND p.estado = 'activa' AND age($1::date, p.fecha_nacimiento) < interval '15 years'
        GROUP BY 1, 2`, [hoyReal]);
    const ninosEntre = (codigo, a, b) => porEdad.filter(r => r.codigo === codigo && r.edad >= a && r.edad <= b).reduce((t, r) => t + r.n, 0);
    const filasSala = [];
    for (const s of sedesRK) {
      if (s.codigo === 'BOG-CHICO') continue;   // la madre ya tiene las cinco de la semilla
      const plantilla = SALAS[s.tamano] ?? SALAS.mediana;
      for (const x of plantilla) {
        // Cabe al menos el 80 % de los niños de esas edades (vienen en uno o dos servicios), redondeado a pares.
        const cap = Math.max(x.cap + azS.entero(-2, 2), Math.ceil(ninosEntre(s.codigo, x.min, x.max) * 0.8 / 2) * 2);
        filasSala.push({ id: azS.uuid(), sede_id: s.id, codigo: x.codigo, nombre: x.nombre, edad_min: x.min, edad_max: x.max,
          capacidad: Math.max(6, cap), activa: true });
      }
      if (s.codigo === 'MED') {
        const x = SALA_CERRADA_MED;
        filasSala.push({ id: azS.uuid(), sede_id: s.id, codigo: x.codigo, nombre: x.nombre, edad_min: x.min, edad_max: x.max, capacidad: x.cap, activa: false });
      }
    }
    await insertarLote(c, 'rocakids.salas', filasSala);
    const { rows: todasSalas } = await c.query(
      `SELECT sa.id, sa.sede_id, s.codigo AS sede, sa.codigo, sa.nombre, sa.edad_min, sa.edad_max, sa.capacidad, sa.activa
         FROM rocakids.salas sa JOIN org.sedes s ON s.id = sa.sede_id ORDER BY s.codigo, sa.edad_min, sa.codigo`);
    const salasDe = {};
    for (const x of todasSalas) {
      const meta = x.sede === 'BOG-CHICO' ? SEMILLA_MADRE[x.codigo]
        : [...SALAS.grande, ...SALAS.mediana, ...SALAS.pequena, SALA_CERRADA_MED].find(y => y.codigo === x.codigo);
      x.seg = meta?.seg ?? 'PEQUENOS';
      x.corto = meta?.corto ?? x.nombre;
      x.segmento_id = segmentoDe.get(`${x.sede_id}|${x.seg}`);
      (salasDe[x.sede] ??= []).push(x);
    }
    const salasActivas = (codigo) => (salasDe[codigo] ?? []).filter(x => x.activa);
    const salaPara = (codigo, e) => salasActivas(codigo).find(x => e >= x.edad_min && e <= x.edad_max);
    paso(`${filasSala.length} salas nuevas en ${sedesRK.length - 1} sedes (la madre conserva las de la semilla)`);

    /* ── 2 · Quién sirve en RocaKids en cada sede ─────────────────── */
    const azE = azar.derivar('equipos');
    const ocupado = new Map();              // persona → cuántos voluntariados tiene
    const tomar = (p) => ocupado.set(p.id, (ocupado.get(p.id) ?? 0) + 1);
    const libre = (p, max = 1) => (ocupado.get(p.id) ?? 0) < max;
    const puedeRol = (p) => !p.con_rol && !p.con_cuenta && p.bautizado && p.email && p.telefono && p.edad >= 21 && p.edad <= 62;
    /* ⛔ Quien ya tiene un cargo en la sede (pastores, secretaría, tesorería, consejería…) no se pone de
       auxiliar ni de ex voluntario: su historia no puede decir «se trasladó de ciudad» mientras firma actas. */
    const sinCargo = (p) => !p.con_rol && !p.con_cuenta;
    /* Los casos difíciles (antecedentes vencidos, suspensiones, salidas) no recaen en la familia pastoral:
       sería una historia que la demostración no tiene por qué contar. */
    const casoPosible = (p) => sinCargo(p) && !p.familia_pastoral;
    /* Si en una sede pequeña no alcanza la gente sin cargo (otro poblador pudo nombrar líderes de grupo
       antes), se amplía la edad y, al final, se acepta a quien ya tiene un cargo con su cuenta activa:
       en las iglesias pequeñas la misma persona lleva varias cosas. Nunca a la pareja pastoral. */
    const puedeRolAmplio = (p) => !p.con_rol && !p.con_cuenta && p.bautizado && p.email && p.telefono && p.edad >= 19 && p.edad <= 70;
    const puedeRolConCargo = (p) => !pastorales.has(p.id) && p.bautizado && p.email && p.telefono && p.edad >= 21 && p.edad <= 66
      && (!p.con_cuenta || p.cuenta_activa);
    /** Elige a alguien de la lista (prefiriendo el género pedido) que cumpla el filtro. */
    const elegir = (lista, filtro, pesoF = 0.78) => {
      const ok = lista.filter(p => libre(p) && filtro(p));
      if (!ok.length) return null;
      const quiere = azE.probabilidad(pesoF) ? 'F' : 'M';
      const pref = ok.filter(p => p.genero === quiere);
      const p = azE.elegir(pref.length ? pref : ok);
      tomar(p);
      return p;
    };

    const servidoresRK = [];   // { p, sede, rol: 'director'|'maestro'|'auxiliar'|..., sala, J, estado, funcion, hasta?, motivo? }
    // 2a · El Equipo RocaKids Global: una directora nacional y dos coordinadores, de las sedes de Bogotá.
    const kids = [];
    {
      const deBogota = [...(adultosDe['BOG-CHICO'] ?? []), ...(adultosDe['BOG-NORTE'] ?? []), ...(adultosDe['BOG-SUBA'] ?? [])];
      const aptoParaEquipo = (p) => puedeRol(p) && p.edad >= 32 && p.edad <= 58 && p.miembro_desde <= '2021-01-01';
      const funciones = [['lider', 'Directora nacional de RocaKids', 'Director nacional de RocaKids'],
        ['integrante', 'Coordinadora de formación de maestros de RocaKids', 'Coordinador de formación de maestros de RocaKids'],
        ['integrante', 'Coordinadora de salvaguarda de menores', 'Coordinador de salvaguarda de menores']];
      for (const [rolEq, fF, fM] of funciones) {
        const p = elegir(deBogota, aptoParaEquipo, rolEq === 'lider' ? 0.9 : 0.6);
        if (!p) throw new Error('No hay a quién poner en el Equipo RocaKids Global');
        const J = inicioServicio(azE, p, 'antiguo');
        kids.push({ p, rolEq, desdeEquipo: entre(azE, SALIDAS_POR_OLA[1], '2026-02-02') });
        servidoresRK.push({ p, sede: S[p.sede], rol: 'equipo', sala: null, J, estado: 'vigente', funcion: femenino(p, fF, fM), ministerio: 'ROCAKIDS', menores: true });
      }
    }
    // 2b · Cada sede con RocaKids: dirección, maestros con rol, auxiliares y los casos de salvaguarda.
    const equipoDe = {};
    for (const s of sedesRK) {
      const lista = adultosDe[s.codigo] ?? [];
      const salas = salasActivas(s.codigo);
      const tam = EQUIPO_RK[s.tamano] ?? EQUIPO_RK.mediana;
      const eq = { director: null, maestros: [], auxiliares: [] };
      const director = elegir(lista, p => puedeRol(p) && p.edad >= 28 && p.edad <= 58, 0.82)
        ?? elegir(lista, puedeRol, 0.5) ?? elegir(lista, puedeRolAmplio, 0.5) ?? elegir(lista, puedeRolConCargo, 0.5);
      if (!director) throw new Error(`No hay quién dirija RocaKids en ${s.codigo}`);
      // La dirección coordina la sala más concurrida (Pequeños o Párvulos) y ese es su alcance.
      const salaDir = salas.find(x => x.seg === 'PEQUENOS') ?? salas[0];
      eq.director = { p: director, sede: s, rol: 'director', sala: salaDir, J: inicioServicio(azE, director, 'antiguo'), estado: 'vigente',
        funcion: femenino(director, 'Directora de RocaKids de la sede', 'Director de RocaKids de la sede'), ministerio: 'ROCAKIDS', menores: true };
      servidoresRK.push(eq.director);
      for (let i = 0; i < tam.maestros; i++) {
        const p = elegir(lista, puedeRol) ?? elegir(lista, puedeRolAmplio) ?? elegir(lista, puedeRolConCargo);
        if (!p) break;
        // En las sedes pequeñas la dirección cubre Pequeños; los maestros, las otras salas.
        const libres = s.tamano === 'pequena' ? salas.filter(x => x !== salaDir) : salas;
        const sala = i < libres.length ? libres[i] : (salas.find(x => x.seg === 'PEQUENOS') ?? salas[0]);
        const clase = azE.probabilidad(0.72) ? 'antiguo' : azE.probabilidad(0.8) ? 'reciente' : 'nuevo';
        const m = { p, sede: s, rol: 'maestro', sala, J: inicioServicio(azE, p, clase), estado: 'vigente',
          funcion: `${femenino(p, 'Maestra', 'Maestro')} de ${sala.corto}`, ministerio: 'ROCAKIDS', menores: true };
        eq.maestros.push(m); servidoresRK.push(m);
      }
      for (let i = 0; i < tam.auxiliares; i++) {
        const p = elegir(lista, x => sinCargo(x) && x.edad >= 18 && x.edad <= 68 && (x.bautizado || azE.probabilidad(0.25)));
        if (!p) break;
        const sala = salas[i % salas.length];
        const clase = azE.probabilidad(0.65) ? 'antiguo' : azE.probabilidad(0.75) ? 'reciente' : 'nuevo';
        const a = { p, sede: s, rol: 'auxiliar', sala, J: inicioServicio(azE, p, clase), estado: 'vigente',
          funcion: azE.probabilidad(0.12) ? 'Alabanza infantil' : `Auxiliar de ${sala.corto}`, ministerio: 'ROCAKIDS', menores: true };
        eq.auxiliares.push(a); servidoresRK.push(a);
      }
      if (EX_VOLUNTARIOS.includes(s.codigo)) {
        const p = elegir(lista, x => casoPosible(x) && x.edad >= 20 && x.edad <= 65 && x.miembro_desde <= '2023-06-01');
        if (p) {
          const J = inicioServicio(azE, p, 'antiguo');
          const hasta = entre(azE, maxFecha('2025-10-05', sumarDias(J, 200)), '2026-07-26');
          servidoresRK.push({ p, sede: s, rol: 'ex', sala: azE.elegir(salas), J, estado: 'terminado', hasta,
            funcion: `${femenino(p, 'Maestra', 'Maestro')} de ${azE.elegir(salas).corto}`, ministerio: 'ROCAKIDS', menores: true,
            motivo: azE.elegir(['Se trasladó de ciudad por trabajo.', 'Nació su bebé y pidió un tiempo con su familia.',
              'Pasó a servir en tMt con los adolescentes.', 'Terminó el compromiso de un año que había hecho.']) });
        }
      }
      if (EN_TRAMITE.includes(s.codigo)) {
        const p = elegir(lista, x => sinCargo(x) && x.edad >= 19 && x.edad <= 55);
        if (p) servidoresRK.push({ p, sede: s, rol: 'nuevo', sala: null, J: entre(azE, '2026-08-02', '2026-09-13'), estado: 'en_tramite',
          funcion: 'Apoyo en registro y bienvenida de RocaKids (en verificación)', ministerio: 'ROCAKIDS', menores: false });
      }
      // Un 11 % de quienes están al día tiene algo por vencer en los próximos dos meses (la lista de trabajo).
      for (const x of [eq.director, ...eq.maestros, ...eq.auxiliares]) {
        if (x.estado === 'vigente' && x.J <= '2025-05-25' && azE.probabilidad(0.11)) x.estado = 'por_vencer';
      }
      equipoDe[s.codigo] = eq;
    }
    // Los casos de salvaguarda, sobre auxiliares antiguos (quienes ya renovaron alguna vez), en el orden de la lista.
    for (const [caso, suspender] of [[VENCIDO_ACTIVO, false], [VENCIDO_SUSPENDIDO, true]]) {
      let hechos = 0;
      for (const codigo of caso.sedes) {
        if (hechos >= caso.cuantos) break;
        const antiguos = (equipoDe[codigo]?.auxiliares ?? []).filter(a => a.estado === 'vigente' && a.J <= '2025-05-25' && casoPosible(a.p));
        if (!antiguos.length) continue;
        const a = azE.elegir(antiguos); a.estado = 'vencido'; a.suspender = suspender; hechos++;
      }
    }
    // 2c · Madrid: RocaKids espera los certificados de delitos sexuales de sus maestros.
    if (madrid) {
      const lista = adultosDe.MAD ?? [];
      for (let i = 0; i < 5; i++) {
        const p = elegir(lista, x => sinCargo(x) && x.edad >= 20 && x.edad <= 60);
        if (!p) break;
        servidoresRK.push({ p, sede: madrid, rol: 'madrid', sala: null, J: entre(azE, '2026-06-14', '2026-08-30'), estado: 'madrid',
          funcion: `${femenino(p, 'Maestra', 'Maestro')} de ${azE.elegir(['Bebés', 'Pequeños', 'Exploradores', 'Aventureros'])}`,
          ministerio: 'ROCAKIDS', menores: false });
      }
    }
    // Una maestra y un maestro con el certificado a punto de vencer: el chip de «días» y la lista de trabajo.
    {
      const ms = servidoresRK.filter(x => x.rol === 'maestro' && x.J <= '2025-05-25');
      for (const x of azE.muestra(ms, 2)) { x.estado = 'por_vencer'; x.diasPorVencer = azE.entero(11, 24); }
    }
    // Dos maestros nombrados este mes que todavía no han entrado: su cuenta queda con clave provisional.
    {
      const ms = servidoresRK.filter(x => x.rol === 'maestro' && x.estado === 'vigente' && x.J <= '2026-06-01'
        && ['BGA', 'PTY', 'VVC', 'BOG-OCC'].includes(x.sede.codigo));
      for (const [i, x] of azE.muestra(ms, 2).entries()) { x.J = ['2026-09-06', '2026-09-13'][i]; x.sinEstrenar = true; }
    }
    paso(`${servidoresRK.length} personas en RocaKids (${sedesRK.length} sedes, Madrid y el equipo global)`);

    /* ── 3 · tMt: quienes acompañan a los adolescentes de Pulso y Eco ── */
    const azT = azar.derivar('tmt');
    const servidoresTMT = [];
    for (const s of sedesTalento) {
      if (!s.ministerios.includes('TMT')) continue;
      const lista = adultosDe[s.codigo] ?? [];
      const n = s.tamano === 'grande' ? 5 : s.tamano === 'mediana' ? 3 : 2;
      const plan = [['Coordinación de tMt', true], ['Líder de Pulso (11 a 14 años)', true], ['Mentor de Eco (15 a 18 años)', true],
        ['Líder de Legado (19 a 25 años)', false], ['Líder de Pulso (11 a 14 años)', true]].slice(0, n);
      for (const [funcion, menores] of plan) {
        const p = (() => {
          const ok = lista.filter(x => libre(x) && sinCargo(x) && x.edad >= 20 && x.edad <= 40);
          if (!ok.length) return null;
          const q = azT.elegir(ok); tomar(q); return q;
        })();
        if (!p) break;
        const J = inicioServicio(azT, p, azT.probabilidad(0.7) ? 'antiguo' : 'reciente');
        const x = { p, sede: s, rol: 'tmt', sala: null, J, estado: 'vigente', ministerio: 'TMT', menores,
          funcion: funcion.replace('Mentor de', femenino(p, 'Mentora de', 'Mentor de')) };
        if (menores && J <= '2025-05-25' && azT.probabilidad(0.1)) x.estado = 'por_vencer';
        servidoresTMT.push(x);
      }
    }
    // Un mentor de Eco en Cali con el certificado de delitos sexuales vencido: también sale en el aviso rojo.
    {
      const x = servidoresTMT.find(y => y.sede.codigo === 'CALI' && y.menores && y.J <= '2025-05-25' && y.estado === 'vigente' && casoPosible(y.p))
        ?? servidoresTMT.find(y => y.menores && y.J <= '2025-05-25' && y.estado === 'vigente' && casoPosible(y.p));
      if (x) { x.estado = 'vencido'; x.suspender = false; }
    }
    paso(`${servidoresTMT.length} servidores de tMt`);

    /* ── 4 · Antecedentes (con su historia de renovaciones) ─────────── */
    const azA = azar.derivar('antecedentes');
    const filasAnt = [];
    const directorDe = (codigo) => equipoDe[codigo]?.director?.p;
    for (const x of [...servidoresRK, ...servidoresTMT]) {
      if (x.ministerio === 'TMT' && !x.menores) continue;
      // Verifica la dirección de RocaKids de la sede; a la dirección, la pastora; al equipo global y a
      // Madrid, Talento Humano de la central; a tMt, el pastor.
      const verificador = x.rol === 'director' ? pastoraDe(x.sede.codigo)?.persona_id
        : x.rol === 'equipo' || x.rol === 'madrid' ? liderTH.persona_id
          : x.ministerio === 'TMT' ? pastorDe(x.sede.codigo)?.persona_id
            : directorDe(x.sede.codigo)?.id ?? pastoraDe(x.sede.codigo)?.persona_id;
      const r = antecedentesDe(azA, x.p, x.J, x.estado, x.sede.pais, verificador ?? dg.persona_id,
        { hasta: x.hasta, diasPorVencer: x.diasPorVencer });
      x.verificada = r.verificada;
      x.verificador = verificador ?? dg.persona_id;
      // Se registró en el sistema unos días después de expedido (o el día de la salida en vivo, si era de antes).
      for (const f of r.filas) {
        const dia = minFecha(maxFecha(sumarDias(f.expedido_en, azA.entero(1, 6)), salidaEnVivo(x.sede)), AYER);
        filasAnt.push({ ...f, creado_en: instante(dia, azA.entero(8 * 60, 18 * 60), x.sede.zona_horaria, azA.entero(0, 59)), _autor: x.verificador });
      }
    }
    // Se insertan por quien verificó: la auditoría dice quién los registró.
    const porAutor = new Map();
    for (const f of filasAnt) { if (!porAutor.has(f._autor)) porAutor.set(f._autor, []); porAutor.get(f._autor).push(f); }
    for (const [autor, filas] of porAutor) {
      await fijarAutor(c, { persona_id: autor, nivel_max: 3, motivo: 'Verificación de antecedentes de salvaguarda' });
      await insertarLote(c, 'talento.antecedentes', filas.map(({ _autor, ...f }) => f));
    }
    paso(`${filasAnt.length} antecedentes`);

    /* ── 5 · Voluntariados ────────────────────────────────────────── */
    const azV = azar.derivar('voluntariados');
    const filasVol = [];
    const cambios = [];   // { id, estado, hasta?, motivo, menores? }
    const volDe = (x, extra = {}) => {
      const menores = Boolean(x.menores);
      const fila = {
        id: azV.uuid(), persona_id: x.p.id, sede_id: x.sede.id, ministerio_id: MIN[x.ministerio], funcion: x.funcion,
        estado: 'activo', desde: x.J, hasta: null, trabaja_con_menores: menores,
        antecedentes_verificados_en: menores ? (x.verificada ?? null) : null,
        compromiso_firmado_en: menores || x.ministerio === 'ROCAKIDS' ? sumarDias(x.J, -azV.entero(1, 9)) : null,
        _autor: extra.autor ?? pastoraDe(x.sede.codigo)?.persona_id ?? dg.persona_id,
      };
      filasVol.push(fila);
      return fila;
    };
    for (const x of [...servidoresRK, ...servidoresTMT]) {
      const f = volDe(x, { autor: x.ministerio === 'ROCAKIDS' && !['equipo', 'director'].includes(x.rol) ? (directorDe(x.sede.codigo)?.id ?? null) : null });
      if (x.estado === 'terminado') {
        cambios.push({ id: f.id, estado: 'terminado', hasta: x.hasta, motivo: x.motivo });
      } else if (x.estado === 'vencido' && x.suspender) {
        const venc = filasAnt.filter(a => a.persona_id === x.p.id).sort((a, b) => b.vence_en.localeCompare(a.vence_en))
          .find(a => a.vence_en < HOY);
        cambios.push({ id: f.id, estado: 'suspendido', motivo:
          `Se le venció un certificado de antecedentes${venc ? ' el ' + venc.vence_en : ''}: no entra a sala hasta renovarlo.` });
      } else if (x.estado === 'madrid') {
        cambios.push({ id: f.id, estado: 'suspendido', menores: true, motivo:
          'RocaKids de Madrid no abre hasta tener los certificados del Registro Central de Delincuentes Sexuales.' });
      }
    }
    // Los demás ministerios: cerca de una de cada cuatro personas que congregan sirve en algo.
    for (const s of sedesTalento) {
      const lista = adultosDe[s.codigo] ?? [];
      for (const cod of s.ministerios) {
        const funciones = FUNCIONES[cod];
        if (!funciones) continue;
        const grande = MINISTERIOS_GRANDES.includes(cod);
        const [lo, hi] = s.tamano === 'grande' ? (grande ? [5, 9] : [2, 5]) : s.tamano === 'mediana' ? (grande ? [3, 6] : [1, 3]) : (grande ? [2, 4] : [1, 2]);
        const n = azV.entero(lo, hi);
        const filtro = (x) => libre(x, 2) && !pastorales.has(x.id) && (cod !== 'MUJER_INTEGRAL' || x.genero === 'F') && (cod !== 'HOMBRES_BIEN' || x.genero === 'M')
          && (cod !== 'J25' || (x.edad >= 24 && x.edad <= 38)) && (cod !== 'DORADOS' || x.edad >= 35) && x.edad <= 72;
        const ok = azV.barajar(lista.filter(filtro));
        for (let i = 0; i < n && i < ok.length; i++) {
          const p = ok[i];
          if ((ocupado.get(p.id) ?? 0) >= 1 && azV.probabilidad(0.75)) continue;   // pocos sirven en dos ministerios
          tomar(p);
          const clase = azV.probabilidad(0.6) ? 'antiguo' : azV.probabilidad(0.8) ? 'reciente' : 'nuevo';
          const J = inicioServicio(azV, p, clase);
          const funcion = azV.elegir(funciones).replace('Anfitrión de', femenino(p, 'Anfitriona de', 'Anfitrión de'))
            .replace('Facilitador de', femenino(p, 'Facilitadora de', 'Facilitador de'));
          const f = volDe({ p, sede: s, J, funcion, ministerio: cod, menores: false },
            { autor: (i % 2 ? pastorDe(s.codigo) : pastoraDe(s.codigo))?.persona_id });
          const u = casoPosible(p) ? azV.siguiente() : 1;
          if (u < 0.06 && J < '2026-03-01') {
            cambios.push({ id: f.id, estado: 'terminado', hasta: entre(azV, maxFecha(sumarDias(J, 90), '2025-10-01'), '2026-09-06'), motivo: azV.elegir(MOTIVOS_FIN) });
          } else if (u < 0.10) {
            cambios.push({ id: f.id, estado: 'suspendido', motivo: azV.elegir(MOTIVOS_PAUSA) });
          }
        }
      }
    }
    const volPorAutor = new Map();
    for (const f of filasVol) { const k = f._autor ?? dg.persona_id; if (!volPorAutor.has(k)) volPorAutor.set(k, []); volPorAutor.get(k).push(f); }
    for (const [autor, filas] of volPorAutor) {
      await fijarAutor(c, { persona_id: autor, nivel_max: 3, motivo: 'Registro de voluntariado' });
      await insertarLote(c, 'talento.voluntariados', filas.map(({ _autor, ...f }) => f));
    }
    // Suspender y terminar se hace con UPDATE y su motivo, como la pantalla: la auditoría lo guarda.
    const porMotivo = new Map();
    for (const x of cambios) { const k = `${x.estado}|${x.motivo}|${x.menores ? 1 : 0}`; if (!porMotivo.has(k)) porMotivo.set(k, []); porMotivo.get(k).push(x); }
    for (const [clave, lista] of porMotivo) {
      const [estado, motivo, menores] = clave.split('|');
      await fijarAutor(c, { persona_id: dg.persona_id, nivel_max: 4, alcance_global: true, motivo });
      await c.query(
        `UPDATE talento.voluntariados v
            SET estado = $2::talento.estado_vinculo, hasta = COALESCE(x.hasta, v.hasta),
                trabaja_con_menores = CASE WHEN $3::boolean THEN true ELSE v.trabaja_con_menores END
           FROM unnest($1::uuid[], $4::date[]) AS x(id, hasta)
          WHERE v.id = x.id`,
        [lista.map(x => x.id), estado, menores === '1', lista.map(x => x.hasta ?? null)]);
    }
    paso(`${filasVol.length} voluntariados (${cambios.filter(x => x.estado === 'suspendido').length} suspendidos, ${cambios.filter(x => x.estado === 'terminado').length} terminados)`);

    /* ── 6 · Roles de RocaKids, con acta, y el equipo global ─────── */
    await fijarAutor(c, { persona_id: dg.persona_id, nivel_max: 4, alcance_global: true, motivo: 'Nombramientos de RocaKids' });
    const conRolRK = [...servidoresRK.filter(x => (x.rol === 'director' || x.rol === 'maestro') && x.estado !== 'vencido')];
    // Quien recibe un cargo es líder de la iglesia (la regla que el núcleo dejó: rol ⇒ líder bautizado con cuenta).
    const aPromover = conRolRK.filter(x => x.p.nivel !== 'lider').map(x => x.p.id);
    if (aPromover.length) {
      await c.query(`SELECT set_config('app.motivo', 'Recibió un cargo en RocaKids: quien sirve con un cargo es líder', true)`);
      await c.query(`UPDATE nucleo.personas SET nivel_compromiso = 'lider' WHERE id = ANY($1::uuid[])`, [aPromover]);
    }
    const actasPorSede = {};
    const nombramientos = conRolRK.map(x => {
      const vivo = salidaEnVivo(x.sede);
      // El acceso nace con la salida en vivo de la sede o cuando la persona empezó a servir, lo que sea después.
      x.rolDesde = maxFecha(vivo, x.J);
      const anio = x.rolDesde.slice(0, 4);
      const n = (actasPorSede[`${x.sede.codigo}|${anio}`] = (actasPorSede[`${x.sede.codigo}|${anio}`] ?? 0) + 1);
      return {
        persona: x.p.id, rol: x.rol === 'director' ? 'DIRECTOR_ROCAKIDS' : 'MAESTRO_ROCAKIDS',
        segmento: x.sala.segmento_id, desde: x.rolDesde,
        acta: `ACTA-RK-${x.sede.codigo}-${anio}-${pad2(n)} · ${x.rol === 'director' ? 'dirección de RocaKids de la sede' : 'nombramiento de maestros de RocaKids'}`,
      };
    });
    const faltaSegmento = nombramientos.filter(x => !x.segmento);
    if (faltaSegmento.length) throw new Error(`Hay ${faltaSegmento.length} nombramientos sin segmento de RocaKids en su sede`);
    const { rows: otorgados } = await c.query(
      `SELECT x.persona, identidad.otorgar_asignacion(x.persona, x.rol, 'segmento', x.segmento, 4::smallint, x.acta, x.desde, NULL) AS r
         FROM unnest($1::uuid[], $2::text[], $3::uuid[], $4::text[], $5::date[]) AS x(persona, rol, segmento, acta, desde)`,
      [nombramientos.map(x => x.persona), nombramientos.map(x => x.rol), nombramientos.map(x => x.segmento),
       nombramientos.map(x => x.acta), nombramientos.map(x => x.desde)]);
    // El Equipo RocaKids Global: entran con org.meter_en_equipo (la base revisa sus antecedentes).
    // otorgar_asignacion dejó puesto el motivo de la última acta: el ingreso al equipo dice el suyo.
    await c.query(`SELECT set_config('app.motivo', $1, true)`, ['Integra el Equipo RocaKids Global']);
    for (const k of kids) {
      await c.query(`SELECT org.meter_en_equipo($1, $2, $3, $4::date)`, [eqKids.id, k.p.id, k.rolEq, k.desdeEquipo]);
    }
    const liderKids = kids.find(k => k.rolEq === 'lider');
    await c.query(`SELECT set_config('app.motivo', 'Líder del Equipo RocaKids Global', true)`);
    await c.query(`UPDATE org.unidades SET lider_persona_id = $2 WHERE id = $1`, [eqKids.id, liderKids.p.id]);
    const promoverEq = kids.filter(k => k.p.nivel !== 'lider').map(k => k.p.id);
    if (promoverEq.length) {
      await c.query(`SELECT set_config('app.motivo', 'Integra el Equipo RocaKids Global: quien sirve con un cargo es líder', true)`);
      await c.query(`UPDATE nucleo.personas SET nivel_compromiso = 'lider' WHERE id = ANY($1::uuid[])`, [promoverEq]);
    }
    // El comité de accesos de hoy (el que el núcleo dejó para la región Bogotá y la central) revisa también
    // los cargos de RocaKids de esa región, con identidad.recertificar. Las otras regiones quedan por revisar.
    const { rows: rkBogota } = await c.query(
      `SELECT a.id, a.persona_id FROM identidad.asignaciones a
         JOIN org.segmentos g ON g.id = a.alcance_id JOIN org.sedes s ON s.id = g.sede_id
         JOIN org.unidades r ON r.id = s.unidad_id
        WHERE a.rol IN ('DIRECTOR_ROCAKIDS', 'MAESTRO_ROCAKIDS') AND a.revocada_en IS NULL AND r.codigo = 'REG-BOG'
          AND a.vigente_desde <= $1::date
        ORDER BY s.codigo, a.rol, a.persona_id`, [hoyReal]);
    await fijarAutor(c, { persona_id: dg.persona_id, sede_ids: [], nivel_max: 4, alcance_global: true, motivo: 'Comité trimestral de accesos' });
    for (const a of rkBogota) {
      const x = conRolRK.find(y => y.p.id === a.persona_id);
      await c.query(`SELECT identidad.recertificar($1, 'se_mantiene', $2)`, [a.id,
        x?.estado === 'por_vencer'
          ? `Comité trimestral de accesos del ${HOY}: sigue en el cargo. Tiene un antecedente por vencer: renovarlo antes de la fecha.`
          : `Comité trimestral de accesos del ${HOY}: sigue en el cargo y sus antecedentes de salvaguarda están vigentes.`]);
    }
    paso(`${otorgados.length} roles de RocaKids otorgados con acta (${rkBogota.length} recertificados hoy en la región Bogotá) · ${kids.length} en el Equipo RocaKids Global`);

    /* ── 7 · Niños: familias, inscripciones, autorizaciones y salud ─ */
    const azN = azar.derivar('ninos');
    const todosMenores = await d.menores(c);
    const { rows: casa } = await c.query(
      `SELECT hm.persona_id AS menor_id, array_agg(DISTINCT ad.persona_id) AS adultos
         FROM grupos.hogar_miembros hm
         JOIN grupos.hogar_miembros ad ON ad.hogar_id = hm.hogar_id AND ad.hasta IS NULL AND ad.persona_id <> hm.persona_id
         JOIN nucleo.personas pa ON pa.id = ad.persona_id AND pa.eliminado_en IS NULL AND pa.estado = 'activa'
                                AND age($1::date, pa.fecha_nacimiento) >= interval '18 years'
        WHERE hm.hasta IS NULL
          AND NOT EXISTS (SELECT 1 FROM nucleo.acudientes a WHERE a.menor_id = hm.persona_id AND a.acudiente_id = ad.persona_id
                            AND a.vigente_desde <= $1::date AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= $1::date))
        GROUP BY hm.persona_id`, [hoyReal]);
    const noAcudientesDe = new Map(casa.map(r => [r.menor_id, r.adultos]));
    const familiasDe = {};
    const ninoPorId = new Map();
    for (const m of todosMenores) {
      if (!esRK.has(m.sede_codigo)) continue;
      const e = edad(m.fecha_nacimiento, hoyReal);
      if (e > (m.sede_codigo === 'BOG-CHICO' ? 14 : 11)) continue;
      const sala = salaPara(m.sede_codigo, e);
      if (!sala) continue;
      const acud = (m.acudientes ?? []).filter(a => a.acudiente_id);
      if (!acud.length) continue;
      const principal = acud.find(a => a.es_principal) ?? acud[0];
      const nino = { id: m.menor_id, nombre: m.nombre, fnac: m.fecha_nacimiento, edad: e, sala, sede: S[m.sede_codigo], acud, principal,
        bebe: diasEntre(m.fecha_nacimiento, hoyReal) < 200, noAcud: noAcudientesDe.get(m.menor_id) ?? [] };
      ninoPorId.set(nino.id, nino);
      const k = principal.acudiente_id;
      const fams = (familiasDe[m.sede_codigo] ??= new Map());
      if (!fams.has(k)) {
        const p = Number(azN.ponderado({ 0.82: 35, 0.55: 30, 0.25: 20, 0: 15 }));
        fams.set(k, { clave: k, sede: S[m.sede_codigo], p, servicio: azN.probabilidad(0.6) ? 0 : 1, ninos: [] });
      }
      fams.get(k).ninos.push(nino);
    }
    // Los preadolescentes de la madre casi no bajan a RocaKids: ya van a Pulso.
    for (const f of (familiasDe['BOG-CHICO']?.values() ?? [])) if (f.ninos.every(n => n.edad >= 12)) f.p *= 0.35;
    const familias = Object.values(familiasDe).flatMap(m => [...m.values()]);
    const ninosInscritos = familias.filter(f => f.p > 0).flatMap(f => f.ninos);

    // 7a · Inscripciones: la sala de hoy y, si pasó de sala después de la salida en vivo, la anterior cerrada.
    const filasIns = [];
    for (const n of ninosInscritos) {
      const vivo = salidaEnVivo(n.sede);
      const desdeActual = maxFecha(vivo, sumarAnios(n.fnac, n.sala.edad_min));
      if (desdeActual > HOY) continue;
      n.inscritoDesde = desdeActual;
      const previa = salasActivas(n.sede.codigo).find(x => x.edad_max === n.sala.edad_min - 1);
      if (previa && desdeActual > vivo) {
        const desdePrev = maxFecha(vivo, sumarAnios(n.fnac, previa.edad_min));
        if (desdePrev < desdeActual) {
          filasIns.push({ id: azN.uuid(), menor_id: n.id, sala_id: previa.id, desde: desdePrev, hasta: sumarDias(desdeActual, -1) });
          n.inscritoDesde = desdePrev;
        }
      }
      filasIns.push({ id: azN.uuid(), menor_id: n.id, sala_id: n.sala.id, desde: desdeActual, hasta: null });
    }
    // 7b · Autorizaciones: las firma el acudiente principal al inscribir y se renuevan cada año (campaña de febrero).
    const filasAut = [];
    const firmar = (n, fecha, vence, prob) => {
      const hora = instante(fecha, azN.entero(9 * 60 + 30, 12 * 60 + 40), n.sede.zona_horaria, azN.entero(0, 59));
      for (const [tipo, p] of Object.entries(prob)) {
        filasAut.push({ id: azN.uuid(), menor_id: n.id, otorgada_por: n.principal.acudiente_id, tipo, concedida: azN.probabilidad(p),
          ocurrido_en: hora, vence_en: vence, evidencia_ref: `Formato de autorización firmado · RocaKids ${n.sede.nombre} · folio ${azN.entero(100, 4999)}`,
          registrado_en: hora });
      }
    };
    const PROB_AUT = { emergencia_medica: 0.99, eventos: 0.93, foto: 0.72, video: 0.61, transporte: 0.27, retiros: 0.34 };
    for (const n of ninosInscritos) {
      if (!n.inscritoDesde) continue;
      const primera = n.inscritoDesde;
      firmar(n, primera, sumarMeses(primera, 12), PROB_AUT);
      if (primera < '2026-01-15' && azN.probabilidad(0.86)) {
        firmar(n, azN.elegir(d.domingosEntre('2026-02-01', '2026-03-15')), '2027-02-28', PROB_AUT);
      }
    }
    // 7c · Condiciones médicas (las ve solo quien tiene N4, y la sala sabe que existen).
    const CONDICIONES = [
      ['alergia', 'Alergia al maní con reacción grave. Los padres dejan un autoinyector de epinefrina en el bolso.', true],
      ['alergia', 'Alergia a la proteína de la leche de vaca.', false],
      ['alergia', 'Alergia al huevo.', false],
      ['alergia', 'Alergia a picaduras de abeja: tiene autoinyector.', true],
      ['alergia', 'Alergia a los colorantes artificiales.', false],
      ['medicamento', 'Usa inhalador de salbutamol si le falta el aire; lo trae el acudiente.', false],
      ['medicamento', 'Toma antihistamínico diario; no necesita dosis en la iglesia.', false],
      ['condicion', 'Asma leve.', false],
      ['condicion', 'Epilepsia controlada: si convulsiona, acostarlo de lado y llamar al acudiente de inmediato.', true],
      ['condicion', 'Diabetes tipo 1: no darle dulces y avisar al acudiente si se ve decaído.', true],
      ['condicion', 'Trastorno del espectro autista (nivel 1): le molestan los ruidos fuertes.', false],
      ['condicion', 'Déficit de atención: necesita instrucciones cortas y una tarea a la vez.', false],
      ['condicion', 'Dermatitis atópica: no usar cremas distintas de la suya.', false],
      ['restriccion_alimentaria', 'Celiaquía: nada con gluten (galletas, pan, tortas).', false],
      ['restriccion_alimentaria', 'No come azúcar por indicación médica.', false],
      ['restriccion_alimentaria', 'Intolerancia a la lactosa.', false],
    ];
    const filasCond = [];
    for (const n of ninosInscritos) {
      if (!n.inscritoDesde || !azN.probabilidad(0.14)) continue;
      const cuantas = azN.probabilidad(0.2) ? 2 : 1;
      for (const [tipo, descripcion, critica] of azN.muestra(CONDICIONES, cuantas)) {
        filasCond.push({ id: azN.uuid(), menor_id: n.id, tipo, descripcion, critica,
          registrada_en: instante(n.inscritoDesde, azN.entero(9 * 60 + 30, 12 * 60 + 30), n.sede.zona_horaria, azN.entero(0, 59)) });
      }
    }
    // Las registra la dirección de RocaKids de cada sede.
    for (const s of sedesRK) {
      const dir = directorDe(s.codigo);
      const deSede = (f) => ninoPorId.get(f.menor_id)?.sede.codigo === s.codigo;
      await fijarAutor(c, { persona_id: dir?.id ?? dg.persona_id, sede_ids: [s.id], nivel_max: 4, motivo: 'Inscripción en RocaKids' });
      await insertarLote(c, 'rocakids.inscripciones', filasIns.filter(deSede));
      await insertarLote(c, 'rocakids.autorizaciones', filasAut.filter(deSede));
      await insertarLote(c, 'rocakids.condiciones_medicas', filasCond.filter(deSede));
    }
    paso(`${familias.length} familias con niños en RocaKids · ${filasIns.length} inscripciones · ${filasAut.length} autorizaciones · ${filasCond.length} condiciones médicas`);

    /* ── 8 · Los últimos ocho domingos y hoy ──────────────────────── */
    const azD = azar.derivar('domingos');
    const { rows: servAsist } = await c.query(
      `SELECT id, sede_id, fecha::text AS fecha, to_char(hora_inicio, 'HH24:MI') AS hora
         FROM asistencia.servicios WHERE admite_checkin AND fecha BETWEEN $1::date AND $2::date`, [DOMINGOS[0], hoyReal]);
    const servicioDe = (sedeId, fecha, minutos) => {
      const c2 = servAsist.filter(x => x.sede_id === sedeId && x.fecha === fecha)
        .map(x => ({ id: x.id, dif: Math.abs(d.aMinutos(x.hora) - minutos) })).sort((a, b) => a.dif - b.dif);
      return c2.length && c2[0].dif <= 90 ? c2[0].id : null;
    };
    const horariosDe = (s) => s.tamano === 'grande' ? [9 * 60, 11 * 60 + 30]
      : ['MIA', 'ORL', 'HOU'].includes(s.codigo) ? [11 * 60] : s.codigo === 'BCN' ? [12 * 60] : [10 * 60];
    const factorDomingo = (s, fecha) => {
      let f = 1;
      if (s.pais === 'CO' && fecha === '2026-08-16') f *= 0.7;    // puente festivo de la Asunción
      if (s.pais === 'ES' && fecha <= '2026-08-30') f *= 0.45;    // agosto en España
      if (s.pais === 'US' && fecha === '2026-09-06') f *= 0.7;    // fin de semana del Día del Trabajo
      if (fecha >= '2026-09-06') f *= 1.06;                       // septiembre: todos de vuelta
      return f;
    };
    const ctxCache = new Map();
    const autor = async (personaId, motivo) => {
      if (!ctxCache.has(personaId)) {
        const { rows: [x] } = await c.query(`SELECT sedes, nivel_max, es_global FROM identidad.contexto_de($1)`, [personaId]);
        ctxCache.set(personaId, { sede_ids: x?.sedes ?? [], nivel_max: Number(x?.nivel_max ?? 0), alcance_global: Boolean(x?.es_global) });
      }
      await fijarAutor(c, { persona_id: personaId, ...ctxCache.get(personaId), motivo });
    };
    const aptoHoy = (x) => (x.estado === 'vigente' || x.estado === 'por_vencer');
    const ultimaVez = new Map();   // persona → último instante en que operó la pantalla (para su último ingreso)
    const recordarIngreso = (id, cuando) => { if (!ultimaVez.has(id) || ultimaVez.get(id) < cuando) ultimaVez.set(id, cuando); };
    const tot = { ingresos: 0, entregas: 0, segundo: 0, codigo: 0, noAut: 0, unAdulto: 0, olvidos: 0 };

    // Incidentes planeados: salas que abrieron con un solo adulto (sedes pequeñas, cuatro domingos).
    const pequenas = sedesRK.filter(s => s.tamano === 'pequena');
    const incidentes = new Set(azD.muestra(pequenas, 4).map((s, i) => `${s.codigo}|${DOMINGOS[1 + i * 2]}`));
    const MOTIVOS_UN_ADULTO = [
      'La segunda maestra avisó que llega tarde por el tráfico; la directora está pendiente de la puerta.',
      'El auxiliar de turno se enfermó esta mañana y no hubo reemplazo a tiempo.',
      'La segunda maestra está recibiendo a los niños en la entrada y sube en diez minutos.',
      'Se canceló el turno del auxiliar a última hora; la pastora acompaña la sala mientras llega otro.',
    ];
    // Hoy y los olvidos del domingo 20.
    const olvidadoDe = new Map();   // sede → niño
    for (const o of OLVIDADOS) {
      const fams = [...(familiasDe[o.sede]?.values() ?? [])].filter(f => f.p >= 0.55);
      const cand = fams.flatMap(f => f.ninos.filter(n => n.sala.codigo === o.sala && !n.bebe));
      if (cand.length) olvidadoDe.set(o.sede, azD.elegir(cand));
    }

    /** Quién opera la pantalla en una sala ese día: su maestro si vino, si no la dirección. */
    const operadorDe = (eq, sala, presentes, fecha) => {
      const m = eq.maestros.find(x => x.sala.id === sala.id && presentes.has(x.p.id) && x.rolDesde <= fecha && aptoHoy(x) && !x.sinEstrenar);
      if (m) return m.p.id;
      if (eq.director.rolDesde <= fecha) return eq.director.p.id;
      const otro = eq.maestros.find(x => x.rolDesde <= fecha && aptoHoy(x) && !x.sinEstrenar);
      return (otro ?? eq.director).p.id;
    };

    const domingos = [...DOMINGOS.map(f => ({ fecha: f, hoy: false })), { fecha: hoyReal, hoy: true }];
    for (const dia of domingos) {
      const D = dia.fecha;
      const salasDelDia = [];   // { s, sala, ninos: [...], servidores: [...], operador, anulacion }
      for (const s of sedesRK) {
        const eq = equipoDe[s.codigo];
        const fams = [...(familiasDe[s.codigo]?.values() ?? [])];
        const horarios = horariosDe(s);
        const porSala = new Map();
        const agregar = (n, reg) => { if (!porSala.has(n.sala.id)) porSala.set(n.sala.id, []); porSala.get(n.sala.id).push(reg); };
        if (!dia.hoy) {
          const f = factorDomingo(s, D);
          for (const fam of fams) {
            const forzado = fam.ninos.includes(olvidadoDe.get(s.codigo)) && D === AYER;
            if (!forzado && !azD.probabilidad(Math.min(0.97, fam.p * f))) continue;
            const inicio = horarios[Math.min(fam.servicio, horarios.length - 1)];
            const llega = inicio - azD.entero(4, 34) + (azD.probabilidad(0.12) ? azD.entero(10, 22) : 0);
            const sale = inicio + azD.entero(100, 116);
            // Quién los trae: casi siempre el acudiente principal; a veces el otro acudiente.
            const otros = fam.ninos[0].acud.filter(a => a.acudiente_id !== fam.clave);
            const trae = otros.length && azD.probabilidad(0.3) ? azD.elegir(otros).acudiente_id : fam.clave;
            const segundo = azD.probabilidad(0.17);
            const errorCodigo = azD.probabilidad(0.025);
            const intentoNoAut = azD.probabilidad(0.012);
            fam.ninos.forEach((n, i) => {
              if (n.bebe) return;
              const entrega = n.acud.some(a => a.acudiente_id === trae) ? trae : n.principal.acudiente_id;
              const autorizados = n.acud.filter(a => a.autoriza_retiro);
              if (!autorizados.length) return;
              let retira = autorizados.some(a => a.acudiente_id === entrega) ? entrega : autorizados[0].acudiente_id;
              let esSegundo = false;
              if (segundo) {
                const alt = autorizados.filter(a => a.acudiente_id !== retira);
                if (alt.length) { retira = azD.elegir(alt).acudiente_id; esSegundo = true; }
              }
              // Quien lo trajo sin permiso de retiro a veces intenta llevárselo; o un familiar de la casa que no es acudiente.
              let noAut = null;
              const sinPermiso = n.acud.filter(a => !a.autoriza_retiro).map(a => a.acudiente_id);
              if (!autorizados.some(a => a.acudiente_id === entrega) && azD.probabilidad(0.3)) noAut = entrega;
              else if (intentoNoAut && i === 0) noAut = sinPermiso[0] ?? n.noAcud[0] ?? null;
              agregar(n, {
                n, entrega, retira, esSegundo, noAut, errorCodigo: errorCodigo && i === 0,
                ingreso: llega + i, segIngreso: azD.entero(0, 59), salida: sale + i + azD.entero(0, 3), segSalida: azD.entero(0, 59),
                servicio: servicioDe(s.id, D, inicio), olvido: n === olvidadoDe.get(s.codigo) && D === AYER,
              });
            });
          }
        } else {
          const salasHoy = HOY_EN_SALA[s.codigo];
          if (!salasHoy) continue;
          for (const cod of salasHoy) {
            const sala = salasActivas(s.codigo).find(x => x.codigo === cod);
            if (!sala) continue;
            const cand = fams.filter(f => f.p > 0).flatMap(f => f.ninos.filter(n => n.sala.id === sala.id && !n.bebe));
            const elegidos = azD.muestra(cand, azD.entero(3, 6));
            const olv = olvidadoDe.get(s.codigo);
            if (olv && olv.sala.id === sala.id && !elegidos.includes(olv)) elegidos.push(olv);
            // En Bogotá Chicó (Exploradores) alguien de la casa que no puede retirarlo lo pide dos veces.
            let alerta = null;
            if (s.codigo === 'BOG-CHICO' && cod === 'EXPLORA') {
              const conQuien = (n) => n.noAcud[0] ?? n.acud.find(a => !a.autoriza_retiro)?.acudiente_id ?? null;
              alerta = elegidos.find(conQuien) ?? azD.barajar(cand).find(conQuien) ?? null;
              if (alerta && !elegidos.includes(alerta)) elegidos.push(alerta);
              if (alerta) alerta.quienNoPuede = conQuien(alerta);
            }
            elegidos.forEach((n, i) => {
              const autorizados = n.acud.filter(a => a.autoriza_retiro);
              agregar(n, { n, entrega: n.principal.acudiente_id, retira: (autorizados[0] ?? n.principal).acudiente_id,
                ingreso: azD.entero(8, 44), segIngreso: azD.entero(0, 59), hoy: true, idx: i, servicio: null, alerta: n === alerta });
            });
          }
        }
        // Quién sirvió en cada sala ese día (la regla de los dos adultos).
        const usadosHoy = new Set();
        for (const [salaId, regs] of porSala) {
          const sala = salasActivas(s.codigo).find(x => x.id === salaId);
          const equipoSala = [...eq.maestros, ...eq.auxiliares].filter(x => x.sala?.id === salaId && aptoHoy(x) && x.J <= D);
          const presentes = [];
          const m = equipoSala.filter(x => x.rol === 'maestro');
          for (const x of m) if (azD.probabilidad(0.9)) presentes.push(x);
          for (const x of azD.barajar(equipoSala.filter(y => y.rol === 'auxiliar'))) {
            if (presentes.length >= (regs.length > 14 ? 3 : 2)) break;
            if (azD.probabilidad(0.86)) presentes.push(x);
          }
          if (presentes.length < 2 && !usadosHoy.has('dir') && aptoHoy(eq.director) && eq.director.J <= D) {
            presentes.push(eq.director); usadosHoy.add('dir');
          }
          if (presentes.length < 2) {
            // Alguien del equipo que no tenía turno cubre la sala.
            const suplente = [...eq.maestros, ...eq.auxiliares].find(x => aptoHoy(x) && x.J <= D && !presentes.includes(x) && !usadosHoy.has(x.p.id));
            if (suplente) presentes.push(suplente);
          }
          let unAdulto = null;
          const incidente = !dia.hoy && incidentes.has(`${s.codigo}|${D}`) && !usadosHoy.has('incidente');
          if ((incidente && presentes.length >= 2) || (dia.hoy && s.codigo === 'CALI')) {
            usadosHoy.add('incidente');
            presentes.splice(1);
            unAdulto = azD.elegir(MOTIVOS_UN_ADULTO);
          } else if (presentes.length < 2) {
            unAdulto = 'Solo vino un servidor a esta sala; la dirección de RocaKids está avisada.';
          }
          for (const x of presentes) usadosHoy.add(x.p.id);
          const operador = operadorDe(eq, sala, new Set(presentes.map(x => x.p.id)), D);
          const primera = Math.min(...horariosDe(s));
          salasDelDia.push({ s, sala, regs: regs.sort((a, b) => a.ingreso - b.ingreso), operador, unAdulto,
            servidores: presentes.map(x => ({ id: azD.uuid(), persona_id: x.p.id, entro: primera - azD.entero(25, 55), seg: azD.entero(0, 59) })) });
        }
      }
      // 8a · Quién sirve (con la fecha de hoy: la regla de los dos adultos mira CURRENT_DATE).
      const filasServ = salasDelDia.flatMap(x => x.servidores.map(v => ({ id: v.id, sala_id: x.sala.id, persona_id: v.persona_id, sede_id: x.s.id })));
      await insertarLote(c, 'rocakids.servidores_sala', filasServ);
      // 8b · Los ingresos, con la función de 6 argumentos, sala por sala y con quien opera la pantalla.
      const ingresos = [];   // { reg, sala, checkin_id, codigo }
      for (const x of salasDelDia) {
        if (!x.regs.length) continue;
        await autor(x.operador, 'Ingreso a RocaKids');
        const { rows } = await c.query(
          `SELECT x.ord::int AS ord, r.checkin_id, r.codigo, r.repetido, r.aviso
             FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::uuid[], $5::uuid[], $6::text[]) WITH ORDINALITY
                  AS x(menor, sala, entrega, recibe, servicio, anulacion, ord)
            CROSS JOIN LATERAL rocakids.registrar_checkin(x.menor, x.sala, x.entrega, x.recibe, x.servicio, x.anulacion) AS r
            ORDER BY x.ord`,
          [x.regs.map(r => r.n.id), x.regs.map(() => x.sala.id), x.regs.map(r => r.entrega), x.regs.map(() => x.operador),
           x.regs.map(r => r.servicio ?? null), x.regs.map(() => x.unAdulto)]);
        rows.forEach((r, i) => {
          if (r.repetido) throw new Error(`El ingreso de ${x.regs[i].n.nombre} salió repetido: no debía`);
          if (r.aviso && r.aviso.includes('sin salida')) tot.olvidos++;
          ingresos.push({ reg: x.regs[i], x, checkin_id: r.checkin_id, codigo: r.codigo, aviso: r.aviso });
        });
        if (x.unAdulto) tot.unAdulto++;
        tot.ingresos += rows.length;
        recordarIngreso(x.operador, dia.hoy ? hoyReal + 'T00:00' : instante(D, Math.min(...horariosDe(x.s)) - 30, x.s.zona_horaria));
      }
      // 8c · Las entregas, con el código que devolvió el ingreso. Primero los intentos que fallan.
      const porOperador = new Map();
      for (const g of ingresos) { const k = g.x.operador + '|' + g.x.sala.id; if (!porOperador.has(k)) porOperador.set(k, []); porOperador.get(k).push(g); }
      const entregar = async (lista, operador) => {
        if (!lista.length) return [];
        const { rows } = await c.query(
          `SELECT x.ord::int AS ord, rocakids.entregar_menor(x.checkin, x.retira, x.codigo, x.maestro) AS resultado
             FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::uuid[]) WITH ORDINALITY AS x(checkin, retira, codigo, maestro, ord)
            ORDER BY x.ord`,
          [lista.map(g => g.checkin_id), lista.map(g => g.retira), lista.map(g => g.codigo), lista.map(() => operador)]);
        return rows.map(r => r.resultado);
      };
      for (const [k, grupo] of porOperador) {
        const operador = k.split('|')[0];
        await autor(operador, 'Entrega de RocaKids');
        const fallos = [];
        const buenos = [];
        for (const g of grupo) {
          const r = g.reg;
          if (dia.hoy) {
            // Hoy: en Bogotá Chicó alguien de la casa que no es acudiente pide dos veces al mismo niño.
            if (r.alerta) {
              const quien = r.n.quienNoPuede;
              if (quien) {
                fallos.push({ checkin_id: g.checkin_id, retira: quien, codigo: codigoErrado(azD, g.codigo), esperado: 'no_autorizado' });
                fallos.push({ checkin_id: g.checkin_id, retira: quien, codigo: g.codigo, esperado: 'no_autorizado' });
                resumenHoy.push({ sede: g.x.s.codigo, sala: g.x.sala.nombre, nino: r.n.nombre, codigo: g.codigo, nota: 'dos intentos de retiro de alguien no autorizado' });
                continue;
              }
            }
            // Hoy: en Medellín un niño salió temprano.
            if (g.x.s.codigo === 'MED' && r.idx === 0) {
              buenos.push({ checkin_id: g.checkin_id, retira: r.retira, codigo: g.codigo, hoy: true });
              resumenHoy.push({ sede: g.x.s.codigo, sala: g.x.sala.nombre, nino: r.n.nombre, codigo: g.codigo, nota: 'ya entregado (salió temprano)' });
              continue;
            }
            resumenHoy.push({ sede: g.x.s.codigo, sala: g.x.sala.nombre, nino: r.n.nombre, codigo: g.codigo,
              nota: g.aviso ? 'en sala · ' + (g.aviso.includes('sin salida') ? 'se cerró su ingreso del domingo sin salida' : 'recibido con un solo adulto') : 'en sala' });
            continue;
          }
          if (r.olvido) continue;   // nadie registró su salida el domingo 20
          if (r.noAut) { fallos.push({ checkin_id: g.checkin_id, retira: r.noAut, codigo: g.codigo, esperado: 'no_autorizado' }); tot.noAut++; }
          if (r.errorCodigo && !r.noAut) { fallos.push({ checkin_id: g.checkin_id, retira: r.retira, codigo: codigoErrado(azD, g.codigo), esperado: 'codigo_incorrecto' }); tot.codigo++; }
          if (r.esSegundo) tot.segundo++;
          buenos.push({ checkin_id: g.checkin_id, retira: r.retira, codigo: g.codigo });
        }
        const rf = await entregar(fallos, operador);
        rf.forEach((res, i) => { if (res !== fallos[i].esperado) throw new Error(`Un intento que debía dar «${fallos[i].esperado}» dio «${res}»`); });
        const rb = await entregar(buenos, operador);
        rb.forEach(res => { if (res !== 'entregado') throw new Error(`Una entrega con el código correcto dio «${res}»`); });
        tot.entregas += rb.length;
      }
      // 8d · La hora de verdad: las funciones fechan con now(); se corrige el ingreso, la salida y quién sirvió.
      if (!dia.hoy) {
        const ids = [], ins = [], outs = [];
        for (const g of ingresos) {
          const z = g.x.s.zona_horaria, r = g.reg;
          ids.push(g.checkin_id);
          ins.push(instante(D, r.ingreso, z, r.segIngreso));
          outs.push(r.olvido ? null : instante(D, r.salida, z, r.segSalida));
        }
        await c.query(`SELECT set_config('app.motivo', $1, true)`, [`Carga de la historia de RocaKids del domingo ${D}: hora real del ingreso y de la salida`]);
        await c.query(
          `UPDATE rocakids.checkins k SET ingreso_en = v.ingreso, salida_en = COALESCE(v.salida, k.salida_en)
             FROM unnest($1::uuid[], $2::timestamptz[], $3::timestamptz[]) AS v(id, ingreso, salida) WHERE k.id = v.id`, [ids, ins, outs]);
        const sIds = [], sEntro = [];
        for (const x of salasDelDia) for (const v of x.servidores) { sIds.push(v.id); sEntro.push(instante(D, v.entro, x.s.zona_horaria, v.seg)); }
        await c.query(
          `UPDATE rocakids.servidores_sala s SET fecha = $2::date, entro_en = v.entro
             FROM unnest($1::uuid[], $3::timestamptz[]) AS v(id, entro) WHERE s.id = v.id`, [sIds, D, sEntro]);
      } else {
        // Hoy: llegaron hace un rato (entre 8 y 44 minutos), y quien sirve llegó antes.
        const ids = ingresos.map(g => g.checkin_id);
        const mins = ingresos.map(g => g.reg.ingreso), segs = ingresos.map(g => g.reg.segIngreso);
        await c.query(
          `UPDATE rocakids.checkins k
              SET ingreso_en = GREATEST(date_trunc('day', now()), now() - make_interval(mins => v.m, secs => v.s)),
                  salida_en = CASE WHEN k.salida_en IS NOT NULL AND k.salida_en >= date_trunc('day', now()) AND NOT k.cierre_administrativo
                                   THEN now() - make_interval(mins => 3) ELSE k.salida_en END
             FROM unnest($1::uuid[], $2::int[], $3::int[]) AS v(id, m, s) WHERE k.id = v.id`, [ids, mins, segs]);
        const sIds = salasDelDia.flatMap(x => x.servidores.map(v => v.id));
        await c.query(
          `UPDATE rocakids.servidores_sala SET entro_en = GREATEST(date_trunc('day', now()), now() - interval '52 minutes')
            WHERE id = ANY($1::uuid[])`, [sIds]);
      }
      paso(`${dia.hoy ? 'hoy' : 'domingo ' + D}: ${ingresos.length} ingresos en ${salasDelDia.length} salas`);
    }

    /* ── 9 · Cuentas para quien recibió un rol ────────────────────── */
    await c.query(`SELECT set_config('app.motivo', $1, true)`, ['Cuenta de acceso para quien recibió un cargo en RocaKids']);
    const conCuenta = [...conRolRK.map(x => ({ p: x.p, desde: x.rolDesde })), ...kids.map(k => ({ p: k.p, desde: k.desdeEquipo }))];
    const azC = azar.derivar('cuentas');
    const nuevas = new Set();   // solo a estas se les fija el último ingreso y la clave provisional
    for (const x of conCuenta) {
      const { rows: [ya] } = await c.query(`SELECT 1 FROM identidad.cuentas WHERE persona_id = $1`, [x.p.id]);
      if (ya) continue;   // ya tenía cuenta por otro cargo: se deja como está
      await c.query(`SELECT identidad.crear_cuenta($1, $2, $3, $4)`, [x.p.id, x.p.email, hashClave, dg.persona_id]);
      nuevas.add(x.p.id);
      cuentas.creadas++;
    }
    const quienes = [], cuando = [], provisionales = [], operaronHoy = [];
    for (const x of conCuenta.filter(y => nuevas.has(y.p.id))) {
      let u = ultimaVez.get(x.p.id) ?? null;
      if (u && u.endsWith('T00:00')) { operaronHoy.push(x.p.id); continue; }   // hoy: entró hace un rato
      if (!u && diasEntre(x.desde, HOY) > 25 && azC.probabilidad(0.85)) {
        u = instante(sumarDias(HOY, -azC.entero(2, 20)), azC.entero(7 * 60, 21 * 60), S[x.p.sede]?.zona_horaria ?? 'America/Bogota');
      }
      if (u) { quienes.push(x.p.id); cuando.push(u); } else if (diasEntre(x.desde, HOY) <= 25) provisionales.push(x.p.id);
    }
    await c.query(`UPDATE identidad.cuentas c SET ultimo_ingreso = v.cuando
                     FROM unnest($1::uuid[], $2::timestamptz[]) AS v(persona_id, cuando) WHERE c.persona_id = v.persona_id`, [quienes, cuando]);
    await c.query(`UPDATE identidad.cuentas SET ultimo_ingreso = GREATEST(date_trunc('day', now()), now() - interval '1 hour')
                    WHERE persona_id = ANY($1::uuid[])`, [operaronHoy]);
    if (provisionales.length) await c.query(`UPDATE identidad.cuentas SET debe_cambiar_clave = true WHERE persona_id = ANY($1::uuid[])`, [provisionales]);
    paso(`${cuentas.creadas} cuentas nuevas (${provisionales.length} con clave provisional)`);

    /* ── 10 · Contratos ────────────────────────────────────────────── */
    const azK = azar.derivar('contratos');
    const { rows: cargos } = await c.query(`SELECT codigo, id FROM talento.cargos`);
    const CARGO = Object.fromEntries(cargos.map(x => [x.codigo, x.id]));
    const monedaDe = (s) => (['US', 'PA'].includes(s.pais) ? 'USD' : s.pais === 'ES' ? 'EUR' : 'COP');
    /* Sueldo mensual: en pesos para Colombia; en dólares (Estados Unidos y Panamá) y euros (España), en unidades. */
    const sueldo = (s, cop, usd, eur) => {
      const m = monedaDe(s);
      const enUsd = usd ?? cop.map(v => v / 4000);
      const [lo, hi] = m === 'USD' ? (s.pais === 'PA' ? enUsd.map(v => v * 0.55) : enUsd) : m === 'EUR' ? (eur ?? cop.map(v => v / 4500)) : cop;
      const paso2 = m === 'COP' ? 50000 : 50;
      return Math.round(azK.entero(Math.round(lo), Math.round(hi)) / paso2) * paso2;
    };
    const madre = S['BOG-CHICO'];
    const filasCon = [];
    const terminar = [];   // { id, termina, motivo }
    const yaContrato = new Set();
    const contrato = (persona, s, cargo, tipo, inicia, termina, salario, extra = {}) => {
      if (!persona || yaContrato.has(`${persona}|${s.id}`)) return null;
      yaContrato.add(`${persona}|${s.id}`);
      const f = { id: azK.uuid(), persona_id: persona, sede_id: s.id, cargo_id: CARGO[cargo], tipo, estado: 'activo', inicia,
        termina: termina ?? null, salario, moneda: monedaDe(s),
        documento_ref: `Contrato ${tipo === 'prestacion_servicios' ? 'de prestación de servicios' : 'laboral'} CR-${inicia.slice(0, 4)}-${pad2(azK.entero(1, 99))}${azK.entero(1, 9)} · archivo de Talento Humano`,
        // Se cargó al sistema con la salida en vivo de la central (o el día que empezó, si fue después).
        creado_en: instante(minFecha(maxFecha(inicia, SALIDAS_POR_OLA[1]), AYER), azK.entero(8 * 60, 17 * 60), 'America/Bogota', azK.entero(0, 59)) };
      filasCon.push(f);
      if (extra.terminarEl) terminar.push({ id: f.id, termina: extra.terminarEl, motivo: extra.motivo });
      return f;
    };
    // La central (trabajan en la sede madre).
    const equipoCentral = async (cod) => d.equipo(c, cod);
    let fijoFin = false;
    for (const x of await equipoCentral('EQ-FIN')) {
      if (x.rol_en_unidad === 'coordinador') continue;
      const cargo = x.rol_en_unidad === 'lider' ? 'CONTADOR' : 'AUX_CONTABLE';
      // Una auxiliar contable con contrato a término fijo que vence en tres semanas: el aviso de «vence pronto».
      const fijo = cargo === 'AUX_CONTABLE' && !fijoFin;
      if (fijo) fijoFin = true;
      const inicia = fijo ? '2025-10-15' : minFecha(x.desde, entre(azK, '2019-02-01', x.desde));
      contrato(x.persona_id, madre, cargo, fijo ? 'termino_fijo' : 'termino_indefinido', inicia, fijo ? '2026-10-14' : null,
        cargo === 'CONTADOR' ? sueldo(madre, [5600000, 6800000]) : sueldo(madre, [2200000, 2700000]));
    }
    {
      const { rows: [salio] } = await c.query(
        `SELECT m.persona_id, to_char(m.desde,'YYYY-MM-DD') AS desde, to_char(m.hasta,'YYYY-MM-DD') AS hasta,
                EXISTS (SELECT 1 FROM identidad.cuentas cu WHERE cu.persona_id = m.persona_id AND cu.estado = 'activa') AS cuenta_activa
           FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id
          WHERE u.codigo = 'EQ-FIN' AND m.hasta IS NOT NULL ORDER BY m.hasta DESC LIMIT 1`);
      // Solo se termina el contrato de quien no tiene cuenta activa: la base suspendería su cuenta (ver el informe).
      if (salio && !salio.cuenta_activa) {
        contrato(salio.persona_id, madre, 'AUX_CONTABLE', 'termino_indefinido', entre(azK, '2021-03-01', '2024-06-30'), null,
          sueldo(madre, [2100000, 2500000]), { terminarEl: salio.hasta, motivo: 'Renunció para servir como tesorero de su sede.' });
      }
    }
    for (const x of await equipoCentral('EQ-TH')) {
      const aprendiz = x.desde >= '2026-06-01';
      contrato(x.persona_id, madre, 'TALENTO_HUMANO', aprendiz ? 'aprendizaje' : 'termino_indefinido', minFecha(x.desde, entre(azK, '2020-01-15', x.desde)),
        aprendiz ? sumarMeses(x.desde, 6) : null, aprendiz ? 1350000 : sueldo(madre, x.rol_en_unidad === 'lider' ? [4200000, 4900000] : [3100000, 3600000]));
    }
    for (const x of await equipoCentral('EQ-TI')) {
      if (x.rol_en_unidad === 'coordinador') continue;
      const reciente = x.desde >= '2026-06-01';
      contrato(x.persona_id, madre, 'SISTEMAS', reciente ? 'prestacion_servicios' : 'termino_indefinido', reciente ? x.desde : minFecha(x.desde, entre(azK, '2021-01-15', x.desde)),
        reciente ? '2026-12-11' : null, sueldo(madre, x.rol_en_unidad === 'lider' ? [5200000, 6000000] : [3800000, 4500000]));
    }
    for (const x of await equipoCentral('EQ-COM')) {
      if (x.rol_en_unidad === 'coordinador') continue;
      const obra = x.desde >= '2026-01-01';
      contrato(x.persona_id, madre, 'COMUNICACIONES', obra ? 'obra_labor' : 'termino_indefinido', obra ? x.desde : entre(azK, '2020-06-01', x.desde),
        obra ? '2026-10-10' : null, sueldo(madre, [2500000, 3500000]));
    }
    for (const x of await equipoCentral('EQ-LEGAL')) {
      contrato(x.persona_id, madre, 'ABOGADO', 'prestacion_servicios', '2026-01-13', '2026-12-18', sueldo(madre, [4600000, 6800000]));
    }
    contrato(liderKids.p.id, madre, 'DIR_ROCAKIDS', 'termino_indefinido', maxFecha(liderKids.desdeEquipo, '2025-09-08'), null, sueldo(madre, [4400000, 4900000]));
    // El Pastor Principal y su esposa, y la pareja pastoral de las sedes grandes.
    contrato(dg.persona_id, madre, 'PASTOR_GENERAL', 'termino_indefinido', '2008-01-15', null, 11800000);
    const esposaDG = (await d.direccionGeneral(c))[1];
    if (esposaDG) contrato(esposaDG.persona_id, madre, 'PASTOR_GENERAL', 'termino_indefinido', '2008-01-15', null, 9600000);
    for (const s of sedesRK.filter(x => x.tamano === 'grande' && x.codigo !== 'BOG-CHICO')) {
      for (const p of pastoresPorSede[s.codigo] ?? []) {
        contrato(p.persona_id, s, 'PASTOR_SEDE', 'termino_indefinido', entre(azK, '2010-02-01', '2022-12-01'), null, sueldo(s, [5600000, 8200000]));
      }
    }
    // La secretaría de cada sede con Talento (la primera), y la tesorería de las grandes.
    const secretarias = await d.conRol(c, 'SECRETARIA');
    const tesorerias = await d.conRol(c, 'TESORERIA');
    let fijosCortos = 0;
    for (const s of sedesTalento) {
      const sec = secretarias.find(x => x.sede_codigo === s.codigo);
      if (sec) {
        const fijo = s.tamano === 'pequena' && azK.probabilidad(0.35);
        const inicia = entre(azK, maxFecha(sumarAnios(HOY, -7), '2016-01-01'), maxFecha(sec.vigente_desde, '2016-02-01'));
        let termina = null;
        if (fijo) termina = fijosCortos++ === 0 ? '2026-10-18' : sumarMeses(HOY, azK.entero(3, 11));
        contrato(sec.persona_id, s, 'SECRETARIA', fijo ? 'termino_fijo' : 'termino_indefinido', fijo ? sumarMeses(termina, -12) : inicia, termina,
          sueldo(s, [1900000, 2600000], [2700, 3200], [1500, 1750]));
      }
      if (s.tamano === 'grande') {
        const tes = tesorerias.find(x => x.sede_codigo === s.codigo);
        if (tes) contrato(tes.persona_id, s, 'TESORERO', 'termino_indefinido', entre(azK, '2017-01-15', tes.vigente_desde), null, sueldo(s, [3100000, 4200000]));
      }
    }
    // Quienes tuvieron el cargo antes (el núcleo les venció la asignación y les suspendió la cuenta): su contrato terminó.
    {
      const { rows: anteriores } = await c.query(
        `SELECT a.persona_id, a.rol, to_char(a.vigente_hasta,'YYYY-MM-DD') AS hasta, s.codigo AS sede
           FROM identidad.asignaciones a JOIN org.sedes s ON s.id = a.alcance_id
          WHERE a.alcance_tipo = 'sede' AND a.vigente_hasta < $1::date AND a.rol IN ('SECRETARIA', 'TESORERIA')
            AND NOT EXISTS (SELECT 1 FROM identidad.cuentas cu WHERE cu.persona_id = a.persona_id AND cu.estado = 'activa')`, [hoyReal]);
      for (const a of anteriores) {
        const s = S[a.sede];
        if (!s) continue;
        const cargo = a.rol === 'SECRETARIA' ? 'SECRETARIA' : 'TESORERO';
        contrato(a.persona_id, s, cargo, 'termino_indefinido', entre(azK, '2018-02-01', '2024-01-31'), null,
          cargo === 'SECRETARIA' ? sueldo(s, [1850000, 2300000], [2600, 3000], [1450, 1650]) : sueldo(s, [3000000, 3800000], [3600, 4200], [2000, 2300]),
          { terminarEl: a.hasta, motivo: azK.elegir(['Renuncia voluntaria: se trasladó de ciudad.', 'Terminó su contrato por mutuo acuerdo.', 'Renunció para dedicarse a su familia.']) });
      }
    }
    // Servicios generales, seguridad, sonido y docentes del Instituto (gente sin cargo en el sistema).
    const sinRol = (codigo, filtro) => azK.barajar((adultosDe[codigo] ?? []).filter(p => !p.con_rol && !p.con_cuenta && p.edad >= 20 && p.edad <= 60 && filtro(p)));
    for (const s of sedesRK.filter(x => x.tamano === 'grande')) {
      const [sg] = sinRol(s.codigo, () => true);
      if (sg) contrato(sg.id, s, 'SERVICIOS_GEN', 'termino_indefinido', entre(azK, '2019-01-10', '2025-12-15'), null, sueldo(s, [1850000, 2050000]));
      if (['BOG-CHICO', 'MED', 'CALI'].includes(s.codigo)) {
        const [so] = sinRol(s.codigo, p => p.id !== sg?.id);
        if (so) contrato(so.id, s, 'SONIDO', 'prestacion_servicios', '2026-02-02', '2026-12-20', sueldo(s, [1800000, 2600000]));
      }
      if (['BOG-CHICO', 'MED'].includes(s.codigo)) {
        for (const se of sinRol(s.codigo, p => p.genero === 'M' && p.id !== sg?.id).slice(0, s.codigo === 'BOG-CHICO' ? 2 : 1)) {
          contrato(se.id, s, 'SEGURIDAD', 'termino_indefinido', entre(azK, '2020-03-01', '2026-03-01'), null, sueldo(s, [1850000, 2150000]));
        }
      }
    }
    // Un auxiliar de servicios generales que ya no está (sin cuenta).
    {
      const s = S.BAQ ?? madre;
      const [ex] = sinRol(s.codigo, () => true);
      if (ex) contrato(ex.id, s, 'SERVICIOS_GEN', 'termino_fijo', '2025-08-01', '2026-07-31', sueldo(s, [1800000, 1950000]),
        { terminarEl: '2026-07-31', motivo: 'Terminó el contrato a término fijo y no se renovó.' });
    }
    for (const s of sedesTalento.filter(x => x.ministerios.includes('INSTITUTO')).slice(0, 6)) {
      const [doc] = sinRol(s.codigo, p => p.bautizado && p.edad >= 30);
      if (doc) contrato(doc.id, s, 'DOCENTE', 'prestacion_servicios', '2026-07-21', '2026-11-28', sueldo(s, [1400000, 2200000], [1200, 1500], [900, 1100]));
    }
    await fijarAutor(c, { persona_id: liderTH.persona_id, nivel_max: 3, alcance_global: true, motivo: 'Carga de contratos de Talento Humano' });
    await insertarLote(c, 'talento.contratos', filasCon);
    // Terminar un contrato es un UPDATE con su motivo (el disparador corta el acceso si no queda otro vínculo).
    for (const t of terminar) {
      await c.query(`SELECT set_config('app.motivo', $1, true)`, [t.motivo]);
      await c.query(`UPDATE talento.contratos SET estado = 'terminado', termina = $2::date WHERE id = $1`, [t.id, t.termina]);
    }
    paso(`${filasCon.length} contratos (${terminar.length} terminados)`);

    /* ── 11 · Comprobaciones: lo que la base exige, visto desde afuera ── */
    const { rows: [chk] } = await c.query(
      `SELECT
         (SELECT count(*) FROM identidad.asignaciones a JOIN identidad.roles_con_menores r ON r.rol = a.rol
           WHERE a.revocada_en IS NULL AND NOT talento.apto_para_menores(a.persona_id))::int AS roles_sin_aptitud,
         (SELECT count(*) FROM identidad.asignaciones a WHERE a.rol IN ('DIRECTOR_ROCAKIDS','MAESTRO_ROCAKIDS') AND a.revocada_en IS NULL
             AND NOT EXISTS (SELECT 1 FROM identidad.cuentas c WHERE c.persona_id = a.persona_id))::int AS roles_sin_cuenta,
         (SELECT count(*) FROM rocakids.checkins WHERE salida_en IS NULL AND ingreso_en::date = CURRENT_DATE)::int AS en_sala_hoy,
         (SELECT count(*) FROM rocakids.checkins WHERE salida_en IS NULL AND ingreso_en::date < CURRENT_DATE)::int AS abiertos_viejos,
         (SELECT count(*) FROM rocakids.checkins WHERE cierre_administrativo)::int AS cierres_administrativos,
         (SELECT count(*) FROM rocakids.checkins k WHERE k.retirado_por IS NOT NULL AND k.retirado_por <> k.entregado_por)::int AS retirados_por_otro,
         (SELECT count(*) FROM rocakids.intentos_entrega WHERE resultado <> 'entregado')::int AS intentos_fallidos,
         (SELECT count(*) FROM talento.voluntariados v WHERE v.estado = 'activo' AND v.trabaja_con_menores
             AND NOT talento.apto_para_menores(v.persona_id))::int AS activos_sin_aptitud,
         (SELECT count(*) FROM talento.v_antecedentes_por_vencer)::int AS por_vencer,
         (SELECT count(*) FROM rocakids.v_salas_sin_dos_adultos)::int AS salas_con_un_adulto`);
    if (chk.roles_sin_aptitud) throw new Error(`${chk.roles_sin_aptitud} roles de menores sin antecedentes vigentes`);
    if (chk.roles_sin_cuenta) throw new Error(`${chk.roles_sin_cuenta} roles de RocaKids sin cuenta`);
    if (chk.abiertos_viejos) throw new Error(`${chk.abiertos_viejos} ingresos de otro día siguen abiertos`);
    paso(`comprobado: ${chk.en_sala_hoy} niños en sala hoy · ${chk.cierres_administrativos} salidas cerradas por el sistema · ` +
      `${chk.retirados_por_otro} entregas a otro acudiente autorizado · ${chk.intentos_fallidos} intentos fallidos · ` +
      `${chk.activos_sin_aptitud} activos con menores sin antecedentes vigentes · ${chk.por_vencer} antecedentes por vencer · ` +
      `${chk.salas_con_un_adulto} salas-día con un solo adulto`);
    console.log(`   · domingos: ${tot.ingresos} ingresos, ${tot.entregas} entregas, ${tot.segundo} a un segundo acudiente, ` +
      `${tot.codigo} códigos mal digitados, ${tot.noAut} intentos de quien no puede retirar, ${tot.unAdulto} salas con un solo adulto`);
  });

  if (resumenHoy.length) {
    console.log('   · HOY EN SALA (solo laboratorio: el código se entrega una sola vez al acudiente):');
    for (const r of resumenHoy) console.log(`       ${r.sede.padEnd(10)} ${r.sala.padEnd(26)} ${r.codigo}  ${r.nino} · ${r.nota}`);
  }

  const conteos = await d.contarFilas(c, [
    'rocakids.salas', 'rocakids.servidores_sala', 'rocakids.checkins', 'rocakids.intentos_entrega', 'rocakids.inscripciones',
    'rocakids.autorizaciones', 'rocakids.condiciones_medicas', 'talento.voluntariados', 'talento.antecedentes', 'talento.contratos',
  ]);
  const { rows: [extra] } = await c.query(
    `SELECT (SELECT count(*) FROM identidad.asignaciones WHERE rol IN ('DIRECTOR_ROCAKIDS','MAESTRO_ROCAKIDS'))::int AS roles,
            (SELECT count(*) FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id WHERE u.codigo = 'EQ-KIDS')::int AS eq_kids`);
  return { ...conteos, 'identidad.asignaciones (RocaKids)': extra.roles, 'identidad.cuentas (nuevas)': cuentas.creadas, 'org.unidad_miembros (EQ-KIDS)': extra.eq_kids };
});
