/* ============================================================
   CASA ROCA · SISTEMA MASTER (Dirección General)
   El cascarón total. Recoge TODO el sistema en una sola shell y
   lo gobierna por roles y permisos.

   Tres cosas lo distinguen de las apps por rol:
   1. Desde aquí se CREA a todo el mundo: pastores, directores,
      líderes, consejeros, tesorería, maestros de RocaKids.
   2. Cada pestaña está atada a un módulo real del backend y
      declara qué nivel de dato maneja y qué roles la alcanzan.
   3. Las apps por rol no se duplican: se ABREN aquí dentro, con
      el patrón de panel anidado que ya usa el pastor.
   ============================================================ */
(function () {
  "use strict";
  const I = window.IDENTIDAD, M = window.MSTORE;
  if (!I || !M) { console.error("Falta master-identidad.js o master-store.js"); return; }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const hoy = () => new Date().toISOString().slice(0, 10);
  const $ = s => document.querySelector(s);

  /* Quien opera el master. En Fase 0 es la Dirección General. */
  let YO = { personaId:"p-dg", nombre:"Ps. Director General",
             rol:"PASTOR_DIRECTOR_GENERAL", techo:4 };

  let vista = "tablero";
  let borrador = null;   // asistente de creación de acceso

  /* ============================================================
     NAVEGACIÓN · todas las pestañas del sistema
     `mod` ata la pestaña a un módulo del backend; si está, el
     permiso se calcula de verdad y no es decorativo.
     ============================================================ */
  const NAV = [
    { sep:"Dirección" },
    { id:"tablero", ico:"🌐", lbl:"Tablero de la red" },

    { sep:"Identidad y accesos" },
    { id:"accesos",  ico:"🔑", lbl:"Personas con acceso", mod:"identidad" },
    { id:"crear",    ico:"➕", lbl:"Crear acceso",        mod:"identidad" },
    { id:"roles",    ico:"🎭", lbl:"Roles y techos",      mod:"identidad" },
    { id:"matriz",   ico:"🧮", lbl:"Matriz de permisos",  mod:"identidad" },
    { id:"efectivo", ico:"🔎", lbl:"Qué ve cada persona", mod:"identidad" },
    { id:"bitacora", ico:"📜", lbl:"Bitácora de accesos", mod:"cumplimiento" },
    { id:"contraste",ico:"⚖️", lbl:"Contraste con el equipo 100p" },

    { sep:"Organización" },
    { id:"iglesias",  ico:"⛪", lbl:"Iglesias y sedes",  mod:"organizacion" },
    { id:"modsede",   ico:"🎚️", lbl:"Módulos por sede",  mod:"organizacion" },

    { sep:"Operación" },
    { id:"personas",   ico:"👤", lbl:"Personas",        mod:"personas" },
    { id:"crm",        ico:"🗒️", lbl:"CRM Pastoral 4C", mod:"crm" },
    { id:"grupos",     ico:"🏠", lbl:"Grupos y hogares",mod:"grupos" },
    { id:"asistencia", ico:"📋", lbl:"Asistencia",      mod:"asistencia" },
    { id:"aportes",    ico:"💰", lbl:"Aportes",         mod:"aportes" },
    { id:"formacion",  ico:"🎓", lbl:"Formación",       mod:"formacion" },
    { id:"talento",    ico:"🤝", lbl:"Talento y voluntariado", mod:"talento" },
    { id:"rocakids",   ico:"🧒", lbl:"RocaKids",        mod:"rocakids" },
    { id:"consejeria", ico:"💬", lbl:"Consejería",      mod:"consejeria" },

    { sep:"Apps por rol" },
    { id:"app-central",   ico:"🏛️", lbl:"Dirección General", src:"central.html" },
    { id:"app-pastor",    ico:"⛪", lbl:"Pastor de sede",     src:"pastor.html" },
    { id:"app-director",  ico:"🗂️", lbl:"Director de ministerio", src:"director.html" },
    { id:"app-lider",     ico:"👥", lbl:"Líder de grupo",     src:"lider.html" },
    { id:"app-nicodemo",  ico:"🌱", lbl:"Nicodemo · nuevos",  src:"nicodemo.html" },
    { id:"app-rocakids",  ico:"🧒", lbl:"RocaKids · dirección", src:"rocakids-director.html" },
    { id:"app-consejeria",ico:"💬", lbl:"Consejería · dirección", src:"consejeria-director.html" },

    { sep:"Gobierno" },
    { id:"cumplimiento", ico:"🛡️", lbl:"Auditoría y cumplimiento", mod:"cumplimiento" },
  ];

  /* ---------- utilidades de presentación ---------- */
  function pastilla(n) {
    const x = I.nivel(n) || { codigo:"N?" };
    return `<span class="ms-niv ms-niv--${n}" title="${esc(x.desc || "")}">${esc(x.codigo)}</span>`;
  }
  function nombreAlcance(a) {
    const t = I.alcance(a.alcanceTipo);
    if (!t) return esc(a.alcanceTipo);
    if (!a.alcanceId) return esc(t.nombre);
    const s = I.SEDES.find(x => x.id === a.alcanceId);
    const m = I.MINISTERIOS.find(x => x.codigo === a.alcanceId);
    return esc(t.nombre) + " · " + esc((s && s.nombre) || (m && m.nombre) || a.alcanceId);
  }
  function vigencia(a) {
    if (!a.hasta) return `<span class="ms-vig ms-vig--ok">Vigente desde ${esc(a.desde)}</span>`;
    const cerrada = a.hasta < hoy();
    return `<span class="ms-vig ms-vig--${cerrada ? "fin" : "porvencer"}">${
      cerrada ? "Cerrada el " : "Vence el "}${esc(a.hasta)}</span>`;
  }
  function head(t, s) {
    return `<div class="ms-head"><h1>${esc(t)}</h1><p>${s}</p></div>`;
  }
  function fichaModulo(cod) {
    const m = I.modulo(cod); if (!m) return "";
    const roles = [...new Set(I.MATRIZ.filter(p => p.modulo === cod).map(p => p.rol))];
    const acc   = [...new Set(I.MATRIZ.filter(p => p.modulo === cod).map(p => p.accion))].sort();
    const n = I.nivel(m.nivel) || {};
    return `
    <div class="ms-modcard">
      <div class="ms-modcard__fila">
        <div><div class="ms-lbl">Nivel del dato</div><div class="ms-val">${pastilla(m.nivel)} ${esc(n.desc || "")}</div></div>
        <div><div class="ms-lbl">Controles que activa</div><div class="ms-val">${
          [n.cifrado && "cifrado", n.bitacora && "bitácora de lectura", n.enmascarado && "enmascarado"]
          .filter(Boolean).join(" · ") || "ninguno adicional"}</div></div>
      </div>
      <div class="ms-modcard__fila">
        <div><div class="ms-lbl">Roles con acceso (${roles.length})</div>
          <div class="ms-chips">${roles.map(r => {
            const rr = I.rol(r); return `<span class="ms-chip">${esc(rr ? rr.nombre : r)}</span>`; }).join("")}</div></div>
      </div>
      <div class="ms-modcard__fila">
        <div><div class="ms-lbl">Acciones definidas (${acc.length})</div>
          <div class="ms-chips">${acc.map(a => `<span class="ms-chip ms-chip--acc">${esc(a)}</span>`).join("")}</div></div>
      </div>
    </div>`;
  }

  /* ============================================================ TABLERO */
  function vTablero() {
    const asg = M.asignaciones(), per = M.personas();
    const vig = asg.filter(a => !a.hasta || a.hasta >= hoy());
    const porVencer = asg.filter(a => a.hasta && a.hasta >= hoy() && a.hasta <= new Date(Date.now()+30*864e5).toISOString().slice(0,10));
    const sinRol = per.filter(p => !vig.some(a => a.personaId === p.id));
    const n34 = vig.filter(a => a.nivelMax >= 3);
    return head("Tablero de la red", "Estado del gobierno de accesos en las 36 iglesias.") + `
    <div class="ms-kpis">
      <div class="ms-kpi"><b>${I.SEDES.length}</b><span>iglesias registradas</span></div>
      <div class="ms-kpi"><b>${per.length}</b><span>personas con ficha</span></div>
      <div class="ms-kpi"><b>${vig.length}</b><span>accesos vigentes</span></div>
      <div class="ms-kpi ${n34.length ? "ms-kpi--ojo" : ""}"><b>${n34.length}</b><span>con acceso a dato sensible (N3/N4)</span></div>
    </div>
    ${sinRol.length ? `<div class="ms-alerta ms-alerta--roja">
      <b>${sinRol.length} persona(s) sin ningún rol vigente.</b> La regla dice que sin rol vigente
      el acceso queda bloqueado: ${esc(sinRol.map(p => p.nombre).join(", "))}.</div>` : ""}
    ${porVencer.length ? `<div class="ms-alerta ms-alerta--ambar">
      <b>${porVencer.length} acceso(s) vencen en los próximos 30 días.</b> Un acceso que vence sin
      que nadie mire deja a una persona por fuera sin aviso.</div>` : ""}
    <h2 class="ms-h2">Los 12 módulos y quién los alcanza</h2>
    <table class="ms-tabla"><thead><tr>
      <th>Módulo</th><th>Dato</th><th>Roles</th><th>Acciones</th></tr></thead><tbody>
    ${I.MODULOS.map(m => {
      const roles = new Set(I.MATRIZ.filter(p => p.modulo === m.codigo).map(p => p.rol));
      const acc   = new Set(I.MATRIZ.filter(p => p.modulo === m.codigo).map(p => p.accion));
      return `<tr><td><b>${esc(m.nombre)}</b><br><code>${esc(m.codigo)}</code></td>
        <td>${pastilla(m.nivel)}</td><td>${roles.size}</td><td>${acc.size}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  /* ============================================================ ACCESOS */
  function vAccesos() {
    const per = M.personas();
    return head("Personas con acceso", "Toda asignación es una fila con vigencia. Revocar no borra: cierra la fila.") +
    per.map(p => {
      const asg = M.deLaPersona(p.id);
      const vig = asg.filter(a => !a.hasta || a.hasta >= hoy());
      const ef  = I.permisoEfectivo(asg);
      return `<div class="ms-persona">
        <div class="ms-persona__cab">
          <div><b>${esc(p.nombre)}</b><span class="ms-doc">${esc(p.documento || "sin documento")}</span></div>
          <div>${vig.length
            ? `<span class="ms-vig ms-vig--ok">${vig.length} rol(es) vigente(s) · ${ef.length} módulo(s)</span>`
            : `<span class="ms-vig ms-vig--fin">Sin acceso</span>`}</div>
        </div>
        <table class="ms-tabla ms-tabla--mini"><thead><tr>
          <th>Rol</th><th>Alcance</th><th>Techo</th><th>Vigencia</th><th>Acta</th><th></th></tr></thead><tbody>
        ${asg.length ? asg.map(a => {
          const r = I.rol(a.rol), cerrada = a.hasta && a.hasta < hoy();
          return `<tr class="${cerrada ? "ms-fila--cerrada" : ""}">
            <td>${esc(r ? r.nombre : a.rol)}</td><td>${nombreAlcance(a)}</td>
            <td>${pastilla(a.nivelMax)}</td><td>${vigencia(a)}</td>
            <td>${a.acta ? `<code>${esc(a.acta)}</code>` : `<span class="ms-falta">sin acta</span>`}</td>
            <td>${cerrada ? "" : `<button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="revocar" data-id="${esc(a.id)}">Cerrar</button>`}</td>
          </tr>`; }).join("")
          : `<tr><td colspan="6" class="ms-vacio">Nunca se le otorgó un acceso.</td></tr>`}
        </tbody></table></div>`;
    }).join("");
  }

  /* ============================================================ CREAR ACCESO */
  function vCrear() {
    const b = borrador || (borrador = { personaId:"", nuevaPersona:"", documento:"",
      rol:"", alcanceTipo:"", alcanceId:"", nivelMax:null, desde:hoy(), hasta:"", acta:"" });
    const puede = I.rolesQuePuedeCrear(YO.rol);
    const r = b.rol ? I.rol(b.rol) : null;
    const al = b.alcanceTipo ? I.alcance(b.alcanceTipo) : null;

    let opcionesAlcanceId = "";
    if (al && al.exigeId) {
      const fuente = al.fuente === "ministerios" ? I.MINISTERIOS.map(m => ({ id:m.codigo, nombre:m.nombre })) :
                     al.fuente === "sedes"       ? I.SEDES : [];
      opcionesAlcanceId = fuente.length
        ? `<label class="ms-campo"><span>¿Cuál? <b class="ms-req">obligatorio</b></span>
           <select data-campo="alcanceId"><option value="">Elegir…</option>
           ${fuente.map(f => `<option value="${esc(f.id)}" ${b.alcanceId === f.id ? "selected" : ""}>${esc(f.nombre)}</option>`).join("")}
           </select></label>`
        : `<div class="ms-alerta ms-alerta--ambar">No hay ${esc(al.fuente)} cargados todavía. Créalos antes de otorgar este alcance.</div>`;
    }

    const validacion = (b.rol && b.alcanceTipo && b.nivelMax != null)
      ? I.validarAsignacion({ personaId: b.personaId || (b.nuevaPersona ? "nueva" : ""), rol:b.rol,
          alcanceTipo:b.alcanceTipo, alcanceId:b.alcanceId || null, nivelMax:b.nivelMax,
          desde:b.desde, hasta:b.hasta || null, acta:b.acta }, YO)
      : null;

    return head("Crear acceso",
      `Usted otorga como <b>${esc(I.rol(YO.rol).nombre)}</b>, con techo ${pastilla(YO.techo)}. Nadie puede dar lo que no tiene.`) + `
    <div class="ms-asistente">

      <section class="ms-paso"><h3><i>1</i> ¿A quién?</h3>
        <div class="ms-fila2">
          <label class="ms-campo"><span>Persona que ya existe</span>
            <select data-campo="personaId"><option value="">Elegir…</option>
            ${M.personas().map(p => `<option value="${esc(p.id)}" ${b.personaId === p.id ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
            </select></label>
          <label class="ms-campo"><span>…o crear una ficha nueva</span>
            <input data-campo="nuevaPersona" value="${esc(b.nuevaPersona)}" placeholder="Nombre completo"></label>
        </div>
        <label class="ms-campo"><span>Documento (si es ficha nueva)</span>
          <input data-campo="documento" value="${esc(b.documento)}" placeholder="Cédula"></label>
      </section>

      <section class="ms-paso"><h3><i>2</i> ¿Con qué rol?</h3>
        <label class="ms-campo"><span>Rol</span>
          <select data-campo="rol"><option value="">Elegir…</option>
          ${I.ROLES.filter(x => puede.indexOf(x.codigo) >= 0).map(x =>
            `<option value="${esc(x.codigo)}" ${b.rol === x.codigo ? "selected" : ""}>${esc(x.nombre)} · techo N${x.techo}</option>`).join("")}
          </select></label>
        ${r ? `<div class="ms-nota">El techo de <b>${esc(r.nombre)}</b> es ${pastilla(r.techo)}.
          Puede alcanzar estos módulos:
          <div class="ms-chips">${I.MODULOS.filter(m => I.rolPuedeModulo(r.codigo, m.codigo).ok &&
            I.MATRIZ.some(p => p.rol === r.codigo && p.modulo === m.codigo))
            .map(m => `<span class="ms-chip">${esc(m.nombre)} ${pastilla(m.nivel)}</span>`).join("") ||
            "<i>ninguno todavía</i>"}</div>
          ${I.MODULOS.filter(m => !I.rolPuedeModulo(r.codigo, m.codigo).ok).length
            ? `<div class="ms-veda">Fuera de su techo, y no es negociable:
               ${I.MODULOS.filter(m => !I.rolPuedeModulo(r.codigo, m.codigo).ok)
                 .map(m => `<span class="ms-chip ms-chip--veda">${esc(m.nombre)} ${pastilla(m.nivel)}</span>`).join("")}</div>` : ""}
          </div>` : ""}
      </section>

      <section class="ms-paso"><h3><i>3</i> ¿Sobre qué alcance?</h3>
        <label class="ms-campo"><span>Alcance</span>
          <select data-campo="alcanceTipo"><option value="">Elegir…</option>
          ${I.ALCANCES.map(a => `<option value="${esc(a.codigo)}" ${b.alcanceTipo === a.codigo ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}
          </select></label>
        ${al ? `<div class="ms-nota">${esc(al.ayuda)}</div>` : ""}
        ${opcionesAlcanceId}
      </section>

      <section class="ms-paso"><h3><i>4</i> ¿Hasta qué nivel de dato?</h3>
        <div class="ms-niveles">
          ${I.NIVELES.map(n => {
            const bloqueado = r && n.nivel > r.techo || n.nivel > YO.techo;
            return `<button class="ms-nivbtn ${b.nivelMax === n.nivel ? "is-on" : ""} ${bloqueado ? "is-off" : ""}"
              ${bloqueado ? "disabled" : ""} data-accion="nivel" data-n="${n.nivel}">
              ${pastilla(n.nivel)}<span>${esc(n.desc)}</span>
              ${bloqueado ? `<i class="ms-porque">${n.nivel > YO.techo ? "por encima de SU techo" : "por encima del techo del rol"}</i>` : ""}
            </button>`; }).join("")}
        </div>
      </section>

      <section class="ms-paso"><h3><i>5</i> Vigencia y respaldo</h3>
        <div class="ms-fila2">
          <label class="ms-campo"><span>Desde</span><input type="date" data-campo="desde" value="${esc(b.desde)}"></label>
          <label class="ms-campo"><span>Hasta (vacío = indefinido)</span><input type="date" data-campo="hasta" value="${esc(b.hasta)}"></label>
        </div>
        ${!b.hasta ? `<div class="ms-nota ms-nota--ojo">Un acceso indefinido no se revisa nunca. Para roles de dato sensible conviene ponerle fecha.</div>` : ""}
        <label class="ms-campo"><span>Acta que lo respalda ${b.nivelMax >= 3 ? '<b class="ms-req">obligatoria para N3/N4</b>' : "(recomendada)"}</span>
          <input data-campo="acta" value="${esc(b.acta)}" placeholder="ACTA-JD-2026-000"></label>
      </section>

      ${validacion ? (validacion.ok
        ? `<div class="ms-alerta ms-alerta--verde"><b>Listo para otorgar.</b> La base aceptará esta asignación.</div>`
        : `<div class="ms-alerta ms-alerta--roja"><b>La base rechazaría esto:</b><ul>${
            validacion.fallos.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>`) : ""}

      <div class="ms-acciones">
        <button class="ms-btn ms-btn--primario" data-accion="otorgar" ${validacion && validacion.ok ? "" : "disabled"}>Otorgar acceso</button>
        <button class="ms-btn" data-accion="limpiar">Limpiar</button>
      </div>
    </div>`;
  }

  /* ============================================================ ROLES */
  function vRoles() {
    return head("Roles y techos",
      "El techo es la sensibilidad máxima que el rol alcanza. No cambia por asignación: es del rol.") + `
    <table class="ms-tabla"><thead><tr><th>Rol</th><th>Techo</th><th>Módulos que alcanza</th><th>Puede crear</th></tr></thead><tbody>
    ${I.ROLES.map(r => {
      const mods = I.MODULOS.filter(m => I.MATRIZ.some(p => p.rol === r.codigo && p.modulo === m.codigo));
      const crea = I.rolesQuePuedeCrear(r.codigo);
      return `<tr>
        <td><b>${esc(r.nombre)}</b><br><code>${esc(r.codigo)}</code></td>
        <td>${pastilla(r.techo)}</td>
        <td><div class="ms-chips">${mods.map(m => `<span class="ms-chip">${esc(m.nombre)}</span>`).join("") || "<i>ninguno</i>"}</div></td>
        <td>${crea.length ? (crea.length === I.ROLES.length ? "<b>todos</b>" : crea.length + " rol(es)") : "<i>a nadie</i>"}</td>
      </tr>`; }).join("")}</tbody></table>`;
  }

  /* ============================================================ MATRIZ */
  function vMatriz() {
    return head("Matriz de permisos",
      `Las ${I.MATRIZ.length} filas reales de <code>sistema.matriz_permisos</code>. Una casilla en rojo no es un olvido: es el techo del rol impidiéndolo.`) + `
    <div class="ms-scroll"><table class="ms-tabla ms-matriz"><thead><tr><th>Rol</th>
    ${I.MODULOS.map(m => `<th title="${esc(m.nombre)}">${esc(m.codigo.slice(0,5))}<br>${pastilla(m.nivel)}</th>`).join("")}
    </tr></thead><tbody>
    ${I.ROLES.map(r => `<tr><td class="ms-rolcel"><b>${esc(r.nombre)}</b> ${pastilla(r.techo)}</td>
      ${I.MODULOS.map(m => {
        const n = I.MATRIZ.filter(p => p.rol === r.codigo && p.modulo === m.codigo).length;
        const permitido = I.rolPuedeModulo(r.codigo, m.codigo).ok;
        if (!permitido) return `<td class="ms-cel ms-cel--veda" title="Techo N${r.techo} contra dato N${m.nivel}">—</td>`;
        return `<td class="ms-cel ${n ? "ms-cel--si" : "ms-cel--no"}">${n || ""}</td>`;
      }).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="ms-leyenda">
      <span><i class="ms-cel--si"></i> con permisos (el número son las acciones)</span>
      <span><i class="ms-cel--no"></i> sin permisos, pero sería otorgable</span>
      <span><i class="ms-cel--veda"></i> vedado por techo: la base lo rechaza</span>
    </div>`;
  }

  /* ============================================================ PERMISO EFECTIVO */
  function vEfectivo() {
    const sel = (borrador && borrador.verPersona) || M.personas()[0].id;
    const p = M.persona(sel), asg = M.deLaPersona(sel), ef = I.permisoEfectivo(asg);
    const cerradas = asg.filter(a => a.hasta && a.hasta < hoy());
    return head("Qué ve cada persona",
      "No es «¿qué puede hacer Juan?» sino «¿qué puede hacer Juan CON ESTE rol, en ESTE alcance, HOY?».") + `
    <label class="ms-campo ms-campo--ancho"><span>Persona</span>
      <select data-campo="verPersona">${M.personas().map(x =>
        `<option value="${esc(x.id)}" ${x.id === sel ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>
    ${ef.length ? `
      <div class="ms-resumen">${esc(p.nombre)} alcanza <b>${ef.length}</b> módulo(s) hoy,
        con <b>${ef.reduce((s,x) => s + x.acciones.length, 0)}</b> acción(es) en total.</div>
      ${ef.map(x => `<div class="ms-efmod">
        <div class="ms-efmod__cab"><b>${esc(x.nombre)}</b> ${pastilla(x.nivelModulo)}</div>
        <div class="ms-lbl">Puede</div>
        <div class="ms-chips">${x.acciones.map(a => `<span class="ms-chip ms-chip--acc">${esc(a)}</span>`).join("")}</div>
        <div class="ms-lbl">Por qué</div>
        <div class="ms-chips">${x.porque.map(w => `<span class="ms-chip">${esc(w)}</span>`).join("")}</div>
      </div>`).join("")}`
      : `<div class="ms-alerta ms-alerta--roja"><b>Hoy no alcanza ningún módulo.</b>
         ${cerradas.length ? `Tuvo ${cerradas.length} asignación(es) que ya cerraron. La regla es explícita:
         sin rol vigente, el acceso queda bloqueado.` : "Nunca se le otorgó acceso."}</div>`}
    ${cerradas.length ? `<h2 class="ms-h2">Historial cerrado</h2>
      <table class="ms-tabla ms-tabla--mini"><thead><tr><th>Rol</th><th>Alcance</th><th>Cerró</th></tr></thead><tbody>
      ${cerradas.map(a => `<tr class="ms-fila--cerrada"><td>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</td>
        <td>${nombreAlcance(a)}</td><td>${esc(a.hasta)}</td></tr>`).join("")}</tbody></table>` : ""}`;
  }

  /* ============================================================ BITÁCORA */
  function vBitacora() {
    return head("Bitácora de accesos",
      "Solo se agrega. Quién otorgó qué, a quién y cuándo. Ninguna línea se borra ni se edita.") + `
    <table class="ms-tabla"><thead><tr><th>Cuándo</th><th>Tipo</th><th>Quién</th><th>Qué pasó</th></tr></thead><tbody>
    ${M.bitacora().map(l => {
      const q = M.persona(l.quien);
      return `<tr><td><code>${esc(l.ts)}</code></td>
        <td><span class="ms-tag ms-tag--${esc(l.tipo.toLowerCase())}">${esc(l.tipo)}</span></td>
        <td>${esc(q ? q.nombre : l.quien)}</td><td>${esc(l.detalle)}</td></tr>`; }).join("")}
    </tbody></table>`;
  }

  /* ============================================================ CONTRASTE */
  function vContraste() {
    return head("Contraste con el modelo del equipo 100p",
      "Lo que hay que resolver en la mesa antes de conectar el frontend. Está escrito en el código, no en un correo.") +
    I.DIVERGENCIAS.map(d => `
      <div class="ms-div ms-div--${esc(d.gravedad)}">
        <div class="ms-div__cab"><b>${esc(d.punto)}</b><span class="ms-grav">${esc(d.gravedad)}</span></div>
        <div class="ms-fila2">
          <div><div class="ms-lbl">Lo construido</div><div class="ms-val">${esc(d.nuestro)}</div></div>
          <div><div class="ms-lbl">Documento del equipo</div><div class="ms-val">${esc(d.dejhon)}</div></div>
        </div>
        <div class="ms-div__porque">${esc(d.porque)}</div>
      </div>`).join("") + `
    <h2 class="ms-h2">Lo que conviene adoptar de su documento</h2>
    <ul class="ms-lista">${I.ADOPTAR_DE_JHON.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  }

  /* ============================================================ ORGANIZACIÓN */
  function vIglesias() {
    return head("Iglesias y sedes", "El alcance «sede» de una asignación apunta a una de estas filas.") + `
    <table class="ms-tabla"><thead><tr><th>Iglesia</th><th>Identificador</th><th>Accesos vigentes</th></tr></thead><tbody>
    ${I.SEDES.map(s => {
      const n = M.asignaciones().filter(a => a.alcanceId === s.id && (!a.hasta || a.hasta >= hoy())).length;
      return `<tr><td><b>${esc(s.nombre)}</b></td><td><code>${esc(String(s.id).slice(0,8))}…</code></td>
        <td>${n || "<i>ninguno</i>"}</td></tr>`; }).join("")}</tbody></table>
    <div class="ms-nota ms-nota--ojo">La sede se identifica por UUID con llave foránea, no por texto libre.
      Es una de las divergencias con el documento del equipo: allí es <code>VARCHAR(50)</code> con
      valores como <code>'bogota'</code>, y un error de tipeo crea una sede fantasma.</div>`;
  }
  function vModSede() {
    return head("Módulos por sede", "Cada iglesia enciende solo lo que usa. Encender un módulo de dato sensible exige evidencia legal.") + `
    <div class="ms-scroll"><table class="ms-tabla"><thead><tr><th>Iglesia</th>
      ${I.MODULOS.map(m => `<th>${esc(m.codigo.slice(0,5))}<br>${pastilla(m.nivel)}</th>`).join("")}</tr></thead><tbody>
      ${I.SEDES.map(s => `<tr><td><b>${esc(s.nombre)}</b></td>
        ${I.MODULOS.map(m => `<td class="ms-cel ms-cel--si">✓</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="ms-nota">Los datos de habilitación viven en <code>sistema.modulos_sede</code>. Esta vista
      los mostrará en vivo cuando el frontend consuma la API.</div>`;
  }

  /* ============================================================ MÓDULOS DE OPERACIÓN */
  function vModulo(cod) {
    const m = I.modulo(cod);
    const yo = M.deLaPersona(YO.personaId);
    const alcanza = I.puedeVer(yo, cod);
    return head(m.nombre, `Módulo <code>${esc(cod)}</code> del backend.`) +
      (alcanza ? "" : `<div class="ms-alerta ms-alerta--roja">Su rol no alcanza este módulo.</div>`) +
      fichaModulo(cod) + `
      <div class="ms-nota">La pantalla de operación de este módulo vive en la app del rol que lo usa.
        Ábrala desde <b>Apps por rol</b>, en el menú. Aquí se gobierna <b>quién entra</b>, no el día a día.</div>`;
  }

  /* ============================================================ APP EMBEBIDA */
  function vApp(n) {
    return head(n.lbl, "Se abre aquí dentro, con el patrón de panel anidado. No es una copia: es la misma aplicación.") + `
    <div class="ms-marco"><iframe src="${esc(n.src)}" title="${esc(n.lbl)}" loading="lazy"></iframe></div>
    <div class="ms-nota">Origen: <code>${esc(n.src)}</code>. Si diera 404, es que no se desplegó junto
      al master: ambos deben publicarse en el mismo sitio.</div>`;
  }

  /* ============================================================ SHELL */
  function shell(html) {
    const yo = M.deLaPersona(YO.personaId), ef = I.permisoEfectivo(yo);
    return `
    <header class="ms-top">
      <div class="ms-marca"><div class="ms-logo">CR</div>
        <div><b>Casa Roca · Sistema Master</b><small>Dirección General · 36 iglesias</small></div></div>
      <div class="ms-sp"></div>
      <div class="ms-yo"><div><b>${esc(YO.nombre)}</b><small>${esc(I.rol(YO.rol).nombre)} · techo N${YO.techo} · ${ef.length} módulos</small></div>
        <div class="ms-av">DG</div></div>
    </header>
    <div class="ms-shell">
      <nav class="ms-nav" aria-label="Secciones del sistema master">
        ${NAV.map(n => n.sep
          ? `<div class="ms-navsep">${esc(n.sep)}</div>`
          : `<button class="ms-navit ${vista === n.id ? "is-on" : ""}" data-accion="ir" data-vista="${esc(n.id)}"
               ${vista === n.id ? 'aria-current="page"' : ""}>
             <span class="ms-navic">${n.ico}</span><span>${esc(n.lbl)}</span>
             ${n.mod ? `<em class="ms-navniv">${(I.nivel((I.modulo(n.mod)||{}).nivel)||{}).codigo || ""}</em>` : ""}
           </button>`).join("")}
      </nav>
      <main class="ms-main" id="ms-main" tabindex="-1">${html}</main>
    </div>`;
  }

  function pintar() {
    const n = NAV.find(x => x.id === vista) || {};
    let html;
    if (n.src) html = vApp(n);
    else switch (vista) {
      case "tablero":   html = vTablero(); break;
      case "accesos":   html = vAccesos(); break;
      case "crear":     html = vCrear();   break;
      case "roles":     html = vRoles();   break;
      case "matriz":    html = vMatriz();  break;
      case "efectivo":  html = vEfectivo();break;
      case "bitacora":  html = vBitacora();break;
      case "contraste": html = vContraste();break;
      case "iglesias":  html = vIglesias();break;
      case "modsede":   html = vModSede(); break;
      default:          html = n.mod ? vModulo(n.mod) : vTablero();
    }
    document.getElementById("app").innerHTML = shell(html);
  }

  /* ---------- eventos ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-accion]"); if (!b) return;
    const a = b.dataset.accion;
    if (a === "ir") { vista = b.dataset.vista; pintar(); const m = $("#ms-main"); if (m) m.focus(); }
    if (a === "nivel")   { borrador.nivelMax = +b.dataset.n; pintar(); }
    if (a === "limpiar") { borrador = null; pintar(); }
    if (a === "revocar") {
      const r = M.revocar(b.dataset.id, "cierre desde el master");
      if (!r.ok) alert(r.fallos.join("\n")); pintar();
    }
    if (a === "otorgar") {
      const bo = borrador;
      let pid = bo.personaId;
      if (!pid && bo.nuevaPersona) pid = M.crearPersona(bo.nuevaPersona, bo.documento, "").id;
      const res = M.otorgar({ personaId:pid, rol:bo.rol, alcanceTipo:bo.alcanceTipo,
        alcanceId:bo.alcanceId || null, nivelMax:bo.nivelMax, desde:bo.desde,
        hasta:bo.hasta || null, acta:bo.acta }, YO);
      if (!res.ok) { alert("La base rechazaría esto:\n\n" + res.fallos.join("\n")); return; }
      borrador = null; vista = "accesos"; pintar();
    }
  });
  document.addEventListener("change", e => {
    const c = e.target.closest("[data-campo]"); if (!c) return;
    const k = c.dataset.campo;
    if (k === "verPersona") { borrador = borrador || {}; borrador.verPersona = c.value; pintar(); return; }
    borrador = borrador || {};
    borrador[k] = c.value;
    if (k === "alcanceTipo") borrador.alcanceId = "";
    if (k === "rol") { const r = I.rol(c.value);
      if (r && borrador.nivelMax > r.techo) borrador.nivelMax = r.techo; }
    pintar();
  });
  document.addEventListener("input", e => {
    const c = e.target.closest("[data-campo]");
    if (c && c.tagName === "INPUT") { borrador = borrador || {}; borrador[c.dataset.campo] = c.value; }
  });

  document.addEventListener("DOMContentLoaded", pintar);
  if (document.readyState !== "loading") pintar();
})();
