# V5.0 SaaS Completion Roadmap

**Ngày cập nhật:** 2026-07-03  
**Phiên bản mục tiêu:** Pickleball Scheduler Pro **v5.0** — Platform / SaaS Edition  
**Branch:** `v5-platform-edition`  
**Commit navigation (latest):** `33c968c` — fix(nav): wire V5 collapsible menu and role resolution  
**Commit menu + docs:** `150da3a` — menu V5 + docs Phase 14  
**Môi trường:** Staging Supabase + Vercel Preview — **không** Production  
**Ràng buộc:** Không tag `v5.0.0-rc1`; không deploy Production; không pop stash `IntegrationSettingsPage.jsx`; không ghi secret hoặc env value vào tài liệu/log.

---

## Executive summary

Navigation V5.0 đã triển khai kỹ thuật (config tập trung, sidebar, topbar, mobile nav theo role) và **automated gates PASS**. Tuy nhiên **Preview manual QA bị BLOCKED** vì `/login` lỗi thiếu Supabase config (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). RC1 tag và Production deploy **vẫn NO-GO**.

| Hạng mục | Verdict |
|----------|---------|
| Platform Core (code) | ✅ **PASS** |
| API key guard / runtime / audit | ✅ **PASS** |
| RC1 automated technical | ✅ **PASS** |
| Cross-tenant RLS | ✅ **PASS** (KN-6 partial) |
| Menu V5 code | ✅ **PASS** |
| Menu browser QA | ⛔ **BLOCKED** — Preview env |
| Manual P0 QA | ⏳ **Pending** |
| RC1 tag | ⛔ **Not allowed yet** |
| Production | ⛔ **NO-GO** |

---

## Current state

| Layer | Status | Ghi chú |
|-------|--------|---------|
| **Platform Core** | ✅ PASS | Kiến trúc SaaS multi-tenant, billing, court engine, API 11C–11E, mobile/PWA shell |
| **API key guard / runtime / audit** | ✅ PASS | Phase 11C–11E staging QA đóng |
| **RC1 automated technical** | ✅ PASS | `npm test` / `build` / `lint` + `verify-v5-rc1-staging.mjs` (documented 2026-07-03) |
| **Cross-tenant RLS** | ✅ PASS with KN-6 partial | 31 PASS / 4 PARTIAL — `qr_tokens`, `checkins` policy `USING (true)` |
| **Menu V5 code** | ✅ PASS | `navigationConfig.js`; sidebar + mobile drawer + topbar; 732 unit tests PASS |
| **Menu browser QA** | ⛔ BLOCKED | Preview thiếu `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → `/login` fail |
| **Manual P0 QA** | ⏳ Pending | Chỉ bắt đầu sau Phase 14A + 14B PASS |
| **RC1 tag** | ⛔ Not allowed yet | Chờ owner approve + tất cả gate trước Phase 17 |
| **Production** | ⛔ NO-GO | Chưa Production readiness, chưa GA deploy |

### Navigation V5.0 — triển khai kỹ thuật (đã xong)

| Thành phần | Trạng thái |
|------------|------------|
| `src/config/navigationConfig.js` — single source of truth | ✅ |
| Sidebar + mobile drawer dùng `navigationConfig.js` | ✅ |
| Topbar: tenant switcher, venue switcher, search, notification, profile, logout | ✅ |
| Mobile nav tách manager / referee / player | ✅ |
| Commit `33c968c` — collapsible menu + role resolution | ✅ |
| Commit `150da3a` — menu V5 + Phase 14 docs | ✅ |
| `npm test` | ✅ 732 tests, 0 fail |
| `npm run build` | ✅ PASS |

Chi tiết QA navigation: `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md`

---

## Go / No-Go

### RC1 (`v5.0.0-rc1`)

| Gate | Verdict |
|------|---------|
| **RC1 hiện tại** | ⛔ **NO-GO** |

**Lý do:**

1. Preview env fail — thiếu `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` trên Vercel Preview
2. Menu Manual QA chưa PASS — browser QA blocked bởi Preview env
3. Manual P0 QA chưa PASS — 66/94 case pending
4. KN-6 chưa closed for Production — `qr_tokens` / `checkins` RLS `USING (true)`

### Production GA

| Gate | Verdict |
|------|---------|
| **Production hiện tại** | ⛔ **NO-GO** |

**Lý do:** RC1 chưa GO; Production SQL/env/backup/smoke chưa tick; KN-6 chưa harden; Phase 18–19 chưa thực hiện.

---

## Phase roadmap

```
Phase 14A (Preview env) ──┐
                          ├──► Phase 15 (Manual P0 QA) ──► Phase 17 (RC1 tag)
