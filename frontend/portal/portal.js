import { api, hayTokens, borrarTokens, guardarTokens } from '../src/api.js';
import { demoActivo } from '../src/demo.js';
import { pintarEntrar } from '../src/vistas/entrar.js';
import { esc, cargando, error, engancharReintentar, avisar, unaVez } from '../src/ui.js';
import { icono } from '../src/iconos.js';
import { animarVista } from '../src/movimiento.js';
import { cabCelda, aviso, avisos } from '../src/tablero.js';

/**
 * Mi iglesia · el portal del congregante.
 *
 * ⛔ Por qué existe. Los derechos del titular (Ley 1581, art. 8: conocer,
 * actualizar, revocar, pedir supresión) solo se ejercían pidiéndoselos a
 * alguien de la iglesia. Aquí la persona los ejerce sola, a cualquier hora.
 *
 * Todo va contra `/api/v1/yo`, que nunca recibe el identificador de nadie:
 * la base responde con la identidad de la sesión. No hay forma de pedir
 * los datos de otro desde esta pantalla.
 */
const RAIZ = document.getElementById('app');
/* `corto` es para la barra del teléfono: cinco etiquetas largas no caben
   en 375 px y la última quedaba cortada. */
const PESTANAS = {
  inicio:   { titulo: 'Inicio',       corto: 'Inicio',   icono: '◈' },
  datos:    { titulo: 'Mis datos',    corto: 'Datos',    icono: '☺' },
  permisos: { titulo: 'Mis permisos', corto: 'Permisos', icono: '✉' },
  aportes:  { titulo: 'Mis aportes',  corto: 'Aportes',  icono: '¤' },
  derechos: { titulo: 'Mis derechos', corto: 'Derechos', icono: '⚖' },
};
const CANAL = { email: 'Correo', whatsapp: 'WhatsApp', sms: 'SMS', llamada: 'Llamada' };
const TIPO_PETICION = {
  consulta: 'Quiero saber qué datos míos tienen y para qué los usan',
  actualizacion: 'Quiero corregir o actualizar un dato',
  revocacion: 'Quiero retirar una autorización que di',
  reclamo: 'Quiero presentar un reclamo',
  supresion: 'Quiero que borren mis datos',
};
let resumen = null;

const pestanaActual = () => {
  const p = location.hash.replace(/^#\/?/, '') || 'inicio';
  return PESTANAS[p] ? p : 'inicio';
};
const dinero = (v, m = 'COP') => Number(v ?? 0).toLocaleString('es-CO', { style: 'currency', currency: m || 'COP', maximumFractionDigits: 0 });

async function arrancar() {
  if (demoActivo() && !hayTokens()) guardarTokens({ acceso: 'demo', refresco: null });
  if (!hayTokens()) return pintarEntrar(RAIZ, arrancar);
  RAIZ.innerHTML = cargando(3);
  try {
    resumen = await api.obtener('/api/v1/yo/resumen');
    pintarMarco();
  } catch (e) {
    if (e.estado === 401) { borrarTokens(); return pintarEntrar(RAIZ, arrancar); }
    RAIZ.innerHTML = error(e.message, e.peticionId);
    engancharReintentar(RAIZ, arrancar);
  }
}

function pintarMarco() {
  const actual = pestanaActual();
  const boton = ([k, v], corto = false) => `<button class="nav__item" data-ir="${k}" ${k === actual ? 'aria-current="page"' : ''}
      ${corto ? `aria-label="${esc(v.titulo)}"` : ''}>
      <span class="nav__icono" aria-hidden="true">${icono(k === 'inicio' ? 'panel' : k)}</span><span>${esc(corto ? v.corto : v.titulo)}</span></button>`;
  /* 5 oct 2026 · Mismo encuadre que la aplicación y la consola (DISENO.md
     §4): emblema arriba, pestañas bajo su rótulo y la persona abajo. Daniel
     lo vio suelto, con iconos de texto y sin marca: «todo lo que creemos
     tiene que tener el mismo estilo». */
  const yo = resumen?.persona ?? {};
  const iniciales = String(yo.nombre ?? '').split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  RAIZ.innerHTML = `
    <a class="salto-al-contenido" href="#contenido">Ir al contenido</a>
    <div class="marco">
      <nav class="nav" aria-label="Secciones">
        <span class="nav__todas">
          <span class="nav__marca">
            <span class="nav__emblema" aria-hidden="true">CR</span>
            <span><b>Mi iglesia</b><small>Casa Sobre la Roca</small></span>
          </span>
          <span class="nav__grupo" role="group" aria-label="Mi cuenta">
            <span class="nav__rotulo">Mi cuenta</span>${Object.entries(PESTANAS).map(e => boton(e)).join('')}
          </span>
          <span class="nav__yo">
            <span class="nav__avatar" aria-hidden="true">${esc(iniciales || '·')}</span>
            <span class="nav__yo-texto"><b>${esc(yo.nombre ?? '')}</b><small>${esc(yo.sede ?? '')}</small></span>
          </span>
        </span>
        <span class="nav__pocas">${Object.entries(PESTANAS).map(e => boton(e, true)).join('')}</span>
      </nav>
      <div class="columna">
        ${demoActivo() ? `<div class="banda-demo" role="alert">⛔ MODO DEMOSTRACIÓN · la persona y sus datos son
          <strong>inventados</strong>. Nada se guarda.</div>` : ''}
        <header class="cabecera">
          <span class="cabecera__marca">Mi iglesia</span>
          <span class="cabecera__sede">${esc(resumen?.persona?.sede ?? '')}</span>
          <div class="cabecera__derecha"><button class="boton boton--suave" id="b-salir">Salir</button></div>
        </header>
        <main class="contenido" id="contenido" tabindex="-1">
          <div id="avisos" aria-live="polite"></div>
          <div id="vista"></div>
        </main>
        <footer class="pie">Casa Sobre la Roca · sus datos se tratan según la Ley 1581 de 2012</footer>
      </div>
    </div>`;
  RAIZ.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => { location.hash = '#/' + b.dataset.ir; }));
  RAIZ.querySelector('#b-salir').addEventListener('click', async () => {
    try { await api.enviar('/api/v1/auth/salir', {}); } catch { /* la sesión igual se cierra aquí */ }
    borrarTokens(); location.hash = ''; pintarEntrar(RAIZ, arrancar);
  });
  pintarPestana();
}

