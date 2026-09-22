#!/usr/bin/env bash
# Revisión anti-slop (Oxlint + las reglas de dmmulroy/anti-slop) de la API, sus pruebas y las tres pantallas.
# Uso:  ./scripts/revisar-slop.sh            informe
#       ./scripts/revisar-slop.sh --fix      corrige lo mecánico (espaciado); revise el diff antes de confirmar
# ⛔ Todavía no es compuerta de verificar.sh: ver backend/api/tools/oxlint/anti-slop/UPSTREAM.md.
set -uo pipefail
cd "$(dirname "$0")/../.."
exec backend/api/node_modules/.bin/oxlint -c backend/api/.oxlintrc.json "$@" \
  backend/api/src backend/api/test frontend/src frontend/master frontend/portal
