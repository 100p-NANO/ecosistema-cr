# HANDOFF · CasaRoca System AI
### Lo que se entrega, cómo se opera y qué falta

> Actualizado el 21 de septiembre de 2026 · Para la mesa (Ps. Carlos Ricardo), desarrollo (Jhon) y calidad (Manuel).

---

## 1 · La tabla de seis columnas, sin suavizarla

| Columna | Estado | Evidencia |
|---|---|---|
| **Backend · datos** | ✅ | 77 migraciones + 25 semillas aplicadas desde cero · **19 bancos, 265 invariantes en verde** (`scripts/probar.sh`) · migración desde 99-o **ensayada con 25.000 personas** (validación 3 s, aplicación 17 s, conciliación cuadrada por sede, reversión 4 s) |
| **Backend · API** | ✅ | **197 rutas**, todas descritas en `openapi.yaml` · 22 pruebas de autenticación, 52 de la API, **98 conectores de la consola y 37 de los módulos nuevos** (cada uno pregunta a la base si el dato llegó) · terceros con tiempo de espera y cortacircuitos · Nest 12, **0 vulnerabilidades** en dependencias |
| **Frontend** | 🟠 | **Los 22 módulos tienen pantalla** (21 en la app de las sedes, organización en la consola) y el **portal del congregante** · verificado en el navegador contra la API real, en móvil y escritorio, sin desbordes · demostración sin API para el teléfono. Falta: prueba automática de accesibilidad (axe) y prueba en teléfonos reales iOS y Android |
| **Infraestructura** | 🔴 | Terraform **validado y probado** (6 casos) con alertas del negocio, **sin aplicar** · restauración **medida con el volumen de la red** (365 MB: copia 4 s, restauración verificada 6 s) · 17 compuertas en `scripts/verificar.sh` · Cloud Build construye y prueba las imágenes. **Falta la facturación de Google Cloud para aplicarla** |
| **Seguridad** | 🟠 | `docs/SEGURIDAD-ASVS-L2.md`: 9 de los 13 capítulos que aplican en verde, con evidencia. Falta aplicar KMS, Secret Manager y TLS a la base (dependen de la infraestructura) y la **prueba de intrusión externa** |
| **Cumplimiento** | 🟠 | Ley 1581 construida en la base: consentimiento por canal y finalidad, plazos legales con festivos, supresión, retención aplicada, bitácora de lectura, y el titular ejerce sus derechos solo en el portal. Los **documentos legales están en borrador** (`docs/legal/`): faltan los datos del Responsable y la revisión de un abogado |
| **Adopción** | 🔴 | Guías por rol escritas (`docs/guias/`). No hay sede piloto, ni personas entrenadas, ni mesa de ayuda, y el conocimiento está en una sola persona |

**Cómo se dice en la mesa:** el sistema está construido de punta a punta y probado en la máquina de desarrollo, **pero no está en producción y no está terminado**: la infraestructura está escrita y sin aplicar (falta la facturación de la nube), los documentos legales son borradores, y nadie en las sedes lo ha usado todavía. Lo que falta ya no es construir: son decisiones, llaves y un piloto.

**La infraestructura está escrita y no aplicada, así que el sistema todavía no está en producción**, y eso no se suaviza. Aplicarla es media jornada con las llaves de Google Cloud en la mano, y el paso a paso está en `docs/PUESTA-EN-MARCHA-GCP.md`.

## 1b · Lo que se construyó el 21 de septiembre de 2026

