# Phase 8 Mobile 5.0 Audit

## 1. Kết luận nhanh

- **Cập nhật Product Completion (2026-07-01):** Phase 8 đạt **~100%** product scope. Push dispatch, PWA icons, player real data, operations dashboard, GA checklist hoàn tất. Còn: RLS staging apply, device QA thật, VAPID push server.
- **Cập nhật sau Hardening + Final Stabilization (2026-07-01):** Phase 8 đạt khoảng **90–95%** mức nghiệm thu kỹ thuật.
- Ban đầu (audit gốc): ~60–70% — nền tảng module mobile đã dựng nhưng chưa production-grade.
- Đã hoàn thành: permission-based mobile navigation, route guard, subscription lock, QR tenant/venue validation, manual QR fallback, referee session guard, offline capability matrix, offline guard, 43 mobile regression tests pass, lint 0 errors, build pass.
- Chưa đủ cho GA mobile production đầy đủ: VAPID push server, device QA thật trên iOS/Android, RLS staging apply.

## Product Completion Result (2026-07-01)

| Hạng mục | Kết quả |
|----------|---------|
| Push notification dispatch | ✅ `notificationDispatchService.js` — tenant/role filter, 8 event types |
| Token storage | ✅ `push_subscriptions` (Supabase) + dev localStorage |
| Logout cleanup | ✅ `cleanupPushTokensOnLogout` trong `signOut()` |
| PWA icons | ✅ `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` |
| Player shell real data | ✅ `playerMobileService.js` — schedule, results, ranking |
| Operations dashboard | ✅ `/mobile/operations` — owner/manager/cashier modes |
| Tests mới | ✅ `mobile-phase8-product.test.js` — 14 tests |
| Tổng mobile tests | ✅ **57/57** PASS |
| GA checklist | ✅ [PHASE_8_MOBILE_GA_CHECKLIST.md](./PHASE_8_MOBILE_GA_CHECKLIST.md) |

### Push notification status

- Client: permission, subscribe, prefs, dispatch, in-app + `Notification` API khi granted
- Server push (app đóng): cần VAPID keys + edge function — **chưa** trong scope sprint này
- PaymentReceived / SubscriptionExpiring: interface + role targets — không deep billing integration

### PWA QA status

- Manifest + icons: automated test PASS
- Device QA: checklist manual trong GA doc — **chưa** test thiết bị thật trong sprint

### Remaining limitations

1. Web Push server-side sender (VAPID)
2. Manual device QA iOS/Android
3. Supabase RLS apply trên staging
4. PWA icon — solid brand color placeholder
5. ESLint 125 warnings (pre-existing)

## Phase 8 Closeout (2026-07-01)

**Trạng thái:** ✅ Đóng kỹ thuật core mobile (~90–95%).

Tài liệu đóng phase chính thức: [PHASE_8_CLOSEOUT.md](./PHASE_8_CLOSEOUT.md)

Xác nhận closeout: mobile tests 43/43 PASS, lint 0 errors, build PASS, không blocker kỹ thuật còn lại cho core mobile.

## Final Stabilization Result (2026-07-01)

| Hạng mục | Kết quả |
|---|---|
| `mobile-sprint9` test treo | **Đã sửa** — IndexedDB mock không fire `oncomplete`/`onupgradeneeded`; thêm `resetOfflineDbForTests()` |
| `mobile-phase8-hardening` tests | **PASS** — 24/24 |
| `mobile-sprint9` tests | **PASS** — 19/19 (tổng mobile 43/43, ~662ms, process thoát bình thường) |
| `npm run lint` | **PASS** — 0 errors (125 warnings pre-existing, chủ yếu react-hooks/exhaustive-deps) |
| `npm run build` | **PASS** — PWA manifest + `sw.js` sinh đủ |
| Phase 8 có thể đóng? | **Có** — về mặt kỹ thuật core mobile (nav/guard/QR/offline/test). Product gaps còn lại không chặn đóng phase. |

### Nguyên nhân test treo

- `offlineCache.js` `withStore()` chờ `tx.oncomplete`.
- Mock IndexedDB trong `tests/mobile-sprint9.test.js` không gọi `oncomplete` sau transaction → promise không resolve → process treo vô hạn.
- Module-level `dbPromise` cache cũng cần reset giữa các test.

