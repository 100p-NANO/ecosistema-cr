#!/usr/bin/env node
/**
 * Exportación SINTÉTICA con la forma de la de 99-o, para ensayar la
 * migración completa sin tocar un solo dato real (ADR-006, punto 8).
 *
 * Uso: node generar-99o-sintetico.js <carpeta> [personas=25000] [semilla=21]
 *
 * Genera familias (parejas que a veces comparten correo, hijos menores con
 * sus padres como acudientes), grupos por iglesia, membresías y
 * consentimientos con fecha. Y mete a propósito los defectos que trae
 * cualquier exportación real, en proporciones pequeñas y conocidas:
 * documentos duplicados, correos mal escritos, fechas ilegibles, tipos de
 * documento sin equivalente (DNI de Barcelona), un menor sin acudiente y
 * consentimientos sin fecha. El ensayo tiene que atraparlos todos.
 *
 * Determinista: la misma semilla da exactamente los mismos archivos.
 */
const fs = require('fs');
const path = require('path');

const carpeta = process.argv[2];
const total = Number(process.argv[3] ?? 25000);
let semilla = Number(process.argv[4] ?? 21);
if (!carpeta) { console.error('Uso: node generar-99o-sintetico.js <carpeta> [personas] [semilla]'); process.exit(2); }
fs.mkdirSync(carpeta, { recursive: true });

