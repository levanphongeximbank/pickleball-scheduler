# Phase 12 — V5.0 RC1 Full QA & Release Readiness

**Ngày bắt đầu:** 2026-07-03  
**Phiên bản mục tiêu:** Pickleball Scheduler Pro **v5.0 RC1** — Platform Core  
**Branch:** `v5-platform-edition`  
**Môi trường:** Staging Supabase + Vercel Preview (chưa Production)

**Tiền đề đã PASS:**

| Phase | Kết quả | Tài liệu |
|-------|---------|----------|
| 11C Edge API key guard | ✅ PASS | `docs/v5/PHASE_11C_EDGE_API_KEY_GUARD_STAGING_QA.md` |
| 11D Supabase API key runtime | ✅ PASS | `docs/v5/PHASE_11D_SUPABASE_API_KEY_RUNTIME_STAGING_QA.md` |
| 11E Integration audit logs | ✅ PASS | `docs/v5/PHASE_11E_INTEGRATION_AUDIT_LOGS_STAGING_QA.md` |
| 10D Cross-tenant RLS | ✅ PASS | `docs/v5/PHASE_10D_CROSS_TENANT_RLS_QA.md` |
| 10E Billing tenant mapping | ✅ Hardened | `docs/v5/PHASE_10E_BILLING_TENANT_MAPPING.md` |

**Ràng buộc Phase 12:**

- Không deploy Production
- Không pop stash `IntegrationSettingsPage.jsx` trừ khi owner yêu cầu riêng
- Không ghi secret vào docs/logs
- Bug phát hiện → ghi bug list; chưa refactor lớn

---

## Tóm tắt điều hành

| Hạng mục | Giá trị |
|----------|---------|
| Tổng test case | 94 |
| P0 | 38 |
| P1 | 36 |
| P2 | 20 |
| Automated (staging script + unit) | 28 |
| Manual (browser/device) | 66 |

**Trạng thái tick (cập nhật khi QA):**

| Trạng thái | Số mục | Ghi chú |
|------------|--------|---------|
| ✅ PASS (automated RC1) | 19 | `verify-v5-rc1-staging.mjs` — 2026-07-03 |
| ✅ PASS (cross-tenant RLS refresh) | 31 | `verify-cross-tenant-rls-staging.mjs` — 2026-07-03 |
| ⏳ Pending (manual) | 66 | Browser/device P0–P2 |
| ⚠️ PARTIAL | 4 | RLS refresh — `qr_tokens`, `checkins` (policy open, 0 rows; không phải FAIL) |
| ❌ FAIL | 0 | |
| 🔒 BLOCKED | 0 | |

---

## Automated gates (chạy trước manual QA)

| Lệnh | Mục đích | Kỳ vọng RC1 |
|------|----------|-------------|
| `npm test` | Unit/integration suite | 0 fail |
| `npm run build` | Production bundle | Pass |
| `npm run lint` | ESLint | 0 errors |
| `git diff --check` | Whitespace conflict | Clean |
| `node scripts/verify-v5-rc1-staging.mjs` | Preview API + audit + SPA shell | PASS |
| `node scripts/verify-cross-tenant-rls-staging.mjs` | JWT RLS isolation | ✅ PASS 31/4/0/0 (2026-07-03) |

### Verify RC1 staging (technical)

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=<secret> \
STAGING_PREVIEW_URL=<preview-url> \
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role> \
  node scripts/verify-v5-rc1-staging.mjs
