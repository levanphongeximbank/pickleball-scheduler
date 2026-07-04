# Phase 20 — Mobile / PWA Pilot QA

**Phạm vi:** Pilot 1–2 venue — không yêu cầu Mobile GA thương mại.  
**Môi trường:** Staging Preview + thiết bị thật.

---

## Automated tests (chạy trước manual QA)

```bash
npm run test:unit
# Chỉ mobile:
node --test tests/mobile-sprint9.test.js tests/mobile-phase8-hardening.test.js tests/tournament-mobile.test.js

# Staging (cần credentials):
npm run test:verify-mobile-staging
```

---

## Manual checklist

| # | Hạng mục | Cách test | Kỳ vọng | Nếu fail |
|---|----------|-----------|---------|----------|
| 1 | Android Chrome install PWA | Chrome menu → Install app / Add to Home screen | Icon xuất hiện; mở standalone | `PwaInstallPrompt.jsx`, `vite-plugin-pwa` |
| 2 | iPhone Safari Add to Home Screen | Share → Add to Home Screen | Icon; mở full-screen | iOS meta tags `index.html` |
| 3 | Login mobile | `/login` trên điện thoại | Đăng nhập OK; redirect dashboard/mobile | `AuthContext`, route guard |
| 4 | Owner mobile navigation | Owner → bottom nav + drawer | Thấy Tổng quan, Check-in, Court ops | `MobileBottomNav`, `navigationConfig` |
| 5 | Staff / court manager nav | Manager login | Không thấy admin billing; thấy ops | `MobileRouteGate`, RBAC |
| 6 | Referee / player route gate | Player → `/mobile/player` | Đúng scope; không admin | `mobileNavAccess.js` |
| 7 | QR check-in camera permission | `/mobile/qr-scan` | Browser hỏi camera; scan OK | `QrScanPage`, `html5-qrcode` |
| 8 | QR invalid token | Scan chuỗi random | Báo lỗi tiếng Việt | `checkInService`, RPC |
| 9 | QR expired token | Token hết hạn (staging) | Báo hết hạn | `docs/supabase-phase16-kn6-qr-checkins-rls.sql` |
| 10 | Offline queue basic | Bật airplane mode → thao tác queue | Không crash; banner offline | `OfflineBanner`, mobile queue |
| 11 | Reconnect sync | Tắt airplane mode | Queue sync nếu đã implement | `src/features/mobile/` sync |
| 12 | Push notification (flag bật) | `VITE_ENABLE_PUSH` true | Đăng ký token; không crash | mobile push module |
| 13 | Push disabled | Flag tắt | UI settings không crash | `NotificationSettingsPage` |

---

## Subscription lock trên mobile

Khi subscription hết hạn:

- `/mobile/check-in`, `/mobile/operations` → **khóa** (qua `MobileRouteGate` + `subscriptionCheck`)
- Owner vẫn có thể mở `/billing` trên desktop (khuyến nghị gia hạn trước khi dùng mobile ops)

---

## Ghi nhận kết quả (owner tự điền — Phase 20B)

| Thiết bị | Trình duyệt | Login | PWA install | QR camera | Reload | Offline | Kết quả |
| -------- | ----------- | ----- | ----------- | --------- | ------ | ------- | ------- |
| Android (ví dụ: Samsung A54) | Chrome | ☐ | ☐ | ☐ | ☐ | ☐ | PASS / FAIL |
| iPhone (ví dụ: iPhone 13) | Safari | ☐ | ☐ | ☐ | ☐ | ☐ | PASS / FAIL |

**Hướng dẫn cột:**

| Cột | Cách test | Kỳ vọng |
|-----|-----------|---------|
| Login | `/login` trên điện thoại | Redirect OK, không 500 |
| PWA install | Android: Install app; iOS: Add to Home Screen | Icon standalone, không thanh URL |
| QR camera | `/mobile/qr-scan` | Browser hỏi quyền camera; scan token hợp lệ OK |
| Reload | F5 sau login / sau tạo phiên court | Session còn; không logout lạ |
| Offline | Bật airplane mode khi đang thao tác queue | Không crash; banner offline; dữ liệu đang sửa không mất ngay |
| Kết quả | Tổng hợp hàng | PASS nếu Login + (PWA hoặc QR) OK |

---

## Phase 20B — Bắt buộc tối thiểu

1. **Android Chrome** — login + ít nhất một: PWA install hoặc QR scan  
2. **iPhone Safari** — login + QR permission (camera)  
3. **Add to Home Screen** — thử trên ít nhất một thiết bị  
4. **Reload sau login** — venue và session không lệch  
5. **Route gate mobile** — tenant hết hạn: `/mobile/check-in` khóa; billing desktop vẫn mở  
6. **Push disabled** — `VITE_ENABLE_PUSH` false (mặc định pilot): Settings notification không crash  
7. **Offline** — không làm mất dữ liệu đang thao tác (queue local giữ tạm)

Module tham chiếu: `MobileRouteGate.jsx`, `OfflineBanner`, `NotificationSettingsPage.jsx`

---

## Ghi nhận kết quả (legacy)

---

## Pilot verdict

- **PASS pilot mobile:** Mục 1–3 + (4 hoặc 5) + 7 PASS trên ít nhất 1 Android hoặc iPhone
- **PARTIAL:** Login OK nhưng PWA install hoặc QR chưa test
- **FAIL:** Crash login, QR security fail, hoặc bypass subscription lock
