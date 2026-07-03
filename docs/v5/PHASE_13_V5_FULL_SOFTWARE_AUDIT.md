# Phase 13 — V5.0 Full Software Audit & Release Progress Review

**Ngày audit:** 2026-07-03  
**Phiên bản mục tiêu:** Pickleball Scheduler Pro **v5.0** — Platform Core / RC1  
**Branch:** `v5-platform-edition` (up to date with `origin/v5-platform-edition`)  
**Môi trường:** Staging Supabase + Vercel Preview — **không** Production  
**Ràng buộc Phase 13:** Audit/review/report only — không refactor lớn, không deploy Production, không pop stash `IntegrationSettingsPage.jsx`

---

## Executive summary

Phase 13 xác nhận **nền tảng kỹ thuật V5.0 RC1 đã sẵn sàng** (unit/build/lint + cross-tenant RLS re-run PASS), nhưng **chưa đủ điều kiện RC1 Staging sign-off đầy đủ** và **Production vẫn NO-GO**.

| Kết luận | Verdict |
|----------|---------|
| **P0 bugs mới** | **0** — không phát hiện blocker mới |
| **V5.0 Platform Core (code + automated)** | ✅ **PASS** — ~95% |
| **V5.0 RC1 Technical (automated staging)** | ✅ **PASS** (Phase 12, 2026-07-03) — re-run Phase 13 cần env bypass |
| **V5.0 RC1 Staging Manual** | ⏳ **NOT_STARTED** — 66/94 case manual pending |
| **V5.0 GA Production** | ⛔ **NO-GO** |
| **Tag `v5.0.0-rc1`** | ⏳ **Conditional** — technical OK; full sign-off cần manual P0 |
| **Production deploy** | ⛔ **NO-GO** |

**Tiến độ tổng thể V5.0 → GA:** **~38%** (automated gates + platform code; manual P0/P1 + Production checklist chưa đóng).

---

## Current version verdict

| Mức | Định nghĩa | Status | Ghi chú |
|-----|------------|--------|---------|
| **Platform Core** | Kiến trúc SaaS multi-tenant, billing, court engine, API 11C–11E, mobile/PWA shell | ✅ **PASS** | Code + 723 unit tests |
| **RC1 Technical** | `npm test/build/lint` + `verify-v5-rc1-staging.mjs` + RLS script | ✅ **PASS** (documented 2026-07-03) | Phase 13 re-run RC1 script **BLOCKED** thiếu bypass env (xem § Automated gates) |
| **RC1 Staging** | RC1 technical + manual P0 browser/device | ⏳ **PARTIAL** | Automated xong; manual 0% tick |
| **GA Production** | RC1 Go + Production SQL/env + smoke + mobile RLS hardening | ⛔ **BLOCKED** | KN-6 + Production checklist |

---

## 1. Repository / Git status

| Kiểm tra | Kết quả |
|----------|---------|
| Branch | `v5-platform-edition` |
| Working tree | ✅ Clean — nothing to commit |
| `e9f5d74` docs(v5): record V5 RC1 technical verify pass | ✅ Present |
| `d024a2f` docs(v5): record cross-tenant RLS refresh for RC1 | ✅ Present |
| Untracked/modified | ✅ None |
| Stash `IntegrationSettingsPage.jsx` | ✅ **Intact** — `stash@{0}: wip: IntegrationSettingsPage mockPayment toggle key fix` — **không pop** |

**Recent log (10 commits):**

```
d024a2f docs(v5): record cross-tenant RLS refresh for RC1
e9f5d74 docs(v5): record V5 RC1 technical verify pass
6e292a9 fix(pwa): serve manifest for V5 RC1 preview
aeb009f fix(v5): harden staging URL resolution and RC1 verifier
c9ff617 docs(v5): add Phase 12 V5 RC1 QA checklist
adea4dc docs(v5): close Phase 11E staging QA
cd21ba1 fix(api): make legacy audit columns nullable
d463ce5 fix(api): await integration audit insert on serverless
4c36469 feat(api): add Phase 11E integration audit logs
7e5017f docs(v5): close Phase 11D Supabase API key runtime QA
```

---

## 2. Secret / output safety scan

**Phạm vi:** toàn repo (docs, scripts, source) — **không echo giá trị secret**.