| Frente | Qué | Dónde |
|---|---|---|
| Diez módulos que solo tenían nombre | Oración, peticiones internas, requerimientos, tareas, calendario, temáticas, legal, comunicaciones, construcción y analítica: tablas con aislamiento por sede, reglas en la base, API, pantallas y pruebas | Migración 0074, `backend/api/src/<módulo>`, `frontend/src/vistas` |
| Pantallas que faltaban | Nuevos, aportes y Habeas Data tenían API y ninguna cara | `frontend/src/vistas` |
| Portal del congregante | El titular ve sus datos, los corrige, maneja sus permisos, descarga todo, pide sus certificados y radica sus derechos | Migración 0075, `/api/v1/yo`, `frontend/portal` |
| Salida de 99-o | Área de aterrizaje, validación explicada, aplicación por bloques, conciliación por sede, reversión exacta, ensayo de 25.000 | Migración 0076, `scripts/migrar-99o.sh`, `backend/db/migracion/MAPA-99o.md` |
| Operación | Alertas del negocio, reversión del despliegue, gancho de pre-commit, Node fijado, restauración medida | `infra/gcp`, `scripts/revertir-despliegue.sh`, `docs/RUNBOOK.md` |
| Documentos | Tres decisiones (tema, IA, migración), ASVS nivel 2, economía, legales en borrador, guías por rol | `docs/` |

**Defectos que aparecieron al construir y se cerraron el mismo día:** la purga de retención nunca se había aplicado a dos tablas, habría borrado alergias de niños que siguen viniendo y habría abortado al chocar con la evidencia de entregas; cinco semillas sin clasificar tumbaban el despliegue a producción; la imagen del frontend no traía la consola ni el portal y en la nube habría llamado a `127.0.0.1`; nginx quitaba las cabeceras de seguridad del HTML; los acudientes al entregar un niño se leían solo de la memoria del equipo; el conteo de la puerta se reescribía en ceros al corregirlo.

## 2 · Lo que se cerró el 19 de septiembre de 2026

| # | Hallazgo | Cómo se cerró |
|---|---|---|
| H-01 | **La API identificaba con una cabecera de texto plano** | Autenticación con token firmado, sesión revocable en la base, segundo factor obligatorio para N3 y N4, bloqueo por intentos, rotación de refresco. 19 pruebas |
| H-02 | **La sede de una persona era una columna mutable** | `nucleo.membresias_sede` con vigencia. Trasladar ya no reescribe el pasado ni entrega la historia a la sede nueva. 14 pruebas |
| H-03 | **El sistema dejaba de escribir el 1 de enero de 2028** | Particiones automáticas, partición por defecto, rescate y prueba que exige dos años de colchón. 10 pruebas |
| H-04 | **26 enumerados rígidos** | 12 catálogos de negocio convertidos a datos editables; los 16 restantes registrados como cerrados **con su motivo escrito**. 11 pruebas |
| H-05 | **La central no existía** | `org.unidades` (central, regiones, direcciones, equipos), permisos heredados del equipo y revocación inmediata. 14 pruebas |
| H-07 | **La API sin defensas** | Validación, límite de peticiones, cabeceras, errores centralizados, traza por petición, `/salud` que comprueba de verdad |
| H-08 | **La llave de cifrado en una variable** | La aplicación **se niega a arrancar** en producción con un secreto de desarrollo |
| H-09 | **Se podía asignar un maestro de niños sin verificar nada** | Antecedentes con vigencia, la base rechaza el rol sin ellos, regla de dos adultos, y peticiones de Habeas Data con plazos contados. 10 pruebas |
| H-10 | **La búsqueda no toleraba erratas** | Trigramas: «Pstor Medelin» encuentra a «Pastor Medellin». Fusión de duplicados que mueve todas las referencias. 11 pruebas |
| H-11 | **Nadie sabía qué pasa el domingo** | Prueba de carga: 36 sedes en paralelo, 2.293 peticiones/s, p95 de 21 ms, cero errores |
| H-12 | **No había frontend** | Aplicación real, móvil primero, con modo sin conexión |
| H-13 | **La suite era un informe, no una compuerta** | 7 de 8 bancos imprimían los fallos y devolvían éxito. Ahora rompen la corrida, y la suite arranca de base limpia |

