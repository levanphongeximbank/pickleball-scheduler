# PROD-SEC-G3-B12-01 — Production Apply Plan

**Do not apply until Owner GO.** This PR only authors SQL + client cutover.

## Preconditions

- [ ] PR merged to `main` (or Owner cherry-picks SQL from this package)
- [ ] Deploy includes `cloudSync.js` cutover (no SPA REST to `club_ai_data`)
- [ ] Staging apply already verified with `11_VERIFY.sql`
- [ ] Backup / snapshot note recorded (table was empty at Gate 4 forensics; re-check row count read-only)
- [ ] No anonymous write exploit test planned

## Production steps

1. Open Supabase Production SQL editor (or migration runner).
2. Run `10_CLUB_AI_DATA_ANON_WRITE_LOCKDOWN.sql` exactly once.
3. Run `11_VERIFY.sql` (read-only). Confirm:
   - No `club_ai_data_anon_*` policies
   - No grants to `anon` / `authenticated`
   - `rls_enabled` + `rls_forced` = true
   - `public_catalog_list_*` RPCs still present
   - `club_data_v3_*` policies unchanged
4. Smoke (authenticated club owner only):
   - Pull/push club via `club_data_v3` path
   - Public Catalog Clubs/Courts pages load
5. Record evidence: policy list + grant list + smoke PASS timestamps

## Rollback

Prefer forward-fix. `90_ROLLBACK.sql` leaves table locked; uncommenting anon policies is **insecure** and requires explicit Owner force.

## Residual risk until apply

Production remains **Release Blocker** for G3-B12 until apply + verify PASS, even after SPA cutover (PostgREST surface can still be hit with anon key until SQL lands).