```

Script kiểm tra: health, API envelope, API key runtime subset, integration audit subset, SPA route shell, output safety. **Không** thay thế manual browser QA.

### RC1 automated technical verify — ✅ PASS (2026-07-03)

| Hạng mục | Kết quả |
|----------|---------|
| **Tổng kết script** | **PASS: 19 · FAIL: 0 · BLOCKED: 0** |
| **V5.0 RC1 staging technical verify** | ✅ **PASS** |
| URL resolution hardening (`preview-url-utils.mjs`) | ✅ PASS — `STAGING_PREVIEW_URL` từ env, hostname hợp lệ |
| API key runtime (RC1 subset) | ✅ PASS — health, envelope, missing/invalid key, cross-tenant, integrations, webhook |
| Integration audit logs (RC1 subset) | ✅ PASS — `integration.read`, `integration.write`, `api_key.scope_denied` |
| PWA manifest Preview | ✅ PASS — `/manifest.webmanifest` 200, JSON hợp lệ |
| SPA shell | ✅ PASS — `/login` 200, `/` 200 |
| Output safety | ✅ PASS — không leak secret trong stdout |

**Lệnh:** `node scripts/verify-v5-rc1-staging.mjs` (env: `STAGING_PREVIEW_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` — không commit).

**Chưa tick:** manual P0 browser QA (Auth, Court Engine, Billing, mobile device). **Production vẫn NO-GO** cho đến khi manual P0 QA xong.

### Cross-tenant RLS refresh — ✅ PASS (2026-07-03)

| Hạng mục | Kết quả |
|----------|---------|
| **Tổng kết script** | **PASS=31 · PARTIAL=4 · FAIL=0 · BLOCKED=0 · N/A=0** |
| **Verdict** | ✅ **Cross-tenant RLS authenticated probe: PASS** (no FAIL rows) |
| Owner A isolated | ✅ PASS |
| Owner B isolated | ✅ PASS |
| `tenant_subscriptions` cross-tenant read | ✅ Blocked |
| `tenant_subscriptions` cross-tenant insert | ✅ Blocked by RLS |
| PLAYER billing/admin/court-engine routes | ✅ Blocked |
| `plans` / `plan_limits` global catalog | ✅ OK |
| SUPER_ADMIN login | ⏳ Skipped — `missing_credentials` (không ảnh hưởng tenant isolation) |

**PARTIAL warnings (không phải FAIL):**

| Bảng | Cảnh báo | Ghi chú |
|------|----------|---------|
| `qr_tokens` | POLICY OPEN (`USING true`), 0 rows | Cần seed cross-tenant để xác nhận không leak |
| `checkins` | POLICY OPEN (`USING true`), 0 rows | Cần seed cross-tenant để xác nhận không leak |

**Action item (trước Production mobile/QR/check-in):** seed dữ liệu cross-tenant trên staging **hoặc** tighten RLS policy cho `qr_tokens` / `checkins` — xem KN-6.

**Lệnh:** `node scripts/verify-cross-tenant-rls-staging.mjs` (env staging passwords — không commit).

---

## Master checklist

**Cột Status:** ⏳ Pending · ✅ PASS · ⚠️ PARTIAL · ❌ FAIL · 🔒 BLOCKED  
**Owner:** `auto` = script/unit · `manual` = người QA · `auto+manual` = cả hai

### 1. Auth / Login

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| A1 | Auth | Login email/password hợp lệ | Vào dashboard, không treo spinner | ⏳ | | manual | P0 |
| A2 | Auth | Logout | Session cleared, redirect `/login` | ⏳ | GA-PRODUCTION-QA §A | manual | P0 |
| A3 | Auth | Reload sau login | Không treo loading vô hạn | ⏳ | `tests/auth.test.js` | auto+manual | P0 |
| A4 | Auth | Session restore (đóng tab mở lại) | Vẫn đăng nhập, route protected OK | ⏳ | GA-PRODUCTION-QA §A | auto+manual | P0 |
| A5 | Auth | Route guard — chưa login vào `/court-engine` | Redirect `/login` | ⏳ | Phase 10C browser smoke | manual | P0 |
| A6 | Auth | Unauthorized route | Không crash, redirect hoặc 404 hợp lệ | ⏳ | | manual | P1 |
| A7 | Auth | 403 khi thiếu quyền (PLAYER → `/court-engine`) | `ForbiddenPage`, không white screen | ⏳ | `tests/rbac.test.js` | auto+manual | P0 |
| A8 | Auth | Expired session | Redirect login, không leak data | ⏳ | | manual | P1 |

### 2. RBAC / Role

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| B1 | RBAC | SUPER_ADMIN — menu admin + billing platform | Thấy `/admin/billing`, user mgmt | ⏳ | `tests/rbac.test.js` | auto+manual | P1 |
| B2 | RBAC | VENUE_OWNER (chủ sân) — court-engine + billing tenant | Vào `/court-engine`, `/billing` | ⏳ | rolePermissions | auto+manual | P0 |
| B3 | RBAC | VENUE_MANAGER — vận hành sân | Court engine, không admin platform | ⏳ | | manual | P0 |
| B4 | RBAC | CLUB_OWNER — CLB + scheduling | Menu CLB, scheduling theo matrix | ⏳ | | manual | P1 |
| B5 | RBAC | CASHIER — thu ngân | Không admin billing platform | ⏳ | mobile hardening tests | auto+manual | P1 |
| B6 | RBAC | ACCOUNTANT — kế toán | Billing read, không court-engine ops | ⏳ | | manual | P1 |
| B7 | RBAC | PLAYER — vận động viên | Không `/court-engine`, `/admin/*` | ⏳ | Phase 10D PLAYER blocked | auto+manual | P0 |
| B8 | RBAC | REFEREE — trọng tài | Referee routes only, không billing | ⏳ | `referee-rpc-security.test.js` | auto+manual | P1 |
| B9 | RBAC | Menu đúng role — không thấy mục forbidden | Sidebar/mobile nav filtered | ⏳ | `menuAccess.js` tests | auto+manual | P0 |
| B10 | RBAC | Action guard (nút xóa/sửa) | Disabled hoặc ẩn khi thiếu permission | ⏳ | | manual | P1 |
| B11 | RBAC | 8-role matrix regression | Unit RBAC pass | ⏳ | `npm test` rbac suite | auto | P0 |
| B12 | RBAC | User không xem menu tenant khác | Chỉ data tenant mình | ⏳ | Phase 10D | auto+manual | P0 |

### 3. Multi-tenant / RLS

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| C1 | RLS | Owner A không SELECT club_data Tenant B | 0 rows / policy deny | ⏳ | Phase 10D PASS | auto | P0 |
| C2 | RLS | Owner B không SELECT billing Tenant A | 0 rows | ⏳ | Phase 10D PASS | auto | P0 |
| C3 | RLS | PLAYER không đọc admin tables | Blocked | ⏳ | Phase 10D | auto | P0 |
| C4 | RLS | API key Tenant A không truy cập Tenant B | 403 `tenant_not_found` | ⏳ | Phase 11D PASS | auto | P0 |
| C5 | RLS | Cross-tenant JWT probe re-run | PASS=31 PARTIAL=4 FAIL=0 | ✅ | RLS refresh PASS 2026-07-03 | auto | P0 |
| C6 | RLS | Không hard-code `tenant-demo` runtime | Resolver trả null/blocklist | ⏳ | `billing-tenant-mapping.test.js` | auto | P0 |
| C7 | RLS | SUPER_ADMIN global read (nếu bật) | Chỉ khi role đúng | ⏳ | | manual | P2 |
| C8 | RLS | Mobile tables (qr_tokens, checkins) tenant scope | Không leak cross-tenant | ⚠️ | PARTIAL — policy open, 0 rows; seed hoặc tighten trước Production mobile | auto+manual | P1 |

### 4. Billing / Subscription

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| D1 | Billing | Trial tenant — hiển thị plan trial | Dates + limits hiển thị | ⏳ | Phase 9 staging | manual | P0 |
| D2 | Billing | Active subscription | Status active, features unlocked | ⏳ | `billing-phase9.test.js` | auto+manual | P0 |
| D3 | Billing | Expired subscription | TenantOperationalGate lock | ⏳ | `tenantAccessService.js` | auto+manual | P0 |
| D4 | Billing | Locked feature khi hết hạn | UI gate + message rõ | ⏳ | SubscriptionGate | auto+manual | P0 |
| D5 | Billing | `/billing` owner — không trắng màn | Plan/usage/error state | ⏳ | Phase 10E hardening | manual | P0 |
| D6 | Billing | `/admin/billing` platform admin | List tenants, không crash | ⏳ | | manual | P1 |
| D7 | Billing | Tenant resolver = `profiles.venue_id` | Không `tenant_not_found` orphan | ⏳ | Phase 10E + mapping script | auto+manual | P0 |
| D8 | Billing | Trial RPC staging | `start_trial` OK cho venue hợp lệ | ⏳ | `verify-billing-phase9-staging.mjs` | auto | P1 |
| D9 | Billing | Payment gateway thật | **BLOCKED** — mock/dev only | 🔒 | By design GA | manual | P2 |
| D10 | Billing | Grace period 3 ngày (nếu config) | Lock sau grace | ⏳ | subscription sprint4 | manual | P2 |

### 5. Court Engine

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| E1 | Court | Vào `/court-engine` authenticated | Render dashboard, không crash | ⏳ | GA-PRODUCTION-QA §F | manual | P0 |
| E2 | Court | Reload trực tiếp URL | Không white screen | ⏳ | UI tests 6/6 | auto+manual | P0 |
| E3 | Court | Check-in 4 người | Queue cập nhật | ⏳ | `court-engine.test.js` | auto+manual | P0 |
| E4 | Court | Queue hiển thị / reorder | FIFO hợp lý | ⏳ | | manual | P1 |
| E5 | Court | Auto-assign / gán sân | Không trùng người/sân | ⏳ | occupied court fix | auto+manual | P0 |
| E6 | Court | Bắt đầu / kết thúc lượt timer | State sync courtStates | ⏳ | unit tests | auto+manual | P0 |
| E7 | Court | Pause / resume trận | Sân pause không bị assign đè | ⏳ | | manual | P1 |
| E8 | Court | Chuyển sân (nếu có) | Transfer không mất người chơi | ⏳ | | manual | P2 |
| E9 | Court | Activity log (nếu có) | Ghi sự kiện assign/end | ⏳ | | manual | P2 |
| E10 | Court | Empty state — thiếu season/league | Message rõ, không crash | ⏳ | context guard tests | auto | P0 |
| E11 | Court | Mobile layout cơ bản | Usable trên 375px | ⏳ | GA-PRODUCTION-QA §F PARTIAL | manual | P1 |
| E12 | Court | Null `active` league guard | Không crash `leagueId` | ⏳ | Fix 3d8688e | auto | P0 |

### 6. Mobile / PWA

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| F1 | Mobile | Android — Install PWA / Add to Home | Icon + standalone | ⏳ | PHASE_8_MOBILE_GA | manual | P1 |
| F2 | Mobile | iPhone — Add to Home Screen | Icon + safe area | ⏳ | | manual | P1 |
| F3 | Mobile | QR check-in flow | Scan → checkin record tenant-scoped | ⏳ | mobile hardening | auto+manual | P0 |
| F4 | Mobile | Offline mode — banner + queue | Actions queue, sync khi online | ⏳ | | manual | P1 |
| F5 | Mobile | Push permission UI | Prompt không crash | ⏳ | | manual | P2 |
| F6 | Mobile | Reload sau offline→online | App recover, queue flush | ⏳ | | manual | P1 |
| F7 | Mobile | Bottom nav RBAC | REFEREE không thấy billing | ⏳ | mobile-phase8 tests | auto | P0 |
| F8 | Mobile | `/mobile/player` PLAYER mode | Render profile/matches | ⏳ | | manual | P1 |
| F9 | PWA | `manifest.webmanifest` load | 200 JSON, icons OK | ✅ | RC1 script `spa:manifest` PASS 2026-07-03 | auto | P1 |
| F10 | PWA | Service worker registered | `sw.js` không 404 | ⏳ | build output | auto+manual | P1 |
| F11 | Mobile | QR generate — manager+ only | PLAYER blocked | ⏳ | route guards | auto+manual | P1 |
| F12 | Mobile | Expired tenant mobile nav lock | Redirect/gate billing routes | ⏳ | hardening tests | auto | P1 |

### 7. API / Integrations

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| G1 | API | `GET /api/v1/health` | 200 `{ ok:true, code:"ok" }` | ✅ | RC1 script PASS 2026-07-03 | auto | P0 |
| G2 | API | API envelope — `ok`, `code`, `requestId` | Consistent shape | ✅ | RC1 script PASS 2026-07-03 | auto | P0 |
| G3 | API | Missing API key | 401 `unauthorized` | ✅ | RC1 script PASS 2026-07-03 | auto | P0 |
| G4 | API | Invalid / revoked / expired key | 401 `invalid_api_key` | ✅ | RC1 subset PASS 2026-07-03 | auto | P0 |
| G5 | API | Valid key + wrong tenant | 403 `tenant_not_found` | ✅ | RC1 script PASS 2026-07-03 | auto | P0 |
| G6 | API | `integrations:read` | 200 integrations list | ✅ | RC1 script PASS 2026-07-03 | auto | P0 |
| G7 | API | `integrations:write` scope | 200 write / 403 denied | ✅ | RC1 script PASS 2026-07-03 | auto | P0 |
| G8 | API | Webhook read/write | Scope enforced | ✅ | RC1 webhook read PASS 2026-07-03 | auto | P1 |
| G9 | API | `integration_audit_logs` row per request | event_type + request_id match | ✅ | RC1 audit subset PASS 2026-07-03 | auto | P0 |
| G10 | API | Output safety — no secret in stdout | Redaction PASS | ✅ | RC1 script PASS 2026-07-03 | auto | P0 |
| G11 | API | Rate limit (Preview env=1) | 429 or NOT_APPLICABLE multi-instance | ⏳ | Phase 11D | auto | P2 |
| G12 | API | `API_KEY_STORE=supabase` Preview | Runtime uses Supabase not localStorage | ⏳ | Phase 11D | auto | P0 |
| G13 | API | `AUDIT_STORE=supabase` Preview | Audit persisted server-side | ⏳ | Phase 11E | auto | P0 |
| G14 | API | Edge guard — no localStorage on serverless | No FUNCTION_INVOCATION_FAILED | ⏳ | Phase 11C PASS | auto | P0 |

### 8. Menu / UX

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| H1 | UX | Menu SaaS nhiều sân — tên dễ hiểu | Không label kỹ thuật thô | ⏳ | | manual | P1 |
| H2 | UX | Không menu thừa / dead links | Mọi link có route | ⏳ | | manual | P1 |
| H3 | UX | VENUE_OWNER sidebar đầy đủ ops | Court, players, billing | ⏳ | | manual | P0 |
| H4 | UX | PLAYER sidebar tối giản | Không admin/court-engine | ⏳ | rbac menu tests | auto+manual | P0 |
| H5 | UX | Mobile drawer không vỡ layout | Scroll + tap targets OK | ⏳ | | manual | P1 |
| H6 | UX | Header CLB / Mùa / Giải switcher | Single source of truth | ⏳ | ClubContext | manual | P1 |
| H7 | UX | Loading states — không flash blank | Skeleton hoặc spinner | ⏳ | | manual | P2 |
| H8 | UX | `/403` page copy rõ ràng | Hướng dẫn quay lại | ⏳ | | manual | P2 |

### 9. Data / Migration / Rollback

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| I1 | Data | SQL migration list documented | 15+ bước GA + sprint10 | ⏳ | SUPABASE-PRODUCTION-CHECKLIST | manual | P0 |
| I2 | Data | Rollback notes per sprint | File `*-rollback.sql` tồn tại | ⏳ | docs/supabase-* | auto | P1 |
| I3 | Data | Staging seed — không xóa data thật | Probe tags + cleanup scripts | ⏳ | seed-phase11d | auto | P0 |
| I4 | Data | Backup checklist trước Production | PITR/snapshot tick | ⏳ | GA-PRODUCTION-ENV | manual | P0 |
| I5 | Data | Phase 11E migration applied staging | integration_audit_logs OK | ⏳ | Phase 11E PASS | auto | P0 |
| I6 | Data | Billing phase9 + 10e align staging | profiles.venue_id match | ⏳ | Phase 10E | auto+manual | P0 |
| I7 | Data | Không chạy destructive SQL trên prod dry-run | Review only | ⏳ | | manual | P0 |
| I8 | Data | Club blob v3 sync | pull/push không corrupt | ⏳ | | manual | P2 |

### 10. Production Readiness

| ID | Area | Test case | Expected result | Status | Evidence | Owner | Priority |
|----|------|-----------|-----------------|--------|----------|-------|----------|
| J1 | Prod | Env Production — biến bắt buộc set | VITE_SUPABASE_*, RBAC=true | ⏳ | GA-PRODUCTION-ENV-CHECKLIST | manual | P0 |
| J2 | Prod | Preview vs Production Supabase | **Tách project** — không lẫn | ⏳ | | manual | P0 |
| J3 | Prod | `VITE_SEED_DEMO=false` Production | Không seed demo | ⏳ | | manual | P0 |
| J4 | Prod | Feature flags GA default OFF | API/AI/Marketplace off until SQL | ⏳ | env checklist | manual | P0 |
| J5 | Prod | Service role **không** trong client env | Server-only Vercel | ⏳ | | manual | P0 |
| J6 | Prod | SQL 15 bước + sprint10 trên Production | Tick checklist | ⏳ | SUPABASE-PRODUCTION-CHECKLIST | manual | P0 |
| J7 | Prod | Redeploy sau đổi env | Build mới active | ⏳ | | manual | P0 |
| J8 | Prod | Domain + HTTPS + PWA origin | manifest/icons same origin | ⏳ | | manual | P1 |
| J9 | Prod | CI green trên `main` | lint + test + build | ⏳ | GitHub Actions | auto | P0 |
| J10 | Prod | Smoke test sau deploy Production | Login + court-engine + health | ⏳ | § Smoke below | manual | P0 |
| J11 | Prod | Rollback plan documented | Redeploy prior tag + SQL notes | ⏳ | | manual | P1 |
| J12 | Prod | Monitoring / error tracking (nếu có) | Không bắt buộc GA | ⏳ | | manual | P2 |

---

## Production vs Preview — env diff

| Biến | Preview / Staging | Production RC1 |
|------|-------------------|----------------|
| `VITE_SUPABASE_URL` | Staging project | **Production project** |
| `VITE_SUPABASE_ANON_KEY` | Staging anon | Production anon |
| `VITE_RBAC_ENABLED` | `true` (QA) | **`true`** |
| `VITE_SEED_DEMO` | `false` | **`false`** |
| `VITE_API_ENABLED` | `true` (11C–11E QA) | **`false`** until SQL + gate |
| `VITE_BILLING_SUPABASE` | `true` | `true` (sau SQL billing) |
| `VITE_ENABLE_AI_ENGINE` | `false` | `false` |
| `VITE_MARKETPLACE_ENABLED` | `false` | `false` |
| `API_KEY_STORE` | `supabase` (Preview server) | `supabase` (khi bật API) |
| `AUDIT_STORE` | `supabase` | `supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Preview **server only** | Vercel Production **server only** |
| Payment gateways | mock/dev | **mock/dev** — no live gateway RC1 |

**Preview-only QA secrets (không commit):** `VERCEL_AUTOMATION_BYPASS_SECRET`, staging passwords, `SUPABASE_SERVICE_ROLE_KEY`.

---

## SQL migration order (Production promote)

Tham chiếu đầy đủ: `docs/SUPABASE-PRODUCTION-CHECKLIST.md`

| # | File | Rollback |
|---|------|----------|
| 1–15 | GA core (club-v3 → sprint10) | Per-file `*-rollback.sql` |
| + | `supabase-billing-phase9.sql` | `supabase-billing-phase9-rollback.sql` |
| + | `supabase-sprint10-phase11b-persistence.sql` | `supabase-sprint10-phase11b-rollback.sql` |
| + | `supabase-sprint10-phase11c-api-key-guard.sql` | `supabase-sprint10-phase11c-rollback.sql` |
| + | `supabase-sprint10-phase11e-integration-audit.sql` | `supabase-sprint10-phase11e-rollback.sql` |

**Trước Production:** backup/PITR snapshot → apply SQL → verify schema → set env → redeploy → smoke test.

---

## Backup checklist (pre-Production)

- [ ] Supabase Production snapshot / PITR confirmed
- [ ] Export critical tables sample (profiles, venues, club_data_v3) — optional
- [ ] Vercel prior deployment ID noted for rollback
- [ ] Git tag `v5.0.0-rc1` (or release branch) identified
- [ ] Maintenance window communicated (nếu có user live)
- [ ] Rollback SQL files reviewed (`*-rollback.sql`)
- [ ] Không chạy seed destructive trên Production

---

## Production smoke test (post-deploy)

| # | Step | Expected |
|---|------|----------|
| 1 | `GET /api/v1/health` (nếu API enabled) | 200 ok |
| 2 | `/login` → owner login | Dashboard load |
| 3 | `/court-engine` | No white screen |
| 4 | Logout → login player | 403 on court-engine |
| 5 | `/billing` owner | Plan visible, no blank |
| 6 | PWA manifest 200 | Icons load |
| 7 | Console — no P0 errors | Clean on login flow |

---

## Bug list (Phase 12 — ghi khi phát hiện)

| ID | Mô tả | Area | Priority | Blocker RC1? | Action |
|----|-------|------|----------|--------------|--------|
| — | *Chưa ghi nhận bug mới trong Phase 12* | — | — | — | — |

**Known accepted (không chặn RC1 staging):**

| ID | Mô tả | Priority | Ghi chú |
|----|-------|----------|---------|
| KN-1 | Payment gateway live (VNPay/MoMo/Stripe) | P2 | Mock/dev only — không release với gateway live |
| KN-2 | Rate limit multi-instance Vercel | P2 | Per-instance counter — distributed limit post-GA |
| KN-3 | SUPER_ADMIN staging password docs mismatch | P2 | Không ảnh hưởng tenant isolation (Phase 10D) |
| KN-4 | Mobile device QA một phần PARTIAL | P1 | Manual device pass trước Production mobile traffic |
| KN-5 | `IntegrationSettingsPage.jsx` in stash | P2 | Không pop trừ khi owner yêu cầu |
| KN-6 | `qr_tokens` / `checkins` RLS policy open (`USING true`) | P1 | Cần seed cross-tenant verification **hoặc** tighten policy trước Production mobile/QR/check-in traffic |

---

## Go / No-Go criteria — V5.0 RC1

### RC1 Staging sign-off (Preview QA complete)

| Gate | Required | Trạng thái |
|------|----------|------------|
| `npm test` + `build` + `lint` | ✅ Pass | ✅ Pass (2026-07-03) |
| `verify-v5-rc1-staging.mjs` | ✅ Pass | ✅ **PASS 19/0/0** (2026-07-03) |
| URL resolution hardening | ✅ Pass | ✅ `preview-url-utils.mjs` |
| API key runtime RC1 subset | ✅ Pass | ✅ |
| Integration audit RC1 subset | ✅ Pass | ✅ |
| PWA manifest Preview | ✅ Pass | ✅ `/manifest.webmanifest` |
| SPA `/login` + `/` | ✅ Pass | ✅ 200 shell |
| Cross-tenant RLS re-run | ✅ Pass (or Phase 10D still valid) | ✅ **PASS 31/4/0/0** (2026-07-03) |
| Manual P0 Auth + Court + Billing browser | ✅ Tick | ⏳ **Pending** |
| No open P0 bugs | ✅ | ✅ (chưa ghi nhận mới) |

**RC1 Staging technical verify:** ✅ PASS — automated gates xong; **chưa** RC1 Staging Go đầy đủ (thiếu manual P0).

**Production:** ⛔ **NO-GO** — chờ manual P0 QA + Production SQL/env checklist.

### Production Go (separate decision)

| Gate | Required |
|------|----------|
| RC1 Staging Go | ✅ |
| Production SQL全部 applied | ✅ |
| Production env checklist | ✅ |
| Manual 8-role Production smoke | ✅ |
| Device mobile P0 (QR, PWA install) | ✅ |
| Backup + rollback plan | ✅ |
| Payment gateway | ⛔ Still mock/dev |

---

## Kết luận Phase 12

| Quyết định | Trạng thái |
|------------|------------|
| **RC1 Staging QA framework** | ✅ Delivered (doc + script) |
| **RC1 automated technical verify** | ✅ **PASS** — PASS: 19, FAIL: 0, BLOCKED: 0 (2026-07-03) |
| **Cross-tenant RLS refresh** | ✅ **PASS** — PASS: 31, PARTIAL: 4, FAIL: 0, BLOCKED: 0 (2026-07-03) |
| **RC1 Staging Go (full)** | ⏳ Pending — manual P0 browser QA |
| **Production deploy** | ⛔ **NO-GO** — chờ manual P0 QA xong + Production SQL/env + KN-6 mobile RLS |
| **Đề xuất tiếp theo** | Manual tick P0 master checklist → seed/tighten `qr_tokens`/`checkins` (KN-6) → họp Go/No-Go RC1 |

---

## Tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `docs/GA-PRODUCTION-QA.md` | Manual QA v4 baseline |
| `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Env Production |
| `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | SQL Production |
| `docs/v5/PHASE_10_RELEASE_AUDIT.md` | Release audit v5 |
| `scripts/verify-phase11c-api-key-guard-staging.mjs` | Full 11C matrix |
| `scripts/verify-phase11d-api-key-runtime-staging.mjs` | Full 11D matrix |
| `scripts/verify-phase11e-integration-audit-staging.mjs` | Full 11E matrix |
| `scripts/verify-v5-rc1-staging.mjs` | **RC1 condensed technical gate** |
| `scripts/verify-cross-tenant-rls-staging.mjs` | **Cross-tenant RLS JWT probe** |
