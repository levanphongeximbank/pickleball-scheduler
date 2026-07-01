# Phase 3 — Production QA Checklist (Sprint 12 GA)

**Môi trường:** Production URL + `VITE_RBAC_ENABLED=true` + SQL đã apply (`docs/SUPABASE-PRODUCTION-CHECKLIST.md`).

Tạo **8 user test** (đăng ký → gán role qua SQL hoặc User Management). Đăng xuất/đăng nhập lại sau mỗi lần đổi role.

**Matrix quyền:** `docs/RBAC-MATRIX.md`  
**RBAC chi tiết:** `docs/RBAC-RC-QA.md`

## Tiến độ QA Production

| Mục | Trạng thái | Ngày |
|-----|------------|------|
| **F. Court Engine** | ✅ PASS | 2026-07-01 |
| **A. Authentication** | ✅ PASS | 2026-07-01 |
| B. RBAC (8 roles) | ⏸️ Chưa tick | — |
| C. Players | ⏸️ Chưa tick | — |
| D. Courts | ⏸️ Chưa tick | — |
| E. Tournament | ⏸️ Chưa tick | — |
| G. Director Mode | ⏸️ Chưa tick | — |
| H. Dashboard | ⏸️ Chưa tick | — |
| I. Subscription | ⏸️ Chưa tick | — |
| J. Tenant Isolation | ⏸️ Chưa tick | — |
| K. API (flag OFF) | ⏸️ Chưa tick | — |
| L. Mobile / PWA | ⏸️ Chưa tick | — |
| M. Preview flags OFF | ⏸️ Chưa tick | — |

**Bug đã RESOLVED:**

- `/court-engine` white screen khi reload trực tiếp hoặc session/context null — fix `courtEngineContextGuard` + `CourtEnginePage`; Production QA xác nhận 2026-07-01.
- **P0 auto-assign trùng sân bận** — ghép sân lần 2 vẫn gán vào sân đang có assignment/trận active; fix `courtStateService` + đồng bộ `courtStates` khi confirm/start/pause/resume/end; fallback `activeAssignments` cho session localStorage; Production QA đóng 2026-07-01.

---

## A. Authentication — ✅ PASS (2026-07-01)

**Ghi chú:** Production manual QA passed, no blocker found.

- [x] `/login` — trang load bình thường; đăng nhập email/password hợp lệ OK
- [x] Đăng nhập sai — thông báo lỗi rõ, không treo
- [x] Session restore sau refresh trang
- [x] Reload trực tiếp trên protected routes — OK
- [x] `/logout` — đăng xuất; protected routes redirect về login
- [ ] `/forgot-password` → email reset (nếu SMTP/Supabase email bật) — chưa test trên Production
- [ ] `/reset-password` — đổi mật khẩu — chưa test trên Production
- [ ] User chưa có profile hợp lệ → thông báo rõ, không crash — chưa test trên Production
- [ ] Signup mới → role **PLAYER** (trigger v3.5.7) — chưa test trên Production

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

## F. Court Engine — ✅ PASS (2026-07-01, đóng QA sau P0 fix)

| Hạng mục | Trạng thái | Ghi chú |
|----------|------------|---------|
| Check-in | ✅ PASS | Check-in, cancel, no-show |
| Live Courts | ✅ PASS | Timer start/pause/resume/end, trạng thái sân |
| Court Assignment | ✅ PASS | Auto-assign preview/confirm; **P0 trùng sân bận đã fix** |
| Session Persistence | ✅ PASS | Reload giữ session localStorage hợp lý |
| Mobile responsive | ⚠️ PARTIAL | Chưa QA đầy đủ trên thiết bị thật |

### P0 fix — auto-assign không ghi đè sân bận (2026-07-01)

- [x] Không cho auto-assign vào sân đang có assignment/trận active
- [x] Sân bận gồm trạng thái: `assigned`, `playing`, `paused`, `overrun`
- [x] `courtStates` đồng bộ khi confirm / start / pause / resume / end match
- [x] `activeAssignments` dùng làm fallback khi `courtStates` lệch (localStorage cũ)
- [x] Ghép lần 2 → sân bận bị loại; dùng sân trống khác hoặc cảnh báo *Không có sân trống*
- [x] Test tự động: `occupied court skipped on second auto-assign` (`tests/court-engine.test.js`)

### Checklist QA đã tick

- [x] `/court-engine` — vào được; reload trực tiếp không trắng màn hình
- [x] Check-in, Queue, Live Courts
- [x] Gán người chơi vào sân (2/4 người)
- [x] Auto assignment preview → confirm → không gán trùng sân đang bận
- [x] Bắt đầu / kết thúc lượt chơi (timer); `courtStates` cập nhật đúng
- [x] Reload giữ trạng thái hợp lý; không mất dữ liệu bất thường
- [x] Thiếu season/league → thông báo hướng dẫn (không crash)
- [x] Không phát hiện lỗi nghiêm trọng trong scope test
- [x] Không phá Director Mode cũ (không regress trong scope test)

### Chưa tick / ngoài scope đóng QA

- [ ] Transfer sân, Activity log, Referee dispatch — chưa test đầy đủ trên Production
- [ ] Mobile layout `/court-engine` trên thiết bị thật — PARTIAL (responsive cơ bản OK)

**Kết luận mục F:** Court Engine Production QA **có thể đóng** — P0 đã fix + test pass; mobile real-device là follow-up không chặn GA scope Court Engine core.

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
