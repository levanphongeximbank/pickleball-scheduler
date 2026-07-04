# Phase 20B — Checklist Smoke Staging (dành cho Owner)

**Mục đích:** Kiểm tra nhanh trên **Vercel Preview staging** trước khi vận hành thử **1 sân thật**.  
**Không cần biết lập trình** — chỉ cần trình duyệt và tài khoản owner.

**Chuẩn bị:**

- URL Preview staging (ví dụ: `https://pickleball-scheduler-xxx.vercel.app`)
- Email + mật khẩu **owner sân thật** (không dùng tài khoản dev)
- Ghi chú venue ID nếu support team đã cung cấp

**Cách đánh dấu:** ☐ chưa làm · ✅ PASS · ❌ FAIL

---

## 1. Đăng nhập Preview bằng owner account

| | |
|---|---|
| **Mục tiêu** | Xác nhận auth staging hoạt động với tài khoản owner thật |
| **Cách kiểm tra** | Mở URL Preview → **Đăng nhập** bằng email owner |
| **Kết quả kỳ vọng** | Vào được trang Tổng quan / Dashboard, không báo lỗi 500 |
| **Nếu fail** | `src/features/identity/`, `AuthContext.jsx`, Supabase Auth staging |

☐ Kết quả: ___

---

## 2. Kiểm tra không dùng dev user

| | |
|---|---|
| **Mục tiêu** | Tránh pilot với tài khoản demo/dev (dữ liệu không đúng sân thật) |
| **Cách kiểm tra** | Vào **Hồ sơ / My Profile** — xem email đăng nhập; không phải `dev@`, `demo@`, `test@` trừ khi đó là owner thật |
| **Kết quả kỳ vọng** | Email là owner sân pilot; role **COURT_OWNER** hoặc **VENUE_OWNER** |
| **Nếu fail** | Đăng xuất → đăng nhập lại account đúng; `src/auth/authService.js` (dev fallback chỉ local) |

☐ Kết quả: ___

---

## 3. Kiểm tra venue hiện đúng

| | |
|---|---|
| **Mục tiêu** | App hiển thị đúng tên sân/venue pilot |
| **Cách kiểm tra** | Xem header hoặc menu chuyển venue — tên sân khớp sân thật |
| **Kết quả kỳ vọng** | Tên venue đúng; không hiện "Demo" / "venue-demo" |
| **Nếu fail** | `VenueSwitcher.jsx`, `TenantContext.jsx`, bảng `venues` Supabase |

☐ Kết quả: ___

---

## 4. Kiểm tra `profiles.venue_id` khớp `venues.id`

| | |
|---|---|
| **Mục tiêu** | Owner gắn đúng venue trong database (billing + RBAC) |
| **Cách kiểm tra** | Nhờ support chạy script hoặc SQL: `profiles.venue_id` của owner = `id` trong bảng `venues` |
| **Kết quả kỳ vọng** | Hai giá trị UUID giống nhau |
| **Nếu fail** | `docs/supabase-billing-phase10e-staging-tenant-align.sql`, `billingTenantResolver.js` |

☐ Kết quả: ___

---

## 5. Kiểm tra tenant có trial subscription

| | |
|---|---|
| **Mục tiêu** | Sân có gói dùng thử hoặc active — không bị khóa operational |
| **Cách kiểm tra** | Vào **Thanh toán / Billing** — thấy gói **Trial** hoặc **Active**; hoặc support chạy `npm run test:verify-billing-tenant-mapping` |
| **Kết quả kỳ vọng** | Status `trialing` hoặc `active`; không thấy màn "Chưa có gói sử dụng" khi vào Court Engine |
| **Nếu fail** | `tenant_subscriptions` Supabase, `subscriptionService.js`, RPC trial Phase 9 |

☐ Kết quả: ___

---

## 6. Vào trang Billing

| | |
|---|---|
| **Mục tiêu** | Trang thanh toán luôn mở được (kể cả khi gói hết hạn) |
| **Cách kiểm tra** | Menu → **Thanh toán** hoặc `/billing` |
| **Kết quả kỳ vọng** | Trang load; hiện plan, trial end, nút hỗ trợ |
| **Nếu fail** | `BillingPage.jsx`, `operationalRoutePolicy.js` (exempt `/billing`) |

☐ Kết quả: ___

---

## 7. Vào Court Engine

| | |
|---|---|
| **Mục tiêu** | Module xếp sân vận hành mở được khi subscription OK |
| **Cách kiểm tra** | Menu → **Xếp sân / Court Engine** hoặc `/court-engine` |
| **Kết quả kỳ vọng** | Trang Court Engine hiện; không bị màn khóa subscription |
| **Nếu fail** | `OperationalRouteGate.jsx`, `TenantOperationalGate.jsx`, `CourtEnginePage` |

☐ Kết quả: ___

---

## 8. Tạo phiên vận hành sân

| | |
|---|---|
| **Mục tiêu** | Tạo session xếp sân cho buổi chơi thật |
| **Cách kiểm tra** | Trong Court Engine → **Tạo phiên mới** / bắt đầu session |
| **Kết quả kỳ vọng** | Phiên tạo thành công; tên phiên hiện trên UI |
| **Nếu fail** | `courtSessionService.js`, `courtEngineStorage.js` |

