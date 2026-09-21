'use strict';
/**
 * =====================================================================
 * 00-red.js · EL NÚCLEO DE LA RED DE DEMOSTRACIÓN DE CASAROCA
 *
 * ⛔ SOLO DEMOSTRACIÓN. Inventa la red completa de Casa Sobre la Roca para
 *    que las pantallas se vean vivas y las pruebas de punta a punta tengan
 *    con qué trabajar. Ninguna persona es real y nada de esto va a
 *    producción: la guarda de comun.js lo impide.
 *
 * Lo que deja, por las reglas de la base y no alrededor de ellas:
 *   1. La red de 36 iglesias: las 6 de la semilla y 30 nuevas creadas con
 *      sistema.crear_iglesia (la única vía válida), colgadas de su región,
 *      con su zona horaria, sus ministerios, sus segmentos y sus módulos
 *      (los de compuerta legal se encienden con sistema.habilitar_modulo y
 *      su evidencia).
 *   2. ~4.100 personas en familias: parejas, hijos menores con acudiente
 *      principal (y a veces un segundo acudiente), jóvenes, adultos
 *      mayores, visitantes, inactivos, fallecidos, trasladados con su
 *      historia (nucleo.trasladar), servidores de plantaciones, traslados
 *      en curso, duplicados por fusionar (nucleo.fusionar) y
 *      consentimientos por canal y finalidad con fecha pasada y evidencia.
 *   3. Roles con alcance por sede, siempre con la pareja pastoral, dados
 *      con identidad.otorgar_asignacion; la dirección general, los equipos
 *      de la central y las parejas supervisoras de cada región.
 *   4. Cuentas de acceso (identidad.crear_cuenta) con la clave de
 *      laboratorio y sin segundo factor activo; el comité de accesos del
 *      día recertifica la región Bogotá (identidad.recertificar).
 *
 * Corre en UNA transacción: o queda todo, o no queda nada.
 * Uso: PGDATABASE=cr_e2e_60 node backend/db/demostracion/00-red.js
 * =====================================================================
 */
const path = require('path');
const d = require('./comun');
const {
  FECHA_REFERENCIA: HOY, AYER, SISTEMA, SALIDAS_POR_OLA, CLAVE_LABORATORIO,
  sumarDias, sumarAnios, sumarMeses, diasEntre, edad, momentoLocal, minFecha, maxFecha,
  nombrePara, apellidoAzar, apodoDe, correoNuevo, telefonoNuevo, documentoNuevo, slug,
  insertarLote, fijarAutor, enTransaccion,
} = d;

/* La derivación de la clave es la de la API: la misma que usa token-para.js. */
const { derivarClave } = require(path.join(__dirname, '..', '..', 'api', 'dist', 'src', 'auth', 'clave.js'));

/* ─────────────────────────────────────────────────────────────────────
   LA RED: 36 IGLESIAS
   meta = personas que tendrá la sede (grandes de 250 a 400, pequeñas de
   40 a 80). fundada = desde cuándo congrega gente ahí (historia de las
   membresías). madre = de dónde salen su equipo fundador y sus servidores.
   ───────────────────────────────────────────────────────────────────── */