Phase 14B (Menu manual) ──┘              │
                                         ▼
                              Phase 16 (KN-6 RLS) ──► Phase 18 (Prod readiness) ──► Phase 19 (GA deploy)
```

---

### Phase 14A — Preview Environment Gate

**Mục tiêu:** Preview Vercel chạy đúng commit mới nhất và `/login` không còn lỗi thiếu Supabase config.

**Trạng thái:** ⛔ **BLOCKED** — env chưa đủ trên Preview deployment.

| # | Task | Owner | Status |
|---|------|-------|--------|
| 14A-1 | Kiểm tra Vercel Preview env **names** (không in values) | DevOps | ⏳ |
| 14A-2 | Đảm bảo có `VITE_SUPABASE_URL` | DevOps | ⏳ |
| 14A-3 | Đảm bảo có `VITE_SUPABASE_ANON_KEY` | DevOps | ⏳ |
| 14A-4 | Đảm bảo có `VITE_API_ENABLED` (theo staging policy) | DevOps | ⏳ |
| 14A-5 | Redeploy Preview sau khi env đủ | DevOps | ⏳ |
| 14A-6 | Verify `/login` không còn lỗi thiếu Supabase config | QA | ⏳ |
| 14A-7 | Verify Preview chạy đúng commit mới nhất (`33c968c` hoặc sau) | QA | ⏳ |

**Env names cần có trên Vercel Preview (không ghi value):**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_ENABLED`

**Kết quả mong muốn:** ✅ **Preview Environment PASS**

---

### Phase 14B — V5 SaaS Navigation Manual QA

**Mục tiêu:** Xác nhận menu V5.0 SaaS đúng nghiệp vụ trên browser Preview.

**Trạng thái:** ⏳ **Pending** — chờ Phase 14A PASS.

**Tiền đề:** Phase 14A PASS; Preview `/login` hoạt động.

| # | Test case | Role | Kỳ vọng |
|---|-----------|------|---------|
| 14B-1 | Owner / court owner thấy đủ menu nghiệp vụ | COURT_OWNER | Sidebar đủ nhóm Vận hành, Khách hàng, CLB, Giải đấu, Tài chính, Báo cáo, Quản trị |
| 14B-2 | Player không thấy menu staff/admin | PLAYER | Không Check-in staff, không Quản trị, không Tài chính |
| 14B-3 | Referee mobile nav đúng role | REFEREE | Bottom nav: Trận đấu, Nhập điểm, Kết quả, Hồ sơ |
| 14B-4 | Manager mobile nav đúng role | COURT_MANAGER | Bottom nav manager profile; drawer đủ nhóm |
| 14B-5 | Không còn menu cũ 4 mục | All | Không label legacy (`USERS`, `Live Courts`, menu 4 mục cũ) |
| 14B-6 | Click menu không bị 403 sai role | COURT_OWNER | Mọi mục visible → route load, không `/403` |
| 14B-7 | `Của tôi (Mobile)` → `/mobile/player` | COURT_OWNER | Render đúng mobile shell |
| 14B-8 | Global search chỉ mục visible theo role | Mixed | RBAC filter đúng |
| 14B-9 | Venue switcher persist session | Multi-venue owner | `localStorage` active venue |

