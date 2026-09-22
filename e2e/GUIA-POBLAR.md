# Guía para los agentes que inventan la red de demostración de CasaRoca

Daniel pidió: «inventa y crea información para que quede perfecto el sistema». Hoy la base de
desarrollo es un esqueleto (6 sedes, 6 personas en una base limpia): la mitad de las pantallas se ven
vacías y ninguna prueba de punta a punta tiene con qué trabajar. Ustedes construyen, entre todos, **una
red completa e inventada** que se carga con un comando, y que después usan los 43 auditores de pestañas.

Repositorio: `~/Desktop/CasaRoca/ecosistema-cr` (rama `main`). Base PostgreSQL 16 local: socket `/tmp`,
puerto `5433`, usuario administrador `postgres`, sin contraseña. Node 22; el cliente `pg` está en
`backend/api/node_modules` (úselo con `createRequire`, como hace `backend/scripts/token-para.js`).

## Lo que NO se hace (hay otros agentes trabajando a la vez)

- ⛔ No corra `migrar.sh`, `probar.sh`, `verificar.sh` ni los bancos de la API: recrean `casaroca_dev`
  y compilan la API, y pisarían a los demás. Trabaje SOLO en la base de su puesto.
- ⛔ No toque `casaroca_dev`, `casaroca_test` ni las plantillas (`cr_pob_base`, `cr_pob_nucleo`,
  `cr_e2e_base`) salvo que su encargo diga exactamente lo contrario.
- ⛔ No edite archivos fuera de los que su encargo le asigna. No haga `git commit` ni `git push`: quien
  organiza revisa y confirma.
- ⛔ Nada de personas reales. Nombres inventados de listas amplias; correos en `@example.org`;
  teléfonos `300 555 xxxx` a `319 555 xxxx`; documentos en el rango 9.000.000.000 a 9.099.999.999.
- ⛔ Sin rayas largas (— –) en ningún texto que se vea en pantalla. Ortografía cuidada, con tildes.

## Cómo se trabaja con su base

    E2E=<carpeta e2e, se la da su encargo>
    $E2E/slot.sh <n> start <plantilla>      # copia la plantilla a cr_e2e_<nn> y levanta API y pantallas
    $E2E/slot.sh <n> sql "SELECT ..."       # SQL como administrador en su base
    $E2E/slot.sh <n> stop                   # antes de terminar
    PGDATABASE=cr_e2e_<nn> node backend/db/demostracion/<su archivo>.js

La API y las pantallas del puesto sirven para mirar cómo se ven sus datos (ver `e2e.py`); no son
obligatorias para poblar.

## La arquitectura del poblador (común a todos)

    backend/db/demostracion/
      LEEME.md              qué es, cómo se corre, qué NO es (lo escribe el agente del núcleo)
      comun.js              azar con semilla, listas de nombres, conexión, contexto, inserción por lotes (núcleo)
      00-red.js             sedes, unidades, personas, familias, menores, consentimientos, cuentas y roles (núcleo)
      10-...js a 60-...js   un archivo por tema (los agentes de módulos)
    backend/scripts/poblar-demostracion.sh   corre los archivos en orden (núcleo)

Reglas de los generadores:

1. **Determinista.** Mismo resultado cada vez: `mulberry32(20260921 + número del archivo)` de `comun.js`,
   nunca `Math.random()`. La fecha de referencia es **21 de septiembre de 2026** (no `new Date()`): la
   historia va de septiembre de 2025 a hoy y lo que viene, hasta noviembre de 2026.
2. **Solo desarrollo.** El script se niega si `PGDATABASE` no es `casaroca_dev`, `casaroca_test`,
   `cr_e2e_*` o `cr_pob_*`. Es una semilla de DEMOSTRACIÓN: jamás va a producción, y el `LEEME.md` lo dice.
3. **No se corre dos veces.** Cada archivo mira si su tema ya está poblado y, si lo está, avisa y sale sin
   duplicar. El linaje de lo inventado va en `source_system = 'demostracion'` donde la tabla lo tenga.
4. **Por las reglas de la base, no alrededor de ellas.** Se inserta como `postgres`, que se salta la
   seguridad por fila pero NO los disparadores, las restricciones ni las máquinas de estado. Si una regla
   frena, se respeta: los menores nacen con su acudiente en la misma transacción; los estados avanzan por
   sus transiciones válidas; lo que la base hace con una función (enviar una comunicación, registrar un
   ingreso de RocaKids con la función de 6 argumentos, recertificar, cerrar un caso con su desenlace) se
   hace con esa función. Si una regla parece un defecto, **no la desactive**: anótelo en su informe.
5. **Con autor.** Antes de escribir, fije el contexto de quien «lo hizo», como hace la API:
   `set_config('app.persona_id', <persona>, true)`, `app.sede_ids` (arreglo `{uuid,...}`), `app.nivel_max`,
   `app.alcance_global`. Así la auditoría y la línea de tiempo dicen quién registró cada cosa.
6. **Rápido.** Inserciones por lotes; el poblador entero tiene que correr en menos de dos minutos.
7. **Los catálogos mandan.** Todo valor de lista sale de `sistema.catalogo_valores` vigente (y de los
   enumerados que queden); nunca un texto inventado que la base no admite.
8. **Realista, no uniforme.** Sedes grandes y pequeñas; unos grupos que se reúnen y otros que se
   apagaron; nuevos atrasados; aportes con estacionalidad (diciembre sube); casos abiertos y cerrados;
   algo vencido en cada bandeja; datos faltantes donde en la vida real faltan (no todos tienen correo).
   Cada pantalla tiene que verse viva, y cada alerta del sistema tiene que tener algo real que decir.

## Dónde está cada cosa en la base

Migraciones en `backend/db/migrations` (0000 a 0077), semillas en `backend/db/seeds`. Lo más útil:
`0002` organización, `0003` persona, `0004` menores, `0005` consentimiento, `0006` identidad y permisos,
`0010` recorrido 4C, `0012` grupos, `0013` asistencia, `0014`/`0050`/`0057`/`0067` RocaKids, `0015`/`0030`/`0072`
consejería, `0016`/`0038` aportes, `0017` formación, `0018`/`0049`/`0051` talento y salvaguarda, `0027`-`0029`
segmentos, `0043` membresías de sede, `0044` central, regiones y equipos, `0046` catálogos, `0053`
cumplimiento, `0073` bandeja de salida, `0074` los diez módulos nuevos (oración, peticiones internas,
requerimientos, tareas, calendario, temáticas, legal, comunicaciones, construcción, analítica), `0075`
portal, `0077` alcance de la ficha. Pregúntele a la base antes de suponer una columna:
`information_schema.columns`, `pg_get_functiondef`, `pg_get_constraintdef`, `pg_policy`.

Reglas de la iglesia que la base ya impone o que el sistema respeta:
- ⛔ **Los pastores van en matrimonio:** cada sede tiene su pastor y su esposa pastora, los dos con
  `PASTOR_CONGREGACIONAL`. Nunca uno solo.
- ⛔ La etapa de RocaKids es el curso donde la persona SIRVE, no su edad.
- Quien sirve con menores tiene antecedentes vigentes y verificados; si no, la base no le da el rol.
- El consentimiento es por canal y finalidad; su fecha no puede estar en el futuro.

## Lo que su informe tiene que decir (lo pide el esquema de salida)

Archivos que escribió, cuántas filas quedaron por tabla, cuánto tarda, qué reglas de la base frenaron algo
(y cómo se respetaron), y cualquier cosa que parezca un **defecto del sistema** encontrado al poblar, con su
reproducción. Eso último es tan valioso como los datos.