### Lint đã xử lý (17 errors → 0)

Tất cả 17 errors ban đầu là **pre-existing**, không phát sinh từ Phase 8 mobile. Đã sửa an toàn:

- `AiSummaryCard.jsx` — hooks trước early return
- `AuthContext.jsx` — bỏ import không dùng
- `PlatformRuntimeProvider.jsx` — tách hook sang `usePlatformRuntime.js`
- `domain/index.js`, `persistence/index.js` — dead code
- `planLimitService.js`, `BillingPage.jsx`, `AdminBillingPage.jsx` — unused vars/imports
- `IntegrationPaymentsPage.jsx`, `EngineScheduleTab.jsx` — thiếu import `Chip`
- `useTournamentEngine.js` — bỏ unused callback params
- 3 file test core-platform — bỏ import không dùng

### Lỗi / rủi ro còn lại

1. Push notification — local/dev fallback, chưa backend thật
2. PWA — chưa icon PNG 192/512, chưa QA device thật
3. Player shell — mock data lịch/kết quả/ranking
4. Owner/staff — chưa mobile dashboard riêng
5. ESLint warnings (125) — react-hooks deps, cần sprint lint riêng nếu muốn 0 warning

## 2. Bảng audit chi tiết

| Hạng mục | Trạng thái | File liên quan | Nhận xét | Việc cần làm |
|---|---|---|---|---|
| PWA chuẩn | Partial | [vite.config.js](../../vite.config.js), [src/main.jsx](../../src/main.jsx), [src/features/mobile/hooks/usePwaInstall.js](../../src/features/mobile/hooks/usePwaInstall.js), [src/features/mobile/components/PwaInstallPrompt.jsx](../../src/features/mobile/components/PwaInstallPrompt.jsx) | Có manifest, service worker auto-generated, registerSW, install prompt và standalone detection. Tuy nhiên chưa thấy test UI regression cho install prompt, chưa có evidence về install flow trên iOS/Android thật, và chưa có asset PWA đầy đủ như icon PNG/192/512. | Hoàn thiện icon PWA đa kích thước, kiểm tra install prompt trên device thật, thêm test regression cho PWA install. |
| Mobile Shell | Partial | [src/layouts/MainLayout.jsx](../../src/layouts/MainLayout.jsx), [src/features/mobile/layout/MobileBottomNav.jsx](../../src/features/mobile/layout/MobileBottomNav.jsx), [src/features/mobile/layout/MobileDrawer.jsx](../../src/features/mobile/layout/MobileDrawer.jsx), [src/components/Header.jsx](../../src/components/Header.jsx) | Có mobile shell cơ bản: bottom nav, drawer, header điều chỉnh cho mobile. Tuy nhiên chưa thấy một layout mobile riêng biệt hoàn toàn tách khỏi desktop; safe-area chỉ có ở bottom nav, chưa có xử lý toàn diện cho iPhone notch/keyboard. | Tách rõ mobile-specific layout shell, tối ưu safe-area, kiểm tra overflow và header trên màn hình nhỏ. |
| Role-based Mobile Screen | Partial | [src/config/sidebarMenu.js](../../src/config/sidebarMenu.js), [src/auth/menuAccess.js](../../src/auth/menuAccess.js), [src/features/mobile/layout/MobileBottomNav.jsx](../../src/features/mobile/layout/MobileBottomNav.jsx), [src/pages/mobile/PlayerHomePage.jsx](../../src/pages/mobile/PlayerHomePage.jsx) | Có lọc menu theo quyền cơ bản và có màn mobile cho player/referee. Tuy nhiên chưa có màn mobile riêng cho từng role đầy đủ: SUPER_ADMIN/TENANT_OWNER/VENUE_MANAGER/CLUB_OWNER/STAFF/CASHIER chưa được xác nhận bằng UI riêng và route riêng rõ ràng. | Xây thêm mobile home/dashboard riêng cho từng role lớn, dùng permission-based menu chuẩn hóa. |
| QR Check-in | Partial | [src/features/mobile/services/qrTokenService.js](../../src/features/mobile/services/qrTokenService.js), [src/features/mobile/services/checkInService.js](../../src/features/mobile/services/checkInService.js), [src/pages/mobile/QrScanPage.jsx](../../src/pages/mobile/QrScanPage.jsx), [src/pages/mobile/QrGeneratePage.jsx](../../src/pages/mobile/QrGeneratePage.jsx), [src/pages/mobile/CheckInDashboardPage.jsx](../../src/pages/mobile/CheckInDashboardPage.jsx) | Có QR generation, scan, validation tenant, duplicate protection, offline fallback và audit. Tuy nhiên flow manual code fallback chưa thấy rõ trong UI; chưa thấy kiểm soát tenant/venue ở UI layer đầy đủ, và chưa có test UI end-to-end cho QR. | Thêm manual entry fallback, kiểm tra tenant/venue context ở UI, thêm test UI/E2E cho scan flow. |
| Offline Mode | Partial | [src/features/mobile/services/offlineQueue.js](../../src/features/mobile/services/offlineQueue.js), [src/features/mobile/services/offlineCache.js](../../src/features/mobile/services/offlineCache.js), [src/features/mobile/hooks/useOfflineStatus.js](../../src/features/mobile/hooks/useOfflineStatus.js), [src/features/mobile/components/OfflineBanner.jsx](../../src/features/mobile/components/OfflineBanner.jsx) | Có detection offline, banner, queue, cache snapshot và sync. Tuy nhiên chưa có conflict strategy rõ ràng cho các thao tác có rủi ro, và hiện tại offline queue chỉ có cơ chế lưu và retry đơn giản. | Chỉ cho phép offline read-only hoặc thao tác low-risk trước khi có conflict strategy rõ. |
| Push Notification | Partial | [src/features/mobile/services/notificationService.js](../../src/features/mobile/services/notificationService.js), [src/pages/mobile/NotificationSettingsPage.jsx](../../src/pages/mobile/NotificationSettingsPage.jsx), [src/features/mobile/constants/notificationTypes.js](../../src/features/mobile/constants/notificationTypes.js) | Có permission request, subscription token logic, preference toggle và local notification. Tuy nhiên chưa thấy event trigger theo tenant/role cho toàn bộ nghiệp vụ mobile cần thiết, và push service hiện vẫn chủ yếu là local/dev fallback. | Kết nối event trigger với backend/service thật, thêm tenant/role-safe dispatch và test push subscription. |
| Referee Scoreboard | Partial | [src/pages/referee/RefereeHub.jsx](../../src/pages/referee/RefereeHub.jsx), [src/pages/referee/RefereeSessionScoreboard.jsx](../../src/pages/referee/RefereeSessionScoreboard.jsx), [src/pages/referee/RefereeScoreboard.jsx](../../src/pages/referee/RefereeScoreboard.jsx) | Có route riêng cho referee, scoreboard nhập điểm nhanh, confirm finalize, undo/decrement và phân quyền session. Tuy nhiên chưa thấy test UI logic đầy đủ cho scoreboard; vẫn cần kiểm tra guard chống sửa trận không thuộc quyền ở UI/route và workflow chấm điểm trên mobile nhỏ. | Thêm test logic scoreboard và kiểm tra route/role guard trên mobile nhỏ. |
| Player App Shell | Partial | [src/pages/mobile/PlayerHomePage.jsx](../../src/pages/mobile/PlayerHomePage.jsx), [src/features/mobile/components/QrDisplayCard.jsx](../../src/features/mobile/components/QrDisplayCard.jsx) | Có player shell cơ bản: profile card, lịch thi đấu mock, QR cá nhân, thông báo, kết quả placeholder. Tuy nhiên nội dung lịch thi đấu/kết quả/ranking/ELO vẫn là mock hoặc placeholder; chưa có dữ liệu thật liên kết với account player. | Kết nối player shell với dữ liệu thật: lịch, kết quả, ranking/ELO và permission gating. |
| Owner / Staff Mobile Flow | Partial | [src/pages/mobile/CheckInDashboardPage.jsx](../../src/pages/mobile/CheckInDashboardPage.jsx), [src/pages/mobile/QrScanPage.jsx](../../src/pages/mobile/QrScanPage.jsx), [src/config/sidebarMenu.js](../../src/config/sidebarMenu.js) | Có dashboard check-in và QR scan phục vụ staff/manager. Tuy nhiên chưa thấy mobile flow riêng cho owner/staff với booking hôm nay, sân đang trống/đang chơi, doanh thu nhanh, cảnh báo subscription và permission gating rõ ràng. | Tạo mobile dashboard riêng cho owner/staff với các metric thao tác nhanh. |
| Mobile Tests | Partial | [tests/mobile-sprint9.test.js](../../tests/mobile-sprint9.test.js) | Có test cho QR, check-in, offline queue, PWA install banner, notification. Tuy nhiên chưa có UI regression test, role-based menu test, QR scan UI test, referee scoreboard test hoặc responsive regression coverage. | Bổ sung test cho mobile UI, role menu, QR scan, referee scoreboard và responsive layout. |

