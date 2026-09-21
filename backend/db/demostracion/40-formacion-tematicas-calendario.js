'use strict';
/**
 * =====================================================================
 * 40-formacion-tematicas-calendario.js · FORMACIÓN, TEMÁTICAS Y CALENDARIO
 *
 * ⛔ SOLO DEMOSTRACIÓN. Todo lo que deja este archivo es inventado: cursos,
 *    cohortes, inscripciones, notas, certificados, series de enseñanza y
 *    eventos. Jamás corre contra producción: la guarda de comun.js lo impide.
 *
 * Lo que deja, por las reglas de la base y no alrededor de ellas:
 *
 *   1. FORMACIÓN. El catálogo de la red se completa (la Escuela de
 *      liderazgo con su segundo semestre, el Instituto bíblico con sus
 *      cuatro semestres y los talleres de matrimonios y de finanzas) y cada
 *      sede con el módulo encendido abre sus cohortes: Fundamentos y
 *      Bautismo cada pocos meses, promociones de liderazgo y del Instituto
 *      que pasan de un nivel al siguiente con quienes aprobaron, formación
 *      de maestros de RocaKids y talleres. Presenciales, virtuales y mixtas;
 *      gratis o con valor en COP, USD o EUR según el país; el Instituto
 *      virtual de la red lo dicta la sede madre. Las inscripciones declaran
 *      su pago (la base lo exige en toda cohorte con valor), respetan el
 *      cupo, tienen nota final donde el curso califica, y quien aprobó un
 *      curso que certifica recibe su certificado (la base impide certificar
 *      a quien no aprobó). Lo anterior a la salida en vivo de cada sede llegó
 *      por migración, sin sesión; lo posterior lo registró la secretaría o
 *      el pastor que tenía el cargo ese día.
 *   2. TEMÁTICAS. Las series de la red que predica la sede madre, domingo a
 *      domingo, con pasaje, predicador y resumen, y las series propias de
 *      cada sede: el estudio de los miércoles, tMt, Mujer Integral, Hombres
 *      Bien y el arranque de las plantaciones. Cada serie pasa por su
 *      máquina de estados (planeada, en curso, terminada).
 *   3. CALENDARIO. Los eventos de la red (conferencia anual, encuentros de
 *      pastores, ayuno, capacitaciones) y los de cada sede (reuniones de
 *      líderes, vigilias, bautizos, retiros, aniversarios, Navidad), en la
 *      zona horaria de cada sede: hechos, cancelados con su motivo y
 *      próximos, y unos cuantos que ya pasaron sin que nadie los marcara.
 *
 * Defectos del sistema que se vieron al poblar (se respetaron; nada se desactivó):
 *   · formacion.certificados y formacion.cohortes no tienen trg_auditar:
 *     anular un certificado o abrir una cohorte no deja rastro.
 *   · Un certificado anulado no se puede volver a expedir: inscripcion_id es
 *     UNIQUE aunque el anterior esté anulado.
 *   · No hay ruta ni pantalla para expedir certificados de formación (este
 *     archivo los escribe por SQL, con la regla de la base que exige aprobado).
 *   · «Registrar pago» no guarda cuánto se pagó (valor_pagado queda vacío);
 *     aquí sí se llena, porque la columna existe.
 *   · El prerrequisito de un curso no lo comprueba nadie al inscribir.
 *   · La lista y la ficha de cohortes cuentan a los reprobados como ocupando
 *     cupo y la base no: después de un reprobado y un reemplazo, la pantalla
 *     dice «por encima del cupo» cuando no lo está.
 *   · La historia de la persona dice «Se inscribió en IB-301-2026-2» (el código
 *     de la cohorte, no el curso).
 *
 * Corre en UNA transacción: o queda todo, o no queda nada. No se corre dos
 * veces: si ya hay cohortes de la demostración, avisa y sale sin tocar nada.
 * Uso: PGDATABASE=cr_e2e_64 node backend/db/demostracion/40-formacion-tematicas-calendario.js
 * =====================================================================
 */
const d = require('./comun');
const {
  FECHA_REFERENCIA: HOY, AYER, FIN_HORIZONTE, SISTEMA, SALIDAS_POR_OLA,
  sumarDias, sumarMeses, diasEntre, edad, momentoLocal, minFecha, maxFecha, diaSemana, slug,
  insertarLote, fijarAutor, autorDireccion, enTransaccion,
} = d;

const ARCHIVO = 40;

/* ─────────────────────────────────────────────────────────────────────
   1 · CONSTANTES DE LA RED
   ───────────────────────────────────────────────────────────────────── */

/** Fundación de cada sede (la misma que usa 00-red.js): nada ocurre antes. */
const FUNDADA = {
  'BOG-CHICO': '1998-03-01', 'BOG-NORTE': '2006-02-12', MED: '2008-08-10', PTY: '2014-05-18', BCN: '2017-09-24',
  CHIA: '2024-08-18', 'BOG-SUR': '2012-04-15', 'BOG-OCC': '2015-07-19', 'BOG-SUBA': '2018-03-04', SOACHA: '2019-10-06',
  ZIPA: '2025-06-01', FUNZA: '2025-10-12', CAJICA: '2025-03-09', CALI: '2009-05-24', BAQ: '2011-02-20',
  BGA: '2013-06-09', ENV: '2013-09-15', BELLO: '2018-04-22', CTG: '2016-01-17', PEI: '2014-03-16', MZL: '2017-08-13',
  ARM: '2019-02-10', IBG: '2016-10-09', VVC: '2015-11-22', NVA: '2020-02-16', SMR: '2018-07-29', CUC: '2017-05-14',
  PSO: '2024-11-10', MTR: '2025-05-18', TUN: '2025-08-24', POP: '2026-02-15', MIA: '2015-04-12', ORL: '2019-06-16',
  HOU: '2021-03-21', MAD: '2016-11-20', NYC: '2026-04-19',
};

/** Moneda de las cohortes con valor, por país de la sede. */
const MONEDA = { CO: 'COP', PA: 'USD', US: 'USD', ES: 'EUR' };

/** Nivel con que la API abre la sesión de cada cargo (identidad.roles). */
const NIVEL_ROL = { PASTOR_CONGREGACIONAL: 3, SECRETARIA: 2, COORDINADOR_NUEVOS: 2 };

const MOTIVO_MIGRACION = 'Migración desde 99-o: historia de formación anterior a la salida en vivo de la sede';

/* ─────────────────────────────────────────────────────────────────────
   2 · EL CATÁLOGO DE FORMACIÓN DE LA RED
   La semilla trae cuatro programas y ocho cursos (y una cohorte de cada
   curso en la sede madre). Aquí se completa lo que un año de verdad
   necesita: el segundo semestre de la Escuela de liderazgo, los semestres
   2 a 4 del Instituto y dos talleres nuevos. Los prerrequisitos van en
   orden: primero lo que depende de la semilla, después lo que depende de
   lo nuevo.
   ───────────────────────────────────────────────────────────────────── */
const PROGRAMAS_NUEVOS = [
  { codigo: 'MATR', nombre: 'Matrimonios sobre la Roca', tipo: 'taller', semestres: null,
    descripcion: 'Talleres para fortalecer el matrimonio y para preparar a las parejas que se van a casar.' },
  { codigo: 'FINZ', nombre: 'Finanzas con propósito', tipo: 'taller', semestres: null,
    descripcion: 'Mayordomía y finanzas del hogar: presupuesto, deudas, ahorro y generosidad.' },
];

const CURSOS_NUEVOS = [
  [ // dependen de la semilla o de nada
    { programa: 'LIDER', codigo: 'LID-03', nombre: 'Liderazgo que sirve', semestre: 2, horas: 20, certifica: true, prerequisito: 'LID-02' },
    { programa: 'IBIB', codigo: 'IB-201', nombre: 'Pentateuco e historia de Israel', semestre: 2, horas: 48, certifica: true, prerequisito: 'IB-101' },
    { programa: 'IBIB', codigo: 'IB-202', nombre: 'Evangelios y Hechos', semestre: 2, horas: 48, certifica: true, prerequisito: 'IB-102' },
    { programa: 'MATR', codigo: 'MAT-01', nombre: 'Taller de matrimonios: pacto y propósito', semestre: null, horas: 12, certifica: false },
    { programa: 'MATR', codigo: 'MAT-02', nombre: 'Preparación para el matrimonio', semestre: null, horas: 10, certifica: true },
    { programa: 'FINZ', codigo: 'FIN-01', nombre: 'Finanzas familiares', semestre: null, horas: 8, certifica: false },
  ],
  [ // dependen de lo anterior
    { programa: 'LIDER', codigo: 'LID-04', nombre: 'Acompañar y aconsejar', semestre: 2, horas: 16, certifica: true, prerequisito: 'LID-03' },
    { programa: 'IBIB', codigo: 'IB-301', nombre: 'Doctrina cristiana', semestre: 3, horas: 48, certifica: true, prerequisito: 'IB-201' },
    { programa: 'IBIB', codigo: 'IB-302', nombre: 'Hermenéutica: cómo leer la Biblia', semestre: 3, horas: 48, certifica: true, prerequisito: 'IB-202' },
  ],
  [
    { programa: 'IBIB', codigo: 'IB-401', nombre: 'Homilética y enseñanza', semestre: 4, horas: 48, certifica: true, prerequisito: 'IB-301' },
    { programa: 'IBIB', codigo: 'IB-402', nombre: 'Historia de la iglesia', semestre: 4, horas: 48, certifica: true, prerequisito: 'IB-302' },
  ],
];

/** A qué clase de formación pertenece cada curso (decide quién se inscribe y si hay nota). */
function claseDe(curso) {
  if (curso === 'RUTA-01') return 'fundamentos';
  if (curso === 'RUTA-02') return 'bautismo';
  if (curso.startsWith('LID-')) return 'liderazgo';
  if (curso.startsWith('IB-')) return 'instituto';
  if (curso.startsWith('KID-')) return 'kids';
  if (curso === 'MAT-01') return 'matrimonios';
  if (curso === 'MAT-02') return 'novios';
  return 'finanzas';
}

/** Las clases que llevan nota final (las demás se aprueban por asistencia). */
const CALIFICA = new Set(['liderazgo', 'instituto', 'kids']);

/* Semestres del Instituto: de lunes a lunes; cada sede dicta su curso «01»
   el lunes o el martes y su curso «02» dos días después. */
const SEMESTRE = {
  '2025-2': ['2025-08-04', '2025-11-24'],
  '2026-1': ['2026-02-02', '2026-06-01'],
  '2026-2': ['2026-08-03', '2026-11-23'],
};

/*
 * El plan de cohortes por tamaño de sede. Cada entrada abre una cohorte si
 * la sede la tiene: `p` es la probabilidad; `de` encadena la promoción (solo
 * se abre si la sede abrió el nivel anterior, y la llenan quienes lo
 * aprobaron); `par` es el curso que la misma promoción ve en paralelo;
 * `abierto` deja entrar a gente nueva además de la que viene del nivel
 * anterior; `solo` limita a unas sedes; `instituto` exige el ministerio del
 * Instituto encendido en la sede. Las fechas son la base: cada sede corre
 * su calendario una semana antes o después.
 */
const PLAN = {
  grande: [
    { curso: 'RUTA-01', inicia: '2025-09-07', semanas: 6, p: 0.8 },
    { curso: 'RUTA-01', inicia: '2025-11-02', semanas: 6, p: 0.35 },
    { curso: 'RUTA-01', inicia: '2026-02-08', semanas: 6, p: 0.9 },
    { curso: 'RUTA-01', inicia: '2026-04-19', semanas: 6, p: 0.8 },
    { curso: 'RUTA-01', inicia: '2026-07-26', semanas: 6, p: 0.5 },
    { curso: 'RUTA-01', inicia: '2026-09-13', semanas: 6, p: 1 },
    { curso: 'RUTA-01', inicia: '2026-11-08', semanas: 6, p: 0.8 },
    { curso: 'RUTA-02', inicia: '2025-10-19', semanas: 4, p: 0.8 },
    { curso: 'RUTA-02', inicia: '2026-03-22', semanas: 4, p: 0.9 },
    { curso: 'RUTA-02', inicia: '2026-06-07', semanas: 4, p: 0.8 },
    { curso: 'RUTA-02', inicia: '2026-09-06', semanas: 4, p: 1 },
    { curso: 'RUTA-02', inicia: '2026-11-01', semanas: 4, p: 0.6 },
    { curso: 'LID-01', inicia: '2025-08-09', semanas: 7, promo: 'A' },
    { curso: 'LID-02', inicia: '2025-10-04', semanas: 7, promo: 'A', de: 'LID-01' },
    { curso: 'LID-03', inicia: '2026-02-07', semanas: 7, promo: 'A', de: 'LID-02' },
    { curso: 'LID-04', inicia: '2026-04-11', semanas: 7, promo: 'A', de: 'LID-03' },
    { curso: 'LID-01', inicia: '2026-08-01', semanas: 6, promo: 'C' },
    { curso: 'LID-02', inicia: '2026-10-03', semanas: 7, promo: 'C', de: 'LID-01' },
    { curso: 'IB-101', semestre: '2025-2', promo: 'A', instituto: true },
    { curso: 'IB-102', semestre: '2025-2', promo: 'A', instituto: true, par: 'IB-101' },
    { curso: 'IB-201', semestre: '2026-1', promo: 'A', instituto: true, de: 'IB-101' },
    { curso: 'IB-202', semestre: '2026-1', promo: 'A', instituto: true, de: 'IB-102' },
    { curso: 'IB-301', semestre: '2026-2', promo: 'A', instituto: true, de: 'IB-201' },
    { curso: 'IB-302', semestre: '2026-2', promo: 'A', instituto: true, de: 'IB-202' },
    { curso: 'IB-101', semestre: '2026-2', promo: 'B', instituto: true, solo: ['MED', 'CALI'] },
    { curso: 'IB-102', semestre: '2026-2', promo: 'B', instituto: true, par: 'IB-101', solo: ['MED', 'CALI'] },
    { curso: 'KID-02', inicia: '2025-10-18', semanas: 2, p: 0.3 },
    { curso: 'KID-01', inicia: '2026-02-14', semanas: 8, p: 0.9, promo: 'K' },
    { curso: 'KID-02', inicia: '2026-04-18', semanas: 2, p: 0.9, promo: 'K', de: 'KID-01', abierto: true },
    { curso: 'KID-02', inicia: '2026-08-22', semanas: 2, p: 0.7 },
    { curso: 'MAT-01', inicia: '2025-10-04', semanas: 4, p: 0.5 },
    { curso: 'MAT-01', inicia: '2026-04-11', semanas: 4, p: 0.8 },
    { curso: 'MAT-01', inicia: '2026-10-10', semanas: 4, p: 0.6 },
    { curso: 'MAT-02', inicia: '2026-03-07', semanas: 4, p: 0.7 },
    { curso: 'MAT-02', inicia: '2026-09-05', semanas: 4, p: 0.6 },
    { curso: 'FIN-01', inicia: '2026-01-24', semanas: 4, p: 0.7 },
    { curso: 'FIN-01', inicia: '2026-10-17', semanas: 4, p: 0.4 },
  ],
  mediana: [
    { curso: 'RUTA-01', inicia: '2025-10-05', semanas: 6, p: 0.6 },
    { curso: 'RUTA-01', inicia: '2026-03-01', semanas: 6, p: 0.85 },
    { curso: 'RUTA-01', inicia: '2026-06-07', semanas: 6, p: 0.6 },
    { curso: 'RUTA-01', inicia: '2026-09-06', semanas: 6, p: 1 },
    { curso: 'RUTA-01', inicia: '2026-11-15', semanas: 6, p: 0.6 },
    { curso: 'RUTA-02', inicia: '2025-11-16', semanas: 4, p: 0.5 },
    { curso: 'RUTA-02', inicia: '2026-04-19', semanas: 4, p: 0.8 },
    { curso: 'RUTA-02', inicia: '2026-07-19', semanas: 4, p: 0.6 },
    { curso: 'RUTA-02', inicia: '2026-10-18', semanas: 4, p: 0.7 },
    { curso: 'LID-01', inicia: '2026-02-07', semanas: 7, promo: 'B', p: 0.85 },
    { curso: 'LID-02', inicia: '2026-04-11', semanas: 7, promo: 'B', de: 'LID-01' },
    { curso: 'LID-03', inicia: '2026-08-01', semanas: 7, promo: 'B', de: 'LID-02' },
    { curso: 'LID-04', inicia: '2026-10-03', semanas: 7, promo: 'B', de: 'LID-03' },
    { curso: 'IB-101', semestre: '2026-1', promo: 'A', instituto: true },
    { curso: 'IB-102', semestre: '2026-1', promo: 'A', instituto: true, par: 'IB-101' },
    { curso: 'IB-201', semestre: '2026-2', promo: 'A', instituto: true, de: 'IB-101' },
    { curso: 'IB-202', semestre: '2026-2', promo: 'A', instituto: true, de: 'IB-102' },
    { curso: 'KID-02', inicia: '2026-03-07', semanas: 2, p: 0.8 },
    { curso: 'KID-01', inicia: '2026-08-15', semanas: 8, p: 0.6 },
    { curso: 'MAT-01', inicia: '2026-05-09', semanas: 4, p: 0.5 },
    { curso: 'FIN-01', inicia: '2026-01-24', semanas: 4, p: 0.4 },
  ],
  pequena: [
    { curso: 'RUTA-01', inicia: '2025-10-19', semanas: 6, p: 0.4 },
    { curso: 'RUTA-01', inicia: '2026-02-22', semanas: 6, p: 0.8 },
    { curso: 'RUTA-01', inicia: '2026-08-23', semanas: 6, p: 0.9 },
    { curso: 'RUTA-02', inicia: '2026-05-03', semanas: 4, p: 0.7 },
    { curso: 'RUTA-02', inicia: '2026-10-25', semanas: 4, p: 0.4 },
    { curso: 'LID-01', inicia: '2026-08-01', semanas: 6, promo: 'C', p: 0.4 },
    { curso: 'IB-101', semestre: '2026-1', promo: 'A', instituto: true },
    { curso: 'IB-102', semestre: '2026-1', promo: 'A', instituto: true, par: 'IB-101' },
    { curso: 'IB-201', semestre: '2026-2', promo: 'A', instituto: true, de: 'IB-101' },
    { curso: 'IB-202', semestre: '2026-2', promo: 'A', instituto: true, de: 'IB-102' },
    { curso: 'KID-02', inicia: '2026-03-14', semanas: 2, p: 0.8 },
  ],
};

