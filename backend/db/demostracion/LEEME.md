# La red de demostración de CasaRoca

> ⛔ **SOLO DEMOSTRACIÓN. JAMÁS PRODUCCIÓN.** Todo lo que deja esta carpeta es **inventado**: sedes
> nuevas, personas, familias, correos, teléfonos, documentos, consentimientos, cuentas. Existe para
> que las pantallas se vean vivas y para que las pruebas de punta a punta tengan con qué trabajar.
> El poblador se niega a correr sobre cualquier base que no sea `casaroca_dev`, `casaroca_test`,
> `cr_e2e_*` o `cr_pob_*`, y no hay forma de saltarse esa guarda sin editar el código.

## Qué es

Una base recién migrada es un esqueleto: 6 sedes y 6 personas. Esta carpeta la convierte en una red
completa y verosímil de Casa Sobre la Roca: **36 iglesias** (las 6 de la semilla y 30 más), unas
**4.100 personas** en familias, sus roles, sus cuentas y, archivo por archivo, lo que hacen en cada
módulo (grupos, asistencia, consejería, aportes, RocaKids, formación y los demás).

Todo se inventa **por las reglas de la base, no alrededor de ellas**: las iglesias nacen con
`sistema.crear_iglesia`, los roles con `identidad.otorgar_asignacion`, los traslados con
`nucleo.trasladar`, las fusiones con `nucleo.fusionar`, la recertificación con
`identidad.recertificar`, los módulos con compuerta legal con `sistema.habilitar_modulo` y su
evidencia. Los disparadores, las restricciones y las máquinas de estado mandan: si una regla frena
algo, se respeta y se anota.

## Cómo se corre

```bash
# Sobre la base de un puesto de pruebas (o casaroca_dev recién migrada)
PGDATABASE=cr_e2e_60 backend/scripts/poblar-demostracion.sh

# Solo algunos archivos, por su número
PGDATABASE=casaroca_dev backend/scripts/poblar-demostracion.sh 00 10
```

Requisitos: PostgreSQL 16 local (socket `/tmp`, puerto `5433`, usuario `postgres`), la base
**recién migrada** (el núcleo exige las 6 sedes de la semilla) y la API compilada una vez
(`backend/api/dist`), porque de ahí sale la derivación de la clave de laboratorio.

El guion corre en orden `backend/db/demostracion/[0-9][0-9]-*.js`, imprime el tiempo de cada
archivo y, al final, las filas por tabla. Cada archivo trabaja en **una transacción** (o queda todo
lo suyo, o nada) y **no se corre dos veces**: si su tema ya está poblado, avisa y sale sin duplicar.
El poblador entero tiene que quedar por debajo de dos minutos, y queda muy por debajo: medido el
21 de septiembre de 2026 sobre una base recién migrada, **la cadena completa tarda unos 36 s**
(35,2 a 36,4 s en tres corridas limpias; la última: 00: 6,2 s · 10: 4,9 · 20: 4,5 · 30: 5,3 ·
40: 1,5 · 50: 8,8 · 60: 4,9). Las tres corridas limpias dejaron exactamente las mismas filas en
cada tabla, y la segunda corrida sobre una base ya poblada sale en 0,8 s sin tocar una fila (la
huella de contenido de las 134 tablas no cambia).

**El orden importa y es el del nombre:** cada archivo lee lo que dejaron los anteriores (10 nombra
líderes entre quienes el núcleo dejó sin cargo, 20 toma servidores entre quienes 10 no nombró, 30
arma los equipos de intercesión con quien queda, y así). **60 va al final a propósito**: su
trabajador de avisos toma TODO lo que haya en cola, como el real. Correr un archivo suelto sobre el
núcleo funciona, pero deja cifras distintas a las de la cadena (por ejemplo, 50 solo sobre el núcleo
deja 23.069 aportes y en la cadena 23.683).

## Las reglas de todo poblador

1. **Determinista.** El azar sale de `mulberry32(20260921 + número del archivo)` (`crearAzar` de
   `comun.js`), nunca de `Math.random()`. Los identificadores de lo que se inserta salen del mismo
   azar (`azar.uuid()`), así que las personas tienen el mismo id en cada corrida. Los que crea una
   función de la base (la sede que devuelve `crear_iglesia`, las asignaciones, las membresías) no
   son deterministas.
