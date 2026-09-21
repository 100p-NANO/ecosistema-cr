# CasaRoca System · Ecosistema

Todo el proyecto **Sistema 100p** en un solo repositorio: la base de datos que corre, la API
sobre el contrato de los módulos, el prototipo navegable y el sitio desplegado.

Hasta ahora esto vivía en tres carpetas sueltas y en documentos de Drive. Aquí está junto y,
sobre todo, **revisable línea por línea**, que es lo que pidió el CTO.

```
backend/           PostgreSQL 16 · 77 migraciones + 25 semillas + 19 bancos · API NestJS 12
frontend/          App de las sedes, consola del Sistema Master y portal «Mi iglesia»: móvil primero, sin paso de construcción
infra/gcp/         Terraform (16 archivos), validado y SIN aplicar
docs/              Arquitectura, infraestructura, runbook, entrega, seguridad (ASVS), economía, decisiones, legales (borrador) y guías por rol
fase0-prototipo/   El prototipo navegable: ~26.000 líneas de JS sin framework, 127 archivos
web/               El sitio unificado que hoy está desplegado en Netlify
```

**Por dónde empezar si llegas hoy:** `docs/HANDOFF.md` dice en qué estado está cada columna
(backend, frontend, infraestructura) sin suavizarlo; `docs/RUNBOOK.md`, qué hacer cuando algo se
rompe; y `docs/PUESTA-EN-MARCHA-GCP.md`, cómo se instala todo esto el día que exista la cuenta de
Google Cloud.

## Por dónde empezar según quién seas

| Si eres… | Abre esto primero |
|---|---|
| **Jhon** (desarrollo e infraestructura) | `backend/db/migrations/`: las 77 migraciones en orden, `infra/gcp/README.md` y `docs/PUESTA-EN-MARCHA-GCP.md` |
| **Manuel** (testing y calidad) | `backend/db/tests/`: los 19 bancos de invariantes, y `backend/scripts/verificar.sh`, que es la compuerta |
| **Ps. Carlos Ricardo** (gerencia) | `backend/entregas-drive/`: los documentos de arquitectura, modelo financiero y plan; `docs/ECONOMIA.md` y `docs/guias/` |

## Cómo se corre la base de datos (3 comandos, sin nube ni Docker)

```bash
cd backend
./scripts/arrancar.sh    # PostgreSQL 16 local en el puerto 5433
./scripts/migrar.sh      # recrea casaroca_dev: 77 migraciones + 25 semillas
./scripts/probar.sh      # 19 bancos, 265 invariantes
./scripts/verificar.sh   # LA COMPUERTA: diecisiete verificaciones, de la base a Terraform
```

Última corrida verificada: **21 de septiembre de 2026 · 77 migraciones limpias · 19 bancos, 265
invariantes · 22 pruebas de autenticación · 52 de la API · 98 conectores de la consola · 37 de los
módulos nuevos y el portal · ensayo de migración desde 99-o · Terraform válido y 6 pruebas ·
0 fugas de lectura · 0 vulnerabilidades en dependencias.**

## Qué está demostrado, no solo diseñado

Cada garantía del diseño tiene una prueba que falla si alguien la rompe:

- **Aislamiento entre sedes.** RLS más contexto por transacción. Las pruebas corren como
  `casaroca_app`, no como superusuario: probarlo como superusuario no demuestra nada.
- **Menores.** Un menor sin acudiente hace fallar la transacción. La entrega exige acudiente
  autorizado y código correcto, y el código va cifrado de verdad (nunca se devuelve).
- **Habeas Data (Ley 1581).** Consentimiento append-only con finalidad, canal, evidencia y
  fecha. Sin registro, `puede_contactar()` devuelve falso.
- **Aportes.** La reconciliación es aritmética: una vista dice si lo migrado cuadra al peso.
  Y el pastor congregacional ve hábito de aporte **sin ninguna columna de monto**.
- **Auditoría.** Append-only e inmutable, con bitácora de lectura sobre los datos sensibles.

## Lo que se corrigió el 11 de septiembre (migración `0031`)

Auditando la base **corriendo** aparecieron dos huecos que el banco de pruebas no veía,
porque probaba las tablas cabeza y no las hijas:

1. **16 tablas hijas sin RLS.** La sede de Chía, que no tiene una sola persona registrada,
   veía los certificados de aporte y las inscripciones de formación de Bogotá Chicó. Entre
   las tablas expuestas estaban las de RocaKids, que son las de los menores.
2. **La aplicación podía subirse su propio techo.** Con `app.nivel_max=1`, el nivel más
   bajo, el rol de la API reescribió las 173 filas de `sistema.matriz_permisos`
   poniéndose `nivel_max=4`.

Ambos están cerrados, cada uno con su prueba, y queda una vista de control
(`plataforma.v_control_rls`) que deja a la vista cualquier tabla futura que nazca legible
sin una sola política. Es el mismo patrón que la fuga de las vistas de agosto: el control
se había puesto donde se estaba mirando, no donde estaban todos los datos.

## Lo que está abierto y necesita decisión de la mesa

1. ✅ **`personas` sin `sede_id`**: **cerrado.** La columna existe y, desde el 19 de septiembre,
   además está `nucleo.membresias_sede` con vigencia: una persona puede pertenecer a una sede y
   servir en otra, y trasladarla ya no reescribe su pasado ni entrega su historia a la sede
   nueva. Este punto llevaba nueve días figurando como abierto sin estarlo.
2. **Región de GCP.** São Paulo en vez de `us-east1` cuesta unos 575.000 COP/mes más. Depende
   de la cláusula de residencia de datos. Ver `backend/entregas-drive/04-Infraestructura-Operacion/`.
3. **La llave de cifrado.** En desarrollo viene de un GUC. **En producción debe venir del KMS**,
   nunca del código ni de una tabla de la propia base.

## Advertencia que sigue vigente

Esto certifica que **lo diseñado** cubre los controles y que **lo construido** pasa la compuerta
completa. **No certifica que lo desplegado los cumpla en producción, porque todavía no hay
producción:** la infraestructura está escrita, validada y sin aplicar. Eso lo verifica la prueba
de intrusión externa de la compuerta G5, sobre la infraestructura ya aplicada.

**El frontend cubre ya los 22 módulos declarados:** 21 en la aplicación de las sedes y el de
organización en la consola del Sistema Master (que además lleva accesos, auditoría y avisos); y
aparte, el portal del congregante. Lo que falta, columna por columna, está en `docs/HANDOFF.md`.
