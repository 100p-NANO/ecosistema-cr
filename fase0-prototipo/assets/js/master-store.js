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
      /* Se resuelve el CÓDIGO a identificador en el momento de sembrar.
         Así el archivo del motor no depende del UUID que toque hoy. */
      modsede:     (function () {
        const porCod = {};
        I.SEDES_FULL.forEach(x => { porCod[x.codigo] = x.id; });
        return I.MODSEDE_SEED.map(r => ({ sede: porCod[r.sedeCodigo] || r.sede,
          modulo: r.modulo, activo: r.activo, evidencia: r.evidencia }))
          .filter(r => r.sede);
      })(),
      vinculos: [],
      /* La línea de tiempo. Cada módulo escribe aquí y sigue con lo
         suyo; el CRM es la LECTURA de esta línea, no una capa encima
         de cada proceso. */
      hechos: [
        { id:"h1", personaId:"p-pc",  tipo:"PRIMERA_VISITA", cuando:"2024-03-10", modulo:"crm",
          resumen:"Primera visita a Bogotá Chicó." },
        { id:"h2", personaId:"p-pc",  tipo:"INGRESO_GRUPO",  cuando:"2024-05-02", modulo:"grupos",
          resumen:"Entró al grupo de hogar Chapinero." },
        { id:"h3", personaId:"p-pc",  tipo:"CURSO_CERTIFICADO", cuando:"2024-11-20", modulo:"formacion",
          resumen:"Certificó el curso ADN." },
        { id:"h4", personaId:"p-pc",  tipo:"CAMBIO_ETAPA",   cuando:"2025-01-15", modulo:"crm",
          resumen:"Pasó de Crece a Sirve en el recorrido 4C.", detalle:{ etapa:"sirve" } },
        { id:"h5", personaId:"p-cs",  tipo:"CURSO_CERTIFICADO", cuando:"2025-06-01", modulo:"formacion",
          resumen:"Certificó Consejería Nivel 1." },
        { id:"h6", personaId:"p-cs",  tipo:"CASO_CONSEJERIA", cuando:"2026-08-14", modulo:"consejeria",
          resumen:"Abrió caso de acompañamiento en duelo." },
        { id:"h7", personaId:"p-dm",  tipo:"PRIMERA_VISITA", cuando:"2026-07-20", modulo:"crm",
          resumen:"Primera visita. Llegó invitada por una vecina." },
        { id:"h8", personaId:"p-dm",  tipo:"ASISTENCIA",     cuando:"2026-08-24", modulo:"asistencia",
          resumen:"Asistió al servicio dominical." },
        { id:"h9", personaId:"p-lg",  tipo:"PRIMERA_VISITA", cuando:"2026-02-02", modulo:"crm",
          resumen:"Primera visita." },
        { id:"h10", personaId:"p-lg", tipo:"INGRESO_GRUPO",  cuando:"2026-03-15", modulo:"grupos",
          resumen:"Entró al grupo de jóvenes." },
        { id:"h11", personaId:"p-tes",tipo:"APORTE",         cuando:"2026-08-01", modulo:"aportes",
          resumen:"Registró el cierre de aportes de julio." },
      ],
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
    /* ⭐⭐ LA FICHA, COLUMNA POR COLUMNA DE `nucleo.personas`.
       Esto NO es una lista inventada: es la tabla real del backend tras
       la migración 0032, que añadió los seis campos que se acordaron con
       el pastor y no estaban. Si el formulario y la tabla no coinciden,
       el usuario llena tres cosas y luego ve seis en «sin registrar»:
       exactamente el defecto que Daniel encontró el 11 de septiembre.

       `col` es el nombre EXACTO de la columna. Cuando el frontend hable
       con la API, el mapeo es directo y no hay que adivinar.
       `n` es el nivel de sensibilidad: gobierna quién puede verlo. */
    FICHA: [
      { g:"Nombre",     k:"primerNombre",    col:"primer_nombre",     l:"Primer nombre",   req:true },
      { g:"Nombre",     k:"segundoNombre",   col:"segundo_nombre",    l:"Segundo nombre" },
      { g:"Nombre",     k:"primerApellido",  col:"primer_apellido",   l:"Primer apellido", req:true },
      { g:"Nombre",     k:"segundoApellido", col:"segundo_apellido",  l:"Segundo apellido",
        ayuda:"En Colombia se usa. Por eso el nombre va partido en cuatro y no en un solo campo." },
      { g:"Documento",  k:"tipoDocumento",   col:"tipo_documento",    l:"Tipo",
        opciones:["CC","TI","CE","PP","PE","NUIP"] },
      { g:"Documento",  k:"documento",       col:"numero_documento",  l:"Número" },
      { g:"Personal",   k:"fechaNac",        col:"fecha_nacimiento",  l:"Fecha de nacimiento", tipo:"date", n:2 },
      { g:"Personal",   k:"genero",          col:"genero",            l:"Género", n:2,
        opciones:[["M","Masculino"],["F","Femenino"],["O","Otro"]] },
      { g:"Personal",   k:"estadoCivil",     col:"estado_civil",      l:"Estado civil", n:2,
        opciones:[["soltero","Soltero"],["casado","Casado"],["union_libre","Unión libre"],
                  ["separado","Separado"],["divorciado","Divorciado"],["viudo","Viudo"]] },
      { g:"Contacto",   k:"celular",         col:"telefono_movil",    l:"Celular", n:2 },
      { g:"Contacto",   k:"telefonoFijo",    col:"telefono_fijo",     l:"Teléfono fijo" },
      { g:"Contacto",   k:"correo",          col:"email_principal",   l:"Correo", n:2,
        ayuda:"OPCIONAL a propósito. Muchos menores y adultos mayores no tienen, y exigirlo los deja fuera del registro." },
      { g:"Contacto",   k:"direccion",       col:"direccion",         l:"Dirección" },
      { g:"Vida de fe", k:"nivelCompromiso", col:"nivel_compromiso",  l:"Nivel de compromiso", n:1,
        opciones:[["visitante","Visitante"],["miembro","Miembro"],["lider","Líder"]],
        ayuda:"Arranca en visitante. Nadie nace miembro." },
      { g:"Vida de fe", k:"anioFe",          col:"fecha_conversion",  l:"Nacimiento en la Fe", tipo:"date", n:2,
        ayuda:"La fecha de su conversión. Es dato propio de una iglesia, no de un CRM genérico." },
      { g:"Vida de fe", k:"bautizado",       col:"ha_sido_bautizado", l:"¿Bautizado?", n:2,
        opciones:[["si","Sí"],["no","No"]] },
      { g:"Vida de fe", k:"fechaBautismo",   col:"fecha_bautismo",    l:"Fecha de bautismo", tipo:"date", n:2 },
      { g:"Identidad",  k:"foto",            col:"foto_url",          l:"Fotografía del rostro", n:2,
        ayuda:"Enlace a la foto." },
      { g:"Identidad",  k:"sedeId",          col:"sede_id",           l:"Iglesia a la que pertenece", req:true,
        ayuda:"La columna es NOT NULL: toda persona pertenece a una sede. Sin esto no hay aislamiento entre iglesias." },
    ],
    /* Para el nombramiento pastoral se exige más que para una ficha
       corriente: es lo que Daniel pidió. */
    OBLIGATORIO_PASTOR: ["primerNombre","primerApellido","documento","fechaNac",
                         "celular","anioFe","foto"],
    validarFicha(x, quien, exigidos) {
      const f = [], req = exigidos || this.FICHA.filter(c => c.req).map(c => c.k);
      req.forEach(k => {
        const c = this.FICHA.find(y => y.k === k);
        if (!(x && x[k])) f.push(`${quien}: falta ${c ? c.l.toLowerCase() : k}.`);
      });
      /* La regla de la 0032: no se pone fecha de bautismo si no está bautizado. */
      if (x && x.fechaBautismo && x.bautizado !== "si")
        f.push(`${quien}: hay fecha de bautismo pero no está marcado como bautizado.`);
      if (x && x.anioFe && x.fechaNac && x.anioFe < x.fechaNac)
        f.push(`${quien}: el nacimiento en la Fe no puede ser anterior al nacimiento.`);
      return f;
    },
    validarHoja(x, quien) {
      const f = [];
      this.HOJA_VIDA.forEach(c => { if (c.req && !(x && x[c.k])) f.push(`${quien}: falta ${c.l.toLowerCase()}.`); });
      return f;
    },

    crearParejaPastoral(d) {
      const st = cargar();
      const f = this.validarFicha(d.el, "Pastor", this.OBLIGATORIO_PASTOR)
        .concat(this.validarFicha(d.ella, "Pastora", this.OBLIGATORIO_PASTOR));
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

    /* Afinar el nivel de UN módulo dentro de una asignación.
       `null` devuelve el módulo al nivel general de la asignación. */
    nivelDeModulo(idAsignacion, codModulo, nivel) {
      const st = cargar(), a = st.asignaciones.find(x => x.id === idAsignacion);
      if (!a) return { ok:false, fallos:["No existe esa asignación."] };
      const r = I.rol(a.rol), m = I.modulo(codModulo);
      if (nivel != null && r && nivel > r.techo) return { ok:false, fallos:[
        `Pidió N${nivel} y el techo de «${r.nombre}» es N${r.techo}. ` +
        `El techo del rol no se negocia módulo por módulo: cámbiele el rol si de verdad lo necesita.`] };
      a.nivelPorModulo = a.nivelPorModulo || {};
      if (nivel == null || nivel === a.nivelMax) delete a.nivelPorModulo[codModulo];
      else a.nivelPorModulo[codModulo] = +nivel;
      if (!Object.keys(a.nivelPorModulo).length) delete a.nivelPorModulo;
      guardar();
      const per = this.persona(a.personaId);
      anotar("CAMBIO_PERMISO", "master",
        nivel == null || nivel === a.nivelMax
          ? `«${m ? m.nombre : codModulo}» vuelve al nivel general N${a.nivelMax} para ${per ? per.nombre : ""}.`
          : `«${m ? m.nombre : codModulo}» queda en N${nivel} para ${per ? per.nombre : ""}, ` +
            `distinto del nivel general N${a.nivelMax} de esa asignación.`);
      return { ok:true };
    },

    /* Sumar o quitar un destino del alcance. Un pastor regional cubre
       tres iglesias con UNA asignación, no con tres iguales. */
    alternarAlcance(idAsignacion, destinoId) {
      const st = cargar(), a = st.asignaciones.find(x => x.id === idAsignacion);
      if (!a) return { ok:false, fallos:["No existe esa asignación."] };
      const t = I.alcance(a.alcanceTipo);
      if (!t || !t.exigeId) return { ok:false, fallos:[
        `El alcance «${t ? t.nombre : a.alcanceTipo}» no lleva destinos: cubre lo que cubre.`] };
      let l = I.alcancesDe(a);
      const i = l.indexOf(destinoId);
      if (i >= 0) l.splice(i, 1); else l.push(destinoId);
      if (!l.length) return { ok:false, fallos:[
        "No puede quedarse sin ningún destino: sería un alcance vacío, y eso la base lo rechaza."] };
      a.alcanceIds = l; delete a.alcanceId;
      guardar();
      const per = this.persona(a.personaId);
      const sd = st.sedes.find(x => x.id === destinoId);
      const mn = st.ministerios.find(x => x.codigo === destinoId);
      anotar("CAMBIO_PERMISO", "master",
        `${i >= 0 ? "Quitado" : "Sumado"} «${(sd && sd.nombre) || (mn && mn.nombre) || destinoId}» al alcance de ` +
        `${per ? per.nombre : a.personaId} como ${(I.rol(a.rol) || {}).nombre || a.rol}. ` +
        `Ahora cubre ${l.length} destino(s).`);
      return { ok:true, total:l.length };
    },

    /* Encender o apagar un módulo A ESTA PERSONA, dentro de su techo.
       No se le inventa un rol nuevo: se ajusta su asignación. */
    alternarModuloPersona(idAsignacion, codModulo) {
      const st = cargar(), a = st.asignaciones.find(x => x.id === idAsignacion);
      if (!a) return { ok:false, fallos:["No existe esa asignación."] };
      const m = I.modulo(codModulo);
      if (!m) return { ok:false, fallos:["No existe ese módulo."] };
      if (a.nivelMax < m.nivel) return { ok:false, fallos:[
        `«${m.nombre}» maneja dato N${m.nivel} y esta asignación tiene techo N${a.nivelMax}. ` +
        `El techo no se negocia por excepción: si de verdad debe verlo, súbale el techo o cámbiele el rol.`] };
      a.modulos = a.modulos || {};
      const daba = I.MATRIZ.some(p2 => p2.rol === a.rol && p2.modulo === codModulo);
      const estaba = a.modulos[codModulo] === undefined ? daba : a.modulos[codModulo];
      a.modulos[codModulo] = !estaba;
      /* Si la excepción coincide con lo que ya daba el rol, se borra:
         no se guardan excepciones que no excepcionan nada. */
      if (a.modulos[codModulo] === daba) delete a.modulos[codModulo];
      guardar();
      const per = this.persona(a.personaId);
      anotar("CAMBIO_PERMISO", "master",
        `${!estaba ? "Encendido" : "Apagado"} «${m.nombre}» para ${per ? per.nombre : a.personaId} ` +
        `como ${(I.rol(a.rol) || {}).nombre || a.rol}. Es una excepción de esta persona, no del rol.`);
      return { ok:true, activo:!estaba };
    },

    /* ⭐ PROMOVER O TRASLADAR · de líder a director, de una sede a otra.
       ⛔ NO se edita la fila existente. Se CIERRA la vieja con fecha de
       fin y se ABRE una nueva. Es la regla en la que coinciden nuestro
       modelo y el documento del equipo 100p: «cambio de rol = nueva
       fila, nunca borras ni editas». Así la auditoría puede responder
       «¿qué era esta persona en marzo?», que es justo lo que se pierde
       cuando alguien edita la fila en sitio.
       Y queda un HECHO en la línea de tiempo: el CRM se entera. */
    promover(idAsignacion, nuevo, quienOtorga) {
      const st = cargar();
      const vieja = st.asignaciones.find(x => x.id === idAsignacion);
      if (!vieja) return { ok:false, fallos:["No existe esa asignación."] };
      if (vieja.hasta && vieja.hasta < hoyIso())
        return { ok:false, fallos:["Esa asignación ya estaba cerrada. Otorgue una nueva."] };

      const propuesta = {
        personaId: vieja.personaId, rol: nuevo.rol,
        alcanceTipo: nuevo.alcanceTipo, alcanceId: nuevo.alcanceId || null,
        nivelMax: nuevo.nivelMax, desde: nuevo.desde || hoyIso(),
        hasta: nuevo.hasta || null, acta: nuevo.acta || "" };
      const v = I.validarAsignacion(propuesta, quienOtorga);
      if (!v.ok) return v;

      vieja.hasta = hoyIso();
      const fila = Object.assign({ id:"a-" + Math.random().toString(36).slice(2, 8),
        delega:false, otorgadoPor:(quienOtorga && quienOtorga.personaId) || "master" }, propuesta);
      st.asignaciones.push(fila);
      guardar();

      const per = this.persona(vieja.personaId);
      const rv = I.rol(vieja.rol), rn = I.rol(nuevo.rol);
      const sube = rn && rv ? rn.techo > rv.techo : false;
      anotar("PROMOCION", (quienOtorga && quienOtorga.personaId) || "master",
        `${per ? per.nombre : vieja.personaId}: de ${rv ? rv.nombre : vieja.rol} a ` +
        `${rn ? rn.nombre : nuevo.rol}${sube ? " (sube de techo)" : ""}. ` +
        `Se cerró la asignación anterior, no se editó.`);
      this.registrarHecho(vieja.personaId, "CAMBIO_ETAPA",
        `Pasó de ${rv ? rv.nombre : vieja.rol} a ${rn ? rn.nombre : nuevo.rol}.`,
        { de:vieja.rol, a:nuevo.rol });
      return { ok:true, fila };
    },

    /* Cerrar varios de una vez: es lo que un pastor necesita al final de
       un ciclo de grupos pequeños, no cerrar de uno en uno. */
    revocarVarios(ids, motivo) {
      let n = 0;
      ids.forEach(id => { if (this.revocar(id, motivo).ok) n++; });
      if (n > 1) anotar("VENCIMIENTO", "master", `Se cerraron ${n} accesos en lote${motivo ? ": " + motivo : "."}`);
      return { ok:true, n };
    },

    /* ⭐ OTORGAR VARIOS ROLES DE UNA VEZ.
       Una persona puede ser Consejero Y Coordinador de Nuevos. El modelo
       siempre lo soportó (una fila por rol); lo que faltaba era poder
       darlos en UN solo acto en vez de repetir el formulario.

       Cada rol conserva SU techo y SU alcance natural: no se fuerza uno
       común, porque un consejero va por «caso propio» y un coordinador
       por «sede». Forzarles el mismo alcance sería romper la regla que
       hace que el consejero no vea todos los casos de su sede.

       Es todo o nada: si una falla, no se otorga ninguna. Media
       asignación es peor que ninguna. */
    otorgarVarios(lista, quienOtorga) {
      const fallos = [];
      lista.forEach((a, i) => {
        const v = I.validarAsignacion(a, quienOtorga);
        if (!v.ok) { const r = I.rol(a.rol);
          v.fallos.forEach(f => fallos.push(`${r ? r.nombre : a.rol}: ${f}`)); }
      });
      if (fallos.length) return { ok:false, fallos };
      const hechas = lista.map(a => this.otorgar(a, quienOtorga));
      const per = this.persona(lista[0] && lista[0].personaId);
      if (lista.length > 1) anotar("ASIGNACION", (quienOtorga && quienOtorga.personaId) || "master",
        `${per ? per.nombre : ""} recibió ${lista.length} roles en un solo acto: ` +
        lista.map(a => (I.rol(a.rol) || {}).nombre || a.rol).join(", ") + ".");
      return { ok:true, n:hechas.length };
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

    /* ---------- CRM DE COMANDO ----------
       La línea de tiempo es la ESPINA: un hecho por fila, venga del
       módulo que venga. Nadie consulta siete módulos para saber qué
       ha pasado con alguien. */
    hechos:      () => (cargar().hechos || []).slice(),
    hechosDe(id) {
      return (cargar().hechos || []).filter(h => h.personaId === id)
        .sort((a, b) => a.cuando < b.cuando ? 1 : -1);
    },
    registrarHecho(personaId, tipo, resumen, detalle) {
      const st = cargar();
      st.hechos = st.hechos || [];
      st.hechos.push({ id:"h-" + Math.random().toString(36).slice(2, 8), personaId, tipo,
        cuando:hoyIso(), modulo:(I.tipoHecho(tipo) || {}).modulo || "crm", resumen, detalle:detalle || null });
      guardar();
    },

    /* El CRM DE UNA IGLESIA: los hechos de toda la gente con alcance en
       esa sede. Sale de la misma línea de tiempo, filtrada. No hay un
       "CRM de sede" aparte: sería justo el error de montar el CRM
       encima de cada proceso. */
    crmDeSede(sedeId) {
      const asg = cargar().asignaciones.filter(a => a.alcanceId === sedeId);
      const ids = new Set(asg.map(a => a.personaId));
      const hs = (cargar().hechos || []).filter(h => ids.has(h.personaId))
        .sort((a, b) => a.cuando < b.cuando ? 1 : -1);
      const porModulo = {};
      hs.forEach(h => { const m = (I.tipoHecho(h.tipo) || {}).modulo || h.modulo;
        porModulo[m] = (porModulo[m] || 0) + 1; });
      const frios = Array.from(ids).map(id => {
        const u = this.hechosDe(id)[0]; if (!u) return null;
        const d = Math.round((Date.now() - new Date(u.cuando).getTime()) / 86400000);
        return d > 120 ? { persona:this.persona(id), dias:d, ultimo:u } : null;
      }).filter(Boolean).sort((a, b) => b.dias - a.dias);
      const sinHechos = Array.from(ids).map(id => this.persona(id))
        .filter(p => p && !this.hechosDe(p.id).length);
      /* El estado de cada persona, leído de su línea. Es lo que el
         pastor local necesita ver de su gente: en qué etapa va, qué
         cursos certificó, en qué grupo está y cuándo se movió por
         última vez. Nada de esto se escribe aparte: se deduce. */
      const gente = Array.from(ids).map(pid => {
        const p = this.persona(pid); if (!p) return null;
        const h = this.hechosDe(pid);
        const etapaH = h.find(x => x.tipo === "CAMBIO_ETAPA");
        const grupoH = h.find(x => x.tipo === "INGRESO_GRUPO");
        const cursos = h.filter(x => x.tipo === "CURSO_CERTIFICADO");
        const primera = h.filter(x => x.tipo === "PRIMERA_VISITA")
          .sort((a, b) => a.cuando < b.cuando ? -1 : 1)[0];
        const u = h[0];
        const dias = u ? Math.round((Date.now() - new Date(u.cuando).getTime()) / 86400000) : null;
        const rol = asg.filter(a => a.personaId === pid && (!a.hasta || a.hasta >= hoyIso()))[0];
        return { persona:p, hechos:h.length, cursos,
          etapa: etapaH && etapaH.detalle ? etapaH.detalle.etapa : (primera ? "conoce" : null),
          grupo: grupoH ? grupoH.resumen.replace(/^Entró al grupo (de hogar |de )?/i, "") : null,
          desde: primera ? primera.cuando : null, ultimo:u, dias,
          rol: rol ? rol.rol : null };
      }).filter(Boolean).sort((a, b) => (b.dias == null ? 1e9 : b.dias) - (a.dias == null ? 1e9 : a.dias));
      return { hechos:hs, porModulo, frios, sinHechos, personas:ids.size, gente };
    },

    /* ⭐⭐ LO QUE PIDIÓ DANIEL: al ir a dar acceso, que el sistema traiga
       del CRM lo que importa para decidir. Nadie debería nombrar a
       alguien sin saber cuánto lleva, en qué etapa va y si ya sirve.
       Y sobre todo: si va a servir con menores, si sus antecedentes
       están verificados. */
    contextoPara(personaId) {
      const p = this.persona(personaId);
      if (!p) return null;
      const h = this.hechosDe(personaId);
      const asg = this.deLaPersona(personaId);
      const vig = asg.filter(a => !a.hasta || a.hasta >= hoyIso());
      const primera = h.filter(x => x.tipo === "PRIMERA_VISITA").sort((a,b) => a.cuando < b.cuando ? -1 : 1)[0];
      const etapaH  = h.find(x => x.tipo === "CAMBIO_ETAPA");
      const cursos  = h.filter(x => x.tipo === "CURSO_CERTIFICADO");
      const ultimo  = h[0];
      const meses = primera
        ? Math.round((Date.now() - new Date(primera.cuando).getTime()) / 2629800000) : null;

      const señales = [];
      if (!h.length) señales.push({ t:"aviso",
        txt:"No hay un solo hecho registrado sobre esta persona. Se le daría acceso a ciegas." });
      if (meses != null && meses < 6) señales.push({ t:"aviso",
        txt:`Lleva ${meses} mes(es) en la iglesia. Conviene preguntarse si es pronto para darle un rol.` });
      if (etapaH && etapaH.detalle && etapaH.detalle.etapa === "sirve") señales.push({ t:"ok",
        txt:"Ya está en la etapa Sirve del recorrido 4C." });
      if (cursos.length) señales.push({ t:"ok",
        txt:`Tiene ${cursos.length} curso(s) certificado(s): ${cursos.map(c => c.resumen.replace(/^Certificó (el curso )?/, "")).join(", ")}.` });
      if (!vig.length && asg.length) señales.push({ t:"aviso",
        txt:"Tuvo acceso antes y se le cerró. Vale la pena saber por qué antes de devolvérselo." });
      if (ultimo) {
        const d = Math.round((Date.now() - new Date(ultimo.cuando).getTime()) / 86400000);
        if (d > 120) señales.push({ t:"aviso",
          txt:`Su último movimiento fue hace ${d} días. Puede estar frío.` });
      }
      /* ⛔ El control que de verdad importa: servir con menores exige
         antecedentes verificados y VIGENTES (caducan a los 2 años). */
      const antecedentes = h.find(x => /antecedente/i.test(x.resumen || ""));
      return { persona:p, hechos:h, meses, primera, cursos, ultimo, señales,
        rolesVigentes:vig, antecedentes: antecedentes || null };
    },

    anotar,
    reiniciar() { try { localStorage.removeItem(LLAVE); } catch (e) {} D = null; },
  };
})();
