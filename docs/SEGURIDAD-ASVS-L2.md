# Seguridad · OWASP ASVS 4.0.3, nivel 2

> Estado al 21 de septiembre de 2026. Cada fila dice qué está construido y **dónde está la prueba**. Lo que falta se dice con su motivo; nada se marca verde por intención.
> Leyenda: ✅ construido y probado · 🟠 construido con un hueco escrito · 🔴 no existe todavía · N/A no aplica, con motivo.

## Resumen

| Capítulo | Estado | En una línea |
|---|---|---|
| V1 Arquitectura | 🟠 | Modelo de amenazas escrito por hallazgos de auditoría; falta el diagrama de flujo de datos firmado con la iglesia. |
| V2 Autenticación | ✅ | scrypt, 12 caracteres mínimo, segundo factor obligatorio para quien alcanza datos sensibles, bloqueo por intentos y límite por dirección. |
| V3 Sesiones | ✅ | La sesión vive en la base: cerrar surte efecto al instante. Acceso de 30 minutos, renovación de 12 horas. |
| V4 Control de acceso | ✅ | Doble cerradura: permiso por módulo y acción en la API y seguridad por fila en la base. Tablas nacen cerradas. |
| V5 Validación y codificación | ✅ | Validación declarada en cada ruta; SQL siempre con parámetros; todo texto escapado al pintarse. |
| V6 Criptografía almacenada | 🟠 | Secretos cifrados por columna con llave rotable; el cifrado en reposo con KMS está escrito en Terraform y sin aplicar. |
| V7 Errores y registros | ✅ | Errores en castellano sin estructura interna, identificador de petición, auditoría de escritura y bitácora de lectura N3 y N4. |
| V8 Protección de datos | ✅ | Clasificación por columna, lectura sensible registrada, prohibido exportar menores, retención con purga y supresión del titular. |
| V9 Comunicaciones | 🟠 | HTTPS y HSTS en la API y el sitio; el TLS hacia Cloud SQL depende de aplicar la infraestructura. |
| V10 Código malicioso | ✅ | Dependencias sin vulnerabilidades conocidas (21 sep 2026), búsqueda de secretos en cada verificación y antes de cada commit. |
| V11 Lógica de negocio | ✅ | Cuatro ojos donde la acción es grave, máquinas de estado en la base, límites en formularios públicos. |
| V12 Archivos | N/A | La aplicación no recibe archivos. Si llega un módulo que los reciba, este capítulo se abre. |
| V13 API | ✅ | Contrato OpenAPI generado y comparado en cada verificación (197 rutas), CORS con lista blanca, solo JSON con tamaño máximo. |
| V14 Configuración | 🟠 | Cabeceras de seguridad en API y sitio, imágenes reproducibles, Node fijado; secretos en Secret Manager escritos y sin aplicar. |

**Lo que falta para declarar nivel 2 completo:** aplicar la infraestructura (KMS, Secret Manager, TLS a Cloud SQL), y una **prueba de intrusión externa** antes de salir a producción (caja 7, punto 13). Las dos dependen de la facturación de Google Cloud.

## Detalle con evidencia

### V2 · Autenticación
| Requisito | Estado | Evidencia |
|---|---|---|
| 2.1.1 Contraseña de al menos 12 caracteres | ✅ | `backend/api/src/auth/clave.ts` (mensaje: «Una frase que recuerde sirve mejor que un jeroglífico») |
| 2.1.7 Contraseñas filtradas | 🟠 | No se consulta una lista de contraseñas filtradas. Mitigado por el mínimo de 12 y el segundo factor. |
| 2.2.1 Freno a la fuerza bruta | ✅ | Bloqueo de la cuenta por intentos (`bloqueada_hasta`) y 10 intentos por dirección cada 5 minutos; alerta `fuerza_bruta` en Terraform |
| 2.4.1 Derivación resistente | ✅ | scrypt (memoria dura) con sal por cuenta, comparación en tiempo constante |
| 2.7/2.8 Segundo factor | ✅ | TOTP obligatorio para cuentas que lo exigen; el refresco de un acceso limitado no lo salta (`auth.e2e`, prueba 22) |

### V3 · Sesiones
| Requisito | Estado | Evidencia |
|---|---|---|
| 3.3.1 Cerrar sesión la invalida | ✅ | Cada petición pregunta a la base si la sesión sigue viva; `auth.e2e` |
| 3.3.2 Expiración | ✅ | Acceso 30 min, renovación 12 h, rotación en cada renovación |
| 3.4 Almacenamiento del token | 🟠 | `sessionStorage` (muere con la pestaña), no cookie `HttpOnly`. Mitigado por la política de contenido sin scripts en línea. |