## 3. Test đã chạy

### Final Stabilization (2026-07-01)

| Lệnh | Kết quả |
|---|---|
| `node --test tests/mobile-phase8-hardening.test.js` | PASS — 24/24 |
| `node --test tests/mobile-sprint9.test.js` | PASS — 19/19, không treo |
| `node --test tests/mobile-*.test.js` (cả hai) | PASS — 43/43, ~662ms |
| `npm run lint` | PASS — 0 errors, 125 warnings |
| `npm run build` | PASS — manifest + sw.js OK |

### Audit gốc (trước stabilization)

- Lệnh đã chạy: `npm run build` — Pass
- `node --test tests/mobile-sprint9.test.js` — treo tại offline cache (đã sửa)
- `npm test` / `npm run lint` — chưa xác nhận trong session audit gốc

## 4. File đã tạo/sửa

### Hardening Sprint

- `src/features/mobile/services/mobileNavAccess.js`
- `src/features/mobile/guards/MobileRouteGate.jsx`
- `src/features/mobile/services/offlineCapabilityMatrix.js`
- `src/features/mobile/services/offlineGuardService.js`
- `src/features/mobile/services/refereeMatchGuard.js`
- `tests/mobile-phase8-hardening.test.js`
- (và các file mobile nav, QR, referee, router đã liệt kê trong hardening report)