**Y tres que aparecieron al construir, que nadie había visto:**

| Hallazgo | Por qué importa |
|---|---|
| **Toda tabla nueva nacía legible por la aplicación** (`ALTER DEFAULT PRIVILEGES` de la migración 0023) | Es la causa raíz de las fugas de agosto y del 11 de septiembre. Se corrigieron las tablas; nunca se corrigió la regla que las hacía nacer abiertas. Ahora nacen cerradas y exponerlas es un acto firmado en `plataforma.registro_exposicion` |
| **Cinco catálogos bloqueantes vacíos** | Consejería, Formación y RocaKids **no se podían usar**: no se abría un caso, no se inscribía a nadie y **no se hacía el check-in de un solo niño** |
| **Revocar un acceso solo surtía efecto al día siguiente** | Sacar a alguien del equipo de Finanzas a las 10:00 lo dejaba dentro hasta la medianoche |

## 2b · Lo que apareció en la madrugada del 20 de septiembre, al revivir las pruebas muertas

Tres bancos de la API (42 comprobaciones) se identificaban con la cabecera `X-Persona-Id`, que se
eliminó al cerrar H-01. Quedaron **muertos y fuera de la compuerta**, y los README seguían
afirmando su resultado. Al hacerlos entrar por la puerta de verdad aparecieron **fallos que
estaban en el producto, no en las pruebas**:

