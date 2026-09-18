#!/usr/bin/env bash
# Corre el banco de invariantes. Salida distinta de 0 si algo falla.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/invariantes.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/aislamiento_rls.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/invariantes_modulos.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/consola_sistemas.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/empalme_100p.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/catalogos_no_vacios.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/rls_tablas_hijas.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/modelo_drive_100p.sql"
