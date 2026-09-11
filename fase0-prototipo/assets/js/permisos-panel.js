/* ============================================================
   CASA ROCA · EL PUENTE ENTRE EL MASTER Y LOS PANELES

   El defecto que esto arregla, encontrado por Daniel el 11 de
   septiembre de 2026: «le desactivé CRM y entré al sistema y aún lo
   podía ver». Tenía razón y era grave.

   Las apps por rol (pastor, director, líder, nicodemo, RocaKids,
   consejería) se escribieron antes que el sistema de permisos, y
   dibujaban su menú COMPLETO sin preguntarle a nadie. El master
   calculaba el permiso efectivo con todo rigor y luego nadie lo
   miraba: quedaba en un tablero bonito sin efecto.

   Este archivo lo conecta. Va en cada app junto a master-identidad.js
   y hace tres cosas:

     1. Averigua QUIÉN entró (el master lo deja escrito al abrir).
     2. Calcula qué módulos alcanza, con el mismo motor del master.
     3. Oculta las pestañas cuyo módulo no alcanza, y bloquea la
        navegación hacia ellas aunque alguien fuerce la URL.

   ⚠️ Esto es un control de INTERFAZ, no de seguridad. La seguridad de
   verdad la impone el RLS de PostgreSQL: aunque alguien borrara este
   archivo, la base seguiría sin devolverle filas ajenas. Aquí se evita
   ofrecer lo que allá va a ser negado, que es distinto.
   ============================================================ */
(function () {
  "use strict";
  const I = window.IDENTIDAD;
  if (!I) { console.warn("[permisos] falta master-identidad.js"); return; }

  /* ---------- 1 · qué pestaña corresponde a qué módulo ----------
     Se saca de las NAV reales de cada app, una por una. Si una pestaña
     no está aquí, se deja pasar: más vale mostrar de más que romper una
     app por un mapeo olvidado. */
  const MAPA = {
    "pastor.html": {
      analitica:"analitica", tareas:"tareas", crm:"crm", finanzas:"aportes",
      asistencia:"asistencia", organigrama:"organizacion", calendario:"calendario",
      grupos:"grupos", equipo:"talento", sirve:"talento", rocakids:"rocakids",
      tematicas:"tematicas", cursos:"formacion", oracion:"oracion",
      consejeria:"consejeria", requerimientos:"requerimientos", directorio:"personas",
    },
    "central.html": {
      tablero:"organizacion", crm:"crm", finanzas:"aportes", organigrama:"organizacion",
      calendario:"calendario", equipo:"talento", contabilidad:"aportes",
      tesoreria:"aportes", rrhh:"talento", legal:"legal", instituto:"formacion",
      comunicaciones:"comunicaciones", construccion:"construccion",
      peticiones:"peticiones", requerimientos:"requerimientos", directorio:"personas",
    },
    "director.html": {
      analitica:"analitica", crm:"crm", grupos:"grupos", equipo:"talento",
      nuevos:"crm", organigrama:"organizacion", tematicas:"tematicas",
      peticiones:"peticiones", calendario:"calendario",
    },
    "nicodemo.html": {
      analitica:"analitica", bucket:"crm", equipo:"talento",
      organigrama:"organizacion", peticiones:"peticiones", calendario:"calendario",
    },
  };

  const archivo = location.pathname.split("/").pop() || "";
  const mapa = MAPA[archivo];
  if (!mapa) return;                       // app sin mapeo: no se toca

  /* ---------- 2 · quién entró ---------- */
  function contexto() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem("casaroca_master_v1") || "null"); } catch (e) {}
    if (!d || !d.asignaciones) return null;
    let pid = null;
    try { pid = localStorage.getItem("casaroca_panel_persona"); } catch (e) {}
    if (!pid) return null;                 // sin persona declarada, no se filtra
    const persona = (d.personas || []).find(p => p.id === pid);
    const asig = d.asignaciones.filter(a => a.personaId === pid);
    /* Lo que la IGLESIA tiene encendido. Sin esto, apagar un módulo en
       una sede no tendría ningún efecto sobre quien la opera. */
    const ms = d.modsede || [];
    const activoEnSede = (sedeId, modulo) => {
      const r = ms.find(x => x.sede === sedeId && x.modulo === modulo);
      return !!(r && r.activo);
    };
    return { persona, asignaciones: asig, activoEnSede };
  }

  const ctx = contexto();
  if (!ctx) {
    console.info("[permisos] sin persona declarada: el panel se muestra completo.");
    return;
  }
  const alcanzados = I.permisoEfectivo(ctx.asignaciones, null, null, ctx.activoEnSede)
    .map(x => x.modulo);
  const permitido = id => {
    const m = mapa[id];
    return !m || alcanzados.indexOf(m) >= 0;
  };

  /* ---------- 3 · aplicar, y volver a aplicar ----------
     Las apps redibujan su menú entero en cada navegación, así que no
     basta con filtrar una vez: hay que observar el DOM. */
  function aplicar() {
    let ocultas = 0;
    document.querySelectorAll("[data-vista]").forEach(el => {
      const v = el.dataset.vista;
      if (!v || permitido(v)) return;
      el.style.display = "none";
      el.setAttribute("data-permiso-oculto", "1");
      ocultas++;
    });
    return ocultas;
  }

  /* Si alguien fuerza la navegación a una vista vedada, se corta el
     clic antes de que la app la pinte. */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-vista]");
    if (!b) return;
    if (permitido(b.dataset.vista)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    alert("Su rol no alcanza esta sección.\n\nSi debería verla, pídalo en el sistema master: es ahí donde se otorga.");
  }, true);

  function aviso(n) {
    if (!n || document.getElementById("cr-aviso-permisos")) return;
    const d = document.createElement("div");
    d.id = "cr-aviso-permisos";
    d.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:9999;max-width:320px;" +
      "background:#fff;border:1px solid #e6e6e9;border-left:3px solid #134291;border-radius:8px;" +
      "padding:9px 12px;font:400 12px/17px Inter,system-ui,sans-serif;color:#57575e;" +
      "box-shadow:0 4px 12px rgba(20,20,24,.08)";
    d.innerHTML = "<b style='color:#1c1c1f'>" + (ctx.persona ? ctx.persona.nombre : "Sesión") + "</b><br>" +
      n + " sección(es) ocultas porque su rol no las alcanza. " +
      "<span style='color:#8b8b93'>Se otorgan en el sistema master.</span>";
    document.body.appendChild(d);
  }

  function ciclo() { aviso(aplicar()); }
  document.addEventListener("DOMContentLoaded", ciclo);
  if (document.readyState !== "loading") ciclo();
  new MutationObserver(() => aplicar()).observe(document.documentElement,
    { childList: true, subtree: true });
})();