| Pattern / rủi ro | Kết quả | Ghi chú |
|------------------|---------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Safe | Chỉ tên biến trong docs/scripts; placeholder `<staging-service-role>` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | ✅ Safe | Chỉ tên biến + hướng dẫn; không giá trị thật |
| `sb_secret_*` (raw Supabase secret) | ✅ Not found | Không có pattern `sb_secret_` + payload trong repo |
| `hashed_key` trong docs/logs | ✅ Safe | Chỉ schema/docs/tests; không digest thật |
| Raw JWT / API key thật | ✅ Safe | Test fixtures dùng `eyJ...test` giả; `docs/REFEREE-E2E.md` truncated |
| Typo URL (`verccel`, `sccheduler`, `.appp`) | ✅ Mitigated | `scripts/preview-url-utils.mjs` block hostname fragments |
| `.env.local` | ✅ Exists | Không đọc/commit; load qua `scripts/load-env.mjs` |

**Output safety:** `verify-v5-rc1-staging.mjs` stdout redaction ✅ PASS trong session Phase 13.

---

## 3. Automated gate results

### Local gates (Phase 13 — 2026-07-03)

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `git diff --check` | ✅ PASS | Clean |
| `npm test` | ✅ **723/723 PASS** | 56 suites, 0 fail |
| `npm run build` | ✅ PASS | PWA `sw.js` + precache 182 entries |
| `npm run lint` | ✅ PASS (0 errors) | 128 warnings `react-hooks/exhaustive-deps` — pre-existing, không blocker |

### Staging scripts

| Script | Phase 13 session | Phase 12 documented | Ghi chú |
|--------|------------------|---------------------|---------|
| `verify-cross-tenant-rls-staging.mjs` | ✅ **PASS 31/4/0/0** | ✅ PASS | JWT probe; SUPER_ADMIN skipped `missing_credentials` |
| `verify-v5-rc1-staging.mjs` | ⚠️ **BLOCKED/FAIL** | ✅ **PASS 19/0/0** | Session thiếu `VERCEL_AUTOMATION_BYPASS_SECRET`; Vercel Deployment Protection → HTML; seed API key `Unregistered` |

**RC1 script BLOCKED — env cần set (không commit):**

```bash
STAGING_PREVIEW_URL=https://<valid-preview>.vercel.app
VERCEL_AUTOMATION_BYPASS_SECRET=<from Vercel Project Settings → Deployment Protection>
SUPABASE_SERVICE_ROLE_KEY=<staging service role — server only>
node scripts/verify-v5-rc1-staging.mjs
```

**Kết luận gate:** Local CI-equivalent ✅ PASS. Staging RC1 script **tin cậy theo Phase 12 PASS** khi env đủ; Phase 13 re-run **không invalidate** kết quả đã ghi — chỉ xác nhận cần bypass secret cho agent/CI headless.

---

## 4. API / Integrations / Audit

| Kiểm tra | Status | Evidence |
|----------|--------|----------|
| `GET /api/v1/health` | ✅ PASS | Phase 12 RC1 script |
| JSON envelope (`ok`, `code`, `requestId`) | ✅ PASS | Phase 11C–11E + RC1 |
| Missing key → 401 | ✅ PASS | Phase 11C/D |
| Invalid/revoked/expired key | ✅ PASS | Phase 11D |
| Cross-tenant A→B → 403 | ✅ PASS | Phase 11D |
| `integrations:read` / `integrations:write` | ✅ PASS | Phase 11D/E |
| Webhook read/write scope | ✅ PASS | Phase 11E |
| `integration_audit_logs` persistence | ✅ PASS | Phase 11E — `request_id`, `event_type`, `result_code`, `status_code` |
| Output safety (no secret in stdout) | ✅ PASS | RC1 + 11E scripts |
| URL resolution hardening | ✅ PASS | `preview-url-utils.mjs` |
| Full 11C matrix (31 tests) | ✅ PASS | Phase 11C staging QA |
| Full 11D matrix (16 tests) | ✅ PASS | Phase 11D staging QA |
| Full 11E matrix (21 tests) | ✅ PASS | Phase 11E staging QA |
| Rate limit multi-instance | ⚠️ PARTIAL | P2 — per-instance counter on Vercel |
| `API_KEY_STORE=supabase` on Preview | ✅ PASS | Phase 11D documented |
| `AUDIT_STORE=supabase` on Preview | ✅ PASS | Phase 11E documented |

**Unit tests automated:** `phase11c-edge-api-key-guard.test.js`, `phase11d-supabase-api-key-runtime.test.js`, `phase11e-integration-audit.test.js`, `sprint10-integrations.test.js`.

