# Acta de construcción · 21 de septiembre de 2026

| Campo | Dato |
|---|---|
| Proyecto | CasaRoca System · Sistema 100p |
| Componente | Base de datos, API, pantallas, portal del congregante, salida de 99-o y operación |
| Fecha de corte | 21 de septiembre de 2026 |
| Repositorio | `github.com/100p-NANO/ecosistema-cr`, rama `main` |
| Confirmaciones | De `00faeba` a `fcafde6`: diez confirmaciones, 143 archivos, diez migraciones (0068 a 0077) |
| Estado | **Construido y verificado en la máquina de desarrollo. No está en producción** |

---

## 1. Objeto de este documento

Dejar constancia de lo que se construyó el 21 de septiembre y de cómo se comprobó. Ese día se cerraron los 35 hallazgos graves que la auditoría por pestaña del 20 había dejado abiertos, y se construyó todo lo que el Manual Maestro marcaba como pendiente y no dependía de una decisión de la iglesia.

Lo que se afirma aquí se puede comprobar: la sección 7 dice cómo. Y se dice de frente lo que **no** está hecho, porque un acta que solo cuenta lo bueno no sirve para decidir.

## 2. Los hallazgos del 20 que se cerraron

La auditoría del 20 de septiembre recorrió el sistema con doce auditores, uno por pestaña, probando contra la base de datos. Encontró 43 hallazgos graves y ese mismo día se cerraron 8. Los 35 restantes se cerraron el 21:

| Grupo | Cuántos | Qué eran |
|---|---|---|
| Impedían operar | 9 | Abrir un caso de consejería, registrar a un menor, registrar un antecedente, inscribir en una cohorte con valor, agregar un valor a un catálogo, plantillas que nacían inservibles |
| Seguridad | 7 | Saltarse el segundo factor, escribir sobre personas de otra iglesia, firmar la propia recertificación, un interruptor de módulos que no hacía nada |
| Sin rastro | 8 | Crear cuentas, equipos, iglesias o plantillas, encender RocaKids o cambiar lo que puede un rol no quedaban registrados |
| Datos falsos | 11 | Cifras y avisos de la consola que afirmaban cosas que no eran ciertas, como «NO tiene pastor asignado» cuando sí lo tenía |

Cada arreglo se comprobó **por su efecto en la base**, no por el código de respuesta de la API: el banco de conectores manda el cuerpo real de la pantalla y después le pregunta a la base si el dato llegó.

## 3. Qué se construyó

| Frente | Qué | Dónde |
|---|---|---|
| Diez módulos que solo tenían nombre | Oración, peticiones internas, requerimientos, tareas, calendario, temáticas, legal, comunicaciones, construcción y analítica: tablas aisladas por sede, reglas en la base, API, pantallas y pruebas | Migración 0074, `backend/api/src`, `frontend/src/vistas` |
| Pantallas que faltaban | Nuevos, aportes y Habeas Data tenían API y ninguna pantalla | `frontend/src/vistas` |
| La ficha de la persona | La búsqueda encontraba a la gente y no dejaba abrir a nadie. Ahora: datos agrupados, corrección con permiso, su historia en todos los módulos, casillas propias y posibles duplicados. Se abre por alcance, no por sede | Migración 0077, `frontend/src/vistas/personas.js` |
| Portal del congregante | La persona ve sus datos y los corrige, maneja sus permisos de contacto por canal y finalidad, descarga todo lo que la iglesia sabe de ella, pide sus certificados y radica sus derechos | Migración 0075, `/api/v1/yo`, `frontend/portal` |
| La salida de 99-o | Área de aterrizaje, validación que explica cada rechazo, aplicación por bloques, conciliación por sede y reversión exacta | Migración 0076, `scripts/migrar-99o.sh`, `backend/db/migracion/MAPA-99o.md` |
| Operación | Alertas del negocio en la nube, reversión del despliegue con un comando, un gancho que frena secretos antes de cada confirmación, versión de Node fijada y restauración medida | `infra/gcp`, `scripts/revertir-despliegue.sh`, `docs/RUNBOOK.md` |
| Documentos | Tres decisiones escritas (tema, inteligencia artificial y migración), ASVS nivel 2, economía, seis documentos legales en borrador y una guía por rol | `docs/` |

Algunas reglas de los módulos nuevos merecen nombrarse, porque las impone la base y no la pantalla:

- **Oración:** una petición confidencial solo la ven quien la registró y quien tiene el permiso expreso de verla.
- **Comunicaciones:** quien redacta no puede aprobar, un mensaje aprobado queda congelado y hay un freno general de envíos. Cuando la base legal es el consentimiento, a una persona solo le llega lo que ella autorizó por ese canal y para esa finalidad.
- **Construcción:** el avance de una obra sale de sus hitos, no de una cifra escrita a mano, y una obra terminada no admite hitos nuevos.
- **Analítica:** ninguna celda muestra un conteo menor que cinco, para que no se pueda adivinar quién es quién.
- **Requerimientos:** cada uno nace con su plazo según la prioridad (urgente 4 horas, alta 24, media 72, baja 7 días).

## 4. La salida de 99-o, ensayada

Se generaron 25.000 personas sintéticas con los defectos que tiene una base real: documentos repetidos, menores sin acudiente, correos compartidos, fechas imposibles y tres iglesias sin equivalencia. El ensayo corrió entero:

| Paso | Resultado |
|---|---|
| Validación | 3 segundos. Cada rechazo con su motivo y su fila de origen |
| Aplicación | 17 segundos, por bloques: primero los adultos, después los menores con su acudiente en el mismo bloque |
| Conciliación | Cuadrada por sede: lo que entró más lo rechazado es igual a lo que venía |
| Reversión | 4 segundos, y se niega si alguien ya usó los datos migrados |
| Reintento | Limpio después de la reversión |

