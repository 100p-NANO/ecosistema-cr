/* ============================================================
   CASA ROCA · MOTOR DE IDENTIDAD, ROLES Y PERMISOS
   El corazón del sistema master. NO es un catálogo decorativo:
   es la misma regla que impone la base de datos, traída al
   navegador para que la interfaz no ofrezca lo que el backend
   va a rechazar.

   El permiso es de CUATRO dimensiones, no una:
        rol  x  alcance  x  sensibilidad  x  vigencia

   Los datos de abajo NO están inventados: salen de la base
   `casaroca_dev` (esquemas identidad, sistema y plataforma),
   exportados el 11 de septiembre de 2026. Si la base cambia,
   este archivo se regenera, no se edita a mano.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1 · NIVELES DE SENSIBILIDAD (plataforma.niveles_sensibilidad)
     El nivel no describe: ACTIVA controles. N3 y N4 exigen cifrado,
     bitácora de lectura y enmascarado. ---------- */
  const NIVELES = [{"nivel": 0, "codigo": "N0", "desc": "Público. Puede salir del sistema sin control.", "cifrado": false, "bitacora": false, "enmascarado": false}, {"nivel": 1, "codigo": "N1", "desc": "Interno. Organización, sedes, catálogos. Sin dato personal.", "cifrado": false, "bitacora": false, "enmascarado": false}, {"nivel": 2, "codigo": "N2", "desc": "Dato personal ordinario. Ley 1581: exige finalidad y consentimiento.", "cifrado": false, "bitacora": false, "enmascarado": false}, {"nivel": 3, "codigo": "N3", "desc": "Sensible. Aportes, notas pastorales, consejería, salud.", "cifrado": true, "bitacora": true, "enmascarado": true}, {"nivel": 4, "codigo": "N4", "desc": "Menores de edad. Protección reforzada; el más restringido.", "cifrado": true, "bitacora": true, "enmascarado": true}];

  /* ---------- 2 · ROLES (identidad.roles)
     `techo` es la sensibilidad máxima que el rol puede alcanzar NUNCA,
     en ningún módulo. No se negocia por asignación. ---------- */
  const ROLES = [{"codigo": "ACUDIENTE", "nombre": "Acudiente", "techo": 4}, {"codigo": "MAESTRO_ROCAKIDS", "nombre": "Maestro RocaKids", "techo": 4}, {"codigo": "PASTOR_DIRECTOR_GENERAL", "nombre": "Pastor Director General", "techo": 4}, {"codigo": "CONSEJERO", "nombre": "Consejero", "techo": 3}, {"codigo": "CONTABILIDAD", "nombre": "Contabilidad", "techo": 3}, {"codigo": "PASTOR_PRINCIPAL", "nombre": "Pastor Principal", "techo": 3}, {"codigo": "TALENTO_HUMANO", "nombre": "Talento Humano", "techo": 3}, {"codigo": "TESORERIA", "nombre": "Tesorería", "techo": 3}, {"codigo": "COORDINADOR", "nombre": "Coordinador", "techo": 2}, {"codigo": "COORDINADOR_NUEVOS", "nombre": "Coordinador de Nuevos", "techo": 2}, {"codigo": "COORDINADOR_SEGMENTO", "nombre": "Coordinador de Segmento", "techo": 2}, {"codigo": "DIRECTOR_MINISTERIO", "nombre": "Director de Ministerio", "techo": 2}, {"codigo": "DIRECTOR_SEGMENTO", "nombre": "Director de Segmento", "techo": 2}, {"codigo": "LIDER_GRUPO", "nombre": "Líder", "techo": 2}, {"codigo": "MIEMBRO", "nombre": "Miembro", "techo": 2}, {"codigo": "PASTOR_CONGREGACIONAL", "nombre": "Pastor Congregacional", "techo": 2}, {"codigo": "SECRETARIA", "nombre": "Secretaría", "techo": 2}, {"codigo": "INTEGRACION_TECNICA", "nombre": "Integración técnica", "techo": 1}];

  /* ---------- 3 · MÓDULOS (sistema.modulos)
     `nivel` es el dato que maneja el módulo. Un rol con techo menor
     no puede recibir permiso sobre él. ---------- */
  const MODULOS = [{"codigo": "aportes", "nombre": "Aportes", "nivel": 3}, {"codigo": "asistencia", "nombre": "Asistencia", "nivel": 2}, {"codigo": "consejeria", "nombre": "Consejería", "nivel": 3}, {"codigo": "crm", "nombre": "CRM Pastoral · 4C", "nivel": 2}, {"codigo": "cumplimiento", "nombre": "Auditoría y cumplimiento", "nivel": 2}, {"codigo": "formacion", "nombre": "Formación e Instituto", "nivel": 2}, {"codigo": "grupos", "nombre": "Grupos y hogares", "nivel": 2}, {"codigo": "identidad", "nombre": "Identidad y accesos", "nivel": 2}, {"codigo": "organizacion", "nombre": "Organización y sedes", "nivel": 1}, {"codigo": "personas", "nombre": "Personas", "nivel": 2}, {"codigo": "rocakids", "nombre": "RocaKids", "nivel": 4}, {"codigo": "talento", "nombre": "Talento y voluntariado", "nivel": 3}];

  /* ---------- 4 · ACCIONES (sistema.acciones)
     Verbos genéricos (ver, crear, editar...) y verbos NOMBRADOS, que
     son los que de verdad importan en una iglesia: ENTREGAR_MENOR,
     VER_NOTAS_CONFIDENCIALES, ANULAR_CERTIFICADO. ---------- */
  const ACCIONES = [{"codigo": "ANULAR_CERTIFICADO", "nombre": "Anular certificado"}, {"codigo": "CONFIRMAR_APORTE", "nombre": "Confirmar un aporte"}, {"codigo": "CONVERTIR_MIEMBRO", "nombre": "Convertir un nuevo en miembro"}, {"codigo": "ENTREGAR_MENOR", "nombre": "Entregar un menor a su acudiente"}, {"codigo": "EXPEDIR_CERTIFICADO", "nombre": "Expedir certificado tributario"}, {"codigo": "REGISTRAR_APORTE", "nombre": "Registrar un aporte"}, {"codigo": "REGISTRAR_CONTACTO", "nombre": "Registrar contacto de seguimiento"}, {"codigo": "VER_METRICAS_NUEVOS", "nombre": "Ver métricas de crecimiento"}, {"codigo": "VER_NOTAS_CONFIDENCIALES", "nombre": "Ver notas de consejería"}, {"codigo": "administrar", "nombre": "Administrar"}, {"codigo": "anular", "nombre": "Anular"}, {"codigo": "crear", "nombre": "Crear"}, {"codigo": "editar", "nombre": "Editar"}, {"codigo": "exportar", "nombre": "Exportar"}, {"codigo": "ver", "nombre": "Ver"}];

  /* ---------- 5 · MATRIZ (sistema.matriz_permisos) · 173 filas reales ---------- */
  const MATRIZ = [{"rol": "ACUDIENTE", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "ACUDIENTE", "modulo": "rocakids", "accion": "ver", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "crear", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "editar", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "ver", "nivel": null}, {"rol": "CONSEJERO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "aportes", "accion": "CONFIRMAR_APORTE", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "aportes", "accion": "exportar", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "aportes", "accion": "ver", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "CONVERTIR_MIEMBRO", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "formacion", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "INTEGRACION_TECNICA", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "ENTREGAR_MENOR", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "crear", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "editar", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "ver", "nivel": null}, {"rol": "MIEMBRO", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "MIEMBRO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "MIEMBRO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "MIEMBRO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": 3}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "consejeria", "accion": "ver", "nivel": 3}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "CONVERTIR_MIEMBRO", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "identidad", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "identidad", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "organizacion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "aportes", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "aportes", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "asistencia", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": 4}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "consejeria", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "VER_METRICAS_NUEVOS", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "cumplimiento", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "formacion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "administrar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "administrar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "administrar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "rocakids", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "talento", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "talento", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "talento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": 3}, {"rol": "PASTOR_PRINCIPAL", "modulo": "consejeria", "accion": "ver", "nivel": 3}, {"rol": "PASTOR_PRINCIPAL", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "SECRETARIA", "modulo": "formacion", "accion": "editar", "nivel": null}, {"rol": "SECRETARIA", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "SECRETARIA", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "SECRETARIA", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "crear", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "editar", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "exportar", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "ver", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "ANULAR_CERTIFICADO", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "EXPEDIR_CERTIFICADO", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "REGISTRAR_APORTE", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "anular", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "crear", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "ver", "nivel": null}, {"rol": "TESORERIA", "modulo": "personas", "accion": "ver", "nivel": null}];

  /* ---------- 6 · ALCANCES (identidad.tipo_alcance)
     Siete, no tres. Los cuatro últimos son los que hacen que el
     sistema sirva de verdad: sin `grupo` un líder ve toda la sede;
     sin `caso_propio` un consejero ve todos los casos de su sede. ---------- */
  const ALCANCES = [
    { codigo:"organizacion",   nombre:"Toda la organización", exigeId:false,
      ayuda:"Las 36 iglesias. Reservado a la Dirección General." },
    { codigo:"sede",           nombre:"Una sede",             exigeId:true, fuente:"sedes",
      ayuda:"Solo esa iglesia local. Es el alcance del pastor congregacional." },
    { codigo:"ministerio",     nombre:"Un ministerio",        exigeId:true, fuente:"ministerios",
      ayuda:"RocaKids, tMt, Mujer Integral... dentro de su sede." },
    { codigo:"segmento",       nombre:"Un segmento",          exigeId:true, fuente:"segmentos",
      ayuda:"Agrupación transversal de personas." },
    { codigo:"grupo",          nombre:"Un grupo",             exigeId:true, fuente:"grupos",
      ayuda:"Un grupo pequeño o de hogar. Es el alcance del líder." },
    { codigo:"caso_propio",    nombre:"Solo sus casos",       exigeId:false,
      ayuda:"El consejero ve el caso que le ASIGNARON, no los de su sede." },
    { codigo:"persona_propia", nombre:"Solo su ficha",        exigeId:false,
      ayuda:"El miembro o el acudiente: sus propios datos y los de sus menores." },
  ];

  const SEDES       = [{"id": "35063b42-86c4-4f76-8a6a-4ca8bf38a5ee", "nombre": "Barcelona"}, {"id": "c53a9556-774f-4261-88b7-7e9db2685504", "nombre": "Bogotá Chicó"}, {"id": "ec85323e-2881-4942-b399-f8aa69262b2a", "nombre": "Bogotá Norte"}, {"id": "ca52fa5c-eb56-49af-8ffa-bbe2798363d4", "nombre": "Chía"}, {"id": "601d1c6a-ca10-4186-9833-b78f408ff800", "nombre": "Medellín"}, {"id": "144d3928-e77b-49ce-8003-44aa8a8b707d", "nombre": "Panamá"}];
  const MINISTERIOS = [{"codigo": "ROCAKIDS", "nombre": "RocaKids"}, {"codigo": "TMT", "nombre": "tMt · jóvenes 11-25"}];

  /* ============================================================
     LAS REGLAS. Cada una existe porque la base la impone; si la
     interfaz no las aplica, deja pedir cosas que van a fallar.
     ============================================================ */

  const rol     = c => ROLES.find(r => r.codigo === c) || null;
  const modulo  = c => MODULOS.find(m => m.codigo === c) || null;
  const alcance = c => ALCANCES.find(a => a.codigo === c) || null;
  const nivel   = n => NIVELES.find(x => x.nivel === n) || null;

  /* R1 · TECHO DEL ROL. Un rol con techo N2 no puede tocar un módulo
     que maneja N4, por mucho que alguien se lo quiera dar.
     (sistema.tg_permiso_respeta_nivel) */
  function rolPuedeModulo(codRol, codMod) {
    const r = rol(codRol), m = modulo(codMod);
    if (!r || !m) return { ok:false, razon:"Rol o módulo inexistente" };
    if (r.techo < m.nivel) return { ok:false,
      razon:`«${r.nombre}» tiene techo N${r.techo} y «${m.nombre}» maneja dato N${m.nivel}. No es otorgable.` };
    return { ok:true };
  }

  /* R2 · EL ALCANCE DEBE ESTAR IDENTIFICADO. Decir «alcance: sede» sin
     decir CUÁL sede deja la puerta abierta.
     (identidad.asignacion_alcance_identificado) */
  function alcanceValido(codAlc, alcanceId) {
    const a = alcance(codAlc);
    if (!a) return { ok:false, razon:"Alcance inexistente" };
    if (a.exigeId && !alcanceId) return { ok:false,
      razon:`El alcance «${a.nombre}» exige decir cuál. Sin eso, la base rechaza la asignación.` };
    if (!a.exigeId && alcanceId) return { ok:false,
      razon:`El alcance «${a.nombre}» no lleva identificador.` };
    return { ok:true };
  }

  /* R3 · NADIE OTORGA POR ENCIMA DE SU PROPIO TECHO. Quien asigna no
     puede dar un nivel que él mismo no tiene. */
  function puedeOtorgar(techoDeQuienOtorga, nivelPedido) {
    if (nivelPedido > techoDeQuienOtorga) return { ok:false,
      razon:`Está otorgando N${nivelPedido} y su propio techo es N${techoDeQuienOtorga}. Nadie da lo que no tiene.` };
    return { ok:true };
  }

  /* R4 · VIGENCIA COHERENTE. (identidad.asignacion_vigencia) */
  function vigenciaValida(desde, hasta) {
    if (!desde) return { ok:false, razon:"Falta la fecha de inicio." };
    if (hasta && hasta < desde) return { ok:false, razon:"La fecha de fin es anterior a la de inicio." };
    return { ok:true };
  }

  /* R5 · ACTA DE RESPALDO PARA DATO SENSIBLE. Dar acceso a N3 o N4
     (aportes, consejería, menores) sin constancia escrita es lo que
     nadie puede explicar después. */
  function exigeActa(nivelPedido) { return nivelPedido >= 3; }

  /* ---------- VALIDACIÓN COMPLETA DE UNA ASIGNACIÓN ---------- */
  function validarAsignacion(a, quienOtorga) {
    const fallos = [];
    const r = rol(a.rol);
    if (!r) fallos.push("El rol no existe.");
    const v2 = alcanceValido(a.alcanceTipo, a.alcanceId); if (!v2.ok) fallos.push(v2.razon);
    const v4 = vigenciaValida(a.desde, a.hasta);          if (!v4.ok) fallos.push(v4.razon);
    if (r && a.nivelMax > r.techo)
      fallos.push(`Pidió N${a.nivelMax} y el techo de «${r.nombre}» es N${r.techo}.`);
    if (quienOtorga) {
      const v3 = puedeOtorgar(quienOtorga.techo, a.nivelMax); if (!v3.ok) fallos.push(v3.razon);
    }
    if (exigeActa(a.nivelMax) && !a.acta)
      fallos.push(`N${a.nivelMax} es dato sensible: exige referencia del acta que lo respalda.`);
    if (!a.personaId) fallos.push("Falta decir a quién se le otorga.");
    return { ok: fallos.length === 0, fallos };
  }

  /* ---------- PERMISO EFECTIVO ----------
     Lo que una persona REALMENTE puede hacer: el cruce de sus
     asignaciones vigentes con la matriz, recortado por su nivel. */
  function permisoEfectivo(asignaciones, hoy) {
    hoy = hoy || new Date().toISOString().slice(0, 10);
    const vigentes = (asignaciones || []).filter(a =>
      a.desde <= hoy && (!a.hasta || a.hasta >= hoy));
    const mapa = {};
    vigentes.forEach(a => {
      MATRIZ.filter(p => p.rol === a.rol).forEach(p => {
        const m = modulo(p.modulo); if (!m) return;
        const tope = Math.min(a.nivelMax, p.nivel == null ? 4 : p.nivel);
        if (m.nivel > tope) return;               // el módulo pide más de lo que tiene
        const k = p.modulo;
        mapa[k] = mapa[k] || { modulo:p.modulo, nombre:m.nombre, nivelModulo:m.nivel,
                               acciones:new Set(), porque:[] };
        mapa[k].acciones.add(p.accion);
        const via = `${rol(a.rol) ? rol(a.rol).nombre : a.rol} · ${alcance(a.alcanceTipo) ? alcance(a.alcanceTipo).nombre : a.alcanceTipo}`;
        if (mapa[k].porque.indexOf(via) < 0) mapa[k].porque.push(via);
      });
    });
    return Object.keys(mapa).sort().map(k => ({
      modulo: mapa[k].modulo, nombre: mapa[k].nombre, nivelModulo: mapa[k].nivelModulo,
      acciones: Array.from(mapa[k].acciones).sort(), porque: mapa[k].porque,
    }));
  }

  /* ---------- ¿PUEDE VER ESTA PESTAÑA? ---------- */
  function puedeVer(asignaciones, codMod) {
    return permisoEfectivo(asignaciones).some(p => p.modulo === codMod);
  }
  function puedeHacer(asignaciones, codMod, accion) {
    const p = permisoEfectivo(asignaciones).find(x => x.modulo === codMod);
    return !!p && p.acciones.indexOf(accion) >= 0;
  }

  /* ---------- CADENA DE DELEGACIÓN · quién puede crear a quién ----------
     El master es la Dirección General: crea a todos. Pero un pastor
     de sede NO debe poder nombrar a otro pastor, ni subirse el techo. */
  const DELEGACION = {
    PASTOR_DIRECTOR_GENERAL: ["*"],
    PASTOR_PRINCIPAL: ["PASTOR_CONGREGACIONAL","DIRECTOR_MINISTERIO","DIRECTOR_SEGMENTO",
      "CONSEJERO","SECRETARIA","TESORERIA","CONTABILIDAD","TALENTO_HUMANO"],
    PASTOR_CONGREGACIONAL: ["DIRECTOR_MINISTERIO","COORDINADOR","COORDINADOR_NUEVOS",
      "COORDINADOR_SEGMENTO","LIDER_GRUPO","CONSEJERO","SECRETARIA","MAESTRO_ROCAKIDS","MIEMBRO"],
    DIRECTOR_MINISTERIO: ["COORDINADOR","LIDER_GRUPO","MAESTRO_ROCAKIDS","MIEMBRO"],
    DIRECTOR_SEGMENTO:   ["COORDINADOR_SEGMENTO","LIDER_GRUPO","MIEMBRO"],
    COORDINADOR:         ["LIDER_GRUPO","MIEMBRO"],
  };
  function rolesQuePuedeCrear(codRol) {
    const l = DELEGACION[codRol];
    if (!l) return [];
    if (l[0] === "*") return ROLES.map(r => r.codigo);
    return l;
  }

  /* ---------- ⚠️ DIVERGENCIAS CON EL DOCUMENTO DE JHON (v1.0, 24 ago) ----------
     Se dejan escritas EN EL CÓDIGO, no en un correo, porque son las
     que hay que resolver en la mesa antes de conectar el frontend. */
  const DIVERGENCIAS = [
    { punto:"Qué significa cada nivel", gravedad:"alta",
      nuestro:"N2 = dato personal ordinario · N3 = sensible (APORTES, consejería, salud)",
      dejhon :"N1 = contacto privado · N2 = FINANCIERO (aportes, diezmos)",
      porque :"En su tabla, un rol de sensibilidad 2 VE LOS DIEZMOS. En la nuestra no: los aportes son N3 y exigen cifrado y bitácora de lectura. No es un desacuerdo de nombres, es de quién puede ver cuánto da cada persona." },
    { punto:"Cuántos alcances hay", gravedad:"alta",
      nuestro:"7: organización, sede, ministerio, segmento, grupo, caso propio, persona propia",
      dejhon :"3: SEDE, REGION, GLOBAL",
      porque :"Sin «caso propio» no se puede cumplir la regla de consejería que ya está construida y probada: el consejero ve el caso que le ASIGNARON, no todos los de su sede. Sin «grupo», un líder ve la sede entera." },
    { punto:"Cómo se identifica la sede", gravedad:"media",
      nuestro:"UUID con llave foránea a org.sedes",
      dejhon :"VARCHAR(50) con texto libre: 'bogota', 'medellin'",
      porque :"Texto libre no tiene integridad referencial: un error de tipeo crea una sede fantasma que nadie ve." },
    { punto:"La sede es obligatoria en la asignación", gravedad:"media",
      nuestro:"El alcance «organización» no lleva identificador, a propósito",
      dejhon :"usuario_roles.sede_id es OBLIGATORIO, pero roles.alcance_default admite GLOBAL",
      porque :"Se contradice consigo mismo: ¿qué sede se le pone al Director General? Nuestro modelo lo resuelve con el tipo de alcance." },
    { punto:"Catálogo de roles", gravedad:"baja",
      nuestro:"18 roles, con ACUDIENTE, MAESTRO_ROCAKIDS y los de segmento",
      dejhon :"9 roles de piso, con PROPIETARIO, DIGITADOR_APORTES y VISITANTE",
      porque :"Los dos son extensibles y no chocan. Solo hay que unificar nombres: él dice DIRECTOR_GENERAL donde nosotros PASTOR_DIRECTOR_GENERAL." },
  ];

  /* ---------- Lo BUENO de su documento, que conviene adoptar ---------- */
  const ADOPTAR_DE_JHON = [
    "roles.alcance_default: el rol trae su alcance sugerido y evita equivocarse al asignar.",
    "roles.activo: desactivar un rol sin borrarlo ni perder su historia.",
    "El enfoque progresivo declarado: cada módulo nuevo trae sus roles y permisos, sin refactorizar.",
  ];

  window.IDENTIDAD = {
    NIVELES, ROLES, MODULOS, ACCIONES, MATRIZ, ALCANCES, SEDES, MINISTERIOS,
    DIVERGENCIAS, ADOPTAR_DE_JHON, DELEGACION,
    rol, modulo, alcance, nivel,
    rolPuedeModulo, alcanceValido, puedeOtorgar, vigenciaValida, exigeActa,
    validarAsignacion, permisoEfectivo, puedeVer, puedeHacer, rolesQuePuedeCrear,
  };
})();