/** El Instituto virtual de la red: lo dicta la sede madre, de noche, para las sedes sin Instituto propio. */
const PLAN_RED = [
  { curso: 'IB-101', semestre: '2026-1', promo: 'V', instituto: true },
  { curso: 'IB-102', semestre: '2026-1', promo: 'V', instituto: true, par: 'IB-101' },
  { curso: 'IB-201', semestre: '2026-2', promo: 'V', instituto: true, de: 'IB-101' },
  { curso: 'IB-202', semestre: '2026-2', promo: 'V', instituto: true, de: 'IB-102' },
];

/** Cuántas personas llenan una cohorte (parejas en matrimonios y novios). */
const META = {
  fundamentos: { grande: [8, 13], mediana: [5, 9], pequena: [4, 7] },
  bautismo: { grande: [5, 9], mediana: [3, 7], pequena: [3, 5] },
  liderazgo: { grande: [10, 15], mediana: [7, 10], pequena: [5, 8] },
  instituto: { grande: [14, 21], mediana: [9, 13], pequena: [7, 10], red: [14, 20] },
  kids: { grande: [8, 13], mediana: [5, 9], pequena: [4, 7] },
  matrimonios: { grande: [4, 7], mediana: [3, 5], pequena: [3, 4] },
  novios: { grande: [3, 5], mediana: [2, 4], pequena: [2, 3] },
  finanzas: { grande: [9, 14], mediana: [6, 10], pequena: [5, 8] },
};

/** Personas de referencia por tamaño: una sede más chica que su referencia llena cohortes más chicas. */
const REFERENCIA = { grande: 290, mediana: 140, pequena: 70 };

/** Cupo por clase y tamaño (null: sin cupo). */
const CUPO = {
  fundamentos: { grande: 40, mediana: 30, pequena: null },
  bautismo: { grande: null, mediana: null, pequena: null },
  liderazgo: { grande: 30, mediana: 20, pequena: 15 },
  instituto: { grande: 35, mediana: 25, pequena: 20, red: 40 },
  kids: { grande: 20, mediana: 20, pequena: 15 },
  matrimonios: { grande: 24, mediana: 16, pequena: 12 },
  novios: { grande: 12, mediana: 10, pequena: 8 },
  finanzas: { grande: 30, mediana: 25, pequena: 20 },
};

/** Valor por persona y moneda. Fundamentos, Bautismo y RocaKids son gratis: la iglesia forma a los suyos. */
const PRECIO = {
  liderazgo: { COP: 60000, USD: 40, EUR: 35 },
  instituto: { COP: 150000, USD: 90, EUR: 80 },
  matrimonios: { COP: 80000, USD: 50, EUR: 45 },
  novios: { COP: 100000, USD: 60, EUR: 55 },
  finanzas: { COP: 20000, USD: 15, EUR: 15 },
};

/* ─────────────────────────────────────────────────────────────────────
   3 · TEMÁTICAS: LAS SERIES DE LA RED
   Las predica la sede madre y las ven las 36 sedes para predicar
   alineadas. Cada enseñanza: [fecha, título, pasaje, quién, resumen].
   Quién: PP pastor principal · PPA su esposa · PPS los dos · PM y PMA la
   pareja pastoral de la sede madre · INV un pastor invitado de otra sede.
   ───────────────────────────────────────────────────────────────────── */
const SERIES_RED = [
  {
    titulo: 'La casa sobre la roca: fundamentos',
    descripcion: 'Serie de apertura del año para toda la red: qué significa edificar la vida, la familia y la iglesia sobre la roca que es Cristo.',
    inicia: '2025-09-07', termina: '2025-10-26',
    ensenanzas: [
      ['2025-09-07', 'Oír y hacer', 'Mateo 7:24-27', 'PP', 'Las dos casas oyeron la misma palabra y enfrentaron la misma tormenta. La diferencia fue poner por obra lo que se oyó.'],
      ['2025-09-14', 'Cavar hondo', 'Lucas 6:46-49', 'PP', 'Edificar sobre la roca cuesta: hay que cavar, quitar tierra y esperar. Lo que no se ve es lo que sostiene la casa.'],
      ['2025-09-21', 'Cristo, el único fundamento', '1 Corintios 3:10-15', 'PPA', 'Nadie puede poner otro fundamento. Cada uno mire cómo sobreedifica, porque la obra de cada uno será probada.'],
      ['2025-09-28', 'Piedras vivas', '1 Pedro 2:4-10', 'PM', 'No somos espectadores de la casa de Dios: somos las piedras con que se edifica.'],
      ['2025-10-05', 'Si el Señor no edifica la casa', 'Salmo 127', 'PP', 'El afán no construye nada que dure. El descanso del que confía también es parte de la obra.'],
      ['2025-10-12', 'Una familia de la fe', 'Efesios 2:19-22', 'PPA', 'Ya no somos extranjeros: somos familia, y juntos somos morada de Dios en el Espíritu.'],
      ['2025-10-19', 'Una iglesia que persevera', 'Hechos 2:42-47', 'INV', 'Enseñanza, comunión, partimiento del pan y oración: cuatro columnas de una iglesia que crece.'],
      ['2025-10-26', 'Firmes cuando llega la tormenta', 'Santiago 1:2-12', 'PP', 'La prueba no destruye la casa bien fundada: la muestra. La fe probada produce paciencia.'],
    ],
  },
  {
    titulo: 'Generosidad: el corazón que da',
    descripcion: 'Cinco domingos sobre la mayordomía: todo lo que tenemos viene de Dios, y dar es una respuesta de gratitud, no una obligación.',
    inicia: '2025-11-02', termina: '2025-11-30',
    ensenanzas: [
      ['2025-11-02', 'Todo es de Él', 'Salmo 24:1-2', 'PP', 'Antes de hablar de dar hablamos de quién es el dueño. Somos administradores, no propietarios.'],
      ['2025-11-09', 'La ofrenda de la viuda', 'Marcos 12:41-44', 'PPA', 'Jesús no midió la cantidad sino lo que quedaba después de dar.'],
      ['2025-11-16', 'Sembrar con alegría', '2 Corintios 9:6-11', 'PM', 'Dios ama al dador alegre. La generosidad es siembra, y la cosecha también es para dar.'],
      ['2025-11-23', 'Primicias', 'Proverbios 3:9-10', 'PP', 'Dar primero es una declaración de confianza: Dios va primero en el presupuesto de la casa.'],
      ['2025-11-30', 'Tesoros en el cielo', 'Mateo 6:19-24', 'PP', 'Donde está el tesoro está el corazón. Nadie puede servir a dos señores.'],
    ],
  },
  {
    titulo: 'Adviento: la luz que vino al mundo',
    descripcion: 'Serie de Navidad para toda la red: esperanza, paz, gozo y amor en la llegada de Jesús.',
    inicia: '2025-12-07', termina: '2025-12-28',
    ensenanzas: [
      ['2025-12-07', 'Esperanza: una luz en las tinieblas', 'Isaías 9:2-7', 'PP', 'El pueblo que andaba en oscuridad vio gran luz. La esperanza de Navidad es una persona.'],
      ['2025-12-14', 'Paz: el Príncipe de paz', 'Lucas 2:8-14', 'PPA', 'Los ángeles anunciaron paz a los pastores del campo: la paz de Dios llega primero a los sencillos.'],
      ['2025-12-21', 'Gozo: el cántico de María', 'Lucas 1:46-55', 'PM', 'María canta antes de ver el cumplimiento. El gozo nace de creer lo que Dios dijo.'],
      ['2025-12-24', 'La Palabra se hizo carne', 'Juan 1:1-14', 'PP', 'Servicio de Nochebuena: Dios no mandó un mensaje, vino Él mismo a habitar entre nosotros.'],
      ['2025-12-28', 'Amor: de tal manera amó Dios', 'Juan 3:16-17', 'PPS', 'Cerramos el año con el versículo que resume el evangelio: un amor que da lo más valioso.'],
    ],
  },
  {
    titulo: '21 días de ayuno y oración',
    descripcion: 'Arranque del año en toda la red: tres semanas de ayuno, oración diaria en cada sede y una enseñanza cada domingo.',
    inicia: '2026-01-11', termina: '2026-01-31',
    ensenanzas: [
      ['2026-01-11', 'Cuando ayunes', 'Mateo 6:16-18', 'PP', 'Jesús dijo cuando, no si. El ayuno es un secreto entre el Padre y el hijo.'],
      ['2026-01-18', 'El ayuno que agrada a Dios', 'Isaías 58:6-12', 'PPA', 'Un ayuno que desata ligaduras, comparte el pan y abre la casa al que no tiene.'],
      ['2026-01-25', 'Orar sin desmayar', 'Lucas 18:1-8', 'PP', 'La viuda insistente enseña que la oración perseverante no cansa a Dios: nos forma a nosotros.'],
    ],
  },
  {
    titulo: 'Hechos: una iglesia en movimiento',
    descripcion: 'Un recorrido por el libro de los Hechos: cómo nació la iglesia, cómo creció y cómo salió de Jerusalén hasta lo último de la tierra.',
    inicia: '2026-02-08', termina: '2026-03-22',
    ensenanzas: [
      ['2026-02-08', 'Esperen la promesa', 'Hechos 1:4-8', 'PP', 'Antes de salir, esperar. El poder para ser testigos no se fabrica: se recibe.'],
      ['2026-02-15', 'El día que llegó el Espíritu', 'Hechos 2:1-13', 'PPA', 'Lenguas de fuego y un mensaje que cada uno oyó en su idioma: el evangelio es para todas las naciones.'],
      ['2026-02-22', 'Lo que tengo te doy', 'Hechos 3:1-10', 'PM', 'Pedro no tenía plata ni oro, pero tenía a Jesús. La iglesia da lo que ha recibido.'],
      ['2026-03-01', 'No podemos dejar de hablar', 'Hechos 4:13-31', 'PP', 'Gente sin letras, pero que había estado con Jesús. La valentía nace de la oración.'],
      ['2026-03-08', 'Esteban, lleno de gracia', 'Hechos 6:8-15; 7:54-60', 'PMA', 'Un servidor de las mesas que predicó con el rostro de un ángel y perdonó al morir.'],
      ['2026-03-15', 'Felipe y el etíope', 'Hechos 8:26-40', 'PP', 'Un evangelista que obedece sin preguntar a dónde va, y un hombre que vuelve gozoso a su tierra.'],
      ['2026-03-22', 'De perseguidor a apóstol', 'Hechos 9:1-19', 'INV', 'Nadie está demasiado lejos: el que perseguía a la iglesia termina edificándola.'],
    ],
  },
  {
    titulo: 'Semana Santa: la cruz y la tumba vacía',
    descripcion: 'Domingo de Ramos, Viernes Santo y Domingo de Resurrección en toda la red.',
    inicia: '2026-03-29', termina: '2026-04-05',
    ensenanzas: [
      ['2026-03-29', 'El Rey que entra humilde', 'Mateo 21:1-11', 'PP', 'Jesús entra en Jerusalén montado en un asno: un Rey que viene a servir y a dar su vida.'],
      ['2026-04-03', 'Consumado es', 'Juan 19:28-30', 'PP', 'Servicio de Viernes Santo: la obra que nos salva está terminada, no falta nada por pagar.'],
      ['2026-04-05', 'No está aquí, ha resucitado', 'Mateo 28:1-10', 'PPS', 'La tumba vacía cambia el miedo por gozo. Id pronto y decid: ha resucitado.'],
    ],
  },
  {
    titulo: 'Familias sobre la Roca',
    descripcion: 'Ocho domingos para el hogar: el matrimonio, la crianza, el perdón y la fe que se hereda.',
    inicia: '2026-04-12', termina: '2026-05-31',
    ensenanzas: [
      ['2026-04-12', 'El diseño de Dios para la familia', 'Génesis 2:18-24', 'PP', 'No es bueno que el hombre esté solo. La familia es idea de Dios antes que de la sociedad.'],
      ['2026-04-19', 'Amor que se entrega', 'Efesios 5:21-33', 'PPS', 'Someterse unos a otros en el temor de Dios: el matrimonio como reflejo de Cristo y su iglesia.'],
      ['2026-04-26', 'Hijos y padres', 'Efesios 6:1-4', 'PPA', 'Honrar a los padres y no provocar a ira a los hijos: dos mandatos que se sostienen juntos.'],
      ['2026-05-03', 'Perdonar en casa', 'Colosenses 3:12-15', 'PM', 'Soportarse y perdonarse: el hogar es el primer lugar donde se practica el evangelio.'],
      ['2026-05-10', 'Madres que siembran fe', '2 Timoteo 1:3-7', 'PPA', 'Domingo de la madre: la fe de Loida y de Eunice llegó a Timoteo. La fe se hereda en casa.'],
      ['2026-05-17', 'Instruye al niño', 'Proverbios 22:6', 'PMA', 'Formar no es solo corregir: es mostrar el camino caminándolo primero.'],
      ['2026-05-24', 'La promesa es para tus hijos', 'Hechos 2:1-4, 38-39', 'PP', 'Domingo de Pentecostés: la promesa del Espíritu es para ustedes y para sus hijos.'],
      ['2026-05-31', 'Yo y mi casa serviremos al Señor', 'Josué 24:14-15', 'PPS', 'Una decisión que se toma cada día y en voz alta: esta casa sirve al Señor.'],
    ],
  },
  {
    titulo: 'El fruto del Espíritu',
    descripcion: 'Gálatas 5:22-23, una virtud por domingo: el carácter que el Espíritu forma en quien camina con Él.',
    inicia: '2026-06-07', termina: '2026-07-26',
    ensenanzas: [
      ['2026-06-07', 'Amor, el primero del fruto', '1 Corintios 13:1-7', 'PP', 'Sin amor, todo lo demás es ruido. El amor es paciente, es bondadoso y no busca lo suyo.'],
      ['2026-06-14', 'Gozo que no depende de las circunstancias', 'Filipenses 4:4-7', 'PPA', 'Pablo escribe desde la cárcel: regocijaos. El gozo es fruto, no emoción.'],
      ['2026-06-21', 'Paz en medio de la tormenta', 'Juan 14:27', 'PM', 'Domingo del padre: la paz que Jesús da no es como la que da el mundo.'],
      ['2026-06-28', 'Paciencia: el arte de esperar', 'Santiago 5:7-11', 'PP', 'El labrador espera la lluvia temprana y la tardía. Esperar también es obedecer.'],
      ['2026-07-05', 'Benignidad: la bondad en acción', 'Lucas 10:30-37', 'INV', 'El samaritano no preguntó quién era su prójimo: se hizo prójimo del herido.'],
      ['2026-07-12', 'Fe y fidelidad en lo poco', 'Lucas 16:10-12', 'PMA', 'El que es fiel en lo muy poco también en lo más es fiel.'],
      ['2026-07-19', 'Mansedumbre: fuerza bajo control', 'Mateo 11:28-30', 'PP', 'Jesús, manso y humilde de corazón, ofrece descanso. La mansedumbre no es debilidad.'],
      ['2026-07-26', 'Dominio propio', 'Proverbios 25:28', 'PPA', 'Una ciudad sin muro queda expuesta. El dominio propio guarda lo que Dios nos confió.'],
    ],
  },
  {
    titulo: 'Nehemías: reconstruir los muros',
    descripcion: 'Diez domingos con Nehemías: orar, planear y edificar juntos lo que estaba en ruinas. Cada sede aplica la serie a su propia ciudad.',
    inicia: '2026-08-02', termina: '2026-10-04',
    ensenanzas: [
      ['2026-08-02', 'Cuando se nos rompe el corazón por la ciudad', 'Nehemías 1:1-11', 'PP', 'Nehemías lloró, ayunó y oró antes de hacer cualquier plan. Toda reconstrucción empieza de rodillas.'],
      ['2026-08-09', 'Orar y actuar', 'Nehemías 2:1-10', 'PPA', 'Una oración breve delante del rey y años de preparación detrás. Dios usa al que está listo.'],
      ['2026-08-16', 'Levantémonos y edifiquemos', 'Nehemías 2:11-20', 'PP', 'Primero ver las ruinas de cerca, después convocar. La visión se comparte, no se impone.'],
      ['2026-08-23', 'Cada uno frente a su casa', 'Nehemías 3:1-32', 'PM', 'Sacerdotes, orfebres y perfumeros edificaron el tramo que tenían delante. Nadie hace todo; todos hacen algo.'],
      ['2026-08-30', 'Con una mano en la obra', 'Nehemías 4:1-23', 'PP', 'Con una mano trabajaban y con la otra sostenían la espada. La oposición no detiene lo que Dios manda edificar.'],
      ['2026-09-06', 'Justicia dentro de los muros', 'Nehemías 5:1-19', 'PPA', 'Antes de terminar el muro, Nehemías corrigió la injusticia entre hermanos. La casa se cuida por dentro.'],
      ['2026-09-13', 'No bajaré', 'Nehemías 6:1-16', 'INV', 'Estoy haciendo una gran obra y no puedo ir. Enfocarse también es obedecer.'],
      ['2026-09-20', 'El gozo del Señor es nuestra fuerza', 'Nehemías 8:1-12', 'PP', 'El pueblo lloró al oír la ley y Nehemías les dijo: no os entristezcáis. La Palabra restaura el gozo.'],
    ],
  },
  {
    titulo: 'Esperanza viva: la primera carta de Pedro',
    descripcion: 'Serie para el cierre del año: una esperanza viva para tiempos de prueba, escrita a una iglesia dispersa.',
    inicia: '2026-10-11', termina: '2026-11-29',
    ensenanzas: [],
  },
];

/* ─────────────────────────────────────────────────────────────────────
   4 · TEMÁTICAS: LAS SERIES PROPIAS DE CADA SEDE
   Material de la red que cada sede escoge para el estudio de los
   miércoles, los sábados de tMt, el encuentro mensual de Mujer Integral y
   el desayuno de Hombres Bien. Cada enseñanza: [título, pasaje, resumen].
   ───────────────────────────────────────────────────────────────────── */
