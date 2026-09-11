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
    const dat = {
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
      /* Creados desde el master. Arrancan con lo que trae la base. */
      sedes:       I.SEDES_FULL.map(x => Object.assign({ plantilla:
                     /chic/i.test(x.nombre) ? "MAESTRA" : (x.tipo === "plantacion" ? "PLANTACION" : "FILIAL") }, x)),
      ministerios: I.MINISTERIOS.map(m => Object.assign({ sedeId:null }, m)),
      equipos:     [],
      rolesX:      [],   // roles creados a mano, encima del catálogo
      modulosX:    [],   // módulos nuevos
      modsede:     I.MODSEDE_SEED.slice(),
      vinculos: [],
      bitacora: [
        { ts:"2026-01-01 08:00", tipo:"CREACION",  quien:"sistema", detalle:"Alta del Pastor Director General con alcance de organización." },
        { ts:"2026-02-01 10:22", tipo:"ASIGNACION",quien:"p-dg",    detalle:"Pastor Congregacional para Bogotá Chicó, techo N2." },
        { ts:"2026-08-31 23:59", tipo:"VENCIMIENTO",quien:"sistema",detalle:"Venció la asignación de Tesorería. El acceso quedó cerrado." },
      ],
    };
    /* Las filas que vienen de la base tambien reciben su codigo. */
    dat.personas.forEach((x, i) => { x.codigo = "CR-" + String(i + 1).padStart(6, "0"); });
    const usados = [];
    dat.sedes.forEach(x => { x.codigo = codIglesia(x.ciudad || x.nombre, x.pais, usados); usados.push(x.codigo); });
    const uMin = [];
    dat.ministerios.forEach(m => { m.codTrabajo = codUnidad("MIN", (dat.sedes[0] || {}).codigo, uMin); uMin.push(m.codTrabajo); });
    return dat;
  }

  const hoyIso = () => new Date().toISOString().slice(0, 10);

  /* ============================================================
     CÓDIGO DE TRABAJO · la llave de negocio
     El UUID sirve a la máquina pero no se dicta por teléfono ni se
     escribe en un acta. Cada iglesia y cada persona lleva además un
     código corto, legible y ESTABLE: es lo que permite cruzar esta
     base con 99-o, con el Excel de tesorería y con lo que venga,
     sin depender de que los nombres coincidan.

     Reglas: se asigna una vez, NUNCA cambia (ni al renombrar ni al
     trasladar), y es único. Es el `source_id` del que habla el
     Documento 1, visto desde dentro.
     ============================================================ */
  const SIN_TILDE = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function codIglesia(nombre, pais, existentes) {
    const ciudad = SIN_TILDE(nombre).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "XXX";
    const base = `${(pais || "CO").toUpperCase()}-${ciudad}`;
    let n = 1;
    while (existentes.some(c => c === `${base}-${String(n).padStart(2, "0")}`)) n++;
    return `${base}-${String(n).padStart(2, "0")}`;
  }
  /* Equipos y ministerios llevan el código de SU iglesia como prefijo:
     así el código dice a qué base pertenece la fila sin consultar nada.
     Un equipo corporativo lleva CR- porque alcanza toda la red. */
  function codUnidad(tipo, sedeCod, existentes) {
    const base = `${sedeCod || "CR"}-${tipo}`;
    let n = 1;
    while (existentes.some(c => c === `${base}-${String(n).padStart(2, "0")}`)) n++;
    return `${base}-${String(n).padStart(2, "0")}`;
  }
  function codPersona(existentes) {
    let n = existentes.length + 1;
    let c = "CR-" + String(n).padStart(6, "0");
    while (existentes.indexOf(c) >= 0) { n++; c = "CR-" + String(n).padStart(6, "0"); }
    return c;
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

    crearPersona(nombre, documento, correo, extra) {
      const d = cargar();
      const p = Object.assign({
        id: "p-" + Math.random().toString(36).slice(2, 8),
        codigo: codPersona(d.personas.map(x => x.codigo).filter(Boolean)), nombre,
        documento: documento || "", correo: correo || "",
        celular:"", fechaNac:"", anioFe:"", foto:"",
        creadoEn: new Date().toISOString().slice(0, 10) }, extra || {});
      d.personas.push(p); guardar();
      anotar("CREACION", "master", `Ficha de ${nombre} creada con código ${p.codigo}.`);
      return p;
    },

    /* ⛔⛔ REGLA DE GOBIERNO DE CASA SOBRE LA ROCA
       Los pastores se nombran SIEMPRE en matrimonio, pastor y pastora.
       La iglesia nunca nombra un pastor solo, ni en la general ni en una
       local. Por eso esto no recibe una persona: recibe una PAREJA, y de
       cada uno la hoja de vida completa. */
    HOJA_VIDA: [
      { k:"nombre",   l:"Nombre completo",            req:true },
      { k:"documento",l:"Documento",                  req:true },
      { k:"fechaNac", l:"Fecha de nacimiento",        req:true,  tipo:"date" },
      { k:"celular",  l:"Celular",                    req:true },
      { k:"correo",   l:"Correo",                     req:false },
      { k:"anioFe",   l:"Año de nacimiento en la Fe", req:true,  ayuda:"El año de su conversión" },
      { k:"foto",     l:"Fotografía del rostro",      req:true,  tipo:"url", ayuda:"Enlace a la foto" },
    ],
    validarHoja(x, quien) {
      const f = [];
      this.HOJA_VIDA.forEach(c => { if (c.req && !(x && x[c.k])) f.push(`${quien}: falta ${c.l.toLowerCase()}.`); });
      return f;
    },

    crearParejaPastoral(d) {
      const st = cargar();
      const f = this.validarHoja(d.el, "Pastor").concat(this.validarHoja(d.ella, "Pastora"));
      if (f.length) return { ok:false, fallos:f };
      const el   = this.crearPersona(d.el.nombre,   d.el.documento,   d.el.correo,   d.el);
      const ella = this.crearPersona(d.ella.nombre, d.ella.documento, d.ella.correo, d.ella);
      st.vinculos = st.vinculos || [];
      /* CONYUGE es bidireccional; HIJO es unidireccional. Son las reglas
         de nucleo.vinculos, no una convención nuestra. */
      st.vinculos.push({ de:el.id, a:ella.id, tipo:"CONYUGE", bidireccional:true });
      (d.hijos || []).filter(h => h && h.nombre).forEach(h => {
        const hijo = this.crearPersona(h.nombre, "", "", { fechaNac:h.fechaNac || "" });
        st.vinculos.push({ de:el.id,   a:hijo.id, tipo:"HIJO", bidireccional:false });
        st.vinculos.push({ de:ella.id, a:hijo.id, tipo:"HIJO", bidireccional:false });
      });
      guardar();
      anotar("CREACION", "master",
        `Pareja pastoral registrada: ${el.nombre} y ${ella.nombre}` +
        ((d.hijos || []).filter(h => h && h.nombre).length
          ? `, con ${(d.hijos || []).filter(h => h && h.nombre).length} hijo(s).` : "."));
      return { ok:true, el:el.id, ella:ella.id };
    },
    vinculos: () => cargar().vinculos || [],
    conyugeDe(id) {
      const v = (cargar().vinculos || []).find(x => x.tipo === "CONYUGE" && (x.de === id || x.a === id));
      if (!v) return null;
      return this.persona(v.de === id ? v.a : v.de);
    },
    hijosDe(id) {
      return (cargar().vinculos || []).filter(x => x.tipo === "HIJO" && x.de === id)
        .map(x => this.persona(x.a)).filter(Boolean);
    },

    /* Otorgar NO edita nada: agrega una fila. Es la regla de los dos
       modelos (el nuestro y el de Jhon): el historial no se toca. */
    otorgar(a, quienOtorga) {
      const v = I.validarAsignacion(a, quienOtorga);
      if (!v.ok) return v;
      const d = cargar();
      /* `delega` es la potestad de nombrar y cerrar accesos DENTRO de su
         alcance. Tener el rol no la trae: el Pastor Principal la otorga
         aparte. Un pastor de sede sin ella opera su iglesia pero no puede
         desactivar a un líder. */
      const fila = Object.assign({ id: "a-" + Math.random().toString(36).slice(2, 8), delega:false }, a);
      d.asignaciones.push(fila); guardar();
      const per = this.persona(a.personaId);
      const rl  = I.rol(a.rol), al = I.alcance(a.alcanceTipo);
      anotar("ASIGNACION", (quienOtorga && quienOtorga.personaId) || "master",
        `${per ? per.nombre : a.personaId} queda como ${rl ? rl.nombre : a.rol}, alcance ${al ? al.nombre.toLowerCase() : a.alcanceTipo}, techo N${a.nivelMax}${a.acta ? " · " + a.acta : ""}.`);
      return { ok: true, fila };
    },

    /* ¿Puede esta persona nombrar o cerrar accesos, y sobre qué alcance? */
    potestad(personaId) {
      const vig = this.deLaPersona(personaId).filter(a => !a.hasta || a.hasta >= hoyIso());
      const con = vig.filter(a => a.delega || a.rol === "PASTOR_DIRECTOR_GENERAL" || a.rol === "PASTOR_PRINCIPAL");
      if (!con.length) return { puede:false, alcances:[], roles:[] };
      const roles = new Set();
      con.forEach(a => I.rolesQuePuedeCrear(a.rol).forEach(r => roles.add(r)));
      return { puede:true,
        alcances: con.map(a => ({ tipo:a.alcanceTipo, id:a.alcanceId })),
        roles: Array.from(roles) };
    },
    alternarDelegacion(idAsignacion) {
      const d = cargar(), a = d.asignaciones.find(x => x.id === idAsignacion);
      if (!a) return { ok:false };
      a.delega = !a.delega; guardar();
      const per = this.persona(a.personaId);
      anotar("CAMBIO_PERMISO", "master",
        `${a.delega ? "Se otorgó" : "Se retiró"} a ${per ? per.nombre : a.personaId} la potestad de ` +
        `nombrar y cerrar accesos como ${a.rol}.`);
      return { ok:true, delega:a.delega };
    },

    /* Cerrar varios de una vez: es lo que un pastor necesita al final de
       un ciclo de grupos pequeños, no cerrar de uno en uno. */
    revocarVarios(ids, motivo) {
      let n = 0;
      ids.forEach(id => { if (this.revocar(id, motivo).ok) n++; });
      if (n > 1) anotar("VENCIMIENTO", "master", `Se cerraron ${n} accesos en lote${motivo ? ": " + motivo : "."}`);
      return { ok:true, n };
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
    /* ---------- catálogos editables ---------- */
    sedes:       () => cargar().sedes.slice(),
    ministerios: () => cargar().ministerios.slice(),
    equipos:     () => cargar().equipos.slice(),
    rolesTodos:  () => I.ROLES.concat(cargar().rolesX),
    modulosTodos:() => I.MODULOS.concat(cargar().modulosX),

    /* Crear una iglesia NO es insertar una fila: es aplicar una
       plantilla. De ahí sale qué módulos ve, y por eso no todas las
       iglesias son iguales. (sistema.crear_iglesia) */
    crearIglesia(d) {
      const st = cargar();
      if (!d.nombre)    return { ok:false, fallos:["Falta el nombre de la iglesia."] };
      if (!d.plantilla) return { ok:false, fallos:["Elija una plantilla: define qué módulos verá."] };
      /* ⛔ REGLA DEL BACKEND (sistema.tg_sede_exige_pastor): una sede no
         existe sin pastor. No es un campo opcional del formulario: es una
         restricción de la base, y aquí se aplica igual para no ofrecer
         algo que allá va a fallar. */
      if (!d.pastorId) return { ok:false, fallos:["Una iglesia no se crea sin su pastor. Elíjalo o créelo aquí mismo."] };
      /* ⛔ Y el pastor no va solo: la iglesia nombra pastor Y pastora. */
      if (!d.pastoraId) {
        const c = this.conyugeDe(d.pastorId);
        if (!c) return { ok:false, fallos:[
          "Falta la pastora. En Casa Sobre la Roca los pastores se nombran en matrimonio: nunca se nombra un pastor solo."] };
        d.pastoraId = c.id;
      }
      if (st.sedes.some(s => s.nombre.toLowerCase() === d.nombre.toLowerCase()))
        return { ok:false, fallos:["Ya existe una iglesia con ese nombre."] };
      const id = "sede-" + Math.random().toString(36).slice(2, 8);
      const codigo = codIglesia(d.ciudad || d.nombre, d.pais, st.sedes.map(x => x.codigo).filter(Boolean));
      st.sedes.push({ id, codigo, nombre:d.nombre, tipo:d.tipo || "filial_nacional",
        pais:d.pais || "CO", ciudad:d.ciudad || "", plantilla:d.plantilla });
      I.modulosDePlantilla(d.plantilla).forEach(m =>
        st.modsede.push({ sede:id, modulo:m, activo:true, evidencia:null }));
      /* El pastor queda otorgado en el mismo acto. Crear la iglesia y
         luego "acordarse" de darle acceso al pastor es como quedaban las
         sedes huérfanas. */
      [d.pastorId, d.pastoraId].forEach(pid => st.asignaciones.push({
        id:"a-" + Math.random().toString(36).slice(2, 8),
        personaId:pid, rol:"PASTOR_CONGREGACIONAL", alcanceTipo:"sede",
        alcanceId:id, nivelMax:2, desde:new Date().toISOString().slice(0,10),
        hasta:null, otorgadoPor:d.otorgadoPor || "master", acta:d.acta || "", delega:false }));
      guardar();
      const pl = I.plantilla(d.plantilla);
      anotar("CREACION", "master",
        `Iglesia «${d.nombre}» (${codigo}) creada con plantilla ${pl ? pl.nombre : d.plantilla}: ` +
        `${I.modulosDePlantilla(d.plantilla).length} de ${I.MODULOS.length} módulos encendidos, ` +
        `pastoreada por ${(this.persona(d.pastorId) || {}).nombre} y ${(this.persona(d.pastoraId) || {}).nombre}.`);
      return { ok:true, id };
    },

    /* ⛔ NADA NACE HUÉRFANO. Igual que una iglesia exige pastor, un
       ministerio exige director y un equipo exige responsable. Un
       ministerio sin nadie al frente es una carpeta vacía que nadie
       revisa, y el día que hay un problema con un menor no hay a quién
       preguntarle. El nombramiento va en el MISMO acto de creación. */
    crearMinisterio(d) {
      const st = cargar();
      if (!d.nombre)   return { ok:false, fallos:["Falta el nombre del ministerio."] };
      if (!d.sedeId)   return { ok:false, fallos:["Un ministerio pertenece a una iglesia. Elija cuál."] };
      if (!d.liderId)  return { ok:false, fallos:["Un ministerio no se crea sin su director. Elíjalo o créelo aquí mismo."] };
      const codigo = (d.codigo || d.nombre).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
      if (st.ministerios.some(m => m.codigo === codigo))
        return { ok:false, fallos:["Ya existe un ministerio con ese código."] };
      const sede = st.sedes.find(x => x.id === d.sedeId);
      const codTrabajo = codUnidad("MIN", sede && sede.codigo, st.ministerios.map(x => x.codTrabajo).filter(Boolean));
      st.ministerios.push({ codigo, codTrabajo, nombre:d.nombre, sedeId:d.sedeId });
      st.asignaciones.push({ id:"a-" + Math.random().toString(36).slice(2, 8),
        personaId:d.liderId, rol:"DIRECTOR_MINISTERIO", alcanceTipo:"ministerio",
        alcanceId:codigo, nivelMax:d.nivelMax != null ? +d.nivelMax : 2,
        desde:new Date().toISOString().slice(0,10), hasta:null,
        otorgadoPor:d.otorgadoPor || "master", acta:d.acta || "" });
      guardar();
      const s2 = st.sedes.find(x => x.id === d.sedeId);
      anotar("CREACION", "master",
        `Ministerio «${d.nombre}» (${codTrabajo}) creado en ${s2 ? s2.nombre : d.sedeId}, ` +
        `con ${(this.persona(d.liderId) || {}).nombre || "su director"} al frente.`);
      return { ok:true, codigo };
    },

    crearEquipo(d) {
      const st = cargar();
      if (!d.nombre)  return { ok:false, fallos:["Falta el nombre del equipo."] };
      if (!d.roles || !d.roles.length)
        return { ok:false, fallos:["Un equipo sin roles no otorga nada. Marque al menos uno."] };
      if (!d.liderId) return { ok:false, fallos:["Un equipo no se crea sin su responsable. Elíjalo o créelo aquí mismo."] };
      const local = (d.ambito || "local") === "local";
      if (local && !d.sedeId)
        return { ok:false, fallos:["Un equipo local pertenece a una iglesia. Elija cuál, o márquelo como corporativo."] };
      const codigo = d.nombre.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 24);
      const sedeE = local ? st.sedes.find(x => x.id === d.sedeId) : null;
      const codTrabajo = codUnidad("EQ", sedeE && sedeE.codigo, st.equipos.map(x => x.codTrabajo).filter(Boolean));
      st.equipos.push({ codigo, codTrabajo, nombre:d.nombre, ambito:d.ambito || "local",
        roles:d.roles.slice(), sedeId:local ? d.sedeId : null, liderId:d.liderId });
      /* El responsable recibe TODOS los roles del equipo de una vez: es
         lo que hace que crear un equipo sea un acto y no cuatro. */
      const hoyd = new Date().toISOString().slice(0,10);
      d.roles.forEach(r => {
        const rr = I.rol(r); if (!rr) return;
        st.asignaciones.push({ id:"a-" + Math.random().toString(36).slice(2, 8),
          personaId:d.liderId, rol:r,
          alcanceTipo: local ? "sede" : "organizacion",
          alcanceId:   local ? d.sedeId : null,
          nivelMax: Math.min(rr.techo, d.nivelMax != null ? +d.nivelMax : rr.techo),
          desde:hoyd, hasta:null, otorgadoPor:d.otorgadoPor || "master", acta:d.acta || "" });
      });
      guardar();
      anotar("CREACION", "master",
        `Equipo «${d.nombre}» (${codTrabajo}, ${d.ambito || "local"}) creado con ${d.roles.length} rol(es), ` +
        `a cargo de ${(this.persona(d.liderId) || {}).nombre || "su responsable"}.`);
      return { ok:true, codigo };
    },

    crearRol(d) {
      const st = cargar();
      if (!d.nombre) return { ok:false, fallos:["Falta el nombre del rol."] };
      if (d.techo == null) return { ok:false, fallos:["Falta el techo: es la sensibilidad máxima del rol y no cambia después."] };
      const codigo = (d.codigo || d.nombre).toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 40);
      if (this.rolesTodos().some(r => r.codigo === codigo))
        return { ok:false, fallos:["Ya existe un rol con ese código."] };
      st.rolesX.push({ codigo, nombre:d.nombre, techo:+d.techo });
      guardar();
      anotar("CREACION", "master", `Rol «${d.nombre}» creado con techo N${d.techo}.`);
      return { ok:true, codigo };
    },

    crearModulo(d) {
      const st = cargar();
      if (!d.nombre) return { ok:false, fallos:["Falta el nombre del módulo."] };
      if (d.nivel == null) return { ok:false, fallos:["Falta el nivel del dato que maneja: de ahí sale qué roles pueden alcanzarlo."] };
      const codigo = (d.codigo || d.nombre).toLowerCase().replace(/[^a-z0-9]+/g, "", "").slice(0, 24);
      if (this.modulosTodos().some(m => m.codigo === codigo))
        return { ok:false, fallos:["Ya existe un módulo con ese código."] };
      st.modulosX.push({ codigo, nombre:d.nombre, nivel:+d.nivel });
      guardar();
      anotar("CREACION", "master",
        `Módulo «${d.nombre}» creado con dato N${d.nivel}. Solo los roles con techo N${d.nivel} o mayor podrán alcanzarlo.`);
      return { ok:true, codigo };
    },

    /* ---------- qué ve cada iglesia ---------- */
    modsede: () => cargar().modsede.slice(),
    moduloActivo(sedeId, modulo) {
      const r = cargar().modsede.find(x => x.sede === sedeId && x.modulo === modulo);
      return !!(r && r.activo);
    },
    alternarModulo(sedeId, modulo) {
      const st = cargar();
      let r = st.modsede.find(x => x.sede === sedeId && x.modulo === modulo);
      if (!r) { r = { sede:sedeId, modulo, activo:false, evidencia:null }; st.modsede.push(r); }
      r.activo = !r.activo; guardar();
      const s = st.sedes.find(x => x.id === sedeId), m = I.modulo(modulo);
      anotar("CAMBIO_MODULO", "master",
        `${r.activo ? "Encendido" : "Apagado"} «${m ? m.nombre : modulo}» en ${s ? s.nombre : sedeId}.`);
      return r.activo;
    },
    aplicarPlantilla(sedeId, cod) {
      const st = cargar(), mods = I.modulosDePlantilla(cod);
      st.modsede = st.modsede.filter(x => x.sede !== sedeId);
      mods.forEach(m => st.modsede.push({ sede:sedeId, modulo:m, activo:true, evidencia:null }));
      const s = st.sedes.find(x => x.id === sedeId); if (s) s.plantilla = cod;
      guardar();
      anotar("CAMBIO_MODULO", "master",
        `Se aplicó la plantilla ${cod} a ${s ? s.nombre : sedeId}: ${mods.length} módulos.`);
    },

    /* ---------- permisos del rol · qué puede y qué no ----------
       La matriz es DATO, no código: por eso se puede editar sin tocar
       el sistema. Lo único que no se puede saltar es el techo. */
    matriz() {
      const st = cargar();
      st.matrizX = st.matrizX || I.MATRIZ.map(x => Object.assign({}, x));
      return st.matrizX;
    },
    tienePermiso(rol, modulo, accion) {
      return this.matriz().some(p => p.rol === rol && p.modulo === modulo && p.accion === accion);
    },
    alternarPermiso(rol, modulo, accion) {
      const st = cargar(); const m = this.matriz();
      const veto = I.rolPuedeModulo(rol, modulo);
      if (!veto.ok) return { ok:false, fallos:[veto.razon] };
      const i = m.findIndex(p => p.rol === rol && p.modulo === modulo && p.accion === accion);
      const rl = I.rol(rol), md = I.modulo(modulo);
      if (i >= 0) {
        m.splice(i, 1); guardar();
        anotar("CAMBIO_PERMISO", "master",
          `Se quitó «${accion}» sobre ${md ? md.nombre : modulo} al rol ${rl ? rl.nombre : rol}.`);
        return { ok:true, activo:false };
      }
      m.push({ rol, modulo, accion, nivel:md ? md.nivel : null }); guardar();
      anotar("CAMBIO_PERMISO", "master",
        `Se dio «${accion}» sobre ${md ? md.nombre : modulo} al rol ${rl ? rl.nombre : rol}.`);
      return { ok:true, activo:true };
    },
    permisosDelRol(rol) {
      return this.matriz().filter(p => p.rol === rol);
    },

    anotar,
    reiniciar() { try { localStorage.removeItem(LLAVE); } catch (e) {} D = null; },
  };
})();
