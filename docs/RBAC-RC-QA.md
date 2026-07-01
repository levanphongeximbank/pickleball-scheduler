# RBAC Manual QA — Release 4.0 RC

Chạy trên **staging/preview** với `VITE_RBAC_ENABLED=true` và SQL đã apply theo `docs/SUPABASE-STAGING-CHECKLIST.md`.

Tạo user test (SQL Editor) cho mỗi role. Đăng xuất/đăng nhập lại sau khi đổi role.

---

## SUPER_ADMIN

- [ ] Thấy menu: Tenant Management, Users, Audit, toàn bộ Điều hành/CLB/Giải
- [ ] Vào `/admin/tenants` — OK
- [ ] Subscription expired tenant — vẫn bypass gate
- [ ] Đổi role user khác qua User Management

## COURT_OWNER (VENUE_OWNER alias)

- [ ] Chỉ dữ liệu sân `venue_id` của mình (club sync, bookings)
- [ ] Menu: Live Courts, Court Engine, revenue, customers, settings
- [ ] Không thấy Tenant Management (trừ khi cũng SUPER_ADMIN)
- [ ] Tạo/sửa CLB trong venue

## COURT_MANAGER (VENUE_MANAGER)

- [ ] Vận hành: bookings, customers, players, tournaments
- [ ] Không sửa system settings / user manage
- [ ] Director Mode — OK nếu subscription active

## ACCOUNTANT

- [ ] Home redirect → `/court-management/revenue`
- [ ] Xem finance/revenue/export
- [ ] Không tạo tournament / director

## CASHIER

- [ ] Home → `/court-management/bookings`
- [ ] Tạo booking, xem customers
- [ ] Không xem statistics export đầy đủ

## REFEREE

- [ ] Home → `/referee`
- [ ] Hub + giải được phân công
- [ ] Không menu Players quản lý CLB
- [ ] Token scoreboard `/referee/:token` (RPC)

## CLUB_OWNER

- [ ] Chỉ CLB `club_id` profile
- [ ] Tab members, ELO, matches CLB
- [ ] Tạo giải nội bộ CLB

## PLAYER

- [ ] Home → `/tournament`
- [ ] Hồ sơ `/players/profile/:playerId` — chỉ self
- [ ] Không menu quản trị CLB/sân
- [ ] Statistics — chỉ dữ liệu liên quan club

---

## Guards chung

| Guard | Test |
|-------|------|
| Route | URL trực tiếp không có quyền → `/403` |
| Menu | Item ẩn theo permission |
| Action | Nút lưu/xóa disabled hoặc toast forbidden |
| Tenant | CLB venue khác → chặn |
| Subscription | Feature premium khi expired → banner + gate |

---

## Marketplace / API (flag OFF)

- [ ] Menu Marketplace, Tích hợp, Admin Integration **ẩn**
- [ ] `VITE_MARKETPLACE_ENABLED=true` → menu hiện, trang load

---

## Ghi chú

- Local dev `VITE_RBAC_ENABLED=false`: mọi guard bypass — **không** dùng để kết luận RC.
- Matrix quyền: `docs/RBAC-MATRIX.md`