2. **Fecha de referencia: 21 de septiembre de 2026** (`FECHA_REFERENCIA`), nunca `new Date()`. La
   historia va de septiembre de 2025 (salida en vivo de la ola 1) a hoy, y lo que viene llega hasta
   noviembre de 2026. Lo que tiene que estar en el pasado va hasta `AYER`.
3. **Linaje.** Todo lo inventado lleva `source_system = 'demostracion'` donde la tabla lo tenga.
4. **Con autor.** Antes de escribir se fija quién lo hizo (`fijarAutor`, `autorComo`,
   `autorDireccion`), igual que la API con `SET LOCAL`: la auditoría y la línea de tiempo lo dicen.
   ⛔ Varias funciones de la base (`identidad.otorgar_asignacion`, `sistema.crear_iglesia`,
   `sistema.habilitar_modulo`, `identidad.recertificar`, entre otras) fijan `app.motivo` y lo dejan
   puesto hasta el fin de la transacción. Antes de cada paso nuevo, el poblador vuelve a escribir el
   suyo (`SELECT set_config('app.motivo', $1, true)`): si no, la bitácora dice que 297 cuentas se
   crearon por «Acta: ACTA-NYC-2026-03 · coordinación de nuevos», que es lo que pasaba antes.
5. **Los catálogos mandan.** Todo valor de lista sale de `sistema.catalogo_valores` vigente
   (`valoresDe`).
6. **Datos inventados de verdad.** Correos en `@example.org`, teléfonos `300 555 0000` a
   `319 555 9999`, documentos entre `9000000000` y `9099999999`.

## Lo que deja el núcleo (00-red.js)

**La red.** 36 sedes colgadas de su región (`REG-BOG`, `REG-COL`, `REG-INT`), con su zona horaria
(Houston en `America/Chicago`, Madrid y Barcelona en `Europe/Madrid`):

| Región | Sedes |
|---|---|
| Bogotá y Sabana | Bogotá Chicó (madre, 380), Bogotá Norte (340), Bogotá Sur (265), Bogotá Occidente (140), Bogotá Suba (115), Soacha (75); plantaciones de Chía, Zipaquirá, Funza y Cajicá |
| Colombia | Medellín (310), Cali (285), Barranquilla (250), Bucaramanga (150), Envigado, Cartagena, Pereira, Villavicencio, Cúcuta, Ibagué, Bello, Manizales, Santa Marta, Armenia, Neiva; plantaciones de Pasto, Montería, Tunja y Popayán |
| Internacional | Miami (120), Panamá (110), Madrid (95), Barcelona (85), Orlando, Houston; plantación de Nueva York |

- **Ministerios por sede** con criterio: las grandes casi todos, las medianas lo principal, las
  plantaciones lo mínimo (Nicodemo, Alabanza, Cursos cortos). Algunas sedes tienen un ministerio que
  se apagó.
- **Segmentos** de RocaKids (`BEBES`, `PEQUENOS`, `EXPLORADORES`, `AVENTUREROS`) y de tMt (`PULSO`,
  `ECO`, `LEGADO`) en cada sede donde esos ministerios están encendidos.
- **Módulos**: los de compuerta legal (Consejería, Aportes, RocaKids, Oración, Legal) quedan
  encendidos con su evidencia, salvo dos pendientes a propósito: **Aportes en Houston** y
  **RocaKids en Madrid**. Construcción está encendida donde hay obra: Bogotá Chicó, Bogotá Sur,
  Medellín, Cali, Barranquilla y Villavicencio. ⛔ La API esconde las sedes donde un módulo está
  apagado: pueble solo donde está encendido (`sedes(c, { conModulo })`).

**La semilla se conserva.** Las 6 sedes y las 6 personas de la semilla mantienen su identificador y
su rol; las personas reciben nombre y hoja de vida completa: el «Director General» pasa a ser
**Álvaro Enrique Montenegro Salcedo** (Pastor Principal, con su esposa **Beatriz Elena Cárdenas
Vallejo**) y los cinco «Pastor Norte», «Pastor Medellin»… reciben nombre propio y quedan trasladados a
su sede con su historia en la madre. ⚠️ En una base poblada, `crear-cuenta.js "Director General"` ya
no encuentra a nadie: búsquelo por su rol (`PASTOR_DIRECTOR_GENERAL`) o con `direccionGeneral()`.