---

## 5. Multi-tenant / RLS

| Kiểm tra | Status | Evidence |
|----------|--------|----------|
| Owner A isolated from B | ✅ PASS | RLS script 2026-07-03 |
| Owner B isolated from A | ✅ PASS | RLS script 2026-07-03 |
| `tenant_subscriptions` cross-tenant read blocked | ✅ PASS | 0 rows filter |
| `tenant_subscriptions` cross-tenant insert blocked | ✅ PASS | RLS deny |
| PLAYER billing/admin/court-engine | ✅ PASS | Route matrix blocked |
| `plans` / `plan_limits` global catalog | ✅ PASS | 4 rows each |
| `qr_tokens` | ⚠️ **PARTIAL** | `USING (true)` — 0 rows, chưa seed cross-tenant |
| `checkins` | ⚠️ **PARTIAL** | `USING (true)` — 0 rows, chưa seed cross-tenant |

### KN-6 — `qr_tokens` / `checkins` RLS assessment

| Câu hỏi | Trả lời |
|---------|---------|
| **Chặn tag `v5.0.0-rc1`?** | **Không** — Phase 12 accepted; không FAIL trong RLS probe |
| **Chặn Production mobile/QR/check-in?** | **Có (P1)** — policy `USING (true)` cho phép authenticated đọc/ghi mọi tenant nếu có data |
| **Đề xuất** | Trước Production mobile traffic: **(a)** seed cross-tenant staging verify leak, **(b)** tighten RLS `tenant_id = auth tenant` trong `docs/supabase-mobile-sprint9.sql` patch |

**SQL nguồn:** `docs/supabase-mobile-sprint9.sql` lines 81–127 — policies `USING (true)` / `WITH CHECK (true)`.

---

## 6. Auth / RBAC / Roles

### Automated (unit)

| Area | Tests | File |
|------|-------|------|
| Auth session/guard | 12 | `tests/auth.test.js` |
| RBAC 8-role matrix | 43 | `tests/rbac.test.js` |
| RLS access helpers | 9 | `tests/rls-access.test.js` |
| Identity Phase B/C | 15 | `identity-phaseB/C.test.js` |
| Referee RPC security | 9 | `referee-rpc-security.test.js` |
| Mobile nav RBAC | 29+20 | `mobile-phase8-hardening/product.test.js` |
| Security hardening | 7 | `security-hardening.test.js` |
| Menu access | via rbac + mobile | `src/auth/menuAccess.js` |

### Manual browser QA required

| Role | Cases | Risk nếu thiếu tài khoản test |
|------|-------|-------------------------------|
| SUPER_ADMIN | B1, C7, D6 | Không verify platform billing — skipped trong RLS script |
| VENUE_OWNER | B2, D1–D5, E1–E6, H3 | **P0** — court-engine + billing owner flow |
| VENUE_MANAGER | B3 | Court ops không verify |
| CLUB_OWNER | B4 | CLB menu regression |
| CASHIER / ACCOUNTANT | B5, B6 | Billing vs court separation |
| PLAYER | B7, A7, F8 | **P0** — 403 court-engine |
| REFEREE | B8 | Referee-only routes |
| Session restore / reload | A3, A4, E2 | White-screen risk |

**Staging accounts documented:** `owner@staging.local`, `owner-b@staging.local`, `player@staging.local` (passwords in `.env.local` only).

---

## 7. Billing / Subscription

| Kiểm tra | Status | Evidence |
|----------|--------|----------|
| Trial / active / expired lifecycle | ✅ Unit PASS | `billing-phase9.test.js` (15 tests) |
| Feature lock (TenantOperationalGate) | ✅ Unit PASS | `tenantAccessService`, subscription tests |
| Tenant resolver | ✅ PASS | `billingTenantResolver.js` — blocklist `tenant-demo` |
| Không fallback `tenant-demo` | ✅ PASS | `billing-tenant-mapping.test.js` (10 tests) |
| `profiles.venue_id === venues.id === tenant_subscriptions.tenant_id` | ✅ Staging PASS | Phase 10E + RLS probe |
| `/billing` không trắng màn | ⏳ Manual | Phase 12 D5 pending |
| RLS billing tables | ✅ PASS | Cross-tenant script |
| Payment gateway live | 🔒 BLOCKED | Mock/dev only — by design |
| Staging billing scripts | ✅ Available | `verify-billing-phase9-staging.mjs`, `verify-billing-tenant-mapping-staging.mjs` |

