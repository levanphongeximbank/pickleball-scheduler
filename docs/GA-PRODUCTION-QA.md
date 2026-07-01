# Phase 3 — Production QA Checklist (Sprint 12 GA)

**Môi trường:** Production URL + `VITE_RBAC_ENABLED=true` + SQL đã apply (`docs/SUPABASE-PRODUCTION-CHECKLIST.md`).

Tạo **8 user test** (đăng ký → gán role qua SQL hoặc User Management). Đăng xuất/đăng nhập lại sau mỗi lần đổi role.

**Matrix quyền:** `docs/RBAC-MATRIX.md`  
**RBAC chi tiết:** `docs/RBAC-RC-QA.md`

---

## A. Authentication

- [ ] `/login` — đăng nhập email/password
- [ ] Session restore sau refresh trang
- [ ] `/logout` — đăng xuất, redirect login
- [ ] `/forgot-password` → email reset (nếu SMTP/Supabase email bật)
- [ ] `/reset-password` — đổi mật khẩu
- [ ] User chưa có profile hợp lệ → thông báo rõ, không crash
- [ ] Signup mới → role **PLAYER** (trigger v3.5.7)

---

## B. RBAC — Theo role

### SUPER_ADMIN

- [ ] Menu: Tenant Management, Users, Audit, toàn bộ Điều hành/CLB/Giải
- [ ] `/admin/tenants` — OK
- [ ] Subscription expired tenant — bypass gate
- [ ] User Management — đổi role user khác

### COURT_OWNER (VENUE_OWNER)

- [ ] Chỉ dữ liệu `venue_id` của mình
- [ ] Live Courts, Court Engine, revenue, customers, settings
- [ ] Không Tenant Management
- [ ] Tạo/sửa CLB trong venue

### COURT_MANAGER (VENUE_MANAGER)

- [ ] Bookings, customers, players, tournaments
- [ ] Không system settings / user manage
- [ ] Director Mode khi subscription active

### ACCOUNTANT

- [ ] Home → `/court-management/revenue`
- [ ] Finance/revenue/export
- [ ] Không tạo tournament / director

### CASHIER

- [ ] Home → `/court-management/bookings`
- [ ] Tạo booking, xem customers
- [ ] Không statistics export đầy đủ

### REFEREE

- [ ] Home → `/referee`
- [ ] Hub + giải được phân công
- [ ] `/referee/:token` scoreboard (RPC)
- [ ] Không menu quản lý CLB

### CLUB_OWNER

- [ ] Chỉ CLB `club_id` profile
- [ ] Members, ELO, matches, giải nội bộ CLB

### PLAYER

- [ ] Home → `/tournament`
- [ ] Hồ sơ self only
- [ ] Không menu quản trị CLB/sân

### Guards chung

- [ ] URL không có quyền → `/403`
- [ ] Menu ẩn theo permission
- [ ] Action forbidden → disabled hoặc toast
- [ ] Tenant isolation — venue khác bị chặn
- [ ] Subscription gate — expired → banner + gate (SUPER_ADMIN bypass)

---

## C. Players

- [ ] CRUD người chơi (role có quyền)
- [ ] Skill level, lịch sử
- [ ] Player profile `/players/profile/:id`
- [ ] Import/export (nếu role cho phép)

---

## D. Courts

- [ ] Quản lý sân — thêm/sửa/tắt sân
- [ ] Court Management — calendar, bookings, status board
- [ ] Cloud sync — Đồng bộ lên cloud → `club_data_v3`

---

## E. Tournament

- [ ] Internal tournament setup + bracket
- [ ] Official / Daily Play
- [ ] Bracket page, standings, Elo cập nhật sau trận
- [ ] Tournament Engine 4.0 tabs (seed/draw/schedule)
- [ ] Season standings + league rounds

---

## F. Court Engine

- [ ] `/court-engine` — Check-in, Queue, Live Courts
- [ ] Auto assignment, timer, transfer sân
- [ ] Activity log
- [ ] Không phá Director Mode cũ

---

## G. Director Mode

- [ ] `/tournament/director/:id` — authenticated JWT (không anon)
- [ ] Realtime cập nhật score
- [ ] Gán trọng tài → token link
- [ ] Supabase chip xanh trong Cài đặt

---

## H. Dashboard

- [ ] KPI panels load
- [ ] Revenue chart, heatmap, peak hours
- [ ] Time filter hoạt động
- [ ] Empty state khi chưa có dữ liệu

---

## I. Subscription

- [ ] Trial / Starter / Professional / Enterprise hiển thị đúng
- [ ] Banner nhắc 7/3/1 ngày
- [ ] Expired → gate (trừ SUPER_ADMIN)
- [ ] `VITE_PAYMENT_MODE=dev` — nâng cấp local OK

---

## J. Tenant Isolation

- [ ] TenantSwitcher — chuyển tenant (SUPER_ADMIN)
- [ ] User venue A không thấy club venue B
- [ ] `club_data_v3.venue_id` đồng bộ đúng sau sync

---

## K. API (flag OFF mặc định GA)

- [ ] Menu API **ẩn**
- [ ] `VITE_API_ENABLED=true` (staging test) — endpoint mock/load OK
- [ ] Flag OFF — router từ chối có message

---

## L. Mobile / PWA

- [ ] Responsive — bottom nav trên mobile
- [ ] `/mobile/check-in`, `/mobile/qr-scan`, `/mobile/player`
- [ ] PWA install prompt (Chrome mobile)
- [ ] Offline banner (mất mạng)
- [ ] Desktop layout không regress

---

## M. Preview flags OFF (GA default)

- [ ] Marketplace menu **ẩn**
- [ ] Integrations menu **ẩn**
- [ ] AI Assistant tab **ẩn** trên tournament setup
- [ ] URL trực tiếp → message "chưa bật"

---

## Phase 3 — Kết luận

| Trạng thái | Điều kiện |
|------------|-----------|
| **PASS** | Mọi mục P0 tick; không blocker bảo mật/dữ liệu |
| **BLOCKED** | RBAC lỗi, RLS lộ/chặn sai, auth broken, tournament/director fail |

**Sau PASS:** Phase 5 tag proposal + Phase 6 final audit → `docs/GA-FINAL-AUDIT.md`