**Las personas.** Unas 4.100, en hogares (`grupos.hogares`): parejas con hijos, madres y padres
solos, jóvenes, adultos solos, adultos mayores, tres generaciones. Hay visitantes recientes (26 %),
miembros y líderes; hogares inactivos; 4 fallecidos y 6 que se fueron de la red con su membresía
cerrada; 53 familias (127 personas) trasladadas entre sedes con su historia; servidores de las plantaciones que
congregan en la sede madre; 10 traslados en curso; 14 personas registradas dos veces (3 ya
fusionadas, 11 por revisar). No todos tienen correo, teléfono o documento: a los españoles y
panameños no se les puede registrar el DNI ni la cédula panameña (ver defectos).

- **Menores**: todos con su acudiente principal; la mayoría con un segundo acudiente, que a veces no
  puede retirarlos; abuelos, padrastros y hermanos mayores como acudientes autorizados. Tres jóvenes
  cumplieron 18 este mes con los acudientes todavía abiertos, y seis cumplen 18 en las próximas
  semanas: la alerta de mayoría de edad tiene algo que decir.
- **Consentimientos** por canal y finalidad, con fecha pasada, evidencia y versión de la política
  (v1.0 retirada, v2.0 vigente). Los que llegaron antes de su ola vienen del sistema anterior; los
  de 2023 salen de la campaña de actualización de datos. El 14 % de los adultos no autorizó nada,
  algo más del 5 % revocó alguna convocatoria, y cinco revocaron hoy (con `plataforma.revocar_consentimiento`).

**Los roles** (todos con acta, fecha y quién los otorgó):

- En cada sede: el pastor y su esposa (`PASTOR_CONGREGACIONAL`, N3, **siempre la pareja**),
  secretaría y coordinación de nuevos (dos en las sedes grandes), tesorería, digitación de aportes y
  dos consejeros (`CONSEJERO`, alcance `caso_propio`: son de la sede donde congregan).
- ⛔ Las **plantaciones no tienen tesorería, digitador ni consejeros**: su plantilla no trae
  Aportes ni Consejería («arranque mínimo») y un rol sin módulo es un acceso que nadie usa.
- En la central: la **dirección general en matrimonio** (el Pastor Principal de la semilla y su
  esposa, `PASTOR_DIRECTOR_GENERAL`, N4), los cinco directores, y los equipos con sus integrantes
  (`org.unidad_miembros`). Cada región tiene su pareja supervisora (heredan
  `PASTOR_CONGREGACIONAL` sobre la región).
- ⛔ **No** hay roles de RocaKids, de líder de grupo ni integrantes de `EQ-KIDS`: dependen de
  antecedentes y de grupos, y los ponen esos pobladores.
- Historia: seis cargos anteriores vencidos (su cuenta quedó suspendida), un integrante que salió
  del equipo de Finanzas, y el comité de accesos de hoy recertificó la región Bogotá y la central
  (una revocación incluida). Las demás regiones tienen accesos vencidos por revisar.

**Las cuentas.** Toda persona con un rol vigente tiene cuenta (297 en el núcleo), con usuario igual a su
correo y la **clave de laboratorio** de `backend/scripts/token-para.js`
(`frase larga de laboratorio para el banco de api`), sin segundo factor activo. Quien tiene N3 o N4
debe configurarlo al entrar. Dos cuentas recién creadas tienen clave provisional. Al final de la
cadena completa hay **684 cuentas** (297 del núcleo, 246 de los líderes y cargos de 10, 123 de
RocaKids en 20 y 18 de la intercesión en 30), seis con clave provisional.

Para entrar en las pruebas: `slot.sh <n> token <persona_id>` o `e2e.py` (usan `token-para.js`, que
resuelve el segundo factor). ⚠️ `token-para.js` le cambia el usuario a la cuenta
(`banco.api.<id>@casaroca.org`) y la deja sin segundo factor: después de usarlo, esa cuenta ya no
es la original.

## La cadena completa (00 a 60): qué deja cada archivo

Cada archivo de módulo explica en su cabecera qué deja, qué reglas de la base lo frenaron y qué
defectos vio. Lo principal, con las cifras de la cadena completa del 21 de septiembre de 2026:

