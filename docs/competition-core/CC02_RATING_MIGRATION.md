# CC-02 — Rating Migration Plan

**Phase:** CC-02 | **Production migration:** NOT APPLIED

---

## 1. Principles

1. **Non-destructive** — keep `ratingInternal`, `skillLevel`, `current_rating`
2. **Idempotent** — safe re-run of backfill
3. **Provisional by default** when unit uncertain
4. **Audit** — log source on every backfill row

---

## 2. Local blob backfill

Function: `backfillPlayerRatingV2Fields(player)` / `backfillClubPlayerRatingsV2(clubId)`

| Source field | Target | Rule |
|--------------|--------|------|
| `competitionElo` (existing) | keep | Never overwrite |
| `ratingInternal` ≤ 10 | `competitionElo` | `mapSkillToCompetitionElo(ratingInternal)` |
| `ratingInternal` > 10 | `competitionElo` | Use as-is (already Elo scale) |
| `current_rating` | `publicSkillLevel` | Already canonical |
| `rating_match_count` | `competitionMatchCount` | Copy if missing |
| N/A | `dailyPlayRating` | `null` |

Metadata: `ratingV2BackfillSource`, `ratingV2BackfilledAt`

---

## 3. Supabase backfill (staging only — manual)

After applying `supabase-cc02-rating-v2.sql` on **staging**:

```sql
-- Example dry-run insert from pick_vn_player_ratings (adjust tenant join)
insert into public.player_ratings (
  id, player_id, auth_user_id, public_skill_level, competition_elo,
  rating_confidence, rating_status, competition_match_count, backfill_source, backfilled_at
)
select
  'pr-' || p.auth_user_id,
  p.id,
  p.auth_user_id,
  p.current_rating,
  1500 + (coalesce(p.current_rating, 3.5) - 3.5) * 400,
  coalesce(p.rating_confidence, 0) * 100,
  case when p.rating_status in ('verified','club_verified','admin_verified','system_verified')
    then 'verified' else 'provisional' end,
  coalesce(p.rating_match_count, 0),
  'cc02-pick-vn-backfill',
  now()
from public.pick_vn_player_ratings p
on conflict (player_id, tenant_id) do nothing;
```

---

## 4. Rollback

| Layer | Action |
|-------|--------|
| Feature flag | Set `VITE_COMPETITION_CORE_RATING_V2_ENABLED=false` → instant legacy restore |
| Blob | Old fields untouched; optional `competitionElo` ignored when flag off |
| Supabase | Manual DROP (see SQL file footer) — only after owner approval |

---

## 5. Apply status

| Environment | Applied |
|-------------|---------|
| Production | **NO** |
| Staging | **NO** (awaiting owner GO) |
| Local dev | Blob backfill via function only |
