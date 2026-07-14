# V5-C.1C-R — Owner Cohort Review Checklist

**Phase:** V5-C.1C-R Wave 1 owner review completion  
**Date:** 2026-07-13  
**Cohort file:** `docs/v5/rating-v5/V5-C1C_WAVE1_COHORT_REVIEW.csv`  
**Slots:** 12 (fixed — no new accounts)

## Constraints (this phase)

- No new accounts
- No enrollment
- No pilot open
- No Production deploy
- Coach estimates must be **independent** — not derived from V5 assessment results

---

## Automated pre-check (run before owner sign-off)

```bash
npm run qa:v5c1c:owner-review
```

---

## Owner confirmation checklist

Mark each item after direct review. Do **not** check coach-estimate items until a real coach has provided independent estimates.

### Account readiness

| # | Item | Auto | Owner ☐ |
|---|------|------|---------|
| 1 | **12/12** slots present in cohort CSV | PASS | |
| 2 | **12/12** `account_status = READY` | PASS | |
| 3 | Skill distribution **4 / 5 / 3** (1.5–2.5 / 3.0–3.5 / 4.0–4.5) | PASS | |
| 4 | Duplicate `auth_user_id` = **0** | PASS | |
| 5 | Duplicate `player_id` / `email` = **0** | PASS | |
| 6 | Active V5 enrollment in cohort = **0** | PASS | |
| 7 | Production email references = **0** (all `@staging.local`) | PASS | |
| 8 | Secrets in cohort file = **0** | PASS | |

### Distribution review

| # | Item | Current | Owner ☐ |
|---|------|---------|---------|
| 9 | Gender mix acceptable (Nam **6**, Nữ **4**, empty **2** — owner may fill W1-01, W1-08) | See CSV | |
| 10 | Tenant mix acceptable (`venue-staging-a` **6**, `platform` **6**) | PASS | |
| 11 | Experience mix spans new / casual / experienced | See CSV | |

### QA account policy

| # | Item | Owner ☐ |
|---|------|---------|
| 12 | Only **one** intentional QA-style slot: `qa42l.nomember@staging.local` (W1-01, nomember beginner band) | |
| 13 | No other QA-only / Wave 0 / test-only accounts in cohort | PASS (auto) |

### Coach estimate protocol (owner + coach)

| # | Item | Status | Owner ☐ |
|---|------|--------|---------|
| 14 | **12** independent coach estimates collected | **PENDING** (0/12) | |
| 15 | Coach did **not** view V5 assessment result before estimating | — | |
| 16 | Each row has `coach_estimate`, `coach_confidence`, `coach_reviewer`, `coach_reviewed_at` | **PENDING** | |
| 17 | `coach_review_status = COMPLETE` for all 12 after coach sign-off | **PENDING** | |
| 18 | No invented / automated coach numbers in CSV | PASS (all empty) | |

### Fields owner/coach must fill (do not auto-fill)

For each slot where blank or `PENDING_COACH_REVIEW`:

- `gender` (if unknown — W1-01, W1-08)
- `coach_estimate`
- `coach_confidence`
- `coach_reviewer`
- `coach_reviewed_at`
- `coach_review_status` → `COMPLETE` when done

**Do not fill:** `court_test_*` in this phase unless a real court test occurred.

---

## Cohort summary (for review)

| Slot | Email | Tenant | Expected band | Gender | Coach status |
|------|-------|--------|---------------|--------|--------------|
| W1-01 | `qa42l.nomember@staging.local` | platform | 1.5–2.5 | *(empty)* | PENDING |
| W1-02 | `club@staging.local` | venue-staging-a | 3.0–3.5 | Nam | PENDING |
| W1-03 | `rating.wave1.01@staging.local` | venue-staging-a | 1.5–2.5 | Nam | PENDING |
| W1-04 | `rating.wave1.02@staging.local` | platform | 1.5–2.5 | Nữ | PENDING |
| W1-05 | `rating.wave1.03@staging.local` | venue-staging-a | 1.5–2.5 | Nam | PENDING |
| W1-06 | `rating.wave1.04@staging.local` | platform | 3.0–3.5 | Nữ | PENDING |
| W1-07 | `rating.wave1.05@staging.local` | venue-staging-a | 3.0–3.5 | Nam | PENDING |
| W1-08 | `rating.wave1.06@staging.local` | platform | 3.0–3.5 | *(empty)* | PENDING |
| W1-09 | `rating.wave1.07@staging.local` | venue-staging-a | 3.0–3.5 | Nữ | PENDING |
| W1-10 | `rating.wave1.08@staging.local` | platform | 4.0–4.5 | Nam | PENDING |
| W1-11 | `rating.wave1.09@staging.local` | venue-staging-a | 4.0–4.5 | Nữ | PENDING |
| W1-12 | `rating.wave1.10@staging.local` | platform | 4.0–4.5 | Nam | PENDING |

---

## Sign-off block (owner only)

| Gate | Value |
|------|-------|
| READY FOR OWNER APPROVAL | **YES** (structure ready — pending coach data) |
| READY TO ENROLL WAVE 1 | **NO** |
| READY TO START SHADOW PILOT | **NO** |
| READY FOR PRODUCTION | **NO** |

**Owner signature / date:** ___________________________

**Notes:** Enrollment remains blocked until owner confirms this checklist **and** all 12 coach estimates are recorded in the CSV with `coach_review_status = COMPLETE`.
