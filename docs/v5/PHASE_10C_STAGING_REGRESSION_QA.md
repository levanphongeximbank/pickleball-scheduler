# Phase 10C — Staging Browser Regression QA

**Ngày QA:** 2026-07-01  
**Branch:** `v5-platform-edition`  
**Commits under test:** `d282c2b` (occupied court fix), `3d8688e` (null active/leagueId guard)  
**Môi trường:** Staging Supabase `qyewbxjsiiyufanzcjcq.supabase.co` + build Preview local (`npm run build` + `npm run preview` port 4173) với `.env.local` (`VITE_RBAC_ENABLED=true`, `VITE_BILLING_SUPABASE=true`)

**Phạm vi:** Regression sau Court Engine fixes — **không sửa code**, **không test payment thật**.

---

## Tóm tắt điều hành

| Kết luận | Chi tiết |
|----------|----------|
| **Regression Court Engine P0** | ✅ Không phát hiện regression mới |
| **Sang Phase 10E** | ✅ **Có thể** — không có blocker mới từ 10C |
| **Production release** | ⛔ **Chưa** — RLS cross-tenant + billing mapping vẫn mở |
| **Rollback** | ❌ **Không cần** — fix `3d8688e` / `d282c2b` ổn định |

| Trạng thái tổng | Số mục |
|-----------------|--------|
| PASS | 14 |
| PARTIAL | 9 |
| FAIL | 0 |
| BLOCKED | 4 |

---

## Automated gate (pre-browser)

| Lệnh | Kết quả | Thời điểm |
|------|---------|-----------|
| `npm test` | **631/631 PASS** | 2026-07-01 |
| `npx vitest run tests/ui/court-engine.ui.test.jsx` | **6/6 PASS** | 2026-07-01 |
| `npm run build` | **PASS** | 2026-07-01 |
| `npm run lint` | **0 errors**, 128 warnings | 2026-07-01 |

---

## Bảng QA chi tiết

### A. Auth / Login

| # | Hạng mục | Trạng thái | Bằng chứng | Lỗi | Mức | Đề xuất |
|---|----------|------------|------------|-----|-----|---------|
| A1 | Chưa đăng nhập → redirect Login | **PASS** | Browser smoke: `/court-engine` → `http://127.0.0.1:4173/login` | — | — | — |
| A2 | Login staging account hợp lệ | **BLOCKED** | Playwright: `waitForURL` timeout 30s sau submit `owner@staging.local` | Không rời `/login` — cần xác nhận account/password staging hoặc email confirm | **P2** | Manual login trên Vercel Preview; verify user tồn tại trong Supabase Auth |
| A3 | Reload sau login không treo spinner | **PARTIAL** | `docs/GA-PRODUCTION-QA.md` §A ✅ Production 2026-07-01; staging browser chưa login được | — | — | Re-test sau khi A2 pass |
| A4 | Logout | **PARTIAL** | Browser: logout khi chưa login thành công → vẫn ở `/login` (PASS về redirect) | — | — | Manual sau A2 |
| A5 | Session restore | **PASS** | `tests/auth.test.js`, GA-PRODUCTION-QA §A | — | — | — |

### B. Route guard / RBAC

| # | Hạng mục | Trạng thái | Bằng chứng | Lỗi | Mức | Đề xuất |
|---|----------|------------|------------|-----|-----|---------|
| B1 | VENUE_OWNER / VENUE_MANAGER vào `/court-engine` | **PARTIAL** | `rolePermissions.js`: `DIRECTOR_USE` + `SCHEDULING_RUN` trong `VENUE_OPS`; browser chưa login | — | — | Manual tick sau A2 |
| B2 | CLUB_OWNER vào `/court-engine` | **PARTIAL** | `CLUB_OWNER_PERMISSIONS` có `SCHEDULING_RUN` | — | — | Manual |
| B3 | PLAYER → `/court-engine` → 403 | **PARTIAL** | `PLAYER_PERMISSIONS` không có scheduling; `CourtEnginePage` → `ForbiddenPage` khi RBAC; browser chưa login | — | — | Manual với `player@staging.local` |
| B4 | CASHIER / ACCOUNTANT / REFEREE không vào `/court-engine` | **PARTIAL** | RBAC matrix: không có `SCHEDULING_RUN` / `DIRECTOR_USE` | — | — | Manual |
| B5 | Không white screen trên route guard | **PASS** | UI tests 6/6; browser unauth → login (không blank) | — | — | — |

