# Rollback Plan

## Gender normalization
1. Run `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_NAM_TO_MALE_ROLLBACK.sql`
2. Restores `Nam` only for IDs in `_remediation_gender_nam_backup`
3. Drops `profiles_gender_canonical_chk` if added
4. Prefer PITR / snapshot restore if ledger missing

## Test-identity quarantine
1. Set `profiles.status` back to `active` for quarantined QA ids
2. Clear auth `ban_duration`
3. Do **not** recreate hard-deleted users without backup

## App rollback
- `git revert` of remediation commit(s) restores strict-reader / writer behavior if needed
- UI labels remain Vietnamese either way via presentation helper

**Applied:** false  
**Production GO:** NO
