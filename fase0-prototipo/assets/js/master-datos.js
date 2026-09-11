/* ============================================================
   CASA ROCA · EL CANAL ENTRE EL CENTRO DE MANDO Y LA IGLESIA LOCAL

   Orden de Daniel, 11 de septiembre de 2026:
     «todo debe funcionar desde el centro de mando, todo lo que se ponga
      allí es lo que debe aparecer en las diferentes iglesias locales, y
      cada pastor debe tener el acceso de crear y modificar ministerios y
      grupos pequeños (aunque desde el centro de mando también); la idea
      es que cada pastor arme su equipo y ministerio y grupos pequeños».

   Hasta hoy cruzaban dos cosas del master al panel: QUÉ módulos ve la
   persona y, desde esta misma mañana, QUIÉN es. Los datos no cruzaban
   nada: cada app pintaba su propio juego sembrado. Por eso una iglesia
   nueva como Barcelona nacía enseñando los ministerios y los grupos de
   Bogotá Chicó, que no son suyos.

   Este archivo abre el tercer carril, el de los datos, y lo abre en los
   DOS sentidos:

     leer    · window.CENTRO.ministerios() / .grupos()  → lo que el centro
               de mando tiene puesto para ESTA iglesia, no para otra.
     escribir· .crearGrupo() / .editarGrupo() / .cerrarGrupo()
               .crearMinisterio()
               → el pastor construye su iglesia desde su panel, y queda
                 escrito en el mismo sitio del que bebe el centro de mando.

   ⚠️ Escribir pasa por las mismas tres puertas que mirar: la iglesia tiene
   que tener el módulo encendido, la persona tiene que alcanzarlo, y el
   alcance tiene que ser esa sede. No hay una puerta trasera para el
   pastor: que pueda construir su equipo no es una excepción al permiso,
   es un permiso más.
   ============================================================ */
(function () {
  "use strict";
  const M = window.MSTORE, I = window.IDENTIDAD;
  if (!M || !I) { console.warn("[centro] falta master-store.js o master-identidad.js"); return; }

  /* Quién entró y a qué iglesia. Es la misma lectura que hace el puente
     de permisos: una sola verdad sobre la sesión, no dos que se
     contradigan. */
  function sesion() {
    let sim = null, pid = null;
    try { sim = JSON.parse(localStorage.getItem("casaroca_panel_simulado") || "null"); } catch (e) {}
    if (sim && sim.rol) {
      return { personaId:null, previa:true, rol:sim.rol,
               sedeId: sim.alcanceTipo === "sede" ? sim.alcanceId : null };
    }
    try { pid = localStorage.getItem("casaroca_panel_persona"); } catch (e) {}
    if (!pid) return null;
    const asg = M.deLaPersona(pid);
    const deSede = asg.find(a => a.alcanceTipo === "sede");
    return { personaId:pid, previa:false, rol:(deSede || asg[0] || {}).rol || null,
             sedeId: deSede ? deSede.alcanceId : null };
  }

  const S = sesion();
  if (!S) return;                                  // sin sesión no se abre el canal
  const sede = S.sedeId ? (M.sedes().find(x => x.id === S.sedeId) || null) : null;

  /* En vista previa nadie ha sido nombrado todavía, así que no hay a quién
     atribuir lo que se escriba. Se puede MIRAR, no escribir: si no, el
     sistema acumularía grupos creados por «nadie». */
  function escritor() {
    if (S.previa) return { ok:false, razon:"Esto es una vista previa: no hay nadie nombrado a quien atribuir el cambio. Nombre al pastor en el centro de mando y vuelva a entrar." };
    if (!S.sedeId) return { ok:false, razon:"Esta sesión no está atada a una iglesia concreta." };
    return { ok:true };
  }

  function envolver(fn) {
    return function () {
      const e = escritor();
      if (!e.ok) return { ok:false, fallos:[e.razon] };
      return fn.apply(null, arguments);
    };
  }

  window.CENTRO = {
    sedeId:     S.sedeId,
    sedeNombre: sede ? sede.nombre : null,
    personaId:  S.personaId,
    previa:     S.previa,

    /* ¿Puede quien entró tocar este módulo en esta iglesia? La pantalla
       pregunta esto ANTES de ofrecer un botón, para no ofrecer lo que la
       escritura va a rechazar. */
    puede(modulo) {
      if (!S.sedeId) return false;
      if (S.previa)  return false;
      return M.puedeEnSede(S.personaId, S.sedeId, modulo).ok;
    },
    porQueNo(modulo) {
      if (S.previa)  return "Vista previa: se puede mirar, no escribir.";
      if (!S.sedeId) return "Esta sesión no está atada a una iglesia.";
      const v = M.puedeEnSede(S.personaId, S.sedeId, modulo);
      return v.ok ? "" : v.razon;
    },

    ministerios() { return S.sedeId ? M.ministeriosDeSede(S.sedeId) : []; },
    grupos()      { return S.sedeId ? M.gruposDeSede(S.sedeId)      : []; },

    crearGrupo:  envolver(d => M.crearGrupo(Object.assign({}, d, { sedeId:S.sedeId }), S.personaId)),
    editarGrupo: envolver((id, c) => M.editarGrupo(id, c, S.personaId)),
    cerrarGrupo: envolver((id, m) => M.cerrarGrupo(id, m ? String(m) : "", S.personaId)),

    crearMinisterio: envolver(d => {
      const v = M.puedeEnSede(S.personaId, S.sedeId, "organizacion");
      if (!v.ok) return { ok:false, fallos:[v.razon] };
      /* Un ministerio no se crea sin director: la regla es del master y
         aquí no se salta. Si el pastor no eligió a nadie, se queda él,
         que es quien responde por su iglesia mientras nombra. */
      return M.crearMinisterio(Object.assign({}, d, {
        sedeId: S.sedeId, liderId: d.liderId || S.personaId, otorgadoPor: S.personaId }));
    }),
  };
})();
