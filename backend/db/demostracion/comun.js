'use strict';
/**
 * =====================================================================
 * comun.js · LO QUE COMPARTEN LOS POBLADORES DE LA RED DE DEMOSTRACIÓN
 *
 * ⛔ SOLO DEMOSTRACIÓN. Nada de lo que se construye con este archivo es
 *    real: personas, sedes nuevas, familias, correos y teléfonos son
 *    inventados. Jamás se corre contra producción: `conectar()` se niega
 *    si la base no es casaroca_dev, casaroca_test, cr_e2e_* o cr_pob_*.
 *
 * Quién lo usa: 00-red.js (el núcleo) y los pobladores de módulos
 * (10-...js a 60-...js). Los pobladores de módulos NO editan este
 * archivo: si algo falta, lo resuelven en su propio archivo.
 *
 * ── LO QUE 00-red.js YA DEJA EN LA BASE (no lo vuelva a crear) ─────────
 *   · 36 sedes (las 6 de la semilla + 30 nuevas), cada una colgada de su
 *     región (REG-BOG, REG-COL, REG-INT) con su zona horaria correcta.
 *   · Las 6 personas de la semilla conservan id y rol, pero ya no se llaman
 *     «Director General» ni «Pastor Norte»: búsquelas por su rol
 *     (direccionGeneral(), pastores()), nunca por el nombre.
 *   · Ministerios encendidos por sede (org.ministerios_sede) y los
 *     SEGMENTOS de RocaKids (BEBES, PEQUENOS, EXPLORADORES, AVENTUREROS) y
 *     de tMt (PULSO, ECO, LEGADO) en cada sede donde esos ministerios están
 *     encendidos. Use `segmentos()`; no los inserte de nuevo (choca con la
 *     restricción única sede + ministerio + código).
 *   · Módulos por sede (sistema.modulos_sede): los de compuerta legal
 *     quedaron encendidos con su evidencia donde corresponde. Use
 *     `sedes(c, { conModulo: 'aportes' })` para poblar SOLO donde el
 *     módulo está encendido: la API esconde las sedes donde está apagado.
 *   · ~4.100 personas en hogares (grupos.hogares y grupos.hogar_miembros:
 *     un hogar por familia de dos o más personas). El poblador de grupos
 *     NO crea hogares, y su comprobación de «ya poblado» debe mirar
 *     grupos.grupos, no grupos.hogares.
 *   · Menores con su acudiente principal y a veces un segundo acudiente
 *     (nucleo.acudientes), vínculos CONYUGE e HIJO/HIJA (nucleo.vinculos).
 *   · Consentimientos por canal y finalidad, y las dos versiones de la
 *     política de tratamiento (v1.0 retirada y v2.0 vigente).
 *   · Roles de sede: PASTOR_CONGREGACIONAL (siempre la pareja), SECRETARIA,
 *     TESORERIA, DIGITADOR_APORTES, dos CONSEJERO y COORDINADOR_NUEVOS. En
 *     la central: la dirección general (pareja) y los equipos con sus
 *     integrantes. Las regiones tienen su pareja supervisora.
 *   · Cuentas de acceso para quien tiene rol, con CLAVE_LABORATORIO y sin
 *     segundo factor activo.
 *   ⛔ NO deja roles de RocaKids (MAESTRO_ROCAKIDS, DIRECTOR_ROCAKIDS) ni
 *     de líder de grupo, ni integrantes del equipo EQ-KIDS: dependen de
 *     antecedentes y de grupos, y los ponen esos pobladores.
 *
 * ── CONTRATO DE UN POBLADOR DE MÓDULO ────────────────────────────────
 *     const d = require('./comun');
 *     d.ejecutar({ archivo: 30, tema: 'consejería' }, async (c, azar) => {
 *       if (await d.yaPoblado(c, `SELECT count(*) FROM consejeria.casos
 *              WHERE source_system = $1`, [d.SISTEMA], 'consejería')) return;
 *       await d.enTransaccion(c, async () => {
 *         const [pastor] = await d.pastores(c, 'CALI');
 *         await d.autorComo(c, pastor.persona_id);     // la auditoría dice quién
 *         ...
 *       });
 *       return await d.contarFilas(c, ['consejeria.casos']);
 *     });
 *
 * Reglas (GUIA-POBLAR.md): determinista (nunca Math.random ni new Date()),
 * fecha de referencia 21 de septiembre de 2026, por las reglas de la base
 * y no alrededor de ellas, con autor, rápido y realista.
 * =====================================================================
 */
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

const RAIZ_BACKEND = path.join(__dirname, '..', '..');
const requerirApi = createRequire(path.join(RAIZ_BACKEND, 'api', 'package.json'));
const { Client } = requerirApi('pg');

/* ─────────────────────────────────────────────────────────────────────
   1 · CONSTANTES
   ───────────────────────────────────────────────────────────────────── */

/** Fecha de referencia de toda la demostración (texto AAAA-MM-DD). La
    historia inventada va de septiembre de 2025 a esta fecha, y lo que viene
    llega hasta noviembre de 2026. Nunca use `new Date()`. */
const FECHA_REFERENCIA = '2026-09-21';

/** El día anterior a la referencia. Úselo como tope de lo que TIENE que
    estar en el pasado (la base rechaza consentimientos y otras cosas con
    fecha futura, y el poblador puede correr hoy a cualquier hora). */
const AYER = '2026-09-20';

/** Primer día de la historia viva del sistema (salida en vivo de la ola 1). */
const INICIO_HISTORIA = '2025-09-08';

/** Último día de lo que viene (eventos, vencimientos, plazos). */
const FIN_HORIZONTE = '2026-11-30';

/** Linaje de todo lo inventado: va en `source_system` donde la tabla lo tenga. */
const SISTEMA = 'demostracion';

/** Semilla base: cada archivo usa SEMILLA_BASE + su número. */
const SEMILLA_BASE = 20260921;

/** Clave de laboratorio de TODAS las cuentas de la demostración. Es la misma
    que usa backend/scripts/token-para.js. ⛔ Solo laboratorio. */
const CLAVE_LABORATORIO = 'frase larga de laboratorio para el banco de api';

/** Bases sobre las que se permite poblar. Cualquier otra se rechaza. */
const BASES_PERMITIDAS = [/^casaroca_dev$/, /^casaroca_test$/, /^cr_e2e_[a-z0-9_]+$/, /^cr_pob_[a-z0-9_]+$/];

/** Salidas en vivo por ola de migración (ola_migracion de org.sedes). Lo que
    existía antes de la ola de su sede llegó por migración ese día. */
const SALIDAS_POR_OLA = {
  1: '2025-09-08', 2: '2025-10-06', 3: '2025-11-10', 4: '2026-01-19', 5: '2026-03-02',
};

/** Canales y finalidades de contacto (plataforma.canal_contacto y plataforma.finalidades). */
const CANALES = ['email', 'sms', 'whatsapp', 'llamada', 'correo_fisico', 'push'];
const FINALIDADES = ['pastoral', 'convocatoria', 'administrativa', 'menores', 'emergencia'];

/* ─────────────────────────────────────────────────────────────────────
   2 · AZAR CON SEMILLA (mulberry32)
   ───────────────────────────────────────────────────────────────────── */

