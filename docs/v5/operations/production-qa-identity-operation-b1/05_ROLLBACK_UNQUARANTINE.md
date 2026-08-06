# Operation B1 — Rollback / Unquarantine

Requires:

- exact `OPERATION_B1_BATCH_ID`
- protected original-state snapshot path + SHA-256
- project ref = `expuvcohlcjzvrrauvud`
- Owner GO + execute confirmation when not dry-run

Behavior:

- restore original profile status only if current status is `quarantined` or already original
- refuse if profile drifted to an unexpected status
- unban Auth only if currently banned and original was not banned
- identity-by-identity fail closed; emit unresolved list
- never hard-delete or recreate accounts
- never touch B2 identities

Idempotent re-run is allowed when already restored.