async function refrescar() {
  resumen = await api.obtener('/api/v1/yo/resumen');
  pintarPestana();
}

function pintarPestana() {
  const p = pestanaActual();
  document.querySelectorAll('[data-ir]').forEach(b => b.dataset.ir === p
    ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  document.title = `${PESTANAS[p].titulo} · Mi iglesia`;
  const z = document.getElementById('vista');
  if (!z) return;
  const vista = z.cloneNode(false); z.replaceWith(vista);
  ({ inicio, datos, permisos, aportes, derechos })[p](vista);
  animarVista(vista);
  document.getElementById('contenido')?.focus({ preventScroll: true });
}

/* ── Inicio: lo suyo de un vistazo ────────────────────────────────────
   5 oct 2026 · En bento, como el Panel de la aplicación: la celda azul
   saluda y dice lo más importante de hoy; cada cuadro explica y lleva a
   su pestaña; los avisos dicen qué le falta por hacer. */
function inicio(v) {
  const r = resumen, yo = r.persona ?? {};
  const hijos = r.hijos ?? [], grupos = r.grupos ?? [], formacion = r.formacion ?? [];
  const a = r.aportes_del_anio ?? {};
  const cons = r.consentimientos ?? [];
  const otorgados = cons.filter(c => c.otorgado).length;
  const enSala = hijos.filter(h => h.en_sala_ahora);
  const frase = enSala.length
    ? `${enSala.map(h => esc(h.nombre)).join(' y ')} ${enSala.length === 1 ? 'está' : 'están'} en su sala ahora mismo.`
    : grupos.length ? `Su grupo se reúne el ${esc(grupos[0].dia ?? '')} a las ${esc(grupos[0].hora ?? '')}.`
    : 'Este es su espacio en la iglesia.';
  const pendientes = [
    !otorgados && aviso({ tono: 'atender', titulo: 'Todavía no ha elegido cómo quiere que la iglesia le contacte',
      detalle: 'Usted decide por qué canal y para qué. Puede cambiarlo cuando quiera.', accion: { t: 'Elegir', ir: 'permisos' } }),
    !grupos.length && aviso({ tono: 'atender', titulo: 'Todavía no está en un grupo',
      detalle: 'Pregunte en su sede por uno cerca de su casa.', accion: { t: 'Ver mis datos', ir: 'datos' } }),
    formacion.some(f => String(f.pago).startsWith('pend')) && aviso({ tono: 'atender', titulo: 'Tiene un pago de formación pendiente',
      detalle: 'Acérquese a Tesorería de su sede.' }),
  ];
  v.innerHTML = `
    <div class="bento">
      <section class="bento__celda bento__celda--marca c-8">
        <p class="bento__rotulo">${esc(yo.sede ?? 'Mi iglesia')}</p>
        <div>
          <h1 style="margin:0 0 .35rem">Hola, ${esc(yo.primer_nombre ?? '')}</h1>
          <p class="bento__pie">${frase}</p>
        </div>
      </section>
      <a class="bento__celda bento__celda--accion c-4" href="#/aportes" style="text-decoration:none">
        <p class="bento__rotulo">Mis aportes de ${new Date().getFullYear()}</p>
        <p class="bento__cifra">${esc(dinero(a.total))}</p>
        <p class="bento__pie">${esc(a.cantidad ?? 0)} aporte(s) confirmados por Tesorería</p>
        <span class="bento__flecha">Ver certificados →</span>
      </a>

      <section class="bento__celda c-12" aria-label="Lo que le falta">
        ${cabCelda('Lo que le falta', 'Lo que puede hacer usted mismo, sin pedírselo a nadie.')}
        ${avisos(pendientes, 'Todo al día. Gracias por mantener sus datos al día.')}
      </section>

      ${hijos.map(h => `
      <section class="bento__celda c-4" aria-label="${esc(h.nombre)}">
        <p class="bento__rotulo">${esc(h.parentesco === 'MADRE' || h.parentesco === 'PADRE' ? 'Su hijo' : 'A su cargo')}</p>
        <div><h2 class="bento__titulo" style="font-size:22px">${esc(h.nombre)}</h2>
          <p class="bento__pie">${esc(h.edad ?? '')} años</p></div>
        <div class="bento__fichas">
          <span class="cajon__der ${h.en_sala_ahora ? 'cajon__der--bien' : ''}">${h.en_sala_ahora ? '● En su sala ahora' : 'No está en sala'}</span>
          ${h.puede_retirar ? '<span class="cajon__der">Usted puede recogerlo</span>' : ''}
        </div>
      </section>`).join('')}

      <section class="bento__celda ${hijos.length ? 'c-4' : 'c-6'}" aria-label="Sus grupos">
        ${cabCelda('Sus grupos', grupos.length ? `Está en <b>${grupos.length}</b> grupo(s).` : 'Todavía no está en ningún grupo.')}
        ${grupos.map(g => `<div class="cr-aviso cr-aviso--bien">
          <span class="cr-aviso__icono" aria-hidden="true">${icono('reunion')}</span>
          <span class="cr-aviso__texto"><b>${esc(g.grupo)}</b>
            <small>${esc(g.tipo ?? '')} · ${esc(g.dia ?? 'por definir')} ${esc(g.hora ?? '')} · ${esc(g.rol ?? '')}</small></span></div>`).join('')}
      </section>

      <section class="bento__celda ${hijos.length ? 'c-4' : 'c-6'}" aria-label="Su formación">
        ${cabCelda('Su formación', formacion.length ? `Está en <b>${formacion.length}</b> curso(s).` : 'No está inscrito en ningún curso.')}
        ${formacion.map(f => `<div class="cr-aviso cr-aviso--${String(f.pago).startsWith('pend') ? 'atender' : 'bien'}">
          <span class="cr-aviso__icono" aria-hidden="true">${icono('formacion')}</span>
          <span class="cr-aviso__texto"><b>${esc(f.curso)}</b>
            <small>${esc(f.cohorte ?? '')} · ${esc(f.estado ?? '')}${f.nota != null ? ` · nota ${esc(f.nota)}` : ''} · ${esc(String(f.pago ?? '').replace('_', ' '))}</small></span></div>`).join('')}
      </section>

      <a class="bento__celda bento__celda--accion c-12" href="#/permisos" style="text-decoration:none">
        <p class="bento__rotulo">Cómo le contactamos</p>
        <p class="bento__pie">Usted autorizó <b>${otorgados}</b> de ${cons.length} combinaciones de canal y finalidad.
          Ningún mensaje sale por un canal que usted no haya autorizado.</p>
        <span class="bento__flecha">Revisar mis permisos →</span>
      </a>
    </div>`;
}

/* ── Mis datos ────────────────────────────────────────────────────── */
function datos(v) {
  const yo = resumen.persona ?? {};
  v.innerHTML = `
    <h1>Mis datos</h1>
    <p class="etiqueta">Así lo contactamos. Corregirlos es su derecho.</p>
    <div class="tarjeta" style="margin-bottom:1rem">
      <p style="margin:0"><strong>${esc(yo.nombre)}</strong>${yo.documento ? ` · ${esc(yo.documento)}` : ''}</p>
      <p class="ayuda" style="margin:.3rem 0 0">Para corregir su nombre o su documento, radique una petición en «Mis derechos»: se verifica con usted.</p>
    </div>
    <form id="f-datos" class="tarjeta" style="display:grid;gap:.75rem" novalidate>
      <div class="campo"><label for="d-email">Correo</label><input id="d-email" name="email" type="email" value="${esc(yo.email ?? '')}" autocomplete="email"></div>
      <div class="campo"><label for="d-tel">Teléfono celular</label><input id="d-tel" name="telefono" type="tel" value="${esc(yo.telefono ?? '')}" autocomplete="tel"></div>
      <div class="campo"><label for="d-dir">Dirección</label><input id="d-dir" name="direccion" value="${esc(yo.direccion ?? '')}" autocomplete="street-address"></div>
      <button class="boton" type="submit">Guardar mis datos</button>
    </form>
    <h2 style="margin-top:1.5rem">Todo lo que la iglesia tiene de usted</h2>
    <p class="ayuda" style="max-width:62ch">Descargue un archivo con sus datos, sus grupos, su asistencia por mes, sus cursos, sus aportes y la historia de sus autorizaciones.
      La consejería y los datos de menores no se descargan con un botón: se piden en «Mis derechos» y se los entrega una persona.</p>
    <button class="boton boton--suave" id="b-descargar">Descargar mis datos</button>`;
  v.querySelector('#f-datos').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target, b = f.querySelector('button');
    unaVez(b, async () => {
      try {
        const r = await api.enviar('/api/v1/yo/datos', {
          email: f.elements.email.value.trim() || undefined, telefono: f.elements.telefono.value.trim() || undefined,
          direccion: f.elements.direccion.value.trim() || undefined });
        avisar(r.mensaje, 'exito'); await refrescar();
      } catch (e) { avisar(e.message, 'error'); }
    });
  });
  v.querySelector('#b-descargar').addEventListener('click', ev => unaVez(ev.currentTarget, async () => {
    try {
      const d = await api.obtener('/api/v1/yo/mis-datos');
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'mis-datos-casaroca.json' });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      avisar('Listo. La descarga quedó registrada, como toda lectura de datos personales.', 'exito');
    } catch (e) { avisar(e.message, 'error'); }
  }));
}

