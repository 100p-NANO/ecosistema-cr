import { api } from '../api.js';
import { esc, cargando, vacio, error, engancharReintentar } from '../ui.js';
import { pantalla, formulario, tabla, chip, chipEstado, cabezaFicha, zonaFicha, historial, valoresDe,
         fechaHora } from './comun.js';

/** Buscar personas. Un solo cuadro: nombre mal escrito, documento, teléfono
    o correo. La base tolera los errores de digitación; sin eso, quien busca
    «Jon» no encuentra a «Jhon» y crea el duplicado. */
export function pintarPersonas(c) {
  c.innerHTML = `
    <h1>Personas</h1>
    <form id="buscar" role="search" style="display:flex;gap:.5rem;margin-bottom:1rem">
      <label class="sr-solo" for="q">Buscar persona</label>
      <input id="q" name="q" type="search" placeholder="Nombre, documento, teléfono o correo"
             autocomplete="off" enterkeyhint="search">
      <button class="boton" type="submit">Buscar</button>
    </form>
    <div id="resultado">${vacio('🔎', 'Busque a alguien',
      'Escriba parte del nombre aunque no esté seguro de cómo se escribe, o el documento o el teléfono.')}</div>`;

  const salida = c.querySelector('#resultado');
  const entrada = c.querySelector('#q');
  entrada.focus();

  let ultimo = 0;
  async function buscar(q) {
    if (!q || q.trim().length < 2) {
      salida.innerHTML = vacio('🔎', 'Escriba un poco más', 'Con dos letras o más ya se puede buscar.');
      return;
    }
    const mio = ++ultimo;
    salida.innerHTML = cargando(3);
    try {
      const r = await api.obtener('/api/v1/personas?limite=25&q=' + encodeURIComponent(q.trim()));
      if (mio !== ultimo) return;               // llegó una respuesta vieja
      const filas = Array.isArray(r) ? r : (r?.datos ?? r?.filas ?? []);
      if (!filas.length) {
        salida.innerHTML = vacio('🫥', 'Nadie coincide',
          'Puede que la persona esté en otra sede, o que todavía no esté registrada.');
        return;
      }
      /* ⛔ 21 sep 2026 · Los resultados eran filas mudas: se encontraba a la
         persona y no había cómo abrir su ficha, aunque la API la tenía desde
         el principio. Ahora el nombre ES el enlace, en la primera celda,
         para que en un teléfono no quede fuera de la pantalla. La ficha solo
         abre si su rol ALCANZA a esa persona (su grupo, su caso, su sede):
         encontrarla por el nombre no es lo mismo que poder leerla entera. */
      salida.innerHTML = `
        <p class="etiqueta">${filas.length} resultado(s) dentro de su alcance</p>
        <div class="tarjeta" style="padding:0;overflow:hidden;margin-top:.5rem">
          <table class="tabla">
            <thead><tr><th>Nombre</th><th>Documento</th><th>Sede</th><th>Estado</th></tr></thead>
            <tbody>${filas.map(p => `
              <tr>
                <td data-th="Nombre"><a class="enlace-fila" href="#/personas/${esc(p.id)}"><strong>${esc(p.nombre ?? [p.primer_nombre, p.primer_apellido].filter(Boolean).join(' '))}</strong></a></td>
                <td data-th="Documento"><code>${esc(p.documento ?? p.numero_documento ?? '·')}</code></td>
                <td data-th="Sede">${esc(p.sede_codigo ?? p.sede ?? '')}</td>
                <td data-th="Estado">${esc(p.estado ?? '')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      if (mio !== ultimo) return;
      /* ⛔ El tercer argumento no existe en `error()`: se descartaba en
         silencio y el botón «Reintentar» se pintaba sin escuchador. Un
         botón visible que no hace nada es peor que no tenerlo. */
      salida.innerHTML = error(e.message, e.peticionId);
      engancharReintentar(salida, () => buscar(entrada.value));
    }
  }

  c.querySelector('#buscar').addEventListener('submit', ev => { ev.preventDefault(); buscar(entrada.value); });
  let temporizador;
  entrada.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => buscar(entrada.value), 350);
  });
}

/* ── La ficha de una persona ─────────────────────────────────────────── */

