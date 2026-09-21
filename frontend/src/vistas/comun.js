import { api } from '../api.js';
import { esc, cargando, vacio, error, avisar, unaVez } from '../ui.js';

/**
 * Piezas compartidas por las pantallas de módulo.
 *
 * ⛔ Por qué existe este archivo: con veintidós módulos, repetir en cada uno
 * el cargar, el estado vacío, el estado de error y la tabla responsive es
 * la forma más segura de que tres pantallas se olviden de uno de los tres
 * estados. Aquí están una vez, y ninguna vista se los puede saltar.
 *
 * ⛔ Y no hay `innerHTML` con datos sin escapar: todo pasa por `esc`.
 */

/** Tabla con cabecera repetida en móvil (`data-th` lo pinta el CSS). */
export function tabla(filas, columnas) {
  return `
    <div class="tarjeta" style="padding:0;overflow:hidden">
      <table class="tabla">
        <thead><tr>${columnas.map(k => `<th>${esc(k.titulo)}</th>`).join('')}</tr></thead>
        <tbody>${filas.map(f => `
          <tr${f.__id ? ` data-id="${esc(f.__id)}"` : ''}${f.__click ? ' class="fila--pulsable"' : ''}>
            ${columnas.map((k, i) => {
              const dentro = k.pintar ? k.pintar(f) : esc(f[k.campo] ?? '—');
              /* ⛔ Nada de role="button" sobre un <tr>: borra el rol de fila y
                 el lector de pantalla deja de anunciar la tabla. El foco vive
                 en un botón de verdad en la PRIMERA celda; la fila entera es
                 solo un blanco más grande para el dedo. */
              return `<td data-th="${esc(k.titulo)}">${i === 0 && f.__click
                ? `<button type="button" class="enlace-fila" data-abrir-fila>${dentro}</button>` : dentro}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

export const chip = (texto, clase = '') =>
  `<span class="distintivo ${clase}">${esc(texto)}</span>`;

/** Aviso que viene del servidor. Si la API lo manda, se muestra: son los
    números que alguien tiene que ver (cupos pasados, casos sin consejero). */
export const avisoServidor = (t) => t
  ? `<div class="aviso ${/⛔|VENCID|SIN /i.test(t) ? 'aviso--error' : 'aviso--aviso'}" role="status">${esc(t)}</div>`
  : '';

/**
 * El armazón de una pantalla de lista: título, intro, barra de acciones,
 * y un cuerpo que se recarga solo.
 */
export function pantalla(c, { titulo, intro, barra = '', cargar, pintar }) {
  c.innerHTML = `
    <h1>${esc(titulo)}</h1>
    ${intro ? `<p class="etiqueta">${esc(intro)}</p>` : ''}
    <div id="barra" style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.75rem 0">${barra}</div>
    <div id="avisos-vista"></div>
    <div id="cuerpo">${cargando(3)}</div>`;

  const cuerpo = c.querySelector('#cuerpo');
  const zonaAviso = c.querySelector('#avisos-vista');

  /* ⛔ Red de seguridad. Un `<form>` con un solo campo de texto y sin
     botón de envío dispara la submisión IMPLÍCITA al pulsar Intro (o el
     botón «buscar» del teclado del teléfono). Como ninguno lleva
     `action`, el navegador navegaba a la misma dirección por GET: la
     aplicación se recargaba entera, se perdía lo escrito y, dentro de la
     ficha de un grupo o de una cohorte, se salía de la ficha. Los
     buscadores ya filtran al teclear, así que Intro no tiene que hacer
     nada más. Esto va DESPUÉS de los manejadores propios, que llaman a
     `preventDefault` por su cuenta y siguen funcionando igual. */
  c.addEventListener('submit', (ev) => {
    if (!ev.defaultPrevented) ev.preventDefault();
  });

  async function recargar() {
    cuerpo.innerHTML = cargando(3);
    try {
      const datos = await cargar();
      zonaAviso.innerHTML = avisoServidor(datos?.aviso);
      cuerpo.innerHTML = pintar(datos, recargar);
      enganchar(cuerpo, recargar);
    } catch (e) {
      zonaAviso.innerHTML = '';
      cuerpo.innerHTML = error(e.message, e.peticionId);
      cuerpo.querySelectorAll('[data-reintentar]').forEach(b => b.addEventListener('click', recargar));
    }
  }

  /* Los botones declarativos: `data-enviar` (ruta), `data-cuerpo` (JSON) y
     `data-confirmar` (texto). Evita un manejador escrito a mano por botón,
     que es donde se cuela el que olvida `unaVez` y dispara dos veces. */
  function enganchar(raiz, recargar) {
    raiz.querySelectorAll('[data-enviar]').forEach(b => {
      b.addEventListener('click', () => unaVez(b, async () => {
        if (b.dataset.confirmar && !confirm(b.dataset.confirmar)) return;
        try {
          const r = await api.enviar(b.dataset.enviar, JSON.parse(b.dataset.cuerpo || '{}'));
          avisar(r?.mensaje ?? 'Listo.', r?.aviso ? 'aviso' : 'exito');
          if (r?.aviso) avisar(r.aviso, 'aviso');
          await recargar();
        } catch (e) { avisar(e.message, 'error'); }
      }));
    });
    raiz.querySelectorAll('.fila--pulsable').forEach(f => {
      const ir = () => f.dispatchEvent(new CustomEvent('cr:abrir', { bubbles: true, detail: f.dataset.id }));
      f.addEventListener('click', ev => { if (!ev.target.closest('[data-enviar]')) ir(); });
    });
  }

  recargar();
  return { recargar, cuerpo };
}

/**
 * Formulario en una tarjeta plegable. Se pliega a propósito: la pantalla
 * es para MIRAR lo que hay; crear es lo que se hace de vez en cuando.
 */
export function formulario({ titulo, campos, boton = 'Guardar', al }) {
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  const html = `
    <details class="tarjeta" style="margin-bottom:1rem">
      <summary style="cursor:pointer;font-weight:600">${esc(String(titulo).replace(/^\+\s*/, ''))}</summary>
      <form id="${id}" novalidate style="margin-top:1rem;display:grid;gap:.75rem">
        ${campos.map(k => k.html ? k.html
          /* Casilla: la etiqueta va DESPUÉS y envuelve, para que el blanco
             del dedo sea toda la frase y no un cuadrito de 16 px. */
          : k.tipo === 'checkbox' ? `
          <div class="campo campo--casilla">
            <label class="casilla" for="${id}-${esc(k.nombre)}">
              <input id="${id}-${esc(k.nombre)}" name="${esc(k.nombre)}" type="checkbox" ${k.valor ? 'checked' : ''}>
              <span>${esc(k.etiqueta)}</span>
            </label>
            ${k.ayuda ? `<span class="ayuda">${esc(k.ayuda)}</span>` : ''}
          </div>` : `
          <div class="campo">
            <label for="${id}-${esc(k.nombre)}">${esc(k.etiqueta)}${k.obligatorio ? ' *' : ''}</label>
            ${k.opciones ? `
              <select id="${id}-${esc(k.nombre)}" name="${esc(k.nombre)}" ${k.obligatorio ? 'required' : ''}>
                <option value="">${esc(k.vacio ?? 'Elija…')}</option>
                ${k.opciones.map(o => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('')}
              </select>`
            : k.multilinea ? `
              <textarea id="${id}-${esc(k.nombre)}" name="${esc(k.nombre)}" rows="3"
                        ${k.obligatorio ? 'required' : ''}
                        ${k.minimo ? `minlength="${k.minimo}"` : ''}></textarea>`
            : `
              <input id="${id}-${esc(k.nombre)}" name="${esc(k.nombre)}" type="${esc(k.tipo ?? 'text')}"
                     ${k.obligatorio ? 'required' : ''} ${k.minimo ? `minlength="${k.minimo}"` : ''}
                     ${k.valor !== undefined ? `value="${esc(k.valor)}"` : ''}
                     ${k.placeholder ? `placeholder="${esc(k.placeholder)}"` : ''}>`}
            ${k.ayuda ? `<span class="ayuda">${esc(k.ayuda)}</span>` : ''}
          </div>`).join('')}
        <button class="boton" type="submit">${esc(boton)}</button>
      </form>
    </details>`;
  return {
    html,
    /**
     * ⛔ 20 de septiembre de 2026. Esto colgaba el escuchador DEL PROPIO
     * `<form>`, y el formulario se pinta DENTRO de `#cuerpo`, que
     * `recargar()` reemplaza entero al guardar. Resultado: el formulario
     * funcionaba UNA vez. Al segundo intento, el `<form>` nuevo no tenía
     * escuchador y, como no lleva `action`, el navegador hacía la
     * submisión nativa: la aplicación se recargaba y no se guardaba nada.
     * Para el pastor era exactamente «pulsé y no pasó nada».
     *
     * Ahora se delega en el CONTENEDOR de la vista, que sobrevive a los
     * repintados, y se marca para no colgarlo dos veces si se vuelve a
     * entrar a la misma pantalla.
     */
    enganchar(raiz, recargar) {
      engancharBuscadores(raiz);
      if (raiz.dataset['forma_' + id]) return;
      raiz.dataset['forma_' + id] = '1';
      raiz.addEventListener('submit', ev => {
        const f = ev.target;
        if (f?.id !== id) return;
        ev.preventDefault();
        const b = f.querySelector('button[type=submit]');
        unaVez(b, async () => {
          const datos = {};
          for (const k of campos) {
            if (!k.nombre) continue;
            const el = f.elements[k.nombre];
            if (k.tipo === 'checkbox') { datos[k.nombre] = !!el?.checked; continue; }
            const v = el?.value?.trim();
            if (v !== '' && v !== undefined) datos[k.nombre] = k.numero ? Number(v) : v;
            else if (k.obligatorio) { avisar(`Falta «${k.etiqueta}».`, 'error'); return; }
          }
          if (typeof campos.validar === 'function') {
            const problema = campos.validar(datos);
            if (problema) { avisar(problema, 'error'); return; }
          }
          try {
            const r = await al(datos);
            avisar(r?.mensaje ?? 'Guardado.', 'exito');
            if (r?.aviso) avisar(r.aviso, 'aviso');
            f.reset();
            f.querySelectorAll('[data-elegido]').forEach(e => { e.textContent = 'Nadie elegido todavía.'; });
            f.closest('details').open = false;
            await recargar();
          } catch (e) { avisar(e.message, 'error'); }
        });
      });
    },
  };
}

/** Las sedes que esta sesión alcanza, para los selectores. Se pide una vez. */
let sedesCache = null;
export async function sedes() {
  /* ⛔ Una lista VACÍA quedaba en caché para siempre (`[]` es verdadero):
     un fallo al entrar dejaba todos los selectores de sede sin opciones.
     Solo se guarda una lista con contenido, y solo las sedes activas. */
  if (sedesCache?.length) return sedesCache;
  const r = await api.obtener('/api/v1/organizacion/sedes');
  const l = (Array.isArray(r) ? r : r?.sedes ?? []).filter(s => s.activa !== false).map(s => ({
    valor: s.id, texto: `${s.codigo} · ${s.nombre}`,
  }));
  if (l.length) sedesCache = l;
  return l;
}

/** Los valores vigentes de un catálogo, para los selectores.
    ⛔ Los formularios traían listas escritas a mano («hogar», «ministerio»)
    que el catálogo no admite: fallaban SIEMPRE. Ahora salen del catálogo. */
const catalogosCache = new Map();
export async function valoresDe(catalogo) {
  if (catalogosCache.get(catalogo)?.length) return catalogosCache.get(catalogo);
  const r = await api.obtener('/api/v1/identidad/catalogos/' + encodeURIComponent(catalogo) + '/valores');
  const l = (Array.isArray(r) ? r : r?.valores ?? []).filter(v => v.vigente !== false)
    .map(v => ({ valor: v.codigo, texto: v.etiqueta ?? v.codigo }));
  if (l.length) catalogosCache.set(catalogo, l);
  return l;
}

/**
 * Buscador de personas en el servidor, para los formularios: escribir
 * pregunta a la base (tolera erratas) y elegir deja el identificador en un
 * campo oculto. ⛔ Antes había que «buscar en Personas y pegar aquí su
 * identificador»: una instrucción imposible de cumplir.
 */
export function buscadorPersona(nombre, etiqueta, { obligatorio = false, ayuda = '' } = {}) {
  const id = 'bp' + Math.random().toString(36).slice(2, 8);
  return {
    nombre, etiqueta, obligatorio,
    html: `<div class="campo" data-buscador="${id}">
      <label for="${id}-q">${esc(etiqueta)}${obligatorio ? ' *' : ''}</label>
      <input id="${id}-q" type="search" placeholder="Escriba un nombre o un documento" autocomplete="off" data-buscar-persona>
      <input type="hidden" name="${esc(nombre)}">
      <div class="buscador__lista" role="listbox" aria-label="Resultados"></div>
      <span class="ayuda" data-elegido>${esc(ayuda || 'Nadie elegido todavía.')}</span>
    </div>`,
    /* ⛔ Delegado en el CONTENEDOR de la vista, igual que el formulario:
       la vista se repinta al guardar y un escuchador colgado del campo se
       perdería con él. Se engancha una vez por contenedor. */
    enganchar(raiz) { engancharBuscadores(raiz); },
  };
}

function engancharBuscadores(raiz) {
  if (!raiz || raiz.dataset.buscadores) return;
  raiz.dataset.buscadores = '1';
  const esperas = new WeakMap();
  raiz.addEventListener('input', ev => {
    const q = ev.target.closest?.('[data-buscar-persona]');
    if (!q) return;
    const caja = q.closest('[data-buscador]');
    const lista = caja.querySelector('.buscador__lista');
    clearTimeout(esperas.get(caja));
    esperas.set(caja, setTimeout(async () => {
      const texto = q.value.trim();
      if (texto.length < 2) { lista.innerHTML = ''; return; }
      try {
        const r = await api.obtener('/api/v1/personas?limite=8&q=' + encodeURIComponent(texto));
        const filas = Array.isArray(r) ? r : (r?.personas ?? r?.datos ?? []);
        lista.innerHTML = filas.length ? filas.map(p => `<button type="button" class="buscador__opcion" role="option"
            data-id="${esc(p.id)}" data-nombre="${esc(p.nombre ?? p.nombre_completo ?? '')}">
            ${esc(p.nombre ?? p.nombre_completo ?? '')}<span class="ayuda"> · ${esc(p.sede_codigo ?? p.sede ?? '')}</span></button>`).join('')
          : '<p class="ayuda">Nadie coincide.</p>';
      } catch (e) { lista.innerHTML = `<p class="ayuda">${esc(e.message)}</p>`; }
    }, 250));
  });
  raiz.addEventListener('click', ev => {
    const b = ev.target.closest?.('.buscador__opcion[data-id]');
    if (!b) return;
    const caja = b.closest('[data-buscador]');
    caja.querySelector('input[type=hidden]').value = b.dataset.id;
    caja.querySelector('[data-elegido]').textContent = 'Elegido: ' + b.dataset.nombre;
    caja.querySelector('.buscador__lista').innerHTML = '';
    caja.querySelector('[data-buscar-persona]').value = '';
  });
}

/** Un campo de buscador dentro de `formulario()`: se declara como campo. */
export function campoPersona(nombre, etiqueta, opciones = {}) {
  const b = buscadorPersona(nombre, etiqueta, opciones);
  return { nombre, etiqueta, obligatorio: !!opciones.obligatorio, html: b.html, buscador: true };
}

/**
 * Pide un texto con un mínimo, en vez de `prompt()` pelado: dice cuánto
 * falta y no deja pasar un motivo de dos letras. Devuelve null si se
 * cancela. (El diálogo nativo sigue siendo el más accesible en móvil.)
 */
export function pedirTexto(pregunta, minimo = 5) {
  const v = prompt(pregunta);
  if (v === null) return null;
  if (v.trim().length < minimo) { avisar(`Hace falta al menos ${minimo} caracteres.`, 'error'); return null; }
  return v.trim();
}

/** Enlaza los buscadores de un contenedor (para vistas que no usan `pantalla`). */
export { engancharBuscadores };


/** Cabeza de una ficha: título, línea de contexto y distintivos. */
export const cabezaFicha = (titulo, contexto, chips = []) => `
  <div class="cabeza-ficha">
    <h2>${esc(titulo)}</h2>
    ${contexto ? `<p class="etiqueta" style="margin:0">${esc(contexto)}</p>` : ''}
    ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
  </div>`;

/** Una línea de tiempo (actuaciones, oraciones, hitos): fecha y texto. */
export const historial = (items, vacioTexto = 'Nada registrado todavía.') => items.length
  ? `<ul class="historial">${items.map(i => `<li><time>${esc(i.cuando)}</time>
      <div>${i.quien ? `<strong>${esc(i.quien)}</strong><br>` : ''}<span class="texto-largo">${esc(i.texto ?? '')}</span></div></li>`).join('')}</ul>`
  : `<p class="ayuda">${esc(vacioTexto)}</p>`;

/** Distintivo de estado con el color de lo que significa. */
export function chipEstado(estado) {
  const mal = ['vencido', 'rechazada', 'cancelada', 'cancelado', 'suspendida'];
  const bien = ['respondida', 'aprobada', 'resuelto', 'cerrado', 'hecha', 'realizado', 'terminada', 'enviada', 'cerrada'];
  const clase = mal.includes(estado) ? 'distintivo--n4' : bien.includes(estado) ? 'distintivo--ok' : 'distintivo--aviso';
  return chip(String(estado ?? '').replace(/_/g, ' '), clase);
}

/** Una pantalla de ficha con su enlace de vuelta. Devuelve la zona. */
export function zonaFicha(c, volverA, textoVolver) {
  c.innerHTML = `<p><a href="#/${esc(volverA)}">← ${esc(textoVolver)}</a></p><div data-ficha></div>`;
  return c.querySelector('[data-ficha]');
}

/** Fecha y hora legibles, en la hora del teléfono de quien mira. */
export const fechaHora = (v) => v
  ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export { esc, vacio, avisar };
