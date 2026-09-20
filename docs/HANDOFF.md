# HANDOFF · CasaRoca System AI
### Lo que se entrega, cómo se opera y qué falta

> 19 de septiembre de 2026 · Para la mesa (Ps. Carlos Ricardo), desarrollo (Jhon) y calidad (Manuel).

---

## 1 · La tabla de tres columnas, sin suavizarla

| Columna | Estado | Evidencia |
|---|---|---|
| **Backend · datos** | ✅ | 49 migraciones + 21 semillas, aplicadas desde cero en máquina limpia · **14 bancos, 176 invariantes en verde** · `scripts/probar.sh` |
| **Backend · API** | ✅ | Autenticación real con segundo factor · **19 pruebas de punta a punta** · `openapi.yaml` generado con 50 rutas, todas descritas · validación, límite de peticiones, cabeceras, traza y `/salud` |
| **Frontend** | 🟠 | Aplicación real con entrada, segundo factor, navegación **por permiso**, búsqueda, check-in **sin conexión** y consola de catálogos. Verificada en navegador, móvil y escritorio, contraste AA medido. Faltan las pantallas de Aportes, Consejería, Formación y Analítica |
| **Infraestructura** | 🔴 | 21 archivos de Terraform **escritos y sin aplicar**. Copia y **restauración ejecutadas de verdad** (`backend/docs/EVIDENCIA-restauracion.txt`), integración continua escrita, nueve compuertas en `scripts/verificar.sh`. **Falta crear los proyectos de GCP y aplicar** |

**Cómo se dice en la mesa:** el modelo de datos y la API están listos para producción. El frontend cubre el núcleo y le faltan cuatro módulos. **La infraestructura está escrita y no aplicada, así que el sistema todavía no está en producción**, y eso no se suaviza: lo que falta es media jornada de trabajo con las llaves de Google Cloud en la mano.

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

## 3 · Cómo se opera

Todo está en **`docs/RUNBOOK.md`**, escrito para que lo siga alguien que no construyó esto. Los cinco comandos que hay que conocer:

```bash
cd backend
./scripts/arrancar.sh    # levanta la base local
./scripts/migrar.sh      # recrea desde cero
./scripts/probar.sh      # 14 bancos, 176 invariantes
./scripts/verificar.sh   # LA COMPUERTA: nueve verificaciones
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
1. Crear `casaroca-staging` y `casaroca-prod` con facturación.
2. `terraform apply` sobre staging y contrastar con `docs/INFRA.md`.
3. Cargar los secretos y envolver la llave N4 con KMS.
4. Primer despliegue, prueba de carga contra staging, despliegue a producción.

**Ola 2 · para que se pueda entregar a las 36 sedes**
5. Las cuatro pantallas que faltan (Aportes, Consejería, Formación, Analítica).
6. Cablear las cuatro alertas que ya tienen su vista en la base.
7. **Prueba de intrusión externa** (compuerta G5). Lo diseñado cubre los controles; esto certifica lo construido.
8. Registro de las bases ante la SIC y publicación del aviso de privacidad.

**Ola 3 · para que sobreviva**
9. Capacitación con **una persona entrenada por sede**.
10. Mesa de ayuda con horario y tiempo de respuesta.
11. **Bus factor:** hoy es 1. Al menos una persona más tiene que poder levantar esto.

## 6 · Decisiones que esperan a la mesa

1. **Región de la nube.** São Paulo cuesta ~575.000 COP/mes más que `us-east1` y depende de la cláusula de residencia de datos.
2. **Traslados** (`docs/DECISIONES/ADR-002`): ¿quién aprueba, el pastor que recibe o el que entrega? ¿La consejería viaja con la persona? La recomendación técnica es que **no viaje** sin consentimiento nuevo.
3. **Quién es el Responsable del Tratamiento** ante la ley: la corporación central o cada iglesia. Cambia el modelo de consentimiento completo.
4. **Quién asume el RPO de 15 minutos.** Es una decisión de la mesa, no del ingeniero.

## 7 · La advertencia que sigue vigente

Esto certifica que **lo diseñado** cubre los controles y que **lo construido** pasa 176 invariantes de base, 19 pruebas de autenticación y una prueba de carga. **No certifica que lo desplegado los cumpla en producción**, porque todavía no hay producción. Eso lo certifica la prueba de intrusión externa de la compuerta G5, sobre la infraestructura aplicada.
