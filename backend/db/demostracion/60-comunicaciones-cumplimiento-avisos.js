'use strict';
/**
 * =====================================================================
 * 60-comunicaciones-cumplimiento-avisos.js · COMUNICACIONES, HABEAS DATA
 *                                            Y LA TRASTIENDA
 *
 * ⛔ SOLO DEMOSTRACIÓN. Los envíos, las peticiones de los titulares y los
 *    avisos son inventados, sobre las personas inventadas del núcleo
 *    (00-red.js). Nada de esto va a producción: la guarda de comun.js se
 *    niega a correr fuera de las bases de desarrollo.
 *
 * Lo que deja, por las reglas de la base y no alrededor de ellas:
 *   1. COMUNICACIONES (crm.comunicaciones) en las sedes con el módulo
 *      encendido. Las escribe uno de los pastores y las aprueba el otro
 *      (cuatro ojos: la base no deja que el autor se apruebe). Hay
 *      borradores, devueltas a borrador y corregidas, aprobadas que esperan
 *      salir, canceladas y ENVIADAS con crm.enviar_comunicacion, que encola
 *      solo a quien autorizó esa finalidad por correo y cuenta a los demás.
 *      Hoy el freno de envíos masivos se puso y se quitó con
 *      sistema.cambiar_freno, y un envío que salió en medio se detuvo.
 *   2. LA BANDEJA DE SALIDA (plataforma.notificaciones), movida por el
 *      trabajador como lo hace la API: plataforma.tomar_notificaciones y
 *      plataforma.marcar_notificacion. Casi todo salió; una caída del
 *      proveedor dejó avisos muertos tras cinco intentos; hubo rechazos
 *      definitivos; hoy el proveedor llegó a su cupo (429) y una parte
 *      espera reintento; lo último encolado aún no se ha tomado, y lo que
 *      estaba en cola para quien revocó hoy se descartó.
 *   3. HABEAS DATA (plataforma.peticiones_titular): consultas,
 *      actualizaciones (rectificación), revocatorias, reclamos y
 *      supresiones en todos sus estados, con el plazo que la base cuenta en
 *      días hábiles. Dos vencidas, prórrogas con motivo
 *      (plataforma.prorrogar_peticion), una respuesta fuera de plazo, una
 *      supresión ejecutada hoy con plataforma.ejecutar_supresion y una
 *      revocatoria de hoy con plataforma.revocar_consentimiento. Las
 *      revocatorias de fechas pasadas quedan como actos de consentimiento
 *      con su fecha y el radicado como evidencia (solo se agrega, como en
 *      el núcleo), y los envíos que salieron antes de registrarlas sí le
 *      llegaron al titular: la bandeja lo muestra.
 *   4. LA RECERTIFICACIÓN: el comité de hoy revisa la región Colombia y
 *      termina la región Bogotá (los cargos que nacieron después del comité
 *      de la mañana del núcleo) con identidad.recertificar. Quedan vencidos,
 *      a propósito, Cúcuta, Neiva, Santa Marta, Armenia y la región
 *      internacional menos Miami; y quien sirve con menores sin antecedentes
 *      vigentes no se firma.
 *
 * ⛔ Corre DESPUÉS de los demás pobladores: el trabajador toma lo que haya
 *    en cola, también los avisos que dejaron otros módulos, y les aplica la
 *    lógica del trabajador real (backend/api/src/notificaciones): canal
 *    distinto de correo o plantilla desconocida es un rechazo definitivo;
 *    lo demás sale. Lo que la base descarte al tomarlo, lo descarta ella.
 *
 * Correcciones por UPDATE, con autor y motivo (como en el núcleo), porque
 * las funciones sellan con now() lo que en la historia pasó otro día:
 *   · enviada_en de la comunicación y creada_en, tomada_en y enviada_en de
 *     sus avisos: la hora en que salió el envío;
 *   · proximo_intento de un aviso que falló de forma pasajera se pone en el
 *     pasado para que el trabajador lo vuelva a tomar (pasa el tiempo de la
 *     espera creciente) hasta su quinto intento;
 *   · prorrogada_en y prorroga_informada_en de una prórroga pasada.
 *   Lo que se hace hoy (el freno, la supresión, la revocatoria de hoy, el
 *   comité de accesos y el envío de Medellín) queda con la hora real.
 *
 * Corre en UNA transacción: o queda todo, o no queda nada.
 * Uso: PGDATABASE=cr_e2e_66 node backend/db/demostracion/60-comunicaciones-cumplimiento-avisos.js
 * =====================================================================
 */
const d = require('./comun');
const {
  FECHA_REFERENCIA: HOY, AYER, SISTEMA, SALIDAS_POR_OLA,
  sumarDias, diasEntre, diaSemana, momentoLocal, minFecha, maxFecha, hash32, insertarLote, fijarAutor,
} = d;

const ARCHIVO = 60;

/* ─────────────────────────────────────────────────────────────────────
   1 · FECHAS EN CASTELLANO
   ───────────────────────────────────────────────────────────────────── */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** '2026-05-10' → '10 de mayo' */
const diaMes = (f) => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
/** '2026-05-10' → 'domingo 10 de mayo' */
const fechaLarga = (f) => `${DIAS[diaSemana(f)]} ${diaMes(f)}`;
/** '2026-05-10' → '10 de mayo de 2026' */
const conAnio = (f) => `${diaMes(f)} de ${f.slice(0, 4)}`;
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** El primer domingo en o después de una fecha. */
const domingoDesde = (f) => sumarDias(f, (7 - diaSemana(f)) % 7);
/** Instante de una fecha y hora local, en milisegundos (para ordenar). */
const ms = (instante) => Date.parse(instante);
const lista = (xs) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

/* Desde cuándo congrega cada sede (la fundación de 00-red.js): para los
   aniversarios que caen dentro de la historia de la demostración. */
const FUNDADA = {
  'BOG-CHICO': '1998-03-01', 'BOG-NORTE': '2006-02-12', MED: '2008-08-10', CALI: '2009-05-24', BAQ: '2011-02-20',
  'BOG-SUR': '2012-04-15', BGA: '2013-06-09', ENV: '2013-09-15', 'BOG-OCC': '2015-07-19', 'BOG-SUBA': '2018-03-04',
  BELLO: '2018-04-22', PEI: '2014-03-16', MIA: '2015-04-12', PTY: '2014-05-18', CUC: '2017-05-14', MZL: '2017-08-13',
  ARM: '2019-02-10', NVA: '2020-02-16', SMR: '2018-07-29', ORL: '2019-06-16', HOU: '2021-03-21', SOACHA: '2019-10-06',
  CTG: '2016-01-17', IBG: '2016-10-09', VVC: '2015-11-22', MAD: '2016-11-20', BCN: '2017-09-24',
};

/** Horarios del domingo según el tamaño y el país de la sede. */
function horarios(s) {
  if (s.pais !== 'CO') return { lista: '11:00 a. m.', una: '11:00 a. m.', varias: false };
  if (s.tamano === 'grande') return { lista: '9:00 a. m. y 11:30 a. m.', una: '11:30 a. m.', varias: true };
  if (s.tamano === 'mediana') return { lista: '10:00 a. m.', una: '10:00 a. m.', varias: false };
  return { lista: '10:30 a. m.', una: '10:30 a. m.', varias: false };
}

/** La firma de una carta: la pareja pastoral, en tres formas que se alternan por sede. */
function firma(x) {
  const formas = [
    `Con cariño,\n${x.pp}, sus pastores`,
    `Sus pastores,\n${x.pp}`,
    `Un abrazo,\n${x.pp}`,
  ];
  return formas[hash32(x.s.codigo) % formas.length];
}

/* ─────────────────────────────────────────────────────────────────────
   2 · LO QUE ESCRIBEN LAS SEDES
   Cada ocasión: su finalidad (la base solo admite convocatoria, pastoral
   y emergencia), la fecha en que sale en cada sede (o null si no aplica),
   el asunto y el cuerpo. Los párrafos van separados por una línea en
   blanco: así los respeta la plantilla Comunicacion_general.
   `errata` es la versión con un error que alguien devolvió a borrador.
   ───────────────────────────────────────────────────────────────────── */
