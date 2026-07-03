# Phase 14 — V5.0 SaaS Navigation QA

**Ngày:** 2026-07-03  
**QA session:** 2026-07-03 14:48–14:57 ICT (gates re-run trước Preview sign-off)  
**Branch:** `v5-platform-edition`  
**Commit:** `60d50563f8d1d0c40cf3f9076c6db8377195f7d9`  
**Phạm vi:** Menu V5 tập trung (`navigationConfig.js`), sidebar/desktop, mobile drawer + bottom nav, RBAC/menu guards  
**Môi trường:** Local gates + Vercel Preview — **không** Production, **không** tag `v5.0.0-rc1`  
**Ràng buộc:** Không pop stash `IntegrationSettingsPage.jsx`; không ghi secret.

---

## Executive summary

| Hạng mục | Verdict |
|----------|---------|
| **RC1 menu structure** | ✅ **PASS** — config tập trung, nhãn tiếng Việt, không trỏ route gây hiểu nhầm |
| **Future/V5.1 items** | ✅ **HIDDEN** — chỉ khai báo `navStatus: future` trong `navigationConfig.js` |
| **Regression fixes (owner/player/mobile)** | ✅ **PASS** (automated) |
| **Automated gates** | ✅ **PASS** |
| **RC1 browser sign-off** | ⏳ **PENDING** — manual QA Preview (mục § Remaining manual QA) |

---

## 1. Root cause — `npm test` 700 vs 723?

### Kết luận

**Không có test bị xóa, skip, hay đổi runner/filter** trong Phase 14.

| Câu hỏi | Trả lời |
|---------|---------|
| Có xóa test không? | **Không** — `package.json` `test:unit` vẫn liệt kê đủ 78 file test như Phase 13 |
| Có skip test không? | **Không** — `skipped: 0` khi chạy `npm test` |
| Có đổi test runner/filter không? | **Không** — vẫn `node --test` + danh sách file tường minh |
| File test nào thay đổi? | `tests/rbac.test.js`, `tests/mobile-phase8-hardening.test.js` — **cập nhật assertion nhãn menu** (legacy → V5 labels); Phase 14 **thêm** 7 test navigation |

### Số test chính xác (đã xác minh bằng worktree)

| Run | Commit | Tests | Suites | Skipped |
|-----|--------|-------|--------|---------|
| Phase 13 baseline | `cd33b65` (worktree `npm test`) | **723** | 56 | 0 |
| Phase 14 hiện tại | `60d5056` (`npm test`) | **730** | 56 | 0 |
| Chênh lệch | +7 test mới navigation QA | +7 | 0 | 0 |

**Phase 14 không xóa test:** `git diff cd33b65..HEAD -- tests/ package.json` chỉ đổi 2 file (`rbac.test.js` +98/−21 dòng, `mobile-phase8-hardening.test.js` +21/−2). `package.json` `test:unit` **không đổi** — vẫn 78 file test.

**Giải thích “700” (root cause):**

| Khả năng | Phân tích |
|----------|-----------|
| **Nhầm 730 → 700** | Output hiện tại: `ℹ pass 730` — typo khi đọc log |
| **Trừ nhầm `test:ui`** | `npm run test:ui` = **30** vitest tests (suite riêng, **không** nằm trong `npm test`). 730 − 30 = **700** — khớp con số báo cáo |
| Xóa / skip / đổi filter | **Loại trừ** — `skipped: 0`, không file test bị gỡ khỏi `test:unit` |

`npm test` = `npm run test:unit` only. `npm run test:quality` = unit + perf (3) + ui (30) — **không** dùng làm baseline Phase 13.

### Thay đổi assertion (không giảm số test)

| File | Thay đổi |
|------|----------|
| `tests/rbac.test.js` | Nhãn menu: `Người chơi`→`Danh sách VĐV`, `Xếp sân`→`Danh sách chờ`, `Live Courts`→`Trạng thái sân` / `Đặt sân`, v.v. |
| `tests/mobile-phase8-hardening.test.js` | Key bottom nav: `tournament`→`player-tournament`, `checkin`→`venue-checkin`, `referee`→`referee-matches` |

### Test mới (Phase 14)

