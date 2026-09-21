'use strict';
/**
 * =====================================================================
 * 30-cuidado-pastoral.js · CONSEJERÍA, ORACIÓN, PETICIONES INTERNAS,
 * REQUERIMIENTOS Y TAREAS DE LA RED DE DEMOSTRACIÓN
 *
 * ⛔ SOLO DEMOSTRACIÓN. Los casos, las notas, las peticiones, los
 *    requerimientos y las tareas son inventados, sobre las personas
 *    inventadas del núcleo (00-red.js). Nada de esto va a producción: la
 *    guarda de comun.js se niega a correr fuera de las bases de desarrollo.
 *
 * Lo que deja, por las reglas de la base y no alrededor de ellas:
 *   1. CONSEJERÍA. Casos por tópico en cada sede con el módulo encendido,
 *      abiertos por la pareja pastoral, con su consejero (del mismo sexo
 *      que quien consulta; si la sede no lo tiene, el pastor o la pastora),
 *      sesiones, notas y el desenlace de los cerrados. Los tópicos que
 *      exigen profesional llevan supervisión pastoral y casi siempre
 *      terminan derivados, con el lugar escrito. Los consejeros que ya no
 *      sirven entregan sus casos (Luz Hoyos en enero; Javier Saavedra hoy,
 *      como dice la revocación del comité de accesos).
 *   2. ORACIÓN. El equipo de intercesión de cada sede (LIDER_DE_ORACION y
 *      PERSONA_QUE_ORA, con acta de la dirección y cuenta de acceso), las
 *      peticiones internas y del formulario público, compartidas y
 *      confidenciales, las oraciones hechas por quien de verdad puede ver
 *      cada petición y los testimonios de las respondidas.
 *   3. PETICIONES INTERNAS de las sedes a la dirección, en todos sus
 *      estados. Las decide la dirección general, nunca quien pidió.
 *   4. REQUERIMIENTOS de la mesa de servicio, con la prioridad y el plazo
 *      que pone la base: asignados, en curso, resueltos, cerrados,
 *      cancelados, reabiertos y vencidos.
 *   5. TAREAS asignadas, en curso, hechas, canceladas y vencidas; algunas
 *      nacen de un requerimiento o de una petición aprobada.
 *
 * Cada estado avanza por las transiciones que la base valida, y cada
 * escritura lleva a su autor (app.persona_id), como hace la API: la
 * auditoría y la línea de tiempo dicen quién hizo qué.
 *
 * Uso: PGDATABASE=cr_e2e_60 node backend/db/demostracion/30-cuidado-pastoral.js
 * =====================================================================
 */
const path = require('path');
const d = require('./comun');
const {
  FECHA_REFERENCIA: HOY, AYER, SISTEMA, SALIDAS_POR_OLA, CLAVE_LABORATORIO,
  sumarDias, diasEntre, momentoLocal, minFecha, maxFecha, insertarLote, fijarAutor,
} = d;

const ARCHIVO = 30;

/* ─────────────────────────────────────────────────────────────────────
   1 · UTILIDADES PEQUEÑAS
   ───────────────────────────────────────────────────────────────────── */

/** Masculino o femenino según la persona. */
const g = (p, m, f) => (p.genero === 'F' ? f : m);

/** Una fecha entre `desde` y `hasta`, más probable cuanto más reciente. */
function fechaReciente(az, desde, hasta, sesgo = 1.5) {
  const total = diasEntre(desde, hasta);
  if (total <= 0) return hasta;
  return sumarDias(hasta, -Math.floor(total * Math.pow(az.siguiente(), sesgo)));
}

/** Un instante (texto con zona) de una fecha y una hora, en la zona de la sede. */
const en = (s, fecha, hora) => momentoLocal(fecha, hora, s.zona_horaria);