// mulberry32: pseudoaleatorio con semilla, sin dependencias.
const azar = () => { semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const uno = (l) => l[Math.floor(azar() * l.length)];
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
const prob = (p) => azar() < p;

const NOMBRES_F = ['María', 'Ana', 'Laura', 'Carolina', 'Paula', 'Daniela', 'Valentina', 'Camila', 'Sofía', 'Natalia', 'Andrea', 'Juliana',
  'Catalina', 'Diana', 'Luisa', 'Marcela', 'Gloria', 'Patricia', 'Sandra', 'Liliana', 'Isabella', 'Mariana', 'Gabriela', 'Lucía', 'Sara'];
const NOMBRES_M = ['Juan', 'Carlos', 'Andrés', 'Felipe', 'Santiago', 'Sebastián', 'Daniel', 'David', 'Alejandro', 'Diego', 'Jorge', 'Luis',
  'Camilo', 'Mateo', 'Nicolás', 'Samuel', 'Tomás', 'Julián', 'Ricardo', 'Óscar', 'Fernando', 'Mauricio', 'Esteban', 'Simón', 'Emiliano'];
const APELLIDOS = ['Rodríguez', 'Gómez', 'González', 'Martínez', 'García', 'López', 'Hernández', 'Sánchez', 'Ramírez', 'Pérez',
  'Díaz', 'Torres', 'Rojas', 'Vargas', 'Moreno', 'Gutiérrez', 'Jiménez', 'Muñoz', 'Castro', 'Ortiz', 'Álvarez', 'Ruiz', 'Suárez',
  'Romero', 'Herrera', 'Quintero', 'Cárdenas', 'Mejía', 'Restrepo', 'Ospina', 'Cifuentes', 'Naranjo', 'Beltrán', 'Quiroga'];
const CALLES = ['Calle', 'Carrera', 'Avenida', 'Transversal', 'Diagonal'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const IGLESIAS = 36;
// Tres iglesias fuera de Colombia, con sus documentos: son los que no tienen equivalente todavía.
const EXTRANJERAS = { 34: 'DNI', 35: 'Cédula panameña', 36: 'Pasaporte' };

const hoy = new Date('2026-09-21T12:00:00Z');
const fecha = (anios) => { const d = new Date(hoy.getTime() - anios * 365.25 * 86400000 - entre(0, 364) * 86400000); return d.toISOString().slice(0, 10); };
const csv = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const escribir = (nombre, cols, filas) => {
  fs.writeFileSync(path.join(carpeta, nombre), [cols.join(','), ...filas.map(f => cols.map(c => csv(f[c])).join(','))].join('\n') + '\n');
};
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const personas = [], acudientes = [], grupos = [], membresias = [], consentimientos = [];
let siguiente = 100000, fila = 0, documento = 10000000;
const nuevaPersona = (p) => { p.fila = ++fila; p.id_origen = String(++siguiente); personas.push(p); return p; };

while (personas.length < total) {
  const church = entre(1, IGLESIAS);
  const apellido1 = uno(APELLIDOS), apellido2 = uno(APELLIDOS);
  const tipoAdulto = EXTRANJERAS[church] ?? 'Cédula de Ciudadanía';
  const adulto = (genero) => {
    const nombre = genero === 'F' ? uno(NOMBRES_F) : uno(NOMBRES_M);
    const p = nuevaPersona({
      church_id: church, tipo_documento: tipoAdulto, documento: String(++documento),
      nombres: prob(0.35) ? `${nombre} ${genero === 'F' ? uno(NOMBRES_F) : uno(NOMBRES_M)}` : nombre,
      apellidos: `${genero === 'F' && prob(0.5) ? uno(APELLIDOS) : apellido1} ${apellido2}`,
      fecha_nacimiento: prob(0.5) ? fecha(entre(19, 75)) : fecha(entre(19, 75)).split('-').reverse().join('/'),
      genero: genero === 'F' ? 'Femenino' : 'Masculino',
      estado_civil: uno(['Soltero(a)', 'Casado(a)', 'Casado(a)', 'Unión libre', 'Divorciado(a)', 'Viudo(a)']),
      telefono: `3${entre(0, 2)}${entre(0, 9)} ${entre(100, 999)} ${entre(1000, 9999)}`,
      direccion: `${uno(CALLES)} ${entre(1, 180)} # ${entre(1, 99)}-${entre(1, 99)}`,
      creado_en: fecha(entre(0, 8)),
    });
    p.email = `${sinTildes(p.nombres.split(' ')[0])}.${sinTildes(p.apellidos.split(' ')[0])}${entre(1, 9999)}@example.org`;
    return p;
  };
  const cabeza = adulto(prob(0.55) ? 'F' : 'M');
  const familia = [cabeza];
  if (prob(0.55)) {
    const pareja = adulto(cabeza.genero === 'Femenino' ? 'M' : 'F');
    pareja.estado_civil = cabeza.estado_civil = 'Casado(a)';
    if (prob(0.3)) pareja.email = cabeza.email;              // la pareja comparte el correo: pasa mucho
    familia.push(pareja);
  }
  const hijos = prob(0.35) ? entre(1, 2) : 0;
  for (let h = 0; h < hijos && personas.length < total; h++) {
    const genero = prob(0.5) ? 'F' : 'M';
    const edad = entre(1, 17);
    const hijo = nuevaPersona({
      church_id: church, tipo_documento: edad < 7 ? 'Registro Civil' : 'Tarjeta de Identidad', documento: String(++documento),
      nombres: genero === 'F' ? uno(NOMBRES_F) : uno(NOMBRES_M), apellidos: `${apellido1} ${apellido2}`,
      fecha_nacimiento: fecha(edad), genero: genero === 'F' ? 'Femenino' : 'Masculino', estado_civil: '',
      email: '', telefono: '', direccion: cabeza.direccion, creado_en: fecha(entre(0, 6)),
    });
    for (const padre of familia) {
      acudientes.push({ menor_id_origen: hijo.id_origen, acudiente_id_origen: padre.id_origen,
        parentesco: padre.genero === 'Femenino' ? 'Madre' : 'Padre', autoriza_retiro: 'si' });
    }
  }
}

// Defectos conocidos, en proporciones pequeñas.
const adultos = personas.filter(p => p.estado_civil);
for (let i = 0; i < Math.round(total * 0.004); i++) uno(adultos).documento = uno(adultos).documento;        // documento repetido
for (let i = 0; i < Math.round(total * 0.01); i++) uno(adultos).email = 'correo-sin-arroba.example.org';    // correo mal escrito
for (let i = 0; i < Math.round(total * 0.005); i++) uno(adultos).fecha_nacimiento = '31/02/19XX';          // fecha ilegible
const huerfano = nuevaPersona({ church_id: 1, tipo_documento: 'Tarjeta de Identidad', documento: String(++documento),
  nombres: 'Menor', apellidos: 'Sin Acudiente', fecha_nacimiento: fecha(9), genero: 'Masculino', estado_civil: '',
  email: '', telefono: '', direccion: '', creado_en: fecha(1) });                                         // un menor sin acudiente

// Grupos: uno por cada 14 personas, repartidos por iglesia.
let g = 5000;
const porIglesia = {};
for (const p of personas) (porIglesia[p.church_id] ??= []).push(p);
for (const [church, gente] of Object.entries(porIglesia)) {
  const n = Math.max(1, Math.round(gente.length / 14));
  const suyos = [];
  for (let i = 0; i < n; i++) {
    const grupo = { id_origen: String(++g), church_id: church, nombre: `${uno(['Grupo Familiar', 'Grupo Pequeño'])} ${uno(APELLIDOS)} ${i + 1}`,
      tipo: prob(0.6) ? 'Grupo Familiar' : prob(0.8) ? 'Grupo Pequeño' : 'Célula', dia: uno(DIAS), hora: `${entre(17, 20)}:${uno(['00', '30'])}` };
    grupos.push(grupo); suyos.push(grupo);
  }
  for (const p of gente) {
    if (!prob(0.6)) continue;
    const gr = uno(suyos);
    membresias.push({ grupo_id_origen: gr.id_origen, persona_id_origen: p.id_origen, rol: 'miembro',
      desde: fecha(entre(0, 4)), hasta: prob(0.08) ? fecha(0) : '' });
  }
}

// Consentimientos: por correo y por teléfono, con su fecha; algunos se revocaron después.
let cf = 0;
for (const p of adultos) {
  if (!prob(0.7)) continue;
  const cuando = fecha(entre(0, 5));
  consentimientos.push({ fila: ++cf, persona_id_origen: p.id_origen, canal: uno(['correo', 'teléfono', 'WhatsApp']), acto: 'otorgado', ocurrido_en: cuando });
  if (prob(0.05)) consentimientos.push({ fila: ++cf, persona_id_origen: p.id_origen, canal: 'correo', acto: 'revocado', ocurrido_en: fecha(0) });
  if (prob(0.02)) consentimientos.push({ fila: ++cf, persona_id_origen: p.id_origen, canal: 'correo', acto: 'otorgado', ocurrido_en: '' });
}

escribir('personas.csv', ['fila', 'id_origen', 'church_id', 'tipo_documento', 'documento', 'nombres', 'apellidos', 'fecha_nacimiento',
  'genero', 'estado_civil', 'email', 'telefono', 'direccion', 'creado_en'], personas);
escribir('acudientes.csv', ['menor_id_origen', 'acudiente_id_origen', 'parentesco', 'autoriza_retiro'], acudientes);
escribir('grupos.csv', ['id_origen', 'church_id', 'nombre', 'tipo', 'dia', 'hora'], grupos);
escribir('membresias.csv', ['grupo_id_origen', 'persona_id_origen', 'rol', 'desde', 'hasta'], membresias);
escribir('consentimientos.csv', ['fila', 'persona_id_origen', 'canal', 'acto', 'ocurrido_en'], consentimientos);

const menores = personas.filter(p => !p.estado_civil).length;
console.log(JSON.stringify({ carpeta, personas: personas.length, adultos: adultos.length, menores, acudientes: acudientes.length,
  grupos: grupos.length, membresias: membresias.length, consentimientos: consentimientos.length,
  defectos: { menor_sin_acudiente: huerfano.id_origen, iglesias_con_documento_sin_equivalente: Object.keys(EXTRANJERAS).map(Number) } }));
