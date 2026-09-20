import { api } from '../api.js';
import { tabla, chip, sedes, esc, vacio, avisar } from './comun.js';
import { cargando, error, unaVez } from '../ui.js';

/**
 * Administración de la solución.
 *
 * ⛔ 20 de septiembre de 2026. Hasta hoy esta pantalla NO EXISTÍA, y eso
 * quería decir algo muy concreto: el primer Pastor Director General se
 * creaba con un comando en la terminal, y los roles de las 36 sedes se
 * otorgaban por SQL o con `curl`. Una sola persona, con acceso a un
 * portátil, era la única que podía dar de alta a alguien.
 *
 * Cinco pestañas, y cada una responde a una pregunta que alguien hace de
 * verdad: ¿quién puede entrar? ¿qué puede hacer? ¿qué tiene encendido esta
 * sede? ¿cómo está armada la red? ¿quién hizo y quién miró qué?
 */

const PESTANAS = [
  { id: 'iglesias',  titulo: 'Iglesias' },
  { id: 'equipos',   titulo: 'Equipos' },
  { id: 'cuentas',   titulo: 'Cuentas' },
  { id: 'permisos',  titulo: 'Permisos' },
  { id: 'modulos',   titulo: 'Módulos por sede' },
  { id: 'organigrama', titulo: 'Organigrama' },
  { id: 'vigilancia', titulo: 'Vigilancia' },
];

export function pintarAdministracion(c) {
  let activa = 'iglesias';

  c.innerHTML = `
    <h1>Administración</h1>
    <p class="etiqueta">Quién entra, qué puede hacer y qué queda registrado.</p>
    <div role="tablist" aria-label="Secciones de administración"
         style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.75rem 0">
      ${PESTANAS.map(p => `
        <button class="boton boton--suave" role="tab" data-pest="${p.id}"
                ${p.id === activa ? 'aria-current="page"' : ''}>${esc(p.titulo)}</button>`).join('')}
    </div>
    <div id="avisos-adm"></div>
    <div id="panel-adm">${cargando(3)}</div>`;

  const panel = c.querySelector('#panel-adm');
  const zonaAviso = c.querySelector('#avisos-adm');

  async function abrir(cual) {
    activa = cual;
    c.querySelectorAll('[data-pest]').forEach(b => {
      if (b.dataset.pest === cual) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    panel.innerHTML = cargando(3);
    zonaAviso.innerHTML = '';
    try {
      await ({ iglesias, equipos, cuentas, permisos, modulos, organigrama, vigilancia })[cual](panel, zonaAviso, abrir);
    } catch (e) {
      panel.innerHTML = error(e.message, e.peticionId);
      panel.querySelectorAll('[data-reintentar]').forEach(b => b.addEventListener('click', () => abrir(cual)));
    }
  }

  c.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pest]');
    if (b) abrir(b.dataset.pest);
  });

  abrir('iglesias');
}

const aviso = (z, t) => { z.innerHTML = t ? `<div class="aviso aviso--aviso" role="status">${esc(t)}</div>` : ''; };

