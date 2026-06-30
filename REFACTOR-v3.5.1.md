# Refactor v3.5.1 — Architecture Freeze (non-destructive)

**Status:** In progress — parallel modules only  
**Version:** 3.5.1  

## Policy (user-approved)

1. **Không** xóa / move / rename file production mà chưa có approval.
2. `src/pages/Tournament.jsx` và mọi route hiện tại **giữ nguyên**.
3. Module mới trong `src/features/` — copy + tách, chưa thay router.
4. Chỉ đánh dấu cleanup trong tài liệu; thực hiện xóa sau khi app chạy ổn với import mới.

## Đã làm (song song)

### Director Mode — `src/features/tournament/director/`

Copy tách từ `pages/tournament/TournamentDirectorMode.jsx`. Production vẫn dùng file `pages/`.

### Statistics — `src/features/statistics/`

Copy tách từ `pages/Statistics.jsx`. Production vẫn dùng file `pages/`.

### `src/legacy/` (draft only)

Bản nháp / tham chiếu — **không** thay `pages/Tournament.jsx`. Không import từ production.

## Khôi phục sau refactor destructive (đã revert)

| File | Trạng thái |
|------|------------|
| `src/pages/Tournament.jsx` | Khôi phục |
| `src/engine/index.js`, `src/scheduler/*` | Khôi phục |
| `CourtManagementFuturePanel.jsx` | Khôi phục |
| `pages/TournamentDirectorMode.jsx`, `pages/Statistics.jsx` | Khôi phục (full) |
| `router.jsx` | Trỏ lại `pages/` |

## Chưa làm / cần approval

| Item | Hành động đề xuất | Cần approval |
|------|-------------------|--------------|
| Chuyển router sang `features/` | Sửa `router.jsx` | **Có** |
| Xóa monolith sau khi features ổn | Cleanup | **Có** |
| Archive / xóa `legacy/` trùng | Cleanup | **Có** |

## Bước tiếp theo (an toàn)

1. `npm run build` + `test:unit` với router → `pages/` ✅
2. (Tuỳ chọn) Thử import `features/` trên branch preview
3. So sánh UI Director + Statistics
4. Sau khi OK → đổi router → cleanup (có approval)

## Checklist refactor còn lại

- [ ] OfficialTournamentSetup.jsx
- [ ] InternalTournamentSetup.jsx
- [ ] `features/league/`, `court-management/`, `scheduler/`, `auth/`
- [ ] UI test: `AuthProvider` trong `testUtils.jsx`

## Principles

1. UI không chứa export CSV / engine logic.
2. Không xóa khi chưa kiểm tra import + route + test.
3. Không đổi schema / RLS / thuật toán trong freeze.
4. `src/features/` = đích tương lai; `src/pages/` = production hiện tại.
