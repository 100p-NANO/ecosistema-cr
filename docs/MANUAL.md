# El Manual Maestro aplicado a CasaRoca System

> La ruta completa de `D-Tech/Estandar/MANUAL-MAESTRO-AIVOR.md` (7 tramos, 60 estaciones, 7 compuertas), marcada contra lo que existe el **21 de septiembre de 2026**.
> ✅ hecho con evidencia · 🟠 hecho con un hueco escrito · 🔴 no existe · N/A no aplica, con motivo.
> Regla del manual: una compuerta no se pasa sin evidencia; la excepción se escribe en `docs/DECISIONES/`.

## Las siete compuertas

| Compuerta | Estado | Qué la detiene |
|---|---|---|
| **A** · Antes de prometer | 🟠 | Alcance y precio sin firmar |
| **B** · Cimientos | 🟠 | Infraestructura escrita y probada, sin aplicar (falta la facturación de Google Cloud) |
| **C** · El núcleo | ✅ | Datos, identidad, permisos, API y migraciones con pruebas en verde |
| **D** · El sistema | 🟠 | Cuenta de PayU, dominio de correo verificado y prueba de carga contra staging |
| **E** · La cara | 🟠 | Prueba automática de accesibilidad, teléfonos reales y cinco usuarios reales |
| **F** · La confianza | 🔴 | Prueba de intrusión externa y documentos legales vigentes |
| **G** · La vida del sistema | 🔴 | Sede piloto, migración real, personas entrenadas y mesa de ayuda |

## Tramo 0 · Antes de prometer nada

| # | Estación | Estado | Evidencia · qué falta |
|---|---|---|---|
| 1 | Descubrimiento y encuadre | ✅ | `docs/ARQUITECTURA.md`; auditoría de 99-o (13 módulos, costo actual) |
| 2 | Alcance, contrato y criterios | 🟠 | `docs/CHECKLIST-CREACION.md` · falta firmar alcance y precio |

## Tramo 1 · Cimientos

| # | Estación | Estado | Evidencia · qué falta |
|---|---|---|---|
| 3 | Arquitectura y decisiones | ✅ | `docs/ARQUITECTURA.md` y seis decisiones en `docs/DECISIONES/` |
| 4 | Entorno de trabajo | ✅ | Cinco scripts, `.nvmrc`, gancho de pre-commit, README por rol |
| 5 | Red y perímetro | 🟠 | Balanceador, Cloud Armor e ingreso restringido en Terraform · sin aplicar |
| 6 | Cómputo y ejecución | 🟠 | Imágenes de API, migrador y frontend; Cloud Build construye y prueba · sin desplegar |
| 7 | Secretos y configuración | 🟠 | `secretos.tf`, `config.js` de ejecución, búsqueda de secretos en cada verificación · Secret Manager sin aplicar |
| 8 | Infraestructura como código | 🟠 | Terraform válido, formateado y con 6 pruebas · sin aplicar |

## Tramo 2 · El núcleo

| # | Estación | Estado | Evidencia · qué falta |
|---|---|---|---|
| 9 | Base de datos en producción | 🟠 | Conexiones calculadas por fase (la prueba de Terraform lo exige), seguridad por fila · Cloud SQL sin crear |
| 10 | Modelo de datos y gobierno | ✅ | Linaje en las tablas que reciben migración, clasificación por columna, catálogos editables, retención aplicada |
| 11 | Tenencia, identidad y permisos | ✅ | Sede en toda tabla, identidad única, permiso por módulo y acción, tablas que nacen cerradas |
| 12 | Autenticación | ✅ | scrypt, segundo factor, bloqueo por intentos; 22 pruebas |
| 13 | Sesión y tokens | ✅ | Sesión viva en la base, acceso 30 min, renovación 12 h |
| 14 | Autorización y tenencia en el código | ✅ | Doble cerradura; 98 + 37 conectores que preguntan a la base |
| 15 | Migraciones sin caída | 🟠 | 77 migraciones desde cero en cada verificación; regla de agregar, usar y quitar escrita en el RUNBOOK · no ensayado contra producción |
| 16 | Esqueleto del backend | ✅ | NestJS 12 por módulos, `/salud`, arranque que se niega con un rol que salte la seguridad por fila |
| 17 | Contrato de API | ✅ | 197 rutas en `openapi.yaml`, generado y comparado en cada verificación |
| 18 | Persistencia y transacciones | ✅ | Contexto por transacción, idempotencia en el check-in y en la migración |
| 19 | Archivos | N/A | La aplicación no recibe archivos |

## Tramo 3 · El sistema