/* ── 1 · Iglesias: desplegar una sede con su plantilla ────────────── */
async function iglesias(panel, zona, recargar) {
  const [pl, sed] = await Promise.all([
    api.obtener('/api/v1/administracion/plantillas'),
    sedes(),
  ]);
  aviso(zona, pl.aviso);
  panel.innerHTML = `
    <details class="tarjeta" style="margin-bottom:1rem">
      <summary style="cursor:pointer;font-weight:600">+ Desplegar una iglesia</summary>
      <p class="ayuda" style="margin:.75rem 0">
        Una sola operación crea la sede, le aplica los módulos de su plantilla,
        deja apagados los de compuerta legal y le asigna su pastor.
      </p>
      <form id="f-iglesia" style="display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="campo"><label for="ig-codigo">Código</label>
          <input id="ig-codigo" name="codigo" required placeholder="BOG-SUR"></div>
        <div class="campo"><label for="ig-nombre">Nombre</label>
          <input id="ig-nombre" name="nombre" required placeholder="Bogotá Sur"></div>
        <div class="campo"><label for="ig-tipo">Tipo</label>
          <select id="ig-tipo" name="tipo" required>
            <option value="plantacion">Plantación</option>
            <option value="filial_nacional">Filial nacional</option>
            <option value="filial_internacional">Filial internacional</option>
          </select></div>
        <div class="campo"><label for="ig-pais">País</label>
          <input id="ig-pais" name="pais" required maxlength="2" value="CO" style="text-transform:uppercase"></div>
        <div class="campo"><label for="ig-ciudad">Ciudad</label>
          <input id="ig-ciudad" name="ciudad" required></div>
        <div class="campo"><label for="ig-plantilla">Plantilla</label>
          <select id="ig-plantilla" name="plantilla" required>
            ${pl.plantillas.filter(p => p.codigo !== 'MAESTRA')
               .map(p => `<option value="${esc(p.codigo)}">${esc(p.nombre)} · ${p.modulos} módulos</option>`).join('')}
          </select></div>
        <div class="campo" style="grid-column:1/-1"><label for="ig-pastor">Pastor congregacional (identificador)</label>
          <input id="ig-pastor" name="pastorId" required>
          <span class="ayuda">Una sede sin pastor no se opera sola: la base lo exige.</span></div>
        <div style="grid-column:1/-1"><button class="boton" type="submit">Desplegar</button></div>
      </form>
    </details>

    <h2>Plantillas de la red</h2>
    ${tabla(pl.plantillas, [
      { titulo: 'Plantilla', pintar: p => `<strong>${esc(p.nombre)}</strong><br><span class="ayuda">${esc(p.descripcion ?? '')}</span>` },
      { titulo: 'Para', pintar: p => chip(p.tipo_sede) },
      { titulo: 'Módulos', pintar: p => `${p.modulos}${p.con_compuerta_legal
          ? ` <span class="ayuda">(${p.con_compuerta_legal} nacen apagados)</span>` : ''}` },
    ])}

    <h2 style="margin-top:2rem">Iglesias de la red</h2>
    ${sed.length ? tabla(sed.map(x => ({ texto: x.texto, valor: x.valor })), [
      { titulo: 'Sede', pintar: x => `<strong>${esc(x.texto)}</strong>` },
      { titulo: '', pintar: x => `<button class="boton boton--suave" data-ver-modulos="${esc(x.valor)}">Ver sus módulos</button>` },
    ]) : vacio('⛪', 'Ninguna sede', 'Despliegue la primera arriba.')}`;

  panel.querySelector('#f-iglesia').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target;
    unaVez(f.querySelector('button[type=submit]'), async () => {
      try {
        const d = {};
        for (const k of ['codigo','nombre','tipo','pais','ciudad','plantilla','pastorId'])
          d[k] = f.elements[k].value.trim();
        d.pais = d.pais.toUpperCase();
        const r = await api.enviar('/api/v1/administracion/iglesias', d);
        avisar(r.mensaje, 'exito');
        f.reset();
        await recargar('iglesias');
      } catch (e) { avisar(e.message, 'error'); }
    });
  });

  panel.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ver-modulos]');
    if (b) recargar('modulos');
  });
}

