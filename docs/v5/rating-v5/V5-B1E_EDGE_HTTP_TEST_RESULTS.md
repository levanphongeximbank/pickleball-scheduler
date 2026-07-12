# V5-B.1E — Edge HTTP Test Results

**Date:** 2026-07-12 (hotfix: strict payload allowlist)  
**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Edge URL:** `https://qyewbxjsiiyufanzcjcq.supabase.co/functions/v1/rating-v5-complete-assessment`

---

## Hotfix V5-B.1E — FORBIDDEN PAYLOAD

### Root cause

`edgeEntry.js` **không gọi** `validateCompleteAssessmentPayload(body)` — chỉ pick `assessment_id`, `answers`, `rating_mode` rồi bỏ qua field cấm.

### Fix

1. Strict allowlist trong `completeAssessmentPayloadGuard.js` — chỉ 4 field snake_case
2. Validation chạy **ngay sau JSON parse, trước auth/scoring**
3. `scoreAssessmentCompletion.js` validate toàn bộ top-level keys (không pick-select)
4. Error `FORBIDDEN_PAYLOAD_FIELD` + `details.fields` (tên field, không giá trị)

### Local verification (pre-deploy)

| Suite | Result |
|-------|--------|
| `pick-vn-rating-v5-payload-guard.test.js` | **15/15 PASS** |
| `pick-vn-rating-v5-edge-payload.test.js` | **2/2 PASS** |
| `pick-vn-rating-v5-complete-assessment.test.js` | **20/20 PASS** |
| Pre-deploy checksums | **PASS** (v5.0f unchanged) |
| Bundle inspection | **PASS** |

**EDGE BUNDLE CHECKSUM (hotfix):** `b9675053312284929be43413cd7ab9c8da2ae05aa989caa30cdf73fb85eeda58`

---

## Staging HTTP (deployed bundle = pre-hotfix)

Last run against **old deployed bundle**:

```text
HTTP END-TO-END: 33/43 PASS
FAIL: payload_verified_rating, payload_domain_scores, payload_reliability_score
      + 7 new forbidden-field tests (expected until redeploy)
```

---

## Redeploy required

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
node scripts/predeploy-v5b1e-check.mjs
node scripts/deploy-v5b1e-edge-staging.mjs
node scripts/verify-v5b1e-edge-http-staging.mjs
```

**Acceptance target:** `43/43 PASS` (36 original + 7 forbidden-field tests)

---

## Error contract (forbidden payload)

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN_PAYLOAD_FIELD",
    "message": "Payload chứa trường không được phép.",
    "requestId": "...",
    "details": { "fields": ["verified_rating"] }
  },
  "request_id": "..."
}
```

Assessment remains `draft`, no rating event, no profile write, V2 unchanged.
