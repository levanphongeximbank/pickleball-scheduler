# CC-03B — Feature Flags (Rules V2)

**Phase:** CC-03B | **Date:** 2026-07-12

---

## Canonical flag

| Env key | Helper |
|---------|--------|
| `VITE_COMPETITION_CORE_RULES_V2_ENABLED` | `isRulesV2Enabled(envSource)` |

## Backward-compatible alias

| Env key | Status |
|---------|--------|
| `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED` | Deprecated alias — read only when canonical key absent |

## Resolution order

1. If `VITE_COMPETITION_CORE_RULES_V2_ENABLED` is set → use it.
2. Else if `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED` is set → use alias (dev warning once).
3. Else → `false`.

Both keys cannot create contradictory behavior because only one source applies per read.

## Master gate

Requires `VITE_COMPETITION_CORE_ENABLED=true`.

## Defaults

| Check | Result |
|-------|--------|
| Missing | `false` |
| Invalid (`enabled`, `maybe`) | `false` |
| `yes` / `on` via `parseEnvBoolean` | `true` (CC-01 env reader) |

## Production

**OFF** — no production env changes in CC-03B.

## API aliases

- `isRulesV2Enabled()` — canonical
- `isConstraintsV2Enabled()` — deprecated alias, same behavior

Reader utility: `resolveRulesV2Flag(envSource)` → `{ enabled, source }`.