/* ── 2 · Equipos de la central ────────────────────────────────────── */
async function equipos(panel, zona, recargar) {
  const d = await api.obtener('/api/v1/administracion/unidades');
  aviso(zona, d.aviso);
  panel.innerHTML = `
    <details class="tarjeta" style="margin-bottom:1rem">
      <summary style="cursor:pointer;font-weight:600">+ Crear un equipo</summary>
      <p class="ayuda" style="margin:.75rem 0">
        Contabilidad, Tesorería, Pastoral… Lo que se le otorgue al equipo lo hereda
        cada integrante mientras esté dentro, y se le cae al salir.
      </p>
      <form id="f-equipo" style="display:grid;gap:.75rem">
        <div class="campo"><label for="eq-codigo">Código</label>
          <input id="eq-codigo" name="codigo" required placeholder="TESORERIA"></div>
        <div class="campo"><label for="eq-nombre">Nombre</label>
          <input id="eq-nombre" name="nombre" required placeholder="Tesorería de la red"></div>
        <div class="campo"><label for="eq-clase">Clase</label>
          <select id="eq-clase" name="clase" required>
            <option value="equipo">Equipo</option>
            <option value="direccion">Dirección</option>
            <option value="region">Región</option>
          </select></div>
        <div class="campo"><label for="eq-proposito">Propósito</label>
          <textarea id="eq-proposito" name="proposito" rows="2" required minlength="15"
            placeholder="Administra diezmos, ofrendas y certificados de toda la red"></textarea>
          <span class="ayuda">Obligatorio: un equipo sin propósito escrito es un equipo
            que nadie sabe por qué tiene los permisos que tiene.</span></div>
        <button class="boton" type="submit">Crear</button>
      </form>
    </details>

    ${tabla(d.unidades, [
      { titulo: 'Unidad', pintar: u => `<strong>${esc(u.nombre)}</strong><br>
          <span class="ayuda">${esc(u.proposito ?? '')}</span>` },
      { titulo: 'Clase', pintar: u => chip(u.clase) },
      { titulo: 'Integrantes', campo: 'integrantes' },
      { titulo: 'Roles', pintar: u => Number(u.roles) === 0 && u.clase === 'equipo'
          ? chip('sin rol', 'distintivo--n4') : String(u.roles) },
      { titulo: '', pintar: u => `<button class="boton boton--suave" data-equipo="${esc(u.id)}">Abrir</button>` },
    ])}
    <div id="ficha-equipo" style="margin-top:1.5rem"></div>`;

  panel.querySelector('#f-equipo').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target;
    unaVez(f.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.enviar('/api/v1/administracion/unidades', {
          codigo: f.elements.codigo.value.trim(),
          nombre: f.elements.nombre.value.trim(),
          clase: f.elements.clase.value,
          proposito: f.elements.proposito.value.trim(),
        });
        avisar(r.mensaje, 'exito');
        f.reset();
        await recargar('equipos');
      } catch (e) { avisar(e.message, 'error'); }
    });
  });

  panel.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-equipo]');
    if (!b) return;
    const z = panel.querySelector('#ficha-equipo');
    z.innerHTML = cargando(2);
    try {
      const u = await api.obtener(`/api/v1/administracion/unidades/${b.dataset.equipo}`);
      z.innerHTML = `
        <div class="tarjeta">
          <h2 style="margin:0 0 .3rem">${esc(u.unidad.nombre)}</h2>
          <p class="etiqueta">${esc(u.unidad.clase)} · ${esc(u.unidad.codigo)}</p>
          <p>${esc(u.unidad.proposito ?? '')}</p>
          ${u.aviso ? `<div class="aviso aviso--error" role="alert">${esc(u.aviso)}</div>` : ''}
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
            <button class="boton boton--suave" data-rol-eq="${esc(u.unidad.id)}">Otorgar un rol</button>
            <button class="boton boton--suave" data-miembro-eq="${esc(u.unidad.id)}">Meter a alguien</button>
          </div>
        </div>

        <h3 style="margin-top:1.5rem">Roles del equipo</h3>
        ${u.roles.length ? tabla(u.roles, [
          { titulo: 'Rol', pintar: r => `<strong>${esc(r.rol)}</strong>` },
          { titulo: 'Alcance', pintar: r => `${esc(r.alcance_tipo)} · N${esc(String(r.nivel_max))}` },
          { titulo: 'Acta', pintar: r => r.acta_referencia ? `<code>${esc(r.acta_referencia)}</code>` : '—' },
          { titulo: '', pintar: r => `<button class="boton boton--suave" data-revocar-eq="${esc(r.id)}">Revocar</button>` },
        ]) : '<p class="ayuda">Ninguno. El equipo existe pero no puede hacer nada.</p>'}

        <h3 style="margin-top:1.5rem">Integrantes</h3>
        ${u.miembros.lista.length ? tabla(u.miembros.lista, [
          { titulo: 'Persona', pintar: m => `<strong>${esc(m.nombre_completo)}</strong>` },
          { titulo: 'Rol en el equipo', pintar: m => chip(m.rol_en_unidad) },
          { titulo: 'Desde', campo: 'desde' },
          { titulo: 'Estado', pintar: m => m.hasta
              ? `<span class="ayuda">salió ${esc(m.hasta)}</span>` : chip('activo') },
          { titulo: '', pintar: m => m.hasta ? ''
              : `<button class="boton boton--suave" data-sacar-eq="${esc(u.unidad.id)}|${esc(m.persona_id)}">Sacar</button>` },
        ]) : '<p class="ayuda">Nadie todavía.</p>'}

        <h3 style="margin-top:1.5rem">Sedes que alcanza</h3>
        ${u.alcanza.length
          ? `<p>${u.alcanza.map(s => chip(s.codigo)).join(' ')}</p>`
          : '<p class="ayuda">Ninguna sede por esta vía.</p>'}`;
      z.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { z.innerHTML = error(e.message, e.peticionId); }
  });

  panel.addEventListener('click', async ev => {
    const rol = ev.target.closest('[data-rol-eq]');
    const mie = ev.target.closest('[data-miembro-eq]');
    const rev = ev.target.closest('[data-revocar-eq]');
    const sac = ev.target.closest('[data-sacar-eq]');
    try {
      if (rol) {
        const r = prompt('Código del rol (por ejemplo TESORERIA, CONTABILIDAD):');
        if (!r) return;
        const al = prompt('Alcance: organizacion, sede, segmento, grupo, ministerio o unidad', 'organizacion');
        if (!al) return;
        const nv = prompt('Nivel máximo (1 a 4):', '3');
        const acta = prompt('Referencia del acta que lo autoriza:');
        if (!acta || acta.trim().length < 3) return avisar('Un permiso de red sin acta no se puede explicar en una auditoría.', 'error');
        const d = { rol: r.trim(), alcanceTipo: al.trim(), nivelMax: Number(nv), acta: acta.trim() };
        if (d.alcanceTipo !== 'organizacion') {
          const ai = prompt('Identificador del alcance (la sede, el ministerio…):');
          if (ai) d.alcanceId = ai.trim();
        }
        const x = await api.enviar(`/api/v1/administracion/unidades/${rol.dataset.rolEq}/roles`, d);
        avisar(x.mensaje, 'exito');
      } else if (mie) {
        const p = prompt('Identificador de la persona:');
        if (!p) return;
        const x = await api.enviar(`/api/v1/administracion/unidades/${mie.dataset.miembroEq}/miembros`,
          { personaId: p.trim() });
        avisar(x.mensaje, 'exito');
      } else if (rev) {
        const m = prompt('¿Por qué se revoca? (lo pierden todos los integrantes)');
        if (!m || m.trim().length < 5) return avisar('Hace falta un motivo.', 'error');
        const x = await api.enviar(`/api/v1/administracion/unidades/roles/${rev.dataset.revocarEq}/revocar`,
          { motivo: m.trim() });
        avisar(x.mensaje, 'exito');
      } else if (sac) {
        const [u, p] = sac.dataset.sacarEq.split('|');
        const m = prompt('¿Por qué sale del equipo?');
        if (!m || m.trim().length < 5) return avisar('Hace falta un motivo.', 'error');
        const x = await api.enviar(`/api/v1/administracion/unidades/${u}/miembros/${p}/salir`, { motivo: m.trim() });
        avisar(x.mensaje, 'exito');
      } else return;
      await recargar('equipos');
    } catch (e) { avisar(e.message, 'error'); }
  });
}

