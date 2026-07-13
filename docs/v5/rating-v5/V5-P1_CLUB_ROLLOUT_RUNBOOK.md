# V5-P1 — Club Rollout Runbook

**Cohort:** `club-rating-v5-production-pilot`  
**Max members:** 40 (club only)  
**Enrollment SOT:** `rating_v5_pilot_enrollments`

## Prerequisites

- P1-B complete: migration + Edge on Production
- P1-C owner GO for Wave A
- `VITE_PICK_VN_RATING_V5_ENABLED=true` on Production build (Wave A only)
- `allow_v5_assessment=true` in `rating_v5_rollout_config`
- Frontend wired to `rating_v5_get_my_pilot_enrollment` (not `profile.rollout_cohort`)

## Member eligibility

Enroll only when ALL true:

| Check | Source |
|-------|--------|
| Production Auth user exists | `auth.users` |
| Player profile exists | `profiles` |
| Club membership active / owner-approved | `club_members` or `club_membership_requests_v42` |
| Correct club (owner's club) | `club_id` / tenant |
| Not disabled | `profiles.status` |
| No duplicate enrollment | unique `(player_id, cohort_label)` |

**PLAYER cannot self-enroll.**

## Enrollment procedure (admin/owner)

```sql
-- Example — use rating_v5_admin_upsert_pilot_enrollment RPC in practice
SELECT rating_v5_admin_upsert_pilot_enrollment(
  p_player_id := '<uuid>',
  p_tenant_id := '<club-tenant>',
  p_cohort_label := 'club-rating-v5-production-pilot',
  p_status := 'active',
  p_notes := 'Wave A slot 1'
);
```

Verify:

```sql
SELECT * FROM rating_v5_pilot_enrollments
WHERE cohort_label = 'club-rating-v5-production-pilot'
  AND status = 'active';
```

## Wave progression

### Wave A — max 5

1. Owner GO
2. Set `allow_v5_assessment = true`
3. Deploy frontend with `VITE_PICK_VN_RATING_V5_ENABLED=true`
4. Enroll up to 5 members one-by-one
5. After each: verify assessment → event → profile → **V2 unchanged**

**Gate to Wave B:**

- 5 successful completions OR documented exceptions
- critical errors = 0
- duplicate events = 0
- partial writes = 0
- cross-user leaks = 0
- V2 mutations = 0

### Wave B — max 15 total

- Owner GO required
- Enroll up to 10 additional (total ≤15)
- Monitor completion rate

**Gate to Wave C:**

- Acceptable completion rate
- critical errors = 0
- No operational blockers
- Owner GO

### Wave C — max 40 total

- Club members only
- No auto-expand beyond 40
- No users outside owner's club

## Per-user verification checklist

| Step | Verify |
|------|--------|
| Login | Production app |
| Menu | "Rating V5 — Điểm trình độ tạm tính" visible |
| Start assessment | `rating_v5_start_assessment` OK |
| Complete | Edge returns provisional rating |
| Profile | `player_rating_profiles.is_shadow = true` |
| UI copy | Provisional notice shown; no "Verified" |
| V2 | `pick_vn_player_ratings` row count unchanged |

## UI copy (mandatory)

**Title:** Rating V5 — Điểm trình độ tạm tính

**Notice:** Đây là điểm trình độ tạm tính của Pick_VN Rating V5. Kết quả có thể được điều chỉnh sau quá trình sử dụng và đánh giá thực tế.

## Monitoring

Run read-only daily:

- Enrolled count by wave
- Starts / completions
- Edge 4xx/5xx
- Duplicate `player_rating_events`
- V2 row count delta (must be 0)

## Stop conditions

Immediately execute disable runbook if:

- Cross-user or cross-tenant leak
- V2 mutation
- Duplicate canonical event
- Partial write
- Wrong project/secret
- UI ≠ server canonical response

## Isolation guarantees

Rating V5 does **not** auto-update: V2, VPR, tournament seeding, matchmaking, eligibility, public verified rating.

## Owner sign-off per wave

| Wave | Owner GO date | Enrolled count | Notes |
|------|---------------|----------------|-------|
| A | __________ | /5 | |
| B | __________ | /15 | |
| C | __________ | /40 | |