const SEDES = [
  // ── Las seis de la semilla (se conservan: solo se completan) ──
  { codigo: 'BOG-CHICO', nombre: 'Bogotá Chicó', tipo: 'sede_madre', pais: 'CO', ciudad: 'Bogotá', region: 'REG-BOG', ola: 1, fundada: '1998-03-01', meta: 380, semilla: true },
  { codigo: 'BOG-NORTE', nombre: 'Bogotá Norte', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Bogotá', region: 'REG-BOG', ola: 2, fundada: '2006-02-12', meta: 340, semilla: true },
  { codigo: 'MED', nombre: 'Medellín', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Medellín', region: 'REG-COL', ola: 3, fundada: '2008-08-10', meta: 310, semilla: true },
  { codigo: 'PTY', nombre: 'Panamá', tipo: 'filial_internacional', pais: 'PA', ciudad: 'Ciudad de Panamá', region: 'REG-INT', ola: 5, fundada: '2014-05-18', meta: 110, semilla: true },
  { codigo: 'BCN', nombre: 'Barcelona', tipo: 'filial_internacional', pais: 'ES', ciudad: 'Barcelona', region: 'REG-INT', ola: 5, fundada: '2017-09-24', meta: 85, semilla: true },
  { codigo: 'CHIA', nombre: 'Chía', tipo: 'plantacion', pais: 'CO', ciudad: 'Chía', region: 'REG-BOG', ola: 4, fundada: '2024-08-18', meta: 55, semilla: true, madre: 'BOG-NORTE' },
  // ── Región Bogotá y Sabana ──
  { codigo: 'BOG-SUR', nombre: 'Bogotá Sur', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Bogotá', region: 'REG-BOG', ola: 2, fundada: '2012-04-15', meta: 265 },
  { codigo: 'BOG-OCC', nombre: 'Bogotá Occidente', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Bogotá', region: 'REG-BOG', ola: 2, fundada: '2015-07-19', meta: 140 },
  { codigo: 'BOG-SUBA', nombre: 'Bogotá Suba', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Bogotá', region: 'REG-BOG', ola: 2, fundada: '2018-03-04', meta: 115 },
  { codigo: 'SOACHA', nombre: 'Soacha', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Soacha', region: 'REG-BOG', ola: 2, fundada: '2019-10-06', meta: 75 },
  { codigo: 'ZIPA', nombre: 'Zipaquirá', tipo: 'plantacion', pais: 'CO', ciudad: 'Zipaquirá', region: 'REG-BOG', ola: 4, fundada: '2025-06-01', meta: 48, madre: 'BOG-NORTE' },
  { codigo: 'FUNZA', nombre: 'Funza', tipo: 'plantacion', pais: 'CO', ciudad: 'Funza', region: 'REG-BOG', ola: 4, fundada: '2025-10-12', meta: 42, madre: 'BOG-OCC' },
  { codigo: 'CAJICA', nombre: 'Cajicá', tipo: 'plantacion', pais: 'CO', ciudad: 'Cajicá', region: 'REG-BOG', ola: 4, fundada: '2025-03-09', meta: 45, madre: 'BOG-CHICO' },
  // ── Región Colombia ──
  { codigo: 'CALI', nombre: 'Cali', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Cali', region: 'REG-COL', ola: 3, fundada: '2009-05-24', meta: 285 },
  { codigo: 'BAQ', nombre: 'Barranquilla', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Barranquilla', region: 'REG-COL', ola: 3, fundada: '2011-02-20', meta: 250 },
  { codigo: 'BGA', nombre: 'Bucaramanga', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Bucaramanga', region: 'REG-COL', ola: 3, fundada: '2013-06-09', meta: 150 },
  { codigo: 'ENV', nombre: 'Envigado', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Envigado', region: 'REG-COL', ola: 3, fundada: '2013-09-15', meta: 100 },
  { codigo: 'BELLO', nombre: 'Bello', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Bello', region: 'REG-COL', ola: 3, fundada: '2018-04-22', meta: 80 },
  { codigo: 'CTG', nombre: 'Cartagena', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Cartagena', region: 'REG-COL', ola: 4, fundada: '2016-01-17', meta: 100 },
  { codigo: 'PEI', nombre: 'Pereira', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Pereira', region: 'REG-COL', ola: 4, fundada: '2014-03-16', meta: 95 },
  { codigo: 'MZL', nombre: 'Manizales', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Manizales', region: 'REG-COL', ola: 4, fundada: '2017-08-13', meta: 70 },
  { codigo: 'ARM', nombre: 'Armenia', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Armenia', region: 'REG-COL', ola: 4, fundada: '2019-02-10', meta: 60 },
  { codigo: 'IBG', nombre: 'Ibagué', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Ibagué', region: 'REG-COL', ola: 4, fundada: '2016-10-09', meta: 80 },
  { codigo: 'VVC', nombre: 'Villavicencio', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Villavicencio', region: 'REG-COL', ola: 4, fundada: '2015-11-22', meta: 90 },
  { codigo: 'NVA', nombre: 'Neiva', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Neiva', region: 'REG-COL', ola: 4, fundada: '2020-02-16', meta: 55 },
  { codigo: 'SMR', nombre: 'Santa Marta', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Santa Marta', region: 'REG-COL', ola: 4, fundada: '2018-07-29', meta: 65 },
  { codigo: 'CUC', nombre: 'Cúcuta', tipo: 'filial_nacional', pais: 'CO', ciudad: 'Cúcuta', region: 'REG-COL', ola: 4, fundada: '2017-05-14', meta: 85 },
  { codigo: 'PSO', nombre: 'Pasto', tipo: 'plantacion', pais: 'CO', ciudad: 'Pasto', region: 'REG-COL', ola: 4, fundada: '2024-11-10', meta: 44, madre: 'CALI' },
  { codigo: 'MTR', nombre: 'Montería', tipo: 'plantacion', pais: 'CO', ciudad: 'Montería', region: 'REG-COL', ola: 4, fundada: '2025-05-18', meta: 46, madre: 'BAQ' },
  { codigo: 'TUN', nombre: 'Tunja', tipo: 'plantacion', pais: 'CO', ciudad: 'Tunja', region: 'REG-COL', ola: 4, fundada: '2025-08-24', meta: 40, madre: 'BOG-NORTE' },
  { codigo: 'POP', nombre: 'Popayán', tipo: 'plantacion', pais: 'CO', ciudad: 'Popayán', region: 'REG-COL', ola: 4, fundada: '2026-02-15', meta: 42, madre: 'CALI' },
  // ── Región Internacional ──
  { codigo: 'MIA', nombre: 'Miami', tipo: 'filial_internacional', pais: 'US', ciudad: 'Miami', region: 'REG-INT', ola: 5, fundada: '2015-04-12', meta: 120, zona: 'America/New_York' },
  { codigo: 'ORL', nombre: 'Orlando', tipo: 'filial_internacional', pais: 'US', ciudad: 'Orlando', region: 'REG-INT', ola: 5, fundada: '2019-06-16', meta: 65, zona: 'America/New_York' },
  { codigo: 'HOU', nombre: 'Houston', tipo: 'filial_internacional', pais: 'US', ciudad: 'Houston', region: 'REG-INT', ola: 5, fundada: '2021-03-21', meta: 55, zona: 'America/Chicago' },
  { codigo: 'MAD', nombre: 'Madrid', tipo: 'filial_internacional', pais: 'ES', ciudad: 'Madrid', region: 'REG-INT', ola: 5, fundada: '2016-11-20', meta: 95 },
  { codigo: 'NYC', nombre: 'Nueva York', tipo: 'plantacion', pais: 'US', ciudad: 'Nueva York', region: 'REG-INT', ola: 5, fundada: '2026-04-19', meta: 40, zona: 'America/New_York', madre: 'MIA' },
];

const ZONA_PAIS = { CO: 'America/Bogota', PA: 'America/Panama', ES: 'Europe/Madrid', US: 'America/New_York' };
const PLANTILLA = { filial_nacional: 'FILIAL', filial_internacional: 'INTERNAC', plantacion: 'PLANTACION' };
const PAIS_NOMBRE = { CO: 'Colombia', PA: 'Panamá', ES: 'España', US: 'Estados Unidos' };
const NACIONALIDAD = { CO: 'colombiana', VE: 'venezolana', ES: 'española', PA: 'panameña', US: 'estadounidense', EC: 'ecuatoriana', PE: 'peruana' };

/** Barrios, localidades y comunas por sede (el campo «zona» de la ficha). */
const ZONAS = {
  'BOG-CHICO': ['Chapinero', 'Usaquén', 'Teusaquillo', 'Barrios Unidos', 'Chicó Norte', 'Rosales', 'Santa Bárbara', 'La Soledad'],
  'BOG-NORTE': ['Usaquén', 'Cedritos', 'Colina Campestre', 'Mazurén', 'Toberín', 'San Cristóbal Norte', 'Suba', 'Villa Magdala'],
  'BOG-SUR': ['Kennedy', 'Bosa', 'Tunjuelito', 'Ciudad Bolívar', 'Rafael Uribe Uribe', 'Usme', 'Timiza', 'Patio Bonito'],
  'BOG-OCC': ['Fontibón', 'Engativá', 'Modelia', 'Hayuelos', 'Castilla', 'Puente Aranda', 'Normandía'],
  'BOG-SUBA': ['Suba', 'Niza', 'La Gaitana', 'Tibabuyes', 'Pinar', 'Prado Veraniego'],
  SOACHA: ['Ciudad Verde', 'San Mateo', 'León XIII', 'Compartir', 'Ciudadela Sucre', 'Hogares Soacha'],
  CHIA: ['Centro', 'Fonquetá', 'Samaria', 'La Balsa', 'Bojacá'],
  ZIPA: ['Centro', 'San Pablo', 'La Esmeralda', 'Algarra'],
  FUNZA: ['Centro', 'El Hato', 'Serrezuela', 'Villa Paula'],
  CAJICA: ['Centro', 'Capellanía', 'Granjitas', 'Rincón Santo'],
  MED: ['El Poblado', 'Laureles-Estadio', 'Belén', 'Robledo', 'Buenos Aires', 'La América', 'Castilla', 'Aranjuez', 'Guayabal'],
  ENV: ['Zúñiga', 'El Dorado', 'La Magnolia', 'Alcalá', 'Las Vegas', 'El Esmeraldal'],
  BELLO: ['Niquía', 'Cabañas', 'Madera', 'París', 'Santa Ana', 'La Cumbre'],
  CALI: ['San Fernando', 'Ciudad Jardín', 'El Ingenio', 'Granada', 'Santa Mónica', 'Pance', 'Chipichape', 'Valle del Lili'],
  BAQ: ['Riomar', 'Alto Prado', 'Villa Country', 'El Prado', 'Boston', 'Ciudad Jardín', 'Las Palmas'],
  BGA: ['Cabecera del Llano', 'Provenza', 'Lagos del Cacique', 'Sotomayor', 'San Alonso', 'Real de Minas'],
  CTG: ['Manga', 'Bocagrande', 'Crespo', 'El Bosque', 'Pie de la Popa', 'Los Alpes'],
  PEI: ['Pinares', 'Álamos', 'Cuba', 'Centro', 'Boston', 'El Jardín'],
  MZL: ['Palermo', 'Chipre', 'La Enea', 'Milán', 'San Jorge'],
  ARM: ['Centro', 'La Castellana', 'El Bosque', 'Fundadores', 'La Clarita'],
  IBG: ['Cádiz', 'La Pola', 'Picaleña', 'El Jordán', 'Ambalá'],
  VVC: ['Barzal', 'La Esperanza', 'Buque', 'El Caudal', 'Porfía', 'La Grama'],
  NVA: ['Altico', 'Quebradita', 'Cándido', 'Ipanema', 'Las Granjas'],
  SMR: ['Rodadero', 'Bastidas', 'Mamatoco', 'Pescaíto', 'Bavaria'],
  CUC: ['La Riviera', 'Caobos', 'Quinta Oriental', 'Atalaya', 'La Libertad', 'Prados del Este'],
  PSO: ['Centro', 'Las Cuadras', 'Pandiaco', 'Anganoy'],
  MTR: ['La Castellana', 'El Recreo', 'La Granja', 'Mocarí'],
  TUN: ['Centro', 'Las Nieves', 'Santa Inés', 'Los Muiscas'],
  POP: ['Centro', 'Bello Horizonte', 'La Paz', 'Pubenza'],
  PTY: ['San Francisco', 'Bella Vista', 'El Cangrejo', 'Costa del Este', 'Condado del Rey', 'Betania', 'Juan Díaz'],
  BCN: ['Sants-Montjuïc', 'Nou Barris', 'Sant Martí', "L'Eixample", 'Horta-Guinardó', 'Gràcia'],
  MAD: ['Tetuán', 'Usera', 'Carabanchel', 'Latina', 'Ciudad Lineal', 'Chamartín'],
  MIA: ['Doral', 'Kendall', 'Hialeah', 'Brickell', 'Weston', 'Coral Gables'],
  ORL: ['Kissimmee', 'Lake Nona', 'Winter Park', 'Hunters Creek', 'Dr. Phillips'],
  HOU: ['Katy', 'Sugar Land', 'Westchase', 'Gulfton', 'Spring'],
  NYC: ['Queens', 'Jackson Heights', 'Elmhurst', 'Corona', 'Astoria'],
};

const CALLES = {
  PA: ['Calle 50', 'Vía España', 'Avenida Balboa', 'Calle 74, San Francisco', 'Vía Porras', 'Avenida Ricardo J. Alfaro', 'Calle Uruguay'],
  PA_EDIF: ['Torres del Mar', 'Coral', 'Bahía', 'Los Robles', 'Altamira', 'Mirador', 'Brisas del Golf'],
  BCN: ['Carrer de Sants', 'Carrer de Mallorca', "Carrer d'Aragó", 'Carrer de Provença', 'Carrer de València', 'Carrer de Pujades', 'Via Júlia'],
  MAD: ['Calle de Bravo Murillo', 'Calle de Alcalá', 'Calle del General Ricardos', 'Calle de Marcelo Usera', 'Calle de Arturo Soria', 'Avenida de Oporto'],
  US: { MIA: ['NW 8th St', 'SW 107th Ave', 'W 49th St', 'Coral Way', 'Kendall Dr', 'NW 41st St'],
    ORL: ['International Dr', 'John Young Pkwy', 'Kirkman Rd', 'Narcoossee Rd', 'Vineland Ave'],
    HOU: ['Westheimer Rd', 'Bellaire Blvd', 'Gessner Rd', 'Richmond Ave', 'Fondren Rd'],
    NYC: ['Roosevelt Ave', '37th Ave', 'Junction Blvd', 'Northern Blvd', 'Broadway'] },
};

const IGLESIAS_ANTERIORES = ['Iglesia Cristiana El Camino', 'Comunidad Bíblica Nueva Vida', 'Iglesia Pentecostal Monte Sion',
  'Parroquia de San José', 'Centro Cristiano Emanuel', 'Iglesia Evangélica La Gracia', 'Tabernáculo de Fe',
  'Iglesia Bautista Horeb', 'Comunidad Cristiana Betel', 'Ministerio Fuente de Vida', 'Parroquia Nuestra Señora del Carmen',
  'Iglesia Menonita del Sur', 'Casa de Oración Rehobot', 'Iglesia Adventista del barrio'];

const COMIDAS = ['Ajiaco', 'Bandeja paisa', 'Arroz con pollo', 'Sancocho de gallina', 'Lasaña', 'Empanadas', 'Tamal',
  'Arepa de huevo', 'Patacón con hogao', 'Ceviche', 'Pescado frito con arroz de coco', 'Sushi', 'Hamburguesa',
  'Mondongo', 'Lechona', 'Posta negra', 'Changua', 'Pizza', 'Tortilla de patatas', 'Paella', 'Arroz atollado'];

const LUGARES_FUERA = ['Tuluá', 'Sogamoso', 'Girardot', 'Riohacha', 'Quibdó', 'Florencia', 'Yopal', 'Leticia', 'Lima',
  'Santiago de Chile', 'Toronto', 'Buenos Aires', 'Guayaquil', 'Valencia (España)'];

/* Pesos de los tipos de hogar según la clase de sede. */
const PESOS_HOGAR = {
  colombia: { pareja_con_hijos: 34, pareja_sin_hijos: 10, madre_sola: 10, padre_solo: 2, joven_solo: 17, adulto_solo: 10, mayor_solo: 6, pareja_mayor: 6, tres_generaciones: 5 },
  exterior: { pareja_con_hijos: 30, pareja_sin_hijos: 14, madre_sola: 8, padre_solo: 2, joven_solo: 22, adulto_solo: 16, mayor_solo: 2, pareja_mayor: 3, tres_generaciones: 3 },
  plantacion: { pareja_con_hijos: 38, pareja_sin_hijos: 14, madre_sola: 8, padre_solo: 2, joven_solo: 22, adulto_solo: 10, mayor_solo: 2, pareja_mayor: 2, tres_generaciones: 2 },
};

/* Ministerios por clase de sede: [código, probabilidad]. BOG-CHICO ya los tiene todos. */
const MINISTERIOS_POR_PERFIL = {
  grande: [['NICODEMO', 1], ['ROCAKIDS', 1], ['TMT', 1], ['MUJER_INTEGRAL', 1], ['HOMBRES_BIEN', 1], ['CASA2', 1],
    ['DORADOS', 1], ['CONSEJERIA', 1], ['J25', 1], ['JOSUES', 0.9], ['AMEC', 0.8], ['EJECUTIVOS', 0.8],
    ['CENTURIONES', 0.5], ['ALABANZA', 1], ['UJIERES', 1], ['VISA', 1], ['CREATIVO', 1], ['CURSOS_CORTOS', 1],
    ['INSTITUTO', 1], ['TESORERIA', 1], ['CONTABLE', 0.8], ['COMUNICACIONES', 1], ['SEGURIDAD', 1],
    ['TECNOLOGIA', 0.7], ['CULTURA', 0.6], ['TALENTO_HUMANO', 0.4]],
  mediana: [['NICODEMO', 1], ['ROCAKIDS', 1], ['TMT', 1], ['MUJER_INTEGRAL', 1], ['HOMBRES_BIEN', 1], ['CASA2', 1],
    ['DORADOS', 0.8], ['CONSEJERIA', 1], ['J25', 0.6], ['JOSUES', 0.5], ['AMEC', 0.3], ['EJECUTIVOS', 0.4],
    ['CENTURIONES', 0.15], ['ALABANZA', 1], ['UJIERES', 1], ['VISA', 0.9], ['CREATIVO', 0.6], ['CURSOS_CORTOS', 1],
    ['INSTITUTO', 0.5], ['TESORERIA', 1], ['COMUNICACIONES', 0.6], ['SEGURIDAD', 0.4]],
  pequena: [['NICODEMO', 1], ['ROCAKIDS', 1], ['TMT', 1], ['MUJER_INTEGRAL', 1], ['HOMBRES_BIEN', 0.8], ['CASA2', 0.8],
    ['DORADOS', 0.4], ['CONSEJERIA', 1], ['ALABANZA', 1], ['UJIERES', 1], ['VISA', 0.4], ['CURSOS_CORTOS', 1],
    ['TESORERIA', 1]],
  plantacion: [['NICODEMO', 1], ['ALABANZA', 1], ['CURSOS_CORTOS', 1], ['MUJER_INTEGRAL', 0.6], ['CASA2', 0.4],
    ['UJIERES', 0.5]],
};

/* Los equipos de la central: cuántos integrantes además del líder. EQ-KIDS
   queda vacío a propósito: su rol (DIRECTOR_ROCAKIDS) exige antecedentes y
   lo puebla RocaKids. */
const EQUIPOS = [
  { unidad: 'EQ-FIN', integrantes: 3 }, { unidad: 'EQ-TH', integrantes: 2 }, { unidad: 'EQ-LEGAL', integrantes: 1 },
  { unidad: 'EQ-COM', integrantes: 2 }, { unidad: 'EQ-PROD', integrantes: 3 }, { unidad: 'EQ-TI', integrantes: 2 },
  { unidad: 'EQ-FORM', integrantes: 2 }, { unidad: 'EQ-MIS', integrantes: 1 }, { unidad: 'EQ-CONST', integrantes: 1 },
];
const DIRECCIONES = [
  { unidad: 'DIR-ADMIN', equipo: 'EQ-FIN' }, { unidad: 'DIR-COM', equipo: 'EQ-COM' }, { unidad: 'DIR-TEC', equipo: 'EQ-TI' },
  { unidad: 'DIR-PAST', equipo: 'EQ-FORM' }, { unidad: 'DIR-PROY', equipo: 'EQ-CONST' },
];
const SUPERVISION = { 'REG-BOG': 'BOG-CHICO', 'REG-COL': 'MED', 'REG-INT': 'MIA' };

/* Los módulos de compuerta legal que quedan APAGADOS a propósito (con su motivo). */
const COMPUERTA_PENDIENTE = {
  HOU: { aportes: 'Falta el concepto tributario de Texas para recibir aportes: la central lo pidió en agosto.' },
  MAD: { rocakids: 'Faltan los certificados de delitos sexuales de los maestros de Madrid: RocaKids espera.' },
};
/* Sedes con obra en curso: se les enciende Construcción. */
const CON_OBRA = ['BOG-SUR', 'CALI', 'MED', 'BAQ', 'VVC'];

/* Personal anterior (asignación vencida y cuenta suspendida): sede → rol. */
const ANTERIORES = { CALI: 'SECRETARIA', BAQ: 'TESORERIA', MED: 'CONSEJERO', BGA: 'COORDINADOR_NUEVOS', MIA: 'TESORERIA', 'BOG-NORTE': 'DIGITADOR_APORTES' };

const POLITICAS = [
  { version: 'v1.0', vigente_desde: '2023-02-01', vigente_hasta: '2025-10-31',
    url: 'https://datos.example.org/casaroca/politica-tratamiento-v1.0.pdf',
    resumen: 'Primera política de tratamiento de datos de la red (Ley 1581 de 2012): finalidades pastoral, convocatoria y administrativa.',
    aprobada_por: 'Junta directiva · acta 2023-004' },
  { version: 'v2.0', vigente_desde: '2025-11-01', vigente_hasta: null,
    url: 'https://datos.example.org/casaroca/politica-tratamiento-v2.0.pdf',
    resumen: 'Agrega los datos de menores de RocaKids, la consejería, las sedes fuera de Colombia (RGPD en España) y la finalidad de emergencia.',
    aprobada_por: 'Junta directiva · acta 2025-019' },
];

/* ─────────────────────────────────────────────────────────────────────
   UTILIDADES LOCALES
   ───────────────────────────────────────────────────────────────────── */
const p4 = (n) => String(n).padStart(4, '0');
const perfilDe = (s) => s.tipo === 'plantacion' ? 'plantacion' : s.tipo === 'sede_madre' ? 'madre'
  : s.meta >= 230 ? 'grande' : s.meta >= 85 ? 'mediana' : 'pequena';
const salidaEnVivo = (s) => maxFecha(SALIDAS_POR_OLA[s.ola], s.fundada);
const momentoEn = (s, fecha, hora) => momentoLocal(fecha, hora, s.zona);
const politicaDe = (fecha) => fecha < '2023-02-01' ? null : fecha < '2025-11-01' ? 'v1.0' : 'v2.0';
const quitarTildes = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Fecha de nacimiento de alguien que HOY tiene exactamente `e` años. */
function nacimiento(az, e) { return sumarDias(sumarAnios(HOY, -e - 1), az.entero(2, 363)); }

/** Una fecha al azar, acotada: si el intervalo se invierte, devuelve el tope. */
function entre(az, desde, hasta) { return desde > hasta ? hasta : az.fechaEntre(desde, hasta); }

function direccionPara(az, sede) {
  if (sede.pais === 'CO') {
    const via = az.ponderado({ Calle: 34, Carrera: 34, Diagonal: 8, Transversal: 8, 'Avenida Calle': 8, 'Avenida Carrera': 8 });
    const sur = ['BOG-SUR', 'SOACHA'].includes(sede.codigo) && az.probabilidad(0.6) ? ' Sur' : '';
    const letra = az.probabilidad(0.25) ? az.elegir(['A', 'B', 'C', 'Bis']) : '';
    const comp = az.ponderado({ '': 30, [`, apto ${az.entero(1, 22)}0${az.entero(1, 4)}`]: 40,
      [`, casa ${az.entero(1, 60)}`]: 15, [`, torre ${az.entero(1, 8)} apto ${az.entero(1, 20)}0${az.entero(1, 6)}`]: 15 });
    return `${via} ${az.entero(1, 180)}${letra ? ' ' + letra : ''}${sur} # ${az.entero(1, 140)}-${az.entero(2, 98)}${comp}`;
  }
  if (sede.pais === 'PA') {
    return `${az.elegir(CALLES.PA)}, ${az.elegir(['Edificio', 'PH'])} ${az.elegir(CALLES.PA_EDIF)}, apto ${az.entero(1, 30)}${az.elegir(['A', 'B', 'C', 'D'])}`;
  }
  if (sede.pais === 'ES') {
    const lista = sede.codigo === 'BCN' ? CALLES.BCN : CALLES.MAD;
    return `${az.elegir(lista)} ${az.entero(2, 320)}, ${az.entero(1, 8)}.º ${az.elegir(['1.ª', '2.ª', 'A', 'B', 'C'])}`;
  }
  const lista = CALLES.US[sede.codigo] ?? CALLES.US.MIA;
  return `${az.entero(100, 9800)} ${az.elegir(lista)}${az.probabilidad(0.6) ? `, Apt ${az.entero(1, 40)}${az.entero(0, 9)}` : ''}`;
}

function origenHogar(az, sede) {
  if (sede.pais === 'CO') {
    return sede.codigo === 'CUC' ? az.ponderado({ CO: 72, VE: 26, EC: 2 }) : az.ponderado({ CO: 93, VE: 6, EC: 0.5, PE: 0.5 });
  }
  if (sede.pais === 'PA') return az.ponderado({ PA: 35, CO: 45, VE: 20 });
  if (sede.pais === 'ES') return az.ponderado({ ES: 25, CO: 45, VE: 20, EC: 6, PE: 4 });
  return az.ponderado({ US: 25, CO: 50, VE: 20, PE: 5 });
}

/** Origen de los nombres: los peruanos y ecuatorianos usan la lista general. */
function origenNombres(az, origen, esNinoAfuera) {
  if (esNinoAfuera && origen !== 'ES' && origen !== 'PA') return 'US';
  if (origen === 'EC' || origen === 'PE') return 'CO';
  if (origen === 'VE') return az.probabilidad(0.55) ? 'VE' : 'CO';
  if (origen === 'US') return az.probabilidad(0.5) ? 'US' : 'CO';
  if (origen === 'PA') return az.probabilidad(0.6) ? 'PA' : 'CO';
  return origen;
}
const origenApellidos = (origen) => (origen === 'EC' || origen === 'PE') ? 'CO' : origen;

/* ─────────────────────────────────────────────────────────────────────
   GENERACIÓN EN MEMORIA · hogares y personas
   ───────────────────────────────────────────────────────────────────── */

/**
 * Arma una persona (sin sede): nombre, nacimiento, género, origen.
 * Los datos de contacto, fe y documento se completan después con el hogar.
 */
function armarPersona(az, sede, o) {
  const fnac = o.fnac ?? nacimiento(az, o.edad);
  const anio = Number(fnac.slice(0, 4));
  const e = edad(fnac);
  const afuera = sede.pais !== 'CO';
  const ninoLocal = afuera && e <= 12 && o.papel.startsWith('hij') && az.probabilidad(0.55);
  const on = o.origenNombre ?? origenNombres(az, o.origen, ninoLocal && sede.pais === 'US');
  const { primer_nombre, segundo_nombre } = nombrePara(az, o.genero, anio, { origen: on });
  const nac = ninoLocal ? { US: 'US', ES: 'ES', PA: 'PA' }[sede.pais] : o.origen;
  return {
    id: az.uuid(), papel: o.papel, genero: o.genero, fecha_nacimiento: fnac,
    primer_nombre, segundo_nombre,
    primer_apellido: o.apellidos[0], segundo_apellido: o.apellidos[1] ?? null,
    origen: o.origen, nacionalidad: NACIONALIDAD[nac] ?? 'colombiana',
    estado_civil: o.estado_civil ?? null,
  };
}

/** Edades de los hijos de una madre de `m` años (cantidad pedida, sin repetir año). */
function edadesHijos(az, m, cantidad, maxEdad = 26) {
  const edades = [];
  for (let i = 0; i < cantidad * 3 && edades.length < cantidad; i++) {
    const alNacer = az.entero(19, Math.max(19, Math.min(42, m)));
    const e = m - alNacer;
    if (e < 0 || e > maxEdad || edades.includes(e)) continue;
    edades.push(e);
  }
  return edades.sort((a, b) => b - a);
}

/**
 * Genera un hogar para una sede.
 * @returns {{clave, sede, tipo, origen, miembros: object[], pareja: object[]|null, jefe: object,
 *            vinculos: object[], acudientes: object[]}}
 */
function generarHogar(az, sede, clave, tipoForzado, opciones = {}) {
  const tipo = tipoForzado ?? az.ponderado(PESOS_HOGAR[sede.tipo === 'plantacion' ? 'plantacion' : sede.pais === 'CO' ? 'colombia' : 'exterior']);
  const origen = opciones.origen ?? origenHogar(az, sede);
  const oa = origenApellidos(origen);
  const ap = () => apellidoAzar(az, oa);
  const h = { clave, sede, tipo, origen, miembros: [], pareja: null, jefe: null, vinculos: [], acudientes: [] };
  const civilPareja = az.probabilidad(0.82) ? 'casado' : 'union_libre';

  const pareja = (edadEl, edadElla) => {
    const el = armarPersona(az, sede, { papel: 'esposo', genero: 'M', edad: edadEl, fnac: opciones.fnacEl, origen,
      apellidos: opciones.apellidosEl ?? [ap(), ap()], estado_civil: civilPareja });
    // Los dos no comparten primer apellido: sus hijos quedarían «Zuluaga Zuluaga».
    let apElla = ap();
    for (let i = 0; i < 5 && apElla === el.primer_apellido; i++) apElla = ap();
    const ella = armarPersona(az, sede, { papel: 'esposa', genero: 'F', edad: edadElla, origen,
      apellidos: [apElla, ap()], estado_civil: civilPareja });
    h.pareja = [el, ella]; h.jefe = el; h.miembros.push(el, ella);
    return [el, ella];
  };
  const hijosDe = (madre, padre, cantidad, apellidos, maxEdad) => {
    const edadMadre = edad(madre.fecha_nacimiento);
    for (const e of edadesHijos(az, edadMadre, cantidad, maxEdad)) {
      const g = az.probabilidad(0.5) ? 'M' : 'F';
      const hijo = armarPersona(az, sede, { papel: g === 'M' ? 'hijo' : 'hija', genero: g, edad: e, origen,
        apellidos, estado_civil: e >= 18 ? (az.probabilidad(0.92) ? 'soltero' : 'union_libre') : null });
      hijo.madre = madre; hijo.padre = padre;
      h.miembros.push(hijo);
    }
  };
  const cantidadHijos = () => az.ponderado({ 1: 30, 2: 40, 3: 22, 4: 8 }) * 1;

  switch (tipo) {
    case 'pareja_pastoral': {
      const edadEl = opciones.edadEl ?? az.normalEntera(sede.tipo === 'plantacion' ? 36 : 46, 6, 29, 64);
      const [el, ella] = pareja(edadEl, Math.max(26, edadEl - az.entero(0, 5)));
      el.estado_civil = ella.estado_civil = 'casado';
      const n = az.ponderado({ 0: 12, 1: 22, 2: 40, 3: 26 }) * 1;
      if (n) hijosDe(ella, el, n, [el.primer_apellido, ella.primer_apellido], 24);
      break;
    }
    case 'pareja_con_hijos':
    case 'tres_generaciones': {
      const edadEl = az.normalEntera(41, 8, 23, 64);
      const [el, ella] = pareja(edadEl, Math.max(21, Math.min(edadEl + 6, edadEl - Math.round(az.normal(2, 3)))));
      const ensamblada = az.probabilidad(0.06);
      if (ensamblada) {
        // Hijos de una unión anterior de ella: el esposo es su padrastro.
        const apAnterior = ap();
        for (const e of edadesHijos(az, edad(ella.fecha_nacimiento), az.entero(1, 2), 17)) {
          const g = az.probabilidad(0.5) ? 'M' : 'F';
          const hijo = armarPersona(az, sede, { papel: g === 'M' ? 'hijo' : 'hija', genero: g, edad: e, origen,
            apellidos: [apAnterior, ella.primer_apellido] });
          hijo.madre = ella; hijo.padrastro = el;
          h.miembros.push(hijo);
        }
      }
      hijosDe(ella, el, ensamblada ? az.entero(0, 2) : cantidadHijos(), [el.primer_apellido, ella.primer_apellido], 26);
      if (tipo === 'tres_generaciones') {
        const deElla = az.probabilidad(0.7);
        const hijoDe = deElla ? ella : el;
        const g = az.probabilidad(0.78) ? 'F' : 'M';
        const eAb = Math.min(96, edad(hijoDe.fecha_nacimiento) + az.entero(22, 34));
        const abuelo = armarPersona(az, sede, { papel: g === 'F' ? 'abuela' : 'abuelo', genero: g, edad: Math.max(58, eAb), origen,
          apellidos: g === 'F' ? [hijoDe.segundo_apellido ?? ap(), ap()] : [hijoDe.primer_apellido, ap()],
          estado_civil: az.probabilidad(0.8) ? 'viudo' : 'casado' });
        abuelo.hijoDe = hijoDe;
        h.miembros.push(abuelo);
      }
      break;
    }
    case 'pareja_sin_hijos': {
      const joven = az.probabilidad(0.5);
      const edadEl = joven ? az.normalEntera(29, 4, 21, 40) : az.normalEntera(58, 6, 45, 74);
      pareja(edadEl, Math.max(20, edadEl - az.entero(0, 5)));
      break;
    }
    case 'pareja_mayor': {
      const edadEl = az.normalEntera(69, 6, 60, 90);
      const [el, ella] = pareja(edadEl, Math.max(56, edadEl - az.entero(0, 6)));
      if (az.probabilidad(0.25)) {
        const g = az.probabilidad(0.5) ? 'M' : 'F';
        const hijo = armarPersona(az, sede, { papel: g === 'M' ? 'hijo' : 'hija', genero: g, edad: az.entero(28, 42), origen,
          apellidos: [el.primer_apellido, ella.primer_apellido], estado_civil: az.probabilidad(0.8) ? 'soltero' : 'divorciado' });
        hijo.madre = ella; hijo.padre = el;
        h.miembros.push(hijo);
      }
      break;
    }
    case 'madre_sola':
    case 'padre_solo': {
      const g = tipo === 'madre_sola' ? 'F' : 'M';
      const e = g === 'F' ? az.normalEntera(37, 8, 20, 60) : az.normalEntera(42, 8, 24, 62);
      const jefe = armarPersona(az, sede, { papel: g === 'F' ? 'madre' : 'padre', genero: g, edad: e, origen, apellidos: [ap(), ap()],
        estado_civil: az.ponderado({ soltero: 45, separado: 25, divorciado: 25, viudo: 5 }) });
      h.jefe = jefe; h.miembros.push(jefe);
      const apellidos = g === 'F'
        ? (az.probabilidad(0.7) ? [ap(), jefe.primer_apellido] : [jefe.primer_apellido, jefe.segundo_apellido])
        : [jefe.primer_apellido, ap()];
      const edadRef = g === 'F' ? e : Math.max(20, e - az.entero(0, 4));
      for (const eh of edadesHijos(az, edadRef, g === 'F' ? az.ponderado({ 1: 45, 2: 40, 3: 15 }) * 1 : az.entero(1, 2), 24)) {
        const gh = az.probabilidad(0.5) ? 'M' : 'F';
        const hijo = armarPersona(az, sede, { papel: gh === 'M' ? 'hijo' : 'hija', genero: gh, edad: eh, origen, apellidos,
          estado_civil: eh >= 18 ? 'soltero' : null });
        if (g === 'F') hijo.madre = jefe; else hijo.padre = jefe;
        h.miembros.push(hijo);
      }
      break;
    }
    case 'joven_solo':
    case 'adulto_solo':
    case 'mayor_solo': {
      const g = az.probabilidad(tipo === 'mayor_solo' ? 0.68 : 0.55) ? 'F' : 'M';
      const e = tipo === 'joven_solo' ? az.normalEntera(23, 3, 18, 30)
        : tipo === 'adulto_solo' ? az.normalEntera(44, 10, 30, 66) : az.normalEntera(74, 6, 65, 94);
      const civil = tipo === 'joven_solo' ? (az.probabilidad(0.95) ? 'soltero' : 'union_libre')
        : tipo === 'adulto_solo' ? az.ponderado({ soltero: 50, divorciado: 25, separado: 15, viudo: 10 })
          : az.ponderado({ viudo: 65, soltero: 12, divorciado: 13, casado: 10 });
      const jefe = armarPersona(az, sede, { papel: 'solo', genero: g, edad: e, origen, apellidos: [ap(), ap()], estado_civil: civil });
      h.jefe = jefe; h.miembros.push(jefe);
      break;
    }
    default: throw new Error(`Tipo de hogar desconocido: ${tipo}`);
  }
  return h;
}

/**
 * Completa un hogar: compromiso, estado, fechas de ingreso y de registro,
 * contacto, fe, documento, dirección. Todo lo que depende del hogar.
 */
function completarHogar(az, h, u, opciones = {}) {
  const s = h.sede;
  const plantacion = s.tipo === 'plantacion';
  h.compromiso = opciones.compromiso ?? az.ponderado(plantacion ? { visitante: 35, miembro: 50, lider: 15 } : { visitante: 22, miembro: 58, lider: 20 });
  h.estado = opciones.estado ?? (h.compromiso !== 'visitante' && az.probabilidad(0.075) ? 'inactiva' : 'activa');
  const vivo = salidaEnVivo(s);
  const adultoMayor = h.miembros.filter(m => edad(m.fecha_nacimiento) >= 18)
    .reduce((a, m) => (a && a.fecha_nacimiento <= m.fecha_nacimiento ? a : m), null) ?? h.jefe;
  const minIngreso = maxFecha(s.fundada, sumarAnios(h.jefe.fecha_nacimiento, 15));

  if (opciones.ingreso) h.ingreso = opciones.ingreso;
  else if (h.compromiso === 'visitante') {
    h.ingreso = az.probabilidad(0.6) ? entre(az, maxFecha(vivo, '2026-05-24'), AYER) : entre(az, vivo, '2026-05-23');
  } else if (az.probabilidad(0.82) && minIngreso < vivo) {
    h.ingreso = entre(az, minIngreso, sumarDias(vivo, -1));
  } else {
    h.ingreso = entre(az, maxFecha(vivo, minIngreso), '2026-08-31');
  }
  if (h.ingreso < minIngreso) h.ingreso = minIngreso > AYER ? AYER : minIngreso;
  void adultoMayor;

  const antesDelSistema = h.ingreso < vivo;
  const fechaRegistro = antesDelSistema ? sumarDias(vivo, az.entero(0, 3)) : h.ingreso;
  h.registro = momentoEn(s, minFecha(fechaRegistro, AYER), antesDelSistema ? az.horaEntre('07:30', '18:30') : az.horaEntre('09:00', '13:30'));
  h.importado = antesDelSistema;
  h.direccion = az.probabilidad(0.78) ? direccionPara(az, s) : null;
  h.zona = az.probabilidad(0.82) ? az.elegir(ZONAS[s.codigo] ?? ['Centro']) : null;

  for (const p of h.miembros) {
    const e = edad(p.fecha_nacimiento);
    p.hogar = h;
    p.estado = h.estado;
    p.ingreso = maxFecha(h.ingreso, p.fecha_nacimiento);
    p.creado_en = h.registro;
    p.direccion = h.direccion; p.zona = h.zona;
    p.ciudad_residencia = s.ciudad; p.pais_residencia = PAIS_NOMBRE[s.pais];
    // compromiso de cada integrante
    if (h.compromiso === 'visitante') p.nivel_compromiso = 'visitante';
    else if (e < 18) p.nivel_compromiso = h.compromiso === 'lider' ? 'miembro' : h.compromiso;
    else if (h.compromiso === 'lider') p.nivel_compromiso = (p === h.jefe || (h.pareja && p === h.pareja[1] && az.probabilidad(0.6))) ? 'lider'
      : (['hijo', 'hija'].includes(p.papel) ? az.ponderado({ miembro: 60, lider: 15, visitante: 25 }) : 'miembro');
    else p.nivel_compromiso = (h.pareja && p === h.pareja[0] && az.probabilidad(0.1)) ? 'visitante' : 'miembro';
    p.membresia = h.compromiso === 'visitante' || p.nivel_compromiso === 'visitante' && h.ingreso >= vivo ? 'visitante' : 'miembro';
    // contacto
    const conCorreo = e >= 18 && e < 70 ? az.probabilidad(h.compromiso === 'visitante' ? 0.7 : 0.85)
      : e >= 70 ? az.probabilidad(0.35) : e >= 14 ? az.probabilidad(0.3) : false;
    const conTel = e >= 18 && e < 70 ? az.probabilidad(0.94) : e >= 70 ? az.probabilidad(0.72) : e >= 14 ? az.probabilidad(0.55) : false;
    p.email_principal = conCorreo ? correoNuevo(az, p.primer_nombre, p.primer_apellido, u.correos) : null;
    p.telefono_movil = conTel ? telefonoNuevo(az, u.telefonos) : null;
    // fe
    const miembroDeVerdad = p.nivel_compromiso !== 'visitante';
    p.es_cristiano = e < 12 ? null : miembroDeVerdad ? (e < 16 && az.probabilidad(0.3) ? 'en_proceso' : 'si')
      : az.ponderado({ no: 40, en_proceso: 35, si: 25 });
    p.fecha_conversion = null; p.ha_sido_bautizado = e < 10 ? null : false; p.fecha_bautismo = null;
    if (p.es_cristiano === 'si' && az.probabilidad(0.85)) {
      // Se convirtió de los 12 años en adelante: cerca de su llegada, o en la adolescencia si llegó de niño.
      p.fecha_conversion = entre(az, sumarAnios(p.fecha_nacimiento, 12),
        minFecha(AYER, maxFecha(sumarAnios(p.ingreso, 2), sumarAnios(p.fecha_nacimiento, 16))));
    } else if (p.es_cristiano === 'en_proceso' && az.probabilidad(0.3)) {
      p.fecha_conversion = entre(az, maxFecha(p.ingreso, sumarAnios(p.fecha_nacimiento, 12)), AYER);
    }
    if (e >= 10) {
      const pb = p.nivel_compromiso === 'lider' ? 0.95 : p.nivel_compromiso === 'miembro' ? (e < 18 ? 0.4 : 0.72)
        : p.es_cristiano === 'si' ? 0.45 : 0;
      if (az.probabilidad(pb)) {
        p.ha_sido_bautizado = true;
        if (az.probabilidad(0.85)) {
          const desde = maxFecha(p.fecha_conversion ?? sumarAnios(p.fecha_nacimiento, 10), sumarAnios(p.fecha_nacimiento, 10));
          p.fecha_bautismo = entre(az, maxFecha(desde, sumarDias(p.ingreso, -365)), AYER);
          if (p.fecha_bautismo < desde) p.fecha_bautismo = desde > AYER ? null : desde;
        }
      }
    }
    p.iglesia_anterior = e >= 18 && az.probabilidad(0.18) ? az.elegir(IGLESIAS_ANTERIORES) : null;
    p.nombre_corto = apodoDe(p.primer_nombre) && az.probabilidad(0.07) ? apodoDe(p.primer_nombre) : null;
    p.es_ministro = false; p.en_directorio_publico = false;
    // documento (el catálogo solo admite CC, TI, RC, CE, PA, PEP, PPT)
    p.tipo_documento = null; p.numero_documento = null;
    const local = s.pais === 'CO' ? 'CO' : s.pais;
    const nacLocal = p.nacionalidad === NACIONALIDAD[local];
    let tipo = null;
    if (s.pais === 'CO') {
      if (p.origen === 'CO' || nacLocal) tipo = e >= 18 ? (az.probabilidad(0.92) ? 'CC' : null) : az.probabilidad(0.72) ? (e < 7 ? 'RC' : 'TI') : null;
      else if (p.origen === 'VE') tipo = e >= 18 ? (az.probabilidad(0.8) ? az.ponderado({ PPT: 6, PEP: 2, PA: 2 }) : null) : (az.probabilidad(0.5) ? 'PA' : null);
      else tipo = az.probabilidad(0.8) ? (e >= 18 ? az.ponderado({ CE: 6, PA: 4 }) : 'PA') : null;
    } else if (p.origen === 'CO' && !nacLocal) {
      tipo = e >= 18 ? az.ponderado({ CC: 50, PA: 40, '': 10 }) : az.ponderado({ PA: 40, [e < 7 ? 'RC' : 'TI']: 20, '': 40 });
    } else if (p.origen === 'VE' && !nacLocal) {
      tipo = az.probabilidad(0.6) ? 'PA' : null;
    } else {
      // Locales: su DNI, CIP o SSN no está en el catálogo. Pasaporte o nada.
      tipo = az.probabilidad(0.35) ? 'PA' : null;
    }
    if (tipo) { p.tipo_documento = tipo; p.numero_documento = documentoNuevo(az, u.documentos); }
  }
  // Teléfono de emergencia: el del cónyuge, o uno nuevo.
  for (const p of h.miembros) {
    p.telefono_emergencia = null;
    if (edad(p.fecha_nacimiento) >= 18 && az.probabilidad(0.25)) {
      const conyuge = h.pareja && h.pareja.includes(p) ? h.pareja.find(x => x !== p) : null;
      p.telefono_emergencia = conyuge?.telefono_movil ?? telefonoNuevo(az, u.telefonos);
    }
  }
  h.nombre = h.pareja ? `Hogar ${h.pareja[0].primer_apellido} ${h.pareja[1].primer_apellido}` : `Hogar ${h.jefe.primer_apellido}`;
}

/** Vínculos (nucleo.vinculos) y acudientes (nucleo.acudientes) de un hogar. */
function relacionesDelHogar(az, h) {
  const v = [], a = [];
  const vinculo = (de, a2, tipo, desde) => v.push({ id: az.uuid(), persona_id: de.id, relacionada_id: a2.id, tipo, vigente_desde: desde });
  if (h.pareja) {
    const [el, ella] = h.pareja;
    const eMenor = Math.min(edad(el.fecha_nacimiento), edad(ella.fecha_nacimiento));
    const hijos = h.miembros.filter(m => (m.padre === el || m.madre === ella) && m.padre === el);
    const mayorHijo = hijos.reduce((x, m) => Math.max(x, edad(m.fecha_nacimiento)), -1);
    const aniosCasados = Math.max(1, Math.min(eMenor - 19, mayorHijo >= 0 ? mayorHijo + az.entero(1, 4) : az.entero(1, 30)));
    const boda = sumarDias(sumarAnios(HOY, -aniosCasados), -az.entero(0, 300));
    vinculo(el, ella, 'CONYUGE', boda); vinculo(ella, el, 'CONYUGE', boda);
  }
  for (const m of h.miembros) {
    const tipoHijo = m.genero === 'M' ? 'HIJO' : 'HIJA';
    if (m.padre) vinculo(m.padre, m, tipoHijo, m.fecha_nacimiento);
    if (m.madre) vinculo(m.madre, m, tipoHijo, m.fecha_nacimiento);
    if (m.hijoDe) {
      vinculo(m.hijoDe, m, m.genero === 'F' ? 'MADRE' : 'PADRE', m.hijoDe.fecha_nacimiento);
      const otro = h.pareja?.find(x => x !== m.hijoDe);
      if (otro) vinculo(otro, m, m.genero === 'F' ? 'SUEGRA' : 'SUEGRO', otro.fecha_nacimiento > m.fecha_nacimiento ? otro.fecha_nacimiento : sumarAnios(otro.fecha_nacimiento, 20));
    }
  }
  // Acudientes: todo menor, y quien cumplió 18 en el último mes (el mantenimiento aún no los cerró).
  const abuelo = h.miembros.find(m => m.hijoDe);
  const hermanoMayor = h.miembros.filter(m => ['hijo', 'hija'].includes(m.papel) && edad(m.fecha_nacimiento) >= 21)[0];
  for (const m of h.miembros) {
    const e = edad(m.fecha_nacimiento);
    const recien18 = e === 18 && diasEntre(sumarAnios(m.fecha_nacimiento, 18), HOY) <= 30;
    if (e >= 18 && !recien18) continue;
    if (!['hijo', 'hija'].includes(m.papel)) continue;
    const desde = m.ingreso;
    const lista = [];
    const principal = m.madre && (!m.padre || az.probabilidad(0.7)) ? m.madre : (m.padre ?? m.madre);
    lista.push({ acudiente: principal, parentesco: principal === m.madre ? 'MADRE' : 'PADRE', es_principal: true, autoriza_retiro: true });
    const otro = principal === m.madre ? m.padre : m.madre;
    if (otro && az.probabilidad(0.85)) lista.push({ acudiente: otro, parentesco: otro === m.madre ? 'MADRE' : 'PADRE', es_principal: false, autoriza_retiro: az.probabilidad(0.9) });
    if (m.padrastro) lista.push({ acudiente: m.padrastro, parentesco: 'PADRASTRO', es_principal: false, autoriza_retiro: az.probabilidad(0.5) });
    if (abuelo && edad(abuelo.fecha_nacimiento) < 85 && az.probabilidad(0.6)) {
      lista.push({ acudiente: abuelo, parentesco: abuelo.genero === 'F' ? 'ABUELA' : 'ABUELO', es_principal: false, autoriza_retiro: az.probabilidad(0.7) });
    }
    if (hermanoMayor && hermanoMayor !== m && az.probabilidad(0.3)) {
      lista.push({ acudiente: hermanoMayor, parentesco: 'ACUDIENTE', es_principal: false, autoriza_retiro: true });
    }
    for (const x of lista) {
      a.push({ id: az.uuid(), menor_id: m.id, acudiente_id: x.acudiente.id, parentesco: x.parentesco,
               es_principal: x.es_principal, autoriza_retiro: x.autoriza_retiro, vigente_desde: desde, menor: m, acudiente: x.acudiente });
    }
    m.acudientes = lista;
  }
  h.vinculos = v; h.acudientes = a;
}

/* ─────────────────────────────────────────────────────────────────────
   EL TRABAJO
   ───────────────────────────────────────────────────────────────────── */
d.ejecutar({ archivo: 0, tema: 'la red: sedes, personas, familias, roles y cuentas' }, async (c, azar) => {
  const t0 = Date.now();
  const paso = (texto) => console.log(`   … ${texto} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  // ⛔ No se corre dos veces.
  if (await d.yaPoblado(c, `SELECT (SELECT count(*) FROM nucleo.personas WHERE source_system = $1)
                                  + (SELECT count(*) FROM org.sedes WHERE codigo = 'CALI')`, [SISTEMA], 'la red')) return;
  const { rows: [semillaOk] } = await c.query(`SELECT count(*)::int AS n FROM org.sedes`);
  if (semillaOk.n !== 6) throw new Error(`Se esperaba la base limpia recién migrada (6 sedes) y hay ${semillaOk.n}.`);

  const u = await d.usadosEnLaBase(c);
  const conteo = {};
  const hashClave = derivarClave(CLAVE_LABORATORIO);

  await enTransaccion(c, async () => {
    /* ── 0 · Lo que trae la semilla ───────────────────────────────── */
    const { rows: filasSede } = await c.query(`SELECT id, codigo, zona_horaria FROM org.sedes`);
    const { rows: unidades } = await c.query(`SELECT id, codigo, clase FROM org.unidades`);
    const { rows: ministerios } = await c.query(`SELECT id, codigo FROM org.ministerios`);
    const idUnidad = Object.fromEntries(unidades.map(x => [x.codigo, x.id]));
    const idMin = Object.fromEntries(ministerios.map(x => [x.codigo, x.id]));
    const { rows: semillaPastores } = await c.query(
      `SELECT a.persona_id, s.codigo, p.fecha_nacimiento::text AS fnac, a.id AS asignacion_id
         FROM identidad.asignaciones a JOIN org.sedes s ON s.id = a.alcance_id
         JOIN nucleo.personas p ON p.id = a.persona_id
        WHERE a.rol = 'PASTOR_CONGREGACIONAL' AND a.alcance_tipo = 'sede'`);
    const [dgSemilla] = await d.direccionGeneral(c);
    if (!dgSemilla) throw new Error('La semilla no trae Pastor Principal.');
    const DG = dgSemilla.persona_id;

    const S = Object.fromEntries(SEDES.map(s => [s.codigo, { ...s, zona: s.zona ?? ZONA_PAIS[s.pais] }]));
    for (const f of filasSede) { S[f.codigo].id = f.id; S[f.codigo].zona = f.zona_horaria; }
    const maestra = S['BOG-CHICO'];

    await d.autorDireccion(c, { motivo: 'Red de demostración · núcleo' });
    const autorDG = () => fijarAutor(c, { persona_id: DG, sede_ids: [], nivel_max: 4, alcance_global: true, motivo: 'Red de demostración · núcleo' });
    // ⛔ identidad.otorgar_asignacion, sistema.crear_iglesia y otras funciones de la base fijan
    //    app.motivo y lo dejan puesto hasta el fin de la transacción: sin volver a escribirlo, lo
    //    que se hace después queda en la auditoría con el motivo del paso anterior (las cuentas
    //    salían creadas por «Acta: ACTA-NYC-2026-03 · coordinación de nuevos»). Cada paso dice el suyo.
    const motivo = (texto) => c.query(`SELECT set_config('app.motivo', $1, true)`, [texto]);

    /* ── 1 · Políticas de tratamiento ─────────────────────────────── */
    await insertarLote(c, 'plataforma.politicas_tratamiento', POLITICAS.map(p => ({
      ...p, hash_sha256: d.crypto.createHash('sha256').update(`CasaRoca · política de tratamiento ${p.version} · demostración`).digest('hex'),
    })));

    /* ── 2 · Generación en memoria de todos los hogares ───────────── */
    const hogares = [];         // todos
    const porSede = {};         // codigo → hogares cuyo destino es esa sede
    const pastoral = {};        // codigo → hogar de la pareja pastoral
    for (const s of Object.values(S)) porSede[s.codigo] = [];
    const nuevoHogar = (s, tipo, opciones = {}) => {
      const az = azar.derivar(`hogar:${s.codigo}:${porSede[s.codigo].length}`);
      const h = generarHogar(az, s, `${s.codigo}-${p4(porSede[s.codigo].length + 1)}`, tipo, opciones);
      completarHogar(az, h, u, opciones);
      relacionesDelHogar(az, h);
      h.az = az;
      porSede[s.codigo].push(h); hogares.push(h);
      return h;
    };

    // 2a · Parejas pastorales. En la semilla, el pastor ya existe (se conserva su nacimiento).
    const azNombres = azar.derivar('semilla');
    for (const s of Object.values(S)) {
      const sp = semillaPastores.find(x => x.codigo === s.codigo);
      const vivo = salidaEnVivo(s);
      const h = nuevoHogar(s, 'pareja_pastoral', {
        compromiso: 'lider', estado: 'activa', ingreso: s.fundada, origen: 'CO',
        fnacEl: sp ? sp.fnac : undefined,
        edadEl: sp ? edad(sp.fnac) : undefined,
      });
      pastoral[s.codigo] = h;
      const [el, ella] = h.pareja;
      if (sp) {
        // El pastor de la semilla conserva su identificador: se corrigen las relaciones ya armadas.
        const viejo = el.id;
        el.id = sp.persona_id; el.deSemilla = true;
        for (const v of h.vinculos) { if (v.persona_id === viejo) v.persona_id = el.id; if (v.relacionada_id === viejo) v.relacionada_id = el.id; }
        for (const a of h.acudientes) if (a.acudiente_id === viejo) a.acudiente_id = el.id;
      }
      for (const p of h.pareja) {
        p.nivel_compromiso = 'lider'; p.es_ministro = true; p.en_directorio_publico = true; p.es_cristiano = 'si';
        p.ha_sido_bautizado = true;
        p.fecha_conversion = sumarDias(sumarAnios(p.fecha_nacimiento, azNombres.entero(14, 22)), azNombres.entero(0, 300));
        p.fecha_bautismo = sumarDias(p.fecha_conversion, azNombres.entero(40, 400));
        if (!p.email_principal) p.email_principal = correoNuevo(h.az, p.primer_nombre, p.primer_apellido, u.correos);
        if (!p.telefono_movil) p.telefono_movil = telefonoNuevo(h.az, u.telefonos);
        if (!p.tipo_documento) { p.tipo_documento = 'CC'; p.numero_documento = documentoNuevo(h.az, u.documentos); }
        p.nacionalidad = 'colombiana';
        p.iglesia_anterior = null;
      }
      // Los pastores de las filiales y plantaciones salieron de la iglesia madre: con la
      // fundación si ya tenían edad, o después, como relevo de los fundadores.
      h.enviados = s.codigo !== 'BOG-CHICO';
      h.fechaEnvio = h.enviados ? minFecha(AYER, maxFecha(s.fundada, sumarAnios(el.fecha_nacimiento, 27))) : null;
      if (h.enviados) {
        for (const p of h.miembros) p.ingreso = maxFecha(h.fechaEnvio, p.fecha_nacimiento);
        for (const a of h.acudientes) a.vigente_desde = a.menor.ingreso;
      }
      // Su ingreso a la madre, años antes del envío.
      h.ingresoMadre = h.enviados ? entre(h.az, maxFecha(maestra.fundada, sumarAnios(el.fecha_nacimiento, 16)),
        sumarDias(h.fechaEnvio, -400)) : null;
      h.vigenteDesde = vivo;
      void ella;
    }

    // 2b · La dirección general: el Pastor Principal de la semilla y su esposa, en la madre.
    const hogarDG = (() => {
      const az = azar.derivar('direccion-general');
      const s = maestra;
      const h = generarHogar(az, s, 'BOG-CHICO-0000', 'pareja_sin_hijos');
      completarHogar(az, h, u, { compromiso: 'lider', estado: 'activa', ingreso: '1998-03-01' });
      const [el, ella] = h.pareja;
      Object.assign(el, { id: DG, deSemilla: true, primer_nombre: 'Álvaro', segundo_nombre: 'Enrique', primer_apellido: 'Montenegro',
        segundo_apellido: 'Salcedo', fecha_nacimiento: '1961-06-14' });
      Object.assign(ella, { primer_nombre: 'Beatriz', segundo_nombre: 'Elena', primer_apellido: 'Cárdenas',
        segundo_apellido: 'Vallejo', fecha_nacimiento: '1963-10-02' });
      for (const p of h.pareja) {
        u.correos.delete(p.email_principal);
        p.email_principal = correoNuevo(az, p.primer_nombre, p.primer_apellido, u.correos);
        p.telefono_movil = p.telefono_movil ?? telefonoNuevo(az, u.telefonos);
        p.tipo_documento = 'CC'; p.numero_documento = p.numero_documento ?? documentoNuevo(az, u.documentos);
        Object.assign(p, { nivel_compromiso: 'lider', es_ministro: true, en_directorio_publico: true, es_cristiano: 'si',
          ha_sido_bautizado: true, estado_civil: 'casado', nacionalidad: 'colombiana', iglesia_anterior: null,
          ingreso: '1998-03-01', nombre_corto: null });
      }
      el.fecha_conversion = '1979-04-08'; el.fecha_bautismo = '1979-09-16';
      ella.fecha_conversion = '1981-02-22'; ella.fecha_bautismo = '1981-08-09';
      h.nombre = 'Hogar Montenegro Cárdenas';
      relacionesDelHogar(az, h);
      h.az = az;
      porSede['BOG-CHICO'].push(h); hogares.push(h);
      return h;
    })();

    // 2c · El resto de cada sede, hasta su meta.
    for (const s of Object.values(S)) {
      let n = porSede[s.codigo].reduce((x, h) => x + h.miembros.length, 0);
      while (n < s.meta) {
        const h = nuevoHogar(s);
        n += h.miembros.length;
      }
    }
    paso(`${hogares.length} hogares generados`);

    /* ── 3 · Traslados con historia, egresados y fallecidos ───────── */
    const azT = azar.derivar('traslados');
    const origenesPara = (dest) => {
      if (dest.tipo === 'plantacion') return [dest.madre];
      if (dest.region === 'REG-INT') return ['BOG-CHICO', 'BOG-NORTE', 'MED', 'CALI', 'BAQ', 'BGA'];
      if (dest.region === 'REG-BOG') return ['MED', 'CALI', 'BAQ', 'BGA', 'IBG', 'VVC', 'PEI', 'BOG-CHICO', 'BOG-NORTE', 'BOG-SUR'];
      return ['BOG-CHICO', 'BOG-NORTE', 'BOG-SUR', 'MED', 'CALI', 'BAQ', 'BGA', 'CTG'];
    };
    const trasladados = [];
    for (const s of Object.values(S)) {
      const prob = s.tipo === 'plantacion' ? 0.3 : 0.06;
      for (const h of porSede[s.codigo]) {
        if (h === pastoral[s.codigo] || h === hogarDG || h.compromiso === 'visitante' || h.estado !== 'activa') continue;
        if (h.tipo === 'mayor_solo' || !azT.probabilidad(prob)) continue;
        const orig = S[azT.elegir(origenesPara(s).filter(x => x !== s.codigo))];
        const fecha = s.tipo === 'plantacion'
          ? minFecha(AYER, sumarDias(s.fundada, azT.entero(0, 90)))
          : entre(azT, maxFecha(s.fundada, '2016-01-01'), '2026-09-10');
        const minOrig = maxFecha(orig.fundada, sumarAnios(h.jefe.fecha_nacimiento, 15));
        const topeOrig = sumarDias(fecha, -200);
        if (minOrig > topeOrig) continue;
        const ingresoOrigen = entre(azT, minOrig, topeOrig);
        h.traslado = {
          origen: orig, fecha, ingresoOrigen,
          motivo: s.tipo === 'plantacion' ? `Se unió al equipo fundador de la plantación de ${s.nombre}.`
            : s.pais !== orig.pais ? `Emigró a ${PAIS_NOMBRE[s.pais]}; la sede de ${orig.nombre} lo recomendó a la de ${s.nombre}.`
              : azT.elegir([`Se mudó a ${s.ciudad} por trabajo.`, `Cambio de ciudad: la familia se radicó en ${s.ciudad}.`,
                  `Traslado laboral a ${s.ciudad}.`, `Se fue a vivir cerca de sus padres en ${s.ciudad}.`, `Estudios en ${s.ciudad}.`]),
          acta: `Carta de traslado ${orig.codigo}-${s.codigo}-${fecha.slice(0, 4)}-${String(azT.entero(1, 199)).padStart(3, '0')}`,
        };
        // Historia: ingresó a la sede de origen; llegó a esta en la fecha del traslado.
        h.ingreso = fecha;
        const vivoOrig = salidaEnVivo(orig), vivoDest = salidaEnVivo(s);
        const creado = fecha < vivoDest ? sumarDias(vivoDest, azT.entero(0, 3))
          : ingresoOrigen < vivoOrig ? sumarDias(vivoOrig, azT.entero(0, 3)) : ingresoOrigen;
        const zonaReg = creado === ingresoOrigen || (fecha >= vivoDest && ingresoOrigen < vivoOrig) ? orig : s;
        for (const p of h.miembros) {
          p.ingreso = maxFecha(fecha, p.fecha_nacimiento);
          p.creado_en = momentoEn(zonaReg, minFecha(creado, AYER), azT.horaEntre('08:00', '18:00'));
          p.membresia = 'miembro';
          p.trasladar = p.fecha_nacimiento < fecha;
          p.ingresoOrigen = maxFecha(ingresoOrigen, p.fecha_nacimiento);
          for (const a of h.acudientes) if (a.menor === p) a.vigente_desde = p.trasladar ? p.ingresoOrigen : p.ingreso;
        }
        trasladados.push(h);
      }
    }
    // Se fueron de la red (estado «trasladada») y fallecidos: su membresía se cierra.
    const egresos = [];
    const azE = azar.derivar('egresos');
    for (const h of hogares) {
      if (h.miembros.length !== 1 || h === hogarDG || h.traslado || h.estado !== 'activa') continue;
      const p = h.jefe; const s = h.sede;
      if (h.tipo === 'mayor_solo' && azE.probabilidad(0.12)) {
        const cuando = entre(azE, maxFecha(p.ingreso, '2025-10-01'), '2026-08-31');
        p.estado = 'fallecida'; h.estado = 'fallecida';
        egresos.push({ p, hasta: cuando, motivo: `Falleció el ${cuando}. La sede de ${s.nombre} acompañó a su familia.` });
      } else if (['joven_solo', 'adulto_solo'].includes(h.tipo) && h.compromiso !== 'visitante' && azE.probabilidad(0.02)) {
        const cuando = entre(azE, maxFecha(p.ingreso, '2025-11-01'), '2026-09-05');
        p.estado = 'trasladada'; h.estado = 'trasladada';
        egresos.push({ p, hasta: cuando, motivo: `Se fue a vivir a ${azE.elegir(LUGARES_FUERA)} y no hay sede de la red cerca.` });
      }
    }
    paso(`${trasladados.length} hogares con traslado · ${egresos.length} egresos`);

    /* ── 4 · Personal de cada sede, de la central y de las regiones ── */
    const azR = azar.derivar('roles');
    // Quien sirve con un cargo es líder de la iglesia: cristiano, bautizado y localizable.
    const hacerLider = (az, p) => {
      p.nivel_compromiso = 'lider';
      p.es_cristiano = 'si';
      if (!p.fecha_conversion) {
        const desde = sumarAnios(p.fecha_nacimiento, 12);
        const hasta = minFecha(AYER, maxFecha(desde, sumarAnios(p.ingreso, 1)));
        p.fecha_conversion = entre(az, desde, p.fecha_bautismo ? minFecha(hasta, p.fecha_bautismo) : hasta);
      }
      if (!p.ha_sido_bautizado) {
        p.ha_sido_bautizado = true;
        p.fecha_bautismo = entre(az, sumarDias(p.fecha_conversion, 30), minFecha(AYER, sumarAnios(p.fecha_conversion, 3)));
      }
      if (!p.email_principal) p.email_principal = correoNuevo(az, p.primer_nombre, p.primer_apellido, u.correos);
      if (!p.telefono_movil) p.telefono_movil = telefonoNuevo(az, u.telefonos);
    };
    const tomado = new Set([...hogarDG.pareja.map(p => p.id)]);
    for (const h of Object.values(pastoral)) for (const p of h.pareja) tomado.add(p.id);
    const candidatos = (s, f = {}) => porSede[s.codigo]
      .filter(h => h !== pastoral[s.codigo] && h !== hogarDG && h.compromiso !== 'visitante' && h.estado === 'activa')
      .flatMap(h => h.miembros)
      .filter(p => p.estado === 'activa' && !tomado.has(p.id) && p.nivel_compromiso !== 'visitante')
      .filter(p => { const e = edad(p.fecha_nacimiento); return e >= (f.min ?? 23) && e <= (f.max ?? 66); })
      .filter(p => !f.genero || p.genero === f.genero);
    const reclutar = (s, f = {}) => {
      let lista = candidatos(s, f);
      if (!lista.length) lista = candidatos(s, { ...f, genero: undefined, min: 21, max: 70 });
      if (!lista.length) throw new Error(`No hay a quién nombrar en ${s.codigo}`);
      const p = azR.elegir(lista);
      tomado.add(p.id);
      hacerLider(azR, p);
      return p;
    };
    const personal = [];   // { persona, sede, rol, desde, hasta?, acta, revocarHoy? }
    for (const s of Object.values(S)) {
      const vivo = salidaEnVivo(s);
      const plantacion = s.tipo === 'plantacion';
      const grande = perfilDe(s) === 'grande' || perfilDe(s) === 'madre';
      const acta = (n) => `ACTA-${s.codigo}-${vivo.slice(0, 4)}-${String(n).padStart(2, '0')}`;
      const desdeAlAzar = () => azR.probabilidad(0.7) ? vivo : entre(azR, vivo, '2026-09-05');
      const nombrar = (rol, f, n) => personal.push({ persona: reclutar(s, f), sede: s, rol, desde: desdeAlAzar(), acta: acta(n) });
      nombrar('SECRETARIA', azR.probabilidad(0.7) ? { genero: 'F', min: 24, max: 55 } : { min: 24, max: 55 }, 1);
      if (grande) nombrar('SECRETARIA', { min: 22, max: 60 }, 2);
      nombrar('COORDINADOR_NUEVOS', { min: 24, max: 52 }, 3);
      if (grande) nombrar('COORDINADOR_NUEVOS', { min: 22, max: 55 }, 4);
      if (!plantacion) {
        nombrar('TESORERIA', { min: 30, max: 62 }, 5);
        nombrar('DIGITADOR_APORTES', { min: 22, max: 50 }, 6);
        nombrar('CONSEJERO', { min: 35, max: 66 }, 7);
        nombrar('CONSEJERO', { min: 35, max: 66 }, 8);
        if (s.codigo === 'BOG-SUR') {
          const x = { persona: reclutar(s, { min: 40, max: 66 }), sede: s, rol: 'CONSEJERO', desde: vivo, acta: acta(9), revocarHoy: true };
          personal.push(x);
        }
      }
      // Quien tuvo el cargo antes: su asignación venció y su cuenta quedó suspendida.
      if (ANTERIORES[s.codigo]) {
        const rol = ANTERIORES[s.codigo];
        const actual = personal.find(x => x.sede === s && x.rol === rol);
        const hasta = entre(azR, sumarDias(vivo, 60), '2026-07-31');
        actual.desde = sumarDias(hasta, 1);
        personal.push({ persona: reclutar(s, { min: 25, max: 66 }), sede: s, rol, desde: vivo, hasta, acta: acta(10), anterior: true });
      }
    }
    // La central: directores, líderes e integrantes de equipo (gente de las sedes de Bogotá).
    const sedesBogota = ['BOG-CHICO', 'BOG-CHICO', 'BOG-CHICO', 'BOG-NORTE', 'BOG-NORTE', 'BOG-SUBA', 'BOG-OCC', 'BOG-SUR'];
    const central = [];    // { persona, unidad, rol_en_unidad, desde, hasta?, motivo_salida? }
    const azC = azar.derivar('central');
    const vivoCentral = SALIDAS_POR_OLA[1];
    const desdeCentral = () => azC.probabilidad(0.6) ? vivoCentral : entre(azC, vivoCentral, '2026-08-31');
    const directores = {};
    for (const dct of DIRECCIONES) {
      const p = reclutar(S[azC.elegir(sedesBogota)], { min: 35, max: 64 });
      directores[dct.unidad] = p;
      const desde = desdeCentral();
      central.push({ persona: p, unidad: dct.unidad, rol_en_unidad: 'lider', desde });
      central.push({ persona: p, unidad: dct.equipo, rol_en_unidad: 'coordinador', desde });
    }
    const lideres = {};
    for (const eq of EQUIPOS) {
      const lider = reclutar(S[azC.elegir(sedesBogota)], { min: 28, max: 62 });
      lideres[eq.unidad] = lider;
      central.push({ persona: lider, unidad: eq.unidad, rol_en_unidad: 'lider', desde: desdeCentral() });
      for (let i = 0; i < eq.integrantes; i++) {
        central.push({ persona: reclutar(S[azC.elegir(sedesBogota)], { min: 22, max: 60 }), unidad: eq.unidad, rol_en_unidad: 'integrante', desde: desdeCentral() });
      }
    }
    // Historia del equipo de Finanzas: alguien que salió.
    central.push({ persona: reclutar(S['BOG-NORTE'], { min: 25, max: 60 }), unidad: 'EQ-FIN', rol_en_unidad: 'integrante',
      desde: vivoCentral, hasta: '2026-04-30', motivo_salida: 'Pasó a servir como tesorero de su sede.' });
    // La dirección general en la unidad CENTRAL.
    central.push({ persona: hogarDG.pareja[0], unidad: 'CENTRAL', rol_en_unidad: 'lider', desde: vivoCentral });
    central.push({ persona: hogarDG.pareja[1], unidad: 'CENTRAL', rol_en_unidad: 'lider', desde: vivoCentral });
    // Las parejas supervisoras de cada región (heredan PASTOR_CONGREGACIONAL sobre su región).
    const supervisores = {};
    for (const [region, codigoSede] of Object.entries(SUPERVISION)) {
      const s = S[codigoSede];
      const parejas = (min, max) => porSede[codigoSede].filter(h => h.pareja && h !== pastoral[codigoSede] && h !== hogarDG
        && h.estado === 'activa' && h.compromiso !== 'visitante' && !h.traslado
        && h.pareja.every(p => !tomado.has(p.id) && edad(p.fecha_nacimiento) >= min && edad(p.fecha_nacimiento) <= max));
      const opciones = parejas(42, 68).length ? parejas(42, 68) : parejas(30, 80);
      if (!opciones.length) throw new Error(`No hay pareja para supervisar ${region} en ${codigoSede}`);
      const h = azC.elegir(opciones);
      supervisores[region] = h.pareja;
      for (const p of h.pareja) {
        tomado.add(p.id);
        hacerLider(azC, p);
        Object.assign(p, { es_ministro: true, en_directorio_publico: true, estado_civil: 'casado' });
        central.push({ persona: p, unidad: region, rol_en_unidad: 'lider', desde: SALIDAS_POR_OLA[s.ola] });
      }
      h.pareja[0].estado_civil = h.pareja[1].estado_civil = 'casado';
    }
    for (const x of personal) if (x.rol === 'SECRETARIA') x.persona.en_directorio_publico = true;
    paso(`${personal.length} nombramientos de sede · ${central.length} puestos de central y regiones`);

    /* ── 5 · La red: renombrar la semilla, crear iglesias, regiones ── */
    await autorDG();
    const columnas = ['id', 'sede_id', 'tipo_documento', 'numero_documento', 'primer_nombre', 'segundo_nombre',
      'primer_apellido', 'segundo_apellido', 'fecha_nacimiento', 'email_principal', 'telefono_movil', 'telefono_emergencia',
      'direccion', 'estado', 'source_system', 'source_id', 'creado_en', 'actualizado_en', 'genero', 'estado_civil',
      'nivel_compromiso', 'fecha_conversion', 'ha_sido_bautizado', 'fecha_bautismo', 'nombre_corto', 'nacionalidad',
      'pais_residencia', 'ciudad_residencia', 'zona', 'es_cristiano', 'iglesia_anterior', 'es_ministro', 'en_directorio_publico'];
    const fila = (p, sedeId, indice) => ({
      id: p.id, sede_id: sedeId, tipo_documento: p.tipo_documento, numero_documento: p.numero_documento,
      primer_nombre: p.primer_nombre, segundo_nombre: p.segundo_nombre, primer_apellido: p.primer_apellido,
      segundo_apellido: p.segundo_apellido, fecha_nacimiento: p.fecha_nacimiento, email_principal: p.email_principal,
      telefono_movil: p.telefono_movil, telefono_emergencia: p.telefono_emergencia, direccion: p.direccion,
      estado: p.estado, source_system: SISTEMA, source_id: `${p.hogar.clave}-${indice}`,
      creado_en: p.creado_en, actualizado_en: p.creado_en, genero: p.genero, estado_civil: p.estado_civil,
      nivel_compromiso: p.nivel_compromiso, fecha_conversion: p.fecha_conversion, ha_sido_bautizado: p.ha_sido_bautizado,
      fecha_bautismo: p.fecha_bautismo, nombre_corto: p.nombre_corto, nacionalidad: p.nacionalidad,
      pais_residencia: p.pais_residencia, ciudad_residencia: p.ciudad_residencia, zona: p.zona,
      es_cristiano: p.es_cristiano, iglesia_anterior: p.iglesia_anterior, es_ministro: p.es_ministro,
      en_directorio_publico: p.en_directorio_publico,
    });
    const indice = new Map();
    for (const h of hogares) h.miembros.forEach((p, i) => indice.set(p, i + 1));

    // 5a · La semilla se conserva: el Pastor Principal y los cinco pastores reciben nombre y hoja de vida.
    const deSemilla = [hogarDG.pareja[0], ...Object.values(pastoral).map(h => h.pareja[0]).filter(p => p.deSemilla)];
    for (const p of deSemilla) {
      await c.query(
        `UPDATE nucleo.personas SET primer_nombre=$2, segundo_nombre=$3, primer_apellido=$4, segundo_apellido=$5,
                fecha_nacimiento=$6, email_principal=$7, telefono_movil=$8, tipo_documento=$9, numero_documento=$10,
                genero=$11, estado_civil=$12, nivel_compromiso='lider', es_cristiano='si', fecha_conversion=$13,
                ha_sido_bautizado=true, fecha_bautismo=$14, nacionalidad='colombiana', pais_residencia='Colombia',
                ciudad_residencia=$15, zona=$16, direccion=$17, es_ministro=true, en_directorio_publico=true
          WHERE id=$1`,
        [p.id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, p.fecha_nacimiento,
         p.email_principal, p.telefono_movil, p.tipo_documento, p.numero_documento, p.genero, p.estado_civil,
         p.fecha_conversion, p.fecha_bautismo, p.ciudad_residencia, p.zona, p.direccion]);
    }
    await c.query(`UPDATE nucleo.membresias_sede SET desde = '1998-03-01', motivo = 'Fundador de la iglesia madre'
                    WHERE persona_id = $1 AND es_principal AND hasta IS NULL`, [DG]);

    // 5b · Los pastores enviados (y las esposas de todos) nacen como miembros de la iglesia madre.
    const enviados = [];
    for (const h of Object.values(pastoral)) if (h.enviados) for (const p of h.pareja) if (!p.deSemilla) enviados.push(p);
    const esposaDG = hogarDG.pareja[1];
    await insertarLote(c, 'nucleo.personas', [esposaDG, ...enviados].map(p => {
      const f = fila(p, maestra.id, indice.get(p));
      f.creado_en = f.actualizado_en = momentoEn(maestra, SALIDAS_POR_OLA[1], '09:10');
      return f;
    }), { columnas });

    // 5c · Las 30 iglesias nuevas, desde la maestra, con su pastor.
    for (const s of Object.values(S)) {
      if (s.semilla) continue;
      const pastor = pastoral[s.codigo].pareja[0];
      const { rows: [r] } = await c.query(
        `SELECT sistema.crear_iglesia($1,$2,$3::org.tipo_sede,$4::char(2),$5,$6,$7,$8::smallint,$9::smallint) AS id`,
        [s.codigo, s.nombre, s.tipo, s.pais, s.ciudad, PLANTILLA[s.tipo], pastor.id, s.ola, 3]);
      s.id = r.id;
    }
    // 5d · Cada sede cuelga de su región, con la zona horaria de su ciudad.
    await motivo('Cada iglesia cuelga de su región, con la zona horaria de su ciudad');
    for (const s of Object.values(S)) {
      await c.query(`UPDATE org.sedes SET unidad_id = $2, zona_horaria = $3 WHERE id = $1
                       AND (unidad_id IS DISTINCT FROM $2 OR zona_horaria IS DISTINCT FROM $3)`,
        [s.id, idUnidad[s.region], s.zona]);
    }
    paso('36 iglesias en la red');

    // 5e · La pareja pastoral: la esposa, con el mismo rol y el mismo acto.
    const otorgar = async (persona, rol, alcance, alcanceId, nivel, acta, desde, hasta) => {
      const { rows: [r] } = await c.query(
        `SELECT identidad.otorgar_asignacion($1,$2,$3,$4,$5::smallint,$6,$7::date,$8::date) AS r`,
        [persona, rol, alcance, alcanceId, nivel, acta, desde, hasta ?? null]);
      return r.r.id;
    };
    const asignacionesPastor = {};
    await motivo('Corrección: el acceso del pastor rige desde la salida en vivo de su sede, no desde la carga');
    for (const s of Object.values(S)) {
      const h = pastoral[s.codigo];
      const [el, ella] = h.pareja;
      const acta = s.codigo === 'BOG-CHICO' ? 'ACTA-DIR-2025-001 · pastores de la iglesia madre'
        : `ACTA-DIR-${h.vigenteDesde.slice(0, 4)}-${String(Object.keys(S).indexOf(s.codigo) + 2).padStart(3, '0')} · nombramiento en matrimonio`;
      h.acta = acta;
      // La pareja de la madre todavía no está registrada: recibe su rol con el resto del personal (paso 11).
      if (s.codigo === 'BOG-CHICO') continue;
      // La fecha del acceso es la de la salida en vivo de su sede, no la de hoy (crear_iglesia la pone hoy).
      await c.query(`UPDATE identidad.asignaciones SET vigente_desde = $3
                      WHERE persona_id = $1 AND rol = 'PASTOR_CONGREGACIONAL' AND alcance_id = $2 AND revocada_en IS NULL`,
        [el.id, s.id, h.vigenteDesde]);
      const { rows: [a] } = await c.query(`SELECT id FROM identidad.asignaciones WHERE persona_id = $1 AND rol = 'PASTOR_CONGREGACIONAL' AND alcance_id = $2`, [el.id, s.id]);
      asignacionesPastor[el.id] = a.id;
      void ella;
    }
    // La esposa del Pastor Principal: la dirección general también es en matrimonio.
    await c.query(`UPDATE identidad.asignaciones SET vigente_desde = $2 WHERE persona_id = $1 AND rol = 'PASTOR_DIRECTOR_GENERAL'`, [DG, SALIDAS_POR_OLA[1]]);
    const asigEsposaDG = await otorgar(esposaDG.id, 'PASTOR_DIRECTOR_GENERAL', 'organizacion', null, 4,
      'ACTA-DIR-2025-001 · constitución del ecosistema: la dirección general es la pareja pastoral', SALIDAS_POR_OLA[1]);

    // 5f · Los enviados: su historia en la madre y el traslado a su iglesia.
    await motivo('Traslado de la pareja pastoral que la dirección envió a su iglesia');
    for (const h of Object.values(pastoral)) {
      if (!h.enviados) continue;
      const s = h.sede;
      for (const p of h.pareja) {
        await c.query(`UPDATE nucleo.membresias_sede SET desde = $2, tipo = 'miembro', motivo = 'Congregaba en la iglesia madre'
                        WHERE persona_id = $1 AND es_principal AND hasta IS NULL`, [p.id, minFecha(h.ingresoMadre, sumarDias(h.fechaEnvio, -30))]);
        await c.query(`SELECT nucleo.trasladar($1, $2, $3, $4, $5, $6::date)`,
          [p.id, s.id, `Enviados por la dirección general como pastores de ${s.nombre}.`, DG, h.acta, h.fechaEnvio]);
      }
    }
    // Ahora que cada pastora está en su sede, recibe su rol.
    for (const h of Object.values(pastoral)) {
      const s = h.sede; const ella = h.pareja[1];
      if (s.codigo === 'BOG-CHICO') continue;
      asignacionesPastor[ella.id] = await otorgar(ella.id, 'PASTOR_CONGREGACIONAL', 'sede', s.id, 3, h.acta, h.vigenteDesde);
    }
    paso('parejas pastorales nombradas y trasladadas');

    /* ── 6 · Ministerios, segmentos y módulos por sede ─────────────── */
    const azM = azar.derivar('ministerios');
    const filasMin = [], filasSeg = [];
    for (const s of Object.values(S)) {
      if (s.codigo === 'BOG-CHICO') continue;   // la semilla ya los tiene todos encendidos
      const perfil = perfilDe(s);
      const lista = MINISTERIOS_POR_PERFIL[perfil === 'madre' ? 'grande' : perfil];
      for (const [cod, prob] of lista) {
        if (s.pais !== 'CO' && cod === 'CENTURIONES') continue;
        if (!azM.probabilidad(prob)) continue;
        const dia = entre(azM, s.fundada, sumarDias(maxFecha(s.fundada, '2016-01-01'), 900));
        filasMin.push({ sede_id: s.id, ministerio_id: idMin[cod], activo: true, activado_en: momentoEn(s, minFecha(dia, AYER), '09:00'), cod, s });
      }
      // Un ministerio que se apagó, en algunas sedes medianas y grandes.
      if (['grande', 'mediana'].includes(perfil) && azM.probabilidad(0.35)) {
        const cand = ['CENTURIONES', 'AMEC', 'JOSUES', 'CULTURA'].filter(x => !filasMin.some(f => f.s === s && f.cod === x));
        if (cand.length) filasMin.push({ sede_id: s.id, ministerio_id: idMin[azM.elegir(cand)], activo: false, activado_en: null, s });
      }
    }
    await insertarLote(c, 'org.ministerios_sede', filasMin, { columnas: ['sede_id', 'ministerio_id', 'activo', 'activado_en'] });
    const SEGMENTOS = {
      ROCAKIDS: [['BEBES', 'Bebés', 1, 0, 2], ['PEQUENOS', 'Pequeños', 2, 3, 5], ['EXPLORADORES', 'Exploradores', 3, 6, 8], ['AVENTUREROS', 'Aventureros', 4, 9, 11]],
      TMT: [['PULSO', 'Pulso', 1, 11, 14], ['ECO', 'Eco', 2, 15, 18], ['LEGADO', 'Legado', 3, 19, 25]],
    };
    for (const f of filasMin) {
      if (!f.activo || !SEGMENTOS[f.cod]) continue;
      for (const [codigo, nombre, orden, emin, emax] of SEGMENTOS[f.cod]) {
        filasSeg.push({ id: azM.uuid(), sede_id: f.sede_id, ministerio_id: f.ministerio_id, codigo, nombre, orden,
          edad_min: emin, edad_max: emax, activo: true, creado_en: f.activado_en });
      }
    }
    await insertarLote(c, 'org.segmentos', filasSeg);
    // Módulos: los de compuerta legal se encienden con su evidencia; construcción donde hay obra.
    const { rows: apagados } = await c.query(
      `SELECT ms.sede_id, ms.modulo FROM sistema.modulos_sede ms JOIN sistema.modulos m ON m.codigo = ms.modulo
        WHERE NOT ms.activo AND m.exige_compuerta_legal`);
    let modulosEncendidos = 0;
    for (const r of apagados) {
      const s = Object.values(S).find(x => x.id === r.sede_id);
      const pendiente = COMPUERTA_PENDIENTE[s.codigo]?.[r.modulo];
      if (pendiente) {
        await c.query(`SELECT sistema.habilitar_modulo($1, $2, false, NULL, $3)`, [s.id, r.modulo, pendiente]);
        continue;
      }
      const evidencia = s.pais === 'CO'
        ? `Política de tratamiento v2.0 · registro SIC RNBD-2025-${String(40000 + azM.entero(0, 9999))} · contrato de encargo ENC-${s.codigo}-2025`
        : s.pais === 'ES' ? `RGPD: registro de actividades RAT-${s.codigo}-2025 · delegado de protección de datos designado`
          : `Aviso de privacidad local ${s.codigo}-2026 · contrato de encargo ENC-${s.codigo}-2026`;
      await c.query(`SELECT sistema.habilitar_modulo($1, $2, true, $3, $4)`,
        [s.id, r.modulo, evidencia, `Compuerta legal cumplida en ${s.nombre}.`]);
      modulosEncendidos++;
    }
    for (const codigo of CON_OBRA) {
      await c.query(`SELECT sistema.habilitar_modulo($1, 'construccion', true, NULL, $2)`,
        [S[codigo].id, `Obra en curso en ${S[codigo].nombre}: la sigue la Dirección de Proyectos.`]);
    }
    paso(`${filasMin.length} ministerios por sede · ${filasSeg.length} segmentos · ${modulosEncendidos} módulos con compuerta encendidos`);

    /* ── 7 · Las personas, sede por sede ───────────────────────────── */
    const secretariaDe = {};
    for (const x of personal) if (x.rol === 'SECRETARIA' && !x.anterior && !secretariaDe[x.sede.codigo]) secretariaDe[x.sede.codigo] = x.persona;
    const yaInsertadas = new Set([esposaDG.id, ...enviados.map(p => p.id), ...deSemilla.map(p => p.id)]);
    const porInsertar = {};   // sede de inserción → filas
    for (const h of hogares) {
      for (const p of h.miembros) {
        if (yaInsertadas.has(p.id)) continue;
        const sIns = h.traslado && p.trasladar ? h.traslado.origen : h.sede;
        (porInsertar[sIns.codigo] ??= []).push(fila(p, sIns.id, indice.get(p)));
      }
    }
    let totalPersonas = 0;
    for (const [codigo, filas] of Object.entries(porInsertar)) {
      const s = S[codigo];
      await fijarAutor(c, { persona_id: secretariaDe[codigo]?.id ?? pastoral[codigo].pareja[0].id, sede_ids: [s.id], nivel_max: 2,
        alcance_global: false, motivo: 'Registro de personas de la sede' });
      await insertarLote(c, 'nucleo.personas', filas, { columnas });
      totalPersonas += filas.length;
    }
    await autorDG();
    paso(`${totalPersonas} personas registradas`);

    // 7b · La membresía dice la verdad: desde cuándo congrega y si es miembro o visitante.
    //      (La base la crea con la fecha del registro y la llama «miembro» a todo activo: ver el informe.)
    const mIds = [], mDesde = [], mTipo = [], mMotivo = [];
    for (const h of hogares) {
      for (const p of h.miembros) {
        if (p.deSemilla || (h.enviados && h.pareja.includes(p))) continue;
        const enOrigen = h.traslado && p.trasladar;
        mIds.push(p.id);
        mDesde.push(enOrigen ? p.ingresoOrigen : p.ingreso);
        mTipo.push(enOrigen ? 'miembro' : p.membresia);
        mMotivo.push(h.importado && !h.traslado ? `Congrega desde ${(enOrigen ? p.ingresoOrigen : p.ingreso).slice(0, 4)}; llegó al sistema con la migración de la ola ${h.sede.ola}.`
          : p.membresia === 'visitante' ? 'Primera visita registrada en la sede.' : 'Alta de la persona');
      }
    }
    await c.query(
      `UPDATE nucleo.membresias_sede m SET desde = v.desde, tipo = v.tipo, motivo = v.motivo
         FROM unnest($1::uuid[], $2::date[], $3::text[], $4::text[]) AS v(persona_id, desde, tipo, motivo)
        WHERE m.persona_id = v.persona_id AND m.es_principal AND m.hasta IS NULL`, [mIds, mDesde, mTipo, mMotivo]);

    // 7c · Hogares, vínculos y acudientes (los menores nacen con su acudiente en la misma transacción).
    const filasHogar = [], filasHM = [], filasV = [], filasA = [];
    const azH = azar.derivar('hogares');
    for (const h of hogares) {
      filasV.push(...h.vinculos.map(v => ({ ...v, creado_en: h.miembros[0].creado_en })));
      filasA.push(...h.acudientes.map(a => ({ id: a.id, menor_id: a.menor_id, acudiente_id: a.acudiente_id, parentesco: a.parentesco,
        es_principal: a.es_principal, autoriza_retiro: a.autoriza_retiro, vigente_desde: a.vigente_desde, creado_en: a.menor.creado_en })));
      const vivos = h.miembros.filter(p => !['fallecida', 'trasladada'].includes(p.estado));
      if (vivos.length < 2) continue;
      const id = azH.uuid();
      h.hogarId = id;
      filasHogar.push({ id, sede_id: h.sede.id, nombre: h.nombre, direccion: h.direccion, jefe_hogar_id: h.jefe.id,
        activo: h.estado === 'activa', source_system: SISTEMA, source_id: `hogar-${h.clave}`, creado_en: h.miembros[0].creado_en,
        actualizado_en: h.miembros[0].creado_en });
      for (const p of vivos) filasHM.push({ hogar_id: id, persona_id: p.id, desde: p.ingreso });
    }
    await insertarLote(c, 'grupos.hogares', filasHogar);
    await insertarLote(c, 'grupos.hogar_miembros', filasHM);
    await insertarLote(c, 'nucleo.vinculos', filasV);
    const pastorQueRegistra = (menorId) => {
      const h = hogares.find(x => x.miembros.some(m => m.id === menorId));
      return pastoral[h.sede.codigo].pareja[0].id;
    };
    void pastorQueRegistra;
    await fijarAutor(c, { persona_id: DG, sede_ids: [], nivel_max: 4, alcance_global: true, motivo: 'Acudientes registrados con el menor' });
    await insertarLote(c, 'nucleo.acudientes', filasA);
    await autorDG();
    paso(`${filasHogar.length} hogares · ${filasV.length} vínculos · ${filasA.length} acudientes`);

    /* ── 8 · Traslados con historia, servidores, traslados en curso y egresos ── */
    let nTraslados = 0;
    for (const h of trasladados) {
      const s = h.sede;
      await fijarAutor(c, { persona_id: secretariaDe[s.codigo]?.id ?? pastoral[s.codigo].pareja[0].id, sede_ids: [s.id, h.traslado.origen.id],
        nivel_max: 2, alcance_global: false, motivo: 'Traslado entre sedes' });
      for (const p of h.miembros) {
        if (!p.trasladar) continue;
        await c.query(`SELECT nucleo.trasladar($1, $2, $3, $4, $5, $6::date)`,
          [p.id, s.id, h.traslado.motivo, pastoral[s.codigo].pareja[0].id, h.traslado.acta, h.traslado.fecha]);
        nTraslados++;
      }
    }
    await autorDG();
    const azS = azar.derivar('servidores');
    const extras = [];
    for (const s of Object.values(S)) {
      if (s.tipo !== 'plantacion') continue;
      const madre = S[s.madre];
      const cand = porSede[madre.codigo].filter(h => h.compromiso !== 'visitante' && h.estado === 'activa' && !h.traslado)
        .flatMap(h => h.miembros).filter(p => edad(p.fecha_nacimiento) >= 20 && edad(p.fecha_nacimiento) <= 60 && !tomado.has(p.id));
      for (const p of azS.muestra(cand, azS.entero(2, 4))) {
        tomado.add(p.id);
        extras.push({ id: azS.uuid(), persona_id: p.id, sede_id: s.id, tipo: 'servidor', es_principal: false,
          desde: minFecha(AYER, sumarDias(s.fundada, azS.entero(0, 45))), motivo: `Sirve en el equipo fundador de la plantación de ${s.nombre}.`,
          aprobada_por: pastoral[s.codigo].pareja[0].id, acta_referencia: `ACTA-${s.codigo}-${s.fundada.slice(0, 4)}-01`,
          source_system: SISTEMA, source_id: `servidor-${s.codigo}-${p.id.slice(0, 8)}` });
      }
    }
    const candidatosTraslado = hogares.filter(h => h.estado === 'activa' && h.compromiso !== 'visitante' && !h.traslado
      && h !== hogarDG && !Object.values(pastoral).includes(h) && h.sede.tipo !== 'plantacion')
      .flatMap(h => h.miembros).filter(p => edad(p.fecha_nacimiento) >= 18 && !tomado.has(p.id));
    for (const p of azS.muestra(candidatosTraslado, 10)) {
      const origen = p.hogar.sede;
      const destinos = Object.values(S).filter(x => x !== origen && x.tipo !== 'plantacion' && (x.region === origen.region || azS.probabilidad(0.3)));
      const dest = azS.elegir(destinos);
      extras.push({ id: azS.uuid(), persona_id: p.id, sede_id: dest.id, tipo: 'en_traslado', es_principal: false,
        desde: entre(azS, '2026-09-01', AYER), motivo: `Traslado en curso: se muda a ${dest.ciudad} en ${azS.elegir(['octubre', 'noviembre'])}; la sede de ${dest.nombre} ya lo espera.`,
        aprobada_por: null, acta_referencia: null, source_system: SISTEMA, source_id: `traslado-${dest.codigo}-${p.id.slice(0, 8)}` });
    }
    await insertarLote(c, 'nucleo.membresias_sede', extras);
    if (egresos.length) {
      await c.query(
        `UPDATE nucleo.membresias_sede m SET hasta = GREATEST(v.hasta, m.desde), tipo = 'egresado', es_principal = false, motivo = v.motivo
           FROM unnest($1::uuid[], $2::date[], $3::text[]) AS v(persona_id, hasta, motivo)
          WHERE m.persona_id = v.persona_id AND m.es_principal AND m.hasta IS NULL`,
        [egresos.map(x => x.p.id), egresos.map(x => x.hasta), egresos.map(x => x.motivo)]);
    }
    paso(`${nTraslados} traslados · ${extras.length} membresías de servidor o en traslado · ${egresos.length} egresos`);

    /* ── 9 · Consentimientos por canal y finalidad ─────────────────── */
    const azK = azar.derivar('consentimientos');
    const filasK = [];
    const campania = (s) => entre(azK, maxFecha('2023-02-12', s.fundada), '2023-06-25');
    const hora = () => azK.horaEntre('09:30', '13:30');
    const sedeEn = (p, fecha) => (p.hogar.traslado && p.trasladar && fecha < p.hogar.traslado.fecha) ? p.hogar.traslado.origen : p.hogar.sede;
    const evidenciaNueva = (s, fecha, canal) => {
      const tipo = canal === 'email' && azK.probabilidad(0.4) ? 'doble_opt_in' : azK.ponderado({ formulario_fisico: 60, formulario_web: 40 });
      const ref = tipo === 'formulario_fisico' ? `Formulario de bienvenida ${s.codigo}-${fecha.slice(0, 4)}-${String(azK.entero(1, 999)).padStart(4, '0')}`
        : tipo === 'formulario_web' ? `Formulario web /conectar · envío ${azK.hex(10)}` : `Confirmación por correo · ${azK.hex(12)}`;
      return { tipo, ref };
    };
    const vivos = hogares.flatMap(h => h.miembros);
    for (const p of vivos) {
      const e = edad(p.fecha_nacimiento);
      const s = p.hogar.sede;
      if (e < 18) {
        // Menores: su representante (el acudiente principal) autoriza.
        const principal = p.acudientes?.find(a => a.es_principal)?.acudiente;
        if (!principal || !principal.telefono_movil) continue;
        const fecha = minFecha(AYER, maxFecha(p.ingreso, '2023-03-05'));
        const sedeK = sedeEn(p, fecha);
        const conRocakids = e <= 11 && filasMin.some(f => f.s === sedeK && f.cod === 'ROCAKIDS' && f.activo) || (e <= 11 && sedeK.codigo === 'BOG-CHICO');
        const conTmt = e >= 12 && (filasMin.some(f => f.s === sedeK && f.cod === 'TMT' && f.activo) || sedeK.codigo === 'BOG-CHICO');
        const finalidad = conRocakids ? 'menores' : conTmt && azK.probabilidad(0.6) ? 'convocatoria' : null;
        if (!finalidad || p.estado !== 'activa') continue;
        const ev = fecha < salidaEnVivo(sedeK) ? { tipo: 'importado_origen', ref: `99o · ${sedeK.codigo} · autorización del representante` } : evidenciaNueva(sedeK, fecha, 'whatsapp');
        filasK.push({ persona_id: p.id, sede_id: sedeK.id, finalidad, canal: 'whatsapp', acto: 'otorgado',
          ocurrido_en: momentoEn(sedeK, fecha, hora()), evidencia_tipo: ev.tipo, evidencia_ref: ev.ref, otorgado_por: principal.id,
          calidad: null, politica_version: politicaDe(fecha), registrado_en: momentoEn(sedeK, maxFecha(fecha, salidaEnVivo(sedeK)), '18:00') });
        continue;
      }
      if (!p.telefono_movil && !p.email_principal) continue;
      // Adultos: la fecha de la autorización.
      let fecha, tipoEv = null, refEv = null;
      const ingreso = p.hogar.traslado && p.trasladar ? p.ingresoOrigen : p.ingreso;
      const sedeIngreso = sedeEn(p, ingreso);
      if (ingreso < salidaEnVivo(sedeIngreso)) {
        if (ingreso < '2023-02-12') {
          if (!azK.probabilidad(0.85)) continue;            // no firmó la campaña de 2023: no hay autorización
          fecha = campania(sedeIngreso);
        } else fecha = ingreso;
        tipoEv = 'importado_origen';
      } else fecha = ingreso;
      fecha = minFecha(fecha, AYER);
      const sedeK = sedeEn(p, fecha);
      if (!tipoEv && fecha < salidaEnVivo(sedeK)) tipoEv = 'importado_origen';
      // A los que cumplieron 18 hace poco, los autorizó su representante cuando eran menores.
      const recien18 = e === 18 && diasEntre(sumarAnios(p.fecha_nacimiento, 18), HOY) <= 30;
      const representante = recien18 ? p.acudientes?.find(a => a.es_principal)?.acudiente : null;
      const finalidades = azK.ponderado({ ambas: 80, pastoral: 12, convocatoria: 5, ninguna: 3 });
      if (finalidades === 'ninguna') continue;
      const canales = [];
      if (p.telefono_movil) { if (azK.probabilidad(0.9)) canales.push('whatsapp'); if (azK.probabilidad(0.6)) canales.push('llamada'); if (azK.probabilidad(0.08)) canales.push('sms'); }
      if (p.email_principal && azK.probabilidad(0.7)) canales.push('email');
      const lista = finalidades === 'ambas' ? ['pastoral', 'convocatoria'] : [finalidades];
      for (const finalidad of lista) {
        for (const canal of canales) {
          if (finalidad === 'convocatoria' && canal === 'llamada' && azK.probabilidad(0.5)) continue;
          const ev = tipoEv === 'importado_origen'
            ? { tipo: 'importado_origen', ref: `99o · ${sedeK.codigo} · formulario ${fecha.slice(0, 4)}-${String(azK.entero(1, 999)).padStart(4, '0')}` }
            : evidenciaNueva(sedeK, fecha, canal);
          filasK.push({ persona_id: p.id, sede_id: sedeK.id, finalidad, canal, acto: 'otorgado',
            ocurrido_en: momentoEn(sedeK, fecha, hora()), evidencia_tipo: ev.tipo, evidencia_ref: ev.ref,
            otorgado_por: representante?.id ?? null, calidad: representante ? 'representante_legal' : null,
            politica_version: politicaDe(fecha), registrado_en: momentoEn(sedeK, maxFecha(fecha, salidaEnVivo(sedeK)), '18:00') });
          // Algunos revocan después (no todos quieren seguir recibiendo convocatorias).
          if (finalidad === 'convocatoria' && ['whatsapp', 'email'].includes(canal) && azK.probabilidad(0.05) && diasEntre(fecha, AYER) > 40) {
            const cuando = entre(azK, sumarDias(fecha, 30), AYER);
            const sedeR = sedeEn(p, cuando);
            const verbal = azK.probabilidad(0.6);
            filasK.push({ persona_id: p.id, sede_id: sedeR.id, finalidad, canal, acto: 'revocado',
              ocurrido_en: momentoEn(sedeR, cuando, azK.horaEntre('08:00', '19:00')),
              evidencia_tipo: verbal ? 'verbal_registrado' : 'formulario_web',
              evidencia_ref: verbal ? azK.elegir(['Lo pidió en la recepción de la sede', 'Lo pidió por teléfono a la secretaría', 'Lo pidió a su líder de grupo'])
                : `Enlace para dejar de recibir convocatorias · ${azK.hex(8)}`,
              otorgado_por: null, calidad: null, politica_version: politicaDe(cuando),
              registrado_en: momentoEn(sedeR, maxFecha(cuando, salidaEnVivo(sedeR)), '19:30') });
          }
        }
      }
    }
    filasK.forEach((k, i) => { k.id = azK.uuid(); k.source_system = SISTEMA; k.source_id = `consentimiento-${i + 1}`; });
    await insertarLote(c, 'plataforma.consentimientos', filasK);
    paso(`${filasK.length} consentimientos`);

    /* ── 10 · Casillas propias (atributos) ─────────────────────────── */
    const { rows: atributos } = await c.query(`SELECT id, codigo FROM sistema.atributos WHERE vigente`);
    const idAttr = Object.fromEntries(atributos.map(a => [a.codigo, a.id]));
    const filasAt = [];
    const azA = azar.derivar('atributos');
    for (const p of vivos) {
      if (p.estado !== 'activa') continue;
      const e = edad(p.fecha_nacimiento);
      const sec = secretariaDe[p.hogar.sede.codigo]?.id ?? null;
      const cuando = momentoEn(p.hogar.sede, entre(azA, maxFecha(p.ingreso, '2025-10-01'), AYER), azA.horaEntre('09:00', '17:00'));
      if (idAttr.comida_favorita && e >= 12 && azA.probabilidad(0.07)) {
        filasAt.push({ persona_id: p.id, atributo_id: idAttr.comida_favorita, valor: JSON.stringify(azA.elegir(COMIDAS)), actualizado_en: cuando, actualizado_por: sec });
      }
      if (idAttr.alergias_alimentarias && azA.probabilidad(e < 12 ? 0.12 : 0.04)) {
        const v = azA.ponderado([[['ninguna'], 50], [['lactosa'], 14], [['gluten'], 10], [['frutos secos'], 10], [['mariscos'], 8], [['lactosa', 'gluten'], 5], [['otra'], 3]]);
        filasAt.push({ persona_id: p.id, atributo_id: idAttr.alergias_alimentarias, valor: JSON.stringify(v), actualizado_en: cuando, actualizado_por: sec });
      }
    }
    await insertarLote(c, 'nucleo.persona_atributos', filasAt);

    /* ── 11 · Roles de sede, central y regiones ────────────────────── */
    await autorDG();
    const NIVEL = { SECRETARIA: 2, COORDINADOR_NUEVOS: 2, TESORERIA: 3, DIGITADOR_APORTES: 3, CONSEJERO: 3 };
    const NOMBRE_CARGO = { SECRETARIA: 'secretaría', COORDINADOR_NUEVOS: 'coordinación de nuevos', TESORERIA: 'tesorería',
      DIGITADOR_APORTES: 'digitación de aportes', CONSEJERO: 'consejería' };
    // BOG-CHICO: su pareja pastoral congregacional (la dirección general es otra pareja).
    const chico = pastoral['BOG-CHICO'];
    for (const p of chico.pareja) {
      asignacionesPastor[p.id] = await otorgar(p.id, 'PASTOR_CONGREGACIONAL', 'sede', maestra.id, 3, chico.acta, chico.vigenteDesde);
    }
    for (const x of personal) {
      const alcance = x.rol === 'CONSEJERO' ? 'caso_propio' : 'sede';
      x.asignacion = await otorgar(x.persona.id, x.rol, alcance, alcance === 'sede' ? x.sede.id : null, NIVEL[x.rol],
        `${x.acta} · ${NOMBRE_CARGO[x.rol]}`, x.desde, x.hasta ?? null);
    }
    // Unidades: integrantes y líderes.
    await motivo('Integrantes de los equipos de la central y de las regiones');
    const filasUM = central.map(x => ({ id: azC.uuid(), unidad_id: idUnidad[x.unidad], persona_id: x.persona.id, rol_en_unidad: x.rol_en_unidad,
      desde: x.desde, hasta: x.hasta ?? null, motivo_salida: x.motivo_salida ?? null, creado_en: momentoEn(maestra, x.desde, '08:30') }));
    await insertarLote(c, 'org.unidad_miembros', filasUM);
    const lideresUnidad = { CENTRAL: DG, ...Object.fromEntries(Object.entries(directores).map(([k, p]) => [k, p.id])),
      ...Object.fromEntries(Object.entries(lideres).map(([k, p]) => [k, p.id])),
      ...Object.fromEntries(Object.entries(supervisores).map(([k, par]) => [k, par[0].id])) };
    await motivo('Líder de cada unidad de la central y de las regiones');
    for (const [codigo, persona] of Object.entries(lideresUnidad)) {
      await c.query(`UPDATE org.unidades SET lider_persona_id = $2 WHERE codigo = $1`, [codigo, persona]);
    }
    paso(`${personal.length + 1} roles de sede otorgados · ${filasUM.length} puestos en unidades`);

    /* ── 12 · Cuentas de acceso ────────────────────────────────────── */
    await motivo('Cuenta de acceso para quien tiene un cargo');
    const { rows: conRol } = await c.query(
      `SELECT DISTINCT pe.persona_id FROM identidad.v_permiso_efectivo pe WHERE pe.vigente
       UNION
       SELECT persona_id FROM identidad.asignaciones WHERE revocada_en IS NULL AND vigente_hasta < CURRENT_DATE`);
    const { rows: correos } = await c.query(`SELECT id, email_principal::text AS email FROM nucleo.personas WHERE id = ANY($1::uuid[])`,
      [conRol.map(r => r.persona_id)]);
    const cuentaDe = {};
    for (const r of correos) {
      const usuario = r.email ?? `cuenta.${r.id.slice(0, 8)}@example.org`;
      const { rows: [x] } = await c.query(`SELECT identidad.crear_cuenta($1, $2, $3, $4) AS id`, [r.id, usuario, hashClave, DG]);
      cuentaDe[r.id] = x.id;
    }
    // Uso real: casi todos han entrado en las últimas semanas; los recién nombrados, nunca.
    const azU = azar.derivar('cuentas');
    const ingresos = [], quien = [];
    for (const r of correos) {
      const x = personal.find(y => y.persona.id === r.id);
      if (x?.anterior) continue;
      const reciente = x && diasEntre(x.desde, HOY) < 25;
      if (reciente && azU.probabilidad(0.7)) continue;
      if (azU.probabilidad(0.08)) continue;
      const dias = r.id === DG ? 1 : azU.entero(1, 28);
      ingresos.push(momentoLocal(sumarDias(HOY, -dias), azU.horaEntre('06:30', '21:30'), 'America/Bogota'));
      quien.push(r.id);
    }
    await c.query(`UPDATE identidad.cuentas c SET ultimo_ingreso = v.cuando
                     FROM unnest($1::uuid[], $2::timestamptz[]) AS v(persona_id, cuando) WHERE c.persona_id = v.persona_id`, [quien, ingresos]);
    // Clave provisional: a quien se nombró este mes y todavía no ha entrado.
    const provisionales = personal.filter(x => !x.anterior && diasEntre(x.desde, HOY) < 25).map(x => x.persona.id).filter(id => !quien.includes(id));
    if (provisionales.length) await c.query(`UPDATE identidad.cuentas SET debe_cambiar_clave = true WHERE persona_id = ANY($1::uuid[])`, [provisionales]);
    // El personal anterior: la cuenta se suspende (con la función de la base).
    for (const x of personal.filter(y => y.anterior)) {
      await c.query(`SELECT identidad.suspender_cuenta($1, $2)`,
        [x.persona.id, `Terminó su servicio de ${NOMBRE_CARGO[x.rol]} en ${x.sede.nombre} el ${x.hasta}.`]);
    }
    paso(`${correos.length} cuentas de acceso`);

    /* ── 13 · Duplicados por revisar y tres fusiones ──────────────── */
    const azD = azar.derivar('duplicados');
    const variante = (n) => {
      const cambios = [['Jhon', 'John'], ['John', 'Jhon'], ['Jhonatan', 'Jonathan'], ['Stefany', 'Estefanía'], ['Yenny', 'Jenny'],
        ['Érika', 'Erica'], ['Johana', 'Yohana'], ['Yuliana', 'Juliana'], ['Leidy', 'Leydi'], ['Brayan', 'Brian'], ['Kevin', 'Keivin']];
      for (const [a, b] of cambios) if (n === a) return b;
      return quitarTildes(n);
    };
    const baseDup = azD.muestra(vivos.filter(p => p.estado === 'activa' && edad(p.fecha_nacimiento) >= 20 && p.telefono_movil
      && !tomado.has(p.id) && !p.hogar.traslado && p.nivel_compromiso !== 'visitante'), 14);
    const filasDup = [], dupPares = [];
    for (const [i, p] of baseDup.entries()) {
      const mismaSede = azD.probabilidad(0.7);
      const s = mismaSede ? p.hogar.sede : azD.elegir(Object.values(S).filter(x => x.region === p.hogar.sede.region && x !== p.hogar.sede));
      const fecha = entre(azD, maxFecha('2026-03-01', salidaEnVivo(s)), '2026-09-13');
      const dup = { id: azD.uuid(), sede_id: s.id, tipo_documento: null, numero_documento: null,
        primer_nombre: variante(p.primer_nombre), segundo_nombre: azD.probabilidad(0.5) ? p.segundo_nombre : null,
        primer_apellido: quitarTildes(p.primer_apellido), segundo_apellido: azD.probabilidad(0.4) ? p.segundo_apellido : null,
        fecha_nacimiento: azD.probabilidad(0.8) ? p.fecha_nacimiento : null, email_principal: null,
        telefono_movil: p.telefono_movil, telefono_emergencia: null, direccion: null, estado: 'activa',
        source_system: SISTEMA, source_id: `duplicado-${i + 1}`, creado_en: momentoEn(s, fecha, '11:40'), actualizado_en: momentoEn(s, fecha, '11:40'),
        genero: p.genero, estado_civil: null, nivel_compromiso: 'visitante', fecha_conversion: null, ha_sido_bautizado: null,
        fecha_bautismo: null, nombre_corto: null, nacionalidad: p.nacionalidad, pais_residencia: PAIS_NOMBRE[s.pais],
        ciudad_residencia: s.ciudad, zona: null, es_cristiano: null, iglesia_anterior: null, es_ministro: false, en_directorio_publico: false };
      filasDup.push(dup);
      dupPares.push({ principal: p, dup, sede: s, fecha });
    }
    for (const x of dupPares) {
      await fijarAutor(c, { persona_id: secretariaDe[x.sede.codigo]?.id ?? DG, sede_ids: [x.sede.id], nivel_max: 2, alcance_global: false,
        motivo: 'Registro en la mesa de bienvenida' });
      await insertarLote(c, 'nucleo.personas', [x.dup], { columnas });
    }
    await c.query(
      `UPDATE nucleo.membresias_sede m SET tipo = 'visitante', desde = v.desde, motivo = 'Primera visita registrada en la sede.'
         FROM unnest($1::uuid[], $2::date[]) AS v(persona_id, desde) WHERE m.persona_id = v.persona_id AND m.es_principal AND m.hasta IS NULL`,
      [dupPares.map(x => x.dup.id), dupPares.map(x => x.fecha)]);
    // En la mesa de bienvenida el duplicado dejó su autorización; uno de ellos pidió que no le escribieran más.
    const filasKD = [];
    dupPares.forEach((x, i) => {
      const t = momentoEn(x.sede, x.fecha, '11:45');
      filasKD.push({ id: azD.uuid(), persona_id: x.dup.id, sede_id: x.sede.id, finalidad: 'convocatoria', canal: 'whatsapp', acto: 'otorgado',
        ocurrido_en: t, evidencia_tipo: 'formulario_fisico', evidencia_ref: `Formulario de bienvenida ${x.sede.codigo}-2026-${String(800 + i).padStart(4, '0')}`,
        registrado_en: t, politica_version: 'v2.0', source_system: SISTEMA, source_id: `consentimiento-duplicado-${i + 1}` });
      if (i === 0) {
        const t2 = momentoEn(x.sede, minFecha(AYER, sumarDias(x.fecha, 5)), '16:20');
        filasKD.push({ id: azD.uuid(), persona_id: x.dup.id, sede_id: x.sede.id, finalidad: 'convocatoria', canal: 'whatsapp', acto: 'revocado',
          ocurrido_en: t2, evidencia_tipo: 'verbal_registrado', evidencia_ref: 'Pidió por teléfono que no le escribieran más por WhatsApp',
          registrado_en: t2, politica_version: 'v2.0', source_system: SISTEMA, source_id: `consentimiento-duplicado-revocado-${i + 1}` });
      }
    });
    await insertarLote(c, 'plataforma.consentimientos', filasKD);
    // Tres se fusionan (con la función de la base); los demás quedan por revisar.
    const fusiones = [];
    for (const x of dupPares.slice(0, 3)) {
      const quienFusiona = secretariaDe[x.principal.hogar.sede.codigo]?.id ?? DG;
      await fijarAutor(c, { persona_id: quienFusiona, sede_ids: [x.principal.hogar.sede.id, x.sede.id], nivel_max: 2, alcance_global: false,
        motivo: 'Fusión de un registro duplicado' });
      const { rows: [f] } = await c.query(`SELECT nucleo.fusionar($1, $2, $3, $4) AS id`,
        [x.principal.id, x.dup.id, 'Misma persona: mismo celular y misma fecha de nacimiento; se registró otra vez en la mesa de bienvenida.', quienFusiona]);
      fusiones.push({ ...x, fusion: f.id });
    }
    await autorDG();
    paso(`${dupPares.length} duplicados · ${fusiones.length} fusionados`);

    /* ── 14 · El comité de accesos de hoy recertifica la región Bogotá ── */
    const { rows: porRevisar } = await c.query(
      `SELECT a.id, a.persona_id, a.rol FROM identidad.asignaciones a
         JOIN nucleo.personas p ON p.id = a.persona_id
         JOIN org.sedes s ON s.id = COALESCE(CASE WHEN a.alcance_tipo = 'sede' THEN a.alcance_id END, p.sede_id)
         JOIN org.unidades r ON r.id = s.unidad_id
        WHERE a.revocada_en IS NULL AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
          AND a.vigente_desde <= CURRENT_DATE
          AND (r.codigo = 'REG-BOG' OR a.alcance_tipo = 'organizacion')
        ORDER BY s.codigo, a.rol, a.id`);
    let recert = 0;
    const revocar = personal.find(x => x.revocarHoy);
    for (const a of porRevisar) {
      const firmante = a.persona_id === DG ? esposaDG.id : DG;
      await fijarAutor(c, { persona_id: firmante, sede_ids: [], nivel_max: 4, alcance_global: true, motivo: 'Comité trimestral de accesos' });
      const esRevocar = revocar && a.id === revocar.asignacion;
      await c.query(`SELECT identidad.recertificar($1, $2, $3)`, [a.id, esRevocar ? 'se_revoca' : 'se_mantiene',
        esRevocar ? 'Pidió dejar la consejería por salud; sus casos pasan a los otros dos consejeros de la sede.'
          : `Comité trimestral de accesos del ${HOY}: sigue en el cargo y usa el acceso que tiene.`]);
      recert++;
    }
    await autorDG();
    paso(`${recert} accesos recertificados`);

    /* ── 15 · Revocaciones de hoy, con la función de la base ────────── */
    const azV = azar.derivar('revocaciones-hoy');
    const coordinadorDe = {};
    for (const x of personal) if (x.rol === 'COORDINADOR_NUEVOS' && !x.anterior && !coordinadorDe[x.sede.codigo]) coordinadorDe[x.sede.codigo] = x.persona;
    const conWhatsapp = new Set(filasK.filter(k => k.canal === 'whatsapp' && k.finalidad === 'convocatoria' && k.acto === 'otorgado').map(k => k.persona_id));
    const revocanHoy = azV.muestra(vivos.filter(p => p.estado === 'activa' && conWhatsapp.has(p.id) && edad(p.fecha_nacimiento) >= 18
      && !filasK.some(k => k.persona_id === p.id && k.acto === 'revocado')), 5);
    for (const p of revocanHoy) {
      const s = p.hogar.sede;
      await fijarAutor(c, { persona_id: (coordinadorDe[s.codigo] ?? pastoral[s.codigo].pareja[0]).id, sede_ids: [s.id], nivel_max: 2,
        alcance_global: false, motivo: 'Revocación pedida por el titular' });
      await c.query(`SELECT plataforma.revocar_consentimiento($1, 'whatsapp', 'convocatoria', $2)`,
        [p.id, 'Pidió en la recepción que no le escriban más por WhatsApp para convocatorias']);
    }
    await autorDG();

    conteo.sedes_nuevas = Object.values(S).filter(s => !s.semilla).length;
    conteo.traslados = nTraslados;
    conteo.fusiones = fusiones.length;
    conteo.recertificaciones = recert;
    conteo.revocaciones_hoy = revocanHoy.length;
    void asigEsposaDG; void pastoral; void azNombres;
    paso('listo para confirmar');
  });

  const tablas = ['org.sedes', 'org.ministerios_sede', 'org.segmentos', 'org.unidad_miembros', 'sistema.modulos_sede',
    'nucleo.personas', 'nucleo.membresias_sede', 'nucleo.vinculos', 'nucleo.acudientes', 'nucleo.fusiones',
    'nucleo.persona_atributos', 'grupos.hogares', 'grupos.hogar_miembros', 'plataforma.politicas_tratamiento',
    'plataforma.consentimientos', 'identidad.asignaciones', 'identidad.cuentas', 'identidad.recertificaciones',
    'crm.linea_tiempo', 'sistema.bitacora_aprovisionamiento'];
  return { ...(await d.contarFilas(c, tablas)), ...conteo };
});