### C. Court Engine

| # | Hạng mục | Trạng thái | Bằng chứng | Lỗi | Mức | Đề xuất |
|---|----------|------------|------------|-----|-----|---------|
| C1 | Mở `/court-engine` không crash `leagueId` | **PASS** | Fix `3d8688e`; UI test `active: null`; `resolveCourtEngineContextState` tests | — | — | — |
| C2 | Reload trực tiếp `/court-engine` | **PASS** | UI tests + GA-PRODUCTION-QA §F; browser unauth → login OK | — | — | Re-QA authenticated trên Preview |
| C3 | Check-in 4 người + Queue | **PASS** | `tests/court-engine.test.js` check-in/queue; GA-PRODUCTION-QA §F tick | — | — | — |
| C4 | Ghép sân tự động lần 1 + confirm | **PASS** | `generateCourtAssignments` + `confirmAssignments` tests | — | — | — |
| C5 | Ghép lần 2 — không gán đè sân bận | **PASS** | `occupied court skipped on second auto-assign` (`d282c2b`); GA-PRODUCTION-QA §F P0 | — | — | — |
| C6 | Pause trận → ghép lại: sân pause bị loại | **PARTIAL** | `courtStateService.js`: `PAUSED` ∈ `BUSY_ASSIGNMENT_STATUSES`; chưa có unit test riêng pause+auto-assign; browser chưa chạy | — | **P3** | Thêm unit test `paused court skipped` (optional); manual browser tick |
| C7 | Kết thúc trận → sân trống, ghép lại OK | **PASS** | `timer start pause resume end` + `endMatchTimer` sync `courtStates` | — | — | — |
| C8 | Reload giữ session localStorage | **PASS** | GA-PRODUCTION-QA §F Session Persistence | — | — | — |
| C9 | Thiếu season/league → empty state | **PASS** | UI tests NO_SEASON / NO_LEAGUE; không crash | — | — | — |

### D. Dashboard / Menu

| # | Hạng mục | Trạng thái | Bằng chứng | Lỗi | Mức | Đề xuất |
|---|----------|------------|------------|-----|-----|---------|
| D1 | Sidebar/menu không mất item quan trọng | **PARTIAL** | `tests/rbac.test.js` menuAccess; chưa browser authenticated | — | — | Manual sau login staging |
| D2 | Điều hướng giữa các màn không crash | **PARTIAL** | Logic/unit PASS; browser nav khi chưa login → redirect login (không blank) | — | — | Manual `/`, `/players`, `/settings` |
| D3 | Không route trắng màn | **PASS** | UI Court Engine 6/6; unauth routes render login | — | — | — |

### E. Billing hiện trạng (ghi nhận — Phase 10E)

| # | Hạng mục | Trạng thái | Bằng chứng | Lỗi | Mức | Đề xuất |
|---|----------|------------|------------|-----|-----|---------|
| E1 | Owner `/billing` | **BLOCKED** | Browser chưa login staging; Phase 9 audit: Venue Staging A + trial trên `/admin/billing` | `profiles.venue_id` mismatch → `tenant_not_found` warning (đã biết) | **P1** | **Phase 10E** |
| E2 | Admin `/admin/billing` | **PARTIAL** | `PHASE_9_COMMERCIAL_CLOSEOUT.md` — admin thấy trial | Cross-tenant RLS manual ⏳ | **P1** | Phase 10E + 10D |
| E3 | SubscriptionGate | **PASS** | `tests/billing-phase9.test.js` TenantAccessService; `subscriptionAccessBridge` | — | — | Browser verify sau login |
| E4 | Payment thật | **BLOCKED** | By design — mock/manual only | — | — | Không bật gateway |

### F. Mobile / PWA cơ bản

| # | Hạng mục | Trạng thái | Bằng chứng | Lỗi | Mức | Đề xuất |
|---|----------|------------|------------|-----|-----|---------|
| F1 | Viewport mobile login layout | **BLOCKED** | Playwright iPhone 13: login timeout | — | **P2** | Manual device/preview |
| F2 | `/court-engine` mobile không trắng màn | **PARTIAL** | GA-PRODUCTION-QA §F mobile **PARTIAL**; UI tests desktop jsdom | — | **P3** | Device QA follow-up |
| F3 | Mobile nav RBAC | **PASS** | `mobile-phase8-hardening.test.js` — REFEREE không thấy billing | — | — | — |