/* ── 3 · Cuentas ──────────────────────────────────────────────────── */
async function cuentas(panel, zona, recargar) {
  const d = await api.obtener('/api/v1/administracion/cuentas?limite=200');
  aviso(zona, d.aviso);
  panel.innerHTML = `
    <details class="tarjeta" style="margin-bottom:1rem">
      <summary style="cursor:pointer;font-weight:600">+ Crear una cuenta</summary>
      <form id="f-cuenta" style="margin-top:1rem;display:grid;gap:.75rem">
        <div class="campo">
          <label for="cu-persona">Identificador de la persona</label>
          <input id="cu-persona" name="personaId" required>
          <span class="ayuda">Búsquela en Personas y pegue aquí su identificador.</span>
        </div>
        <div class="campo">
          <label for="cu-usuario">Usuario (correo)</label>
          <input id="cu-usuario" name="usuario" type="email" required>
        </div>
        <button class="boton" type="submit">Crear</button>
        <p class="ayuda">El sistema genera una contraseña provisional y la muestra
           UNA vez. Entréguela en persona; la aplicación obligará a cambiarla al entrar.</p>
      </form>
    </details>

    <form id="f-buscar-cuenta" role="search" style="display:flex;gap:.5rem;margin-bottom:1rem">
      <label class="sr-solo" for="qc">Buscar cuenta</label>
      <input id="qc" type="search" placeholder="Nombre o usuario" style="flex:1">
      <button class="boton boton--suave" type="submit">Buscar</button>
    </form>

    ${d.cuentas.length ? tabla(d.cuentas, [
      { titulo: 'Persona', pintar: x => `<strong>${esc(x.persona)}</strong><br>
          <span class="ayuda">${esc(x.usuario)}</span>` },
      { titulo: 'Sede', pintar: x => esc(x.sede ?? '—') },
      { titulo: 'Estado', pintar: x => `
          ${chip(x.estado, x.estado === 'activa' ? '' : 'distintivo--aviso')}
          ${x.bloqueada ? chip('bloqueada', 'distintivo--n4') : ''}
          ${x.debe_cambiar_clave ? chip('clave provisional', 'distintivo--aviso') : ''}` },
      { titulo: 'Segundo factor', pintar: x => !x.exige_segundo_factor ? '<span class="ayuda">no lo exige</span>'
          : x.segundo_factor_activo ? chip('activo') : chip('SIN activar', 'distintivo--n4') },
      { titulo: 'Último ingreso', pintar: x => x.ultimo_ingreso
          ? esc(new Date(x.ultimo_ingreso).toLocaleDateString('es-CO')) : '<span class="ayuda">nunca</span>' },
      { titulo: 'Roles', pintar: x => x.roles ? esc(x.roles) : '<span class="ayuda">ninguno</span>' },
      { titulo: '', pintar: x => `
          <button class="boton boton--suave" data-clave="${esc(x.cuenta_id)}">Clave</button>
          ${x.bloqueada ? `<button class="boton boton--suave" data-desbloq="${esc(x.cuenta_id)}">Desbloquear</button>` : ''}
          <button class="boton boton--suave" data-mfa="${esc(x.cuenta_id)}">2FA</button>` },
    ]) : vacio('🔑', 'Ninguna cuenta a su alcance',
               'Cree la primera con el formulario de arriba.')}`;

  panel.querySelector('#f-cuenta').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target;
    unaVez(f.querySelector('button'), async () => {
      try {
        const r = await api.enviar('/api/v1/administracion/cuentas', {
          personaId: f.elements.personaId.value.trim(),
          usuario: f.elements.usuario.value.trim(),
        });
        mostrarClave(panel, r.clave_provisional, r.mensaje);
        f.reset();
        await recargar('cuentas');
      } catch (e) { avisar(e.message, 'error'); }
    });
  });

  panel.querySelector('#f-buscar-cuenta').addEventListener('submit', async ev => {
    ev.preventDefault();
    const q = panel.querySelector('#qc').value.trim();
    try {
      const r = await api.obtener('/api/v1/administracion/cuentas?limite=200&q=' + encodeURIComponent(q));
      avisar(`${r.total_filas} cuenta(s).`, 'info');
      panel.querySelector('table')?.closest('.tarjeta')?.replaceWith(
        document.createRange().createContextualFragment(tabla(r.cuentas, [
          { titulo: 'Persona', pintar: x => `<strong>${esc(x.persona)}</strong><br><span class="ayuda">${esc(x.usuario)}</span>` },
          { titulo: 'Sede', pintar: x => esc(x.sede ?? '—') },
          { titulo: 'Estado', pintar: x => chip(x.estado) },
          { titulo: 'Roles', pintar: x => x.roles ? esc(x.roles) : '—' },
        ])));
    } catch (e) { avisar(e.message, 'error'); }
  });

  panel.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-clave],[data-desbloq],[data-mfa]');
    if (!b) return;
    try {
      if (b.dataset.clave) {
        if (!confirm('Se genera una contraseña provisional NUEVA y se cierran todas sus sesiones. ¿Seguir?')) return;
        const r = await api.enviar(`/api/v1/administracion/cuentas/${b.dataset.clave}/reiniciar-clave`, {});
        mostrarClave(panel, r.clave_provisional, r.mensaje);
      } else if (b.dataset.desbloq) {
        const r = await api.enviar(`/api/v1/administracion/cuentas/${b.dataset.desbloq}/desbloquear`, {});
        avisar(r.mensaje, 'exito');
      } else if (b.dataset.mfa) {
        if (!confirm('Se borra su segundo factor y se cierran sus sesiones. Lo volverá a configurar al entrar. ¿Seguir?')) return;
        const r = await api.enviar(`/api/v1/administracion/cuentas/${b.dataset.mfa}/reiniciar-segundo-factor`, {});
        avisar(r.mensaje, 'exito');
      }
      await recargar('cuentas');
    } catch (e) { avisar(e.message, 'error'); }
  });
}