Falta la exportación real de 99-o. Sin ella, esto demuestra que el camino funciona, no que los datos de la iglesia estén listos.

## 5. Lo que apareció al construir, y se cerró el mismo día

| Defecto | Por qué importaba |
|---|---|
| La purga de retención nunca se había aplicado a dos tablas | Los datos se quedaban más tiempo del que dice la política |
| La purga habría borrado alergias de niños que siguen viniendo | Contaba la edad del registro, no la última visita del niño |
| La purga habría abortado al chocar con la evidencia de entregas | Una fila que otra tabla necesita no se puede borrar a ciegas |
| Cinco semillas sin clasificar | Tumbaban el despliegue a producción |
| La imagen de las pantallas no traía la consola ni el portal | Y en la nube habría llamado a la máquina local |
| El servidor web quitaba las cabeceras de seguridad | De las páginas, que es donde más importan |
| Los acudientes, al entregar un niño, se leían solo de la memoria del equipo | Un equipo recién abierto no los tenía |
| El conteo de la puerta se reescribía en ceros al corregirlo | Una corrección borraba el dato que venía a corregir |

## 5b. Lo que apareció en la tarde, al construir la ficha de la persona

Probar la ficha con roles distintos destapó seis fallos que estaban en el producto. Se cerraron el mismo día, cada uno con su prueba:

| Hallazgo | Por qué importaba | Cómo se cerró |
|---|---|---|
| La ficha se abría por sede, no por alcance | Un líder de grupo, con un grupo vacío, abría la ficha completa de las 35 personas de su sede. La red prevé unos 800 líderes | Regla de alcance en la base (0077): grupo, segmento, ministerio, caso, menores a cargo. Banco de 22 casos |
| Editar no pedía el permiso de editar | Tesorería, que solo puede ver, corregía los datos de fe de cualquiera, y una prueba lo daba por bueno | Se exige el permiso; la prueba ahora comprueba que Tesorería no puede |
| Datos por encima del nivel | La fe y el bautismo (N3) le llegaban a un líder N2, y leerlos no dejaba rastro | Recorte por nivel de cada campo y bitácora de lectura N3 |
| La ficha de un menor sin rastro | La consola lo registraba; la ruta de las sedes no | Lectura N4 registrada |
| Sacar a alguien de un grupo fallaba siempre | Un tipo de hecho que nunca se sembró hacía caer la operación | Semilla y prueba por la API |
| La consola publicada abría vacía | Tres pantallas del 21 no tenían datos de ejemplo | Datos agregados y barrido de las 15 pestañas de la consola y las 23 de la app |

## 6. Estado por columna, sin suavizarlo

| Columna | Estado | Evidencia |
|---|---|---|
| Datos | ✅ | 78 migraciones y 25 semillas aplicadas desde cero; 20 bancos con 287 reglas probadas |
| API | ✅ | 197 rutas descritas en `openapi.yaml`; 22 pruebas de autenticación, 54 de la API, 146 conectores; 0 vulnerabilidades en dependencias |
| Pantallas | 🟠 | Los 22 módulos tienen pantalla, más la ficha de cada persona y el portal; verificado en el navegador en móvil y escritorio. Falta la prueba automática de accesibilidad y la prueba en teléfonos reales |
| Infraestructura | 🔴 | Terraform validado con 6 casos y sin aplicar; restauración medida (365 MB: copia en 4 s, restauración en 6 s). Falta la facturación de Google Cloud |
| Seguridad | 🟠 | ASVS nivel 2: 9 de 13 capítulos en verde. Faltan KMS, Secret Manager, TLS hacia la base y la prueba de intrusión externa |
| Cumplimiento | 🟠 | Ley 1581 construida en la base y en el portal. Los documentos legales son borradores |
| Adopción | 🔴 | Guías por rol escritas. No hay sede piloto, ni personas entrenadas, ni mesa de ayuda |

**Un rojo en infraestructura se reporta como «no terminado».** El sistema está construido de punta a punta y probado en la máquina de desarrollo, pero no está en producción.

## 7. Cómo comprobarlo

1. Abrir las tres demostraciones desde el teléfono: la aplicación de las sedes, la consola de la central y el portal «Mi iglesia». Tienen datos inventados y ningún servidor detrás, así que enseñan las pantallas y no el servidor.
2. En la máquina de desarrollo, correr `./scripts/verificar.sh`. Son 17 compuertas, de la base a Terraform, y el 21 de septiembre terminaron todas en verde.
3. Para la migración: `./scripts/migrar-99o.sh ensayo`, que corre sobre una base de ensayo y nunca sobre la real.

## 8. Lo que decide la mesa

Todo lo que se podía construir sin la iglesia está construido. Lo que sigue son decisiones:

1. Alcance y precio firmados: qué módulos entran en la primera ola, quién es el dueño de cada uno y si el portal va desde el inicio.
2. Quién es el Responsable del Tratamiento ante la ley, con razón social y NIT.
3. Facturación y región de Google Cloud.
4. La exportación de 99-o, el mapa de las 36 iglesias y la fecha de fin del contrato.
5. Quién asume perder hasta 15 minutos de datos en un desastre y quién aprueba los traslados entre sedes.
6. Qué inteligencia artificial y cuándo. Hoy no hay ninguna, a propósito.
7. La cuenta de PayU, la firma de los certificados de donación y el dominio casaroca.org.
8. La sede piloto (propuesta: Chía) y quién la acompaña.
9. La ratificación, con acta, de los permisos propuestos para los módulos nuevos.
10. La cifra de costo que se presenta: la fase 2 de la nube cuesta 526 USD al mes, unos 2,1 millones de COP, no 1,5 millones.
11. La revisión de un abogado para los documentos legales.
