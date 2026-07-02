# Phase 11B — Marketplace/API Staging Persistence & RLS QA

**Ngày:** 2026-07-01  
**Branch:** `v5-platform-edition` (post `d8c1b8b` Phase 11A)  
**Supabase staging:** `qyewbxjsiiyufanzcjcq`  
**Production:** không apply

## Verdict (closeout — sau apply 11a-rls)

| Gate | Verdict | Ghi chú |
|------|---------|---------|
| SQL `phase11a-rls` applied | **PASS** | User applied trên `qyewbxjsiiyufanzcjcq` |
| SQL `phase11b-persistence` | **PENDING** | `tenant_integration_settings`, `integration_audit_logs` chưa có |
| Sprint 10 tables + RLS (JWT Owner A) | **PASS** | `api_clients`, `api_keys`, `webhook_endpoints`, `webhook_events`, `marketplace_products` |
| Owner A manage insert | **PASS** | `api_clients`, `webhook_endpoints` insert OK |
| Owner B JWT RLS | **BLOCKED** | Login fail — cần reset password / `.env.staging-qa.local` |
| PLAYER JWT RLS | **BLOCKED** | Login fail — cần creds staging |
| Store layer | **DONE** | Supabase mode → `tenant_integration_settings` (sau apply 11b) |
| Cross-tenant bidirectional | **PARTIAL** | Chỉ verify Owner A; Owner B chưa login |

**JWT verify (2026-07-01):** `PASS=7 PARTIAL=2 BLOCKED=4 FAIL=0`  
Script: `node scripts/verify-phase11b-marketplace-rls-staging.mjs` (authenticated JWT only).

**Chưa sẵn sàng Phase 11C** — apply `phase11b-persistence.sql` + Owner B/PLAYER creds + bidirectional RLS PASS.

---

## A. SQL staging

### Apply order (staging only)

1. `docs/supabase-sprint10.sql` (nếu chưa có bảng Sprint 10)
2. `docs/supabase-sprint10-phase11a-rls.sql` (RLS + `webhook_endpoints`)
3. `docs/supabase-sprint10-phase11b-persistence.sql` (**mới** — `tenant_integration_settings`, `integration_audit_logs`)

### Automated apply (optional)

```bash
# .env.local — KHÔNG commit
SUPABASE_DB_URL=postgresql://postgres.qyewbxjsiiyufanzcjcq:***@...pooler.supabase.com:6543/postgres

npm install pg --save-dev   # một lần
node scripts/apply-phase11b-staging-sql.mjs
```

Nếu thiếu `SUPABASE_DB_URL`: script in hướng dẫn manual (exit 2).

### Rollback

1. `docs/supabase-sprint10-phase11b-rollback.sql`
2. `docs/supabase-sprint10-phase11a-rollback.sql` (nếu cần gỡ RLS + `webhook_endpoints`)

### Bảng / policies (sau apply)

| Bảng | Phase | RLS |
|------|-------|-----|
| `tenant_integration_settings` | 11B | select own venue; manage venue staff |
| `integration_audit_logs` | 11B | select own; insert staff; admin all |
| `webhook_endpoints` | 11A | select own; manage staff |
| `webhook_events` | Sprint 10 | select own; manage super_admin only |
| `api_clients` | Sprint 10 | select own; manage staff |
| `api_keys` | Sprint 10 | select own; manage staff (**hash only**) |
| `api_logs` | Sprint 10 | select own; insert admin |
| `marketplace_*` | Sprint 10 | tenant isolation |
| `payment_transactions` | Sprint 10 | select own; manage admin |
| `notification_logs` | Sprint 10 | select own |

**Mapping tên:** không có `tenant_api_keys` — dùng `api_keys` (Sprint 10).

### Trạng thái apply (session 2026-07-01)

| SQL | Applied |
|-----|---------|
| `supabase-sprint10.sql` | ✅ (prerequisite — tables probe OK) |
| `supabase-sprint10-phase11a-rls.sql` | ✅ User applied |
| `supabase-sprint10-phase11b-persistence.sql` | ❌ **Chưa apply** — cần bước tiếp theo |

### Schema probe (anon — không phải RLS verdict)

| Bảng | Trạng thái |
|------|------------|
| `webhook_endpoints` | ✅ EXISTS |
| `api_clients` | ✅ EXISTS |
| `api_keys` | ✅ EXISTS |
| `webhook_events` | ✅ EXISTS |
| `marketplace_products` | ✅ EXISTS |
| `tenant_integration_settings` | ❌ MISSING |
| `integration_audit_logs` | ❌ MISSING |

---

## B. Store layer

### Mode resolution

| Env | Mode |
|-----|------|
| `NODE_ENV=test` | `memory` |
| `VITE_INTEGRATIONS_STORE_MODE` | force `memory` \| `local` \| `supabase` |
| Supabase configured + `VITE_INTEGRATIONS_SUPABASE !== false` | `supabase` |
| default | `local` (localStorage) |

### Files

