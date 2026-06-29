# Checklist test — Trình công khai & Rating nội bộ

Dùng checklist này sau mỗi lần sửa liên quan `level`, `rating`, `ratingInternal`, giải đấu hoặc xếp sân.

**Chuẩn bị**

- [ ] Chạy `npm run dev`, mở CLB có sẵn VĐV và giải cũ (nếu có).
- [ ] (Tuỳ chọn) Chạy test tự động:  
  `node --test tests/skill-level-engine.test.js tests/skill-level-service.test.js tests/elo-engine.test.js`

**Vai trò test**

| Vai trò | Tài khoản dev gợi ý |
|---------|----------------------|
| Admin / Chủ CLB | `club@club.local` (bật RBAC trong Cài đặt nếu cần) |
| VĐV | `player@club.local` |

---

## 1. Người chơi cũ vẫn hiển thị đúng điểm trình

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 1.1 | Vào **Người chơi**, xem VĐV đã có từ trước khi nâng cấp | Cột/thẻ hiển thị `level` như cũ (vd. 3.5) | ☐ |
| 1.2 | Mở **Hồ sơ VĐV** | Dòng **Trình công khai** = `level` cũ | ☐ |
| 1.3 | DevTools → Application → Local Storage → `pickleball-club-data-v3::{clubId}` | `players[].level` không bị đổi ngẫu nhiên | ☐ |

---

## 2. Tạo trận mới không lỗi

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 2.1 | **Giải đấu** → Daily Play / Nội bộ / Mở → tạo hoặc mở giải ACTIVE | Không crash, không toast lỗi | ☐ |
| 2.2 | Tạo trận / xếp lịch sân (Director hoặc Setup) | Trận xuất hiện, status `waiting`/`assigned` | ☐ |
| 2.3 | **Xếp sân** → chạy AI xếp 1 lượt | Lưu session thành công | ☐ |

---

## 3. Nhập kết quả không lỗi

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 3.1 | Nhập điểm trận (Setup hoặc Director Mode) | Lưu OK, trận `completed` | ☐ |
| 3.2 | Daily Play: nhập score A/B | Sân được giải phóng (nếu có court) | ☐ |
| 3.3 | Knockout / vòng bảng: nhập score | BXH/bracket cập nhật bình thường | ☐ |

---

## 4. Giải đấu cũ không lỗi

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 4.1 | Mở giải đã tạo trước khi có `ratingInternal` | Load được, danh sách trận/events hiển thị | ☐ |
| 4.2 | Xem kết quả trận đã hoàn tất | Score/winner hiển thị đúng | ☐ |
| 4.3 | Director Mode trên giải cũ | Không lỗi console | ☐ |

---

## 5. Ghép cặp không lỗi

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 5.1 | Giải nội bộ: chọn VĐV → **Đề xuất ghép cặp** | Animation / danh sách cặp chạy | ☐ |
| 5.2 | **Xếp sân**: chọn VĐV + sân → Xếp | Cặp/sân hợp lệ, dùng `level` công khai | ☐ |
| 5.3 | Kiểm tra không đọc `ratingInternal` cho ghép cặp UI | Ghép theo trình công khai, không crash | ☐ |

---

## 6. Chia bảng không lỗi

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 6.1 | Internal/Official: **Chia bảng** / seed | Bảng A/B… tạo thành công | ☐ |
| 6.2 | Xem danh sách trận vòng bảng | Matches gắn đúng group | ☐ |
| 6.3 | Giải cũ đã có bảng | Mở lại không mất dữ liệu bảng | ☐ |

---

## 7. Không VĐV nào đổi trình công khai ngay sau trận

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 7.1 | Ghi nhận `level` VĐV tham gia trận (vd. 3.5) | — | ☐ |
| 7.2 | Nhập kết quả trận giải **có gắn league** | Lưu thành công | ☐ |
| 7.3 | Kiểm tra lại **Người chơi** / localStorage | `level` và `rating` **không đổi** | ☐ |
| 7.4 | Kiểm tra `ratingInternal` | Có thể tăng/giảm (Elo nội bộ) | ☐ |
| 7.5 | Test tự động | `node --test tests/skill-level-service.test.js` (case elo) pass | ☐ |

---

## 8. Cuối tháng mới tạo bản đề xuất cập nhật trình

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 8.1 | Đặt `skillMeta.lastPublicLevelReviewAt` tháng trước (hoặc đợi sang tháng mới) | — | ☐ |
| 8.2 | Đảm bảo `ratingInternal` lệch đủ ngưỡng (≥ +0.35 hoặc ≤ −0.35 so với `level`) | — | ☐ |
| 8.3 | Sang tháng mới (hoặc mở app / vào **Người chơi**) | Hệ thống **tự tạo** đề xuất, không cần bấm nút | ☐ |
| 8.4 | Kiểm tra localStorage `skillLevelProposals[]` | Có bản ghi `status: "pending"` | ☐ |
| 8.5 | Kiểm tra `players[].level` | **Chưa đổi** sau bước tạo đề xuất | ☐ |
| 8.6 | VĐV không đủ điều kiện đổi trình | Chốt hold tháng, không có đề xuất pending | ☐ |

---

## 9. Admin duyệt thì trình mới thay đổi

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 9.1 | Đăng nhập Admin/Chủ CLB (`PLAYERS_MANAGE`) | Thấy nút **Duyệt** / **Từ chối** | ☐ |
| 9.2 | Bấm **Duyệt** trên 1 đề xuất | `level` + `rating` = `proposedLevel`; `ratingInternal` giữ nguyên | ☐ |
| 9.3 | Đề xuất chuyển `status: "approved"` | Không còn trong danh sách pending | ☐ |
| 9.4 | Tạo đề xuất khác → bấm **Từ chối** | `level` không đổi; proposal `rejected` | ☐ |
| 9.5 | VĐV (`PLAYER`) | Không thấy nút duyệt (PermissionGate) | ☐ |
| 9.6 | Test tự động | `node --test tests/skill-level-service.test.js` (approve/reject) pass | ☐ |

---

## Regression nhanh (smoke)

```bash
npm run test:unit
```

Hoặc tối thiểu:

```bash
node --test tests/skill-level-engine.test.js tests/skill-level-service.test.js tests/elo-engine.test.js tests/tournament-engines.test.js tests/tournament-service.test.js
```

---

## Ghi chú kỹ thuật

| Field | Ý nghĩa |
|-------|---------|
| `level` | Trình **công khai** — chỉ đổi khi admin **Duyệt** đề xuất tháng |
| `rating` | Mirror `level` (tương thích code cũ) |
| `ratingInternal` | Elo nội bộ — cập nhật sau trận giải có `leagueId` |
| `skillLevelProposals[]` | Đề xuất chờ duyệt (blob CLB) |

**Ngoài phạm vi checklist:** Module **Xếp sân** không cộng Elo / không tạo đề xuất trình (theo thiết kế v3).

---

## Ký xác nhận

| Mục | Người test | Ngày | Pass/Fail |
|-----|------------|------|-----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |

**Tester:** _______________  
**Phiên bản app:** _______________  
**Ghi chú lỗi:** _______________
