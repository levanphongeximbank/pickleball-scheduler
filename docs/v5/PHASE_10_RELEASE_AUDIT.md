# Phase 10A — Release Readiness Audit

**Ngày audit:** 2026-07-01  
**Phiên bản mục tiêu:** Pickleball Scheduler Pro v5.0 — SaaS Platform Edition  
**Môi trường tham chiếu:** Staging (Supabase + Vercel Preview)  
**Quyết định release:** ⛔ **NO-GO production** — còn gate P0/P1 và manual QA chưa đóng

---

## Tóm tắt điều hành

| Trạng thái | Số mục |
|------------|--------|
| PASS | 18 |
| PARTIAL | 14 |
| FAIL | 2 |
| BLOCKED | 3 |

**Blocker production (bắt buộc đóng trước release):**

1. Cross-tenant RLS manual QA chưa hoàn tất (Auth/RBAC/RLS)
2. Billing tenant mapping `profiles.venue_id` ↔ `venues.id` chưa verify end-to-end trên staging browser
3. Payment gateway thật (VNPay/MoMo/Stripe) chưa kiểm soát — chỉ mock/manual được phép

**P0 đã đóng (Phase 10B — 2026-07-01):**

- `/court-engine` crash `Cannot read properties of null (reading 'leagueId')` — ✅ fix `SeasonContext` null guard + `buildPlatformEngineSummary` + regression tests (631 unit + 6 UI)

---

## Bảng audit chi tiết

### 1. Auth

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Login / logout | PASS | `docs/GA-PRODUCTION-QA.md` §A — ✅ 2026-07-01 | Production manual QA passed |
| Session restore / refresh | PASS | `tests/auth.test.js`, GA-PRODUCTION-QA §A | Reload protected routes OK |
| Expired session | PARTIAL | `AuthContext.jsx`, route guards | Chưa tick forgot/reset password production |
| AUTH_INIT_TIMEOUT fix | PASS | Prior sprint closeout | Login/dashboard không còn treo |
| React #185 login fix | PASS | Prior sprint closeout | Dashboard render ổn định |
| Profile thiếu / signup role | PARTIAL | GA-PRODUCTION-QA §A — chưa tick | Cần QA production 8 user |

### 2. RBAC

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| 8 role definitions | PASS | `src/auth/roles.js`, `rolePermissions.js` | SUPER_ADMIN → PLAYER |
| Route guard | PASS | `router.jsx`, `ProtectedRoute` | Deny-by-default khi RBAC on |
| Menu guard | PASS | `src/auth/menuAccess.js`, `tests/rbac.test.js` | `/billing`, `/admin/billing` gated |
| 8-role manual QA | PARTIAL | `docs/GA-PRODUCTION-QA.md` §B — chưa tick | Automated RBAC pass; browser manual pending |
| PLAYER/REFEREE admin access | PASS | `tests/rbac.test.js`, mobile tests | Không thấy billing nav cho REFEREE |

### 3. RLS

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Tenant isolation (club_data) | PARTIAL | `tests/rls-access.test.js`, `tests/tenant.test.js` | Automated pass; staging SQL manual pending |
| Billing isolation | PARTIAL | `docs/v5/BILLING_RBAC_RLS_MATRIX.md` | SQL applied staging; cross-tenant browser QA ⏳ |
| Player/referee restrictions | PARTIAL | RBAC tests + mobile guards | Referee RPC: `tests/referee-rpc-security.test.js` ✅ |
| Cross-tenant authenticated | BLOCKED | `BILLING_RBAC_RLS_MATRIX.md` §Staging manual | Tenant A không được thấy Tenant B — **chưa verify** |
| SUPER_ADMIN bypass | PARTIAL | SQL policies in phase9 | Cần manual SQL probe staging |

