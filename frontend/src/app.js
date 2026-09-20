import { api, hayTokens, borrarTokens } from './api.js';
import { pintarEntrar } from './vistas/entrar.js';
import { pintarPanel } from './vistas/panel.js';
import { pintarPersonas } from './vistas/personas.js';
import { pintarCheckin } from './vistas/checkin.js';
import { pintarCatalogos } from './vistas/catalogos.js';
import { esc, cargando, error, engancharReintentar, avisar } from './ui.js';
import { cola } from './offline.js';

/**
 * El armazón.
 *
 * ⛔ LA REGLA QUE ORDENA TODO ESTO: el menú se pinta contra lo que la BASE
 * dice que esta sesión alcanza (`/api/v1/sesion/yo`), no contra una lista
 * escrita aquí. En el prototipo la lista estaba cableada en el cliente y se
 * podía abrir una pestaña que el permiso ya negaba.
 */
const RAIZ = document.getElementById('app');
let sesion = null;

/* Cada vista declara QUÉ MÓDULO necesita. Si la sesión no lo alcanza, ni
   siquiera aparece en el menú, y entrar por la URL tampoco la abre. */
const VISTAS = {
  panel:     { titulo: 'Panel',     icono: '◈', modulo: null,        pintar: pintarPanel },
  personas:  { titulo: 'Personas',  icono: '☺', modulo: 'personas',  pintar: pintarPersonas },
  checkin:   { titulo: 'Niños',     icono: '✦', modulo: 'rocakids',  pintar: pintarCheckin },
  catalogos: { titulo: 'Catálogos', icono: '☰', modulo: 'sistemas',  pintar: pintarCatalogos },
};

const alcanza = (modulo) =>
  !modulo || (sesion?.modulos ?? []).some(m => (m.modulo ?? m) === modulo) || sesion?.alcance?.todaLaRed;

function rutaActual() {
  const r = location.hash.replace('#/', '') || 'panel';
  return VISTAS[r] && alcanza(VISTAS[r].modulo) ? r : 'panel';
}

async function arrancar() {
  if (!hayTokens()) return pintarEntrar(RAIZ, entrarYa);
  RAIZ.innerHTML = cargando(3);
  try {
    sesion = await api.obtener('/api/v1/sesion/yo');
    pintarMarco();
  } catch (e) {
    if (e.estado === 401) { borrarTokens(); return pintarEntrar(RAIZ, entrarYa); }
    RAIZ.innerHTML = error(e.message, e.peticionId, 'location.reload()');
  }
}

async function entrarYa() {
  sesion = await api.obtener('/api/v1/sesion/yo');
  location.hash = '#/panel';
  pintarMarco();
}

function pintarMarco() {
  const disponibles = Object.entries(VISTAS).filter(([, v]) => alcanza(v.modulo));
  const actual = rutaActual();

  RAIZ.innerHTML = `
    <a class="salto-al-contenido" href="#contenido" id="salto">Ir al contenido</a>
    <div class="marco">
      <nav class="nav" aria-label="Secciones">
        ${disponibles.map(([k, v]) => `
          <button class="nav__item" data-ruta="${k}" ${k === actual ? 'aria-current="page"' : ''}>
            <span class="nav__icono" aria-hidden="true">${v.icono}</span>
            <span>${esc(v.titulo)}</span>
          </button>`).join('')}
      </nav>
      <div class="columna">
        <header class="cabecera">
          <span class="cabecera__marca">Casa Sobre la Roca</span>
          <span class="cabecera__sede">${esc(sesion?.alcance?.todaLaRed ? 'toda la red'
            : (sesion?.alcance?.sedes?.length ?? 0) + ' sede(s)')}</span>
          <div class="cabecera__derecha">
            <span id="cr-pendientes"></span>
            <span class="distintivo">N${esc(String(sesion?.alcance?.nivelMax ?? 0))}</span>
            <button class="boton boton--suave" id="b-salir">Salir</button>
          </div>
        </header>
        <div id="banda-conexion"></div>
        <main class="contenido" id="contenido" tabindex="-1">
          <div id="avisos" aria-live="polite"></div>
          <div id="vista"></div>
        </main>
        <footer class="pie">
          CasaRoca System · versión <code>${esc(window.CASAROCA_VERSION ?? 'dev')}</code>
          · <code>${esc(api.base)}</code>
        </footer>
      </div>
    </div>`;

  RAIZ.querySelectorAll('[data-ruta]').forEach(b =>
    b.addEventListener('click', () => { location.hash = '#/' + b.dataset.ruta; }));
  RAIZ.querySelector('#b-salir').addEventListener('click', salir);

  /* ⛔ El enlace de salto ponia location.hash='#contenido', el enrutador no
     reconocia esa ruta y caia al Panel: la unica ayuda de teclado de la
     aplicacion deshacia la navegacion del usuario. */
  RAIZ.querySelector('#salto')?.addEventListener('click', ev => {
    ev.preventDefault();
    document.getElementById('contenido')?.focus({ preventScroll: false });
  });

  pintarPendientes();
  pintarVista();
}