| Test | File |
|------|------|
| RC1 không render mục future | `rbac.test.js` |
| VENUE_OWNER thấy `Của tôi (Mobile)` | `rbac.test.js` |
| Không label `USERS` | `rbac.test.js` |
| Owner không thấy `AI Assistant` khi flag tắt | `rbac.test.js` |
| Owner vào mọi path menu visible | `rbac.test.js` |
| PLAYER mobile thấy `Trang của tôi` | `rbac.test.js` |
| VENUE_OWNER vào `/mobile/player` | `mobile-phase8-hardening.test.js` |

---

## 2. Root cause — navigation refactor

**Vấn đề:** Menu rải rác (`sidebarMenu.js`, `mobileNav.js`) — nhãn legacy (`USERS`, `Live Courts`, `Xếp sân`), mục V5.1 trỏ tạm sang trang gần nhất, owner thiếu mobile shell, player thiếu nhãn `Trang của tôi`.

**Giải pháp:** Single source of truth `src/config/navigationConfig.js` — `MENU_GROUPS`, `ROLE_MENU_MAP`, `MOBILE_BOTTOM_NAV_PROFILES`, `ROUTE_PERMISSIONS`. Sidebar, drawer, bottom nav, global search derive từ đây. Mục chưa có route → `navStatus: future` (không render RC1).

---

## 3. Files changed

| File | Loại | Mô tả |
|------|------|-------|
| `src/config/navigationConfig.js` | **NEW** | Menu V5, role map, mobile profiles, future items |
| `src/config/navIcons.js` | **NEW** | Icon key → MUI |
| `src/config/sidebarMenu.js` | MOD | Re-export `MENU_GROUPS` |
| `src/auth/menuAccess.js` | MOD | Filter `navStatus: future`, derive routes từ config |
| `src/components/Sidebar.jsx` | MOD | Render từ `navigationConfig` |
| `src/components/Header.jsx` | MOD | Global search hook-in |
| `src/components/GlobalSearch.jsx` | **NEW** | Tìm menu theo RBAC |
| `src/components/VenueSwitcher.jsx` | **NEW** | Chuyển venue session |
| `src/data/venueSession.js` | **NEW** | `localStorage` active venue |
| `src/layouts/MainLayout.jsx` | MOD | Mobile nav provider, layout |
| `src/features/mobile/constants/mobileNav.js` | MOD | Re-export config |
| `src/features/mobile/services/mobileNavAccess.js` | MOD | Profiles + owner `/mobile/player` |
| `src/features/mobile/layout/MobileBottomNav.jsx` | MOD | V5 bottom nav |
| `src/features/mobile/layout/MobileDrawer.jsx` | MOD | V5 drawer |
| `src/features/mobile/context/mobileNavContext.js` | **NEW** | Context + hook |
| `src/features/mobile/context/MobileNavProvider.jsx` | **NEW** | Provider component |
| `tests/rbac.test.js` | MOD | Nav QA tests + label updates |
| `tests/mobile-phase8-hardening.test.js` | MOD | Owner mobile + key updates |
| `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md` | **NEW** | Báo cáo này |

---

## 4. Route mapping table (RC1 active items)

| Nhóm | Menu (VI) | Route | Ghi chú |
|------|-----------|-------|---------|
| Dashboard | Tổng quan | `/` | |
| Vận hành sân | Lịch sân | `/court-management/calendar` | |
| | Đặt sân | `/court-management/bookings` | |
| | Check-in | `/mobile/check-in` | Staff only |
| | Danh sách chờ | `/select-players` | |
| | Điều phối sân | `/court-engine` | |
| | Trạng thái sân | `/court-management` | |
| Khách hàng & VĐV | Danh sách khách hàng | `/court-management/customers` | |
| | Danh sách VĐV | `/players` | |
| | Điểm trình độ | `/statistics` | Tab/view chung |
| | Lịch sử thi đấu | `/statistics` | Tab/view chung |
| CLB | Danh sách CLB | `/clubs` | |
| | Thành viên CLB | `/players` | |
| | Lịch sinh hoạt | `/club` | Route thật |
| | Giải nội bộ CLB | `/daily-play` | Route thật |
| Giải đấu | Danh sách giải | `/tournament` | |
| | Tạo giải / Đăng ký VĐV | `/tournament` | Cùng hub |
| | Ghép cặp | `/select-players` | |
| | Chia bảng / Sơ đồ | `/tournament/bracket` | |
| | Lịch thi đấu | `/court-engine` | Director view |
| | Trọng tài | `/referee` | |
| | Kết quả & Xếp hạng | `/statistics` | |
| Tài chính | Đơn hàng | `/marketplace/orders` | Flag marketplace |
| | Thanh toán | `/billing/payment` | |
| | Gói thuê bao | `/billing/current-plan` | |
| | Lịch sử giao dịch | `/billing/invoices` | Route thật |
| Báo cáo | Tổng quan KD | `/` | |
| | Doanh thu sân | `/court-management/revenue` | |
| | Hiệu suất sân | `/court-management` | |
| | Khách hàng | `/court-management/customers` | |
| | Giải đấu | `/statistics` | |
| Quản trị | Cụm sân | `/admin/tenants` | SUPER_ADMIN |
| | Người dùng | `/users` | Không còn label `USERS` |
| | Vai trò & Quyền | `/users` | |
| | Sân | `/court-management/courts` | |
| | Cấu hình | `/settings` | |
| | Nhật ký | `/audit` | |
| | Tích hợp | `/settings/integrations` | Flag API |
| Hỗ trợ | Trung tâm trợ giúp | `/billing/support` | Route thật |
| | Hồ sơ của tôi | `/profile` | |
| | Của tôi (Mobile) | `/mobile/player` | Owner/Manager |
| | Thông báo / QR / Billing | `/mobile/*`, `/billing` | Theo role |

