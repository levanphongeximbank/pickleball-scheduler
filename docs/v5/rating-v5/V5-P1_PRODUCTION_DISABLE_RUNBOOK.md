# V5-P1 — Production Disable / Rollback Runbook

**Purpose:** Emergency stop for Rating V5 on Production without deleting audit data.

## When to use

Trigger on any stop condition:

- Cross-user or cross-tenant data leak
- `pick_vn_player_ratings` (V2) mutation
- Duplicate canonical rating event
- Partial assessment write
- Wrong Supabase project or leaked secret
- UI display ≠ server canonical response
- Wrong version stamping
- Unrelated Production module regression

## Immediate actions (order matters)

### 1. Kill assessment (database)

```sql
UPDATE public.rating_v5_rollout_config
SET
  allow_v5_assessment = false,
  updated_at = now()
WHERE id = 'default';
```

Verify:

```sql
SELECT allow_v5_assessment, shadow_mode_enabled, pilot_cohort_label
FROM public.rating_v5_rollout_config WHERE id = 'default';
-- allow_v5_assessment must be false
```

### 2. Pause enrollments

```sql
UPDATE public.rating_v5_pilot_enrollments
SET status = 'paused', paused_at = now(), updated_at = now()
WHERE cohort_label = 'club-rating-v5-production-pilot'
  AND status = 'active';
```

Or per-player via `rating_v5_admin_upsert_pilot_enrollment` with `p_status := 'paused'`.

### 3. Disable frontend feature flag

Vercel / Production env:

```text
VITE_PICK_VN_RATING_V5_ENABLED=false
```

Redeploy Production frontend. Confirm V5 menu hidden.

### 4. Optional: remove Edge HTTP entry

```bash
# Production only — after owner approval
npx supabase functions delete rating-v5-complete-assessment --project-ref expuvcohlcjzvrrauvud
```

Persistence RPCs remain; assessments cannot complete via HTTP.

## What NOT to do

- **Do not** `DELETE` from `player_skill_assessments`
- **Do not** `DELETE` from `player_rating_events`
- **Do not** modify `pick_vn_player_ratings`
- **Do not** drop V5 tables during incident (preserves audit trail)

## Post-incident

1. Export health report (enrollment counts, error logs, event integrity queries)
2. Snapshot affected rows (`player_rating_events`, assessments)
3. Incident review with owner
4. Root-cause before re-enable

## Re-enable procedure (after fix)

1. Fix root cause + owner GO
2. `allow_v5_assessment = true` (if appropriate)
3. Re-activate enrollments (`status = 'active'`)
4. Redeploy Edge if deleted
5. Set feature flag true only for Wave A scope
6. Re-run smoke tests

## Rollback migration (last resort)

Only if migration itself is defective and owner approves:

1. Full DB restore from pre-P1-B backup
2. Document data loss scope (V5 tables only if restored to pre-migration state)
3. Do **not** partial-drop V5 tables without backup

## Verification after disable

| Check | Expected |
|-------|----------|
| `rating_v5_start_assessment` | Blocked / `ROLLOUT_BLOCKED` |
| Edge complete | `PILOT_NOT_ENROLLED` or 403 |
| V5 menu | Hidden |
| V2 row count | Unchanged since incident start |
| Staging | Unaffected |

## Contacts / evidence

- Production ref: `expuvcohlcjzvrrauvud`
- Cohort: `club-rating-v5-production-pilot`
- Evidence folder: `docs/v5/rating-v5/qa-evidence/v5-p1*/`
