# Phase 11C — Edge API Key Guard Staging QA

**Ngày test:** 2026-07-02 ~16:33 ICT (manual) · automation final **PASS** cùng ngày  
**Branch:** `v5-platform-edition`  
**Preview URL:** https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app  
**Deployment:** `dpl_91SmVoF3sDBp4tia5SWJ3HEp7R5a`  
**Commit:** `f028503` (trên `470faef` — P0 `localStorage` serverless fix)  
**Supabase staging:** `qyewbxjsiiyufanzcjcq`  
**Env Preview:** `VITE_API_ENABLED=true`  
**Production:** không apply

## Verdict

| Gate | Verdict | Ghi chú |
|------|---------|---------|
| `VITE_API_ENABLED=true` trên Preview | **PASS** | `/api/v1/tenant` trả JSON `unauthorized`, không còn `feature_disabled` |
| GET `/api/v1/tenant` không API key | **PASS** | **HTTP 401** + `code: unauthorized` — manual browser 2026-07-02 (§B2) |
| GET `/api/v1/health` | **PASS** | HTTP **200** + `code: ok` — `vercel curl` 2026-07-02 (§B1) |
| GET `/api/v1/tenant` API key sai | **PASS** | HTTP **401** + `code: invalid_api_key` — `vercel curl` (§B3) |
| Route không tồn tại | **PASS** | HTTP **404** + `code: not_found` — `vercel curl` (§B4) |
| Không 500 / `FUNCTION_INVOCATION_FAILED` | **PASS** | Không thấy trong `vercel curl` + browser |
| Không `localStorage is not defined` | **PASS** | Fix `470faef` — runtime storage trên serverless |
| In-memory edge router (script §D) | **PASS** | 17/17 scenario PASS |
| Supabase `api_keys` schema | **PASS** | Columns đủ; indexes PARTIAL (filter OK) |
| JWT RLS + RBAC | **PASS** | Owner A/B/PLAYER isolated; `api.manage` gate OK |
| Automated verify script (final) | **PASS** | `PASS: 31` `FAIL: 0` `BLOCKED: 0` `PARTIAL: 0` `NOT_APPLICABLE: 11` |
| Automated Preview HTTP (script §B–§C) | **PASS** | Sau fix URL composition + fetch isolation (`phase11c-preview-http.mjs`) + bypass secret |
| Valid-key HTTP trên Preview | **NOT_APPLICABLE** | In-memory key store — wire Supabase Phase 11D |

**Phase 11C staging closeout: PASS** — gate bắt buộc đạt: missing API key → **HTTP 401** `unauthorized` trên Preview (§B2).

---

## A. Prerequisites

| Bước | Trạng thái |
|------|------------|
| Apply `docs/supabase-sprint10-phase11c-api-key-guard.sql` | ✅ |
| `VITE_API_ENABLED=true` trên Vercel Preview | ✅ |
| Redeploy Preview sau khi bật flag | ✅ |

## B. Preview HTTP verification (2026-07-02)

Phương pháp: `npx vercel curl --yes` (CLI bypass Deployment Protection) + browser manual (§B2).

### B1. GET `/api/v1/health` — `vercel curl`

```
npx vercel curl --yes "/api/v1/health" \
  --deployment "https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app"
```

| Field | Giá trị |
|-------|---------|
| HTTP status | **200** |
| `ok` | `true` |
| `code` | `ok` |

```json
{
  "ok": true,
  "code": "ok",
  "message": "OK",
  "data": { "status": "ok", "version": "v1", "layer": "edge" },
  "requestId": "..."
}
```

### B2. GET `/api/v1/tenant` — không API key *(gate bắt buộc)*

Browser + `vercel curl` — cùng kết quả.

| Field | Giá trị |
|-------|---------|
| HTTP status | **401** |
| `ok` | `false` |
| `code` | `unauthorized` |
| `message` | `Thiếu API key.` |
| `data` | `null` |

Response body (redacted `requestId`):

```json
{
  "ok": false,
  "code": "unauthorized",
  "message": "Thiếu API key.",
  "data": null,
  "requestId": "..."
}
```

> Xác nhận: API layer active — **không** còn `feature_disabled` (503).

### B3. GET `/api/v1/tenant` — API key sai — `vercel curl`

```
npx vercel curl --yes "/api/v1/tenant" \
  -H "x-api-key: pk_invalid.notarealkey000000000000000000000000" \
  --deployment "https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app"
```

| Field | Giá trị |
|-------|---------|
| HTTP status | **401** |
| `ok` | `false` |
| `code` | `invalid_api_key` |
| `message` | `API key không hợp lệ.` |

```json
{
  "ok": false,
  "code": "invalid_api_key",
  "message": "API key không hợp lệ.",
  "data": null,
  "requestId": "..."
}
```

### B4. GET route không tồn tại — `vercel curl`

```
npx vercel curl --yes "/api/v1/not-found-route" \
  --deployment "https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app"
```

| Field | Giá trị |
|-------|---------|
| HTTP status | **404** |
| `ok` | `false` |
| `code` | `not_found` |
| `message` | `Route không tồn tại.` |
| `data.path` | `/api/v1/not-found-route` |

```json
{
  "ok": false,
  "code": "not_found",
  "message": "Route không tồn tại.",
  "data": { "path": "/api/v1/not-found-route" },
  "requestId": "..."
}
```

### B5. Negative checks

