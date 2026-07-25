# COACHING-03 — Rollback & Recovery (plan only — not executed)

## Decision tree

| Failure point | Action | Stop condition |
|---------------|--------|----------------|
| Before any write | No rollback needed; retain preflight evidence | Resume after fix |
| During permission seed | If single-tx: ROLLBACK whole tx. If checkpointed: run catalog cleanup only for Coaching seed rows **Owner-approved**; prefer restore baseline | Owner if seed partially visible |
| During tables / indexes | Scripted: apply `90_COACHING_02_ROLLBACK.sql` from last successful object set; single-tx: ROLLBACK | Owner if DROP fails |
| During RLS / RPC / grants | Same as above — rollback covers policies, helpers, RPCs, grants | Owner if objects linger |
| During role grants | Run `91_COACHING_03_ROLE_PERMISSION_ROLLBACK.proposal.sql` | Owner if unexpected non-Coaching rows touched (should not) |
| During fixture certification | Run cleanup script (idempotent); verify residual = 0 | Owner if residual > 0 |
| During runtime smoke | No schema rollback unless smoke proves corrupt apply; stop cutover | Owner |
| Residual fixture cleanup failure | Re-run cleanup; do not broaden DELETE | **Owner decision required** |

## Distinctions

| Layer | Artifact |
|-------|----------|
| Schema rollback | `docs/coaching-training/coaching-02/90_COACHING_02_ROLLBACK.sql` |
| Role grant rollback | `sql/91_COACHING_03_ROLE_PERMISSION_ROLLBACK.proposal.sql` |
| Fixture cleanup | `scripts/coaching/coaching-03-staging-cleanup.mjs` (authored; prefix `COACHING_03_CERT_FIXTURE_`) |
| Restore no-Coaching baseline | Schema rollback + role grant rollback + residual verify |
| Retain evidence | Never delete `evidence/*.json` on failure |
| Owner decision required | Residual non-zero, Production risk, partial unknown state |

## Rollback object coverage

`90_*` must cover: RPCs → triggers/immutable fns → policies → scope helpers → indexes → 13 tables.

Role rollback covers Coaching `role_permissions` for proposed roles only — **not** permission catalog rows.

## Explicit non-action (this step)

Do **not** execute rollback SQL now.
