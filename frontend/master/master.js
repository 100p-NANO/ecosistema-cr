import { api, hayTokens, guardarTokens, borrarTokens } from '../src/api.js';
import { demoActivo } from '../src/demo.js';

/**
 * CASA ROCA · SISTEMA MASTER
 *
 * ⛔ Esto NO es la aplicación de los pastores, y por eso no se le parece.
 * Es el comando central: desde aquí el equipo de la central despliega
 * iglesias, registra personas, crea accesos, otorga roles, arma los
 * equipos corporativos (Contabilidad, Tesorería) y enciende o apaga
 * módulos en cada sede. Un pastor administra su sede; aquí se administra
 * la red.
 *
 * El visual es el del prototipo que la iglesia eligió: columna de pestañas
 * a la izquierda agrupada por materia, densidad de Linear sobre blanco,
 * cero sombras, cifras tabulares y un solo acento (el azul de la marca).
 * No se reinventó: se conservó, porque la uniformidad es parte de lo que
 * convenció.
 */

const RAIZ = document.getElementById('app');
let sesion = null;
let vista = 'arranque';

/* Las secciones, en el orden en que un administrador las necesita.
   ⛔ «Puesta en marcha» va primero a propósito: el sistema se llena en un
   orden y saltarse un paso deja huérfano al que sigue. */
const NAV = [
  { grupo: 'Dirección' },
  { id: 'arranque',   icono: '🧭', titulo: 'Puesta en marcha' },
  { id: 'red',        icono: '🌐', titulo: 'Tablero de la red' },

  { grupo: 'Identidad y accesos' },
  { id: 'cuentas',    icono: '🔑', titulo: 'Personas con acceso', nivel: 'N4' },
  { id: 'crear',      icono: '➕', titulo: 'Crear acceso',        nivel: 'N4' },
  { id: 'permisos',   icono: '🔎', titulo: 'Qué puede cada quien', nivel: 'N3' },
  { id: 'roles',      icono: '🎭', titulo: 'Roles y techos',      nivel: 'N2' },
  { id: 'recert',     icono: '📜', titulo: 'Recertificación',     nivel: 'N4' },

  { grupo: 'Organización' },
  { id: 'iglesias',   icono: '⛪', titulo: 'Iglesias y sedes',    nivel: 'N2' },
  { id: 'plantillas', icono: '🧩', titulo: 'Plantillas de iglesia' },
  { id: 'modulos',    icono: '🎚️', titulo: 'Qué ve cada iglesia', nivel: 'N3' },
  { id: 'equipos',    icono: '🏛️', titulo: 'Equipos corporativos', nivel: 'N4' },
  { id: 'organigrama',icono: '🗂️', titulo: 'Organigrama' },

  { grupo: 'Gobierno' },
  { id: 'vigilancia', icono: '🛡️', titulo: 'Sesiones y alertas',  nivel: 'N4' },
  { id: 'bitacora',   icono: '📖', titulo: 'Quién hizo y quién miró', nivel: 'N4' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const niv = (n) => `<span class="ms-niv ms-niv--${Number(n) || 0}">N${Number(n) || 0}</span>`;
const num = (n) => `<span class="num">${esc(n ?? 0)}</span>`;

/* ── Arranque ─────────────────────────────────────────────────────── */
async function arrancar() {
  if (demoActivo() && !hayTokens()) guardarTokens({ acceso: 'demo', refresco: null });
  if (!hayTokens()) return entrada();
  try {
    sesion = await api.obtener('/api/v1/sesion/yo');
    if (!(sesion?.alcance?.todaLaRed) && Number(sesion?.alcance?.nivelMax ?? 0) < 4) {
      /* ⛔ No es un adorno: quien no alcanza la red no tiene nada que
         hacer aquí, y decírselo claro es mejor que enseñarle pestañas
         que después le van a responder «no tiene permiso» una por una. */
      return sinPaso();
    }
    marco();
  } catch (e) {
    if (e.estado === 401) { borrarTokens(); return entrada(); }
    RAIZ.innerHTML = `<div class="ms-main"><div class="ms-alerta ms-alerta--roja">
      No se pudo abrir la consola: ${esc(e.message)}</div></div>`;
  }
}

function entrada(mensaje = '') {
  RAIZ.innerHTML = `
    <div style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:var(--pa)">
      <div style="width:100%;max-width:380px">
        <div style="text-align:center;margin-bottom:24px">
          <div class="ms-logo" style="width:44px;height:44px;font-size:16px;margin:0 auto 12px">CR</div>
          <b style="font-size:18px;display:block">Sistema Master</b>
          <small style="color:var(--tin-dim)">El comando central de la red</small>
        </div>
        <div style="background:var(--sup);border:1px solid var(--fil);border-radius:var(--r-lg);padding:24px">
          ${mensaje ? `<div class="ms-alerta ms-alerta--roja">${esc(mensaje)}</div>` : ''}
          <form id="f-entrar">
            <label class="ms-campo"><span>Usuario</span>
              <input name="usuario" type="email" autocomplete="username" required></label>
            <label class="ms-campo"><span>Contraseña</span>
              <input name="clave" type="password" autocomplete="current-password" required></label>
            <div id="zona-codigo"></div>
            <button class="ms-btn ms-btn--pri" style="width:100%" type="submit">Entrar</button>
          </form>
        </div>
        <p style="text-align:center;color:var(--tin-dim);font-size:11px;margin-top:16px">
          Esta consola administra los accesos de toda la red.
        </p>
      </div>
    </div>`;

  let usuario = '', clave = '', paso = 'clave', secreto = '';
  RAIZ.querySelector('#f-entrar').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, b = f.querySelector('button');
    b.disabled = true; b.textContent = 'Un momento…';
    try {
      if (paso === 'clave') {
        usuario = f.usuario.value.trim(); clave = f.clave.value;
        const r = await api.enviar('/api/v1/auth/entrar', { usuario, clave });
        if (r.debeConfigurarSegundoFactor) {
          guardarTokens({ acceso: r.acceso, refresco: null });
          const ini = await api.enviar('/api/v1/auth/segundo-factor/iniciar', {});
          secreto = ini.secreto; paso = 'configurar';
          f.querySelector('#zona-codigo').innerHTML = `
            <div class="ms-nota" style="margin-bottom:12px">
              Su rol alcanza datos sensibles. Agregue esta clave a su aplicación de
              autenticación y escriba el código:
              <div class="mono" style="margin-top:6px;word-break:break-all">${esc(secreto)}</div>
            </div>
            <label class="ms-campo"><span>Código</span>
              <input name="codigo" inputmode="numeric" maxlength="6" required></label>`;
          return;
        }
        guardarTokens(r); return entrar();
      }
      if (paso === 'configurar') {
        await api.enviar('/api/v1/auth/segundo-factor/activar', { codigo: f.codigo.value });
      }
      const r = await api.enviar('/api/v1/auth/entrar', { usuario, clave, codigo: f.codigo?.value });
      guardarTokens(r); return entrar();
    } catch (e) {
      if (e.datos?.faltaSegundoFactor) {
        paso = 'codigo';
        f.querySelector('#zona-codigo').innerHTML = `
          <label class="ms-campo"><span>Código del segundo factor</span>
            <input name="codigo" inputmode="numeric" maxlength="6" required></label>`;
      } else entrada(e.message);
    } finally { b.disabled = false; b.textContent = 'Entrar'; }
  });
  RAIZ.querySelector('input')?.focus();
}