### V4 · Control de acceso
| Requisito | Estado | Evidencia |
|---|---|---|
| 4.1.1 Se aplica en el servidor | ✅ | `identidad.puede` en cada acción; políticas por fila en cada tabla; `db/tests/aislamiento_rls.sql`, `rls_tablas_hijas.sql` |
| 4.1.3 Mínimo privilegio | ✅ | Tablas nacen cerradas (migración 0023) y se publican con justificación (`registro_exposicion`). En la ficha de una persona, los campos por encima del nivel de la sesión no se devuelven ni se escriben (`clasificacion_columna`) |
| 4.2.1 Referencias directas inseguras | ✅ | Una ficha de otra sede responde 404, y dentro de la sede la ficha se abre por ALCANCE (grupo, segmento, ministerio, caso, acudiente): `identidad.alcanza_persona`, banco `alcance_persona.sql` (22 casos). Hasta el 21 de septiembre un líder de grupo abría cualquier ficha de su sede. Bancos de conectores (98 y 48 comprobaciones) |
| 4.3.1 Segundo factor para administrar | ✅ | Roles de administración con segundo factor obligatorio |

### V5 · Validación
| Requisito | Estado | Evidencia |
|---|---|---|
| 5.1.3 Validación de entrada | ✅ | `backend/api/src/comun/validar.ts` en cada ruta; listas cerradas desde catálogos |
| 5.3 Codificación de salida | ✅ | `esc()` en todo HTML del frontend y de los correos |
| 5.3.4 Inyección SQL | ✅ | Solo consultas con parámetros; las funciones con SQL dinámico usan `format('%I', …)` |

### V7 · Errores y registros
| Requisito | Estado | Evidencia |
|---|---|---|
| 7.1 Qué se registra | ✅ | `plataforma.auditoria` (quién, qué campos, motivo) y `plataforma.bitacora_lectura` para N3 y N4 |
| 7.4.1 Errores sin detalles internos | ✅ | `comun/errores.ts`: la jerga del motor nunca sale; reglas con nombre traducidas |

### V8 · Protección de datos
| Requisito | Estado | Evidencia |
|---|---|---|
| 8.1 Clasificación | ✅ | `plataforma.clasificacion_columna` con nivel y mecanismo por columna |
| 8.3.4 Datos sensibles identificados y con control | ✅ | Lecturas N3 y N4 registradas; exportar datos de menores prohibido en la base |
| 8.3.2 Borrado a pedido del titular | ✅ | `plataforma.ejecutar_supresion` y el portal del congregante (`/api/v1/yo`) |
| 8.3.8 Retención | ✅ | `plataforma.purgar_por_retencion`, corregida el 21 sep 2026 para que ninguna política quede sin aplicar |

### V10 · Código malicioso y dependencias
| Requisito | Estado | Evidencia |
|---|---|---|
| 10.3.2 Dependencias sin vulnerabilidades conocidas | ✅ | `npm audit`: 0 vulnerabilidades tras subir Nest a la versión 12 (21 sep 2026) |
| Secretos fuera del repositorio | ✅ | `backend/scripts/buscar-secretos.py` en la compuerta 6 y en el gancho `.githooks/pre-commit` |

### V13 · API
| Requisito | Estado | Evidencia |
|---|---|---|
| 13.1.3 Contrato | ✅ | `backend/api/openapi.yaml`, generado desde las rutas reales y comparado en la compuerta 5 |
| 13.2.6 CORS | ✅ | Lista blanca por variable (`CORS_ORIGENES`), nunca asterisco |
| 13.1.4 Tamaño máximo | ✅ | 413 con mensaje en castellano |

### V14 · Configuración
| Requisito | Estado | Evidencia |
|---|---|---|
| 14.4 Cabeceras | ✅ | API: `comun/peticion.ts`. Sitio: `frontend/cabeceras-seguridad.conf`, incluido en cada bloque de nginx (21 sep 2026: antes el HTML salía sin ellas) |
| 14.2 Dependencias fijadas | ✅ | `package-lock.json`, Node 22 en `.nvmrc`, `engines` y la imagen |
| 14.1 Secretos del servidor | 🟠 | Secret Manager escrito en `infra/gcp/secretos.tf`, sin aplicar |