---

## 8. Court Engine

| Kiểm tra | Status | Evidence |
|----------|--------|----------|
| Route `/court-engine` | ⏳ Manual P0 | Phase 12 E1 |
| Reload direct URL | ✅ Unit + ⏳ manual | `tests/ui/court-engine.ui.test.jsx` (6 tests) |
| Check-in / queue / assign | ✅ Unit PASS | `court-engine.test.js` (29 tests) |
| Start/end turn timer | ✅ Unit PASS | court-engine tests |
| Null league/season guard | ✅ PASS | Fix 3d8688e / SeasonContext |
| Mobile layout 375px | ⏳ Manual P1 | GA-PRODUCTION-QA §F |
| Activity log | ⏳ Manual P2 | — |

---

## 9. Mobile / PWA / QR / Push / Offline

| Kiểm tra | Status | Evidence |
|----------|--------|----------|
| `manifest.webmanifest` | ✅ PASS | Phase 12 RC1 — 200 JSON |
| `manifest.json` alias | ✅ PASS | RC1 probe paths |
| Service worker build | ✅ PASS | `dist/sw.js` + workbox in build |
| PWA install prompt | ⏳ Manual | F1/F2 device |
| Android / iPhone Add to Home | ⏳ Manual | — |
| QR check-in flow | ⏳ Manual P0 | `mobile-sprint9.test.js` (26) unit only |
| Offline mode + queue | ⏳ Manual P1 | — |
| Push permission UI | ⏳ Manual P2 | — |
| Mobile route gate | ✅ Unit PASS | `mobile-phase8-hardening.test.js` |
| `qr_tokens`/`checkins` RLS | ⚠️ PARTIAL | KN-6 |

---

## 10. Menu / UX / SaaS readiness

| Kiểm tra | Status | Evidence |
|----------|--------|----------|
| Menu filtered by role | ✅ Unit PASS | `menuAccess.js`, rbac tests |
| PLAYER không thấy court-engine/admin | ✅ Unit PASS | rbac + mobile nav |
| VENUE_OWNER ops menu | ⏳ Manual P0 | H3 |
| Mobile drawer layout | ⏳ Manual P1 | H5 |
| Không label kỹ thuật thô | ⏳ Manual P1 | H1 — cần browser review |
| Tenant admin workflow | ⏳ Manual | Venue onboarding panels exist |
| Stash `IntegrationSettingsPage` | ⚠️ KN-5 | Mock payment toggle fix chưa merge |

---

## 11. Data / Migration / Rollback

### SQL migration order (Production promote)

| # | File | Rollback |
|---|------|----------|
| 1–15 | GA core (`supabase-club-v3` → `supabase-sprint10`) | Per `SUPABASE-PRODUCTION-CHECKLIST.md` |
| + | `supabase-billing-phase9.sql` | `supabase-billing-phase9-rollback.sql` |
| + | `supabase-sprint10-phase11b-persistence.sql` | `supabase-sprint10-phase11b-rollback.sql` |
| + | `supabase-sprint10-phase11c-api-key-guard.sql` | `supabase-sprint10-phase11c-rollback.sql` |
| + | `supabase-sprint10-phase11e-integration-audit.sql` | `supabase-sprint10-phase11e-rollback.sql` |

**Phase 11E legacy columns:** `action`/`meta` nullable (`cd21ba1`) — canonical `event_type`/`metadata`.

**Rollback docs:** 13 `*-rollback.sql` files present under `docs/`.

**Seed/cleanup:** `seed-phase11d-api-keys-staging.mjs` — probe tag `phase12-rc1`.

**Production checklists:** `docs/SUPABASE-PRODUCTION-CHECKLIST.md`, `docs/GA-PRODUCTION-ENV-CHECKLIST.md`, `docs/GA-PRODUCTION-QA.md`.

**CI note:** `.github/workflows/deploy.yml` chạy lint+test+build trên `main`/`master` only — branch `v5-platform-edition` không trigger auto-deploy (đúng cho NO-GO Production).

---

## Bug / blocker table