| Archivo | Lo que deja | Tiempo |
|---|---|---|
| `00-red.js` | 36 sedes, 4.181 personas en 1.062 hogares, menores con acudientes, consentimientos, roles de sede, la central y sus equipos, cuentas | 6,2 s |
| `10-grupos-asistencia-nuevos.js` | 197 grupos (91 familiares, 68 pequeños con 30 de tMt Legado, 19 de discipulado, 19 ministeriales) con 2.086 integrantes y 5.126 reuniones; 3.387 servicios con su conteo y 11.673 marcas QR en 13 domingos; 499 nuevos en la bandeja (213 integrados) con 1.450 contactos; líderes de grupo, directores y coordinadores de Legado y quien toma la asistencia | 4,9 s |
| `20-rocakids-talento.js` | 100 salas en las 26 sedes con RocaKids (Madrid no: su módulo está apagado); 1.109 voluntariados, 2.594 antecedentes con su historia, 26 directores y 94 maestros de RocaKids por etapa, el equipo global; ocho domingos con 3.022 ingresos y sus entregas; hoy, 28 ingresos en 6 salas; 84 contratos | 4,5 s |
| `30-cuidado-pastoral.js` | 178 casos de consejería con 723 sesiones y 817 notas; 354 peticiones de oración y 1.298 oraciones hechas; 48 intercesores; 122 peticiones internas, 198 requerimientos (17 vencidos) y 211 tareas (26 vencidas) | 5,3 s |
| `40-formacion-tematicas-calendario.js` | 6 programas, 19 cursos, 359 cohortes con 2.709 inscripciones y 841 certificados; 151 series con 663 enseñanzas; 948 eventos (180 por venir, 23 que pasaron sin marcar) | 1,5 s |
| `50-aportes-construccion-legal.js` | 23.683 aportes en COP, USD y EUR desde enero de 2025 (210 por confirmar, 39 anulados con motivo), 244 certificados de 2025, 520 cierres de control (dos que no cuadran a propósito), 260 pagos por la pasarela y 22 desembolsos; 10 obras con 38 hitos; 16 asuntos legales con 41 actuaciones | 8,8 s |
| `60-comunicaciones-cumplimiento-avisos.js` | 191 comunicaciones (156 enviadas) y 8.957 avisos en todos sus estados (74 en cola, 32 esperando reintento, 19 fallidos); 36 peticiones de Habeas Data (2 vencidas); el comité de accesos de hoy | 4,9 s |

**Filas al final de la cadena** (las tablas del núcleo crecen con los demás archivos: roles,
cuentas, recertificaciones y revocatorias también las escriben 10, 20, 30 y 60):

| Archivo | Tablas y filas |
|---|---|
| 00 | `org.sedes` 36 · `org.unidades` 19 · `org.unidad_miembros` 48 · `org.ministerios_sede` 503 · `org.segmentos` 189 · `sistema.modulos_sede` 637 · `nucleo.personas` 4.181 · `nucleo.membresias_sede` 4.413 · `nucleo.vinculos` 4.760 · `nucleo.acudientes` 2.320 · `nucleo.fusiones` 3 · `nucleo.persona_atributos` 416 · `grupos.hogares` 1.062 · `grupos.hogar_miembros` 3.625 · `plataforma.politicas_tratamiento` 2 · `plataforma.consentimientos` 10.130 · `identidad.asignaciones` 687 · `identidad.asignaciones_unidad` 9 · `identidad.cuentas` 684 · `identidad.recertificaciones` 421 |
| 10 | `grupos.grupos` 197 · `grupos.membresias` 2.086 · `grupos.reuniones` 5.126 · `asistencia.servicios` 3.387 · `asistencia.conteos` 3.333 · `asistencia.entradas` 11.673 · `crm.nuevos_registros` 499 · `crm.contactos_nuevos` 1.450 · `crm.notas_privadas_nuevos` 102 · `crm.recorrido` 315 |
| 20 | `rocakids.salas` 100 · `rocakids.servidores_sala` 1.453 · `rocakids.inscripciones` 863 · `rocakids.autorizaciones` 6.564 · `rocakids.condiciones_medicas` 129 · `rocakids.checkins` 3.022 · `rocakids.intentos_entrega` 3.084 · `talento.antecedentes` 2.594 · `talento.voluntariados` 1.109 · `talento.contratos` 84 |
| 30 | `consejeria.casos` 178 · `consejeria.asignaciones` 199 · `consejeria.sesiones` 723 · `consejeria.notas` 817 · `crm.peticiones_oracion` 354 · `crm.oraciones_hechas` 1.298 · `sistema.peticiones_internas` 122 · `sistema.requerimientos` 198 · `plataforma.tareas` 211 |
| 40 | `formacion.programas` 6 · `formacion.cursos` 19 · `formacion.cohortes` 359 · `formacion.inscripciones` 2.709 · `formacion.certificados` 841 · `formacion.series` 151 · `formacion.ensenanzas` 663 · `org.eventos` 948 |
| 50 | `aportes.aportes` 23.683 · `aportes.certificados` 244 · `aportes.cierres_control` 520 · `aportes.pasarela_transacciones` 260 · `aportes.pasarela_eventos` 261 · `aportes.desembolsos` 22 · `aportes.desembolso_items` 227 · `org.obras` 10 · `org.obras_hitos` 38 · `plataforma.asuntos_legales` 16 · `plataforma.asuntos_legales_notas` 41 |
| 60 | `crm.comunicaciones` 191 · `plataforma.peticiones_titular` 36 · `plataforma.notificaciones` 8.957 |
| todos | `crm.linea_tiempo` 42.566 · `plataforma.auditoria` 82.714 · `plataforma.bitacora_lectura` 3.084 |

