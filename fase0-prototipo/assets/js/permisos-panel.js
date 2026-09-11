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
    "lider.html": {
      resumen:"grupos", grupo:"grupos", analisis:"analitica",
      tematicas:"tematicas", tematicaDetalle:"tematicas",
      peticiones:"peticiones", notis:"peticiones", app:"grupos",
    },
    "rocakids-domingo.html":  { "*":"rocakids" },
    "rocakids-director.html": { "*":"rocakids" },
    "consejeria-consejero.html":   { "*":"consejeria" },
    "consejeria-coordinador.html": { "*":"consejeria" },
    "consejeria-director.html":    { "*":"consejeria" },
  };

  const archivo = location.pathname.split("/").pop() || "";
  const mapa = MAPA[archivo];
  if (!mapa) return;                       // app sin mapeo: no se toca

  /* ---------- 2 · quién entró ---------- */
  function contexto() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem("casaroca_master_v1") || "null"); } catch (e) {}
    if (!d || !d.asignaciones) return null;
    /* Lo que la IGLESIA tiene encendido, primero: lo necesitan los dos
       caminos, el real y la vista previa. */
    const msRows = d.modsede || [];
    const activo = (sedeId, modulo) => {
      const r = msRows.find(x => x.sede === sedeId && x.modulo === modulo);
      return !!(r && r.activo);
    };

    /* ⭐ VISTA PREVIA. El master la usa para comprobar la configuración de
       una iglesia ANTES de que exista nadie a quien nombrar, que es
       justo cuando hace falta mirarla. No crea nada: es una asignación
       de mentira que vive en el navegador y se borra al salir. */
    let sim = null;
    try { sim = JSON.parse(localStorage.getItem("casaroca_panel_simulado") || "null"); } catch (e) {}
    if (sim && sim.rol) {
      return { persona: { nombre: sim.etiqueta || "Vista previa" },
               asignaciones: [sim], activoEnSede: activo, previa: true };
    }

    let pid = null;
    try { pid = localStorage.getItem("casaroca_panel_persona"); } catch (e) {}
    if (!pid) return null;                 // sin persona declarada, no se filtra
    const persona = (d.personas || []).find(p => p.id === pid);
    const asig = d.asignaciones.filter(a => a.personaId === pid);
    return { persona, asignaciones: asig, activoEnSede: activo };
  }

  const ctx = contexto();

  /* ⛔⛔ ESTO ESTABA AL REVÉS Y ERA EL DEFECTO DE FONDO.
     Antes, si no se sabía quién entraba, el panel se abría COMPLETO.
     Eso es «permitir por defecto», y en permisos la regla es la
     contraria: lo que no está otorgado, no se ve.

     Daniel lo dijo exacto: «si yo no le activo, él no debería ver nada».
     Tiene razón, y no es un matiz: con el criterio viejo bastaba con
     abrir pastor.html directamente, sin pasar por el master, para verlo
     todo. El control no servía de nada.

     Ahora sin sesión declarada no se muestra ni una pestaña, y se
     explica por qué en vez de dejar una pantalla muda. */
  if (!ctx) {
    cerrarTodo("Este panel no tiene sesión.",
      "Ábralo desde el sistema master, que es donde se dice quién entra y qué alcanza. " +
      "Abrirlo directamente no da acceso a nada: lo que no está otorgado, no se ve.");
    return;
  }
  if (ctx.previa) document.documentElement.setAttribute("data-vista-previa", "1");
  const alcanzados = I.permisoEfectivo(ctx.asignaciones, null, null, ctx.activoEnSede)
    .map(x => x.modulo);
  /* Si el mapa dice "*", la app entera depende de un solo módulo. */
  const moduloDeLaApp = mapa["*"] || null;
  const sinMapear = [];
  const permitido = id => {
    if (moduloDeLaApp) return alcanzados.indexOf(moduloDeLaApp) >= 0;
    const m = mapa[id];
    if (!m) { if (sinMapear.indexOf(id) < 0) sinMapear.push(id); return false; }
    return alcanzados.indexOf(m) >= 0;
  };

  /* ---------- 3 · aplicar, y volver a aplicar ----------
     Las apps redibujan su menú entero en cada navegación, así que no
     basta con filtrar una vez: hay que observar el DOM. */
  function cerrarTodo(titulo, detalle) {
    const pinta = () => {
      if (document.getElementById("cr-sin-sesion")) return;
      const d = document.createElement("div");
      d.id = "cr-sin-sesion";
      d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fafafa;" +
        "display:grid;place-items:center;padding:24px;" +
        "font:400 14px/21px Inter,system-ui,sans-serif;color:#57575e";
      d.innerHTML = "<div style='max-width:420px;text-align:center;background:#fff;" +
        "border:1px solid #e6e6e9;border-radius:12px;padding:32px'>" +
        "<div style='width:40px;height:40px;margin:0 auto 16px;border-radius:10px;" +
        "background:#134291;color:#fff;display:grid;place-items:center;font-weight:600'>CR</div>" +
        "<div style='font-size:17px;font-weight:600;color:#1c1c1f;margin-bottom:8px'>" + titulo + "</div>" +
        "<div style='font-size:13px;line-height:20px'>" + detalle + "</div></div>";
      document.body.appendChild(d);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pinta);
    else pinta();
    new MutationObserver(pinta).observe(document.documentElement, { childList: true, subtree: true });
  }

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
      n + " sección(es) ocultas porque " + (ctx.previa ? "este rol" : "su rol") + " no las alcanza. " +
      "<span style='color:#8b8b93'>" +
      (ctx.previa ? "Vista previa: nadie ocupa este rol todavía." : "Se otorgan en el sistema master.") +
      "</span>";
    document.body.appendChild(d);
  }

  function ciclo() {
    const n = aplicar();
    const quedan = Array.from(document.querySelectorAll("[data-vista]"))
      .filter(el => el.style.display !== "none").length;
    /* Si no alcanza ni una sola pestaña, no se deja una app vacía y
       confusa: se dice claramente que no tiene nada otorgado aquí. */
    if (!quedan && document.querySelectorAll("[data-vista]").length) {
      cerrarTodo((ctx.persona ? ctx.persona.nombre : "Esta persona") + " no tiene nada aquí.",
        "No se le ha otorgado ningún módulo de este panel. Se otorgan en el sistema master, " +
        "en la ficha de la persona o en la de su iglesia.");
      return;
    }
    if (sinMapear.length) console.info("[permisos] pestañas sin mapear, ocultas por defecto:", sinMapear);
    aviso(n);
  }
  document.addEventListener("DOMContentLoaded", ciclo);
  if (document.readyState !== "loading") ciclo();
  new MutationObserver(() => aplicar()).observe(document.documentElement,
    { childList: true, subtree: true });
})();
