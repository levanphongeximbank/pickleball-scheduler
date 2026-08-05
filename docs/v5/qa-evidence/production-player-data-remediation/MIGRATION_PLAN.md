# Migration Plan — profiles.gender Nam → male

**Status:** PREPARED, NOT APPLIED  
**Target:** `expuvcohlcjzvrrauvud.public.profiles.gender`  
**Expected affected rows:** 4  
**Production GO:** NO

## Files
| Step | Path |
|------|------|
| Precheck | `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE_PRECHECK.sql` |
| Forward | `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE_FORWARD.sql` |
| Postcheck | `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE_POSTCHECK.sql` |
| Rollback | `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE_ROLLBACK.sql` |
| Bundle notes | `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE.sql` |

## Behavior
1. Snapshot `gender='Nam'` rows into `_remediation_gender_nam_backup`.
2. `UPDATE ... SET gender='male' WHERE gender='Nam'` (idempotent).
3. Optionally add `profiles_gender_canonical_chk` if no gender CHECK exists.
4. Does **not** alter `male|female|other|null`.

## Zero-row / repeat safety
- Second run: `WHERE gender='Nam'` matches 0 rows; backup insert uses `ON CONFLICT DO NOTHING`.