/* ── Mis permisos de contacto ─────────────────────────────────────── */
function permisos(v) {
  const porFinalidad = {};
  for (const c of resumen.consentimientos ?? []) (porFinalidad[c.finalidad] ??= { ...c, canales: [] }).canales.push(c);
  v.innerHTML = `
    <h1>Mis permisos</h1>
    <p class="etiqueta">Para qué y por dónde le puede escribir la iglesia. Cambia en el acto y queda registrado.</p>
    <div class="permisos">
      ${Object.values(porFinalidad).map(f => `<section class="permiso" aria-labelledby="t-${esc(f.finalidad)}">
        <h3 id="t-${esc(f.finalidad)}">${esc(f.finalidad_nombre)}</h3>
        <p>${esc(f.descripcion ?? '')}</p>
        <div class="canales">${f.canales.map(c => `<label class="canal">
          <input type="checkbox" data-finalidad="${esc(f.finalidad)}" data-canal="${esc(c.canal)}" ${c.otorgado ? 'checked' : ''}>
          ${esc(CANAL[c.canal] ?? c.canal)}${c.desde ? `<small>desde ${esc(String(c.desde).slice(0, 10))}</small>` : ''}</label>`).join('')}</div>
      </section>`).join('')}
    </div>
    <p class="ayuda" style="margin-top:1rem;max-width:62ch">Los avisos de trámites que usted pidió (un certificado, una inscripción) y los de emergencia
      no dependen de estas casillas. Si no quiere recibirlos, radique una petición en «Mis derechos».</p>`;
  v.addEventListener('change', async ev => {
    const c = ev.target.closest('input[data-finalidad]');
    if (!c) return;
    c.disabled = true;
    try {
      const r = await api.enviar('/api/v1/yo/consentimientos', { canal: c.dataset.canal, finalidad: c.dataset.finalidad, otorgar: c.checked });
      avisar(r.mensaje, 'exito');
      resumen = await api.obtener('/api/v1/yo/resumen');
    } catch (e) { c.checked = !c.checked; avisar(e.message, 'error'); }
    finally { c.disabled = false; }
  });
}