| Path | Role |
|------|------|
| `src/features/integrations/repositories/integrationRepository.js` | mode resolve |
| `src/features/integrations/repositories/integrationStoreRuntime.js` | singleton, hydrate, persist |
| `src/features/integrations/repositories/memoryIntegrationStore.js` | tests |
| `src/features/integrations/repositories/localIntegrationStore.js` | localStorage |
| `src/features/integrations/repositories/supabaseIntegrationStore.js` | `tenant_integration_settings` |
| `src/features/integrations/repositories/integrationRowMap.js` | strip secrets trước upsert |
| `src/features/integrations/models/integrationDefaults.js` | default disabled |
| `src/features/integrations/storage/integrationStorage.js` | facade → store |

### Behavior

- Đọc/ghi settings theo `tenant_id` (= `venues.id`)
- Tất cả provider **mặc định disabled**
- `mock_payment` → `mock_only` khi bật explicitly
- **Không** lưu secret provider trong JSON (`stripSecrets` trên serialize)
- API keys: app vẫn localStorage (`apiStorage.js`); DB `api_keys.hashed_key` khi wire Phase 11C
- Webhook endpoints: bảng `webhook_endpoints` — chưa outbound worker

### UI

`IntegrationSettingsPage` gọi `hydrateIntegrationSettings(tenantId)` khi mount (Supabase mode).

---

## C. RLS verify (JWT)

### Script

```bash
STAGING_OWNER_A_PASSWORD=... \
STAGING_OWNER_B_PASSWORD=... \
STAGING_PLAYER_PASSWORD=... \
  node scripts/verify-phase11b-marketplace-rls-staging.mjs
```

### Matrix (kỳ vọng sau SQL apply)

| Actor | Read own tenant tables | Write own settings | Write other tenant | api_clients / webhooks manage |
|-------|------------------------|--------------------|--------------------|-------------------------------|
| Owner A | PASS | PASS | FAIL (RLS) | PASS |
| Owner B | PASS | PASS | FAIL | PASS |
| PLAYER | PASS (read own venue) | FAIL | FAIL | FAIL |

Kết luận **chỉ** từ authenticated JWT — không dùng `service_role` để đánh giá.

### Kết quả JWT verify (Owner A — authenticated)

| Bảng / action | Owner A |
|---------------|---------|
| `api_clients` select | ✅ PASS (0 rows, isolated) |
| `api_keys` select | ✅ PASS |
| `webhook_endpoints` select | ✅ PASS |
| `webhook_events` select | ✅ PASS |
| `marketplace_products` select | ✅ PASS |
| `api_clients` insert own tenant | ✅ PASS |
| `webhook_endpoints` insert own tenant | ✅ PASS |
| `tenant_integration_settings` | ⏳ BLOCKED (bảng chưa apply) |

Owner B / PLAYER: **BLOCKED** (login credentials — cấu hình `.env.staging-qa.local`, không commit).

---

## D. UI QA `/settings/integrations`

| Check | Kỳ vọng | Trạng thái |
|-------|---------|------------|
| COURT_OWNER / VENUE_OWNER mở được | RBAC `INTEGRATION_VIEW` | ⏳ Manual sau SQL |
| PLAYER không manage | `canManageIntegrations` false | ✅ Unit (Sprint 10) |
| Provider list đủ 7 | Zalo, Email, SMS, VNPay, MoMo, Stripe, mock | ✅ Code |
| Mặc định disabled | `integrationDefaults` | ✅ Tests |
| Toggle không network thật | mock notification only | ✅ |
| Reload giữ settings (Supabase) | hydrate + persist | ⏳ Sau SQL apply |

---

## E. Security notes

- Raw API key: chỉ trả một lần khi generate; DB chỉ `hashed_key`
- Provider secrets: env/server only — stripped khỏi `tenant_integration_settings.settings`
- Không secret trong repo / không commit `.env.local`
- Không network call VNPay/MoMo/Stripe/Zalo/SMS/Email thật
- Public API: vẫn **tắt** (`VITE_API_ENABLED=false`); rate limit chưa enforce

---

## F. Test / build / lint

| Command | Result |
|---------|--------|
| `npm test` | **658 pass, 0 fail** |
| `npm run build` | **PASS** |
| `npm run lint` | **0 errors** |

---

## G. Known risks / Phase 11C

| Risk | Severity |
|------|----------|
| Sprint 10 base tables chưa apply staging | P0 blocker |
| `api_keys` app layer vẫn localStorage | P1 — wire Supabase Phase 11C |
| Rate limit / public API guard | P1 — Phase 11C edge |
| Webhook ingress signature | P1 — Phase 11C |

### Phase 11C đề xuất

1. Apply SQL staging + JWT verify **PASS**
2. Wire `apiKeyService` → Supabase `api_clients` / `api_keys`
3. Edge API router + rate limit enforce
4. Webhook ingress Edge Function
5. Outbound webhook worker (retry design từ 11A)

---

## Files Phase 11B (code)

- `docs/supabase-sprint10-phase11b-persistence.sql`
- `docs/supabase-sprint10-phase11b-rollback.sql`
- `scripts/apply-phase11b-staging-sql.mjs`
- `scripts/verify-phase11b-marketplace-rls-staging.mjs`
- `tests/phase11b-marketplace-api-staging.test.js`
- `src/features/integrations/repositories/*`
- `src/features/integrations/models/integrationDefaults.js`

**Commit:** chưa commit (working tree có thay đổi).
