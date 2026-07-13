# V5-P1 — Production Deployment Plan (P1-A)

**Phase gate:** P1-A — audit & plan only  
**Date:** 2026-07-13  
**Owner decision:** Functional acceptance APPROVED; controlled Production use YES  
**Git SHA:** `e37ce0ebab163ab891edd8b100c5f02accd7bce8`

## Scope

Controlled Production rollout for **up to 40 club members** (owner's club). Not public release.

| Project | Ref |
|---------|-----|
| Production | `expuvcohlcjzvrrauvud` |
| Staging | `qyewbxjsiiyufanzcjcq` |

## Phase gates (mandatory stops)

| Gate | Actions | Auto-advance |
|------|---------|--------------|
| **P1-A** | Schema diff, migration review, backup plan, runbooks | **NO** |
| **P1-B** | Apply Production SQL + deploy Edge | Owner GO only |
| **P1-C** | Enable flag + enroll Wave A (≤5) | Owner GO only |

**This document completes P1-A only.**

## User flow (target)

```text
Self-register (Production Auth)
  → Player profile linked
  → Club membership approved (owner)
  → Admin enrolls rating_v5_pilot_enrollments
  → User completes V5 assessment (when allow_v5_assessment=true)
  → Provisional Rating displayed (shadow)
```

## Production schema diff (Staging ↔ Production)

### Present on Staging, missing on Production

| Object | Purpose |
|--------|---------|
| `rating_v5_rollout_config` | Kill switch + cohort config |
| `rating_v5_idempotency` | Edge idempotency |
| `rating_v5_pilot_enrollments` | **Enrollment SOT** |
| `rating_v5_reassessment_approvals` | Reassessment policy |
| `player_rating_profiles` | V5 shadow profiles |
| `player_skill_assessments` | Assessment lifecycle |
| `player_rating_events` | Append-only events |
| `rating_evidence` | Evidence workflow |
| `rating_snapshots` | Snapshots |
| `rating_review_cases` | Review cases |
| `rating_calibration_versions` | Calibration registry |

### Untouched on Production (required)

| Object | Status |
|--------|--------|
| `pick_vn_player_ratings` | V2 canonical — **no migration changes** |
| VPR tables | No changes |
| Tournament / seeding / matchmaking | No changes |

**Diff audit:** PASS (diff understood; Production lacks V5 stack by design until P1-B)

## Migration bundle (repo)

| File | SHA256 (prefix) | Apply order |
|------|-----------------|-------------|
| `PHASE_V5A_RATING_FOUNDATION.sql` | `9FF3B05ED6B91AC5…` | 1 |
| `PHASE_V5B1_COMPLETE_ASSESSMENT.sql` | `5445E66697E7E094…` | 2 |
| `PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql` | `D407A548F7C0835D…` | 3 |

### Blocker: repo ↔ staging drift

Staging has objects **not** in the committed SQL bundle:

1. `rating_v5_pilot_enrollments` + RLS + indexes
2. `rating_v5_reassessment_approvals`
3. Rollout config columns: `max_completed_assessments`, `cooldown_days`, `allow_manual_reassessment`, `reassessment_requires_approval`
4. RPCs: `rating_v5_assert_pilot_gate`, `rating_v5_admin_upsert_pilot_enrollment`, `rating_v5_get_my_pilot_enrollment`, `rating_v5_grant_reassessment_approval`, `rating_v5_load_rollout_config`, `rating_v5_count_valid_completed_assessments`

**Action before P1-B:** Export staging DDL into `PHASE_V5C1_PILOT_ENROLLMENT.sql` (or equivalent) and owner-review.

### Idempotency / safety

- Bundle uses `create table if not exists`, `on conflict do nothing`, `create or replace function`
- No `DROP TABLE` on V2 or club data
- Event table append-only via trigger

## Initial Production configuration (post-migration, pre-activation)

```sql
-- Set after migration; do not enable assessment until P1-C
UPDATE rating_v5_rollout_config SET
  shadow_mode_enabled = true,
  compare_v2_enabled = true,
  allow_v5_assessment = false,
  pilot_cohort_label = 'club-rating-v5-production-pilot',
  max_completed_assessments = 1,
  cooldown_days = 7,
  reassessment_requires_approval = true
WHERE id = 'default';
```

Frontend: `VITE_PICK_VN_RATING_V5_ENABLED=false` until P1-C.

## Edge Function

| Item | Value |
|------|-------|
| Name | `rating-v5-complete-assessment` |
| Engine | Frozen `v5.0f` |
| Entry source | `src/features/pick-vn-rating-v5/server/edgeEntry.js` |
| Entry SHA256 prefix | `46966A8C51FE92E0…` |
| Production URL | `https://expuvcohlcjzvrrauvud.supabase.co/functions/v1/rating-v5-complete-assessment` |

Production CORS (owner-approved):

```text
https://pickleball-scheduler-eight.vercel.app
```

**Exclude:** `__vercel_preview__`, `__localhost_qa__`, staging ref in secrets.

## Club rollout waves

| Wave | Max enrolled | Cohort label |
|------|--------------|--------------|
| A | 5 | `club-rating-v5-production-pilot` |
| B | 15 | same |
| C | 40 | same (club members only) |

Enrollment RPC: `rating_v5_admin_upsert_pilot_enrollment` only. PLAYER cannot self-enroll.

## Pre-flight checklist (P1-A)

| # | Step | P1-A status |
|---|------|-------------|
| 1 | Schema diff audit | PASS |
| 2 | Migration review | **BLOCKED** (repo gap) |
| 3 | Idempotent / non-destructive | PASS (intent) |
| 4 | Production DB backup | **OWNER** (before P1-B) |
| 5 | V2 snapshot `pick_vn_player_ratings` | **OWNER** (before P1-B) |
| 6 | Git SHA pinned | `e37ce0eb` |
| 7 | Migration checksums | Recorded |
| 8 | Edge checksum | Recorded |
| 9 | Disable/rollback runbook | READY |
| 10 | Pre-flight script | `npm run qa:v5p1:preflight` |

## UI copy (Production)

Title: **Rating V5 — Điểm trình độ tạm tính**

Notice: *"Đây là điểm trình độ tạm tính của Pick_VN Rating V5. Kết quả có thể được điều chỉnh sau quá trình sử dụng và đánh giá thực tế."*

No "Verified" label. No accuracy claims.

## Frontend gap (fix before P1-C)

`ratingV5AccessService.js` currently uses `isUserInRolloutCohort` with `profile.rollout_cohort`. Production must use **`rating_v5_pilot_enrollments`** as sole auth source (per enrollment SOT). Wire `rating_v5_get_my_pilot_enrollment` before Wave A.

## Monitoring (read-only scripts — post P1-B)

Track: enrollments, starts, completions, Edge 4xx/5xx, duplicate events, partial writes, V2 mutations, rating/confidence distribution.

## Commands

```bash
npm run qa:v5p1:preflight
```

Evidence: `docs/v5/rating-v5/qa-evidence/v5-p1a-preflight/`