/* ── Mis aportes ──────────────────────────────────────────────────── */
function aportes(v) {
  const a = resumen.aportes_del_anio ?? {};
  v.innerHTML = `
    <h1>Mis aportes</h1>
    <p class="etiqueta">Lo confirmado por Tesorería este año, y sus certificados para la declaración de renta.</p>
    <div class="bento"><section class="bento__celda bento__celda--marca c-6">
      <p class="bento__rotulo">Confirmado en ${new Date().getFullYear()}</p>
      <div><p class="bento__cifra">${esc(dinero(a.total))}</p>
        <p class="bento__pie">${esc(a.cantidad ?? 0)} aporte(s) confirmados por Tesorería</p></div></section></div>
    <h2>Certificados de donación</h2>
    ${(resumen.certificados ?? []).length ? `<div class="tarjeta" style="padding:0;overflow:hidden"><table class="tabla">
      <thead><tr><th>Certificado</th><th>Período</th><th>Total</th></tr></thead><tbody>
      ${resumen.certificados.map(c => `<tr><td data-th="Certificado"><button type="button" class="enlace-fila" data-cert="${esc(c.id)}">${esc(c.numero)}</button></td>
        <td data-th="Período">${esc(c.desde)} a ${esc(c.hasta)}</td><td data-th="Total">${esc(dinero(c.total, c.moneda))}</td></tr>`).join('')}
      </tbody></table></div>`
      : '<p class="ayuda">Todavía no tiene certificados. Tesorería los expide al cierre del año o cuando usted lo pide.</p>'}`;
  v.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-cert]');
    if (!b) return;
    const ventana = window.open('', '_blank');
    try {
      const html = await api.obtenerTexto(`/api/v1/yo/certificados/${b.dataset.cert}/documento`);
      if (ventana) { ventana.document.open(); ventana.document.write(html); ventana.document.close(); }
    } catch (e) { ventana?.close(); avisar(e.message, 'error'); }
  });
}

