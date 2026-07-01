# Phase 8 — Mobile GA Readiness Checklist

**Ngày:** 2026-07-01  
**Mục tiêu:** Xác minh Phase 8 Mobile 5.0 product-ready trước GA mobile staging  
**Liên quan:** [PHASE_8_CLOSEOUT.md](./PHASE_8_CLOSEOUT.md), [PHASE_8_MOBILE_AUDIT.md](./PHASE_8_MOBILE_AUDIT.md)

---

## 1. RLS / Supabase (staging)

| # | Kiểm tra | Cách verify | Pass? |
|---|----------|-------------|-------|
| 1.1 | RLS bật trên `push_subscriptions`, `notifications`, `qr_tokens`, `checkins` | `npm run test:verify-mobile-staging` | ☑ |
| 1.2 | Tenant A không đọc notification tenant B | Automated: `mobile-phase8-product` dispatch test | ☑ (code) / ☐ (2-user SQL) |
| 1.3 | Tenant A không đọc push_subscriptions tenant B | Cần service role + 2 user staging | ☐ |
| 1.4 | PLAYER không đọc admin notification | `mobile-sprint9` + product tests | ☑ |
| 1.5 | QR check-in không bypass `tenant_id` | `mobile-phase8-hardening` QR suite | ☑ |
| 1.6 | Expired tenant lock đúng rule | `mobile-phase8-hardening` nav test | ☑ |

---

## 2. RBAC mobile routes

| # | Route | Role được phép | Pass? |
|---|-------|----------------|-------|
| 2.1 | `/mobile/check-in` | Staff+, không PLAYER | ☑ |
| 2.2 | `/mobile/qr-scan` | Staff+, không PLAYER | ☑ |
| 2.3 | `/mobile/qr-generate` | Manager+, không PLAYER/REFEREE/CASHIER | ☑ |
| 2.4 | `/mobile/player` | PLAYER, CLUB_OWNER, REFEREE, có playerId | ☑ |
| 2.5 | `/mobile/operations` | COURT_OWNER, COURT_MANAGER, CASHIER | ☑ |
| 2.6 | `/mobile/notifications` | Authenticated | ☑ |
| 2.7 | REFEREE không sửa match không được phân công | `refereeMatchGuard.js` | ☑ |
| 2.8 | CASHIER không quản lý subscription trên mobile | Operations dashboard `canManageBilling: false` | ☑ |

---

## 3. Push notification

| # | Kiểm tra | Pass? |
|---|----------|-------|
| 3.1 | Permission request qua Notification Settings | ☐ |
| 3.2 | Push token lưu `push_subscriptions` (Supabase) hoặc dev fallback | ☐ |
| 3.3 | Token cleanup khi logout | ☐ |
| 3.4 | Dispatch theo `tenant_id` | ☑ |
| 3.5 | Dispatch filter theo role (`notificationDispatchService.js`) | ☑ |
| 3.6 | User tắt loại thông báo → không nhận | ☐ |
| 3.7 | Browser không hỗ trợ → fallback in-app / local | ☑ |
| 3.8 | Events: BookingCreated, MatchStarted, PlayerCheckedIn, … | ☐ |

**Lưu ý:** PaymentReceived / SubscriptionExpiring — interface sẵn sàng; cần billing event production để gửi thật.

---

## 4. PWA install

| # | Kiểm tra | Pass? |
|---|----------|-------|
| 4.1 | `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` trong `public/` | ☑ |
| 4.2 | Manifest: name, short_name, theme_color, background_color, display standalone | ☑ |
| 4.3 | Build sinh `manifest.webmanifest` + `sw.js` | ☑ |
| 4.4 | Install prompt (`PwaInstallPrompt`) không lỗi console | ☐ |
| 4.5 | Standalone detection (`usePwaInstall`) | ☐ |

---

## 5. Device QA (manual)

### Android Chrome

| # | Kiểm tra | Pass? |
|---|----------|-------|
| 5.1 | Add to Home Screen / Install PWA | ☐ |
| 5.2 | Icon hiển thị đúng trên launcher | ☐ |
| 5.3 | Bottom nav + safe area | ☐ |
| 5.4 | QR scan camera permission | ☐ |
| 5.5 | Push permission prompt | ☐ |
| 5.6 | Offline banner + queue sync | ☐ |