async function entrar() { sesion = await api.obtener('/api/v1/sesion/yo'); marco(); }

function sinPaso() {
  RAIZ.innerHTML = `
    <div class="ms-main ms-ancho--lectura">
      <div class="ms-head"><h1>Esta consola no es para su rol</h1>
        <p>El Sistema Master administra los accesos, las iglesias y los permisos de
           toda la red, y exige alcance de organización. Su trabajo diario está en la
           aplicación de la sede.</p></div>
      <p><a class="ms-btn ms-btn--pri" href="../index.html">Ir a la aplicación</a>
         <button class="ms-btn" id="b-salir2">Salir</button></p>
    </div>`;
  RAIZ.querySelector('#b-salir2').addEventListener('click', salir);
}

/* ── Marco ────────────────────────────────────────────────────────── */
function marco() {
  const yo = sesion?.persona?.nombre ?? 'Usuario maestro';
  const iniciales = yo.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  RAIZ.innerHTML = `
    ${demoActivo() ? `<div style="background:#7A1F12;color:#FFF6F2;padding:6px 24px;font-size:11px;text-align:center">
      ⛔ MODO DEMOSTRACIÓN · todos los nombres y las cifras son <b>inventados</b>. Nada se guarda.</div>` : ''}
    <header class="ms-top">
      <div class="ms-marca">
        <div class="ms-logo">CR</div>
        <div><b>Casa Roca · Sistema Master</b>
          <small id="ms-sub">Comando central de la red</small></div>
      </div>
      <div class="ms-sp"></div>
      <div class="ms-yo"><div><b>${esc(yo)}</b>
        <small>${esc(sesion?.alcance?.todaLaRed ? 'toda la red' : 'alcance limitado')}
          · techo N${esc(String(sesion?.alcance?.nivelMax ?? 0))}</small></div>
        <div class="ms-av">${esc(iniciales)}</div></div>
      <button class="ms-btn" id="b-salir" style="margin-left:12px">Salir</button>
    </header>
    <div class="ms-shell">
      <nav class="ms-nav" aria-label="Secciones del Sistema Master">
        ${NAV.map(n => n.grupo
          ? `<div class="ms-navsep">${esc(n.grupo)}</div>`
          : `<button class="ms-navit ${n.id === vista ? 'is-on' : ''}" data-vista="${n.id}"
                     ${n.id === vista ? 'aria-current="page"' : ''}>
               <span class="ms-navic" aria-hidden="true">${n.icono}</span><span>${esc(n.titulo)}</span>
               ${n.nivel ? `<em class="ms-navniv">${esc(n.nivel)}</em>` : ''}
             </button>`).join('')}
      </nav>
      <main class="ms-main" id="ms-main" tabindex="-1"></main>
    </div>`;
  RAIZ.querySelectorAll('[data-vista]').forEach(b =>
    b.addEventListener('click', () => { location.hash = '#/' + b.dataset.vista; }));
  RAIZ.querySelector('#b-salir').addEventListener('click', salir);
  pintar();
  subtitulo();
}

/** El subtítulo dice el estado real de la red, no un eslogan. */
async function subtitulo() {
  try {
    const s = await api.obtener('/api/v1/organizacion/sedes');
    const lista = Array.isArray(s) ? s : (s?.sedes ?? []);
    const z = document.getElementById('ms-sub');
    if (z) z.textContent = `Comando central · ${lista.length} iglesia(s) en la red`;
  } catch { /* el marco vale igual sin esto */ }
}

async function salir() {
  try { await api.enviar('/api/v1/auth/salir', {}); } catch { /* igual se cierra aquí */ }
  borrarTokens(); sesion = null; location.hash = ''; entrada();
}

