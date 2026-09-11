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
  let filtro  = "";      // búsqueda de la lista
  let abierta = null;    // fila desplegada
  let cfgSede = null;    // iglesia que se está configurando
  let menuCrear = false; // desplegable de + Crear

  /* ============================================================
     NAVEGACIÓN · todas las pestañas del sistema
     `mod` ata la pestaña a un módulo del backend; si está, el
     permiso se calcula de verdad y no es decorativo.
     ============================================================ */
  const NAV = [
    { sep:"Dirección" },
    { id:"arranque",ico:"🧭", lbl:"Puesta en marcha" },
    { id:"comando", ico:"🛰️", lbl:"Centro de mando", mod:"crm" },
    { id:"tablero", ico:"🌐", lbl:"Tablero de la red" },

    { sep:"Identidad y accesos" },
    { id:"accesos",  ico:"🔑", lbl:"Personas con acceso", mod:"identidad" },
    { id:"crear",    ico:"➕", lbl:"Crear acceso",        mod:"identidad" },
    { id:"roles",    ico:"🎭", lbl:"Roles y techos",      mod:"identidad" },
    { id:"matriz",   ico:"🧮", lbl:"Matriz de permisos",  mod:"identidad" },
    { id:"permisos", ico:"✅", lbl:"Qué puede hacer cada rol", mod:"identidad" },
    { id:"efectivo", ico:"🔎", lbl:"Qué ve cada persona", mod:"identidad" },
    { id:"bitacora", ico:"📜", lbl:"Bitácora de accesos", mod:"cumplimiento" },
    { id:"contraste",ico:"⚖️", lbl:"Contraste con el equipo 100p" },

    { sep:"Organización" },
    { id:"iglesias",  ico:"⛪", lbl:"Iglesias y sedes",  mod:"organizacion" },
    { id:"plantillas",ico:"🧩", lbl:"Plantillas de iglesia", mod:"organizacion" },
    { id:"modsede",   ico:"🎚️", lbl:"Qué ve cada iglesia", mod:"organizacion" },

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

  /* ============================================================ PUESTA EN MARCHA
     El orden importa y no es decorativo: primero los pastores
     generales, de ellos sale la parte administrativa, de ahí las
     iglesias (cada una con SU pastor, que la base exige), y solo
     entonces los roles de cada iglesia. Saltarse un paso deja
     huérfano el siguiente. */
  function vArranque() {
    const per = M.personas(), asg = M.asignaciones();
    const vig = a => !a.hasta || a.hasta >= hoy();
    const generales = asg.filter(a => vig(a) && a.alcanceTipo === "organizacion");
    const admin     = M.equipos();
    const sedes     = M.sedes();
    const conPastor = sedes.filter(s => asg.some(a => vig(a) && a.alcanceId === s.id && a.rol === "PASTOR_CONGREGACIONAL"));
    const rolesSede = asg.filter(a => vig(a) && a.alcanceTipo !== "organizacion");

    const pasos = [
      { n:1, t:"Pastores generales", sub:"La Dirección General. De aquí sale todo lo demás.",
        hecho:generales.length, meta:"al menos 1", ok:generales.length > 0,
        ir:"crear", btn:"Otorgar Dirección General",
        detalle:generales.length
          ? generales.map(a => (M.persona(a.personaId) || {}).nombre).join(", ")
          : "Todavía nadie gobierna la red." },
      { n:2, t:"Equipo administrativo", sub:"Los equipos corporativos que dependen de la Dirección.",
        hecho:admin.length, meta:"los que hagan falta", ok:admin.length > 0,
        ir:"n-equipo", btn:"Crear equipo",
        detalle:admin.length ? admin.map(e => e.nombre).join(", ") : "Ningún equipo creado todavía.",
        bloqueado: generales.length === 0, porque:"Primero tiene que existir la Dirección General." },
      { n:3, t:"Iglesias", sub:"Cada una nace con su pastor y con una plantilla que define qué ve.",
        hecho:sedes.length, meta:"36", ok:sedes.length > 0 && conPastor.length === sedes.length,
        ir:"n-iglesia", btn:"Crear iglesia",
        detalle:sedes.length
          ? `${conPastor.length} de ${sedes.length} tienen pastor asignado.`
          : "Ninguna iglesia creada.",
        bloqueado: generales.length === 0, porque:"La Dirección General es quien crea iglesias." },
      { n:4, t:"Roles por iglesia", sub:"Directores, líderes, consejeros y tesorería de cada sede.",
        hecho:rolesSede.length, meta:"según cada iglesia", ok:rolesSede.length > 0,
        ir:"crear", btn:"Otorgar acceso",
        detalle:rolesSede.length ? `${rolesSede.length} accesos vigentes fuera de la Dirección.` : "Sin roles locales todavía.",
        bloqueado: sedes.length === 0, porque:"Primero hay que crear la iglesia donde van a servir." },
    ];
    const hechos = pasos.filter(x => x.ok).length;

    return `<div class="ms-ancho--lectura">` + head("Puesta en marcha",
      "El sistema se llena en un orden. Cada paso habilita el siguiente; saltarse uno deja huérfano al que sigue.") + `
      <div class="ms-prog">
        <div class="ms-prog__barra"><i style="width:${(hechos / pasos.length) * 100}%"></i></div>
        <span class="ms-cuenta">${hechos} de ${pasos.length} pasos completos</span>
      </div>
      ${pasos.map(x => `
        <div class="ms-paso-seq ${x.ok ? "is-ok" : ""} ${x.bloqueado ? "is-bloq" : ""}">
          <div class="ms-paso-seq__n">${x.ok ? "\u2713" : x.n}</div>
          <div class="ms-paso-seq__c">
            <h3>${esc(x.t)}</h3>
            <p>${esc(x.sub)}</p>
            <div class="ms-paso-seq__est">${esc(x.detalle)}</div>
            ${x.bloqueado ? `<div class="ms-nota ms-nota--ojo">${esc(x.porque)}</div>` : ""}
          </div>
          <div class="ms-paso-seq__a">
            <div class="ms-cuenta">${x.hecho} <small>/ ${esc(x.meta)}</small></div>
            <button class="ms-btn ${x.ok ? "" : "ms-btn--primario"}" data-accion="ir" data-vista="${x.ir}"
              ${x.bloqueado ? "disabled" : ""}>${esc(x.btn)}</button>
          </div>
        </div>`).join("")}
    </div>`;
  }


  /* ============================================================ CENTRO DE MANDO
     El CRM no es una capa encima de cada proceso: es la LECTURA de la
     línea de tiempo donde todos los procesos escriben. Aquí se ve la
     red entera moviéndose, y desde aquí se actúa.

     Si mañana entra un módulo nuevo, no hay que tocar esta pantalla:
     basta con que escriba sus hechos. Esa es toda la gracia. */
  function vComando() {
    const hs = M.hechos().sort((a, b) => a.cuando < b.cuando ? 1 : -1);
    const porModulo = {};
    hs.forEach(h => { const m = (I.tipoHecho(h.tipo) || {}).modulo || h.modulo;
      porModulo[m] = (porModulo[m] || 0) + 1; });
    const sinHechos = M.personas().filter(p => !M.hechosDe(p.id).length);
    const frios = M.personas().map(p => {
      const h = M.hechosDe(p.id)[0];
      if (!h) return null;
      const d = Math.round((Date.now() - new Date(h.cuando).getTime()) / 86400000);
      return d > 120 ? { p, d, h } : null;
    }).filter(Boolean).sort((a, b) => b.d - a.d);

    return `<div class="ms-ancho">` + head("Centro de mando",
      "Una sola línea de tiempo. Cada módulo escribe un hecho y sigue con lo suyo; esto es la lectura de esa línea, no una capa encima de cada proceso.") + `

    <div class="ms-kpis">
      <div class="ms-kpi"><b>${hs.length}</b><span>hechos registrados</span></div>
      <div class="ms-kpi"><b>${Object.keys(porModulo).length}</b><span>módulos alimentando</span></div>
      <div class="ms-kpi ${sinHechos.length ? "ms-kpi--ojo" : ""}"><b>${sinHechos.length}</b><span>personas sin un solo hecho</span></div>
      <div class="ms-kpi ${frios.length ? "ms-kpi--ojo" : ""}"><b>${frios.length}</b><span>sin movimiento hace 4 meses</span></div>
    </div>

    ${sinHechos.length ? `<div class="ms-alerta ms-alerta--ambar">
      <b>${sinHechos.length} persona(s) sin un solo hecho en su línea.</b>
      Si se les da un rol, se les da a ciegas: ${esc(sinHechos.map(p => p.nombre).join(", "))}.</div>` : ""}

    ${frios.length ? `<div class="ms-lbl">Se están enfriando</div>
      <table class="ms-tabla"><thead><tr><th>Persona</th><th>Último movimiento</th><th>Hace</th><th></th></tr></thead><tbody>
      ${frios.slice(0, 6).map(x => `<tr>
        <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(x.p.id)}">${esc(x.p.nombre)}</button></td>
        <td>${esc(x.h.resumen)}</td><td class="num">${x.d} días</td>
        <td class="ms-acc-col"><button class="ms-btn ms-btn--peq" data-accion="verpersona" data-id="${esc(x.p.id)}">Ver ficha</button></td>
      </tr>`).join("")}</tbody></table>` : ""}

    <div class="ms-lbl" style="margin-top:22px">Qué módulos están alimentando la línea</div>
    <div class="ms-chips">${I.MODULOS.map(m => {
      const n = porModulo[m.codigo] || 0;
      return `<span class="ms-chip ${n ? "" : "ms-chip--veda"}">${esc(m.nombre)} · ${n}</span>`;
    }).join("")}</div>
    <div class="ms-nota">Los tachados todavía no escriben hechos. No es un defecto del CRM: es que ese
      módulo aún no está conectado. Cuando lo esté, aparece aquí sin tocar esta pantalla.</div>

    <div class="ms-lbl" style="margin-top:22px">La línea, toda la red</div>
    <ul class="ms-linea ms-linea--grande">
      ${hs.slice(0, 20).map(h => {
        const p = M.persona(h.personaId), t = I.tipoHecho(h.tipo);
        return `<li><span class="ms-linea__f">${esc(h.cuando)}</span>
          <span class="ms-chip">${esc(t ? t.modulo : h.modulo)}</span>
          <button class="ms-enlace" data-accion="verpersona" data-id="${esc(h.personaId)}">${esc(p ? p.nombre : "")}</button>
          ${esc(h.resumen)}</li>`;
      }).join("")}
    </ul></div>`;
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

  /* ============================================================ ACCESOS · LISTA
     Una tarjeta por persona obliga a desplazarse para comparar dos.
     La lista deja ver veinte de un golpe, que es lo que se necesita
     para gobernar accesos. El detalle se despliega, no se navega. */
  function vAccesos() {
    const norm = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = norm(filtro || "");
    const filas = M.personas().map(p => {
      const asg = M.deLaPersona(p.id);
      const vig = asg.filter(a => !a.hasta || a.hasta >= hoy());
      return { p, asg, vig, ef: I.permisoEfectivo(asg),
               techo: vig.reduce((m, a) => Math.max(m, a.nivelMax), -1) };
    }).filter(f => !q || norm(f.p.nombre).indexOf(q) >= 0 ||
      f.vig.some(a => norm((I.rol(a.rol) || {}).nombre || a.rol).indexOf(q) >= 0));

    return `<div class="ms-ancho">` + head("Personas con acceso",
      "Otorgar agrega una fila; cerrar le pone fecha de fin. Nunca se borra ni se edita.") + `
    <div class="ms-barra">
      <input class="ms-busca" data-campo="filtro" value="${esc(filtro)}" placeholder="Buscar persona o rol…">
      <span class="ms-cuenta">${filas.length} de ${M.personas().length}</span>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--primario" data-accion="ir" data-vista="crear">Crear acceso</button>
    </div>
    <table class="ms-lista-t"><thead><tr>
      <th style="width:26px"></th><th>Persona</th><th>Roles vigentes</th><th>Alcance</th>
      <th style="width:70px">Techo</th><th style="width:120px">Módulos</th>
      <th style="width:150px">Vigencia</th><th class="ms-acc-col">Acciones</th>
    </tr></thead><tbody>
    ${filas.length ? filas.map(f => {
      const ab = abierta === f.p.id;
      const prox = f.vig.filter(a => a.hasta).sort((x, y) => x.hasta < y.hasta ? -1 : 1)[0];
      return `<tr class="${ab ? "is-abierta" : ""}">
        <td><button class="ms-desp" data-accion="desplegar" data-id="${esc(f.p.id)}"
             title="Abrir ficha">\u203A</button></td>
        <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(f.p.id)}">${esc(f.p.nombre)}</button>
            <span class="ms-sub">${esc(f.p.codigo || "")} \u00b7 ${esc(f.p.documento || "sin documento")}</span></td>
        <td>${f.vig.length
            ? `<div class="ms-chips">${f.vig.map(a => `<span class="ms-chip">${esc((I.rol(a.rol)||{}).nombre || a.rol)}</span>`).join("")}</div>`
            : `<span class="ms-vig ms-vig--fin">Sin rol vigente</span>`}</td>
        <td>${f.vig.length ? f.vig.map(a => `<div class="ms-sub" style="font-family:var(--ui)">${nombreAlcance(a)}</div>`).join("") : "<span class=ms-sub>—</span>"}</td>
        <td>${f.techo >= 0 ? pastilla(f.techo) : "<span class=ms-sub>—</span>"}</td>
        <td class="num">${f.ef.length ? f.ef.length + " de " + I.MODULOS.length : "<span class=ms-sub>0</span>"}</td>
        <td>${f.vig.length ? (prox ? vigencia(prox) : `<span class="ms-vig ms-vig--ok">Indefinido</span>`)
                           : `<span class="ms-vig ms-vig--fin">Bloqueado</span>`}</td>
        <td class="ms-acc-col">
          <button class="ms-btn ms-btn--peq" data-accion="verefectivo" data-id="${esc(f.p.id)}">Qué ve</button>
          <button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="agregarrol" data-id="${esc(f.p.id)}">+ Rol</button>
        </td>
      </tr>
      ${ab ? `<tr class="ms-detalle"><td colspan="8">
        <div class="ms-lbl">Todas las asignaciones, incluidas las cerradas</div>
        <table class="ms-tabla ms-tabla--mini" style="margin-top:6px"><thead><tr>
          <th>Rol</th><th>Alcance</th><th>Techo</th><th>Vigencia</th><th>Acta</th><th>Otorgó</th><th></th>
        </tr></thead><tbody>
        ${f.asg.length ? f.asg.map(a => {
          const cerrada = a.hasta && a.hasta < hoy(), q2 = M.persona(a.otorgadoPor);
          return `<tr class="${cerrada ? "ms-fila--cerrada" : ""}">
            <td><b>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</b></td>
            <td>${nombreAlcance(a)}</td><td>${pastilla(a.nivelMax)}</td>
            <td>${vigencia(a)}</td>
            <td>${a.acta ? `<code>${esc(a.acta)}</code>` : `<span class="ms-falta">sin acta</span>`}</td>
            <td>${esc(q2 ? q2.nombre : (a.otorgadoPor || "—"))}</td>
            <td class="ms-acc-col">${cerrada ? "" :
              `<button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="revocar" data-id="${esc(a.id)}">Cerrar</button>`}</td>
          </tr>`; }).join("")
          : `<tr><td colspan="7" class="ms-vacio">Nunca se le otorgó un acceso.</td></tr>`}
        </tbody></table></td></tr>` : ""}`;
    }).join("") : `<tr><td colspan="8" class="ms-vacio" style="padding:24px;text-align:center">Nadie coincide con la búsqueda.</td></tr>`}
    </tbody></table></div>`;
  }


  /* ============================================================ FICHA DE PERSONA
     Hacer clic en alguien no debe desplegar una fila: debe abrir su
     ficha. A la izquierda quién es; a la derecha qué puede hacer y
     por qué. Todo lo que un pastor necesita saber antes de nombrarla
     o de cerrarle el acceso, en una pantalla. */
  function iniciales(n) {
    return (n || "?").split(/\s+/).filter(w => w.length > 2).slice(0, 2)
      .map(w => w[0]).join("").toUpperCase() || "?";
  }
  function edadDe(f) {
    if (!f) return null;
    const d = new Date(f), h = new Date();
    let a = h.getFullYear() - d.getFullYear();
    const m = h.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--;
    return a >= 0 && a < 130 ? a : null;
  }
  function vPersona() {
    const id = (borrador && borrador.verPersona) || M.personas()[0].id;
    const p = M.persona(id);
    if (!p) return head("Persona", "No existe esa ficha.");
    const asg = M.deLaPersona(id);
    const vig = asg.filter(a => !a.hasta || a.hasta >= hoy());
    const cerradas = asg.filter(a => a.hasta && a.hasta < hoy());
    const ef = I.permisoEfectivo(asg);
    const conyuge = M.conyugeDe(id), hijos = M.hijosDe(id);
    const pot = M.potestad(id);
    const edad = edadDe(p.fechaNac);
    const menor = edad != null && edad < 18;

    const dato = (l, v, mono) => `<div class="ms-dato"><div class="ms-lbl">${esc(l)}</div>
      <div class="ms-val ${mono ? "mono" : ""}">${v || '<span class="ms-falta">sin registrar</span>'}</div></div>`;

    return `<div class="ms-ancho">` + `
    <div class="ms-ficha__top">
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="accesos">← Volver a la lista</button>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--peq" data-accion="verefectivo2" data-id="${esc(id)}">Ver permiso detallado</button>
      <button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="agregarrol" data-id="${esc(id)}">+ Otorgar rol</button>
    </div>

    <div class="ms-ficha">
      <aside class="ms-ficha__id">
        <div class="ms-foto">${p.foto
          ? `<img src="${esc(p.foto)}" alt="${esc(p.nombre)}">`
          : `<span>${esc(iniciales(p.nombre))}</span>`}</div>
        <h1>${esc(p.nombre)}</h1>
        <div class="ms-codigo">${esc(p.codigo || "sin código")}</div>
        ${menor ? `<div class="ms-alerta ms-alerta--roja" style="margin:12px 0 0">
          <b>Es menor de edad.</b> Sus datos son N4: protección reforzada y acudiente obligatorio.</div>` : ""}

        <div class="ms-lbl" style="margin-top:18px">Hoja de vida</div>
        <div class="ms-datos">
          ${dato("Documento", esc(p.documento), true)}
          ${dato("Fecha de nacimiento", p.fechaNac ? esc(p.fechaNac) + (edad != null ? ` <small>(${edad} años)</small>` : "") : "")}
          ${dato("Celular", esc(p.celular), true)}
          ${dato("Correo", esc(p.correo), true)}
          ${dato("Nacimiento en la Fe", esc(p.anioFe))}
        </div>

        <div class="ms-lbl" style="margin-top:18px">Familia</div>
        <div class="ms-datos">
          ${conyuge
            ? `<div class="ms-dato"><div class="ms-lbl">Cónyuge</div>
                 <button class="ms-enlace" data-accion="verpersona" data-id="${esc(conyuge.id)}">${esc(conyuge.nombre)}</button></div>`
            : `<div class="ms-dato"><div class="ms-lbl">Cónyuge</div><div class="ms-val"><span class="ms-falta">sin vínculo registrado</span></div></div>`}
          <div class="ms-dato"><div class="ms-lbl">Hijos (${hijos.length})</div>
            <div class="ms-val">${hijos.length
              ? hijos.map(h => `<button class="ms-enlace" data-accion="verpersona" data-id="${esc(h.id)}">${esc(h.nombre)}</button>`).join(" · ")
              : '<span class="ms-falta">ninguno registrado</span>'}</div></div>
        </div>
      </aside>

      <section class="ms-ficha__acc">
        <div class="ms-kpis">
          <div class="ms-kpi"><b>${vig.length}</b><span>roles vigentes</span></div>
          <div class="ms-kpi"><b>${ef.length}</b><span>de ${I.MODULOS.length} módulos</span></div>
          <div class="ms-kpi ${vig.some(a => a.nivelMax >= 3) ? "ms-kpi--ojo" : ""}">
            <b>${vig.length ? "N" + Math.max.apply(null, vig.map(a => a.nivelMax)) : "—"}</b><span>techo alcanzado</span></div>
          <div class="ms-kpi ${pot.puede ? "ms-kpi--ojo" : ""}"><b>${pot.puede ? "Sí" : "No"}</b><span>puede nombrar a otros</span></div>
        </div>

        ${!vig.length ? `<div class="ms-alerta ms-alerta--roja">
          <b>Hoy no tiene acceso.</b> ${cerradas.length
            ? `Tuvo ${cerradas.length} asignación(es) que ya cerraron. Sin rol vigente, el acceso queda bloqueado.`
            : "Nunca se le otorgó ninguno."}</div>` : ""}

        <div class="ms-lbl">Roles vigentes</div>
        ${vig.length ? vig.map(a => {
          const r = I.rol(a.rol);
          return `<div class="ms-rolcard">
            <div class="ms-rolcard__c">
              <b>${esc(r ? r.nombre : a.rol)}</b>
              <div class="ms-sub" style="font-family:var(--ui)">${nombreAlcance(a)}</div>
            </div>
            <div>${pastilla(a.nivelMax)}</div>
            <div>${vigencia(a)}</div>
            <div>${a.acta ? `<code>${esc(a.acta)}</code>` : `<span class="ms-falta">sin acta</span>`}</div>
            <div class="ms-rolcard__a">
              <label class="ms-opt ${a.delega ? "is-on" : ""}" style="padding:2px 8px" title="Potestad de nombrar y cerrar accesos dentro de su alcance">
                <input type="checkbox" ${a.delega ? "checked" : ""} data-delega="${esc(a.id)}">
                <div><b style="font-size:11.5px">Puede nombrar</b></div></label>
              <button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="revocar" data-id="${esc(a.id)}">Cerrar</button>
            </div>
          </div>`;
        }).join("") : ""}

        <div class="ms-lbl" style="margin-top:20px">Qué panel abre</div>
        ${(() => {
          const pn = I.panelesDe(asg, (sid, mod) => M.moduloActivo(sid, mod));
          if (!pn.length) return `<div class="ms-nota">Ningún panel. Sin rol vigente no hay pantalla que abrir.</div>`;
          return `<div class="ms-modgrid">${pn.map(x => {
            const sd = x.asignacion.alcanceId && M.sedes().find(z => z.id === x.asignacion.alcanceId);
            return `<div class="ms-panelc ${x.abre ? "is-on" : ""}">
              <div class="ms-panelc__c">
                <b>${esc(x.nombre)}</b>
                <span class="ms-sub">${sd ? esc(sd.nombre) : esc((I.alcance(x.asignacion.alcanceTipo)||{}).nombre || "")}</span>
              </div>
              ${x.abre
                ? `<button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="abrirpanel" data-url="${esc(x.url)}" data-lbl="${esc(x.nombre)}">Entrar</button>`
                : `<span class="ms-vig ms-vig--fin">${x.encendido ? "techo insuficiente" : "módulo apagado en su iglesia"}</span>`}
              ${x.crea && x.crea.length ? `<div class="ms-panelc__crea">Desde ahí crea: ${esc(x.crea.join(", "))}</div>` : ""}
            </div>`;
          }).join("")}</div>`;
        })()}

        <div class="ms-lbl" style="margin-top:20px">Qué puede hacer hoy</div>
        ${ef.length ? `<div class="ms-modgrid">
          ${ef.map(x => `<div class="ms-modmini">
            <div class="ms-modmini__c"><b>${esc(x.nombre)}</b> ${pastilla(x.nivelModulo)}</div>
            <div class="ms-chips">${x.acciones.slice(0, 6).map(ac => `<span class="ms-chip ms-chip--acc">${esc(ac)}</span>`).join("")}
              ${x.acciones.length > 6 ? `<span class="ms-chip">+${x.acciones.length - 6}</span>` : ""}</div>
          </div>`).join("")}</div>`
          : `<div class="ms-nota">Ningún módulo alcanzable hoy.</div>`}

        ${cerradas.length ? `<div class="ms-lbl" style="margin-top:20px">Historial cerrado (${cerradas.length})</div>
          <table class="ms-tabla ms-tabla--mini"><thead><tr><th>Rol</th><th>Alcance</th><th>Cerró</th></tr></thead><tbody>
          ${cerradas.map(a => `<tr class="ms-fila--cerrada"><td>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</td>
            <td>${nombreAlcance(a)}</td><td>${esc(a.hasta)}</td></tr>`).join("")}</tbody></table>` : ""}
      </section>
    </div></div>`;
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

      ${(() => {
        const pid = b.personaId;
        if (!pid) return "";
        const c = M.contextoPara(pid);
        if (!c) return "";
        return `<section class="ms-paso ms-paso--ctx">
          <h3><i>·</i> Lo que el CRM sabe de ${esc(c.persona.nombre)}</h3>
          <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
            Nadie debería nombrar a alguien a ciegas. Esto sale de la línea de tiempo, no de un formulario.</p>
          <div class="ms-ctxkpis">
            <div><b>${c.meses != null ? c.meses : "—"}</b><span>meses en la iglesia</span></div>
            <div><b>${c.hechos.length}</b><span>hechos registrados</span></div>
            <div><b>${c.cursos.length}</b><span>cursos certificados</span></div>
            <div><b>${c.rolesVigentes.length}</b><span>roles vigentes</span></div>
          </div>
          ${c.señales.map(x => `<div class="ms-senal ms-senal--${esc(x.t)}">${esc(x.txt)}</div>`).join("")}
          ${c.hechos.length ? `<div class="ms-lbl" style="margin-top:12px">Últimos movimientos</div>
            <ul class="ms-linea">${c.hechos.slice(0, 5).map(h => {
              const t = I.tipoHecho(h.tipo);
              return `<li><span class="ms-linea__f">${esc(h.cuando)}</span>
                <span class="ms-chip">${esc(t ? t.modulo : h.modulo)}</span>
                ${esc(h.resumen)}</li>`;
            }).join("")}</ul>` : ""}
        </section>`;
      })()}

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

      ${(() => {
        const r2 = b.rol ? I.rol(b.rol) : null;
        if (!r2 || r2.techo < 4 || !b.personaId) return "";
        const c = M.contextoPara(b.personaId);
        if (!c) return "";
        return `<div class="ms-alerta ms-alerta--roja">
          <b>Este rol toca datos de menores (N4).</b>
          ${c.antecedentes
            ? "Hay antecedentes registrados en su línea de tiempo: verifique que sigan vigentes (caducan a los 2 años)."
            : "No hay ningún registro de antecedentes verificados en su línea de tiempo. La regla del módulo de Talento es explícita: nadie sirve con menores sin antecedentes verificados y vigentes."}
        </div>`;
      })()}
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



  /* ============================================================ SELECTOR DE PERMISOS
     El MISMO componente en un rol, en un ministerio y en un equipo.
     Tres niveles, no quince acciones. Si una pantalla usara palabras
     distintas de otra, nadie entendería el sistema.

     `techo` recorta lo que se puede ofrecer: un módulo por encima del
     techo sale vedado y no se puede marcar. */
  function selectorPermisos(permisos, techo, campo, modsVisibles) {
    permisos = permisos || {};
    const mods = (modsVisibles && modsVisibles.length)
      ? I.MODULOS.filter(m => modsVisibles.indexOf(m.codigo) >= 0)
      : I.MODULOS;
    const n = Object.keys(permisos).filter(k => permisos[k]).length;
    return `
    <div class="ms-permsel">
      <div class="ms-permsel__cab">
        <span class="ms-lbl" style="margin:0">Módulo</span>
        ${I.NIVELES_ACCESO.map(x => `<span class="ms-lbl" style="margin:0;text-align:center" title="${esc(x.ayuda)}">${esc(x.nombre)}</span>`).join("")}
        <span class="ms-lbl" style="margin:0;text-align:center">Sin acceso</span>
      </div>
      ${mods.map(m => {
        const vedado = m.nivel > techo;
        const act = permisos[m.codigo] || null;
        return `<div class="ms-permsel__f ${vedado ? "is-veda" : ""}">
          <div class="ms-permsel__m"><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}
            ${vedado ? `<span class="ms-porque">fuera del techo N${techo}</span>` : ""}</div>
          ${I.NIVELES_ACCESO.map(x => `
            <label class="ms-radio ${act === x.codigo ? "is-on" : ""}" title="${esc(x.ayuda)}">
              <input type="radio" name="${esc(campo)}_${esc(m.codigo)}" ${act === x.codigo ? "checked" : ""}
                ${vedado ? "disabled" : ""} data-perm-campo="${esc(campo)}"
                data-perm-mod="${esc(m.codigo)}" data-perm-niv="${esc(x.codigo)}"></label>`).join("")}
          <label class="ms-radio ${!act ? "is-on" : ""}" title="Sin acceso a este módulo">
            <input type="radio" name="${esc(campo)}_${esc(m.codigo)}" ${!act ? "checked" : ""}
              ${vedado ? "disabled" : ""} data-perm-campo="${esc(campo)}"
              data-perm-mod="${esc(m.codigo)}" data-perm-niv=""></label>
        </div>`;
      }).join("")}
      <div class="ms-permsel__pie">
        <span class="ms-cuenta">${n} módulo(s) con acceso</span>
        <div class="ms-barra__sp"></div>
        ${I.NIVELES_ACCESO.map(x => `<button class="ms-btn ms-btn--peq" data-accion="perm-todos"
          data-campo="${esc(campo)}" data-niv="${esc(x.codigo)}">Todo a «${esc(x.nombre.toLowerCase())}»</button>`).join("")}
        <button class="ms-btn ms-btn--peq" data-accion="perm-todos" data-campo="${esc(campo)}" data-niv="">Ninguno</button>
      </div>
    </div>`;
  }

  /* ============================================================ FORMULARIOS DE CREACIÓN
     Un patrón para todos: campos arriba, la consecuencia visible
     abajo, y el botón deshabilitado hasta que la base lo aceptaría.
     Nunca se deja pulsar algo que va a fallar. */
  function b_() { return (borrador = borrador || {}); }
  function selPersona(campo, etiqueta, ayuda) {
    const b = b_();
    return `<label class="ms-campo"><span>${esc(etiqueta)} <b class="ms-req">obligatorio</b></span>
      <select data-campo="${campo}"><option value="">Elegir persona…</option>
      ${M.personas().map(x => `<option value="${esc(x.id)}" ${b[campo] === x.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
      </select></label>
      <label class="ms-campo"><span>…o crear la ficha aquí mismo</span>
        <input data-campo="${campo}_nueva" value="${esc(b[campo + "_nueva"] || "")}" placeholder="Nombre completo"></label>
      ${ayuda ? `<div class="ms-nota">${esc(ayuda)}</div>` : ""}`;
  }
  function selSede(campo, etiqueta) {
    const b = b_();
    return `<label class="ms-campo"><span>${esc(etiqueta)} <b class="ms-req">obligatorio</b></span>
      <select data-campo="${campo}"><option value="">Elegir iglesia…</option>
      ${M.sedes().map(x => `<option value="${esc(x.id)}" ${b[campo] === x.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
      </select></label>`;
  }
  function pie(fallos, textoBtn, accion) {
    return `${fallos.length
      ? `<div class="ms-alerta ms-alerta--roja"><b>Falta para poder crear:</b><ul>${fallos.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>`
      : `<div class="ms-alerta ms-alerta--verde"><b>Listo.</b> La base aceptaría esto.</div>`}
      <div class="ms-acciones">
        <button class="ms-btn ms-btn--primario" data-accion="${accion}" ${fallos.length ? "disabled" : ""}>${esc(textoBtn)}</button>
        <button class="ms-btn" data-accion="limpiar">Limpiar</button>
      </div>`;
  }

  /* ---------- PERSONA ---------- */
  function vNPersona() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre completo.");
    return `<div class="ms-ancho--forma">` + head("Crear persona",
      "La ficha por sí sola no da acceso a nada. El acceso se otorga después, o al crear la iglesia, el ministerio o el equipo donde va a servir.") + `
      <div class="ms-paso">
        <label class="ms-campo"><span>Nombre completo <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Juan Carlos Pérez"></label>
        <div class="ms-fila2">
          <label class="ms-campo"><span>Documento</span>
            <input data-campo="documento" value="${esc(b.documento || "")}" placeholder="Cédula"></label>
          <label class="ms-campo"><span>Correo</span>
            <input data-campo="correo" value="${esc(b.correo || "")}" placeholder="opcional"></label>
        </div>
        <div class="ms-nota">El correo es <b>opcional</b> a propósito. Muchos menores y adultos mayores
          no tienen, y exigirlo los deja fuera del registro. Es una de las divergencias con el modelo
          del equipo 100p, donde es obligatorio y único.</div>
      </div>` + pie(f, "Crear persona", "hacer-persona") + `</div>`;
  }

  /* ---------- IGLESIA ---------- */
  function vNIglesia() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre de la iglesia.");
    if (!b.plantilla) f.push("La plantilla: define qué módulos verá esta iglesia.");
    if (!b.pastorId && !b.pastorId_nueva) f.push("Su pastor. Una iglesia no se crea sin pastor.");
    const mods = b.plantilla ? I.modulosDePlantilla(b.plantilla) : [];
    return `<div class="ms-ancho--lectura">` + head("Crear iglesia",
      "Tres cosas y queda operando: cómo se llama, qué plantilla usa y quién la pastorea.") + `
      <div class="ms-paso"><h3><i>1</i> Identidad</h3>
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Bogotá Norte"></label>
        <div class="ms-fila2">
          <label class="ms-campo"><span>Ciudad</span>
            <input data-campo="ciudad" value="${esc(b.ciudad || "")}" placeholder="Bogotá"></label>
          <label class="ms-campo"><span>País</span>
            <select data-campo="pais">
              <option value="CO" ${b.pais === "CO" || !b.pais ? "selected" : ""}>Colombia</option>
              <option value="ES" ${b.pais === "ES" ? "selected" : ""}>España</option>
              <option value="US" ${b.pais === "US" ? "selected" : ""}>Estados Unidos</option>
              <option value="PA" ${b.pais === "PA" ? "selected" : ""}>Panamá</option>
            </select></label>
        </div>
      </div>

      <div class="ms-paso"><h3><i>2</i> Plantilla</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          Aquí se decide qué ve esta iglesia. No todas son iguales: una plantación arranca con lo
          mínimo y crece cuando se consolida.</p>
        <div class="ms-plant">
          ${I.PLANTILLAS.map(pl => {
            const n = I.modulosDePlantilla(pl.codigo).length;
            return `<button class="ms-plantc ${b.plantilla === pl.codigo ? "is-on" : ""}"
              data-accion="plantilla" data-cod="${esc(pl.codigo)}" style="text-align:left;cursor:pointer;font:inherit">
              <h4>${esc(pl.nombre)}</h4><p>${esc(pl["desc"] || "")}</p>
              <span class="ms-plantc__n">${n} de ${I.MODULOS.length} módulos</span></button>`;
          }).join("")}
        </div>
        ${b.plantilla ? `<div class="ms-lbl">Con esta plantilla verá</div>
          <div class="ms-chips">${I.MODULOS.map(m => mods.indexOf(m.codigo) >= 0
            ? `<span class="ms-chip">${esc(m.nombre)} ${pastilla(m.nivel)}</span>`
            : `<span class="ms-chip ms-chip--veda">${esc(m.nombre)}</span>`).join("")}</div>
          <div class="ms-nota">Lo tachado se puede encender después desde <b>Qué ve cada iglesia</b>.
            Los módulos de dato sensible piden evidencia legal para encenderse.</div>` : ""}
      </div>

      <div class="ms-paso"><h3><i>3</i> Su pastor</h3>
        ${selPersona("pastorId", "Pastor congregacional",
          "Queda nombrado en el mismo acto, con alcance de esta sede y techo N2. La base lo exige: una sede sin pastor no existe.")}
      </div>` + pie(f, "Crear iglesia y nombrar a su pastor", "hacer-iglesia") + `</div>`;
  }

  /* ---------- MINISTERIO ---------- */
  function vNMinisterio() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre del ministerio.");
    if (!b.sedeId) f.push("La iglesia a la que pertenece.");
    if (!b.liderId && !b.liderId_nueva) f.push("Su director. Un ministerio no se crea sin alguien a cargo.");
    if (!Object.keys(b.permisos || {}).some(k => b.permisos[k]))
      f.push("Al menos un módulo con acceso. Un ministerio que no puede ver nada no sirve de nada.");
    return `<div class="ms-ancho--forma">` + head("Crear ministerio",
      "RocaKids, tMt, Mujer Integral, Hombres de Bien. Cada uno pertenece a una iglesia y tiene alguien al frente.") + `
      <div class="ms-paso"><h3><i>1</i> Qué y dónde</h3>
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Mujer Integral"></label>
        ${selSede("sedeId", "Iglesia")}
      </div>
      <div class="ms-paso"><h3><i>2</i> Qué puede hacer este ministerio</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          Los mismos tres niveles que en cualquier otra parte del sistema. Es lo que podrán hacer
          quienes sirvan aquí.</p>
        ${selectorPermisos(b.permisos, b.techo != null ? +b.techo : 2, "permisos")}
        <label class="ms-campo" style="margin-top:12px"><span>Techo del ministerio</span>
          <select data-campo="techo">
            ${I.NIVELES.map(n => `<option value="${n.nivel}" ${(b.techo != null ? +b.techo : 2) === n.nivel ? "selected" : ""}>N${n.nivel} · ${esc(n["desc"])}</option>`).join("")}
          </select></label>
      </div>

      <div class="ms-paso"><h3><i>3</i> Quién lo dirige</h3>
        ${selPersona("liderId", "Director del ministerio",
          "Queda nombrado en el mismo acto, con alcance de este ministerio. Un ministerio sin nadie al frente es una carpeta que nadie revisa, y el día que hay un problema con un menor no hay a quién preguntarle.")}
        ${b.nombre && /roca|kid|nin|niñ/i.test(b.nombre) ? `<div class="ms-nota ms-nota--ojo">
          Este ministerio parece de menores. Los módulos de menores son <b>N4</b>: exigen antecedentes
          verificados y vigentes para servir, y acta de respaldo para el acceso.</div>` : ""}
      </div>` + pie(f, "Crear ministerio y nombrar a su director", "hacer-ministerio") + `</div>`;
  }

  /* ---------- EQUIPO ---------- */
  function vNEquipo() {
    const b = b_(), f = [];
    const roles = b.roles || [];
    const local = (b.ambito || "local") === "local";
    if (!b.nombre) f.push("El nombre del equipo.");
    if (!roles.length) f.push("Al menos un rol. Un equipo sin roles no otorga nada.");
    if (local && !b.sedeId) f.push("La iglesia, o márquelo como corporativo.");
    if (!b.liderId && !b.liderId_nueva) f.push("Su responsable.");
    return `<div class="ms-ancho--lectura">` + head("Crear equipo administrativo",
      "Un equipo no es un rol: es un conjunto de roles que se otorgan juntos. Sirve para no repetir cuatro veces la misma asignación.") + `
      <div class="ms-paso"><h3><i>1</i> Qué equipo</h3>
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Tesorería Bogotá Chicó"></label>
        <label class="ms-campo"><span>Ámbito</span>
          <div class="ms-seg">
            <button data-accion="ambito" data-v="local" class="${local ? "is-on" : ""}">Local, de una iglesia</button>
            <button data-accion="ambito" data-v="corporativo" class="${!local ? "is-on" : ""}">Corporativo, de toda la red</button>
          </div></label>
        ${local ? selSede("sedeId", "Iglesia") : `<div class="ms-nota">Un equipo corporativo alcanza las 36 iglesias. Úselo solo para Contable, Legal y Tecnología.</div>`}
        ${I.EQUIPOS.length ? `<div class="ms-lbl" style="margin-top:12px">Atajos de los 8 equipos del back-office</div>
          <div class="ms-chips">${I.EQUIPOS.map(e => `<button class="ms-chip" style="cursor:pointer"
            data-accion="equipo-atajo" data-cod="${esc(e.codigo)}">${esc(e.nombre)}</button>`).join("")}</div>` : ""}
      </div>

      <div class="ms-paso"><h3><i>2</i> Qué puede hacer este equipo</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          Los mismos tres niveles que en un rol o en un ministerio. Vocabulario único en todo el sistema.</p>
        ${selectorPermisos(b.permisos, b.techo != null ? +b.techo : 3, "permisos")}
        <label class="ms-campo" style="margin-top:12px"><span>Techo del equipo</span>
          <select data-campo="techo">
            ${I.NIVELES.map(n => `<option value="${n.nivel}" ${(b.techo != null ? +b.techo : 3) === n.nivel ? "selected" : ""}>N${n.nivel} · ${esc(n["desc"])}</option>`).join("")}
          </select></label>

        <div class="ms-lbl" style="margin-top:16px">Roles que otorga al responsable</div>
        <div class="ms-sel">
          ${M.rolesTodos().map(r => {
            const on = roles.indexOf(r.codigo) >= 0;
            return `<label class="ms-opt ${on ? "is-on" : ""}">
              <input type="checkbox" data-rol="${esc(r.codigo)}" ${on ? "checked" : ""}>
              <div><b>${esc(r.nombre)}</b><small>techo N${r.techo}</small></div></label>`;
          }).join("")}
        </div>
      </div>

      <div class="ms-paso"><h3><i>3</i> Quién responde</h3>
        ${selPersona("liderId", "Responsable del equipo",
          "Recibe todos los roles marcados en el mismo acto.")}
      </div>` + pie(f, "Crear equipo y nombrar a su responsable", "hacer-equipo") + `</div>`;
  }

  /* ---------- ROL ---------- */
  function vNRol() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre del rol.");
    if (b.techo == null) f.push("El techo: la sensibilidad máxima que alcanzará.");
    return `<div class="ms-ancho--forma">` + head("Crear rol",
      "El catálogo es extensible a propósito: cada módulo nuevo trae sus roles. Lo que no cambia nunca es el techo.") + `
      <div class="ms-paso">
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Líder de Oración"></label>
        <label class="ms-campo"><span>Techo de sensibilidad <b class="ms-req">obligatorio</b></span></label>
        <div class="ms-niveles">
          ${I.NIVELES.map(n => `<button class="ms-nivbtn ${b.techo === n.nivel ? "is-on" : ""}"
            data-accion="techo" data-n="${n.nivel}">${pastilla(n.nivel)}<span>${esc(n["desc"])}</span></button>`).join("")}
        </div>
        ${b.techo != null ? `<div class="ms-nota">Con techo N${b.techo} este rol podrá alcanzar
          <b>${I.MODULOS.filter(m => m.nivel <= b.techo).length}</b> de los ${I.MODULOS.length} módulos.
          Los demás le quedan vedados para siempre: el techo no se negocia por asignación.</div>` : ""}
      </div>` + pie(f, "Crear rol", "hacer-rol") + `</div>`;
  }

  /* ---------- MÓDULO ---------- */
  function vNModulo() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre del módulo.");
    if (b.nivel == null) f.push("El nivel del dato que maneja.");
    return `<div class="ms-ancho--forma">` + head("Crear módulo",
      "Un módulo nuevo declara qué dato maneja. De ese nivel sale, automáticamente, qué roles pueden alcanzarlo.") + `
      <div class="ms-paso">
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Peticiones de oración"></label>
        <label class="ms-campo"><span>Nivel del dato <b class="ms-req">obligatorio</b></span></label>
        <div class="ms-niveles">
          ${I.NIVELES.map(n => `<button class="ms-nivbtn ${b.nivel === n.nivel ? "is-on" : ""}"
            data-accion="nivelmod" data-n="${n.nivel}">${pastilla(n.nivel)}<span>${esc(n["desc"])}</span></button>`).join("")}
        </div>
        ${b.nivel != null ? `<div class="ms-nota">Con dato N${b.nivel}, solo los roles con techo N${b.nivel}
          o mayor podrán recibir permisos aquí: <b>${M.rolesTodos().filter(r => r.techo >= b.nivel).length}</b>
          de ${M.rolesTodos().length} roles.
          ${b.nivel >= 3 ? " Además activa cifrado, bitácora de lectura y enmascarado." : ""}</div>` : ""}
      </div>` + pie(f, "Crear módulo", "hacer-modulo") + `</div>`;
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
      `Las ${M.matriz().length} filas de <code>sistema.matriz_permisos</code>. Una casilla en rojo no es un olvido: es el techo del rol impidiéndolo.`) + `
    <div class="ms-scroll"><table class="ms-tabla ms-matriz"><thead><tr><th>Rol</th>
    ${I.MODULOS.map(m => `<th title="${esc(m.nombre)}">${esc(m.codigo.slice(0,5))}<br>${pastilla(m.nivel)}</th>`).join("")}
    </tr></thead><tbody>
    ${I.ROLES.map(r => `<tr><td class="ms-rolcel"><b>${esc(r.nombre)}</b> ${pastilla(r.techo)}</td>
      ${I.MODULOS.map(m => {
        const n = M.matriz().filter(p => p.rol === r.codigo && p.modulo === m.codigo).length;
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


  /* ============================================================ PERMISOS DEL ROL
     Aquí se habilita y se deshabilita, casilla por casilla, qué puede
     hacer cada rol en cada módulo. La matriz es DATO: por eso se
     edita sin tocar el sistema.

     Lo único que no se puede saltar es el techo. Una casilla apagada
     se puede encender; una VEDADA no, y dice por qué. */
  function vPermisos() {
    const rolSel = (borrador && borrador.rolPerm) || I.ROLES[0].codigo;
    const r = I.rol(rolSel) || M.rolesTodos().find(x => x.codigo === rolSel);
    const verbos = I.ACCIONES.filter(a => /^[a-z]/.test(a.codigo));   // ver, crear, editar…
    const nombrados = I.ACCIONES.filter(a => /^[A-Z]/.test(a.codigo)); // ENTREGAR_MENOR…
    const total = M.permisosDelRol(rolSel).length;

    function celda(mod, acc) {
      const veto = I.rolPuedeModulo(rolSel, mod.codigo);
      const on = M.tienePermiso(rolSel, mod.codigo, acc);
      if (!veto.ok) return `<td><button class="ms-sw is-veda" disabled title="${esc(veto.razon)}"></button></td>`;
      return `<td><button class="ms-sw ${on ? "is-on" : ""}" data-accion="perm"
        data-mod="${esc(mod.codigo)}" data-acc="${esc(acc)}"
        title="${on ? "Quitar" : "Dar"} «${esc(acc)}» sobre ${esc(mod.nombre)}"
        aria-pressed="${on}"></button></td>`;
    }
    function tabla(titulo, acciones, nota) {
      return `<div class="ms-lbl" style="margin-top:18px">${esc(titulo)}</div>
      ${nota ? `<div class="ms-nota">${esc(nota)}</div>` : ""}
      <div class="ms-scroll"><table class="ms-grid-cfg"><thead><tr><th>Módulo</th>
        ${acciones.map(a => `<th>${esc(a.codigo.replace(/_/g, " "))}</th>`).join("")}
      </tr></thead><tbody>
      ${I.MODULOS.map(m => `<tr>
        <td><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}</td>
        ${acciones.map(a => celda(m, a.codigo)).join("")}
      </tr>`).join("")}</tbody></table></div>`;
    }

    return `<div class="ms-ancho">` + head("Qué puede hacer cada rol",
      "Casilla por casilla. Lo que quede encendido es lo que el rol podrá hacer en cada módulo.") + `
    <div class="ms-barra">
      <label class="ms-campo" style="margin:0;min-width:280px"><span>Rol</span>
        <select data-campo="rolPerm">
        ${M.rolesTodos().map(x => `<option value="${esc(x.codigo)}" ${x.codigo === rolSel ? "selected" : ""}>${esc(x.nombre)} · techo N${x.techo}</option>`).join("")}
        </select></label>
      <div class="ms-barra__sp"></div>
      <span class="ms-cuenta">${total} permiso(s) activos</span>
    </div>

    ${r ? `<div class="ms-alerta ${r.techo >= 3 ? "ms-alerta--ambar" : "ms-alerta--verde"}">
      <b>${esc(r.nombre)}</b> tiene techo ${pastilla(r.techo)}.
      Alcanza ${I.MODULOS.filter(m => I.rolPuedeModulo(rolSel, m.codigo).ok).length} de ${I.MODULOS.length} módulos.
      Los demás le quedan vedados y no hay forma de encenderlos: el techo es del rol, no de la asignación.
      ${r.techo >= 3 ? " Este rol toca dato sensible: cada permiso que le dé aquí queda en la bitácora." : ""}
    </div>` : ""}

    ${tabla("Verbos generales", verbos)}
    ${tabla("Acciones nombradas", nombrados,
      "Estas son las que de verdad importan en una iglesia: entregar un menor, ver notas confidenciales, anular un certificado. Un permiso de «editar» no las cubre.")}

    <div class="ms-leyenda" style="margin-top:16px">
      <span><i class="ms-sw is-on" style="pointer-events:none"></i> puede hacerlo</span>
      <span><i class="ms-sw" style="pointer-events:none"></i> no, pero se puede encender</span>
      <span><i class="ms-sw is-veda" style="pointer-events:none"></i> vedado por techo: no es otorgable</span>
    </div></div>`;
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
    const asg = M.asignaciones(), vig = a => !a.hasta || a.hasta >= hoy();
    return `<div class="ms-ancho">` + head("Iglesias y sedes",
      "Toda la red. Haga clic en una para ver su gobierno completo: quién la pastorea, quién tiene acceso y qué módulos ve.") + `
    <div class="ms-barra">
      <span class="ms-cuenta">${M.sedes().length} iglesias</span>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--primario" data-accion="ir" data-vista="n-iglesia">+ Crear iglesia</button>
    </div>
    <table class="ms-lista-t"><thead><tr>
      <th style="width:26px"></th><th>Iglesia</th><th style="width:110px">Código</th>
      <th>Plantilla</th><th>Pastores</th><th style="width:110px">Módulos</th>
      <th style="width:110px">Con acceso</th><th class="ms-acc-col"></th>
    </tr></thead><tbody>
    ${M.sedes().map(sd => {
      const past = asg.filter(a => vig(a) && a.alcanceId === sd.id && a.rol === "PASTOR_CONGREGACIONAL")
                      .map(a => M.persona(a.personaId)).filter(Boolean);
      const gente = new Set(asg.filter(a => vig(a) && a.alcanceId === sd.id).map(a => a.personaId));
      const mods = M.modsede().filter(x => x.sede === sd.id && x.activo).length;
      const pl = I.plantilla(sd.plantilla);
      return `<tr>
        <td><button class="ms-desp" data-accion="veriglesia" data-id="${esc(sd.id)}" title="Abrir ficha">›</button></td>
        <td><button class="ms-enlace ms-nom" data-accion="veriglesia" data-id="${esc(sd.id)}">${esc(sd.nombre)}</button>
            <span class="ms-sub">${esc(sd.ciudad || "")}${sd.pais ? " · " + esc(sd.pais) : ""}</span></td>
        <td><span class="ms-codigo">${esc(sd.codigo || "—")}</span></td>
        <td>${pl ? `<span class="ms-chip">${esc(pl.nombre)}</span>` : "<span class=ms-falta>sin plantilla</span>"}</td>
        <td>${past.length
          ? `<div class="ms-chips">${past.map(p => `<span class="ms-chip">${esc(p.nombre)}</span>`).join("")}</div>`
          : `<span class="ms-vig ms-vig--fin">Sin pastor</span>`}</td>
        <td class="num">${mods} de ${I.MODULOS.length}</td>
        <td class="num">${gente.size}</td>
        <td class="ms-acc-col">
          <button class="ms-btn ms-btn--peq" data-accion="veriglesia" data-id="${esc(sd.id)}">Ver todo</button></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  }

  /* ============================================================ FICHA DE IGLESIA
     Todo el gobierno de una sede en una pantalla: quién la pastorea,
     quién más tiene acceso y con qué permiso, qué módulos ve y qué
     ministerios y equipos tiene dentro. */
  function vIglesia() {
    const id = (borrador && borrador.verSede) || (M.sedes()[0] || {}).id;
    const sd = M.sedes().find(x => x.id === id);
    if (!sd) return head("Iglesia", "No existe esa sede.");
    const asg = M.asignaciones(), vig = a => !a.hasta || a.hasta >= hoy();
    const aqui = asg.filter(a => vig(a) && a.alcanceId === id);
    const past = aqui.filter(a => a.rol === "PASTOR_CONGREGACIONAL");
    const otros = aqui.filter(a => a.rol !== "PASTOR_CONGREGACIONAL");
    const mins = M.ministerios().filter(m => m.sedeId === id);
    const eqs = M.equipos().filter(e => e.sedeId === id);
    const pl = I.plantilla(sd.plantilla);
    const activos = M.modsede().filter(x => x.sede === id && x.activo).map(x => x.modulo);

    const filaAcceso = a => {
      const p = M.persona(a.personaId), r = I.rol(a.rol);
      const ef = I.permisoEfectivo([a]);
      return `<tr>
        <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(a.personaId)}">${esc(p ? p.nombre : a.personaId)}</button>
            <span class="ms-sub">${esc((p || {}).codigo || "")}</span></td>
        <td>${esc(r ? r.nombre : a.rol)}</td>
        <td>${pastilla(a.nivelMax)}</td>
        <td><div class="ms-chips">${ef.length
          ? ef.map(x => `<span class="ms-chip">${esc(x.nombre)}</span>`).join("")
          : "<i>ninguno</i>"}</div></td>
        <td>${a.delega ? `<span class="ms-vig ms-vig--ok">Puede nombrar</span>` : `<span class="ms-sub">no nombra</span>`}</td>
        <td>${vigencia(a)}</td>
        <td class="ms-acc-col"><button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="revocar" data-id="${esc(a.id)}">Cerrar</button></td>
      </tr>`;
    };

    return `<div class="ms-ancho">` + `
    <div class="ms-ficha__top">
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="iglesias">← Todas las iglesias</button>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="n-ministerio">+ Ministerio</button>
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="n-equipo">+ Equipo</button>
      <button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="ir" data-vista="crear">+ Otorgar acceso</button>
    </div>

    <div class="ms-head">
      <h1>${esc(sd.nombre)} <span class="ms-codigo" style="vertical-align:6px">${esc(sd.codigo || "")}</span></h1>
      <p>${esc(sd.ciudad || "")}${sd.pais ? " · " + esc(sd.pais) : ""}
         ${pl ? ` · plantilla <b>${esc(pl.nombre)}</b>: ${esc(pl["desc"] || "")}` : ""}</p>
    </div>

    <div class="ms-kpis">
      <div class="ms-kpi"><b>${past.length}</b><span>pastores</span></div>
      <div class="ms-kpi"><b>${aqui.length}</b><span>accesos vigentes</span></div>
      <div class="ms-kpi"><b>${activos.length}</b><span>de ${I.MODULOS.length} módulos</span></div>
      <div class="ms-kpi"><b>${mins.length}</b><span>ministerios</span></div>
    </div>

    ${!past.length ? `<div class="ms-alerta ms-alerta--roja">
      <b>Esta iglesia no tiene pastor asignado.</b> Una sede sin pastor no debería existir:
      la base lo exige y aquí quedó sin cumplir.</div>` : ""}
    ${past.length === 1 ? `<div class="ms-alerta ms-alerta--ambar">
      <b>Solo hay un pastor nombrado.</b> En Casa Sobre la Roca los pastores se nombran en
      matrimonio: falta la pastora.</div>` : ""}

    <div class="ms-lbl">Pastores</div>
    ${past.length ? `<table class="ms-tabla"><thead><tr>
      <th>Persona</th><th>Rol</th><th>Techo</th><th>Alcanza</th><th>Nombra</th><th>Vigencia</th><th></th>
    </tr></thead><tbody>${past.map(filaAcceso).join("")}</tbody></table>`
      : `<div class="ms-nota">Nadie la pastorea todavía.</div>`}

    <div class="ms-lbl" style="margin-top:22px">Otros accesos en esta iglesia (${otros.length})</div>
    ${otros.length ? `<table class="ms-tabla"><thead><tr>
      <th>Persona</th><th>Rol</th><th>Techo</th><th>Alcanza</th><th>Nombra</th><th>Vigencia</th><th></th>
    </tr></thead><tbody>${otros.map(filaAcceso).join("")}</tbody></table>`
      : `<div class="ms-nota">Nadie más tiene acceso a esta sede todavía.</div>`}

    <div class="ms-lbl" style="margin-top:22px">Qué ve esta iglesia</div>
    <div class="ms-nota">Encender o apagar aquí cambia lo que ven TODOS los de esta sede.
      Los módulos de dato sensible piden evidencia legal.</div>
    <div class="ms-modgrid">
      ${I.MODULOS.map(m => {
        const on = activos.indexOf(m.codigo) >= 0;
        return `<button class="ms-modtog ${on ? "is-on" : ""}" data-accion="cfg-mod"
          data-sede="${esc(id)}" data-mod="${esc(m.codigo)}" aria-pressed="${on}">
          <span class="ms-sw ${on ? "is-on" : ""}" aria-hidden="true"></span>
          <span><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}</span></button>`;
      }).join("")}
    </div>
    <div class="ms-acciones" style="margin-top:12px">
      ${I.PLANTILLAS.map(x => `<button class="ms-btn ms-btn--peq" data-accion="cfg-plant"
        data-sede="${esc(id)}" data-cod="${esc(x.codigo)}">Aplicar «${esc(x.nombre)}»</button>`).join("")}
    </div>

    <div class="ms-lbl" style="margin-top:22px">Paneles vivos en esta iglesia</div>
    <div class="ms-nota">Cada persona con rol aquí abre su propia pantalla. Si un módulo está apagado
      arriba, el panel que depende de él no abre, por mucho que la persona tenga el rol.</div>
    ${(() => {
      const filas = [];
      aqui.forEach(a => {
        I.panelesDe([a], (sid, mod) => M.moduloActivo(sid, mod)).forEach(x => {
          const per = M.persona(a.personaId);
          filas.push(`<tr>
            <td><b>${esc(x.nombre)}</b><span class="ms-sub">${esc(x.url)}</span></td>
            <td>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</td>
            <td><button class="ms-enlace" data-accion="verpersona" data-id="${esc(a.personaId)}">${esc(per ? per.nombre : "")}</button></td>
            <td>${x.abre ? `<span class="ms-vig ms-vig--ok">Abre</span>`
                         : `<span class="ms-vig ms-vig--fin">${x.encendido ? "techo insuficiente" : "módulo apagado"}</span>`}</td>
            <td class="ms-acc-col">${x.abre
              ? `<button class="ms-btn ms-btn--peq" data-accion="abrirpanel" data-url="${esc(x.url)}" data-lbl="${esc(x.nombre)}">Entrar</button>` : ""}</td>
          </tr>`);
        });
      });
      return filas.length
        ? `<table class="ms-tabla"><thead><tr><th>Panel</th><th>Rol</th><th>Quién</th><th>Estado</th><th></th></tr></thead>
           <tbody>${filas.join("")}</tbody></table>`
        : `<div class="ms-nota">Ningún panel vivo: nadie tiene todavía un rol con pantalla en esta sede.</div>`;
    })()}

    <div class="ms-lbl" style="margin-top:22px">Ministerios (${mins.length}) y equipos (${eqs.length})</div>
    ${mins.length || eqs.length ? `<table class="ms-tabla"><thead><tr>
      <th>Unidad</th><th>Código</th><th>Tipo</th><th>A cargo</th></tr></thead><tbody>
      ${mins.map(m => {
        const l = asg.find(a => vig(a) && a.alcanceId === m.codigo && a.rol === "DIRECTOR_MINISTERIO");
        const per = l && M.persona(l.personaId);
        return `<tr><td><b>${esc(m.nombre)}</b></td><td><span class="ms-codigo">${esc(m.codTrabajo || "—")}</span></td>
          <td>Ministerio</td><td>${per
            ? `<button class="ms-enlace" data-accion="verpersona" data-id="${esc(per.id)}">${esc(per.nombre)}</button>`
            : `<span class="ms-falta">sin director</span>`}</td></tr>`;
      }).join("")}
      ${eqs.map(e => { const per = M.persona(e.liderId);
        return `<tr><td><b>${esc(e.nombre)}</b></td><td><span class="ms-codigo">${esc(e.codTrabajo || "—")}</span></td>
          <td>Equipo ${esc(e.ambito)}</td><td>${per
            ? `<button class="ms-enlace" data-accion="verpersona" data-id="${esc(per.id)}">${esc(per.nombre)}</button>`
            : `<span class="ms-falta">sin responsable</span>`}</td></tr>`;
      }).join("")}
    </tbody></table>` : `<div class="ms-nota">Esta iglesia no tiene ministerios ni equipos creados.</div>`}
    </div>`;
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
    const url = (borrador && borrador.panelUrl) || n.src;
    const lbl = (borrador && borrador.panelLbl) || n.lbl;
    const pn = I.PANELES.filter(x => x.url === url);
    const quien = [];
    M.personas().forEach(p => {
      I.panelesDe(M.deLaPersona(p.id), (sid, m) => M.moduloActivo(sid, m))
        .filter(x => x.url === url && x.abre).forEach(() => quien.push(p));
    });
    return `<div class="ms-ancho">` + head(lbl,
      "No es una demo suelta: es lo que ve quien tiene este rol. Se abre aquí dentro, con el patrón de panel anidado.") + `
    ${pn.length ? `<div class="ms-panelinfo">
      ${pn.map(x => `<div>
        <div class="ms-lbl">Lo abre</div>
        <div class="ms-val">${esc((I.rol(x.rol)||{}).nombre || x.rol)}
          <span class="ms-sub" style="font-family:var(--ui)">alcance ${esc((I.alcance(x.alcance)||{}).nombre || x.alcance)}</span></div>
        <div class="ms-lbl" style="margin-top:10px">Depende del módulo</div>
        <div class="ms-val">${esc((I.modulo(x.modulo)||{}).nombre || x.modulo)} ${pastilla((I.modulo(x.modulo)||{}).nivel)}
          <span class="ms-sub" style="font-family:var(--ui)">si la iglesia lo apaga, este panel no abre</span></div>
        ${x.crea && x.crea.length ? `<div class="ms-lbl" style="margin-top:10px">Desde aquí se crea</div>
          <div class="ms-chips">${x.crea.map(c => `<span class="ms-chip">${esc(c)}</span>`).join("")}</div>` : ""}
      </div>`).join("")}
      <div>
        <div class="ms-lbl">Quién lo abre hoy (${quien.length})</div>
        <div class="ms-chips">${quien.length
          ? quien.map(p => `<button class="ms-chip" style="cursor:pointer" data-accion="verpersona" data-id="${esc(p.id)}">${esc(p.nombre)}</button>`).join("")
          : "<i>nadie todavía</i>"}</div>
      </div>
    </div>` : ""}
    <div class="ms-marco"><iframe src="${esc(url)}" title="${esc(lbl)}" loading="lazy"></iframe></div>
    <div class="ms-nota">Origen: <code>${esc(url)}</code>. Si diera 404, es que no se desplegó junto
      al master: ambos deben publicarse en el mismo sitio.</div></div>`;
  }

  /* ============================================================ SHELL */
  function shell(html) {
    const yo = M.deLaPersona(YO.personaId), ef = I.permisoEfectivo(yo);
    return `
    <header class="ms-top">
      <div class="ms-marca"><div class="ms-logo">CR</div>
        <div><b>Casa Roca · Sistema Master</b><small>Dirección General · 36 iglesias</small></div></div>
      <div class="ms-sp"></div>
      <button class="ms-ck" data-accion="abrircmd" title="Ir a cualquier parte">
        <span>Buscar o ir a…</span><kbd>\u2318K</kbd></button>
      <div class="ms-crear">
        <button class="ms-btn ms-btn--primario" data-accion="menucrear">+ Crear</button>
        <div class="ms-crear__men ${menuCrear ? "is-on" : ""}">
          ${[["n-persona","👤","Persona"],["n-iglesia","⛪","Iglesia"],
             ["n-ministerio","🗂️","Ministerio"],["n-equipo","🤝","Equipo administrativo"],
             ["crear","🔑","Acceso a una persona"],["n-rol","🎭","Rol"],["n-modulo","🧩","Módulo"]]
            .map(([id,ic,l]) => `<button data-accion="ir" data-vista="${id}"><span>${ic}</span>${l}</button>`).join("")}
        </div>
      </div>
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
    </div>
    <div class="ms-cmd" id="ms-cmd" role="dialog" aria-modal="true" aria-label="Ir a">
      <div class="ms-cmd__caja">
        <input class="ms-cmd__in" id="ms-cmd-in" placeholder="Pestaña, persona o rol…" autocomplete="off">
        <div class="ms-cmd__lista" id="ms-cmd-lista"></div>
      </div>
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
      case "permisos":  html = vPermisos();break;
      case "efectivo":  html = vEfectivo();break;
      case "bitacora":  html = vBitacora();break;
      case "contraste": html = vContraste();break;
      case "arranque":  html = vArranque(); break;
      case "comando":   html = vComando();  break;
      case "persona":   html = vPersona();  break;
      case "iglesia":   html = vIglesia();  break;
      case "n-persona": html = vNPersona(); break;
      case "n-iglesia": html = vNIglesia(); break;
      case "n-ministerio": html = vNMinisterio(); break;
      case "n-equipo":  html = vNEquipo();  break;
      case "n-rol":     html = vNRol();     break;
      case "n-modulo":  html = vNModulo();  break;
      case "iglesias":  html = vIglesias();break;
      case "modsede":   html = vModSede(); break;
      default:          html = n.mod ? vModulo(n.mod) : vTablero();
    }
    document.getElementById("app").innerHTML = shell(html);
  }

  /* ---------- eventos ---------- */
  document.addEventListener("click", e => {
    const bt = e.target.closest("[data-accion]");
    if (!bt) { if (menuCrear && !e.target.closest(".ms-crear")) { menuCrear = false; pintar(); } return; }
    const a = bt.dataset.accion;
    if (menuCrear && a !== "menucrear") menuCrear = false;
    if (a === "abrircmd") { cmdAbrir(); return; }
    if (a === "menucrear") { menuCrear = !menuCrear; pintar(); return; }

    const b = b_();
    if (a === "plantilla")  { b.plantilla = bt.dataset.cod; pintar(); return; }
    if (a === "techo")      { b.techo   = +bt.dataset.n; pintar(); return; }
    if (a === "nivelmod")   { b.nivel   = +bt.dataset.n; pintar(); return; }
    if (a === "ambito")     { b.ambito  = bt.dataset.v; if (b.ambito !== "local") b.sedeId = ""; pintar(); return; }
    if (a === "equipo-atajo") {
      const e = I.EQUIPOS.find(x => x.codigo === bt.dataset.cod);
      if (e) { b.nombre = e.nombre; b.ambito = e.ambito; b.roles = e.roles.slice(); }
      pintar(); return;
    }
    if (a === "desplegar")  { b.verPersona = bt.dataset.id; vista = "persona"; pintar(); return; }
    if (a === "abrirpanel") { b.panelUrl = bt.dataset.url; b.panelLbl = bt.dataset.lbl;
      vista = "app-pastor"; pintar(); return; }
    if (a === "veriglesia") { b.verSede = bt.dataset.id; vista = "iglesia"; pintar(); return; }
    if (a === "verpersona") { b.verPersona = bt.dataset.id; vista = "persona"; pintar(); return; }
    if (a === "verefectivo"){ b.verPersona = bt.dataset.id; vista = "persona"; pintar(); return; }
    if (a === "verefectivo2"){ b.verPersona = bt.dataset.id; vista = "efectivo"; pintar(); return; }
    if (a === "agregarrol") { borrador = { personaId: bt.dataset.id }; vista = "crear"; pintar(); return; }
    if (a === "delegar")    { M.alternarDelegacion(bt.dataset.id); pintar(); return; }
    if (a === "cerrar-sel") {
      const ids = Array.from(document.querySelectorAll("[data-marca]:checked")).map(x => x.dataset.marca);
      if (!ids.length) return;
      if (!confirm(`Se cerrará el acceso de ${ids.length} asignación(es). Queda registrado en la bitácora y no se borra nada. ¿Continuar?`)) return;
      M.revocarVarios(ids, "cierre en lote desde el master"); pintar(); return;
    }
    if (a === "perm-todos") {
      const b2 = b_(); b2.permisos = {};
      if (bt.dataset.niv) {
        const techo = b2.techo != null ? +b2.techo : 4;
        I.MODULOS.forEach(m => { if (m.nivel <= techo) b2.permisos[m.codigo] = bt.dataset.niv; });
      }
      pintar(); return;
    }
    if (a === "perm") {
      const rs = (borrador && borrador.rolPerm) || I.ROLES[0].codigo;
      const r2 = M.alternarPermiso(rs, bt.dataset.mod, bt.dataset.acc);
      if (!r2.ok) alert(r2.fallos.join("\n"));
      pintar(); return;
    }
    if (a === "cfg-sede")   { cfgSede = bt.dataset.id; pintar(); return; }
    if (a === "cfg-mod")    { M.alternarModulo(bt.dataset.sede, bt.dataset.mod); pintar(); return; }
    if (a === "cfg-plant")  { M.aplicarPlantilla(bt.dataset.sede, bt.dataset.cod); pintar(); return; }

    /* ---- creaciones: si vino nombre nuevo, se crea la ficha primero ---- */
    function resolverPersona(campo) {
      if (b[campo]) return b[campo];
      const n = (b[campo + "_nueva"] || "").trim();
      return n ? M.crearPersona(n, "", "").id : "";
    }
    function hecho(r, destino, msg) {
      if (!r.ok) { alert("No se puede crear:\n\n" + r.fallos.join("\n")); return; }
      borrador = null; vista = destino; pintar();
    }
    if (a === "hacer-persona")  { M.crearPersona(b.nombre, b.documento, b.correo); borrador = null; vista = "accesos"; pintar(); return; }
    if (a === "hacer-iglesia")  { hecho(M.crearIglesia({ nombre:b.nombre, ciudad:b.ciudad, pais:b.pais,
                                    plantilla:b.plantilla, pastorId:resolverPersona("pastorId"),
                                    otorgadoPor:YO.personaId }), "iglesias"); return; }
    if (a === "hacer-ministerio"){ hecho(M.crearMinisterio({ nombre:b.nombre, sedeId:b.sedeId,
                                    liderId:resolverPersona("liderId"), otorgadoPor:YO.personaId }), "accesos"); return; }
    if (a === "hacer-equipo")   { hecho(M.crearEquipo({ nombre:b.nombre, ambito:b.ambito, sedeId:b.sedeId,
                                    roles:b.roles || [], liderId:resolverPersona("liderId"),
                                    otorgadoPor:YO.personaId }), "accesos"); return; }
    if (a === "hacer-rol")      { hecho(M.crearRol({ nombre:b.nombre, techo:b.techo }), "roles"); return; }
    if (a === "hacer-modulo")   { hecho(M.crearModulo({ nombre:b.nombre, nivel:b.nivel }), "matriz"); return; }
    if (a === "ir") { if (borrador) { delete borrador.panelUrl; delete borrador.panelLbl; }
      vista = bt.dataset.vista; pintar(); const m = $("#ms-main"); if (m) m.focus(); }
    if (a === "nivel")   { b_().nivelMax = +bt.dataset.n; pintar(); }
    if (a === "limpiar") { borrador = null; pintar(); }
    if (a === "revocar") {
      const r = M.revocar(bt.dataset.id, "cierre desde el master");
      if (!r.ok) alert(r.fallos.join("\n")); pintar();
    }
    if (a === "otorgar") {
      const bo = b_();
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
    const pr = e.target.closest("[data-perm-campo]");
    if (pr) {
      const b2 = b_(); const campo = pr.dataset.permCampo;
      b2[campo] = b2[campo] || {};
      if (pr.dataset.permNiv) b2[campo][pr.dataset.permMod] = pr.dataset.permNiv;
      else delete b2[campo][pr.dataset.permMod];
      pintar(); return;
    }
    const dl = e.target.closest("[data-delega]");
    if (dl) { M.alternarDelegacion(dl.dataset.delega); pintar(); return; }
    const rc = e.target.closest("[data-rol]");
    if (rc) {
      const b = b_(); b.roles = b.roles || [];
      const cod = rc.dataset.rol, i = b.roles.indexOf(cod);
      if (rc.checked && i < 0) b.roles.push(cod); else if (!rc.checked && i >= 0) b.roles.splice(i, 1);
      pintar(); return;
    }
    if (e.target.dataset && e.target.dataset.marca !== undefined) return;  // marcas de lote: sin repintar
    const c = e.target.closest("[data-campo]"); if (!c) return;
    const k = c.dataset.campo;
    if (k === "verPersona") { b_().verPersona = c.value; pintar(); return; }
    if (k === "filtro")     { filtro = c.value; pintar(); return; }
    b_()[k] = c.value;
    if (k === "alcanceTipo") borrador.alcanceId = "";
    if (k === "rol") { const r = I.rol(c.value);
      if (r && borrador.nivelMax > r.techo) borrador.nivelMax = r.techo; }
    pintar();
  });
  document.addEventListener("input", e => {
    const c = e.target.closest("[data-campo]");
    if (!c || c.tagName !== "INPUT") return;
    if (c.dataset.campo === "filtro") { filtro = c.value; pintar(); const f = $("[data-campo=filtro]");
      if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } return; }
    b_()[c.dataset.campo] = c.value;
  });

  /* ============================================================
     BARRA DE COMANDOS · el gesto de Linear.
     Con 36 iglesias y 30 pestañas, el menú deja de servir: lo que
     sirve es escribir tres letras. Indexa pestañas, personas y roles.
     ============================================================ */
  let cmdAbierta = false, cmdSel = 0, cmdRes = [];

  function cmdIndice() {
    const idx = [];
    NAV.forEach(n => { if (!n.sep) idx.push({ t:"Pestaña", txt:n.lbl, ico:n.ico, ir:n.id }); });
    M.personas().forEach(p => {
      const vig = M.deLaPersona(p.id).filter(a => !a.hasta || a.hasta >= hoy());
      idx.push({ t:"Persona", txt:p.nombre, ico:"👤",
        pista: vig.length ? (I.rol(vig[0].rol)||{}).nombre : "sin acceso",
        ir:"efectivo", persona:p.id });
    });
    I.ROLES.forEach(r => idx.push({ t:"Rol", txt:r.nombre, ico:"🎭",
      pista:"techo N" + r.techo, ir:"roles" }));
    return idx;
  }
  function cmdPintar(q) {
    const norm = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const t = norm(q || "").trim();
    cmdRes = cmdIndice().filter(x => !t || norm(x.txt).indexOf(t) >= 0 || norm(x.t).indexOf(t) >= 0)
                        .slice(0, 40);
    if (cmdSel >= cmdRes.length) cmdSel = 0;
    const cont = document.getElementById("ms-cmd-lista"); if (!cont) return;
    cont.innerHTML = cmdRes.length
      ? cmdRes.map((x, i) => `<button class="ms-cmd__it ${i === cmdSel ? "is-sel" : ""}" data-cmd="${i}">
          <span>${x.ico}</span><span>${esc(x.txt)}</span>
          <em>${esc(x.pista || x.t)}</em></button>`).join("")
      : `<div class="ms-cmd__vac">Nada coincide con «${esc(q)}».</div>`;
  }
  function cmdIr(i) {
    const x = cmdRes[i]; if (!x) return;
    if (x.persona) { borrador = borrador || {}; borrador.verPersona = x.persona; }
    vista = x.ir; cmdCerrar(); pintar();
  }
  function cmdAbrir() {
    const c = document.getElementById("ms-cmd"); if (!c) return;
    cmdAbierta = true; cmdSel = 0; c.classList.add("is-on");
    const inp = document.getElementById("ms-cmd-in");
    inp.value = ""; cmdPintar(""); inp.focus();
  }
  function cmdCerrar() {
    cmdAbierta = false;
    const c = document.getElementById("ms-cmd"); if (c) c.classList.remove("is-on");
  }
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); cmdAbierta ? cmdCerrar() : cmdAbrir(); return; }
    if (!cmdAbierta) return;
    if (e.key === "Escape") { e.preventDefault(); cmdCerrar(); }
    if (e.key === "ArrowDown") { e.preventDefault(); cmdSel = Math.min(cmdSel + 1, cmdRes.length - 1); cmdPintar(document.getElementById("ms-cmd-in").value); }
    if (e.key === "ArrowUp")   { e.preventDefault(); cmdSel = Math.max(cmdSel - 1, 0); cmdPintar(document.getElementById("ms-cmd-in").value); }
    if (e.key === "Enter")     { e.preventDefault(); cmdIr(cmdSel); }
  });
  document.addEventListener("input", e => {
    if (e.target.id === "ms-cmd-in") { cmdSel = 0; cmdPintar(e.target.value); }
  });
  document.addEventListener("click", e => {
    if (e.target.id === "ms-cmd") { cmdCerrar(); return; }
    const it = e.target.closest("[data-cmd]");
    if (it) cmdIr(+it.dataset.cmd);
  });

  document.addEventListener("DOMContentLoaded", pintar);
  if (document.readyState !== "loading") pintar();
})();
