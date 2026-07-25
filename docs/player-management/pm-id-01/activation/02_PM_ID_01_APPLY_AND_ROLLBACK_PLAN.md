# PM-ID-01 — Apply And Rollback Plan (author only)

**Status:** authored for future execution. **Not executed** in this activation-package step.

## Apply plan (future, Owner GO required)

1. Re-run exact-commit guard (clean tree, full SHA equality, Staging ref, manifest hashes, Owner GO token).
2. Re-run read-only Staging preflight (`BEGIN TRANSACTION READ ONLY` … `ROLLBACK`).
3. Begin controlled execution only when guards pass.
4. Apply SQL in manifest forward order:
   - `10_PM_ID_01_MAPPING_TABLE.sql`
   - `20_PM_ID_01_CONSTRAINTS_AND_INDEXES.sql`
   - `30_PM_ID_01_RESOLUTION_HELPERS.sql`
   - `40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql`
   - `50_PM_ID_01_RLS_AND_GRANTS.sql`
5. Do **not** run backfill.
6. Do **not** create mapping rows (no INSERT fixtures; admin RPCs exist but are not invoked by apply runner).
7. Run `99_PM_ID_01_VERIFICATION.sql`.
8. Verify:
   - table `public.player_identity_links`
   - constraints + indexes
   - helpers (`player_identity_resolve_mapping`, `player_identity_is_mapped`)
   - management RPCs
   - RLS ENABLE + FORCE
   - grants / no PUBLIC / no anon execute
9. Write apply evidence under `activation/evidence/`.
10. Stop before any Coaching changes.

## Explicit non-goals during PM-ID-01 activation

- Author Coaching PLAYER RLS
- Grant `coaching.self.read`
- Enable Coaching durable runtime
- Retire Coaching localStorage
- Change Production

## Rollback boundary

- **No automatic rollback.**
- Rollback may be considered only when:
  - apply fails mid-way;
  - verification fails;
  - schema is inconsistent;
  - Owner grants a **separate** rollback decision.
- Presence of `90_PM_ID_01_ROLLBACK.sql` is **not** rollback authorization.
- Do **not** run rollback in the current (package-only) step.