### iPhone Safari

| # | Kiểm tra | Pass? |
|---|----------|-------|
| 5.7 | Add to Home Screen | ☐ |
| 5.8 | Apple touch icon | ☐ |
| 5.9 | Standalone mode (status bar) | ☐ |
| 5.10 | QR scan (Safari limitations) | ☐ |
| 5.11 | Web Push (iOS 16.4+ nếu bật) | ☐ |

### Desktop Chrome PWA

| # | Kiểm tra | Pass? |
|---|----------|-------|
| 5.12 | Install from address bar | ☐ |
| 5.13 | Window standalone | ☐ |

---

## 6. Player shell (real data)

| # | Màn hình | Nguồn dữ liệu | Pass? |
|---|----------|---------------|-------|
| 6.1 | Lịch thi đấu / booking | `playerMobileService` → club blob + bookings | ☐ |
| 6.2 | Trận sắp tới | tournaments trong club data | ☐ |
| 6.3 | Kết quả / BXH | `playerHistoryEngine`, `seasonStandingsService` | ☐ |
| 6.4 | Thông báo | `notificationService` + role filter | ☐ |
| 6.5 | Loading / empty / error state | `PlayerHomePage.jsx` | ☐ |

---

## 7. Owner / Staff / Cashier dashboard

| # | Metric / action | Role | Pass? |
|---|-----------------|------|-------|
| 7.1 | Booking hôm nay, sân trống/đang chơi | Owner, Manager | ☐ |
| 7.2 | Check-in hôm nay | Owner, Manager | ☐ |
| 7.3 | Doanh thu nhanh | Owner | ☐ |
| 7.4 | Giải đang chạy | Owner | ☐ |
| 7.5 | Booking chờ thanh toán | Cashier | ☐ |
| 7.6 | Tạo booking / check-in quick action | Theo permission | ☐ |

Route: `/mobile/operations`

---

## 8. Offline sync

| # | Kiểm tra | Pass? |
|---|----------|-------|
| 8.1 | `match_score` không enqueue offline | ☑ |
| 8.2 | Check-in offline → pending, sync khi online | ☑ (unit) / ☐ (device) |
| 8.3 | Flush validate lại quyền trước ghi | ☑ |

---

## 9. Automated tests (bắt buộc)

```bash
node --test tests/mobile-phase8-hardening.test.js   # 24 tests
node --test tests/mobile-phase8-product.test.js     # 14 tests
node --test tests/mobile-sprint9.test.js            # 19 tests
npm run lint                                        # 0 errors
npm run build                                       # manifest + sw.js
```

Tổng mobile: **57 tests**

---

## 10. Known limitations

| Hạng mục | Trạng thái |
|----------|------------|
| Push VAPID / FCM backend server | Cần env VAPID keys + edge function để gửi Web Push production |
| PaymentReceived / SubscriptionExpiring dispatch | Interface only — chờ billing event production |
| PWA icon | PNG solid brand color — thay logo thật trước GA marketing |
| Device QA | Checklist manual — chưa thay thế test thiết bị thật |
| Player cloud sync | Dữ liệu từ club blob local/staging; cloud pull theo club sync hiện có |
| ESLint warnings | 125 warnings pre-existing (`react-hooks/exhaustive-deps`) |

---

## 11. Go / No-Go

| Tiêu chí | Yêu cầu |
|----------|---------|
| Mobile tests | 57/57 PASS |
| Lint | 0 errors |
| Build | PASS |
| RLS staging applied | ☑ (verify script 2026-07-01) |
| Device QA spot-check | ☐ (tối thiểu 1 Android + 1 iOS) |
| Product gaps Phase 8 | Đã đóng trong Product Completion Sprint |

**QA staging mobile:** [STAGING-APPLY-QA-v40-mobile.md](./STAGING-APPLY-QA-v40-mobile.md)

**Quyết định GA mobile staging:** ☐ Go / ☑ Conditional Go (chờ device QA)  
**Người ký:** _Codex automated run_  
**Ngày:** 2026-07-01