---

## 5. Hidden / Future items (V5.1)

Chỉ khai báo trong `navigationConfig.js` — `navStatus: future` → **không render** RC1.

| Key | Label | Lý do ẩn | Kế hoạch |
|-----|-------|----------|----------|
| `customer-groups` | Nhóm khách hàng | Chưa có `/court-management/customer-groups` | V5.1 |
| `debt` | Công nợ | Không trỏ tạm revenue (sai nghiệp vụ) | V5.1 |
| `report-peak` | Giờ cao điểm | Chưa có báo cáo riêng | V5.1 |
| `ai-validation` | Cảnh báo bất hợp lý | Chưa có màn validation riêng | V5.1 + AI flag |

**Đã xác nhận ACTIVE (có route thật):**

| Label | Route | Verdict |
|-------|-------|---------|
| Lịch sử giao dịch | `/billing/invoices` | ✅ Active |
| Lịch sinh hoạt | `/club` | ✅ Active |
| Giải nội bộ CLB | `/daily-play` | ✅ Active |
| Trung tâm trợ giúp | `/billing/support` | ✅ Active |

**Nhóm AI Assistant:** ẩn toàn bộ khi `VITE_ENABLE_AI_ENGINE=false` (RC1 default). Không có label `AI Director Platform` trong sidebar.

---

## 6. Role visibility matrix (sidebar RC1)

| Nhóm / mục chính | SUPER_ADMIN | COURT_OWNER | COURT_MANAGER | CASHIER | ACCOUNTANT | CLUB_OWNER | PLAYER | REFEREE |
|------------------|:-----------:|:-----------:|:-------------:|:-------:|:----------:|:----------:|:------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Vận hành sân | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Khách hàng & VĐV | ✅ | ✅ | ✅ | — | — | ✅ | — | — |
| CLB | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — |
| Giải đấu | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| Tài chính | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| Báo cáo | ✅ | ✅ | ✅ | — | ✅ | — | — | — |
| AI Assistant | flag | flag | flag | — | — | — | — | — |
| Quản trị | ✅ | ✅* | — | — | — | — | — | — |
| Hỗ trợ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| VĐV zone | — | — | — | — | — | ✅ | ✅ | — |
| Trọng tài zone | — | — | — | — | — | — | — | ✅ |
| Của tôi (Mobile) | ✅ | ✅ | ✅ | — | — | — | ✅** | — |

\* Owner: không thấy `/admin/tenants`, `/admin/billing` (role-gated)  
\** Player: trong nhóm VĐV + bottom nav `Trang của tôi`

---

## 7. Mobile navigation matrix

| Profile | Bottom nav items | Drawer |
|---------|------------------|--------|
| **manager** (owner/manager/staff) | Tổng quan*, Lịch sân, Check-in, Giải đấu, Thêm | Full menu groups + quick links |
| **referee** | Trận đấu, Nhập điểm, Kết quả, Hồ sơ | Referee + tournament |
| **player** | **Trang của tôi**, Lịch chơi, Giải đấu, QR, Hồ sơ | CLB + giải + VĐV zone |