/** Generador mulberry32: devuelve una función que da números en [0, 1). */
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de 32 bits de un texto (FNV-1a), para derivar semillas por etiqueta. */
function hash32(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Azar determinista. Todos los métodos consumen el mismo flujo, así que el
 * orden de las llamadas importa: si quiere que una parte no cambie cuando
 * toca otra, derive un flujo propio con `azar.derivar('etiqueta')`.
 */
class Azar {
  /** @param {number} semilla entero de 32 bits */
  constructor(semilla) {
    this.semilla = semilla >>> 0;
    this._f = mulberry32(this.semilla);
  }
  /** Número en [0, 1). */
  siguiente() { return this._f(); }
  /** Entero entre min y max, ambos incluidos. */
  entero(min, max) { return min + Math.floor(this._f() * (max - min + 1)); }
  /** Decimal entre min (incluido) y max (excluido). */
  decimal(min, max) { return min + this._f() * (max - min); }
  /** true con probabilidad p (0 a 1). */
  probabilidad(p) { return this._f() < p; }
  /** Un elemento de la lista. */
  elegir(lista) {
    if (!lista || !lista.length) throw new Error('azar.elegir: la lista está vacía');
    return lista[Math.floor(this._f() * lista.length)];
  }
  /**
   * Un valor según pesos. Acepta [[valor, peso], ...] o { valor: peso }.
   * Ej.: azar.ponderado({ efectivo: 5, transferencia: 3, nequi_daviplata: 2 })
   */
  ponderado(pesos) {
    const pares = Array.isArray(pesos) ? pesos : Object.entries(pesos);
    const total = pares.reduce((s, [, p]) => s + p, 0);
    let x = this._f() * total;
    for (const [v, p] of pares) { if ((x -= p) < 0) return v; }
    return pares[pares.length - 1][0];
  }
  /** Copia barajada (Fisher-Yates). No toca la lista original. */
  barajar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this._f() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** n elementos distintos de la lista (o todos si hay menos). */
  muestra(lista, n) { return this.barajar(lista).slice(0, Math.max(0, n)); }
  /** Número con distribución normal (Box-Muller). */
  normal(media, desviacion) {
    const u = Math.max(this._f(), 1e-12), v = this._f();
    return media + desviacion * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Normal recortada al intervalo [min, max] y redondeada a entero. */
  normalEntera(media, desviacion, min, max) {
    return Math.min(max, Math.max(min, Math.round(this.normal(media, desviacion))));
  }
  /** Fecha AAAA-MM-DD uniforme entre desde y hasta (incluidas). */
  fechaEntre(desde, hasta) {
    const d = diasEntre(desde, hasta);
    if (d < 0) throw new Error(`azar.fechaEntre: ${desde} es posterior a ${hasta}`);
    return sumarDias(desde, this.entero(0, d));
  }
  /** Hora HH:MM entre dos horas, en pasos de `paso` minutos. */
  horaEntre(desde = '08:00', hasta = '18:00', paso = 5) {
    const m0 = aMinutos(desde), m1 = aMinutos(hasta);
    const pasos = Math.floor((m1 - m0) / paso);
    const m = m0 + this.entero(0, Math.max(0, pasos)) * paso;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  /** Texto hexadecimal de n caracteres (referencias, folios). */
  hex(n = 8) {
    let s = '';
    while (s.length < n) s += Math.floor(this._f() * 16).toString(16);
    return s;
  }
  /** UUID v4 determinista. Úselo como id de lo que inserta: así el mismo
      poblador deja los mismos identificadores en cada corrida. */
  uuid() {
    const b = new Array(16);
    for (let i = 0; i < 16; i++) b[i] = Math.floor(this._f() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  /** Flujo independiente, derivado de esta semilla y una etiqueta. Cambiar el
      código de una parte no altera lo que sale en las demás. */
  derivar(etiqueta) { return new Azar(hash32(`${this.semilla}:${etiqueta}`)); }
}

/**
 * El azar de un archivo: mulberry32(20260921 + número del archivo).
 * @param {number} numeroArchivo 0 para 00-red.js, 10 para 10-...js, etc.
 * @param {string} [etiqueta] si se da, devuelve un flujo derivado con esa etiqueta.
 */
function crearAzar(numeroArchivo, etiqueta) {
  const a = new Azar(SEMILLA_BASE + Number(numeroArchivo));
  return etiqueta ? a.derivar(etiqueta) : a;
}

/* ─────────────────────────────────────────────────────────────────────
   3 · FECHAS (texto AAAA-MM-DD, sin husos: nada depende del reloj)
   ───────────────────────────────────────────────────────────────────── */

const _utc = (f) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const _texto = (ms) => new Date(ms).toISOString().slice(0, 10);
function aMinutos(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); }

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
function sumarDias(fecha, dias) { return _texto(_utc(fecha) + dias * 86400000); }

/** Suma meses conservando el día cuando existe (31 ene + 1 mes = 28 feb). */
function sumarMeses(fecha, meses) {
  const [y, m, d] = fecha.split('-').map(Number);
  const total = (y * 12 + (m - 1)) + meses;
  const ny = Math.floor(total / 12), nm = total % 12;
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return _texto(Date.UTC(ny, nm, Math.min(d, ultimo)));
}

/** Suma años (29 feb cae en 28 feb si el año no es bisiesto). */
function sumarAnios(fecha, anios) { return sumarMeses(fecha, anios * 12); }

/** Días de `desde` a `hasta` (negativo si hasta es anterior). */
function diasEntre(desde, hasta) { return Math.round((_utc(hasta) - _utc(desde)) / 86400000); }

/** Edad cumplida en años a una fecha (por omisión, la de referencia). */
function edad(fechaNacimiento, a = FECHA_REFERENCIA) {
  if (!fechaNacimiento) return null;
  const [y1, m1, d1] = fechaNacimiento.split('-').map(Number);
  const [y2, m2, d2] = a.split('-').map(Number);
  return y2 - y1 - ((m2 < m1 || (m2 === m1 && d2 < d1)) ? 1 : 0);
}

/** ¿Es menor de 18 años a esa fecha? */
function esMenor(fechaNacimiento, a = FECHA_REFERENCIA) {
  const e = edad(fechaNacimiento, a);
  return e !== null && e < 18;
}

/** Día de la semana: 0 domingo … 6 sábado. */
function diaSemana(fecha) { return new Date(_utc(fecha)).getUTCDay(); }

/** Nombre del día como lo guarda la base (grupos.dia_reunion): 'lunes'…'domingo', sin tildes. */
function nombreDia(fecha) { return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][diaSemana(fecha)]; }

/** Todas las fechas de un día de la semana (0 = domingo) entre dos fechas incluidas. */
function fechasDelDia(dia, desde, hasta) {
  const salida = [];
  let f = sumarDias(desde, (7 + dia - diaSemana(desde)) % 7);
  while (diasEntre(f, hasta) >= 0) { salida.push(f); f = sumarDias(f, 7); }
  return salida;
}

/** Domingos entre dos fechas incluidas. */
function domingosEntre(desde, hasta) { return fechasDelDia(0, desde, hasta); }

/** La menor y la mayor de dos fechas AAAA-MM-DD. */
function minFecha(a, b) { return a <= b ? a : b; }
function maxFecha(a, b) { return a >= b ? a : b; }

/** Desfase en minutos de una zona horaria en un instante (Intl, sin librerías). */
function desfaseMinutos(zona, instanteMs) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(instanteMs)).map(x => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((comoUtc - instanteMs) / 60000);
}

/**
 * Un instante con zona horaria, listo para una columna timestamptz.
 * Tiene en cuenta el horario de verano (Madrid, Barcelona, Estados Unidos).
 * @param {string} fecha AAAA-MM-DD
 * @param {string} hora HH:MM (hora local de esa zona)
 * @param {string} zona p. ej. 'America/Bogota' (use la zona_horaria de la sede)
 * @returns {string} p. ej. '2026-03-15T10:30:00-05:00'
 */
function momentoLocal(fecha, hora = '12:00', zona = 'America/Bogota') {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const local = Date.UTC(y, m - 1, d, hh, mm || 0, 0);
  let off = desfaseMinutos(zona, local);
  const off2 = desfaseMinutos(zona, local - off * 60000);
  if (off2 !== off) off = off2;
  const signo = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${fecha}T${String(hh).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}:00${signo}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/* ─────────────────────────────────────────────────────────────────────
   4 · NOMBRES, CORREOS, TELÉFONOS Y DOCUMENTOS INVENTADOS
   Combinaciones inventadas a partir de nombres y apellidos comunes. Las
   listas se agrupan por generación para que una abuela no se llame
   «Zharick» ni un bebé «Hernando».
   ───────────────────────────────────────────────────────────────────── */

const NOMBRES_HOMBRE = {
  mayores: ['José', 'Luis', 'Carlos', 'Jorge', 'Álvaro', 'Hernando', 'Gustavo', 'Fabio', 'Orlando', 'Rafael',
    'Alfonso', 'Guillermo', 'Jaime', 'Germán', 'Rodrigo', 'Humberto', 'Ricardo', 'Hernán', 'Gilberto', 'Arturo',
    'Efraín', 'Hugo', 'Mario', 'Óscar', 'Fernando', 'Julio', 'Alberto', 'Rubén', 'Édgar', 'Nelson', 'Jairo',
    'Libardo', 'Ramiro', 'Gonzalo', 'Enrique', 'Manuel', 'Francisco', 'Pedro', 'Antonio', 'Eduardo', 'Víctor',
    'Marco', 'Aurelio', 'Ignacio', 'Octavio', 'Reinaldo', 'Alirio', 'Belisario', 'Ernesto', 'Tiberio', 'Heriberto',
    'Luis Alberto', 'Jorge Enrique', 'José Vicente', 'Pedro Pablo', 'Luis Eduardo', 'José Antonio', 'Carlos Arturo'],
  medios: ['Andrés', 'Juan', 'Diego', 'Felipe', 'Mauricio', 'Alejandro', 'Javier', 'Sergio', 'Camilo', 'Iván',
    'Fredy', 'Jhon', 'Edwin', 'Wilmer', 'Yesid', 'Harold', 'Giovanny', 'Alexander', 'Fabián', 'Leonardo', 'Julián',
    'Daniel', 'David', 'Esteban', 'Cristian', 'Jonathan', 'Ronald', 'Milton', 'Robinson', 'Gabriel', 'Omar',
    'César', 'Adolfo', 'Arley', 'Duván', 'Wilson', 'William', 'Nicolás', 'Ricardo', 'Hugo', 'Rodrigo', 'Álex',
    'Juan Carlos', 'Juan David', 'Juan Pablo', 'Carlos Andrés', 'Luis Fernando', 'Jorge Iván', 'Juan Camilo',
    'Luis Carlos', 'Diego Fernando', 'Andrés Felipe', 'Jhon Fredy', 'Óscar Iván', 'Édison', 'Norbey', 'Yeison'],
  jovenes: ['Santiago', 'Sebastián', 'Nicolás', 'Daniel', 'David', 'Alejandro', 'Felipe', 'Andrés', 'Julián',
    'Esteban', 'Camilo', 'Kevin', 'Brayan', 'Stiven', 'Johan', 'Sneider', 'Yeferson', 'Andrey', 'Mateo', 'Miguel',
    'Juan Sebastián', 'Juan Esteban', 'Juan Diego', 'Juan José', 'Miguel Ángel', 'Luis Miguel', 'Jhonatan',
    'Cristian Camilo', 'Brandon', 'Maicol', 'Duvan', 'Samuel', 'Simón', 'Tomás', 'Jacobo', 'Gabriel', 'Isaac',
    'Emmanuel', 'Joel', 'Josué', 'Elías', 'Nicolás Andrés', 'Mauricio', 'Iván Darío'],
  ninos: ['Samuel', 'Matías', 'Tomás', 'Emiliano', 'Martín', 'Jerónimo', 'Juan José', 'Juan Pablo', 'Juan Martín',
    'Simón', 'Maximiliano', 'Emmanuel', 'Gabriel', 'Thiago', 'Salvador', 'Joaquín', 'Lucas', 'Benjamín', 'Mateo',
    'Agustín', 'Dylan', 'Isaac', 'Jacobo', 'Santiago', 'Sebastián', 'Nicolás', 'Daniel', 'David', 'Felipe',
    'Emilio', 'Federico', 'Juan Esteban', 'Miguel Ángel', 'Luciano', 'Ian', 'Liam', 'Gael', 'Samuel David',
    'Elías', 'Noah', 'Josué', 'Mathías', 'Juan Diego', 'Alejandro', 'Pablo'],
};

const NOMBRES_MUJER = {
  mayores: ['María', 'Rosa', 'Carmen', 'Gloria', 'Blanca', 'Luz', 'Martha', 'Ana', 'Cecilia', 'Beatriz', 'Esperanza',
    'Amparo', 'Consuelo', 'Nubia', 'Myriam', 'Stella', 'Teresa', 'Inés', 'Graciela', 'Rocío', 'Olga', 'Nelly',
    'Fanny', 'Mercedes', 'Leonor', 'Lucía', 'Aurora', 'Alba', 'Dora', 'Elvira', 'Gladys', 'Marleny', 'Yolanda',
    'Lilia', 'Luz Marina', 'María Teresa', 'María Elena', 'Ana Lucía', 'Rosa Elena', 'Luz Dary', 'Luz Stella',
    'Martha Cecilia', 'María Eugenia', 'Carmenza', 'Hilda', 'Ofelia', 'Betty', 'Socorro', 'Clemencia', 'Ligia'],
  medios: ['Claudia', 'Sandra', 'Adriana', 'Patricia', 'Diana', 'Paola', 'Carolina', 'Liliana', 'Marcela', 'Natalia',
    'Andrea', 'Ángela', 'Mónica', 'Johana', 'Viviana', 'Yenny', 'Érika', 'Lorena', 'Catalina', 'Alejandra',
    'Juliana', 'Paula', 'Tatiana', 'Milena', 'Yuliana', 'Leidy', 'Yesenia', 'Sonia', 'Ximena', 'Marisol', 'Nathaly',
    'Yamile', 'Maritza', 'Luisa Fernanda', 'María Fernanda', 'Ana María', 'Laura', 'Daniela', 'Camila', 'Vanessa',
    'Katherine', 'Jessica', 'Lina', 'Sandra Milena', 'Diana Carolina', 'Luz Adriana', 'Ángela María', 'Yadira',
    'Mayerly', 'Dayana', 'Jenny', 'Olga Lucía'],
  jovenes: ['Valentina', 'Sofía', 'Isabella', 'Mariana', 'Salomé', 'Gabriela', 'Valeria', 'Manuela', 'Sara', 'Laura',
    'Daniela', 'Camila', 'Natalia', 'María José', 'María Paula', 'María Camila', 'Juliana', 'Paula Andrea',
    'Luisa', 'Alejandra', 'Karen', 'Tatiana', 'Stefany', 'Yuliana', 'Nicole', 'Allison', 'Ashley', 'Danna',
    'Zharick', 'Sharon', 'Melissa', 'Andrea', 'Lina', 'Ana Sofía', 'Carolina', 'Viviana', 'Kelly', 'Estefanía',
    'Juana', 'Catalina', 'Michelle'],
  ninos: ['Valentina', 'Sofía', 'Isabella', 'Mariana', 'Salomé', 'Antonella', 'Luciana', 'Emilia', 'Violeta', 'Sara',
    'Gabriela', 'Valeria', 'Martina', 'Manuela', 'Samantha', 'Victoria', 'Juanita', 'Julieta', 'María José',
    'María Paula', 'Luna', 'Abigail', 'Amelia', 'Elena', 'Renata', 'Paulina', 'Isabel', 'Catalina', 'Ana Sofía',
    'Ana Lucía', 'Mía', 'Emma', 'Regina', 'Josefina', 'Florencia', 'Agustina', 'Allison', 'Danna Sofía',
    'Mariángel', 'Susana', 'Lucía', 'Alicia', 'Margarita'],
};

/** Nombres de españoles, panameños y estadounidenses, para las sedes de afuera. */
const NOMBRES_EXTERIOR = {
  ES: { M: ['Jordi', 'Pau', 'Marc', 'Àlex', 'Javier', 'Alberto', 'Sergio', 'Pablo', 'Álvaro', 'Hugo', 'Adrián',
    'Rubén', 'Iván', 'Óscar', 'Raúl', 'Jaume', 'Oriol', 'Xavier', 'Íñigo', 'Mario'],
  F: ['Laia', 'Núria', 'Montserrat', 'Pilar', 'Carmen', 'Lucía', 'Paula', 'Alba', 'Irene', 'Marta', 'Cristina',
    'Elena', 'Nerea', 'Aina', 'Mireia', 'Rocío', 'Begoña', 'Ainhoa', 'Sílvia', 'Lorena'] },
  PA: { M: ['Rubén', 'Ricardo', 'Aníbal', 'Rolando', 'Abdiel', 'Eliécer', 'Omar', 'Luis', 'Roberto', 'Iván',
    'Joel', 'Abel', 'Edwin', 'Moisés', 'Ramón'],
  F: ['Itzel', 'Yariela', 'Anayansi', 'Yamileth', 'Dayra', 'Lisbeth', 'Kathia', 'Yarisel', 'Nitzia', 'Maribel',
    'Aracelly', 'Yahaira', 'Katherine', 'Gisela', 'Mitzi'] },
  US: { M: ['Kevin', 'Brian', 'Jason', 'Ethan', 'Aiden', 'Justin', 'Christopher', 'Anthony', 'Ryan', 'Jayden',
    'Nathan', 'Adrian', 'Dylan', 'Logan', 'Evan'],
  F: ['Ashley', 'Jennifer', 'Nicole', 'Olivia', 'Emma', 'Mia', 'Chloe', 'Isabella', 'Madison', 'Kimberly',
    'Stephanie', 'Brianna', 'Emily', 'Samantha', 'Victoria'] },
  VE: { M: ['José Gregorio', 'Luis Alfonso', 'Yorman', 'Keiner', 'Deivis', 'Edixon', 'Freddy', 'Yohan', 'Eliezer',
    'Rafael', 'Wuilmer', 'Jesús', 'Ender', 'Leonel', 'Franklin'],
  F: ['María Gabriela', 'Yulimar', 'Oriana', 'Génesis', 'Yoselin', 'Yusleidy', 'Mariangel', 'Yenifer', 'Dayana',
    'Rosmary', 'Yorgelis', 'Andreína', 'Maryuri', 'Nairobi', 'Yuliett'] },
};

/** Apellidos frecuentes en Colombia. */
const APELLIDOS = ['Rodríguez', 'Gómez', 'González', 'Martínez', 'García', 'López', 'Hernández', 'Sánchez',
  'Ramírez', 'Pérez', 'Díaz', 'Muñoz', 'Rojas', 'Moreno', 'Jiménez', 'Vargas', 'Castro', 'Gutiérrez', 'Álvarez',
  'Romero', 'Suárez', 'Torres', 'Ruiz', 'Ortiz', 'Herrera', 'Castillo', 'Guerrero', 'Mendoza', 'Medina',
  'Cárdenas', 'Ospina', 'Restrepo', 'Zapata', 'Arango', 'Cardona', 'Giraldo', 'Montoya', 'Quintero', 'Salazar',
  'Valencia', 'Correa', 'Mejía', 'Henao', 'Londoño', 'Betancur', 'Posada', 'Uribe', 'Echeverri', 'Vélez',
  'Agudelo', 'Marín', 'Osorio', 'Ríos', 'Duque', 'Cano', 'Toro', 'Palacio', 'Arias', 'Soto', 'Bedoya', 'Castaño',
  'Hoyos', 'Rendón', 'Múnera', 'Franco', 'Gil', 'Jaramillo', 'Serna', 'Estrada', 'Villa', 'Alzate', 'Buitrago',
  'Calle', 'Tamayo', 'Rincón', 'Pineda', 'Barrera', 'Cortés', 'Acosta', 'Parra', 'Vega', 'Rivera', 'Rubio',
  'Peña', 'Pardo', 'Beltrán', 'Camacho', 'Forero', 'Cruz', 'Ramos', 'Méndez', 'Bernal', 'Gaitán', 'Rozo',
  'Sierra', 'Nieto', 'Prieto', 'Garzón', 'Moya', 'Lozano', 'Molina', 'Ávila', 'Chaparro', 'Bustos', 'Galindo',
  'León', 'Sandoval', 'Fonseca', 'Neira', 'Téllez', 'Hurtado', 'Caicedo', 'Mosquera', 'Valderrama', 'Cifuentes',
  'Aguirre', 'Orozco', 'Sepúlveda', 'Montaño', 'Benítez', 'Figueroa', 'Cabrera', 'Navarro', 'Guzmán', 'Vásquez',
  'Ayala', 'Delgado', 'Espinosa', 'Zambrano', 'Paz', 'Bravo', 'Ibarra', 'Lara', 'Olarte', 'Porras', 'Quiroga',
  'Rangel', 'Tovar', 'Urrego', 'Varón', 'Villamil', 'Zuluaga', 'Ariza', 'Barreto', 'Becerra', 'Campos',
  'Carvajal', 'Cuéllar', 'Escobar', 'Flórez', 'Galvis', 'Gallego', 'Granados', 'Guevara', 'Ibáñez', 'Lemus',
  'Lizarazo', 'Llanos', 'Maldonado', 'Mantilla', 'Márquez', 'Mora', 'Murillo', 'Niño', 'Ochoa', 'Olaya',
  'Otálora', 'Pacheco', 'Patiño', 'Perdomo', 'Pinto', 'Puentes', 'Quevedo', 'Reyes', 'Riaño', 'Robayo', 'Rueda',
  'Salcedo', 'Sarmiento', 'Solano', 'Tapias', 'Trujillo', 'Useche', 'Valbuena', 'Vanegas', 'Vera', 'Villegas',
  'Zamora', 'Acevedo', 'Amaya', 'Arboleda', 'Arenas', 'Ballesteros', 'Barón', 'Benavides', 'Blanco', 'Buendía',
  'Cadena', 'Calderón', 'Cañón', 'Castellanos', 'Cely', 'Contreras', 'Cubillos', 'Dueñas', 'Durán', 'Fajardo',
  'Fuentes', 'Gamboa', 'Garcés', 'Hincapié', 'Holguín', 'Lugo', 'Macías', 'Manrique', 'Mesa', 'Montenegro',
  'Obando', 'Orjuela', 'Páez', 'Piñeros', 'Poveda', 'Quintana', 'Rengifo', 'Rosero', 'Saavedra', 'Sabogal',
  'Santamaría', 'Segura', 'Sossa', 'Sotelo', 'Ulloa', 'Vallejo', 'Velandia', 'Wilches', 'Yepes', 'Zárate',
  'Bohórquez', 'Cuervo', 'Daza', 'Enciso', 'Guarín', 'Jaimes', 'Leal', 'Melo', 'Nova', 'Ortega', 'Plata',
  'Quiñones', 'Sanabria', 'Suaza', 'Triana', 'Urbina', 'Vaca', 'Arévalo', 'Bolaños', 'Chávez', 'Espitia',
  'Gordillo', 'Insuasty', 'Julio', 'Lobo', 'Mateus', 'Ocampo', 'Palomino', 'Rivas', 'Rico', 'Silva', 'Toledo'];

/** Apellidos de España para los miembros españoles de Barcelona y Madrid. */
const APELLIDOS_ESPANA = ['Fernández', 'Martín', 'Alonso', 'Navarro', 'Domínguez', 'Vázquez', 'Serrano', 'Blanco',
  'Morales', 'Ortega', 'Sanz', 'Núñez', 'Iglesias', 'Garrido', 'Santos', 'Calvo', 'Gallego', 'Vidal', 'Cabrera',
  'Carrasco', 'Caballero', 'Pascual', 'Herrero', 'Lorenzo', 'Montero', 'Hidalgo', 'Ferrer', 'Soler', 'Puig',
  'Serra', 'Pujol', 'Font', 'Martí', 'Vila', 'Roig', 'Casals', 'Esteban', 'Crespo', 'Sáez', 'Velasco'];

/** Apellidos frecuentes en Panamá, Venezuela y el Caribe. */
const APELLIDOS_CARIBE = ['Batista', 'Castillo', 'Barría', 'De León', 'Samaniego', 'Quintero', 'Moreno', 'Araúz',
  'Cedeño', 'Pinzón', 'Colón', 'Marrero', 'Santiago', 'Rivera', 'Figueroa', 'Rondón', 'Carrillo', 'Mendoza',
  'Briceño', 'Guevara', 'Ochoa', 'Urdaneta', 'Brito', 'Zambrano', 'Villalobos'];

/** Apodos (nombre_corto) por primer nombre. */
const APODOS = {
  Francisco: 'Pacho', José: 'Pepe', Luis: 'Lucho', Antonio: 'Toño', Guillermo: 'Memo', Alejandro: 'Alejo',
  Alejandra: 'Aleja', Fernando: 'Nando', Rafael: 'Rafa', Ignacio: 'Nacho', Manuel: 'Manolo', Sebastián: 'Sebas',
  Santiago: 'Santi', Nicolás: 'Nico', Camila: 'Cami', Mariana: 'Mari', Catalina: 'Cata', Valentina: 'Vale',
  Daniela: 'Dani', Natalia: 'Nati', Carolina: 'Caro', Gabriela: 'Gabi', Mercedes: 'Meche', Isabel: 'Chabela',
  Margarita: 'Margo', 'María José': 'Majo', 'María Fernanda': 'Mafe', 'Juan Pablo': 'Juanpa', 'Juan José': 'Juanjo',
  Andrés: 'Andy', Alberto: 'Beto', Roberto: 'Beto', Eduardo: 'Lalo', Jesús: 'Chucho', Consuelo: 'Chelo',
  Esperanza: 'Pita', Patricia: 'Pati', Guadalupe: 'Lupe', Teresa: 'Tere', Ricardo: 'Richi', Gustavo: 'Tavo',
};

/** Quita tildes y deja solo letras y números en minúscula. */
function slug(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Generación de un año de nacimiento: 'mayores' | 'medios' | 'jovenes' | 'ninos'. */
function generacion(anioNacimiento) {
  if (anioNacimiento < 1966) return 'mayores';
  if (anioNacimiento < 1991) return 'medios';
  if (anioNacimiento < 2006) return 'jovenes';
  return 'ninos';
}

/**
 * Nombre de pila inventado, según el género y el año de nacimiento.
 * @param {Azar} azar
 * @param {'M'|'F'} genero
 * @param {number} anioNacimiento
 * @param {{origen?: 'CO'|'ES'|'PA'|'US'|'VE'}} [op] origen para nombres de afuera
 * @returns {{primer_nombre: string, segundo_nombre: string|null}}
 */
function nombrePara(azar, genero, anioNacimiento, op = {}) {
  const origen = op.origen ?? 'CO';
  let lista;
  if (origen !== 'CO' && NOMBRES_EXTERIOR[origen]) lista = NOMBRES_EXTERIOR[origen][genero === 'F' ? 'F' : 'M'];
  else lista = (genero === 'F' ? NOMBRES_MUJER : NOMBRES_HOMBRE)[generacion(anioNacimiento)];
  const base = azar.elegir(lista).split(' ');
  if (base.length > 1) return { primer_nombre: base[0], segundo_nombre: base.slice(1).join(' ') };
  if (origen === 'CO' && azar.probabilidad(0.3)) {
    const otra = (genero === 'F' ? NOMBRES_MUJER : NOMBRES_HOMBRE)[generacion(anioNacimiento)]
      .filter(n => !n.includes(' ') && n !== base[0]);
    return { primer_nombre: base[0], segundo_nombre: azar.elegir(otra) };
  }
  return { primer_nombre: base[0], segundo_nombre: null };
}

/**
 * Un apellido inventado.
 * @param {Azar} azar
 * @param {'CO'|'ES'|'PA'|'US'|'VE'} [origen] 'ES' mezcla apellidos de España; 'PA', 'US' y 'VE', del Caribe.
 */
function apellidoAzar(azar, origen = 'CO') {
  if (origen === 'ES' && azar.probabilidad(0.7)) return azar.elegir(APELLIDOS_ESPANA);
  if (['PA', 'US', 'VE'].includes(origen) && azar.probabilidad(0.45)) return azar.elegir(APELLIDOS_CARIBE);
  return azar.elegir(APELLIDOS);
}

/** Apodo corriente para un primer nombre, si lo hay (o null). */
function apodoDe(nombre) { return APODOS[nombre] ?? null; }

/**
 * Correo inventado, único y SIEMPRE en @example.org.
 * @param {Azar} azar
 * @param {string} nombre primer nombre
 * @param {string} apellido primer apellido
 * @param {Set<string>} usados correos ya tomados (se agrega el nuevo). Cárguelos con usadosEnLaBase().
 */
function correoNuevo(azar, nombre, apellido, usados) {
  const n = slug(nombre), a = slug(apellido);
  const formas = [`${n}.${a}`, `${n}${a}`, `${n[0]}${a}`, `${n}_${a}`, `${n}.${a}${azar.entero(1, 99)}`,
    `${a}.${n}`, `${n}${a}${azar.entero(70, 99)}`];
  for (let i = 0; i < 40; i++) {
    let c = i < formas.length ? formas[azar.entero(0, formas.length - 1)] : `${n}.${a}${azar.entero(100, 9999)}`;
    c = `${c}@example.org`;
    if (!usados.has(c)) { usados.add(c); return c; }
  }
  throw new Error(`No hubo correo libre para ${nombre} ${apellido}`);
}

/**
 * Teléfono móvil inventado y único, en el rango de la guía: 300 555 0000 a 319 555 9999.
 * @param {Azar} azar
 * @param {Set<string>} usados teléfonos tomados (se agrega el nuevo)
 * @returns {string} p. ej. '310 555 0417'
 */
function telefonoNuevo(azar, usados) {
  for (let i = 0; i < 500; i++) {
    const t = `3${String(azar.entero(0, 19)).padStart(2, '0')} 555 ${String(azar.entero(0, 9999)).padStart(4, '0')}`;
    if (!usados.has(t)) { usados.add(t); return t; }
  }
  throw new Error('Se agotaron los teléfonos inventados');
}

/**
 * Número de documento inventado y único, en el rango de la guía: 9000000000 a 9099999999.
 * @param {Azar} azar
 * @param {Set<string>} usados documentos tomados (se agrega el nuevo)
 */
function documentoNuevo(azar, usados) {
  for (let i = 0; i < 500; i++) {
    const d = String(9000000000 + azar.entero(0, 99999999));
    if (!usados.has(d)) { usados.add(d); return d; }
  }
  throw new Error('Se agotaron los documentos inventados');
}

/**
 * Tipo de documento correcto para la edad y el origen, SOLO de los que el
 * catálogo vigente acepta (CC, TI, RC, CE, PA, PEP, PPT). ⛔ DNI, NIE, CIP o
 * SSN existen en nucleo.tipos_documento pero el catálogo no los admite y la
 * base los rechaza: a un español se le registra el pasaporte (PA).
 * @param {number} edadAnios
 * @param {{extranjero?: boolean, venezolano?: boolean, azar?: Azar}} [op]
 */
function tipoDocumentoPara(edadAnios, op = {}) {
  if (edadAnios < 7) return 'RC';
  if (edadAnios < 18) return op.extranjero ? 'PA' : 'TI';
  if (op.venezolano) return op.azar ? op.azar.ponderado({ PPT: 6, PEP: 2, PA: 2 }) : 'PPT';
  if (op.extranjero) return op.azar ? op.azar.ponderado({ PA: 7, CE: 3 }) : 'PA';
  return 'CC';
}

/**
 * Los correos, teléfonos y documentos que ya existen en la base, para no
 * repetirlos al inventar personas nuevas.
 * @returns {Promise<{correos: Set<string>, telefonos: Set<string>, documentos: Set<string>}>}
 */
async function usadosEnLaBase(c) {
  const { rows } = await c.query(
    `SELECT email_principal::text AS e, telefono_movil AS t, numero_documento AS d FROM nucleo.personas`);
  const u = { correos: new Set(), telefonos: new Set(), documentos: new Set() };
  for (const r of rows) {
    if (r.e) u.correos.add(r.e.toLowerCase());
    if (r.t) u.telefonos.add(r.t);
    if (r.d) u.documentos.add(r.d);
  }
  return u;
}

/**
 * Una persona inventada, lista para INSERT INTO nucleo.personas (sin sede
 * ni estado: los pone quien la inserta). Útil para quien necesite gente
 * NUEVA (por ejemplo, visitantes de la bandeja de nuevos).
 * @param {Azar} azar
 * @param {{genero?: 'M'|'F', edad?: number, conCorreo?: boolean, conTelefono?: boolean,
 *          usados: {correos:Set,telefonos:Set,documentos:Set}, origen?: string}} op
 * @returns {object} columnas de nucleo.personas: id, primer_nombre, segundo_nombre, primer_apellido,
 *   segundo_apellido, genero, fecha_nacimiento, tipo_documento, numero_documento, email_principal, telefono_movil
 */
function inventarPersona(azar, op) {
  const genero = op.genero ?? (azar.probabilidad(0.54) ? 'F' : 'M');
  const e = op.edad ?? azar.entero(18, 70);
  const fnac = sumarDias(sumarAnios(FECHA_REFERENCIA, -e - 1), azar.entero(1, 364));
  const anio = Number(fnac.slice(0, 4));
  const origen = op.origen ?? 'CO';
  const { primer_nombre, segundo_nombre } = nombrePara(azar, genero, anio, { origen });
  const primer_apellido = apellidoAzar(azar, origen);
  const segundo_apellido = azar.probabilidad(0.9) ? apellidoAzar(azar, origen) : null;
  const conDoc = azar.probabilidad(0.85);
  const tipo = conDoc ? tipoDocumentoPara(edad(fnac), { extranjero: origen !== 'CO', venezolano: origen === 'VE', azar }) : null;
  return {
    id: azar.uuid(), primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, genero,
    fecha_nacimiento: fnac,
    tipo_documento: tipo, numero_documento: tipo ? documentoNuevo(azar, op.usados.documentos) : null,
    email_principal: (op.conCorreo ?? azar.probabilidad(0.8)) && e >= 14
      ? correoNuevo(azar, primer_nombre, primer_apellido, op.usados.correos) : null,
    telefono_movil: (op.conTelefono ?? azar.probabilidad(0.9)) && e >= 13 ? telefonoNuevo(azar, op.usados.telefonos) : null,
  };
}

/** Nombre completo de una fila con primer_nombre, segundo_nombre, primer_apellido y segundo_apellido. */
function nombreCompleto(p) {
  return [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
}

/* ─────────────────────────────────────────────────────────────────────
   5 · CONEXIÓN, GUARDA Y TRANSACCIONES
   ───────────────────────────────────────────────────────────────────── */

/**
 * La guarda: lanza un error si la base no es de desarrollo.
 * Permitidas: casaroca_dev, casaroca_test, cr_e2e_*, cr_pob_*.
 * @param {string} base
 */
function guardaDeBase(base) {
  if (!base) {
    throw new Error('Falta PGDATABASE. Diga sobre qué base se puebla: PGDATABASE=cr_e2e_60 node 00-red.js');
  }
  if (!BASES_PERMITIDAS.some(r => r.test(base))) {
    throw new Error(`La base «${base}» no está permitida. Esta es una semilla de DEMOSTRACIÓN: solo corre ` +
      'sobre casaroca_dev, casaroca_test, cr_e2e_* o cr_pob_*. Jamás sobre producción.');
  }
  return base;
}

/**
 * Conecta como `postgres` por el socket local (/tmp, puerto 5433) a la base
 * de PGDATABASE, después de pasar la guarda. Como `postgres` se salta la
 * seguridad por fila, pero NO los disparadores, restricciones ni máquinas
 * de estado: esas mandan.
 * @param {{aplicacion?: string}} [op]
 * @returns {Promise<import('pg').Client>}
 */
async function conectar(op = {}) {
  const base = guardaDeBase(process.env.PGDATABASE);
  const c = new Client({
    host: '/tmp', port: 5433, database: base, user: 'postgres',
    application_name: op.aplicacion ?? 'poblador-demostracion',
  });
  await c.connect();
  const { rows: [r] } = await c.query(
    `SELECT current_database() AS base, inet_server_addr() AS ip,
            to_regclass('nucleo.personas') IS NOT NULL AS tiene_modelo`);
  if (r.base !== base) { await c.end(); throw new Error(`Se conectó a «${r.base}» y se pidió «${base}».`); }
  if (r.ip) { await c.end(); throw new Error('La conexión no es por el socket local: se rechaza.'); }
  if (!r.tiene_modelo) { await c.end(); throw new Error(`La base «${base}» no tiene el modelo de CasaRoca (¿se migró?).`); }
  c.base = base;
  return c;
}

/**
 * Abre una transacción, corre `fn` y confirma; si algo falla, revierte todo.
 * El contexto de autor (fijarAutor) vive DENTRO de la transacción.
 * @template T
 * @param {import('pg').Client} c
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function enTransaccion(c, fn) {
  await c.query('BEGIN');
  try {
    const r = await fn();
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

/**
 * Fija quién «hizo» lo que se escribe a continuación, como hace la API con
 * SET LOCAL. Vale hasta el fin de la transacción (llámela DENTRO de
 * enTransaccion). La auditoría, la línea de tiempo y las funciones que
 * piden alcance leen estas variables.
 * @param {import('pg').Client} c
 * @param {{persona_id: string|null, sede_ids?: string[], nivel_max?: number,
 *          alcance_global?: boolean, motivo?: string|null}} autor
 */
async function fijarAutor(c, autor) {
  const sedes = autor.sede_ids ?? [];
  await c.query(
    `SELECT set_config('app.persona_id', $1, true), set_config('app.sede_ids', $2, true),
            set_config('app.nivel_max', $3, true), set_config('app.alcance_global', $4, true),
            set_config('app.motivo', $5, true)`,
    [autor.persona_id ?? '', sedes.length ? `{${sedes.join(',')}}` : '', String(autor.nivel_max ?? 0),
     String(Boolean(autor.alcance_global)), autor.motivo ?? '']);
}

/**
 * Fija como autor a una persona con el contexto que la base le calcula
 * (identidad.contexto_de: sus sedes, su nivel y si alcanza la red), igual
 * que la API al abrir una petición. Si la persona no tiene ningún rol
 * vigente, queda con nivel 0 y sin sedes.
 * @param {import('pg').Client} c
 * @param {string} personaId
 * @param {{motivo?: string}} [op] texto que la auditoría guarda como motivo
 * @returns {Promise<{sedes: string[], nivel_max: number, es_global: boolean, tiene_acceso: boolean}>}
 */
async function autorComo(c, personaId, op = {}) {
  const { rows: [x] } = await c.query(
    `SELECT sedes, nivel_max, es_global, tiene_acceso FROM identidad.contexto_de($1)`, [personaId]);
  const ctx = { sedes: x?.sedes ?? [], nivel_max: Number(x?.nivel_max ?? 0), es_global: Boolean(x?.es_global),
                tiene_acceso: Boolean(x?.tiene_acceso) };
  await fijarAutor(c, { persona_id: personaId, sede_ids: ctx.sedes, nivel_max: ctx.nivel_max,
                        alcance_global: ctx.es_global, motivo: op.motivo ?? null });
  return ctx;
}

/**
 * Fija como autor al Pastor Principal (Director General de la semilla), con
 * alcance de toda la red y N4. Es quien crea iglesias, otorga roles y
 * enciende módulos.
 * @returns {Promise<string>} su persona_id
 */
async function autorDireccion(c, op = {}) {
  const [dg] = await direccionGeneral(c);
  if (!dg) throw new Error('No hay Pastor Principal (PASTOR_DIRECTOR_GENERAL) vigente en la base.');
  await fijarAutor(c, { persona_id: dg.persona_id, sede_ids: [], nivel_max: 4, alcance_global: true,
                        motivo: op.motivo ?? null });
  return dg.persona_id;
}

/**
 * Inserta filas por lotes (un INSERT con muchas filas por viaje).
 * ⛔ Para columnas jsonb pase el texto ya convertido: JSON.stringify(valor).
 *    Un arreglo de JavaScript se envía como arreglo de Postgres, no como JSON.
 * @param {import('pg').Client} c
 * @param {string} tabla p. ej. 'nucleo.personas'
 * @param {object[]} filas objetos con las mismas llaves
 * @param {{columnas?: string[], tamano?: number, conflicto?: string, retornar?: string}} [op]
 *   conflicto: p. ej. 'ON CONFLICT DO NOTHING' · retornar: p. ej. 'id'
 * @returns {Promise<object[]>} lo que devuelva RETURNING (vacío si no se pide)
 */
async function insertarLote(c, tabla, filas, op = {}) {
  if (!filas.length) return [];
  const cols = op.columnas ?? Object.keys(filas[0]);
  const tamano = Math.max(1, Math.min(op.tamano ?? 500, Math.floor(60000 / cols.length)));
  const salida = [];
  for (let i = 0; i < filas.length; i += tamano) {
    const trozo = filas.slice(i, i + tamano);
    const valores = [];
    const marcas = trozo.map((f, j) => {
      for (const col of cols) valores.push(f[col] === undefined ? null : f[col]);
      return '(' + cols.map((_, k) => `$${j * cols.length + k + 1}`).join(',') + ')';
    });
    const sql = `INSERT INTO ${tabla} (${cols.join(',')}) VALUES ${marcas.join(',')} ` +
      `${op.conflicto ?? ''} ${op.retornar ? 'RETURNING ' + op.retornar : ''}`;
    const r = await c.query(sql, valores);
    if (op.retornar) salida.push(...r.rows);
  }
  return salida;
}

/**
 * ¿Ya está poblado este tema? Corre la consulta (debe devolver un número en
 * la primera columna). Si es mayor que cero, avisa y devuelve true: el
 * poblador debe salir sin duplicar.
 * @param {import('pg').Client} c
 * @param {string} consulta p. ej. `SELECT count(*) FROM grupos.grupos WHERE source_system = $1`
 * @param {any[]} parametros
 * @param {string} etiqueta cómo se llama el tema en el aviso
 */
async function yaPoblado(c, consulta, parametros, etiqueta) {
  const { rows: [r] } = await c.query(consulta, parametros ?? []);
  const n = Number(Object.values(r ?? { n: 0 })[0] ?? 0);
  if (n > 0) {
    console.log(`   · ${etiqueta}: ya estaba poblado (${n}). No se duplica: sale sin tocar nada.`);
    return true;
  }
  return false;
}

/**
 * Cuenta filas de varias tablas (para el informe del poblador).
 * @param {import('pg').Client} c
 * @param {string[]} tablas nombres calificados, p. ej. ['nucleo.personas']
 * @param {string} [donde] condición opcional común (p. ej. "source_system = 'demostracion'")
 * @returns {Promise<Object<string, number>>}
 */
async function contarFilas(c, tablas, donde) {
  const salida = {};
  for (const t of tablas) {
    const { rows: [r] } = await c.query(`SELECT count(*)::int AS n FROM ${t}${donde ? ' WHERE ' + donde : ''}`);
    salida[t] = r.n;
  }
  return salida;
}

/**
 * Corre un poblador completo: conecta con la guarda, crea el azar del
 * archivo, mide el tiempo, imprime los conteos que devuelva el trabajo y
 * cierra la conexión. Si algo falla, imprime el error de la base con su
 * detalle y deja el código de salida en 1.
 * @param {{archivo: number, tema: string}} op
 * @param {(c: import('pg').Client, azar: Azar) => Promise<Object<string, number>|void>} trabajo
 */
async function ejecutar(op, trabajo) {
  const inicio = Date.now();
  const n = String(op.archivo).padStart(2, '0');
  let c;
  try {
    c = await conectar({ aplicacion: `poblador-${n}` });
    console.log(`▶ ${n} · ${op.tema} · base ${c.base}`);
    const conteos = await trabajo(c, crearAzar(op.archivo));
    if (conteos) for (const [t, v] of Object.entries(conteos)) console.log(`   ${t.padEnd(44, ' ')} ${v}`);
    console.log(`✔ ${n} · ${op.tema} · ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
  } catch (e) {
    console.error(`⛔ ${n} · ${op.tema}: ${e.message}`);
    if (e.detail) console.error(`   detalle: ${e.detail}`);
    if (e.hint) console.error(`   pista: ${e.hint}`);
    if (e.where) console.error(`   dónde: ${String(e.where).split('\n')[0]}`);
    process.exitCode = 1;
  } finally {
    if (c) await c.end().catch(() => {});
  }
}

/* ─────────────────────────────────────────────────────────────────────
   6 · AYUDAS PARA ELEGIR SEDES Y PERSONAS
   Todas leen la base (como postgres, sin RLS) y devuelven filas simples.
   El orden es estable; si quiere variedad, baraje con SU azar.
   ───────────────────────────────────────────────────────────────────── */

/**
 * Las sedes de la red.
 * @param {import('pg').Client} c
 * @param {{tipo?: string|string[], codigos?: string[], conModulo?: string, conMinisterio?: string,
 *          region?: string, pais?: string, incluirInactivas?: boolean}} [f]
 *   tipo: 'sede_madre' | 'filial_nacional' | 'filial_internacional' | 'plantacion'
 *   conModulo: solo donde ese módulo está ENCENDIDO (p. ej. 'aportes', 'rocakids', 'consejeria')
 *   conMinisterio: solo donde ese ministerio está encendido (p. ej. 'ROCAKIDS', 'TMT')
 *   region: 'REG-BOG' | 'REG-COL' | 'REG-INT'
 * @returns {Promise<Array<{id, codigo, nombre, tipo, pais, ciudad, zona_horaria, ola_migracion, region,
 *   personas: number, tamano: 'grande'|'mediana'|'pequena', modulos: string[], ministerios: string[]}>>}
 */
async function sedes(c, f = {}) {
  const tipos = f.tipo ? (Array.isArray(f.tipo) ? f.tipo : [f.tipo]) : null;
  const { rows } = await c.query(
    `SELECT s.id, s.codigo, s.nombre, s.tipo::text AS tipo, s.pais, s.ciudad, s.zona_horaria, s.ola_migracion,
            u.codigo AS region,
            (SELECT count(*)::int FROM nucleo.personas p
              WHERE p.sede_id = s.id AND p.eliminado_en IS NULL AND p.estado::text = 'activa') AS personas,
            COALESCE((SELECT array_agg(ms.modulo ORDER BY ms.modulo) FROM sistema.modulos_sede ms
                       WHERE ms.sede_id = s.id AND ms.activo), '{}') AS modulos,
            COALESCE((SELECT array_agg(m.codigo ORDER BY m.codigo) FROM org.ministerios_sede x
                        JOIN org.ministerios m ON m.id = x.ministerio_id
                       WHERE x.sede_id = s.id AND x.activo), '{}') AS ministerios
       FROM org.sedes s
       LEFT JOIN org.unidades u ON u.id = s.unidad_id
      WHERE ($1::boolean OR s.activa)
        AND ($2::text[] IS NULL OR s.tipo::text = ANY($2))
        AND ($3::text[] IS NULL OR s.codigo = ANY($3))
        AND ($4::text IS NULL OR u.codigo = $4)
        AND ($5::text IS NULL OR s.pais = $5)
      ORDER BY s.codigo`,
    [Boolean(f.incluirInactivas), tipos, f.codigos ?? null, f.region ?? null, f.pais ?? null]);
  return rows
    .filter(s => !f.conModulo || s.modulos.includes(f.conModulo))
    .filter(s => !f.conMinisterio || s.ministerios.includes(f.conMinisterio))
    .map(s => ({ ...s, tamano: s.personas >= 230 ? 'grande' : s.personas >= 85 ? 'mediana' : 'pequena' }));
}

/** Una sede por su código (p. ej. 'CALI'). Lanza un error si no existe. */
async function sede(c, codigo) {
  const [s] = await sedes(c, { codigos: [codigo], incluirInactivas: true });
  if (!s) throw new Error(`No existe la sede «${codigo}».`);
  return s;
}

/** Resuelve «sede» (código o id) a su id. */
async function _idSede(c, s) {
  if (!s) return null;
  if (/^[0-9a-f-]{36}$/i.test(s)) return s;
  return (await sede(c, s)).id;
}

/**
 * Personas de una sede (o de toda la red) con filtros.
 * @param {import('pg').Client} c
 * @param {{sede?: string, edadMin?: number, edadMax?: number, genero?: 'M'|'F',
 *          estado?: string|null, compromiso?: string|string[], conCorreo?: boolean, conTelefono?: boolean,
 *          sinRol?: boolean, excluir?: string[], limite?: number, azar?: Azar}} [f]
 *   sede: código o id · estado: por omisión 'activa' (pase null para todas)
 *   compromiso: 'visitante' | 'miembro' | 'lider' · sinRol: sin ningún rol vigente
 *   azar: si se da, baraja con él antes de aplicar el límite
 * @returns {Promise<Array<{id, nombre, primer_nombre, primer_apellido, genero, fecha_nacimiento, edad,
 *   sede_id, sede_codigo, zona_horaria, email, telefono, nivel_compromiso, estado_civil, estado, hogar_id}>>}
 */
async function personas(c, f = {}) {
  const sedeId = await _idSede(c, f.sede);
  const comp = f.compromiso ? (Array.isArray(f.compromiso) ? f.compromiso : [f.compromiso]) : null;
  const { rows } = await c.query(
    `SELECT p.id, trim(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre,
            p.primer_nombre, p.primer_apellido, p.genero::text AS genero,
            to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
            date_part('year', age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento))::int AS edad,
            p.sede_id, s.codigo AS sede_codigo, s.zona_horaria, p.email_principal::text AS email,
            p.telefono_movil AS telefono, p.nivel_compromiso, p.estado_civil, p.estado::text AS estado,
            (SELECT hm.hogar_id FROM grupos.hogar_miembros hm WHERE hm.persona_id = p.id AND hm.hasta IS NULL LIMIT 1) AS hogar_id
       FROM nucleo.personas p JOIN org.sedes s ON s.id = p.sede_id
      WHERE p.eliminado_en IS NULL
        AND ($1::uuid IS NULL OR p.sede_id = $1)
        AND ($2::text IS NULL OR p.estado::text = $2)
        AND ($3::int IS NULL OR age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento) >= make_interval(years => $3))
        AND ($4::int IS NULL OR age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento) < make_interval(years => $4 + 1))
        AND ($5::text IS NULL OR p.genero::text = $5)
        AND ($6::text[] IS NULL OR p.nivel_compromiso = ANY($6))
        AND (NOT $7::boolean OR p.email_principal IS NOT NULL)
        AND (NOT $8::boolean OR p.telefono_movil IS NOT NULL)
        AND (NOT $9::boolean OR NOT EXISTS (SELECT 1 FROM identidad.v_permiso_efectivo pe
                                             WHERE pe.persona_id = p.id AND pe.vigente))
        AND ($10::uuid[] IS NULL OR NOT (p.id = ANY($10)))
      ORDER BY p.source_id NULLS FIRST, p.id`,
    [sedeId, f.estado === undefined ? 'activa' : f.estado, f.edadMin ?? null, f.edadMax ?? null, f.genero ?? null,
     comp, Boolean(f.conCorreo), Boolean(f.conTelefono), Boolean(f.sinRol), f.excluir?.length ? f.excluir : null]);
  const lista = f.azar ? f.azar.barajar(rows) : rows;
  return f.limite ? lista.slice(0, f.limite) : lista;
}

/**
 * Las familias (hogares de dos o más personas) de una sede, con sus
 * integrantes y el parentesco de cada uno con el jefe de hogar.
 * @param {import('pg').Client} c
 * @param {{sede?: string, conMenores?: boolean, azar?: Azar, limite?: number}} [f]
 * @returns {Promise<Array<{hogar_id, nombre, sede_id, sede_codigo, direccion, jefe_id,
 *   miembros: Array<{persona_id, nombre, genero, edad, es_menor, parentesco: string|null, estado}>}>>}
 *   parentesco: lo que el integrante ES para el jefe ('CONYUGE', 'HIJO', 'HIJA', 'MADRE', 'PADRE'…);
 *   null para el jefe mismo.
 */
async function familias(c, f = {}) {
  const sedeId = await _idSede(c, f.sede);
  const { rows } = await c.query(
    `SELECT h.id AS hogar_id, h.nombre, h.sede_id, s.codigo AS sede_codigo, h.direccion, h.jefe_hogar_id AS jefe_id,
            json_agg(json_build_object(
              'persona_id', p.id,
              'nombre', trim(concat_ws(' ', p.primer_nombre, p.primer_apellido, p.segundo_apellido)),
              'genero', p.genero, 'estado', p.estado,
              'edad', date_part('year', age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento))::int,
              'es_menor', COALESCE(age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento) < interval '18 years', false),
              'parentesco', (SELECT v.tipo FROM nucleo.vinculos v
                              WHERE v.persona_id = h.jefe_hogar_id AND v.relacionada_id = p.id
                                AND v.vigente_hasta IS NULL LIMIT 1))
              ORDER BY p.fecha_nacimiento NULLS LAST) AS miembros
       FROM grupos.hogares h
       JOIN org.sedes s ON s.id = h.sede_id
       JOIN grupos.hogar_miembros hm ON hm.hogar_id = h.id AND hm.hasta IS NULL
       JOIN nucleo.personas p ON p.id = hm.persona_id AND p.eliminado_en IS NULL
      WHERE h.activo AND ($1::uuid IS NULL OR h.sede_id = $1)
      GROUP BY h.id, s.codigo
      ORDER BY h.source_id NULLS FIRST, h.id`, [sedeId]);
  let lista = rows;
  if (f.conMenores) lista = lista.filter(h => h.miembros.some(m => m.es_menor));
  if (f.azar) lista = f.azar.barajar(lista);
  return f.limite ? lista.slice(0, f.limite) : lista;
}

/**
 * Menores de una sede con TODOS sus acudientes vigentes.
 * @param {import('pg').Client} c
 * @param {{sede?: string, edadMin?: number, edadMax?: number, azar?: Azar, limite?: number}} [f]
 * @returns {Promise<Array<{menor_id, nombre, genero, fecha_nacimiento, edad, sede_id, sede_codigo,
 *   acudientes: Array<{acudiente_id, nombre, parentesco, es_principal, autoriza_retiro, telefono}>}>>}
 */
async function menores(c, f = {}) {
  const sedeId = await _idSede(c, f.sede);
  const { rows } = await c.query(
    `SELECT p.id AS menor_id, trim(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre,
            p.genero::text AS genero, to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
            date_part('year', age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento))::int AS edad,
            p.sede_id, s.codigo AS sede_codigo,
            json_agg(json_build_object('acudiente_id', a.acudiente_id,
                     'nombre', q.primer_nombre || ' ' || q.primer_apellido, 'parentesco', a.parentesco,
                     'es_principal', a.es_principal, 'autoriza_retiro', a.autoriza_retiro,
                     'telefono', q.telefono_movil)
                     ORDER BY a.es_principal DESC, a.creado_en) AS acudientes
       FROM nucleo.personas p
       JOIN org.sedes s ON s.id = p.sede_id
       JOIN nucleo.acudientes a ON a.menor_id = p.id AND a.vigente_hasta IS NULL
       JOIN nucleo.personas q ON q.id = a.acudiente_id
      WHERE p.eliminado_en IS NULL AND p.estado::text = 'activa'
        AND age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento) < interval '18 years'
        AND ($1::uuid IS NULL OR p.sede_id = $1)
        AND ($2::int IS NULL OR age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento) >= make_interval(years => $2))
        AND ($3::int IS NULL OR age(DATE '${FECHA_REFERENCIA}', p.fecha_nacimiento) < make_interval(years => $3 + 1))
      GROUP BY p.id, s.codigo
      ORDER BY p.source_id NULLS FIRST, p.id`, [sedeId, f.edadMin ?? null, f.edadMax ?? null]);
  const lista = f.azar ? f.azar.barajar(rows) : rows;
  return f.limite ? lista.slice(0, f.limite) : lista;
}

/**
 * Quién tiene hoy un rol (asignación personal vigente, no heredada de equipo).
 * @param {import('pg').Client} c
 * @param {string} rol p. ej. 'SECRETARIA', 'TESORERIA', 'CONSEJERO', 'COORDINADOR_NUEVOS'
 * @param {{sede?: string}} [f] sede: código o id; se compara con el alcance si es de sede
 *   o con la sede de la persona si el rol es de otro alcance (p. ej. CONSEJERO es caso_propio)
 * @returns {Promise<Array<{persona_id, nombre, genero, rol, alcance_tipo, alcance_id, nivel_max, asignacion_id,
 *   sede_id, sede_codigo, email, vigente_desde}>>}
 */
async function conRol(c, rol, f = {}) {
  const sedeId = await _idSede(c, f.sede);
  const { rows } = await c.query(
    `SELECT a.persona_id, trim(concat_ws(' ', p.primer_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre,
            p.genero::text AS genero,
            a.rol, a.alcance_tipo::text AS alcance_tipo, a.alcance_id, a.nivel_max, a.id AS asignacion_id,
            COALESCE(CASE WHEN a.alcance_tipo = 'sede' THEN a.alcance_id END, p.sede_id) AS sede_id,
            s.codigo AS sede_codigo, p.email_principal::text AS email,
            to_char(a.vigente_desde, 'YYYY-MM-DD') AS vigente_desde
       FROM identidad.asignaciones a
       JOIN nucleo.personas p ON p.id = a.persona_id
       JOIN org.sedes s ON s.id = COALESCE(CASE WHEN a.alcance_tipo = 'sede' THEN a.alcance_id END, p.sede_id)
      WHERE a.rol = $1 AND a.revocada_en IS NULL
        AND a.vigente_desde <= DATE '${FECHA_REFERENCIA}'
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= DATE '${FECHA_REFERENCIA}')
        AND ($2::uuid IS NULL OR s.id = $2)
      ORDER BY s.codigo, p.primer_apellido, p.primer_nombre`, [rol, sedeId]);
  return rows;
}

/** La pareja pastoral de una sede (PASTOR_CONGREGACIONAL con alcance de esa sede): [pastor, pastora],
    siempre en ese orden. ⛔ Los pastores van en matrimonio: son dos, nunca uno. */
async function pastores(c, sedeCodigoOId) {
  const lista = await conRol(c, 'PASTOR_CONGREGACIONAL', { sede: sedeCodigoOId });
  return lista.filter(x => x.alcance_tipo === 'sede')
    .sort((x, y) => (x.genero === 'M' ? 0 : 1) - (y.genero === 'M' ? 0 : 1));
}

/** Los dos consejeros (CONSEJERO) de una sede: los que tienen el rol y son de esa sede. */
async function consejeros(c, sedeCodigoOId) { return conRol(c, 'CONSEJERO', { sede: sedeCodigoOId }); }

/** La dirección general: la pareja con PASTOR_DIRECTOR_GENERAL (alcance de organización). */
async function direccionGeneral(c) {
  const { rows } = await c.query(
    `SELECT a.persona_id, trim(concat_ws(' ', p.primer_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre,
            p.genero::text AS genero, a.id AS asignacion_id
       FROM identidad.asignaciones a JOIN nucleo.personas p ON p.id = a.persona_id
      WHERE a.rol = 'PASTOR_DIRECTOR_GENERAL' AND a.alcance_tipo = 'organizacion' AND a.revocada_en IS NULL
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= DATE '${FECHA_REFERENCIA}')
      ORDER BY a.creado_en, a.id`);
  return rows;
}

/**
 * Integrantes vigentes de una unidad de la central o de una región.
 * @param {import('pg').Client} c
 * @param {string} codigoUnidad p. ej. 'EQ-FIN', 'EQ-TI', 'DIR-PAST', 'REG-COL', 'CENTRAL'
 * @returns {Promise<Array<{persona_id, nombre, rol_en_unidad, desde, sede_codigo, email}>>}
 */
async function equipo(c, codigoUnidad) {
  const { rows } = await c.query(
    `SELECT m.persona_id, trim(concat_ws(' ', p.primer_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre,
            m.rol_en_unidad, to_char(m.desde, 'YYYY-MM-DD') AS desde, s.codigo AS sede_codigo,
            p.email_principal::text AS email
       FROM org.unidad_miembros m
       JOIN org.unidades u ON u.id = m.unidad_id
       JOIN nucleo.personas p ON p.id = m.persona_id
       JOIN org.sedes s ON s.id = p.sede_id
      WHERE u.codigo = $1 AND m.hasta IS NULL AND m.revocado_en IS NULL
      ORDER BY (m.rol_en_unidad = 'lider') DESC, p.primer_apellido`, [codigoUnidad]);
  return rows;
}

/**
 * Segmentos de un ministerio en una sede (RocaKids: BEBES, PEQUENOS,
 * EXPLORADORES, AVENTUREROS · tMt: PULSO, ECO, LEGADO).
 * @returns {Promise<Array<{id, codigo, nombre, edad_min, edad_max, orden}>>}
 */
async function segmentos(c, sedeCodigoOId, ministerioCodigo) {
  const sedeId = await _idSede(c, sedeCodigoOId);
  const { rows } = await c.query(
    `SELECT g.id, g.codigo, g.nombre, g.edad_min, g.edad_max, g.orden
       FROM org.segmentos g JOIN org.ministerios m ON m.id = g.ministerio_id
      WHERE g.sede_id = $1 AND m.codigo = $2 AND g.activo
      ORDER BY g.orden`, [sedeId, ministerioCodigo]);
  return rows;
}

/** Id de un ministerio por su código (p. ej. 'ROCAKIDS', 'TMT', 'ALABANZA'). */
async function ministerio(c, codigo) {
  const { rows: [m] } = await c.query(`SELECT id FROM org.ministerios WHERE codigo = $1`, [codigo]);
  if (!m) throw new Error(`No existe el ministerio «${codigo}».`);
  return m.id;
}

/**
 * Códigos VIGENTES de un catálogo (sistema.catalogo_valores). Los catálogos
 * mandan: nunca invente un valor que la base no admite.
 * @param {import('pg').Client} c
 * @param {string} catalogo p. ej. 'tipo_aporte', 'medio_pago', 'tipo_grupo', 'tipo_servicio'
 * @param {string} [sedeId] incluye además los valores propios de esa sede
 * @returns {Promise<string[]>}
 */
async function valoresDe(c, catalogo, sedeId) {
  const { rows } = await c.query(
    `SELECT codigo FROM sistema.catalogo_valores
      WHERE catalogo = $1 AND vigente AND retirado_en IS NULL AND (sede_id IS NULL OR sede_id = $2)
      ORDER BY orden, codigo`, [catalogo, sedeId ?? null]);
  return rows.map(r => r.codigo);
}

/** ¿Se puede contactar a esta persona por ese canal y para esa finalidad? (plataforma.puede_contactar) */
async function puedeContactar(c, personaId, canal, finalidad) {
  const { rows: [r] } = await c.query(`SELECT plataforma.puede_contactar($1, $2, $3) AS si`, [personaId, canal, finalidad]);
  return Boolean(r?.si);
}

module.exports = {
  // constantes
  FECHA_REFERENCIA, AYER, INICIO_HISTORIA, FIN_HORIZONTE, SISTEMA, SEMILLA_BASE, CLAVE_LABORATORIO,
  BASES_PERMITIDAS, SALIDAS_POR_OLA, CANALES, FINALIDADES,
  // azar
  mulberry32, hash32, Azar, crearAzar,
  // fechas
  sumarDias, sumarMeses, sumarAnios, diasEntre, edad, esMenor, diaSemana, nombreDia, fechasDelDia,
  domingosEntre, minFecha, maxFecha, momentoLocal, aMinutos,
  // nombres y datos inventados
  NOMBRES_HOMBRE, NOMBRES_MUJER, NOMBRES_EXTERIOR, APELLIDOS, APELLIDOS_ESPANA, APELLIDOS_CARIBE, APODOS,
  slug, generacion, nombrePara, apellidoAzar, apodoDe, correoNuevo, telefonoNuevo, documentoNuevo,
  tipoDocumentoPara, usadosEnLaBase, inventarPersona, nombreCompleto,
  // base
  guardaDeBase, conectar, enTransaccion, fijarAutor, autorComo, autorDireccion, insertarLote, yaPoblado,
  contarFilas, ejecutar,
  // elegir
  sedes, sede, personas, familias, menores, conRol, pastores, consejeros, direccionGeneral, equipo,
  segmentos, ministerio, valoresDe, puedeContactar,
  // utilidades internas que también sirven
  crypto,
};
