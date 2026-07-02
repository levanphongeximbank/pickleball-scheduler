# Phase 11D — Supabase API Key Runtime Staging QA

**Trạng thái:** Chờ chạy verify sau deploy Preview với `API_KEY_STORE=supabase`  
**Branch:** `v5-platform-edition`  
**Spec:** `docs/v5/PHASE_11D_SUPABASE_API_KEY_RUNTIME.md`

## Prerequisites

| Bước | Trạng thái |
|------|------------|
| Phase 11C PASS | ✅ |
| Code P0 merged / deployed Preview | ⏳ |
| `API_KEY_STORE=supabase` trên Vercel Preview | ⏳ |
| `SUPABASE_SERVICE_ROLE_KEY` trên Vercel Preview (server) | ⏳ |
| `API_RATE_LIMIT_REQUESTS_PER_MINUTE=1` trên Preview | ⏳ |
| `VITE_API_ENABLED=true` | ✅ |

## Verify command

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=<secret> \
STAGING_PREVIEW_URL=<preview-url> \
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role> \
node scripts/verify-phase11d-api-key-runtime-staging.mjs
```

## Expected matrix

| Scenario | HTTP | `code` |
|----------|------|--------|
| `GET /api/v1/health` | 200 | `ok` |
| `GET /api/v1/tenant` (no key) | 401 | `unauthorized` |
| `GET /api/v1/tenant` (invalid key) | 401 | `invalid_api_key` |
| `GET /api/v1/tenant` (valid key A) | 200 | `ok` |
| `GET /api/v1/integrations` (missing scope) | 403 | `scope_denied` |
| `GET /api/v1/integrations` (valid scope) | 200 | `ok` |
| `GET /api/v1/tenant?tenantId=B` (key A) | 403 | `tenant_not_found` |
| `GET /api/v1/tenant?tenantId=A` (key B) | 403 | `tenant_not_found` |
| Revoked key | 401 | `invalid_api_key` |
| Expired key | 401 | `invalid_api_key` |
| Rate limit (2× rapid) | 429 or `NOT_APPLICABLE` | `rate_limited` / multi-instance |
| `GET /api/v1/webhooks/test` | 200 | `ok` |
| `POST /api/v1/webhooks/test` (read-only key) | 403 | `scope_denied` |
| `POST /api/v1/webhooks/test` (write key) | 200 | `ok` |

## Rate limit note

- `API_RATE_LIMIT_REQUESTS_PER_MINUTE=1` on Preview enables env override (router passes empty `limits`, not default 120).
- In-memory counter is per serverless instance — verify may mark `NOT_APPLICABLE` when requests hit different instances (P2: distributed limit).
- Unit tests (`phase11c`, `phase11d`) still **PASS**.

## Verdict

| Counter | Giá trị |
|---------|---------|
| PASS | — |
| FAIL | — |
| BLOCKED | — |
| PARTIAL | — |

**Phase 11D staging closeout:** PENDING
