# Phase 1I-B — Staging Apply Runbook

**Status:** Authoring complete — **APPLY NOT AUTHORIZED** under `AUTHORIZE_PHASE_1I_B_SQL_AUTHORING_ONLY`  
**Required apply token:** `AUTHORIZE_PHASE_1I_B_STAGING_APPLY`  
**Production:** Hold until Phase 1I-F separate gate

---

## Pre-conditions

1. Phase 1C/1D/1E profile columns present on Staging `public.profiles`:
   - `privacy_settings`, `identity_verification_status`, `activity_region`, `handedness`, `gender`, `avatar_url`, `player_id`, `status`, `display_name`
2. Phase 1I-A application code deployed or available for adapter tests
3. Owner issued `AUTHORIZE_PHASE_1I_B_STAGING_APPLY`
4. Rollback file reviewed: `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL_ROLLBACK.sql`

---

## Apply order (Staging only)

1. Snapshot / note current schema revision  
2. Apply `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL.sql`  
3. Run `docs/v5/PHASE_1I_B_PLAYER_DIRECTORY_READ_MODEL_VERIFY.sql`  
4. Smoke (authenticated session only):
   - `select public.player_directory_search(null, null, null, 5);`
   - `select public.player_directory_search(null, null, 'not-a-cursor', 5);` → `INVALID_CURSOR`
   - `select public.player_directory_get('<known-eligible-player-id>');`
   - `select public.player_directory_get('<hidden-or-unknown-id>');` → `data: null`
5. Confirm anon cannot execute (expect permission denied)
6. Capture evidence for 1I-E QA

---

## Forbidden during this authoring wave

- Connecting Staging or Production from the authoring agent  
- Applying SQL without Owner apply token  
- Production apply  
- Expanding `profiles` SELECT policies  
- Granting EXECUTE to `anon`

---

## Rollback

See `04_ROLLBACK.md` / executable SQL rollback file.
