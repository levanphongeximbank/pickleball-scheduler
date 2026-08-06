# Operation B1 — Rollback / Unquarantine

Requires:

- exact `OPERATION_B1_BATCH_ID`
- protected original-state snapshot path + SHA-256
- project ref = `expuvcohlcjzvrrauvud`
- **separate** rollback Owner GO (forward GO cannot authorize rollback):
  `APPROVE_OPERATION_B1_ROLLBACK_UNQUARANTINE_ONLY`
- execute confirmation when not dry-run:
  `I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY`

Live operator entry: `rollback-live-operator.mjs` (see `07_LIVE_OPERATOR_RUNNER.md`).

Behavior:

- restore original profile status only if current status is `quarantined` or already original
- refuse if profile drifted to an unexpected status
- unban Auth only if currently banned and original was not banned
- identity-by-identity fail closed; emit unresolved list
- never hard-delete or recreate accounts
- never touch B2 identities

Idempotent re-run is allowed when already restored.
