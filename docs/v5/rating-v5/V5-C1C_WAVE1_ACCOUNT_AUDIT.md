# V5-C.1C — Wave 1 Account Audit

**Phase:** V5-C.1C Wave 1 account preparation (staging only)  
**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Run:** `2026-07-13T12:15:05Z`  
**Scope:** Audit + create accounts — **no enrollment**

## Summary

| Metric | Value |
|--------|-------|
| Wave 1 cohort slots | 12 |
| READY | 12 |
| Created this run | 10 (`rating.wave1.01` … `rating.wave1.10`) |
| Reused existing | 2 (`qa42l.nomember`, `club`) |
| Active V5 enrollment in cohort | 0 |

## Skill-band distribution (expected)

| Band | Count | Target |
|------|-------|--------|
| 1.5–2.5 | 4 | 4–6 |
| 3.0–3.5 | 5 | 4–8 |
| 4.0–4.5 | 3 | 2–6 |

## Tenant mix

| Tenant | Count |
|--------|-------|
| `venue-staging-a` | 6 |
| `platform` | 6 |

## Per-slot audit

| Slot | Email | Status | Notes |
|------|-------|--------|-------|
| W1-01 | `qa42l.nomember@staging.local` | **READY** | Existing auth + profile; platform tenant |
| W1-02 | `club@staging.local` | **READY** | Existing; `venue-staging-a`; has `player_id` |
| W1-03 | `rating.wave1.01@staging.local` | **READY** | Created auth + profile |
| W1-04 | `rating.wave1.02@staging.local` | **READY** | Created |
| W1-05 | `rating.wave1.03@staging.local` | **READY** | Created |
| W1-06 | `rating.wave1.04@staging.local` | **READY** | Created |
| W1-07 | `rating.wave1.05@staging.local` | **READY** | Created |
| W1-08 | `rating.wave1.06@staging.local` | **READY** | Created |
| W1-09 | `rating.wave1.07@staging.local` | **READY** | Created |
| W1-10 | `rating.wave1.08@staging.local` | **READY** | Created |
| W1-11 | `rating.wave1.09@staging.local` | **READY** | Created |
| W1-12 | `rating.wave1.10@staging.local` | **READY** | Created |

## Excluded from Wave 1 cohort

| Email | Reason |
|-------|--------|
| `player@staging.local` | Wave 0 enrolled (`v5-shadow-pilot-wave0`) |
| `player.nomember@staging.local` | Wave 0 enrolled |
| `vicepresident@staging.local` | Wave 0 enrolled |
| `huynhanh1970@gmail.com` | Non-`@staging.local`; omitted from pilot cohort file |
| `lephong.eximbank@gmail.com` | Non-`@staging.local` |
| `nguoichoi@gmail.com` | Non-`@staging.local` |
| `player@gmail.com` | Non-`@staging.local` |
| `superadm@gmail.com` | Non-`@staging.local` |

## Identity consistency checks

- Duplicate auth user in cohort: **0**
- Duplicate player/email in cohort: **0**
- Missing tenant in cohort: **0**
- Missing PLAYER role: **0**
- Cross-tenant mismatch (profile vs manifest): **0**

## Coach / court estimate

All 12 slots:

- `coach_estimate`: empty (not invented)
- `coach_review_status`: `PENDING_COACH_REVIEW`
- `court_test_status`: `PENDING`

## Security

- Accounts created via staging service-role admin path only
- Password sourced from env (`STAGING_PLAYER_NEW_PASSWORD` / `STAGING_WAVE1_ACCOUNT_PASSWORD`); not logged or committed
- Cohort CSV contains no passwords, JWT, or keys

## Artifacts

- Cohort: `docs/v5/rating-v5/V5-C1C_WAVE1_COHORT_REVIEW.csv`
- Prepare report: `artifacts/rating-v5-wave1/2026-07-13T12-15-05-589Z/prepare-report.json`
