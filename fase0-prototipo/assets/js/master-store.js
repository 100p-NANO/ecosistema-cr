/* ============================================================
   CASA ROCA · ALMACÉN DEL MASTER
   Personas con acceso, asignaciones y bitácora. Persiste en
   localStorage mientras no haya backend conectado.
   ⛔ La bitácora es SOLO-AGREGAR: nunca se borra una línea.
   ============================================================ */
(function () {
  "use strict";
  const LLAVE = "casaroca_master_v1";
  const I = window.IDENTIDAD;

  function semilla() {
    const s = I.SEDES, sedeMadre = (s.find(x => /chic/i.test(x.nombre)) || s[0] || {}).id;
    const hoy = new Date().toISOString().slice(0, 10);
    const p = (id, nombre, doc) => ({ id, nombre, documento: doc, correo: "", creadoEn: hoy });
    return {
      personas: [
        p("p-dg",  "Ps. Director General",      "79.000.001"),
        p("p-pc",  "Ps. Andrés Lozano",         "79.000.002"),
        p("p-dm",  "Marcela Ríos",              "52.000.003"),
        p("p-lg",  "Julián Prieto",             "80.000.004"),
        p("p-cs",  "Ps. Ana Vela",              "52.000.005"),
        p("p-tes", "Claudia Bernal",            "52.000.006"),
      ],
      asignaciones: [
        { id:"a1", personaId:"p-dg", rol:"PASTOR_DIRECTOR_GENERAL", alcanceTipo:"organizacion",
          alcanceId:null, nivelMax:4, desde:"2026-01-01", hasta:null,
          otorgadoPor:"sistema", acta:"ACTA-JD-2026-001" },
        { id:"a2", personaId:"p-pc", rol:"PASTOR_CONGREGACIONAL", alcanceTipo:"sede",
          alcanceId:sedeMadre, nivelMax:2, desde:"2026-02-01", hasta:null,
          otorgadoPor:"p-dg", acta:"ACTA-JD-2026-014" },
        { id:"a3", personaId:"p-cs", rol:"CONSEJERO", alcanceTipo:"caso_propio",
          alcanceId:null, nivelMax:3, desde:"2026-03-01", hasta:null,
          otorgadoPor:"p-pc", acta:"ACTA-CONS-2026-007" },
        { id:"a4", personaId:"p-tes", rol:"TESORERIA", alcanceTipo:"sede",
          alcanceId:sedeMadre, nivelMax:3, desde:"2026-02-15", hasta:"2026-08-31",
          otorgadoPor:"p-dg", acta:"ACTA-TES-2026-003" },
      ],
      bitacora: [
        { ts:"2026-01-01 08:00", tipo:"CREACION",  quien:"sistema", detalle:"Alta del Pastor Director General con alcance de organización." },
        { ts:"2026-02-01 10:22", tipo:"ASIGNACION",quien:"p-dg",    detalle:"Pastor Congregacional para Bogotá Chicó, techo N2." },
        { ts:"2026-08-31 23:59", tipo:"VENCIMIENTO",quien:"sistema",detalle:"Venció la asignación de Tesorería. El acceso quedó cerrado." },
      ],
    };
  }

  let D = null;
  function cargar() {
    if (D) return D;
    try { const c = localStorage.getItem(LLAVE); D = c ? JSON.parse(c) : semilla(); }
    catch (e) { D = semilla(); }
    return D;
  }
  function guardar() {
    try { localStorage.setItem(LLAVE, JSON.stringify(D)); } catch (e) {}
  }
  function anotar(tipo, quien, detalle) {
    cargar().bitacora.unshift({
      ts: new Date().toISOString().slice(0, 16).replace("T", " "), tipo, quien, detalle });
    guardar();
  }

  window.MSTORE = {
    personas:     () => cargar().personas.slice(),
    asignaciones: () => cargar().asignaciones.slice(),
    bitacora:     () => cargar().bitacora.slice(),
    persona:      id => cargar().personas.find(p => p.id === id) || null,
    deLaPersona:  id => cargar().asignaciones.filter(a => a.personaId === id),

    crearPersona(nombre, documento, correo) {
      const d = cargar();
      const p = { id: "p-" + Math.random().toString(36).slice(2, 8), nombre,
                  documento: documento || "", correo: correo || "",
                  creadoEn: new Date().toISOString().slice(0, 10) };
      d.personas.push(p); guardar();
      anotar("CREACION", "master", `Se creó la ficha de ${nombre}.`);
      return p;
    },

    /* Otorgar NO edita nada: agrega una fila. Es la regla de los dos
       modelos (el nuestro y el de Jhon): el historial no se toca. */
    otorgar(a, quienOtorga) {
      const v = I.validarAsignacion(a, quienOtorga);
      if (!v.ok) return v;
      const d = cargar();
      const fila = Object.assign({ id: "a-" + Math.random().toString(36).slice(2, 8) }, a);
      d.asignaciones.push(fila); guardar();
      const per = this.persona(a.personaId);
      const rl  = I.rol(a.rol), al = I.alcance(a.alcanceTipo);
      anotar("ASIGNACION", (quienOtorga && quienOtorga.personaId) || "master",
        `${per ? per.nombre : a.personaId} queda como ${rl ? rl.nombre : a.rol}, alcance ${al ? al.nombre.toLowerCase() : a.alcanceTipo}, techo N${a.nivelMax}${a.acta ? " · " + a.acta : ""}.`);
      return { ok: true, fila };
    },

    /* Revocar tampoco borra: pone fecha de fin. */
    revocar(idAsignacion, motivo) {
      const d = cargar(), a = d.asignaciones.find(x => x.id === idAsignacion);
      if (!a) return { ok:false, fallos:["No existe esa asignación."] };
      if (a.hasta) return { ok:false, fallos:["Esa asignación ya estaba cerrada."] };
      a.hasta = new Date().toISOString().slice(0, 10); guardar();
      const per = this.persona(a.personaId);
      anotar("VENCIMIENTO", "master",
        `Se cerró el acceso de ${per ? per.nombre : a.personaId} como ${a.rol}${motivo ? ": " + motivo : "."}`);
      return { ok: true };
    },
    anotar,
    reiniciar() { try { localStorage.removeItem(LLAVE); } catch (e) {} D = null; },
  };
})();