const TEMAS_MIERCOLES = [
  { titulo: 'Efesios: la iglesia que Dios diseñó', descripcion: 'Estudio bíblico de los miércoles: un capítulo de Efesios por semana.', ensenanzas: [
    ['Bendecidos en Cristo', 'Efesios 1:3-14', 'Antes de pedirnos algo, Pablo nos recuerda todo lo que ya recibimos en Cristo.'],
    ['De muerte a vida', 'Efesios 2:1-10', 'Salvos por gracia, por medio de la fe, para buenas obras que Dios preparó de antemano.'],
    ['El misterio revelado', 'Efesios 3:1-13', 'Judíos y gentiles, un solo cuerpo: la iglesia muestra la sabiduría de Dios.'],
    ['Andar como es digno', 'Efesios 4:1-16', 'Unidad, dones y madurez: cada miembro aporta para que el cuerpo crezca.'],
    ['Imitadores de Dios', 'Efesios 5:1-20', 'Andar en amor, en luz y en sabiduría, aprovechando bien el tiempo.'],
    ['La armadura de Dios', 'Efesios 6:10-20', 'La batalla es espiritual y la armadura ya fue provista: hay que ponérsela.'],
  ] },
  { titulo: 'Filipenses: gozo en todo tiempo', descripcion: 'Estudio bíblico de los miércoles sobre la carta del gozo, escrita desde la cárcel.', ensenanzas: [
    ['El que comenzó la buena obra', 'Filipenses 1:1-11', 'Dios termina lo que empieza. La confianza de Pablo no está en la iglesia sino en quien la sostiene.'],
    ['El mismo sentir de Cristo', 'Filipenses 2:1-11', 'Jesús se despojó a sí mismo. La humildad es el camino del reino.'],
    ['Prosigo a la meta', 'Filipenses 3:7-14', 'Olvidar lo que queda atrás y extenderse a lo que está delante.'],
    ['Todo lo puedo en Cristo', 'Filipenses 4:10-20', 'Contentarse en la escasez y en la abundancia: el secreto está en quien fortalece.'],
  ] },
  { titulo: 'Salmos para el alma', descripcion: 'Estudio de los miércoles: seis salmos para orar en cada etapa de la vida.', ensenanzas: [
    ['El Señor es mi pastor', 'Salmo 23', 'Un salmo para cada etapa: pastos delicados, valles de sombra y una mesa servida.'],
    ['Espera en Dios', 'Salmo 42', 'Cuando el alma está abatida, el salmista se habla a sí mismo y vuelve a esperar.'],
    ['Crea en mí un corazón limpio', 'Salmo 51', 'La oración de David después de su pecado: arrepentimiento sin excusas y restauración.'],
    ['Al abrigo del Altísimo', 'Salmo 91', 'Un refugio para los días de miedo: Dios cubre con sus plumas.'],
    ['Bendice, alma mía', 'Salmo 103', 'No olvidar ninguno de sus beneficios: la gratitud es memoria.'],
    ['Alzaré mis ojos a los montes', 'Salmo 121', 'El socorro viene del Señor, que no se duerme ni se cansa.'],
  ] },
  { titulo: 'Proverbios: sabiduría para la vida diaria', descripcion: 'Estudio de los miércoles: lo que Proverbios enseña sobre el trabajo, las palabras y el corazón.', ensenanzas: [
    ['El principio de la sabiduría', 'Proverbios 1:1-7', 'El temor del Señor es el comienzo: la sabiduría se recibe antes de aplicarse.'],
    ['Fíate del Señor', 'Proverbios 3:1-12', 'No apoyarse en la propia prudencia y reconocerlo en todos los caminos.'],
    ['Guarda tu corazón', 'Proverbios 4:20-27', 'De él mana la vida: lo que se guarda adentro se ve afuera.'],
    ['El poder de las palabras', 'Proverbios 18:20-21', 'La muerte y la vida están en poder de la lengua.'],
    ['Aprender de la hormiga', 'Proverbios 6:6-11', 'Diligencia, previsión y ahorro: la sabiduría también se ve en el trabajo.'],
    ['La mujer virtuosa', 'Proverbios 31:10-31', 'Un retrato de carácter, trabajo y temor de Dios que honra a toda la casa.'],
  ] },
  { titulo: 'Juan: los siete «Yo soy»', descripcion: 'Estudio de los miércoles en el Evangelio de Juan: quién dijo Jesús que era.', ensenanzas: [
    ['Yo soy el pan de vida', 'Juan 6:35', 'Jesús sacia un hambre que el pan no alcanza.'],
    ['Yo soy la luz del mundo', 'Juan 8:12', 'El que le sigue no andará en tinieblas.'],
    ['Yo soy la puerta', 'Juan 10:7-10', 'Entrar por Él es encontrar pastos y vida en abundancia.'],
    ['Yo soy el buen pastor', 'Juan 10:11-18', 'Un pastor que conoce a sus ovejas por nombre y da la vida por ellas.'],
    ['Yo soy la resurrección y la vida', 'Juan 11:25-26', 'Frente a la tumba de Lázaro, Jesús cambia la pregunta: ¿crees esto?'],
    ['Yo soy el camino, la verdad y la vida', 'Juan 14:6', 'No un camino entre muchos: el camino al Padre.'],
    ['Yo soy la vid verdadera', 'Juan 15:1-8', 'Permanecer en Él es la única forma de dar fruto.'],
  ] },
  { titulo: 'Las parábolas del Reino', descripcion: 'Estudio de los miércoles: las historias con que Jesús explicó el Reino.', ensenanzas: [
    ['El sembrador', 'Mateo 13:1-23', 'La misma semilla en cuatro terrenos: el fruto depende de cómo se recibe la Palabra.'],
    ['La semilla de mostaza', 'Mateo 13:31-32', 'El Reino empieza pequeño y crece más allá de lo que se imagina.'],
    ['El tesoro escondido', 'Mateo 13:44-46', 'Quien lo encuentra lo vende todo con gozo: el Reino vale más que todo.'],
    ['La oveja perdida', 'Lucas 15:1-7', 'Hay más gozo en el cielo por uno que vuelve que por noventa y nueve seguros.'],
    ['El hijo pródigo', 'Lucas 15:11-32', 'Un padre que corre al encuentro y un hermano mayor que no quiere entrar a la fiesta.'],
    ['Los talentos', 'Mateo 25:14-30', 'Lo que se recibe se multiplica al invertirlo: el miedo entierra el talento.'],
  ] },
  { titulo: 'Santiago: una fe que se ve', descripcion: 'Estudio de los miércoles en la carta de Santiago: la fe que se nota en las obras y en las palabras.', ensenanzas: [
    ['Pruebas que producen paciencia', 'Santiago 1:2-8', 'Tener por sumo gozo las pruebas: la fe probada madura.'],
    ['Hacedores de la palabra', 'Santiago 1:19-27', 'Oír sin hacer es engañarse a sí mismo.'],
    ['Sin acepción de personas', 'Santiago 2:1-13', 'En la iglesia no hay sillas de primera y de segunda.'],
    ['La fe sin obras', 'Santiago 2:14-26', 'Una fe que no se mueve hacia el necesitado está muerta.'],
    ['Domar la lengua', 'Santiago 3:1-12', 'Un miembro pequeño que puede incendiar un bosque.'],
  ] },
  { titulo: 'José: del pozo al palacio', descripcion: 'Estudio de los miércoles en la vida de José: la providencia de Dios en la traición, la espera y el perdón.', ensenanzas: [
    ['Los sueños de José', 'Génesis 37:1-11', 'Un sueño de Dios en un corazón joven, y una familia que no lo entiende.'],
    ['Vendido por sus hermanos', 'Génesis 37:12-36', 'La traición no saca a José de los planes de Dios.'],
    ['Íntegro en casa de Potifar', 'Génesis 39:1-23', 'José huye de la tentación y termina en la cárcel, pero el Señor estaba con él.'],
    ['Olvidado en la cárcel', 'Génesis 40:1-23', 'Dos años de espera después de ayudar a otro: Dios no olvida.'],
    ['Del calabozo al palacio', 'Génesis 41:37-57', 'En un solo día José pasa de preso a gobernador: la espera tenía propósito.'],
    ['Vosotros pensasteis mal', 'Génesis 50:15-21', 'José perdona a sus hermanos: Dios encaminó a bien lo que otros hicieron para mal.'],
  ] },
  { titulo: 'David: un corazón conforme a Dios', descripcion: 'Estudio de los miércoles en la vida de David: unción, valentía, amistad, caída y restauración.', ensenanzas: [
    ['Ungido en el campo', '1 Samuel 16:1-13', 'Dios mira el corazón: el menor de la casa, cuidando ovejas, es el elegido.'],
    ['Frente al gigante', '1 Samuel 17:32-50', 'David no confió en la armadura de Saúl sino en el nombre del Señor.'],
    ['Amistad y pacto', '1 Samuel 18:1-4', 'Jonatán y David: una amistad que protege el llamado del otro.'],
    ['No tocaré al ungido', '1 Samuel 24:1-12', 'David tuvo a Saúl a su alcance y decidió esperar el tiempo de Dios.'],
    ['Caída y restauración', '2 Samuel 12:1-13', 'El profeta confronta, el rey confiesa: Dios restaura al que se humilla.'],
  ] },
  { titulo: 'Rut: redención y lealtad', descripcion: 'Estudio de los miércoles en el libro de Rut: una historia pequeña que termina en la genealogía de Jesús.', ensenanzas: [
    ['Tiempos de hambre', 'Rut 1:1-5', 'Una familia sale de Belén buscando pan y encuentra pérdida.'],
    ['Tu Dios será mi Dios', 'Rut 1:6-22', 'Rut elige quedarse: la lealtad abre la puerta a la gracia.'],
    ['Espigando en el campo de Booz', 'Rut 2:1-23', 'La providencia de Dios se ve en lo cotidiano: un campo, una cosecha, un encuentro.'],
    ['El redentor', 'Rut 4:1-17', 'Booz rescata la herencia: una historia que termina en David y apunta a Cristo.'],
  ] },
  { titulo: 'Romanos: el evangelio de la gracia', descripcion: 'Estudio de los miércoles en Romanos: qué es el evangelio y cómo cambia la vida.', ensenanzas: [
    ['No me avergüenzo del evangelio', 'Romanos 1:16-17', 'El evangelio es poder de Dios para salvación a todo aquel que cree.'],
    ['Todos pecaron', 'Romanos 3:21-26', 'Nadie queda por fuera: todos necesitamos la justicia que viene por la fe.'],
    ['Justificados por la fe', 'Romanos 5:1-11', 'Tenemos paz para con Dios: la reconciliación ya ocurrió.'],
    ['Muertos al pecado, vivos para Dios', 'Romanos 6:1-14', 'El bautismo cuenta una historia: morimos con Cristo y resucitamos con Él.'],
    ['Ninguna condenación', 'Romanos 8:1-17', 'El Espíritu da vida y testifica que somos hijos de Dios.'],
    ['Nada nos separará', 'Romanos 8:31-39', 'Si Dios es por nosotros, ¿quién contra nosotros?'],
  ] },
  { titulo: 'Jonás: el Dios de las segundas oportunidades', descripcion: 'Estudio de los miércoles en Jonás: un profeta que huye y un Dios que no se rinde.', ensenanzas: [
    ['Huir de Dios', 'Jonás 1:1-17', 'Jonás bajó a Jope, bajó al barco, bajó al mar: huir siempre es bajar.'],
    ['Una oración desde el fondo', 'Jonás 2:1-10', 'Desde el vientre del pez Jonás recuerda que la salvación es del Señor.'],
    ['La segunda vez', 'Jonás 3:1-10', 'Dios habla otra vez, y una ciudad entera se arrepiente.'],
    ['El enojo del profeta', 'Jonás 4:1-11', 'Dios cuida a Nínive y le pregunta a Jonás si tiene razón para enojarse.'],
  ] },
  { titulo: 'Enséñanos a orar', descripcion: 'Estudio de los miércoles sobre la oración: lo que Jesús enseñó y lo que la iglesia practicó.', ensenanzas: [
    ['Padre nuestro', 'Mateo 6:9-13', 'La oración modelo empieza con una relación: Padre.'],
    ['Orar en lo secreto', 'Mateo 6:5-8', 'La oración no es espectáculo: el Padre ve en lo secreto.'],
    ['Pedid, buscad, llamad', 'Lucas 11:5-13', 'Insistir no es desconfiar: es conocer al Padre que da buenas cosas.'],
    ['Orar juntos', 'Hechos 12:5-17', 'La iglesia oraba sin cesar por Pedro, y la puerta de la cárcel se abrió.'],
    ['No se haga mi voluntad', 'Lucas 22:39-46', 'La oración más difícil en Getsemaní: rendir la voluntad al Padre.'],
  ] },
  { titulo: 'El Sermón del monte', descripcion: 'Estudio de los miércoles en Mateo 5 a 7: la vida del Reino según Jesús.', ensenanzas: [
    ['Las bienaventuranzas', 'Mateo 5:1-12', 'Jesús llama dichosos a los que el mundo pasaría por alto.'],
    ['Sal y luz', 'Mateo 5:13-16', 'La iglesia no existe para esconderse: da sabor y alumbra.'],
    ['Más allá de la letra', 'Mateo 5:21-37', 'Jesús lleva la ley al corazón: el enojo, la mirada y la palabra dada.'],
    ['Amar a los enemigos', 'Mateo 5:38-48', 'Orar por los que persiguen: así se parecen los hijos al Padre.'],
    ['No os afanéis', 'Mateo 6:25-34', 'Buscar primero el Reino: el Padre sabe lo que necesitamos.'],
    ['La regla de oro', 'Mateo 7:7-12', 'Tratar a otros como queremos ser tratados resume la ley y los profetas.'],
  ] },
  { titulo: 'Gálatas: libres en Cristo', descripcion: 'Estudio de los miércoles en Gálatas: la gracia que libera y el amor que sirve.', ensenanzas: [
    ['No hay otro evangelio', 'Gálatas 1:6-10', 'Pablo defiende la gracia: al evangelio no se le puede añadir nada.'],
    ['Crucificado con Cristo', 'Gálatas 2:15-21', 'Ya no vivo yo, mas vive Cristo en mí.'],
    ['Hijos y herederos', 'Gálatas 4:1-7', 'Ya no esclavos sino hijos: la fe nos hace herederos.'],
    ['Firmes en la libertad', 'Gálatas 5:1-15', 'Libres para servirnos por amor, no para volver al yugo.'],
    ['Sobrellevad los unos las cargas', 'Gálatas 6:1-10', 'Restaurar con mansedumbre y no cansarse de hacer el bien.'],
  ] },
  { titulo: 'Hebreos: una fe que persevera', descripcion: 'Estudio de los miércoles en Hebreos: Cristo, mejor que todo, y una fe que no se rinde.', ensenanzas: [
    ['Dios nos ha hablado por el Hijo', 'Hebreos 1:1-4', 'Jesús es la palabra final de Dios, superior a ángeles y profetas.'],
    ['Un sumo sacerdote que nos entiende', 'Hebreos 4:14-16', 'Acerquémonos confiadamente: Él fue tentado en todo y no pecó.'],
    ['La fe es la certeza', 'Hebreos 11:1-6', 'Sin fe es imposible agradar a Dios: creer que Él existe y que recompensa.'],
    ['Una gran nube de testigos', 'Hebreos 12:1-3', 'Correr con paciencia puestos los ojos en Jesús.'],
    ['Jesucristo es el mismo', 'Hebreos 13:1-8', 'Ayer, hoy y por los siglos: la constancia de Cristo sostiene la nuestra.'],
  ] },
];

const TEMAS_TMT = [
  { titulo: 'tMt: identidad', descripcion: 'Serie de los sábados de tMt: quiénes somos en Cristo y para qué fuimos hechos.', ensenanzas: [
    ['¿Quién dice Dios que eres?', 'Efesios 2:10', 'Somos hechura suya: la identidad no se gana, se recibe.'],
    ['Hechos a su imagen', 'Génesis 1:26-28', 'Nuestro valor no depende de los seguidores ni de las notas: viene de quien nos creó.'],
    ['Hijos, no huérfanos', 'Romanos 8:14-17', 'El Espíritu nos hace clamar Abba, Padre. Ya no vivimos con miedo.'],
    ['Una generación escogida', '1 Pedro 2:9-10', 'Linaje escogido para anunciar sus virtudes en el colegio, en la universidad y en la casa.'],
    ['No te conformes', 'Romanos 12:1-2', 'Transformados por la renovación del entendimiento, no moldeados por el mundo.'],
  ] },
  { titulo: 'tMt: decisiones que marcan', descripcion: 'Serie de los sábados de tMt sobre las decisiones que definen una vida: amistades, pureza y propósito.', ensenanzas: [
    ['Daniel propuso en su corazón', 'Daniel 1:8-16', 'Decidir antes de la presión: Daniel ya sabía qué no iba a hacer.'],
    ['Amistades que suman', 'Proverbios 13:20', 'El que anda con sabios será sabio. Las amistades trazan el rumbo.'],
    ['Pureza en un mundo de pantallas', 'Salmo 119:9-11', 'Guardar la Palabra en el corazón para no pecar.'],
    ['Tu propósito empieza hoy', 'Jeremías 1:4-10', 'No digas soy muy joven: Dios llama y envía desde ahora.'],
  ] },
];

const TEMA_MUJERES = { titulo: 'Mujeres de la Biblia', descripcion: 'Encuentro mensual de Mujer Integral: la fe de mujeres que marcaron la historia de Dios.', ensenanzas: [
  ['Ana: la oración que cambió su historia', '1 Samuel 1:9-20', 'Ana derramó su alma delante del Señor y salió con el rostro cambiado.'],
  ['Rut: lealtad que abre caminos', 'Rut 1:14-18', 'Donde tú vayas, iré yo: una extranjera que entra en la genealogía de Jesús.'],
  ['Ester: para esta hora', 'Ester 4:12-17', 'Una reina que arriesga su vida por su pueblo después de ayunar.'],
  ['Débora: liderazgo con sabiduría', 'Jueces 4:4-10', 'Una jueza que escuchaba a Dios y animaba a otros a obedecer.'],
  ['María de Betania: la buena parte', 'Lucas 10:38-42', 'A los pies de Jesús, lo necesario se vuelve claro.'],
  ['Priscila: una casa abierta', 'Hechos 18:1-4, 24-26', 'Con su esposo enseñó, sirvió y abrió su casa a la iglesia.'],
] };

const TEMA_HOMBRES = { titulo: 'Hombres de palabra', descripcion: 'Desayuno mensual de Hombres Bien: el carácter de hombres que caminaron con Dios.', ensenanzas: [
  ['Abraham: salir sin saber a dónde', 'Hebreos 11:8-10', 'La fe de un padre que obedece y deja un legado.'],
  ['José de Nazaret: un hombre justo', 'Mateo 1:18-25', 'Proteger, obedecer y cuidar en silencio: el padre terrenal de Jesús.'],
  ['Josué: esfuérzate y sé valiente', 'Josué 1:6-9', 'El valor que Dios pide viene de meditar su Palabra de día y de noche.'],
  ['Daniel: fiel en Babilonia', 'Daniel 6:10-23', 'Oraba tres veces al día, con la ventana abierta, aunque le costara.'],
  ['Pedro: restaurado para servir', 'Juan 21:15-19', 'Tres preguntas junto al fuego y un encargo: apacienta mis ovejas.'],
] };