/** Minutos del día de una hora HH:MM, y al revés. */
const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + (b || 0); };
const aHora = (m) => { const t = Math.max(0, Math.min(23 * 60 + 55, m)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

/** Un momento {fecha, hora} desplazado en minutos (puede pasar al día siguiente). */
function mover(m, minutos) {
  let total = aMin(m.hora) + minutos, fecha = m.fecha;
  while (total >= 24 * 60) { total -= 24 * 60; fecha = sumarDias(fecha, 1); }
  while (total < 0) { total += 24 * 60; fecha = sumarDias(fecha, -1); }
  return { fecha, hora: aHora(total) };
}

/** Minutos de un momento {fecha, hora} a otro (de la misma sede). */
const minutosEntre = (a, b) => diasEntre(a.fecha, b.fecha) * 1440 + aMin(b.hora) - aMin(a.hora);

/** Orden de dos momentos {fecha, hora}. */
const clave = (m) => `${m.fecha} ${m.hora}`;
const antes = (a, b) => clave(a) < clave(b);

/** El último momento que puede tener algo que ya pasó: ayer a las 21:30. */
const TOPE = { fecha: AYER, hora: '21:30' };

/** Recorta un momento al tope (nada queda en el futuro). */
const hastaTope = (m) => (antes(TOPE, m) ? { ...TOPE } : m);

/** Dinero en la moneda del país de la sede, con miles a la colombiana. */
const MONEDA = { CO: ['COP', 1, 50000], US: ['USD', 1 / 4000, 10], PA: ['USD', 1 / 4000, 10], ES: ['EUR', 1 / 4400, 10] };
function dinero(s, cop) {
  const [m, f, paso] = MONEDA[s.pais] ?? MONEDA.CO;
  const v = Math.max(paso, Math.round((cop * f) / paso) * paso);
  return `${m} ${v.toLocaleString('es-CO')}`;
}

/** Nombre de un mes en minúscula. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesDe = (fecha) => MESES[Number(fecha.slice(5, 7)) - 1];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** «sábado 3 de octubre» */
const diaLargo = (fecha) => `${DIAS[d.diaSemana(fecha)]} ${Number(fecha.slice(8, 10))} de ${mesDe(fecha)}`;

/** El mismo día si es de lunes a viernes; si cae en fin de semana, el lunes siguiente. */
const diaHabil = (f) => { const dia = d.diaSemana(f); return dia === 6 ? sumarDias(f, 2) : dia === 0 ? sumarDias(f, 1) : f; };

/** Elige según pesos, ignorando las opciones con peso cero. */
const ponderado = (az, pesos) => az.ponderado(Object.entries(pesos).filter(([, p]) => p > 0));

/* ─────────────────────────────────────────────────────────────────────
   2 · CONSEJERÍA: LO QUE SE ESCRIBE EN CADA CASO
   Cada texto es una función (p, x): p es quien consulta ({nombre, genero})
   y x el contexto del caso (pareja, familiar, hijo, oficio, país...).
   Notas sobrias, sin detalles gráficos: son lo más privado que guarda la
   iglesia y se escriben pensando en quien las lea en un año.
   ───────────────────────────────────────────────────────────────────── */

/** Peso de cada tópico en la red (los que no estén aquí pesan 1). */
const PESO_TOPICO = {
  FAM: 22, ANSIEDAD: 12, DUELO: 10, FE: 9, CRIANZA: 9, FINANZAS: 8, LABORAL: 8,
  VOCACION: 5, ADICCION: 5, OTRO: 4, VIF: 3, ABUSO: 2, MENOR: 2, SUICIDIO: 1,
};

const DETONANTES = ['la llegada del segundo hijo', 'un cambio de trabajo', 'las deudas del hogar', 'la mudanza a otra ciudad',
  'la enfermedad de un familiar', 'problemas con la familia extensa', 'meses de horarios cruzados'];
const TIEMPOS = ['tres semanas', 'un mes', 'dos meses', 'cuatro meses', 'medio año'];
const OFICIOS = [['auxiliar contable', 'auxiliar contable'], ['asesor comercial', 'asesora comercial'], ['conductor', 'conductora'],
  ['técnico de mantenimiento', 'técnica de mantenimiento'], ['docente', 'docente'], ['cocinero', 'cocinera'],
  ['analista de datos', 'analista de datos'], ['recepcionista', 'recepcionista'], ['coordinador de bodega', 'coordinadora de bodega']];

/** Adónde se deriva, por país (CO, ES, US, PA). Se escriben para leerse después de «derivado a». */
const DERIVAR = {
  psicologia: { CO: ['psicología clínica por la EPS', 'una psicóloga de la red de apoyo de la iglesia'],
    ES: ['un psicólogo colegiado de la red de apoyo', 'el Centro de Salud Mental del distrito'],
    US: ['un terapeuta licenciado de la red de apoyo', 'el programa de salud mental del seguro médico'],
    PA: ['psicología de la Caja de Seguro Social', 'una psicóloga de la red de apoyo de la iglesia'] },
  psiquiatria: { CO: ['urgencias y psiquiatría de la EPS'], ES: ['urgencias y la unidad de salud mental del hospital'],
    US: ['urgencias y psiquiatría del hospital'], PA: ['urgencias y psiquiatría de la Caja de Seguro Social'] },
  violencia: { CO: ['la Comisaría de Familia y psicología', 'la Comisaría de Familia'],
    ES: ['los servicios sociales del ayuntamiento', 'el servicio de atención a víctimas de violencia'],
    US: ['los servicios de protección a víctimas del condado'], PA: ['el Ministerio Público y psicología'] },
  abuso: { CO: ['psicología especializada en trauma', 'la Fiscalía, con acompañamiento psicológico'],
    ES: ['un psicólogo especializado en trauma'], US: ['un terapeuta especializado en trauma'], PA: ['psicología especializada en trauma'] },
  menor: { CO: ['el ICBF', 'psicología infantil por la EPS'], ES: ['los servicios sociales y psicología infantil'],
    US: ['un terapeuta infantil licenciado'], PA: ['psicología infantil de la Caja de Seguro Social'] },
  adiccion: { CO: ['el programa ambulatorio de adicciones de la EPS', 'un centro de tratamiento de adicciones'],
    ES: ['el centro de atención a las adicciones del ayuntamiento'], US: ['el programa de tratamiento de adicciones del condado'],
    PA: ['el programa de adicciones de la Caja de Seguro Social'] },
  pareja: { CO: ['terapia de pareja con una psicóloga de la red de apoyo'], ES: ['terapia de pareja con un psicólogo colegiado'],
    US: ['terapia de pareja con un terapeuta licenciado'], PA: ['terapia de pareja con una psicóloga de la red de apoyo'] },
  finanzas: { CO: ['el consultorio jurídico de una universidad'], ES: ['la oficina municipal del consumidor'],
    US: ['una asesoría financiera sin costo del condado'], PA: ['la oficina de protección al consumidor'] },
  duelo: { CO: ['el grupo de apoyo en el duelo de la fundación aliada'], ES: ['el grupo de apoyo en el duelo del centro de salud'],
    US: ['el grupo de apoyo en el duelo del hospital'], PA: ['el grupo de apoyo en el duelo de la fundación aliada'] },
};

const CASOS = {
  FAM: {
    motivo: [
      (p, x) => `${p.nombre} pide acompañamiento porque la comunicación con ${x.pareja} se rompió después de ${x.detonante}. Discuten casi a diario y le preocupa que los hijos lo estén notando.`,
      (p, x) => `${p.nombre} llega ${g(p, 'cansado', 'cansada')} de los conflictos con ${x.pareja}: cada conversación termina en reproche. Quiere intentarlo todo antes de pensar en separarse.`,
      (p, x) => `Primera conversación. Hay tensión fuerte en el hogar desde ${x.detonante}. Se acordó empezar con sesiones individuales y, si ${x.pareja} acepta, seguir en pareja.`,
      (p, x) => `${p.nombre} cuenta que en la casa se sienten como dos extraños desde ${x.detonante}. Pide orientación para reconstruir la confianza.`,
    ],
    sesion: [
      () => 'Trabajamos la escucha sin interrumpir. Quedó de practicar diez minutos diarios de conversación sin pantallas.',
      (p, x) => `Vino con ${x.pareja}. Cada uno nombró una necesidad concreta y se comprometieron a un rato semanal a solas.`,
      () => 'Reportan menos discusiones. Seguimos con el perdón y con los acuerdos sobre el dinero de la casa.',
      () => 'Leímos Efesios 4:26 a 32 y hablamos de resolver los desacuerdos antes de que termine el día.',
      () => 'Semana difícil: volvió una discusión fuerte. Revisamos qué la disparó y qué harían distinto. Siguen comprometidos.',
      () => 'Hicieron el ejercicio de escribir tres cosas que valoran del otro y lo leyeron en voz alta. Fue un buen momento.',
    ],
    cierre: [
      () => 'La pareja retomó el diálogo y se integró a un grupo de matrimonios. Se cierra de común acuerdo; pueden volver cuando lo necesiten.',
      () => 'Los conflictos bajaron y ya tienen herramientas para conversar. Se cierra con seguimiento informal de su líder de grupo.',
      (p, x) => `${p.nombre} decidió no continuar por ahora porque ${x.pareja} no quiso participar. Se cierra dejando la puerta abierta.`,
      () => 'Terminaron el proceso y renovaron sus votos en el retiro de parejas. Se cierra con gratitud.',
    ],
    derivar: 'pareja',
  },
  ANSIEDAD: {
    motivo: [
      (p) => `${p.nombre} cuenta que desde hace semanas duerme mal, se siente ${g(p, 'abrumado', 'abrumada')} y le cuesta concentrarse en el trabajo. Dice que no ha pensado en hacerse daño. Se le explicó que conviene una valoración profesional y aceptó pedir cita.`,
      (p) => `${p.nombre} describe crisis de ansiedad antes de salir al trabajo, con el corazón acelerado y ganas de llorar. Se le acompañó con calma y se acordó buscar atención psicológica.`,
      (p) => `${p.nombre} se siente sin ánimo desde hace meses y dejó de ir al grupo. Su familia está preocupada. Se le propuso pedir cita con psicología y seguir con el acompañamiento pastoral.`,
    ],
    sesion: [
      () => 'Consiguió cita con psicología. Mientras tanto, acompañamiento pastoral: rutina de sueño, caminar en la mañana y una oración breve al despertar.',
      () => 'Ya empezó con la psicóloga y dice que le ayuda. Aquí nos enfocamos en no aislarse y en retomar el grupo.',
      () => 'Semana mejor. Volvió al servicio del domingo y habló con su líder. Sigue el tratamiento.',
      () => 'Tuvo una recaída leve por presión en el trabajo. Revisamos qué le funciona cuando la angustia sube y a quién llamar si empeora.',
      () => 'Leímos Filipenses 4:6 y 7. Habló de lo que le quita la paz y de lo que ya no depende de sí.',
    ],
    cierre: [
      () => 'Sigue en tratamiento con su psicóloga y se siente estable. Se cierra el acompañamiento pastoral; queda en contacto con su líder de grupo.',
      () => 'Terminó su proceso profesional y retomó su servicio en la iglesia. Se cierra con su acuerdo.',
    ],
    derivar: 'psicologia',
  },
  DUELO: {
    motivo: [
      (p, x) => `${p.nombre} perdió a su ${x.familiar} hace ${x.tiempo}. Pide acompañamiento porque siente que no alcanzó a despedirse. Tiene el apoyo de su familia.`,
      (p, x) => `${p.nombre} está en duelo por su ${x.familiar}. Dice que en la casa todos siguieron con su vida y siente que se quedó en el mismo lugar.`,
      (p, x) => `Acompañamiento de duelo. ${p.nombre} cuidó a su ${x.familiar} durante la enfermedad y ahora siente culpa y un cansancio que no se le quita.`,
    ],
    sesion: [
      (p, x) => `Habló de los recuerdos con su ${x.familiar}. Normalizamos que el duelo tiene altibajos. Le propuse escribirle una carta de despedida.`,
      () => 'Trajo la carta y la leyó. Lloró y dijo que sintió alivio. Oramos juntos.',
      () => 'Las fechas especiales le pegan duro y se acerca un cumpleaños. Acordamos que no pase ese día a solas.',
      () => 'Se siente algo mejor. Volvió a dormir bien y retomó sus rutinas de la semana.',
    ],
    cierre: [
      () => 'Terminó el proceso de duelo acompañado y volvió a servir en su ministerio. Se cierra con gratitud.',
      (p, x) => `Dice que ya puede hablar de su ${x.familiar} con paz. Se cierra; queda ${g(p, 'invitado', 'invitada')} al grupo de apoyo en el duelo.`,
    ],
    derivar: 'duelo',
  },
  FE: {
    motivo: [
      (p) => `${p.nombre} atraviesa un tiempo de dudas y sequedad espiritual. Dejó de leer la Biblia y de congregarse con regularidad, y quiere retomar.`,
      (p) => `${p.nombre} tiene preguntas sobre el sufrimiento después de una pérdida económica fuerte. Siente que Dios se quedó en silencio.`,
      (p) => `${p.nombre} se congrega hace poco y quiere entender mejor la fe. Pidió un espacio para sus preguntas.`,
    ],
    sesion: [
      () => 'Conversamos sobre el Salmo 42. Se propuso un plan de lectura corto, quince minutos al día.',
      () => 'Volvió al servicio del domingo dos semanas seguidas. Hablamos de sus preguntas y le presté un libro.',
      () => 'Oramos juntos. Dice que empieza a sentir paz, aunque las preguntas siguen ahí.',
    ],
    cierre: [
      () => 'Retomó su vida devocional y se inscribió en el curso de fundamentos. Se cierra el caso.',
      () => 'Se integró a un grupo y encontró con quién hablar de sus preguntas. Se cierra con su acuerdo.',
    ],
  },
  VOCACION: {
    motivo: [
      (p) => `${p.nombre} quiere discernir si su llamado es al ministerio o a seguir en su carrera. Está por terminar la universidad.`,
      (p) => `${p.nombre} lleva años sirviendo y se siente sin rumbo. Pide ayuda para entender dónde servir ahora.`,
    ],
    sesion: [
      () => 'Revisamos sus dones y lo que le apasiona. Tarea: conversar con dos líderes que sirven donde le gustaría servir.',
      () => 'Habló con los líderes y le gustó el trabajo con adolescentes. Seguimos orando por dirección.',
      () => 'Hablamos de cómo se toma una decisión con paz: consejo, oración y tiempo.',
    ],
    cierre: [
      () => 'Decidió servir en el equipo de jóvenes mientras termina la carrera. Se cierra el acompañamiento.',
      () => 'Tomó la decisión de empezar la escuela de líderes. Se cierra con alegría.',
    ],
  },
  FINANZAS: {
    motivo: [
      (p) => `${p.nombre} tiene deudas con tarjetas de crédito y no le alcanza para el mes. Pide orientación para organizarse.`,
      (p) => `${p.nombre} y su familia atrasaron el arriendo dos meses. Le da vergüenza contarlo en el grupo.`,
      (p) => `${p.nombre} cayó en un préstamo de pago diario con intereses abusivos y está ${g(p, 'asustado', 'asustada')}. Se le orientó a buscar asesoría antes de seguir pagando.`,
    ],
    sesion: [
      () => 'Hicimos un presupuesto sencillo. Identificó gastos pequeños que se suman y priorizó la deuda con el interés más alto.',
      () => 'Logró un acuerdo de pago con el banco. Sigue ajustando el presupuesto de la casa.',
      () => 'La iglesia le dio un mercado mientras se organiza. Revisamos ingresos y gastos de la semana.',
    ],
    cierre: [
      () => 'Organizó su presupuesto y está al día con el acuerdo de pago. Se cierra; se le recomendó el taller de finanzas.',
      () => 'Salió de la deuda más costosa y ya tiene un fondo pequeño para emergencias. Se cierra con gratitud.',
    ],
    derivar: 'finanzas',
  },
  LABORAL: {
    motivo: [
      (p, x) => `${p.nombre} quedó sin empleo hace ${x.tiempo}. Está ${g(p, 'angustiado', 'angustiada')} por los gastos de la casa.`,
      (p) => `${p.nombre} tiene un conflicto fuerte con su jefe y piensa renunciar sin tener otro trabajo. Quiere pensarlo con alguien.`,
      (p) => `${p.nombre} trabaja jornadas muy largas y siente que descuida a su familia y su vida espiritual.`,
    ],
    sesion: [
      () => 'Revisamos su hoja de vida y se le conectó con dos hermanos de la iglesia que conocen vacantes.',
      () => 'Tuvo una entrevista esta semana. Oramos por el proceso.',
      () => 'Hablamos de límites sanos en el trabajo y de cómo plantear la conversación con su jefe.',
    ],
    cierre: [
      (p, x) => `Consiguió trabajo como ${x.oficio}. Se cierra con gratitud y un testimonio para compartir.`,
      () => 'Decidió quedarse y ajustar sus horarios; la relación con su jefe mejoró. Se cierra.',
    ],
  },
  CRIANZA: {
    motivo: [
      (p, x) => `${p.nombre} consulta por la relación con su ${x.hijo} de ${x.edadHijo} años: discusiones fuertes y bajo rendimiento en el colegio.`,
      (p, x) => `${p.nombre} no sabe cómo poner límites a su ${x.hijo} de ${x.edadHijo} años, que pasa muchas horas en el celular.`,
      (p, x) => `${p.nombre} está criando ${g(p, 'solo', 'sola')} a su ${x.hijo} y se siente ${g(p, 'agotado', 'agotada')}. Pide orientación y apoyo.`,
    ],
    sesion: [
      (p, x) => `Hablamos de límites claros y de escuchar sin sermonear. Acordó un espacio semanal a solas con su ${x.hijo}.`,
      () => 'Probaron un acuerdo de horarios para el celular. Funcionó a medias y lo ajustamos.',
      (p, x) => `Su ${x.hijo} empezó a ir al grupo de su edad. ${p.nombre} nota un cambio de actitud en la casa.`,
    ],
    cierre: [
      (p, x) => `La relación mejoró y su ${x.hijo} se integró al grupo de su edad. Se cierra.`,
      (p) => `${p.nombre} tiene herramientas y una red de apoyo en su grupo. Se cierra con su acuerdo.`,
    ],
  },
  ADICCION: {
    motivo: [
      (p) => `${p.nombre} reconoce un consumo de alcohol que se le salió de las manos y está afectando a su familia. Pide ayuda. Se le explicó que necesita acompañamiento profesional además del pastoral.`,
      (p) => `La familia de ${p.nombre} pidió ayuda por su consumo. Aceptó venir y hablar. Se conversó con franqueza y con respeto.`,
      (p) => `${p.nombre} perdió buena parte de sus ahorros en apuestas en línea y no ha podido parar. Se acordó un plan con rendición de cuentas y apoyo profesional.`,
    ],
    sesion: [
      () => 'Lleva tres semanas sin consumir. Asiste a un grupo de apoyo los martes y su familia está al tanto.',
      () => 'Tuvo una recaída el fin de semana. Sin juzgar, revisamos qué la disparó y reforzamos el plan.',
      () => 'Sigue en el programa. Nombró a un compañero de rendición de cuentas en su grupo.',
    ],
    cierre: [
      () => 'Completó el programa ambulatorio y se mantiene en abstinencia. Se cierra con seguimiento de su líder.',
    ],
    derivar: 'adiccion',
  },
  VIF: {
    motivo: [
      (p, x) => `${p.nombre} relata episodios de maltrato en su hogar. Se verificó que hoy esté a salvo y se le explicó la ruta de atención. Caso reservado: no se comenta fuera de este expediente.`,
      (p) => `${p.nombre} pidió hablar en privado sobre agresiones en su casa. Se escuchó sin juzgar y se acordó un plan de seguridad con contactos de confianza.`,
    ],
    sesion: [
      () => 'Se le acompañó a poner la denuncia. Mientras tanto se queda en casa de un familiar.',
      () => 'Tiene medida de protección. La iglesia la apoya con mercado y oración.',
    ],
    cierre: [
      () => 'Se activó la ruta de protección y la familia está a salvo. La iglesia sigue acompañando con oración y apoyo práctico.',
    ],
    derivar: 'violencia',
  },
  ABUSO: {
    motivo: [
      (p) => `${p.nombre} pidió hablar de un abuso que vivió hace años y que nunca había contado. Se escuchó sin juzgar, se confirmó que hoy está a salvo y se le ofreció acompañamiento profesional.`,
      (p) => `${p.nombre} contó una situación de acoso en su trabajo. Se le orientó sobre cómo documentarla y a quién acudir.`,
    ],
    sesion: [
      () => 'Empezó con una profesional especializada. Aquí acompañamos en oración, sin presionar.',
      () => 'Habló de cómo está durmiendo y de lo que le ayuda. Se le recordó que puede escribir cuando lo necesite.',
    ],
    cierre: [
      (p) => `Sigue su proceso con la profesional y se siente ${g(p, 'acompañado', 'acompañada')}. Se cierra la parte pastoral.`,
    ],
    derivar: 'abuso',
  },
  MENOR: {
    motivo: [
      (p, x) => `${p.nombre} consulta por una situación de su ${x.hijo} de ${x.edadHijo} años que le preocupa en el colegio. Se le orientó sobre la ruta de protección de la niñez y se cuidó no exponer al menor.`,
      (p, x) => `${p.nombre} nota cambios fuertes en el comportamiento de su ${x.hijo} de ${x.edadHijo} años. Se le recomendó una valoración con psicología infantil.`,
    ],
    sesion: [
      () => 'Ya tienen cita con psicología infantil. Hablamos de cómo acompañar en la casa sin presionar.',
      () => 'El colegio está al tanto y hay un plan con la orientadora. Oramos por la familia.',
    ],
    cierre: [
      () => 'El menor recibe atención especializada y la familia está acompañada. Se cierra la parte pastoral.',
    ],
    derivar: 'menor',
  },
  SUICIDIO: {
    motivo: [
      (p, x) => `${p.nombre} expresó que ha pensado en no seguir viviendo. Se le acompañó a urgencias con un familiar ese mismo día y se activó la ruta de salud mental. La pareja pastoral hace seguimiento diario.`,
    ],
    sesion: [
      (p) => `Llamada de seguimiento: está en tratamiento, con su familia cerca, y se siente ${g(p, 'acompañado', 'acompañada')}.`,
    ],
    cierre: [
      () => 'Recibe tratamiento profesional y tiene una red de apoyo firme. La iglesia sigue en contacto.',
    ],
    derivar: 'psiquiatria',
  },
  OTRO: {
    motivo: [
      (p) => `${p.nombre} pide orientación sobre una decisión importante: le ofrecieron trabajo en otro país y no sabe si irse con la familia.`,
      (p) => `${p.nombre} cuida a su mamá enferma y siente que ya no puede más. Busca apoyo y orientación.`,
      (p) => `${p.nombre} tiene un conflicto con un hermano de la iglesia y no sabe cómo resolverlo.`,
    ],
    sesion: [
      () => 'Pusimos en la balanza lo bueno y lo difícil de cada camino. Oramos por dirección.',
      () => 'Hablamos de pedir ayuda y de repartir las cargas con la familia.',
      () => 'Preparamos juntos la conversación que tiene pendiente.',
    ],
    cierre: [
      () => 'Tomó su decisión con paz y la conversó con su familia. Se cierra.',
      () => 'Se reconcilió con el hermano después de una conversación mediada. Se cierra con gratitud.',
    ],
  },
};

/** Notas que no dependen del tópico. */
const NOTA_INASISTENCIA = [
  'No asistió. Se le escribió y se reprogramó para la próxima semana.',
  'No llegó a la cita; avisó después por un imprevisto del trabajo.',
  'No se conectó a la sesión virtual. Se le llamó, está bien, y se reprogramó.',
];
const NOTA_PAUSA = [
  (p) => `${p.nombre} pidió pausar el proceso por un viaje de trabajo. Retomará cuando regrese.`,
  (p) => `Pausa de común acuerdo: ${p.nombre} está con muchas cargas este mes y prefiere retomar más adelante.`,
  (p) => `Se pausa: ${p.nombre} se siente mejor y prefiere espaciar. Se le llamará en un mes.`,
];
const NOTA_RETOMA = [
  (p) => `${p.nombre} volvió a escribir y retomamos el proceso donde lo dejamos.`,
  () => 'Se retoma después de la pausa. Revisamos cómo le fue en estas semanas.',
];
const NOTA_SESION_GENERAL = [
  () => 'Sesión de seguimiento. Revisamos los compromisos de la vez pasada y oramos.',
  () => 'Conversación tranquila; se ve con más ánimo. Quedamos de vernos en quince días.',
  () => 'Revisamos lo avanzado y los pasos que siguen.',
  (p) => `Buena sesión: se nota más ${g(p, 'tranquilo', 'tranquila')} y con claridad sobre lo que sigue.`,
  () => 'Hablamos de cómo le fue con lo acordado. Hubo avances pequeños, pero reales.',
  () => 'Terminamos orando juntos por lo que viene esta semana.',
  () => 'Sesión corta porque tenía poco tiempo. Quedamos de retomar el tema la próxima vez.',
  (p) => `${p.nombre} trajo sus propias preguntas esta vez. Buena señal: se está apropiando del proceso.`,
];

/* ─────────────────────────────────────────────────────────────────────
   3 · ORACIÓN: LO QUE LA GENTE PIDE
   Cada modelo recibe x = {par, pg(m,f) del pariente, hijo, edadHijo,
   causa, parte, fecha, apellido, tiempo, quien (g del que pide), pais}.
   ───────────────────────────────────────────────────────────────────── */

const PARIENTES = [['mamá', 'F'], ['papá', 'M'], ['abuela', 'F'], ['abuelo', 'M'], ['hermano', 'M'], ['hermana', 'F'],
  ['tía', 'F'], ['tío', 'M'], ['suegra', 'F'], ['hijo', 'M'], ['hija', 'F']];
const CAUSAS = ['una neumonía', 'complicaciones de la diabetes', 'un problema del corazón', 'una infección fuerte', 'un accidente de tránsito', 'una caída en la casa'];
const PARTES = ['rodilla', 'vesícula', 'columna', 'cadera', 'hombro'];

const ORACION = {
  salud: [
    (x) => ({ resumen: `Salud de su ${x.par}, ${x.pg('hospitalizado', 'hospitalizada')} por ${x.causa}`,
      detalle: `Su ${x.par} lleva varios días en la clínica por ${x.causa}. La familia está pendiente de los médicos y pide que oremos por sanidad y por fortaleza para quienes ${x.pg('lo', 'la')} acompañan.`,
      respuestas: [`Su ${x.par} salió de la clínica y se recupera en la casa. La familia agradece a todos los que oraron.`,
        'Los médicos dicen que respondió muy bien al tratamiento. Damos gracias a Dios.'] }),
    (x) => ({ resumen: `Cirugía de ${x.parte} el ${diaLargo(x.fecha)}`, evento: x.fecha,
      detalle: `Le programaron una cirugía de ${x.parte}. Pide oración por los médicos y por una recuperación sin complicaciones.`,
      respuestas: ['La cirugía salió muy bien y ya camina con ayuda.', 'Todo salió bien en la cirugía. Gracias por orar.'] }),
    () => ({ resumen: 'Resultados de unos exámenes',
      detalle: 'Le mandaron exámenes por unos dolores que no se le quitan y está a la espera de los resultados. Pide paz mientras tanto.',
      respuestas: ['Los exámenes salieron bien: no era nada grave.', 'Encontraron la causa a tiempo y ya empezó el tratamiento.'] }),
    (x) => ({ resumen: `Tratamiento de quimioterapia de su ${x.par}`,
      detalle: `Su ${x.par} empezó quimioterapia este mes. Pide oración por fuerzas para el tratamiento y por la familia, que está muy cansada.`,
      respuestas: ['Terminó el ciclo de quimioterapia y los controles salieron bien.'] }),
    () => ({ resumen: 'Recuperación después de un accidente de moto',
      detalle: 'Tuvo un accidente de moto camino al trabajo. Se recupera de una fractura y por ahora no puede trabajar.',
      respuestas: ['Ya le quitaron el yeso y volvió a trabajar. Gracias por las oraciones y por el mercado.'] }),
    (x) => ({ resumen: `Fuerzas para cuidar a su ${x.par}`,
      detalle: `Cuida a su ${x.par}, que tiene una enfermedad avanzada. Está ${x.quien('agotado', 'agotada')} y pide oración por fuerzas y por paz en la casa.`,
      respuestas: ['Consiguieron una enfermera que ayuda en las noches y ya descansa mejor.'] }),
    () => ({ resumen: 'Salud de su bebé recién nacido',
      detalle: 'El bebé nació antes de tiempo y está en cuidados intensivos neonatales. Piden oración por su desarrollo.',
      respuestas: ['El bebé ya está en la casa y va ganando peso.'] }),
  ],
  familia: [
    () => ({ resumen: 'Restauración de su matrimonio',
      detalle: 'Atraviesan una crisis fuerte y ya hablaron de separarse. Pide oración para que puedan escucharse y buscar ayuda.',
      respuestas: ['Empezaron consejería de pareja y hay avances.', 'Decidieron luchar por su matrimonio y entraron a un grupo de parejas.'] }),
    (x) => ({ resumen: `Que su ${x.hijo} vuelva a casa`,
      detalle: `Su ${x.hijo} de ${x.edadHijo} años se fue de la casa después de una discusión. Pide oración por reconciliación.`,
      respuestas: [`Su ${x.hijo} volvió a la casa y hablaron con calma.`] }),
    () => ({ resumen: 'Paz en la familia después de una herencia',
      detalle: 'Los hermanos están peleados por la herencia de sus papás. Pide oración por unidad y por acuerdos justos.',
      respuestas: ['Llegaron a un acuerdo y volvieron a reunirse todos.'] }),
    (x) => ({ resumen: `Por su ${x.hijo}, que se alejó de Dios`,
      detalle: `Su ${x.hijo} dejó de venir a la iglesia y anda con malas amistades. Pide sabiduría para acompañar sin alejar más.`,
      respuestas: [`Su ${x.hijo} volvió al grupo de jóvenes.`] }),
    () => ({ resumen: 'Sabiduría para cuidar a su mamá',
      detalle: 'Su mamá ya no puede vivir sola y los hermanos no se ponen de acuerdo en quién la cuida. Pide sabiduría y unidad.',
      respuestas: ['Se organizaron por turnos entre los hermanos.'] }),
    () => ({ resumen: 'Unidad entre sus hijos',
      detalle: 'Sus dos hijos mayores no se hablan desde hace meses. Pide oración por perdón entre ellos.',
      respuestas: ['Los hermanos se reconciliaron y almorzaron juntos el domingo.'] }),
  ],
  duelo: [
    (x) => ({ resumen: `Consuelo por la partida de su ${x.par}`,
      detalle: `Su ${x.par} falleció hace pocos días. Pide oración por consuelo para toda la familia.`,
      respuestas: ['La familia agradece el acompañamiento en las exequias y las oraciones.'] }),
    (x) => ({ resumen: `Fortaleza para la familia ${x.apellido}`,
      detalle: `Falleció de manera inesperada el papá de la familia ${x.apellido}. Pide oración por la esposa y los hijos.`,
      respuestas: ['La familia agradece las visitas y el apoyo de la iglesia.'] }),
    () => ({ resumen: 'Por la familia de un compañero de trabajo',
      detalle: 'Un compañero de trabajo murió en un accidente. Pide oración por su esposa y sus dos hijos pequeños.',
      respuestas: [] }),
  ],
  trabajo: [
    (x) => ({ resumen: 'Un empleo estable',
      detalle: `Lleva ${x.tiempo} sin trabajo fijo y vive de trabajos por días. Pide oración por un empleo estable.`,
      respuestas: ['Consiguió trabajo con contrato fijo. Empieza el lunes.', 'Lo llamaron de una empresa donde había dejado la hoja de vida. Ya firmó.'] }),
    () => ({ resumen: 'Que le aprueben el crédito de vivienda',
      detalle: 'Está a la espera de la aprobación del crédito para su primera casa. Pide oración por el proceso.',
      respuestas: ['Le aprobaron el crédito. Gracias por orar.'] }),
    (x) => ({ resumen: `Entrevista de trabajo el ${diaLargo(x.fecha)}`, evento: x.fecha,
      detalle: 'Tiene una entrevista para un cargo que lleva meses buscando. Pide oración por paz y claridad.',
      respuestas: ['Le dieron el trabajo.', 'No quedó en ese cargo, pero lo llamaron para otro mejor.'] }),
    () => ({ resumen: 'El negocio familiar atraviesa un mal momento',
      detalle: 'Las ventas del negocio bajaron mucho este año y están atrasados con los proveedores. Pide oración por provisión y sabiduría.',
      respuestas: ['Las ventas repuntaron y se pusieron al día con los proveedores.'] }),
    () => ({ resumen: 'Renovación de su contrato',
      detalle: 'Su contrato vence a fin de mes y no le han dicho si lo renuevan. Pide oración.',
      respuestas: ['Le renovaron el contrato por un año.'] }),
  ],
  espiritual: [
    (x) => ({ resumen: `Salvación de su ${x.par}`,
      detalle: `Pide oración para que su ${x.par} conozca a Cristo. Ya ${x.pg('lo', 'la')} ha acompañado algunos domingos.`,
      respuestas: [`Su ${x.par} entregó su vida a Cristo en el servicio del domingo.`] }),
    () => ({ resumen: 'Crecer en su vida de oración',
      detalle: 'Siente que su vida de oración está fría y quiere volver a buscar a Dios cada mañana.',
      respuestas: [] }),
    () => ({ resumen: 'Dirección para una decisión importante',
      detalle: 'Tiene que decidir si acepta un trabajo en otra ciudad. Pide oración por dirección y paz.',
      respuestas: ['Tomó la decisión con paz y la familia está de acuerdo.'] }),
    (x) => ({ resumen: 'Que su familia conozca a Cristo',
      detalle: `Es ${x.quien('el primero', 'la primera')} de su familia en congregarse. Pide oración por sus papás y hermanos.`,
      respuestas: ['Su mamá vino al servicio y se quedó a la reunión de nuevos.'] }),
    (x) => ({ resumen: `Por el bautismo de su ${x.hijo}`,
      detalle: `Su ${x.hijo} decidió bautizarse el próximo mes. Pide oración para que sea un paso firme.`,
      respuestas: [`Su ${x.hijo} se bautizó y la familia entera estuvo presente.`] }),
  ],
  gratitud: [
    (x) => ({ resumen: `Gratitud por el nacimiento de ${x.pg('su nieto', 'su nieta')}`,
      detalle: `Nació ${x.pg('su nieto', 'su nieta')} sin complicaciones. Quiere dar gracias con la iglesia.`,
      respuestas: ['Dio su testimonio en el servicio del domingo.'] }),
    () => ({ resumen: 'Gracias a Dios por el nuevo empleo',
      detalle: 'Después de meses buscando, consiguió trabajo. Quiere que la iglesia se alegre con su familia.',
      respuestas: ['Compartió su testimonio en el grupo.'] }),
    (x) => ({ resumen: 'Gratitud porque salió bien la cirugía',
      detalle: `La cirugía de su ${x.par} salió bien. Agradece a todos los que oraron.`,
      respuestas: ['La familia trajo una ofrenda de gratitud el domingo.'] }),
    () => ({ resumen: 'Gracias por un año sin consumir',
      detalle: 'Cumple un año libre del alcohol. Quiere dar gracias a Dios y a su grupo.',
      respuestas: ['Celebraron el año en su grupo con la familia.'] }),
    () => ({ resumen: 'Gratitud por su casa propia',
      detalle: 'Después de años pagando arriendo, recibieron las llaves de su apartamento.',
      respuestas: ['Dedicaron la casa con su grupo el sábado.'] }),
  ],
  otro: [
    () => ({ resumen: 'Trámites de su visa',
      detalle: 'Tiene cita en el consulado para una visa de estudio. Pide oración.',
      respuestas: ['Le aprobaron la visa.'] }),
    (x) => ({ resumen: 'Por el viaje misionero de la sede',
      detalle: `Un grupo de la sede viaja en ${mesDe(sumarDias(x.fecha, 20))} a servir en una comunidad rural. Pide oración por salud y protección.`,
      respuestas: ['El equipo volvió bien y con muchos testimonios.'] }),
    () => ({ resumen: 'Que se resuelva el problema del arriendo',
      detalle: 'El dueño del apartamento les pidió entregarlo con poco tiempo de aviso. Pide oración por un lugar nuevo.',
      respuestas: ['Encontraron un apartamento cerca del colegio de los niños.'] }),
    () => ({ resumen: 'Por la seguridad en su barrio',
      detalle: 'Ha habido robos en su cuadra y la familia está asustada. Pide oración por protección.',
      respuestas: [] }),
  ],
};

/** Lo que se pide con reserva: el resumen dice poco a propósito. */
const ORACION_CONFIDENCIAL = [
  (x) => ({ resumen: 'Situación delicada en su matrimonio', detalle: 'Pide total reserva. Atraviesan una crisis que la familia todavía no conoce.' }),
  () => ({ resumen: 'Una decisión médica difícil', detalle: 'Le recomendaron una cirugía riesgosa y todavía no se lo ha contado a nadie.' }),
  (x) => ({ resumen: 'Una lucha personal que prefiere no contar', detalle: `Pide oración sin dar detalles. Aceptó que ${x.pastoral} ${x.quien('lo', 'la')} llame esta semana.` }),
  (x) => ({ resumen: 'Deudas que su familia no conoce', detalle: `Está muy ${x.quien('angustiado', 'angustiada')} por una deuda y no se atreve a contarle a su familia.` }),
  () => ({ resumen: 'Un diagnóstico que acaba de recibir', detalle: 'Le confirmaron un diagnóstico serio y todavía no se lo ha dicho a sus hijos.' }),
  () => ({ resumen: 'Un hijo con un proceso judicial', detalle: 'Su hijo mayor está vinculado a un proceso judicial. Pide reserva total.' }),
];
const ORACION_CONFIDENCIAL_AFUERA = [
  () => ({ resumen: 'Situación migratoria de su familia', detalle: 'Sus papeles están en trámite y teme por la estabilidad de su familia. Pide reserva.' }),
];
const RESPUESTA_CONFIDENCIAL = ['La situación se resolvió. Pide que siga en reserva.', 'Recibió acompañamiento pastoral y está en paz.'];

/** Lo que llega por el formulario público «¿Por qué podemos orar?», en primera persona. */
const ORACION_PUBLICA = [
  { categoria: 'salud', resumen: 'Por mi mamá, que está enferma', detalle: 'Hola. Mi mamá está hospitalizada y los médicos no nos dan buenas noticias. Les pido que oren por ella. Gracias.' },
  { categoria: 'salud', resumen: 'Por la salud de mi hijo', detalle: 'Mi hijo tiene asma y esta semana ha estado muy mal. Por favor oren por él.' },
  { categoria: 'familia', resumen: 'Por mi matrimonio', detalle: 'Estamos pasando por un momento muy difícil en la casa. Necesitamos oración.' },
  { categoria: 'trabajo', resumen: 'Necesito trabajo', detalle: 'Estoy sin empleo hace varios meses y tengo dos hijos. Les pido que oren por mí.' },
  { categoria: 'espiritual', resumen: 'Me siento lejos de Dios', detalle: 'Hace tiempo dejé de ir a la iglesia y quiero volver. Oren por mí, por favor.' },
  { categoria: 'duelo', resumen: 'Murió mi papá', detalle: 'Mi papá murió hace quince días y no encuentro consuelo. Gracias por orar por mi familia.' },
  { categoria: 'gratitud', resumen: 'Gracias por sus oraciones', detalle: 'Quiero agradecerles: mi mamá salió de la clínica. Dios es fiel.' },
  { categoria: 'otro', resumen: 'Por mis estudios', detalle: 'Presento el examen de ingreso a la universidad este mes. Les pido oración.' },
  { categoria: 'salud', resumen: 'Por la operación de mi esposo', detalle: 'Mi esposo tiene una cirugía esta semana y estamos nerviosos. Oren por los médicos, por favor.' },
  { categoria: 'salud', resumen: 'Por mi embarazo', detalle: 'Tengo un embarazo de riesgo y estoy en reposo. Les pido oración por mi bebé.' },
  { categoria: 'salud', resumen: 'Por mi abuelita', detalle: 'Mi abuelita tiene noventa años y está muy débil. Oren para que no sufra.' },
  { categoria: 'familia', resumen: 'Por mi hijo, que se fue de la casa', detalle: 'Mi hijo de diecinueve años se fue de la casa y no contesta el teléfono. Oren para que vuelva.' },
  { categoria: 'familia', resumen: 'Paz en mi casa', detalle: 'Hay muchas peleas en mi casa y los niños lo están sufriendo. Necesitamos paz.' },
  { categoria: 'trabajo', resumen: 'Trabajo para mi esposo', detalle: 'Mi esposo lleva cinco meses sin trabajo y ya no nos alcanza. Gracias por orar.' },
  { categoria: 'trabajo', resumen: 'Por mi negocio', detalle: 'Tengo una panadería y las ventas bajaron mucho. Oren por provisión, por favor.' },
  { categoria: 'espiritual', resumen: 'Quiero volver a Dios', detalle: 'Me alejé de la iglesia hace años. Quiero volver y no sé por dónde empezar.' },
  { categoria: 'duelo', resumen: 'Por la muerte de mi hermano', detalle: 'Mi hermano murió en un accidente la semana pasada. Mi mamá está destrozada.' },
  { categoria: 'gratitud', resumen: 'Gracias por orar por mi trabajo', detalle: 'Les había pedido oración y ya empecé a trabajar. Dios es bueno.' },
  { categoria: 'otro', resumen: 'Por la seguridad de mi hijo', detalle: 'Mi hijo trabaja de noche en moto y me da mucho miedo. Oren por su protección.' },
];
/** Lo que llega por el formulario de las sedes de afuera. */
const ORACION_PUBLICA_AFUERA = [
  { categoria: 'otro', resumen: 'Por mis papeles de residencia', detalle: 'Estoy esperando la respuesta de mi residencia desde hace meses. Oren por mí y por mi familia.' },
  { categoria: 'familia', resumen: 'Por mi familia, que está lejos', detalle: 'Mis hijos se quedaron en mi país con mi mamá y los extraño mucho. Oren para que pronto estemos juntos.' },
];

/** Lo que anota quien ora (nota de crm.oraciones_hechas, hasta 300 caracteres). */
const NOTAS_ORACION = [
  'Oramos en la vigilia del jueves.', 'La llamé y oramos por teléfono.', 'Oramos en el grupo de intercesión del martes.',
  'Orando cada mañana por esto.', 'La visitamos y oramos con la familia.', 'Oramos al terminar el servicio del domingo, sin decir su nombre.',
  'Le escribí con un versículo: Salmo 46:1.', 'Oramos en el ayuno congregacional.', 'Seguimos orando. Dice que se siente acompañada.',
  'Oramos en la reunión de hombres.', 'Oramos en la cadena de oración de la mañana.',
];

/* ─────────────────────────────────────────────────────────────────────
   4 · PETICIONES INTERNAS A LA DIRECCIÓN
   Cada modelo recibe (s, x) con x = {fecha, barrio, az} y devuelve el
   tipo, el asunto, el detalle, la unidad a la que se dirige, los pesos de
   prioridad y cómo se aprueba o se rechaza.
   ───────────────────────────────────────────────────────────────────── */

const PETICIONES = [
  (s, x) => ({ tipo: 'permiso', dirigida: 'DIR-PAST', prioridad: { normal: 3, alta: 1 },
    asunto: `Permiso para usar el auditorio el ${diaLargo(x.sabado)} para un retiro de parejas`,
    detalle: 'El equipo de matrimonios quiere hacer un retiro de un día con unas treinta parejas. Necesitamos el auditorio de 8:00 a 17:00 y el apoyo de sonido. Los refrigerios los cubren los participantes.',
    aprobada: ['Aprobado. Coordinen el sonido con producción y dejen el auditorio listo para el servicio del domingo.'],
    rechazada: ['Esa fecha ya está reservada para la conferencia de líderes. Propongan otro sábado del mes.'] }),
  (s) => ({ tipo: 'permiso', dirigida: 'DIR-ADMIN', prioridad: { normal: 3, baja: 1 },
    asunto: 'Permiso para un bazar en el parqueadero a favor de las misiones',
    detalle: 'Queremos recaudar fondos para el viaje misionero con venta de comida y de ropa donada. Sería un domingo después del segundo servicio.',
    aprobada: ['Aprobado con dos condiciones: nada de rifas, y el dinero se reporta a tesorería el mismo día.'],
    rechazada: ['Por ahora no: el parqueadero está comprometido con otra actividad ese mes. Lo retomamos en enero.'] }),
  (s, x) => ({ tipo: 'presupuesto', dirigida: 'EQ-FIN', prioridad: { normal: 2, alta: 2 },
    asunto: `Presupuesto para el campamento de jóvenes de ${mesDe(sumarDias(x.fecha, 60))}`,
    detalle: `Son ${x.az.entero(25, 60)} jóvenes y ${x.az.entero(5, 9)} líderes, tres días en una finca cerca de la ciudad. El costo total es de ${dinero(s, x.az.entero(12, 30) * 1000000)}; los jóvenes aportan la mitad y pedimos apoyo para el resto.`,
    aprobada: [`Aprobado por ${dinero(s, x.az.entero(5, 12) * 1000000)} del fondo de jóvenes. Envíen las facturas a finanzas antes de fin de mes.`],
    rechazada: ['El fondo de jóvenes no alcanza este trimestre. Ajusten el costo o busquen una finca más cercana, y vuelvan a enviarla.'] }),
  (s, x) => ({ tipo: 'presupuesto', dirigida: 'EQ-FIN', prioridad: { normal: 3, alta: 1 },
    asunto: 'Presupuesto para la celebración de Navidad de la sede',
    detalle: `Proponemos una noche de Navidad para las familias con obra de teatro de los niños, cena sencilla y regalos para los niños de la comunidad. Calculamos ${dinero(s, x.az.entero(4, 12) * 1000000)}.`,
    aprobada: ['Aprobado. Prioricen los regalos de los niños de la comunidad y reporten los gastos con soportes.'],
    rechazada: ['Aprobamos solo la noche de familias; la cena se hace con aportes voluntarios este año.'] }),
  (s, x) => ({ tipo: 'presupuesto', dirigida: 'EQ-FIN', prioridad: { normal: 3, baja: 1 },
    asunto: 'Refrigerios para el curso de líderes del segundo semestre',
    detalle: `Son ocho sesiones con unos ${x.az.entero(20, 45)} participantes. Pedimos ${dinero(s, x.az.entero(8, 20) * 100000)} para refrigerios sencillos.`,
    aprobada: ['Aprobado. Compren al por mayor y guarden las facturas.'],
    rechazada: ['No hay rubro para refrigerios este semestre. Pidan que cada participante traiga algo.'] }),
  (s, x) => ({ tipo: 'compra', dirigida: 'DIR-ADMIN', prioridad: { normal: 2, alta: 1 },
    asunto: `Compra de ${x.az.elegir([30, 40, 50, 60])} sillas plásticas para el salón de jóvenes`,
    detalle: `Las sillas actuales están partidas y los viernes la gente se queda de pie. Tenemos dos cotizaciones; la más baja es de ${dinero(s, x.az.entero(3, 7) * 1000000)}.`,
    aprobada: ['Aprobada la cotización más baja. Pidan garantía por escrito.'],
    rechazada: ['La sede madre tiene sillas en buen estado que ya no usa. Coordinen el préstamo con logística.'] }),
  (s, x) => ({ tipo: 'compra', dirigida: 'DIR-TEC', prioridad: { normal: 2, alta: 1 },
    asunto: 'Compra de un videoproyector para el salón infantil',
    detalle: `Los maestros de RocaKids proyectan desde un portátil prestado. Un proyector sencillo cuesta ${dinero(s, x.az.entero(18, 30) * 100000)}.`,
    aprobada: ['Aprobado. Tecnología les recomienda el modelo; que quede inventariado.'],
    rechazada: ['Por ahora no. El equipo de tecnología les presta uno mientras se define el presupuesto de 2027.'] }),
  (s, x) => ({ tipo: 'compra', dirigida: 'DIR-ADMIN', prioridad: { alta: 3, urgente: 1 },
    asunto: 'Compra de extintores y de un botiquín completo',
    detalle: `En la última visita de los bomberos nos pidieron dos extintores más y un botiquín. El total es de ${dinero(s, x.az.entero(6, 14) * 100000)}.`,
    aprobada: ['Aprobado: es obligatorio. Compren con dos cotizaciones y guarden el certificado de recarga.'],
    rechazada: ['Aprobamos los extintores; el botiquín lo dona el equipo de salud de la sede madre.'] }),
  (s, x) => ({ tipo: 'compra', dirigida: 'DIR-TEC', prioridad: { normal: 2, alta: 2 },
    asunto: 'Compra de un micrófono inalámbrico para el púlpito',
    detalle: `El micrófono actual tiene interferencia y ya se cambió dos veces de frecuencia. Uno nuevo cuesta ${dinero(s, x.az.entero(8, 25) * 100000)}.`,
    aprobada: ['Aprobado. Compren el mismo modelo que usa la sede madre para tener repuestos.'],
    rechazada: ['Producción revisará primero el receptor: puede ser la antena y no el micrófono.'] }),
  (s, x) => ({ tipo: 'autorizacion', dirigida: 'DIR-PAST', prioridad: { normal: 3 },
    asunto: `Autorización para abrir un grupo nuevo en ${x.barrio}`,
    detalle: `Hay ${x.az.entero(6, 12)} personas de la sede que viven en ${x.barrio} y no tienen grupo cerca. Una pareja de líderes está dispuesta a abrir su casa los jueves.`,
    aprobada: ['Aprobado. Que la pareja termine la escuela de líderes antes de abrir y que el grupo quede registrado en el sistema.'],
    rechazada: ['Todavía no: la pareja apenas empieza la escuela de líderes. Revisemos en tres meses.'] }),
  (s, x) => ({ tipo: 'autorizacion', dirigida: 'DIR-PAST', prioridad: { normal: 2, alta: 1 },
    asunto: `Autorización para el bautismo al aire libre del ${diaLargo(x.domingo)}`,
    detalle: `Son ${x.az.entero(8, 22)} personas que terminaron el curso de bautismo. Queremos hacerlo en un centro recreativo, con transporte para las familias.`,
    aprobada: ['Aprobado. Que haya salvavidas, un permiso del lugar y la lista firmada de los acudientes de los menores.'],
    rechazada: ['Hagámoslo en el bautisterio de la sede madre: no hay forma de garantizar la seguridad en ese lugar.'] }),
  () => ({ tipo: 'autorizacion', dirigida: 'EQ-LEGAL', prioridad: { alta: 2, normal: 1 },
    asunto: 'Autorización para firmar la renovación del arriendo de la sede',
    detalle: 'El contrato de arriendo vence el próximo mes. El propietario propone un incremento mayor al del año pasado. Adjuntamos la propuesta.',
    aprobada: ['Aprobado. El equipo legal revisó el contrato: firmen con el incremento limitado al índice de precios.'],
    rechazada: ['No firmen todavía: el equipo legal va a negociar una cláusula de salida anticipada.'] }),
  () => ({ tipo: 'autorizacion', dirigida: 'DIR-COM', prioridad: { normal: 3 },
    asunto: 'Autorización para publicar el testimonio en video de una familia',
    detalle: 'Una familia de la sede grabó su testimonio de restauración y quiere compartirlo en redes. En el video salen sus dos hijos.',
    aprobada: ['Aprobado con la autorización firmada de los papás, incluida la de los menores, y sin mostrar el colegio de los niños.'],
    rechazada: ['No sin la autorización firmada de los padres: en el video salen niños. Envíenla y lo revisamos de nuevo.'] }),
  (s) => ({ tipo: 'otro', dirigida: 'DIR-PAST', prioridad: { normal: 3 },
    asunto: 'Visita de la dirección pastoral a la sede',
    detalle: `Queremos invitar a la dirección a un domingo en ${s.nombre} para animar a los líderes y presentar a los nuevos servidores.`,
    aprobada: ['Con gusto. Coordinen la fecha con la agenda de la dirección; que sea después del retiro de pastores.'],
    rechazada: ['Este semestre la agenda está completa. Lo dejamos para el primer trimestre del próximo año.'] }),
  () => ({ tipo: 'otro', dirigida: 'DIR-COM', prioridad: { normal: 2, alta: 1 },
    asunto: 'Apoyo de comunicaciones para las piezas de la conferencia de mujeres',
    detalle: 'Necesitamos la pieza para redes, el afiche y la invitación en video. La conferencia es en seis semanas.',
    aprobada: ['Aprobado. Comunicaciones entrega las piezas en diez días; envíen los textos y las fotos esta semana.'],
    rechazada: ['Comunicaciones no tiene capacidad este mes. Usen las plantillas de la red, que ya están aprobadas.'] }),
  (s, x) => ({ tipo: 'presupuesto', dirigida: 'DIR-PROY', prioridad: { alta: 2, urgente: 1 },
    asunto: 'Apoyo para reparar el techo de la sede',
    detalle: `Con las lluvias aparecieron goteras en el salón principal y en un salón infantil. La reparación completa cuesta ${dinero(s, x.az.entero(6, 25) * 1000000)}.`,
    aprobada: ['Aprobado con recursos del fondo de mantenimiento. Proyectos acompaña la obra y recibe el trabajo.'],
    rechazada: ['Hagamos primero el arreglo urgente de las goteras; la reparación completa entra en el plan de obras de 2027.'] }),
  (s) => ({ tipo: 'otro', dirigida: 'DIR-PAST', prioridad: { normal: 2, alta: 1 },
    asunto: 'Envío de un equipo de alabanza de la sede madre para un servicio especial',
    detalle: `${s.nombre} celebra su aniversario y queremos contar con músicos de la sede madre para ese domingo.`,
    aprobada: ['Aprobado. La sede madre envía a cuatro músicos; la sede cubre el transporte y el almuerzo.'],
    rechazada: ['Ese domingo la sede madre tiene bautismos. Les enviamos pistas y un director de alabanza.'] }),
  () => ({ tipo: 'permiso', dirigida: 'DIR-PAST', prioridad: { normal: 3 },
    asunto: 'Permiso para que el equipo de alabanza participe en un evento de la ciudad',
    detalle: 'La alcaldía organiza un festival por la paz y nos invitaron a cantar dos canciones. No hay pago de por medio.',
    aprobada: ['Aprobado. Que vayan identificados como la iglesia y con un líder responsable del grupo.'],
    rechazada: ['Esta vez no: el evento tiene tintes de campaña política y no participamos en eso.'] }),
];

/* ─────────────────────────────────────────────────────────────────────
   5 · REQUERIMIENTOS DE LA MESA DE SERVICIO
   quien: 'ti' (Equipo de Sistemas), 'prod' (Producción), 'const'
   (Construcción) o 'local' (un voluntario de la sede).
   ───────────────────────────────────────────────────────────────────── */

const CIUDADES_CALIDAS = new Set(['CALI', 'BAQ', 'CTG', 'SMR', 'CUC', 'VVC', 'NVA', 'IBG', 'MIA', 'ORL', 'HOU', 'PTY']);

const REQUERIMIENTOS = {
  mantenimiento: [
    { asunto: 'Gotera en el techo del salón principal', quien: 'const', prioridad: { alta: 3, media: 2 },
      detalle: 'Con la lluvia cayó agua sobre las sillas de la tercera fila. Pusimos baldes mientras tanto.',
      solucion: 'Se cambiaron tres tejas y se selló la canal. Se revisó con lluvia y no volvió a gotear.' },
    { asunto: 'El baño de mujeres del segundo piso no descarga', quien: 'local', prioridad: { alta: 2, media: 3 },
      detalle: 'La cisterna se queda llenando y el agua no baja. Pusimos un aviso en la puerta.',
      solucion: 'Se cambió el mecanismo de la cisterna. Funciona bien.' },
    { asunto: 'La puerta de la entrada lateral no cierra', quien: 'local', prioridad: { alta: 2, media: 2 },
      detalle: 'La chapa está dura y la puerta queda entreabierta en la noche.',
      solucion: 'Se ajustaron las bisagras y se cambió la chapa.' },
    { asunto: 'Se fundieron cuatro lámparas del parqueadero', quien: 'local', prioridad: { media: 3, baja: 1 },
      detalle: 'El parqueadero queda oscuro a la salida del servicio de la noche.',
      solucion: 'Se cambiaron las cuatro lámparas por unas led.' },
    { asunto: 'Humedad en la pared del salón infantil', quien: 'const', prioridad: { alta: 2, media: 2 },
      detalle: 'Apareció una mancha de humedad y huele a encierro. Los niños usan ese salón los domingos.',
      solucion: 'Se impermeabilizó el muro por fuera y se pintó con pintura contra hongos.' },
    { asunto: 'El aire acondicionado del auditorio no enfría', quien: 'const', prioridad: { alta: 3, media: 1 }, calido: true,
      detalle: 'Con el auditorio lleno hace mucho calor. El equipo prende pero no enfría.',
      solucion: 'El técnico recargó el gas y limpió los filtros. Queda mantenimiento cada tres meses.' },
    { asunto: 'Pintar el salón de jóvenes', quien: 'local', prioridad: { baja: 3, media: 1 },
      detalle: 'Las paredes están rayadas y descascaradas. Hay voluntarios para un sábado.',
      solucion: 'Se pintó el salón un sábado con voluntarios del grupo de jóvenes.' },
    { asunto: 'Se partió un vidrio de la ventana de la oficina', quien: 'local', prioridad: { media: 2, alta: 1 },
      detalle: 'Un balón rompió el vidrio. Tapamos el hueco con cartón.',
      solucion: 'Se instaló un vidrio nuevo con película de seguridad.' },
  ],
  sonido_video: [
    { asunto: 'Se cayó la consola de sonido en el primer servicio', quien: 'prod', prioridad: { urgente: 3, alta: 2 }, domingo: true,
      detalle: 'A mitad de la prédica la consola se reinició dos veces. Terminamos con un solo micrófono.',
      solucion: 'Se cambió la fuente de poder de la consola y se dejó un regulador de voltaje.' },
    { asunto: 'Interferencia en el micrófono inalámbrico del púlpito', quien: 'prod', prioridad: { alta: 2, media: 2 }, domingo: true,
      detalle: 'Se escucha un zumbido cuando el pastor camina hacia la izquierda de la tarima.',
      solucion: 'Se cambió la frecuencia del receptor y las baterías. Se probó en el ensayo del sábado.' },
    { asunto: 'El videoproyector del auditorio se apaga solo', quien: 'prod', prioridad: { alta: 2, media: 1 },
      detalle: 'Se apaga a los veinte minutos de uso; parece recalentamiento.',
      solucion: 'Se limpió el filtro y se cambió el ventilador del proyector.' },
    { asunto: 'La transmisión en vivo se congeló el domingo', quien: 'prod', prioridad: { alta: 3, urgente: 1 }, domingo: true,
      detalle: 'Se perdió la señal en el segundo servicio y en redes hubo quejas.',
      solucion: 'Se contrató un plan de internet dedicado para la transmisión y se dejó un respaldo por celular.' },
    { asunto: 'Falta un cable XLR largo para la batería', quien: 'local', prioridad: { baja: 2, media: 2 },
      detalle: 'El cable actual no alcanza y queda tensionado en el piso de la tarima.',
      solucion: 'Se compraron dos cables de diez metros.' },
  ],
  tecnologia: [
    { asunto: 'El computador de la secretaría no enciende', quien: 'ti', prioridad: { alta: 3, media: 1 },
      detalle: 'Desde el lunes no prende. Ahí está el archivo de los nuevos.',
      solucion: 'Se cambió la fuente de poder y se hizo copia de seguridad del disco.' },
    { asunto: 'Sin internet en la oficina desde el viernes', quien: 'ti', prioridad: { alta: 2, urgente: 1 },
      detalle: 'El módem tiene la luz roja y el proveedor no contesta.',
      solucion: 'El proveedor cambió el módem. Se dejó el número del contrato a la vista.' },
    { asunto: 'La impresora no imprime a color', quien: 'ti', prioridad: { baja: 2, media: 2 },
      detalle: 'Imprime con rayas y sin color. Necesitamos los certificados de bautismo.',
      solucion: 'Se cambió el cartucho de color y se limpiaron los cabezales.' },
    { asunto: 'Configurar la cuenta de la nueva secretaria', quien: 'ti', prioridad: { media: 3 },
      detalle: 'Empieza el lunes y necesita su correo y su acceso al sistema.',
      solucion: 'Se creó la cuenta, se entregó en persona y ya entró al sistema.' },
    { asunto: 'La tableta del registro de niños no carga la aplicación', quien: 'ti', prioridad: { urgente: 2, alta: 2 }, domingo: true,
      detalle: 'El domingo tocó registrar a mano, en papel, a la entrada de RocaKids.',
      solucion: 'Se actualizó el sistema de la tableta y se borró la caché del navegador. Se probó el sábado.' },
  ],
  compras: [
    { asunto: 'Resmas de papel y tóner para la oficina', quien: 'local', prioridad: { baja: 2, media: 2 },
      detalle: 'Queda media resma y el tóner está en reserva.',
      solucion: 'Se compraron cinco resmas y un tóner. La factura se entregó a tesorería.' },
    { asunto: 'Vasos, platos y servilletas para la cena de parejas', quien: 'local', prioridad: { media: 3 },
      detalle: 'Son unas ochenta personas. La cena es en dos semanas.',
      solucion: 'Compra hecha con el presupuesto aprobado del evento.' },
    { asunto: 'Botiquín de primeros auxilios para el salón infantil', quien: 'local', prioridad: { alta: 2, media: 1 },
      detalle: 'El botiquín está incompleto y algunos productos vencieron.',
      solucion: 'Se compró el botiquín completo y se dejó a la vista con la lista de contenido.' },
    { asunto: 'Baterías para los micrófonos', quien: 'local', prioridad: { media: 2, baja: 1 },
      detalle: 'Se acaban cada domingo. Necesitamos una caja completa.',
      solucion: 'Se compraron baterías recargables y un cargador.' },
  ],
  logistica: [
    { asunto: 'Transporte para el retiro de mujeres', quien: 'local', prioridad: { media: 2, alta: 1 },
      detalle: 'Son unas cuarenta y cinco mujeres. Se necesita un bus el sábado a las 6:00.',
      solucion: 'Se contrató el bus con la empresa de siempre. Salida confirmada.' },
    { asunto: 'Préstamo de sesenta sillas para la conferencia', quien: 'local', prioridad: { media: 3 },
      detalle: 'La conferencia es el sábado y solo tenemos cien sillas.',
      solucion: 'Se trajeron las sillas de la sede madre y se devolvieron el lunes.' },
    { asunto: 'Carpa para el bautismo al aire libre', quien: 'local', prioridad: { media: 2, baja: 1 },
      detalle: 'Necesitamos sombra para las familias durante el bautismo.',
      solucion: 'Se alquiló una carpa de seis por doce metros.' },
  ],
  aseo: [
    { asunto: 'Fumigación antes del campamento', quien: 'local', prioridad: { media: 2, baja: 1 },
      detalle: 'Hay cucarachas en la cocina y el salón se usa para guardar la comida del campamento.',
      solucion: 'Se fumigó el viernes y el salón quedó cerrado veinticuatro horas.' },
    { asunto: 'Aseo profundo del auditorio después de la conferencia', quien: 'local', prioridad: { media: 3 },
      detalle: 'Quedaron manchas en las alfombras y basura en los pasillos.',
      solucion: 'Se hizo el aseo con voluntarios y una empresa externa lavó las alfombras.' },
    { asunto: 'Faltan insumos de aseo para los baños', quien: 'local', prioridad: { media: 2, alta: 1 },
      detalle: 'No hay jabón ni papel desde el miércoles.',
      solucion: 'Se compraron jabón, papel y desinfectante para el mes.' },
  ],
  seguridad: [
    { asunto: 'La cámara del parqueadero no graba', quien: 'ti', prioridad: { alta: 2, media: 1 },
      detalle: 'El grabador muestra la imagen pero no guarda nada desde hace una semana.',
      solucion: 'Se cambió el disco del grabador y se configuró la grabación continua.' },
    { asunto: 'Cambiar la chapa de la oficina de tesorería', quien: 'local', prioridad: { alta: 3 },
      detalle: 'Se perdió una copia de la llave.',
      solucion: 'Se cambió la chapa y se entregaron dos llaves, con registro de quién las tiene.' },
    { asunto: 'La alarma se dispara sola en la madrugada', quien: 'local', prioridad: { alta: 2, media: 1 },
      detalle: 'Los vecinos se quejaron: ya pasó tres veces esta semana.',
      solucion: 'Se cambió el sensor de la puerta trasera, que estaba dañado.' },
    { asunto: 'Revisar los extintores vencidos', quien: 'const', prioridad: { media: 2, alta: 1 },
      detalle: 'Tres extintores tienen la fecha de recarga vencida desde junio.',
      solucion: 'Se recargaron los extintores y se pegó la nueva fecha.' },
  ],
};
const PESO_CATEGORIA_REQ = { mantenimiento: 28, sonido_video: 18, tecnologia: 16, compras: 10, logistica: 9, aseo: 9, seguridad: 10 };

/* ─────────────────────────────────────────────────────────────────────
   6 · TAREAS
   Modelos por quien la tiene. x = {fecha, apellido, mes, az}.
   ───────────────────────────────────────────────────────────────────── */

const TAREAS = {
  secretaria: [
    () => ({ titulo: 'Pasar al sistema las fichas de los nuevos del domingo', detalle: 'Quedaron fichas en papel en la bandeja de la entrada.' }),
    () => ({ titulo: 'Enviar el boletín semanal a los líderes', detalle: 'Anuncios de la semana, cumpleaños y horarios de los grupos.' }),
    () => ({ titulo: 'Confirmar la reserva del salón para el retiro de parejas', detalle: 'Llamar al centro de retiros y pedir la confirmación por escrito.' }),
    () => ({ titulo: 'Organizar el archivo de actas de 2025', detalle: 'Escanear las actas firmadas y guardarlas en la carpeta de la sede.' }),
    (x) => ({ titulo: `Preparar los certificados de bautismo del ${diaLargo(x.domingo)}`, fecha: x.domingo, detalle: 'Revisar los nombres completos con los documentos antes de imprimir.' }),
    () => ({ titulo: 'Enviar las invitaciones de la cena de parejas', detalle: 'Por correo y por el grupo de líderes; pedir confirmación.' }),
    () => ({ titulo: 'Recoger las firmas del acta de la reunión de líderes', detalle: 'Faltan tres firmas.' }),
    () => ({ titulo: 'Actualizar la cartelera de anuncios', detalle: 'Quitar lo vencido y poner los eventos del mes.' }),
    () => ({ titulo: 'Renovar la póliza del inmueble', detalle: 'Pedir dos cotizaciones y pasarlas a la pareja pastoral.' }),
  ],
  pastor: [
    (x) => ({ titulo: `Preparar la prédica del ${diaLargo(x.domingo)}`, fecha: x.domingo, detalle: 'Serie del mes: «Una fe que se ve».' }),
    (x) => ({ titulo: `Visitar a la familia ${x.apellido}`, detalle: 'Visita pastoral acordada con la familia.' }),
    () => ({ titulo: 'Reunión con los líderes de grupos', detalle: 'Revisar los grupos que no se reúnen y los nuevos sin grupo.' }),
    () => ({ titulo: 'Revisar el plan del campamento de jóvenes', detalle: 'Presupuesto, permisos de los acudientes y lista de servidores.' }),
    () => ({ titulo: 'Entrevistas con los candidatos al bautismo', detalle: 'Uno por uno, antes del curso final.' }),
    () => ({ titulo: 'Llamar a la pareja supervisora de la región', detalle: 'Contarles cómo va la sede y lo que necesitamos.' }),
    (x) => ({ titulo: `Planear el retiro de líderes de ${x.mes}`, detalle: 'Lugar, tema, invitados y costo por persona.' }),
    () => ({ titulo: 'Escribir la carta de bienvenida a los nuevos miembros', detalle: 'Para entregar el primer domingo del mes.' }),
    () => ({ titulo: 'Revisar las peticiones de oración de la semana', detalle: 'Llamar a quienes pidieron oración por salud.' }),
  ],
  coordinador: [
    () => ({ titulo: 'Llamar a los visitantes del domingo pasado', detalle: 'Agradecer la visita e invitarlos al café de bienvenida.' }),
    (x) => ({ titulo: `Asignar grupo a los nuevos de ${x.mes}`, detalle: 'Según el barrio y el día que les sirve.' }),
    () => ({ titulo: 'Preparar el café de bienvenida del primer domingo', detalle: 'Invitar a los nuevos del mes y a dos líderes.' }),
  ],
  tesoreria: [
    (x) => ({ titulo: `Conciliar los aportes de ${x.mesAnterior}`, detalle: 'Cruzar lo digitado con los extractos del banco.' }),
    () => ({ titulo: 'Enviar el informe financiero del mes a la central', detalle: 'Con los soportes de gastos.' }),
    () => ({ titulo: 'Pagar los servicios públicos de la sede', detalle: 'Agua, luz e internet; guardar los comprobantes.' }),
  ],
  libre: [
    () => ({ titulo: 'Conseguir voluntarios para el aseo del sábado', detalle: 'Se necesitan ocho personas de 8:00 a 11:00.' }),
    () => ({ titulo: 'Revisar el inventario de sillas y mesas', detalle: 'Contar lo que hay y lo que está dañado.' }),
  ],
  direccion: [
    { titulo: 'Revisar las peticiones de presupuesto de diciembre', detalle: 'Priorizar la Navidad de las sedes pequeñas.', para: 'dg', prioridad: 'alta' },
    { titulo: 'Preparar el encuentro nacional de pastores', detalle: 'Temas, lugar y agenda de los tres días.', para: 'esposa', prioridad: 'alta' },
    { titulo: 'Firmar las actas de los equipos de intercesión', detalle: 'Las actas de julio y agosto quedaron pendientes de firma.', para: 'dg', prioridad: 'normal' },
    { titulo: 'Reunión con las parejas supervisoras de región', detalle: 'Revisar las sedes con requerimientos vencidos y las plantaciones.', para: 'dg', prioridad: 'normal' },
    { titulo: 'Revisar el informe de requerimientos vencidos de la red', detalle: 'Cuáles son de mantenimiento mayor y cuáles de la mesa de servicio.', para: 'DIR-ADMIN', prioridad: 'alta' },
    { titulo: 'Plan de comunicaciones del aniversario de la iglesia', detalle: 'Piezas, video y convocatoria para las 36 sedes.', para: 'DIR-COM', prioridad: 'normal' },
    { titulo: 'Agenda de visitas pastorales a las plantaciones', detalle: 'Una visita por plantación antes de diciembre.', para: 'esposa', prioridad: 'normal' },
  ],
};

/* ─────────────────────────────────────────────────────────────────────
   7 · LO QUE SE LEE DE LA BASE
   Todo sale de lo que dejó el núcleo: sedes, personas, roles (con su
   historia), equipos y menores con su acudiente principal.
   ───────────────────────────────────────────────────────────────────── */

/** Todas las asignaciones de un rol, vigentes y pasadas, con la sede donde sirve la persona. */
async function asignacionesDe(c, rol) {
  const { rows } = await c.query(
    `SELECT a.persona_id, a.rol, a.alcance_tipo::text AS alcance_tipo,
            COALESCE(CASE WHEN a.alcance_tipo = 'sede' THEN a.alcance_id END, p.sede_id) AS sede_id,
            to_char(a.vigente_desde, 'YYYY-MM-DD') AS desde,
            to_char(LEAST(a.vigente_hasta, a.revocada_en::date), 'YYYY-MM-DD') AS hasta,
            to_char(a.revocada_en, 'YYYY-MM-DD"T"HH24:MI:SS.USOF') AS revocada_en,
            p.primer_nombre, p.primer_apellido, p.genero::text AS genero,
            trim(concat_ws(' ', p.primer_nombre, p.primer_apellido)) AS nombre
       FROM identidad.asignaciones a JOIN nucleo.personas p ON p.id = a.persona_id
      WHERE a.rol = $1 AND a.alcance_tipo IN ('sede', 'caso_propio')
      ORDER BY a.vigente_desde, p.primer_apellido, a.persona_id`, [rol]);
  return rows;
}

/** ¿La asignación estaba vigente esa fecha? */
const vigenteEn = (a, fecha) => a.desde <= fecha && (!a.hasta || a.hasta > fecha);

async function cargarRed(c) {
  const sedes = await d.sedes(c);
  const sedePorId = new Map(sedes.map((s) => [s.id, s]));

  const { rows: topicos } = await c.query(
    `SELECT codigo, nombre, requiere_profesional FROM consejeria.topicos ORDER BY codigo`);

  /* Las personas vivas y activas, con la fecha desde la que congregan en su sede. */
  const { rows: gente } = await c.query(
    `SELECT p.id, p.primer_nombre, p.primer_apellido, p.genero::text AS genero,
            date_part('year', age(DATE '${HOY}', p.fecha_nacimiento))::int AS edad,
            p.sede_id, p.estado_civil, p.nivel_compromiso, COALESCE(p.ha_sido_bautizado, false) AS bautizado,
            p.email_principal::text AS email, p.telefono_movil AS telefono, p.zona,
            to_char(COALESCE((SELECT m.desde FROM nucleo.membresias_sede m
                               WHERE m.persona_id = p.id AND m.es_principal AND m.hasta IS NULL
                               ORDER BY m.desde DESC LIMIT 1), p.creado_en::date), 'YYYY-MM-DD') AS desde
       FROM nucleo.personas p
      WHERE p.eliminado_en IS NULL AND p.estado::text = 'activa' AND p.fecha_nacimiento IS NOT NULL
        AND p.fusionada_en_id IS NULL
      ORDER BY p.source_id NULLS FIRST, p.id`);
  const gentePorSede = new Map(sedes.map((s) => [s.id, []]));
  for (const p of gente) {
    p.nombre = p.primer_nombre;
    gentePorSede.get(p.sede_id)?.push(p);
  }

  /* Quién tiene hoy algún rol (directo o de equipo) y quién ya tiene cuenta. */
  const { rows: r1 } = await c.query(
    `SELECT persona_id, array_agg(DISTINCT rol) AS roles FROM identidad.v_permiso_efectivo WHERE vigente GROUP BY 1`);
  const conRol = new Set(r1.map((r) => r.persona_id));
  const rolesDe = new Map(r1.map((r) => [r.persona_id, r.roles]));
  const { rows: r2 } = await c.query(`SELECT persona_id FROM identidad.cuentas`);
  const conCuenta = new Set(r2.map((r) => r.persona_id));
  /* Quién ya sirve en un equipo o una dirección de la central (aunque el equipo no le dé rol). */
  const { rows: r3 } = await c.query(`SELECT DISTINCT persona_id FROM org.unidad_miembros WHERE hasta IS NULL AND revocado_en IS NULL`);
  const enEquipo = new Set(r3.map((r) => r.persona_id));

  /* Menores con su acudiente principal: para los casos de crianza y las peticiones por los hijos. */
  const { rows: menores } = await c.query(
    `SELECT a.acudiente_id, m.primer_nombre, m.genero::text AS genero,
            date_part('year', age(DATE '${HOY}', m.fecha_nacimiento))::int AS edad
       FROM nucleo.acudientes a JOIN nucleo.personas m ON m.id = a.menor_id
      WHERE a.vigente_hasta IS NULL AND a.es_principal AND m.eliminado_en IS NULL AND m.estado::text = 'activa'
        AND age(DATE '${HOY}', m.fecha_nacimiento) < interval '18 years'
      ORDER BY a.acudiente_id, m.fecha_nacimiento`);
  const hijosDe = new Map();
  for (const m of menores) {
    if (!hijosDe.has(m.acudiente_id)) hijosDe.set(m.acudiente_id, []);
    hijosDe.get(m.acudiente_id).push(m);
  }

  /* Roles de sede, con su historia (el consejero que ya no sirve también atendió casos). */
  const porSede = (lista) => {
    const m = new Map(sedes.map((s) => [s.id, []]));
    for (const a of lista) m.get(a.sede_id)?.push(a);
    return m;
  };
  const pastores = porSede((await asignacionesDe(c, 'PASTOR_CONGREGACIONAL')).filter((a) => a.alcance_tipo === 'sede'));
  const consejeros = porSede(await asignacionesDe(c, 'CONSEJERO'));
  const secretarias = porSede(await asignacionesDe(c, 'SECRETARIA'));
  const coordinadores = porSede(await asignacionesDe(c, 'COORDINADOR_NUEVOS'));
  const tesoreria = porSede(await asignacionesDe(c, 'TESORERIA'));

  const direccion = (await d.direccionGeneral(c)).sort((a, b) => (a.genero === 'M' ? 0 : 1) - (b.genero === 'M' ? 0 : 1));
  const equipos = {};
  for (const u of ['EQ-COM', 'EQ-TI', 'EQ-PROD', 'EQ-CONST', 'DIR-ADMIN', 'DIR-COM']) equipos[u] = await d.equipo(c, u);
  const { rows: unidades } = await c.query(`SELECT id, codigo FROM org.unidades`);
  const unidad = Object.fromEntries(unidades.map((u) => [u.codigo, u.id]));

  return { sedes, sedePorId, topicos, gentePorSede, conRol, rolesDe, conCuenta, enEquipo, hijosDe, pastores, consejeros, secretarias,
    coordinadores, tesoreria, direccion, equipos, unidad, intercesion: {} };
}

/** La pareja pastoral vigente de una sede en una fecha: [pastor, pastora] (el que falte, null). */
function parejaEn(red, s, fecha) {
  const v = red.pastores.get(s.id).filter((a) => vigenteEn(a, fecha));
  const el = v.find((a) => a.genero === 'M') ?? null;
  const ella = v.find((a) => a.genero === 'F') ?? null;
  return [el ?? ella, ella ?? el];
}

/** Quienes tienen un rol vigente en una sede en una fecha. */
const vigentesEn = (mapa, s, fecha) => mapa.get(s.id).filter((a) => vigenteEn(a, fecha));

/* ─────────────────────────────────────────────────────────────────────
   8 · AUTOR Y ESCRITURA POR LOTES
   ───────────────────────────────────────────────────────────────────── */

/**
 * Fija el autor como la API (SET LOCAL): su persona, las sedes y el nivel
 * que la base le calcula. Sin persona, es el formulario público de la sede.
 */
function crearComo(c) {
  const cache = new Map();
  return async function como(personaId, motivo, sedePublica) {
    if (!personaId) {
      await fijarAutor(c, { persona_id: null, sede_ids: sedePublica ? [sedePublica] : [], nivel_max: sedePublica ? 1 : 0,
        alcance_global: false, motivo: motivo ?? null });
      return;
    }
    let x = cache.get(personaId);
    if (!x) {
      const { rows: [r] } = await c.query(`SELECT sedes, nivel_max, es_global FROM identidad.contexto_de($1)`, [personaId]);
      x = { sedes: r?.sedes ?? [], nivel_max: Number(r?.nivel_max ?? 0), es_global: Boolean(r?.es_global) };
      cache.set(personaId, x);
    }
    await fijarAutor(c, { persona_id: personaId, sede_ids: x.sedes, nivel_max: x.nivel_max,
      alcance_global: x.es_global, motivo: motivo ?? null });
  };
}

/** Inserta las filas agrupadas por autor: la auditoría y la línea de tiempo dicen quién lo registró. */
async function insertarPorAutor(c, como, tabla, filas, autorDe, motivo, op = {}) {
  const grupos = new Map();
  for (const f of filas) {
    const k = `${autorDe(f) ?? ''}|${op.sedePublica ? op.sedePublica(f) ?? '' : ''}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(f);
  }
  for (const [k, grupo] of grupos) {
    const [autor, sede] = k.split('|');
    await como(autor || null, motivo, sede || null);
    await insertarLote(c, tabla, grupo, { columnas: op.columnas });
  }
}

/**
 * Actualiza por lotes con jsonb_to_recordset. `tipos` da el tipo de cada
 * columna. Si cambian menos filas de las esperadas, falla: nada se da por
 * hecho sin que la base lo confirme.
 */
async function actualizarLote(c, tabla, filas, tipos) {
  if (!filas.length) return;
  const llaves = Object.keys(filas[0]).filter((k) => k !== 'id');
  const def = ['id uuid', ...llaves.map((k) => `${k} ${tipos[k]}`)].join(', ');
  const set = llaves.map((k) => `${k} = v.${k}`).join(', ');
  for (let i = 0; i < filas.length; i += 400) {
    const trozo = filas.slice(i, i + 400);
    const r = await c.query(
      `UPDATE ${tabla} t SET ${set} FROM jsonb_to_recordset($1::jsonb) AS v(${def}) WHERE t.id = v.id`,
      [JSON.stringify(trozo)]);
    if (r.rowCount !== trozo.length) {
      throw new Error(`${tabla}: se esperaban ${trozo.length} filas actualizadas y cambiaron ${r.rowCount}.`);
    }
  }
}

/**
 * Hace avanzar cada entidad por sus pasos, en rondas: la ronda k aplica el
 * k-ésimo paso de todas. Cada paso es {autor, motivo, set: {estado, ...}} y
 * pasa por los disparadores de la base (transiciones, sellos, auditoría).
 */
async function aplicarPasos(c, como, tabla, tipos, entidades) {
  const rondas = Math.max(0, ...entidades.map((e) => e.pasos.length));
  for (let r = 0; r < rondas; r++) {
    const grupos = new Map();
    for (const e of entidades) {
      const p = e.pasos[r];
      if (!p) continue;
      const llaves = Object.keys(p.set).sort();
      const k = `${p.autor ?? ''}|${p.motivo ?? ''}|${llaves.join(',')}`;
      if (!grupos.has(k)) grupos.set(k, { autor: p.autor, motivo: p.motivo, filas: [] });
      const fila = { id: e.id };
      for (const l of llaves) fila[l] = p.set[l];
      grupos.get(k).filas.push(fila);
    }
    for (const gr of grupos.values()) {
      await como(gr.autor ?? null, gr.motivo);
      await actualizarLote(c, tabla, gr.filas, tipos);
    }
  }
}

/** Horas creíbles para cada cosa. */
function horaOficina(az, fecha) {
  const dia = d.diaSemana(fecha);
  if (dia === 0) return az.horaEntre('12:30', '15:30', 5);
  if (dia === 6) return az.horaEntre('08:30', '12:30', 5);
  return az.horaEntre('08:00', '18:00', 5);
}
function horaSesion(az, fecha) {
  const dia = d.diaSemana(fecha);
  if (dia === 0) return az.horaEntre('13:00', '16:30', 15);
  if (dia === 6) return az.horaEntre('09:00', '12:30', 15);
  return az.horaEntre('09:00', '19:30', 15);
}

/** Roles del personal de una sede: quien los tiene no se suma al equipo de intercesión. */
const ROLES_DE_PERSONAL = new Set(['PASTOR_DIRECTOR_GENERAL', 'PASTOR_CONGREGACIONAL', 'SECRETARIA', 'TESORERIA', 'DIGITADOR_APORTES',
  'CONSEJERO', 'COORDINADOR_NUEVOS', 'LIDER_DE_ORACION', 'PERSONA_QUE_ORA', 'GERENCIA_ADMINISTRATIVA', 'CONTABILIDAD', 'AUDITOR',
  'TALENTO_HUMANO', 'INTEGRACION_TECNICA', 'DIRECTOR_ROCAKIDS']);

/* ─────────────────────────────────────────────────────────────────────
   9 · EL EQUIPO DE INTERCESIÓN
   Sin él, «compartir con el equipo de intercesión» no significa nada: nadie
   más que los pastores vería una petición. Cada sede con Oración encendida
   recibe su líder de oración y, en las medianas y grandes, personas que
   oran. Los nombra la dirección (la única con `identidad administrar`),
   con acta, en julio y agosto de 2026: dentro de los 90 días de la
   recertificación de un rol N3, así que no aparecen vencidos.
   Mismas reglas que el núcleo: líderes bautizados, con cuenta de acceso.
   ───────────────────────────────────────────────────────────────────── */

async function equipoDeIntercesion(c, az, red, como) {
  const [dg] = red.direccion;
  if (!dg) throw new Error('No hay dirección general vigente: nadie puede nombrar el equipo de intercesión.');
  /* La misma derivación de clave que la API (y que el núcleo): la clave de laboratorio. */
  const { derivarClave } = require(path.join(__dirname, '..', '..', 'api', 'dist', 'src', 'auth', 'clave.js'));
  const hashClave = derivarClave(CLAVE_LABORATORIO);

  await como(dg.persona_id, 'Nombramiento del equipo de intercesión de la sede');
  const nuevos = [];
  for (const s of red.sedes.filter((x) => x.modulos.includes('oracion'))) {
    const azS = az.derivar(s.codigo);
    const aptos = red.gentePorSede.get(s.id).filter((p) => !red.enEquipo.has(p.id) && p.nivel_compromiso === 'lider' && p.bautizado
      && p.edad >= 24 && p.edad <= 72 && p.email && p.desde <= '2026-06-01');
    /* Primero quien no tiene ningún rol; si no alcanza, quien ya sirve en un ministerio (un líder de grupo
       también intercede). Nunca el personal de la sede ni quien ya está en el equipo de intercesión. */
    const libres = aptos.filter((p) => !red.conRol.has(p.id) && !red.conCuenta.has(p.id));
    const ministerio = aptos.filter((p) => red.conRol.has(p.id)
      && (red.rolesDe.get(p.id) ?? []).every((r) => !ROLES_DE_PERSONAL.has(r)));
    /* Los equipos de intercesión suelen ser más de mujeres: se las prefiere dos a uno. */
    const mezclar = (lista) => {
      const ordenados = [...lista.filter((p) => p.genero === 'F'), ...lista.filter((p) => p.genero !== 'F')];
      const salida = [];
      while (ordenados.length) salida.push(ordenados.splice(azS.probabilidad(0.67) ? 0 : ordenados.length - 1, 1)[0]);
      return salida;
    };
    const mezcla = [...mezclar(azS.barajar(libres)), ...mezclar(azS.barajar(ministerio))];
    const cupos = [['LIDER_DE_ORACION', 1], ['PERSONA_QUE_ORA', s.tamano === 'grande' ? 2 : s.tamano === 'mediana' ? 1 : 0]];
    const equipo = { lider: null, orantes: [] };
    let numeroActa = azS.entero(11, 18);
    for (const [rol, cupo] of cupos) {
      for (let i = 0; i < cupo && mezcla.length; i++) {
        const p = mezcla.shift();
        const desde = azS.fechaEntre('2026-06-29', '2026-09-07');
        const acta = `ACTA-${s.codigo}-2026-${String(numeroActa++).padStart(2, '0')} · ${rol === 'LIDER_DE_ORACION' ? 'liderazgo de intercesión' : 'equipo de intercesión'}`;
        await c.query(`SELECT identidad.otorgar_asignacion($1, $2, 'sede', $3, 3::smallint, $4, $5::date)`,
          [p.id, rol, s.id, acta, desde]);
        red.conRol.add(p.id);
        const miembro = { ...p, persona_id: p.id, rol, desde };
        if (rol === 'LIDER_DE_ORACION') equipo.lider = miembro; else equipo.orantes.push(miembro);
        nuevos.push({ ...miembro, s });
      }
    }
    red.intercesion[s.codigo] = equipo;
  }

  /* Cuentas: usuario = su correo, clave de laboratorio. Casi todos ya entraron a registrar oraciones. */
  // otorgar_asignacion dejó puesto el motivo de la última acta: la cuenta dice el suyo.
  await c.query(`SELECT set_config('app.motivo', $1, true)`, ['Cuenta de acceso para el equipo de intercesión']);
  const quien = [], cuando = [], provisionales = [];
  for (const p of nuevos) {
    if (red.conCuenta.has(p.id)) continue;   // ya entra al sistema por otro ministerio: el rol nuevo se suma a su cuenta
    await c.query(`SELECT identidad.crear_cuenta($1, $2, $3, $4)`, [p.id, p.email, hashClave, dg.persona_id]);
    red.conCuenta.add(p.id);
    const azP = az.derivar(`cuenta:${p.id}`);
    if (azP.probabilidad(0.86)) {
      const f = azP.fechaEntre(maxFecha(p.desde, '2026-09-01'), AYER);
      quien.push(p.id);
      cuando.push(en(p.s, f, azP.horaEntre('05:30', '21:30', 5)));
    } else if (diasEntre(p.desde, HOY) < 25) {
      provisionales.push(p.id);
    }
  }
  if (quien.length) {
    await c.query(`UPDATE identidad.cuentas c SET ultimo_ingreso = v.cuando
                     FROM unnest($1::uuid[], $2::timestamptz[]) AS v(persona_id, cuando) WHERE c.persona_id = v.persona_id`,
    [quien, cuando]);
  }
  if (provisionales.length) {
    await c.query(`UPDATE identidad.cuentas SET debe_cambiar_clave = true WHERE persona_id = ANY($1::uuid[])`, [provisionales]);
  }
  return nuevos.length;
}

/* ─────────────────────────────────────────────────────────────────────
   10 · CONSEJERÍA
   ───────────────────────────────────────────────────────────────────── */

/** Primera letra en mayúscula. */
const may = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Un instante listo para la base: el explícito (ts) o el de la sede. */
const ts = (s, m) => m.ts ?? en(s, m.fecha, m.hora);

const FILTRO_CONSULTANTE = {
  FAM: (p) => ['casado', 'union_libre'].includes(p.estado_civil) && p.edad >= 22 && p.edad <= 66,
  DUELO: (p) => p.edad >= 25,
  CRIANZA: (p, red) => p.edad >= 25 && p.edad <= 60 && (red.hijosDe.get(p.id) ?? []).some((h) => h.edad >= 7),
  MENOR: (p, red) => p.edad >= 25 && (red.hijosDe.get(p.id) ?? []).some((h) => h.edad >= 5),
  VIF: (p) => p.edad >= 21 && p.edad <= 60 && ['casado', 'union_libre', 'separado', 'divorciado'].includes(p.estado_civil),
  ABUSO: (p) => p.edad >= 19 && p.edad <= 55,
  ADICCION: (p) => p.edad >= 19 && p.edad <= 60,
  ANSIEDAD: (p) => p.edad >= 19 && p.edad <= 66,
  SUICIDIO: (p) => p.edad >= 20 && p.edad <= 45,
  VOCACION: (p) => p.edad >= 19 && p.edad <= 35,
  FINANZAS: (p) => p.edad >= 22 && p.edad <= 64,
  LABORAL: (p) => p.edad >= 21 && p.edad <= 62,
  FE: (p) => p.edad >= 19,
  OTRO: (p) => p.edad >= 25,
};
/** Probabilidad de que quien consulta sea mujer, en los tópicos donde pesa. */
const MUJER_EN_TOPICO = { VIF: 0.82, ABUSO: 0.75, ADICCION: 0.3, CRIANZA: 0.7, MENOR: 0.75 };

function elegirConsultante(az, red, pool, topico, fecha, usados) {
  const filtro = FILTRO_CONSULTANTE[topico] ?? FILTRO_CONSULTANTE.OTRO;
  let cand = pool.filter((p) => !usados.has(p.id) && p.desde <= fecha && filtro(p, red));
  if (MUJER_EN_TOPICO[topico] !== undefined && cand.length) {
    const genero = az.probabilidad(MUJER_EN_TOPICO[topico]) ? 'F' : 'M';
    const delGenero = cand.filter((p) => p.genero === genero);
    if (delGenero.length) cand = delGenero;
  }
  if (!cand.length) return null;
  return az.ponderado(cand.map((p) => [p, p.nivel_compromiso === 'visitante' ? 0.5 : p.nivel_compromiso === 'lider' ? 0.8 : 1]));
}

/** La pareja pastoral de la sede en esa fecha; si no hay registro, la de hoy. */
function parejaDe(red, s, fecha) {
  const [a, b] = parejaEn(red, s, fecha);
  return a ? [a, b] : parejaEn(red, s, HOY);
}

/**
 * Quién lleva el caso: un consejero de la sede del mismo sexo que quien
 * consulta, vigente en esa fecha; si no lo hay, el pastor o la pastora.
 */
function consejeroPara(az, red, s, fecha, persona, excluir = null) {
  const mismos = vigentesEn(red.consejeros, s, fecha)
    .filter((a) => a.genero === persona.genero && a.persona_id !== excluir && a.persona_id !== persona.id);
  if (mismos.length) return { ...az.elegir(mismos), esPastor: false };
  const [el, ella] = parejaDe(red, s, fecha);
  const pastor = persona.genero === 'F' ? ella : el;
  return { ...pastor, esPastor: true };
}

function contextoCaso(az, red, s, topico, persona, fecha, pastorDelCaso) {
  const x = { detonante: az.elegir(DETONANTES), tiempo: az.elegir(TIEMPOS), pais: s.pais };
  const oficio = az.elegir(OFICIOS);
  x.oficio = g(persona, oficio[0], oficio[1]);
  x.pareja = persona.estado_civil === 'casado' ? g(persona, 'su esposa', 'su esposo') : 'su pareja';
  if (persona.estado_civil === 'viudo' && az.probabilidad(0.7)) x.familiar = g(persona, 'esposa', 'esposo');
  else if (persona.edad >= 55) x.familiar = az.elegir(['hermano', 'hermana', 'mamá']);
  else x.familiar = az.elegir(['mamá', 'papá', 'abuela', 'abuelo', 'hermano']);
  const hijos = (red.hijosDe.get(persona.id) ?? []).filter((h) => h.edad >= 5);
  const h = hijos.length ? az.elegir(hijos) : null;
  x.hijo = h ? (h.genero === 'F' ? 'hija' : 'hijo') : az.elegir(['hijo', 'hija']);
  x.edadHijo = h ? Math.max(4, h.edad - Math.floor(diasEntre(fecha, HOY) / 365)) : az.entero(13, 17);
  x.quienReserva = pastorDelCaso
    ? `${pastorDelCaso.genero === 'F' ? 'la pastora' : 'el pastor'} ${pastorDelCaso.primer_nombre}` : 'la pareja pastoral';
  return x;
}

function estadoCaso(az, topico, edad, prof) {
  if (topico === 'SUICIDIO') return 'derivado';
  const der = prof ? (topico === 'ANSIEDAD' ? 2.4 : topico === 'ADICCION' ? 3 : 5) : 0.2;
  if (edad <= 10) return ponderado(az, { abierto: 3, en_proceso: 7, derivado: prof ? 1.5 : 0 });
  if (edad <= 60) return ponderado(az, { abierto: 0.15, en_proceso: 7, en_pausa: 0.8, cerrado: 1.6, derivado: der * 0.8 });
  if (edad <= 150) return ponderado(az, { en_proceso: 3.2, en_pausa: 1.1, cerrado: 5, derivado: der });
  return ponderado(az, { en_proceso: 0.9, cerrado: 8, derivado: der });
}

const MODALIDAD = { presencial: 70, virtual: 20, telefonica: 10 };
const DURACION = { presencial: [45, 90], virtual: [40, 60], telefonica: [15, 35] };
const TOPICOS_INTENSOS = new Set(['ANSIEDAD', 'ADICCION', 'VIF', 'SUICIDIO', 'ABUSO']);

/** Arma la historia completa de un caso: apertura, asignación, sesiones, notas, relevos y final. */
function armarCaso(az, red, s, numero, topico, persona, fecha, prof, previo) {
  const id = az.uuid();
  const pais = MONEDA[s.pais] ? s.pais : 'CO';
  const [el, ella] = parejaDe(red, s, fecha);
  const pastorDelCaso = persona.genero === 'F' ? ella : el;
  const abre = az.probabilidad(0.7) ? pastorDelCaso : (persona.genero === 'F' ? el : ella);
  const abierto = { fecha, hora: horaOficina(az, fecha) };
  const x = contextoCaso(az, red, s, topico, persona, fecha, pastorDelCaso);
  const t = CASOS[topico] ?? CASOS.OTRO;
  const edadCaso = diasEntre(fecha, AYER);
  let estado = estadoCaso(az, topico, edadCaso, prof);

  const caso = { id, s, persona, topico, abre, abierto, estado, asignaciones: [], sesiones: [], notas: [], pasos: [],
    source_id: `caso-${s.codigo}-${String(numero).padStart(3, '0')}` };
  const nota = (autor, texto, m, sesionId = null) => caso.notas.push({ id: az.uuid(), caso_id: id, sesion_id: sesionId,
    autor_id: autor.persona_id, contenido: texto, escrita_en: ts(s, m) });

  const motivo = (previo ? `Vuelve después de un proceso anterior que se cerró en ${mesDe(previo.cierre.fecha)}. ` : '')
    + az.elegir(t.motivo)(persona, x);
  nota(abre, motivo, hastaTope(mover(abierto, az.entero(20, 90))));

  /* Asignación: el caso pasa a «en proceso». */
  let asig;
  if (topico === 'SUICIDIO') asig = mover(abierto, az.entero(10, 40));
  else {
    const f = sumarDias(abierto.fecha, az.entero(0, 3));
    asig = { fecha: f, hora: horaOficina(az, f) };
    if (!antes(abierto, asig)) asig = mover(abierto, az.entero(45, 180));
  }
  if (estado === 'abierto' || antes(TOPE, asig)) { caso.estado = 'abierto'; return caso; }
  let actual = consejeroPara(az, red, s, asig.fecha, persona);
  const nuevaAsignacion = (quien, rol, desde, porQuien) => {
    const a = { id: az.uuid(), caso_id: id, consejero_id: quien.persona_id, rol, desde, hasta: null, asignado_por: porQuien.persona_id,
      quien };
    caso.asignaciones.push(a);
    return a;
  };
  let asignacion = nuevaAsignacion(actual, 'consejero', asig, abre);
  caso.pasos.push({ autor: abre.persona_id, motivo: 'Consejería: consejero asignado', set: { estado: 'en_proceso' } });
  if (prof && !actual.esPastor && pastorDelCaso && pastorDelCaso.persona_id !== actual.persona_id) {
    nuevaAsignacion(pastorDelCaso, 'supervisor', asig, abre);
  }

  /* Relevo: termina la asignación del que sale y empieza la del que entra. */
  const relevar = (m, razon, excluir, soloConsejeros = false) => {
    const nuevo = consejeroPara(az, red, s, m.fecha, persona, excluir);
    if (nuevo.persona_id === actual.persona_id || (soloConsejeros && nuevo.esPastor)) return;
    asignacion.hasta = m;
    asignacion = nuevaAsignacion(nuevo, 'consejero', m, pastorDelCaso ?? abre);
    nota(pastorDelCaso ?? abre, `Se reasigna el caso: ${razon}. Continúa ${nuevo.nombre}.`, m);
    actual = nuevo;
  };

  /* Sesiones. */
  const intenso = TOPICOS_INTENSOS.has(topico);
  let objetivo = { cerrado: az.entero(2, 7), derivado: topico === 'SUICIDIO' ? 1 : az.entero(1, 3), en_pausa: az.entero(3, 8),
    en_proceso: az.entero(1, 9) }[estado];
  let limite = AYER;
  if (estado === 'cerrado') limite = sumarDias(AYER, -3);
  if (estado === 'en_pausa') limite = sumarDias(AYER, -az.entero(20, 45));
  const estancado = estado === 'en_proceso' && edadCaso > 45 && az.probabilidad(0.2);
  if (estancado) limite = sumarDias(AYER, -az.entero(25, 50));
  /* Un proceso vivo tiene sesiones hasta estas semanas (con un tope razonable); el estancado es el que alerta. */
  if (estado === 'en_proceso' && !estancado) objetivo = Math.min(az.entero(8, 14), Math.max(objetivo, Math.ceil(edadCaso / 14)));
  /* Un proceso largo no se detiene: se espacia (cada tres o cuatro semanas) y llega hasta estos días. */
  const ritmo = estado === 'en_proceso' && !estancado ? diasEntre(asig.fecha, limite) / Math.max(1, objetivo) : 0;
  const pausaIntermedia = estado === 'en_proceso' && edadCaso > 100 && az.probabilidad(0.18);
  const relevoAlAzar = az.probabilidad(0.05);
  const textos = t.sesion.filter(() => az.probabilidad(0.8));
  if (!textos.length) textos.push(...t.sesion);
  let usados = 0, previa = asig, fSes = topico === 'SUICIDIO' ? asig.fecha : sumarDias(asig.fecha, az.entero(0, 5));
  let pausa = null;
  while (caso.sesiones.length < objetivo && fSes <= limite) {
    let m = { fecha: fSes, hora: topico === 'SUICIDIO' && fSes === asig.fecha ? mover(asig, 30).hora : horaSesion(az, fSes) };
    if (!antes(previa, m)) m = mover(previa, 45);
    if (antes(TOPE, m)) break;
    /* ¿El consejero sigue sirviendo ese día? Si no, el caso pasa a otro (Luz Hoyos en enero). */
    if (!actual.esPastor && actual.hasta && !vigenteEn(actual, m.fecha)) {
      relevar({ fecha: actual.hasta, hora: '09:00' }, `${actual.nombre} terminó su servicio en consejería`, actual.persona_id);
    } else if (relevoAlAzar && caso.sesiones.length === 2) {
      relevar(mover(previa, 24 * 60), 'se equilibró la carga de casos entre los consejeros', actual.persona_id, true);
    }
    const modalidad = topico === 'SUICIDIO' && !caso.sesiones.length ? 'presencial' : ponderado(az, MODALIDAD);
    const [dmin, dmax] = DURACION[modalidad];
    const duracion = Math.round(az.entero(dmin, dmax) / 5) * 5;
    const asistio = !caso.sesiones.length || az.probabilidad(0.92);
    const sesion = { id: az.uuid(), caso_id: id, consejero_id: actual.persona_id, fecha: ts(s, m), duracion_min: duracion,
      modalidad, asistio, registrada_en: ts(s, hastaTope(mover(m, duracion + az.entero(5, 120)))), momento: m };
    caso.sesiones.push(sesion);
    const escrita = hastaTope(mover(m, duracion + az.entero(10, 150)));
    if (asistio && az.probabilidad(0.85)) {
      const texto = usados < textos.length ? textos[usados++](persona, x) : az.elegir(NOTA_SESION_GENERAL)(persona, x);
      nota(actual, texto, escrita, sesion.id);
    } else if (!asistio && az.probabilidad(0.6)) {
      nota(actual, az.elegir(NOTA_INASISTENCIA), escrita, sesion.id);
    }
    previa = m;
    let salto = intenso ? az.entero(5, 10) : az.entero(7, 18);
    if (ritmo > (intenso ? 10 : 18)) salto = az.entero(Math.round(ritmo * 0.75), Math.round(ritmo * 1.2));
    if (pausaIntermedia && caso.sesiones.length === 2 && !pausa) {
      salto = az.entero(35, 60);
      const inicioPausa = { fecha: sumarDias(m.fecha, az.entero(3, 6)), hora: horaOficina(az, m.fecha) };
      pausa = { inicio: inicioPausa, fin: { fecha: sumarDias(m.fecha, salto - 2), hora: '10:00' } };
      if (antes(TOPE, pausa.fin)) { pausa = null; salto = intenso ? 7 : 12; }
      else {
        caso.pasos.push({ autor: actual.persona_id, motivo: 'Consejería: proceso en pausa', set: { estado: 'en_pausa' } });
        nota(actual, az.elegir(NOTA_PAUSA)(persona), inicioPausa);
        caso.pasos.push({ autor: actual.persona_id, motivo: 'Consejería: se retoma el proceso', set: { estado: 'en_proceso' } });
        nota(actual, az.elegir(NOTA_RETOMA)(persona), pausa.fin);
      }
    }
    fSes = sumarDias(fSes, salto);
  }

  const ultima = caso.sesiones.length ? caso.sesiones[caso.sesiones.length - 1].momento : asig;
  if (['cerrado', 'en_pausa'].includes(estado) && !caso.sesiones.length) estado = 'en_proceso';

  const cerrarAsignaciones = (m) => { for (const a of caso.asignaciones) if (!a.hasta) a.hasta = m; };
  if (estado === 'cerrado') {
    let cierre = { fecha: sumarDias(ultima.fecha, az.entero(1, 9)), hora: '11:00' };
    cierre.hora = horaOficina(az, cierre.fecha);
    cierre = hastaTope(cierre);
    if (!antes(ultima, cierre)) estado = 'en_proceso';
    else {
      const desenlace = az.elegir(t.cierre)(persona, x);
      caso.pasos.push({ autor: actual.persona_id, motivo: 'Consejería: cierre con su desenlace',
        set: { estado: 'cerrado', cerrado_en: ts(s, cierre), desenlace } });
      cerrarAsignaciones(cierre);
      caso.cierre = cierre;
    }
  } else if (estado === 'derivado') {
    let deriv = topico === 'SUICIDIO' ? mover(ultima, 120)
      : { fecha: sumarDias(ultima.fecha, az.entero(0, 3)), hora: '12:00' };
    if (topico !== 'SUICIDIO') deriv.hora = horaOficina(az, deriv.fecha);
    if (!antes(ultima, deriv)) deriv = mover(ultima, 90);
    deriv = hastaTope(deriv);
    const lugares = (DERIVAR[t.derivar ?? 'psicologia'] ?? DERIVAR.psicologia)[pais] ?? DERIVAR.psicologia.CO;
    const derivadoA = az.elegir(lugares);
    const desenlace = topico === 'SUICIDIO'
      ? `Se activó la ruta de salud mental el mismo día. ${may(x.quienReserva)} sigue en contacto con la familia.`
      : `Se derivó a ${derivadoA} porque el tema necesita atención profesional. La iglesia sigue acompañando con oración y cercanía.`;
    caso.pasos.push({ autor: actual.persona_id, motivo: 'Consejería: caso derivado',
      set: { estado: 'derivado', derivado_a: derivadoA, desenlace } });
    nota(actual, `Se deriva a ${derivadoA}. El tema necesita atención profesional; se acordó con ${persona.nombre} y queda el contacto de la iglesia para lo que necesite.`, deriv);
    cerrarAsignaciones(deriv);
  } else if (estado === 'en_pausa') {
    let p = { fecha: sumarDias(ultima.fecha, az.entero(3, 12)), hora: '10:00' };
    p.hora = horaOficina(az, p.fecha);
    p = hastaTope(p);
    if (antes(ultima, p)) {
      caso.pasos.push({ autor: actual.persona_id, motivo: 'Consejería: proceso en pausa', set: { estado: 'en_pausa' } });
      nota(actual, az.elegir(NOTA_PAUSA)(persona), p);
    } else estado = 'en_proceso';
  }
  caso.estado = estado;

  /* El consejero revocado hoy (Javier Saavedra): sus casos abiertos pasan a los otros consejeros de la sede,
     como dice el motivo de la revocación, en el mismo instante en que el comité la firmó. */
  if (!['cerrado', 'derivado'].includes(estado) && !actual.esPastor && actual.revocada_en) {
    const m = { fecha: actual.revocada_en.slice(0, 10), hora: actual.revocada_en.slice(11, 16), ts: actual.revocada_en };
    relevar(m, `${actual.nombre} dejó la consejería por salud (revocación del comité de accesos)`, actual.persona_id);
  }
  return caso;
}

async function consejeria(c, az, red, como) {
  const profesional = new Set(red.topicos.filter((t) => t.requiere_profesional).map((t) => t.codigo));
  const pesos = Object.fromEntries(red.topicos.map((t) => [t.codigo, PESO_TOPICO[t.codigo] ?? 1]));
  const casos = [];
  let crisis = 0;
  for (const s of red.sedes.filter((x) => x.modulos.includes('consejeria'))) {
    const azS = az.derivar(s.codigo);
    const n = s.tamano === 'grande' ? azS.entero(12, 16) : s.tamano === 'mediana' ? azS.entero(5, 8) : azS.entero(2, 4);
    const inicio = maxFecha(SALIDAS_POR_OLA[s.ola_migracion] ?? d.INICIO_HISTORIA, d.INICIO_HISTORIA);
    /* Quien consulta no tiene rol ni sirve en la central: quienes prueban el sistema entran como ellos. */
    const pool = red.gentePorSede.get(s.id).filter((p) => !red.conRol.has(p.id) && !red.enEquipo.has(p.id) && p.edad >= 19);
    const usados = new Set();
    const cerrados = [];
    let crisisSede = 0;
    for (let i = 0; i < n; i++) {
      let topico = ponderado(azS, pesos);
      if (topico === 'SUICIDIO' && (crisis >= 2 || crisisSede >= 1 || s.tamano === 'pequena')) topico = 'ANSIEDAD';
      if (!crisis && s.tamano === 'grande' && i === 1 && pesos.SUICIDIO) topico = 'SUICIDIO';
      let fecha = fechaReciente(azS, inicio, AYER, 1.4);
      let persona = null, previo = null;
      if (cerrados.length && azS.probabilidad(0.08)) {
        const cand = cerrados.filter((k) => sumarDias(k.cierre.fecha, 30) < AYER && !k.repetido);
        if (cand.length) {
          previo = azS.elegir(cand);
          previo.repetido = true;
          persona = previo.persona;
          fecha = azS.fechaEntre(sumarDias(previo.cierre.fecha, 30), AYER);
          if (topico === 'SUICIDIO') topico = 'ANSIEDAD';
        }
      }
      if (!persona) persona = elegirConsultante(azS, red, pool, topico, fecha, usados);
      if (!persona) { topico = 'FE'; persona = elegirConsultante(azS, red, pool, topico, fecha, usados); }
      if (!persona) continue;
      usados.add(persona.id);
      if (topico === 'SUICIDIO') { crisis++; crisisSede++; }
      const caso = armarCaso(azS, red, s, i + 1, topico, persona, fecha, profesional.has(topico), previo);
      casos.push(caso);
      if (caso.estado === 'cerrado') cerrados.push(caso);
    }
  }

  /* 1 · Los casos nacen «abiertos», con el autor que los abrió (la línea de tiempo lo anota). */
  await insertarPorAutor(c, como, 'consejeria.casos',
    casos.map((k) => ({ id: k.id, consultante_id: k.persona.id, sede_id: k.s.id, topico: k.topico, estado: 'abierto',
      abierto_en: ts(k.s, k.abierto), source_system: SISTEMA, source_id: k.source_id, _autor: k.abre.persona_id })),
    (f) => f._autor, 'Consejería: apertura del caso',
    { columnas: ['id', 'consultante_id', 'sede_id', 'topico', 'estado', 'abierto_en', 'source_system', 'source_id'] });
  /* 2 · Quién lleva cada caso (con sus relevos), sesiones y notas. */
  await insertarPorAutor(c, como, 'consejeria.asignaciones',
    casos.flatMap((k) => k.asignaciones.map((a) => ({ id: a.id, caso_id: a.caso_id, consejero_id: a.consejero_id, rol: a.rol,
      desde: ts(k.s, a.desde), hasta: a.hasta ? ts(k.s, a.hasta) : null, asignado_por: a.asignado_por }))),
    (f) => f.asignado_por, 'Consejería: asignación del consejero');
  await insertarPorAutor(c, como, 'consejeria.sesiones',
    casos.flatMap((k) => k.sesiones.map(({ momento, ...f }) => f)), (f) => f.consejero_id, 'Consejería: sesión registrada');
  await insertarPorAutor(c, como, 'consejeria.notas', casos.flatMap((k) => k.notas), (f) => f.autor_id, 'Consejería: nota del caso');
  /* 3 · Los estados avanzan por la base: asignado, pausas, cierre con desenlace, derivación. */
  await aplicarPasos(c, como, 'consejeria.casos',
    { estado: 'consejeria.estado_caso', cerrado_en: 'timestamptz', derivado_a: 'text', desenlace: 'text' }, casos);
  return casos;
}

/* ─────────────────────────────────────────────────────────────────────
   11 · ORACIÓN
   Quién puede orar por una petición es quien puede verla, como dice la
   política de la base: los pastores todo; el líder de oración lo que no es
   confidencial; quien ora en el equipo, solo lo compartido.
   ───────────────────────────────────────────────────────────────────── */

const PESO_CATEGORIA_ORACION = { salud: 30, familia: 20, trabajo: 15, espiritual: 12, duelo: 8, gratitud: 9, otro: 6 };
const RESPUESTA_PUBLICA = ['Se le llamó y contó que la situación mejoró. Da gracias a Dios.',
  'Escribió de nuevo para contar que Dios respondió. Vendrá el domingo a dar gracias.'];

/** De dónde son los nombres de quien escribe desde afuera. */
function origenDe(az, s) {
  if (s.pais === 'ES') return az.probabilidad(0.6) ? 'ES' : 'CO';
  if (s.pais === 'PA') return az.probabilidad(0.6) ? 'PA' : 'CO';
  if (s.pais === 'US') return az.ponderado({ CO: 55, VE: 25, US: 20 });
  return 'CO';
}

function estadoOracion(az, edad, categoria) {
  if (categoria === 'gratitud') {
    return edad > 7 ? ponderado(az, { cerrada: 5, respondida: 4, en_oracion: 1 }) : ponderado(az, { abierta: 1, en_oracion: 1 });
  }
  if (edad > 45) return ponderado(az, { respondida: 33, cerrada: 48, en_oracion: 16, abierta: 3 });
  if (edad > 14) return ponderado(az, { respondida: 20, cerrada: 15, en_oracion: 57, abierta: 8 });
  return ponderado(az, { en_oracion: 48, abierta: 46, respondida: 6 });
}

async function oracion(c, az, red, como, usados) {
  const cats = await d.valoresDe(c, 'categoria_oracion');
  const pesos = Object.fromEntries(cats.map((k) => [k, PESO_CATEGORIA_ORACION[k] ?? 3]));
  const peticiones = [], oraciones = [];
  for (const s of red.sedes.filter((x) => x.modulos.includes('oracion'))) {
    const azS = az.derivar(s.codigo);
    const n = s.tamano === 'grande' ? azS.entero(24, 32) : s.tamano === 'mediana' ? azS.entero(10, 15) : azS.entero(5, 8);
    const inicio = maxFecha(SALIDAS_POR_OLA[s.ola_migracion] ?? d.INICIO_HISTORIA, '2026-03-02');
    const equipo = red.intercesion[s.codigo] ?? { lider: null, orantes: [] };
    const gente = red.gentePorSede.get(s.id).filter((p) => p.edad >= 18);
    const afuera = s.pais !== 'CO';
    for (let i = 0; i < n; i++) {
      const creado = { fecha: fechaReciente(azS, inicio, AYER, 1.7), hora: azS.horaEntre('07:00', '21:00', 5) };
      const [el, ella] = parejaDe(red, s, creado.fecha);
      const edad = diasEntre(creado.fecha, AYER);
      const pet = { id: azS.uuid(), s, creado, pasos: [] };
      let t, categoria;
      if (azS.probabilidad(0.18)) {
        /* Llegó por el formulario público del sitio: sin sesión, sin persona registrada. */
        const m = azS.elegir([...ORACION_PUBLICA, ...(afuera ? ORACION_PUBLICA_AFUERA : [])].filter((x) => cats.includes(x.categoria)));
        const genero = azS.probabilidad(0.6) ? 'F' : 'M';
        const origen = origenDe(azS, s);
        const nom = d.nombrePara(azS, genero, 1955 + azS.entero(0, 50), { origen });
        const apellido = d.apellidoAzar(azS, origen);
        categoria = m.categoria;
        t = { resumen: m.resumen, detalle: m.detalle, respuestas: RESPUESTA_PUBLICA };
        Object.assign(pet, { origen: 'formulario_publico', persona_id: null, nombre_contacto: `${nom.primer_nombre} ${apellido}`,
          contacto: azS.probabilidad(0.65) ? `Celular ${d.telefonoNuevo(azS, usados.telefonos)}`
            : d.correoNuevo(azS, nom.primer_nombre, apellido, usados.correos),
          confidencial: azS.probabilidad(0.25), compartir: false, creado_por: null });
      } else {
        const candidatas = gente.filter((p) => p.desde <= creado.fecha);
        const persona = azS.probabilidad(0.75) && candidatas.length ? azS.elegir(candidatas) : null;
        const lider = equipo.lider && equipo.lider.desde <= creado.fecha ? equipo.lider : null;
        const registra = lider && azS.probabilidad(0.4) ? lider : (persona?.genero === 'F' ? ella : el) ?? el;
        const confidencial = azS.probabilidad(0.18);
        const pariente = azS.elegir(PARIENTES);
        const hijos = persona ? (red.hijosDe.get(persona.id) ?? []) : [];
        const h = hijos.length ? azS.elegir(hijos) : null;
        const quienPide = persona ?? { genero: azS.probabilidad(0.6) ? 'F' : 'M' };
        const x = {
          par: pariente[0], pg: (m, f) => (pariente[1] === 'F' ? f : m), quien: (m, f) => g(quienPide, m, f),
          hijo: h ? (h.genero === 'F' ? 'hija' : 'hijo') : azS.elegir(['hijo', 'hija']), edadHijo: h ? h.edad : azS.entero(15, 24),
          causa: azS.elegir(CAUSAS), parte: azS.elegir(PARTES), fecha: diaHabil(sumarDias(creado.fecha, azS.entero(3, 12))),
          apellido: persona?.primer_apellido ?? d.apellidoAzar(azS, 'CO'), tiempo: azS.elegir(TIEMPOS),
          pastoral: quienPide.genero === 'F' ? 'la pastora' : 'el pastor',
        };
        if (confidencial) {
          const banco = afuera ? [...ORACION_CONFIDENCIAL, ...ORACION_CONFIDENCIAL_AFUERA] : ORACION_CONFIDENCIAL;
          t = { ...azS.elegir(banco)(x), respuestas: RESPUESTA_CONFIDENCIAL };
          categoria = azS.elegir(['familia', 'salud', 'trabajo', 'otro'].filter((k) => cats.includes(k)));
        } else {
          categoria = ponderado(azS, pesos);
          t = azS.elegir(ORACION[categoria] ?? ORACION.otro)(x);
        }
        let nombreContacto = null, contacto = null;
        if (!persona) {
          const nom = d.nombrePara(azS, quienPide.genero, 1950 + azS.entero(0, 50), { origen: origenDe(azS, s) });
          nombreContacto = `${nom.primer_nombre} ${d.apellidoAzar(azS, origenDe(azS, s))}`;
          if (azS.probabilidad(0.6)) contacto = `Celular ${d.telefonoNuevo(azS, usados.telefonos)}`;
        } else if (persona.telefono && azS.probabilidad(0.35)) contacto = `Celular ${persona.telefono}`;
        Object.assign(pet, { origen: 'interno', persona_id: persona?.id ?? null, nombre_contacto: nombreContacto, contacto,
          confidencial, compartir: !confidencial && azS.probabilidad(0.55), creado_por: registra.persona_id });
      }
      Object.assign(pet, { categoria, resumen: t.resumen, detalle: t.detalle });

      /* Estado y momentos: respondida y cerrada tienen su fecha, y las oraciones caben antes. */
      let estado = estadoOracion(azS, edad, categoria);
      if (estado === 'respondida' && !t.respuestas?.length) estado = 'cerrada';
      const pastores = [el, ella].filter(Boolean).map((p) => ({ ...p, edita: true }));
      const pueden = [...pastores];
      if (!pet.confidencial && equipo.lider) pueden.push({ ...equipo.lider, edita: false });
      if (pet.compartir) for (const o of equipo.orantes) pueden.push({ ...o, edita: false });
      let tResp = null, tCierre = null;
      const despues = (desde, minDias, maxDias) => {
        const m = { fecha: sumarDias(desde.fecha, azS.entero(minDias, maxDias)), hora: azS.horaEntre('08:00', '20:30', 5) };
        return hastaTope(antes(desde, m) ? m : mover(desde, 120));
      };
      if (estado === 'respondida' || (estado === 'cerrada' && t.respuestas?.length && azS.probabilidad(0.5))) {
        tResp = despues(creado, Math.min(3, edad), Math.max(3, Math.min(edad, 40)));
        /* Lo que tiene fecha (una cirugía, una entrevista) se responde después de ese día. */
        if (t.evento && tResp.fecha <= t.evento) {
          const tras = { fecha: sumarDias(t.evento, azS.entero(1, 4)), hora: azS.horaEntre('08:00', '20:30', 5) };
          if (antes(TOPE, tras)) { tResp = null; if (estado === 'respondida') estado = 'en_oracion'; } else tResp = tras;
        }
      }
      if (estado === 'cerrada' && t.evento && !tResp && t.evento >= AYER) estado = 'en_oracion';
      if (estado === 'cerrada') tCierre = despues(tResp ?? creado, Math.min(2, edad), Math.max(2, Math.min(diasEntre((tResp ?? creado).fecha, AYER), 25)));
      if (tResp && tCierre && !antes(tResp, tCierre)) tCierre = null, estado = 'respondida';
      const fin = tResp ?? tCierre ?? TOPE;

      let cuantas = 0, soloSinEditar = false;
      if (estado === 'en_oracion') cuantas = azS.entero(1, 7);
      else if (estado === 'respondida') cuantas = azS.entero(2, 10);
      else if (estado === 'cerrada') cuantas = azS.probabilidad(0.15) ? 0 : azS.entero(1, 8);
      else if (edad >= 3 && azS.probabilidad(edad > 14 ? 0.6 : 0.3)) { cuantas = azS.entero(1, 3); soloSinEditar = true; }
      const lista = [];
      for (let k = 0; k < cuantas; k++) {
        const m = { fecha: azS.fechaEntre(creado.fecha, fin.fecha), hora: azS.horaEntre('05:30', '21:30', 5) };
        const quienes = pueden.filter((p) => (p.edita ? !soloSinEditar : (p.desde ?? '') <= m.fecha));
        if (!quienes.length || !antes(creado, m) || antes(fin, m)) continue;
        /* Los que oran con el equipo lo hacen más a menudo que los pastores. */
        const p = azS.ponderado(quienes.map((q) => [q, q.edita ? 1 : 2]));
        lista.push({ m, p });
      }
      lista.sort((a, b) => (clave(a.m) < clave(b.m) ? -1 : 1));
      if (soloSinEditar && !lista.length) soloSinEditar = false;
      for (const o of lista) {
        oraciones.push({ id: azS.uuid(), peticion_id: pet.id, sede_id: s.id, persona_id: o.p.persona_id, oro_en: ts(s, o.m),
          nota: azS.probabilidad(0.45) ? azS.elegir(NOTAS_ORACION) : null });
      }

      /* Pasos: en oración con la primera oración; respondida con el testimonio; cerrada. */
      const editor = (m) => {
        const quienes = pueden.filter((p) => p.edita || (p.desde <= m.fecha && !pet.confidencial && p.rol === 'LIDER_DE_ORACION'));
        return azS.elegir(quienes.length ? quienes : pastores);
      };
      if (!soloSinEditar && ['en_oracion', 'respondida', 'cerrada'].includes(estado) && lista.length) {
        pet.pasos.push({ autor: lista[0].p.persona_id, motivo: 'Oración: en oración', set: { estado: 'en_oracion' } });
      } else if (estado === 'en_oracion') estado = 'abierta';
      if (tResp) {
        const respuesta = azS.elegir(t.respuestas);
        pet.pasos.push({ autor: editor(tResp).persona_id, motivo: 'Oración: respuesta registrada',
          set: { estado: 'respondida', respuesta, respondida_en: ts(s, tResp) } });
      }
      if (tCierre) {
        pet.pasos.push({ autor: editor(tCierre).persona_id, motivo: 'Oración: petición cerrada', set: { estado: 'cerrada', cerrada_en: ts(s, tCierre) } });
      }
      pet.estado = tCierre ? 'cerrada' : tResp ? 'respondida' : estado;
      peticiones.push(pet);
    }
  }

  await insertarPorAutor(c, como, 'crm.peticiones_oracion',
    peticiones.map((p) => ({ id: p.id, sede_id: p.s.id, persona_id: p.persona_id, nombre_contacto: p.nombre_contacto,
      contacto: p.contacto, categoria: p.categoria, resumen: p.resumen, detalle: p.detalle, confidencial: p.confidencial,
      compartir_con_intercesores: p.compartir, origen: p.origen, estado: 'abierta', creado_por: p.creado_por,
      creado_en: ts(p.s, p.creado) })),
    (f) => f.creado_por, 'Oración: petición registrada', { sedePublica: (f) => (f.creado_por ? null : f.sede_id) });
  await insertarPorAutor(c, como, 'crm.oraciones_hechas', oraciones, (f) => f.persona_id, 'Oración: oró por la petición');
  await aplicarPasos(c, como, 'crm.peticiones_oracion',
    { estado: 'text', respuesta: 'text', respondida_en: 'timestamptz', cerrada_en: 'timestamptz' }, peticiones);
  return { peticiones, oraciones };
}

/* ─────────────────────────────────────────────────────────────────────
   12 · PETICIONES INTERNAS
   Las piden la pareja pastoral o la coordinación de nuevos (los roles que
   la matriz deja crear); las decide la dirección general (la única con
   DECIDIR_PETICION, por `administrar`). Nadie decide lo que pidió.
   ───────────────────────────────────────────────────────────────────── */

/** Los modelos de PETICIONES que tienen sentido en una plantación de cuarenta personas. */
const PARA_PLANTACION = [3, 9, 13, 14, 16];
/** Los que la sede madre no pide: que la dirección la visite o que le envíe músicos de sí misma. */
const SOLO_FUERA_DE_LA_MADRE = [13, 16];

/** El siguiente día de la semana `dia` (0 domingo) entre min y max días después de `desde`. */
function proximo(az, dia, desde, min, max) {
  const f = sumarDias(desde, az.entero(min, max));
  return d.fechasDelDia(dia, f, sumarDias(f, 6))[0];
}

function estadoPeticion(az, edad) {
  if (edad <= 6) return ponderado(az, { enviada: 60, en_revision: 25, aprobada: 10, cancelada: 5 });
  if (edad <= 30) return ponderado(az, { enviada: 10, en_revision: 25, aprobada: 42, rechazada: 13, cancelada: 10 });
  return ponderado(az, { en_revision: 5, aprobada: 62, rechazada: 22, cancelada: 11 });
}

async function peticionesInternas(c, az, red, como) {
  const tipos = await d.valoresDe(c, 'tipo_peticion_interna');
  const [dg, esposa] = red.direccion;
  const lista = [];
  for (const s of red.sedes.filter((x) => x.modulos.includes('peticiones'))) {
    const azS = az.derivar(s.codigo);
    const plantacion = s.tipo === 'plantacion';
    const n = plantacion ? azS.entero(1, 3) : s.tamano === 'grande' ? azS.entero(6, 9) : s.tamano === 'mediana' ? azS.entero(3, 5) : azS.entero(2, 3);
    const inicio = maxFecha(SALIDAS_POR_OLA[s.ola_migracion] ?? d.INICIO_HISTORIA, '2026-01-13');
    const zonas = [...new Set(red.gentePorSede.get(s.id).map((p) => p.zona).filter(Boolean))].sort();
    const madre = s.tipo === 'sede_madre';
    const modelos = azS.barajar(plantacion ? PARA_PLANTACION.map((i) => PETICIONES[i])
      : PETICIONES.filter((_, i) => !madre || !SOLO_FUERA_DE_LA_MADRE.includes(i)));
    for (let i = 0; i < n; i++) {
      const creado = { fecha: fechaReciente(azS, inicio, AYER, 1.3), hora: '09:00' };
      creado.hora = horaOficina(azS, creado.fecha);
      const [el, ella] = parejaDe(red, s, creado.fecha);
      const coords = vigentesEn(red.coordinadores, s, creado.fecha);
      const solicitante = coords.length && azS.probabilidad(0.35) ? azS.elegir(coords) : azS.elegir([el, ella].filter(Boolean));
      const x = { fecha: creado.fecha, az: azS, barrio: zonas.length ? azS.elegir(zonas) : s.ciudad,
        sabado: proximo(azS, 6, creado.fecha, 14, 35), domingo: proximo(azS, 0, creado.fecha, 10, 40) };
      const m = modelos[i % modelos.length](s, x);
      if (!tipos.includes(m.tipo)) continue;
      const edad = diasEntre(creado.fecha, AYER);
      let estado = estadoPeticion(azS, edad);
      let decide = azS.probabilidad(0.6) ? dg : esposa;
      if (decide.persona_id === solicitante.persona_id) decide = decide === dg ? esposa : dg;
      const pet = { id: azS.uuid(), s, creado, solicitante, tipo: m.tipo, asunto: m.asunto, detalle: m.detalle,
        dirigida_a: red.unidad[m.dirigida] ?? null, prioridad: ponderado(azS, m.prioridad), pasos: [] };
      let cursor = creado;
      const despues = (min, max) => {
        const f = { fecha: sumarDias(cursor.fecha, azS.entero(min, max)), hora: '10:00' };
        f.hora = horaOficina(azS, f.fecha);
        const mm = antes(cursor, f) ? f : mover(cursor, 60);
        return antes(TOPE, mm) ? null : mm;
      };
      if (estado === 'en_revision' || (['aprobada', 'rechazada'].includes(estado) && azS.probabilidad(0.6))) {
        const rev = despues(1, 4);
        if (rev) {
          cursor = rev;
          pet.pasos.push({ autor: decide.persona_id, motivo: 'Petición interna: en revisión', set: { estado: 'en_revision' } });
        } else if (estado === 'en_revision') estado = 'enviada';
      }
      if (['aprobada', 'rechazada'].includes(estado)) {
        const dec = despues(1, 12);
        if (dec) {
          pet.decision = azS.elegir(m[estado]);
          pet.decidida = dec;
          pet.decidida_por = decide.persona_id;
          pet.pasos.push({ autor: decide.persona_id, motivo: 'Petición interna: decisión de la dirección',
            set: { estado, decision: pet.decision, decidida_por: decide.persona_id, decidida_en: ts(s, dec) } });
        } else estado = pet.pasos.length ? 'en_revision' : 'enviada';
      }
      if (estado === 'cancelada') {
        const can = despues(1, 6);
        if (can) pet.pasos.push({ autor: solicitante.persona_id, motivo: 'Petición interna: retirada por quien la pidió', set: { estado: 'cancelada' } });
        else estado = 'enviada';
      }
      pet.estado = estado;
      lista.push(pet);
    }
  }
  await insertarPorAutor(c, como, 'sistema.peticiones_internas',
    lista.map((p) => ({ id: p.id, sede_id: p.s.id, solicitante_id: p.solicitante.persona_id, tipo: p.tipo, asunto: p.asunto,
      detalle: p.detalle, dirigida_a: p.dirigida_a, prioridad: p.prioridad, estado: 'enviada', creado_en: ts(p.s, p.creado) })),
    (f) => f.solicitante_id, 'Petición interna enviada a la dirección');
  await aplicarPasos(c, como, 'sistema.peticiones_internas',
    { estado: 'text', decision: 'text', decidida_por: 'uuid', decidida_en: 'timestamptz' }, lista);
  return lista;
}

/* ─────────────────────────────────────────────────────────────────────
   13 · REQUERIMIENTOS
   Los reporta la secretaría o la pareja pastoral (crear); los atiende el
   único rol con ATENDER_REQUERIMIENTO (GERENCIA_ADMINISTRATIVA, que el
   seed 020 le da al Equipo de Comunicaciones); el plazo lo pone la base.
   ───────────────────────────────────────────────────────────────────── */

function estadoRequerimiento(az, edad) {
  if (edad >= 30) return ponderado(az, { cerrado: 76, resuelto: 11, cancelado: 10, en_curso: 1.2, asignado: 1, nuevo: 0.8 });
  if (edad >= 8) return ponderado(az, { cerrado: 38, resuelto: 30, cancelado: 6, en_curso: 12, asignado: 8, nuevo: 6 });
  if (edad >= 2) return ponderado(az, { resuelto: 22, cerrado: 8, en_curso: 28, asignado: 22, nuevo: 18, cancelado: 2 });
  return ponderado(az, { nuevo: 45, asignado: 30, en_curso: 15, resuelto: 10 });
}
/** Minutos entre pasos según la prioridad: [asignar, empezar, resolver]. */
const RITMO = {
  urgente: [[20, 90], [10, 60], [60, 300]], alta: [[60, 600], [60, 1440], [180, 2880]],
  media: [[120, 1800], [120, 2880], [1440, 5760]], baja: [[1440, 4320], [720, 4320], [1440, 10080]],
};

async function requerimientos(c, az, red, como) {
  const cats = await d.valoresDe(c, 'categoria_requerimiento');
  const pesos = Object.fromEntries(cats.map((k) => [k, PESO_CATEGORIA_REQ[k] ?? 5]));
  const atienden = red.equipos['EQ-COM'].length ? red.equipos['EQ-COM'] : [red.direccion[0]];
  const ti = red.equipos['EQ-TI'], prod = red.equipos['EQ-PROD'], cons = red.equipos['EQ-CONST'];
  const lista = [];
  let reabiertos = 0;
  for (const s of red.sedes.filter((x) => x.modulos.includes('requerimientos'))) {
    const azS = az.derivar(s.codigo);
    const n = s.tamano === 'grande' ? azS.entero(12, 16) : s.tamano === 'mediana' ? azS.entero(6, 9) : azS.entero(3, 5);
    const inicio = maxFecha(SALIDAS_POR_OLA[s.ola_migracion] ?? d.INICIO_HISTORIA, '2026-03-02');
    const bogota = s.region === 'REG-BOG';
    const voluntarios = azS.barajar(red.gentePorSede.get(s.id).filter((p) => !red.conRol.has(p.id) && !red.enEquipo.has(p.id) && p.edad >= 22
      && p.edad <= 60 && p.nivel_compromiso !== 'visitante' && p.telefono)).slice(0, 3).map((p) => ({ ...p, persona_id: p.id }));
    const atiende = azS.elegir(atienden);
    const vistos = new Set();
    for (let i = 0; i < n; i++) {
      const cat = ponderado(azS, pesos);
      const aptas = (REQUERIMIENTOS[cat] ?? []).filter((t) => !t.calido || CIUDADES_CALIDAS.has(s.codigo));
      const nuevas = aptas.filter((t) => !vistos.has(t.asunto));
      if (!aptas.length) continue;
      const t = azS.elegir(nuevas.length ? nuevas : aptas);
      vistos.add(t.asunto);
      /* Un tercio de lo reportado es de estos días (la mayoría de los últimos cinco): la mesa de servicio está viva. */
      const cuando = azS.siguiente();
      let fecha = cuando < 0.28 ? azS.fechaEntre(maxFecha(inicio, sumarDias(AYER, -4)), AYER)
        : cuando < 0.36 ? azS.fechaEntre(maxFecha(inicio, sumarDias(AYER, -11)), AYER) : fechaReciente(azS, inicio, AYER, 1.4);
      if (t.domingo) {
        const dom = d.fechasDelDia(0, sumarDias(fecha, -6), fecha);
        if (dom.length && dom[0] >= inicio) fecha = dom[0];
      }
      const creado = { fecha, hora: t.domingo && d.diaSemana(fecha) === 0 ? azS.horaEntre('09:30', '13:30', 5) : horaOficina(azS, fecha) };
      const secs = vigentesEn(red.secretarias, s, fecha);
      const [el, ella] = parejaDe(red, s, fecha);
      const reporta = d.diaSemana(fecha) !== 0 && secs.length && azS.probabilidad(0.6) ? azS.elegir(secs) : azS.elegir([el, ella].filter(Boolean));
      const prioridad = ponderado(azS, t.prioridad);
      const edad = diasEntre(fecha, AYER);
      let estado = estadoRequerimiento(azS, edad);
      /* Si su plazo ya pasó, lo normal es que se haya atendido: solo una parte queda vencida. */
      const plazo = { urgente: 240, alta: 1440, media: 4320, baja: 10080 }[prioridad];
      const vence = mover(creado, plazo);
      if (['nuevo', 'asignado', 'en_curso'].includes(estado) && antes(vence, { fecha: HOY, hora: '12:00' })) {
        const muyAtrasado = diasEntre(vence.fecha, HOY) > 3;
        if (azS.probabilidad(muyAtrasado ? 0.8 : 0.5)) estado = azS.probabilidad(0.55) ? 'resuelto' : 'cerrado';
      }
      const tecnico = (t.quien === 'ti' && ti.length) ? azS.elegir(ti)
        : (t.quien === 'prod' && bogota && prod.length) ? azS.elegir(prod)
          : (t.quien === 'const' && (bogota || s.tamano === 'grande') && cons.length) ? azS.elegir(cons)
            : voluntarios.length ? azS.elegir(voluntarios) : reporta;
      const req = { id: azS.uuid(), s, creado, reporta, categoria: cat, t, prioridad, pasos: [], asignado: null };
      /* El camino hasta su estado de hoy, paso por paso, dentro del tiempo que ya pasó. */
      let plan;
      if (estado === 'nuevo') plan = [];
      else if (estado === 'asignado') plan = ['asignado'];
      else if (estado === 'en_curso') {
        plan = azS.probabilidad(0.8) ? ['asignado', 'en_curso'] : ['en_curso'];
        if (reabiertos < 2 && edad >= 10 && ['mantenimiento', 'sonido_video'].includes(cat)) {
          plan = ['asignado', 'en_curso', 'resuelto', 'reabierto'];
          reabiertos++;
        }
      } else if (estado === 'resuelto') plan = azS.probabilidad(0.8) ? ['asignado', 'en_curso', 'resuelto'] : ['asignado', 'resuelto'];
      else if (estado === 'cerrado') plan = [...(azS.probabilidad(0.8) ? ['asignado', 'en_curso', 'resuelto'] : ['asignado', 'resuelto']), 'cerrado'];
      else plan = azS.probabilidad(0.5) ? ['cancelado'] : ['asignado', 'cancelado'];
      let cursor = creado;
      const [r1, r2, r3] = RITMO[prioridad];
      const tarde = azS.probabilidad(0.25) ? 2.5 : 1;
      for (const [k, paso] of plan.entries()) {
        const rango = { asignado: r1, en_curso: r2, resuelto: r3.map((v) => Math.round(v * tarde)), cerrado: [1440, 8640],
          cancelado: [120, 4320], reabierto: [1440, 7200] }[paso];
        let m = mover(cursor, azS.entero(rango[0], rango[1]));
        if (antes(TOPE, m)) {
          /* Lo que hoy está en ese estado llegó ahí en el tiempo que hubo: se aprietan los pasos que faltan. */
          const libre = minutosEntre(cursor, TOPE), quedan = plan.length - k;
          if (libre < quedan * 15) break;
          m = mover(cursor, Math.max(10, Math.floor(libre / (quedan + 1))));
        }
        cursor = m;
        if (paso === 'asignado') {
          req.asignado = tecnico.persona_id;
          req.pasos.push({ autor: atiende.persona_id, motivo: 'Requerimiento asignado', set: { estado: 'asignado', asignado_a: tecnico.persona_id } });
        } else if (paso === 'en_curso') {
          const set = { estado: 'en_curso' };
          if (!req.asignado) { set.asignado_a = tecnico.persona_id; req.asignado = tecnico.persona_id; }
          req.pasos.push({ autor: atiende.persona_id, motivo: 'Requerimiento en curso', set });
        } else if (paso === 'resuelto') {
          req.pasos.push({ autor: atiende.persona_id, motivo: 'Requerimiento resuelto', set: { estado: 'resuelto', solucion: t.solucion, resuelto_en: ts(s, m) } });
        } else if (paso === 'reabierto') {
          req.pasos.push({ autor: atiende.persona_id, motivo: 'Requerimiento reabierto: el problema volvió', set: { estado: 'en_curso' } });
        } else if (paso === 'cerrado') {
          req.pasos.push({ autor: atiende.persona_id, motivo: 'Requerimiento cerrado', set: { estado: 'cerrado' } });
        } else if (paso === 'cancelado') {
          req.pasos.push({ autor: reporta.persona_id, motivo: 'Requerimiento cancelado por quien lo reportó', set: { estado: 'cancelado' } });
        }
      }
      const ultimo = req.pasos[req.pasos.length - 1]?.set.estado ?? 'nuevo';
      req.estado = ultimo;
      lista.push(req);
    }
  }
  await insertarPorAutor(c, como, 'sistema.requerimientos',
    lista.map((r) => ({ id: r.id, sede_id: r.s.id, reportado_por: r.reporta.persona_id, categoria: r.categoria, asunto: r.t.asunto,
      detalle: r.t.detalle, prioridad: r.prioridad, estado: 'nuevo', creado_en: ts(r.s, r.creado) })),
    (f) => f.reportado_por, 'Requerimiento reportado a la mesa de servicio');
  await aplicarPasos(c, como, 'sistema.requerimientos',
    { estado: 'text', asignado_a: 'uuid', solucion: 'text', resuelto_en: 'timestamptz' }, lista);
  return lista;
}

/* ─────────────────────────────────────────────────────────────────────
   14 · TAREAS
   Las crean la pareja pastoral y la secretaría (crear); quien tiene la
   tarea la marca si su rol ve tareas, y si no, quien se la asignó.
   ───────────────────────────────────────────────────────────────────── */

function estadoTarea(az, vence) {
  if (!vence) return ponderado(az, { hecha: 50, pendiente: 30, en_curso: 15, cancelada: 5 });
  if (vence < sumarDias(HOY, -30)) return ponderado(az, { hecha: 82, cancelada: 10, pendiente: 5, en_curso: 3 });
  if (vence < HOY) return ponderado(az, { hecha: 60, cancelada: 6, pendiente: 20, en_curso: 14 });
  return ponderado(az, { pendiente: 45, en_curso: 25, hecha: 25, cancelada: 5 });
}

/** Arma una tarea con su camino (en curso, hecha, cancelada) dentro del tiempo que ya pasó. */
function armarTarea(az, s, o) {
  const tarea = { id: az.uuid(), s, titulo: o.titulo.slice(0, 160), detalle: o.detalle ?? null, asignada: o.asignada ?? null,
    creador: o.creador, creado: o.creado, vence: o.vence ?? null, prioridad: o.prioridad ?? ponderado(az, { normal: 55, alta: 25, baja: 20 }),
    origen_modulo: o.origen_modulo ?? null, origen_id: o.origen_id ?? null, pasos: [] };
  let estado = o.estado ?? estadoTarea(az, tarea.vence);
  const plan = { pendiente: [], en_curso: ['en_curso'], hecha: az.probabilidad(0.6) ? ['en_curso', 'hecha'] : ['hecha'],
    cancelada: az.probabilidad(0.6) ? ['cancelada'] : ['en_curso', 'cancelada'] }[estado];
  /* Quien la marca: la persona que la tiene si su rol ve tareas; si no, quien la creó. */
  const marca = o.asignadaVeTareas && tarea.asignada ? tarea.asignada : tarea.creador;
  let cursor = tarea.creado;
  for (const paso of plan) {
    let m;
    if (paso === 'en_curso') m = mover(cursor, az.entero(60, 3 * 1440));
    else if (paso === 'hecha') {
      const limite = tarea.vence && az.probabilidad(0.8) ? tarea.vence : sumarDias(cursor.fecha, az.entero(2, 20));
      const dias = Math.max(0, diasEntre(cursor.fecha, limite));
      m = { fecha: sumarDias(cursor.fecha, az.entero(0, dias)), hora: '10:00' };
      m.hora = horaOficina(az, m.fecha);
      if (!antes(cursor, m)) m = mover(cursor, az.entero(90, 600));
    } else m = mover(cursor, az.entero(1440, 10 * 1440));
    if (antes(TOPE, m)) break;
    cursor = m;
    if (paso === 'hecha') tarea.pasos.push({ autor: marca, motivo: 'Tarea hecha', set: { estado: 'hecha', hecha_en: ts(s, m) } });
    else if (paso === 'en_curso') tarea.pasos.push({ autor: marca, motivo: 'Tarea en curso', set: { estado: 'en_curso' } });
    else tarea.pasos.push({ autor: tarea.creador, motivo: 'Tarea cancelada', set: { estado: 'cancelada' } });
  }
  tarea.estado = tarea.pasos[tarea.pasos.length - 1]?.set.estado ?? 'pendiente';
  return tarea;
}

async function tareas(c, az, red, como, peticiones, reqs) {
  const lista = [];
  const [dg, esposa] = red.direccion;
  for (const s of red.sedes.filter((x) => x.modulos.includes('tareas'))) {
    const azS = az.derivar(s.codigo);
    const n = s.tamano === 'grande' ? azS.entero(10, 14) : s.tamano === 'mediana' ? azS.entero(5, 8) : azS.entero(3, 4);
    const inicio = maxFecha(SALIDAS_POR_OLA[s.ola_migracion] ?? d.INICIO_HISTORIA, '2026-05-04');
    const modelos = Object.fromEntries(Object.entries(TAREAS).filter(([k]) => k !== 'direccion').map(([k, v]) => [k, azS.barajar(v)]));
    const usados = {};
    const siguiente = (tipo, x) => {
      const lista2 = modelos[tipo];
      usados[tipo] = (usados[tipo] ?? 0) + 1;
      return lista2[(usados[tipo] - 1) % lista2.length](x);
    };
    const apellidos = [...new Set(red.gentePorSede.get(s.id).map((p) => p.primer_apellido))].sort();
    let turnoSecretaria = azS.entero(0, 1);
    for (let i = 0; i < n; i++) {
      /* Las dos primeras: una de él y una de ella, para que cada pastor tenga «Mis tareas» (una de ellas vencida). */
      let tipo = i === 0 ? 'pastor' : i === 1 ? 'pastora' : ponderado(azS, {
        secretaria: 35, pastor: 30, coordinador: 12, tesoreria: vigentesEn(red.tesoreria, s, HOY).length ? 10 : 0, libre: 8 });
      const reciente = i < 2 || azS.probabilidad(0.35);
      let creado = { fecha: reciente ? maxFecha(inicio, sumarDias(AYER, -azS.entero(0, 15))) : fechaReciente(azS, inicio, AYER, 1.3), hora: '09:00' };
      creado.hora = horaOficina(azS, creado.fecha);
      const [el, ella] = parejaDe(red, s, creado.fecha);
      const secs = vigentesEn(red.secretarias, s, creado.fecha);
      /* Por turnos: en las sedes con dos secretarias, las dos tienen su lista. */
      const secretaria = secs.length ? secs[(tipo === 'secretaria' ? turnoSecretaria++ : turnoSecretaria) % secs.length] : null;
      let asignada = null, creador = null, veTareas = true, modelo = tipo;
      if (tipo === 'pastor' || tipo === 'pastora') {
        asignada = tipo === 'pastor' ? el : ella;
        if (i >= 2) asignada = azS.elegir([el, ella].filter(Boolean));
        creador = azS.probabilidad(0.5) ? asignada : (secretaria ?? (asignada === el ? ella : el));
        modelo = 'pastor';
      } else if (tipo === 'secretaria' && secretaria) {
        asignada = secretaria;
        creador = azS.probabilidad(0.3) ? secretaria : azS.elegir([el, ella].filter(Boolean));
      } else if (tipo === 'coordinador' || tipo === 'tesoreria') {
        const quien = vigentesEn(tipo === 'coordinador' ? red.coordinadores : red.tesoreria, s, creado.fecha);
        if (quien.length) { asignada = azS.elegir(quien); veTareas = false; } else { asignada = secretaria ?? el; modelo = 'secretaria'; }
        creador = azS.elegir([el, ella].filter(Boolean));
      } else {
        modelo = 'libre';
        creador = secretaria ?? azS.elegir([el, ella].filter(Boolean));
      }
      const x = { domingo: proximo(azS, 0, creado.fecha, 3, 20), apellido: azS.elegir(apellidos),
        mes: mesDe(sumarDias(creado.fecha, 35)), mesAnterior: mesDe(d.sumarMeses(creado.fecha, -1)) };
      const m = siguiente(modelo, x);
      let vence = azS.probabilidad(0.88) ? sumarDias(creado.fecha, azS.entero(3, 30)) : null;
      let estado;
      if (i === 0) { vence = sumarDias(HOY, azS.entero(2, 14)); estado = azS.probabilidad(0.5) ? 'pendiente' : 'en_curso'; }
      if (i === 1) { vence = azS.probabilidad(0.5) ? sumarDias(HOY, -azS.entero(1, 6)) : sumarDias(HOY, azS.entero(1, 10)); estado = 'pendiente'; }
      if (vence && vence < creado.fecha) vence = sumarDias(creado.fecha, azS.entero(2, 5));
      /* Lo que tiene fecha (una prédica, unos certificados) vence el día anterior. */
      if (m.fecha) vence = maxFecha(sumarDias(creado.fecha, 1), minFecha(vence ?? m.fecha, sumarDias(m.fecha, -1)));
      const { fecha: _fecha, ...texto } = m;
      lista.push(armarTarea(azS, s, { ...texto, asignada: asignada?.persona_id ?? null, creador: creador.persona_id, creado, vence, estado,
        asignadaVeTareas: veTareas }));
    }

    /* Lo aprobado por la dirección se vuelve trabajo de la secretaría. */
    for (const p of peticiones.filter((x) => x.s.id === s.id && x.estado === 'aprobada' && ['compra', 'presupuesto'].includes(x.tipo))) {
      const creado = mover(p.decidida, azS.entero(60, 2 * 1440));
      if (antes(TOPE, creado)) continue;
      const secs = vigentesEn(red.secretarias, s, creado.fecha);
      const [el] = parejaDe(red, s, creado.fecha);
      const creador = p.solicitante.rol === 'PASTOR_CONGREGACIONAL' ? p.solicitante : el;
      lista.push(armarTarea(azS, s, { titulo: `Ejecutar lo aprobado: ${p.asunto}`, detalle: `La dirección aprobó la petición. ${p.decision}`,
        asignada: (secs.length ? azS.elegir(secs) : el).persona_id, creador: creador.persona_id, creado,
        vence: sumarDias(creado.fecha, azS.entero(10, 20)), prioridad: p.prioridad === 'baja' ? 'normal' : 'alta',
        origen_modulo: 'peticiones', origen_id: p.id, asignadaVeTareas: true }));
    }
    /* Y lo que está en manos de un técnico, alguien de la sede lo acompaña. */
    for (const r of reqs.filter((x) => x.s.id === s.id && ['asignado', 'en_curso'].includes(x.estado) && x.reporta.rol === 'SECRETARIA')) {
      if (!azS.probabilidad(0.35)) continue;
      const creado = mover(r.creado, azS.entero(60, 1440));
      if (antes(TOPE, creado)) continue;
      lista.push(armarTarea(azS, s, { titulo: `Acompañar al técnico: ${r.t.asunto}`, detalle: 'Abrir la sede, mostrar el problema y confirmar que quedó resuelto.',
        asignada: r.reporta.persona_id, creador: r.reporta.persona_id, creado, vence: sumarDias(creado.fecha, azS.entero(3, 7)),
        prioridad: r.prioridad === 'baja' ? 'normal' : 'alta', origen_modulo: 'requerimientos', origen_id: r.id, asignadaVeTareas: true }));
    }
  }

  /* La dirección también tiene su lista, en la sede madre. */
  const madre = red.sedes.find((s) => s.tipo === 'sede_madre');
  if (madre && dg) {
    const azD = az.derivar('direccion');
    const para = { dg, esposa, 'DIR-ADMIN': red.equipos['DIR-ADMIN'][0] ?? dg, 'DIR-COM': red.equipos['DIR-COM'][0] ?? esposa };
    for (const [k, m] of TAREAS.direccion.entries()) {
      const creado = { fecha: sumarDias(AYER, -azD.entero(3, 40)), hora: '08:00' };
      creado.hora = horaOficina(azD, creado.fecha);
      const asignada = para[m.para] ?? dg;
      const creador = m.para === 'esposa' ? esposa : dg;
      const vence = k === 0 ? sumarDias(HOY, -3) : sumarDias(creado.fecha, azD.entero(7, 45));
      lista.push(armarTarea(azD, madre, { titulo: m.titulo, detalle: m.detalle, asignada: asignada.persona_id, creador: creador.persona_id,
        creado, vence, prioridad: m.prioridad, estado: k === 0 ? 'en_curso' : undefined,
        asignadaVeTareas: ['dg', 'esposa'].includes(m.para) }));
    }
  }

  await insertarPorAutor(c, como, 'plataforma.tareas',
    lista.map((t) => ({ id: t.id, sede_id: t.s.id, titulo: t.titulo, detalle: t.detalle, asignada_a: t.asignada, creada_por: t.creador,
      vence_en: t.vence, prioridad: t.prioridad, estado: 'pendiente', origen_modulo: t.origen_modulo, origen_id: t.origen_id,
      creado_en: ts(t.s, t.creado) })),
    (f) => f.creada_por, 'Tarea creada');
  await aplicarPasos(c, como, 'plataforma.tareas', { estado: 'text', hecha_en: 'timestamptz' }, lista);
  return lista;
}

/* ─────────────────────────────────────────────────────────────────────
   15 · COMPROBACIONES (dentro de la transacción: si una falla, no queda nada)
   ───────────────────────────────────────────────────────────────────── */

async function comprobar(c) {
  const reglas = [
    ['Nadie decidió una petición interna que él mismo pidió',
      `SELECT count(*) FROM sistema.peticiones_internas WHERE decidida_por = solicitante_id`],
    ['Todo caso cerrado dice cómo terminó',
      `SELECT count(*) FROM consejeria.casos WHERE source_system = $1 AND estado = 'cerrado' AND (desenlace IS NULL OR length(btrim(desenlace)) < 5)`],
    ['Todo caso derivado dice a dónde',
      `SELECT count(*) FROM consejeria.casos WHERE source_system = $1 AND estado = 'derivado' AND derivado_a IS NULL`],
    ['Un caso «abierto» no tiene consejero todavía',
      `SELECT count(*) FROM consejeria.casos k WHERE k.source_system = $1 AND k.estado = 'abierto'
          AND EXISTS (SELECT 1 FROM consejeria.asignaciones a WHERE a.caso_id = k.id)`],
    ['Todo caso en proceso o en pausa tiene un consejero activo',
      `SELECT count(*) FROM consejeria.casos k WHERE k.source_system = $1 AND k.estado IN ('en_proceso', 'en_pausa')
          AND NOT EXISTS (SELECT 1 FROM consejeria.asignaciones a WHERE a.caso_id = k.id AND a.hasta IS NULL AND a.rol = 'consejero')`],
    ['Ninguna sesión, nota ni asignación antes de abrir el caso',
      `SELECT (SELECT count(*) FROM consejeria.sesiones s JOIN consejeria.casos k ON k.id = s.caso_id WHERE s.fecha < k.abierto_en)
            + (SELECT count(*) FROM consejeria.notas n JOIN consejeria.casos k ON k.id = n.caso_id WHERE n.escrita_en < k.abierto_en)
            + (SELECT count(*) FROM consejeria.asignaciones a JOIN consejeria.casos k ON k.id = a.caso_id WHERE a.desde < k.abierto_en OR a.hasta < a.desde)`],
    ['Quien consulta era mayor de edad al abrir el caso',
      `SELECT count(*) FROM consejeria.casos k JOIN nucleo.personas p ON p.id = k.consultante_id
        WHERE k.source_system = $1 AND age(k.abierto_en::date, p.fecha_nacimiento) < interval '18 years'`],
    ['Nada de lo inventado queda en el futuro',
      `SELECT (SELECT count(*) FROM consejeria.casos WHERE abierto_en > now() OR cerrado_en > now())
            + (SELECT count(*) FROM consejeria.sesiones WHERE fecha > now() OR registrada_en > now())
            + (SELECT count(*) FROM consejeria.notas WHERE escrita_en > now())
            + (SELECT count(*) FROM consejeria.asignaciones WHERE desde > now() OR hasta > now())
            + (SELECT count(*) FROM crm.peticiones_oracion WHERE creado_en > now() OR respondida_en > now() OR cerrada_en > now())
            + (SELECT count(*) FROM crm.oraciones_hechas WHERE oro_en > now())
            + (SELECT count(*) FROM sistema.peticiones_internas WHERE creado_en > now() OR decidida_en > now())
            + (SELECT count(*) FROM sistema.requerimientos WHERE creado_en > now() OR resuelto_en > now())
            + (SELECT count(*) FROM plataforma.tareas WHERE creado_en > now() OR hecha_en > now())`],
    ['Ninguna oración antes de la petición ni después de cerrarla',
      `SELECT count(*) FROM crm.oraciones_hechas h JOIN crm.peticiones_oracion p ON p.id = h.peticion_id
        WHERE h.oro_en < p.creado_en OR h.oro_en > COALESCE(p.respondida_en, p.cerrada_en, now())`],
    ['Nadie ora por una petición que la base no le deja ver',
      `SELECT count(*) FROM crm.oraciones_hechas h JOIN crm.peticiones_oracion p ON p.id = h.peticion_id
        WHERE NOT (p.creado_por = h.persona_id
                   OR identidad.puede(h.persona_id, 'oracion', 'VER_CONFIDENCIAL_ORACION')
                   OR (NOT p.confidencial AND (p.compartir_con_intercesores OR identidad.puede(h.persona_id, 'oracion', 'crear'))))
         `],
    ['El equipo de intercesión tiene cuenta de acceso',
      `SELECT count(*) FROM identidad.asignaciones a
        WHERE a.rol IN ('LIDER_DE_ORACION', 'PERSONA_QUE_ORA') AND a.revocada_en IS NULL
          AND NOT EXISTS (SELECT 1 FROM identidad.cuentas c WHERE c.persona_id = a.persona_id)`],
  ];
  const fallas = [];
  for (const [regla, sql] of reglas) {
    const { rows: [r] } = await c.query(sql, sql.includes('$1') ? [SISTEMA] : []);
    const n = Number(Object.values(r)[0]);
    if (n > 0) fallas.push(`${regla}: ${n}`);
  }
  if (fallas.length) throw new Error(`No se cumple lo que la demostración promete:\n   · ${fallas.join('\n   · ')}`);
}

/** Una línea de resumen: «abierto 12 · en_proceso 40 ...». */
async function porEstado(c, sql) {
  const { rows } = await c.query(sql);
  return rows.map((r) => `${r.k} ${r.n}`).join(' · ');
}

/* ─────────────────────────────────────────────────────────────────────
   16 · EL POBLADOR
   ───────────────────────────────────────────────────────────────────── */

d.ejecutar({ archivo: ARCHIVO, tema: 'consejería, oración, peticiones internas, requerimientos y tareas' }, async (c, azar) => {
  if (await d.yaPoblado(c, `SELECT count(*) FROM consejeria.casos WHERE source_system = $1`, [SISTEMA],
    'cuidado pastoral (consejería, oración, peticiones internas, requerimientos y tareas)')) return undefined;

  await d.enTransaccion(c, async () => {
    const red = await cargarRed(c);
    if (!red.direccion.length) throw new Error('La base no tiene dirección general: ¿se corrió 00-red.js?');
    const como = crearComo(c);
    const usados = await d.usadosEnLaBase(c);
    await equipoDeIntercesion(c, azar.derivar('intercesion'), red, como);
    await consejeria(c, azar.derivar('consejeria'), red, como);
    await oracion(c, azar.derivar('oracion'), red, como, usados);
    const pet = await peticionesInternas(c, azar.derivar('peticiones'), red, como);
    const reqs = await requerimientos(c, azar.derivar('requerimientos'), red, como);
    await tareas(c, azar.derivar('tareas'), red, como, pet, reqs);
    await comprobar(c);
  });

  console.log('   consejería          ' + await porEstado(c,
    `SELECT estado::text AS k, count(*) AS n FROM consejeria.casos WHERE source_system = '${SISTEMA}' GROUP BY 1 ORDER BY 1`));
  console.log('   oración             ' + await porEstado(c,
    `SELECT estado AS k, count(*) AS n FROM crm.peticiones_oracion GROUP BY 1 ORDER BY 1`));
  console.log('   peticiones          ' + await porEstado(c,
    `SELECT estado AS k, count(*) AS n FROM sistema.peticiones_internas GROUP BY 1 ORDER BY 1`));
  console.log('   requerimientos      ' + await porEstado(c,
    `SELECT CASE WHEN estado NOT IN ('resuelto','cerrado','cancelado') AND vence_en < now() THEN estado || ' (vencido)' ELSE estado END AS k,
            count(*) AS n FROM sistema.requerimientos GROUP BY 1 ORDER BY 1`));
  console.log('   tareas              ' + await porEstado(c,
    `SELECT CASE WHEN estado IN ('pendiente','en_curso') AND vence_en < CURRENT_DATE THEN estado || ' (vencida)' ELSE estado END AS k,
            count(*) AS n FROM plataforma.tareas GROUP BY 1 ORDER BY 1`));
  const conteos = await d.contarFilas(c, ['consejeria.casos', 'consejeria.asignaciones', 'consejeria.sesiones', 'consejeria.notas',
    'crm.peticiones_oracion', 'crm.oraciones_hechas', 'sistema.peticiones_internas', 'sistema.requerimientos', 'plataforma.tareas']);
  const { rows: [eq] } = await c.query(
    `SELECT count(*)::int AS n FROM identidad.asignaciones WHERE rol IN ('LIDER_DE_ORACION', 'PERSONA_QUE_ORA') AND revocada_en IS NULL`);
  conteos['identidad.asignaciones (intercesión)'] = eq.n;
  return conteos;
});
