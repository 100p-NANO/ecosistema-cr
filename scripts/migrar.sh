#!/usr/bin/env bash
# Aplica todas las migraciones en orden sobre una base LIMPIA de desarrollo.
# Producción usa el mismo directorio, aplicado por el migrador con control de versión.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

psql -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS $PGDATABASE;" 
psql -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE $PGDATABASE;"

for f in "$RAIZ"/db/migrations/*.sql; do
  printf '  → %s\n' "$(basename "$f")"
  psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q -f "$f"
done
for f in "$RAIZ"/db/seeds/*.sql; do
  printf '  → seed %s\n' "$(basename "$f")"
  psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q -f "$f"
done
# Rol de conexión de la API. SOLO desarrollo (ver db/dev/rol_login_dev.sql).
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q -f "$RAIZ/db/dev/rol_login_dev.sql"

echo "migraciones aplicadas sobre $PGDATABASE"
