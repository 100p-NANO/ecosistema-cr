# INFRA · Inventario de recursos
### Qué corre dónde, con qué identificador y cuánto cuesta

> 19 de septiembre de 2026 · **Documento vivo.** Si un recurso no está aquí, no existe para la operación: nadie sabe que hay que pagarlo, vigilarlo ni apagarlo.
> ⛔ **Estado: la infraestructura está ESCRITA y NO APLICADA.** Ver «Estado real» al final.

---

## 1 · Ambientes

| Ambiente | Para qué | Proyecto GCP | Estado |
|---|---|---|---|
| `desarrollo` | El portátil de quien construye | ninguno (PostgreSQL local, puerto 5433) | ✅ funciona |
| `staging` | Igual que producción, con datos sintéticos | `casaroca-staging` | 🔴 sin crear |
| `produccion` | La red real | `casaroca-prod` | 🔴 sin crear |

**⛔ «Staging es producción» no es un ambiente.** Los tres son reales y separados, con secretos distintos y sin una sola persona real fuera de producción.

## 2 · Recursos declarados en Terraform (`infra/gcp/`)

| Recurso | Nombre en Terraform | Para qué | USD/mes |
|---|---|---|---|
| Cloud SQL PostgreSQL 16 | `google_sql_database_instance` | La base. RLS, auditoría, particiones | ~200 |
| Cloud Run · API | `run.tf` | La API NestJS | ~85 |
| Cloud Run · Frontend | `run.tf` | El sitio | ~25 |
| Cloud Run · Keycloak | `run.tf` | Proveedor de identidad (camino de producción) | ~40 |
| Memorystore Redis | `google_redis_instance.cache` | Colas y caché | ~45 |
| Balanceador HTTPS | `google_compute_*` | TLS, dominio, redirección 301 | ~25 |
| Cloud Armor | `google_compute_security_policy.armor` | Cortafuegos de aplicación | ~20 |
| Cloud KMS | `google_kms_crypto_key.datos` | **La llave que cifra los datos N4** | ~1 |
| Secret Manager | `google_secret_manager_secret.s` | Contraseñas, secretos, llaves de terceros | ~2 |
| Artifact Registry | `google_artifact_registry_repository.imagenes` | Imágenes de contenedor | ~5 |
| Cloud Build | `google_cloudbuild_trigger.main` | Construcción y despliegue | ~10 |
| Logging | `google_logging_project_bucket_config` | Logs centralizados, 30 días | ~20 |
| Monitoreo y alertas | `google_monitoring_alert_policy.*` | CPU y disco de la base, fallo del migrador | ~10 |
| Presupuesto con alerta | `google_billing_budget.fase` | Aviso al 80 % y al 100 % | 0 |
| Red privada | `google_compute_network.privada` | La base sin IP pública | ~5 |
| **Total producción** | | | **~488** |
| **Preproducción** | | | **~18** |

**Total: 506 USD/mes ≈ 2.049.300 COP** a 4.050 COP/USD. Presupuesto aprobado con colchón: **2.500.000 COP/mes**.

**Decisión abierta:** región `us-east1` frente a São Paulo. São Paulo cuesta **~575.000 COP/mes más** y depende de la cláusula de residencia de datos.

## 3 · Alertas configuradas

| Alerta | Umbral | A dónde | Quién responde |
|---|---|---|---|
| CPU de Cloud SQL | > 80 % por 10 min | `correos_alertas` | Guardia de Sistemas |
| Disco de Cloud SQL | > 85 % | `correos_alertas` | Guardia de Sistemas |
| Fallo del migrador | cualquier fallo | `correos_alertas` | Quien desplegó |
| Presupuesto | 80 % y 100 % | Administrativa | Dirección Administrativa |
| **Particiones con hueco** | `v_salud_particiones` ≠ BIEN | 🔴 pendiente de cablear | Sistemas |
| **Fugas de lectura** | `v_control_rls` > 0 | 🔴 pendiente de cablear | Sistemas |
| **Peticiones de titular vencidas** | > 0 | 🔴 pendiente de cablear | Legal |
| **Antecedentes por vencer** | < 30 días | 🔴 pendiente de cablear | RocaKids Global |

Las cuatro últimas ya tienen su vista en la base; falta el trabajo de cablearlas al canal (`infra/gcp/observabilidad.tf`).

## 4 · Secretos y dónde viven

| Secreto | Dónde debe vivir | Hoy |
|---|---|---|
| `APP_LLAVE_N4` (cifra datos críticos) | **Cloud KMS**, envuelto | 🟠 variable de entorno; la aplicación **se niega a arrancar** en producción con un valor de desarrollo |
| `APP_JWT_SECRETO` | Secret Manager | 🟠 igual |
| Contraseña de la base | Secret Manager | 🔴 sin aplicar |
| Llave de la pasarela de pagos | Secret Manager | 🔴 sin aplicar |
| `CASAROCA_LLAVE_RESPALDO` | Secret Manager | 🔴 sin aplicar |

**⛔ Regla:** toda credencial recibida de un tercero se rota el mismo día.

## 5 · Copias de seguridad

| Qué | Cómo | Retención | Probado |
|---|---|---|---|
| Cloud SQL, copia continua | Automática, punto en el tiempo | 7 días | 🔴 sin aplicar |
| Copia lógica diaria | `scripts/respaldar.sh`, cifrada | 30 días | ✅ ejecutada |
| **Restauración** | `scripts/restaurar.sh` | | ✅ **ejecutada el 19 sep 2026** · ver `backend/docs/EVIDENCIA-restauracion.txt` |

## 6 · Dominios y TLS

| Dominio | A dónde | Estado |
|---|---|---|
| `api.casaroca.org` | Cloud Run · API | 🔴 sin crear |
| `app.casaroca.org` | Cloud Run · Frontend | 🔴 sin crear |
| `casaroca-system.netlify.app` | El sitio actual | ✅ en línea |

Certificado gestionado por Google, política TLS moderna, HSTS y redirección 301 desde HTTP.

## 7 · Estado real, sin suavizarlo

**Lo que está listo:** 21 archivos de Terraform con la infraestructura completa, una prueba de Terraform (`infra/gcp/tests/fases.tftest.hcl`), integración continua escrita, y los scripts de copia, restauración, despliegue y verificación **probados en local**.

**Lo que falta, y es trabajo de una tarde con las llaves en la mano:**
1. Crear los proyectos de GCP (`casaroca-staging` y `casaroca-prod`) y habilitar la facturación. **Lo hace Daniel o la mesa: exige una cuenta de facturación.**
2. `terraform apply` sobre staging y comprobar `docs/INFRA.md` contra lo creado.
3. Cargar los secretos en Secret Manager y envolver la llave N4 con KMS.
4. Apuntar los dominios.
5. Cablear las cuatro alertas que faltan.
6. Primer despliegue a staging, corrida de carga y luego producción.

**Los dos bloqueos que `infra/gcp/README.md` declaraba como impedimentos para producción quedaron cerrados el 19 de septiembre de 2026:**
- «La API no puede abrirse a internet: toma la identidad de la cabecera `X-Persona-Id`» → **cerrado**, hay autenticación real con token, sesión revocable y segundo factor obligatorio para N3 y N4, con 19 pruebas de punta a punta.
- «Seis catálogos quedan vacíos con las semillas de producción» → **cerrado**, los cinco catálogos bloqueantes están sembrados (seed 019) y hay una prueba que falla si alguno vuelve a quedar vacío.

Con esos dos cerrados, `api_publica = true` deja de estar prohibido. Lo que queda antes de abrirla es la prueba de intrusión externa de la compuerta G5.