### Final Stabilization Sprint

- `src/features/mobile/services/offlineCache.js` — `resetOfflineDbForTests()`
- `tests/mobile-sprint9.test.js` — IndexedDB mock fix, cleanup, assertion message sync
- `src/core/platform/app/PlatformRuntimeContext.js`, `usePlatformRuntime.js` — tách hook (lint)
- `src/core/platform/app/PlatformRuntimeProvider.jsx` — chỉ export Provider
- 14 file cập nhật import `usePlatformRuntime`
- Lint fixes: `AiSummaryCard.jsx`, `AuthContext.jsx`, `domain/index.js`, `persistence/index.js`, `planLimitService.js`, `AdminBillingPage.jsx`, `BillingPage.jsx`, `IntegrationPaymentsPage.jsx`, `EngineScheduleTab.jsx`, `useTournamentEngine.js`, 3 test core-platform
- `docs/v5/PHASE_8_MOBILE_AUDIT.md` — cập nhật stabilization result

## 5. Đề xuất việc làm tiếp theo

1. Push notification backend thật + tenant/role dispatch
2. Player shell dữ liệu thật (lịch, kết quả, ranking/ELO)
3. Owner/staff mobile dashboard (metric thao tác nhanh)
4. PWA icon đa kích thước + QA install trên iOS/Android
5. Sau các mục trên → chuyển Phase 9 Commercial SaaS

## 6. Cảnh báo rủi ro

- ~~Rủi ro RBAC menu mobile~~ — đã harden bằng `mobileNavAccess` + `MobileRouteGate`
- ~~Rủi ro offline queue ghi sai dữ liệu~~ — đã có capability matrix + block match_score
- ~~Rủi ro QR tenant/venue~~ — đã validate ở service layer
- ~~Rủi ro scoreboard unauthorized~~ — đã có `refereeMatchGuard`
- ~~Test mobile treo~~ — đã sửa IndexedDB mock
- Rủi ro RLS production: QR check-in/offline sync vẫn cần apply SQL + QA staging
- Rủi ro push: chưa có backend thật, notification chỉ local
- Rủi ro product: player shell và owner dashboard chưa đủ dữ liệu thật