**Kết quả mong muốn:** ✅ **Menu V5.0 SaaS Manual PASS**

**Tài liệu chi tiết:** `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md` § Remaining manual QA

---

### Phase 15 — Manual P0 QA

**Mục tiêu:** Tick manual P0 master checklist (66 cases) trên Preview staging.

**Trạng thái:** ⏳ **Pending** — chỉ bắt đầu sau Phase 14A **và** 14B PASS.

**Tiền đề:**

- Phase 14A — Preview Environment PASS
- Phase 14B — Menu V5.0 SaaS Manual PASS

| Domain | Phạm vi | Tài liệu |
|--------|---------|----------|
| Auth | Login, logout, session restore, route guard | `PHASE_12` § A1–A8 |
| RBAC | Role menu, 403 guard, cross-tenant | `PHASE_12` § B* |
| Billing | Plan, payment, invoices, grace lock | `PHASE_12` § D* |
| Court Engine | Calendar, bookings, court-engine ops | `PHASE_12` § E* |
| Mobile / PWA | QR, check-in, bottom nav, offline shell | `PHASE_12` § F* |
| Menu / UX | Topbar, search, tenant/venue switcher | `PHASE_12` § H* |

**Master checklist:** `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` — 94 cases (38 P0, 36 P1, 20 P2).

**Kết quả mong muốn:** ✅ **Manual P0 PASS** (tick đủ P0 cases trên Preview)

---

### Phase 16 — Mobile QR / Check-ins RLS Hardening

**Mục tiêu:** Đóng KN-6 — harden RLS `qr_tokens` và `checkins` trước Production mobile traffic.

**Trạng thái:** ⏳ **Pending** — có thể song song Phase 15 nhưng **bắt buộc** trước Production.

| # | Task | Kỳ vọng |
|---|------|---------|
| 16-1 | SQL patch RLS `qr_tokens` — không còn `USING (true)` | Policy `tenant_id = user_venue_id()` hoặc tương đương |
| 16-2 | SQL patch RLS `checkins` — không còn `USING (true)` | Policy tenant-scoped |
| 16-3 | Cross-tenant verify — Owner A không đọc/ghi QR/checkins Owner B | `verify-cross-tenant-rls-staging.mjs` → 0 PARTIAL cho 2 bảng |
| 16-4 | Mobile QR flow vẫn hoạt động đúng tenant | Manual F3 + staging smoke |

**Known issue:** KN-6 — `qr_tokens` / `checkins` policy open, 0 rows staging, chưa leak thực tế nhưng **không chấp nhận cho Production**.

**Kết quả mong muốn:** ✅ **KN-6 CLOSED** — RLS hardened + cross-tenant verify PASS

---

### Phase 17 — RC1 Tag

**Mục tiêu:** Tag `v5.0.0-rc1` khi owner approve và tất cả gate đạt.

**Trạng thái:** ⛔ **NOT ALLOWED YET**

| Điều kiện | Required |
|-----------|----------|
| Preview Environment PASS (Phase 14A) | ✅ Bắt buộc |
| Menu Manual QA PASS (Phase 14B) | ✅ Bắt buộc |
| Manual P0 QA PASS (Phase 15) | ✅ Bắt buộc |
| Owner explicit approve | ✅ Bắt buộc |
| KN-6 closed (Phase 16) | ⚠️ Bắt buộc cho Production; khuyến nghị trước RC1 tag |

**Không tag nếu:**

- Manual P0 chưa PASS
- Preview Environment chưa PASS
- Menu Manual QA chưa PASS
- Owner chưa approve

**Lệnh (chỉ khi GO):**

```bash
git tag -a v5.0.0-rc1 -m "V5.0 RC1 — Platform SaaS Edition"
git push origin v5.0.0-rc1
```

⛔ **Không tự tag trong session QA/docs.**

---

### Phase 18 — Production Readiness

