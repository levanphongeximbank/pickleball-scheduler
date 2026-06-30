# Features modules (parallel architecture — v3.5.1)

**Trạng thái:** Song song với `src/pages/` — **chưa** thay route production.

## Nguyên tắc

1. Code mới nằm ở đây; `pages/` giữ nguyên cho đến khi bạn duyệt chuyển import.
2. Không xóa / không move file cũ khi chưa có approval.
3. Chuyển route: sửa `src/router.jsx` **sau khi** `npm run build` + test pass với module mới.

## Module sẵn sàng (copy + tách)

| Module | Path | Thay thế (khi duyệt) |
|--------|------|---------------------|
| Director Mode | `tournament/director/` | `pages/tournament/TournamentDirectorMode.jsx` |
| Statistics | `statistics/` | `pages/Statistics.jsx` |

## Cách kiểm tra module mới (tạm thời)

Trong `router.jsx`, đổi một dòng lazy import sang `features/...`, chạy `npm run build`, so sánh UI, rồi revert hoặc giữ.

## Chưa làm

- `features/league/`, `court-management/`, `scheduler/`, `auth/`
- Archive `legacy/` — chỉ đánh dấu cleanup, không xóa `pages/Tournament.jsx`
