# Auditoría por pestaña · 21 de septiembre de 2026 (detenida a mitad)

Un agente por pestaña probó cada proceso de punta a punta en su propio puesto (copia de la red de demostración), con los roles que deben poder, los que no, otra sede, el teléfono y el modo demostración. El Workflow se detuvo a las 7:46 p. m. por decisión de Daniel, para cuidar los créditos de la semana.

## Estado

- **Auditadas y con reporte completo: 18 de 43.** Reporte crudo de cada una en `docs/auditoria-pestanas-21sep2026/reportes.json`.
- **Interrumpidas al detener (6):** Construcción, Legal, Habeas Data, Analítica, Catálogos, Consola · Puesta en marcha. No dejaron reporte: se repiten completas.
- **Sin empezar (19):** Consola · Tablero de la red, Consola · Personas con acceso, Consola · Crear acceso, Consola · Qué puede cada quien, Consola · Roles y techos, Consola · Recertificación, Consola · Iglesias y sedes, Consola · Plantillas, Consola · Qué ve cada iglesia, Consola · Equipos corporativos, Consola · Organigrama, Consola · Sesiones y alertas, Consola · Quién hizo y quién miró, Consola · Avisos e integraciones, Portal · Inicio, Portal · Mis datos, Portal · Mis permisos, Portal · Mis aportes, Portal · Mis derechos.
- **Refutación pendiente:** 276 hallazgos nuevos de las pestañas auditadas todavía no los reprodujo un segundo agente. Hasta entonces son candidatos, no defectos confirmados.
- Hallazgos reportados: 343 (12 críticos, 60 altos, 160 medios, 111 bajos).

## Pestañas auditadas

| Pestaña | Procesos bien | Fallan | Sin probar | Críticos | Altos | Medios y bajos | Nuevos por refutar | Candidatos del poblador confirmados |
|---|---|---|---|---|---|---|---|---|
| Entrar y la sesión | 18 | 10 | 0 | 0 | 0 | 0 | 0 | 4 |
| Panel | 18 | 11 | 0 | 2 | 3 | 10 | 15 | 8 |
| Personas y la ficha | 23 | 18 | 1 | 1 | 4 | 17 | 17 | 5 |
| Asistencia | 22 | 21 | 0 | 0 | 2 | 20 | 22 | 2 |
| Grupos | 26 | 22 | 0 | 0 | 3 | 15 | 14 | 4 |
| Niños (RocaKids) | 25 | 15 | 0 | 3 | 5 | 12 | 13 | 7 |
| Nuevos | 22 | 24 | 0 | 2 | 6 | 19 | 22 | 5 |
| Oración | 24 | 8 | 0 | 1 | 0 | 17 | 17 | 2 |
| Consejería | 25 | 20 | 0 | 0 | 7 | 15 | 14 | 8 |
| Formación | 24 | 25 | 1 | 0 | 2 | 25 | 19 | 8 |
| Calendario | 21 | 18 | 1 | 0 | 1 | 20 | 18 | 3 |
| Temáticas | 28 | 15 | 0 | 0 | 2 | 11 | 11 | 2 |
| Tareas | 23 | 11 | 0 | 0 | 3 | 16 | 18 | 1 |
| Talento | 21 | 22 | 1 | 2 | 7 | 18 | 21 | 6 |
| Comunicaciones | 27 | 15 | 1 | 0 | 4 | 12 | 13 | 3 |
| Peticiones internas | 29 | 11 | 0 | 0 | 1 | 14 | 13 | 1 |
| Requerimientos | 23 | 13 | 0 | 0 | 3 | 14 | 16 | 1 |
| Aportes | 28 | 18 | 0 | 1 | 7 | 16 | 13 | 11 |

## Hallazgos, de más grave a menos

Detalle completo (pasos, esperado, obtenido, evidencia, causa y arreglo) en `reportes.json`.