☐ Kết quả: ___

---

## 9. Thêm sân/court

| | |
|---|---|
| **Mục tiêu** | Cấu hình số sân thật trong phiên |
| **Cách kiểm tra** | Thêm hoặc chọn sân trong Court Engine / quản lý sân |
| **Kết quả kỳ vọng** | Sân hiện đúng tên/số; có thể tick chọn để xếp |
| **Nếu fail** | `src/pages/CourtEnginePage`, club blob courts, `courtEngineStorage.js` |

☐ Kết quả: ___

---

## 10. Check-in thử

| | |
|---|---|
| **Mục tiêu** | Ghi nhận người chơi có mặt |
| **Cách kiểm tra** | Mobile **Check-in** hoặc dashboard check-in → đánh dấu 1–2 người |
| **Kết quả kỳ vọng** | Trạng thái check-in cập nhật; không crash |
| **Nếu fail** | `checkInService.js`, `CheckInDashboardPage.jsx`, mobile check-in |

☐ Kết quả: ___

---

## 11. Test QR hợp lệ

| | |
|---|---|
| **Mục tiêu** | QR check-in hoạt động với token đúng |
| **Cách kiểm tra** | Tạo QR trong app → quét bằng điện thoại (hoặc scan từ màn hình) |
| **Kết quả kỳ vọng** | Check-in thành công; thông báo tiếng Việt rõ ràng |
| **Nếu fail** | `qrTokenService.js`, `QrScanPage.jsx`, `docs/supabase-phase16-kn6-qr-checkins-rls.sql` |

☐ Kết quả: ___

---

## 12. Test QR hết hạn hoặc sai token

| | |
|---|---|
| **Mục tiêu** | QR lỗi không được chấp nhận (bảo mật) |
| **Cách kiểm tra** | Quét chuỗi random hoặc QR đã hết hạn |
| **Kết quả kỳ vọng** | Báo lỗi "token không hợp lệ" / "đã hết hạn"; **không** check-in thành công |
| **Nếu fail** | `checkInService.js`, RPC `referee_get_match_by_token` pattern, KN6 RLS |

☐ Kết quả: ___

---

## 13. Test logout/login lại

| | |
|---|---|
| **Mục tiêu** | Session restore và tenant context ổn định |
| **Cách kiểm tra** | Đăng xuất → đăng nhập lại cùng account |
| **Kết quả kỳ vọng** | Vào lại đúng venue; Court Engine còn phiên (nếu chưa xóa cache) |
| **Nếu fail** | `AuthContext.jsx`, `TenantContext.jsx`, Supabase session |

☐ Kết quả: ___

---

## 14. Test reload trang Court Engine

| | |
|---|---|
| **Mục tiêu** | Dữ liệu phiên không mất sau F5 |
| **Cách kiểm tra** | Đang có phiên active → nhấn **F5** hoặc reload trình duyệt |
| **Kết quả kỳ vọng** | Phiên và queue vẫn còn (localStorage cùng tenant) |
| **Nếu fail** | `courtEngineStorage.js` — key `pickleball-court-engine-v1::{tenantId}::{clubId}` |

☐ Kết quả: ___

---

## 15. Test mobile Android

| | |
|---|---|
| **Mục tiêu** | Pilot dùng được trên Android thật |
| **Cách kiểm tra** | Chrome Android → mở Preview → login → check-in hoặc Court ops |
| **Kết quả kỳ vọng** | UI đọc được; bottom nav hoạt động; không crash |
| **Nếu fail** | `src/features/mobile/`, `MobileBottomNav`, `PHASE_20_MOBILE_PILOT_QA.md` |

☐ Kết quả: ___

---

## 16. Test mobile iPhone

| | |
|---|---|
| **Mục tiêu** | Pilot dùng được trên iPhone thật |
| **Cách kiểm tra** | Safari iOS → mở Preview → login → thử QR / nav |
| **Kết quả kỳ vọng** | Tương tự Android; camera permission hoạt động |
| **Nếu fail** | `index.html` PWA meta, `QrScanPage.jsx`, Safari quirks |

☐ Kết quả: ___

---

## 17. Ghi lại lỗi nếu có

| | |
|---|---|
| **Mục tiêu** | Thu thập bug trước khi vận hành sân đông người |
| **Cách kiểm tra** | Điền bảng dưới mỗi mục FAIL |
| **Kết quả kỳ vọng** | Có screenshot + bước tái hiện + thiết bị/trình duyệt |
| **Nếu fail** | Gửi support kèm URL Preview và thời gian test |

### Bảng ghi lỗi

| # mục | Mô tả lỗi | Thiết bị | Trình duyệt | Screenshot |
|-------|-----------|----------|-------------|------------|
| | | | | |

---

## Tiêu chí PASS pilot staging

- Mục **1, 3, 5, 7, 8** → ✅ bắt buộc  
- Mục **11** hoặc **10** → ✅ ít nhất một  
- Mục **15** hoặc **16** → ✅ ít nhất một  
- Không có FAIL nghiêm trọng (crash login, bypass subscription lock, QR sai vẫn check-in)

**Khi hoàn tất:** báo team dev để cập nhật `PHASE_20B_VERIFICATION_REPORT.md`.
