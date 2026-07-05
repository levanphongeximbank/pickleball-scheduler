# V5 Sidebar — Ghi chú triển khai menu

**Ngày:** 2026-07-05  
**Quy tắc:** Sidebar **tối đa 2 cấp** — cấp 1 (folder) có nút **xổ/thu** → cấp 2 (mục lá). Chi tiết sâu hơn dùng tab trong màn hình.

## Cấu trúc sidebar (source of truth)

```
▼ Tổng quan          ← cấp 1, bấm mũi tên để thu/mở
    Tổng quan        ← cấp 2
▼ Vận hành sân
    Lịch sân, Đặt sân, Check-in, …
▼ Giải đấu
    Tổng quan, Danh sách giải, Tạo giải, Loại giải, …
…
```

## Chi tiết sâu → tab / thẻ trong màn hình

Các mục như **Đơn nam**, **Đôi tự do**, **Chia thủ công**, **Bốc thăm tự động**, **Chọn đội theo lượt** **không** nằm trong sidebar.

Registry: [`src/config/v5Menu/tournamentInPageNav.js`](../../src/config/v5Menu/tournamentInPageNav.js)  
UI hub: [`src/components/nav/InPageNavHub.jsx`](../../src/components/nav/InPageNavHub.jsx)  
Routes hub giải: `/tournament/types`, `/tournament/roster`, `/tournament/organize`, `/tournament/operations`, `/tournament/results`, `/tournament/config`

## File liên quan

| Vai trò | Path |
|---------|------|
| Menu sidebar (phẳng) | `src/config/v5Menu/*Menu.js` |
| Độ sâu sidebar | `src/config/v5Menu/menuDepthAudit.js` |
| Gộp nhóm | `src/config/v5Menu/index.js` |
| Runtime filter RBAC | `src/config/navigationConfig.js` |
| Render sidebar | `src/components/nav/NavMenuShell.jsx` |

## QA

```bash
npm test -- tests/v5-menu-audit.test.js
```

- `auditSidebarMenuDepth(MENU_GROUPS)` → `ok: true` (không folder lồng trong sidebar)
- Mục giải cá nhân vẫn có trong `tournamentInPageNav` (test riêng)