const siNo = (v) => v === true ? 'Sí' : v === false ? 'No' : null;
const fecha = (v) => v ? new Date(v + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' }) : null;

/** Los datos, agrupados como los piensa quien atiende, no como están en la tabla.
    Un campo que la sesión no alcanza NO LLEGA de la API: aquí ni se nombra. */
const mayuscula = (v) => v ? String(v).charAt(0).toUpperCase() + String(v).slice(1).replace(/_/g, ' ') : v;

function grupos(p, etiquetas = {}) {
  /* El estado civil se guarda como código del catálogo («union_libre»); se
     muestra su nombre («Unión libre»), que es el que la iglesia corrigió. */
  const civil = p.estado_civil ? (etiquetas.estado_civil?.[p.estado_civil] ?? mayuscula(p.estado_civil)) : null;
  const doc = [p.tipo_documento, p.numero_documento].filter(Boolean).join(' ');
  const nacimiento = p.fecha_nacimiento
    ? `${fecha(p.fecha_nacimiento)}${p.edad != null ? ` · ${p.edad} años` : ''}` : null;
  return [
    ['Identificación', [
      ['Documento', doc || null, 'numero_documento'],
      ['Nacimiento', nacimiento, 'fecha_nacimiento'],
      ['Género', mayuscula(p.genero), 'genero'],
      ['Estado civil', civil, 'estado_civil'],
      ['Nacionalidad', mayuscula(p.nacionalidad), 'nacionalidad'],
    ]],
    ['Contacto', [
      ['Correo', p.email_principal, 'email_principal'],
      ['Celular', p.telefono_movil, 'telefono_movil'],
      ['Teléfono fijo', p.telefono_fijo, 'telefono_fijo'],
      ['En una emergencia', p.telefono_emergencia, 'telefono_emergencia'],
      ['Otro correo', p.email_secundario, 'email_secundario'],
    ]],
    ['Dónde vive', [
      ['Dirección', p.direccion, 'direccion'],
      ['Ciudad', p.ciudad_residencia, 'ciudad_residencia'],
      ['Zona', p.zona, 'zona'],
      ['País', p.pais_residencia, 'pais_residencia'],
    ]],
    ['Vida de fe', [
      ['Bautizado', siNo(p.ha_sido_bautizado), 'ha_sido_bautizado'],
      ['Fecha de bautismo', fecha(p.fecha_bautismo), 'fecha_bautismo'],
      ['Fecha de conversión', fecha(p.fecha_conversion), 'fecha_conversion'],
      ['Iglesia anterior', p.iglesia_anterior, 'iglesia_anterior'],
      ['Compromiso', mayuscula(p.nivel_compromiso), 'nivel_compromiso'],
      ['Sirve como ministro', siNo(p.es_ministro), 'es_ministro'],
    ]],
  ].map(([titulo, filas]) => [titulo, filas.filter(([, , campo]) => campo in p)])
   .filter(([, filas]) => filas.length);
}

const pintarDatos = (p, etiquetas) => `<div class="ficha-datos">${grupos(p, etiquetas).map(([titulo, filas]) => `
  <section>
    <h3>${esc(titulo)}</h3>
    <dl>${filas.map(([etq, valor]) => `
      <div><dt>${esc(etq)}</dt><dd>${valor ? esc(valor) : '<span class="ayuda">sin registrar</span>'}</dd></div>`).join('')}
    </dl>
  </section>`).join('')}</div>`;

/** Qué campos se pueden corregir desde aquí: solo los que la sesión ve. */
async function camposEditables(p) {
  const [tipos, civiles] = await Promise.all([
    valoresDe('tipo_documento').catch(() => []),
    valoresDe('estado_civil').catch(() => []),
  ]);
  const todos = [
    { nombre: 'primer_nombre', etiqueta: 'Primer nombre', obligatorio: true },
    { nombre: 'segundo_nombre', etiqueta: 'Segundo nombre' },
    { nombre: 'primer_apellido', etiqueta: 'Primer apellido', obligatorio: true },
    { nombre: 'segundo_apellido', etiqueta: 'Segundo apellido' },
    { nombre: 'tipo_documento', etiqueta: 'Tipo de documento', opciones: tipos, vacio: 'Sin tipo' },
    { nombre: 'numero_documento', etiqueta: 'Número de documento' },
    { nombre: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date' },
    { nombre: 'email_principal', etiqueta: 'Correo', tipo: 'email' },
    { nombre: 'telefono_movil', etiqueta: 'Celular', tipo: 'tel' },
    { nombre: 'telefono_fijo', etiqueta: 'Teléfono fijo', tipo: 'tel' },
    { nombre: 'direccion', etiqueta: 'Dirección' },
    { nombre: 'ciudad_residencia', etiqueta: 'Ciudad' },
    { nombre: 'estado_civil', etiqueta: 'Estado civil', opciones: civiles, vacio: 'Sin registrar' },
  ];
  return todos.filter(k => k.nombre in p && !(k.opciones && !k.opciones.length))
              .map(k => ({ ...k, valor: p[k.nombre] ?? '' }));
}

const valorCasilla = (v) => v == null ? null
  : Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v);

export function pintarPersona(c, id) {
  const z = zonaFicha(c, 'personas', 'Volver a personas');
  /* La persona tal como está AHORA: el formulario compara contra ella para
     mandar solo lo que cambió, y se repinta con sus valores al guardar. */
  let actual = null, campos = null, enganchado = false;
  const guardar = async (d) => {
    const cambios = Object.fromEntries(Object.entries(d).filter(([k, v]) => String(actual?.[k] ?? '') !== String(v)));
    if (!Object.keys(cambios).length) return { mensaje: 'No había nada distinto que guardar.' };
    await api.cambiar(`/api/v1/personas/${id}`, cambios);
    return { mensaje: 'Datos corregidos. El cambio queda en la auditoría con el valor anterior.' };
  };
  pantalla(z, {
    titulo: 'Ficha de la persona',
    cargar: async () => {
      const p = await api.obtener(`/api/v1/personas/${id}`);
      actual = p;
      /* Lo que no es la ficha no la tumba: si la historia o los duplicados
         fallan, se dice en su sitio y el resto se sigue viendo. */
      const [hist, casillas, dup] = await Promise.all([
        api.obtener(`/api/v1/personas/${id}/linea-tiempo?limite=60`).catch(e => ({ error: e.message })),
        api.obtener(`/api/v1/personas/${id}/atributos`).catch(e => ({ error: e.message })),
        api.obtener(`/api/v1/personas/${id}/duplicados`).catch(e => ({ error: e.message })),
      ]);
      campos = p.puede_editar ? await camposEditables(p) : null;
      const civiles = await valoresDe('estado_civil').catch(() => []);
      const etiquetas = { estado_civil: Object.fromEntries(civiles.map(v => [v.valor, v.texto])) };
      return { p, hist, casillas, dup, etiquetas };
    },
    pintar: ({ p, hist, casillas, dup, etiquetas }, recargar) => {
      const form = campos ? formulario({ id: 'f-persona', titulo: 'Corregir sus datos', boton: 'Guardar cambios',
                                         campos, al: guardar }) : null;
      if (form && !enganchado) { enganchado = true; form.enganchar(z, recargar); }
      const nivel = p.nivel_de_la_sesion;
      const ocultos = p.campos_ocultos ?? [];
      return `<div class="tarjeta">
        ${cabezaFicha(p.nombre, [p.sede_nombre ?? p.sede_codigo, p.nombre_corto ? `le dicen ${p.nombre_corto}` : null]
          .filter(Boolean).join(' · '),
          [chipEstado(p.estado), p.es_menor ? chip('menor de edad', 'distintivo--n4') : ''].filter(Boolean))}
        ${p.es_menor ? `<p class="ayuda">Es menor de edad: esta lectura quedó registrada con su nombre y la hora.</p>` : ''}
        ${ocultos.length ? `<p class="ayuda">${ocultos.length} dato(s) están por encima de su nivel de acceso (N${esc(nivel)}) y no se muestran.</p>` : ''}
        ${pintarDatos(p, etiquetas)}
      </div>
      ${form ? `<div style="margin-top:1rem">${form.html}</div>` : ''}

      <h2 style="margin-top:1.5rem">Su historia</h2>
      <p class="etiqueta">Lo que cada módulo dejó escrito: grupos, asistencia, formación, llamadas. Solo lo que su nivel alcanza.</p>
      <div class="tarjeta">${hist?.error ? `<p class="ayuda">No se pudo cargar la historia: ${esc(hist.error)}</p>`
        : historial((hist ?? []).map(h => ({ cuando: fechaHora(h.ocurrido_en), quien: h.tipo_nombre ?? h.tipo, texto: h.resumen })),
          'Todavía no hay hechos en su historia.')}</div>

      ${!casillas?.error && casillas?.length ? `
      <h2 style="margin-top:1.5rem">Casillas propias</h2>
      <p class="etiqueta">Datos que la iglesia agregó sin cambiar el sistema.</p>
      <div class="tarjeta" style="padding:0;overflow:hidden">${tabla(casillas, [
        { titulo: 'Casilla', pintar: a => esc(a.etiqueta ?? a.codigo) },
        { titulo: 'Valor', pintar: a => { const v = valorCasilla(a.valor); return v ? esc(v) : '<span class="ayuda">sin registrar</span>'; } },
        { titulo: 'Módulo', pintar: a => esc(a.modulo ?? '') },
      ])}</div>` : ''}

      ${!dup?.error && dup?.length ? `
      <h2 style="margin-top:1.5rem">¿Registrada dos veces?</h2>
      <p class="etiqueta">Personas que se le parecen: mismo documento, misma fecha de nacimiento o un nombre muy parecido.</p>
      <div class="tarjeta" style="padding:0;overflow:hidden">${tabla(dup, [
        { titulo: 'Persona', pintar: d => `<a class="enlace-fila" href="#/personas/${esc(d.candidata_id)}">${esc(d.nombre)}</a>` },
        { titulo: 'Sede', pintar: d => esc(d.sede_codigo ?? '') },
        { titulo: 'Parecido', pintar: d => `${Math.round(Number(d.puntaje ?? 0) * 100)} %` },
        { titulo: 'Por qué', pintar: d => esc(d.motivos || 'nombre parecido') },
      ])}</div>` : ''}`;
    },
  });
}