\* Manager có quyền ops → shortcut `/mobile/operations` thay dashboard khi phù hợp.

| Route | PLAYER | OWNER | REFEREE |
|-------|:------:|:-----:|:-------:|
| `/mobile/player` | ✅ | ✅ | ✅ (hồ sơ) |
| `/mobile/check-in` | ❌ | ✅ | ✅ |
| `/mobile/qr-scan` | ❌ | ✅ | ❌ |

---

## 8. Regression checklist (automated)

| Bug cũ | Kết quả Phase 14 |
|--------|------------------|
| Owner không thấy `Của tôi (Mobile)` / `/mobile/player` | ✅ Fixed — menu + `PLAYER_SHELL_ROLES` |
| Player thấy `Trang của tôi` | ✅ Fixed — bottom nav label |
| Owner click menu → 403 | ✅ Automated — mọi path visible pass `canAccessRoute` |
| Label `USERS` | ✅ Fixed — hiển thị `Người dùng` |
| `AI Director Platform` sidebar owner | ✅ Không render — nhóm `AI Assistant` gated by flag |

---

## 9. Bugs found

| ID | Severity | Mô tả | Status |
|----|----------|-------|--------|
| NAV-1 | P1 | Mục V5.1 trỏ tạm revenue/customers | ✅ Fixed — `navStatus: future` |
| NAV-2 | P1 | Owner thiếu `/mobile/player` | ✅ Fixed |
| NAV-3 | P2 | Player bottom nav `Trang chủ` thay vì `Trang của tôi` | ✅ Fixed |
| NAV-4 | P2 | `MobileNavContext.jsx` lint `react-refresh/only-export-components` | ✅ Fixed — tách provider/hook |
| — | — | Không phát hiện P0 mới | — |

---

## 10. Full gates result (2026-07-03 14:48–14:57 ICT)

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `git diff --check` | ✅ **Clean** | Exit 0, không whitespace conflict |
| `npm test` | ✅ **730/730 PASS** | 56 suites, fail 0, skipped 0, duration ~6.8s |
| `npm run build` | ✅ **PASS** | Vite build OK, PWA precache 179 entries (~2953 KiB) |
| `npm run lint` | ✅ **0 errors** | 129 warnings `react-hooks/exhaustive-deps` (pre-existing) |

**Không chạy cho RC1 nav sign-off:** `npm run test:ui` (30 tests, 24 fail local — suite UI tách biệt, pre-existing).

---

## 11. RC1 menu verdict

| Tiêu chí | Verdict |
|----------|---------|
| Cấu trúc menu V5 SaaS | ✅ **GO** cho Preview test |
| Không route gây hiểu nhầm | ✅ **GO** |
| RBAC/automated regression | ✅ **GO** |
| Staging manual 66/94 cases | ⏳ Chưa thay thế bằng nav QA — vẫn cần browser |

**RC1 Navigation:** ✅ **CONDITIONAL GO** — sẵn sàng Preview manual; chưa đủ cho Production tag.

---

## 12. Remaining manual QA (Preview)

- [ ] Login **COURT_OWNER** Preview — sidebar đủ nhóm, không mục future
- [ ] Click từng mục owner — không `/403`
- [ ] `Của tôi (Mobile)` → `/mobile/player` render đúng
- [ ] Login **PLAYER** — bottom nav `Trang của tôi`, không thấy Check-in staff
- [ ] Mobile drawer `Thêm` — nhóm menu khớp desktop
- [ ] Global search — chỉ mục visible theo role
- [ ] Venue switcher (nếu multi-venue) — session persist
- [ ] `VITE_ENABLE_AI_ENGINE=false` — không nhóm AI sidebar
- [ ] Marketplace/API flags off — không menu marketplace/admin integration

---

## 13. Deploy metadata

| Field | Value |
|-------|-------|
| Branch | `v5-platform-edition` |
| Commit | `60d50563f8d1d0c40cf3f9076c6db8377195f7d9` |
| Vercel Preview (latest) | https://pickleball-scheduler-lbcrkzewe-pickleball-scheduler.vercel.app |
| Branch alias | https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app |
| Production | ⛔ **NO-GO** — không deploy |
| Tag `v5.0.0-rc1` | ⛔ **NOT created** |
| Stash `IntegrationSettingsPage` | ✅ Intact — `stash@{0}: wip: IntegrationSettingsPage mockPayment toggle key fix` |