/* ⛔ El contador solo existia dentro de Ninos y la banda solo aparecia al
   perder la conexion: alguien podia cerrar la tableta con ninos sin enviar
   y nadie se enteraba nunca. */
function pintarPendientes() {
  const z = document.getElementById('cr-pendientes');
  if (!z) return;
  const n = cola.pendientes(), r = cola.rechazados().length;
  z.innerHTML = !n && !r ? '' :
    `<span class="distintivo ${r ? 'distintivo--n4' : 'distintivo--aviso'}">
       ${n ? n + ' sin enviar' : ''}${n && r ? ' · ' : ''}${r ? r + ' rechazado(s)' : ''}
     </span>`;
}
window.addEventListener('cr:cola-cambio', pintarPendientes);

async function pintarVista() {
  const r = rutaActual();
  const zona = document.getElementById('vista');
  if (!zona) return pintarMarco();
  /* ⛔ `toggleAttribute` dejaba `aria-current=""`, que segun la
     especificacion equivale a FALSE, y el CSS busca [aria-current="page"]:
     ni el lector de pantalla ni el ojo sabian en que seccion estaban. */
  document.querySelectorAll('[data-ruta]').forEach(b => {
    if (b.dataset.ruta === r) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.title = `${VISTAS[r].titulo} · CasaRoca`;
  try { await VISTAS[r].pintar(zona, sesion); }
  catch (e) {
    zona.innerHTML = error(e.message, e.peticionId);
    engancharReintentar(zona, () => pintarVista());
  }
  /* Quien navega con teclado se quedaba en BODY y tenia que recorrer todo
     otra vez desde arriba en cada cambio de vista. */
  document.getElementById('contenido')?.focus({ preventScroll: true });
}

async function salir() {
  const n = cola.pendientes();
  if (n && !confirm(
      `Hay ${n} registro(s) guardados en este equipo que todavía no se enviaron.\n\n` +
      `Si sale ahora, nadie más podrá enviarlos con su identidad hasta que usted vuelva a entrar.\n\n` +
      `¿Salir de todas formas?`)) return;
  try { await api.enviar('/api/v1/auth/salir', {}); } catch { /* la sesión igual se cierra aquí */ }
  borrarTokens(); sesion = null; location.hash = '';
  pintarEntrar(RAIZ, entrarYa);
}

window.addEventListener('hashchange', () => { if (sesion) pintarVista(); });
/* ⛔ Tres peticiones fallando a la vez disparaban el evento tres veces y
   `pintarEntrar` reconstruia el formulario tres veces, borrando lo escrito.
   Y el aviso no se veia NUNCA: `avisar` lo metia en #avisos y la linea
   siguiente destruia ese nodo al repintar. Ahora se dispara una sola vez y
   el mensaje viaja DENTRO del formulario nuevo. */
let sesionYaCaida = false;
window.addEventListener('cr:sesion-caida', () => {
  if (sesionYaCaida) return;
  sesionYaCaida = true;
  sesion = null;
  pintarEntrar(RAIZ, () => { sesionYaCaida = false; return entrarYa(); },
    'Su sesión se cerró. Vuelva a entrar.');
});
window.addEventListener('online',  () => bandaConexion(true));
window.addEventListener('offline', () => bandaConexion(false));

function bandaConexion(enLinea) {
  const z = document.getElementById('banda-conexion');
  if (!z) return;
  z.innerHTML = enLinea ? '' :
    `<div class="sin-conexion" role="status">Sin conexión · <strong>puede seguir trabajando</strong>,
      lo que registre se envía al volver la red${cola.pendientes() ? ` (${cola.pendientes()} en espera)` : ''}.</div>`;
}

arrancar();
