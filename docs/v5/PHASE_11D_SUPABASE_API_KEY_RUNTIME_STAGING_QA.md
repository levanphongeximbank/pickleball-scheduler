# Phase 11D — Supabase API Key Runtime Staging QA

**Trạng thái:** ✅ **PASS** (2026-07-02)
**Branch:** `v5-platform-edition`  
**Spec:** `docs/v5/PHASE_11D_SUPABASE_API_KEY_RUNTIME.md`
**Production:** không deploy

---

## A. Prerequisites

| Bước | Trạng thái |
|------|------------|
| Phase 11C PASS | ✅ |
| Code P0 merged / deployed Preview | ✅ |
| `API_KEY_STORE=supabase` trên Vercel Preview | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` trên Vercel Preview (server) | ✅ |
| `SUPABASE_URL` trên Vercel Preview | ✅ |
| `API_RATE_LIMIT_REQUESTS_PER_MINUTE=1` trên Preview | ✅ |
| `VITE_API_ENABLED=true` | ✅ |

### Commits liên quan

| Commit | Mô tả |
|--------|-------|
| `ac98479` | `feat(api): add Phase 11D Supabase API key runtime` |
| `00ee490` | `fix(api): apply Phase 11D rate limit env override` |
| `091e289` | `fix(api): isolate Phase 11D webhook rate-limit verification` |

---

## B. Verify command

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=<secret> \
STAGING_PREVIEW_URL=<preview-url> \
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role> \
node scripts/verify-phase11d-api-key-runtime-staging.mjs
```

Script tự seed fixtures (`Phase11D Probe *`), chạy Preview HTTP matrix, cleanup sau run. Không commit raw keys.

---

## C. Final automation result (2026-07-02)

```
PASS: 16
FAIL: 0
BLOCKED: 0
PARTIAL: 0
Phase 11D staging verify: PASS
```

| # | Scenario | Verdict |
|---|----------|---------|
| 1 | seed fixtures | **PASS** |
| 2 | health (`GET /api/v1/health`) | **PASS** |
| 3 | missing key | **PASS** — 401 `unauthorized` |
| 4 | invalid key | **PASS** — 401 `invalid_api_key` |
| 5 | valid key (tenant A) | **PASS** — 200 `ok` |
| 6 | missing scope | **PASS** — 403 `scope_denied` |
| 7 | valid scope (`integrations:read`) | **PASS** — 200 `ok` |
| 8 | wrong tenant A→B | **PASS** — 403 `tenant_not_found` |
| 9 | wrong tenant B→A | **PASS** — 403 `tenant_not_found` |
| 10 | revoked key | **PASS** — 401 `invalid_api_key` |
| 11 | expired key | **PASS** — 401 `invalid_api_key` |
| 12 | rate limit (2× rapid, limit=1) | **PASS** — 429 `rate_limited` |
| 13 | webhook read | **PASS** — 200 `ok` |
| 14 | webhook write denied | **PASS** — 403 `scope_denied` |
| 15 | webhook write ok | **PASS** — 200 `ok` |
| 16 | output safety (stdout redaction) | **PASS** |

### Preview HTTP matrix — chi tiết

| Endpoint | HTTP | `code` | Kết quả |
|----------|------|--------|---------|
| `GET /api/v1/health` | 200 | `ok` | PASS |
| `GET /api/v1/tenant` (no key) | 401 | `unauthorized` | PASS |
| `GET /api/v1/tenant` (invalid key) | 401 | `invalid_api_key` | PASS |
| `GET /api/v1/tenant` (valid key A) | 200 | `ok` | PASS |
| `GET /api/v1/integrations` (missing scope) | 403 | `scope_denied` | PASS |
| `GET /api/v1/integrations` (valid scope) | 200 | `ok` | PASS |
| `GET /api/v1/tenant?tenantId=venue-staging-b` (key A) | 403 | `tenant_not_found` | PASS |
| `GET /api/v1/tenant?tenantId=venue-staging-a` (key B) | 403 | `tenant_not_found` | PASS |
| `GET /api/v1/tenant` (revoked key) | 401 | `invalid_api_key` | PASS |
| `GET /api/v1/tenant` (expired key) | 401 | `invalid_api_key` | PASS |
| 2× `GET /api/v1/tenant` (rate limit) | 429 | `rate_limited` | PASS |
| `GET /api/v1/webhooks/test` | 200 | `ok` | PASS |
| `POST /api/v1/webhooks/test` (read-only key) | 403 | `scope_denied` | PASS |
| `POST /api/v1/webhooks/test` (write key) | 200 | `ok` | PASS |

Không có HTTP 500, `FUNCTION_INVOCATION_FAILED`, hay `localStorage is not defined`.

---

## D. Vercel Preview env (đã dùng)

| Variable | Giá trị |
|----------|---------|
| `API_KEY_STORE` | `supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | set trên Vercel Preview (server only) |
| `SUPABASE_URL` | set |
| `VITE_API_ENABLED` | `true` |
| `API_RATE_LIMIT_REQUESTS_PER_MINUTE` | `1` (staging verify) |

> Không ghi secret thật vào docs. Operator set qua Vercel Dashboard.

### Rate limit note

- `API_RATE_LIMIT_REQUESTS_PER_MINUTE=1` + router passes empty `limits` → env override hoạt động trên Preview.
- Staging verify **PASS** rate limit (429 + `X-RateLimit-*` headers).
- Production-scale distributed limit vẫn P2 (Redis/Supabase counter).

---

## E. Verdict

| Counter | Giá trị |
|---------|---------|
| PASS | **16** |
| FAIL | **0** |
| BLOCKED | **0** |
| PARTIAL | **0** |

**Phase 11D staging closeout: PASS**

---

## F. Handoff Phase 11E

Phase 11D **đóng** — Supabase-backed API key runtime trên Vercel Preview đạt đủ P0 matrix. Phase 11E tiếp theo:

| Hạng mục | Mô tả |
|----------|-------|
| `integration_audit_logs` persist | `apiKeyAuditService` → Supabase insert |
| `integrations:write` scope | Route POST/PATCH khi cần |
| Distributed rate limit (P2) | Redis hoặc Supabase counter table |
| API key management UI (P2) | `IntegrationSettingsPage` + RBAC `api.manage` |

**Prerequisites 11E:** Phase 11D PASS (doc này), `API_KEY_STORE=supabase` trên Preview, schema `integration_audit_logs` đã apply staging.