/** La contraseña provisional se muestra UNA vez, grande y con copiar. */
function mostrarClave(panel, clave, mensaje) {
  const d = document.createElement('div');
  d.className = 'tarjeta';
  d.style.cssText = 'margin-bottom:1rem;border:2px solid var(--cr-azul-700)';
  d.innerHTML = `
    <p class="etiqueta">Contraseña provisional · se muestra una sola vez</p>
    <p style="font-family:var(--cr-fuente-mono);font-size:1.3rem;letter-spacing:.04em;
              background:var(--cr-superficie-2);padding:.8rem;border-radius:var(--cr-radio-md);
              word-break:break-word;margin:.5rem 0">${esc(clave)}</p>
    <p class="ayuda">${esc(mensaje ?? '')}</p>
    <button class="boton boton--suave" data-copiar>Copiar</button>
    <button class="boton boton--suave" data-ocultar>Ya la entregué</button>`;
  panel.prepend(d);
  d.querySelector('[data-copiar]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(clave); avisar('Copiada.', 'exito'); }
    catch { avisar('Su navegador no dejó copiar: selecciónela a mano.', 'aviso'); }
  });
  d.querySelector('[data-ocultar]').addEventListener('click', () => d.remove());
}

/* ── 2 · Permisos de una persona ──────────────────────────────────── */
async function permisos(panel, zona, recargar) {
  const [roles, matriz] = await Promise.all([
    api.obtener('/api/v1/identidad/roles'),
    api.obtener('/api/v1/identidad/matriz').catch(() => null),
  ]);
  const lista = Array.isArray(roles) ? roles : (roles?.roles ?? []);
  panel.innerHTML = `
    <form id="f-persona" style="display:flex;gap:.5rem;margin-bottom:1rem">
      <label class="sr-solo" for="qp">Identificador de la persona</label>
      <input id="qp" placeholder="Pegue el identificador de la persona" style="flex:1">
      <button class="boton" type="submit">Ver permisos</button>
    </form>
    <div id="detalle-permiso">${vacio('🔐', 'Elija a una persona',
      'Búsquela en Personas, copie su identificador y péguelo arriba.')}</div>

    <h2 style="margin-top:2rem">Roles de la red</h2>
    ${lista.length ? tabla(lista, [
      { titulo: 'Rol', pintar: r => `<strong>${esc(r.nombre ?? r.codigo)}</strong>` },
      { titulo: 'Código', pintar: r => `<code>${esc(r.codigo)}</code>` },
      { titulo: 'Activo', pintar: r => r.activo === false ? chip('no', 'distintivo--aviso') : chip('sí') },
    ]) : ''}
    ${matriz ? `<p class="etiqueta" style="margin-top:1rem">
      La matriz de permisos tiene ${esc(String((matriz.filas ?? matriz).length ?? '—'))} reglas declaradas.</p>` : ''}`;

  panel.querySelector('#f-persona').addEventListener('submit', async ev => {
    ev.preventDefault();
    const id = panel.querySelector('#qp').value.trim();
    const z = panel.querySelector('#detalle-permiso');
    if (!id) return;
    z.innerHTML = cargando(2);
    try {
      const [asig, efectivo] = await Promise.all([
        api.obtener(`/api/v1/identidad/personas/${id}/asignaciones`),
        api.obtener(`/api/v1/identidad/personas/${id}/efectivo`).catch(() => null),
      ]);
      const filas = Array.isArray(asig) ? asig : (asig?.asignaciones ?? []);
      z.innerHTML = `
        <h2>Sus roles</h2>
        ${filas.length ? tabla(filas, [
          { titulo: 'Rol', pintar: a => `<strong>${esc(a.rol)}</strong>` },
          { titulo: 'Alcance', pintar: a => `${esc(a.alcance_tipo)}${a.alcance_nombre ? ' · ' + esc(a.alcance_nombre) : ''}` },
          { titulo: 'Nivel', pintar: a => 'N' + esc(String(a.nivel_max)) },
          { titulo: 'Vigencia', pintar: a => `${esc(a.vigente_desde ?? '')}${a.vigente_hasta ? ' → ' + esc(a.vigente_hasta) : ''}` },
          { titulo: '', pintar: a => `<button class="boton boton--suave" data-revocar="${esc(a.id)}">Revocar</button>` },
        ]) : vacio('🚫', 'Sin roles vigentes', 'Esta persona no puede hacer nada todavía.')}
        ${efectivo ? `<h2 style="margin-top:2rem">Lo que puede hacer de verdad</h2>
          ${tabla((efectivo.permisos ?? efectivo ?? []).slice(0, 200), [
            { titulo: 'Módulo', campo: 'modulo' },
            { titulo: 'Acción', campo: 'accion' },
            { titulo: 'Nivel', pintar: p => 'N' + esc(String(p.nivel_max ?? p.nivel ?? '')) },
          ])}` : ''}`;
      z.querySelectorAll('[data-revocar]').forEach(b => b.addEventListener('click', async () => {
        const motivo = prompt('¿Por qué se revoca? (queda escrito)');
        if (!motivo || motivo.trim().length < 5) return avisar('Hace falta un motivo.', 'error');
        try {
          await api.borrar(`/api/v1/identidad/asignaciones/${b.dataset.revocar}`);
          avisar('Rol revocado.', 'exito');
          panel.querySelector('#f-persona').requestSubmit();
        } catch (e) { avisar(e.message, 'error'); }
      }));
    } catch (e) { z.innerHTML = error(e.message, e.peticionId); }
  });
}