window.addEventListener('hashchange', () => { if (sesion) { vista = ruta(); marco(); } });
const ruta = () => {
  const r = location.hash.replace(/^#\/?/, '').split('/')[0];
  return NAV.some(n => n.id === r) ? r : 'arranque';
};

/* ── Pintado ──────────────────────────────────────────────────────── */
const cargando = `<div class="ms-main" style="padding:0"><p style="color:var(--tin-dim)">Cargando…</p></div>`;

async function pintar() {
  vista = ruta();
  const m = document.getElementById('ms-main');
  if (!m) return;
  m.innerHTML = cargando;
  document.title = `${NAV.find(n => n.id === vista)?.titulo ?? 'Sistema Master'} · Casa Roca`;
  try {
    await VISTAS[vista](m);
  } catch (e) {
    m.innerHTML = `<div class="ms-alerta ms-alerta--roja">
      <b>No se pudo cargar.</b> ${esc(e.message)}
      ${e.peticionId ? `<div class="mono" style="margin-top:4px">petición ${esc(e.peticionId)}</div>` : ''}
    </div>`;
  }
  m.focus({ preventScroll: true });
}

function cabecera(titulo, texto) {
  return `<div class="ms-head"><h1>${esc(titulo)}</h1><p>${esc(texto)}</p></div>`;
}
function alerta(texto, clase = 'ambar') {
  return texto ? `<div class="ms-alerta ms-alerta--${clase}">${esc(texto)}</div>` : '';
}
function tablaMs(filas, cols, vacio = 'Nada todavía.') {
  if (!filas?.length) return `<p class="ms-vacio">${esc(vacio)}</p>`;
  return `<div class="ms-scroll"><table class="ms-tabla">
    <thead><tr>${cols.map(c => `<th>${esc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr>${cols.map(c => `<td>${c.p ? c.p(f) : esc(f[c.k] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

/* Diálogo de una pregunta, en el marco de la consola. */
function pedir(campos, titulo) {
  return new Promise(resolve => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(20,20,24,.35)';
    d.innerHTML = `<div style="background:var(--sup);border:1px solid var(--fil);border-radius:var(--r-lg);
        padding:24px;width:min(520px,92vw);max-height:88dvh;overflow:auto;box-shadow:var(--som-flota)">
      <h3 style="margin:0 0 16px;font-size:15px">${esc(titulo)}</h3>
      <form id="f-modal">
        ${campos.map(c => `
          <label class="ms-campo"><span>${esc(c.etiqueta)}${c.obligatorio ? ' <i class="ms-req">obligatorio</i>' : ''}</span>
            ${c.opciones
              ? `<select name="${esc(c.nombre)}" ${c.obligatorio ? 'required' : ''}>
                   ${c.opciones.map(o => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('')}
                 </select>`
              : `<input name="${esc(c.nombre)}" type="${esc(c.tipo ?? 'text')}"
                        ${c.obligatorio ? 'required' : ''} ${c.valor ? `value="${esc(c.valor)}"` : ''}
                        ${c.ayuda ? `placeholder="${esc(c.ayuda)}"` : ''}>`}
          </label>`).join('')}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button type="button" class="ms-btn" id="b-cancelar">Cancelar</button>
          <button type="submit" class="ms-btn ms-btn--pri">Confirmar</button>
        </div>
      </form></div>`;
    document.body.appendChild(d);
    d.querySelector('input,select')?.focus();
    d.querySelector('#b-cancelar').addEventListener('click', () => { d.remove(); resolve(null); });
    d.querySelector('#f-modal').addEventListener('submit', ev => {
      ev.preventDefault();
      const out = {};
      for (const c of campos) {
        const v = ev.target.elements[c.nombre]?.value?.trim();
        if (v) out[c.nombre] = c.numero ? Number(v) : v;
      }
      d.remove(); resolve(out);
    });
  });
}

function avisar(texto, clase = 'verde') {
  const m = document.getElementById('ms-main');
  if (!m) return;
  const d = document.createElement('div');
  d.className = `ms-alerta ms-alerta--${clase}`;
  d.setAttribute('role', clase === 'roja' ? 'alert' : 'status');
  d.textContent = texto;
  m.prepend(d);
  setTimeout(() => d.remove(), 9000);
}

/* ══════════════════════════════════════════════════════════════════════
   LAS VISTAS
   ══════════════════════════════════════════════════════════════════════ */
const VISTAS = {

  /* ── Puesta en marcha ──────────────────────────────────────────────
     ⛔ El sistema se llena EN UN ORDEN. Cada paso habilita el siguiente;
     saltarse uno deja huérfano al que sigue: una iglesia sin pastor no
     se opera sola, y un equipo sin rol existe pero no puede hacer nada. */
  async arranque(m) {
    const [sed, uni, cue, pla] = await Promise.all([
      api.obtener('/api/v1/organizacion/sedes').catch(() => []),
      api.obtener('/api/v1/administracion/unidades').catch(() => ({ unidades: [] })),
      api.obtener('/api/v1/administracion/cuentas?limite=500').catch(() => ({ cuentas: [] })),
      api.obtener('/api/v1/administracion/plantillas').catch(() => ({ plantillas: [] })),
    ]);
    const sedes = Array.isArray(sed) ? sed : (sed?.sedes ?? []);
    const equipos = (uni.unidades ?? []).filter(u => u.clase === 'equipo');
    const equiposConRol = equipos.filter(u => Number(u.roles) > 0);
    const cuentas = cue.cuentas ?? [];

    const pasos = [
      { n: 1, titulo: 'Dirección General',
        texto: 'De aquí sale todo lo demás: quien despliega iglesias y otorga accesos.',
        hecho: cuentas.some(c => (c.roles ?? '').includes('PASTOR_DIRECTOR_GENERAL')),
        cuenta: cuentas.filter(c => (c.roles ?? '').includes('PASTOR_DIRECTOR_GENERAL')).length,
        de: 'al menos 1', ir: 'cuentas', boton: 'Ver accesos' },
      { n: 2, titulo: 'Equipos corporativos',
        texto: 'Contabilidad, Tesorería y los demás equipos que dependen de la Dirección.',
        hecho: equiposConRol.length > 0,
        cuenta: equiposConRol.length, de: `${equipos.length} creados`,
        ir: 'equipos', boton: 'Crear equipo' },
      { n: 3, titulo: 'Iglesias con pastor',
        texto: 'Cada una nace con su pastor y con una plantilla que define qué ve.',
        hecho: sedes.length > 1, cuenta: sedes.length, de: 'la red prevé 36',
        ir: 'iglesias', boton: 'Desplegar iglesia' },
      { n: 4, titulo: 'Accesos por iglesia',
        texto: 'Directores, líderes, consejeros y tesorería de cada sede.',
        hecho: cuentas.length > 1, cuenta: cuentas.length, de: 'según cada iglesia',
        ir: 'crear', boton: 'Crear acceso' },
    ];
    const listos = pasos.filter(p => p.hecho).length;

    m.innerHTML = `
      <div class="ms-ancho--lectura">
      ${cabecera('Puesta en marcha',
        'El sistema se llena en un orden. Cada paso habilita el siguiente; saltarse uno deja huérfano al que sigue.')}
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <div style="flex:1;height:4px;background:var(--pa-alt);border-radius:2px;overflow:hidden">
          <div style="width:${(listos / pasos.length) * 100}%;height:100%;background:var(--ok)"></div>
        </div>
        <small style="color:var(--tin-dim);white-space:nowrap">${listos} de ${pasos.length} pasos completos</small>
      </div>
      <div class="ms-asistente">
        ${pasos.map(p => `
          <div class="ms-paso">
            <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <h3><i style="${p.hecho ? 'background:var(--ok)' : 'background:var(--pa-alt);color:var(--tin-mid)'}">
                  ${p.hecho ? '✓' : p.n}</i>${esc(p.titulo)}</h3>
                <p style="margin:0;color:var(--tin-mid);font-size:13px">${esc(p.texto)}</p>
              </div>
              <div style="text-align:right;white-space:nowrap">
                <b class="num" style="font-size:22px;font-weight:500">${p.cuenta}</b>
                <small style="display:block;color:var(--tin-dim);font-size:11px">/ ${esc(p.de)}</small>
              </div>
            </div>
            <div style="margin-top:12px;text-align:right">
              <button class="ms-btn ${p.hecho ? '' : 'ms-btn--pri'}" data-ir="${p.ir}">${esc(p.boton)}</button>
            </div>
          </div>`).join('')}
      </div>
      ${pla.plantillas?.length ? `<p class="ms-nota" style="margin-top:24px">
        La red tiene ${pla.plantillas.length} plantilla(s) de iglesia. Los módulos con
        compuerta legal nacen apagados: se encienden cuando exista la evidencia jurídica.</p>` : ''}
      </div>`;
    m.querySelectorAll('[data-ir]').forEach(b =>
      b.addEventListener('click', () => { location.hash = '#/' + b.dataset.ir; }));
  },

  /* ── Tablero de la red ─────────────────────────────────────────── */
  async red(m) {
    const [sed, uni, cue, rec] = await Promise.all([
      api.obtener('/api/v1/organizacion/sedes').catch(() => []),
      api.obtener('/api/v1/administracion/unidades').catch(() => ({ unidades: [] })),
      api.obtener('/api/v1/administracion/cuentas?limite=500').catch(() => ({ cuentas: [] })),
      api.obtener('/api/v1/administracion/recertificar').catch(() => ({ accesos: [] })),
    ]);
    const sedes = Array.isArray(sed) ? sed : (sed?.sedes ?? []);
    const cuentas = cue.cuentas ?? [];
    const problemas = cuentas.filter(c => c.bloqueada || c.estado !== 'activa'
      || (c.exige_segundo_factor && !c.segundo_factor_activo));
    m.innerHTML = `
      ${cabecera('Tablero de la red', 'Lo que hay hoy, contado por el sistema, no por un informe.')}
      <div class="ms-kpis">
        <div class="ms-kpi"><b class="num">${sedes.length}</b><span>Iglesias</span></div>
        <div class="ms-kpi"><b class="num">${(uni.unidades ?? []).filter(u => u.clase === 'equipo').length}</b><span>Equipos</span></div>
        <div class="ms-kpi"><b class="num">${cuentas.length}</b><span>Personas con acceso</span></div>
        <div class="ms-kpi ${problemas.length ? 'ms-kpi--ojo' : ''}"><b class="num">${problemas.length}</b><span>Accesos con problema</span></div>
        <div class="ms-kpi ${(rec.accesos ?? []).length ? 'ms-kpi--ojo' : ''}"><b class="num">${(rec.accesos ?? []).length}</b><span>Por recertificar</span></div>
      </div>
      ${alerta(rec.aviso)}
      <h2 class="ms-h2">Iglesias</h2>
      ${tablaMs(sedes, [
        { t: 'Código', p: s => `<code>${esc(s.codigo)}</code>` },
        { t: 'Nombre', p: s => `<b>${esc(s.nombre)}</b>` },
        { t: 'Ciudad', k: 'ciudad' },
        { t: '', p: s => `<button class="ms-btn" data-modulos="${esc(s.id)}">Qué ve</button>` },
      ], 'Ninguna iglesia todavía.')}`;
    m.querySelectorAll('[data-modulos]').forEach(b =>
      b.addEventListener('click', () => { location.hash = '#/modulos'; }));
  },

  /* ── Personas con acceso ───────────────────────────────────────── */
  async cuentas(m) {
    const d = await api.obtener('/api/v1/administracion/cuentas?limite=300');
    m.innerHTML = `
      ${cabecera('Personas con acceso',
        'Quién puede entrar hoy, con qué roles y en qué estado está su cuenta.')}
      ${alerta(d.aviso)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input id="q" class="ms-campo" style="max-width:320px;height:32px;padding:0 12px;
               border:1px solid var(--fil);border-radius:var(--r);font:inherit"
               placeholder="Buscar por nombre o usuario">
        <button class="ms-btn ms-btn--pri" id="b-nuevo">+ Crear acceso</button>
      </div>
      <div id="tabla">${tablaMs(d.cuentas, COLS_CUENTA, 'Ninguna cuenta a su alcance.')}</div>`;
    engancharCuentas(m);
    m.querySelector('#b-nuevo').addEventListener('click', () => { location.hash = '#/crear'; });
    let t;
    m.querySelector('#q').addEventListener('input', ev => {
      clearTimeout(t);
      const q = ev.target.value.trim();
      t = setTimeout(async () => {
        const r = await api.obtener('/api/v1/administracion/cuentas?limite=300&q=' + encodeURIComponent(q));
        m.querySelector('#tabla').innerHTML = tablaMs(r.cuentas, COLS_CUENTA, 'Nadie coincide.');
        engancharCuentas(m);
      }, 300);
    });
  },

  /* ── Crear acceso ──────────────────────────────────────────────── */
  async crear(m) {
    const sed = await api.obtener('/api/v1/organizacion/sedes').catch(() => []);
    const sedes = Array.isArray(sed) ? sed : (sed?.sedes ?? []);
    m.innerHTML = `
      <div class="ms-ancho--forma">
      ${cabecera('Crear acceso',
        'Dos pasos: registrar a la persona, si no está, y crearle la cuenta. La contraseña provisional se muestra una sola vez.')}
      <div class="ms-paso">
        <h3><i>1</i>Registrar a la persona</h3>
        <form id="f-persona">
          <div class="ms-fila2">
            <label class="ms-campo"><span>Primer nombre <i class="ms-req">obligatorio</i></span>
              <input name="primerNombre" required></label>
            <label class="ms-campo"><span>Primer apellido <i class="ms-req">obligatorio</i></span>
              <input name="primerApellido" required></label>
          </div>
          <label class="ms-campo"><span>Iglesia <i class="ms-req">obligatorio</i></span>
            <select name="sedeId" required>
              ${sedes.map(s => `<option value="${esc(s.id)}">${esc(s.codigo)} · ${esc(s.nombre)}</option>`).join('')}
            </select></label>
          <div class="ms-fila2">
            <label class="ms-campo"><span>Documento</span><input name="numeroDocumento"></label>
            <label class="ms-campo"><span>Correo</span><input name="email" type="email"></label>
          </div>
          <button class="ms-btn ms-btn--pri" type="submit">Registrar</button>
        </form>
        <div id="salida-persona"></div>
      </div>

      <div class="ms-paso" style="margin-top:12px">
        <h3><i>2</i>Crearle la cuenta</h3>
        <form id="f-cuenta">
          <label class="ms-campo"><span>Identificador de la persona <i class="ms-req">obligatorio</i></span>
            <input name="personaId" required placeholder="Se rellena solo al registrarla arriba"></label>
          <label class="ms-campo"><span>Usuario (correo) <i class="ms-req">obligatorio</i></span>
            <input name="usuario" type="email" required></label>
          <button class="ms-btn ms-btn--pri" type="submit">Crear cuenta</button>
        </form>
        <div id="salida-cuenta"></div>
      </div>
      </div>`;

    m.querySelector('#f-persona').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, d = {};
      for (const k of ['primerNombre','primerApellido','sedeId','numeroDocumento','email'])
        if (f.elements[k].value.trim()) d[k] = f.elements[k].value.trim();
      try {
        const r = await api.enviar('/api/v1/administracion/personas', d);
        m.querySelector('#f-cuenta').elements.personaId.value = r.id;
        if (d.email) m.querySelector('#f-cuenta').elements.usuario.value = d.email;
        m.querySelector('#salida-persona').innerHTML =
          `<div class="ms-alerta ms-alerta--verde" style="margin-top:12px">${esc(r.mensaje)}
            <div class="mono" style="margin-top:4px">${esc(r.id)}</div></div>`;
        f.reset();
      } catch (e) {
        m.querySelector('#salida-persona').innerHTML =
          `<div class="ms-alerta ms-alerta--roja" style="margin-top:12px">${esc(e.message)}</div>`;
      }
    });

    m.querySelector('#f-cuenta').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target;
      try {
        const r = await api.enviar('/api/v1/administracion/cuentas', {
          personaId: f.elements.personaId.value.trim(),
          usuario: f.elements.usuario.value.trim(),
        });
        m.querySelector('#salida-cuenta').innerHTML = claveProvisional(r.clave_provisional, r.mensaje);
        engancharCopiar(m);
        f.reset();
      } catch (e) {
        m.querySelector('#salida-cuenta').innerHTML =
          `<div class="ms-alerta ms-alerta--roja" style="margin-top:12px">${esc(e.message)}</div>`;
      }
    });
  },
};

/* ══════════════════════════════════════════════════════════════════════
   El resto de las vistas. Se añaden con Object.assign en vez de alargar
   el literal de arriba: así cada bloque se lee entero sin tener que
   buscar dónde cierra el anterior.
   ══════════════════════════════════════════════════════════════════════ */
Object.assign(VISTAS, {

  async permisos(m) {
    m.innerHTML = `
      ${cabecera('Qué puede cada quien',
        'Los roles de una persona y lo que de verdad alcanza con ellos. Es la pregunta de toda auditoría.')}
      <form id="f-p" style="display:flex;gap:8px;margin-bottom:16px;max-width:560px">
        <input name="id" style="flex:1;height:32px;padding:0 12px;border:1px solid var(--fil);
               border-radius:var(--r);font:inherit" placeholder="Identificador de la persona" required>
        <button class="ms-btn ms-btn--pri" type="submit">Ver</button>
      </form>
      <div id="det"><p class="ms-vacio">Pegue el identificador de una persona.</p></div>`;
    m.querySelector('#f-p').addEventListener('submit', async ev => {
      ev.preventDefault();
      const id = ev.target.elements.id.value.trim();
      const z = m.querySelector('#det');
      z.innerHTML = cargando;
      try {
        const [asig, efe] = await Promise.all([
          api.obtener('/api/v1/identidad/personas/' + id + '/asignaciones'),
          api.obtener('/api/v1/identidad/personas/' + id + '/efectivo').catch(() => null),
        ]);
        const filas = Array.isArray(asig) ? asig : (asig?.asignaciones ?? []);
        const permisos = Array.isArray(efe) ? efe : (efe?.permisos ?? []);
        z.innerHTML = `
          <h2 class="ms-h2">Roles vigentes</h2>
          ${tablaMs(filas, [
            { t: 'Rol', p: a => `<b>${esc(a.rol)}</b>` },
            { t: 'Alcance', p: a => esc(a.alcance_tipo) },
            { t: 'Techo', p: a => niv(a.nivel_max) },
            { t: 'Desde', k: 'vigente_desde' },
            { t: '', p: a => `<button class="ms-btn" data-rev="${esc(a.id)}">Revocar</button>` },
          ], 'Sin roles vigentes: esta persona no puede hacer nada.')}
          <h2 class="ms-h2">Lo que alcanza de verdad</h2>
          ${tablaMs(permisos.slice(0, 300), [
            { t: 'Módulo', k: 'modulo' }, { t: 'Acción', k: 'accion' },
            { t: 'Techo', p: p => niv(p.nivel_max ?? p.nivel) },
          ], 'Nada.')}`;
        z.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', async () => {
          const r = await pedir([{ nombre: 'motivo', etiqueta: 'Motivo de la revocación', obligatorio: true }],
                                'Revocar el rol');
          if (!r) return;
          try {
            await api.borrar('/api/v1/identidad/asignaciones/' + b.dataset.rev);
            avisar('Rol revocado.'); m.querySelector('#f-p').requestSubmit();
          } catch (e) { avisar(e.message, 'roja'); }
        }));
      } catch (e) { z.innerHTML = `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`; }
    });
  },

  async roles(m) {
    const r = await api.obtener('/api/v1/identidad/roles');
    const lista = Array.isArray(r) ? r : (r?.roles ?? []);
    m.innerHTML = `
      ${cabecera('Roles y techos',
        'Cada rol tiene un alcance máximo y un techo de sensibilidad. La base no deja otorgar por encima.')}
      ${tablaMs(lista, [
        { t: 'Rol', p: x => `<b>${esc(x.nombre ?? x.codigo)}</b>` },
        { t: 'Código', p: x => `<code>${esc(x.codigo)}</code>` },
        { t: 'Alcance máximo', k: 'alcance_maximo' },
        { t: 'Techo', p: x => niv(x.nivel_maximo) },
        { t: 'Para qué', p: x => `<span style="color:var(--tin-mid)">${esc(x.descripcion ?? '')}</span>` },
      ])}`;
  },

  async recert(m) {
    const d = await api.obtener('/api/v1/administracion/recertificar');
    m.innerHTML = `
      ${cabecera('Recertificación de accesos',
        'Un permiso que nadie revisa es un permiso que nadie quitó.')}
      ${alerta(d.aviso, 'ambar')}
      ${tablaMs(d.accesos, [
        { t: 'Persona', p: x => `<b>${esc(x.persona)}</b>` },
        { t: 'Rol', p: x => `${esc(x.rol)} ${niv(x.nivel_max)}` },
        { t: 'Sin revisar', p: x => `<span class="num">${esc(x.dias_sin_revisar)}</span> día(s)` },
        { t: 'Tope', p: x => `<span class="num">${esc(x.tope_dias ?? '—')}</span>` },
      ], 'Nada pendiente de revisar.')}`;
  },

  async iglesias(m) {
    const [sed, pla] = await Promise.all([
      api.obtener('/api/v1/organizacion/sedes').catch(() => []),
      api.obtener('/api/v1/administracion/plantillas'),
    ]);
    const sedes = Array.isArray(sed) ? sed : (sed?.sedes ?? []);
    m.innerHTML = `
      ${cabecera('Iglesias y sedes',
        'Desplegar una iglesia es una sola operación: la sede, sus módulos según la plantilla, y su pastor.')}
      ${alerta(pla.aviso)}
      <p style="margin-bottom:16px"><button class="ms-btn ms-btn--pri" id="b-desplegar">+ Desplegar una iglesia</button></p>
      ${tablaMs(sedes, [
        { t: 'Código', p: s => `<code>${esc(s.codigo)}</code>` },
        { t: 'Iglesia', p: s => `<b>${esc(s.nombre)}</b>` },
        { t: 'Ciudad', k: 'ciudad' },
        { t: 'Tipo', p: s => `<span class="ms-chip">${esc(s.tipo ?? '')}</span>` },
      ], 'Ninguna iglesia. Despliegue la primera.')}`;
    m.querySelector('#b-desplegar').addEventListener('click', async () => {
      const d = await pedir([
        { nombre: 'codigo', etiqueta: 'Código', obligatorio: true, ayuda: 'BOG-SUR' },
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, ayuda: 'Bogotá Sur' },
        { nombre: 'tipo', etiqueta: 'Tipo', obligatorio: true, opciones: [
          { valor: 'plantacion', texto: 'Plantación' },
          { valor: 'filial_nacional', texto: 'Filial nacional' },
          { valor: 'filial_internacional', texto: 'Filial internacional' }] },
        { nombre: 'pais', etiqueta: 'País (2 letras)', obligatorio: true, valor: 'CO' },
        { nombre: 'ciudad', etiqueta: 'Ciudad', obligatorio: true },
        { nombre: 'plantilla', etiqueta: 'Plantilla', obligatorio: true,
          opciones: pla.plantillas.filter(p => p.codigo !== 'MAESTRA')
            .map(p => ({ valor: p.codigo, texto: p.nombre + ' · ' + p.modulos + ' módulos' })) },
        { nombre: 'pastorId', etiqueta: 'Identificador del pastor', obligatorio: true },
      ], 'Desplegar una iglesia');
      if (!d) return;
      try { const r = await api.enviar('/api/v1/administracion/iglesias', d); avisar(r.mensaje); pintar(); }
      catch (e) { avisar(e.message, 'roja'); }
    });
  },

  async plantillas(m) {
    const d = await api.obtener('/api/v1/administracion/plantillas');
    m.innerHTML = `
      ${cabecera('Plantillas de iglesia',
        'Qué módulos trae una iglesia nueva según su tipo. Es lo que hace que las 36 tengan el mismo sistema inicial.')}
      ${alerta(d.aviso)}
      ${d.plantillas.map(p => `
        <div class="ms-persona">
          <div class="ms-persona__cab">
            <div><b>${esc(p.nombre)}</b><span class="ms-doc">${esc(p.codigo)} · ${esc(p.tipo_sede)}</span></div>
            <div><span class="num" style="font-size:18px">${p.modulos}</span>
              <small style="color:var(--tin-dim)"> módulos</small></div>
          </div>
          <div style="padding:12px 16px">
            <p style="margin:0 0 8px;color:var(--tin-mid);font-size:13px">${esc(p.descripcion ?? '')}</p>
            <div class="ms-chips">${(p.lista ?? '').split(', ').filter(Boolean)
              .map(x => `<span class="ms-chip">${esc(x)}</span>`).join('')}</div>
            ${p.con_compuerta_legal ? `<p class="ms-falta" style="margin-top:8px">
              ${p.con_compuerta_legal} nacen APAGADOS: exigen evidencia jurídica.</p>` : ''}
          </div>
        </div>`).join('')}`;
  },
});

Object.assign(VISTAS, {

  async modulos(m) {
    const sed = await api.obtener('/api/v1/organizacion/sedes').catch(() => []);
    const sedes = Array.isArray(sed) ? sed : (sed?.sedes ?? []);
    m.innerHTML = `
      ${cabecera('Qué ve cada iglesia',
        'Los módulos encendidos en una sede. La base impone las reglas: el núcleo no se apaga, y lo que tiene compuerta legal no se enciende sin evidencia.')}
      <label class="ms-campo ms-campo--ancho"><span>Iglesia</span>
        <select id="sel">${sedes.map(s => `<option value="${esc(s.id)}">${esc(s.codigo)} · ${esc(s.nombre)}</option>`).join('')}</select>
      </label>
      <div id="lista">${cargando}</div>`;
    const sel = m.querySelector('#sel');
    const pintarLista = async () => {
      const z = m.querySelector('#lista');
      z.innerHTML = cargando;
      try {
        const d = await api.obtener('/api/v1/administracion/sedes/' + sel.value + '/modulos');
        z.innerHTML = alerta(d.aviso, 'roja') + tablaMs(d.modulos, [
          { t: 'Módulo', p: x => `<b>${esc(x.nombre)}</b>${x.es_nucleo ? ' <span class="ms-chip">núcleo</span>' : ''}` },
          { t: 'Nivel', p: x => niv(x.nivel_dato) },
          { t: 'Depende de', p: x => x.depende_de ? `<code>${esc(x.depende_de)}</code>` : '—' },
          { t: 'Estado', p: x => x.activo
              ? '<span class="ms-vig ms-vig--ok">encendido</span>'
              : '<span class="ms-vig ms-vig--fin">apagado</span>' },
          { t: 'Evidencia legal', p: x => x.evidencia_legal_ref
              ? `<code>${esc(x.evidencia_legal_ref)}</code>`
              : (x.exige_compuerta_legal && x.activo ? '<span class="ms-falta">FALTA</span>' : '—') },
          { t: '', p: x => x.es_nucleo && x.activo ? '<span class="ms-vacio">no se apaga</span>'
              : `<button class="ms-btn" data-mod="${esc(x.codigo)}" data-on="${x.activo ? '1' : '0'}"
                   data-legal="${x.exige_compuerta_legal ? '1' : '0'}">${x.activo ? 'Apagar' : 'Encender'}</button>` },
        ]);
        z.querySelectorAll('[data-mod]').forEach(b => b.addEventListener('click', async () => {
          const encender = b.dataset.on === '0';
          let evidencia;
          if (encender && b.dataset.legal === '1') {
            const r = await pedir([{ nombre: 'evidencia', etiqueta: 'Referencia del instrumento jurídico', obligatorio: true }],
                                  'Este módulo exige compuerta legal');
            if (!r) return;
            evidencia = r.evidencia;
          }
          try {
            const r = await api.enviar('/api/v1/administracion/sedes/' + sel.value + '/modulos',
              { modulo: b.dataset.mod, activo: encender, evidencia });
            avisar(r.mensaje); pintarLista();
          } catch (e) { avisar(e.message, 'roja'); }
        }));
      } catch (e) { z.innerHTML = `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`; }
    };
    sel.addEventListener('change', pintarLista);
    pintarLista();
  },

  async equipos(m) {
    const d = await api.obtener('/api/v1/administracion/unidades');
    m.innerHTML = `
      ${cabecera('Equipos corporativos',
        'Contabilidad, Tesorería, Pastoral. Lo que se le otorga al equipo lo hereda cada integrante mientras esté dentro, y se le cae al salir.')}
      ${alerta(d.aviso)}
      <p style="margin-bottom:16px"><button class="ms-btn ms-btn--pri" id="b-eq">+ Crear un equipo</button></p>
      ${tablaMs(d.unidades, [
        { t: 'Unidad', p: u => `<b>${esc(u.nombre)}</b><span class="ms-doc">${esc(u.codigo)}</span>` },
        { t: 'Clase', p: u => `<span class="ms-chip">${esc(u.clase)}</span>` },
        { t: 'Integrantes', p: u => num(u.integrantes) },
        { t: 'Roles', p: u => Number(u.roles) === 0 && u.clase === 'equipo'
            ? '<span class="ms-falta">sin rol</span>' : num(u.roles) },
        { t: '', p: u => `<button class="ms-btn" data-eq="${esc(u.id)}">Abrir</button>` },
      ])}
      <div id="ficha" style="margin-top:24px"></div>`;

    m.querySelector('#b-eq').addEventListener('click', async () => {
      const r = await pedir([
        { nombre: 'codigo', etiqueta: 'Código', obligatorio: true, ayuda: 'TESORERIA' },
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true },
        { nombre: 'clase', etiqueta: 'Clase', obligatorio: true, opciones: [
          { valor: 'equipo', texto: 'Equipo' }, { valor: 'direccion', texto: 'Dirección' },
          { valor: 'region', texto: 'Región' }] },
        { nombre: 'proposito', etiqueta: 'Propósito (mínimo 15 caracteres)', obligatorio: true },
      ], 'Crear un equipo');
      if (!r) return;
      try { const x = await api.enviar('/api/v1/administracion/unidades', r); avisar(x.mensaje); pintar(); }
      catch (e) { avisar(e.message, 'roja'); }
    });

    m.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-eq]');
      if (!b) return;
      const z = m.querySelector('#ficha');
      z.innerHTML = cargando;
      try {
        const u = await api.obtener('/api/v1/administracion/unidades/' + b.dataset.eq);
        z.innerHTML = `
          <div class="ms-persona">
            <div class="ms-persona__cab">
              <div><b>${esc(u.unidad.nombre)}</b><span class="ms-doc">${esc(u.unidad.codigo)} · ${esc(u.unidad.clase)}</span></div>
              <div style="display:flex;gap:8px">
                <button class="ms-btn ms-btn--pri" data-rol="${esc(u.unidad.id)}">Otorgar rol</button>
                <button class="ms-btn" data-mie="${esc(u.unidad.id)}">Meter a alguien</button>
              </div>
            </div>
            <div style="padding:12px 16px">
              <p style="margin:0 0 12px;color:var(--tin-mid);font-size:13px">${esc(u.unidad.proposito ?? '')}</p>
              ${alerta(u.aviso, 'roja')}
              <h2 class="ms-h2" style="margin-top:0">Roles del equipo</h2>
              ${tablaMs(u.roles, [
                { t: 'Rol', p: r => `<b>${esc(r.rol)}</b>` },
                { t: 'Alcance', k: 'alcance_tipo' },
                { t: 'Techo', p: r => niv(r.nivel_max) },
                { t: 'Acta', p: r => r.acta_referencia ? `<code>${esc(r.acta_referencia)}</code>` : '—' },
                { t: '', p: r => `<button class="ms-btn" data-revr="${esc(r.id)}">Revocar</button>` },
              ], 'Ninguno: el equipo existe pero no puede hacer nada.')}
              <h2 class="ms-h2">Integrantes</h2>
              ${tablaMs(u.miembros.lista, [
                { t: 'Persona', p: x => `<b>${esc(x.nombre_completo)}</b>` },
                { t: 'Rol en el equipo', p: x => `<span class="ms-chip">${esc(x.rol_en_unidad)}</span>` },
                { t: 'Desde', k: 'desde' },
                { t: 'Estado', p: x => x.hasta
                    ? `<span class="ms-vig ms-vig--fin">salió ${esc(x.hasta)}</span>`
                    : '<span class="ms-vig ms-vig--ok">activo</span>' },
                { t: '', p: x => x.hasta ? ''
                    : `<button class="ms-btn" data-sac="${esc(u.unidad.id)}|${esc(x.persona_id)}">Sacar</button>` },
              ], 'Nadie todavía.')}
              <h2 class="ms-h2">Sedes que alcanza</h2>
              <div class="ms-chips">${u.alcanza.length
                ? u.alcanza.map(s => `<span class="ms-chip">${esc(s.codigo)}</span>`).join('')
                : '<span class="ms-vacio">Ninguna por esta vía.</span>'}</div>
            </div>
          </div>`;
        z.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { z.innerHTML = `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`; }
    });

    m.addEventListener('click', async ev => {
      const rol = ev.target.closest('[data-rol]'), mie = ev.target.closest('[data-mie]');
      const rev = ev.target.closest('[data-revr]'), sac = ev.target.closest('[data-sac]');
      try {
        if (rol) {
          const r = await pedir([
            { nombre: 'rol', etiqueta: 'Código del rol', obligatorio: true, ayuda: 'TESORERIA' },
            { nombre: 'alcanceTipo', etiqueta: 'Alcance', obligatorio: true, opciones:
              ['organizacion','sede','segmento','grupo','ministerio','unidad'].map(v => ({ valor: v, texto: v })) },
            { nombre: 'alcanceId', etiqueta: 'Identificador del alcance (vacío si es toda la organización)' },
            { nombre: 'nivelMax', etiqueta: 'Techo (1 a 4)', obligatorio: true, valor: '3', numero: true },
            { nombre: 'acta', etiqueta: 'Acta que lo autoriza', obligatorio: true },
          ], 'Otorgar un rol al equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/' + rol.dataset.rol + '/roles', r);
          avisar(x.mensaje);
        } else if (mie) {
          const r = await pedir([{ nombre: 'personaId', etiqueta: 'Identificador de la persona', obligatorio: true }],
                                'Meter a alguien en el equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/' + mie.dataset.mie + '/miembros', r);
          avisar(x.mensaje);
        } else if (rev) {
          const r = await pedir([{ nombre: 'motivo', etiqueta: 'Motivo (lo pierden todos los integrantes)', obligatorio: true }],
                                'Revocar el rol del equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/roles/' + rev.dataset.revr + '/revocar', r);
          avisar(x.mensaje);
        } else if (sac) {
          const partes = sac.dataset.sac.split('|');
          const r = await pedir([{ nombre: 'motivo', etiqueta: 'Motivo de la salida', obligatorio: true }],
                                'Sacar del equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/' + partes[0] + '/miembros/' + partes[1] + '/salir', r);
          avisar(x.mensaje);
        } else return;
        pintar();
      } catch (e) { avisar(e.message, 'roja'); }
    });
  },

  async organigrama(m) {
    const d = await api.obtener('/api/v1/administracion/organigrama');
    m.innerHTML = `
      ${cabecera('Organigrama', 'La central, sus regiones, sus direcciones y sus equipos.')}
      ${tablaMs(d.unidades, [
        { t: 'Unidad', p: u => `${'&nbsp;'.repeat(Math.max(0, (u.nivel ?? 0) * 4))}<b>${esc(u.nombre)}</b>` },
        { t: 'Clase', p: u => `<span class="ms-chip">${esc(u.clase)}</span>` },
        { t: 'Código', p: u => `<code>${esc(u.codigo)}</code>` },
        { t: 'Integrantes', p: u => num(u.integrantes) },
        { t: 'Sedes que alcanza', p: u => num(u.sedes_que_alcanza) },
      ])}`;
  },

  async vigilancia(m) {
    const [ses, ale] = await Promise.all([
      api.obtener('/api/v1/administracion/sesiones'),
      api.obtener('/api/v1/administracion/alertas'),
    ]);
    m.innerHTML = `
      ${cabecera('Sesiones y alertas', 'Quién está dentro ahora y quién está probando contraseñas.')}
      ${alerta(ale.aviso, 'ambar')}
      <h2 class="ms-h2">Sesiones abiertas</h2>
      ${tablaMs(ses.sesiones, [
        { t: 'Persona', p: x => `<b>${esc(x.persona)}</b><span class="ms-doc">${esc(x.usuario)}</span>` },
        { t: 'Desde', p: x => esc(new Date(x.emitida_en).toLocaleString('es-CO')) },
        { t: 'Le queda', p: x => `<code>${esc(String(x.le_queda ?? '').split('.')[0])}</code>` },
        { t: 'Dirección', p: x => `<code>${esc(x.ip ?? '—')}</code>` },
      ], 'Nadie dentro.')}
      <h2 class="ms-h2">Intentos fallidos</h2>
      ${tablaMs(ale.alertas, [
        { t: 'Usuario', k: 'usuario' },
        { t: 'Dirección', p: x => `<code>${esc(x.ip ?? '—')}</code>` },
        { t: 'Intentos', p: x => `<span class="ms-niv ms-niv--4">${esc(x.intentos_fallidos)}</span>` },
      ], 'Ninguno.')}`;
  },

  async bitacora(m) {
    const [aud, lec] = await Promise.all([
      api.obtener('/api/v1/administracion/auditoria?limite=100'),
      api.obtener('/api/v1/administracion/lecturas?limite=100'),
    ]);
    m.innerHTML = `
      ${cabecera('Quién hizo y quién miró',
        'La auditoría registra los cambios. La bitácora de lectura existe para que mirar por curiosidad tenga nombre y hora.')}
      <h2 class="ms-h2">Lecturas de datos sensibles</h2>
      ${tablaMs(lec.lecturas, [
        { t: 'Cuándo', p: x => esc(new Date(x.ocurrido_en).toLocaleString('es-CO')) },
        { t: 'Quién', p: x => `<b>${esc(x.actor ?? '—')}</b>` },
        { t: 'Qué', p: x => `<code>${esc(x.esquema)}.${esc(x.tabla)}</code> ${niv(x.nivel)}` },
        { t: 'Motivo', p: x => `<span style="color:var(--tin-mid)">${esc(x.motivo ?? '')}</span>` },
      ], 'Ninguna lectura sensible registrada.')}
      <h2 class="ms-h2">Cambios</h2>
      ${tablaMs(aud.movimientos, [
        { t: 'Cuándo', p: x => esc(new Date(x.ocurrido_en).toLocaleString('es-CO')) },
        { t: 'Quién', p: x => esc(x.actor ?? 'sistema') },
        { t: 'Qué', p: x => `<code>${esc(x.esquema)}.${esc(x.tabla)}</code>` },
        { t: 'Operación', p: x => `<span class="ms-chip">${esc({ I: 'creó', U: 'cambió', D: 'borró' }[x.operacion] ?? x.operacion)}</span>` },
      ], 'Sin movimientos.')}`;
  },
});

/* ── Piezas compartidas de las cuentas ────────────────────────────── */
const COLS_CUENTA = [
  { t: 'Persona', p: x => `<b>${esc(x.persona)}</b><span class="ms-doc">${esc(x.usuario)}</span>` },
  { t: 'Iglesia', p: x => esc(x.sede ?? '—') },
  { t: 'Estado', p: x => `
      ${x.estado === 'activa' ? '<span class="ms-vig ms-vig--ok">activa</span>'
        : `<span class="ms-vig ms-vig--fin">${esc(x.estado)}</span>`}
      ${x.bloqueada ? '<span class="ms-vig ms-vig--porvencer">bloqueada</span>' : ''}
      ${x.debe_cambiar_clave ? '<span class="ms-chip">clave provisional</span>' : ''}` },
  { t: 'Segundo factor', p: x => !x.exige_segundo_factor ? '<span class="ms-vacio">no lo exige</span>'
      : x.segundo_factor_activo ? '<span class="ms-vig ms-vig--ok">activo</span>'
      : '<span class="ms-falta">SIN activar</span>' },
  { t: 'Último ingreso', p: x => x.ultimo_ingreso
      ? esc(new Date(x.ultimo_ingreso).toLocaleDateString('es-CO')) : '<span class="ms-vacio">nunca</span>' },
  { t: 'Roles', p: x => x.roles ? `<span style="color:var(--tin-mid)">${esc(x.roles)}</span>`
      : '<span class="ms-vacio">ninguno</span>' },
  { t: '', p: x => `
      <button class="ms-btn" data-cl="${esc(x.cuenta_id)}">Clave</button>
      ${x.bloqueada ? `<button class="ms-btn" data-db="${esc(x.cuenta_id)}">Desbloquear</button>` : ''}
      <button class="ms-btn" data-mfa="${esc(x.cuenta_id)}">2FA</button>` },
];

function claveProvisional(clave, mensaje) {
  return `<div class="ms-alerta ms-alerta--verde" style="margin-top:12px">
    <b>Contraseña provisional · se muestra una sola vez</b>
    <div class="mono" style="font-size:16px;margin:8px 0;padding:8px;background:var(--sup);
         border:1px solid var(--fil);border-radius:var(--r);word-break:break-word">${esc(clave)}</div>
    <div style="font-size:12px">${esc(mensaje ?? '')}</div>
    <button class="ms-btn" data-copiar="${esc(clave)}" style="margin-top:8px">Copiar</button>
  </div>`;
}

function engancharCopiar(m) {
  m.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copiar); avisar('Copiada.'); }
    catch { avisar('Su navegador no dejó copiar: selecciónela a mano.', 'ambar'); }
  }));
}

function engancharCuentas(m) {
  m.querySelectorAll('[data-cl],[data-db],[data-mfa]').forEach(b => b.addEventListener('click', async () => {
    try {
      if (b.dataset.cl) {
        if (!confirm('Se genera una contraseña provisional NUEVA y se cierran todas sus sesiones. ¿Seguir?')) return;
        const r = await api.enviar('/api/v1/administracion/cuentas/' + b.dataset.cl + '/reiniciar-clave', {});
        const z = document.createElement('div');
        z.innerHTML = claveProvisional(r.clave_provisional, r.mensaje);
        document.getElementById('ms-main').prepend(z.firstElementChild);
        engancharCopiar(document.getElementById('ms-main'));
        return;
      }
      if (b.dataset.db) {
        const r = await api.enviar('/api/v1/administracion/cuentas/' + b.dataset.db + '/desbloquear', {});
        avisar(r.mensaje);
      }
      if (b.dataset.mfa) {
        if (!confirm('Se borra su segundo factor y se cierran sus sesiones. Lo volverá a configurar al entrar. ¿Seguir?')) return;
        const r = await api.enviar('/api/v1/administracion/cuentas/' + b.dataset.mfa + '/reiniciar-segundo-factor', {});
        avisar(r.mensaje);
      }
      pintar();
    } catch (e) { avisar(e.message, 'roja'); }
  }));
}

arrancar();
