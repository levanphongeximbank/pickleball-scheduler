# Phase 11E — Integration Audit Logs Staging QA

**Trạng thái:** ✅ **PASS** (2026-07-03)  
**Branch:** `v5-platform-edition`  
**Spec:** `docs/v5/PHASE_11E_INTEGRATION_AUDIT_LOGS.md`  
**Production:** không deploy

---

## A. Prerequisites

| Bước | Trạng thái |
|------|------------|
| Phase 11D PASS | ✅ |
| Code P0 merged / deployed Preview | ✅ |
| `docs/supabase-sprint10-phase11e-integration-audit.sql` applied staging | ✅ |
| Legacy `action`/`meta` nullable (re-apply sau `cd21ba1`) | ✅ |
| `API_KEY_STORE=supabase` trên Vercel Preview | ✅ |
| `AUDIT_STORE=supabase` trên Vercel Preview | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` trên Vercel Preview (server only) | ✅ |
| `SUPABASE_URL` trên Vercel Preview | ✅ |
| `VITE_API_ENABLED=true` | ✅ |

### Commits liên quan

| Commit | Mô tả |
|--------|-------|
| `4c36469` | `feat(api): add Phase 11E integration audit logs` |
| `d463ce5` | `fix(api): await integration audit insert on serverless` |
| `cd21ba1` | `fix(api): make legacy audit columns nullable` |

---

## B. Verify command

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=<secret> \
STAGING_PREVIEW_URL=<preview-url> \
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role> \
node scripts/verify-phase11e-integration-audit-staging.mjs
```

Script tự: probe schema (11E columns + legacy nullable), seed fixtures, clear probe audit rows, Preview HTTP + Supabase audit assert, cleanup. Không commit raw keys.

---

## C. Final automation result (2026-07-03)

```
PASS: 21
FAIL: 0
BLOCKED: 0
PARTIAL: 0
Phase 11E staging verify: PASS
```

| # | Scenario | Verdict |
|---|----------|---------|
| 1 | schema `integration_audit_logs` + 11E columns | **PASS** |
| 2 | legacy `action` nullable (11B upgrade) | **PASS** |
| 3 | legacy `meta` nullable (11B upgrade) | **PASS** |
| 4 | seed fixtures (10 keys) | **PASS** |
| 5 | integrations read — HTTP | **PASS** — 200 `ok` |
| 6 | integrations read — audit row | **PASS** — `integration.read` |
| 7 | integrations write — HTTP | **PASS** — 200 `ok` |
| 8 | integrations write — audit row | **PASS** — `integration.write` |
| 9 | integrations write denied — HTTP | **PASS** — 403 `scope_denied` |
| 10 | integrations write denied — audit row | **PASS** — `api_key.scope_denied` |
| 11 | missing key — HTTP | **PASS** — 401 `unauthorized` |
| 12 | missing key — audit row | **PASS** — `api_key.denied` |
| 13 | invalid key — HTTP | **PASS** — 401 `invalid_api_key` |
| 14 | invalid key — audit row | **PASS** — `api_key.denied` |
| 15 | revoked key — HTTP | **PASS** — 401 `invalid_api_key` |
| 16 | revoked key — audit row | **PASS** — `api_key.denied` |
| 17 | webhook read — HTTP | **PASS** — 200 `ok` |
| 18 | webhook read — audit row | **PASS** — `webhook.read` |
| 19 | webhook write — HTTP | **PASS** — 200 `ok` |
| 20 | webhook write — audit row | **PASS** — `webhook.write` |
| 21 | output safety (stdout redaction) | **PASS** |

### Preview HTTP matrix — chi tiết

| Endpoint | HTTP | `code` | Audit `event_type` | Kết quả |
|----------|------|--------|---------------------|---------|
| `GET /api/v1/integrations` (read key) | 200 | `ok` | `integration.read` | PASS |
| `POST /api/v1/integrations/zalo/test-write` (write key) | 200 | `ok` | `integration.write` | PASS |
| `POST /api/v1/integrations/zalo/test-write` (read-only key) | 403 | `scope_denied` | `api_key.scope_denied` | PASS |
| `GET /api/v1/integrations` (no key) | 401 | `unauthorized` | `api_key.denied` | PASS |
| `GET /api/v1/integrations` (invalid key) | 401 | `invalid_api_key` | `api_key.denied` | PASS |
| `GET /api/v1/integrations` (revoked key) | 401 | `invalid_api_key` | `api_key.denied` | PASS |
| `GET /api/v1/webhooks/test` | 200 | `ok` | `webhook.read` | PASS |
| `POST /api/v1/webhooks/test` (write key) | 200 | `ok` | `webhook.write` | PASS |

Audit rows asserted on staging Supabase via `request_id`, `event_type`, `result_code`, `scope_required`, `status_code`, `key_prefix`. Một row per request.

Không có HTTP 500, `FUNCTION_INVOCATION_FAILED`, hay `localStorage is not defined`.

---

## D. Staging fixes applied

| Issue | Symptom | Fix commit |
|-------|---------|------------|
| Serverless fire-and-forget audit | HTTP PASS, no audit rows in DB | `d463ce5` — bounded `await` in `edgeApiRouter.finish()` |
| Legacy `action NOT NULL` | Vercel log: `null value in column "action"` | `cd21ba1` — migration drops NOT NULL on `action`/`meta` |

Phase 11E code writes canonical columns only (`event_type`, `metadata`, …). Legacy `action`/`meta` retained nullable for 11B backward compatibility.

---

## E. Vercel Preview env (đã dùng)

| Variable | Giá trị |
|----------|---------|
| `API_KEY_STORE` | `supabase` |
| `AUDIT_STORE` | `supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | set trên Vercel Preview (server only) |
| `SUPABASE_URL` | set |
| `VITE_API_ENABLED` | `true` |

> Không ghi secret thật vào docs. Operator set qua Vercel Dashboard.

---

## F. Verdict

| Counter | Giá trị |
|---------|---------|
| PASS | **21** |
| FAIL | **0** |
| BLOCKED | **0** |
| PARTIAL | **0** |

**Phase 11E staging closeout: PASS**

---

## G. Handoff

Phase 11E **đóng** — persistent `integration_audit_logs` trên Supabase staging + Preview verify đạt P0 matrix.

| Hạng mục | Trạng thái |
|----------|------------|
| Production deploy | **Không** — chờ approval riêng |
| API key management UI | P2 |
| Distributed rate limit | P2 |
| Pop stash `IntegrationSettingsPage.jsx` | **Không** trong scope 11E |