### G. Console / Network

| # | Hạng mục | Trạng thái | Bằng chứng | Lỗi | Mức | Đề xuất |
|---|----------|------------|------------|-----|-----|---------|
| G1 | Uncaught `leagueId` runtime | **PASS** | Browser unauth + UI tests: không có `pageerror` leagueId | — | — | — |
| G2 | Console error nghiêm trọng (unauth) | **PASS** | Browser smoke: `consoleErrors: []` trên `/login` redirect path | — | — | — |
| G3 | API/RLS errors khi authenticated | **BLOCKED** | Cần session staging | — | — | Phase 10D |

---

## Browser QA session log

**Preview URL:** `http://127.0.0.1:4173` (build từ commit `3d8688e` + `.env.local`)  
**Công cụ:** Playwright headless smoke (2026-07-01T21:16Z)

| Case | Kết quả |
|------|---------|
| Unauthenticated `/court-engine` → Login | ✅ PASS |
| Owner login + reload | ⏸ BLOCKED (login timeout) |
| Owner `/court-engine` | ⏸ BLOCKED (phụ thuộc login) |
| Player `/court-engine` → 403 | ⏸ BLOCKED |
| Mobile owner court-engine | ⏸ BLOCKED |
| `/billing` snapshot | ⏸ Hiển thị Login (chưa auth) |

**Thay thế bằng chứng mạnh cho Court Engine core:**

- Production manual QA `docs/GA-PRODUCTION-QA.md` §F — **PASS 2026-07-01** (check-in, queue, auto-assign P0, reload, empty state)
- Unit regression `tests/court-engine.test.js` — occupied court, timer, context guard
- UI regression `tests/ui/court-engine.ui.test.jsx` — 6/6 including `active: null`

---

## Lỗi phát hiện trong Phase 10C

| ID | Mô tả | Mức | Chặn production? | Hành động |
|----|-------|-----|------------------|----------|
| — | **Không có P0/P1 mới** từ regression Court Engine | — | Không | — |
| 10C-BLOCK-1 | Staging login automation timeout (`owner@staging.local`) | P2 | Không (QA tooling) | Verify Supabase Auth users + password; manual Preview QA |
| 10E-KNOWN-1 | Billing `tenant_not_found` khi `profiles.venue_id` ≠ `venues.id` | P1 | Có (billing SaaS) | **Phase 10E** — đã lên lịch |
| 10D-KNOWN-1 | Cross-tenant RLS chưa manual | P1 | Có (security) | **Phase 10D** |

---

## Kết luận Phase 10C

### Có thể sang Phase 10E Billing mapping chưa?

**Có.** Phase 10C không phát hiện regression mới trên Court Engine sau `d282c2b` + `3d8688e`. Automated suite 631 + UI 6/6 pass. Billing mapping (`10E-KNOWN-1`) là blocker đã biết từ Phase 9/10A — **đúng thứ tự** xử lý tiếp.

### Có lỗi nào chặn production không?

**Có — không phải từ 10C regression mới:**

1. Billing tenant/subscription mapping (10E)
2. Cross-tenant RLS manual (10D)
3. Staging authenticated browser QA chưa đóng hết (PARTIAL/BLOCKED do login tooling)

**Không có P0/P1 mới** từ scope 10C.

### Có cần rollback không?

**Không.** Commit `3d8688e` và `d282c2b` ổn định; test pass; không regression chứng minh. Rollback chỉ cần nếu Preview manual phát hiện blocker mới (chưa có).

---

## Việc manual còn lại (người QA trên Vercel Preview)

Sau khi Preview deploy commit `3d8688e` Ready:

1. Login `owner@staging.local` / `manager@staging.local` / `club@staging.local` — tick B1–B4
2. Chạy full checklist §C trên browser (đặc biệt C6 pause + auto-assign)
3. Mở `/billing` + `/admin/billing` — ghi snapshot cho 10E
4. Mobile viewport trên Preview URL

**Tài khoản tham chiếu:** `docs/STAGING-APPLY-QA-v358.md` §2 (password gợi ý `PickleStaging!358`)

---

## Tham chiếu

- `docs/v5/PHASE_10_RELEASE_AUDIT.md`
- `docs/GA-PRODUCTION-QA.md` §A, §F
- `docs/STAGING-APPLY-QA-v358.md`
- `docs/v5/PHASE_9_COMMERCIAL_CLOSEOUT.md`
