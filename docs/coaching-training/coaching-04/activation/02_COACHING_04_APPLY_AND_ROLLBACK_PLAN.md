# COACHING-04 — Apply And Rollback Plan

**Target:** Staging `qyewbxjsiiyufanzcjcq` only  
**Owner GO:** `COACHING_04_OWNER_GO_APPLY_STAGING` (**not granted**)  
**CODEX_DELETE_ALLOWED:** `NO`

## Forward apply order (future Owner GO only)

1. `10_COACHING_04_ASSIGNMENT_HELPERS.sql`
2. `11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql`
3. `20_COACHING_04_ASSIGNMENT_RLS.sql`
4. `21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql`
5. `30_COACHING_04_SCOPED_RPCS.sql`
6. `40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql`
7. `99_COACHING_04_VERIFICATION.sql` — only after forward success

## Explicit exclusions

- `90_COACHING_04_ROLLBACK.sql` is **never** auto-executed.
- **No automatic rollback.**
- **No automatic retry.**
- **No partial continuation** from a mid-package file after failure.
- **Do not** create mapping rows.
- **Do not** run backfill.
- **Do not** activate durable runtime.
- **Do not** retire localStorage.
- **Do not** Change Production / touch Production.

## Stop conditions before first SQL

Refuse before database connection when any guard fails (GO, commit, hashes, target, dirty tree, preflight, credentials).

## Failure behaviour

On first apply error: stop immediately, leave checkpoint evidence, wait for Owner decision. Manual rollback (if any) uses `90_COACHING_04_ROLLBACK.sql` under separate Owner authorization.