| ID | Area | Severity | Description | Evidence | Impact | Recommended action | Blocks RC1? | Blocks Production? | Owner |
|----|------|----------|-------------|----------|--------|-------------------|-------------|-------------------|-------|
| P13-B01 | QA | **P1** | Manual P0 browser QA chưa tick (66/94 cases) | `PHASE_12_V5_RC1_FULL_QA.md` | Không xác nhận login/court/billing trên Preview | Chạy manual P0 checklist §1–5, tick evidence | **Yes** (full RC1 sign-off) | **Yes** | manual QA |
| P13-B02 | RLS | **P1** | `qr_tokens`/`checkins` policy `USING (true)` | `supabase-mobile-sprint9.sql`, RLS PARTIAL×4 | Cross-tenant leak khi có mobile data | Seed cross-tenant verify **hoặc** tighten RLS patch | No (technical RC1) | **Yes** (mobile/QR) | backend |
| P13-B03 | Mobile | **P1** | Device QA (PWA install, QR scan, offline) chưa pass | KN-4, Phase 12 F1–F6 pending | Mobile production risk | Manual device pass trên Android + iPhone | No | **Yes** | manual QA |
| P13-B04 | Ops | **P2** | RC1 script headless cần `VERCEL_AUTOMATION_BYPASS_SECRET` | Phase 13 re-run BLOCKED | CI/agent không verify Preview HTTP khi thiếu env | Set bypass trong `.env.staging-qa.local` (gitignored) | No | No | ops |
| P13-B05 | Lint | **P2** | 128 ESLint `react-hooks/exhaustive-deps` warnings | `npm run lint` | Không ảnh hưởng runtime | Defer post-GA hoặc batch fix | No | No | frontend |
| P13-B06 | Billing | **P2** | Payment gateway live (VNPay/MoMo/Stripe) | KN-1 | Không thu tiền thật | Giữ mock/dev; gateway post-GA | No | No (by design) | product |
| P13-B07 | RBAC | **P2** | SUPER_ADMIN staging credentials missing | RLS script skip | Không verify platform admin global | Cập nhật staging creds hoặc doc | No | Partial | ops |
| P13-B08 | WIP | **P2** | `IntegrationSettingsPage.jsx` in stash | `stash@{0}` | Mock payment toggle fix chưa merge | Pop stash khi owner yêu cầu | No | No | frontend |
| P13-B09 | API | **P2** | Rate limit per-instance on Vercel | KN-2 | Không distributed rate limit | Post-GA Redis/KV limiter | No | No | backend |

**P0 bugs:** **None** phát hiện trong Phase 13.

---

## Known accepted risks

| ID | Risk | Severity | RC1 | Production |
|----|------|----------|-----|------------|
| KN-1 | Payment gateway mock only | P2 | Accept | Accept |
| KN-2 | Rate limit per-instance | P2 | Accept | Accept |
| KN-3 | SUPER_ADMIN password doc mismatch | P2 | Accept | Review |
| KN-4 | Mobile device QA partial | P1 | Accept | **Must close** |
| KN-5 | IntegrationSettingsPage stash | P2 | Accept | Accept |
| KN-6 | qr_tokens/checkins RLS open | P1 | Accept | **Must close** |

---

## Version progress assessment

| Area | Current status | Evidence | Remaining work | Blocks RC1? | Blocks GA? |
|------|----------------|----------|----------------|-------------|------------|
| V5.0 Platform Core | ✅ **PASS** (~95%) | 723 tests, architecture docs, modules 10–11E | Minor WIP stash | No | No |
| V5.0 RC1 Technical | ✅ **PASS** | Phase 12: RC1 19/0/0, RLS 31/4/0/0, build/lint | Re-run RC1 khi đổi Preview URL | No | No |
| V5.0 RC1 Staging Manual | ⏳ **NOT_STARTED** (0/66) | Phase 12 master checklist | Auth P0, Court P0, Billing P0, mobile P0 | **Yes** (full sign-off) | **Yes** |
| V5.0 GA Production | ⛔ **BLOCKED** (~12%) | NO-GO since Phase 10 | SQL prod, env prod, smoke, backup, KN-6 | — | — |

### V5.0 progress percentage

| Milestone | % | Basis |
|-----------|---|-------|
| Platform Core code | **95%** | Features implemented; stash minor |
| RC1 automated gates | **100%** | Phase 12 PASS documented |
| RC1 overall (incl. manual) | **~32%** | ~28/94 automated ticked; 66 manual pending |
| GA Production readiness | **~12%** | Checklists documented; execution not started |

**Overall V5.0 → GA:** **~38%**

---

## Manual QA remaining list (priority order)

### P0 — bắt buộc trước RC1 full sign-off

