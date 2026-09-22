# Skills y subagentes de terceros de este proyecto

Instalados a nivel de proyecto el 21 de septiembre de 2026, a pedido de Daniel («añade thermos y anti-slop
para que no me falle el código»). Revisados ANTES de instalar, como exige la regla de skills de Aivor:
sin comandos de red, sin `curl | sh`, sin acceso a secretos ni a variables de entorno.

| Qué | De dónde | Commit | Licencia | Qué contiene |
|---|---|---|---|---|
| `thermos`, `thermo-nuclear-review`, `thermo-nuclear-code-quality-review` (skills) y los dos subagentes en `.claude/agents/` | `github.com/cursor/plugins`, carpeta `thermos/` | `53e579f1481697931fc44f5445171397cfa2b24b` | MIT (Cursor) | Solo instrucciones en texto: revisión profunda de correctitud y seguridad de una rama, y revisión estricta de calidad de código; `thermos` lanza las dos en paralelo y une lo que encuentran |
| `install-anti-slop` (skill) | `github.com/dmmulroy/anti-slop`, carpeta `skills/install-anti-slop/` | `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` | MIT | La skill que instala y actualiza las reglas de Oxlint; su `install.mjs` solo copia archivos locales. Las reglas ya quedaron instaladas en `backend/api/tools/oxlint/anti-slop/` (ver su `UPSTREAM.md`) |

## Cómo se usan

- **Antes de confirmar un cambio grande:** pídale a Claude «thermos» (o «thermo-nuclear review» / «revisión de
  calidad thermo-nuclear»). Las tres skills tienen `disable-model-invocation: true`: solo corren cuando se
  piden por su nombre, no solas.
- **Revisión automática del código:** `backend/scripts/revisar-slop.sh` (o `npm run revisar:slop` en
  `backend/api`). Todavía no es compuerta de `verificar.sh`.
- Los subagentes de thermos se escribieron para Cursor: donde dicen `subagent_type: "shell"` y `"explore"`,
  en Claude Code son la terminal (Bash) y el agente Explore. No se editaron, para poder compararlos con el original.

Para actualizar: volver a revisar el contenido nuevo, copiar desde el commit nuevo y cambiar aquí el commit.