| # | Hallazgo | Por qué importa | Cómo se cerró |
|---|---|---|---|
| H-14 | **Toda donación devolvía 500** | El código seguía escribiendo `::aportes.tipo_aporte`, un enumerado que la migración 0046 convirtió en catálogo y **borró**. TypeScript no mira dentro de una cadena de SQL. El módulo de Aportes estaba roto entero | Se quitó el cast y hay una **compuerta nueva** que compara cada tipo citado por la API contra los tipos vivos de la base |
| H-15 | **Quien no autorizaba correo no podía ser miembro** | Convertir disparaba el aviso de bienvenida, el aviso exigía consentimiento, y al no haberlo **se deshacía la transacción entera**: la persona no llegaba a existir. Además se exigía consentimiento para finalidades cuya base legal **no** es el consentimiento (Ley 1581, art. 10): un certificado que la persona misma pidió | Migración 0055: el consentimiento se exige donde la ley lo exige, y lo que no se puede enviar **queda escrito** en `plataforma.avisos_no_enviados` con su motivo en vez de tumbar la operación |
| H-16 | **La API podía arrancar como superusuario** | Si heredaba `PGUSER` del entorno se conectaba como `postgres`, que **se salta todas las políticas**. Medellín veía la bandeja de Bogotá y nada fallaba a la vista. Pasaba dentro de la propia compuerta | La API **se niega a levantar** con un rol superusuario o con `BYPASSRLS` |
| H-17 | **La salvaguarda de menores no llegaba por la API** | Quedaban dos `registrar_checkin` vivas: la vieja (5 argumentos) y la endurecida (6). **La API llamaba con cinco.** Por la aplicación se podía entregar a un niño sin figurar como acudiente, y una sala con un solo adulto recibía sin decir nada. El banco probaba una puerta y el producto entraba por la otra | Se tumbó la sobrecarga vieja y la API llama a la endurecida |
| H-18 | **El check-in reventaba un domingo por una salida de la semana anterior** | Un ingreso que se quedó abierto hacía que el del domingo siguiente chocara con el índice único: error en crudo, en la pantalla, a las nueve, con la fila de padres | El ingreso abierto **se cierra dejando dicho por qué**. El modelo pasa a tres estados: abierto · entregado · cerrado por el sistema |
| H-19 | **El procedimiento de rotar la llave N4 destruía los datos** | El RUNBOOK decía que no hacía falta recifrar. El sistema cifra con **una** llave simétrica sin versión: rotar sin recifrar deja ilegibles los códigos de entrega de los menores, y si se destruye la versión anterior en KMS, para siempre | `plataforma.recifrar_n4()` + `scripts/rotar-llave-n4.sh`, probado de ida y vuelta, y el guion se planta si queda una fila ilegible |
| H-20 | **El estado de Terraform iba a quedar en un portátil** | El `backend "gcs"` estaba comentado. Dos personas aplicando se pisan, no hay bloqueo, y perder el portátil es perder el mapa de la nube | Backend parcial activo: el bucket se pasa en el `init` |
| H-21 | **Nadie se enteraba de una caída completa** | Todas las alertas viven dentro del proyecto que vigilan. Y la sonda de arranque de Cloud Run era TCP: puerto abierto bastaba, aunque la base estuviera caída | Sonda **externa** de disponibilidad con su alerta, y sondas de arranque y de vida contra `/salud` |
| H-22 | **El domingo se podía desplegar, y sin copia previa** | Un push a `main` llegaba a producción cualquier día, y las migraciones corrían sin una copia hecha a propósito | Freno de domingo con escape explícito y registrado, y copia bajo demanda etiquetada con el build, antes de migrar |
| H-24 | **Los derechos del titular no tenían ni una ruta** | La Ley 1581 estaba implementada en la base desde la 0053 (plazos en días hábiles, prórroga con motivo, supresión real) y solo se podía ejercer con `psql`. Un derecho que solo ejerce quien sabe SQL no es un derecho, y ante la Superintendencia «está en la base» no es una respuesta | Ocho rutas (`/api/v1/cumplimiento`), la bandeja avisa de las vencidas y responder dice si fue fuera de plazo |
| H-25 | **Revocar el consentimiento fallaba entero desde la API** | `revocar_consentimiento` cancela lo ya encolado y la aplicación solo tiene `SELECT` sobre esa cola: la revocación no se registraba y el correo salía igual. Y revocaba TODO, también lo que se apoya en contrato u obligación legal, que la ley no deja renunciar | `SECURITY DEFINER` con la comprobación de alcance por dentro, y solo revoca lo revocable (migración 0058) |
| H-26 | **El volcado del modelo 100p ignoraba el nivel** | `GET /modelo100p/<tabla>` devuelve `SELECT *`: todas las columnas, incluidas salud, menores y consejería. La RLS acotaba la sede y **nadie acotaba la sensibilidad**: una sesión N1 podía pedir `/modelo100p/menores` y llevarse el volcado de su sede | Cada tabla exige el nivel de su columna más sensible, que lo dice la base y no una lista escrita a mano |
| H-23 | **Las conexiones no daban para el domingo** | 10 de negocio y 5 de autenticación por instancia; la puerta era más angosta que la casa. Con 36 sedes a la vez las peticiones no fallan: **se encolan**, justo en la pantalla de check-in | Los pozos salen de la tabla de fases, igual que el número de instancias, y Cloud SQL declara `max_connections` con la misma cuenta. La API avisa al arrancar cuántas instancias caben |

**Y cuatro pruebas que habían dejado de probar lo que decían** (una sala sembrada compartida, un
líder elegido con `LIMIT 1` sin orden, una invariante que registraba `ACEPTADO` sin mirar nada y
otra que dependía de cómo quedó la semilla). Todas pasaban en base nueva y fallaban en base
usada, que es la peor clase de prueba: la que da confianza sin darla.

## 3 · Cómo se opera

Todo está en **`docs/RUNBOOK.md`**, escrito para que lo siga alguien que no construyó esto. Los cinco comandos que hay que conocer:

```bash
cd backend
./scripts/arrancar.sh    # levanta la base local
./scripts/migrar.sh      # recrea desde cero
./scripts/probar.sh      # 16 bancos, 219 invariantes
./scripts/verificar.sh   # LA COMPUERTA: once verificaciones
./scripts/desplegar.sh staging
```

## 4 · Credenciales y accesos

