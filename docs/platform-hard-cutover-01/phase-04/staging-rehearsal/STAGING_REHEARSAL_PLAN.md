# Staging Rehearsal Plan (NOT executed in Phase 4)

## Sequence

1. Backup Staging (Owner console)
2. Identity preserve precheck (`00_IDENTITY_PRESERVE_PRECHECK.sql`)
3. Protected guards (`01_PROTECTED_OBJECT_GUARDS.sql`)
4. Apply migration families M1→M8 (manifest order); verify each
5. Ordered wipe (`10_ORDERED_WIPE.sql`)
6. DROP `club_ai_data` (`20_DROP_CLUB_AI_DATA.sql`)
7. Post verify (`30_POST_WIPE_VERIFY.sql`)
8. Redeploy Preview/Staging SPA (includes hard-cutover code)
9. Enable flags (Staging only):  
   `VITE_PLATFORM_HARD_CUTOVER_ENABLED=true`  
   `VITE_COMPETITION_REMOTE_SSOT_ENABLED=true`  
   `VITE_PICK_VN_RATING_V5_ENABLED=true` (optional after rating seed)
10. Reseed (`sql/reseed/`)
11. E2E acceptance tests
12. Rollback decision: restore Staging backup if FAIL

## Owner GO required

Marker to request later: `PLATFORM_HARD_CUTOVER_01_STAGING_REHEARSAL_OWNER_GO_REQUIRED`
