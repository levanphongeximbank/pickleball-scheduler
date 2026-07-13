# V5-P1 — Production Backup Checklist

**Gate:** P1-A — prepare only (no apply)  
**Production ref:** `expuvcohlcjzvrrauvud`

## Pre-P1-B backup (owner executes)

| # | Step | Owner ☐ | Notes |
|---|------|---------|-------|
| B1 | Confirm Supabase project = **Production** (`expuvcohlcjzvrrauvud`) | | Not staging |
| B2 | Export schema snapshot via Dashboard → Database → Backups (if plan supports) | | Free/Nano may have no PITR |
| B3 | Record `pick_vn_player_ratings` row count | | V2 baseline |
| B4 | Record `profiles` / `club_members` counts | | Club baseline |
| B5 | Save migration checksums from `MIGRATION_CHECKSUMS.json` | | Pin before apply |
| B6 | Record Git SHA deploying with migration | | |
| B7 | Document rollback owner contact + time window | | |

## V2 snapshot query (run before P1-B)

```sql
select count(*) as v2_row_count from public.pick_vn_player_ratings;
select count(*) as profile_count from public.profiles;
select count(*) as club_member_count from public.club_members;
```

Save results to: `docs/v5/rating-v5/qa-evidence/v5-p1b-backup/BASELINE_SNAPSHOT.json` (owner).

## Rollback commands (reference)

### Soft disable (preferred)

```sql
update public.rating_v5_rollout_config
set allow_v5_assessment = false, updated_at = now()
where id = 'default';

update public.rating_v5_pilot_enrollments
set status = 'paused', paused_at = now(), updated_at = now()
where cohort_label = 'club-rating-v5-production-pilot' and status = 'active';
```

### Frontend kill switch

```text
VITE_PICK_VN_RATING_V5_ENABLED=false
```

Redeploy Production app.

### Edge HTTP rollback (P1-B+ only)

```bash
npx supabase functions delete rating-v5-complete-assessment --project-ref expuvcohlcjzvrrauvud
```

### Full DB restore (last resort)

Restore from Supabase backup / point-in-time if available. **Do not** partial-drop V5 tables without backup.

## BACKUP READY criteria (P1-A)

Checklist documented + commands ready + V2 snapshot procedure defined = **YES** (owner executes snapshot at P1-B).

## Evidence template

```json
{
  "production_ref": "expuvcohlcjzvrrauvud",
  "snapshot_at": null,
  "v2_row_count": null,
  "profile_count": null,
  "club_member_count": null,
  "migration_checksums_file": "qa-evidence/v5-p1a-preflight/MIGRATION_CHECKSUMS.json",
  "git_sha": null
}
```