**Nada de esto va por correo ni por mensaje.** Se entrega por canal seguro y a nombre de la **organización**, no de una persona:

| Qué | A quién | Canal |
|---|---|---|
| Proyecto de Google Cloud | Dirección de Tecnología | Invitación a la cuenta de la organización |
| Repositorio `100p-NANO/ecosistema-cr` | Jhon (`jhonchavez-creator`) | Invitación de GitHub |
| Secretos de producción | Nadie los ve: viven en Secret Manager | Acceso por rol, no por persona |
| Llave de cifrado N4 | Nadie la ve: vive en Cloud KMS | Rol de la aplicación |
| Correo del proyecto | `100p@casaroca.org` | Ya asignado |

## 5 · Lo que falta, en orden

**Ola 1 · para que exista en producción (media jornada, necesita las llaves de GCP)**
1. Crear `casaroca-staging` y `casaroca-prod` con facturación, en la región que decida la mesa.
2. `terraform apply` sobre staging y contrastar con `docs/INFRA.md`.
3. Cargar los secretos y envolver la llave N4 con KMS.
4. Primer despliegue (Cloud Build construye, prueba y sube API, migrador y frontend), prueba de carga contra staging, despliegue a producción.

**Ola 2 · para entregar a las sedes**
5. Sede piloto dos domingos, con la **exportación real de 99-o** de esa sede migrada, conciliada y corrida en paralelo.
6. **Prueba de intrusión externa** sobre la infraestructura aplicada.
7. Documentos legales con los datos del Responsable, revisados por abogado, y el registro ante la SIC si la iglesia está obligada.
8. La mesa ratifica en la consola, con acta, los permisos propuestos para los módulos nuevos.
9. Prueba automática de accesibilidad y en teléfonos reales.

**Ola 3 · para que sobreviva**
10. **Una persona entrenada por sede**, con las guías de `docs/guias/`.
11. Mesa de ayuda con horario y tiempo de respuesta.
12. **Bus factor:** hoy es 1. Al menos una persona más tiene que poder levantar esto (Jhon: aceptar la invitación al repositorio antes del 25 de septiembre).

## 6 · Decisiones que esperan a la mesa (o a Daniel)

1. **Alcance y precio firmados**, y qué módulos entran en la primera ola y si el portal va desde el inicio.
2. **Quién es el Responsable del Tratamiento** ante la ley (la corporación central o cada iglesia), con razón social y NIT.
3. **Facturación y región de Google Cloud.** São Paulo cuesta ~575.000 COP/mes más que `us-east1` y depende de la residencia de datos.
4. **La exportación de 99-o, el mapa de las 36 iglesias y la fecha de fin del contrato**: sin eso no hay cronograma honesto de migración.
5. **Quién asume el RPO de 15 minutos** y quién aprueba los traslados entre sedes (`ADR-002`).
6. **Qué inteligencia artificial y cuándo** (`ADR-005`): hoy no hay ninguna, a propósito.
7. **PayU** (cuenta de la iglesia) y los **certificados de donación** con su firma, y el **DNS de casaroca.org** para la API y la aplicación.
8. **Sede piloto** (propuesta: Chía) y quién la acompaña.
9. **La cifra de costo que se presenta**: la fase 2 de la nube cuesta 526 USD al mes (unos 2,1 millones de COP), no 1,5 millones como dice el documento de retorno (`docs/ECONOMIA.md`).

## 7 · La advertencia que sigue vigente

Esto certifica que **lo diseñado** cubre los controles y que **lo construido** pasa 265 invariantes de base, 22 pruebas de autenticación, 52 de la API, 135 conectores entre pantalla y base, un ensayo de migración de 25.000 personas y una restauración medida. **No certifica que lo desplegado los cumpla en producción**, porque todavía no hay producción. Eso lo certifica la prueba de intrusión externa, sobre la infraestructura aplicada.