/* ── Mis derechos (Habeas Data) ───────────────────────────────────── */
function derechos(v) {
  v.innerHTML = `
    <h1>Mis derechos</h1>
    <p class="etiqueta">Conocer, corregir, revocar o pedir que borremos sus datos. La ley nos da un plazo y el sistema lo cuenta.</p>
    <form id="f-pet" class="tarjeta" style="display:grid;gap:.75rem;margin-bottom:1.5rem" novalidate>
      <div class="campo"><label for="p-tipo">Qué necesita</label><select id="p-tipo" name="tipo" required>
        ${Object.entries(TIPO_PETICION).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></div>
      <div class="campo"><label for="p-det">Cuéntenos con sus palabras</label>
        <textarea id="p-det" name="detalle" rows="4" minlength="15" required></textarea>
        <span class="ayuda">Le respondemos al correo o al teléfono de «Mis datos».</span></div>
      <button class="boton" type="submit">Radicar mi petición</button>
    </form>
    <h2>Sus peticiones</h2>
    ${(resumen.peticiones ?? []).length ? `<div class="tarjeta" style="padding:0;overflow:hidden"><table class="tabla">
      <thead><tr><th>Radicado</th><th>Estado</th><th>Plazo</th></tr></thead><tbody>
      ${resumen.peticiones.map(p => `<tr><td data-th="Radicado"><strong>${esc(p.radicado)}</strong><br><span class="ayuda">${esc(TIPO_PETICION[p.tipo] ?? p.tipo)}</span>
        ${p.respuesta ? `<p class="texto-largo" style="margin:.4rem 0 0">${esc(p.respuesta)}</p>` : ''}</td>
        <td data-th="Estado">${esc(String(p.estado).replace('_', ' '))}</td><td data-th="Plazo">${esc(p.vence ?? '·')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="ayuda">No ha radicado ninguna petición.</p>'}`;
  v.querySelector('#f-pet').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target, b = f.querySelector('button');
    const detalle = f.elements.detalle.value.trim();
    if (detalle.length < 15) return avisar('Cuéntenos un poco más (al menos 15 caracteres).', 'error');
    if (f.elements.tipo.value === 'supresion' && !confirm('Pedir que borremos sus datos es una decisión seria: se verifica con usted antes de ejecutarla. ¿Radicarla?')) return;
    unaVez(b, async () => {
      try {
        const r = await api.enviar('/api/v1/yo/peticiones', { tipo: f.elements.tipo.value, detalle });
        avisar(r.mensaje, 'exito'); await refrescar();
      } catch (e) { avisar(e.message, 'error'); }
    });
  });
}

window.addEventListener('hashchange', () => { if (resumen) pintarPestana(); });
arrancar();