/* ── 3 · Módulos por sede ─────────────────────────────────────────── */
async function modulos(panel, zona) {
  const op = await sedes();
  panel.innerHTML = `
    <div class="campo" style="max-width:420px">
      <label for="sel-sede">Sede</label>
      <select id="sel-sede">${op.map(s => `<option value="${esc(s.valor)}">${esc(s.texto)}</option>`).join('')}</select>
    </div>
    <div id="lista-modulos" style="margin-top:1rem">${cargando(3)}</div>`;

  const sel = panel.querySelector('#sel-sede');
  const z = panel.querySelector('#lista-modulos');

  async function cargar() {
    z.innerHTML = cargando(3);
    try {
      const d = await api.obtener(`/api/v1/administracion/sedes/${sel.value}/modulos`);
      aviso(zona, d.aviso);
      z.innerHTML = tabla(d.modulos, [
        { titulo: 'Módulo', pintar: m => `<strong>${esc(m.nombre)}</strong>
            ${m.es_nucleo ? chip('núcleo') : ''}
            ${m.exige_compuerta_legal ? chip('compuerta legal', 'distintivo--n4') : ''}` },
        { titulo: 'Nivel', pintar: m => 'N' + esc(String(m.nivel_dato)) },
        { titulo: 'Depende de', pintar: m => m.depende_de ? `<code>${esc(m.depende_de)}</code>` : '—' },
        { titulo: 'Estado', pintar: m => m.activo ? chip('encendido') : chip('apagado', 'distintivo--aviso') },
        { titulo: 'Evidencia legal', pintar: m => m.evidencia_legal_ref
            ? `<code>${esc(m.evidencia_legal_ref)}</code>`
            : (m.exige_compuerta_legal && m.activo ? chip('FALTA', 'distintivo--n4') : '—') },
        { titulo: '', pintar: m => m.es_nucleo && m.activo ? '<span class="ayuda">no se apaga</span>'
            : `<button class="boton boton--suave" data-modulo="${esc(m.codigo)}"
                 data-activo="${m.activo ? 'si' : 'no'}"
                 data-legal="${m.exige_compuerta_legal ? 'si' : 'no'}">
                 ${m.activo ? 'Apagar' : 'Encender'}</button>` },
      ]);
    } catch (e) {
      z.innerHTML = error(e.message, e.peticionId);
      z.querySelectorAll('[data-reintentar]').forEach(b => b.addEventListener('click', cargar));
    }
  }

  sel.addEventListener('change', cargar);
  panel.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-modulo]');
    if (!b) return;
    const encender = b.dataset.activo === 'no';
    let evidencia = null;
    if (encender && b.dataset.legal === 'si') {
      evidencia = prompt('Este módulo exige compuerta legal. Escriba la referencia del instrumento jurídico (acta, política, registro):');
      if (!evidencia || evidencia.trim().length < 3) return avisar('Sin la referencia legal no se enciende.', 'error');
    }
    try {
      const r = await api.enviar(`/api/v1/administracion/sedes/${sel.value}/modulos`, {
        modulo: b.dataset.modulo, activo: encender, evidencia: evidencia?.trim(),
      });
      avisar(r.mensaje, 'exito');
      cargar();
    } catch (e) { avisar(e.message, 'error'); }
  });

  cargar();
}