### 4. Billing / SaaS (Phase 9)

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Plans / limits | PASS | `tests/billing-phase9.test.js` (14/14) | TRIAL/STARTER/PRO/ENTERPRISE |
| Subscription lifecycle | PASS | `subscriptionService.js`, billing tests | trialing→active→expired/suspended |
| Trial RPC | PASS | `docs/supabase-billing-phase9-trial-rpc.sql` | Applied staging |
| Invoice / payment | PASS | `invoiceService.js`, `paymentService.js` | Manual/mock only |
| Owner UI `/billing` | PARTIAL | `BillingPage.jsx`, staging browser | Cảnh báo venue mismatch khi `profiles.venue_id` ≠ `venues.id` |
| Admin UI `/admin/billing` | PARTIAL | Staging: Venue Staging A + trial seen | Cần verify đầy đủ suspend/unlock/mark paid |
| Tenant lock | PASS | `tenantAccessService.js`, `TenantOperationalGate.jsx` | Expired/suspended lock |
| Payment gateway thật | BLOCKED | `providers/vnpay`, `momo`, `stripe` stub | `GATEWAY_DISABLED` — không release với gateway live |
| Hydrate/persist Supabase | PARTIAL | `billing-repository-runtime.test.js` | Bridge ready; full browser QA pending |
| SQL staging apply | PASS | `docs/v5/PHASE_9_STAGING_BILLING_APPLY.md` | Tables + RLS applied |

### 5. Court Engine

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Route render (no white screen) | PASS | `SeasonContext.jsx`, `courtEngineContextGuard.js`, UI tests | Phase 10B: null `active` guard — no `leagueId` crash |
| Context empty state | PASS | `courtEngineContextGuard.js`, UI tests | NO_SEASON / NO_LEAGUE / TENANT_ERROR |
| Check-in / queue | PASS | `tests/court-engine.test.js` | Unit coverage |
| Auto-assign / timer / transfer | PASS | `tests/court-engine.test.js`, `courtStateService.js` | P0 auto-assign trùng sân đã fix GA-QA |
| Reload / direct URL | PASS | `tests/ui/court-engine.ui.test.jsx` (6/6), browser smoke | No white screen; unauth → login (expected) |
| Production QA | PARTIAL | `docs/GA-PRODUCTION-QA.md` §F | Re-QA staging sau 10B closeout |

### 6. Tournament Engine

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Create / CRUD | PASS | `tests/tournament-service.test.js` | |
| Bracket / group / standings | PASS | `tests/tournament-regression.test.js`, bracket tests | 5 regression scenarios |
| Match result / director sync | PASS | `tests/tournament-director.test.js` | |
| Tournament Engine page | PASS | `tests/tournament-engine.test.js` | |
| Production manual QA | PARTIAL | GA-PRODUCTION-QA §E — chưa tick | |

### 7. Mobile (Phase 8)

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| PWA manifest / icons | PASS | `docs/v5/PHASE_8_MOBILE_AUDIT.md` | |
| QR check-in | PASS | `tests/mobile-sprint9.test.js`, hardening tests | |
| Offline queue | PASS | `tests/mobile-phase8-hardening.test.js` | |
| Referee scoreboard | PASS | `tests/referee-flow.integration.test.js` | |
| Player shell real data | PASS | `mobile-phase8-product.test.js` | |
| Device QA iOS/Android | PARTIAL | `PHASE_8_MOBILE_GA_CHECKLIST.md` | Manual device chưa hoàn tất |
| VAPID push server | BLOCKED | Phase 8 audit | Client ready; server push ngoài scope GA |

### 8. Dashboard / Analytics

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Analytics logic | PASS | `tests/dashboard-analytics.test.js` | |
| Demo vs real data | PARTIAL | `Dashboard.jsx`, `VITE_SEED_DEMO` | Cần verify staging không lẫn demo |
| Filter season/league | PASS | `dashboard.logic.js` tests | |
| Revenue cards | PARTIAL | Court management revenue | GA-PRODUCTION-QA §H chưa tick |

### 9. Performance

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Unit test suite | PASS | `npm test` — **630/630** (2026-07-01) | |
| Build | PASS | `npm run build` — ✅ ~1.25s | |
| Lint | PASS | `npm run lint` — 0 errors, 123 warnings | Pre-existing warnings |
| UI tests | PASS | `npm run test:ui` — court-engine + harness | |
| Perf benchmarks | PARTIAL | `tests/performance.test.js` | Chưa chạy trong audit này |
| Bundle size | PARTIAL | build output ~471KB main gzip 144KB | Chấp nhận được; chưa budget gate |

