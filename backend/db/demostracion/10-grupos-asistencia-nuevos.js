'use strict';
/**
 * =====================================================================
 * 10-grupos-asistencia-nuevos.js · GRUPOS, ASISTENCIA Y NUEVOS (4C)
 *
 * ⛔ SOLO DEMOSTRACIÓN. Los grupos, las reuniones, los servicios, los
 *    conteos, las marcas de entrada, los nuevos y sus llamadas son
 *    inventados, sobre las personas inventadas del núcleo (00-red.js).
 *    La guarda de comun.js se niega a correr fuera de las bases de
 *    desarrollo. Jamás va a producción.
 *
 * Lo que deja, por las reglas de la base y no alrededor de ellas:
 *
 *   1. GRUPOS en las 36 sedes, de los cuatro tipos del catálogo
 *      (familiar, pequeño, discipulado y ministerial) y los de tMt
 *      Legado con su segmento. Cada grupo tiene su líder con el rol
 *      LIDER_GRUPO sobre SU grupo (otorgado con acta por la dirección con
 *      identidad.otorgar_asignacion) y su cuenta, como en el núcleo;
 *      colíderes (casi siempre el cónyuge), anfitriones y aprendices.
 *      Donde hay segmento Legado: su director y, en las sedes grandes, su
 *      coordinador (DIRECTOR_SEGMENTO y COORDINADOR_SEGMENTO). En las
 *      sedes que marcan con QR, quien toma la asistencia
 *      (ASISTENCIA_REGISTRO). Las reuniones se reportan cada semana
 *      desde que la sede salió en vivo: la mayoría al día, otras que
 *      llevan semanas sin reportar, dos recién abiertos que todavía no se
 *      reúnen y unos pocos que se cerraron y se unieron a otro grupo.
 *      Las salidas llevan su motivo y se registran como las registra la
 *      API (UPDATE de fecha_salida), así la historia dice SALIDA_GRUPO.
 *
 *   2. ASISTENCIA: los servicios de cada sede desde su salida en vivo
 *      (domingos según su tamaño, la noche de oración, el culto de mitad
 *      de semana, el Encuentro tMt, Nochebuena, Viernes Santo y las
 *      conferencias), todos del catálogo tipo_servicio y con el conteo de
 *      la puerta (con temporada: diciembre y Resurrección suben, enero y
 *      los puentes bajan). Desde el 28 de junio de 2026 las sedes grandes
 *      y las medianas de más de cien personas marcan la entrada con QR:
 *      hay marcas por persona en los últimos trece domingos, y familias
 *      que venían seguido y dejaron de venir en agosto, para que
 *      «¿Quién se nos está perdiendo?» tenga a quién mostrar.
 *
 *   3. NUEVOS (la bandeja del recorrido 4C): primeras visitas por la web y
 *      por la tarjeta de bienvenida, llamadas y mensajes con su reacción y
 *      su siguiente paso (crm.contactos_nuevos solo se agrega), unos
 *      atrasados, otros por contactar hoy, no interesados y personas
 *      integradas con crm.convertir_en_miembro (la de seis argumentos: con
 *      grupo y padrino). Los integrados son visitantes que el núcleo ya
 *      tenía en el registro maestro con su correo: la conversión los
 *      VINCULA, no los duplica. El recorrido 4C abre en «conoce» con la
 *      fecha de llegada y pasa a «conéctate» cuando entran a un grupo.
 *
 * Correcciones por UPDATE, con autor y motivo (como en el núcleo):
 *   · convertir_en_miembro sella convertido_en con now() aunque reciba la
 *     fecha de la decisión: se corrige convertido_en a la fecha real. El
 *     hecho CAMBIO_ETAPA que escribe la función no se puede corregir (la
 *     línea de tiempo no admite UPDATE): queda con la fecha de hoy. Es un
 *     defecto de la base y está en el informe.
 *   · Los avisos que encolan los disparadores de la bandeja (bienvenida,
 *     aviso al coordinador y confirmación) nacen con now(): se les pone la
 *     fecha del hecho. Los anteriores a ayer los mueve el trabajador de la
 *     base (plataforma.tomar_notificaciones y marcar_notificacion) y se
 *     les pone la hora en que habrían salido; los de ayer quedan en cola
 *     para el trabajador de 60. Solo si en la cola no hay nada más.
 *   · Quien no era «líder» y fue nombrado líder de grupo pasa a nivel de
 *     compromiso «lider» (lo hace la secretaría en la ficha).
 *
 * Quién recibe un cargo aquí: líderes bautizados sin ningún rol (ni
 * personal ni heredado de un equipo) que llevan tiempo en la sede; si no
 * alcanzan, un miembro bautizado. Todos quedan con cuenta (clave de
 * laboratorio, como en el núcleo). El líder de un grupo que se cerró
 * queda con el cargo vencido y la cuenta suspendida. El comité de hoy,
 * que en el núcleo recertificó la región Bogotá, revisa también los
 * cargos nuevos de esa región; los de las demás quedan por revisar.
 *
 * Defectos de la base que se vieron al poblar (respetados, no se tocó
 * nada; la reproducción está en el informe del poblador):
 *   1. Un LIDER_GRUPO ve todos los grupos de su sede, lee los integrantes
 *      de los demás, reporta reuniones y saca gente de grupos que no son
 *      el suyo: el alcance «grupo» se vuelve «sede» (identidad.sedes_de
 *      y la RLS de grupos miran la sede).
 *   2. plataforma.tomar_notificaciones descarta como «Consentimiento
 *      revocado antes del envío» los avisos de finalidad administrativa
 *      (base legal contrato): el coordinador nunca recibe el aviso de un
 *      nuevo y el integrado nunca recibe su confirmación.
 *   3. DIRECTOR_SEGMENTO, COORDINADOR_SEGMENTO y LIDER_GRUPO se otorgan
 *      sobre segmentos y grupos de menores sin antecedentes.
 *   4. convertir_en_miembro ignora la fecha de la decisión (convertido_en
 *      y el hecho CAMBIO_ETAPA salen con la fecha de hoy) y parte el
 *      nombre por el primer espacio («Samuel David Villamil» queda con
 *      apellido «David Villamil»).
 *   5. Con el grupo cerrado, grupos.tg_grupo_abierto también frena el
 *      UPDATE: nadie puede registrar la salida de sus integrantes y el
 *      mensaje dice «no admite membresías nuevas».
 *   6. La bandeja muestra a los «no interesados» y, como el contacto
 *      conserva la fecha anterior, muchos salen «CONTACTAR HOY».
 *
 * Para los demás pobladores:
 *   · Los servicios dominicales ya existen (asistencia.servicios, tipo
 *     'dominical'). ⛔ RocaKids NO debe crear otro servicio a la misma
 *     hora: la base tiene UNIQUE (sede_id, fecha, hora_inicio, tipo).
 *     Búsquelo: SELECT id FROM asistencia.servicios WHERE sede_id = $1
 *     AND fecha = $2 AND tipo = 'dominical' ORDER BY hora_inicio.
 *   · ⛔ No hay grupos de menores (Pulso, Eco ni RocaKids) ni roles sobre
 *     esos segmentos: su liderazgo exige antecedentes, y la base no los
 *     pide a LIDER_GRUPO ni a DIRECTOR_SEGMENTO (defecto en el informe).
 *
 * Corre en UNA transacción: o queda todo, o no queda nada. Si ya corrió
 * (hay grupos de la demostración), avisa y sale sin duplicar.
 * Uso: PGDATABASE=cr_e2e_61 node backend/db/demostracion/10-grupos-asistencia-nuevos.js
 * =====================================================================
 */
const path = require('path');
const d = require('./comun');
const {
  FECHA_REFERENCIA: HOY, AYER, SISTEMA, SALIDAS_POR_OLA, CLAVE_LABORATORIO,
  sumarDias, diasEntre, diaSemana, momentoLocal, minFecha, maxFecha, fechasDelDia, domingosEntre,
  aMinutos, insertarLote, fijarAutor,
} = d;

/* La derivación de la clave es la de la API: la misma que usa token-para.js. */
const { derivarClave } = require(path.join(__dirname, '..', '..', 'api', 'dist', 'src', 'auth', 'clave.js'));

const ARCHIVO = 10;
const MOTIVO = 'Red de demostración · grupos, asistencia y nuevos';

/** Domingo en que las sedes grandes estrenaron el registro de entrada con QR. */
const INICIO_QR = '2026-06-28';
/** Límite de lo que ya pasó: lo más reciente que se inventa es de ayer. */
const TOPE = AYER;

/* ─────────────────────────────────────────────────────────────────────
   1 · CALENDARIO, HORAS Y TEXTOS EN CASTELLANO
   ───────────────────────────────────────────────────────────────────── */

const DIAS_TXT = { domingo: 'domingo', lunes: 'lunes', martes: 'martes', miercoles: 'miércoles',
  jueves: 'jueves', viernes: 'viernes', sabado: 'sábado' };
const IDX_DIA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