| Check | Kết quả |
|-------|---------|
| HTTP 500 | Không thấy |
| `FUNCTION_INVOCATION_FAILED` | Không thấy |
| `localStorage is not defined` | Không thấy |
| Response HTML (SPA) cho `/api/v1/*` | Không — JSON envelope đúng spec |

## C. Automated verify script

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=<from Vercel Project Settings → Deployment Protection> \
STAGING_PREVIEW_URL=https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app \
node scripts/verify-phase11c-api-key-guard-staging.mjs
```

### C1. Lần chạy đầu (chưa có bypass secret)

**Kết quả:** `PASS=26 FAIL=0 BLOCKED=4 PARTIAL=0` → script verdict **PARTIAL**

| Section | Kết quả |
|---------|---------|
| §D In-memory edge invoke | **PASS** |
| §B Preview deployment probe | **BLOCKED** — Vercel Deployment Protection HTML |
| §C Preview HTTP | **BLOCKED** — cùng lý do |
| §A Schema | **PASS** columns; indexes PASS (filter OK) |
| §F JWT RLS + RBAC | **PASS** |

### C2. Sau khi set bypass secret — lỗi URL composition trong script

Manual `curl.exe` với header `x-vercel-protection-bypass` đã **PASS** (`GET /api/v1/health` → HTTP 200 JSON).

Script vẫn **PARTIAL** do bug ghép URL (không phải Deployment Protection):

| Triệu chứng | Nguyên nhân |
|-------------|-------------|
| Preview URL log `...vercel.appp` | Env/base URL bị corrupt hoặc hostname bị sửa sai — script **không** được tự sửa hostname |
| Fetch URL `.../api//v1/health` | Nối path sai (`/api/` + `/v1/...`) → `TypeError: fetch failed` |

**Kết luận đúng lúc đó:**

| Gate | Verdict |
|------|---------|
| Phase 11C app/API | **PASS** |
| Manual browser/curl gate | **PASS** |
| Vercel bypass secret | **PASS** |
| Automation script | **PARTIAL** — URL composition bug |

### C3. Sau fix URL composition + fetch isolation (2026-07-02) — **PASS**

Fix trong `scripts/phase11c-preview-http.mjs` + `scripts/verify-phase11c-api-key-guard-staging.mjs`:

- `normalizePreviewBaseUrl`: trim, strip control chars/BOM, bỏ trailing `/` — **không** sửa hostname
- `buildPreviewUrl`: nối `base + endpoint`, collapse slash trong path → không còn `/api//v1/*`
- **Fetch isolation:** module `phase11c-preview-http.mjs` capture `globalThis.fetch` trước khi import app modules — không bị polyfill/mock ghi đè
- Mọi Preview `fetch` gắn `x-vercel-protection-bypass: VERCEL_AUTOMATION_BYPASS_SECRET`
- Network/URL errors → **FAIL** (không ghi nhầm BLOCKED Deployment Protection)

**Kết quả chạy thực tế (final automation):**

```
Preview URL: https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app
PASS: 31
FAIL: 0
BLOCKED: 0
PARTIAL: 0
NOT_APPLICABLE: 11
Phase 11C staging verify: PASS
```

| Section | Kết quả |
|---------|---------|
| §B Preview deployment probe | **PASS** — health 200 `ok:true` |
| §C Preview HTTP | **PASS** — xem bảng dưới |
| §D In-memory edge invoke | **PASS** |
| §A Schema + §F RLS/RBAC | **PASS** |
| Valid-key HTTP scenarios | **NOT_APPLICABLE** (11) — Phase 11D |

**§C Preview HTTP — automation PASS:**

| Endpoint | HTTP | `code` |
|----------|------|--------|
| `GET /api/v1/health` | 200 | `ok` |
| `GET /api/v1/does-not-exist-route` | 404 | `not_found` |
| `GET /api/v1/tenant` (no key) | 401 | `unauthorized` |
| `GET /api/v1/tenant` (invalid key) | 401 | `invalid_api_key` |

## D. In-memory edge results (representative)

| Test | HTTP | Code |
|------|------|------|
| public health | 200 | `ok` |
| missing key | 401 | `unauthorized` |
| invalid key | 401 | `invalid_api_key` |
| not found | 404 | `not_found` |
| valid key | 200 | `ok` |
| missing scope | 403 | `scope_denied` |
| wrong tenant | 403 | `tenant_not_found` |
| revoked / expired | 401 | `invalid_api_key` |
| rate limit | 429 | `rate_limited` |

## E. Handoff Phase 11D

Phase 11C **đóng** — automation + manual gate đạt. Phase 11D tiếp theo:

| Hạng mục | Mô tả |
|----------|-------|
| Supabase-backed key store runtime | Wire `api_keys` lookup trên Vercel serverless (valid-key HTTP scenarios hiện `NOT_APPLICABLE`) |
| Valid-key HTTP trên Preview | Owner A/B tenant isolation, scope denied, revoked/expired — qua DB thật |
| `integration_audit_logs` | Persist audit events thay localStorage test |
| `integrations:write` scope | Reserved trong scope matrix |
| Redis / distributed rate limit | Thay in-memory counter production-scale |
| API key UI management | `canManageApiKeys` RBAC gate sẵn |

**Prerequisites 11D:** Phase 11C PASS (doc này), SQL `api_keys` schema đã apply staging, Preview `VITE_API_ENABLED=true`.

## F. Rollback

Xem `docs/v5/PHASE_11C_EDGE_API_KEY_GUARD.md` §10.