Tablas que la cadena deja vacías a propósito: `identidad.sesiones`, `identidad.intentos_acceso` e
`identidad.suplantaciones` (se llenan con el uso: cuando alguien entra o cuando soporte actúa en
nombre de alguien; la alerta de intentos fallidos mira solo la última hora), `plataforma.avisos_no_enviados` y el esquema `migracion` (la carga desde 99o no
tiene pantalla).

**Lo que conviene saber para probar:**

- **Roles vigentes al final:** 677 asignaciones personales (72 pastores de sede, siempre en pareja;
  la dirección general en pareja; 42 secretarías, 42 coordinaciones de nuevos, 27 tesorerías, 27
  digitadores, 54 consejeros, 194 líderes de grupo, 24 directores y 6 coordinadores de segmento, 19
  de asistencia, 26 directores y 94 maestros de RocaKids, 27 líderes de oración y 21 personas que
  oran) y 27 personas con rol por su equipo o su región (`identidad.asignaciones_unidad`).
- **Intercesión (30):** `LIDER_DE_ORACION` en las 27 sedes con Oración y `PERSONA_QUE_ORA` en las
  medianas y grandes, con acta de la dirección y cuenta. La persona que ora solo ve lo compartido;
  el líder, todo menos lo confidencial.
- **Relevos de consejería (30):** Luz Hoyos entregó sus casos en enero; Javier Saavedra, hoy, en el
  instante de su revocación en el comité de accesos. Ese relevo lo hizo el poblador: el sistema no
  reasigna los casos de quien pierde el rol.
- **Requerimientos (30):** los atiende el Equipo de Comunicaciones (`EQ-COM`).
- **Construcción y Legal (50):** solo los maneja la dirección general (la matriz no se los da a nadie
  más); sus autores son el Pastor Principal y su esposa.
- **RocaKids hoy (20):** 27 niños en sala en Bogotá Chicó, Bogotá Norte, Cali y Medellín; Cali
  Pequeños con un solo adulto y, en Bogotá Chicó, un niño con dos intentos de retiro de alguien sin
  permiso. El poblador imprime los códigos de entrega de hoy (solo laboratorio); se leen también con
  `pgp_sym_decrypt(codigo_cifrado, 'llave-solo-de-desarrollo')`. Los códigos cambian en cada corrida.
- **El comité de accesos de hoy (00, 10, 20 y 60):** recertificó la central, la región Bogotá, la
  región Colombia y Miami (421 revisiones, una revocación). Quedan 121 accesos vencidos por revisar
  (Cúcuta, Neiva, Santa Marta, Armenia y el resto de la región internacional).
- **La red está anclada al lunes 21 de septiembre de 2026.** Lo «de hoy» (niños en sala, envíos de
  la mañana, el freno de Medellín, el comité) es de ese día: usada otro día, queda en el pasado.

## La plantilla de los auditores (`cr_e2e_base`)

`cr_e2e_base` es la red completa, lista para copiar a cada puesto de pruebas. Se rehace así (lo que
se hizo el 21 de septiembre de 2026 en el puesto 67):