### 10. Security

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| No service role in frontend | PASS | Grep + `security-hardening.test.js` | |
| Env secrets | PASS | `.env.example`, GA-PRODUCTION-ENV-CHECKLIST | Không commit `.env` |
| Referee RPC token scope | PASS | `tests/referee-rpc-security.test.js` | v3.5.6 hardening |
| Signup role lock | PASS | `tests/security-hardening.test.js` | v3.5.7 |
| Billing owner cannot edit status | PASS | `billing-phase9.test.js` RBAC | COURT_OWNER view-only |
| Unsafe logs | PARTIAL | Manual review | Không audit log dump đầy đủ |

### 11. Migration / Data

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Club v3 migration | PASS | `tests/club-v3.test.js` | v2→v3 auto migrate |
| Billing SQL + rollback | PASS | `supabase-billing-phase9.sql`, rollback files | Staging applied |
| Trial RPC rollback | PASS | `supabase-billing-phase9-trial-rpc-rollback.sql` | |
| Identity / mobile SQL | PARTIAL | `docs/SUPABASE-STAGING-CHECKLIST.md` | Một số sprint chưa production apply |
| Seed data staging | PARTIAL | Venue Staging A exists | `profiles.venue_id` mapping cần align |

### 12. Release / Deploy

| Mục | Trạng thái | Chứng cứ | Ghi chú |
|-----|------------|----------|---------|
| Vercel env checklist | PARTIAL | `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Production chưa tick |
| Supabase production | PARTIAL | `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | Tách staging/production |
| Feature flags GA default OFF | PASS | AI, API, Marketplace, gateways | |
| `VITE_RBAC_ENABLED=true` prod | PARTIAL | Checklist yêu cầu | Staging/preview verify trước |
| Release notes v5 | PARTIAL | `CHANGELOG.md`, v4 GA docs | v5 release report chưa viết |
| Production deploy | BLOCKED | Phase 10 nguyên tắc | **Không deploy** khi còn gate trên |

---

## Automated gate snapshot (2026-07-01)

```bash
npm test        # 630/630 PASS
npm run build   # PASS
npm run lint    # 0 errors, 123 warnings
npm run test:ui # court-engine + auth harness PASS
```

Billing subset:

```bash
node --test tests/billing-phase9.test.js           # 14/14 PASS
node --test tests/billing-repository-runtime.test.js
```

---

## Release gate checklist (NO-GO criteria)

| Gate | Hiện trạng | Pass? |
|------|------------|-------|
| Không route trắng màn | `/court-engine` P0 đóng 10B | ✅ |
| Auth ổn định | Login/session OK | ✅ |
| RLS verified cross-tenant | Manual pending | ❌ |
| Billing tenant/subscription đúng | Venue mapping warning | ❌ |
| Payment không sửa sai quyền | Automated RBAC OK | ✅ |
| Court Engine không crash | Phase 10B fix + tests pass | ✅ |
| Build/test/lint pass | All green | ✅ |
| Payment thật kiểm soát | Gateways disabled | ✅ (by design) |

---

## Việc tiếp theo (Phase 10B → 10N)

1. ~~**10B** — Đóng P0 `/court-engine` null `leagueId` + regression test~~ ✅ 2026-07-01
2. **10C** — Full regression QA staging browser
3. **10D** — Auth/RBAC/RLS manual matrix (8 roles + cross-tenant)
4. **10E** — Billing/SaaS browser QA (`/billing`, `/admin/billing`)
5. **10F–10M** — Mobile, tournament, dashboard, perf, security, migration QA
6. **10N** — Final release report + production checklist tick

---

## Tài liệu tham chiếu

| Doc | Mục đích |
|-----|----------|
| `docs/GA-PRODUCTION-QA.md` | Manual QA matrix v4 GA (đang mở rộng v5) |
| `docs/v5/PHASE_9_COMMERCIAL_AUDIT.md` | Phase 9 scope closeout |
| `docs/v5/BILLING_RBAC_RLS_MATRIX.md` | Billing permissions + RLS |
| `docs/v5/PHASE_8_MOBILE_AUDIT.md` | Mobile 5.0 status |
| `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Vercel/Supabase env |
| `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | SQL production apply order |

---

**Kết luận Phase 10A/10B:** Staging **đủ điều kiện tiếp tục QA sprint** (Court Engine P0 đóng). **Chưa đủ điều kiện production release** — còn billing tenant mapping và cross-tenant RLS manual.
