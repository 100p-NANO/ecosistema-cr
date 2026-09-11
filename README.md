# CasaRoca System · Ecosistema

Todo el proyecto **Sistema 100p** en un solo repositorio: la base de datos que corre, la API
sobre el contrato de los módulos, el prototipo navegable y el sitio desplegado.

Hasta ahora esto vivía en tres carpetas sueltas y en documentos de Drive. Aquí está junto y,
sobre todo, **revisable línea por línea** — que es lo que pidió el CTO.

```
backend/           Fase 1 · PostgreSQL 16 · 32 migraciones SQL + 89 pruebas + API NestJS
fase0-prototipo/   El prototipo navegable: ~26.000 líneas de JS sin framework, 127 archivos
web/               El sitio unificado que hoy está desplegado en Netlify
```

## Por dónde empezar según quién seas

| Si eres… | Abre esto primero |
|---|---|
| **Jhon** (desarrollo e infraestructura) | `backend/db/migrations/` — las 31 migraciones en orden, y `backend/db/tests/` |
| **Manuel** (testing y calidad) | `backend/db/tests/` — los 5 bancos de invariantes, y `backend/docs/EVIDENCIA-pruebas.txt` |
| **Ps. Carlos Ricardo** (gerencia) | `backend/entregas-drive/` — los documentos de arquitectura, modelo financiero y plan |

## Cómo se corre la base de datos (3 comandos, sin nube ni Docker)

```bash
cd backend
./scripts/arrancar.sh    # PostgreSQL 16 local en el puerto 5433
./scripts/migrar.sh      # recrea casaroca_dev: 32 migraciones + seeds
./scripts/probar.sh      # 89 pruebas
```

Última corrida verificada: **11 de septiembre de 2026 · 32 migraciones limpias · 89/89 en verde.**

## Qué está demostrado, no solo diseñado

Cada garantía del diseño tiene una prueba que falla si alguien la rompe:

- **Aislamiento entre sedes.** RLS más contexto por transacción. Las pruebas corren como
  `casaroca_app`, no como superusuario — probarlo como superusuario no demuestra nada.
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
2. **La aplicación podía subirse su propio techo.** Con `app.nivel_max=1` —el nivel más
   bajo— el rol de la API reescribió las 173 filas de `sistema.matriz_permisos`
   poniéndose `nivel_max=4`.

Ambos están cerrados, cada uno con su prueba, y queda una vista de control
(`plataforma.v_control_rls`) que deja a la vista cualquier tabla futura que nazca legible
sin una sola política. Es el mismo patrón que la fuga de las vistas de agosto: el control
se había puesto donde se estaba mirando, no donde estaban todos los datos.

## Lo que está abierto y necesita decisión de la mesa

1. **`personas` sin `sede_id`.** En el modelo v1.1 del equipo no existe esa columna. Sin ella
   no hay multi-tenancy ni RLS posible para las 36 sedes. Está detallado, con la corrección ya
   implementada, en `backend/entregas-drive/01-Estructura-Datos/DIVERGENCIAS-Y-CORRECCIONES.md`.
2. **Región de GCP.** São Paulo en vez de `us-east1` cuesta unos 575.000 COP/mes más. Depende
   de la cláusula de residencia de datos. Ver `backend/entregas-drive/04-Infraestructura-Operacion/`.
3. **La llave de cifrado.** En desarrollo viene de un GUC. **En producción debe venir del KMS**,
   nunca del código ni de una tabla de la propia base.

## Advertencia que sigue vigente

Esto certifica que **lo diseñado** cubre los controles. No certifica que lo construido los
cumpla en producción: eso lo verifica la prueba de intrusión externa de la compuerta G5.