```bash
E2E=<carpeta e2e>
$E2E/slot.sh 67 start cr_pob_base                              # base recién migrada
PGDATABASE=cr_e2e_67 backend/scripts/poblar-demostracion.sh     # la cadena completa
$E2E/slot.sh 67 stop                                            # y cerrar toda conexión a cr_e2e_67
psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS cr_e2e_base" \
                             -c "CREATE DATABASE cr_e2e_base TEMPLATE cr_e2e_67"
```

Junto a la plantilla queda `directorio.json` en la carpeta e2e: para cada rol, quién lo tiene
(persona, sede, nivel, alcance y si llega por su equipo), la pareja pastoral de cada sede y ejemplos
listos (un menor con acudiente que retira y otro que no, los niños en sala hoy con su código, un
miembro sin rol, personas de otra sede, un líder con su grupo y alguien de su sede fuera del grupo,
un consejero con casos, un nuevo atrasado, cuentas con clave provisional o suspendidas). Una
persona por línea: `grep '"rol":"TESORERIA"' directorio.json`.

## Los bancos sobre la red poblada

Los 20 bancos de invariantes están escritos para una base limpia (`scripts/probar.sh` migra antes de
correr). Corridos con `--rapido` sobre una copia de la red completa, **17 de 20 quedan en verde y
283 de 287 invariantes pasan**. Las cuatro que fallan son **supuestos frágiles de los bancos**, no
defectos del poblador ni de la regla (la regla se comprobó aparte en cada caso):

1. `consola_sistemas` C11 (**Filial nace con los módulos legales apagados**) y C13 (**Permiso sobre
   módulo apagado**) leen Barcelona (`BCN`), la filial de la semilla, en vez de crear una filial. En
   la red, Barcelona tiene Consejería, Aportes, RocaKids y Oración encendidos **con** su evidencia
   (registro RGPD), por `sistema.habilitar_modulo`. La regla se cumple: una filial nueva creada con
   `sistema.crear_iglesia` nace con los cuatro apagados, y en Houston (Aportes apagado) nadie tiene
   permiso efectivo sobre Aportes.
2. `membresias_sede` M1 (**Persona sin sede principal vigente o con dos**) cuenta a las 4 personas
   fallecidas y a las 5 que se fueron de la red: su membresía quedó cerrada como `egresado`, el único
   tipo del catálogo para «estuvo aquí y ya no». El comentario del banco dice «se cuentan solo las
   personas VIVAS», pero su consulta solo excluye las borradas y las fusionadas. (El sistema no tiene
   cómo registrar un fallecimiento ni una salida: ver el defecto 9.)
3. `modulos_nuevos` G2 (**Alergia de hace 2 años**) cuenta TODAS las condiciones médicas que la purga
   tomaría, no solo la suya. En la red ya hay una que la purga toma con razón: la de un niño de 13
   años inscrito en Preadolescentes de Bogotá Chicó desde el 8 de septiembre de 2025 que no tiene
   ningún ingreso registrado.

Ningún banco se editó. Para que pasen sobre cualquier base, C11 y C13 tendrían que crear su propia
filial, M1 excluir `fallecida` y `trasladada` (o el sistema definir qué pasa con ellas) y G2 contar
solo su propia fila.

## Cómo encontrar a la gente (consultas listas)

