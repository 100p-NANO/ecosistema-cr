#!/usr/bin/env bash
# Corre el banco de invariantes. Salida distinta de 0 si algo falla.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/invariantes.sql"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/aislamiento_rls.sql"