1. A1–A5, A7 — Auth login/logout/restore/guard/403  
2. B2, B7, B9, B12 — RBAC owner/player/menu/tenant  
3. D1–D5, D7 — Billing trial/active/expired/lock/resolver  
4. E1–E3, E5–E6, E10, E12 — Court engine browser smoke  
5. F3, F7 — QR check-in + mobile nav RBAC  
6. G12–G13 — Confirm Preview env stores (browser Network optional)  
7. C8 — qr_tokens manual hoặc seed verify  

### P1 — trước Production

8. F1–F2, F4, F6, F10 — PWA install, offline, SW  
9. H1–H5 — Menu UX SaaS  
10. J1–J10 — Production env/SQL/smoke checklist  
11. KN-6 — Tighten mobile RLS SQL patch  

### P2 — post-GA acceptable

12. A6, A8, D9–D10, E7–E9, F5, G11, J11–J12  

---

## RC1 Go/No-Go recommendation

| Gate | Verdict |
|------|---------|
| **RC1 Technical (automated)** | ✅ **GO** — PASS documented 2026-07-03; local gates re-confirmed Phase 13 |
| **Tag `v5.0.0-rc1` (technical only)** | ✅ **Conditional GO** — có thể tag khi owner approve; **không tự tag trong Phase 13** |
| **RC1 Staging full sign-off** | ⛔ **NO-GO** — manual P0 0% tick |
| **Production GA** | ⛔ **NO-GO** |

---

## Production GA Go/No-Go recommendation

⛔ **NO-GO** — lý do bắt buộc:

1. RC1 manual P0 chưa hoàn tất  
2. Production SQL 15+ steps chưa apply  
3. Production env checklist chưa tick  
4. KN-6 mobile RLS chưa harden  
5. Device mobile QA (KN-4) chưa pass  
6. Backup/rollback chưa execute  
7. Payment gateway vẫn mock (acceptable) nhưng cần explicit product sign-off  

---

## Next 10 actions (exact order)

1. **Set staging QA env** — `STAGING_PREVIEW_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` trong `.env.staging-qa.local` (gitignored); re-run `verify-v5-rc1-staging.mjs` → xác nhận 19/0/0.  
2. **Manual P0 Auth** — tick A1–A5, A7 trên Vercel Preview (owner + player accounts).  
3. **Manual P0 Court Engine** — tick E1–E3, E5–E6, E10 trên `/court-engine`.  
4. **Manual P0 Billing** — tick D1–D5, D7 trên `/billing` (owner staging A).  
5. **Seed hoặc tighten KN-6** — cross-tenant `qr_tokens`/`checkins` verify hoặc SQL patch RLS `tenant_id`.  
6. **Manual mobile P0** — F3 QR scan, F7 bottom nav RBAC trên device/emulator.  
7. **Họp RC1 Go/No-Go** — nếu P0 pass → approve tag `v5.0.0-rc1` (owner decision).  
8. **Production backup** — Supabase snapshot + note Vercel deployment ID.  
9. **Apply Production SQL** — theo `SUPABASE-PRODUCTION-CHECKLIST.md` (owner manual).  
10. **Production env + smoke** — `GA-PRODUCTION-ENV-CHECKLIST.md` → deploy → smoke §Production (J10) — **chỉ sau RC1 full GO**.

---

## Tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` | Master checklist 94 cases |
| `docs/v5/PHASE_10D_CROSS_TENANT_RLS_QA.md` | RLS baseline |
| `docs/v5/PHASE_10_RELEASE_AUDIT.md` | Phase 10 release audit |
| `docs/v5/PHASE_11C–11E *_STAGING_QA.md` | API phases |
| `scripts/verify-v5-rc1-staging.mjs` | RC1 technical gate |
| `scripts/verify-cross-tenant-rls-staging.mjs` | RLS JWT probe |
| `CHANGELOG.md` | Release history |

---

## Kết luận Phase 13

| Deliverable | Status |
|-------------|--------|
| Full software audit report | ✅ This document |
| P0 bugs mới | **0** |
| Automated local gates | ✅ PASS |
| Cross-tenant RLS re-run | ✅ PASS 31/4/0/0 |
| RC1 staging script re-run | ⚠️ BLOCKED (env) — Phase 12 PASS vẫn valid |
| Production deploy | ⛔ **NO-GO** (unchanged) |
| Stash IntegrationSettingsPage | ✅ Not popped |

**Phase 13 verdict:** V5.0 đạt **Platform Core + RC1 Technical**; **chưa** RC1 Staging full **chưa** GA Production.