```sql
-- La pareja pastoral de una sede
SELECT p.id, p.primer_nombre, p.primer_apellido, p.genero
  FROM identidad.asignaciones a JOIN nucleo.personas p ON p.id = a.persona_id
 WHERE a.rol = 'PASTOR_CONGREGACIONAL' AND a.revocada_en IS NULL
   AND a.alcance_id = (SELECT id FROM org.sedes WHERE codigo = 'CALI');

-- Adultos activos de una sede entre 25 y 40 años, con celular
SELECT p.id, p.primer_nombre, p.primer_apellido, date_part('year', age(DATE '2026-09-21', p.fecha_nacimiento)) AS edad
  FROM nucleo.personas p JOIN org.sedes s ON s.id = p.sede_id
 WHERE s.codigo = 'BOG-NORTE' AND p.estado = 'activa' AND p.eliminado_en IS NULL
   AND p.telefono_movil IS NOT NULL
   AND age(DATE '2026-09-21', p.fecha_nacimiento) BETWEEN interval '25 years' AND interval '41 years';

-- Una familia completa y el parentesco de cada uno con el jefe de hogar
SELECT h.nombre, p.primer_nombre, p.fecha_nacimiento,
       (SELECT v.tipo FROM nucleo.vinculos v WHERE v.persona_id = h.jefe_hogar_id AND v.relacionada_id = p.id LIMIT 1) AS parentesco
  FROM grupos.hogares h JOIN grupos.hogar_miembros hm ON hm.hogar_id = h.id AND hm.hasta IS NULL
  JOIN nucleo.personas p ON p.id = hm.persona_id
 WHERE h.source_id = 'hogar-CALI-0001';

-- Menores de 3 a 5 años de una sede, con quién puede retirarlos
SELECT m.primer_nombre, m.fecha_nacimiento, q.primer_nombre AS acudiente, a.parentesco, a.es_principal, a.autoriza_retiro
  FROM nucleo.personas m JOIN nucleo.acudientes a ON a.menor_id = m.id AND a.vigente_hasta IS NULL
  JOIN nucleo.personas q ON q.id = a.acudiente_id
 WHERE m.sede_id = (SELECT id FROM org.sedes WHERE codigo = 'BOG-SUR')
   AND age(DATE '2026-09-21', m.fecha_nacimiento) BETWEEN interval '3 years' AND interval '6 years' - interval '1 day';

-- Quién tiene hoy un rol en una sede (los consejeros se buscan por la sede de la persona)
SELECT a.rol, p.primer_nombre, p.primer_apellido
  FROM identidad.asignaciones a JOIN nucleo.personas p ON p.id = a.persona_id
 WHERE a.revocada_en IS NULL AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
   AND (a.alcance_id = (SELECT id FROM org.sedes WHERE codigo = 'MED')
        OR (a.alcance_tipo = 'caso_propio' AND p.sede_id = (SELECT id FROM org.sedes WHERE codigo = 'MED')));

-- Integrantes de un equipo de la central
SELECT u.codigo, m.rol_en_unidad, p.primer_nombre, p.primer_apellido
  FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id JOIN nucleo.personas p ON p.id = m.persona_id
 WHERE u.codigo = 'EQ-FIN' AND m.hasta IS NULL;
```

Las mismas búsquedas existen como funciones en `comun.js`: `sedes`, `sede`, `personas`, `familias`,
`menores`, `conRol`, `pastores`, `consejeros`, `direccionGeneral`, `equipo`, `segmentos`,
`valoresDe`, `puedeContactar`.

## Cómo se escribe un poblador de módulo

```js
const d = require('./comun');
d.ejecutar({ archivo: 30, tema: 'consejería' }, async (c, azar) => {
  if (await d.yaPoblado(c, `SELECT count(*) FROM consejeria.casos WHERE source_system = $1`,
                        [d.SISTEMA], 'consejería')) return;
  await d.enTransaccion(c, async () => {
    for (const s of await d.sedes(c, { conModulo: 'consejeria' })) {
      const [pastor] = await d.pastores(c, s.codigo);
      await d.autorComo(c, pastor.persona_id, { motivo: 'Consejería de la sede' });
      // ... insertar por lotes con d.insertarLote, o llamar la función de la base que corresponda
    }
  });
  return d.contarFilas(c, ['consejeria.casos']);
});
```

`comun.js` documenta cada función que exporta. Los pobladores de módulos **no lo editan**.

## Defectos del sistema encontrados al poblar

Se respetaron tal como están (nada se desactivó) y quedan aquí para que alguien los corrija:

1. **La fusión de duplicados pierde los consentimientos, incluida la revocación.** `nucleo.fusionar`
   mueve las referencias con `UPDATE`, pero `plataforma.consentimientos` tiene la regla
   `consentimientos_no_update ... DO INSTEAD NOTHING`: el `UPDATE` no hace nada, no falla y la
   fusión informa `referencias_movidas = {}`. Si la persona revocó WhatsApp en el registro duplicado,
   después de fusionar la principal sigue «contactable». En la demostración está la fusión que lo
   muestra (el primer duplicado fusionado).
