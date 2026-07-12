# V5-A.1 — Shadow Mode Design

**Status:** PASS (design) | **Runtime:** NOT VERIFIED

## Rollout principle

```text
V2 = production canonical (pick_vn_player_ratings + blob mirrors)
V5 = staging/shadow only until owner promotes cohort
```

## Schema signals

| Field / table | Purpose |
|---------------|---------|
| `player_rating_profiles.is_shadow` | Default `true` — excludes from leaderboard index |
| `player_rating_profiles.rollout_cohort` | Cohort label e.g. `v5-shadow-pilot` |
| `rating_v5_rollout_config` | Global flags — no hard-coded user IDs |
| `*.is_shadow` on assessments, events, evidence | Shadow lineage |

## `rating_v5_rollout_config` defaults

```sql
shadow_mode_enabled = true
pilot_cohort_label = 'v5-shadow-pilot'
allow_v5_assessment = true
allow_v5_profile_write = true  -- via RPC only
compare_v2_enabled = true
```

## Shadow mode rules

| Action | V5 shadow | V2 production |
|--------|-----------|---------------|
| Save assessment | ✅ `player_skill_assessments` | Unchanged |
| Update verified | ❌ never from questionnaire | Unchanged |
| Control VPR | ❌ | VPR unchanged |
| Control seeding | ❌ | Legacy/CC-02 flags |
| Control matchmaking | ❌ | Legacy |
| Compare V2 vs V5 | ✅ `compare_v2_enabled` | Read-only |

## Cohort promotion (future — not in this phase)

1. Owner sets `is_shadow = false` per cohort via RPC + audit
2. Leaderboard index `player_rating_profiles_leaderboard_idx` filters `is_shadow = false`
3. Feature flag `VITE_PICK_VN_RATING_V5_ENABLED` per environment

## V2 ↔ V5 compare (V5-F)

```text
read pick_vn_player_ratings.current_rating  (V2)
read player_rating_profiles.display_rating    (V5 shadow)
emit diff report — no write-back
```

## Singles in shadow

- `rating_v5_start_assessment('singles')` returns `SINGLES_NOT_IMPLEMENTED`
- Profile may exist with `singles_assessment_status = incomplete`
- No provisional/verified singles from doubles questionnaire