/** '08:00' → '8:00 a. m.' · '12:00' → '12:00 m.' · '17:00' → '5:00 p. m.' */
function hora12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === 12 && m === 0) return '12:00 m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Fecha y hora local desplazadas unos minutos (puede cruzar la medianoche). */
function mover(fecha, hhmm, minutos = 0) {
  const total = aMinutos(hhmm) + minutos;
  const dia = Math.floor(total / 1440);
  const m = ((total % 1440) + 1440) % 1440;
  return { fecha: sumarDias(fecha, dia), hora: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` };
}
/** Instante con zona (timestamptz) y su llave ordenable local 'AAAA-MM-DD HH:MM'. */
function instante(fecha, hhmm, zona, minutos = 0) {
  const x = mover(fecha, hhmm, minutos);
  return { iso: momentoLocal(x.fecha, x.hora, zona), llave: `${x.fecha} ${x.hora}`, fecha: x.fecha, hora: x.hora };
}

/** Festivos de lunes en Colombia antes de 2026 (los de 2026 salen de sistema.festivos). */
const FESTIVOS_2025 = ['2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25'];
/** Domingos antes de un festivo en Estados Unidos (Memorial Day, 4 de julio, Labor Day). */
const PUENTES_US = ['2026-05-24', '2026-07-05', '2026-09-06'];

/**
 * La guía semanal de los grupos (la serie que la iglesia predica). Cada
 * serie arranca un lunes; cada título es una semana.
 */
const SERIES = [
  ['2025-09-01', 'Raíces', ['identidad en Cristo', 'la Palabra que sostiene', 'una vida de oración',
    'comunidad que sana', 'generosidad que libera', 'enviados a servir']],
  ['2025-10-13', 'Familias sobre la Roca', ['el diseño de Dios para la familia', 'perdonar en casa',
    'padres que bendicen', 'finanzas en familia', 'hijos con propósito']],
  ['2025-11-17', 'Gratitud', ['un corazón agradecido', 'contentos en toda situación', 'gratitud en medio de la prueba']],
  ['2025-12-08', 'Emanuel', ['la esperanza que llegó', 'paz para los que Él ama']],
  ['2026-01-12', 'Corazón nuevo', ['21 días de ayuno y oración', 'renovar la mente', 'metas con propósito',
    'hábitos que transforman']],
  ['2026-02-09', 'Amor que permanece', ['el amor es paciente', 'amistades que edifican', 'matrimonios firmes',
    'amar al prójimo']],
  ['2026-03-09', 'Camino a la cruz', ['Getsemaní', 'el precio de la gracia', 'el Rey que sirve']],
  ['2026-04-06', 'Resurrección', ['la tumba está vacía']],
  ['2026-04-13', 'Hechos: la iglesia en movimiento', ['el poder de Pentecostés', 'una iglesia que ora',
    'todo lo tenían en común', 'Esteban, fe bajo presión', 'Felipe y el etíope', 'Saulo, una vida transformada',
    'Pedro y Cornelio']],
  ['2026-06-01', 'Sabiduría para la vida', ['el temor del Señor', 'palabras que construyen', 'trabajo y diligencia',
    'amigos verdaderos', 'el dinero y el corazón', 'la familia que Dios bendice']],
  ['2026-07-13', 'Llamados a servir', ['dones para edificar', 'servir con excelencia', 'liderar como Jesús',
    'la iglesia en la ciudad', 'perseverar sin cansarse']],
  ['2026-08-17', 'El fruto del Espíritu', ['amor', 'gozo', 'paz', 'paciencia', 'amabilidad y bondad', 'fidelidad',
    'dominio propio']],
];
/** El tema de la guía para la semana de una fecha. */
function temaGuia(fecha) {
  let elegido = null;
  for (const [inicio, serie, titulos] of SERIES) {
    const dias = diasEntre(inicio, fecha);
    if (dias < 0) break;
    const semana = Math.floor(dias / 7);
    if (semana < titulos.length) elegido = `${serie}: ${titulos[semana]}`;
  }
  if (fecha >= '2026-05-04' && fecha <= '2026-05-10') return 'Mujeres de fe: honramos a las madres';
  if (fecha >= '2026-06-15' && fecha <= '2026-06-21') return 'Padres que dejan huella';
  return elegido;
}
/** Receso de los grupos: fin de año y Semana Santa. */
const enReceso = (f) => (f >= '2025-12-20' && f <= '2026-01-11') || (f >= '2026-03-29' && f <= '2026-04-05');

/** Temas propios de cada clase de grupo (cuando no siguen la guía). */
const TEMAS_PROPIOS = {
  familiar: ['Noche de testimonios', 'Oración por las familias del barrio', 'Compartir y alabanza',
    'Estudio del Salmo 23', 'Oración por los enfermos', 'Cena compartida y oración'],
  pequeno: ['Oración unos por otros', 'Testimonios de la semana', 'Estudio de Filipenses', 'Desayuno de compañerismo'],
  nicodemo: ['Primeros pasos 1: ¿quién es Jesús?', 'Primeros pasos 2: la salvación', 'Primeros pasos 3: la oración',
    'Primeros pasos 4: la Biblia', 'Primeros pasos 5: la iglesia', 'Primeros pasos 6: el bautismo',
    'Primeros pasos 7: el Espíritu Santo', 'Primeros pasos 8: compartir la fe'],
  formacion: ['Formación de líderes: el carácter del líder', 'Formación de líderes: cómo dirigir un grupo',
    'Formación de líderes: escuchar y acompañar', 'Formación de líderes: la multiplicación',
    'Formación de líderes: cuidar al que se aleja', 'Formación de líderes: orar por su gente'],
  alabanza: ['Ensayo del repertorio del domingo', 'Ensayo y oración por el servicio', 'Taller de voces',
    'Planeación de turnos del mes'],
  ujieres: ['Turnos del mes y oración', 'Protocolo de bienvenida', 'Cómo recibir a quien viene por primera vez',
    'Primeros auxilios básicos'],
  visa: ['Revisión de consola y micrófonos', 'Transmisión en vivo: ensayo', 'Turnos del mes y oración'],
  legado: ['Noche de alabanza y Palabra', 'Propósito y vocación', 'Noviazgo con propósito', 'Fe en la universidad',
    'Salud mental y fe', 'Finanzas para jóvenes', 'Servir en la ciudad', 'Amistades que edifican'],
};

/** Motivos de salida de un grupo (el API exige al menos cinco letras). */
const MOTIVOS_SALIDA = [
  (x) => `Cambió de turno en el trabajo y ya no puede asistir los ${x.dia}.`,
  () => 'Empezó a estudiar en la noche; volverá cuando termine el semestre.',
  () => 'Dejó de asistir; se le llamó varias veces sin respuesta.',
  () => 'Pasó al grupo más cerca de su nueva casa.',
  () => 'Por la salud de su mamá no puede salir en las noches; el grupo la visita.',
  (x) => `Se mudó a ${x.ciudad} por trabajo; se le conectó con la sede de allá.`,
  () => 'Se integró a un equipo de servicio y los horarios se cruzan.',
];
const CIUDADES_MUDANZA = ['Medellín', 'Cali', 'Bogotá', 'Barranquilla', 'Bucaramanga', 'Pereira', 'Chía', 'Madrid'];

/* ─────────────────────────────────────────────────────────────────────
   2 · PLANTILLAS DE GRUPO
   ───────────────────────────────────────────────────────────────────── */
const PLANTILLAS = {
  mujeres: { clase: 'pequeno', tipo: 'pequeno', ministerio: 'MUJER_INTEGRAL', nombre: 'Mujer Integral · Mujeres de propósito',
    genero: 'F', edad: [24, 70], dias: [['martes', '09:30'], ['jueves', '19:00']], tamano: [7, 13] },
  hombres: { clase: 'pequeno', tipo: 'pequeno', ministerio: 'HOMBRES_BIEN', nombre: 'Hombres de Bien · Desayuno de los sábados',
    genero: 'M', edad: [24, 72], dias: [['sabado', '07:00']], tamano: [6, 12] },
  dorados: { clase: 'pequeno', tipo: 'pequeno', ministerio: 'DORADOS', nombre: 'Años Dorados · Tertulia y oración',
    edad: [58, 99], dias: [['miercoles', '10:00']], tamano: [6, 12] },
  ejecutivos: { clase: 'pequeno', tipo: 'pequeno', ministerio: 'EJECUTIVOS', nombre: 'Ejecutivos y Empresarios · Reino en los negocios',
    edad: [28, 62], dias: [['martes', '06:30']], tamano: [5, 10] },
  parejas: { clase: 'pequeno', tipo: 'pequeno', ministerio: null, nombre: 'Parejas · Matrimonios con propósito',
    parejas: true, edad: [23, 58], dias: [['viernes', '19:30']], tamano: [8, 14] },
  nicodemo: { clase: 'nicodemo', tipo: 'discipulado', ministerio: 'NICODEMO', nombre: 'Discipulado Nicodemo · Primeros pasos',
    nuevos: true, edad: [18, 80], dias: [['domingo', '13:00'], ['martes', '19:00']], tamano: [4, 7], cupo: 8 },
  formacion: { clase: 'formacion', tipo: 'discipulado', ministerio: null, nombre: 'Discipulado · Líderes en formación',
    bautizados: true, edad: [21, 48], dias: [['sabado', '08:00']], tamano: [5, 8], cupo: 10, cerradoANuevos: true },
  alabanza: { clase: 'alabanza', tipo: 'ministerial', ministerio: 'ALABANZA', nombre: 'Alabanza · Ensayo y oración',
    edad: [18, 48], dias: [['jueves', '19:00'], ['sabado', '15:00']], tamano: [8, 14] },
  ujieres: { clase: 'ujieres', tipo: 'ministerial', ministerio: 'UJIERES', nombre: 'Ujieres · Equipo de bienvenida',
    edad: [25, 70], dias: [['domingo', '07:00']], tamano: [8, 14] },
  visa: { clase: 'visa', tipo: 'ministerial', ministerio: 'VISA', nombre: 'VISA · Técnica y sonido',
    edad: [18, 45], dias: [['sabado', '14:00']], tamano: [5, 9] },
  legado: { clase: 'legado', tipo: 'pequeno', ministerio: 'TMT', segmento: 'LEGADO', nombre: 'tMt Legado · Universitarios',
    edad: [19, 25], liderEdad: [23, 36], dias: [['viernes', '18:30']], tamano: [8, 16], cupo: 25 },
  legado2: { clase: 'legado', tipo: 'pequeno', ministerio: 'TMT', segmento: 'LEGADO', nombre: 'tMt Legado · Jóvenes profesionales',
    edad: [21, 25], liderEdad: [24, 38], dias: [['sabado', '18:00']], tamano: [7, 14], cupo: 25 },
  familiar: { clase: 'familiar', tipo: 'familiar', ministerio: null, nombre: null,
    dias: [['martes', '19:30'], ['miercoles', '19:30'], ['jueves', '19:30'], ['viernes', '20:00'], ['sabado', '17:00'],
      ['jueves', '20:00'], ['martes', '20:00']], tamano: [7, 15] },
};

/* ─────────────────────────────────────────────────────────────────────
   3 · LA BANDEJA DE NUEVOS: LO QUE ESCRIBEN Y LO QUE SE HABLA
   ───────────────────────────────────────────────────────────────────── */
const COMENTARIOS = [
  () => 'Vine invitado por una compañera de trabajo. Me gustaría saber de los grupos para parejas.',
  (x) => `Me mudé hace poco a ${x.ciudad} y estoy buscando una iglesia cerca de mi casa.`,
  () => 'Estoy pasando por un momento difícil con mi salud y quiero que oren por mí.',
  () => 'Quisiera información sobre el bautizo.',
  () => 'Tengo dos hijos pequeños, ¿qué actividades hay para niños?',
  () => 'Me gustó mucho la alabanza. ¿Cómo puedo servir?',
  () => 'Quiero reconciliarme con Dios.',
  () => 'Mi esposo no es creyente; les pido que oren por mi matrimonio.',
  () => '¿Tienen grupo de jóvenes universitarios?',
  () => 'Me invitaron a la conferencia y quiero seguir viniendo.',
  () => 'Estoy buscando un grupo cerca del trabajo, entre semana.',
  () => 'Perdí a mi papá hace unos meses y necesito una comunidad.',
];
const COMENTARIO_VE = 'Llegué de Venezuela hace poco y estoy buscando una comunidad.';

const RESUMEN = {
  llamada: {
    interesado: [
      (x) => `Llamada de bienvenida a ${x.nombre}. Le gustó mucho la alabanza y quiere conocer un grupo familiar cerca de su casa.`,
      (x) => `${x.nombre} contestó con alegría; pregunta por el curso Primeros pasos y por los horarios del domingo.`,
      (x) => `Hablamos casi media hora con ${x.nombre}: está pasando un momento difícil en el trabajo y agradeció la oración.`,
      (x) => `${x.nombre} quiere traer a su familia el próximo domingo; le interesa el grupo familiar de su barrio.`,
      (x) => `${x.nombre} dice que se sintió en casa desde el primer día y quiere empezar a servir.`,
    ],
    dudoso: [
      (x) => `${x.nombre} dice que todavía está conociendo varias iglesias; prefiere que le escribamos más adelante.`,
      (x) => `${x.nombre} tiene turnos rotativos y no sabe si puede comprometerse con un grupo.`,
      (x) => `${x.nombre} vino con una amiga y no está seguro de volver; se le invitó al culto de mitad de semana.`,
    ],
    no_contesto: [
      () => 'No contestó. Se dejó mensaje de voz presentando la iglesia.',
      () => 'Timbró sin respuesta; se intentará de nuevo en la tarde.',
      () => 'El número suena apagado.',
      () => 'Contestó otra persona y dijo que no estaba; se dejó razón.',
    ],
    no_interesado: [
      () => 'Agradeció la llamada, pero ya se congrega en otra iglesia cerca de su casa. Se cierra el seguimiento con respeto.',
      () => 'Vino solo al bautizo de su sobrino; no desea más contacto.',
      () => 'Pidió que no lo llamemos más; se respeta y se cierra.',
      () => 'Después de varios intentos sin respuesta se cierra el seguimiento.',
    ],
  },
  whatsapp: {
    interesado: [
      () => 'Respondió por WhatsApp: agradece el mensaje y confirma que vuelve el domingo con su familia.',
      () => 'Pidió por WhatsApp la ubicación del grupo familiar; se le envió la dirección y el horario.',
      () => 'Por WhatsApp contó que quiere bautizarse; se le enviaron las fechas del curso.',
    ],
    dudoso: [() => 'Contestó por WhatsApp que esta semana está muy ocupado; que le escribamos después.'],
    no_contesto: [() => 'Mensaje de WhatsApp enviado; lo leyó pero no respondió.', () => 'Mensaje de WhatsApp sin leer.'],
    no_interesado: [() => 'Respondió por WhatsApp que no desea recibir más mensajes. Se respeta y se cierra.'],
  },
  visita: {
    interesado: [() => 'Visita en casa con la pareja pastoral: oramos por la salud de su mamá y conoció a los líderes del grupo de su barrio.',
      () => 'Visita en casa: conocimos a la familia y quedaron de ir al grupo familiar el jueves.'],
  },
  email: {
    interesado: [() => 'Respondió el correo de bienvenida pidiendo información del bautizo.'],
    no_contesto: [() => 'Se le escribió por correo con los horarios; no respondió.'],
  },
  mensaje: {
    interesado: [() => 'Mensaje de texto con el horario del domingo; respondió que allá estará.'],
    no_contesto: [() => 'Mensaje de texto con el horario del domingo; sin respuesta.'],
  },
};
const SIGUIENTE = {
  interesado: [
    (x) => x.grupo ? `Invitarlo al ${x.grupo}` : 'Presentarle a los líderes del grupo familiar el domingo',
    () => 'Enviarle por WhatsApp los horarios del curso Primeros pasos',
    () => 'Presentarle a los líderes del grupo familiar el domingo',
    () => 'Agendar una visita en casa con la pareja pastoral',
    () => 'Llamar el jueves para confirmar que viene al grupo',
  ],
  dudoso: [() => 'Volver a llamar en dos semanas', () => 'Esperar a que escriba; invitarlo a la noche de oración',
    () => 'Pasar el caso a la pareja pastoral'],
  no_contesto: [() => 'Intentar de nuevo en la tarde', () => 'Escribirle por WhatsApp', () => 'Llamar el sábado en la mañana'],
};
const NOTAS_PRIVADAS = [
  'Mencionó que está en proceso de separación; pidió discreción.',
  'Tiene una hija en tratamiento médico; prefiere que no se comente en el grupo.',
  'Está sin trabajo desde hace tres meses; se le habló del fondo de ayuda de la sede.',
  'Viene de una experiencia dolorosa en otra iglesia; hay que ir despacio.',
  'Pidió que no la llamen a la oficina, solo por WhatsApp.',
];
/** Transiciones de la reacción de una llamada a la siguiente (pesos). */
const TRANSICION = {
  inicio: { no_contesto: 35, interesado: 42, dudoso: 18, no_interesado: 5 },
  no_contesto: { no_contesto: 40, interesado: 35, dudoso: 17, no_interesado: 8 },
  interesado: { interesado: 72, dudoso: 18, no_contesto: 6, no_interesado: 4 },
  dudoso: { interesado: 38, dudoso: 30, no_contesto: 17, no_interesado: 15 },
};

/* ─────────────────────────────────────────────────────────────────────
   4 · AYUDAS PEQUEÑAS
   ───────────────────────────────────────────────────────────────────── */
const agrupar = (xs, llave) => {
  const m = new Map();
  for (const x of xs) { const k = llave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
};
const anio = (f) => f.slice(0, 4);
/** Quién tenía un rol en una fecha (lista de {persona_id, desde, hasta}). */
const vigenteEn = (lista, fecha) => (lista ?? []).filter(a => a.desde <= fecha && (!a.hasta || a.hasta >= fecha));

d.ejecutar({ archivo: ARCHIVO, tema: 'grupos, asistencia y nuevos (recorrido 4C)' }, async (c, azar) => {
  const t0 = Date.now();
  const paso = (t) => console.log(`   … ${t} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  // ⛔ No se corre dos veces.
  if (await d.yaPoblado(c, `SELECT count(*) FROM grupos.grupos WHERE source_system = $1`, [SISTEMA],
    'grupos, asistencia y nuevos')) return;
  const { rows: [nucleo] } = await c.query(`SELECT count(*)::int AS n FROM nucleo.personas WHERE source_system = $1`, [SISTEMA]);
  if (!nucleo.n) throw new Error('Falta el núcleo: corra primero 00-red.js (no hay personas de la demostración).');

  const u = await d.usadosEnLaBase(c);
  const hashClave = derivarClave(CLAVE_LABORATORIO);
  const conteo = {};

  await d.enTransaccion(c, async () => {
    /* ══ 0 · LO QUE YA HAY ══════════════════════════════════════════ */
    const [DG] = await d.direccionGeneral(c);
    if (!DG) throw new Error('No hay Pastor Principal vigente.');
    const autorDG = (motivo) => fijarAutor(c, { persona_id: DG.persona_id, sede_ids: [], nivel_max: 4,
      alcance_global: true, motivo: motivo ?? MOTIVO });
    const autor = (persona, sede, nivel, motivo) => fijarAutor(c, { persona_id: persona, sede_ids: sede ? [sede] : [],
      nivel_max: nivel ?? 2, alcance_global: false, motivo: motivo ?? MOTIVO });

    const { rows: rGolive } = await c.query(
      `SELECT a.alcance_id AS sede_id, to_char(min(a.vigente_desde), 'YYYY-MM-DD') AS desde
         FROM identidad.asignaciones a
        WHERE a.rol = 'PASTOR_CONGREGACIONAL' AND a.alcance_tipo = 'sede'
        GROUP BY 1`);
    const golive = Object.fromEntries(rGolive.map(r => [r.sede_id, r.desde]));
    const SEDES = (await d.sedes(c)).map(s => ({
      ...s, desde: golive[s.id] ?? SALIDAS_POR_OLA[s.ola_migracion] ?? d.INICIO_HISTORIA,
    }));
    const porCodigo = Object.fromEntries(SEDES.map(s => [s.codigo, s]));
    const porId = Object.fromEntries(SEDES.map(s => [s.id, s]));

    const { rows: gente } = await c.query(
      `SELECT p.id, p.sede_id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
              p.genero::text AS genero, to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fnac,
              date_part('year', age(DATE '${HOY}', p.fecha_nacimiento))::int AS edad,
              p.email_principal::text AS email, p.telefono_movil AS telefono, p.nivel_compromiso AS nivel,
              p.estado_civil, COALESCE(p.ha_sido_bautizado, false) AS bautizado, NULLIF(btrim(p.zona), '') AS zona,
              to_char(p.creado_en AT TIME ZONE s.zona_horaria, 'YYYY-MM-DD HH24:MI') AS creado_local,
              hm.hogar_id, h.source_id AS hogar_src,
              (SELECT to_char(min(m.desde), 'YYYY-MM-DD') FROM nucleo.membresias_sede m
                WHERE m.persona_id = p.id AND m.sede_id = p.sede_id) AS llego,
              /* Con rol: personal, o heredado de un equipo de la central o de una región. */
              (EXISTS (SELECT 1 FROM identidad.asignaciones a WHERE a.persona_id = p.id)
               OR EXISTS (SELECT 1 FROM org.unidad_miembros um WHERE um.persona_id = p.id)) AS con_rol,
              EXISTS (SELECT 1 FROM identidad.cuentas k WHERE k.persona_id = p.id) AS con_cuenta
         FROM nucleo.personas p
         JOIN org.sedes s ON s.id = p.sede_id
         LEFT JOIN grupos.hogar_miembros hm ON hm.persona_id = p.id AND hm.hasta IS NULL
         LEFT JOIN grupos.hogares h ON h.id = hm.hogar_id
        WHERE p.eliminado_en IS NULL AND p.estado::text = 'activa' AND p.fecha_nacimiento IS NOT NULL
        ORDER BY p.source_id NULLS FIRST, p.id`);
    for (const p of gente) {
      p.llego = p.llego ?? p.creado_local.slice(0, 10);
      p.mayor = d.sumarAnios(p.fnac, 18);   // desde cuándo es adulto: nadie entra a un grupo siendo menor
    }
    const persona = new Map(gente.map(p => [p.id, p]));
    const gentePorSede = agrupar(gente, p => p.sede_id);

    const { rows: rConyuges } = await c.query(
      `SELECT persona_id, relacionada_id FROM nucleo.vinculos WHERE tipo = 'CONYUGE' AND vigente_hasta IS NULL`);
    const conyugeDe = new Map(rConyuges.map(r => [r.persona_id, r.relacionada_id]));

    const { rows: rRoles } = await c.query(
      `SELECT a.persona_id, a.rol, a.alcance_id AS sede_id, p.genero::text AS genero,
              to_char(a.vigente_desde, 'YYYY-MM-DD') AS desde, to_char(a.vigente_hasta, 'YYYY-MM-DD') AS hasta
         FROM identidad.asignaciones a JOIN nucleo.personas p ON p.id = a.persona_id
        WHERE a.revocada_en IS NULL AND a.alcance_tipo = 'sede'
          AND a.rol IN ('PASTOR_CONGREGACIONAL', 'SECRETARIA', 'COORDINADOR_NUEVOS')
        ORDER BY a.rol, p.source_id NULLS FIRST, a.vigente_desde, a.persona_id`);
    const rolesSede = {};
    for (const r of rRoles) {
      const x = (rolesSede[r.sede_id] ??= { PASTOR_CONGREGACIONAL: [], SECRETARIA: [], COORDINADOR_NUEVOS: [] });
      x[r.rol].push(r);
    }
    for (const x of Object.values(rolesSede)) {
      x.PASTOR_CONGREGACIONAL.sort((a, b) => (a.genero === 'M' ? 0 : 1) - (b.genero === 'M' ? 0 : 1));
    }
    const pastoresDe = (s) => rolesSede[s.id]?.PASTOR_CONGREGACIONAL ?? [];
    /** La secretaría en una fecha; si no había, la pastora. */
    const secretariaEn = (s, f) => vigenteEn(rolesSede[s.id]?.SECRETARIA, f)[0]?.persona_id
      ?? pastoresDe(s)[1]?.persona_id ?? pastoresDe(s)[0]?.persona_id;

    const { rows: rSeg } = await c.query(
      `SELECT g.id, g.sede_id FROM org.segmentos g JOIN org.ministerios m ON m.id = g.ministerio_id
        WHERE m.codigo = 'TMT' AND g.codigo = 'LEGADO' AND g.activo`);
    const legadoDe = Object.fromEntries(rSeg.map(r => [r.sede_id, r.id]));
    const { rows: rMin } = await c.query(`SELECT id, codigo FROM org.ministerios`);
    const idMin = Object.fromEntries(rMin.map(r => [r.codigo, r.id]));

    const { rows: rFest } = await c.query(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS f FROM sistema.festivos WHERE pais = 'CO' AND fecha BETWEEN DATE '2025-09-01' AND DATE '${HOY}'`);
    const festivos = new Set([...FESTIVOS_2025, ...rFest.map(r => r.f)]);
    const esPuente = (domingo, pais) => (pais === 'CO' && festivos.has(sumarDias(domingo, 1))) || (pais === 'US' && PUENTES_US.includes(domingo));

    await autorDG();
    paso(`${SEDES.length} sedes y ${gente.length} personas activas leídas`);

    /* ══ 1 · QUIÉNES SE INTEGRAN DESDE LA BANDEJA (se deciden primero) ══
       Son visitantes del núcleo con correo que llegaron después de que su
       sede saliera en vivo: la conversión los vincula por el correo. No
       entran a los grupos por el paso 2: entran por la conversión. */
    const integrados = new Map();   // persona_id → { sede, llegada, conversion }
    for (const s of SEDES) {
      const az = azar.derivar('integrados:' + s.codigo);
      const candidatos = (gentePorSede.get(s.id) ?? []).filter(p => p.nivel === 'visitante' && p.email && p.edad >= 18
        && !p.con_rol && p.llego >= s.desde && diasEntre(p.llego, TOPE) >= 8);
      for (const p of candidatos) {
        const dias = diasEntre(p.llego, TOPE);
        const prob = dias < 30 ? 0.18 : dias < 120 ? 0.42 : 0.52;
        if (!az.probabilidad(prob)) continue;
        integrados.set(p.id, { sede: s, persona: p });
      }
    }

    /* ══ 2 · LOS GRUPOS DE CADA SEDE (en memoria) ═════════════════════ */
    const grupos = [];              // todos los grupos planeados
    const ocupado = new Map();      // persona_id → { familiar: grupo|null, otro: grupo|null }
    const cargo = new Set();        // quienes reciben un rol en este archivo
    const promovidos = [];          // miembros nombrados líderes: pasan a nivel «lider»
    const lugar = (id) => { if (!ocupado.has(id)) ocupado.set(id, { familiar: null, otro: null }); return ocupado.get(id); };

    /* De dónde salen los líderes de cada sede: líderes bautizados sin ningún
       rol (ni personal ni de equipo) que ya llevan tiempo en la sede. Si no
       alcanzan, se nombra a un miembro bautizado, que pasa a nivel «lider». */
    const canteras = new Map();
    for (const s of SEDES) {
      const az = azar.derivar('cantera:' + s.codigo);
      const adultos = (gentePorSede.get(s.id) ?? []).filter(p => p.edad >= 18 && !p.con_rol && !integrados.has(p.id)
        && p.bautizado && diasEntre(p.llego, TOPE) >= (s.tipo === 'plantacion' ? 100 : 150));
      canteras.set(s.id, {
        libres: az.barajar(adultos.filter(p => p.nivel === 'lider' && p.edad >= 22 && p.edad <= 74)),
        reserva: az.barajar(adultos.filter(p => p.nivel === 'miembro' && p.edad >= 23 && p.edad <= 70)),
      });
    }
    const tomarDe = (s, filtro = () => true) => {
      const { libres, reserva } = canteras.get(s.id);
      for (const lista of [libres, reserva]) {
        const i = lista.findIndex(p => !cargo.has(p.id) && filtro(p));
        if (i >= 0) {
          const p = lista.splice(i, 1)[0];
          cargo.add(p.id);
          if (p.nivel !== 'lider') { promovidos.push(p); p.nivel = 'lider'; }
          return p;
        }
      }
      return null;
    };

    for (const s of SEDES) {
      const az = azar.derivar('grupos:' + s.codigo);
      const todos = gentePorSede.get(s.id) ?? [];
      const adultos = todos.filter(p => p.edad >= 18);
      const jovenes = adultos.filter(p => p.edad >= 19 && p.edad <= 25);
      const ministerios = new Set(s.ministerios);
      const [pastor] = pastoresDe(s);
      const tomarLider = (filtro) => tomarDe(s, filtro);

      // Qué grupos tiene la sede.
      const tam = s.tamano;
      const nFam = Math.max(1, Math.round(adultos.length / 30));
      const plan = [];
      for (let i = 0; i < nFam; i++) plan.push('familiar');
      const siHay = (k) => !PLANTILLAS[k].ministerio || ministerios.has(PLANTILLAS[k].ministerio);
      if (tam === 'grande') {
        plan.push(...az.muestra(['mujeres', 'hombres', 'dorados', 'ejecutivos', 'parejas'].filter(siHay), 3));
        plan.push('nicodemo', 'formacion');
        plan.push(...['alabanza', 'ujieres'].filter(siHay));
        if (s.codigo === 'BOG-CHICO' && siHay('visa')) plan.push('visa');
      } else if (tam === 'mediana') {
        plan.push(...az.muestra(['mujeres', 'hombres', 'parejas'].filter(siHay), 1));
        if (adultos.length >= 60) plan.push('nicodemo');
        if (adultos.length >= 70 && siHay('alabanza')) plan.push('alabanza');
      } else if (adultos.length >= 40 && siHay('mujeres')) {
        plan.push('mujeres');
      }
      if (legadoDe[s.id] && ministerios.has('TMT') && jovenes.length >= 9) {
        plan.push('legado');
        if (tam === 'grande' && jovenes.length >= 28) plan.push('legado2');
      }

      const nombresUsados = new Set();
      const barrios = new Set();
      for (const clave of plan) {
        const pl = PLANTILLAS[clave];
        // El líder: para Legado, alguien joven; para Mujer Integral, una mujer; etc. Los grupos
        // familiares se reparten por barrios: primero alguien de un barrio que todavía no tiene grupo.
        const barrioLibre = (p) => pl.clase !== 'familiar' || (p.zona && !barrios.has(p.zona));
        const cumple = (p) => (!pl.genero || p.genero === pl.genero)
          && (!pl.liderEdad || (p.edad >= pl.liderEdad[0] && p.edad <= pl.liderEdad[1]))
          && (clave !== 'dorados' || p.edad >= 52)
          && (clave !== 'parejas' || (conyugeDe.has(p.id) && persona.get(conyugeDe.get(p.id))?.sede_id === s.id))
          && (pl.clase !== 'familiar' || lugar(p.id).familiar === null)
          && (pl.clase === 'familiar' || lugar(p.id).otro === null);
        const lider = tomarLider(p => cumple(p) && barrioLibre(p)) ?? tomarLider(cumple);
        if (!lider) continue;
        if (pl.clase === 'familiar' && lider.zona) barrios.add(lider.zona);
        const [dia, hora] = az.elegir(pl.dias);
        let nombre = pl.nombre;
        if (pl.clase === 'familiar') {
          nombre = lider.zona ? `Grupo Familiar ${lider.zona}` : `Grupo Familiar de los ${lider.primer_apellido}`;
          if (nombresUsados.has(nombre)) nombre = `${nombre} · Familia ${lider.primer_apellido}`;
        } else if (nombresUsados.has(nombre)) {
          nombre = `${nombre} · ${DIAS_TXT[dia]}`;
        }
        nombresUsados.add(nombre);
        grupos.push({
          id: azar.derivar('grupo:' + s.codigo + ':' + nombre).uuid(),
          sede: s, clave, pl, clase: pl.clase, tipo: pl.tipo, nombre, dia, hora, lider,
          cupo: pl.cupo ?? (pl.clase === 'familiar' && az.probabilidad(0.3) ? az.entero(15, 20) : null),
          abierto: !pl.cerradoANuevos && !(pl.clase === 'familiar' && az.probabilidad(0.08)),
          ministerio_id: pl.ministerio ? idMin[pl.ministerio] : null,
          segmento_id: pl.segmento ? legadoDe[s.id] : null,
          hogar_id: null, miembros: [], reuniones: [], pastor,
        });
        const g = grupos[grupos.length - 1];
        lugar(lider.id)[pl.clase === 'familiar' ? 'familiar' : 'otro'] = g;
      }
    }
    paso(`${grupos.length} grupos planeados`);

    /* 2a · Legado (su director y, en las sedes grandes, su coordinador) y quien toma la
       asistencia con QR (dos en las sedes grandes, uno en las medianas de más de cien). */
    const cargosSede = [];
    const sedesQR = SEDES.filter(s => s.tamano === 'grande' || (s.tamano === 'mediana' && s.personas >= 100));
    const registradores = {};
    for (const codigo of [...new Set(grupos.filter(g => g.clase === 'legado').map(g => g.sede.codigo))]) {
      const s = porCodigo[codigo];
      const az = azar.derivar('legado:' + s.codigo);
      const director = tomarDe(s, p => p.edad >= 25 && p.edad <= 50);
      if (director) {
        cargosSede.push({ persona: director, sede: s, rol: 'DIRECTOR_SEGMENTO', alcance: 'segmento', alcanceId: legadoDe[s.id],
          desde: maxFecha(s.desde, az.fechaEntre('2025-09-15', '2026-02-15')), texto: 'dirección del segmento Legado de tMt' });
      }
      if (s.tamano === 'grande') {
        const coord = tomarDe(s, p => p.edad >= 22 && p.edad <= 40);
        if (coord) {
          cargosSede.push({ persona: coord, sede: s, rol: 'COORDINADOR_SEGMENTO', alcance: 'segmento', alcanceId: legadoDe[s.id],
            desde: maxFecha(s.desde, az.fechaEntre('2026-02-01', '2026-07-15')), texto: 'coordinación de los grupos de tMt Legado' });
        }
      }
    }
    for (const s of sedesQR) {
      const az = azar.derivar('registro:' + s.codigo);
      for (let i = 0; i < (s.tamano === 'grande' ? 2 : 1); i++) {
        const p = tomarDe(s, q => q.edad >= 22 && q.edad <= 66);
        if (!p) break;
        cargosSede.push({ persona: p, sede: s, rol: 'ASISTENCIA_REGISTRO', alcance: 'sede', alcanceId: s.id,
          desde: sumarDias(INICIO_QR, -az.entero(10, 16)), texto: 'registro de asistencia con QR' });
      }
    }

    /* 2b · Perfil de cada grupo: al día, callado, recién abierto o que se cerró. */
    {
      const az = azar.derivar('perfiles');
      const porSede = agrupar(grupos, g => g.sede.codigo);
      for (const [, gs] of porSede) for (const g of gs) g.perfil = 'activo';
      // Callados: uno o dos por sede grande, y un 12 % en las demás.
      for (const [, gs] of porSede) {
        const candidatos = gs.filter(g => g.clase !== 'nicodemo');
        const n = gs[0].sede.tamano === 'grande' ? az.entero(1, 2) : (az.probabilidad(0.35) ? 1 : 0);
        for (const g of az.muestra(candidatos, Math.min(n, Math.max(0, candidatos.length - 1)))) g.perfil = 'callado';
      }
      // Dos grupos recién abiertos que todavía no se reúnen (uno en Bogotá Norte y otro en Cali).
      for (const codigo of ['BOG-NORTE', 'CALI']) {
        const g = (porSede.get(codigo) ?? []).filter(x => x.clase === 'familiar' && x.perfil === 'activo').pop();
        if (g) g.perfil = 'nuevo';
      }
      // Cuatro grupos familiares que se cerraron y se unieron a otro de la misma sede.
      for (const codigo of ['BOG-CHICO', 'MED', 'BAQ', 'BOG-SUR']) {
        const fam = (porSede.get(codigo) ?? []).filter(x => x.clase === 'familiar' && x.perfil === 'activo');
        // El que recibe no tiene cupo: si lo tuviera, la base rechazaría a los que llegan.
        const receptores = fam.slice(1).filter(x => !x.cupo && x.abierto);
        if (!receptores.length) continue;
        const g = fam[0];
        g.perfil = 'cerrado';
        g.absorbe = receptores[receptores.length - 1];
      }
    }

    /* 2c · Fecha de fundación, hogar y miembros de cada grupo. */
    const unidadesPorSede = new Map();   // sede → hogares (o personas solas) de adultos
    for (const s of SEDES) {
      const adultos = (gentePorSede.get(s.id) ?? []).filter(p => p.edad >= 18 && !integrados.has(p.id)
        && !pastoresDe(s).some(x => x.persona_id === p.id));
      const porHogar = agrupar(adultos, p => p.hogar_id ?? ('solo:' + p.id));
      unidadesPorSede.set(s.id, [...porHogar.values()]);
    }
    const membresias = [];   // { id, grupo, persona, rol, ingreso, salida, motivo }
    const azM = azar.derivar('miembros');
    for (const g of grupos) {
      const s = g.sede;
      const az = azar.derivar('miembros:' + g.id);
      // Fundación: la mayoría ya existía cuando la sede salió en vivo.
      const lider = g.lider;
      // El líder abre el grupo cuando ya lleva un tiempo en la sede y es adulto.
      const minFund = maxFecha(sumarDias(lider.llego, 30), lider.mayor);
      if (g.perfil === 'nuevo') {
        g.fundado = sumarDias(TOPE, -az.entero(5, 16));
      } else if (az.probabilidad(g.clase === 'legado' ? 0.55 : 0.78) && diasEntre(minFund, sumarDias(s.desde, -40)) > 0) {
        g.fundado = az.fechaEntre(maxFecha(minFund, sumarDias(s.desde, -6 * 365)), sumarDias(s.desde, -40));
      } else {
        const hasta = sumarDias(TOPE, g.perfil === 'cerrado' ? -200 : -45);
        const desde = maxFecha(sumarDias(s.desde, 14), minFund);
        g.fundado = desde <= hasta ? az.fechaEntre(desde, hasta) : maxFecha(s.desde, minFund);
        if (g.fundado > sumarDias(TOPE, -30)) g.fundado = sumarDias(TOPE, -30);
      }
      g.migrado = g.fundado < s.desde;
      g.creado = g.migrado ? instante(s.desde, '07:00', s.zona_horaria, az.entero(0, 90))
        : instante(g.fundado, '10:00', s.zona_horaria, az.entero(0, 300));
      // El cierre de los que se unieron a otro grupo.
      if (g.perfil === 'cerrado') {
        const desde = maxFecha(sumarDias(g.fundado, 150), maxFecha(sumarDias(s.desde, 70), '2026-03-01'));
        g.cierre = desde <= '2026-08-20' ? az.fechaEntre(desde, '2026-08-20') : null;
        if (!g.cierre || g.absorbe.perfil !== 'activo') g.perfil = 'activo';
      }

      const agregar = (p, rol, ingreso) => {
        if (!p || g.miembros.some(m => m.persona.id === p.id)) return null;
        if (g.cupo && g.miembros.length >= g.cupo) return null;
        const m = { id: az.uuid(), grupo: g, persona: p, rol, ingreso, salida: null, motivo: null };
        g.miembros.push(m); membresias.push(m);
        return m;
      };
      agregar(lider, 'lider', g.fundado);
      // Colíder: el cónyuge del líder, si congrega en la misma sede.
      const conyuge = persona.get(conyugeDe.get(lider.id));
      const usaConyuge = conyuge && conyuge.sede_id === s.id && conyuge.edad >= 18 && !integrados.has(conyuge.id)
        && (g.clase === 'familiar' || g.clave === 'parejas')
        && lugar(conyuge.id)[g.clase === 'familiar' ? 'familiar' : 'otro'] === null;
      const ingresoConyuge = usaConyuge ? maxFecha(maxFecha(g.fundado, sumarDias(conyuge.llego, 60)), conyuge.mayor) : null;
      const limiteConyuge = g.perfil === 'cerrado' ? sumarDias(g.cierre, -30) : sumarDias(TOPE, -1);
      if (usaConyuge && ingresoConyuge <= limiteConyuge) {
        agregar(conyuge, 'colider', ingresoConyuge);
        lugar(conyuge.id)[g.clase === 'familiar' ? 'familiar' : 'otro'] = g;
      }
      // El hogar donde se reúne: el del líder, o el de un anfitrión.
      g.hogar_id = g.clase === 'familiar' ? lider.hogar_id : null;

      const objetivo = g.perfil === 'nuevo' ? az.entero(3, 5) : az.entero(g.pl.tamano[0], g.pl.tamano[1]);
      const cabe = (p) => p.edad >= 18 && !integrados.has(p.id) && !cargo.has(p.id)
        && diasEntre(p.llego, TOPE) >= 21 && p.nivel !== undefined;
      const fechaIngreso = (p) => {
        const lo = maxFecha(maxFecha(g.fundado, sumarDias(p.llego, 21)), p.mayor);
        const hi = g.perfil === 'cerrado' ? sumarDias(g.cierre, -30) : sumarDias(TOPE, g.perfil === 'nuevo' ? -1 : -9);
        if (lo > hi) return null;
        // Los primeros llegaron casi con la fundación; los demás, a lo largo del tiempo.
        return az.probabilidad(0.35) ? minFecha(hi, sumarDias(lo, az.entero(0, 60))) : az.fechaEntre(lo, hi);
      };
      /** Una familia entra junta: cuando llegó el último y el menor ya es adulto. */
      const juntos = (ps) => ({ llego: ps.reduce((x, q) => maxFecha(x, q.llego), ps[0].llego),
        mayor: ps.reduce((x, q) => maxFecha(x, q.mayor), ps[0].mayor) });
      if (g.clase === 'familiar') {
        // Las familias del mismo barrio del líder primero, después las demás.
        const unidades = az.barajar(unidadesPorSede.get(s.id));
        unidades.sort((a, b) => (b[0].zona === lider.zona ? 1 : 0) - (a[0].zona === lider.zona ? 1 : 0));
        for (const unidad of unidades) {
          if (g.miembros.length >= objetivo) break;
          const disponibles = unidad.filter(p => cabe(p) && lugar(p.id).familiar === null);
          if (!disponibles.length) continue;
          const peso = { lider: 0.9, miembro: 0.62, visitante: 0.22 }[disponibles[0].nivel] ?? 0.4;
          if (!azM.probabilidad(peso)) continue;
          const ingreso = fechaIngreso(juntos(disponibles));
          if (!ingreso) continue;
          for (const p of disponibles) {
            if (p.id !== disponibles[0].id && !az.probabilidad(0.85)) continue;
            if (agregar(p, 'miembro', ingreso)) lugar(p.id).familiar = g;
          }
        }
        // Uno de cada cuatro se reúne en la casa de un miembro, que es el anfitrión.
        const candidatos = g.miembros.filter(m => m.rol === 'miembro' && m.persona.hogar_id && m.persona.hogar_id !== lider.hogar_id);
        if (candidatos.length && az.probabilidad(0.25)) {
          const a = az.elegir(candidatos);
          a.rol = 'anfitrion';
          g.hogar_id = a.persona.hogar_id;
          for (const m of g.miembros) if (m.persona.hogar_id === a.persona.hogar_id) m.ingreso = minFecha(m.ingreso, a.ingreso);
        }
      } else {
        const pl = g.pl;
        let pool = (gentePorSede.get(s.id) ?? []).filter(p => cabe(p) && lugar(p.id).otro === null
          && p.edad >= (pl.edad?.[0] ?? 18) && p.edad <= (pl.edad?.[1] ?? 99)
          && (!pl.genero || p.genero === pl.genero)
          && (!pl.bautizados || p.bautizado)
          && !pastoresDe(s).some(x => x.persona_id === p.id));
        if (pl.nuevos) pool = pool.filter(p => p.nivel === 'visitante' || diasEntre(p.llego, TOPE) < 540);
        else pool = pool.filter(p => p.nivel !== 'visitante' || azM.probabilidad(0.25));
        if (pl.parejas) {
          const parejas = [];
          for (const p of az.barajar(pool)) {
            const q = persona.get(conyugeDe.get(p.id));
            if (q && pool.includes(q) && p.genero === 'M') parejas.push([p, q]);
          }
          for (const [p, q] of parejas) {
            if (g.miembros.length >= objetivo) break;
            const ingreso = fechaIngreso(juntos([p, q]));
            if (!ingreso) continue;
            if (agregar(p, 'miembro', ingreso)) lugar(p.id).otro = g;
            if (agregar(q, 'miembro', ingreso)) lugar(q.id).otro = g;
          }
        } else {
          for (const p of az.barajar(pool)) {
            if (g.miembros.length >= objetivo) break;
            const ingreso = fechaIngreso(p);
            if (!ingreso) continue;
            if (agregar(p, 'miembro', ingreso)) lugar(p.id).otro = g;
          }
        }
      }
      // Un aprendiz en cuatro de cada diez grupos: alguien bautizado que ya lleva un tiempo.
      const aprendices = g.miembros.filter(m => m.rol === 'miembro' && m.persona.bautizado && m.persona.edad >= 20
        && m.persona.edad <= 45 && diasEntre(m.ingreso, TOPE) > 120);
      if (aprendices.length && az.probabilidad(0.4) && g.perfil !== 'nuevo') az.elegir(aprendices).rol = 'aprendiz';
    }
    paso(`${membresias.length} integrantes repartidos`);

    /* 2d · Las salidas con motivo (y los que se fueron cuando su grupo se unió a otro). */
    {
      const az = azar.derivar('salidas');
      for (const m of membresias) {
        const g = m.grupo;
        if (m.rol !== 'miembro' || g.perfil === 'nuevo') continue;
        const desde = maxFecha(sumarDias(m.ingreso, 30), sumarDias(g.sede.desde, 7));
        const hasta = g.perfil === 'cerrado' ? sumarDias(g.cierre, -10) : sumarDias(TOPE, -3);
        if (desde > hasta || !az.probabilidad(0.11)) continue;
        m.salida = az.fechaEntre(desde, hasta);
        m.motivo = az.elegir(MOTIVOS_SALIDA)({ dia: DIAS_TXT[g.dia], ciudad: az.elegir(CIUDADES_MUDANZA.filter(x => x !== g.sede.ciudad)) });
      }
    }

    /* 2e · Las reuniones reportadas, semana a semana. */
    {
      for (const g of grupos) {
        const s = g.sede;
        const az = azar.derivar('reuniones:' + g.id);
        const inicio = maxFecha(g.fundado, s.desde);
        let fin = TOPE;
        if (g.perfil === 'callado') fin = sumarDias(TOPE, -az.entero(26, 120));
        if (g.perfil === 'cerrado') fin = sumarDias(g.cierre, -az.entero(7, 24));
        if (g.perfil === 'nuevo') fin = az.probabilidad(0.5) ? TOPE : sumarDias(inicio, -1);
        const fechas = fin >= inicio ? fechasDelDia(IDX_DIA[g.dia], inicio, fin) : [];
        const propios = TEMAS_PROPIOS[g.clase === 'pequeno' ? 'pequeno' : g.clase] ?? TEMAS_PROPIOS.familiar;
        let leccion = az.entero(0, 7);
        let cenaHecha = false;
        for (const f of fechas) {
          if (enReceso(f)) continue;
          if (festivos.has(f) && s.pais === 'CO' && az.probabilidad(0.6)) continue;
          if (az.probabilidad(g.perfil === 'callado' ? 0.18 : 0.1)) continue;
          // El último informe a veces no se ha subido todavía.
          if (diasEntre(f, TOPE) <= 3 && az.probabilidad(0.35)) continue;
          const activos = g.miembros.filter(m => m.ingreso <= f && (!m.salida || m.salida > f)).length;
          if (activos < 2) continue;
          let tema;
          if (g.clase === 'nicodemo' || g.clase === 'formacion') { tema = propios[leccion % propios.length]; leccion++; }
          else if (['alabanza', 'ujieres', 'visa', 'legado'].includes(g.clase)) tema = az.probabilidad(0.3) ? temaGuia(f) : az.elegir(propios);
          else tema = az.probabilidad(0.12) ? az.elegir(propios) : temaGuia(f);
          if (g.clase === 'familiar' && !cenaHecha && f >= '2025-12-12' && f <= '2025-12-19') { tema = 'Cena de Navidad del grupo'; cenaHecha = true; }
          if (az.probabilidad(0.07)) tema = null;
          const asistentes = Math.max(2, Math.round(activos * az.decimal(0.58, 0.96)) + (az.probabilidad(0.3) ? az.entero(1, 3) : 0));
          const reporte = instante(f, g.hora, s.zona_horaria, az.probabilidad(0.6) ? az.entero(120, 240) : az.entero(900, 2600));
          g.reuniones.push({ id: az.uuid(), fecha: f, tema, asistentes, reporte });
        }
        // Un reporte nunca queda en el futuro: lo de ayer se reporta ayer.
        for (const r of g.reuniones) if (r.reporte.fecha > TOPE) r.reporte = instante(TOPE, '22:30', s.zona_horaria, 0);
        g.ultima = g.reuniones.length ? g.reuniones[g.reuniones.length - 1].fecha : null;
      }
    }

    /* ══ 3 · A LA BASE: GRUPOS, ROLES, INTEGRANTES, REUNIONES ══════════ */

    // 3a · Quien fue nombrado líder y no lo era pasa a nivel «lider» (lo hace la secretaría).
    if (promovidos.length) {
      await autorDG('Nombrado líder de grupo: su nivel de compromiso pasa a líder');
      await c.query(`UPDATE nucleo.personas SET nivel_compromiso = 'lider' WHERE id = ANY($1::uuid[]) AND nivel_compromiso <> 'lider'`,
        [promovidos.map(p => p.id)]);
    }

    // 3b · Los grupos, creados por el pastor de cada sede.
    for (const [codigo, gs] of agrupar(grupos, g => g.sede.codigo)) {
      const s = porCodigo[codigo];
      const creador = gs[0].pastor?.persona_id ?? DG.persona_id;
      await autor(creador, s.id, 3, `${MOTIVO} · los grupos de ${s.nombre}`);
      await insertarLote(c, 'grupos.grupos', gs.map(g => ({
        id: g.id, sede_id: s.id, ministerio_id: g.ministerio_id, segmento_id: g.segmento_id, tipo: g.tipo,
        nombre: g.nombre, dia_reunion: g.dia, hora_reunion: g.hora, cupo: g.cupo, abierto: g.abierto,
        hogar_id: g.hogar_id, cerrado_en: null, source_system: SISTEMA, source_id: `grupo-${codigo}-${String(gs.indexOf(g) + 1).padStart(2, '0')}`,
        creado_en: g.creado.iso, actualizado_en: g.creado.iso, creado_por: creador,
      })));
    }
    paso(`${grupos.length} grupos creados`);

    // 3c · Los roles: el líder de cada grupo, Legado y el registro de asistencia. Los otorga la dirección, con acta.
    const otorgados = [];     // { persona, rol, alcance_id, desde, hasta, asignacion, sede, etiqueta }
    const actaSede = {};
    const numActa = (s, f) => { actaSede[s.codigo] = (actaSede[s.codigo] ?? 10) + 1; return `ACTA-${s.codigo}-${anio(f)}-${actaSede[s.codigo]}`; };
    const otorgar = async (p, rol, alcance, alcanceId, acta, desde, hasta) => {
      const { rows: [r] } = await c.query(
        `SELECT identidad.otorgar_asignacion($1, $2, $3, $4, 2::smallint, $5, $6::date, $7::date) AS r`,
        [p.id, rol, alcance, alcanceId, acta, desde, hasta ?? null]);
      return r.r.id;
    };
    await autorDG(`${MOTIVO} · líderes de grupo`);
    const actaMigracion = {};
    for (const g of grupos) {
      const s = g.sede;
      const desde = g.migrado ? s.desde : g.fundado;
      let acta;
      if (g.migrado) {
        actaMigracion[s.codigo] ??= `${numActa(s, s.desde)} · líderes de grupo al salir en vivo`;
        acta = actaMigracion[s.codigo];
      } else {
        acta = `${numActa(s, desde)} · líder del grupo «${g.nombre}»`;
      }
      const hasta = g.perfil === 'cerrado' ? g.cierre : null;
      const id = await otorgar(g.lider, 'LIDER_GRUPO', 'grupo', g.id, acta, desde, hasta);
      otorgados.push({ persona: g.lider, rol: 'LIDER_GRUPO', desde, hasta, asignacion: id, sede: s, grupo: g });
    }
    // Legado: su director y, en las sedes grandes, su coordinador.
    // Legado y el registro de asistencia (elegidos al planear: la cantera es la misma de los líderes).
    for (const x of cargosSede) {
      const id = await otorgar(x.persona, x.rol, x.alcance, x.alcanceId, `${numActa(x.sede, x.desde)} · ${x.texto}`, x.desde, null);
      otorgados.push({ persona: x.persona, rol: x.rol, desde: x.desde, asignacion: id, sede: x.sede });
      if (x.rol === 'ASISTENCIA_REGISTRO') (registradores[x.sede.id] ??= []).push({ persona_id: x.persona.id, desde: x.desde });
    }
    conteo.roles_otorgados = otorgados.length;
    paso(`${otorgados.length} roles otorgados con acta`);

    // 3d · Los integrantes, dados de alta por el líder de cada grupo.
    for (const g of grupos) {
      await autor(g.lider.id, g.sede.id, 2, `${MOTIVO} · integrantes del grupo`);
      await insertarLote(c, 'grupos.membresias', g.miembros.map(m => ({
        id: m.id, grupo_id: g.id, persona_id: m.persona.id, rol: m.rol, fecha_ingreso: m.ingreso,
        source_system: SISTEMA, source_id: `membresia-${m.id.slice(0, 8)}`, agregado_por: g.lider.id,
      })));
    }
    // 3e · Las reuniones, reportadas por el líder.
    const filasReunion = [];
    for (const g of grupos) for (const r of g.reuniones) {
      filasReunion.push({ id: r.id, grupo_id: g.id, fecha: r.fecha, tema: r.tema, asistentes: r.asistentes,
        reportada_por: g.lider.id, registrada_en: r.reporte.iso });
    }
    await insertarLote(c, 'grupos.reuniones', filasReunion);
    // 3f · Las salidas con motivo, como las registra la API (UPDATE de fecha_salida).
    for (const g of grupos) {
      const salen = g.miembros.filter(m => m.salida);
      if (!salen.length) continue;
      await autor(g.lider.id, g.sede.id, 2, `${MOTIVO} · salida de un integrante`);
      await c.query(
        `UPDATE grupos.membresias m SET fecha_salida = v.f, motivo_salida = v.motivo, sacado_por = $2
           FROM unnest($1::uuid[], $3::date[], $4::text[]) AS v(id, f, motivo)
          WHERE m.id = v.id`,
        [salen.map(m => m.id), g.lider.id, salen.map(m => m.salida), salen.map(m => m.motivo)]);
    }
    paso(`${membresias.length} integrantes, ${filasReunion.length} reuniones y ${membresias.filter(m => m.salida).length} salidas`);

    /* ══ 4 · ASISTENCIA: SERVICIOS, CONTEOS Y MARCAS ═══════════════════ */
    const { rows: yaServicios } = await c.query(
      `SELECT s.id, s.sede_id, to_char(s.fecha, 'YYYY-MM-DD') AS fecha, to_char(s.hora_inicio, 'HH24:MI') AS hora, s.tipo,
              EXISTS (SELECT 1 FROM asistencia.conteos x WHERE x.servicio_id = s.id) AS con_conteo
         FROM asistencia.servicios s`);
    const existente = new Map(yaServicios.map(r => [`${r.sede_id}|${r.fecha}|${r.hora}|${r.tipo}`, r]));
    const servicios = [];   // planeados
    const horasDomingo = (s) => {
      if (s.codigo === 'BOG-CHICO') return ['08:00', '10:00', '12:00', '17:00'];
      if (s.tamano === 'grande') return ['08:00', '10:00', '12:00'];
      if (s.codigo === 'MIA') return ['10:00', '12:00'];
      if (s.codigo === 'PTY' || s.tamano === 'mediana') return ['09:00', '11:00'];
      if (s.codigo === 'MAD') return ['12:00'];
      if (s.codigo === 'BCN') return ['11:30'];
      if (s.codigo === 'NYC') return ['13:00'];
      if (s.pais === 'US') return ['11:00'];
      if (s.tipo === 'plantacion') return ['10:30'];
      return ['10:00'];
    };
    const nombreDomingo = (s, h) => s.tamano === 'grande' ? `Celebración dominical · ${hora12(h)}`
      : s.tamano === 'mediana' ? `Servicio dominical · ${hora12(h)}` : 'Reunión dominical';
    const ESPECIALES = [
      { fecha: '2025-12-24', hora: '19:00', tipo: 'especial', nombre: 'Nochebuena en familia', factor: 1.25, donde: () => true },
      { fecha: '2025-12-31', hora: '22:00', tipo: 'especial', nombre: 'Culto de fin de año', factor: 0.6, donde: (s) => s.tamano === 'grande' },
      { fecha: '2026-04-03', hora: '19:00', tipo: 'especial', nombre: 'Viernes Santo · Santa Cena', factor: 0.85, donde: (s) => s.tamano !== 'pequena' },
      { fecha: '2026-05-16', hora: '09:00', tipo: 'conferencia', nombre: 'Conferencia Mujer Integral 2026', factor: 0.7, primera: 18, donde: (s) => ['BOG-CHICO', 'MED', 'CALI'].includes(s.codigo) },
      { fecha: '2026-06-19', hora: '19:00', tipo: 'retiro', nombre: 'Retiro tMt Legado 2026', factor: 0.2, jovenes: true, donde: (s) => s.codigo === 'BOG-NORTE' },
      { fecha: '2026-07-18', hora: '09:00', tipo: 'conferencia', nombre: 'Conferencia de familias 2026', factor: 0.9, primera: 12, donde: (s) => ['MED', 'BAQ'].includes(s.codigo) },
      { fecha: '2026-08-08', hora: '09:00', tipo: 'conferencia', nombre: 'Conferencia de líderes 2026', factor: 0.45, primera: 2, donde: (s) => s.codigo === 'BOG-CHICO' },
    ];
    const pesos = { 4: [0.2, 0.34, 0.3, 0.16], 3: [0.27, 0.43, 0.3], 2: [0.44, 0.56], 1: [1] };
    const temporada = (f, pais) => {
      let m = 1;
      const md = f.slice(5);
      if (md >= '12-07' && md <= '12-21') m *= 1.08;
      if (md >= '12-26' || md <= '01-04') m *= 0.72;
      else if (md >= '01-05' && md <= '01-11') m *= 0.82;
      else if (md >= '01-12' && md <= '01-18') m *= 0.92;
      if (f === '2026-03-29') m *= 1.06;
      if (f === '2026-04-05') m *= 1.32;
      if (f === '2026-05-10' && pais !== 'ES') m *= 1.2;
      if (f === '2026-05-03' && pais === 'ES') m *= 1.15;
      if (f === '2026-06-21' && pais === 'CO') m *= 1.05;
      if (pais === 'CO' && md >= '06-22' && md <= '07-12') m *= 0.9;
      if (esPuente(f, pais)) m *= 0.88;
      return m;
    };
    const tendencia = (f) => 0.9 + 0.1 * Math.min(1, Math.max(0, diasEntre('2025-09-01', f) / 385));
    for (const s of SEDES) {
      const az = azar.derivar('servicios:' + s.codigo);
      const base = s.personas * az.decimal(0.84, 0.98);
      const jovenesSede = (gentePorSede.get(s.id) ?? []).filter(p => p.edad >= 11 && p.edad <= 25).length;
      const horas = horasDomingo(s);
      const qr = sedesQR.includes(s);
      const nuevo = (fecha, hora, tipo, nombre, extra = {}) => {
        const sv = { id: az.uuid(), sede: s, fecha, hora, tipo, nombre, admite_checkin: false, ...extra };
        const ya = existente.get(`${s.id}|${fecha}|${hora}|${tipo}`);
        if (ya) { sv.id = ya.id; sv.existia = true; sv.conConteo = ya.con_conteo; }
        servicios.push(sv);
        return sv;
      };
      for (const f of domingosEntre(s.desde, TOPE)) {
        const total = base * temporada(f, s.pais) * tendencia(f) * az.normal(1, 0.045);
        horas.forEach((h, i) => {
          nuevo(f, h, 'dominical', nombreDomingo(s, h), { esperado: total * pesos[horas.length][i],
            admite_checkin: qr && f >= INICIO_QR, tarde: h >= '17:00' });
        });
      }
      if (s.tamano === 'grande') {
        for (const f of fechasDelDia(3, s.desde, TOPE)) {
          if (enReceso(f)) continue;
          nuevo(f, '19:00', 'oracion', 'Noche de oración', { esperado: base * az.decimal(0.12, 0.18), clase: 'oracion' });
        }
        if (s.ministerios.includes('TMT')) {
          for (const f of fechasDelDia(6, s.desde, TOPE)) {
            if (enReceso(f)) continue;
            nuevo(f, '16:00', 'entre_semana', 'Encuentro tMt', { esperado: jovenesSede * az.decimal(0.45, 0.7), clase: 'tmt' });
          }
        }
      } else if (s.tamano === 'mediana') {
        for (const f of fechasDelDia(4, s.desde, TOPE)) {
          if (enReceso(f)) continue;
          nuevo(f, '19:30', 'entre_semana', 'Culto de mitad de semana', { esperado: base * az.decimal(0.2, 0.3), clase: 'semana' });
        }
      } else {
        for (const f of fechasDelDia(3, s.desde, TOPE)) {
          if (Number(f.slice(8, 10)) > 7 || enReceso(f)) continue;
          nuevo(f, '19:00', 'oracion', 'Noche de oración mensual', { esperado: base * az.decimal(0.18, 0.28), clase: 'oracion' });
        }
      }
      for (const e of ESPECIALES) {
        if (e.fecha < s.desde || !e.donde(s)) continue;
        nuevo(e.fecha, e.hora, e.tipo, e.nombre, { esperado: e.jovenes ? jovenesSede * 0.5 : base * e.factor,
          clase: e.jovenes ? 'tmt' : 'especial', primera: e.primera ?? 0 });
      }
    }

    // 4b · Las marcas de entrada con QR (últimos trece domingos, sedes grandes y medianas de más de cien).
    const entradas = [];     // { servicio, persona, llave, medio, marcador }
    const marcadosPor = new Map();
    const seFueron = [];
    {
      const domingosQR = domingosEntre(INICIO_QR, TOPE);
      for (const s of sedesQR) {
        const az = azar.derivar('checkin:' + s.codigo);
        const svPorDomingo = agrupar(servicios.filter(x => x.sede === s && x.admite_checkin), x => x.fecha);
        const regs = registradores[s.id] ?? [];
        const adultos = (gentePorSede.get(s.id) ?? []).filter(p => p.edad >= 18);
        const unidades = [...agrupar(adultos, p => p.hogar_id ?? ('solo:' + p.id)).values()];
        const nServ = horasDomingo(s).length;
        for (const unidad of unidades) {
          // Qué tan seguido viene cada persona.
          const prob = new Map();
          for (const p of unidad) {
            let x;
            if (p.nivel === 'lider') x = 0.86;
            else if (p.nivel === 'miembro') x = az.ponderado([[0.82, 45], [0.6, 30], [0.28, 16], [0.03, 9]]);
            else x = integrados.has(p.id) ? az.ponderado([[0.7, 50], [0.45, 50]]) : az.ponderado([[0.55, 25], [0.3, 40], [0.1, 35]]);
            prob.set(p.id, x);
          }
          const pUnidad = Math.max(...prob.values());
          const preferido = az.entero(0, nServ - 1);
          // Una de cada veinte familias que venían seguido dejó de venir en agosto.
          const sinCargo = unidad.every(p => !p.con_rol && !cargo.has(p.id));
          const seFue = sinCargo && pUnidad >= 0.55 && az.probabilidad(0.055) ? az.fechaEntre('2026-08-09', '2026-08-23') : null;
          if (seFue) seFueron.push(...unidad.map(p => p.id));
          for (const f of domingosQR) {
            if (seFue && f > seFue) continue;
            const svs = svPorDomingo.get(f);
            if (!svs?.length) continue;
            const pHoy = seFue ? Math.max(pUnidad, 0.85) : pUnidad;
            if (!az.probabilidad(pHoy)) continue;
            const sv = svs[az.probabilidad(0.86) ? Math.min(preferido, svs.length - 1) : az.entero(0, svs.length - 1)];
            const llegada = az.entero(-25, 18);
            const medio = az.ponderado({ qr: 55, app: 20, manual: 20, tarjeta: 5 });
            for (const p of unidad) {
              if (p.llego > f || p.mayor > f) continue;   // aún no llegaba, o todavía era menor de edad
              const pi = seFue ? Math.max(prob.get(p.id), 0.85) : prob.get(p.id);
              if (!az.probabilidad(Math.min(1, pi / pUnidad)) || !az.probabilidad(0.9)) continue;
              const cuando = instante(f, sv.hora, s.zona_horaria, llegada + az.entero(0, 2));
              entradas.push({ servicio: sv, persona: p, iso: cuando.iso, medio: az.probabilidad(0.85) ? medio : 'qr',
                marcador: regs.length ? az.elegir(regs).persona_id : secretariaEn(s, f) });
              marcadosPor.set(sv.id, (marcadosPor.get(sv.id) ?? 0) + 1);
            }
          }
        }
      }
    }

    // 4c · A la base: servicios (los crea la secretaría de ese momento), conteos y marcas.
    const nuevosSv = servicios.filter(x => !x.existia);
    for (const s of SEDES) {
      const az = azar.derivar('creacion:' + s.codigo);
      const deSede = nuevosSv.filter(x => x.sede === s);
      for (const sv of deSede) {
        sv.creador = secretariaEn(s, sv.fecha);
        sv.creado = instante(sv.fecha, sv.hora, s.zona_horaria, -az.entero(60, 60 * 30));
      }
      for (const [creador, lote] of agrupar(deSede, x => x.creador)) {
        await autor(creador, s.id, 2, `${MOTIVO} · servicios de ${s.nombre}`);
        await insertarLote(c, 'asistencia.servicios', lote.map(sv => ({
          id: sv.id, sede_id: s.id, fecha: sv.fecha, hora_inicio: sv.hora, tipo: sv.tipo, nombre: sv.nombre,
          admite_checkin: sv.admite_checkin, creado_en: sv.creado.iso, creado_por: creador,
        })));
      }
    }
    // Los conteos de la puerta.
    const conteos = [];
    for (const s of SEDES) {
      const az = azar.derivar('conteos:' + s.codigo);
      const regs = registradores[s.id] ?? [];
      for (const sv of servicios.filter(x => x.sede === s)) {
        if (sv.conConteo) continue;
        // Lo de ayer por la tarde, y algo de ayer en las sedes pequeñas, todavía no se reporta.
        if (sv.fecha === TOPE && (sv.tarde || (s.tamano === 'pequena' && az.probabilidad(0.3)))) continue;
        if (diasEntre(sv.fecha, TOPE) > 30 && az.probabilidad(0.015)) continue;
        const total = Math.max(6, Math.round(sv.esperado * az.normal(1, 0.06)));
        let ninos, jovenes;
        if (sv.clase === 'tmt') { jovenes = Math.round(total * az.decimal(0.82, 0.92)); ninos = 0; }
        else if (sv.clase === 'oracion') { ninos = Math.round(total * az.decimal(0.02, 0.06)); jovenes = Math.round(total * az.decimal(0.08, 0.15)); }
        else if (sv.tarde) { ninos = Math.round(total * az.decimal(0.06, 0.12)); jovenes = Math.round(total * az.decimal(0.28, 0.36)); }
        else { ninos = Math.round(total * az.decimal(0.17, 0.24)); jovenes = Math.round(total * az.decimal(0.12, 0.19)); }
        let adultos = Math.max(1, total - ninos - jovenes);
        const marcados = marcadosPor.get(sv.id) ?? 0;
        if (marcados) adultos = Math.max(adultos, marcados + Math.round(marcados * az.decimal(0.15, 0.5)));
        const suma = adultos + jovenes + ninos;
        let primera = Math.max(0, Math.round(az.normal(suma * 0.012, 1.1))) + (sv.primera ? az.entero(Math.floor(sv.primera / 2), sv.primera) : 0);
        if (sv.fecha === '2026-04-05' || sv.fecha === '2025-12-24') primera += az.entero(1, 4);
        primera = Math.min(primera, suma);
        const quien = regs.length && sv.fecha >= regs[0].desde ? az.elegir(regs).persona_id : secretariaEn(s, sv.fecha);
        conteos.push({ servicio_id: sv.id, adultos, jovenes, ninos, primera_vez: primera, reportado_por: quien,
          reportado_en: instante(sv.fecha, sv.hora, s.zona_horaria, az.entero(80, 200)).iso, sede: s });
        sv.contados = suma;
      }
    }
    for (const [sedeId, lote] of agrupar(conteos, x => x.sede.id)) {
      await autor(lote[0].reportado_por, sedeId, 2, `${MOTIVO} · conteo de la puerta`);
      await insertarLote(c, 'asistencia.conteos', lote.map(({ sede, ...x }) => x));
    }
    // Las marcas, a nombre de quien las tomó.
    for (const [marcador, lote] of agrupar(entradas, x => x.marcador)) {
      await autor(marcador, lote[0].servicio.sede.id, 2, `${MOTIVO} · registro de entrada`);
      await insertarLote(c, 'asistencia.entradas', lote.map(e => ({
        servicio_id: e.servicio.id, persona_id: e.persona.id, marcada_en: e.iso, medio: e.medio, marcada_por: marcador,
      })), { conflicto: 'ON CONFLICT (servicio_id, persona_id) DO NOTHING' });
    }
    conteo.servicios = nuevosSv.length;
    conteo.conteos = conteos.length;
    conteo.entradas = entradas.length;
    paso(`${nuevosSv.length} servicios, ${conteos.length} conteos y ${entradas.length} marcas de entrada`);

    /* ══ 5 · NUEVOS: LA BANDEJA DEL RECORRIDO 4C ══════════════════════ */
    const nuevos = [];        // registros de la bandeja
    const contactos = [];
    const notas = [];
    const coordEn = (s, f) => {
      const lista = rolesSede[s.id]?.COORDINADOR_NUEVOS ?? [];
      const vig = vigenteEn(lista, f);
      if (vig.length) return vig;
      const hoy = vigenteEn(lista, TOPE);
      return hoy.length ? hoy : [];
    };
    const gruposAbiertos = (s, f) => grupos.filter(g => g.sede === s && g.perfil !== 'cerrado' && g.perfil !== 'nuevo'
      && (g.clase === 'familiar' || g.clase === 'nicodemo') && g.fundado <= f && g.abierto);

    /**
     * Llamadas de seguimiento de un registro, con la regla de estado de la API.
     * modo: 'convertir' (termina interesado y se integra) · 'activo' (se le sigue
     * llamando hasta hoy) · 'cerrado' (termina diciendo que no) · 'descuidado' (se
     * dejó de llamar y quedó vencido) · 'sin_contacto' (nadie lo ha llamado).
     */
    const simular = (az, n, s, fin, modo) => {
      const lista = [];
      let estado = 'nuevo';
      let proximo = sumarDias(n.reg.fecha, 1);
      let previa = 'inicio';
      let momento = n.reg;
      if (modo === 'sin_contacto') return { lista, estado, proximo, ultimo: momento };
      const coordinadores = coordEn(s, n.reg.fecha);
      const nombre = n.primer_nombre;
      const tope = modo === 'convertir' ? az.entero(1, 3) : modo === 'cerrado' ? az.entero(1, 4)
        : modo === 'descuidado' ? az.entero(1, 3) : 16;
      // Quien lleva meses sin decidirse ya no está «interesado» cada semana: se le llama cada tanto.
      const viejo = diasEntre(n.reg.fecha, TOPE) > 90;
      for (let i = 0; i < tope; i++) {
        const retraso = i === 0 ? (az.probabilidad(0.25) ? az.entero(5, 11) : az.entero(1, 4))
          : Math.max(1, diasEntre(momento.fecha, proximo) + az.entero(-1, 3));
        const f = sumarDias(momento.fecha, retraso);
        if (f > fin) break;
        if (modo === 'descuidado' && i > 0 && diasEntre(f, fin) < 14) break;
        let reaccion = az.ponderado(TRANSICION[previa]);
        const ultima = i === tope - 1;
        if (modo === 'convertir') reaccion = ultima ? 'interesado' : (reaccion === 'no_interesado' ? 'dudoso' : reaccion);
        else if (modo === 'cerrado') reaccion = ultima ? 'no_interesado' : (reaccion === 'no_interesado' ? 'no_contesto' : reaccion);
        else if (reaccion === 'no_interesado') reaccion = 'dudoso';
        if (modo === 'activo' && viejo && i >= 2) reaccion = az.ponderado({ dudoso: 55, no_contesto: 30, interesado: 15 });
        const tipo = reaccion === 'interesado' ? az.ponderado({ llamada: 55, whatsapp: 30, visita: 6, email: 4, mensaje: 5 })
          : reaccion === 'no_contesto' ? az.ponderado({ llamada: 70, whatsapp: 20, email: 5, mensaje: 5 })
            : az.ponderado({ llamada: 70, whatsapp: 30 });
        const textos = RESUMEN[tipo]?.[reaccion] ?? RESUMEN.llamada[reaccion];
        const quienHace = tipo === 'visita' ? (pastoresDe(s)[az.entero(0, 1)]?.persona_id)
          : (vigenteEn(rolesSede[s.id]?.COORDINADOR_NUEVOS, f)[0]?.persona_id ?? coordinadores[0]?.persona_id ?? pastoresDe(s)[1]?.persona_id);
        const hora = az.horaEntre(tipo === 'visita' ? '15:00' : '09:00', '20:30', 5);
        const cuando = instante(f, hora, s.zona_horaria);
        if (cuando.llave <= momento.llave) continue;
        const siguiente = reaccion === 'no_interesado' ? null
          : az.elegir(SIGUIENTE[reaccion])({ grupo: n.grupoSugerido });
        const largo = modo === 'activo' && i > 0;
        const prox = reaccion === 'interesado' ? sumarDias(f, largo ? (viejo ? az.entero(14, 24) : az.entero(6, 14)) : az.entero(3, 10))
          : reaccion === 'dudoso' ? sumarDias(f, largo ? (viejo ? az.entero(21, 40) : az.entero(12, 28)) : az.entero(7, 20))
            : reaccion === 'no_contesto' ? sumarDias(f, largo && viejo ? az.entero(5, 12) : az.entero(2, 5)) : null;
        lista.push({ id: az.uuid(), nuevo_id: n.id, coordinador_id: quienHace, ocurrido_en: cuando.iso, tipo,
          resumen: az.elegir(textos)({ nombre }), reaccion, siguiente_paso: siguiente, proximo_contacto: prox,
          registrado_en: instante(f, hora, s.zona_horaria, az.entero(2, 90)).iso, llave: cuando.llave });
        if (quienHace && az.probabilidad(0.07)) {
          notas.push({ id: az.uuid(), nuevo_id: n.id, autor_id: quienHace, nota: az.elegir(NOTAS_PRIVADAS),
            creada_en: instante(f, hora, s.zona_horaria, az.entero(5, 30)).iso });
        }
        // La regla de la API: la reacción decide el estado; la fecha próxima se conserva si no se da otra.
        estado = reaccion === 'no_interesado' ? 'no_interesado' : estado === 'nuevo' ? 'contactado' : 'en_seguimiento';
        proximo = prox ?? proximo;
        previa = reaccion;
        momento = cuando;
        if (reaccion === 'no_interesado') break;
      }
      // Quien sigue en seguimiento casi siempre tiene ya agendada la próxima llamada.
      if (modo === 'activo' && lista.length && proximo < HOY && diasEntre(momento.fecha, TOPE) <= 30 && az.probabilidad(0.8)) {
        proximo = sumarDias(TOPE, az.entero(2, 14));
        lista[lista.length - 1].proximo_contacto = proximo;
      }
      return { lista, estado, proximo, ultimo: momento };
    };

    for (const s of SEDES) {
      const az = azar.derivar('nuevos:' + s.codigo);
      const adultos = (gentePorSede.get(s.id) ?? []).filter(p => p.edad >= 18).length;
      const meses = Math.max(1, diasEntre(s.desde, TOPE) / 30.4);
      const origenes = s.pais === 'ES' ? { ES: 55, CO: 30, VE: 15 } : s.pais === 'US' ? { US: 20, CO: 50, VE: 30 }
        : s.pais === 'PA' ? { PA: 50, CO: 30, VE: 20 } : { CO: 90, VE: 10 };
      const grupoDeLaSede = grupos.filter(g => g.sede === s && g.clase === 'familiar' && g.perfil === 'activo');
      const sugerido = () => {
        if (!grupoDeLaSede.length) return null;
        const g = az.elegir(grupoDeLaSede);
        return `${g.nombre} (${DIAS_TXT[g.dia]} ${hora12(g.hora)})`;
      };
      const horaVisita = () => {
        const hs = horasDomingo(s);
        return mover('2000-01-02', az.elegir(hs), az.entero(95, 140)).hora;
      };

      // 5a · Los que llegaron y todavía no están integrados: gente nueva, que el maestro no tiene.
      const cuantos = Math.round(adultos * 0.1 * Math.min(1, meses / 12)) + 2;
      for (let i = 0; i < cuantos; i++) {
        const origen = az.ponderado(origenes);
        const p = d.inventarPersona(az, { usados: u, origen, edad: az.entero(18, 67),
          conCorreo: az.probabilidad(0.78), conTelefono: az.probabilidad(0.92) });
        if (!p.email_principal && !p.telefono_movil) p.telefono_movil = d.telefonoNuevo(az, u.telefonos);
        // Cuándo llegó: un tercio en las últimas tres semanas.
        // En las sedes grandes y medianas, el primero es alguien que llegó hace unos días y nadie ha llamado.
        const atrasado = i === 0 && s.tamano !== 'pequena';
        const antig = atrasado ? 'atrasado' : az.ponderado([['reciente', 36], ['medio', 34], ['viejo', 30]]);
        const tope = antig === 'reciente' ? 0 : antig === 'atrasado' ? 3 : antig === 'medio' ? 21 : 90;
        const desde = antig === 'reciente' ? sumarDias(TOPE, -20) : antig === 'atrasado' ? sumarDias(TOPE, -8)
          : antig === 'medio' ? sumarDias(TOPE, -90) : s.desde;
        const hasta = sumarDias(TOPE, -tope);
        if (desde > hasta) continue;
        let f = az.fechaEntre(maxFecha(desde, s.desde), hasta);
        const fuente = az.ponderado({ web: 52, presencial: 42, evento: 6 });
        if (fuente === 'presencial') f = sumarDias(f, -diaSemana(f)) >= s.desde ? sumarDias(f, -diaSemana(f)) : f;
        const reg = fuente === 'web' ? instante(f, az.horaEntre('07:00', '22:40', 5), s.zona_horaria)
          : instante(f, horaVisita(), s.zona_horaria);
        const dias = diasEntre(f, TOPE);
        const modo = atrasado ? 'sin_contacto' : dias <= 2 ? (az.probabilidad(0.8) ? 'sin_contacto' : 'activo')
          : dias <= 9 ? (az.probabilidad(0.15) ? 'sin_contacto' : 'activo')
            : dias <= 60 ? az.ponderado({ activo: 71, cerrado: 14, descuidado: 11, sin_contacto: 4 })
              : az.ponderado({ activo: 54, cerrado: 30, descuidado: 16 });
        const nombre = [p.primer_nombre, p.segundo_nombre && az.probabilidad(0.3) ? p.segundo_nombre : null, p.primer_apellido,
          p.segundo_apellido && az.probabilidad(0.5) ? p.segundo_apellido : null].filter(Boolean).join(' ');
        const n = {
          id: az.uuid(), sede: s, reg, fuente, nombre, primer_nombre: p.primer_nombre, email: p.email_principal, telefono: p.telefono_movil,
          como_supo: fuente === 'evento' ? 'evento' : az.ponderado({ amigo: 50, redes: 20, google: 11, evento: 9, otro: 10 }),
          es_cristiano: az.ponderado({ si: 45, duda: 30, no: 25 }),
          comentarios: az.probabilidad(0.6) ? (origen === 'VE' && az.probabilidad(0.5) ? COMENTARIO_VE : az.elegir(COMENTARIOS)({ ciudad: s.ciudad })) : null,
          modo, grupoSugerido: sugerido(),
        };
        n.prioridad = n.es_cristiano === 'no' || /salud|oren|reconciliarme|perdí/i.test(n.comentarios ?? '') ? 'alta'
          : n.es_cristiano === 'si' && az.probabilidad(0.4) ? 'baja' : 'media';
        const sim = simular(az, n, s, TOPE, n.modo);
        n.contactos = sim.lista; n.estado = sim.estado; n.proximo = sim.proximo;
        nuevos.push(n);
      }

      // 5b · Los que se integraron: visitantes del núcleo con correo (la conversión los vincula).
      for (const [pid, x] of integrados) {
        if (x.sede !== s) continue;
        const p = x.persona;
        const fuente = az.ponderado({ presencial: 55, web: 38, evento: 7 });
        const creado = p.creado_local.split(' ');
        const reg = fuente === 'web' ? instante(p.llego, az.horaEntre('18:30', '22:30', 5), s.zona_horaria)
          : instante(p.llego, creado[1] ?? '11:00', s.zona_horaria, -az.entero(10, 45));
        const n = {
          id: az.uuid(), sede: s, reg, fuente, persona: p,
          nombre: `${p.primer_nombre} ${p.primer_apellido}${p.segundo_apellido ? ' ' + p.segundo_apellido : ''}`,
          primer_nombre: p.primer_nombre, email: p.email, telefono: p.telefono,
          como_supo: fuente === 'evento' ? 'evento' : az.ponderado({ amigo: 55, redes: 18, google: 9, evento: 8, otro: 10 }),
          es_cristiano: az.ponderado({ si: 40, duda: 38, no: 22 }),
          comentarios: az.probabilidad(0.5) ? az.elegir(COMENTARIOS)({ ciudad: s.ciudad }) : null,
          prioridad: 'media', grupoSugerido: sugerido(),
        };
        const sim = simular(az, n, s, sumarDias(TOPE, -2), 'convertir');
        n.contactos = sim.lista;
        // La decisión: días después de la última llamada.
        const desdeConv = sumarDias(sim.ultimo.fecha, az.entero(2, 18));
        n.conversion = minFecha(maxFecha(desdeConv, sumarDias(p.llego, 5)), sumarDias(TOPE, -1));
        if (n.conversion <= sim.ultimo.fecha) n.conversion = sumarDias(sim.ultimo.fecha, 1);
        if (n.conversion > TOPE) { n.contactos = n.contactos.slice(0, 1); n.conversion = TOPE; }
        n.estado = 'convertido_pendiente';
        n.proximo = sim.proximo;
        // Grupo y padrino al integrarse.
        const abiertos = gruposAbiertos(s, n.conversion).filter(g => !g.cupo || g.miembros.length < g.cupo);
        if (abiertos.length && az.probabilidad(0.55)) {
          const nic = abiertos.filter(g => g.clase === 'nicodemo');
          const g = nic.length && az.probabilidad(0.3) ? az.elegir(nic) : az.elegir(abiertos.filter(x => x.clase === 'familiar').length
            ? abiertos.filter(x => x.clase === 'familiar') : abiertos);
          n.grupo = g;
          g.miembros.push({ persona: p, rol: 'miembro', ingreso: n.conversion, conversion: true });
        }
        if (az.probabilidad(0.35)) {
          // El padrino: alguien maduro del mismo género, del grupo al que entra si lo hay.
          const candidatos = (n.grupo ? n.grupo.miembros.filter(m => !m.conversion && !m.salida).map(m => m.persona)
            : (gentePorSede.get(s.id) ?? []))
            .filter(q => q.genero === p.genero && q.id !== p.id && q.nivel !== 'visitante' && q.bautizado && q.edad >= 25
              && !integrados.has(q.id));
          if (candidatos.length) n.padrino = az.elegir(candidatos);
        }
        n.canales = null;
        nuevos.push(n);
      }
    }
    // Los canales que la persona integrada autorizó (solo los que hoy tiene vigentes: la conversión
    // los vuelve a escribir y así no se reabre lo que alguien revocó).
    {
      const ids = nuevos.filter(n => n.persona).map(n => n.persona.id);
      const { rows } = await c.query(
        `SELECT v.id, array_remove(ARRAY[
                  CASE WHEN plataforma.puede_contactar(v.id, 'email', 'convocatoria') THEN 'email' END,
                  CASE WHEN plataforma.puede_contactar(v.id, 'whatsapp', 'convocatoria') THEN 'whatsapp' END,
                  CASE WHEN plataforma.puede_contactar(v.id, 'sms', 'convocatoria') THEN 'sms' END,
                  CASE WHEN plataforma.puede_contactar(v.id, 'llamada', 'convocatoria') THEN 'llamada' END], NULL) AS canales
           FROM unnest($1::uuid[]) AS v(id)`, [ids]);
      const canalesDe = new Map(rows.map(r => [r.id, r.canales]));
      for (const n of nuevos.filter(x => x.persona)) {
        const cs = canalesDe.get(n.persona.id) ?? [];
        n.canales = cs.length && n.fuente === 'web' ? cs : null;
      }
    }
    // A la base: los registros de la bandeja (el coordinador de ese momento), con la política vigente.
    const azCoord = azar.derivar('coordinador');
    const filasNuevo = nuevos.map(n => {
      const cs = coordEn(n.sede, n.reg.fecha);
      n.coordinador = cs.length ? azCoord.elegir(cs).persona_id : null;
      const canales = n.canales ?? (!n.persona && n.fuente === 'web' && azCoord.probabilidad(0.85)
        ? azCoord.muestra(['email', 'whatsapp', 'llamada', 'sms'].filter(k => (k === 'email' ? n.email : n.telefono)), azCoord.entero(1, 3)) : null);
      n.canalesFinal = canales && canales.length ? canales : null;
      return {
        id: n.id, sede_id: n.sede.id, nombre: n.nombre, email: n.email, telefono: n.telefono, como_supo: n.como_supo,
        es_cristiano: n.es_cristiano, comentarios: n.comentarios, estado: 'nuevo', coordinador_id: n.coordinador,
        proximo_contacto: sumarDias(n.reg.fecha, 1), prioridad: n.prioridad, fuente: n.fuente === 'evento' ? 'evento' : n.fuente,
        registrado_en: n.reg.iso,
        ip_registro: n.fuente === 'web' ? `203.0.113.${azCoord.entero(2, 250)}` : null,
        canales_autorizados: n.canalesFinal ? `{${n.canalesFinal.join(',')}}` : null,
        autorizado_en: n.canalesFinal ? n.reg.iso : null,
        politica_version: n.canalesFinal ? (n.reg.fecha < '2025-11-01' ? 'v1.0' : 'v2.0') : null,
      };
    });
    for (const [sedeId, lote] of agrupar(filasNuevo, x => x.sede_id)) {
      const s = porId[sedeId];
      await autor(lote[0].coordinador_id ?? pastoresDe(s)[1]?.persona_id, sedeId, 2, `${MOTIVO} · bandeja de nuevos`);
      await insertarLote(c, 'crm.nuevos_registros', lote);
    }
    // Las llamadas y mensajes (solo se agregan), y las notas que solo ve el coordinador.
    for (const n of nuevos) contactos.push(...n.contactos);
    await insertarLote(c, 'crm.contactos_nuevos', contactos.map(({ llave, ...x }) => x));
    await insertarLote(c, 'crm.notas_privadas_nuevos', notas);
    // El estado que la API deriva de cada contacto, y la próxima fecha que dejó el último.
    const abiertosBandeja = nuevos.filter(n => !n.persona);
    await c.query(
      `UPDATE crm.nuevos_registros r SET estado = v.estado::crm.estado_nuevo, proximo_contacto = v.proximo
         FROM unnest($1::uuid[], $2::text[], $3::date[]) AS v(id, estado, proximo)
        WHERE r.id = v.id AND r.estado::text <> v.estado`,
      [abiertosBandeja.map(n => n.id), abiertosBandeja.map(n => n.estado), abiertosBandeja.map(n => n.proximo)]);
    const intermedios = nuevos.filter(n => n.persona && n.contactos.length);
    await c.query(
      `UPDATE crm.nuevos_registros r SET estado = CASE WHEN v.n > 1 THEN 'en_seguimiento' ELSE 'contactado' END::crm.estado_nuevo,
              proximo_contacto = v.proximo
         FROM unnest($1::uuid[], $2::int[], $3::date[]) AS v(id, n, proximo)
        WHERE r.id = v.id`,
      [intermedios.map(n => n.id), intermedios.map(n => n.contactos.length), intermedios.map(n => n.proximo)]);
    conteo.nuevos = nuevos.length;
    conteo.contactos = contactos.length;
    paso(`${nuevos.length} registros en la bandeja, ${contactos.length} contactos`);

    // 5c · La integración, con la función de la base (grupo y padrino), a nombre del coordinador.
    const convertidos = nuevos.filter(n => n.persona).sort((a, b) => (a.conversion < b.conversion ? -1 : a.conversion > b.conversion ? 1 : 0));
    const azC = azar.derivar('conversion');
    for (const n of convertidos) {
      const s = n.sede;
      const quien = vigenteEn(rolesSede[s.id]?.COORDINADOR_NUEVOS, n.conversion)[0]?.persona_id ?? n.coordinador ?? pastoresDe(s)[0]?.persona_id;
      await autor(quien, s.id, 2, `${MOTIVO} · integración desde la bandeja`);
      const nota = n.grupo ? `Se integra al ${n.grupo.nombre}${n.padrino ? `; su padrino es ${n.padrino.primer_nombre} ${n.padrino.primer_apellido}` : ''}.`
        : 'Decidió quedarse en la iglesia; se le ofrecerá un grupo cerca de su casa.';
      const { rows: [r] } = await c.query(`SELECT crm.convertir_en_miembro($1, $2, $3, $4, $5, $6::date) AS persona_id`,
        [n.id, quien, nota, n.grupo?.id ?? null, n.padrino?.id ?? null, n.conversion]);
      if (r.persona_id !== n.persona.id) throw new Error(`La conversión de ${n.nombre} no vinculó a la persona del núcleo.`);
      n.convertidoPor = quien;
      n.convertido = instante(n.conversion, azC.horaEntre('10:00', '19:30', 5), s.zona_horaria);
    }
    // ⛔ La función sella convertido_en con now() aunque recibe la fecha de la decisión: se corrige.
    if (convertidos.length) {
      await autorDG('Corrección: la integración ocurrió en la fecha de la decisión, no hoy');
      await c.query(
        `UPDATE crm.nuevos_registros r SET convertido_en = v.cuando
           FROM unnest($1::uuid[], $2::timestamptz[]) AS v(id, cuando) WHERE r.id = v.id`,
        [convertidos.map(n => n.id), convertidos.map(n => n.convertido.iso)]);
    }
    // 5d · El recorrido 4C: «conoce» desde que llegó; quien entró a un grupo pasa a «conéctate».
    const pasos4c = [];
    for (const n of convertidos) {
      const s = n.sede;
      await autor(n.convertidoPor, s.id, 2, `${MOTIVO} · recorrido 4C`);
      await c.query(`SELECT crm.anotar_hecho($1, $2, $3::timestamptz, 'PRIMERA_VISITA', 'nuevos', 'nuevo_registro', $4, $5, $6::jsonb, $7, $8)`,
        [n.persona.id, s.id, n.reg.iso, n.id,
          n.fuente === 'web' ? 'Primera visita: se registró en el formulario de bienvenida de la página.'
            : n.fuente === 'evento' ? 'Primera visita: llegó a un evento de la sede y dejó sus datos.'
              : 'Primera visita: llenó la tarjeta de bienvenida en el servicio.',
          JSON.stringify({ como_supo: n.como_supo, fuente: n.fuente }), SISTEMA, `primera-visita-${n.id.slice(0, 8)}`]);
      if (!n.grupo) continue;
      const lider = n.grupo.lider;
      const entro = instante(n.conversion, n.convertido.hora, s.zona_horaria, 5);
      pasos4c.push({ n, entro, lider });
    }
    for (const x of pasos4c) {
      const { n, entro, lider } = x;
      const s = n.sede;
      await autor(n.convertidoPor, s.id, 2, `${MOTIVO} · recorrido 4C`);
      await c.query(`UPDATE crm.recorrido SET salio_en = $2::timestamptz WHERE persona_id = $1 AND salio_en IS NULL`, [n.persona.id, entro.iso]);
      const id = azC.uuid();
      await c.query(
        `INSERT INTO crm.recorrido (id, persona_id, sede_id, etapa, entro_en, puerta_entrada, responsable_id, source_system, source_id)
         VALUES ($1, $2, $3, 'conectate', $4::timestamptz, $5, $6, $7, $8)`,
        [id, n.persona.id, s.id, entro.iso, n.como_supo, n.padrino?.id ?? lider.id, SISTEMA, `4c-${n.id.slice(0, 8)}`]);
      await c.query(`SELECT crm.anotar_hecho($1, $2, $3::timestamptz, 'CAMBIO_ETAPA', 'crm', 'recorrido', $4, $5, $6::jsonb, $7, $8)`,
        [n.persona.id, s.id, entro.iso, id, `Pasó a Conéctate: se integró al ${n.grupo.nombre}.`,
          JSON.stringify({ etapa_anterior: 'conoce', etapa: 'conectate', grupo_id: n.grupo.id }), SISTEMA, `4c-${n.id.slice(0, 8)}`]);
    }
    conteo.integrados = convertidos.length;
    paso(`${convertidos.length} integrados con crm.convertir_en_miembro, ${pasos4c.length} ya en Conéctate`);

    /* ══ 6 · LOS GRUPOS QUE SE CERRARON Y SE UNIERON A OTRO ═══════════ */
    for (const g of grupos.filter(x => x.perfil === 'cerrado')) {
      const s = g.sede;
      const az = azar.derivar('cierre:' + g.id);
      const otro = g.absorbe;
      const lugarNuevo = az.elegir(CIUDADES_MUDANZA.filter(x => x !== s.ciudad));
      const motivo = `El grupo se unió al ${otro.nombre}: los anfitriones se mudaron a ${lugarNuevo}.`;
      // ⛔ Primero las salidas y después el cierre: con el grupo cerrado, la base ya no deja tocar sus membresías.
      await autor(g.lider.id, s.id, 2, `${MOTIVO} · cierre del grupo`);
      await c.query(
        `UPDATE grupos.membresias SET fecha_salida = $2, motivo_salida = $3, sacado_por = $4
          WHERE grupo_id = $1 AND fecha_salida IS NULL`, [g.id, g.cierre, motivo, g.lider.id]);
      // Los que siguen, al grupo que los recibió (los recibe su líder).
      const siguen = g.miembros.filter(m => !m.salida && !m.conversion && az.probabilidad(m.persona.id === g.lider.id ? 1 : 0.65));
      const filas = [];
      for (const m of siguen) {
        if (otro.miembros.some(x => x.persona.id === m.persona.id)) continue;
        const ingreso = minFecha(sumarDias(g.cierre, az.entero(3, 14)), TOPE);
        const mm = { id: az.uuid(), grupo: otro, persona: m.persona, rol: 'miembro', ingreso };
        otro.miembros.push(mm);
        filas.push({ id: mm.id, grupo_id: otro.id, persona_id: m.persona.id, rol: 'miembro', fecha_ingreso: ingreso,
          source_system: SISTEMA, source_id: `membresia-${mm.id.slice(0, 8)}`, agregado_por: otro.lider.id });
      }
      await autor(otro.lider.id, s.id, 2, `${MOTIVO} · integrantes que llegan de otro grupo`);
      await insertarLote(c, 'grupos.membresias', filas);
      await autor(g.pastor?.persona_id ?? DG.persona_id, s.id, 3, `Cierre del grupo: se unió al ${otro.nombre}`);
      await c.query(`UPDATE grupos.grupos SET cerrado_en = $2, abierto = false WHERE id = $1`, [g.id, g.cierre]);
    }
    paso(`${grupos.filter(x => x.perfil === 'cerrado').length} grupos cerrados`);

    /* ══ 7 · LOS AVISOS QUE ENCOLARON LOS DISPARADORES ════════════════
       Nacen con now(): se les pone la fecha del hecho. Lo anterior a ayer lo
       mueve el trabajador de la base (tomar y marcar), como lo haría la API;
       lo de ayer queda en cola para el trabajador de 60. Solo si la cola no
       tiene nada más: el trabajador toma lo que haya, y no debe tomar lo ajeno. */
    {
      const ids = nuevos.map(n => n.id);
      await autorDG('Corrección: el aviso se encoló cuando ocurrió el hecho, no hoy');
      await c.query(
        `UPDATE plataforma.notificaciones x
            SET creada_en = CASE WHEN x.plantilla = 'Confirmacion_miembro' THEN r.convertido_en ELSE r.registrado_en END
                            + make_interval(secs => 20 + (get_byte(decode(md5(x.id::text), 'hex'), 0) % 90))
           FROM crm.nuevos_registros r
          WHERE x.origen_modulo = 'nuevos' AND x.origen_id = r.id::text AND r.id = ANY($1::uuid[])`, [ids]);
      await c.query(
        `UPDATE plataforma.avisos_no_enviados x
            SET ocurrido_en = CASE WHEN x.plantilla = 'Confirmacion_miembro' THEN r.convertido_en ELSE r.registrado_en END
                              + interval '20 seconds'
           FROM crm.nuevos_registros r
          WHERE x.origen_modulo = 'nuevos' AND x.origen_id = r.id::text AND r.id = ANY($1::uuid[])`, [ids]);
      // Cuántos de los viejos tomaría el trabajador: los que no descarta por consentimiento (su misma regla).
      const { rows: [cola] } = await c.query(
        `SELECT count(*) FILTER (WHERE NOT (origen_modulo = 'nuevos' AND origen_id = ANY($1::text[])))::int AS ajenos,
                count(*) FILTER (WHERE origen_modulo = 'nuevos' AND origen_id = ANY($1::text[])
                                   AND creada_en < $2::timestamptz
                                   AND NOT (persona_id IS NOT NULL AND COALESCE(finalidad, 'convocatoria') <> 'emergencia'
                                            AND NOT plataforma.puede_contactar(persona_id, canal, COALESCE(finalidad, 'convocatoria')))
                                )::int AS viejos
           FROM plataforma.notificaciones WHERE estado = 'pendiente'`,
        [ids.map(String), momentoLocal(TOPE, '00:00', 'America/Bogota')]);
      conteo.avisos_en_cola_ajenos = cola.ajenos;
      if (!cola.ajenos && cola.viejos) {
        const { rows: tomadas } = await c.query(`SELECT t.id FROM plataforma.tomar_notificaciones($1) t`, [cola.viejos]);
        for (const t of tomadas) {
          await c.query(`SELECT plataforma.marcar_notificacion($1, true, NULL, $2)`, [t.id, `demo-${t.id.slice(0, 13)}`]);
        }
        // La hora en que habrían salido: segundos después de encolarse.
        await c.query(
          `UPDATE plataforma.notificaciones x
              SET tomada_en = x.creada_en + interval '15 seconds',
                  enviada_en = x.creada_en + make_interval(secs => 25 + (get_byte(decode(md5(x.id::text), 'hex'), 1) % 150))
            WHERE x.id = ANY($1::uuid[]) AND x.estado = 'enviada'`, [tomadas.map(t => t.id)]);
        conteo.avisos_enviados = tomadas.length;
      }
    }

    /* ══ 8 · CUENTAS DE QUIENES RECIBIERON UN ROL AQUÍ ════════════════ */
    {
      const az = azar.derivar('cuentas');
      const sinCuenta = otorgados.filter(o => !o.persona.con_cuenta);
      // El motivo que quedó puesto era el de la corrección de los avisos: la cuenta dice el suyo.
      await c.query(`SELECT set_config('app.motivo', $1, true)`, ['Cuenta de acceso para quien recibió un cargo']);
      const creadas = new Set();
      for (const o of sinCuenta) {
        if (creadas.has(o.persona.id)) continue;
        creadas.add(o.persona.id);
        const usuario = o.persona.email ?? `cuenta.${o.persona.id.slice(0, 8)}@example.org`;
        await c.query(`SELECT identidad.crear_cuenta($1, $2, $3, $4)`, [o.persona.id, usuario, hashClave, DG.persona_id]);
      }
      // Último ingreso: el líder entra cuando reporta; el registro, el domingo; los de Legado, en las últimas semanas.
      const ingreso = new Map();
      for (const o of otorgados) {
        let cuando = null;
        if (o.rol === 'LIDER_GRUPO' && o.grupo.reuniones.length) cuando = o.grupo.reuniones[o.grupo.reuniones.length - 1].reporte.iso;
        else if (o.rol === 'ASISTENCIA_REGISTRO') cuando = instante(TOPE, '07:10', o.sede.zona_horaria, az.entero(0, 40)).iso;
        else if (o.rol !== 'LIDER_GRUPO') cuando = instante(sumarDias(TOPE, -az.entero(1, 18)), az.horaEntre('07:00', '21:30'), o.sede.zona_horaria).iso;
        if (cuando && (!ingreso.has(o.persona.id) || ingreso.get(o.persona.id) < cuando)) ingreso.set(o.persona.id, cuando);
      }
      await c.query(`UPDATE identidad.cuentas c SET ultimo_ingreso = v.cuando
                       FROM unnest($1::uuid[], $2::timestamptz[]) AS v(persona_id, cuando) WHERE c.persona_id = v.persona_id`,
        [[...ingreso.keys()], [...ingreso.values()]]);
      // Los líderes recién nombrados que no han entrado: clave provisional.
      const provisionales = otorgados.filter(o => o.rol === 'LIDER_GRUPO' && !o.grupo.reuniones.length
        && diasEntre(o.desde, TOPE) < 25 && !ingreso.has(o.persona.id)).map(o => o.persona.id);
      if (provisionales.length) {
        await c.query(`UPDATE identidad.cuentas SET debe_cambiar_clave = true WHERE persona_id = ANY($1::uuid[])`, [provisionales]);
      }
      // El líder de un grupo que se cerró y no tiene otro cargo: la cuenta se suspende (con la función de la base).
      await autorDG(`${MOTIVO} · fin de un cargo`);
      for (const o of otorgados.filter(x => x.hasta)) {
        if (otorgados.some(y => y.persona.id === o.persona.id && !y.hasta) || o.persona.con_rol) continue;
        await c.query(`SELECT identidad.suspender_cuenta($1, $2)`,
          [o.persona.id, `Terminó su servicio como líder del ${o.grupo.nombre} el ${o.hasta}: el grupo se unió al ${o.grupo.absorbe.nombre}.`]);
      }
      conteo.cuentas_nuevas = creadas.size;
    }

    /* ══ 9 · EL COMITÉ DE HOY TAMBIÉN REVISÓ LOS CARGOS NUEVOS DE LA REGIÓN BOGOTÁ ══
       El núcleo recertificó hoy la región Bogotá y la central: los líderes de
       grupo de esa región pasan por el mismo comité, o saldrían «vencidos». */
    {
      const { rows } = await c.query(
        `SELECT a.id, a.rol, a.alcance_id FROM identidad.asignaciones a
           JOIN nucleo.personas p ON p.id = a.persona_id
           JOIN org.sedes s ON s.id = p.sede_id JOIN org.unidades r ON r.id = s.unidad_id
          WHERE a.id = ANY($1::uuid[]) AND r.codigo = 'REG-BOG' AND a.revocada_en IS NULL
            AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE) AND a.vigente_desde <= CURRENT_DATE
          ORDER BY s.codigo, a.rol, a.id`, [otorgados.map(o => o.asignacion)]);
      await autorDG('Comité trimestral de accesos');
      const callados = new Set(grupos.filter(g => g.perfil === 'callado').map(g => g.id));
      for (const a of rows) {
        const nota = a.rol === 'LIDER_GRUPO' && callados.has(a.alcance_id)
          ? `Comité trimestral de accesos del ${HOY}: sigue en el cargo; su grupo no reporta reunión hace semanas y la pareja pastoral lo acompaña.`
          : `Comité trimestral de accesos del ${HOY}: sigue en el cargo y usa el acceso que tiene.`;
        await c.query(`SELECT identidad.recertificar($1, 'se_mantiene', $2)`, [a.id, nota]);
      }
      conteo.recertificados = rows.length;
    }
    await autorDG();
    conteo.se_fueron = seFueron.length;
    paso('listo');
  });

  // Lo que quedó (la línea de tiempo y los avisos cuentan también lo que escribieron los disparadores).
  const salida = await d.contarFilas(c, ['grupos.grupos', 'grupos.membresias', 'grupos.reuniones', 'asistencia.servicios',
    'asistencia.conteos', 'asistencia.entradas', 'crm.nuevos_registros', 'crm.contactos_nuevos', 'crm.notas_privadas_nuevos',
    'crm.recorrido']);
  const { rows: extra } = await c.query(
    `SELECT 'identidad.asignaciones (' || rol || ')' AS t, count(*)::int AS n FROM identidad.asignaciones
      WHERE rol IN ('LIDER_GRUPO', 'DIRECTOR_SEGMENTO', 'COORDINADOR_SEGMENTO', 'ASISTENCIA_REGISTRO') GROUP BY rol
     UNION ALL SELECT 'identidad.cuentas', count(*)::int FROM identidad.cuentas
     UNION ALL SELECT 'crm.linea_tiempo (' || tipo || ')', count(*)::int FROM crm.linea_tiempo
      WHERE tipo IN ('INGRESO_GRUPO', 'SALIDA_GRUPO', 'ASISTENCIA', 'CAMBIO_ETAPA', 'PRIMERA_VISITA') GROUP BY tipo
     UNION ALL SELECT 'plataforma.notificaciones (' || estado || ')', count(*)::int FROM plataforma.notificaciones
      WHERE origen_modulo = 'nuevos' GROUP BY estado
     ORDER BY 1`);
  for (const r of extra) salida[r.t] = r.n;
  if (Object.keys(conteo).length) for (const [k, v] of Object.entries(conteo)) salida[`· ${k}`] = v;
  return salida;
});