const TEMA_PLANTACION = { titulo: 'Una iglesia que nace', descripcion: 'Serie de arranque de la plantación: qué es una iglesia y cómo crece en una ciudad nueva.', ensenanzas: [
  ['Lo que Dios empezó en Jerusalén', 'Hechos 2:37-41', 'Una iglesia nace cuando la Palabra se predica y la gente responde.'],
  ['Casa por casa', 'Hechos 2:46-47', 'Partían el pan en las casas: la iglesia crece alrededor de la mesa.'],
  ['Siervos para la ciudad', 'Jeremías 29:4-7', 'Procurad la paz de la ciudad: la iglesia existe también para sus vecinos.'],
  ['Unos a otros', 'Romanos 12:9-16', 'Amor sin fingimiento y hospitalidad: la marca de una comunidad nueva.'],
  ['Sembradores', '1 Corintios 3:5-9', 'Uno planta, otro riega, pero Dios da el crecimiento.'],
] };

/* ─────────────────────────────────────────────────────────────────────
   5 · CALENDARIO: MOTIVOS DE CANCELACIÓN
   Lo que de verdad cancela un evento en una iglesia. La base exige que un
   evento cancelado diga por qué.
   ───────────────────────────────────────────────────────────────────── */
const MOTIVO_PUENTE = 'Coincidió con el puente festivo y casi nadie confirmó asistencia.';
const MOTIVOS_CANCELACION = [
  'Alerta por lluvias fuertes en la ciudad: se pidió a las familias no salir.',
  'El salón no estuvo disponible por una asamblea del conjunto vecino.',
  'Calamidad familiar del pastor; se pasa para el mes siguiente.',
  'Corte de energía programado en el sector toda la tarde.',
  'Se unió con la reunión del mes siguiente por la agenda de la sede.',
  'El equipo de sonido estaba en reparación y no se pudo alquilar otro.',
];
const MOTIVOS_RETIRO = [
  'La finca canceló la reserva a última hora.',
  'No se alcanzó el mínimo de inscritos para pagar el transporte.',
];
const MOTIVOS_FUTUROS = [
  'La finca no confirmó la reserva; se busca otra fecha antes de fin de año.',
  'Se cruza con la conferencia anual de la red y se pasa para noviembre.',
  'El auditorio estará en obra esas semanas; se reprograma cuando termine.',
];

/* Festivos de Colombia de 2025 (la semilla 022 los trae desde 2026): un puente es un lunes festivo. */
const FESTIVOS_2025 = ['2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25'];

/* ─────────────────────────────────────────────────────────────────────
   6 · AYUDAS
   ───────────────────────────────────────────────────────────────────── */

/** El primer día `dia` (0 domingo … 6 sábado) en o después de `fecha`. */
const siguiente = (fecha, dia) => sumarDias(fecha, (7 + dia - diaSemana(fecha)) % 7);
/** El último día `dia` en o antes de `fecha`. */
const anterior = (fecha, dia) => sumarDias(fecha, -((7 + diaSemana(fecha) - dia) % 7));
const dosDigitos = (n) => String(n).padStart(2, '0');

/** El n-ésimo `dia` del mes (n = 1…4) o el último (n = -1). */
function enesimo(anio, mes, dia, n) {
  const primero = `${anio}-${dosDigitos(mes)}-01`;
  if (n > 0) return sumarDias(siguiente(primero, dia), 7 * (n - 1));
  return anterior(sumarDias(sumarMeses(primero, 1), -1), dia);
}

/** Meses [año, mes] entre dos fechas, incluidos los extremos. */
function mesesEntre(desde, hasta) {
  const salida = [];
  let [y, m] = desde.split('-').map(Number);
  const [y2, m2] = hasta.split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) {
    salida.push([y, m]);
    if (++m > 12) { m = 1; y++; }
  }
  return salida;
}

/** pasada · actual · proxima, frente al 21 de septiembre de 2026. */
function faseDe(inicia, termina) {
  if (termina && termina < HOY) return 'pasada';
  if (inicia > HOY) return 'proxima';
  return 'actual';
}

const r1 = (x) => Math.round(x * 10) / 10;
const redondearA = (x, paso) => Math.round(x / paso) * paso;
const nombreDe = (p) => `${p.primer_nombre} ${p.primer_apellido}`;
const tratamiento = (p) => `${p.genero === 'F' ? 'Pastora' : 'Pastor'} ${nombreDe(p)}`;

/** Una muestra ponderada sin reemplazo (determinista con el azar dado). */
function muestraPonderada(az, items, peso, n) {
  const pool = [];
  for (const x of items) { const w = peso(x); if (w > 0) pool.push({ x, w }); }
  const salida = [];
  while (salida.length < n && pool.length) {
    let total = 0;
    for (const o of pool) total += o.w;
    let r = az.siguiente() * total, i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r < 0) break; }
    salida.push(pool[i].x);
    pool.splice(i, 1);
  }
  return salida;
}

/** Agrupa filas por autor y escribe cada grupo con su contexto fijado, como
    lo haría la API una petición a la vez. autor null = sin sesión (migración). */
