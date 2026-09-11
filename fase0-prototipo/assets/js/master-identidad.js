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
  const ROLES = [{"codigo": "ACUDIENTE", "nombre": "Acudiente", "techo": 4, "alcanceMax": "persona_propia"}, {"codigo": "DIRECTOR_ROCAKIDS", "nombre": "Director de RocaKids", "techo": 4, "alcanceMax": "ministerio"}, {"codigo": "MAESTRO_ROCAKIDS", "nombre": "Maestro RocaKids", "techo": 4, "alcanceMax": "ministerio"}, {"codigo": "PASTOR_DIRECTOR_GENERAL", "nombre": "Pastor Director General", "techo": 4, "alcanceMax": "organizacion"}, {"codigo": "CONSEJERO", "nombre": "Consejero", "techo": 3, "alcanceMax": "caso_propio"}, {"codigo": "CONTABILIDAD", "nombre": "Contabilidad", "techo": 3, "alcanceMax": "organizacion"}, {"codigo": "PASTOR_PRINCIPAL", "nombre": "Pastor Principal", "techo": 3, "alcanceMax": "organizacion"}, {"codigo": "TALENTO_HUMANO", "nombre": "Talento Humano", "techo": 3, "alcanceMax": "organizacion"}, {"codigo": "TESORERIA", "nombre": "Tesorería", "techo": 3, "alcanceMax": "sede"}, {"codigo": "COORDINADOR", "nombre": "Coordinador", "techo": 2, "alcanceMax": "ministerio"}, {"codigo": "COORDINADOR_NUEVOS", "nombre": "Coordinador de Nuevos", "techo": 2, "alcanceMax": "sede"}, {"codigo": "COORDINADOR_SEGMENTO", "nombre": "Coordinador de Segmento", "techo": 2, "alcanceMax": "segmento"}, {"codigo": "DIRECTOR_MINISTERIO", "nombre": "Director de Ministerio", "techo": 2, "alcanceMax": "ministerio"}, {"codigo": "DIRECTOR_SEGMENTO", "nombre": "Director de Segmento", "techo": 2, "alcanceMax": "segmento"}, {"codigo": "LIDER_GRUPO", "nombre": "Líder", "techo": 2, "alcanceMax": "grupo"}, {"codigo": "MIEMBRO", "nombre": "Miembro", "techo": 2, "alcanceMax": "persona_propia"}, {"codigo": "PASTOR_CONGREGACIONAL", "nombre": "Pastor Congregacional", "techo": 2, "alcanceMax": "sede"}, {"codigo": "SECRETARIA", "nombre": "Secretaría", "techo": 2, "alcanceMax": "sede"}, {"codigo": "INTEGRACION_TECNICA", "nombre": "Integración técnica", "techo": 1, "alcanceMax": "organizacion"}];

  /* ---------- 3 · MÓDULOS (sistema.modulos)
     `nivel` es el dato que maneja el módulo. Un rol con techo menor
     no puede recibir permiso sobre él. ---------- */
  const MODULOS = [{"codigo": "personas", "nombre": "Personas", "nivel": 2, "esquema": "nucleo", "compuerta": false}, {"codigo": "organizacion", "nombre": "Organización y sedes", "nivel": 1, "esquema": "org", "compuerta": false}, {"codigo": "identidad", "nombre": "Identidad y accesos", "nivel": 2, "esquema": "identidad", "compuerta": false}, {"codigo": "cumplimiento", "nombre": "Auditoría y cumplimiento", "nivel": 2, "esquema": "plataforma", "compuerta": false}, {"codigo": "crm", "nombre": "CRM Pastoral · 4C", "nivel": 2, "esquema": "crm", "compuerta": false}, {"codigo": "grupos", "nombre": "Grupos y hogares", "nivel": 2, "esquema": "grupos", "compuerta": false}, {"codigo": "asistencia", "nombre": "Asistencia", "nivel": 2, "esquema": "asistencia", "compuerta": false}, {"codigo": "formacion", "nombre": "Formación e Instituto", "nivel": 2, "esquema": "formacion", "compuerta": false}, {"codigo": "talento", "nombre": "Talento y voluntariado", "nivel": 3, "esquema": "talento", "compuerta": false}, {"codigo": "consejeria", "nombre": "Consejería", "nivel": 3, "esquema": "consejeria", "compuerta": true}, {"codigo": "aportes", "nombre": "Aportes", "nivel": 3, "esquema": "aportes", "compuerta": true}, {"codigo": "rocakids", "nombre": "RocaKids", "nivel": 4, "esquema": "rocakids", "compuerta": true}, {"codigo": "analitica", "nombre": "Analítica y tableros", "nivel": 2, "esquema": "plataforma", "compuerta": false}, {"codigo": "tareas", "nombre": "Tareas", "nivel": 1, "esquema": "plataforma", "compuerta": false}, {"codigo": "calendario", "nombre": "Calendario", "nivel": 1, "esquema": "org", "compuerta": false}, {"codigo": "tematicas", "nombre": "Temáticas y enseñanza", "nivel": 1, "esquema": "formacion", "compuerta": false}, {"codigo": "oracion", "nombre": "Peticiones de oración", "nivel": 3, "esquema": "crm", "compuerta": true}, {"codigo": "requerimientos", "nombre": "Requerimientos", "nivel": 1, "esquema": "sistema", "compuerta": false}, {"codigo": "peticiones", "nombre": "Peticiones internas", "nivel": 2, "esquema": "sistema", "compuerta": false}, {"codigo": "legal", "nombre": "Legal", "nivel": 3, "esquema": "plataforma", "compuerta": true}, {"codigo": "comunicaciones", "nombre": "Comunicaciones", "nivel": 2, "esquema": "crm", "compuerta": false}, {"codigo": "construccion", "nombre": "Construcción", "nivel": 1, "esquema": "org", "compuerta": false}];

  /* ---------- 4 · ACCIONES (sistema.acciones)
     Verbos genéricos (ver, crear, editar...) y verbos NOMBRADOS, que
     son los que de verdad importan en una iglesia: ENTREGAR_MENOR,
     VER_NOTAS_CONFIDENCIALES, ANULAR_CERTIFICADO. ---------- */
  const ACCIONES = [{"codigo": "ANULAR_CERTIFICADO", "nombre": "Anular certificado"}, {"codigo": "CONFIRMAR_APORTE", "nombre": "Confirmar un aporte"}, {"codigo": "CONVERTIR_MIEMBRO", "nombre": "Convertir un nuevo en miembro"}, {"codigo": "ENTREGAR_MENOR", "nombre": "Entregar un menor a su acudiente"}, {"codigo": "EXPEDIR_CERTIFICADO", "nombre": "Expedir certificado tributario"}, {"codigo": "REGISTRAR_APORTE", "nombre": "Registrar un aporte"}, {"codigo": "REGISTRAR_CONTACTO", "nombre": "Registrar contacto de seguimiento"}, {"codigo": "VER_METRICAS_NUEVOS", "nombre": "Ver métricas de crecimiento"}, {"codigo": "VER_NOTAS_CONFIDENCIALES", "nombre": "Ver notas de consejería"}, {"codigo": "administrar", "nombre": "Administrar"}, {"codigo": "anular", "nombre": "Anular"}, {"codigo": "crear", "nombre": "Crear"}, {"codigo": "editar", "nombre": "Editar"}, {"codigo": "exportar", "nombre": "Exportar"}, {"codigo": "ver", "nombre": "Ver"}];

  /* ---------- 5 · MATRIZ (sistema.matriz_permisos) · 173 filas reales ---------- */
  const MATRIZ = [{"rol": "ACUDIENTE", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "ACUDIENTE", "modulo": "rocakids", "accion": "ver", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "crear", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "editar", "nivel": null}, {"rol": "CONSEJERO", "modulo": "consejeria", "accion": "ver", "nivel": null}, {"rol": "CONSEJERO", "modulo": "oracion", "accion": "ver", "nivel": null}, {"rol": "CONSEJERO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "aportes", "accion": "CONFIRMAR_APORTE", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "aportes", "accion": "exportar", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "aportes", "accion": "ver", "nivel": null}, {"rol": "CONTABILIDAD", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "analitica", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "analitica", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "analitica", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "calendario", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "calendario", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "calendario", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "CONVERTIR_MIEMBRO", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "peticiones", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "peticiones", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR_NUEVOS", "modulo": "peticiones", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "COORDINADOR_SEGMENTO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "analitica", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "analitica", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "analitica", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "calendario", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "calendario", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "calendario", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "formacion", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "peticiones", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "peticiones", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "peticiones", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "tareas", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "tareas", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "tareas", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "tematicas", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "tematicas", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_MINISTERIO", "modulo": "tematicas", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "rocakids", "accion": "ENTREGAR_MENOR", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "rocakids", "accion": "administrar", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "rocakids", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "rocakids", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "rocakids", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_ROCAKIDS", "modulo": "talento", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "DIRECTOR_SEGMENTO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "INTEGRACION_TECNICA", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "calendario", "accion": "crear", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "calendario", "accion": "editar", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "calendario", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "peticiones", "accion": "crear", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "peticiones", "accion": "editar", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "peticiones", "accion": "ver", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "tematicas", "accion": "crear", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "tematicas", "accion": "editar", "nivel": null}, {"rol": "LIDER_GRUPO", "modulo": "tematicas", "accion": "ver", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "ENTREGAR_MENOR", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "crear", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "editar", "nivel": null}, {"rol": "MAESTRO_ROCAKIDS", "modulo": "rocakids", "accion": "ver", "nivel": null}, {"rol": "MIEMBRO", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "MIEMBRO", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "MIEMBRO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "MIEMBRO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "analitica", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "analitica", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "analitica", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "asistencia", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "calendario", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "calendario", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "calendario", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "comunicaciones", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "comunicaciones", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "comunicaciones", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": 3}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "consejeria", "accion": "ver", "nivel": 3}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "CONVERTIR_MIEMBRO", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "identidad", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "identidad", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "organizacion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "peticiones", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "peticiones", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "peticiones", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "requerimientos", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "requerimientos", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "requerimientos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "tareas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "tareas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "tareas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "tematicas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "tematicas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_CONGREGACIONAL", "modulo": "tematicas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "analitica", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "analitica", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "analitica", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "aportes", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "aportes", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "asistencia", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "calendario", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "calendario", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "calendario", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "comunicaciones", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "comunicaciones", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "comunicaciones", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": 4}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "consejeria", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "construccion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "construccion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "construccion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "VER_METRICAS_NUEVOS", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "cumplimiento", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "formacion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "grupos", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "grupos", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "administrar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "identidad", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "legal", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "legal", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "legal", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "oracion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "oracion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "oracion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "administrar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "administrar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "exportar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "peticiones", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "peticiones", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "peticiones", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "requerimientos", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "requerimientos", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "requerimientos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "rocakids", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "talento", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "talento", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "talento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "tareas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "tareas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "tareas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "tematicas", "accion": "crear", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "tematicas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_DIRECTOR_GENERAL", "modulo": "tematicas", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "asistencia", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "consejeria", "accion": "VER_NOTAS_CONFIDENCIALES", "nivel": 3}, {"rol": "PASTOR_PRINCIPAL", "modulo": "consejeria", "accion": "ver", "nivel": 3}, {"rol": "PASTOR_PRINCIPAL", "modulo": "crm", "accion": "REGISTRAR_CONTACTO", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "crm", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "cumplimiento", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "legal", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "oracion", "accion": "crear", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "oracion", "accion": "editar", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "oracion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "PASTOR_PRINCIPAL", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "calendario", "accion": "crear", "nivel": null}, {"rol": "SECRETARIA", "modulo": "calendario", "accion": "editar", "nivel": null}, {"rol": "SECRETARIA", "modulo": "calendario", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "formacion", "accion": "crear", "nivel": null}, {"rol": "SECRETARIA", "modulo": "formacion", "accion": "editar", "nivel": null}, {"rol": "SECRETARIA", "modulo": "formacion", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "grupos", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "organizacion", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "personas", "accion": "crear", "nivel": null}, {"rol": "SECRETARIA", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "SECRETARIA", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "requerimientos", "accion": "crear", "nivel": null}, {"rol": "SECRETARIA", "modulo": "requerimientos", "accion": "editar", "nivel": null}, {"rol": "SECRETARIA", "modulo": "requerimientos", "accion": "ver", "nivel": null}, {"rol": "SECRETARIA", "modulo": "tareas", "accion": "crear", "nivel": null}, {"rol": "SECRETARIA", "modulo": "tareas", "accion": "editar", "nivel": null}, {"rol": "SECRETARIA", "modulo": "tareas", "accion": "ver", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "personas", "accion": "editar", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "personas", "accion": "ver", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "crear", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "editar", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "exportar", "nivel": null}, {"rol": "TALENTO_HUMANO", "modulo": "talento", "accion": "ver", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "ANULAR_CERTIFICADO", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "EXPEDIR_CERTIFICADO", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "REGISTRAR_APORTE", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "anular", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "crear", "nivel": null}, {"rol": "TESORERIA", "modulo": "aportes", "accion": "ver", "nivel": null}, {"rol": "TESORERIA", "modulo": "personas", "accion": "ver", "nivel": null}];

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


  /* ---------- 7 · CONFIGURACIÓN POR IGLESIA ----------
     Aquí está la respuesta a «no todas las iglesias van a ser iguales».
     No se resuelve escondiendo pestañas a mano: se resuelve con
     PLANTILLA al crear la iglesia, y ajuste fino después.
     Una PLANTACION nace con 7 de los 12 módulos: sin aportes, sin
     RocaKids, sin consejería. No es una carencia, es su etapa. ---------- */
  const PLANTILLAS = [{"codigo": "FILIAL", "nombre": "Filial nacional", "tipo": "filial_nacional", "desc": "Operación completa de una sede en Colombia."}, {"codigo": "INTERNAC", "nombre": "Filial internacional", "tipo": "filial_internacional", "desc": "Igual que la filial, pero migra en la última ola por GDPR y husos horarios."}, {"codigo": "MAESTRA", "nombre": "Sede maestra", "tipo": "sede_madre", "desc": "Todos los módulos. Es la que gobierna el ecosistema."}, {"codigo": "PLANTACION", "nombre": "Plantación", "tipo": "plantacion", "desc": "Arranque mínimo: personas, seguimiento y grupos. Sin aportes ni menores hasta consolidarse."}];
  const PLANTILLA_MODS = [{"plantilla": "MAESTRA", "modulo": "personas"}, {"plantilla": "MAESTRA", "modulo": "organizacion"}, {"plantilla": "MAESTRA", "modulo": "identidad"}, {"plantilla": "MAESTRA", "modulo": "cumplimiento"}, {"plantilla": "MAESTRA", "modulo": "crm"}, {"plantilla": "MAESTRA", "modulo": "grupos"}, {"plantilla": "MAESTRA", "modulo": "asistencia"}, {"plantilla": "MAESTRA", "modulo": "formacion"}, {"plantilla": "MAESTRA", "modulo": "talento"}, {"plantilla": "MAESTRA", "modulo": "consejeria"}, {"plantilla": "MAESTRA", "modulo": "aportes"}, {"plantilla": "MAESTRA", "modulo": "rocakids"}, {"plantilla": "FILIAL", "modulo": "personas"}, {"plantilla": "FILIAL", "modulo": "organizacion"}, {"plantilla": "FILIAL", "modulo": "identidad"}, {"plantilla": "FILIAL", "modulo": "cumplimiento"}, {"plantilla": "FILIAL", "modulo": "crm"}, {"plantilla": "FILIAL", "modulo": "grupos"}, {"plantilla": "FILIAL", "modulo": "asistencia"}, {"plantilla": "FILIAL", "modulo": "formacion"}, {"plantilla": "FILIAL", "modulo": "talento"}, {"plantilla": "FILIAL", "modulo": "consejeria"}, {"plantilla": "FILIAL", "modulo": "aportes"}, {"plantilla": "FILIAL", "modulo": "rocakids"}, {"plantilla": "INTERNAC", "modulo": "personas"}, {"plantilla": "INTERNAC", "modulo": "organizacion"}, {"plantilla": "INTERNAC", "modulo": "identidad"}, {"plantilla": "INTERNAC", "modulo": "cumplimiento"}, {"plantilla": "INTERNAC", "modulo": "crm"}, {"plantilla": "INTERNAC", "modulo": "grupos"}, {"plantilla": "INTERNAC", "modulo": "asistencia"}, {"plantilla": "INTERNAC", "modulo": "formacion"}, {"plantilla": "INTERNAC", "modulo": "talento"}, {"plantilla": "INTERNAC", "modulo": "consejeria"}, {"plantilla": "INTERNAC", "modulo": "aportes"}, {"plantilla": "INTERNAC", "modulo": "rocakids"}, {"plantilla": "PLANTACION", "modulo": "personas"}, {"plantilla": "PLANTACION", "modulo": "organizacion"}, {"plantilla": "PLANTACION", "modulo": "identidad"}, {"plantilla": "PLANTACION", "modulo": "cumplimiento"}, {"plantilla": "PLANTACION", "modulo": "crm"}, {"plantilla": "PLANTACION", "modulo": "grupos"}, {"plantilla": "PLANTACION", "modulo": "asistencia"}, {"plantilla": "INTERNAC", "modulo": "analitica"}, {"plantilla": "FILIAL", "modulo": "analitica"}, {"plantilla": "MAESTRA", "modulo": "analitica"}, {"plantilla": "INTERNAC", "modulo": "tareas"}, {"plantilla": "FILIAL", "modulo": "tareas"}, {"plantilla": "MAESTRA", "modulo": "tareas"}, {"plantilla": "PLANTACION", "modulo": "calendario"}, {"plantilla": "INTERNAC", "modulo": "calendario"}, {"plantilla": "FILIAL", "modulo": "calendario"}, {"plantilla": "MAESTRA", "modulo": "calendario"}, {"plantilla": "PLANTACION", "modulo": "tematicas"}, {"plantilla": "INTERNAC", "modulo": "tematicas"}, {"plantilla": "FILIAL", "modulo": "tematicas"}, {"plantilla": "MAESTRA", "modulo": "tematicas"}, {"plantilla": "INTERNAC", "modulo": "oracion"}, {"plantilla": "FILIAL", "modulo": "oracion"}, {"plantilla": "MAESTRA", "modulo": "oracion"}, {"plantilla": "INTERNAC", "modulo": "requerimientos"}, {"plantilla": "FILIAL", "modulo": "requerimientos"}, {"plantilla": "MAESTRA", "modulo": "requerimientos"}, {"plantilla": "PLANTACION", "modulo": "peticiones"}, {"plantilla": "INTERNAC", "modulo": "peticiones"}, {"plantilla": "FILIAL", "modulo": "peticiones"}, {"plantilla": "MAESTRA", "modulo": "peticiones"}, {"plantilla": "MAESTRA", "modulo": "legal"}, {"plantilla": "INTERNAC", "modulo": "comunicaciones"}, {"plantilla": "FILIAL", "modulo": "comunicaciones"}, {"plantilla": "MAESTRA", "modulo": "comunicaciones"}, {"plantilla": "MAESTRA", "modulo": "construccion"}];
  const SEDES_FULL = [{"id": "35063b42-86c4-4f76-8a6a-4ca8bf38a5ee", "nombre": "Barcelona", "tipo": "filial_internacional", "pais": "ES", "ciudad": "Barcelona"}, {"id": "c53a9556-774f-4261-88b7-7e9db2685504", "nombre": "Bogotá Chicó", "tipo": "sede_madre", "pais": "CO", "ciudad": "Bogotá"}, {"id": "ec85323e-2881-4942-b399-f8aa69262b2a", "nombre": "Bogotá Norte", "tipo": "filial_nacional", "pais": "CO", "ciudad": "Bogotá"}, {"id": "ca52fa5c-eb56-49af-8ffa-bbe2798363d4", "nombre": "Chía", "tipo": "plantacion", "pais": "CO", "ciudad": "Chía"}, {"id": "601d1c6a-ca10-4186-9833-b78f408ff800", "nombre": "Medellín", "tipo": "filial_nacional", "pais": "CO", "ciudad": "Medellín"}, {"id": "144d3928-e77b-49ce-8003-44aa8a8b707d", "nombre": "Panamá", "tipo": "filial_internacional", "pais": "PA", "ciudad": "Ciudad de Panamá"}];
  const MODSEDE_SEED = [{"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "personas", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "organizacion", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "identidad", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "cumplimiento", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "crm", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "grupos", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "asistencia", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "formacion", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "talento", "activo": true, "evidencia": null}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "consejeria", "activo": true, "evidencia": "PENDIENTE-H02 · demostración"}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "aportes", "activo": true, "evidencia": "PENDIENTE-H02 · demostración"}, {"sede": "8db9b4db-3abc-406e-b9a0-cbacd5d9e64c", "modulo": "rocakids", "activo": true, "evidencia": "PENDIENTE-H02 · demostración"}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "personas", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "organizacion", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "identidad", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "cumplimiento", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "crm", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "grupos", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "asistencia", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "formacion", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "talento", "activo": true, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "consejeria", "activo": false, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "aportes", "activo": false, "evidencia": null}, {"sede": "5900cb60-6c34-45af-9e3f-ef62bfd7472a", "modulo": "rocakids", "activo": false, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "personas", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "organizacion", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "identidad", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "cumplimiento", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "crm", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "grupos", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "asistencia", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "formacion", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "talento", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "consejeria", "activo": false, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "aportes", "activo": false, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "personas", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "organizacion", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "identidad", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "cumplimiento", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "crm", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "grupos", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "asistencia", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "formacion", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "talento", "activo": true, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "consejeria", "activo": false, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "aportes", "activo": false, "evidencia": null}, {"sede": "a7386ea9-804c-4aac-a1d4-0a0f25bc7ace", "modulo": "rocakids", "activo": false, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "personas", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "organizacion", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "identidad", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "cumplimiento", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "crm", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "grupos", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "asistencia", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "formacion", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "talento", "activo": true, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "consejeria", "activo": false, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "aportes", "activo": false, "evidencia": null}, {"sede": "ca6d755c-158b-432a-9e9d-07f5ee56254c", "modulo": "rocakids", "activo": false, "evidencia": null}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "personas", "activo": true, "evidencia": null}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "organizacion", "activo": true, "evidencia": null}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "identidad", "activo": true, "evidencia": null}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "cumplimiento", "activo": true, "evidencia": null}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "crm", "activo": true, "evidencia": null}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "grupos", "activo": true, "evidencia": null}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "asistencia", "activo": true, "evidencia": null}, {"sede": "aad44da2-9304-4519-af15-f445baf2d5b9", "modulo": "rocakids", "activo": true, "evidencia": "ACTA-SIC-2026-014"}, {"sede": "b76fc103-ba88-4b72-9a93-94a9abefdc06", "modulo": "aportes", "activo": true, "evidencia": "ACTA-X"}];

  function modulosDePlantilla(cod) {
    return PLANTILLA_MODS.filter(p => p.plantilla === cod).map(p => p.modulo).sort();
  }
  function plantilla(cod) { return PLANTILLAS.find(p => p.codigo === cod) || null; }


  /* ---------- 8 · PLANTILLAS DE ACCESO ----------
     Así lo resuelven Okta, Google Workspace y Notion: nadie compone
     «rol x alcance x nivel x vigencia» a mano cada vez. Se elige
     «Pastor de una iglesia», se dice CUÁL iglesia, y listo. Las
     cuatro dimensiones van pre-rellenadas.

     La configuración avanzada sigue existiendo para el 5% de casos
     raros. Pero el 95% se resuelve en dos clics.
     ---------- */
  const PRESETS = [
    { id:"direccion", titulo:"Dirección General",  sub:"Toda la red, las 36 iglesias",
      rol:"PASTOR_DIRECTOR_GENERAL", alcanceTipo:"organizacion", nivelMax:4, ico:"\uD83C\uDF10" },
    { id:"pastor",    titulo:"Pastor de una iglesia", sub:"Opera su sede completa",
      rol:"PASTOR_CONGREGACIONAL", alcanceTipo:"sede", nivelMax:2, ico:"\u26EA" },
    { id:"dirmin",    titulo:"Director de ministerio", sub:"RocaKids, tMt, Mujer Integral…",
      rol:"DIRECTOR_MINISTERIO", alcanceTipo:"ministerio", nivelMax:2, ico:"\uD83D\uDDC2\uFE0F" },
    { id:"lider",     titulo:"Líder de grupo",  sub:"Solo su grupo pequeño o de hogar",
      rol:"LIDER_GRUPO", alcanceTipo:"grupo", nivelMax:2, ico:"\uD83D\uDC65" },
    { id:"consejero", titulo:"Consejero",       sub:"Solo los casos que le asignen",
      rol:"CONSEJERO", alcanceTipo:"caso_propio", nivelMax:3, ico:"\uD83D\uDCAC", acta:true },
    { id:"tesoreria", titulo:"Tesorería de una iglesia", sub:"Aportes y certificados de su sede",
      rol:"TESORERIA", alcanceTipo:"sede", nivelMax:3, ico:"\uD83D\uDCB0", acta:true },
    { id:"rocakids",  titulo:"Maestro de RocaKids", sub:"Entrada y entrega de menores",
      rol:"MAESTRO_ROCAKIDS", alcanceTipo:"ministerio", nivelMax:4, ico:"\uD83E\uDDD2", acta:true },
    { id:"nuevos",    titulo:"Coordinador de Nuevos", sub:"Registra y hace seguimiento del 4C",
      rol:"COORDINADOR_NUEVOS", alcanceTipo:"sede", nivelMax:2, ico:"\uD83C\uDF31" },
    { id:"secretaria",titulo:"Secretaría",      sub:"Personas, grupos y formación de su sede",
      rol:"SECRETARIA", alcanceTipo:"sede", nivelMax:2, ico:"\uD83D\uDCCB" },
    { id:"talento",   titulo:"Talento Humano",  sub:"Voluntariado y antecedentes",
      rol:"TALENTO_HUMANO", alcanceTipo:"sede", nivelMax:3, ico:"\uD83E\uDD1D", acta:true },
    { id:"miembro",   titulo:"Miembro",         sub:"Solo su propia ficha",
      rol:"MIEMBRO", alcanceTipo:"persona_propia", nivelMax:2, ico:"\uD83D\uDC64" },
    { id:"acudiente", titulo:"Acudiente",       sub:"Su ficha y la de sus menores",
      rol:"ACUDIENTE", alcanceTipo:"persona_propia", nivelMax:4, ico:"\uD83D\uDC6A", acta:true },
  ];
  const preset = id => PRESETS.find(p => p.id === id) || null;

  /* ---------- 9 · EQUIPOS ADMINISTRATIVOS ----------
     Los 8 equipos del back-office. Un equipo no es un rol: es un
     conjunto de roles que se otorgan juntos. Crear el equipo de
     Tesorería de una sede deberia ser un clic, no cuatro. ---------- */
  const EQUIPOS = [
    { codigo:"CONTABLE",       nombre:"Contable",         ambito:"corporativo", roles:["CONTABILIDAD"] },
    { codigo:"TESORERIA",      nombre:"Tesorería",        ambito:"local",       roles:["TESORERIA"] },
    { codigo:"LEGAL",          nombre:"Legal",            ambito:"corporativo", roles:["SECRETARIA"] },
    { codigo:"TALENTO",        nombre:"Talento Humano",   ambito:"local",       roles:["TALENTO_HUMANO"] },
    { codigo:"SEGURIDAD",      nombre:"Seguridad",        ambito:"local",       roles:["SECRETARIA"] },
    { codigo:"TECNOLOGIA",     nombre:"Tecnología",       ambito:"corporativo", roles:["INTEGRACION_TECNICA"] },
    { codigo:"CULTURA",        nombre:"Cultura",          ambito:"local",       roles:["COORDINADOR"] },
    { codigo:"COMUNICACIONES", nombre:"Comunicaciones",   ambito:"local",       roles:["COORDINADOR"] },
  ];


  /* ---------- 10 · NIVELES DE ACCESO · el vocabulario ÚNICO ----------
     Quince acciones son demasiadas para pedirle a un pastor que las
     marque una por una en cada ministerio. Y si cada pantalla usa
     palabras distintas, nadie entiende el sistema.

     Por eso hay TRES niveles, y son los mismos en todas partes: en un
     rol, en un ministerio y en un equipo interno. Son acumulativos:
     quien edita también ve; quien tiene permiso completo también edita.

     Debajo siguen estando las 15 acciones, para el caso raro. Pero el
     95% de las veces basta con decir «ver», «editar» o «completo».
     ---------- */
  const NIVELES_ACCESO = [
    { codigo:"ver",      nombre:"Ver",             orden:1,
      ayuda:"Consulta y exporta. No cambia nada.",
      verbos:["ver","exportar"] },
    { codigo:"editar",   nombre:"Editar",          orden:2,
      ayuda:"Todo lo anterior, y además crea y modifica.",
      verbos:["ver","exportar","crear","editar"] },
    { codigo:"completo", nombre:"Permiso completo", orden:3,
      ayuda:"Todo lo anterior, más anular, administrar y las acciones nombradas del módulo.",
      verbos:["ver","exportar","crear","editar","anular","administrar"] },
  ];
  const nivelAcceso = c => NIVELES_ACCESO.find(n => n.codigo === c) || null;

  /* Qué acciones concretas implica un nivel sobre un módulo dado.
     Las acciones NOMBRADAS (ENTREGAR_MENOR, VER_NOTAS_CONFIDENCIALES,
     ANULAR_CERTIFICADO) solo entran con permiso completo: son las que
     de verdad pesan, y un «editar» no puede arrastrarlas por descuido. */
  function accionesDeNivel(codNivel, codModulo) {
    const n = nivelAcceso(codNivel); if (!n) return [];
    const acc = n.verbos.slice();
    if (codNivel === "completo") {
      MATRIZ.filter(p => p.modulo === codModulo && /^[A-Z]/.test(p.accion))
        .forEach(p => { if (acc.indexOf(p.accion) < 0) acc.push(p.accion); });
    }
    return acc;
  }

  /* Y al revés: dado un conjunto de acciones, qué nivel representa.
     Sirve para mostrar el estado actual sin mentir: si un rol tiene
     «crear» pero no «editar», no se dibuja como «editar». */
  function nivelDeAcciones(acciones) {
    const a = acciones || [];
    const tiene = v => a.indexOf(v) >= 0;
    if (tiene("administrar") || tiene("anular")) return "completo";
    if (tiene("crear") || tiene("editar")) return "editar";
    if (tiene("ver") || tiene("exportar")) return "ver";
    return null;
  }


  /* ---------- 11 · PANELES · qué VE cada rol cuando se le activa ----------
     Esto es lo que convierte «apps por rol» de una lista de demos en el
     sistema de verdad: cada rol tiene su panel, y ese panel se abre
     SOLO si se cumplen tres cosas a la vez:

       1. La persona tiene ese rol vigente.
       2. Su alcance corresponde (esta sede, este ministerio, este grupo).
       3. La iglesia tiene encendido el módulo del que depende el panel.

     Si se crea una iglesia en Chigorodó y se nombra a su pastor, ese
     pastor abre el panel de pastor de sede. Él crea sus ministerios
     dentro de los permisos que le dieron, y los directores de esos
     ministerios crean a sus líderes. La cascada sale de aquí, no de un
     menú escrito a mano.
     ---------- */
  const PANELES = [
    { rol:"PASTOR_DIRECTOR_GENERAL", url:"central.html",            nombre:"Dirección General",
      modulo:"organizacion", alcance:"organizacion",
      crea:["Pastores de sede","Equipos corporativos","Iglesias"] },
    { rol:"PASTOR_CONGREGACIONAL",   url:"pastor.html",             nombre:"Pastor de sede",
      modulo:"personas",     alcance:"sede",
      crea:["Ministerios de su iglesia","Equipos locales","Coordinadores"] },
    { rol:"DIRECTOR_MINISTERIO",     url:"director.html",           nombre:"Director de ministerio",
      modulo:"grupos",       alcance:"ministerio",
      crea:["Líderes de grupo","Coordinadores de su ministerio"] },
    { rol:"LIDER_GRUPO",             url:"lider.html",              nombre:"Líder de grupo",
      modulo:"grupos",       alcance:"grupo",
      crea:["Miembros de su grupo"] },
    { rol:"COORDINADOR_NUEVOS",      url:"nicodemo.html",           nombre:"Nicodemo · nuevos",
      modulo:"crm",          alcance:"sede", crea:[] },
    { rol:"MAESTRO_ROCAKIDS",        url:"rocakids-domingo.html",   nombre:"RocaKids · domingo",
      modulo:"rocakids",     alcance:"ministerio", crea:[] },
    { rol:"DIRECTOR_MINISTERIO",     url:"rocakids-director.html",  nombre:"RocaKids · dirección",
      modulo:"rocakids",     alcance:"ministerio", crea:["Maestros de RocaKids"] },
    { rol:"CONSEJERO",               url:"consejeria-consejero.html", nombre:"Consejería · consejero",
      modulo:"consejeria",   alcance:"caso_propio", crea:[] },
    { rol:"COORDINADOR",             url:"consejeria-coordinador.html", nombre:"Consejería · coordinación",
      modulo:"consejeria",   alcance:"sede", crea:["Consejeros"] },
    { rol:"PASTOR_PRINCIPAL",        url:"consejeria-director.html", nombre:"Consejería · dirección",
      modulo:"consejeria",   alcance:"organizacion", crea:["Coordinadores de consejería"] },
    { rol:"MIEMBRO",                 url:"experiencia-v3.html",     nombre:"Experiencia pública",
      modulo:"personas",     alcance:"persona_propia", crea:[] },
  ];

  /* Qué paneles abriría esta persona HOY, con sus asignaciones vigentes
     y con lo que tenga encendido su iglesia. */
  function panelesDe(asignaciones, moduloActivoEnSede) {
    const hoy = new Date().toISOString().slice(0, 10);
    const vig = (asignaciones || []).filter(a => a.desde <= hoy && (!a.hasta || a.hasta >= hoy));
    const out = [];
    PANELES.forEach(pn => {
      const a = vig.find(x => x.rol === pn.rol);
      if (!a) return;
      const m = modulo(pn.modulo);
      const porTecho = !m || a.nivelMax >= m.nivel;
      const encendido = !moduloActivoEnSede || !a.alcanceId
        ? true : moduloActivoEnSede(a.alcanceId, pn.modulo);
      out.push(Object.assign({}, pn, { asignacion:a, porTecho, encendido,
        abre: porTecho && encendido }));
    });
    return out;
  }


  /* ---------- 12 · LOS HECHOS · la espina del CRM de comando ----------
     Esta es la decisión de arquitectura que ya estaba tomada bien en el
     backend, y conviene no romperla: **ningún módulo tiene su propio
     CRM.** Cada uno escribe un HECHO en `crm.linea_tiempo` y sigue con
     lo suyo. El CRM es la LECTURA de esa línea, no una capa encima de
     cada proceso.

     Por eso un aporte, una asistencia, un caso de consejería y un
     check-in de RocaKids caben en la misma tabla: cambia el `tipo` y el
     `detalle`, no la estructura. Y por eso se puede preguntar «qué ha
     pasado con esta persona» sin consultar siete módulos.
     ---------- */
  const TIPOS_HECHO = [{"codigo": "APORTE", "nombre": "Aporte registrado", "modulo": "aportes"}, {"codigo": "ASISTENCIA", "nombre": "Asistencia a un servicio", "modulo": "asistencia"}, {"codigo": "CASO_CONSEJERIA", "nombre": "Apertura de caso de consejería", "modulo": "consejeria"}, {"codigo": "CAMBIO_ETAPA", "nombre": "Cambio de etapa del recorrido 4C", "modulo": "crm"}, {"codigo": "LLAMADA", "nombre": "Llamada de seguimiento", "modulo": "crm"}, {"codigo": "NOTA_PASTORAL", "nombre": "Nota pastoral", "modulo": "crm"}, {"codigo": "PRIMERA_VISITA", "nombre": "Primera visita", "modulo": "crm"}, {"codigo": "VISITA_PASTORAL", "nombre": "Visita pastoral", "modulo": "crm"}, {"codigo": "CURSO_CERTIFICADO", "nombre": "Certificación de curso", "modulo": "formacion"}, {"codigo": "CURSO_INICIADO", "nombre": "Inicio de curso", "modulo": "formacion"}, {"codigo": "INGRESO_GRUPO", "nombre": "Ingreso a un grupo", "modulo": "grupos"}, {"codigo": "CHECKIN_ROCAKIDS", "nombre": "Check-in de menor", "modulo": "rocakids"}, {"codigo": "ENTREGA_ROCAKIDS", "nombre": "Entrega de menor a acudiente", "modulo": "rocakids"}];
  const tipoHecho = c => TIPOS_HECHO.find(t => t.codigo === c) || null;

  /* ============================================================
     LAS REGLAS. Cada una existe porque la base la impone; si la
     interfaz no las aplica, deja pedir cosas que van a fallar.
     ============================================================ */

  const rol     = c => ROLES.find(r => r.codigo === c) || null;
  /* Cada rol trae su alcance máximo: al marcar varios roles a la vez,
     cada uno arranca con el suyo y no hay que elegirlo doce veces. */
  const alcanceSugerido = c => { const r = rol(c); return r ? r.alcanceMax : null; };
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

  /* ---------- ALCANCE MODULAR ----------
     Una asignación podía apuntar a UNA sede. Pero un pastor regional
     cubre tres iglesias, y un director puede llevar dos ministerios.
     Obligarle a tener tres asignaciones iguales salvo el destino es
     papeleo, no seguridad.

     Ahora `alcanceIds` es una LISTA. `alcanceId` sigue funcionando para
     lo de siempre (una sola), y las dos conviven sin romper nada. */
  function alcancesDe(a) {
    if (a.alcanceIds && a.alcanceIds.length) return a.alcanceIds.slice();
    return a.alcanceId ? [a.alcanceId] : [];
  }
  function cubre(a, id) {
    const l = alcancesDe(a);
    return l.length ? l.indexOf(id) >= 0 : false;
  }

  /* R2 · EL ALCANCE DEBE ESTAR IDENTIFICADO. Decir «alcance: sede» sin
     decir CUÁL sede deja la puerta abierta.
     (identidad.asignacion_alcance_identificado) */
  function alcanceValido(codAlc, alcanceId, alcanceIds) {
    const a = alcance(codAlc);
    if (!a) return { ok:false, razon:"Alcance inexistente" };
    const n = (alcanceIds && alcanceIds.length) ? alcanceIds.length : (alcanceId ? 1 : 0);
    if (a.exigeId && !n) return { ok:false,
      razon:`El alcance «${a.nombre}» exige decir cuál. Sin eso, la base rechaza la asignación.` };
    if (!a.exigeId && n) return { ok:false,
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
    const v2 = alcanceValido(a.alcanceTipo, a.alcanceId, a.alcanceIds); if (!v2.ok) fallos.push(v2.razon);
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
  /* ---------- EXCEPCIONES POR PERSONA ----------
     El nivel N es un TECHO de seguridad: dice hasta qué sensibilidad
     puede llegar alguien, y eso sí es rígido a propósito. Pero DENTRO
     de ese techo, qué módulos ve cada persona debe poder ajustarse una
     por una.

     Caso real que lo motivó: un Pastor Director General alcanza los 12
     módulos por su rol, pero se quiere que este en concreto NO vea
     RocaKids. No hay que inventarle un rol nuevo ni bajarle el techo:
     se le apaga ese módulo a él.

     `asignacion.modulos` es un mapa de excepciones:
        undefined  → hereda lo que diga la matriz del rol
        false      → apagado para esta persona, aunque el rol lo dé
        true       → encendido, siempre que el techo lo permita
     Lo que NUNCA se puede es encender un módulo por encima del techo.
     Esa es la línea que no se mueve. ---------- */
  /* El nivel también es modular. Por defecto la asignación lleva UN
     nivel (`nivelMax`) que vale para todo: es el preestablecido y
     resuelve el 90% de los casos sin pensar.

     Pero se puede afinar por módulo con `nivelPorModulo`: «N2 en
     general, pero N3 en aportes». Lo que NO se puede es pasarse del
     techo del rol. Esa línea no se mueve por excepción, ni aquí ni en
     ningún otro sitio. */
  function nivelEn(asignacion, codModulo) {
    const ex = asignacion.nivelPorModulo && asignacion.nivelPorModulo[codModulo];
    const n = (ex === undefined || ex === null) ? asignacion.nivelMax : ex;
    const r = rol(asignacion.rol);
    return r ? Math.min(n, r.techo) : n;    // el techo del rol siempre recorta
  }

  function moduloPermitido(asignacion, codModulo, nivelModulo) {
    if (nivelEn(asignacion, codModulo) < nivelModulo) return { ok:false, razon:"techo" };
    const ex = asignacion.modulos && asignacion.modulos[codModulo];
    if (ex === false) return { ok:false, razon:"apagado a esta persona" };
    return { ok:true, forzado: ex === true };
  }

  function permisoEfectivo(asignaciones, hoy, matriz) {
    hoy = hoy || new Date().toISOString().slice(0, 10);
    /* Si el master ya editó la matriz, se usa la editada. El permiso
       efectivo tiene que reflejar lo que se acaba de cambiar. */
    const MTZ = matriz || (window.MSTORE && window.MSTORE.matriz ? window.MSTORE.matriz() : MATRIZ);
    const vigentes = (asignaciones || []).filter(a =>
      a.desde <= hoy && (!a.hasta || a.hasta >= hoy));
    const mapa = {};
    vigentes.forEach(a => {
      MTZ.filter(p => p.rol === a.rol).forEach(p => {
        const m = modulo(p.modulo); if (!m) return;
        const tope = Math.min(nivelEn(a, p.modulo), p.nivel == null ? 4 : p.nivel);
        if (m.nivel > tope) return;               // el módulo pide más de lo que tiene
        if (!moduloPermitido(a, p.modulo, m.nivel).ok) return;   // excepción de esta persona
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
    PLANTILLAS, PLANTILLA_MODS, SEDES_FULL, MODSEDE_SEED, modulosDePlantilla, plantilla,
    PRESETS, preset, EQUIPOS,
    NIVELES_ACCESO, nivelAcceso, accionesDeNivel, nivelDeAcciones,
    PANELES, panelesDe, TIPOS_HECHO, tipoHecho,
    DIVERGENCIAS, ADOPTAR_DE_JHON, DELEGACION,
    rol, modulo, alcance, nivel,
    rolPuedeModulo, alcanceValido, puedeOtorgar, vigenciaValida, exigeActa,
    validarAsignacion, permisoEfectivo, puedeVer, puedeHacer, rolesQuePuedeCrear,
    moduloPermitido, alcancesDe, cubre, nivelEn, alcanceSugerido,
  };
})();