| # | Estación | Estado | Evidencia · qué falta |
|---|---|---|---|
| 20 | Trabajo asíncrono | 🟠 | Bandeja de salida con reintentos, muertos y reproceso · los trabajadores programados están escritos para la fase 2 de Terraform; hasta entonces la purga y las particiones se corren a mano |
| 21 | Idempotencia y resiliencia | ✅ | Tiempo de espera, clasificación y cortacircuitos en toda llamada a terceros (10 pruebas) |
| 22 | Caché | 🟠 | Redis escrito en Terraform para las fases 1 y 2; la API todavía no lo usa · decidirlo con la prueba de carga contra staging |
| 23 | Integraciones salientes | ✅ | SendGrid y reCAPTCHA por un solo cliente con cortacircuitos |
| 24 | Entradas: webhooks | ✅ | Webhook de PayU con firma comparada en tiempo constante |
| 25 | Eventos y ecosistema | 🟠 | Línea de tiempo común de la persona entre módulos · falta integrar las otras aplicaciones de la iglesia |
| 26 | Correo | 🟠 | Plantillas y envío con cola · falta verificar el dominio de correo (DNS de casaroca.org) |
| 27 | Mensajería y avisos | ✅ | Comunicaciones con cuatro ojos, freno y consentimiento por persona |
| 28 | Pagos | 🟠 | Aportes, confirmación a dos manos, certificados y webhook · falta la cuenta de PayU de la iglesia |
| 29 | Generación de documentos | ✅ | Certificado de donación imprimible, para Tesorería y para el titular |
| 30 | Búsqueda y filtros | ✅ | Búsqueda de personas tolerante a erratas y detección de duplicados, con banco |
| 31 | Auditoría y trazabilidad | ✅ | Quién escribió qué y con qué motivo; quién leyó datos sensibles |
| 32 | Reportería y analítica | ✅ | Tablero con supresión de cifras pequeñas y «quién se nos está perdiendo» |
| 33 | Inteligencia artificial | N/A | Diferida a la fase 3 con compuerta (`ADR-005`) |
| 34 | Rendimiento del backend | 🟠 | Prueba de carga local · falta contra staging |
| 35 | Observabilidad dentro del código | ✅ | Identificador por petición y señales del negocio en el registro |

## Tramo 4 · La cara

| # | Estación | Estado | Evidencia · qué falta |
|---|---|---|---|
| 36 | Esqueleto del frontend | ✅ | Módulos del navegador sin paso de construcción, carga diferida por pantalla |
| 37 | Estado y datos | ✅ | Cola sin conexión para el check-in de RocaKids |
| 38 | Formularios | ✅ | Kit común con validación, listas del catálogo y buscador de personas |
| 39 | Rutas, navegación y sesión | ✅ | Cada ficha con su dirección; menú contra lo que la base dice que la sesión alcanza |
| 40 | Sistema de diseño | ✅ | `docs/DISENO.md` y `ADR-004` |
| 41 | Estados, errores y vacíos | ✅ | Carga, vacío y error en toda pantalla; errores en castellano con código de petición |
| 42 | Accesibilidad | 🟠 | Contraste AA, teclado, lectores de pantalla en tablas · falta la prueba automática (axe) |
| 43 | Rendimiento del frontend | 🟠 | Carga diferida · falta medirlo en un teléfono de gama baja |
| 44 | Seguridad e idioma en el cliente | ✅ | Política de contenido sin scripts en línea, todo escapado, todo en castellano |
| 45 | Experiencia de uso y primer valor | 🟠 | Guías por rol · falta probar con cinco usuarios reales |
| 46 | Administración y soporte | ✅ | Consola del Sistema Master: accesos, auditoría, lecturas y avisos |

## Tramo 5 · La confianza

| # | Estación | Estado | Evidencia · qué falta |
|---|---|---|---|
| 47 | Seguridad aplicada | 🟠 | `docs/SEGURIDAD-ASVS-L2.md` · falta la prueba de intrusión externa |
| 48 | Pruebas | 🟠 | 19 bancos (265 invariantes), 135 conectores, extremo a extremo, ensayo de migración · falta automatizar el navegador |
| 49 | Canal de despliegue y entrega | 🟠 | `desplegar.sh`, Cloud Build, `revertir-despliegue.sh` · la CI de GitHub espera un permiso (`gh auth refresh -s workflow`) |
| 50 | Observabilidad de plataforma | 🟠 | Alertas de plataforma y del negocio en Terraform · sin aplicar |
| 51 | Respaldo y continuidad | ✅ | Restauración ejecutada y medida con el volumen de la red · el RPO lo asume la mesa |
| 52 | Costos de la nube | ✅ | `docs/ECONOMIA.md` y presupuesto con avisos en Terraform |
| 53 | Cumplimiento y evidencia | 🟠 | Ley 1581 construida en la base · documentos legales en borrador |

## Tramo 6 · La vida del sistema

| # | Estación | Estado | Evidencia · qué falta |
|---|---|---|---|
| 54 | Migración desde el sistema anterior | 🟠 | Canal completo y ensayado con 25.000 personas · falta la exportación real de 99-o |
| 55 | Adopción y gestión del cambio | 🔴 | Guías escritas · sin sede piloto ni personas entrenadas |
| 56 | Economía del producto | 🟠 | Costo por fase y por sede · precio sin firmar y una cifra por reconciliar |
| 57 | Verificación antes de «listo» | ✅ | `verificar.sh`: 16 compuertas en verde |
| 58 | Soporte, documentación y traspaso | 🟠 | HANDOFF, RUNBOOK y guías · falta la mesa de ayuda y una segunda persona que sepa operarlo |

## Apéndice

| # | Estación | Estado | Motivo |
|---|---|---|---|
| 59 | Tiempo real | N/A | Ningún flujo lo necesita; el check-in funciona con cola sin conexión |
| 60 | Aplicación móvil | N/A | Web móvil primero; no hace falta instalar nada |