/* ── 4 · Organigrama ──────────────────────────────────────────────── */
async function organigrama(panel) {
  const d = await api.obtener('/api/v1/administracion/organigrama');
  panel.innerHTML = d.unidades.length ? `
    <p class="etiqueta">La central, sus regiones, sus direcciones y sus equipos.</p>
    ${tabla(d.unidades, [
      { titulo: 'Unidad', pintar: u => `${'&nbsp;'.repeat(Math.max(0, (u.nivel ?? 0) * 4))}
          <strong>${esc(u.nombre)}</strong>` },
      { titulo: 'Clase', pintar: u => chip(u.clase) },
      { titulo: 'Código', pintar: u => `<code>${esc(u.codigo)}</code>` },
      { titulo: 'Integrantes', campo: 'integrantes' },
      { titulo: 'Sedes que alcanza', campo: 'sedes_que_alcanza' },
    ])}` : vacio('🏛', 'Sin unidades', 'La central todavía no está armada.');
}

/* ── 5 · Vigilancia ───────────────────────────────────────────────── */
async function vigilancia(panel, zona) {
  panel.innerHTML = cargando(4);
  const [ses, ale, rec, aud, lec] = await Promise.allSettled([
    api.obtener('/api/v1/administracion/sesiones'),
    api.obtener('/api/v1/administracion/alertas'),
    api.obtener('/api/v1/administracion/recertificar'),
    api.obtener('/api/v1/administracion/auditoria?limite=50'),
    api.obtener('/api/v1/administracion/lecturas?limite=50'),
  ]);
  const v = (r, k) => r.status === 'fulfilled' ? (r.value[k] ?? []) : null;
  const falla = (r) => r.status === 'rejected'
    ? `<div class="aviso aviso--error" role="alert">No se pudo cargar: ${esc(r.reason.message)}</div>` : '';

  const avisos = [ale, rec].map(r => r.status === 'fulfilled' ? r.value.aviso : null).filter(Boolean);
  aviso(zona, avisos.join(' · ') || null);

  panel.innerHTML = `
    <h2>Accesos por recertificar</h2>
    <p class="etiqueta">Un permiso que nadie revisa es un permiso que nadie quitó.</p>
    ${falla(rec)}
    ${(v(rec, 'accesos') ?? []).length ? tabla(v(rec, 'accesos').slice(0, 50), [
      { titulo: 'Persona', pintar: x => `<strong>${esc(x.persona)}</strong>` },
      { titulo: 'Rol', pintar: x => `${esc(x.rol)} · N${esc(String(x.nivel_max))}` },
      { titulo: 'Sin revisar', pintar: x => `${x.dias_sin_revisar} día(s)
          ${x.dias_sin_revisar > (x.tope_dias ?? 180) ? chip('pasado', 'distintivo--n4') : ''}` },
    ]) : (rec.status === 'fulfilled' ? '<p class="ayuda">Nada pendiente.</p>' : '')}

    <h2 style="margin-top:2rem">Sesiones abiertas ahora</h2>
    ${falla(ses)}
    ${(v(ses, 'sesiones') ?? []).length ? tabla(v(ses, 'sesiones').slice(0, 50), [
      { titulo: 'Persona', pintar: x => `<strong>${esc(x.persona)}</strong><br><span class="ayuda">${esc(x.usuario)}</span>` },
      { titulo: 'Desde', pintar: x => esc(new Date(x.emitida_en).toLocaleString('es-CO')) },
      { titulo: 'Le queda', pintar: x => esc(String(x.le_queda ?? '').split('.')[0]) },
      { titulo: 'IP', pintar: x => `<code>${esc(x.ip ?? '—')}</code>` },
    ]) : (ses.status === 'fulfilled' ? '<p class="ayuda">Nadie dentro.</p>' : '')}

    <h2 style="margin-top:2rem">Intentos fallidos</h2>
    ${falla(ale)}
    ${(v(ale, 'alertas') ?? []).length ? tabla(v(ale, 'alertas'), [
      { titulo: 'Usuario', pintar: x => esc(x.usuario) },
      { titulo: 'IP', pintar: x => `<code>${esc(x.ip ?? '—')}</code>` },
      { titulo: 'Intentos', pintar: x => chip(String(x.intentos_fallidos), 'distintivo--n4') },
    ]) : (ale.status === 'fulfilled' ? '<p class="ayuda">Ninguno.</p>' : '')}

    <h2 style="margin-top:2rem">Quién miró los datos sensibles</h2>
    <p class="etiqueta">Esta bitácora existe para que mirar por curiosidad tenga nombre y hora.</p>
    ${falla(lec)}
    ${(v(lec, 'lecturas') ?? []).length ? tabla(v(lec, 'lecturas'), [
      { titulo: 'Cuándo', pintar: x => esc(new Date(x.ocurrido_en).toLocaleString('es-CO')) },
      { titulo: 'Quién', pintar: x => esc(x.actor ?? '—') },
      { titulo: 'Qué', pintar: x => `<code>${esc(x.esquema)}.${esc(x.tabla)}</code> · N${esc(String(x.nivel))}` },
      { titulo: 'Motivo', pintar: x => esc(x.motivo ?? '') },
    ]) : (lec.status === 'fulfilled' ? '<p class="ayuda">Ninguna lectura sensible registrada.</p>' : '')}

    <h2 style="margin-top:2rem">Quién hizo qué</h2>
    ${falla(aud)}
    ${(v(aud, 'movimientos') ?? []).length ? tabla(v(aud, 'movimientos'), [
      { titulo: 'Cuándo', pintar: x => esc(new Date(x.ocurrido_en).toLocaleString('es-CO')) },
      { titulo: 'Quién', pintar: x => esc(x.actor ?? 'sistema') },
      { titulo: 'Qué', pintar: x => `<code>${esc(x.esquema)}.${esc(x.tabla)}</code>` },
      { titulo: 'Operación', pintar: x => chip({ I: 'creó', U: 'cambió', D: 'borró' }[x.operacion] ?? x.operacion) },
    ]) : (aud.status === 'fulfilled' ? '<p class="ayuda">Sin movimientos.</p>' : '')}`;
}