2. **Buscar por un solo apellido no encuentra a quien tiene nombre largo.** `nucleo.buscar_personas`
   compara con `similarity()` contra el nombre completo y el umbral 0,3: «Gómez» encuentra 14 de las
   31 personas que se apellidan así, y el pastor de Bogotá Norte no se encuentra a sí mismo buscando
   «Zamora». Es justo el duplicado que la búsqueda quería evitar.
3. **Todo visitante nace «miembro» de la sede.** `nucleo.tg_persona_nace_con_membresia` decide el
   tipo por el estado (`activa`) y no por el nivel de compromiso: un visitante convertido desde la
   bandeja de nuevos queda como «Miembro: congrega en esta sede y es su casa». El núcleo corrige el
   tipo de sus visitantes después del alta.
4. **El traslado se anota con la fecha de hoy.** `nucleo.trasladar` escribe el hecho
   `TRASLADO_SEDE` con `now()` y no con `p_desde`: un traslado de 2009 aparece en la línea de tiempo
   como ocurrido hoy.
5. **El catálogo de documentos no sirve fuera de Colombia.** `nucleo.tipos_documento` tiene DNI, NIE,
   CIP, SSN e ITIN, pero el catálogo vigente (`tipo_documento`) solo admite los colombianos y el
   disparador rechaza los demás: en Barcelona, Madrid, Panamá y Estados Unidos los locales quedan sin
   documento o con pasaporte.
6. **Dos caminos para abrir una iglesia que no hacen lo mismo.** `POST /api/v1/organizacion/sedes`
   inserta la sede directo (sin plantilla de módulos, sin sede madre, sin bitácora de
   aprovisionamiento) aunque sí exige a la esposa; `POST /api/v1/administracion/iglesias` usa
   `sistema.crear_iglesia` pero recibe un solo pastor, sin la esposa.

Encontrados al integrar la cadena completa y probar la API con 22 roles sobre la red (21 de
septiembre de 2026; la reproducción está en el informe del integrador). Cada archivo de módulo
lista además, en su cabecera, los defectos que vio al poblar.

7. **Un consejero sin otro rol no puede usar la aplicación.** El rol `CONSEJERO` tiene alcance
   `caso_propio` y la base exige `alcance_id` nulo para ese alcance; `identidad.sedes_de` no le da
   ninguna sede, y `conSesion` (`backend/api/src/comun/identidad.helper.ts:69`) rechaza a todo
   usuario sin sede con 403 «Su usuario no tiene ninguna sede asignada todavía», también en
   `GET /api/v1/consejeria/casos`. En la red, los 54 consejeros están así (44 con casos asignados).
   La seguridad por fila sí le mostraría sus casos: el cerrojo está en la API.
8. **La ficha de una persona en la consola da 500 a un pastor.**
   `GET /api/v1/administracion/personas/:id` (`backend/api/src/administracion/administracion.ts:929`)
   envuelve `identidad.cuenta_de` en un `try/catch` sin punto de guardado: para quien no administra
   accesos la función lanza 42501, la transacción queda abortada y la consulta siguiente falla con
   25P02. Se llega desde «Qué puede cada quien» (N3), botón Ficha.
9. **No hay cómo registrar un fallecimiento ni una salida de la red.** Ni la API ni las pantallas
   cambian el estado de una persona (`personas.service.ts:154`); solo se puede por SQL. Y el
   disparador `nucleo.tg_estado_persona_corta_acceso` (migración 0048) suspende la cuenta al pasar a
   `fallecida`, `fusionada` o `inactiva`, pero no a `trasladada`, aunque su comentario dice que sí:
   quien se fue de la red conserva la cuenta y los roles.
10. **Textos de la semilla sin tildes y una raya larga.** Se ven en pantalla: las tres regiones
    («Region Bogota y Sabana», «Region Colombia», «Region Internacional»), las cinco direcciones
    («Direccion Pastoral» y las demás), «Equipo de Formacion», «Equipo de Produccion» y «Equipo de
    Construccion» (semilla 020); «Instituto biblico», «Formacion de maestros de ninos», «Ensenar a
    ninos», «Como dirigir un grupo», «El caracter del lider», «Salvaguarda y proteccion de menores»
    y la sala «Parvulos (3 a 5)» de Bogotá Chicó (semilla 019); y la descripción del rol
    `DIRECTOR_SEGMENTO` lleva una raya larga (semilla 006). El poblador no los maquilla, para que el
    arreglo llegue a producción.