async function porAutor(c, items, motivo, escribir) {
  const grupos = new Map();
  for (const it of items) {
    const k = it.autor ? it.autor.persona_id : '';
    if (!grupos.has(k)) grupos.set(k, { autor: it.autor, filas: [] });
    grupos.get(k).filas.push(it.fila);
  }
  for (const { autor, filas } of grupos.values()) {
    await fijarAutor(c, autor ? { ...autor, motivo } : { persona_id: null, motivo: MOTIVO_MIGRACION });
    await escribir(filas);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   7 · EL CONTEXTO: SEDES, CARGOS Y GENTE
   ───────────────────────────────────────────────────────────────────── */
async function prepararContexto(c) {
  const sedes = await d.sedes(c);
  const porCodigo = new Map(sedes.map(s => [s.codigo, s]));

  /* Todos los cargos de sede con su vigencia (también los que ya vencieron):
     quien registró algo en marzo es quien tenía el cargo en marzo. */
  const { rows: cargos } = await c.query(
    `SELECT a.rol, a.persona_id, a.alcance_id AS sede_id, to_char(a.vigente_desde, 'YYYY-MM-DD') AS desde,
            to_char(LEAST(a.vigente_hasta, a.revocada_en::date), 'YYYY-MM-DD') AS hasta,
            p.genero::text AS genero, p.primer_nombre, p.primer_apellido
       FROM identidad.asignaciones a JOIN nucleo.personas p ON p.id = a.persona_id
      WHERE a.alcance_tipo = 'sede' AND a.rol IN ('PASTOR_CONGREGACIONAL', 'SECRETARIA', 'COORDINADOR_NUEVOS')
      ORDER BY a.alcance_id, a.rol, a.vigente_desde, p.genero DESC, a.persona_id`);
  const roles = new Map();
  for (const r of cargos) {
    const k = `${r.sede_id}|${r.rol}`;
    if (!roles.has(k)) roles.set(k, []);
    roles.get(k).push(r);
  }

  /* La gente: activos e inactivos, con sus membresías (en qué sede estaba
     cada quien y desde cuándo), su cónyuge y su bautismo. */
  const { rows: gente } = await c.query(
    `SELECT p.id, p.sede_id, p.primer_nombre, p.primer_apellido, p.genero::text AS genero,
            to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fnac, p.estado::text AS estado,
            p.nivel_compromiso AS nivel, p.estado_civil, COALESCE(p.ha_sido_bautizado, false) AS bautizado,
            to_char(p.fecha_bautismo, 'YYYY-MM-DD') AS fbau,
            (SELECT v.relacionada_id FROM nucleo.vinculos v
              WHERE v.persona_id = p.id AND v.tipo = 'CONYUGE' AND v.vigente_hasta IS NULL
              ORDER BY v.relacionada_id LIMIT 1) AS conyuge,
            (SELECT hm.hogar_id FROM grupos.hogar_miembros hm
              WHERE hm.persona_id = p.id AND hm.hasta IS NULL LIMIT 1) AS hogar,
            COALESCE((SELECT json_agg(json_build_object('sede', m.sede_id, 'desde', to_char(m.desde, 'YYYY-MM-DD'),
                                                        'hasta', to_char(m.hasta, 'YYYY-MM-DD')) ORDER BY m.desde, m.sede_id)
                        FROM nucleo.membresias_sede m
                       WHERE m.persona_id = p.id AND m.tipo <> 'en_traslado' AND m.desde IS NOT NULL), '[]') AS membresias
       FROM nucleo.personas p
      WHERE p.eliminado_en IS NULL AND p.estado::text IN ('activa', 'inactiva') AND p.fecha_nacimiento IS NOT NULL
      ORDER BY p.source_id NULLS FIRST, p.id`);
  const porId = new Map(gente.map(p => [p.id, p]));
  const genteDeSede = new Map();
  for (const p of gente) {
    for (const sid of new Set(p.membresias.map(m => m.sede))) {
      if (!genteDeSede.has(sid)) genteDeSede.set(sid, []);
      genteDeSede.get(sid).push(p);
    }
  }

  /* Quien tiene un cargo ya hizo el camino de los nuevos: no vuelve a Fundamentos ni a Bautismo. */
  const { rows: conCargo } = await c.query(`SELECT DISTINCT persona_id FROM identidad.asignaciones`);
  /* Los pastores (de sede, de región y de la dirección) enseñan y dirigen: no se sientan como alumnos. */
  const { rows: pastoresRed } = await c.query(
    `SELECT DISTINCT a.persona_id FROM identidad.asignaciones a
      WHERE a.rol IN ('PASTOR_CONGREGACIONAL', 'PASTOR_DIRECTOR_GENERAL')
     UNION
     SELECT m.persona_id FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id
      WHERE u.codigo LIKE 'REG-%' OR u.codigo IN ('CENTRAL', 'DIR-PAST')`);

  const direccion = await d.direccionGeneral(c);
  const pp = porId.get(direccion.find(x => x.genero === 'M')?.persona_id) ?? null;
  const ppa = porId.get(direccion.find(x => x.genero === 'F')?.persona_id) ?? null;
  const equipoFormacion = await d.equipo(c, 'EQ-FORM');
  const [dirPastoral] = await d.equipo(c, 'DIR-PAST');
  const [dirTecnologia] = await d.equipo(c, 'DIR-TEC');

  const ctx = {
    sedes, porCodigo, roles, gente, porId, genteDeSede, pp, ppa, equipoFormacion, dirPastoral, dirTecnologia,
    noAlumnos: new Set(pastoresRed.map(r => r.persona_id)), conCargo: new Set(conCargo.map(r => r.persona_id)),
    docentes: new Map(),
    madre: sedes.find(s => s.tipo === 'sede_madre'),
    salida: (s) => SALIDAS_POR_OLA[s.ola_migracion] ?? SALIDAS_POR_OLA[1],
    /** Quien tenía un cargo en la sede ese día (el primero, si eran dos). */
    titular(s, rol, fecha) {
      return (roles.get(`${s.id}|${rol}`) ?? []).find(a => a.desde <= fecha && (!a.hasta || a.hasta >= fecha)) ?? null;
    },
    /** La pareja pastoral vigente hoy: [pastor, pastora]. */
    pastores(s) {
      const hoy = (roles.get(`${s.id}|PASTOR_CONGREGACIONAL`) ?? []).filter(a => !a.hasta || a.hasta >= HOY);
      return [hoy.find(a => a.genero === 'M') ?? hoy[0], hoy.find(a => a.genero === 'F') ?? hoy[1] ?? hoy[0]];
    },
    /** El autor de un acto en la sede ese día: el cargo pedido o, si no había, el pastor. Antes de la
        salida en vivo no hay autor: lo que existía llegó por migración. */
    autor(s, fecha, rol = 'SECRETARIA') {
      if (fecha < ctx.salida(s)) return null;
      const t = ctx.titular(s, rol, fecha) ?? ctx.titular(s, 'PASTOR_CONGREGACIONAL', fecha) ?? ctx.pastores(s)[0];
      if (!t) return null;
      return { persona_id: t.persona_id, sede_ids: [s.id], nivel_max: NIVEL_ROL[t.rol] ?? 2, alcance_global: false };
    },
    /** Líderes de la sede que pueden enseñar, predicar o responder por algo. */
    lideres(s, { edadMin = 26, edadMax = 68, genero } = {}) {
      return (genteDeSede.get(s.id) ?? []).filter(p => p.sede_id === s.id && p.estado === 'activa'
        && p.nivel === 'lider' && p.bautizado && edad(p.fnac) >= edadMin && edad(p.fnac) <= edadMax
        && (!genero || p.genero === genero));
    },
  };
  return ctx;
}

/** La membresía de alguien en alguna de las sedes, vigente ese día (o null). */
function membresiaEn(p, sedesIds, fecha) {
  return p.membresias.find(m => sedesIds.has(m.sede) && m.desde <= fecha && (!m.hasta || m.hasta >= fecha)) ?? null;
}

/* ─────────────────────────────────────────────────────────────────────
   8 · FORMACIÓN
   ───────────────────────────────────────────────────────────────────── */

/** Completa el catálogo de la red (programas y cursos) y lo devuelve por código. */
async function completarCatalogo(c, az) {
  await autorDireccion(c, { motivo: 'Catálogo de formación de la red' });
  await insertarLote(c, 'formacion.programas', PROGRAMAS_NUEVOS.map(p => ({ id: az.uuid(), ...p })),
    { conflicto: 'ON CONFLICT (codigo) DO NOTHING' });
  const programa = new Map((await c.query(`SELECT id, codigo FROM formacion.programas`)).rows.map(r => [r.codigo, r.id]));
  for (const tanda of CURSOS_NUEVOS) {
    const cursos = new Map((await c.query(`SELECT id, codigo FROM formacion.cursos`)).rows.map(r => [r.codigo, r.id]));
    const filas = tanda.map(x => {
      if (!programa.has(x.programa)) throw new Error(`Falta el programa ${x.programa} (semilla 019).`);
      if (x.prerequisito && !cursos.has(x.prerequisito)) throw new Error(`Falta el curso ${x.prerequisito} (semilla 019).`);
      return {
        id: az.uuid(), programa_id: programa.get(x.programa), codigo: x.codigo, nombre: x.nombre, semestre: x.semestre,
        horas: x.horas, otorga_certificado: x.certifica, prerequisito_id: x.prerequisito ? cursos.get(x.prerequisito) : null,
      };
    });
    await insertarLote(c, 'formacion.cursos', filas, { conflicto: 'ON CONFLICT (codigo) DO NOTHING' });
  }
  const { rows } = await c.query(`SELECT id, codigo, otorga_certificado FROM formacion.cursos`);
  return new Map(rows.map(r => [r.codigo, { id: r.id, otorga: r.otorga_certificado }]));
}

/** Las fechas de una entrada del plan en una sede. */
function fechasDe(e, desfase, diaIB) {
  if (e.semestre) {
    const [a, b] = SEMESTRE[e.semestre];
    const extra = diaIB + (/02$/.test(e.curso) ? 2 : 0);
    return [sumarDias(a, extra), sumarDias(b, extra)];
  }
  const inicia = sumarDias(e.inicia, desfase);
  return [inicia, sumarDias(inicia, 7 * (e.semanas - 1))];
}

function nuevaCohorte(ctx, az, catalogo, s, e, inicia, termina, previa, op = {}) {
  const clase = claseDe(e.curso);
  const tam = op.red ? 'red' : s.tamano;
  const fase = faseDe(inicia, termina);
  const [m0, m1] = META[clase][tam] ?? META[clase].pequena;
  const escala = op.red ? 1 : Math.min(1.2, Math.max(0.6, s.personas / (REFERENCIA[s.tamano] ?? 70)));
  let meta = Math.max(2, Math.round(az.entero(m0, m1) * escala));
  if (fase === 'proxima') meta = Math.max(2, Math.round(meta * az.decimal(0.45, 0.8)));
  let cupo = CUPO[clase][tam] ?? null;
  if (cupo && (clase === 'fundamentos' || clase === 'finanzas') && az.probabilidad(0.3)) cupo = null;
  const moneda = MONEDA[s.pais] ?? 'COP';
  let valor = null;
  if (op.red) valor = 120000;
  else if (PRECIO[clase]) {
    const gratis = (clase === 'liderazgo' && s.tamano === 'pequena' && az.probabilidad(0.5))
      || (clase === 'finanzas' && az.probabilidad(0.5));
    if (!gratis) valor = PRECIO[clase][moneda];
  }
  const modalidad = op.red ? 'virtual'
    : clase === 'instituto' ? ({ MIA: 'virtual', MAD: 'virtual', PTY: 'mixta' }[s.codigo] ?? 'presencial')
      : clase === 'finanzas' && az.probabilidad(0.3) ? 'virtual'
        : (clase === 'fundamentos' || clase === 'liderazgo') && az.probabilidad(0.12) ? 'mixta' : 'presencial';
  const cat = catalogo.get(e.curso);
  return {
    id: az.uuid(), host: s, curso: e.curso, cursoId: cat.id, otorga: cat.otorga, clase, promo: e.promo ?? null,
    previa, par: Boolean(e.par) && Boolean(previa), abierto: Boolean(e.abierto), especial: null,
    codigo: e.semestre ? `${e.curso}-${e.semestre}${op.red ? '-RED' : ''}` : `${e.curso}-${inicia.slice(0, 7)}`,
    modalidad, inicia, termina, cupo, valor, moneda, fase, meta,
    semilla: false, red: Boolean(op.red), sedesPool: op.sedesPool ?? new Set([s.id]),
    migrada: inicia < ctx.salida(s), sinCalificar: false, vencida: false, docente_id: null, inscritos: [],
  };
}

/**
 * La semilla 019 abrió una cohorte de cada curso en la sede madre (inicio del
 * mes de la migración, cupo 30, sin valor ni docente). No se tocan ni se
 * duplican: se usan como las cohortes vigentes de la madre y se llenan.
 */
function conSemillas(ctx, az, catalogo, s, propias, semillas) {
  const vivas = semillas.filter(h => faseDe(h.inicia, h.termina) === 'actual' && catalogo.has(h.curso));
  const hay = new Set(vivas.map(h => h.curso));
  const quedan = propias.filter(x => {
    if ((x.curso === 'RUTA-01' || x.curso === 'RUTA-02') && x.fase === 'actual') return !hay.has(x.curso);
    if (x.promo === 'C') return !hay.has('LID-01');
    if (x.curso === 'KID-02' && x.inicia >= '2026-08-01') return !hay.has('KID-02');
    return true;
  });
  const sem = vivas.map(h => {
    const clase = claseDe(h.curso);
    const [m0, m1] = META[clase].grande;
    const cat = catalogo.get(h.curso);
    return {
      id: h.id, host: s, curso: h.curso, cursoId: cat.id, otorga: cat.otorga, clase,
      promo: h.curso === 'LID-01' ? 'C' : h.curso.startsWith('IB-') ? 'B' : null,
      previa: null, par: false, abierto: h.curso === 'KID-02', especial: h.curso === 'LID-02' ? 'retoma' : null,
      codigo: h.codigo, modalidad: h.modalidad, inicia: h.inicia, termina: h.termina, cupo: h.cupo,
      valor: h.valor === null ? null : Number(h.valor), moneda: h.moneda, fase: 'actual',
      meta: Math.min(h.cupo ?? 99, az.entero(m0, m1)), semilla: true, red: false, sedesPool: new Set([s.id]),
      migrada: false, sinCalificar: false, vencida: false, docente_id: h.docente_id, inscritos: [],
    };
  });
  const ib101 = sem.find(x => x.curso === 'IB-101');
  for (const x of sem) if (x.curso === 'IB-102' && ib101) { x.previa = ib101; x.par = true; }
  return [...quedan, ...sem];
}

function planearCohortes(ctx, az, catalogo, semillas) {
  const todas = [];
  for (const s of ctx.sedes.filter(x => x.modulos.includes('formacion'))) {
    const a = az.derivar(`plan:${s.codigo}`);
    const desfase = a.elegir([-7, 0, 0, 7]);
    const diaIB = a.elegir([0, 1]);
    const propias = [];
    for (const e of PLAN[s.tamano] ?? PLAN.pequena) {
      if (e.instituto && !s.ministerios.includes('INSTITUTO')) continue;
      if (e.solo && !e.solo.includes(s.codigo)) continue;
      const base = e.de ?? e.par;
      const previa = base ? propias.find(x => x.curso === base && x.promo === e.promo) ?? null : null;
      if (base && !previa && !e.abierto) continue;
      if (!previa && e.p !== undefined && !a.probabilidad(e.p)) continue;
      const [inicia, termina] = fechasDe(e, desfase, diaIB);
      if (inicia > FIN_HORIZONTE) continue;
      propias.push(nuevaCohorte(ctx, a, catalogo, s, e, inicia, termina, previa));
    }
    todas.push(...(s.id === ctx.madre.id ? conSemillas(ctx, a, catalogo, s, propias, semillas) : propias));
  }
  /* El Instituto virtual de la red: lo dicta la madre para las sedes de América sin Instituto propio. */
  const sinInstituto = ctx.sedes.filter(x => x.tipo !== 'plantacion' && x.modulos.includes('formacion')
    && !x.ministerios.includes('INSTITUTO') && (x.pais === 'CO' || x.pais === 'US'));
  const pool = new Set(sinInstituto.map(x => x.id));
  const a = az.derivar('plan:red');
  const red = [];
  for (const e of PLAN_RED) {
    const base = e.de ?? e.par;
    const previa = base ? red.find(x => x.curso === base) ?? null : null;
    const [inicia, termina] = fechasDe(e, 0, 0);
    red.push(nuevaCohorte(ctx, a, catalogo, ctx.madre, e, inicia, termina, previa, { red: true, sedesPool: pool }));
  }
  todas.push(...red);
  return todas;
}

/** Cohortes que el docente nunca cerró: las recién terminadas, la mitad; y dos viejas que se quedaron abiertas. */
function marcarPendientes(az, cohortes) {
  for (const h of cohortes) {
    if (h.fase === 'pasada' && diasEntre(h.termina, HOY) <= 10 && az.probabilidad(0.5)) h.sinCalificar = true;
  }
  const viejas = cohortes.filter(h => h.fase === 'pasada' && !h.semilla && !h.red && !h.migrada
    && ['kids', 'finanzas', 'matrimonios'].includes(h.clase) && h.host.tipo !== 'sede_madre'
    && h.termina >= '2026-04-01' && h.termina <= '2026-08-15');
  for (const h of az.muestra(viejas, 2)) { h.sinCalificar = true; h.vencida = true; }
}

function asignarDocentes(ctx, az, cohortes) {
  const maestros = new Map();
  const de = (s) => {
    if (!maestros.has(s.id)) {
      const a = az.derivar(`docentes:${s.codigo}`);
      const lid = a.barajar(ctx.lideres(s, { edadMin: 32, edadMax: 66 }));
      maestros.set(s.id, { ib: lid.slice(0, 2), kids: lid.find(p => p.genero === 'F') ?? lid[2] ?? null, fin: lid[3] ?? lid[0] ?? null });
    }
    return maestros.get(s.id);
  };
  const eq = ctx.equipoFormacion;
  for (const h of cohortes) {
    if (h.semilla) continue;
    const s = h.host;
    const [pastor, pastora] = ctx.pastores(s);
    const m = de(s);
    const x02 = /02$/.test(h.curso);
    let doc = null;
    if (h.red) doc = eq.length ? eq[((h.curso.startsWith('IB-2') ? 2 : 0) + (x02 ? 1 : 0)) % eq.length].persona_id : null;
    else if (h.clase === 'fundamentos') doc = (ctx.titular(s, 'COORDINADOR_NUEVOS', h.inicia) ?? ctx.titular(s, 'COORDINADOR_NUEVOS', HOY) ?? pastora)?.persona_id;
    else if (['bautismo', 'matrimonios', 'novios'].includes(h.clase)) doc = pastor?.persona_id;
    else if (h.clase === 'liderazgo') doc = (az.probabilidad(0.6) ? pastora : pastor)?.persona_id;
    else if (h.clase === 'instituto') doc = (m.ib[x02 ? 1 : 0] ?? m.ib[0])?.id ?? pastor?.persona_id;
    else if (h.clase === 'kids') doc = m.kids?.id ?? pastora?.persona_id;
    else doc = m.fin?.id ?? pastor?.persona_id;
    h.docente_id = doc ?? null;
  }
  /* Quien enseña una clase de formación no se inscribe como alumno de esa misma clase. */
  for (const h of cohortes) {
    if (!h.docente_id) continue;
    if (!ctx.docentes.has(h.clase)) ctx.docentes.set(h.clase, new Set());
    ctx.docentes.get(h.clase).add(h.docente_id);
  }
}

/** Qué tanto encaja alguien en una cohorte (0 = no entra). */
function peso(h, p, m, aprobo) {
  const F = h.inicia, T = h.termina ?? FIN_HORIZONTE;
  const e = edad(p.fnac, F);
  const inact = p.estado === 'activa' ? 1 : 0.3;
  switch (h.clase) {
    case 'fundamentos': {
      if (e < 15 || p.nivel === 'lider' || aprobo(p, 'RUTA-01')) return 0;
      return inact * (e < 18 ? 0.4 : 1) * (diasEntre(m.desde, F) <= 150 ? 6 : !p.bautizado ? 0.5 : 0.04);
    }
    case 'bautismo': {
      if (e < 12 || (p.fbau && p.fbau < F)) return 0;
      const joven = e < 18 ? 0.3 : 1;
      if (h.fase === 'pasada') {
        /* Quien se bautizó en las semanas siguientes al curso fue, casi seguro, a ese curso. */
        if (p.fbau && p.fbau >= T && diasEntre(T, p.fbau) <= 75) return 12 * inact;
        if (p.fbau) return 2 * inact * joven;
        return p.bautizado ? 0 : inact * joven;
      }
      if (p.bautizado) return 0;
      return joven * (aprobo(p, 'RUTA-01') ? 5 : 1);
    }
    case 'liderazgo':
      if (h.especial === 'retoma') {
        if (e < 22 || e > 58 || !p.bautizado || p.nivel === 'visitante' || aprobo(p, 'LID-02')) return 0;
        return aprobo(p, 'LID-01') ? 6 : p.nivel === 'lider' ? 1 : 0.3;
      }
      if (e < 20 || e > 60 || !p.bautizado || p.nivel === 'visitante') return 0;
      return inact * (p.nivel === 'miembro' ? 3 : 1);
    case 'instituto':
      if (e < 18 || e > 70 || p.nivel === 'visitante') return 0;
      return inact * (p.bautizado ? 1 : 0.15);
    case 'kids':
      if (e < 18 || e > 62 || !p.bautizado || p.nivel === 'visitante') return 0;
      return inact * (p.genero === 'F' ? 3 : 1) * (h.curso === 'KID-02' && aprobo(p, 'KID-01') ? 8 : 1);
    case 'finanzas':
      if (e < 22 || e > 68 || p.nivel === 'visitante') return 0;
      return inact;
    default:
      return 0;
  }
}

/** Quiénes se inscriben en una cohorte: [{ p, m, pareja?, base? }]. */
function elegirInscritos(ctx, a, h, hist) {
  const F = h.inicia, T = h.termina ?? FIN_HORIZONTE;
  const vistos = new Map();
  for (const sid of h.sedesPool) for (const p of ctx.genteDeSede.get(sid) ?? []) if (!vistos.has(p.id)) vistos.set(p.id, p);
  const pool = [...vistos.values()];
  const vigente = (p) => {
    const m = membresiaEn(p, h.sedesPool, F);
    if (!m) return null;
    if (h.fase !== 'pasada' && (p.estado !== 'activa' || !membresiaEn(p, h.sedesPool, HOY))) return null;
    return m;
  };
  const libre = (p, limite) => {
    if (p.id === h.docente_id || ctx.noAlumnos.has(p.id) || ctx.docentes.get(h.clase)?.has(p.id)) return false;
    if ((h.clase === 'fundamentos' || h.clase === 'bautismo') && ctx.conCargo.has(p.id)) return false;
    const hs = hist.get(p.id) ?? [];
    if (hs.some(x => x.curso === h.curso && x.estado !== 'retirado' && x.estado !== 'reprobado')) return false;
    let n = 0;
    for (const x of hs) if (x.estado !== 'retirado' && x.inicia <= T && (x.termina ?? FIN_HORIZONTE) >= F) n++;
    return n < limite;
  };
  const aprobo = (p, curso) => (hist.get(p.id) ?? []).some(x => x.curso === curso && x.estado === 'aprobado');
  const tope = (n) => Math.min(n, h.cupo ?? 999);

  /* La promoción sigue: el siguiente nivel lo llenan quienes aprobaron el anterior
     (o quienes lo siguen cursando, si el docente todavía no ha subido las notas). */
  if (h.previa && !h.par && !h.abierto) {
    const sigue = h.clase === 'instituto' ? 0.88 : 0.9;
    const lista = [];
    for (const i of h.previa.inscritos) {
      if (!(i.estado === 'aprobado' || (h.previa.sinCalificar && i.estado === 'cursando'))) continue;
      const m = vigente(i.p);
      if (m && libre(i.p, 3) && a.probabilidad(sigue)) lista.push({ p: i.p, m });
    }
    return lista.slice(0, tope(lista.length));
  }

  /* Matrimonios: se inscribe la pareja. */
  if (h.clase === 'matrimonios') {
    const parejas = [];
    for (const p of pool) {
      if (p.genero !== 'M' || !p.conyuge) continue;
      const q = ctx.porId.get(p.conyuge);
      if (!q) continue;
      const mp = vigente(p), mq = vigente(q);
      if (!mp || !mq || edad(p.fnac, F) < 24 || edad(q.fnac, F) < 21 || edad(p.fnac, F) > 76) continue;
      if (!libre(p, 2) || !libre(q, 2)) continue;
      parejas.push({ p, q, mp, mq, w: p.nivel === 'visitante' ? 0.4 : 1 });
    }
    const n = Math.min(h.meta, Math.floor((h.cupo ?? 999) / 2));
    return muestraPonderada(a, parejas, x => x.w, n)
      .flatMap((x, k) => [{ p: x.p, m: x.mp, pareja: k }, { p: x.q, m: x.mq, pareja: k }]);
  }

  /* Preparación para el matrimonio: parejas de solteros que se van a casar. */
  if (h.clase === 'novios') {
    const solteros = pool.filter(p => {
      const e = edad(p.fnac, F);
      return p.estado_civil === 'soltero' && !p.conyuge && e >= 21 && e <= 38 && p.bautizado
        && p.nivel !== 'visitante' && vigente(p) && libre(p, 2);
    });
    const hombres = a.barajar(solteros.filter(p => p.genero === 'M'));
    const mujeres = a.barajar(solteros.filter(p => p.genero === 'F'));
    const n = Math.min(h.meta, Math.floor((h.cupo ?? 999) / 2));
    const lista = [], usadas = new Set();
    for (const hom of hombres) {
      if (lista.length / 2 >= n) break;
      const muj = mujeres.find(x => !usadas.has(x.id) && (x.hogar === null || x.hogar !== hom.hogar)
        && Math.abs(edad(x.fnac) - edad(hom.fnac)) <= 7);
      if (!muj) continue;
      usadas.add(muj.id);
      const k = lista.length / 2;
      lista.push({ p: hom, m: vigente(hom), pareja: k }, { p: muj, m: vigente(muj), pareja: k });
    }
    return lista;
  }

  const candidatos = [];
  for (const p of pool) {
    const m = vigente(p);
    if (!m || !libre(p, h.par ? 3 : 2)) continue;
    const w = peso(h, p, m, aprobo);
    if (w > 0) candidatos.push({ p, m, w });
  }

  /* El curso «02» del Instituto lo ve la misma promoción que el «01», en paralelo. */
  if (h.par && h.previa) {
    const lista = [];
    const ya = new Set();
    for (const i of h.previa.inscritos) {
      const m = vigente(i.p);
      if (m && libre(i.p, 3) && a.probabilidad(0.92)) { lista.push({ p: i.p, m, base: i }); ya.add(i.p.id); }
    }
    const extra = muestraPonderada(a, candidatos.filter(x => !ya.has(x.p.id)), x => x.w, a.entero(0, 2));
    return [...lista, ...extra].slice(0, tope(99));
  }

  if (h.clase === 'bautismo' && h.fase === 'pasada') {
    const T0 = h.termina;
    const seBautizaron = candidatos.filter(x => x.p.fbau && x.p.fbau >= T0 && diasEntre(T0, x.p.fbau) <= 75);
    const primero = muestraPonderada(a, seBautizaron, x => x.w, tope(h.meta));
    const ya = new Set(primero.map(x => x.p.id));
    const n = Math.min(tope(h.meta), Math.max(primero.length, 2) + a.entero(0, 2)) - primero.length;
    return [...primero, ...muestraPonderada(a, candidatos.filter(x => !ya.has(x.p.id)), x => x.w, Math.max(0, n))];
  }
  const lista = muestraPonderada(a, candidatos, x => x.w, tope(h.meta));
  /* Finanzas del hogar: la mitad llega con su cónyuge. */
  if (h.clase === 'finanzas') {
    const dentro = new Set(lista.map(x => x.p.id));
    for (const x of lista.slice()) {
      if (lista.length >= tope(999) || !x.p.conyuge || dentro.has(x.p.conyuge) || !a.probabilidad(0.5)) continue;
      const q = ctx.porId.get(x.p.conyuge);
      const mq = q && vigente(q);
      if (mq && libre(q, 2) && q.nivel !== 'visitante' && edad(q.fnac, F) >= 20) { lista.push({ p: q, m: mq }); dentro.add(q.id); }
    }
  }
  return lista;
}

function estadoDe(h, a, x) {
  if (h.fase === 'proxima') return a.probabilidad(0.04) ? 'retirado' : 'inscrito';
  if (h.fase === 'actual') return a.ponderado({ cursando: 86, inscrito: 5, retirado: 9 });
  if (h.sinCalificar) return a.probabilidad(0.1) ? 'retirado' : 'cursando';
  switch (h.clase) {
    case 'fundamentos': return a.ponderado({ aprobado: 72, retirado: 28 });
    case 'bautismo': return x.p.fbau && x.p.fbau >= h.inicia
      ? a.ponderado({ aprobado: 97, retirado: 3 }) : a.ponderado({ aprobado: 55, retirado: 45 });
    case 'liderazgo': return a.ponderado({ aprobado: 85, reprobado: 5, retirado: 10 });
    case 'instituto': return a.ponderado({ aprobado: 82, reprobado: 7, retirado: 11 });
    case 'kids': return a.ponderado({ aprobado: 88, reprobado: 4, retirado: 8 });
    case 'matrimonios': return a.ponderado({ aprobado: 90, retirado: 10 });
    case 'novios': return a.ponderado({ aprobado: 92, retirado: 8 });
    default: return a.ponderado({ aprobado: 74, retirado: 26 });
  }
}

/** El pago de una inscripción: cómo se declaró al inscribir y cómo está hoy. */
function pagoDe(h, estado, a) {
  if (!(h.valor > 0)) return { ini: 'no_aplica', fin: 'no_aplica', valor: null };
  const ini = a.ponderado({ pendiente: 65, pagado: 30, exonerado: 5 });
  let fin = ini;
  if (ini === 'pendiente') {
    if (h.fase === 'pasada') fin = estado === 'retirado'
      ? a.ponderado({ pendiente: 55, pagado: 35, parcial: 10 }) : a.ponderado({ pagado: 84, parcial: 7, pendiente: 9 });
    else if (h.fase === 'actual') fin = a.ponderado({ pagado: 55, parcial: 20, pendiente: 25 });
    else fin = a.ponderado({ pagado: 22, pendiente: 78 });
  }
  const paso = h.moneda === 'COP' ? 5000 : 5;
  const valor = fin === 'pagado' ? h.valor
    : fin === 'parcial' ? Math.max(paso, redondearA(h.valor * a.decimal(0.3, 0.7), paso)) : null;
  return { ini, fin, valor };
}

/** Llena todas las cohortes en orden de inicio: la historia de cada persona decide la siguiente. */
function inscribirTodas(ctx, az, cohortes) {
  const hist = new Map();
  const clave = (h) => `${h.inicia}|${h.par ? 1 : 0}|${h.host.codigo}|${h.codigo}`;
  const orden = cohortes.slice().sort((x, y) => (clave(x) < clave(y) ? -1 : clave(x) > clave(y) ? 1 : 0));
  for (const h of orden) {
    const a = az.derivar(`inscritos:${h.host.codigo}:${h.codigo}`);
    const califica = CALIFICA.has(h.clase);
    const dePareja = new Map();
    for (const x of elegirInscritos(ctx, a, h, hist)) {
      let estado;
      if (x.pareja !== undefined && dePareja.has(x.pareja) && a.probabilidad(0.9)) estado = dePareja.get(x.pareja);
      else if (x.base && x.base.estado === 'retirado' && a.probabilidad(0.8)) estado = 'retirado';
      else estado = estadoDe(h, a, x);
      if (x.pareja !== undefined && !dePareja.has(x.pareja)) dePareja.set(x.pareja, estado);
      const nota = !califica ? null
        : estado === 'aprobado' ? r1(Math.min(5, Math.max(3, a.normal(4.15, 0.42))))
          : estado === 'reprobado' ? r1(a.decimal(1.6, 2.94)) : null;
      let lo, hi;
      if (h.fase === 'proxima') { lo = sumarDias(HOY, -25); hi = AYER; } else { lo = sumarDias(h.inicia, -24); hi = minFecha(sumarDias(h.inicia, 6), AYER); }
      lo = maxFecha(lo, x.m.desde);
      if (lo > hi) lo = hi;
      const fecha = a.fechaEntre(lo, hi);
      const hora = h.clase === 'fundamentos' || h.clase === 'bautismo' ? a.horaEntre('12:00', '13:45', 5) : a.horaEntre('08:00', '20:00', 5);
      const pago = pagoDe(h, estado, a);
      const fechaEstado = h.fase === 'proxima' ? a.fechaEntre(fecha, AYER)
        : h.fase === 'actual' || h.sinCalificar ? minFecha(AYER, maxFecha(fecha, sumarDias(h.inicia, a.entero(0, 6))))
          : minFecha(AYER, sumarDias(h.termina, a.entero(2, 12)));
      const fechaPago = a.fechaEntre(fecha, minFecha(sumarDias(fecha, 40), AYER));
      h.inscritos.push({ id: a.uuid(), p: x.p, estado, nota, fecha, hora, pago, fechaEstado, fechaPago });
      if (!hist.has(x.p.id)) hist.set(x.p.id, []);
      hist.get(x.p.id).push({ curso: h.curso, inicia: h.inicia, termina: h.termina, estado });
    }
  }
  return hist;
}

/** Certificados de quien aprobó un curso que certifica, con su consecutivo por sede y año. */
function planearCertificados(ctx, az, cohortes) {
  const a = az.derivar('certificados');
  const lista = [];
  for (const h of cohortes) {
    if (!h.otorga || h.fase !== 'pasada' || h.sinCalificar) continue;
    const reciente = diasEntre(h.termina, HOY) <= 30;
    for (const i of h.inscritos) {
      if (i.estado !== 'aprobado') continue;
      if (a.probabilidad(reciente ? 0.35 : 0.04)) continue;   // todavía sin expedir
      lista.push({ id: a.uuid(), h, i, emitido: minFecha(AYER, sumarDias(h.termina, a.entero(4, 21))) });
    }
  }
  const clave = (x) => `${x.h.host.codigo}|${x.emitido}|${x.h.codigo}|${x.i.p.id}`;
  lista.sort((x, y) => (clave(x) < clave(y) ? -1 : 1));
  const consecutivo = new Map();
  for (const x of lista) {
    const k = `${x.h.host.codigo}-${x.emitido.slice(0, 4)}`;
    const n = (consecutivo.get(k) ?? 0) + 1;
    consecutivo.set(k, n);
    x.codigo = `FOR-${k}-${String(n).padStart(4, '0')}`;
  }
  /* Dos anulaciones: un nombre mal escrito y una nota que se corrigió después de expedir. */
  const viejos = lista.filter(x => x.emitido <= sumarDias(HOY, -40) && !x.h.red && !x.h.migrada);
  const [nombre] = a.muestra(viejos, 1);
  const [nota] = a.muestra(viejos.filter(x => x !== nombre && CALIFICA.has(x.h.clase)), 1);
  if (nombre) {
    nombre.anulado = minFecha(AYER, sumarDias(nombre.emitido, a.entero(5, 20)));
    nombre.motivo = 'Se expidió con el segundo apellido equivocado; la persona pidió que se lo expidan de nuevo.';
  }
  if (nota) {
    nota.anulado = minFecha(AYER, sumarDias(nota.emitido, a.entero(8, 25)));
    nota.motivo = 'Se expidió antes de corregir la nota final: no alcanzó la asistencia mínima.';
    nota.reprobar = true;
  }
  return lista;
}

async function poblarFormacion(c, az, ctx) {
  const catalogo = await completarCatalogo(c, az.derivar('catalogo'));
  const { rows: semillas } = await c.query(
    `SELECT h.id, h.codigo, u.codigo AS curso, h.modalidad, to_char(h.inicia, 'YYYY-MM-DD') AS inicia,
            to_char(h.termina, 'YYYY-MM-DD') AS termina, h.cupo, h.valor, h.moneda, h.docente_id
       FROM formacion.cohortes h JOIN formacion.cursos u ON u.id = h.curso_id
      WHERE h.sede_id = $1 AND h.source_system IS NULL
        AND NOT EXISTS (SELECT 1 FROM formacion.inscripciones i WHERE i.cohorte_id = h.id)
      ORDER BY u.codigo, h.codigo`, [ctx.madre.id]);
  const cohortes = planearCohortes(ctx, az.derivar('plan'), catalogo, semillas);
  marcarPendientes(az.derivar('pendientes'), cohortes);
  asignarDocentes(ctx, az.derivar('docentes'), cohortes);
  inscribirTodas(ctx, az.derivar('inscripciones'), cohortes);
  const certificados = planearCertificados(ctx, az, cohortes);

  const salida = (h) => ctx.salida(h.host);
  const PP = { persona_id: ctx.pp.id, sede_ids: [], nivel_max: 4, alcance_global: true };

  /* 1 · Cohortes: las abre la secretaría (o el pastor) un mes antes de empezar. */
  await porAutor(c, cohortes.filter(h => !h.semilla).map(h => ({
    autor: h.migrada ? null : ctx.autor(h.host, maxFecha(sumarDias(h.inicia, -30), salida(h))),
    fila: {
      id: h.id, curso_id: h.cursoId, sede_id: h.host.id, codigo: h.codigo, modalidad: h.modalidad,
      inicia: h.inicia, termina: h.termina, cupo: h.cupo, valor: h.valor, moneda: h.moneda, docente_id: h.docente_id,
      source_system: SISTEMA, source_id: `demo-cohorte-${h.host.codigo}-${h.codigo}`,
    },
  })), 'Apertura de cohortes de formación', (filas) => insertarLote(c, 'formacion.cohortes', filas));

  /* 2 · Inscripciones. Lo migrado llega como estaba; lo del sistema nace «inscrito»,
     con el pago que se declaró ese día, como lo hace la pantalla. */
  const inscripciones = [];
  for (const h of cohortes) {
    h.inscritos.forEach((i, k) => {
      const final = h.migrada;
      inscripciones.push({
        autor: final ? null : ctx.autor(h.host, maxFecha(i.fecha, salida(h))),
        fila: {
          id: i.id, cohorte_id: h.id, persona_id: i.p.id,
          estado: final ? i.estado : 'inscrito',
          estado_pago: final ? i.pago.fin : i.pago.ini,
          valor_pagado: final && i.pago.valor !== null ? String(i.pago.valor) : null,
          inscrito_en: momentoLocal(i.fecha, i.hora, h.host.zona_horaria),
          nota_final: final && i.nota !== null ? i.nota.toFixed(1) : null,
          source_system: SISTEMA, source_id: `demo-inscripcion-${h.host.codigo}-${h.codigo}-${String(k + 1).padStart(3, '0')}`,
        },
      });
    });
  }
  await porAutor(c, inscripciones, 'Inscripciones de formación', (filas) => insertarLote(c, 'formacion.inscripciones', filas));

  /* 3 · Estados y notas (lo que hace «Calificar» en la ficha de la cohorte). */
  const cambios = [];
  for (const h of cohortes) {
    if (h.migrada) continue;
    for (const i of h.inscritos) {
      if (i.estado === 'inscrito') continue;
      cambios.push({ autor: ctx.autor(h.host, maxFecha(i.fechaEstado, salida(h))),
        fila: { id: i.id, estado: i.estado, nota: i.nota === null ? null : i.nota.toFixed(1) } });
    }
  }
  await porAutor(c, cambios, 'Calificación y estado de los inscritos', async (filas) => {
    for (let k = 0; k < filas.length; k += 1000) {
      const t = filas.slice(k, k + 1000);
      await c.query(
        `UPDATE formacion.inscripciones i
            SET estado = v.estado::formacion.estado_inscripcion, nota_final = v.nota::numeric
           FROM unnest($1::uuid[], $2::text[], $3::text[]) AS v(id, estado, nota)
          WHERE i.id = v.id`, [t.map(f => f.id), t.map(f => f.estado), t.map(f => f.nota)]);
    }
  });

  /* 4 · Pagos (lo que hace «Registrar pago»; aquí queda además cuánto se pagó). */
  const pagos = [];
  for (const h of cohortes) {
    if (h.migrada || !(h.valor > 0)) continue;
    for (const i of h.inscritos) {
      if (i.pago.fin === i.pago.ini && i.pago.valor === null) continue;
      pagos.push({ autor: ctx.autor(h.host, maxFecha(i.fechaPago, salida(h))),
        fila: { id: i.id, pago: i.pago.fin, valor: i.pago.valor === null ? null : String(i.pago.valor) } });
    }
  }
  await porAutor(c, pagos, 'Pago de formación: recibo de caja de la secretaría', async (filas) => {
    for (let k = 0; k < filas.length; k += 1000) {
      const t = filas.slice(k, k + 1000);
      await c.query(
        `UPDATE formacion.inscripciones i
            SET estado_pago = v.pago::formacion.estado_pago, valor_pagado = v.valor::numeric
           FROM unnest($1::uuid[], $2::text[], $3::text[]) AS v(id, pago, valor)
          WHERE i.id = v.id`, [t.map(f => f.id), t.map(f => f.pago), t.map(f => f.valor)]);
    }
  });

  /* 5 · Certificados: los firma el pastor de la sede (los del Instituto virtual, el Pastor Principal). */
  const firma = (x) => {
    if (x.h.red) return { autor: PP, por: ctx.pp.id };
    const autor = x.emitido < salida(x.h) ? null : ctx.autor(x.h.host, x.emitido, 'PASTOR_CONGREGACIONAL');
    return { autor, por: autor?.persona_id ?? ctx.pastores(x.h.host)[0]?.persona_id ?? null };
  };
  await porAutor(c, certificados.map(x => {
    const f = firma(x);
    x.firma = f;
    return { autor: f.autor, fila: { id: x.id, inscripcion_id: x.i.id, codigo: x.codigo, emitido_en: x.emitido, emitido_por: f.por } };
  }), 'Expedición de certificados de formación', (filas) => insertarLote(c, 'formacion.certificados', filas));

  /* 6 · Anulaciones: la nota corregida pasa la inscripción a «reprobado» antes de anular. */
  for (const x of certificados.filter(y => y.anulado)) {
    await fijarAutor(c, { ...x.firma.autor, motivo: x.motivo });
    if (x.reprobar) {
      await c.query(`UPDATE formacion.inscripciones SET estado = 'reprobado', nota_final = 2.6 WHERE id = $1`, [x.i.id]);
      x.i.estado = 'reprobado';
    }
    await c.query(`UPDATE formacion.certificados SET anulado_en = $2, anulado_motivo = $3 WHERE id = $1`, [x.id, x.anulado, x.motivo]);
  }
  return cohortes;
}

/* ─────────────────────────────────────────────────────────────────────
   9 · TEMÁTICAS
   ───────────────────────────────────────────────────────────────────── */

/* Semanas sin serie: Navidad y Año Nuevo, y la Semana Santa (la predica la red). */
const VEDA = [['2025-12-20', '2026-01-10'], ['2026-03-29', '2026-04-05']];

/** n fechas semanales en el día `dia`, desde `desde`, saltando la veda. */
function semanas(desde, n, dia) {
  const fechas = [];
  let f = siguiente(desde, dia);
  while (fechas.length < n) {
    if (!VEDA.some(([x, y]) => f >= x && f <= y)) fechas.push(f);
    f = sumarDias(f, 7);
  }
  return fechas;
}

/** n fechas mensuales: el `cual`-ésimo `dia` de cada mes, desde `desde`. */
function mensuales(desde, n, dia, cual) {
  const fechas = [];
  let [y, m] = desde.split('-').map(Number);
  while (fechas.length < n) {
    const f = enesimo(y, m, dia, cual);
    if (f >= desde) fechas.push(f);
    if (++m > 12) { m = 1; y++; }
  }
  return fechas;
}

function estadoSerie(inicia, termina) {
  if (termina < HOY) return 'terminada';
  if (inicia > HOY) return 'planeada';
  return 'en_curso';
}

function planearTematicas(ctx, az) {
  const series = [];
  const madre = ctx.madre;
  const [pm, pma] = ctx.pastores(madre);
  const invitados = ['MED', 'CALI', 'BOG-NORTE', 'BAQ', 'PTY', 'BGA'].map(k => ctx.porCodigo.get(k))
    .filter(Boolean).map(s => ({ s, p: ctx.pastores(s)[0] })).filter(x => x.p);
  let turno = 0;
  const quien = (cod) => ({
    PP: () => tratamiento(ctx.pp), PPA: () => tratamiento(ctx.ppa),
    PPS: () => `Pastores ${nombreDe(ctx.pp)} y ${nombreDe(ctx.ppa)}`,
    PM: () => tratamiento(pm), PMA: () => tratamiento(pma),
    INV: () => { const x = invitados[turno++ % invitados.length]; return `${tratamiento(x.p)}, invitado de ${x.s.nombre}`; },
  }[cod])();

  /* 1 · Las series de la red: las publica el Pastor Principal y las predica la madre. */
  const ar = az.derivar('red');
  for (const x of SERIES_RED) {
    series.push({
      id: ar.uuid(), sede: madre, red: true, titulo: x.titulo, descripcion: x.descripcion, inicia: x.inicia, termina: x.termina,
      estado: estadoSerie(x.inicia, x.termina), autorRol: 'PP',
      ensenanzas: x.ensenanzas.map(([fecha, titulo, pasaje, cod, resumen]) => ({
        id: ar.uuid(), fecha, titulo, pasaje, resumen, predicador: quien(cod),
        recursos: ar.probabilidad(0.8) ? `Bosquejo para los grupos y audio del servicio: https://recursos.example.org/red/${fecha}` : null,
      })),
    });
  }

  /* 2 · Las series de cada sede. */
  for (const s of ctx.sedes) {
    const a = az.derivar(`sede:${s.codigo}`);
    const arranque = maxFecha(maxFecha(ctx.salida(s), FUNDADA[s.codigo] ?? '2000-01-01'), '2025-09-08');
    const [pastor, pastora] = ctx.pastores(s);
    if (!pastor) continue;
    const lideres = a.barajar(ctx.lideres(s, { edadMin: 26, edadMax: 66 }));
    const jovenes = a.barajar(ctx.lideres(s, { edadMin: 20, edadMax: 34 }));
    const mujeres = lideres.filter(p => p.genero === 'F');
    const hombres = lideres.filter(p => p.genero === 'M');
    const voz = (p) => (p.persona_id ? tratamiento(p) : nombreDe(p));
    const voces = {
      miercoles: [[pastor, 3], [pastora, 3], ...lideres.slice(0, 3).map(p => [p, 1])],
      tmt: [...jovenes.slice(0, 2).map(p => [p, 3]), [pastor, 1]],
      mujeres: [[pastora, 3], ...mujeres.slice(0, 2).map(p => [p, 1])],
      hombres: [[pastor, 3], ...hombres.slice(0, 2).map(p => [p, 1])],
      plantacion: [[pastor, 3], [pastora, 2]],
    };
    const agregar = (tema, fechas, pista) => {
      const inicia = fechas[0], termina = fechas[fechas.length - 1];
      const estado = estadoSerie(inicia, termina);
      const quienes = voces[pista].filter(([p]) => p);
      const ens = [];
      tema.ensenanzas.forEach(([titulo, pasaje, resumen], k) => {
        const fecha = fechas[k];
        if (fecha > AYER) return;
        if (estado === 'terminada' && k > 1 && k < fechas.length - 1 && a.probabilidad(0.06)) return;   // esa semana no quedó escrita
        const p = a.ponderado(quienes.map(([x, w]) => [x, w]));
        const r = a.siguiente();
        ens.push({
          id: a.uuid(), fecha, titulo, pasaje, resumen, predicador: a.probabilidad(0.04) ? null : voz(p),
          recursos: r < 0.3 ? `Bosquejo para los grupos: https://recursos.example.org/${slug(s.codigo)}/${fecha}`
            : r < 0.4 ? `Audio de la enseñanza: https://audio.example.org/${slug(s.codigo)}/${fecha}` : null,
        });
      });
      series.push({ id: a.uuid(), sede: s, red: false, titulo: tema.titulo, descripcion: tema.descripcion, inicia, termina,
        estado, ensenanzas: ens, autorRol: a.probabilidad(0.6) ? 'M' : 'F' });
    };

    if (s.tipo === 'plantacion') {
      agregar(TEMA_PLANTACION, semanas(sumarDias(arranque, a.entero(0, 21)), TEMA_PLANTACION.ensenanzas.length, 0), 'plantacion');
      continue;
    }

    /* El estudio de los miércoles: series seguidas con pausas, y una que va ahora (o que viene). La de
       ahora se escoge primero, para que las anteriores terminen antes de que empiece. */
    const maxMiercoles = { grande: 4, mediana: 3, pequena: 2 }[s.tamano] ?? 2;
    const temas = a.barajar(TEMAS_MIERCOLES);
    const temaAncla = temas[0];
    const ancla = a.probabilidad(0.7)
      ? siguiente(a.fechaEntre(sumarDias(HOY, -7 * (temaAncla.ensenanzas.length - 2)), sumarDias(HOY, -6)), 3)
      : siguiente(a.fechaEntre('2026-10-07', '2026-10-28'), 3);
    let f = siguiente(sumarDias(arranque, a.entero(7, 35)), 3);
    for (let k = 1; k < maxMiercoles; k++) {
      const fechas = semanas(f, temas[k].ensenanzas.length, 3);
      if (sumarDias(fechas[fechas.length - 1], 21) > ancla) break;
      agregar(temas[k], fechas, 'miercoles');
      f = sumarDias(fechas[fechas.length - 1], 7 * a.entero(2, 8));
    }
    if (ancla >= arranque) agregar(temaAncla, semanas(ancla, temaAncla.ensenanzas.length, 3), 'miercoles');

    /* tMt los sábados. */
    if (s.ministerios.includes('TMT') && jovenes.length && (s.tamano !== 'pequena' || a.probabilidad(0.3))) {
      const t0 = siguiente(a.fechaEntre(maxFecha(arranque, '2025-10-01'), '2026-04-30'), 6);
      const primera = semanas(t0, TEMAS_TMT[0].ensenanzas.length, 6);
      agregar(TEMAS_TMT[0], primera, 'tmt');
      if (s.tamano === 'grande' || a.probabilidad(0.4)) {
        agregar(TEMAS_TMT[1], semanas(sumarDias(primera[primera.length - 1], 7 * a.entero(6, 16)), TEMAS_TMT[1].ensenanzas.length, 6), 'tmt');
      }
    }
    /* Mujer Integral: el primer sábado de cada mes. */
    if (s.ministerios.includes('MUJER_INTEGRAL') && s.tamano !== 'pequena' && a.probabilidad(0.65)) {
      const [y, m] = a.elegir(mesesEntre(maxFecha(arranque, '2026-01-01'), '2026-05-01'));
      agregar(TEMA_MUJERES, mensuales(`${y}-${dosDigitos(m)}-01`, TEMA_MUJERES.ensenanzas.length, 6, 1), 'mujeres');
    }
    /* Hombres Bien: el segundo sábado de cada mes. */
    if (s.ministerios.includes('HOMBRES_BIEN') && a.probabilidad(s.tamano === 'grande' ? 0.6 : 0.3)) {
      const [y, m] = a.elegir(mesesEntre(maxFecha(arranque, '2026-02-01'), '2026-06-01'));
      agregar(TEMA_HOMBRES, mensuales(`${y}-${dosDigitos(m)}-01`, TEMA_HOMBRES.ensenanzas.length, 6, 2), 'hombres');
    }
  }
  return series;
}

async function escribirTematicas(c, ctx, az, series) {
  const a = az.derivar('momentos');
  const PP = { persona_id: ctx.pp.id, sede_ids: [], nivel_max: 4, alcance_global: true };
  const autorDe = (x, fecha) => {
    if (x.red) return PP;
    const [pastor, pastora] = ctx.pastores(x.sede);
    const p = x.autorRol === 'F' ? pastora ?? pastor : pastor;
    if (fecha < ctx.salida(x.sede)) return null;
    return { persona_id: p.persona_id, sede_ids: [x.sede.id], nivel_max: 3, alcance_global: false };
  };
  const cuando = (s, fecha) => momentoLocal(fecha, a.horaEntre('09:00', '19:00', 5), s.zona_horaria);

  /* 1 · Las series nacen «planeadas» unas semanas antes de empezar. */
  for (const x of series) x.creada = minFecha(AYER, maxFecha(ctx.salida(x.sede), sumarDias(x.inicia, -a.entero(7, 28))));
  await porAutor(c, series.filter(x => x.red).map(x => ({ autor: PP, fila: filaSerie(x, cuando) })),
    'Series de enseñanza de la red', (filas) => insertarLote(c, 'formacion.series', filas));
  await porAutor(c, series.filter(x => !x.red).map(x => ({ autor: autorDe(x, x.creada), fila: filaSerie(x, cuando) })),
    'Series de enseñanza de la sede', (filas) => insertarLote(c, 'formacion.series', filas));

  /* 2 · Cada enseñanza queda escrita el día que se predicó o uno o dos días después.
         Las de la red las escribe el pastor de la sede madre. */
  const ens = [];
  for (const x of series) {
    for (const e of x.ensenanzas) {
      const dia = minFecha(AYER, maxFecha(ctx.salida(x.sede), sumarDias(e.fecha, a.entero(0, 2))));
      const autor = x.red ? ctx.autor(x.sede, dia, 'PASTOR_CONGREGACIONAL') : autorDe(x, dia);
      ens.push({ autor, fila: { id: e.id, serie_id: x.id, sede_id: x.sede.id, titulo: e.titulo, fecha: e.fecha,
        predicador: e.predicador, pasaje: e.pasaje, resumen: e.resumen, recursos: e.recursos, creado_en: cuando(x.sede, dia) } });
    }
  }
  await porAutor(c, ens, 'Enseñanzas de la serie', (filas) => insertarLote(c, 'formacion.ensenanzas', filas));

  /* 3 · La máquina de estados: planeada → en curso → terminada. */
  const pasar = async (lista, hacia, motivo, fechaDe) => {
    await porAutor(c, lista.map(x => ({ autor: autorDe(x, fechaDe(x)), fila: x.id })), motivo, async (ids) => {
      await c.query(`UPDATE formacion.series SET estado = $2 WHERE id = ANY($1::uuid[])`, [ids, hacia]);
    });
  };
  await pasar(series.filter(x => x.estado !== 'planeada'), 'en_curso', 'La serie empezó', x => maxFecha(ctx.salida(x.sede), x.inicia));
  await pasar(series.filter(x => x.estado === 'terminada'), 'terminada', 'La serie terminó',
    x => minFecha(AYER, maxFecha(ctx.salida(x.sede), sumarDias(x.termina, 1))));
}

function filaSerie(x, cuando) {
  return { id: x.id, sede_id: x.sede.id, alcance_red: x.red, titulo: x.titulo, descripcion: x.descripcion,
    inicia: x.inicia, termina: x.termina, estado: 'planeada', creado_en: cuando(x.sede, x.creada) };
}

/* ─────────────────────────────────────────────────────────────────────
   10 · CALENDARIO
   ───────────────────────────────────────────────────────────────────── */

const idDe = (p) => (p ? p.persona_id ?? p.id ?? null : null);

function eventosDeLaRed(ctx, az) {
  const a = az.derivar('red');
  const lista = [];
  const ev = (o) => lista.push({ id: a.uuid(), sede: ctx.madre, red: true, publico: false, cupo: null,
    lugar: 'Sede Chicó, auditorio principal', ...o });
  const olas = { 2: '2025-10-04', 3: '2025-11-08', 4: '2026-01-17', 5: '2026-02-28' };
  for (const [n, f] of Object.entries(olas)) {
    const nombres = ctx.sedes.filter(s => s.ola_migracion === Number(n)).map(s => s.nombre);
    const listaSedes = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres.join('');
    ev({ tipo: 'capacitacion', titulo: `Capacitación en CasaRoca System para la ola ${n}`, fecha: f, hora: '09:00', horaFin: '12:00',
      lugar: 'Sede Chicó, salón 2, y conexión virtual', cupo: 80, responsable: ctx.dirTecnologia,
      descripcion: `Capacitación para pastores, secretarías y coordinadores de nuevos de las sedes que salen en vivo en la ola ${n}: ${listaSedes}.`
        + (n === '5' ? ' Virtual para las sedes de afuera: 9:00 en Houston, 10:00 en Panamá, Miami y Orlando, y 16:00 en Madrid y Barcelona.' : '') });
  }
  const encuentro = (f) => ev({ tipo: 'reunion', titulo: 'Encuentro de pastores de la red', fecha: f, hora: '08:00', horaFin: '16:00',
    cupo: 90, responsable: ctx.dirPastoral, lugar: 'Sede Chicó, salón principal',
    descripcion: 'Las parejas pastorales de todas las sedes: informe del trimestre, planeación y tiempo de oración.' });
  ['2025-11-15', '2026-02-21', '2026-05-16', '2026-08-22', '2026-11-14'].forEach(encuentro);
  ev({ tipo: 'conferencia', titulo: 'Conferencia anual de la red 2025: Firmes', fecha: '2025-10-24', hora: '18:00', fechaFin: '2025-10-26',
    horaFin: '13:00', publico: true, cupo: 1800, responsable: ctx.pp,
    descripcion: 'Tres días de conferencia para toda la red con talleres por ministerio, pastores invitados y un servicio unido el domingo.' });
  ev({ tipo: 'oracion', titulo: '21 días de ayuno y oración de la red', fecha: '2026-01-11', hora: '05:00', fechaFin: '2026-01-31', horaFin: '21:00',
    publico: true, responsable: ctx.ppa, lugar: 'Todas las sedes',
    descripcion: 'Tres semanas de ayuno y oración en toda la red. Cada sede abre el templo a las 5:00 a. m. de lunes a viernes y cierra con una vigilia el último viernes.' });
  ev({ tipo: 'capacitacion', titulo: 'Capacitación en protección de menores', fecha: '2026-03-14', hora: '09:00', horaFin: '12:00',
    responsable: ctx.ppa, lugar: 'Virtual',
    descripcion: 'Capacitación obligatoria para maestros de RocaKids y líderes de tMt. Hora de Bogotá y Panamá; 10:00 en Miami, Orlando y Nueva York, 9:00 en Houston y 15:00 en Madrid y Barcelona.' });
  ev({ tipo: 'servicio', titulo: 'Viernes Santo: servicio unido de la red', fecha: '2026-04-03', hora: '10:00', horaFin: '12:00', publico: true,
    responsable: ctx.pp, descripcion: 'Servicio unido transmitido desde la sede Chicó para todas las sedes de la red.' });
  ev({ tipo: 'especial', titulo: 'Clausura del Instituto bíblico virtual', fecha: '2026-06-05', hora: '19:00', horaFin: '21:00',
    responsable: ctx.dirPastoral, lugar: 'Virtual',
    descripcion: 'Cierre del semestre del Instituto virtual de la red con los estudiantes de las sedes que no tienen Instituto propio.' });
  ev({ tipo: 'retiro', titulo: 'Retiro de pastores de la red', fecha: '2026-06-19', hora: '16:00', fechaFin: '2026-06-21', horaFin: '13:00',
    cupo: 80, responsable: ctx.pp, lugar: 'Centro de retiros en tierra caliente, a dos horas de Bogotá',
    descripcion: 'Descanso, enseñanza y oración para las parejas pastorales de la red. Solo con inscripción.' });
  ev({ tipo: 'especial', titulo: 'Encuentro nacional de jóvenes tMt', fecha: '2026-07-18', hora: '09:00', horaFin: '18:00', publico: true,
    cupo: 600, responsable: ctx.dirPastoral, destino: 'cancelado',
    motivo: 'Se cruzaba con el puente festivo del 20 de julio y más de la mitad de las sedes no confirmó transporte. Pasa al 17 de octubre.',
    descripcion: 'Encuentro de los jóvenes de tMt de todas las sedes de Colombia, con alabanza, talleres y un servicio de cierre.' });
  ev({ tipo: 'capacitacion', titulo: 'Capacitación para coordinadores de nuevos: el recorrido 4C', fecha: '2026-09-12', hora: '09:00', horaFin: '12:00',
    responsable: ctx.dirPastoral, lugar: 'Virtual',
    descripcion: 'Cómo acompañar a quien llega: la primera llamada, el café de bienvenida, Fundamentos y el grupo familiar.' });
  ev({ tipo: 'oracion', titulo: 'Día de oración por las naciones', fecha: '2026-09-26', hora: '06:00', horaFin: '18:00', publico: true,
    responsable: ctx.ppa, lugar: 'Todas las sedes',
    descripcion: 'Doce horas de oración en cadena: cada sede toma un turno y ora por las ciudades donde la red tiene iglesias.' });
  ev({ tipo: 'capacitacion', titulo: 'Capacitación en protección de menores (segunda jornada)', fecha: '2026-10-10', hora: '09:00', horaFin: '12:00',
    responsable: ctx.ppa, lugar: 'Virtual',
    descripcion: 'Segunda jornada para los maestros de RocaKids y los líderes de tMt que entraron este semestre. Misma hora de la primera.' });
  ev({ tipo: 'especial', titulo: 'Encuentro nacional de jóvenes tMt', fecha: '2026-10-17', hora: '09:00', horaFin: '18:00', publico: true,
    cupo: 600, responsable: ctx.dirPastoral,
    descripcion: 'Nueva fecha del encuentro nacional de tMt. Cada sede coordina el transporte de sus jóvenes; los menores viajan con autorización firmada del acudiente.' });
  ev({ tipo: 'conferencia', titulo: 'Conferencia anual de la red 2026: Sobre la Roca', fecha: '2026-10-23', hora: '18:00', fechaFin: '2026-10-25',
    horaFin: '13:00', publico: true, cupo: 2200, responsable: ctx.pp,
    descripcion: 'La conferencia anual de toda la red: tres días con pastores invitados, talleres por ministerio y servicio unido el domingo. Inscripción por sede.' });
  ev({ tipo: 'especial', titulo: 'Clausura del Instituto bíblico virtual', fecha: '2026-11-27', hora: '19:00', horaFin: '21:00',
    responsable: ctx.dirPastoral, lugar: 'Virtual',
    descripcion: 'Cierre del semestre del Instituto virtual de la red y entrega de los certificados de los cursos aprobados.' });
  return lista;
}

function eventosDeSede(ctx, a, s, cohortes) {
  const lista = [];
  const arranque = maxFecha(maxFecha(ctx.salida(s), FUNDADA[s.codigo] ?? '2000-01-01'), '2025-09-08');
  const plant = s.tipo === 'plantacion';
  const tam = plant ? 'plantacion' : s.tamano;
  const [pastor, pastora] = ctx.pastores(s);
  const coord = ctx.titular(s, 'COORDINADOR_NUEVOS', HOY);
  const joven = ctx.lideres(s, { edadMin: 22, edadMax: 34 })[0] ?? null;
  const rk = s.modulos.includes('rocakids');
  const salon = plant ? 'Salón donde se reúne la plantación' : 'Auditorio principal de la sede';
  const nuevo = (o) => {
    if (o.fecha < arranque || o.fecha > FIN_HORIZONTE) return;
    lista.push({ id: a.uuid(), sede: s, red: false, publico: false, cupo: null, lugar: salon, creador: 'SECRETARIA', ...o });
  };
  const meses = mesesEntre(`${arranque.slice(0, 7)}-01`, FIN_HORIZONTE);

  /* Reuniones de líderes (o del equipo de servidores en las plantaciones). */
  if (plant) {
    for (const [y, m] of meses) nuevo({ tipo: 'reunion', titulo: 'Reunión del equipo de servidores', fecha: enesimo(y, m, 2, 1),
      hora: '19:30', horaFin: '21:00', lugar: 'Casa de los pastores', responsable: pastor, creador: 'PASTOR_CONGREGACIONAL',
      descripcion: 'Planeación de los servicios del mes y oración por la ciudad.' });
  } else {
    const sabado = a.probabilidad(0.5);
    const cada = tam === 'pequena' ? 2 : 1;
    meses.forEach(([y, m], k) => {
      if (m === 12 || m === 1 || k % cada) return;
      nuevo({ tipo: 'reunion', titulo: 'Reunión de líderes', fecha: sabado ? enesimo(y, m, 6, 2) : enesimo(y, m, 1, 1),
        hora: sabado ? '08:00' : '19:00', horaFin: sabado ? '10:30' : '21:00', lugar: 'Salón de reuniones de la sede',
        responsable: pastor, descripcion: 'Revisión del mes, agenda de la sede y oración por los grupos y sus líderes.' });
    });
  }
  /* Vigilias: el último viernes, cada dos meses (cada trimestre en las pequeñas). */
  const mesesVigilia = tam === 'grande' || tam === 'mediana' ? [2, 4, 6, 8, 10, 12] : [3, 6, 9];
  for (const [y, m] of meses) {
    if (!mesesVigilia.includes(m)) continue;
    const f = enesimo(y, m, 5, -1);
    nuevo({ tipo: 'oracion', titulo: 'Vigilia de oración', fecha: f, hora: '21:00', fechaFin: sumarDias(f, 1), horaFin: '01:00',
      publico: true, responsable: pastora, descripcion: 'Noche de oración por las familias, la ciudad y las naciones. Traer abrigo y la Biblia.' });
  }
  /* Café de bienvenida para los nuevos: tercer domingo. */
  if (tam === 'grande' || tam === 'mediana') {
    const mc = tam === 'grande' ? [1, 3, 5, 7, 9, 11] : [3, 6, 9];
    for (const [y, m] of meses) if (mc.includes(m)) nuevo({ tipo: 'reunion', titulo: 'Café de bienvenida para los nuevos',
      fecha: enesimo(y, m, 0, 3), hora: '13:00', horaFin: '14:30', lugar: 'Cafetería de la sede', responsable: coord ?? pastora,
      creador: 'COORDINADOR_NUEVOS',
      descripcion: 'Encuentro con quienes llegaron en los últimos meses: conocer a los pastores, resolver preguntas e invitar a Fundamentos.' });
  }
  /* Servicio de bautizos: el domingo siguiente a cada curso de Bautismo de la sede. */
  const bautizos = new Set(cohortes.filter(h => h.host.id === s.id && h.curso === 'RUTA-02' && !h.red)
    .map(h => siguiente(sumarDias(h.termina ?? sumarDias(h.inicia, 28), 7), 0)));
  if (!bautizos.size && sumarDias(arranque, 45) < '2026-11-29') bautizos.add(siguiente(a.fechaEntre(sumarDias(arranque, 45), '2026-11-29'), 0));
  for (const f of bautizos) nuevo({ tipo: 'servicio', titulo: 'Servicio de bautizos', fecha: f, hora: '11:00', horaFin: '13:30', publico: true,
    lugar: plant ? 'Piscina de un centro recreativo cercano' : a.elegir(['Auditorio principal de la sede (bautisterio)', 'Piscina de un centro recreativo cercano']),
    responsable: pastor, descripcion: 'Bautizos de quienes terminaron el curso de bautismo. Los bautizandos llegan una hora antes con ropa de cambio y toalla.' });
  /* Noches de alabanza. */
  const alabanza = tam === 'grande' ? ['2025-11', '2026-03', '2026-06', '2026-10'] : tam === 'mediana' ? ['2026-04', '2026-09']
    : tam === 'pequena' && a.probabilidad(0.4) ? ['2026-08'] : [];
  for (const ym of alabanza) {
    const [y, m] = ym.split('-').map(Number);
    nuevo({ tipo: 'especial', titulo: 'Noche de alabanza', fecha: enesimo(y, m, 5, 2), hora: '19:00', horaFin: '22:00', publico: true,
      responsable: pastor, alabanza: true, descripcion: 'Una noche de adoración con el equipo de alabanza de la sede. Entrada libre.' });
  }
  /* Retiro de parejas. */
  if (tam === 'grande' || (tam === 'mediana' && a.probabilidad(0.5))) {
    const f = siguiente(a.fechaEntre('2026-03-07', '2026-08-29'), 6);
    const retiro = { tipo: 'retiro', titulo: 'Retiro de parejas', hora: '08:00', horaFin: '15:00', cupo: 20 * a.entero(2, 4),
      lugar: 'Finca de retiros a las afueras de la ciudad', responsable: pastor, creador: 'PASTOR_CONGREGACIONAL',
      descripcion: 'Dos días para el matrimonio: enseñanza, tiempo a solas y oración. Cupo limitado, con inscripción previa.' };
    nuevo({ ...retiro, fecha: f, fechaFin: sumarDias(f, 1) });
    if (tam === 'grande' && a.probabilidad(0.5)) nuevo({ ...retiro, fecha: '2026-11-07', fechaFin: '2026-11-08' });
  }
  /* Retiro de jóvenes tMt. */
  if (s.ministerios.includes('TMT') && (tam === 'grande' ? a.probabilidad(0.9) : tam === 'mediana' && a.probabilidad(0.5))) {
    const f = s.pais === 'US' || s.pais === 'ES' ? '2026-07-11' : a.elegir(['2026-06-27', '2026-07-04']);
    nuevo({ tipo: 'retiro', titulo: 'Retiro de jóvenes tMt', fecha: f, hora: '07:00', fechaFin: sumarDias(f, 1), horaFin: '16:00',
      cupo: 10 * a.entero(5, 12), lugar: 'Centro de campamentos fuera de la ciudad', responsable: joven ?? pastor,
      descripcion: 'Campamento de tMt con alabanza, enseñanza y actividades al aire libre. Los menores van con la autorización firmada del acudiente.' });
  }
  /* Escuela bíblica de vacaciones. */
  if (rk && (tam === 'grande' || tam === 'mediana')) {
    const lunes = s.pais === 'US' ? '2026-07-13' : s.pais === 'ES' ? '2026-07-06' : a.elegir(['2026-06-22', '2026-07-06']);
    nuevo({ tipo: 'especial', titulo: 'Escuela bíblica de vacaciones', fecha: lunes, hora: '09:00', fechaFin: sumarDias(lunes, 2), horaFin: '12:00',
      publico: true, cupo: 20 * a.entero(3, 6), lugar: 'Salones de RocaKids', responsable: pastora,
      descripcion: 'Tres mañanas de historias bíblicas, juegos y manualidades para niños de 4 a 11 años. Cada niño sale solo con quien está autorizado a recogerlo.' });
  }
  /* Navidad, fin de año y Resurrección (solo las sedes que ya estaban en el sistema). */
  nuevo({ tipo: 'servicio', titulo: 'Servicio de Nochebuena', fecha: '2025-12-24', hora: '19:00', horaFin: '21:00', publico: true,
    responsable: pastor, descripcion: 'Servicio especial de Nochebuena con la presentación de los niños y cena compartida al final.' });
  nuevo({ tipo: 'servicio', titulo: 'Culto de fin de año', fecha: '2025-12-31', hora: '21:00', fechaFin: '2026-01-01', horaFin: '00:45',
    publico: true, responsable: pastor, descripcion: 'Despedimos el año dando gracias y orando por el que empieza.' });
  nuevo({ tipo: 'servicio', titulo: 'Domingo de Resurrección', fecha: '2026-04-05', hora: '10:00', horaFin: '12:30', publico: true,
    responsable: pastor, descripcion: 'Servicio especial de Resurrección con Santa Cena y la presentación del coro.' });
  /* Aniversario de la sede. */
  const fundada = FUNDADA[s.codigo];
  if (fundada) {
    for (const y of [2025, 2026]) {
      const anios = y - Number(fundada.slice(0, 4));
      if (anios < 1) continue;
      nuevo({ tipo: 'servicio', titulo: anios === 1 ? 'Primer aniversario de la sede' : `${anios} años de la sede`,
        fecha: siguiente(`${y}${fundada.slice(4)}`, 0), hora: '10:00', horaFin: '13:00', publico: true, responsable: pastor,
        descripcion: anios === 1 ? `Celebramos el primer año de ${s.nombre} con un servicio especial y almuerzo compartido.`
          : `Celebramos ${anios} años de ${s.nombre} con un servicio especial, testimonios de los fundadores y almuerzo compartido.` });
    }
  }
  /* Día de la familia y jornada de servicio social. */
  if ((tam === 'grande' || tam === 'mediana') && a.probabilidad(0.6)) nuevo({ tipo: 'especial', titulo: 'Día de la familia',
    fecha: siguiente(a.fechaEntre('2026-05-16', '2026-08-29'), 6), hora: '09:00', horaFin: '16:00', publico: true,
    lugar: 'Parque recreativo del sector', responsable: pastora,
    descripcion: 'Jornada para toda la familia: juegos, almuerzo compartido y un servicio corto al final de la tarde.' });
  if ((tam === 'grande' && a.probabilidad(0.7)) || (tam === 'mediana' && a.probabilidad(0.4))) nuevo({ tipo: 'especial',
    titulo: 'Jornada de servicio social', fecha: siguiente(a.fechaEntre('2026-03-01', '2026-08-31'), 6), hora: '08:00', horaFin: '14:00',
    publico: true, lugar: 'Salón comunal de un barrio vecino', responsable: pastor,
    descripcion: 'Entrega de mercados y brigada de salud con los profesionales de la sede en un barrio vecino.' });
  /* Capacitación de ujieres y servidores. */
  if (s.ministerios.includes('UJIERES') && !plant) {
    const fechas = tam === 'grande' ? ['2026-02-14', '2026-08-08'] : tam === 'mediana' ? [a.elegir(['2026-02-21', '2026-08-15'])]
      : a.probabilidad(0.5) ? ['2026-05-16'] : [];
    for (const f0 of fechas) nuevo({ tipo: 'capacitacion', titulo: 'Capacitación de ujieres y servidores',
      fecha: siguiente(sumarDias(f0, a.elegir([-7, 0, 7])), 6), hora: '09:00', horaFin: '12:00', cupo: 10 * a.entero(3, 5),
      responsable: pastor, descripcion: 'Protocolo de recibimiento, manejo del auditorio, primeros auxilios básicos y plan de evacuación.' });
  }
  /* RocaKids: reunión de padres y la fiesta de luz. */
  if (rk) {
    for (const f of tam === 'pequena' ? ['2026-08-09'] : ['2026-02-08', '2026-08-09']) nuevo({ tipo: 'reunion',
      titulo: 'Reunión de padres de RocaKids', fecha: f, hora: '13:00', horaFin: '14:00', lugar: 'Salones de RocaKids', responsable: pastora,
      descripcion: 'Cómo funcionan el ingreso y la entrega segura de los niños, quién puede recogerlos y presentación de los maestros del semestre.' });
    if (a.probabilidad(tam === 'pequena' ? 0.4 : 0.8)) nuevo({ tipo: 'especial', titulo: 'Fiesta de luz para los niños', fecha: '2026-10-31',
      hora: '15:00', horaFin: '18:00', publico: true, lugar: 'Salones de RocaKids', responsable: pastora,
      descripcion: 'Una alternativa para el 31 de octubre: disfraces de personajes bíblicos, dulces y juegos. Los niños entran y salen con su acudiente.' });
  }
  /* Amor y amistad (Colombia, tercer sábado de septiembre) y la tarde de integración de ayer. */
  if (s.pais === 'CO' && !plant && a.probabilidad(tam === 'pequena' ? 0.3 : 0.7)) nuevo({ tipo: 'especial', titulo: 'Noche de amor y amistad',
    fecha: '2026-09-19', hora: '19:00', horaFin: '22:00', publico: true, responsable: pastora, reciente: true,
    descripcion: 'Noche para parejas y amigos con cena, música en vivo y una palabra sobre la amistad.' });
  if (!plant && a.probabilidad(0.35)) nuevo({ tipo: 'especial', titulo: 'Tarde de integración de los grupos familiares', fecha: '2026-09-20',
    hora: '16:00', horaFin: '18:30', responsable: pastor, reciente: true,
    descripcion: 'Encuentro de todos los grupos familiares de la sede: testimonios, onces y oración por los líderes.' });
  if (!plant && a.probabilidad(0.15)) nuevo({ tipo: 'reunion', titulo: 'Reunión de coordinación de la semana', fecha: HOY, hora: '19:00',
    horaFin: '20:30', lugar: 'Salón de reuniones de la sede', responsable: pastor,
    descripcion: 'Revisión de la agenda de la semana con los coordinadores de ministerio.' });
  /* Acción de Gracias en Estados Unidos. */
  if (s.pais === 'US') nuevo({ tipo: 'servicio', titulo: 'Servicio de Acción de Gracias', fecha: '2026-11-26', hora: '18:00', horaFin: '20:30',
    publico: true, responsable: pastor, descripcion: 'Servicio especial por el Día de Acción de Gracias y cena compartida para las familias de la sede.' });
  /* Clausura de cada semestre del Instituto y graduación de la Escuela de liderazgo. */
  const finesIB = new Map();
  for (const h of cohortes) {
    if (h.host.id !== s.id || h.clase !== 'instituto' || h.red || !h.termina) continue;
    const k = h.codigo.slice(-6);
    finesIB.set(k, maxFecha(finesIB.get(k) ?? h.termina, h.termina));
  }
  for (const f of finesIB.values()) nuevo({ tipo: 'especial', titulo: 'Clausura del semestre del Instituto bíblico',
    fecha: siguiente(sumarDias(f, 1), 5), hora: '19:00', horaFin: '21:30', responsable: pastor,
    descripcion: 'Cierre del semestre con los estudiantes y sus familias, y entrega de los certificados de los cursos aprobados.' });
  const lid4 = cohortes.find(h => h.host.id === s.id && h.curso === 'LID-04' && h.fase === 'pasada' && !h.sinCalificar);
  if (lid4) nuevo({ tipo: 'especial', titulo: 'Graduación de la Escuela de liderazgo', fecha: siguiente(sumarDias(lid4.termina, 7), 6),
    hora: '17:00', horaFin: '20:00', publico: true, responsable: pastora,
    descripcion: 'Graduación de la promoción que terminó los dos semestres de la Escuela de liderazgo, con entrega de diplomas.' });
  /* Plantaciones: el culto de apertura. */
  if (plant && fundada && fundada >= arranque) nuevo({ tipo: 'servicio', titulo: 'Culto de apertura de la plantación', fecha: fundada,
    hora: '10:00', horaFin: '12:30', publico: true, responsable: pastor, creador: 'PASTOR_CONGREGACIONAL',
    descripcion: `Primer servicio de ${s.nombre}, con el equipo que envió la sede madre y los vecinos invitados.` });
  return lista;
}

/** Qué pasó con cada evento: lo pasado se hizo (o se canceló, o nadie lo marcó); lo que viene sigue en pie. */
function destinoDe(ev, a) {
  if (ev.destino) return ev.destino;
  const fin = ev.fechaFin ?? ev.fecha;
  const cancelable = ev.tipo !== 'servicio' && ev.tipo !== 'conferencia';
  if (fin < HOY) {
    if (ev.reciente) return a.ponderado({ realizado: 55, programado: 42, cancelado: cancelable ? 3 : 0 });
    return a.ponderado({ realizado: 93, cancelado: cancelable ? 5 : 0, programado: 2 });
  }
  if (ev.titulo === 'Reunión de líderes' && ev.fecha >= '2026-10-22' && ev.fecha <= '2026-10-26') {
    ev.motivo = MOTIVOS_FUTUROS[1];
    return 'cancelado';
  }
  if (ev.tipo === 'retiro' && a.probabilidad(0.3)) { ev.motivo = MOTIVOS_FUTUROS[0]; return 'cancelado'; }
  if (ev.alabanza && a.probabilidad(0.15)) { ev.motivo = MOTIVOS_FUTUROS[2]; return 'cancelado'; }
  return 'programado';
}

async function poblarCalendario(c, az, ctx, cohortes) {
  const eventos = [...eventosDeLaRed(ctx, az)];
  for (const s of ctx.sedes) eventos.push(...eventosDeSede(ctx, az.derivar(`agenda:${s.codigo}`), s, cohortes));
  const a = az.derivar('destinos');
  const PP = { persona_id: ctx.pp.id, sede_ids: [], nivel_max: 4, alcance_global: true };
  const { rows: fs } = await c.query(`SELECT to_char(fecha, 'YYYY-MM-DD') AS f FROM sistema.festivos WHERE pais = 'CO'`);
  const lunesFestivos = [...FESTIVOS_2025, ...fs.map(r => r.f)].filter(f => diaSemana(f) === 1);
  const enPuente = (ev) => ev.sede.pais === 'CO' && lunesFestivos.some(f => ev.fecha >= sumarDias(f, -3) && ev.fecha <= f);
  for (const ev of eventos) {
    ev.estado = destinoDe(ev, a);
    if (ev.estado === 'cancelado' && !ev.motivo) {
      ev.motivo = ev.tipo === 'retiro' ? a.elegir(MOTIVOS_RETIRO)
        : enPuente(ev) && a.probabilidad(0.8) ? MOTIVO_PUENTE : a.elegir(MOTIVOS_CANCELACION);
    }
    const arranque = ev.red ? ctx.salida(ctx.madre) : maxFecha(ctx.salida(ev.sede), FUNDADA[ev.sede.codigo] ?? '2000-01-01');
    ev.creado = minFecha(AYER, maxFecha(arranque, sumarDias(ev.fecha, -a.entero(8, 40))));
    ev.marcado = minFecha(AYER, maxFecha(ev.creado, sumarDias(ev.fechaFin ?? ev.fecha, ev.estado === 'cancelado' && (ev.fechaFin ?? ev.fecha) >= HOY
      ? -a.entero(3, 20) : a.entero(0, 3))));
    ev.autor = ev.red ? PP : ctx.autor(ev.sede, ev.creado, ev.creador);
  }
  const fila = (ev) => ({
    id: ev.id, sede_id: ev.sede.id, alcance_red: ev.red, tipo: ev.tipo, titulo: ev.titulo, descripcion: ev.descripcion ?? null,
    lugar: ev.lugar ?? null, inicia: momentoLocal(ev.fecha, ev.hora, ev.sede.zona_horaria),
    termina: momentoLocal(ev.fechaFin ?? ev.fecha, ev.horaFin, ev.sede.zona_horaria), publico: Boolean(ev.publico),
    cupo: ev.cupo ?? null, responsable_id: idDe(ev.responsable), estado: 'programado',
    creado_en: momentoLocal(ev.creado, a.horaEntre('08:00', '18:00', 5), ev.sede.zona_horaria),
  });
  await porAutor(c, eventos.filter(e => e.red).map(ev => ({ autor: ev.autor, fila: fila(ev) })), 'Agenda de la red',
    (filas) => insertarLote(c, 'org.eventos', filas));
  await porAutor(c, eventos.filter(e => !e.red).map(ev => ({ autor: ev.autor, fila: fila(ev) })), 'Agenda de la sede',
    (filas) => insertarLote(c, 'org.eventos', filas));

  /* «Se hizo» y «Cancelar», como en la pantalla: lo marca la secretaría (o el pastor) después. */
  const marca = (ev) => (ev.red ? PP : ctx.autor(ev.sede, ev.marcado, 'SECRETARIA'));
  await porAutor(c, eventos.filter(e => e.estado === 'realizado').map(ev => ({ autor: marca(ev), fila: ev.id })),
    'Evento realizado', async (ids) => {
      await c.query(`UPDATE org.eventos SET estado = 'realizado' WHERE id = ANY($1::uuid[])`, [ids]);
    });
  await porAutor(c, eventos.filter(e => e.estado === 'cancelado').map(ev => ({ autor: marca(ev), fila: { id: ev.id, motivo: ev.motivo } })),
    'Evento cancelado', async (filas) => {
      await c.query(
        `UPDATE org.eventos e SET estado = 'cancelado', motivo_cancelacion = v.motivo
           FROM unnest($1::uuid[], $2::text[]) AS v(id, motivo) WHERE e.id = v.id`,
        [filas.map(f => f.id), filas.map(f => f.motivo)]);
    });
  return eventos;
}

/* ─────────────────────────────────────────────────────────────────────
   11 · EL POBLADOR
   ───────────────────────────────────────────────────────────────────── */
d.ejecutar({ archivo: ARCHIVO, tema: 'formación, temáticas y calendario' }, async (c, azar) => {
  /* Se mira el linaje propio (source_id «demo-cohorte-…»): si otro poblador llegara a abrir cohortes de
     la demostración, este no debe creer que ya corrió. */
  if (await d.yaPoblado(c, `SELECT count(*) FROM formacion.cohortes WHERE source_system = $1 AND source_id LIKE 'demo-cohorte-%'`,
    [SISTEMA], 'formación, temáticas y calendario')) return;
  let cohortes, series, eventos;
  await enTransaccion(c, async () => {
    const ctx = await prepararContexto(c);
    if (!ctx.madre || !ctx.pp || !ctx.ppa) throw new Error('Falta el núcleo: corra primero 00-red.js (sede madre y dirección general).');
    cohortes = await poblarFormacion(c, azar.derivar('formacion'), ctx);
    series = planearTematicas(ctx, azar.derivar('tematicas'));
    await escribirTematicas(c, ctx, azar.derivar('tematicas-escritura'), series);
    eventos = await poblarCalendario(c, azar.derivar('calendario'), ctx, cohortes);
  });
  const conteos = await d.contarFilas(c, ['formacion.programas', 'formacion.cursos', 'formacion.cohortes',
    'formacion.inscripciones', 'formacion.certificados', 'formacion.series', 'formacion.ensenanzas', 'org.eventos']);
  const porFase = (f) => cohortes.filter(h => h.fase === f).length;
  return {
    ...conteos,
    'cohortes pasadas · actuales · próximas': `${porFase('pasada')} · ${porFase('actual')} · ${porFase('proxima')}`,
    'cohortes que nadie cerró': cohortes.filter(h => h.vencida).length,
    'series de la red · de las sedes': `${series.filter(s => s.red).length} · ${series.filter(s => !s.red).length}`,
    'eventos de la red · de las sedes': `${eventos.filter(e => e.red).length} · ${eventos.filter(e => !e.red).length}`,
    'eventos próximos (hasta el 30 de noviembre)': eventos.filter(e => (e.fechaFin ?? e.fecha) >= HOY).length,
    'eventos que pasaron sin marcar': eventos.filter(e => e.estado === 'programado' && (e.fechaFin ?? e.fecha) < HOY).length,
  };
});