const OCASIONES = [
  {
    clave: 'navidad-2025', finalidad: 'convocatoria', fecha: () => '2025-12-15',
    asunto: (x) => `Navidad en ${x.s.nombre}: servicios del 24 y del 31 de diciembre`,
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

Diciembre nos recuerda que Dios se acercó a nosotros. Queremos celebrarlo juntos y con las puertas abiertas para quienes todavía no nos conocen.

Nochebuena: ${fechaLarga('2025-12-24')} a las 6:00 p. m. Es un servicio corto, pensado para venir en familia.
Fin de año: ${fechaLarga('2025-12-31')} a las 9:00 p. m., para dar gracias por el año que termina.

Invite a sus vecinos y a su familia. Si puede servir en la bienvenida o en el montaje, avísele a la secretaría de la sede.

${firma(x)}`,
  },
  {
    clave: 'ayuno-2026', finalidad: 'pastoral', fecha: () => '2026-01-09',
    asunto: () => 'Empezamos el año orando juntos: 21 días de oración',
    cuerpo: (x) => `Querida iglesia:

El ${fechaLarga('2026-01-13')} empezamos 21 días de oración. No se trata de hacer más cosas, sino de empezar el año cerca de Dios y cerca unos de otros.

Cada mañana su líder de grupo le compartirá una lectura corta. Los miércoles nos reunimos a orar en la sede a las 7:00 p. m.

Si está pasando por un momento difícil, cuéntenos cómo podemos orar por usted. No tiene que cargarlo solo.

${firma(x)}`,
  },
  {
    clave: 'grupos-nuevos', finalidad: 'convocatoria', fecha: () => '2026-02-10',
    asunto: () => '¿Ya tiene grupo? Esta semana abrimos grupos nuevos',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

Los grupos son la forma en que esta iglesia se conoce, se cuida y crece. Esta semana abrimos grupos nuevos en distintos barrios y horarios, para que nadie se quede sin uno.

El domingo habrá una mesa de grupos a la salida de cada servicio. También puede pedirle a la secretaría que le ayude a encontrar el más cercano a su casa.

${firma(x)}`,
  },
  {
    clave: 'aniversario', finalidad: 'convocatoria',
    fecha: (s) => {
      const a = aniversario(s);
      return a ? sumarDias(a.domingo, -5) : null;
    },
    asunto: (x) => `${x.s.nombre} cumple ${aniversario(x.s).anios} años`,
    cuerpo: (x) => {
      const a = aniversario(x.s);
      return `Querida iglesia:

El ${diaMes(a.fecha)} se cumplen ${a.anios} años desde que empezamos a reunirnos en ${x.s.ciudad}. Queremos celebrarlo con un servicio de gratitud el ${fechaLarga(a.domingo)} a las ${x.h.una}, y un almuerzo compartido al terminar.

Si usted estuvo desde los primeros años, nos encantaría escuchar su testimonio. Avísele a la secretaría de la sede.

${firma(x)}`;
    },
  },
  {
    clave: 'semana-santa', finalidad: 'convocatoria', fecha: () => '2026-03-26',
    asunto: (x) => `Semana Santa en ${x.s.nombre}: horarios de los servicios`,
    cuerpo: (x) => `Querida familia:

Esta Semana Santa queremos detenernos en lo que Jesús hizo por nosotros. Estos son los horarios:

Jueves Santo, 2 de abril: Santa Cena a las 7:00 p. m.
Viernes Santo, 3 de abril: servicio de las siete palabras a las 10:00 a. m.
Domingo de Resurrección, 5 de abril: ${x.h.varias ? 'servicios' : 'servicio'} a las ${x.h.lista}.

${x.s.pais === 'CO' ? 'El jueves y el viernes son festivos: es una buena ocasión para invitar a quien se queda en la ciudad.\n\n' : ''}${firma(x)}`,
    errata: { correcto: 'servicio de las siete palabras a las 10:00 a. m.', error: 'servicio de las siete palabras a las 9:00 a. m.',
      devuelta: 'Devuelta: el servicio del Viernes Santo quedó a las 10:00 a. m., no a las 9:00.',
      corrige: 'Corrige la hora del Viernes Santo.' },
  },
  {
    clave: 'pascua', finalidad: 'pastoral', fecha: () => '2026-04-07',
    asunto: () => 'Una palabra de sus pastores después de la Pascua',
    cuerpo: (x) => `Querida iglesia:

Gracias por cada servicio de esta Semana Santa. Vimos familias completas, personas que volvían después de mucho tiempo y a muchos que vinieron por primera vez.

La resurrección no es solo una fecha: es la razón por la que seguimos. Si en estos días tomó una decisión de fe, queremos acompañarle. Acérquese a la mesa de bienvenida el domingo o escríbale a la secretaría de la sede.

Con gratitud,
${x.pp}`,
  },
  {
    /* En España el Día de la Madre es el primer domingo de mayo; en Panamá,
       el 8 de diciembre (antes de su salida en vivo). */
    clave: 'madres', finalidad: 'convocatoria',
    fecha: (s) => s.pais === 'PA' ? null : s.pais === 'ES' ? '2026-04-28' : '2026-05-05',
    asunto: () => 'Este domingo celebramos a las mamás',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

El ${fechaLarga(x.s.pais === 'ES' ? '2026-05-03' : '2026-05-10')} queremos honrar a las madres, a las abuelas y a quienes han sido madres de corazón. Al terminar el servicio de las ${x.h.una} habrá un detalle para cada una.

Si su mamá no congrega con nosotros, este es un buen domingo para invitarla.

${firma(x)}`,
  },
  {
    clave: 'bautizos-junio', finalidad: 'convocatoria', fecha: () => '2026-05-26',
    asunto: (x) => `Bautizos en ${x.s.nombre}: domingo 28 de junio`,
    cuerpo: (x) => `Querida iglesia:

El ${fechaLarga('2026-06-28')} celebraremos bautizos en el servicio de las ${x.h.una}. Si ya decidió seguir a Jesús y quiere bautizarse, inscríbase con la secretaría de la sede antes del ${fechaLarga('2026-06-14')}.

Antes del bautizo hay una charla de preparación el ${fechaLarga('2026-06-20')} a las 4:00 p. m. Su familia puede acompañarle.

${firma(x)}`,
    errata: { correcto: `antes del ${fechaLarga('2026-06-14')}`, error: `antes del ${fechaLarga('2026-06-21')}`,
      devuelta: 'Devuelta: el 21 de junio ya no alcanza para la charla de preparación. El cierre es el 14.',
      corrige: 'Corrige la fecha de cierre de las inscripciones.' },
  },
  {
    clave: 'vacaciones-ninos', finalidad: 'convocatoria', fecha: () => '2026-06-09',
    asunto: () => 'Escuela de vacaciones para niños: del 23 al 26 de junio',
    cuerpo: (x) => `Querida familia:

Del ${fechaLarga('2026-06-23')} al ${fechaLarga('2026-06-26')}, de 9:00 a. m. a 12:00 m., tendremos escuela de vacaciones para niños de 3 a 11 años en la sede. Habrá historias bíblicas, juegos, manualidades y refrigerio.

Las inscripciones son con la secretaría. Cada niño se entrega y se recoge con su código de RocaKids: solo lo recoge un acudiente autorizado.

${firma(x)}`,
  },
  {
    /* El Día del Padre de España es el 19 de marzo (San José). */
    clave: 'padres', finalidad: 'convocatoria',
    fecha: (s) => s.pais === 'ES' ? '2026-03-16' : '2026-06-16',
    asunto: (x) => `Desayuno de hombres por el Día del Padre: ${fechaLarga(x.s.pais === 'ES' ? '2026-03-21' : '2026-06-20')}`,
    cuerpo: (x) => {
      const sab = x.s.pais === 'ES' ? '2026-03-21' : '2026-06-20';
      return `Hermanos de ${x.s.nombre}:

El ${fechaLarga(sab)} a las 8:00 a. m. nos reunimos a desayunar en la sede para celebrar a los padres y a los hombres de la iglesia. Vengan con sus hijos, con sus papás o con un amigo.

Para calcular la comida, confirme su asistencia con la secretaría antes del ${fechaLarga(sumarDias(sab, -2))}.

${firma(x)}`;
    },
  },
  {
    clave: 'retiro-tmt', finalidad: 'convocatoria', fecha: () => '2026-06-30',
    asunto: (x) => x.s.pais === 'CO' ? 'Retiro de jóvenes tMt: del 17 al 20 de julio' : 'Retiro de jóvenes tMt: del 17 al 19 de julio',
    cuerpo: (x) => `Querida familia:

Los jóvenes de tMt se van de retiro del ${fechaLarga('2026-07-17')} al ${x.s.pais === 'CO' ? 'lunes festivo 20 de julio' : fechaLarga('2026-07-19')}.

El retiro incluye transporte, alojamiento y comidas. Los menores de edad necesitan la autorización firmada por su acudiente, que se entrega en la sede hasta el ${fechaLarga('2026-07-12')}.

Si su familia no puede cubrir el valor completo, hable con nosotros: ningún joven se queda sin ir por dinero.

${firma(x)}`,
  },
  {
    clave: 'mitad-de-anio', finalidad: 'pastoral', fecha: () => '2026-07-07',
    asunto: () => 'Carta de sus pastores a mitad de año',
    cuerpo: (x) => `Querida iglesia:

Llegamos a la mitad del año y queremos darles las gracias: por cada domingo servido, por cada grupo que abrió su casa y por cada persona que recibió a alguien nuevo.

Sabemos que para muchos este año ha traído pruebas: trabajos que se perdieron, enfermedades, despedidas. No están solos. Si necesita que alguien ore con usted o le visite, avísele a la secretaría de la sede y le buscamos.

Seguimos adelante, juntos.
${x.pp}`,
  },
  {
    clave: 'formacion-agosto', finalidad: 'convocatoria', fecha: () => '2026-07-28',
    asunto: () => 'Inscripciones abiertas: nuevo ciclo de formación desde el 10 de agosto',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

El ${fechaLarga('2026-08-10')} empieza un nuevo ciclo de la ruta de formación. Hay cursos para quienes llegaron hace poco, para quienes quieren servir y para líderes de grupo.

Las clases son entre semana en la noche, con opción los sábados en la mañana. Inscríbase en la mesa de formación el domingo o con la secretaría de la sede.

${firma(x)}`,
  },
  {
    clave: 'semana-oracion', finalidad: 'convocatoria', fecha: () => '2026-08-12',
    asunto: () => 'Semana de oración: del 18 al 21 de agosto',
    cuerpo: (x) => `Querida iglesia de ${x.s.ciudad}:

Del ${fechaLarga('2026-08-18')} al ${fechaLarga('2026-08-21')}, a las 6:30 p. m., tendremos una semana de oración en la sede. Cada noche oraremos por un tema: las familias, la ciudad, los enfermos y los jóvenes.

Venga cuando pueda, aunque sea una sola noche.

${firma(x)}`,
  },
  {
    clave: 'conferencia', finalidad: 'convocatoria', fecha: () => '2026-09-02',
    asunto: () => 'Conferencia Roca Firme 2026: del 16 al 18 de octubre',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

Del ${fechaLarga('2026-10-16')} al ${fechaLarga('2026-10-18')} nos reunimos como red en la conferencia Roca Firme 2026, en la sede de Bogotá Chicó. Tres días de enseñanza, adoración y encuentro con las iglesias de Colombia y del exterior.

La inscripción temprana va hasta el ${fechaLarga('2026-09-30')}. ${x.s.ciudad === 'Bogotá'
    ? 'Si puede servir en la bienvenida de las iglesias que llegan de otras ciudades, avísele a la secretaría.'
    : 'La sede coordina el viaje en grupo: pregunte en la secretaría por el transporte y el alojamiento.'}

${firma(x)}`,
    errata: { correcto: `hasta el ${fechaLarga('2026-09-30')}`, error: `hasta el ${fechaLarga('2026-09-15')}`,
      devuelta: 'Devuelta: la inscripción temprana se amplió hasta el 30 de septiembre.',
      corrige: 'Corrige la fecha de la inscripción temprana.' },
  },
  {
    clave: 'amor-amistad', finalidad: 'convocatoria', fecha: (s) => s.pais === 'CO' ? '2026-09-08' : null,
    asunto: () => 'Noche de parejas por Amor y Amistad: sábado 19 de septiembre',
    cuerpo: (x) => `Querida iglesia:

El ${fechaLarga('2026-09-19')} a las 7:00 p. m. tendremos una noche para parejas en la sede: cena, música y un tiempo para hablar de lo que cuida un matrimonio.

Los cupos son limitados. Inscríbanse con la secretaría antes del ${fechaLarga('2026-09-16')}. Mientras tanto, el equipo de RocaKids cuidará a los niños.

${firma(x)}`,
  },
];
const OCASION = Object.fromEntries(OCASIONES.map(o => [o.clave, o]));

/** El aniversario de una sede que cae entre su salida en vivo y ayer (o null). */
function aniversario(s) {
  const f0 = FUNDADA[s.codigo];
  if (!f0) return null;
  for (const anio of ['2025', '2026']) {
    const fecha = `${anio}${f0.slice(4)}`;
    const domingo = domingoDesde(fecha);
    const envio = sumarDias(domingo, -5);
    if (envio >= SALIDAS_POR_OLA[s.ola] && envio >= '2025-12-01' && domingo <= AYER) {
      return { fecha, domingo, anios: Number(anio) - Number(f0.slice(0, 4)) };
    }
  }
  return null;
}

/* Envíos que no son de temporada: emergencias, duelo y los de hoy. */
const ESPECIALES = {
  'emergencia-arroyos': {
    finalidad: 'emergencia',
    asunto: () => 'Hoy no hay servicio en la noche: alerta por arroyos',
    cuerpo: (x) => `Querida iglesia de ${x.s.ciudad}:

Por el aguacero de esta tarde, las autoridades declararon alerta por arroyos en varios sectores de la ciudad. Por su seguridad, el servicio de oración de esta noche se suspende.

No cruce calles inundadas ni intente pasar un arroyo en carro, en moto o a pie. Si alguien de su familia está en riesgo, llame a la línea de emergencias 123.

Nos vemos el domingo, si Dios lo permite.
${x.pp}`,
  },
  'emergencia-tormenta': {
    finalidad: 'emergencia',
    asunto: () => 'Tormenta tropical: el servicio del domingo será solo en línea',
    cuerpo: (x) => `Querida iglesia de ${x.s.ciudad}:

Las autoridades mantienen el aviso de tormenta tropical para el sur de la Florida hasta el domingo. Por su seguridad, el servicio del ${fechaLarga('2026-08-30')} será solo en línea, a las 11:00 a. m.

Siga las indicaciones de las autoridades del condado y tenga a mano agua, linterna y sus medicamentos. Si necesita ayuda, avísenos: el equipo de la sede está pendiente.

${x.pp}`,
  },
  duelo: {
    finalidad: 'pastoral',
    asunto: () => 'Acompañemos a las familias que están de duelo',
    cuerpo: (x) => `Querida iglesia de ${x.s.ciudad}:

En estas semanas despedimos a dos hermanos muy queridos. Sus familias necesitan compañía más que palabras: una visita, una comida, una llamada.

Desde este jueves, a las 7:00 p. m., abrimos en la sede un grupo de consolación para quienes están atravesando un duelo. Es un espacio sencillo, para hablar y orar juntos.

Con cariño,
${x.pp}`,
  },
  'hoy-semana': {
    finalidad: 'convocatoria',
    asunto: (x) => `Esta semana en ${x.s.nombre}: vigilia, bautizos y conferencia`,
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

Estas son las fechas de la semana:

${mayuscula(fechaLarga('2026-09-23'))}, 7:00 p. m.: vigilia de oración en la sede.
${mayuscula(fechaLarga('2026-09-26'))}, 4:00 p. m.: charla para quienes se bautizan el 25 de octubre.
Hasta el ${fechaLarga('2026-09-30')}: inscripción temprana a la conferencia Roca Firme 2026.

Gracias por servir y por abrir sus casas a los grupos. Nos vemos el domingo.

${firma(x)}`,
  },
  'hoy-conferencia': {
    finalidad: 'convocatoria',
    asunto: () => 'Últimos días de inscripción temprana a Roca Firme 2026',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

La inscripción temprana a la conferencia Roca Firme 2026 cierra el ${fechaLarga('2026-09-30')}. Ya van ${x.inscritos} personas de ${x.s.ciudad} inscritas, y el bus sale de la sede el ${fechaLarga('2026-10-15')} a las 8:00 p. m.

Si quiere ir y el valor es un problema, hable con nosotros antes del cierre: hay becas para quien las necesite.

${firma(x)}`,
  },
  'hoy-vigilia': {
    finalidad: 'convocatoria',
    asunto: () => 'Vigilia de oración este miércoles 23 de septiembre',
    cuerpo: (x) => `Querida iglesia de ${x.s.ciudad}:

Este ${fechaLarga('2026-09-23')}, de 7:00 p. m. a 10:00 p. m., tendremos vigilia de oración en la sede. Oraremos por las familias, por los enfermos y por la conferencia de octubre.

Traiga su Biblia y, si puede, algo para compartir en el café de las 8:30 p. m.

${firma(x)}`,
  },
  grupo: {
    finalidad: 'convocatoria',
    asunto: (x) => `${x.grupo.nombre}: esta semana nos reunimos en la sede`,
    cuerpo: (x) => `Hola a todos:

Esta semana el grupo no se reúne en la casa de siempre: nos vemos en la sede, a la hora de costumbre. Aprovechamos para orar por los que están enfermos y para organizar la visita del mes.

Si no puede venir, avísele a su líder.

${firma(x)}`,
  },
  servidores: {
    finalidad: 'convocatoria',
    asunto: () => 'Reunión general de servidores: sábado 26 de septiembre',
    cuerpo: (x) => `Querido equipo de servidores de ${x.s.nombre}:

El ${fechaLarga('2026-09-26')} a las 9:00 a. m. tenemos reunión general de servidores en la sede. Vamos a organizar la conferencia de octubre y a repasar el protocolo de protección de menores.

Es importante que vengan todos los que sirven, en cualquier área.

${firma(x)}`,
  },
};

/* Lo que está en curso hoy en cada sede: borradores, devueltas,
   aprobadas que esperan salir y canceladas. */
const EN_CURSO = {
  'navidad-2026': {
    estado: 'borrador', finalidad: 'convocatoria',
    asunto: () => 'Navidad 2026: necesitamos manos para el montaje',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

Ya empezamos a preparar la Navidad: el servicio de Nochebuena, la cena para las familias del barrio y la decoración de la sede.

Necesitamos personas para el montaje, la cocina, la bienvenida y el cuidado de los niños. Si puede servir, anótese con la secretaría antes del ${fechaLarga('2026-10-31')}.

${firma(x)}`,
  },
  'palabra-trabajo': {
    estado: 'borrador', finalidad: 'pastoral',
    asunto: () => 'Si está buscando trabajo, no está solo',
    cuerpo: (x) => `Querida iglesia:

Sabemos que varias familias de ${x.s.nombre} están pasando por un tiempo sin empleo. Queremos acompañarlas de forma concreta.

Los sábados de octubre, a las 9:00 a. m., tendremos en la sede un taller para preparar la hoja de vida y la entrevista, con hermanos que trabajan en selección de personal. Y cada miércoles oraremos por quienes están buscando trabajo.

${firma(x)}`,
  },
  'conferencia-ultimos': {
    estado: 'aprobada', finalidad: 'convocatoria',
    asunto: () => 'Última semana de inscripción temprana a Roca Firme 2026',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

Esta es la última semana de inscripción temprana a la conferencia Roca Firme 2026, del 16 al 18 de octubre. Después del ${fechaLarga('2026-09-30')} el valor sube.

Si quiere ir y el valor es un problema, hable con nosotros: hay becas para quien las necesite.

${firma(x)}`,
  },
  'retiro-matrimonios': {
    estado: 'aprobada', finalidad: 'convocatoria',
    asunto: () => 'Retiro de matrimonios: 7 y 8 de noviembre',
    cuerpo: (x) => `Querida iglesia:

El ${fechaLarga('2026-11-07')} y el ${fechaLarga('2026-11-08')} tendremos retiro de matrimonios, fuera de la ciudad. Dos días para descansar, hablar y volver a empezar.

El valor incluye transporte, alojamiento y comidas. Los cupos son limitados: inscríbanse con la secretaría antes del ${fechaLarga('2026-10-23')}.

${firma(x)}`,
  },
  'bautizos-octubre': {
    /* Se aprobó con el 18 de octubre, que es el último día de la conferencia:
       quien la aprobó la devolvió, y el autor la corrigió. Espera otra aprobación. */
    estado: 'devuelta', finalidad: 'convocatoria',
    asunto: (x, dom = '2026-10-25') => `Bautizos en ${x.s.nombre}: ${fechaLarga(dom)}`,
    cuerpo: (x, dom = '2026-10-25') => `Querida iglesia:

El ${fechaLarga(dom)} celebraremos bautizos en el servicio de las ${x.h.una}. Si ya decidió seguir a Jesús y quiere bautizarse, inscríbase con la secretaría de la sede antes del ${fechaLarga(sumarDias(dom, -14))}.

La charla de preparación es el ${fechaLarga(sumarDias(dom, -8))} a las 4:00 p. m. Su familia puede acompañarle.

${firma(x)}`,
    primera: '2026-10-18',
    devuelta: 'Devuelta: el 18 de octubre es el último día de la conferencia en Bogotá. Los bautizos quedaron para el 25.',
    corrige: 'Corrige la fecha de los bautizos: domingo 25 de octubre.',
  },
  picnic: {
    /* Se aprobó y después se canceló por el pronóstico. */
    estado: 'cancelada', desde: 'aprobada', finalidad: 'convocatoria', fechaBase: '2026-08-18',
    asunto: () => 'Picnic familiar: domingo 23 de agosto',
    cuerpo: (x) => `Querida familia de ${x.s.nombre}:

El ${fechaLarga('2026-08-23')}, después del servicio, nos vamos de picnic al parque. Traiga algo para compartir, una manta y ganas de jugar: habrá juegos para niños y para grandes.

${firma(x)}`,
    motivo: 'Se cancela: el pronóstico anuncia lluvias fuertes para el domingo 23 de agosto. El picnic se aplaza.',
  },
  'duplicado-amor': {
    /* Se escribió dos veces: la copia se canceló antes de aprobarla. */
    estado: 'cancelada', desde: 'borrador', finalidad: 'convocatoria', fechaBase: '2026-09-07',
    asunto: (x) => OCASION['amor-amistad'].asunto(x),
    cuerpo: (x) => OCASION['amor-amistad'].cuerpo(x),
    motivo: 'Estaba escrita dos veces: queda la otra, que ya se aprobó.',
  },
  'aniversario-proximo': {
    estado: 'segun-sede', finalidad: 'convocatoria',
    asunto: (x) => `${x.s.nombre} cumple ${x.aniv.anios} años`,
    cuerpo: (x) => `Querida iglesia:

El ${diaMes(x.aniv.fecha)} se cumplen ${x.aniv.anios} años desde que empezamos a reunirnos en ${x.s.ciudad}. Queremos celebrarlo con un servicio de gratitud el ${fechaLarga(x.aniv.domingo)} a las ${x.h.una}, y un almuerzo compartido al terminar.

Si usted estuvo desde los primeros años, nos encantaría escuchar su testimonio. Avísele a la secretaría de la sede.

${firma(x)}`,
  },
};

/* Qué tiene en curso cada sede (las demás, nada). */
const EN_CURSO_POR_SEDE = {
  'BOG-CHICO': ['navidad-2026', 'conferencia-ultimos', 'palabra-trabajo'],
  'BOG-NORTE': ['retiro-matrimonios', 'duplicado-amor'],
  MED: ['bautizos-octubre', 'conferencia-ultimos'],
  CALI: ['navidad-2026', 'retiro-matrimonios'],
  'BOG-SUR': ['bautizos-octubre', 'picnic'],
  BAQ: ['conferencia-ultimos', 'navidad-2026', 'duplicado-amor'],
  BGA: ['bautizos-octubre'],
  'BOG-OCC': ['picnic'],
  MIA: ['retiro-matrimonios'],
  'BOG-SUBA': ['palabra-trabajo'],
  PTY: ['conferencia-ultimos'],
  CTG: ['navidad-2026'],
  ENV: ['conferencia-ultimos'],
  PEI: ['navidad-2026'],
  VVC: ['retiro-matrimonios'],
  BCN: ['aniversario-proximo'],
  CUC: ['picnic'],
  IBG: ['aniversario-proximo'],
  SOACHA: ['palabra-trabajo'],
};

/* Ocasiones que una sede SIEMPRE envía (las historias de Habeas Data y de
   la bandeja se apoyan en ellas), con su fecha y hora exactas cuando
   importan. */
const FORZADAS = {
  'BOG-SUR': { conferencia: ['2026-09-02', '18:30'], 'amor-amistad': ['2026-09-08', '19:30'] },
  CTG: { 'semana-oracion': ['2026-08-12', '18:00'] },
  BAQ: { conferencia: ['2026-09-03', '18:40'], 'amor-amistad': ['2026-09-08', '19:00'] },
  'BOG-CHICO': { padres: ['2026-06-16', '17:15'] },
  CALI: { 'formacion-agosto': ['2026-07-28', '11:20'] },
  'BOG-NORTE': { 'amor-amistad': ['2026-09-08', '18:10'] },
};

/* Envíos pasados que tuvieron un tropiezo en la bandeja de salida. */
const TROPIEZOS = {
  'BAQ:conferencia': { caida: 14 },     // el proveedor se cayó a media tanda: mueren tras cinco intentos
  'BOG-CHICO:padres': { lentos: 3 },    // tres correos sin respuesta a tiempo, cinco veces
  'CALI:formacion-agosto': { definitivos: 1 },
};

/* ─────────────────────────────────────────────────────────────────────
   3 · LO QUE PIDEN LOS TITULARES (Ley 1581 de 2012 y, en España, el RGPD)
   Cada petición: tipo, sede, canal, cuándo llegó, a quién se refiere y su
   historia. Los pasos se cuentan en DÍAS HÁBILES desde que llegó (sin
   sábados, domingos ni festivos de sistema.festivos, igual que la base):
     tramite: n      pasa a «en trámite»
     prorroga: n     plataforma.prorrogar_peticion, con motivo
     responde: n     «atendida», con respuesta y evidencia
     rechaza: n      «rechazada», diciendo por qué
     revoca: {...}   la revocatoria se registra como acto de consentimiento
     hoy: '...'      se hace hoy con la función de la base
   `dinamica` quiere decir que la respuesta se escribe después de los
   envíos, porque cuenta los correos que de verdad le llegaron.
   ───────────────────────────────────────────────────────────────────── */
const lo = (t) => t.genero === 'F' ? 'la' : 'lo';
const trato = (t) => `${t.genero === 'F' ? 'Señora' : 'Señor'} ${t.primer_nombre}`;

const PETICIONES = [
  { n: 1, tipo: 'consulta', sede: 'BOG-CHICO', canal: 'web', recibida: '2025-10-20', hora: '09:12',
    titular: { correo: true, consiente: [['email', 'convocatoria'], ['whatsapp', 'convocatoria'], ['whatsapp', 'pastoral']], alguno: true },
    detalle: () => 'Buenos días. Quisiera saber qué datos personales míos tiene la iglesia, de dónde salieron y para qué los usan. Congrego en Bogotá Chicó hace varios años y nunca me lo habían explicado.',
    pasos: [{ responde: 7, respuesta: (t) => `${trato(t)}: en el sistema de la iglesia están ${t.datos}. Se recogieron en el formulario de bienvenida y en la actualización de datos de 2023. Se usan para acompañarle y para invitarle a las actividades, solo por los canales que usted autorizó: ${t.autorizaciones}. Puede revocar cualquiera de esas autorizaciones cuando quiera. La política de tratamiento vigente es la versión 1.0 y está disponible en la recepción de la sede.` }] },
  { n: 2, tipo: 'actualizacion', sede: 'MED', canal: 'correo', recibida: '2025-11-24', hora: '10:40',
    titular: { correo: true },
    detalle: (t) => `Cambié de correo electrónico y el que tienen registrado ya no lo uso. Les pido actualizarlo a ${t.email}. Gracias.`,
    pasos: [{ responde: 6, respuesta: (t) => `${trato(t)}: actualizamos su correo. Desde hoy las comunicaciones le llegan a ${t.email}; el anterior quedó retirado de su ficha.` }] },
  { n: 3, tipo: 'revocacion', sede: 'CALI', canal: 'presencial', recibida: '2025-12-09', hora: '11:30',
    titular: { consiente: [['whatsapp', 'convocatoria']] },
    detalle: () => 'Me acerqué a la recepción para pedir que no me envíen más mensajes de WhatsApp con invitaciones a eventos. Los mensajes de acompañamiento de mi grupo sí los quiero seguir recibiendo.',
    pasos: [{ revoca: { canales: ['whatsapp'], finalidades: ['convocatoria'] }, en: 0 },
      { responde: 2, respuesta: (t) => `${trato(t)}: registramos su revocación el ${diaMes(t.revocada)}. Desde ese día no recibe invitaciones a eventos por WhatsApp. Los mensajes de acompañamiento de su grupo siguen llegando, porque esa autorización usted no la retiró.` }] },
  { n: 4, tipo: 'consulta', sede: 'PTY', canal: 'correo', recibida: '2026-03-17', hora: '14:10',
    titular: { correo: true },
    detalle: () => '¿La información que di en la sede de Panamá la pueden ver en Bogotá? Quisiera saber quién tiene acceso a mis datos.',
    pasos: [{ responde: 7, respuesta: (t) => `${trato(t)}: sus datos los ven sus pastores en Panamá y las personas de la sede que los necesitan para su servicio, como la secretaría y la bienvenida. La central en Bogotá accede solo para administrar la red, y cada lectura queda registrada con nombre y fecha. No se entregan a terceros.` }] },
  { n: 5, tipo: 'supresion', sede: 'BOG-SUR', canal: 'web', recibida: '2026-02-09', hora: '08:50',
    titular: { externo: true },
    detalle: () => 'En 2024 asistí a un evento de su iglesia en Bogotá Sur y llené un formulario con mis datos. No soy miembro y pido que los eliminen.',
    pasos: [{ responde: 7, respuesta: (t) => `${trato(t)}: buscamos su nombre, su documento, su correo y su teléfono en todas las sedes de la red y no encontramos ningún registro suyo, ni en el sistema ni en los formularios de 2024 que se migraron. No hay datos que suprimir. Si nos escribió con otro correo o con otro número, díganos cuál y lo verificamos de nuevo.` }] },
  { n: 6, tipo: 'revocacion', sede: 'ENV', canal: 'correo', recibida: '2026-03-06', hora: '19:05',
    titular: { saliente: 'ENV' },
    detalle: (t) => `Me fui a vivir a ${t.ciudadNueva} y ya no congrego con ustedes. Les pido que no me escriban más por ningún medio.`,
    pasos: [{ revoca: { canales: d.CANALES, finalidades: ['pastoral', 'convocatoria'] }, en: 1 },
      { responde: 2, respuesta: (t) => `${trato(t)}: registramos su revocación el ${diaMes(t.revocada)}: desde ese día no recibe mensajes de la iglesia por ningún medio. Sus datos se conservan porque no pidió suprimirlos; si quiere que los borremos, puede pedirlo con una solicitud de supresión.` }] },
  { n: 7, tipo: 'actualizacion', sede: 'BAQ', canal: 'whatsapp', recibida: '2026-03-16', hora: '17:45',
    titular: { telefono: true },
    detalle: (t) => `Cambié de número de celular. El nuevo es ${t.telefono}; el anterior ya no lo tengo.`,
    pasos: [{ responde: 4, respuesta: (t) => `${trato(t)}: actualizamos su número de celular a ${t.telefono}. El anterior quedó retirado de su ficha.` }] },
  { n: 8, tipo: 'consulta', sede: 'MED', canal: 'presencial', recibida: '2026-04-07', hora: '12:20',
    titular: {},
    detalle: () => 'Estoy en consejería con la iglesia y quiero saber quién puede leer lo que hablo con mi consejero.',
    pasos: [{ responde: 7, respuesta: (t) => `${trato(t)}: lo que se habla en consejería solo lo leen su consejero y los pastores de su sede. Cada lectura queda registrada con nombre y fecha, y nadie más tiene acceso, ni siquiera la secretaría. Si en algún momento quiere cambiar de consejero, puede pedirlo.` }] },
  { n: 9, tipo: 'reclamo', sede: 'BOG-NORTE', canal: 'correo', recibida: '2026-04-20', hora: '21:10',
    titular: { correo: true, telefono: true },
    detalle: () => 'Me agregaron a un grupo de WhatsApp de la sede sin preguntarme. Nunca autoricé que compartieran mi número con otras personas.',
    pasos: [{ responde: 11, respuesta: (t) => `${trato(t)}: tiene razón. El grupo lo creó un líder desde su teléfono personal y ${lo(t)} agregó sin su autorización. ${mayuscula(lo(t))} retiramos del grupo el ${diaMes(sumarDias(t.recibida, 2))} y les recordamos a los líderes de la sede que solo se agrega a quien lo autoriza. Su número no se compartió por ningún otro medio.` }] },
  { n: 10, tipo: 'actualizacion', sede: 'CALI', canal: 'web', recibida: '2026-05-04', hora: '10:05',
    titular: { apellidoConTilde: true },
    detalle: (t) => `Mi segundo apellido aparece mal escrito: es ${t.segundo_apellido}, con tilde, y en la ficha salió sin ella.`,
    pasos: [{ responde: 5, respuesta: (t) => `${trato(t)}: corregimos su segundo apellido. Ahora figura como ${t.segundo_apellido} en su ficha, y así saldrá en los certificados que expida la sede.` }] },
  { n: 11, tipo: 'consulta', sede: 'MAD', canal: 'correo', recibida: '2026-05-11', hora: '18:30',
    titular: { correo: true },
    detalle: () => 'Ejerzo mi derecho de acceso (artículo 15 del RGPD). Quisiera saber qué datos míos tratan, con qué finalidad y durante cuánto tiempo los conservan.',
    pasos: [{ responde: 6, respuesta: (t) => `${trato(t)}: tratamos ${t.datos}, para acompañarle y para convocarle a las actividades que usted autorizó. Los datos se conservan mientras forme parte de la iglesia; si deja de congregar, puede pedir que los suprimamos. La política de tratamiento (versión 2.0) incluye las condiciones del RGPD para las sedes de España.` }] },
  { n: 12, tipo: 'supresion', sede: 'BOG-NORTE', canal: 'presencial', recibida: '2026-06-02', hora: '10:00',
    titular: { saliente: 'BOG-NORTE', presentaTercero: true },
    detalle: (t) => `Soy la mamá de ${t.nombreCompleto}. ${t.genero === 'F' ? 'Ella' : 'Él'} se fue a vivir a ${t.ciudadNueva} y me pidió que viniera a pedir que borren sus datos.`,
    pasos: [{ rechaza: 6, respuesta: (t) => `La supresión la tiene que pedir ${t.primer_nombre} directamente, porque es mayor de edad, o una persona con un poder firmado por ${t.genero === 'F' ? 'ella' : 'él'}. Le explicamos a su mamá que puede escribirnos desde ${t.ciudadNueva} por este mismo canal y ${lo(t)} atendemos sin que tenga que venir. Mientras tanto no se le envía nada: dejó de congregar en ${MESES[Number(t.salio.slice(5, 7)) - 1]}.` }] },
  { n: 13, tipo: 'revocacion', sede: 'BGA', canal: 'presencial', recibida: '2026-06-16', hora: '11:00',
    titular: { consiente: [['llamada', 'pastoral'], ['llamada', 'convocatoria']], alguno: true },
    detalle: () => 'No quiero que me llamen de la iglesia. Los mensajes por WhatsApp sí los quiero seguir recibiendo.',
    pasos: [{ revoca: { canales: ['llamada'], finalidades: ['pastoral', 'convocatoria'] }, en: 0 },
      { responde: 3, respuesta: (t) => `${trato(t)}: registramos el ${diaMes(t.revocada)} que no quiere recibir llamadas de la iglesia. Los mensajes por WhatsApp siguen activos, como lo pidió.` }] },
  { n: 14, tipo: 'reclamo', sede: 'SOACHA', canal: 'telefono', recibida: '2026-06-23', hora: '15:30',
    titular: { padreDeNino: true },
    detalle: (t) => `En la página de la sede publicaron fotos de la escuela de vacaciones y en dos sale mi ${t.hijo}. Yo no firmé ninguna autorización de fotos.`,
    pasos: [{ prorroga: 10, informada: true, motivo: 'Se están revisando con el equipo de Comunicaciones todas las publicaciones de junio de la sede y la autorización de imagen de cada niño que aparece. Hace falta más tiempo para verificarlas una por una.' },
      { responde: 19, respuesta: (t) => `${trato(t)}: retiramos las dos publicaciones el ${diaMes(sumarDias(t.recibida, 1))}, el día después de su llamada. Revisamos las autorizaciones: la de su ${t.hijo} no estaba firmada y la sede publicó sin verificarla. Desde julio, ninguna foto de niños se publica sin revisar antes su autorización de imagen en el sistema.` }] },
  { n: 15, tipo: 'consulta', sede: 'BOG-OCC', canal: 'web', recibida: '2026-07-13', hora: '20:15',
    titular: { correo: true, consiente: [['email', 'convocatoria'], ['email', 'pastoral']], alguno: true, antesDe: '2025-06-01' },
    detalle: () => '¿Con qué autorización me escriben por correo? No recuerdo haberla dado.',
    pasos: [{ responde: 7, respuesta: (t) => `${trato(t)}: usted autorizó que le escribiéramos por correo el ${conAnio(t.primeraCorreo.fecha)} (${t.primeraCorreo.como}). Si ya no quiere recibir correos, puede revocar esa autorización cuando quiera y la aplicamos el mismo día.` }] },
  { n: 16, tipo: 'actualizacion', sede: 'ENV', canal: 'presencial', recibida: '2026-07-27', hora: '17:00',
    titular: { direccion: true },
    detalle: (t) => `Me cambié de casa. La dirección nueva es ${t.direccion}.`,
    pasos: [{ responde: 4, respuesta: (t) => `${trato(t)}: actualizamos su dirección a ${t.direccion}. Con ella le podemos sugerir el grupo más cercano; si quiere, la secretaría le da los datos.` }] },
  { n: 17, tipo: 'reclamo', sede: 'BOG-SUR', canal: 'correo', recibida: '2026-09-10', hora: '08:30',
    titular: { correo: true, consiente: [['email', 'convocatoria']], antesDe: '2026-08-03' },
    detalle: () => `El 3 de agosto le pedí a la líder de mi grupo que no me enviaran más correos con invitaciones, y me siguen llegando. El último me llegó el ${fechaLarga('2026-09-08')}.`,
    pasos: [{ revoca: { canales: ['email'], finalidades: ['convocatoria'] }, en: 0 },
      { responde: 4, dinamica: true, respuesta: (t) => `${trato(t)}: tiene razón y le pedimos disculpas. Su solicitud del 3 de agosto se hizo de palabra y no quedó registrada en el sistema; por eso le ${t.recibidos.length === 1 ? 'llegó un correo más' : `llegaron ${t.recibidos.length} correos más`}: ${lista(t.recibidos)}. Registramos su revocación el ${diaMes(t.revocada)} y desde ese día no le llega ninguna invitación por correo. Con los líderes de la sede repasamos que una solicitud así se radica el mismo día.` }] },
  { n: 18, tipo: 'consulta', sede: 'MIA', canal: 'correo', recibida: '2026-08-18', hora: '09:00',
    titular: { saliente: 'MIA' },
    detalle: (t) => `Me fui a vivir a ${t.ciudadNueva} y ya no congrego en Miami. Quiero saber qué datos míos siguen guardados y si los van a borrar.`,
    pasos: [{ prorroga: 8, informada: true, motivo: 'La consulta pide todo lo que se guarda y la historia de su membresía; se está reuniendo con la sede de Miami para responder completo.' },
      { responde: 13, respuesta: (t) => `${trato(t)}: guardamos su nombre, sus datos de contacto, su fecha de nacimiento y la historia de su membresía en Miami, que se cerró el ${conAnio(t.salio)}. Desde entonces no le enviamos comunicaciones. Los datos no se borran solos: si quiere que los suprimamos, basta con que nos lo pida y lo hacemos dentro del plazo de ley.` }] },
  { n: 19, tipo: 'consulta', sede: 'BOG-SUBA', canal: 'telefono', recibida: '2026-08-25', hora: '11:40',
    titular: { externo: true },
    detalle: () => 'Necesito la dirección y el teléfono de mi hermana, que congrega en la sede de Suba. Perdimos el contacto y quiero buscarla.',
    pasos: [{ rechaza: 2, respuesta: (t) => `${trato(t)}: no podemos entregar los datos de otra persona: la consulta de Habeas Data es sobre los datos propios. Si quiere, le hacemos llegar a ella su mensaje y su número, y ella decide si le escribe.` }] },
  { n: 20, tipo: 'revocacion', sede: 'CTG', canal: 'correo', recibida: '2026-07-30', hora: '19:20',
    titular: { correo: true, consiente: [['email', 'convocatoria']], antesDe: '2026-07-30' },
    detalle: () => 'No quiero recibir más correos de la iglesia. Por favor retírenme de la lista.',
    pasos: [{ revoca: { canales: ['email'], finalidades: ['convocatoria', 'pastoral'] }, en: 19 },
      { responde: 19, dinamica: true, respuesta: (t) => `${trato(t)}: registramos hoy, ${diaMes(t.revocada)}, su revocación. Lamentamos la demora: su solicitud llegó el ${diaMes(t.recibida)} y debimos atenderla dentro de los quince días hábiles que da la ley.${t.recibidos.length ? ` Entre esa fecha y hoy le ${t.recibidos.length === 1 ? 'llegó un correo más' : `llegaron ${t.recibidos.length} correos más`}: ${lista(t.recibidos)}.` : ''} Desde hoy no recibe correos de la iglesia.` }] },
  { n: 21, tipo: 'actualizacion', sede: 'BOG-SUBA', canal: 'web', recibida: '2026-09-01', hora: '07:50',
    titular: { telefono: true },
    detalle: (t) => `Por favor actualicen mi celular: ahora es ${t.telefono}.`,
    pasos: [{ responde: 5, respuesta: (t) => `${trato(t)}: actualizamos su número de celular a ${t.telefono}.` }] },
  /* ── Abiertas ── */
  { n: 22, tipo: 'consulta', sede: 'BOG-NORTE', canal: 'web', recibida: '2026-09-16', hora: '22:05',
    titular: { correo: true },
    detalle: () => 'Quiero saber si mis datos se comparten con otras iglesias o con empresas.', pasos: [] },
  { n: 23, tipo: 'consulta', sede: 'VVC', canal: 'telefono', recibida: '2026-08-24', hora: '16:30',
    titular: { telefono: true },
    detalle: () => 'Llamé para preguntar por qué me llegan mensajes de la sede de Villavicencio si yo me inscribí en otra ciudad. Quiero saber de dónde sacaron mi número.',
    pasos: [] },
  { n: 24, tipo: 'reclamo', sede: 'BOG-SUR', canal: 'presencial', recibida: '2026-08-19', hora: '10:15',
    titular: { telefono: true },
    detalle: () => 'Hace un año me pasé a la sede de Soacha y todavía aparezco en Bogotá Sur. Me siguen llamando de allá. Pido que corrijan mi sede y que dejen de llamarme de Bogotá Sur.',
    pasos: [{ tramite: 2 }] },
  { n: 25, tipo: 'actualizacion', sede: 'PEI', canal: 'correo', recibida: '2026-09-11', hora: '09:25',
    titular: { correo: true, nacimiento: true },
    detalle: (t) => `Mi fecha de nacimiento está mal registrada: aparece el ${conAnio(t.fnac)} y es el ${conAnio(sumarDias(t.fnac, 3))}. Adjunto copia de mi documento.`,
    pasos: [{ tramite: 1 }] },
  { n: 26, tipo: 'supresion', sede: 'CALI', canal: 'web', recibida: '2026-09-14', hora: '20:40',
    titular: { saliente: 'CALI' },
    detalle: (t) => `Me mudé a ${t.ciudadNueva} y ya no voy a congregar en Cali. Les pido que eliminen todos mis datos.`,
    pasos: [] },
  { n: 27, tipo: 'revocacion', sede: 'BAQ', canal: 'whatsapp', recibida: '2026-09-17', hora: '13:10',
    titular: { telefono: true, consiente: [['whatsapp', 'convocatoria'], ['whatsapp', 'pastoral']], alguno: true },
    detalle: () => 'Ya no quiero recibir mensajes por WhatsApp de ningún tipo. Por correo sí.', pasos: [] },
  { n: 28, tipo: 'reclamo', sede: 'MED', canal: 'correo', recibida: '2026-08-27', hora: '18:45',
    titular: { correo: true },
    detalle: () => 'En una reunión de grupo alguien comentó algo que yo solo le había contado a mi consejero. Quiero saber quién tuvo acceso a mi caso.',
    pasos: [{ prorroga: 13, informada: true, motivo: 'El reclamo toca un caso de consejería: se está revisando la bitácora de lecturas del caso, y hay que escuchar al consejero y a los pastores antes de responder.' }] },
  { n: 29, tipo: 'consulta', sede: 'CUC', canal: 'correo', recibida: '2026-09-03', hora: '08:15',
    titular: { correo: true, familiaConNinos: true },
    detalle: (t) => `Quiero una copia de todos los datos que tienen de mi familia: los de mis hijos, los de mi ${t.genero === 'F' ? 'esposo' : 'esposa'} y los míos.`,
    pasos: [{ prorroga: 8, informada: false, motivo: (t) => `La consulta incluye los datos de menores y los de ${t.genero === 'F' ? 'su esposo' : 'su esposa'}: hay que verificar que quien pide es el acudiente de los menores y pedir la autorización ${t.genero === 'F' ? 'de él' : 'de ella'} para entregar sus propios datos.` }] },
  { n: 30, tipo: 'supresion', sede: 'BCN', canal: 'correo', recibida: '2026-09-02', hora: '17:30',
    titular: { saliente: 'BCN' },
    detalle: (t) => `Me he mudado a ${t.ciudadNueva} y ya no congrego en Barcelona. Solicito la supresión de todos mis datos personales (artículo 17 del RGPD).`,
    pasos: [{ hoy: 'suprimir' }] },
  { n: 31, tipo: 'revocacion', sede: 'CALI', canal: 'presencial', recibida: '2026-09-18', hora: '12:30',
    titular: { deLaColaDeHoy: 'CALI' },
    detalle: () => 'Me están llegando demasiados correos con invitaciones. Por favor no me envíen más invitaciones por correo.',
    pasos: [{ hoy: 'revocar', canal: 'email', finalidad: 'convocatoria',
      respuesta: (t) => `${trato(t)}: registramos hoy su revocación. Un correo con una invitación que estaba en la cola ya no se le envió. Desde hoy no recibe invitaciones por correo; los mensajes de acompañamiento siguen igual.` }] },
  { n: 32, tipo: 'actualizacion', sede: 'MIA', canal: 'whatsapp', recibida: '2026-09-18', hora: '19:50',
    titular: { correo: true, telefono: true },
    detalle: (t) => `Mi correo cambió: el nuevo es ${t.correoNuevo}. El anterior ya no lo reviso.`, pasos: [] },
  { n: 33, tipo: 'reclamo', sede: 'ORL', canal: 'correo', recibida: '2026-09-08', hora: '11:05',
    titular: { correo: true },
    detalle: () => 'En el formulario de inscripción a la conferencia me pidieron el número de pasaporte y no entiendo para qué lo necesitan. Quiero saber qué hacen con ese dato y que lo borren si no es necesario.',
    pasos: [{ tramite: 2 }] },
  { n: 34, tipo: 'consulta', sede: 'SMR', canal: 'presencial', recibida: '2026-09-09', hora: '16:10',
    titular: {},
    detalle: () => 'Quisiera saber si la iglesia guarda mis aportes con mi nombre y quién los puede ver.',
    pasos: [{ tramite: 2 }] },
  { n: 35, tipo: 'supresion', sede: 'BOG-CHICO', canal: 'web', recibida: '2026-09-10', hora: '23:15',
    titular: { correo: true },
    detalle: () => 'Quiero que eliminen mis datos de la iglesia. Tuve una mala experiencia y no quiero que quede nada mío.',
    pasos: [{ tramite: 1 }] },
  { n: 36, tipo: 'consulta', sede: 'NVA', canal: 'telefono', recibida: '2026-09-17', hora: '10:20',
    titular: { telefono: true },
    detalle: () => '¿Me pueden decir qué autorizaciones de contacto tengo registradas? Quiero revisarlas.', pasos: [] },
];

/** Cómo se registró una autorización, en palabras. */
const COMO_SE_AUTORIZO = {
  formulario_fisico: 'formulario de bienvenida en papel',
  formulario_web: 'formulario de la página web',
  doble_opt_in: 'confirmó el enlace que le llegó al correo',
  importado_origen: 'se trajo del sistema anterior de la sede, 99-o',
  verbal_registrado: 'lo dijo en la sede y quedó registrado',
};
const NOMBRE_CANAL = { email: 'correo', sms: 'mensaje de texto', whatsapp: 'WhatsApp', llamada: 'llamada',
  correo_fisico: 'correo físico', push: 'avisos en el celular' };
const NOMBRE_FINALIDAD = { convocatoria: 'invitaciones a actividades', pastoral: 'acompañamiento pastoral',
  administrativa: 'trámites', menores: 'gestión de menores', emergencia: 'emergencias' };

/* ─────────────────────────────────────────────────────────────────────
   4 · AYUDAS DE ESTE ARCHIVO
   ───────────────────────────────────────────────────────────────────── */

/** Hora HH:MM más unos minutos (sin pasar de medianoche). */
function horaMas(hora, minutos) {
  const m = Math.min(23 * 60 + 59, d.aMinutos(hora) + minutos);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Días hábiles como los cuenta la base (plataforma.dias_habiles_desde): sin
    sábados, domingos ni los festivos sembrados en sistema.festivos. */
function contadorHabiles(festivos) {
  return (desde, n) => {
    let f = desde, k = 0;
    while (k < n) {
      f = sumarDias(f, 1);
      const w = diaSemana(f);
      if (w !== 0 && w !== 6 && !festivos.has(f)) k++;
    }
    return f;
  };
}

/** Identificador de mensaje como el que devuelve el proveedor de correo
    (cabecera x-message-id), determinista por aviso. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function idProveedor(clave) {
  const a = new d.Azar(hash32(clave));
  let s = '';
  for (let i = 0; i < 22; i++) s += ALFABETO[a.entero(0, ALFABETO.length - 1)];
  return s;
}

/** Plantillas que el trabajador sabe armar (backend/api/src/notificaciones/plantillas.ts). */
const PLANTILLAS_CONOCIDAS = new Set(['Bienvenida_nuevo', 'Notificacion_coordinador', 'Confirmacion_miembro',
  'Confirmacion_aporte', 'Comunicacion_general', 'Certificado_expedido']);

/** Lo que decide el trabajador real con un aviso que no es de este archivo. */
function decisionDelTrabajador(n) {
  if (n.canal !== 'email') return { ok: false, error: `Canal ${n.canal} sin proveedor configurado`, definitivo: true };
  if (!PLANTILLAS_CONOCIDAS.has(n.plantilla)) return { ok: false, error: `Plantilla desconocida: ${n.plantilla}`, definitivo: true };
  return { ok: true, proveedor: idProveedor(`${n.plantilla}:${n.destinatario}:${JSON.stringify(n.datos ?? {})}`) };
}

const ERROR_503 = 'sendgrid respondió 503';
const ERROR_LENTO = 'sendgrid no respondió a tiempo (10000 ms)';
const ERROR_400 = 'sendgrid respondió 400: la dirección del destinatario no es válida';
const ERROR_429 = 'sendgrid respondió 429: se alcanzó el cupo diario de envíos de la cuenta';

/** Texto de las autorizaciones vigentes de una persona («correo y WhatsApp para invitaciones…»). */
function textoAutorizaciones(estado) {
  const porFinalidad = {};
  for (const [clave, v] of Object.entries(estado ?? {})) {
    if (v.acto !== 'otorgado') continue;
    const [canal, finalidad] = clave.split('/');
    (porFinalidad[finalidad] ??= []).push(NOMBRE_CANAL[canal] ?? canal);
  }
  const partes = ['convocatoria', 'pastoral', 'menores']
    .filter(f => porFinalidad[f]?.length)
    .map(f => `${lista(porFinalidad[f].sort())} para ${NOMBRE_FINALIDAD[f]}`);
  return partes.length ? partes.join('; ') : 'ninguno, porque no tiene autorizaciones registradas';
}

/** Los datos que el sistema guarda de una persona, en palabras. */
function textoDatos(t, sedeNombre) {
  const xs = ['su nombre'];
  if (t.numero_documento) xs.push(t.tipo_documento === 'PA' ? 'su pasaporte' : 'su documento de identidad');
  if (t.fnac) xs.push('su fecha de nacimiento');
  xs.push('sus datos de contacto');
  xs.push(sedeNombre ? `su participación en la iglesia de ${sedeNombre}` : 'la sede donde congrega');
  if (t.hogar) xs.push('su hogar');
  return lista(xs);
}

/* ─────────────────────────────────────────────────────────────────────
   5 · EL POBLADOR
   ───────────────────────────────────────────────────────────────────── */
d.ejecutar({ archivo: ARCHIVO, tema: 'comunicaciones, Habeas Data y la trastienda' }, async (c, azar) => {
  if (await d.yaPoblado(c,
    `SELECT (SELECT count(*) FROM crm.comunicaciones) + (SELECT count(*) FROM plataforma.peticiones_titular)`,
    [], 'comunicaciones y peticiones de Habeas Data')) return;

  const conteo = {};
  const otrosModulos = { enviados: 0, rechazados: 0 };   // avisos de otros módulos que el trabajador tomó
  const avisos = [];      // lo que conviene saber al terminar (reglas que frenaron, planes que cambiaron)
  const defectos = [];    // lo que se comportó distinto de lo que la base promete

  await d.enTransaccion(c, async () => {
    /* ── 0 · Contexto ─────────────────────────────────────────────── */
    /* El reloj de la base (no el de este proceso): lo que las funciones sellan con now(). */
    const { rows: [reloj] } = await c.query(
      `SELECT (EXTRACT(epoch FROM now()) * 1000)::bigint AS ahora_ms,
              EXTRACT(epoch FROM ((date_trunc('day', now() AT TIME ZONE 'America/Bogota') + interval '1 day 5 minutes')
                                   AT TIME ZONE 'America/Bogota') - now())::int AS hasta_medianoche`);
    const ahoraMs = Number(reloj.ahora_ms);
    /** Un instante de HOY que no quede en el futuro si el poblador corre temprano. */
    const deHoy = (hora, zona, margenMin) => {
      const t = momentoLocal(HOY, hora, zona);
      return ms(t) <= ahoraMs - margenMin * 60000 ? t : new Date(ahoraMs - margenMin * 60000).toISOString();
    };

    const { rows: fest } = await c.query(`SELECT to_char(fecha, 'YYYY-MM-DD') AS f FROM sistema.festivos WHERE pais = 'CO'`);
    const habiles = contadorHabiles(new Set(fest.map(x => x.f)));

    const autoresCache = new Map();
    /** Fija quién hace lo que sigue, con el contexto que la base le calcula (como la API). */
    const autor = async (personaId, motivo = null) => {
      let x = autoresCache.get(personaId);
      if (!x) {
        const { rows: [r] } = await c.query(`SELECT sedes, nivel_max, es_global FROM identidad.contexto_de($1)`, [personaId]);
        x = { sedes: r?.sedes ?? [], nivel: Number(r?.nivel_max ?? 0), global: Boolean(r?.es_global) };
        autoresCache.set(personaId, x);
      }
      await fijarAutor(c, { persona_id: personaId, sede_ids: x.sedes, nivel_max: x.nivel, alcance_global: x.global, motivo });
    };

    const [dg, esposaDG] = await d.direccionGeneral(c);
    if (!dg || !esposaDG) throw new Error('Falta la dirección general (PASTOR_DIRECTOR_GENERAL): corra primero 00-red.js.');
    const legal = await d.equipo(c, 'EQ-LEGAL');
    const responsables = legal.length ? legal.map(x => x.persona_id) : [dg.persona_id];

    const sedesCom = (await d.sedes(c, { conModulo: 'comunicaciones' })).map(s => ({ ...s, ola: s.ola_migracion }));
    const { rows: parejas } = await c.query(
      `SELECT a.alcance_id AS sede_id, p.id, p.primer_nombre, p.genero::text AS genero
         FROM identidad.asignaciones a JOIN nucleo.personas p ON p.id = a.persona_id
        WHERE a.rol = 'PASTOR_CONGREGACIONAL' AND a.alcance_tipo = 'sede' AND a.revocada_en IS NULL
          AND a.vigente_desde <= DATE '${HOY}' AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= DATE '${HOY}')
        ORDER BY a.alcance_id, p.genero DESC, p.id`);
    for (const s of sedesCom) {
      const par = parejas.filter(x => x.sede_id === s.id);
      s.pastor = par.find(x => x.genero === 'M') ?? par[0];
      s.pastora = par.find(x => x.genero === 'F') ?? par[1];
      s.h = horarios(s);
      s.pp = `${s.pastor.primer_nombre} y ${s.pastora.primer_nombre}`;
      s.golive = SALIDAS_POR_OLA[s.ola];
    }
    const sedePorCodigo = Object.fromEntries((await d.sedes(c, { incluirInactivas: true })).map(s => [s.codigo, s]));

    /* Grupos y servidores: solo si los pobladores de esos módulos ya corrieron. */
    const { rows: gruposVivos } = await c.query(
      `SELECT g.id, g.nombre, g.tipo, g.sede_id, count(*)::int AS miembros
         FROM grupos.grupos g JOIN grupos.membresias m ON m.grupo_id = g.id AND m.fecha_salida IS NULL
        WHERE g.cerrado_en IS NULL
        GROUP BY g.id HAVING count(*) >= 6 ORDER BY g.sede_id, g.nombre, g.id`);
    const { rows: servidoresPorSede } = await c.query(
      `SELECT sede_id, count(*)::int AS n FROM talento.voluntariados WHERE estado::text = 'activo' GROUP BY sede_id`);
    const servidores = new Map(servidoresPorSede.map(x => [x.sede_id, x.n]));

    /* ── 1 · El plan de comunicaciones de cada sede ─────────────────── */
    const comunicaciones = [];
    const tarde = (az) => az.horaEntre('08:00', '17:30', 5);
    for (const s of sedesCom) {
      const az = azar.derivar(`plan-${s.codigo}`);
      const forzadas = FORZADAS[s.codigo] ?? {};
      const elegibles = OCASIONES
        .map(o => ({ o, base: o.fecha(s) }))
        .filter(x => x.base && x.base >= s.golive && x.base <= AYER);
      const cuantas = s.tamano === 'grande' ? az.entero(8, 9) : s.tamano === 'mediana' ? az.entero(5, 6) : az.entero(3, 4);
      const obligadas = elegibles.filter(x => x.o.clave in forzadas
        || (x.o.clave === 'conferencia' && s.tamano !== 'pequena')
        || (x.o.clave === 'navidad-2025' && s.tamano === 'grande'));
      const resto = az.barajar(elegibles.filter(x => !obligadas.includes(x)));
      const elegidas = [...obligadas, ...resto.slice(0, Math.max(0, cuantas - obligadas.length))]
        .sort((a, b) => a.base.localeCompare(b.base));
      // Una devuelta con errata entre lo enviado: en las grandes siempre, en las medianas a veces.
      const conErrata = elegidas.filter(x => x.o.errata);
      const devueltaEnviada = conErrata.length && (s.tamano === 'grande' || (s.tamano === 'mediana' && az.probabilidad(0.35)))
        ? az.elegir(conErrata).o.clave : null;
      for (const x of elegidas) {
        const fija = forzadas[x.o.clave];
        const fecha = fija ? fija[0] : minFecha(AYER, maxFecha(s.golive, sumarDias(x.base, az.entero(-1, 2))));
        const hora = fija ? fija[1] : az.horaEntre('07:30', '20:30', 5);
        comunicaciones.push({ s, clave: x.o.clave, fuente: x.o, estado: 'enviada', fecha, hora,
          errata: x.o.clave === devueltaEnviada ? x.o.errata : null, az: azar.derivar(`com-${s.codigo}-${x.o.clave}`) });
      }
      // Lo que no es de temporada.
      if (s.codigo === 'BAQ') comunicaciones.push({ s, clave: 'emergencia-arroyos', fuente: ESPECIALES['emergencia-arroyos'], estado: 'enviada', fecha: '2026-05-13', hora: '17:40', urgente: true, az: azar.derivar('com-BAQ-arroyos') });
      if (s.codigo === 'MIA') comunicaciones.push({ s, clave: 'emergencia-tormenta', fuente: ESPECIALES['emergencia-tormenta'], estado: 'enviada', fecha: '2026-08-28', hora: '16:15', urgente: true, az: azar.derivar('com-MIA-tormenta') });
      if (s.codigo === 'SOACHA') comunicaciones.push({ s, clave: 'duelo', fuente: ESPECIALES.duelo, estado: 'enviada', fecha: '2026-08-12', hora: '19:00', az: azar.derivar('com-SOACHA-duelo') });
      // Lo que está en curso.
      for (const clave of EN_CURSO_POR_SEDE[s.codigo] ?? []) {
        const f = EN_CURSO[clave];
        let estado = f.estado, aniv = null;
        if (clave === 'aniversario-proximo') {
          const f0 = FUNDADA[s.codigo];
          const fecha = `2026${f0.slice(4)}`;
          aniv = { fecha, domingo: domingoDesde(fecha), anios: 2026 - Number(f0.slice(0, 4)) };
          estado = s.codigo === 'BCN' ? 'aprobada' : 'borrador';
        }
        comunicaciones.push({ s, clave, fuente: f, estado, aniv, en_curso: true, az: azar.derivar(`com-${s.codigo}-${clave}`) });
      }
      // Grupos y servidores, si existen.
      const gs = gruposVivos.filter(g => g.sede_id === s.id);
      if (gs.length && s.tamano === 'grande') {
        // «Esta semana no nos reunimos en la casa de siempre»: le va a un grupo familiar.
        const familiares = gs.filter(g => g.tipo === 'familiar');
        const g = az.elegir(familiares.length ? familiares : gs);
        comunicaciones.push({ s, clave: 'grupo', fuente: ESPECIALES.grupo, estado: 'enviada', grupo: g,
          fecha: sumarDias('2026-09-14', az.entero(0, 4)), hora: az.horaEntre('17:00', '20:00', 5), az: azar.derivar(`com-${s.codigo}-grupo`) });
      }
      const conServidores = (servidores.get(s.id) ?? 0) >= 8;
      if (conServidores && (s.tamano === 'grande' || (s.tamano === 'mediana' && az.probabilidad(0.35)))) {
        comunicaciones.push({ s, clave: 'servidores', fuente: ESPECIALES.servidores, estado: s.tamano === 'grande' ? 'aprobada' : 'borrador',
          en_curso: true, az: azar.derivar(`com-${s.codigo}-servidores`) });
      }
    }
    // Los tres envíos de hoy.
    const hoyPor = {};
    for (const [codigo, clave, estado] of [['BOG-NORTE', 'hoy-semana', 'hoy'], ['CALI', 'hoy-conferencia', 'hoy'], ['MED', 'hoy-vigilia', 'hoy']]) {
      const s = sedesCom.find(x => x.codigo === codigo);
      if (!s) { avisos.push(`La sede ${codigo} no tiene comunicaciones encendidas: sin envío de hoy.`); continue; }
      const k = { s, clave, fuente: ESPECIALES[clave], estado, az: azar.derivar(`com-${codigo}-${clave}`) };
      comunicaciones.push(k);
      hoyPor[codigo] = k;
    }

    /* ── 2 · Cada comunicación nace, se aprueba, se devuelve o se cancela ──
       Como en la API: el INSERT lo hace el autor; la aprobación, otra
       persona (la base rechaza que el autor se apruebe); devolver a
       borrador borra la aprobación (lo hace la base); lo aprobado no se
       edita. El envío va después, en orden de fecha, con la función. */
    const insertarCom = async (k, textos, creada) => {
      await autor(k.A.id);
      await c.query(
        `INSERT INTO crm.comunicaciones (id, sede_id, canal, finalidad, asunto, cuerpo, destinatarios, grupo_id, estado, creada_por, creada_en)
         VALUES ($1, $2, 'email', $3, $4, $5, $6, $7, 'borrador', $8, $9)`,
        [k.id, k.s.id, k.fuente.finalidad, textos.asunto, textos.cuerpo, k.destinatarios, k.grupo?.id ?? null, k.A.id, creada]);
    };
    const aprobarCom = async (k, cuando) => {
      await autor(k.B.id);
      await c.query(`UPDATE crm.comunicaciones SET estado = 'aprobada', aprobada_por = $2, aprobada_en = $3 WHERE id = $1`,
        [k.id, k.B.id, cuando]);
    };
    const devolverCom = async (k, motivo) => {
      await autor(k.B.id, motivo);
      await c.query(`UPDATE crm.comunicaciones SET estado = 'borrador' WHERE id = $1`, [k.id]);
    };
    const editarCom = async (k, textos, motivo) => {
      await autor(k.A.id, motivo);
      await c.query(`UPDATE crm.comunicaciones SET asunto = $2, cuerpo = $3 WHERE id = $1`, [k.id, textos.asunto, textos.cuerpo]);
    };
    const cancelarCom = async (k, quien, motivo) => {
      await autor(quien.id, motivo);
      await c.query(`UPDATE crm.comunicaciones SET estado = 'cancelada' WHERE id = $1`, [k.id]);
    };

    for (const k of comunicaciones) {
      const s = k.s, az = k.az;
      k.id = az.uuid();
      [k.A, k.B] = az.probabilidad(0.55) ? [s.pastor, s.pastora] : [s.pastora, s.pastor];
      k.quienEnvia = az.probabilidad(0.5) ? k.A : k.B;
      k.destinatarios = k.clave === 'grupo' ? 'grupo' : k.clave === 'servidores' ? 'servidores' : 'miembros_sede';
      const x = { s, pp: s.pp, h: s.h, grupo: k.grupo, aniv: k.aniv, inscritos: az.entero(28, 61) };
      const textos = { asunto: k.fuente.asunto(x), cuerpo: k.fuente.cuerpo(x) };
      const zona = s.zona_horaria;

      if (k.estado === 'enviada') {
        k.envio = momentoLocal(k.fecha, k.hora, zona);
        if (k.urgente) {
          await insertarCom(k, textos, momentoLocal(k.fecha, horaMas(k.hora, -40), zona));
          await aprobarCom(k, momentoLocal(k.fecha, horaMas(k.hora, -15), zona));
          continue;
        }
        const k1 = az.entero(2, 5), k2 = az.entero(1, k1 - 1);
        const fCreada = maxFecha(s.golive, sumarDias(k.fecha, -k1));
        const fAprobada = maxFecha(fCreada, sumarDias(k.fecha, -k2));
        const hCreada = fCreada === fAprobada ? az.horaEntre('08:00', '10:30', 5) : tarde(az);
        const hAprobada = fCreada === fAprobada ? az.horaEntre('14:00', '18:00', 5) : az.horaEntre('08:00', '21:00', 5);
        if (k.errata) {
          // Salió con un error: quien aprobaba la devolvió, el autor la corrigió y se aprobó de nuevo.
          const v1 = { asunto: textos.asunto, cuerpo: textos.cuerpo.replace(k.errata.correcto, k.errata.error) };
          await insertarCom(k, v1, momentoLocal(fCreada, hCreada, zona));
          await aprobarCom(k, momentoLocal(fCreada, horaMas(hCreada, 50), zona));
          await devolverCom(k, k.errata.devuelta);
          await editarCom(k, textos, k.errata.corrige);
          await aprobarCom(k, momentoLocal(fAprobada, hAprobada, zona));
          conteo.devueltas_y_corregidas = (conteo.devueltas_y_corregidas ?? 0) + 1;
        } else {
          await insertarCom(k, textos, momentoLocal(fCreada, hCreada, zona));
          await aprobarCom(k, momentoLocal(fAprobada, hAprobada, zona));
        }
        continue;
      }

      if (k.estado === 'hoy') {
        const creada = { 'BOG-NORTE': ['2026-09-18', '16:20'], CALI: [AYER, '18:00'], MED: ['2026-09-18', '10:30'] }[s.codigo];
        await insertarCom(k, textos, momentoLocal(creada[0], creada[1], zona));
        if (s.codigo === 'CALI') await aprobarCom(k, deHoy('08:50', zona, 150));
        else await aprobarCom(k, momentoLocal(AYER, s.codigo === 'MED' ? '20:00' : '21:05', zona));
        continue;
      }

      // En curso: fechas contadas hacia atrás desde hoy.
      const hace = (dias, hora) => momentoLocal(maxFecha(s.golive, sumarDias(HOY, -dias)), hora, zona);
      if (k.estado === 'borrador') {
        await insertarCom(k, textos, hace(az.entero(1, 6), tarde(az)));
      } else if (k.estado === 'aprobada') {
        const k1 = az.entero(3, 7), k2 = az.entero(1, k1 - 1);
        await insertarCom(k, textos, hace(k1, tarde(az)));
        await aprobarCom(k, hace(k2, az.horaEntre('08:00', '21:00', 5)));
      } else if (k.estado === 'devuelta') {
        const f = k.fuente;
        const v1 = { asunto: f.asunto(x, f.primera), cuerpo: f.cuerpo(x, f.primera) };
        await insertarCom(k, v1, hace(6, tarde(az)));
        await aprobarCom(k, hace(5, az.horaEntre('08:00', '21:00', 5)));
        await devolverCom(k, f.devuelta);
        await editarCom(k, textos, f.corrige);
      } else if (k.estado === 'cancelada') {
        const f = k.fuente;
        const base = f.fechaBase;
        if (f.desde === 'aprobada') {
          await insertarCom(k, textos, momentoLocal(sumarDias(base, -4), tarde(az), zona));
          await aprobarCom(k, momentoLocal(sumarDias(base, -2), az.horaEntre('08:00', '21:00', 5), zona));
          await cancelarCom(k, k.B, f.motivo);
        } else {
          await insertarCom(k, textos, momentoLocal(base, az.horaEntre('09:00', '12:00', 5), zona));
          await cancelarCom(k, k.A, f.motivo);
        }
      }
    }
    await autor(dg.persona_id);

    /* ── 3 · Las peticiones de los titulares ─────────────────────────── */
    // Quién puede ser titular: adultos activos que congregan en su sede y no tienen cargo.
    const { rows: pool } = await c.query(`
      SELECT p.id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, p.genero::text AS genero,
             to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fnac, p.email_principal::text AS email, p.telefono_movil AS telefono,
             p.tipo_documento, p.numero_documento, p.direccion, p.sede_id, s.codigo AS sede, s.nombre AS sede_nombre,
             EXISTS (SELECT 1 FROM grupos.hogar_miembros hm WHERE hm.persona_id = p.id AND hm.hasta IS NULL) AS hogar,
             EXISTS (SELECT 1 FROM nucleo.vinculos v WHERE v.persona_id = p.id AND v.tipo = 'CONYUGE' AND v.vigente_hasta IS NULL) AS casado,
             (SELECT json_build_object('genero', m.genero, 'parentesco', a.parentesco)
                FROM nucleo.acudientes a JOIN nucleo.personas m ON m.id = a.menor_id
               WHERE a.acudiente_id = p.id AND a.vigente_hasta IS NULL AND m.eliminado_en IS NULL
                 AND age(DATE '${HOY}', m.fecha_nacimiento) BETWEEN interval '3 years' AND interval '11 years 11 months'
               ORDER BY m.fecha_nacimiento DESC, m.id LIMIT 1) AS nino
        FROM nucleo.personas p JOIN org.sedes s ON s.id = p.sede_id
       WHERE p.eliminado_en IS NULL AND p.estado::text = 'activa'
         AND p.fecha_nacimiento <= DATE '${HOY}' - interval '18 years'
         AND p.fecha_nacimiento >  DATE '${HOY}' - interval '80 years'
         AND EXISTS (SELECT 1 FROM nucleo.membresias_sede m WHERE m.persona_id = p.id AND m.sede_id = p.sede_id AND m.hasta IS NULL)
         AND NOT EXISTS (SELECT 1 FROM identidad.asignaciones a WHERE a.persona_id = p.id AND a.revocada_en IS NULL)
         AND NOT EXISTS (SELECT 1 FROM org.unidad_miembros u WHERE u.persona_id = p.id AND u.hasta IS NULL)
       ORDER BY p.source_id NULLS FIRST, p.id`);
    const poolPorId = new Map(pool.map(p => [p.id, p]));

    // El último acto de consentimiento de cada persona, por canal y finalidad (como lo lee puede_contactar).
    const { rows: ultimos } = await c.query(`
      SELECT DISTINCT ON (persona_id, canal, finalidad) persona_id, canal::text AS canal, finalidad, acto::text AS acto,
             to_char(ocurrido_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha
        FROM plataforma.consentimientos
       ORDER BY persona_id, canal, finalidad, ocurrido_en DESC, registrado_en DESC, acto DESC`);
    const consent = new Map();
    for (const r of ultimos) {
      if (!consent.has(r.persona_id)) consent.set(r.persona_id, {});
      consent.get(r.persona_id)[`${r.canal}/${r.finalidad}`] = { acto: r.acto, fecha: r.fecha };
    }

    // Quienes se fueron de la red (membresía cerrada y ninguna abierta).
    const { rows: salientes } = await c.query(`
      SELECT p.id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, p.genero::text AS genero,
             to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fnac, p.email_principal::text AS email, p.telefono_movil AS telefono,
             p.tipo_documento, p.numero_documento, p.direccion, p.sede_id, s.codigo AS sede, s.nombre AS sede_nombre,
             to_char(m.hasta, 'YYYY-MM-DD') AS salio, m.motivo
        FROM nucleo.personas p JOIN org.sedes s ON s.id = p.sede_id
        JOIN LATERAL (SELECT x.hasta, x.motivo FROM nucleo.membresias_sede x WHERE x.persona_id = p.id
                       ORDER BY x.hasta DESC NULLS FIRST, x.id LIMIT 1) m ON true
       WHERE p.eliminado_en IS NULL AND p.estado::text = 'trasladada'
         AND NOT EXISTS (SELECT 1 FROM nucleo.membresias_sede x WHERE x.persona_id = p.id AND x.hasta IS NULL)
       ORDER BY m.hasta, p.id`);
    const usados = await d.usadosEnLaBase(c);
    const usadosTit = new Set();

    const elegirTitular = (pet) => {
      const f = pet.titular;
      const az = azar.derivar(`titular-${pet.n}`);
      if (f.externo) {
        const genero = az.probabilidad(0.5) ? 'F' : 'M';
        const { primer_nombre, segundo_nombre } = d.nombrePara(az, genero, az.entero(1966, 2001));
        const primer_apellido = d.apellidoAzar(az), segundo_apellido = d.apellidoAzar(az);
        return { id: null, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, genero,
          email: d.correoNuevo(az, primer_nombre, primer_apellido, usados.correos),
          telefono: d.telefonoNuevo(az, usados.telefonos),
          tipo_documento: 'CC', numero_documento: d.documentoNuevo(az, usados.documentos),
          sede: pet.sede, sede_id: sedePorCodigo[pet.sede].id };
      }
      if (f.saliente) {
        const s = salientes.find(x => x.sede === f.saliente && !usadosTit.has(x.id))
          ?? salientes.find(x => !usadosTit.has(x.id) && x.email);
        if (s) {
          usadosTit.add(s.id);
          const ciudad = /vivir a (.+?) y no hay/.exec(s.motivo ?? '')?.[1]?.replace(/\s*\(.*\)$/, '') ?? 'otra ciudad';
          if (s.sede !== f.saliente) avisos.push(`Petición ${pet.n}: no hay quien se haya ido de ${f.saliente}; se usó a alguien de ${s.sede}.`);
          return { ...s, ciudadNueva: ciudad, esSaliente: true };
        }
        avisos.push(`Petición ${pet.n}: no hay personas que se hayan ido de la red; se usa un adulto activo.`);
      }
      const cumple = (p) => {
        if (usadosTit.has(p.id)) return false;
        if (f.correo && !p.email) return false;
        if (f.telefono && !p.telefono) return false;
        if (f.direccion && !p.direccion) return false;
        if (f.nacimiento && !p.fnac) return false;
        if (f.apellidoConTilde && !/[áéíóúÁÉÍÓÚ]/.test(p.segundo_apellido ?? '')) return false;
        if (f.padreDeNino && !(p.nino && ['MADRE', 'PADRE'].includes(p.nino.parentesco))) return false;
        if (f.familiaConNinos && !(p.casado && p.nino)) return false;
        if (f.consiente) {
          const est = consent.get(p.id) ?? {};
          const antes = f.antesDe ?? pet.recibida;
          const ok = f.consiente.map(([canal, fin]) => {
            const v = est[`${canal}/${fin}`];
            return Boolean(v && v.acto === 'otorgado' && v.fecha < antes);
          });
          if (f.alguno ? !ok.some(Boolean) : !ok.every(Boolean)) return false;
        }
        return true;
      };
      let cand = az.barajar(pool.filter(p => p.sede === pet.sede && cumple(p)));
      if (!cand.length) {
        cand = az.barajar(pool.filter(cumple));
        if (cand.length) avisos.push(`Petición ${pet.n}: nadie en ${pet.sede} cumple la historia; se tomó a alguien de ${cand[0].sede}.`);
      }
      if (!cand.length) throw new Error(`Petición ${pet.n}: no hay ningún titular posible.`);
      usadosTit.add(cand[0].id);
      return { ...cand[0], ciudadNueva: 'otra ciudad', salio: AYER };
    };

    const contactoDe = (pet, t) => ['web', 'correo'].includes(pet.canal) ? (t.email ?? t.telefono) : (t.telefono ?? t.email);
    const evidenciaDe = (pet, t, fecha, rechazo) => {
      if (pet.titular.presentaTercero) return `Respuesta entregada en la sede a quien presentó la solicitud, el ${conAnio(fecha)}, con firma de recibido.`;
      const esCelular = /^\d{3} \d{3} \d{4}$/.test(t.contacto ?? '');
      switch (pet.canal) {
        case 'presencial': return `Respuesta entregada en la sede el ${conAnio(fecha)}, con firma de recibido.`;
        case 'telefono': return `Respuesta dada por teléfono el ${conAnio(fecha)} y confirmada por escrito${t.email ? ` a ${t.email}` : ''}.`;
        case 'whatsapp': return `Respuesta enviada por WhatsApp al ${t.contacto} el ${conAnio(fecha)}.`;
        default: return esCelular
          ? `Respuesta enviada por WhatsApp al ${t.contacto} el ${conAnio(fecha)}.`
          : `Respuesta ${rechazo ? 'con el motivo del rechazo ' : ''}enviada a ${t.contacto} el ${conAnio(fecha)}.`;
      }
    };

    /** Responder o rechazar: como la API (estado, respuesta, evidencia), con la fecha en que se hizo. */
    const responder = async (r) => {
      await autor(r.pet.responsable, r.estado === 'rechazada'
        ? 'Respuesta de rechazo a una petición de Habeas Data' : 'Respuesta a una petición de Habeas Data');
      await c.query(
        `UPDATE plataforma.peticiones_titular SET estado = $2, respuesta = $3, evidencia = $4, respondida_en = $5 WHERE id = $1`,
        [r.pet.id, r.estado, r.respuesta(r.t), evidenciaDe(r.pet, r.t, r.fecha, r.estado === 'rechazada'), r.instante]);
    };

    const peticiones = [];
    const eventos = [];
    const dinamicas = [];
    const deHoyPet = {};
    for (const pet of PETICIONES) {
      if (pet.titular.deLaColaDeHoy) { deHoyPet[pet.n] = pet; continue; }   // se elige hoy, de la cola
      const t = elegirTitular(pet);
      const sedeP = sedePorCodigo[t.id ? t.sede : pet.sede] ?? sedePorCodigo[pet.sede];
      const zona = sedeP.zona_horaria;
      const azP = azar.derivar(`peticion-${pet.n}`);
      pet.id = azP.uuid();
      pet.radicado = `HD-${pet.recibida.replace(/-/g, '')}-${azP.hex(6)}`;
      pet.responsable = responsables[pet.n % responsables.length];
      t.recibida = pet.recibida;
      t.nombreCompleto = d.nombreCompleto(t);
      t.contacto = pet.titular.presentaTercero ? d.telefonoNuevo(azP, usados.telefonos) : contactoDe(pet, t);
      t.datos = textoDatos(t, pet.sede === 'MAD' ? 'Madrid' : null);
      t.autorizaciones = textoAutorizaciones(consent.get(t.id));
      t.hijo = t.nino?.genero === 'F' ? 'hija' : 'hijo';
      if (pet.n === 15) {
        const { rows: [pc] } = await c.query(
          `SELECT to_char(ocurrido_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha, evidencia_tipo
             FROM plataforma.consentimientos WHERE persona_id = $1 AND canal = 'email' AND acto = 'otorgado'
            ORDER BY ocurrido_en, registrado_en LIMIT 1`, [t.id]);
        t.primeraCorreo = { fecha: pc.fecha, como: COMO_SE_AUTORIZO[pc.evidencia_tipo] ?? 'formulario de la sede' };
      }
      if (pet.n === 32) t.correoNuevo = d.correoNuevo(azP, t.primer_nombre, t.primer_apellido, usados.correos);
      pet.t = t;
      pet.zona = zona;

      await autor(pet.responsable, 'Radicación de una petición de Habeas Data');
      const { rows: [r] } = await c.query(
        `INSERT INTO plataforma.peticiones_titular
           (id, radicado, tipo, titular_id, titular_nombre, titular_documento, titular_contacto, detalle, canal,
            recibida_en, responsable_id, sede_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING to_char(vence_en, 'YYYY-MM-DD') AS vence`,
        [pet.id, pet.radicado, pet.tipo, t.id, t.nombreCompleto,
         t.numero_documento ? `${t.tipo_documento ?? 'CC'} ${t.numero_documento}` : null,
         t.contacto, pet.detalle(t), pet.canal, momentoLocal(pet.recibida, pet.hora, zona), pet.responsable, sedeP.id]);
      pet.vence = r.vence;

      for (const paso of pet.pasos) {
        const hora = azP.horaEntre('08:00', '17:30', 5);
        if ('tramite' in paso) {
          await autor(pet.responsable, 'La petición pasa a trámite');
          await c.query(`UPDATE plataforma.peticiones_titular SET estado = 'en_tramite' WHERE id = $1`, [pet.id]);
        } else if ('prorroga' in paso) {
          const f = habiles(pet.recibida, paso.prorroga);
          const motivo = typeof paso.motivo === 'function' ? paso.motivo(t) : paso.motivo;
          await autor(pet.responsable, 'Prórroga de una petición de Habeas Data');
          const { rows: [p] } = await c.query(`SELECT plataforma.prorrogar_peticion($1, $2, $3)::text AS vence`, [pet.id, motivo, paso.informada]);
          // La base sella la prórroga con la hora de hoy: se deja en la fecha en que se hizo.
          const cuando = momentoLocal(f, hora, zona);
          await c.query(
            `UPDATE plataforma.peticiones_titular SET prorrogada_en = $2::timestamptz,
                    prorroga_informada_en = CASE WHEN $3 THEN $2::timestamptz + interval '2 hours' END WHERE id = $1`,
            [pet.id, cuando, paso.informada]);
          pet.venceProrroga = p.vence;
          conteo.prorrogas = (conteo.prorrogas ?? 0) + 1;
        } else if ('revoca' in paso) {
          const f = habiles(pet.recibida, paso.en);
          const horaR = paso.en === 0 ? horaMas(pet.hora, 20) : hora;
          t.revocada = f;
          t.revocadaInstante = momentoLocal(f, horaR, zona);
          eventos.push({ tipo: 'revoca', instante: t.revocadaInstante, registrado: momentoLocal(f, horaMas(horaR, 12), zona),
            fecha: f, pet, t, canales: paso.revoca.canales, finalidades: paso.revoca.finalidades });
        } else if ('responde' in paso || 'rechaza' in paso) {
          const f = habiles(pet.recibida, paso.responde ?? paso.rechaza);
          const r2 = { pet, t, estado: 'responde' in paso ? 'atendida' : 'rechazada', fecha: f,
            instante: momentoLocal(f, horaMas(hora, 30), zona), respuesta: paso.respuesta };
          if (paso.dinamica) { dinamicas.push(r2); continue; }
          await responder(r2);
        } else if ('hoy' in paso) {
          deHoyPet[pet.n] = pet;
        }
      }
      peticiones.push(pet);
    }

    /* ── 4 · Los envíos y las revocatorias, en el orden en que pasaron ──
       Cada envío lo hace crm.enviar_comunicacion (freno, estado aprobado y
       consentimiento de cada destinatario) y enseguida pasa el trabajador
       de la bandeja. Las revocatorias se registran en su fecha: lo que salió
       antes le llegó al titular; lo de después, ya no. */
    /** Una vuelta del trabajador: tomar lo que haya en cola y marcar cada aviso. */
    const vuelta = async (decidir) => {
      const { rows } = await c.query(`SELECT * FROM plataforma.tomar_notificaciones(100000)`);
      if (!rows.length) return 0;
      const m = rows.map(n => ({ id: n.id, ...decidir(n) }));
      await c.query(
        `SELECT plataforma.marcar_notificacion(x.id, x.ok, x.error, x.proveedor, x.definitivo, x.esperar)
           FROM unnest($1::uuid[], $2::boolean[], $3::text[], $4::text[], $5::boolean[], $6::int[])
             AS x(id, ok, error, proveedor, definitivo, esperar)`,
        [m.map(x => x.id), m.map(x => x.ok), m.map(x => x.error ?? null), m.map(x => x.proveedor ?? null),
         m.map(x => Boolean(x.definitivo)), m.map(x => x.esperar ?? null)]);
      return rows.length;
    };

    /** Enviar con la función de la base, como el botón «Enviar» de la pantalla. */
    const enviar = async (k, instante) => {
      await autor(k.quienEnvia.id);
      const { rows: [r] } = await c.query(`SELECT crm.enviar_comunicacion($1) AS r`, [k.id]);
      k.resultado = r.r;
      if (instante) {
        // La base sella el envío con la hora de hoy: se deja en la fecha en que salió.
        await autor(k.quienEnvia.id, 'Carga de la demostración: fecha y hora en que salió el envío');
        await c.query(`UPDATE crm.comunicaciones SET enviada_en = $2 WHERE id = $1`, [k.id, instante]);
        await c.query(`UPDATE plataforma.notificaciones SET creada_en = $2 WHERE origen_modulo = 'comunicaciones' AND origen_id = $1`,
          [k.id, instante]);
      }
      return r.r;
    };

    /** El trabajador procesa la tanda de un envío. `tropiezo` dice qué salió mal y a cuántos. */
    const trabajar = async (k, tropiezo = {}) => {
      const { rows: mias } = await c.query(
        `SELECT id, destinatario FROM plataforma.notificaciones
          WHERE origen_modulo = 'comunicaciones' AND origen_id = $1 AND estado = 'pendiente'`, [k.id]);
      const cola = mias.map(n => ({ ...n, h: hash32(`${k.id}:${n.destinatario}`) }))
        .sort((a, b) => a.h - b.h || a.destinatario.localeCompare(b.destinatario));
      const plan = new Map();
      const n = cola.length;
      const nCupo = tropiezo.cupo ? Math.ceil(n * tropiezo.cupo) : 0;
      cola.slice(n - nCupo).forEach(x => plan.set(x.id, 'cupo'));
      cola.slice(n - Math.min(tropiezo.caida ?? 0, n)).forEach(x => plan.set(x.id, 'caida'));
      cola.slice(0, Math.min(tropiezo.lentos ?? 0, n)).forEach(x => plan.set(x.id, 'lento'));
      cola.slice(Math.floor(n / 2), Math.floor(n / 2) + Math.min(tropiezo.definitivos ?? 0, n))
        .forEach(x => plan.set(x.id, 'definitivo'));
      const mias2 = new Set(cola.map(x => x.id));
      const decidir = (intento) => (x) => {
        const p = plan.get(x.id);
        if (p === 'caida') return { ok: false, error: intento < 5 ? ERROR_503 : ERROR_LENTO };
        if (p === 'lento') return { ok: false, error: ERROR_LENTO };
        if (p === 'definitivo') return { ok: false, error: ERROR_400, definitivo: true };
        if (p === 'cupo') return { ok: false, error: ERROR_429, esperar: Number(reloj.hasta_medianoche) };
        if (mias2.has(x.id)) return { ok: true, proveedor: idProveedor(`${k.id}:${x.destinatario}`) };
        // Un aviso de otro módulo: la lógica del trabajador real.
        const dec = decisionDelTrabajador(x);
        if (dec.ok) otrosModulos.enviados++; else otrosModulos.rechazados++;
        return dec;
      };
      const ajenos = [];
      await vuelta((x) => { const r = decidir(1)(x); if (!mias2.has(x.id)) ajenos.push(x.id); return r; });
      if (ajenos.length) {
        // Lo que otros módulos dejaron en cola de días anteriores habría salido al minuto de encolarse:
        // se deja con esa hora. Lo encolado hace menos de diez minutos sale ahora.
        await c.query(
          `UPDATE plataforma.notificaciones x
              SET tomada_en = x.creada_en + make_interval(secs => 15 + get_byte(decode(md5(x.id::text), 'hex'), 0) % 30),
                  enviada_en = CASE WHEN x.estado = 'enviada'
                                    THEN x.creada_en + make_interval(secs => 50 + get_byte(decode(md5(x.id::text), 'hex'), 1) % 90) END
            WHERE x.id = ANY($1::uuid[]) AND x.estado IN ('enviada', 'fallida') AND x.creada_en < now() - interval '10 minutes'`,
          [ajenos]);
      }
      // Lo que falló de forma pasajera vuelve a la cola con espera creciente; cuando la
      // espera pasa, el trabajador lo toma de nuevo. Al quinto intento, muere.
      const reintentar = cola.filter(x => ['caida', 'lento'].includes(plan.get(x.id))).map(x => x.id);
      for (let intento = 2; intento <= 5 && reintentar.length; intento++) {
        await c.query(`UPDATE plataforma.notificaciones SET proximo_intento = now() - interval '1 second' WHERE id = ANY($1::uuid[])`,
          [reintentar]);
        await vuelta(decidir(intento));
      }
    };

    /** La base sella con la hora de hoy: cada aviso queda con la hora en que de verdad se tomó y salió. */
    const ajustarTiempos = async (k, instante) => {
      await c.query(
        `UPDATE plataforma.notificaciones n
            SET tomada_en = CASE WHEN n.intentos > 0 THEN $2::timestamptz + make_interval(secs => (12 + x.orden * 0.4)::float8)
                                  + CASE WHEN n.intentos >= 5 THEN interval '30 minutes' ELSE interval '0 seconds' END END,
                enviada_en = CASE WHEN n.estado = 'enviada' THEN $2::timestamptz + make_interval(secs => (13 + x.orden * 0.4)::float8) END
           FROM (SELECT id, row_number() OVER (ORDER BY destinatario, id) AS orden
                   FROM plataforma.notificaciones WHERE origen_modulo = 'comunicaciones' AND origen_id = $1) x
          WHERE n.id = x.id`, [k.id, instante]);
    };

    /** Una revocatoria de otra fecha: actos de consentimiento con su fecha y el radicado como evidencia. */
    const registrarRevocacion = async (ev) => {
      const { t, pet } = ev;
      const { rows } = await c.query(
        `SELECT c.canal::text AS canal, f.codigo AS finalidad
           FROM plataforma.finalidades f CROSS JOIN unnest($2::plataforma.canal_contacto[]) AS c(canal)
          WHERE f.codigo = ANY($3::text[]) AND f.base_legal = 'consentimiento'
            AND plataforma.puede_contactar($1, c.canal, f.codigo)
          ORDER BY 1, 2`, [t.id, ev.canales, ev.finalidades]);
      const az = azar.derivar(`revocacion-${pet.n}`);
      const filas = rows.map(r => ({
        id: az.uuid(), persona_id: t.id, sede_id: t.sede_id, finalidad: r.finalidad, canal: r.canal, acto: 'revocado',
        ocurrido_en: ev.instante, registrado_en: ev.registrado,
        evidencia_tipo: ['web', 'correo'].includes(pet.canal) ? 'formulario_web' : 'verbal_registrado',
        evidencia_ref: `Petición de Habeas Data ${pet.radicado}`,
        politica_version: ev.fecha < '2025-11-01' ? 'v1.0' : 'v2.0',
        source_system: SISTEMA, source_id: `consentimiento-hd-${pet.radicado}-${r.canal}-${r.finalidad}`,
      }));
      await insertarLote(c, 'plataforma.consentimientos', filas);
      conteo.actos_de_revocacion_por_habeas_data = (conteo.actos_de_revocacion_por_habeas_data ?? 0) + filas.length;
      if (!filas.length) avisos.push(`Petición ${pet.n}: no había nada vigente que revocar.`);
    };

    for (const k of comunicaciones) if (k.estado === 'enviada') eventos.push({ tipo: 'envio', instante: k.envio, k });
    eventos.sort((a, b) => (ms(a.instante) - ms(b.instante))
      || ((a.tipo === 'revoca' ? 0 : 1) - (b.tipo === 'revoca' ? 0 : 1))
      || String(a.k?.id ?? a.pet?.n).localeCompare(String(b.k?.id ?? b.pet?.n)));
    for (const ev of eventos) {
      if (ev.tipo === 'revoca') { await registrarRevocacion(ev); continue; }
      const k = ev.k;
      await enviar(k, k.envio);
      await trabajar(k, TROPIEZOS[`${k.s.codigo}:${k.clave}`] ?? {});
      await ajustarTiempos(k, k.envio);
    }

    /* Las respuestas que cuentan lo que de verdad le llegó al titular. */
    for (const r of dinamicas) {
      // Desde que pidió (de palabra o por escrito) hasta que la revocatoria quedó registrada.
      const desde = r.pet.n === 17 ? momentoLocal('2026-08-03', '12:00', r.pet.zona) : momentoLocal(r.pet.recibida, r.pet.hora, r.pet.zona);
      const soloInvitaciones = r.pet.n === 17;
      const { rows } = await c.query(
        `SELECT k.asunto, to_char(k.enviada_en AT TIME ZONE $4, 'YYYY-MM-DD') AS fecha
           FROM plataforma.notificaciones n JOIN crm.comunicaciones k ON k.id::text = n.origen_id
          WHERE n.origen_modulo = 'comunicaciones' AND n.persona_id = $1 AND n.estado = 'enviada'
            AND k.enviada_en > $2::timestamptz AND k.enviada_en < $3::timestamptz
            AND k.finalidad <> 'emergencia' AND (NOT $5 OR k.finalidad = 'convocatoria')
          ORDER BY k.enviada_en`, [r.t.id, desde, r.t.revocadaInstante ?? r.instante, r.pet.zona, soloInvitaciones]);
      r.t.recibidos = rows.map(x => `el del ${diaMes(x.fecha)} («${x.asunto}»)`);
      if (!rows.length) avisos.push(`Petición ${r.pet.n}: al titular no le llegó ningún correo en el periodo que reclama.`);
      await responder(r);
    }

    /* ── 5 · Hoy ─────────────────────────────────────────────────────── */
    // 5.a Bogotá Norte salió temprano: todo bien, salvo una dirección que el proveedor rechazó.
    const kN = hoyPor['BOG-NORTE'];
    if (kN) {
      const t0 = deHoy('07:10', kN.s.zona_horaria, 180);
      await enviar(kN, t0);
      await trabajar(kN, { definitivos: 1 });
      await ajustarTiempos(kN, t0);
    }
    // 5.b Cali, a media mañana: a mitad de la tanda el proveedor llegó a su cupo diario (429) y
    //     dijo cuándo volver (a medianoche). Esos avisos esperan reintento: no se pierden.
    const kC = hoyPor.CALI;
    if (kC) {
      const t1 = deHoy('09:40', kC.s.zona_horaria, 120);
      await enviar(kC, t1);
      await trabajar(kC, { cupo: 0.4 });
      await ajustarTiempos(kC, t1);
    }
    // 5.c La dirección pone el freno de envíos masivos mientras Sistemas revisa el cupo. Medellín
    //     intenta enviar su vigilia en ese rato y la base lo detiene. Después se quita el freno.
    await autor(dg.persona_id);
    await c.query(`SELECT sistema.cambiar_freno('comunicaciones_masivas', true, $1)`,
      ['El proveedor de correo empezó a responder 429 (cupo diario) desde las 9:40. Se detienen los envíos masivos mientras Sistemas confirma que la cola no pierde nada.']);
    const kM = hoyPor.MED;
    if (kM) {
      await autor(kM.quienEnvia.id);
      await c.query('SAVEPOINT freno');
      try {
        await c.query(`SELECT crm.enviar_comunicacion($1)`, [kM.id]);
        await c.query('ROLLBACK TO SAVEPOINT freno');
        defectos.push('Con el freno de envíos masivos puesto, crm.enviar_comunicacion encoló igual.');
      } catch (e) {
        await c.query('ROLLBACK TO SAVEPOINT freno');
        if (!/freno/i.test(e.message)) throw e;
        conteo.envios_detenidos_por_el_freno = 1;
      }
      await c.query('RELEASE SAVEPOINT freno');
    }
    await autor(dg.persona_id);
    await c.query(`SELECT sistema.cambiar_freno('comunicaciones_masivas', false, $1)`,
      ['Sistemas confirmó con el proveedor que el cupo se renueva a medianoche y que la cola espera sin perder avisos. Se reanudan los envíos.']);

    // 5.d La revocatoria de hoy: quien la pidió el viernes tenía un correo de Cali esperando en la cola.
    const pet31 = deHoyPet[31];
    if (pet31 && kC) {
      const { rows: enCola } = await c.query(
        `SELECT persona_id FROM plataforma.notificaciones
          WHERE origen_modulo = 'comunicaciones' AND origen_id = $1 AND estado = 'pendiente' AND persona_id IS NOT NULL
          ORDER BY destinatario`, [kC.id]);
      const posibles = enCola.map(x => poolPorId.get(x.persona_id)).filter(p => p && !usadosTit.has(p.id));
      if (posibles.length) {
        const azP = azar.derivar('peticion-31');
        const t = { ...azP.elegir(posibles) };
        usadosTit.add(t.id);
        pet31.id = azP.uuid();
        pet31.radicado = `HD-${pet31.recibida.replace(/-/g, '')}-${azP.hex(6)}`;
        pet31.responsable = responsables[pet31.n % responsables.length];
        pet31.zona = sedePorCodigo[t.sede].zona_horaria;
        t.nombreCompleto = d.nombreCompleto(t);
        t.contacto = contactoDe(pet31, t);
        pet31.t = t;
        await autor(pet31.responsable, 'Radicación de una petición de Habeas Data');
        const { rows: [r] } = await c.query(
          `INSERT INTO plataforma.peticiones_titular
             (id, radicado, tipo, titular_id, titular_nombre, titular_documento, titular_contacto, detalle, canal,
              recibida_en, responsable_id, sede_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING to_char(vence_en, 'YYYY-MM-DD') AS vence`,
          [pet31.id, pet31.radicado, pet31.tipo, t.id, t.nombreCompleto,
           t.numero_documento ? `${t.tipo_documento ?? 'CC'} ${t.numero_documento}` : null,
           t.contacto, pet31.detalle(t), pet31.canal, momentoLocal(pet31.recibida, pet31.hora, pet31.zona),
           pet31.responsable, t.sede_id]);
        pet31.vence = r.vence;
        const paso = pet31.pasos[0];
        await autor(pet31.responsable, 'Revocatoria pedida por el titular');
        const { rows: [rv] } = await c.query(
          `SELECT plataforma.revocar_consentimiento($1, $2::plataforma.canal_contacto, $3, $4) AS n`,
          [t.id, paso.canal, paso.finalidad, `Petición de Habeas Data ${pet31.radicado}`]);
        conteo.actos_de_revocacion_de_hoy = rv.n;
        await c.query(
          `UPDATE plataforma.peticiones_titular SET estado = 'atendida', respuesta = $2, evidencia = $3, respondida_en = now() WHERE id = $1`,
          [pet31.id, paso.respuesta(t), `Respuesta entregada en la sede de ${sedePorCodigo[t.sede].nombre} hoy, con firma de recibido.`]);
        peticiones.push(pet31);
      } else {
        avisos.push('Petición 31: no quedó nadie de la cola de Cali que pudiera ser titular; no se radicó.');
      }
    }

    // 5.e La supresión de hoy, con la función de la base (la ejecuta quien tiene N4).
    const pet30 = deHoyPet[30];
    if (pet30?.id && !pet30.t?.esSaliente) {
      // Solo se suprime a quien ya se fue de la red: nunca a alguien que otros módulos siguen usando.
      avisos.push('Petición 30: no había nadie que se hubiera ido de la red; la supresión queda recibida, sin ejecutar.');
    } else if (pet30?.id) {
      await autor(dg.persona_id, 'Supresión pedida por el titular');
      const { rows: [sx] } = await c.query(`SELECT plataforma.ejecutar_supresion($1, $2) AS r`, [pet30.id, dg.persona_id]);
      conteo.supresiones_ejecutadas_hoy = sx.r ? 1 : 0;
    }

    // 5.f Medellín envía su vigilia con el freno ya quitado: queda en cola, sin tomar todavía.
    if (kM) await enviar(kM, null);
    await autor(dg.persona_id);

    /* ── 6 · El comité de accesos de hoy ────────────────────────────────
       Con identidad.recertificar, que exige nota y no deja firmar el propio
       acceso. Revisa la región Colombia y termina la región Bogotá (los
       cargos que nacieron después del comité de la mañana, como los de
       RocaKids). Cúcuta, Neiva, Santa Marta y Armenia quedan para el próximo
       comité, y la región internacional también, salvo Miami. A quien sirve
       con menores y tiene los antecedentes vencidos no se le firma: queda
       en la lista hasta que los renueve. */
    const APLAZADAS = ['CUC', 'NVA', 'SMR', 'ARM'];
    const { rows: porRevisar } = await c.query(
      `SELECT v.asignacion_id, v.persona_id, v.rol, s.codigo AS sede, r.codigo AS region,
              (EXISTS (SELECT 1 FROM identidad.roles_con_menores m WHERE m.rol = v.rol)
               AND NOT talento.apto_para_menores(v.persona_id)) AS sin_antecedentes
         FROM identidad.v_accesos_por_recertificar v
         JOIN identidad.asignaciones a ON a.id = v.asignacion_id
         JOIN nucleo.personas p ON p.id = v.persona_id
         JOIN org.sedes s ON s.id = COALESCE(CASE WHEN a.alcance_tipo = 'sede' THEN a.alcance_id END, p.sede_id)
         JOIN org.unidades r ON r.id = s.unidad_id
        WHERE v.vencido AND ((r.codigo IN ('REG-COL', 'REG-BOG') AND s.codigo <> ALL($1::text[])) OR s.codigo = 'MIA')
        ORDER BY s.codigo, v.rol, v.asignacion_id`, [APLAZADAS]);
    const NOTA = {
      LIDER_GRUPO: 'lidera un grupo que se reúne y reporta su asistencia; el acceso se mantiene.',
      MAESTRO_ROCAKIDS: 'sirve en RocaKids con los antecedentes vigentes y verificados.',
      DIRECTOR_ROCAKIDS: 'dirige RocaKids en la sede, con los antecedentes vigentes y verificados.',
      DIRECTOR_SEGMENTO: 'acompaña su segmento y revisa su asistencia; el acceso se mantiene.',
      COORDINADOR_SEGMENTO: 'coordina su segmento cada semana; el acceso se mantiene.',
      ASISTENCIA_REGISTRO: 'registra la asistencia de los servicios del domingo.',
      LIDER_DE_ORACION: 'dirige el equipo de intercesión y reparte las peticiones.',
      PERSONA_QUE_ORA: 'sirve en el equipo de intercesión y ora por las peticiones que se le asignan.',
      PASTOR_CONGREGACIONAL: 'pastorea la sede con su cónyuge; el acceso corresponde al cargo y lo usa a diario.',
      SECRETARIA: 'sigue en la secretaría de la sede y usa el acceso a diario.',
      TESORERIA: 'sigue a cargo de la tesorería y firma el cierre mensual con este acceso.',
      DIGITADOR_APORTES: 'digita los aportes de cada domingo; la tesorería confirma que el acceso se usa.',
      CONSEJERO: 'tiene casos de consejería abiertos en la sede; el acceso se mantiene.',
      COORDINADOR_NUEVOS: 'coordina la bienvenida de los nuevos y hace los primeros contactos.',
    };
    const sedesRevisadas = [...new Set(porRevisar.map(x => x.sede))];
    let recert = 0;
    for (const a of porRevisar) {
      if (a.sin_antecedentes) { conteo.recertificacion_frenada_por_antecedentes = (conteo.recertificacion_frenada_por_antecedentes ?? 0) + 1; continue; }
      let firmante = sedesRevisadas.indexOf(a.sede) % 2 === 0 ? dg.persona_id : esposaDG.persona_id;
      if (firmante === a.persona_id) firmante = firmante === dg.persona_id ? esposaDG.persona_id : dg.persona_id;
      const origen = a.sede === 'MIA' ? `Revisión de Miami en la visita de la dirección, ${conAnio(HOY)}`
        : `Comité de accesos de la región ${a.region === 'REG-BOG' ? 'Bogotá y Sabana' : 'Colombia'}, ${conAnio(HOY)}`;
      await autor(firmante, 'Comité de accesos');
      await c.query(`SELECT identidad.recertificar($1, 'se_mantiene', $2)`,
        [a.asignacion_id, `${origen}: ${NOTA[a.rol] ?? 'sigue en el cargo y usa el acceso que tiene.'}`]);
      recert++;
    }
    conteo.accesos_recertificados_hoy = recert;
    await autor(dg.persona_id);

    if (avisos.length) for (const a of avisos) console.log(`   · ${a}`);
    if (defectos.length) for (const a of defectos) console.log(`   ⛔ ${a}`);
  });

  /* ── 7 · Lo que quedó ─────────────────────────────────────────────── */
  const cuenta = async (sql) => Object.fromEntries((await c.query(sql)).rows.map(r => [r.k, Number(r.n)]));
  const com = await cuenta(`SELECT estado AS k, count(*) AS n FROM crm.comunicaciones GROUP BY 1`);
  const noti = await cuenta(`SELECT CASE WHEN estado = 'pendiente' AND proximo_intento > now() THEN 'esperando reintento' ELSE estado::text END AS k,
                                    count(*) AS n FROM plataforma.notificaciones GROUP BY 1`);
  const pet = await cuenta(`SELECT estado AS k, count(*) AS n FROM plataforma.peticiones_titular GROUP BY 1`);
  const { rows: [v] } = await c.query(
    `SELECT count(*) FILTER (WHERE estado NOT IN ('atendida','rechazada') AND vence_en < CURRENT_DATE) AS vencidas,
            count(*) FILTER (WHERE respondida_en::date > vence_en) AS fuera_de_plazo FROM plataforma.peticiones_titular`);
  const { rows: [rc] } = await c.query(
    `SELECT count(*) FILTER (WHERE vencido) AS vencidos, count(*) AS vigentes FROM identidad.v_accesos_por_recertificar`);
  const suma = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const salida = {
    'crm.comunicaciones': suma(com),
    '  borrador / aprobada / enviada / cancelada': ['borrador', 'aprobada', 'enviada', 'cancelada'].map(e => com[e] ?? 0).join(' / '),
    '  devueltas a borrador y corregidas': conteo.devueltas_y_corregidas ?? 0,
    '  envíos detenidos por el freno': conteo.envios_detenidos_por_el_freno ?? 0,
    'plataforma.notificaciones': suma(noti),
    '  enviada / en cola / esperando reintento': ['enviada', 'pendiente', 'esperando reintento'].map(e => noti[e] ?? 0).join(' / '),
    '  fallida / descartada': ['fallida', 'descartada'].map(e => noti[e] ?? 0).join(' / '),
    '  de otros módulos: enviados / rechazados': `${otrosModulos.enviados} / ${otrosModulos.rechazados}`,
    'plataforma.peticiones_titular': suma(pet),
    '  recibida / en trámite / prorrogada': ['recibida', 'en_tramite', 'prorrogada'].map(e => pet[e] ?? 0).join(' / '),
    '  atendida / rechazada': ['atendida', 'rechazada'].map(e => pet[e] ?? 0).join(' / '),
    '  vencidas sin responder': Number(v.vencidas),
    '  respondidas fuera de plazo': Number(v.fuera_de_plazo),
    '  prórrogas con motivo': conteo.prorrogas ?? 0,
    '  supresiones ejecutadas hoy': conteo.supresiones_ejecutadas_hoy ?? 0,
    'plataforma.consentimientos (revocatorias)': (conteo.actos_de_revocacion_por_habeas_data ?? 0) + Number(conteo.actos_de_revocacion_de_hoy ?? 0),
    'identidad.recertificaciones (hoy, este archivo)': conteo.accesos_recertificados_hoy ?? 0,
    '  sin firmar por antecedentes vencidos': conteo.recertificacion_frenada_por_antecedentes ?? 0,
    '  accesos vencidos / vigentes': `${rc.vencidos} / ${rc.vigentes}`,
  };
  return salida;
});
