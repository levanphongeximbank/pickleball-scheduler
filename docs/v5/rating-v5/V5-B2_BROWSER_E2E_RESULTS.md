# V5-B.2 — Browser E2E Results (Staging)

**Date:** 2026-07-12  
**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Route:** `/player/skill-assessment-v5`  
**Runner:** `scripts/verify-v5b2-browser-e2e-staging.mjs`  
**Status:** **BLOCKED** (script ready; env not configured)

---

## How to run

```powershell
# .env.staging-qa.local (gitignored)
STAGING_PREVIEW_URL=https://<your-branch-preview>.vercel.app
STAGING_PLAYER_EMAIL=player@staging.local
STAGING_PLAYER_PASSWORD=<password>
STAGING_NON_COHORT_EMAIL=owner-b@staging.local
STAGING_NON_COHORT_PASSWORD=<password>
STAGING_SUPABASE_PROJECT_REF=qyewbxjsiiyufanzcjcq
VERCEL_AUTOMATION_BYPASS_SECRET=<if deployment protection enabled>

npx playwright install chromium
npm run qa:v5b2:browser
```

Preview must include V5-B.2 commit + `VITE_PICK_VN_RATING_V5_ENABLED=true`.

**Do not** use Production URL or ref `expuvcohlcjzvrrauvud`.

---

## Latest run

```text
BROWSER E2E: BLOCKED
PASS: 0 / FAIL: 0 / BLOCKED: 14 / TOTAL: 14
Blocker: STAGING_PREVIEW_URL, STAGING_PLAYER_PASSWORD, STAGING_NON_COHORT_PASSWORD missing
```

Evidence: `docs/v5/rating-v5/qa-evidence/v5-b2-browser/LATEST_RUN.json`  
Artifacts on failure: `artifacts/v5b2-browser-e2e/<run-id>/`

---

## 14-test checklist

| # | ID | Scenario | Result |
|---|-----|----------|--------|
| 1 | t01_login_cohort | Login cohort user | BLOCKED |
| 2 | t02_menu_v5 | Menu `Đánh giá V5 (shadow)` | BLOCKED |
| 3 | t03_route_v5 | Route `/player/skill-assessment-v5` | BLOCKED |
| 4 | t04_question_counts | 22 core / ≤8 adaptive / ≤30 total | BLOCKED |
| 5 | t05_terminology | No unresolved placeholders | BLOCKED |
| 6 | t06_back_next | Back/Next preserves answers | BLOCKED |
| 7 | t07_draft_resume | Reload resumes draft | BLOCKED |
| 8 | t08_payload_allowlist | Edge payload 4 fields only | BLOCKED |
| 9 | t09_ui_parity | UI matches canonical response | BLOCKED |
| 10 | t10_shadow_notice | Shadow notice always shown | BLOCKED |
| 11 | t11_rating_cap | Cap 4.5 + under_review | BLOCKED |
| 12 | t12_idempotency | No duplicate events | BLOCKED |
| 13 | t13_v2_isolation | V2 unchanged | BLOCKED |
| 14 | t14_non_cohort | Non-cohort blocked | BLOCKED |

---

## Acceptance gate

```text
BROWSER E2E: 14/14 PASS
UNRESOLVED PLACEHOLDERS: 0
DUPLICATE ASSESSMENTS: 0
DUPLICATE EVENTS: 0
V2 MUTATIONS: 0
PRODUCTION REQUESTS: 0
```

---

## Script safeguards

- Fail-fast env guard (HTTPS, staging ref, no production ref)
- Preview `/login` probe before browser
- Network guard: stops on `expuvcohlcjzvrrauvud` requests
- JWT/anon only for DB checks (no service role in script)
- No passwords/tokens in logs or artifact JSON