**Mục tiêu:** Chuẩn bị Production trước deploy — backup, SQL, env, smoke, rollback plan.

**Trạng thái:** ⏳ **Not started** — chờ Phase 17 GO.

| # | Task | Tài liệu |
|---|------|----------|
| 18-1 | Supabase Production backup / snapshot | `docs/SUPABASE-PRODUCTION-CHECKLIST.md` |
| 18-2 | Apply Production SQL (15+ steps) | `docs/supabase-*.sql` theo checklist |
| 18-3 | Production env checklist tick | `docs/GA-PRODUCTION-ENV-CHECKLIST.md` |
| 18-4 | Smoke test plan sẵn sàng | `docs/GA-PRODUCTION-QA.md` |
| 18-5 | Rollback plan documented | Deployment ID + DB snapshot reference |

**Kết quả mong muốn:** ✅ **Production Readiness GO**

---

### Phase 19 — GA Deploy

**Mục tiêu:** Deploy Production và xác nhận GA.

**Trạng thái:** ⛔ **NO-GO** — chỉ sau Phase 18 GO.

| # | Task |
|---|------|
| 19-1 | Deploy Vercel Production (owner trigger) |
| 19-2 | Production smoke test — auth, billing, court-engine, mobile |
| 19-3 | Monitor 24h — error rate, RLS, API audit |
| 19-4 | Publish `RELEASE_NOTES_v5.0.md` |
| 19-5 | Update `AGENTS.md` — GA status |

**Kết quả mong muốn:** ✅ **V5.0 GA LIVE**

---

## Completed phases (reference)

| Phase | Mô tả | Status | Tài liệu |
|-------|-------|--------|----------|
| 8 | Mobile GA checklist | ✅ | `PHASE_8_MOBILE_GA_CHECKLIST.md` |
| 9 | Commercial closeout | ✅ | `PHASE_9_COMMERCIAL_CLOSEOUT.md` |
| 10 | Release audit + cross-tenant RLS | ✅ | `PHASE_10_*` |
| 11A–11E | Marketplace API + key guard + audit | ✅ | `PHASE_11*` |
| 12 | RC1 full QA checklist (automated PASS) | ✅ partial | `PHASE_12_V5_RC1_FULL_QA.md` |
| 13 | Full software audit | ✅ | `PHASE_13_V5_FULL_SOFTWARE_AUDIT.md` |
| 14 (code) | Navigation V5 technical | ✅ | `PHASE_14_V5_SAAS_NAVIGATION_QA.md` |

---

## Next action (immediate)

1. **Phase 14A** — Owner/DevOps: kiểm tra và bổ sung env names trên Vercel Preview (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_ENABLED`), redeploy Preview.
2. Verify `/login` load không còn lỗi Supabase config.
3. **Phase 14B** — QA manual menu trên Preview (owner, player, referee).
4. Sau 14A + 14B PASS → mở **Phase 15** Manual P0 QA.

---

## Constraints (unchanged)

| Ràng buộc | Status |
|-----------|--------|
| Không tag `v5.0.0-rc1` | ⛔ Enforced |
| Không deploy Production | ⛔ Enforced |
| Không pop stash `IntegrationSettingsPage.jsx` | ✅ Stash intact |
| Không ghi secret / env value vào docs hoặc log | ⛔ Enforced |

---

## Tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` | Master checklist 94 cases |
| `docs/v5/PHASE_13_V5_FULL_SOFTWARE_AUDIT.md` | Full audit + KN-6 |
| `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md` | Navigation technical + manual QA |
| `docs/v5/PHASE_10D_CROSS_TENANT_RLS_QA.md` | RLS baseline |
| `docs/v5/V5_ARCHITECTURE_BLUEPRINT.md` | Kiến trúc V5 |
| `scripts/verify-v5-rc1-staging.mjs` | RC1 technical gate |
| `scripts/verify-cross-tenant-rls-staging.mjs` | RLS JWT probe |