- **critica · aportes-1** (Aportes, capa api, origen propio): Cualquier rol N3 lee todas las donaciones por /api/v1/modelo100p sin tener permiso de Aportes
- **critica · ninos-1** (Niños (RocaKids), capa base, origen P19): Un maestro de otra sede registra y entrega a un niño ajeno (por la API y por la pantalla)
- **critica · ninos-2** (Niños (RocaKids), capa pantalla, origen propio): El código de entrega se pierde si el niño se registró sin conexión o si la respuesta se perdió: esos niños no se pueden entregar por el sistema
- **critica · ninos-3** (Niños (RocaKids), capa pantalla, origen propio): Con un solo acudiente autorizado la pantalla no pregunta quién retira: entrega a quien traiga el código y registra como retirado al autorizado
- **critica · nuevos-1** (Nuevos, capa api, origen propio): La API de Nuevos no pregunta el permiso: cualquier rol con sede (o con toda la red) lee la bandeja completa, registra contactos e integra personas
- **critica · nuevos-2** (Nuevos, capa base, origen propio): Integrar a un nuevo cuyo correo ya existe lo funde con esa persona: el nuevo desaparece, la pantalla dice «Nuevo miembro integrado» y se reactiva un consentimiento que el titular había revocado
- **critica · oracion-1** (Oración, capa base, origen propio): Un rol cualquiera en otra sede abre la oración de esa sede, incluidas las peticiones confidenciales
- **critica · panel-1** (Panel, capa base, origen propio): Una segunda asignación en otra sede le extiende a esa sede el nivel y los módulos de TODOS los roles de la persona: una maestra de RocaKids de Cali con un rol N2 de asistencia en Pereira ve las salas, el censo de niños y los acudientes de Pereira
- **critica · panel-2** (Panel, capa api, origen propio): Integración técnica (N1, único módulo «Organización y sedes») lee el directorio de toda la red con documentos, incluidos registros civiles de bebés, y la bandeja de nuevos con teléfonos y correos
- **critica · personas-1** (Personas y la ficha, capa api, origen propio): La búsqueda de Personas no pide el permiso del módulo ni tiene tope: la cuenta técnica N1 saca el directorio completo de la red con documentos, 1.325 menores incluidos
- **critica · talento-1** (Talento, capa api, origen propio): La API de Talento solo mira el nivel N3 y no la matriz: Digitación de aportes, Contabilidad, Auditoría y Líder de oración (y el pastor y la directora de RocaKids, que solo tienen «ver») registran antecedentes «apto», crean y terminan voluntariados y leen salarios
- **critica · talento-2** (Talento, capa base, origen P20): Un antecedente nuevo «no apto» no quita la aptitud mientras siga vigente uno «apto» anterior, y la pantalla responde «Queda apto para menores»
- **alta · aportes-2** (Aportes, capa base, origen P60): El certificado de donación recoge aportes sin confirmar, y al anularlo quedan confirmados sin segunda mano
- **alta · aportes-3** (Aportes, capa api, origen P63): El número del certificado usa la sede actual de la persona: marca mal la serie y, si la sede nueva tiene su propia serie, el certificado no se puede expedir
- **alta · aportes-4** (Aportes, capa api, origen P64): No hay forma de anular un aporte (ni botón ni ruta), aunque Tesorería tiene la acción «anular»
- **alta · aportes-5** (Aportes, capa pantalla, origen propio): La pestaña no tiene certificados ni pagos sin dueño, y la API no deja a Tesorería emparejar
- **alta · aportes-6** (Aportes, capa api, origen propio): Leer aportes, certificados y su documento (N3) no deja rastro en la bitácora de lectura
- **alta · aportes-7** (Aportes, capa api, origen propio): La API acepta cualquier moneda y una sola fila con moneda inválida deja la pestaña de toda la sede sin cargar
- **alta · aportes-8** (Aportes, capa base, origen P59): Un aviso «pendiente» de PayU se rechaza y el aviso no queda guardado
- **alta · asistencia-1** (Asistencia, capa api, origen propio): La API de asistencia solo exige nivel N2 y no mira la matriz: Tesorería, Coordinación de nuevos, Auditoría, Contabilidad y roles de solo «ver» abren servicios, marcan gente y reescriben el conteo
- **alta · asistencia-2** (Asistencia, capa pantalla, origen propio): Los resultados de «Buscar persona» aparecen debajo de toda la lista de marcados, fuera de la vista, en el teléfono y en el escritorio
- **alta · calendario-1** (Calendario, capa base, origen propio): Cualquiera que edite en la sede madre cancela o da por hecho un evento de toda la red
- **alta · ninos-4** (Niños (RocaKids), capa base, origen P23): La salud del niño no se puede leer: rocakids.condiciones_de revienta y la pantalla solo dice «tiene condición médica registrada»
- **alta · ninos-5** (Niños (RocaKids), capa pantalla, origen propio): Tras «Salir» el equipo conserva censo y acudientes de los niños, y la pantalla los usa aunque la API responda 403: otro usuario ve niños de otra sede
- **alta · ninos-6** (Niños (RocaKids), capa base, origen P31): El código de entrega no tiene tope de intentos y la alerta de intentos fallidos no le llega a nadie
- **alta · ninos-7** (Niños (RocaKids), capa pantalla, origen propio): Al salir con registros pendientes, la cola se envía sin sesión al volver la red y el niño queda en «rechazados» con un mensaje técnico
- **alta · ninos-8** (Niños (RocaKids), capa api, origen propio): La misma persona cuenta como adulto en varias salas a la vez: dos maestras cumplen la regla de dos adultos en todas las salas
- **alta · comunicaciones-1** (Comunicaciones, capa base, origen propio): El freno de envíos masivos no detiene lo que ya está en la cola: el trabajador sigue entregando los correos masivos
- **alta · comunicaciones-2** (Comunicaciones, capa api, origen propio): Los cuatro ojos se saltan: quien aprueba puede reescribir el borrador de otro, aprobarlo y enviarlo sola, y la pantalla atribuye el texto al autor original
- **alta · comunicaciones-3** (Comunicaciones, capa api, origen propio): La aprobación no queda atada al texto que la aprobadora vio: se aprueba lo que el autor cambió un momento antes
- **alta · comunicaciones-4** (Comunicaciones, capa base, origen propio): Dos «Enviar» simultáneos encolan todo dos veces: cada destinatario recibe el correo masivo repetido
- **alta · consejeria-1** (Consejería, capa api, origen P36): El consejero sin otro rol no puede entrar: la API le responde 403 «no tiene ninguna sede» en todas las rutas aunque tiene casos asignados
- **alta · consejeria-2** (Consejería, capa api, origen P86): Mismo defecto que consejeria-1, reproducido con otra consejera y otra sede: Diana Piñeros (Barranquilla, 5 casos) recibe 403 en todas las rutas
- **alta · consejeria-3** (Consejería, capa api, origen P37): Derivar un caso siempre falla con 400 «Los datos no cumplen una regla del sistema» y el caso no cambia
- **alta · consejeria-4** (Consejería, capa api, origen propio): Un caso derivado sigue abierto en la ficha y «Cerrar el caso» sobre él borra a dónde se derivó y el desenlace anterior, sin rastro
- **alta · consejeria-5** (Consejería, capa api, origen P44): La API de consejería solo exige N3 y no el permiso del módulo: un rol N3 sin consejería lista (200 vacío) y además ABRE casos en su sede; el auditor, en cualquier sede de la red
- **alta · consejeria-6** (Consejería, capa api, origen propio): «Asignar consejero» acepta a cualquier persona: el pastor asignó el caso al tesorero y el tesorero lee las notas confidenciales
- **alta · consejeria-7** (Consejería, capa base, origen propio): Nada de consejería queda en la auditoría: abrir, asignar, registrar, cerrar o sobrescribir un caso no deja rastro, y nadie sabe quién cerró un caso
- **alta · formacion-1** (Formación, capa api, origen propio): La API de Formación no consulta la matriz de permisos: tesorería, líderes, gerencia y el auditor abren cohortes, inscriben, califican y cambian pagos
- **alta · formacion-2** (Formación, capa api, origen P48): No existe ninguna ruta ni pantalla para expedir, ver o anular certificados de formación
- **alta · grupos-1** (Grupos, capa api, origen P09): Un líder de grupo (y un coordinador de segmento) opera sobre todos los grupos de su sede: ve integrantes, reporta reuniones, agrega y saca gente de grupos ajenos
- **alta · grupos-2** (Grupos, capa api, origen propio): La API de Grupos no consulta la matriz de permisos: basta nivel N2. Tesorería y Gerencia administrativa (sin el módulo) leen integrantes y crean grupos; Secretaría (solo «ver») reporta y saca; líder y coordinador de segmento (sin «crear») crean grupos
- **alta · grupos-3** (Grupos, capa api, origen propio): «Agregar al grupo» acepta a quien ya no pertenece a la sede: el pastor de Cali metió en un grupo de Cali a un miembro de Bogotá Chicó (se fue en 2022) y a una persona «trasladada»
- **alta · nuevos-3** (Nuevos, capa api, origen propio): El formulario público de nuevos no tiene límite por IP y, sin RECAPTCHA_SECRET, nada lo frena (tampoco en producción)
- **alta · nuevos-4** (Nuevos, capa api, origen propio): La bandeja entrega «es_cristiano» (dato N3) a sesiones N2 y ninguna lectura queda en la bitácora
- **alta · nuevos-5** (Nuevos, capa api, origen propio): La API de Nuevos cree la cabecera X-Forwarded-For: la IP que queda como evidencia del consentimiento y en la auditoría se puede inventar
- **alta · nuevos-6** (Nuevos, capa api, origen propio): Con el módulo CRM apagado en la sede, la pestaña desaparece pero la API de Nuevos sigue sirviendo la bandeja
- **alta · nuevos-7** (Nuevos, capa pantalla, origen propio): A quien dijo «no desea más contacto» se le ofrece «Integrar como miembro» y, al hacerlo, su autorización de WhatsApp queda vigente y se le encola un correo
- **alta · nuevos-8** (Nuevos, capa base, origen propio): Al integrar se acepta como padrino a un niño de otra sede o a una persona fallecida, y la respuesta lo oculta
- **alta · panel-3** (Panel, capa api, origen propio): Las listas de siete módulos solo piden el nivel, no el permiso del módulo: el menú las esconde, pero la API se las entrega a cualquiera con el nivel (una maestra de RocaKids lee contratos con salario y peticiones de Habeas Data de Cali)
- **alta · panel-4** (Panel, capa api, origen propio): Cualquier rol con alcance de toda la red amplía los catálogos de la red aunque no tenga el módulo: Integración técnica (N1) agregó un tipo de evento desde la pantalla
- **alta · panel-5** (Panel, capa api, origen propio): Apagar «Nuevos» (crm) en una sede no apaga su API: el Panel y el menú lo esconden, pero la bandeja y el historial siguen respondiendo
- **alta · personas-2** (Personas y la ficha, capa api, origen propio): «Arrastrar por casilla» no pide permiso ni deja rastro: el Auditor lista las alergias de 233 personas de 35 sedes, 118 de ellas menores
- **alta · personas-3** (Personas y la ficha, capa api, origen propio): El permiso y el nivel se suman entre roles: un líder de grupo que además ora (N3) ve aportes, consejería, fe y alergias de su grupo, y un rol de edición en otra sede deja editar a los del grupo
- **alta · personas-4** (Personas y la ficha, capa base, origen propio): Cambiar una casilla propia (alergias, N3) no deja auditoría
- **alta · P01** (Personas y la ficha, capa base, origen P01): La fusión de duplicados pierde los consentimientos, también la revocación (Ley 1581)
- **alta · peticiones-1** (Peticiones internas, capa api, origen propio): Una decisión ya tomada se puede reescribir: repetir «aprobada» (o «rechazada») cambia el texto y el decisor
- **alta · requerimientos-2** (Requerimientos, capa api, origen propio): «Asignar a» acepta a cualquiera: un niño de 7 años de otra sede, una persona fallecida, alguien que no puede ver el módulo
- **alta · requerimientos-3** (Requerimientos, capa api, origen propio): Cualquier secretaria o pastor de la sede cancela lo que reportó otra persona
- **alta · requerimientos-5** (Requerimientos, capa api, origen propio): Un requerimiento cerrado o cancelado se puede reescribir, y quien solo puede cancelar también asigna, sube la prioridad y escribe la solución
- **alta · talento-3** (Talento, capa base, origen propio): Una persona se registra a sí misma los cinco antecedentes y queda apta para estar con niños
- **alta · talento-4** (Talento, capa base, origen propio): La vigencia la escribe quien registra: un certificado de 12 meses se carga con vencimiento en 2099, uno «expedido» en el futuro cuenta como vigente y un compromiso firmado en 2027 sella la verificación
- **alta · talento-5** (Talento, capa base, origen propio): Un pastor registra como voluntarios de su sede a personas de otra sede, y la fila queda invisible para las dos sedes
- **alta · talento-6** (Talento, capa api, origen propio): Los salarios (N3) llegan al navegador aunque la pantalla no los muestra, y su lectura no queda en la bitácora
- **alta · talento-7** (Talento, capa pantalla, origen propio): No hay cómo llegar a los antecedentes de un voluntario nuevo ni de nadie fuera de las primeras 100 filas
- **alta · talento-8** (Talento, capa base, origen P11): Los roles que trabajan con menores fuera de RocaKids (director o coordinador de un segmento de niños o adolescentes) se otorgan sin antecedentes
- **alta · talento-9** (Talento, capa base, origen P25): Terminar un contrato suspende la cuenta aunque la persona siga con un rol vigente (y terminar un voluntariado no toca nada, aunque el RUNBOOK dice que sí)
- **alta · tareas-1** (Tareas, capa api, origen propio): Quien tiene la tarea no la ve ni la puede marcar si su rol no es Secretaría o Pastor: la excepción «es suya» nunca se aplica
- **alta · tareas-2** (Tareas, capa api, origen propio): Asignar a alguien de otra sede se acepta, pero la responsable nunca la ve y la sede de la tarea muestra «sin asignar»
- **alta · tareas-3** (Tareas, capa pantalla, origen propio): La pantalla no deja reabrir, cancelar ni devolver a pendiente, y un «Hecha» por error no se puede deshacer
- **alta · tematicas-2** (Temáticas, capa api, origen propio): No se puede corregir ni retirar una serie ni una enseñanza: la única edición que existe es el estado
- **alta · tematicas-3** (Temáticas, capa base, origen propio): Un líder de grupo de la sede principal termina la serie de toda la red y le agrega enseñanzas que ven las 36 sedes
- **media · aportes-9** (Aportes, capa pantalla, origen P62): La cifra grande suma pesos, dólares y euros y la pinta siempre en pesos
- **media · aportes-10** (Aportes, capa api, origen propio): La cifra grande suma también los aportes anulados
- **media · aportes-11** (Aportes, capa pantalla, origen propio): La lista se corta en 200 sin aviso ni paginación y la cifra no es el total del filtro
- **media · aportes-12** (Aportes, capa pantalla, origen P65): El formulario no deja escoger el fondo: lo dirigido a un proyecto cae al fondo general
- **media · aportes-13** (Aportes, capa base, origen P61): Un rechazo o contracargo de un pago ya contabilizado no se puede registrar
- **media · aportes-14** (Aportes, capa api, origen propio): Una fecha futura responde con el nombre de la restricción en inglés
- **media · aportes-15** (Aportes, capa pantalla, origen propio): En el teléfono el botón «Confirmar» sale recortado en cada tarjeta
- **media · aportes-16** (Aportes, capa pantalla, origen propio): A los roles de toda la red sin permiso se les ofrece la pestaña Aportes, que abre en error
- **media · aportes-17** (Aportes, capa demostracion, origen propio): En la demostración los filtros no filtran y se permite lo que el sistema real niega
- **media · asistencia-3** (Asistencia, capa pantalla, origen propio): «Abrir un servicio» propone la fecha de UTC: desde las 7:00 p. m. del domingo en Colombia propone el lunes, y el servicio dominical de la noche queda en lunes
- **media · asistencia-4** (Asistencia, capa api, origen propio): Se marca asistencia y se reporta el conteo de servicios que todavía no ocurrieron, y se abren servicios en 1900 o 2099
- **media · asistencia-5** (Asistencia, capa pantalla, origen propio): La pantalla ignora «admite_checkin»: ofrece marcar donde la base lo prohíbe, el error trae el identificador crudo y la lista pone «0 marcados» donde no hay lista
- **media · asistencia-6** (Asistencia, capa api, origen propio): Una persona fallecida (o trasladada) aparece como cualquier otra en la búsqueda y se marca presente
- **media · asistencia-7** (Asistencia, capa pantalla, origen propio): Las sugerencias solo muestran el nombre: homónimos y duplicados salen como botones idénticos
- **media · asistencia-8** (Asistencia, capa api, origen propio): Los marcados no cuadran: la lista y el aviso del conteo cuentan a quien la ficha no muestra
- **media · asistencia-9** (Asistencia, capa api, origen propio): Un número del conteo que no llega se guarda en cero: la API reemplaza los cuatro y la pantalla manda 0 si un campo queda vacío
- **media · asistencia-10** (Asistencia, capa api, origen propio): Un líder de grupo (alcance «grupo») opera la asistencia de toda la sede: ve quién asistió, reescribe el conteo oficial y marca a gente fuera de su grupo
- **media · asistencia-11** (Asistencia, capa pantalla, origen propio): La lista se corta en 30 servicios, sin filtro por sede o fecha ni paginación: la dirección no llega a 23 de 36 sedes y una sede no llega a lo de hace seis semanas
- **media · asistencia-12** (Asistencia, capa api, origen propio): No hay forma de deshacer: una marca equivocada no se quita y un servicio mal fechado no se corrige ni se anula
- **media · asistencia-13** (Asistencia, capa demostracion, origen propio): En la demostración, «Marcar» y «Guardar el conteo» responden con un éxito falso (y cifras que no son las escritas); la ficha no trae el servicio
- **media · calendario-2** (Calendario, capa base, origen propio): Un líder de grupo cancela o da por hecho cualquier evento de su sede, incluido el servicio del domingo
- **media · calendario-3** (Calendario, capa pantalla, origen P51): Se ofrecen «Se hizo» y «Cancelar» sobre los eventos de la red a quien no puede hacerlo, y la respuesta dice que el evento no existe
- **media · calendario-4** (Calendario, capa api, origen propio): «Se hizo» no pide confirmación, se deja usar en eventos que todavía no ocurren y no tiene reversa
- **media · calendario-5** (Calendario, capa pantalla, origen propio): Al cancelar, la pantalla promete avisar a los inscritos y no se avisa a nadie
- **media · calendario-6** (Calendario, capa api, origen propio): Con más de 200 eventos la lista se corta en silencio: «Próximos 6 meses» muestra poco más de dos
- **media · calendario-7** (Calendario, capa api, origen propio): Lo que no se marcó en 24 horas desaparece y queda «programado» para siempre; lo pasado y lo lejano no se ve
- **media · calendario-8** (Calendario, capa pantalla, origen propio): La hora no dice de qué zona es: los eventos de la red salen en hora de Bogotá en Madrid y la lista de varias sedes parece desordenada
- **media · calendario-9** (Calendario, capa api, origen propio): Si una sola sede apaga el Calendario, el Pastor General ya no puede publicar en la red y el mensaje le dice que no alcanza la red
- **media · calendario-10** (Calendario, capa api, origen propio): Se agendan dos cosas en el mismo lugar a la misma hora, y el mismo evento dos veces
- **media · calendario-11** (Calendario, capa pantalla, origen P58): En el teléfono la tarjeta de un evento de la red se deforma y los botones quedan cortados
- **media · calendario-12** (Calendario, capa pantalla, origen P56): Los eventos de varios días o que pasan la medianoche muestran solo la hora final
- **media · calendario-19** (Calendario, capa demostracion, origen propio): En la demostración el evento nuevo cae en otra sede, con el tipo en código, al final de la lista y sin respetar el horizonte
- **media · ninos-9** (Niños (RocaKids), capa pantalla, origen P30): No se puede salir de la sala: la regla de dos adultos cuenta a quien ya se fue, y la vista de alertas mezcla días y no ve las salas sin nadie
- **media · ninos-10** (Niños (RocaKids), capa base, origen P26): Las funciones del domingo no reciben la fecha: lo que envía la cola queda con la hora del envío
- **media · ninos-11** (Niños (RocaKids), capa pantalla, origen propio): La pantalla no muestra el aviso del servidor: ingreso sin salida de la semana anterior, recibido con menos de dos adultos o ingreso repetido
- **media · ninos-12** (Niños (RocaKids), capa pantalla, origen propio): Un rechazo del servidor con conexión se presenta como «quedó registrado en este equipo»; el motivo no tiene tope en pantalla
- **media · ninos-13** (Niños (RocaKids), capa api, origen propio): Leer los acudientes de un menor (dato N4) no deja lectura registrada, y «Preparar el domingo» con alcance de red baja 894 menores de 26 sedes al equipo
- **media · ninos-14** (Niños (RocaKids), capa base, origen propio): Quien no tiene antecedentes vigentes puede recibir y entregar niños, aunque no puede estar en la sala
- **media · ninos-15** (Niños (RocaKids), capa pantalla, origen propio): La entrega no funciona sin conexión aunque la pantalla dice «check-in y entrega · funciona sin conexión»
- **media · ninos-16** (Niños (RocaKids), capa demostracion, origen propio): En la demostración el niño que ya está dentro no se puede entregar, las edades no corresponden a la sala y los mensajes dicen que se registró
- **media · comunicaciones-5** (Comunicaciones, capa pantalla, origen P83): La lista se corta en 100 sin forma de ver el resto, no dice la sede y llama «en cola» a lo que ya salió
- **media · comunicaciones-6** (Comunicaciones, capa pantalla, origen P81): «Enviada el» se muestra en UTC: lo enviado a las 7 p. m. aparece con la fecha del día siguiente
- **media · comunicaciones-7** (Comunicaciones, capa base, origen P75): Revocar solo la convocatoria por correo descarta también el aviso pastoral ya encolado, que sigue autorizado
- **media · comunicaciones-8** (Comunicaciones, capa api, origen propio): Si quien escribió o aprobó es de otra sede, la sede ve «aprobada» sin aprobador y «Escribió ·»
- **media · comunicaciones-9** (Comunicaciones, capa api, origen propio): Aprobar algo ya aprobado cambia el aprobador y conserva la hora de la primera aprobación
- **media · comunicaciones-10** (Comunicaciones, capa pantalla, origen propio): El menú ofrece Comunicaciones a quien alcanza toda la red sin tener el permiso, y la pestaña abre en error
- **media · comunicaciones-11** (Comunicaciones, capa pantalla, origen propio): La pantalla dice «solo le llega a quien autorizó», pero con finalidad «Emergencia» le llega a todos, también a quien revocó, y no lo advierte
- **media · consejeria-8** (Consejería, capa base, origen P38): Revocar el rol de un consejero deja sus casos a su nombre y el aviso de «sin consejero» no los cuenta
- **media · consejeria-9** (Consejería, capa base, origen P39): El consejero tiene «crear» en la matriz pero la base no le deja abrir un caso; y si tiene otro rol con sede, lo abre y el caso le desaparece
- **media · consejeria-10** (Consejería, capa pantalla, origen propio): La lista corta en 100 casos sin paginación ni filtros: la dirección ve 100 de 180 y ninguno de los 3 casos en pausa
- **media · consejeria-11** (Consejería, capa api, origen propio): La lista entrega nombre y tópico N3 de cada caso sin registrar la lectura
- **media · consejeria-12** (Consejería, capa pantalla, origen propio): «Abrir un caso» obliga a elegir la sede sin proponer la de la persona: el caso de un visitante de Cali quedó en Chicó, a la vista de otros pastores
- **media · consejeria-13** (Consejería, capa pantalla, origen propio): En la ficha, un doble clic duplica la nota confidencial (que no se puede borrar) y la asignación; asignar dos veces a la misma persona también se acepta
- **media · consejeria-14** (Consejería, capa pantalla, origen propio): «Registrar sesión» la atribuye a quien pulsa, no deja poner fecha, modalidad ni inasistencia, y un valor inválido de minutos se descarta en silencio
- **media · consejeria-15** (Consejería, capa demostracion, origen propio): En la demostración cerrar y derivar siempre fallan, y las demás acciones dicen «guardado» sin avisar que es una demostración
- **media · formacion-3** (Formación, capa api, origen P49): «Registrar pago» no guarda cuánto se pagó ni la ficha lo muestra
- **media · formacion-4** (Formación, capa pantalla, origen propio): Cancelar los dos diálogos de «Registrar pago» registra igual un pago parcial
- **media · formacion-5** (Formación, capa api, origen P50): La lista y la ficha dicen «por encima del cupo» cuando la base no lo está
- **media · formacion-6** (Formación, capa base, origen propio): Recalificar a un reprobado como aprobado se bloquea por el cupo
- **media · formacion-7** (Formación, capa base, origen propio): Un certificado sigue vigente después de recalificar la inscripción como reprobada
- **media · formacion-8** (Formación, capa api, origen propio): Se puede inscribir, y dejar con pago pendiente, a una persona fallecida
- **media · formacion-9** (Formación, capa api, origen propio): Se inscribe gente en cohortes que ya terminaron, y la ficha no dice que terminaron
- **media · formacion-10** (Formación, capa base, origen propio): El cupo se supera con inscripciones simultáneas
- **media · formacion-11** (Formación, capa pantalla, origen propio): Una cohorte abierta en una sede del exterior queda en pesos colombianos
- **media · formacion-12** (Formación, capa pantalla, origen propio): La lista se corta en 100 cohortes sin aviso, sin paginación y sin filtros
- **media · formacion-13** (Formación, capa api, origen propio): Una cohorte no se puede corregir ni completar: no hay edición ni campo de docente, aunque el mensaje de cupo lleno pide ampliarlo
- **media · formacion-14** (Formación, capa pantalla, origen propio): A quien alcanza toda la red se le ofrecen sedes donde Formación está apagado y el error dice algo falso
- **media · formacion-15** (Formación, capa demostracion, origen propio): La demostración de Formación responde con éxitos falsos y con reglas que el sistema real no tiene
- **media · formacion-16** (Formación, capa api, origen P52): El prerrequisito de un curso no lo comprueba nadie ni se muestra
- **media · formacion-17** (Formación, capa base, origen P46): Abrir una cohorte, y expedir o anular un certificado, no deja rastro en la auditoría
- **media · formacion-18** (Formación, capa base, origen P47): Un certificado anulado no se puede volver a expedir
- **media · grupos-4** (Grupos, capa base, origen P14): En un grupo cerrado no se puede registrar la salida de sus integrantes: responde «no admite membresías nuevas» con el identificador del grupo, y la ficha sigue ofreciendo sacar, agregar y reportar
- **media · grupos-5** (Grupos, capa api, origen propio): No hay forma de cerrar ni de editar un grupo (ni en la pantalla ni en la API), y un grupo cerrado sigue aceptando reuniones posteriores a su cierre
- **media · grupos-6** (Grupos, capa pantalla, origen propio): Reportar una reunión de noche propone la fecha de MAÑANA, y la API acepta cualquier fecha futura: el grupo sale de «los que llevan tiempo sin reportar» con días negativos
- **media · grupos-7** (Grupos, capa base, origen propio): Un grupo que «no recibe nuevos» (abierto = false) acepta integrantes, y ni la lista ni la ficha muestran el cupo ni si recibe gente
- **media · grupos-8** (Grupos, capa pantalla, origen propio): La pestaña Grupos aparece a cualquier rol con alcance de toda la red aunque su rol no tenga el módulo: Integración técnica (N1) la abre y recibe un error; Gerencia administrativa ve y opera los grupos de las 36 sedes
- **media · grupos-9** (Grupos, capa pantalla, origen propio): La lista se corta en 100 grupos sin paginación, búsqueda ni filtro por sede: la dirección general no alcanza 99 de los 199 grupos de la red
- **media · grupos-10** (Grupos, capa base, origen propio): El buscador para agregar a un grupo no encuentra por apellido cuando el nombre es largo: «garcia» no trae a ninguno de los tres García activos de Cali y sí trae a uno de Bogotá Chicó
- **media · grupos-11** (Grupos, capa pantalla, origen propio): Doble clic: en una sugerencia de «agregar» aparece un error rojo en inglés después del éxito; en «Reportar» se manda dos veces y sale «Ya hay una reunión reportada» junto a «Reunión reportada»
- **media · grupos-12** (Grupos, capa demostracion, origen propio): En la demostración, «Sacar del grupo» dice «Salió del grupo» y la persona sigue activa; agregar a quien ya está dice «Entró al grupo» y suma; reportar muestra otro tema y otra cifra
- **media · nuevos-9** (Nuevos, capa pantalla, origen propio): El filtro «Integrados» siempre dice «Nadie en esta bandeja»
- **media · nuevos-10** (Nuevos, capa base, origen P15): La bandeja muestra a los «No interesados» como «CONTACTAR HOY» y ningún camino los saca
- **media · nuevos-11** (Nuevos, capa pantalla, origen propio): «Llegó» y «último» muestran la fecha en UTC: lo que pasa después de las 7 p. m. aparece con el día siguiente
- **media · nuevos-12** (Nuevos, capa pantalla, origen propio): Un doble clic en «Registrar contacto» guarda el contacto dos veces, y la tabla no deja borrar el repetido
- **media · nuevos-13** (Nuevos, capa api, origen propio): Registrar una llamada sin «Próximo contacto» deja a la persona en «CONTACTAR HOY» aunque se acaba de llamar
- **media · nuevos-14** (Nuevos, capa pantalla, origen propio): Para quien alcanza la red, la bandeja se corta en 100 sin avisar y sin decir de qué sede es cada persona
- **media · nuevos-15** (Nuevos, capa api, origen propio): El formulario público responde «Error» cuando el correo ya está en la bandeja (y también cuando el reCAPTCHA rechaza)
- **media · nuevos-16** (Nuevos, capa api, origen propio): El formulario público acepta un correo o un teléfono que no lo son, y encola la bienvenida a esa dirección
- **media · nuevos-17** (Nuevos, capa api, origen propio): La autorización que da el formulario público no guarda la versión de la política que se aceptó
- **media · nuevos-18** (Nuevos, capa base, origen P12): La integración ignora la fecha de la decisión: convertido_en y el hecho CAMBIO_ETAPA quedan con la fecha de hoy
- **media · nuevos-19** (Nuevos, capa base, origen P13): La conversión parte el nombre en el primer espacio: el segundo nombre queda como apellido
- **media · nuevos-20** (Nuevos, capa base, origen P04): Todo visitante nace «miembro» de la sede
- **media · nuevos-21** (Nuevos, capa base, origen propio): Al integrar se puede meter al nuevo en un grupo que no recibe nuevos
- **media · oracion-2** (Oración, capa api, origen propio): El intercesor, con solo «reportar respuesta», cierra cualquier petición compartida (estado final)
- **media · oracion-3** (Oración, capa pantalla, origen propio): La lista se corta en 100 sin avisar: la dirección general ve 100 de 155 abiertas y el aviso cuenta mal
- **media · oracion-4** (Oración, capa pantalla, origen propio): El selector de sede ofrece sedes con oración apagada y el error dice que la sede está fuera de su alcance
- **media · oracion-5** (Oración, capa pantalla, origen propio): El doble clic en «Registrar que oré» deja dos oraciones
- **media · oracion-6** (Oración, capa pantalla, origen propio): En el teléfono la fila de la lista se deforma: el distintivo queda como un óvalo y el nombre en cinco renglones
- **media · oracion-7** (Oración, capa pantalla, origen propio): Quien alcanza toda la red ve la pestaña Oración aunque no tenga el módulo, y al abrirla falla
- **media · oracion-8** (Oración, capa api, origen propio): Una petición compartida por error no se puede corregir: no hay cómo volverla confidencial ni dejar de compartirla
- **media · oracion-9** (Oración, capa api, origen propio): Se puede registrar en una sede la petición de una persona de otra, y ese equipo la recibe sin nombre
- **media · panel-6** (Panel, capa pantalla, origen propio): Con alcance de toda la red, el menú y la dirección abren las 22 pestañas aunque el rol no tenga esos módulos, y el pie ofrece «Sistema Master» a quien no administra
- **media · panel-7** (Panel, capa pantalla, origen propio): Quien no tiene rol vigente (miembro, visitante, cargo vencido, rol revocado) y entra por la aplicación no llega al portal: el formulario no dice nada y al recargar queda atrapado sin botón de salir
- **media · panel-8** (Panel, capa demostracion, origen propio): En la demostración, «Sistema Master» sale del modo demostración: abre la consola real, manda el token «demo» a la API y pide usuario y contraseña reales
- **media · panel-9** (Panel, capa pantalla, origen propio): En el teléfono, la barra de abajo no muestra dónde está la persona después de elegir una sección en «Más»
- **media · panel-10** (Panel, capa base, origen propio): Con la sede desactivada, el Panel se contradice (Sedes 1 y abajo «No alcanza ninguna sede todavía») y su pastor sigue leyendo las personas de esa iglesia
- **media · P03** (Personas y la ficha, capa base, origen P03): Buscar por un solo apellido no encuentra a quien tiene nombre largo
- **media · P28** (Personas y la ficha, capa base, origen P28): Un director o maestro de RocaKids no puede abrir la ficha de un niño de su sala ni de sus voluntarios
- **media · P88** (Personas y la ficha, capa api, origen P88): No hay cómo registrar un fallecimiento ni una salida de la red, y «trasladada» no corta el acceso
- **media · personas-5** (Personas y la ficha, capa api, origen propio): Leer datos N3 fuera de la ficha principal no queda en la bitácora: casillas (alergias), historia con aportes y consejería, y las casillas de un menor
- **media · personas-6** (Personas y la ficha, capa pantalla, origen propio): Vaciar un campo en «Corregir sus datos» no lo borra: no hay cómo quitar un teléfono, un correo o un documento equivocado
- **media · personas-7** (Personas y la ficha, capa api, origen propio): La corrección guarda un correo inválido, un celular con letras y textos sin límite
- **media · personas-8** (Personas y la ficha, capa api, origen propio): Los errores de la corrección salen en inglés técnico con nombres de restricciones, o como error 500
- **media · personas-9** (Personas y la ficha, capa pantalla, origen propio): La lista dice «dentro de su alcance» y enlaza fichas que el rol no puede abrir; el error ofrece «Reintentar»
- **media · personas-10** (Personas y la ficha, capa demostracion, origen propio): En la demostración, guardar una corrección dice que quedó en la auditoría
- **media · personas-11** (Personas y la ficha, capa base, origen propio): «¿Registrada dos veces?» ignora su umbral, muestra «210 %» y no deja hacer nada
- **media · personas-12** (Personas y la ficha, capa pantalla, origen propio): «Corregir sus datos» no ofrece la mitad de lo que la ficha muestra ni las casillas propias
- **media · personas-13** (Personas y la ficha, capa pantalla, origen propio): Desde Personas no se puede registrar a nadie aunque Secretaría y Pastor tengan «crear»
- **media · peticiones-2** (Peticiones internas, capa api, origen propio): Quien pidió no ve quién decidió ni cuándo, y lo pedido por alguien de otra sede sale «pedida por sin dato»
- **media · peticiones-3** (Peticiones internas, capa pantalla, origen propio): La lista se corta en 100 sin paginar: la dirección no ve 25 peticiones, entre ellas las decisiones más recientes
- **media · peticiones-4** (Peticiones internas, capa api, origen propio): Quien pidió puede poner en revisión su propia petición, y el texto de «en revisión» se muestra como «Decisión»
- **media · peticiones-5** (Peticiones internas, capa pantalla, origen propio): A los roles de toda la red sin permiso la pestaña les aparece y al abrirla responde 403
- **media · peticiones-7** (Peticiones internas, capa pantalla, origen propio): La ficha no muestra el rastro: ni cuándo se envió, ni quién la puso en revisión, ni cuándo se decidió, ni a quién va dirigida
- **media · peticiones-13** (Peticiones internas, capa demostracion, origen propio): En la demostración «Solo las mías» no filtra y «Marcar en revisión» pone a alguien en «Decidió»
- **media · requerimientos-1** (Requerimientos, capa base, origen P40): La mesa de servicio solo la atienden los 4 del Equipo de Comunicaciones (y los 2 Pastores Directores Generales)
- **media · requerimientos-4** (Requerimientos, capa pantalla, origen propio): Quien reportó no tiene cómo retirar su requerimiento en la pantalla
- **media · requerimientos-6** (Requerimientos, capa pantalla, origen propio): «Asignar a alguien» se ofrece en curso o reabierto y siempre falla; si se pulsó «Empezar» sin asignar, ya no se le puede poner responsable desde la pantalla
- **media · requerimientos-7** (Requerimientos, capa api, origen propio): La lista se corta en 100 sin avisar y, sin el filtro, esconde justo los cerrados más recientes
- **media · requerimientos-8** (Requerimientos, capa api, origen propio): Si quien atiende o quien reportó es de otra sede, la pantalla dice «asignado» con «Atiende ·» y «reportado por sin dato»
- **media · requerimientos-9** (Requerimientos, capa api, origen propio): El plazo sale con dos horas distintas: la lista y el mensaje en hora de Bogotá sin decirlo, la ficha en la hora del teléfono
- **media · requerimientos-10** (Requerimientos, capa pantalla, origen propio): El selector de sede ofrece las 9 plantaciones con el módulo apagado y el error culpa a «otra sede»
- **media · requerimientos-11** (Requerimientos, capa pantalla, origen propio): La pestaña aparece a quien alcanza toda la red aunque no tenga el módulo, y abre con error
- **media · requerimientos-12** (Requerimientos, capa demostracion, origen propio): En la demostración el plazo, la sede, el área y quién atiende salen falsos, y el aviso de vencidos no cambia
- **media · talento-10** (Talento, capa api, origen P27): El aviso rojo de Talento solo mira la primera página, y la lista se corta en 100 sin decirlo
- **media · talento-11** (Talento, capa pantalla, origen P32): El formulario de antecedentes deja «Vence» opcional, la base lo exige y el error dice «Falta un dato obligatorio.» sin decir cuál
- **media · talento-12** (Talento, capa base, origen P29): v_antecedentes_por_vencer cuenta los antecedentes viejos ya renovados, con días negativos
- **media · talento-13** (Talento, capa api, origen propio): La ficha de antecedentes de alguien fuera del alcance, o que no existe, responde 200 y afirma «NO apto · Falta: todo»
- **media · talento-14** (Talento, capa pantalla, origen propio): La ficha de antecedentes no dice de quién es
- **media · talento-15** (Talento, capa pantalla, origen propio): Talento no tiene la lista de antecedentes por vencer ni la de vencidos
- **media · talento-16** (Talento, capa pantalla, origen propio): Desde la pantalla no se puede terminar un voluntariado, ni registrar o terminar un contrato
- **media · talento-17** (Talento, capa pantalla, origen propio): La pestaña Talento se ofrece a todo el que alcanza toda la red, tenga o no el módulo, y sus formularios a quien solo puede «ver»
- **media · talento-18** (Talento, capa demostracion, origen propio): En la demostración, Talento responde con éxitos que el sistema real no da, no avisa que no se guarda y la ficha no deja registrar
- **media · talento-19** (Talento, capa pantalla, origen propio): Un doble clic en «Registrar» guarda dos veces el mismo antecedente
- **media · talento-20** (Talento, capa api, origen propio): Si «Vence» es anterior o igual a «Expedido», el mensaje sale en inglés y con nombres internos
- **media · tareas-4** (Tareas, capa api, origen propio): Las tareas sin responsable se ordenan al final aunque estén vencidas; en listas largas se cortan y el aviso de vencidas cuenta de menos
- **media · tareas-5** (Tareas, capa pantalla, origen propio): La lista se corta en 100 sin «ver más» ni filtro por sede, y total_filas no dice cuántas hay
- **media · tareas-6** (Tareas, capa api, origen propio): Una tarea no se puede reasignar ni corregir (responsable, fecha, título) después de creada
- **media · tareas-7** (Tareas, capa api, origen propio): Se puede asignar una tarea a un niño de 7 años, a una persona inactiva o a una trasladada
- **media · tareas-8** (Tareas, capa pantalla, origen propio): El selector de sede ofrece plantaciones con Tareas apagado y la API responde con un motivo falso
- **media · tareas-9** (Tareas, capa pantalla, origen propio): Quien alcanza toda la red sin permiso de tareas ve la pestaña en el menú y al abrirla recibe un error
- **media · tareas-10** (Tareas, capa pantalla, origen propio): El detalle y la prioridad se guardan pero no se ven en ninguna parte
- **media · tareas-11** (Tareas, capa api, origen propio): Se crean tareas sin responsable y sin fecha, contra la regla B9.12 del propio checklist
- **media · tareas-12** (Tareas, capa demostracion, origen propio): En la demostración, la tarea creada sale con otra sede y otro responsable, y una tarea hecha sigue «vencida»
- **media · tematicas-1** (Temáticas, capa pantalla, origen P57): La lista de series se corta en 100 sin avisar, sin filtros ni paginación: la dirección no ve 51 de 151 series y una serie recién creada desaparece
- **media · tematicas-4** (Temáticas, capa pantalla, origen P51): En una serie de la red, las demás sedes ven «Terminada»/«En curso» y el formulario «Agregar una enseñanza», que siempre fallan (404 con mensaje falso y 403)
- **media · tematicas-5** (Temáticas, capa pantalla, origen propio): La ficha esconde lo que se guarda: los enlaces o recursos no se ven nunca, el resumen se corta a 140 caracteres a mitad de palabra y la serie no muestra sus fechas
- **media · tematicas-6** (Temáticas, capa api, origen propio): Las fechas no se contrastan: un año escrito con dos cifras (0026) o una fecha ajena a la serie se guardan sin aviso
- **media · tematicas-7** (Temáticas, capa pantalla, origen propio): Quien alcanza toda la red sin el permiso (auditoría, contabilidad, gerencia, talento humano, integración técnica) ve la pestaña «Temáticas» y al abrirla recibe un error con códigos internos
- **media · tematicas-8** (Temáticas, capa api, origen propio): Un miembro sin rol que entra a la aplicación (por ejemplo a #/tematicas) queda en un error en vez de ir a su portal
- **media · tematicas-9** (Temáticas, capa demostracion, origen propio): Modo demostración: acepta lo que la API real rechaza y responde «Serie creada.»; además la lista no cuenta la enseñanza agregada
- **baja · aportes-18** (Aportes, capa pantalla, origen P68): Quien no puede confirmar o registrar ve «Confirmar» y el formulario, y al usarlos recibe 403
- **baja · aportes-19** (Aportes, capa texto, origen P71): Se muestran códigos del catálogo en vez de sus nombres, también en el certificado de donación
- **baja · aportes-20** (Aportes, capa base, origen P70): El control de certificados marca como descuadrado todo certificado anulado
- **baja · aportes-21** (Aportes, capa base, origen P72): Los fondos nacen vigentes desde el día en que corrió la semilla
- **baja · aportes-22** (Aportes, capa pantalla, origen propio): El selector de sede ofrece sedes sin el módulo y el error dice «fuera de su alcance»
- **baja · aportes-23** (Aportes, capa texto, origen propio): Textos menores: concordancia, opciones repetidas, avisos genéricos y colores de estado
- **baja · aportes-24** (Aportes, capa api, origen propio): Entradas de la API sin validar: errores 500, anonimato ignorado y emparejar vacío que dice «ok»
- **baja · asistencia-14** (Asistencia, capa api, origen propio): Dos correcciones del conteo a la vez: la del formulario viejo pisa la otra sin aviso
- **baja · asistencia-15** (Asistencia, capa api, origen propio): Fechas y horas imposibles dan 500 «error inesperado» en vez de decir qué está mal
- **baja · asistencia-16** (Asistencia, capa api, origen propio): «Primera vez» mayor que el total responde «Los datos no cumplen una regla del sistema.» y la etiqueta no dice que es parte del total
- **baja · asistencia-17** (Asistencia, capa pantalla, origen propio): El conteo arranca en ceros y se guarda un cero oficial sin preguntar; tampoco se avisa cuando la puerta cuenta menos gente que la lista
- **baja · asistencia-18** (Asistencia, capa pantalla, origen propio): Las horas no salen en la zona de la sede: «Reportado» va en hora de Bogotá para Madrid
- **baja · asistencia-19** (Asistencia, capa base, origen propio): La marca que se pasa tarde queda en la historia con la fecha en que se marcó, no con la del servicio
- **baja · asistencia-20** (Asistencia, capa pantalla, origen propio): Doble toque en una sugerencia manda dos marcas con avisos contradictorios, y dos marcas simultáneas dan 409 «Ese registro ya existe.»
- **baja · asistencia-21** (Asistencia, capa texto, origen propio): Códigos crudos y fechas ISO: «entre_semana», «BOG-NORTE», «manual», «2026-09-20»
- **baja · asistencia-22** (Asistencia, capa pantalla, origen propio): La lista de servicios se pide dos veces cada vez que se abre la pestaña
- **baja · calendario-13** (Calendario, capa base, origen propio): Cancelar un evento ya cancelado reemplaza el motivo sin avisar
- **baja · calendario-14** (Calendario, capa pantalla, origen propio): Descripción, cupo y «Se puede anunciar al público» se guardan pero no se ven en ninguna parte
- **baja · calendario-15** (Calendario, capa api, origen propio): El responsable de un evento de la red sale como «·» en las demás sedes
- **baja · calendario-16** (Calendario, capa api, origen propio): Una fecha imposible hace fallar la API con «error inesperado»
- **baja · calendario-17** (Calendario, capa texto, origen propio): Los mensajes de error nombran el campo por su código y sin tilde
- **baja · calendario-18** (Calendario, capa pantalla, origen propio): Roles de toda la red sin permiso de calendario ven la pestaña y un error
- **baja · calendario-20** (Calendario, capa texto, origen propio): Fechas en formato técnico, sin día de la semana, y la sede en código
- **baja · calendario-21** (Calendario, capa pantalla, origen propio): Los botones de cada fila no dicen de qué evento son
- **baja · ninos-17** (Niños (RocaKids), capa base, origen P35): Los ingresos de RocaKids entran a la línea de tiempo aunque 0036 dice que quedan fuera, y la entrega no deja su hecho
- **baja · ninos-18** (Niños (RocaKids), capa texto, origen P34): Textos sin tildes, códigos crudos y nombres técnicos en la pestaña Niños
- **baja · ninos-19** (Niños (RocaKids), capa base, origen propio): La vista semanal de salidas sin registrar siempre sale vacía
- **baja · ninos-20** (Niños (RocaKids), capa pantalla, origen propio): Uso y accesibilidad: botones «Entregar» sin nombre del niño, entrega con prompt() y «Entrar a servir» sin estado
- **baja · comunicaciones-12** (Comunicaciones, capa pantalla, origen propio): La ficha de un envío ya hecho muestra el alcance recalculado hoy, que contradice lo que salió
- **baja · comunicaciones-13** (Comunicaciones, capa pantalla, origen propio): El formulario del Pastor Principal ofrece sedes con el módulo apagado (el error dice «fuera de su alcance») y grupos de todas las sedes, y no marca los límites de largo
- **baja · comunicaciones-14** (Comunicaciones, capa pantalla, origen propio): Con el freno puesto, la ficha sigue ofreciendo «Enviar» y pide confirmar antes de fallar
- **baja · comunicaciones-15** (Comunicaciones, capa texto, origen propio): Textos: nombres de campo crudos, doble punto, códigos de sede y mensajes que no corresponden
- **baja · comunicaciones-16** (Comunicaciones, capa demostracion, origen propio): En la demostración, «Enviar» anuncia «En cola para 171 persona(s)» sin decir que no sale ni se guarda nada
- **baja · consejeria-16** (Consejería, capa pantalla, origen P42): Los casos cerrados y derivados salen «sin asignar» con chip rojo y con «Abierto N día(s)»
- **baja · consejeria-17** (Consejería, capa texto, origen P43): Tópicos sin tildes y el estado con el código crudo («en_proceso», «EN_PROCESO»)
- **baja · consejeria-18** (Consejería, capa api, origen propio): Se puede abrir un segundo caso igual para la misma persona sin ningún aviso
- **baja · consejeria-19** (Consejería, capa api, origen propio): Asignar un consejero no le avisa: no se encola ninguna notificación
- **baja · consejeria-20** (Consejería, capa api, origen propio): Las notas escritas por alguien de otra sede salen sin autor
- **baja · consejeria-21** (Consejería, capa pantalla, origen propio): La lista de casos se pide dos veces cada vez que se entra a la pestaña
- **baja · consejeria-22** (Consejería, capa texto, origen propio): Mensajes con el nombre interno del campo y dos textos ambiguos
- **baja · formacion-19** (Formación, capa api, origen propio): El catálogo de programas y cursos no se puede administrar desde ninguna ruta ni pantalla
- **baja · formacion-20** (Formación, capa base, origen P53): La historia de la persona muestra el código de la cohorte y el certificado a medianoche
- **baja · formacion-21** (Formación, capa texto, origen P55): Códigos sin traducir y un título que no corresponde en Formación
- **baja · formacion-22** (Formación, capa texto, origen propio): Textos: nombres del catálogo sin tildes, fechas en formato de máquina y palabras internas
- **baja · formacion-23** (Formación, capa api, origen propio): Fechas al revés y valor negativo dan un mensaje genérico; una fecha imposible da 500
- **baja · formacion-24** (Formación, capa api, origen propio): Reinscribir a una persona retirada responde «Ese registro ya existe.»
- **baja · formacion-25** (Formación, capa pantalla, origen propio): Doble clic en una sugerencia manda dos inscripciones y muestra un error de JavaScript en inglés
- **baja · formacion-26** (Formación, capa pantalla, origen propio): Desde la pantalla no se puede borrar una nota y vaciar el campo se ignora en silencio
- **baja · formacion-27** (Formación, capa pantalla, origen propio): Accesibilidad: botones y campos repetidos sin el nombre de la persona
- **baja · grupos-13** (Grupos, capa texto, origen P16): La pestaña muestra códigos crudos en vez de las etiquetas del catálogo: «pequeno», «familiar», «miercoles», «sabado», «colider», «lider»
- **baja · grupos-14** (Grupos, capa texto, origen P17): El hecho de ingreso y salida repite la palabra: «Entró al grupo Grupo Familiar Granada», «Salió del grupo Grupo Familiar Ciudad Jardín Sur»
- **baja · grupos-15** (Grupos, capa pantalla, origen propio): Cancelar el diálogo del motivo muestra un error; tras agregar, el foco vuelve al principio de la página; los botones «Sacar del grupo» no dicen a quién
- **baja · grupos-16** (Grupos, capa api, origen propio): Valores inválidos por la API responden con el mensaje del motor en inglés o con 500: día «miércoles», hora «25:99», fecha «2026-02-31»; una salida anterior al ingreso no dice qué pasó
- **baja · grupos-17** (Grupos, capa pantalla, origen propio): Se pueden crear dos grupos con el mismo nombre en la misma sede, sin aviso
- **baja · grupos-18** (Grupos, capa base, origen propio): Reportar una reunión no deja rastro en la auditoría: solo queda reportada_por, sin IP ni registro en plataforma.auditoria
- **baja · nuevos-22** (Nuevos, capa base, origen P18): «Integrar como miembro» deja a la persona como «Visitante»
- **baja · nuevos-23** (Nuevos, capa api, origen propio): Fechas sin validar y datos de tipo equivocado que terminan en «error inesperado» (500)
- **baja · nuevos-24** (Nuevos, capa texto, origen propio): Códigos crudos, una palabra en inglés y tildes faltantes en la pantalla
- **baja · nuevos-25** (Nuevos, capa pantalla, origen propio): La ficha no dice quién hizo cada contacto ni lleva a la persona después de integrarla
- **baja · nuevos-26** (Nuevos, capa demostracion, origen propio): La demostración cuenta otra historia: «No interesado» deja al nuevo como «contactado» y el integrado sigue en la bandeja
- **baja · nuevos-27** (Nuevos, capa base, origen propio): La bandeja de nuevos no deja auditoría: ni el cambio de estado ni la asignación del coordinador quedan en plataforma.auditoria
- **baja · oracion-10** (Oración, capa pantalla, origen propio): Abrir la lista la pide dos veces y deja dos lecturas N3 en la bitácora
- **baja · oracion-11** (Oración, capa api, origen propio): Orar solo pasa la petición a «en oración» si quien ora es pastor
- **baja · oracion-12** (Oración, capa api, origen propio): La API guarda una respuesta sin marcar respondida y la ficha dice «Respondida el» vacío
- **baja · oracion-13** (Oración, capa texto, origen P43): «en oracion» sin tilde en la lista y en la ficha
- **baja · oracion-14** (Oración, capa texto, origen propio): Mensajes con nombres internos de campo, de módulo y de estado
- **baja · oracion-15** (Oración, capa texto, origen propio): Textos que prometen algo distinto de lo que pasa
- **baja · oracion-16** (Oración, capa texto, origen propio): Fechas en formato de máquina en la lista y la ficha
- **baja · oracion-17** (Oración, capa demostracion, origen propio): En la demostración la petición nueva sale con el código de la categoría y siempre en BOG-NORTE
- **baja · oracion-18** (Oración, capa pantalla, origen propio): El formulario no dice sus límites, no preselecciona la única sede y el contacto admite cualquier texto
- **baja · panel-11** (Panel, capa pantalla, origen propio): «Sus módulos» no sirve de acceso rápido: tarjetas sin enlace, con nombres distintos de las pestañas, ordenadas por código y contando módulos sin pantalla
- **baja · panel-12** (Panel, capa texto, origen propio): Textos del Panel y del armazón: saludo fijo, plurales con «(s)», concordancia, un nivel que promete lo que el rol no tiene y códigos crudos en los 403
- **baja · panel-13** (Panel, capa pantalla, origen propio): El estado del sistema le muestra a cualquier rol el diagnóstico técnico crudo, incluida la cuenta de tablas legibles sin política
- **baja · panel-14** (Panel, capa pantalla, origen propio): El armazón no sigue la regla de diseño escrita: menú sin rótulos por materia ni distintivo de nivel, tarjetas con sombra, foco sin contorno y la hoja «Más» no retiene el foco
- **baja · panel-15** (Panel, capa demostracion, origen propio): La demostración trae un catálogo de módulos que no es el real: 23 en vez de 22 y «Auditoría y cumplimiento» repetido como Habeas Data
- **baja · P07** (Personas y la ficha, capa base, origen P07): El traslado queda en la línea de tiempo con la fecha de hoy
- **baja · personas-14** (Personas y la ficha, capa api, origen propio): Fijar una casilla por encima del nivel responde «otra sede»
- **baja · personas-15** (Personas y la ficha, capa texto, origen propio): Códigos crudos y tildes faltantes en la ficha
- **baja · personas-16** (Personas y la ficha, capa pantalla, origen propio): La historia se corta en 60 hechos sin avisar
- **baja · personas-17** (Personas y la ficha, capa pantalla, origen propio): Volver de la ficha borra la búsqueda, el cuadro no queda con el foco y cada búsqueda con Intro sale dos veces
- **baja · peticiones-6** (Peticiones internas, capa base, origen P45): Solo la pareja de la dirección general puede decidir, y «dirigida_a» no sirve: el equipo destinatario ni la ve
- **baja · peticiones-8** (Peticiones internas, capa api, origen propio): No se encola ningún aviso: la dirección no se entera de una petición nueva ni quien pidió de la decisión
- **baja · peticiones-9** (Peticiones internas, capa texto, origen P43): «en revision» sin tilde en la lista y en la ficha
- **baja · peticiones-10** (Peticiones internas, capa pantalla, origen propio): Una petición que espera decisión se pinta en verde, igual que una aprobada
- **baja · peticiones-11** (Peticiones internas, capa pantalla, origen propio): La lista de la dirección no dice de qué sede es cada petición
- **baja · peticiones-12** (Peticiones internas, capa texto, origen propio): Detalles de texto: «normal» dos veces en Prioridad, código de sede en la ficha, «hace 0 día(s)» y mensaje técnico con un enlace roto
- **baja · peticiones-14** (Peticiones internas, capa demostracion, origen propio): Textos crudos en la demostración: «Petición en_revision.», tipo «presupuesto» y la fecha de mañana después de las 7 p. m.
- **baja · peticiones-15** (Peticiones internas, capa pantalla, origen propio): Los distintivos de estado y de prioridad no llegan al contraste AA
- **baja · requerimientos-13** (Requerimientos, capa pantalla, origen propio): El formulario «Reportar un requerimiento» se ofrece a la Gerencia, que no puede reportar
- **baja · requerimientos-14** (Requerimientos, capa pantalla, origen propio): Doble clic en «Asignar» o en «Resolver» envía dos veces y abre dos diálogos
- **baja · requerimientos-15** (Requerimientos, capa texto, origen propio): Textos: nombres internos de campos, estados con guion bajo, plural «(s)», «media» repetida y fechas crudas
- **baja · requerimientos-16** (Requerimientos, capa pantalla, origen propio): Al reabrir, la ficha muestra la solución vieja como vigente y la nueva solución borra la anterior
- **baja · requerimientos-17** (Requerimientos, capa pantalla, origen propio): La lista se pide dos veces cada vez que se abre la pestaña
- **baja · talento-21** (Talento, capa base, origen propio): Se puede registrar dos veces el mismo voluntariado activo
- **baja · talento-22** (Talento, capa pantalla, origen propio): El selector de sede ofrece las 9 sedes con Talento apagado, y el rechazo dice «no están en su alcance»
- **baja · talento-23** (Talento, capa api, origen propio): Una fecha imposible (2026-02-30) produce un error 500
- **baja · talento-24** (Talento, capa texto, origen propio): Códigos crudos, nombres internos y textos sin tildes en Talento
- **baja · talento-25** (Talento, capa pantalla, origen propio): Cada visita a Talento pide dos veces la lista de voluntariados y la de contratos
- **baja · talento-26** (Talento, capa pantalla, origen propio): Cien enlaces se llaman igual («Antecedentes») y no dicen de quién son
- **baja · talento-27** (Talento, capa pantalla, origen propio): «Con observación» se registra sin poder escribir la observación ni la referencia del certificado
- **baja · tareas-13** (Tareas, capa base, origen P41): Reabrir no borra hecha_en: la tarea reabierta, o cancelada después, dice que se hizo, y al volver a marcarla hecha conserva la primera fecha
- **baja · tareas-14** (Tareas, capa api, origen propio): Una fecha imposible (30 o 31 de febrero) produce un 500 «error inesperado»
- **baja · tareas-15** (Tareas, capa pantalla, origen propio): Se acepta una fecha de vencimiento ya pasada, sin aviso: la tarea nace vencida
- **baja · tareas-16** (Tareas, capa api, origen propio): «Vencida» se calcula con la fecha de Bogotá, no con la de la sede
- **baja · tareas-17** (Tareas, capa texto, origen propio): Mensajes con nombres técnicos y códigos crudos; plural «tarea(s)»; «normal» dos veces en Prioridad; fechas en formato ISO
- **baja · tareas-18** (Tareas, capa pantalla, origen propio): En el teléfono la primera celda se deforma: el distintivo «suya» se estira y los botones cambian de alto
- **baja · tareas-19** (Tareas, capa pantalla, origen propio): Detalles de uso: la sede no viene elegida cuando hay una sola, la lista se pide dos veces al abrir, el título no tiene tope de caracteres y los botones repiten el mismo nombre
- **baja · tematicas-10** (Temáticas, capa texto, origen propio): Mensajes con nombres internos: «titulo», «descripcion», «pasaje», «predicador», «recursos», «id», «permiso ver sobre el módulo tematicas» y «Un evento para toda la red» dicho de una serie
- **baja · tematicas-11** (Temáticas, capa api, origen propio): Una fecha imposible (30 de febrero, 31 de abril) enviada a la API da 500 «error inesperado» en vez de 400
- **baja · tematicas-12** (Temáticas, capa pantalla, origen propio): La lista se pide dos veces cada vez que se abre la pestaña
- **baja · tematicas-13** (Temáticas, capa pantalla, origen propio): En el teléfono, al entrar a Temáticas desde «Más» la barra de abajo no marca ninguna sección

## Cómo terminarla la próxima semana

1. Revisar `e2e/GUIA-E2E.md`: el Postgres de laboratorio (puerto 5433) con la plantilla `cr_e2e_base` y la API compilada tienen que estar listos antes de lanzar.
2. En una sesión NUEVA (no en la de la auditoría, que relee más de 800.000 tokens en cada paso), pedir: «usa un workflow: corre `e2e/auditar-pestanas.workflow.js`». No necesita args: los títulos de los defectos del poblador y los hallazgos por refutar ya van dentro del script.
3. Ese script ya salta las 18 pestañas hechas: audita las 25 pendientes y refuta los 276 hallazgos nuevos de las hechas. Al final se juntan sus resultados con `reportes.json`.
4. **Costo esperado si corre igual que el 21 sep** (Opus 5, esfuerzo máximo, de 6 a 7 agentes en paralelo): cada auditoría costó en promedio unos 38 millones de tokens, así que las 25 pendientes suman del orden de 950 millones. La refutación nunca llegó a correr; si cuesta parecido, un agente por pestaña con hallazgos nuevos sumaría otro tanto o más. En total, del orden de 2.000 millones, casi lo mismo que se gastó el 21 sep en todo. Para gastar menos: dejar `REFUTAR = ['critica', 'alta']` en el script (72 de los 343 hallazgos actuales), correrlo por tandas (primero la consola) o con agentes en Sonnet 5.

El arnés (`e2e/`) vivía en una carpeta temporal de la sesión que se borra al reiniciar el Mac; desde el 21 sep vive en el repositorio. `poblar-red.workflow.js` es el Workflow que creó la red de demostración del commit 81af7bd.
