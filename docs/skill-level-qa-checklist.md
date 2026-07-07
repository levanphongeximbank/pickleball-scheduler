# Checklist test — Điểm trình độ riêng tư & Elo giải đấu

Dùng checklist này sau mỗi lần sửa liên quan `skillLevel`, `level`, `rating`, `ratingInternal`, giải đấu hoặc xếp sân.

**Chuẩn bị**

- [ ] Chạy `npm run dev`, mở CLB có sẵn VĐV và giải cũ (nếu có).
- [ ] (Tuỳ chọn) Chạy test tự động:  
  `node --test tests/skill-level-change-service.test.js tests/skill-level-engine.test.js tests/skill-level-service.test.js tests/elo-engine.test.js`

**Vai trò test**

| Vai trò | Tài khoản dev gợi ý |
|---------|----------------------|
| Chủ CLB | `club@club.local` |
| VĐV | `player@club.local` |
| Kỹ thuật viên | `kythuat@gmail.com` (V5.2 seed) |

---

## 1. Tạo VĐV — nhập trình độ một lần

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 1.1 | Chủ CLB → **Người chơi** → **Thêm** → chọn điểm trình độ | Slider hiện nhãn "chỉ nhập một lần" | ☐ |
| 1.2 | Lưu VĐV mới | `skillLevel` + `skillLevelLockedAt` có trong blob | ☐ |
| 1.3 | **Sửa** VĐV vừa tạo | Không thấy slider trình độ; có thông báo đã khóa | ☐ |

---

## 2. Quyền xem điểm trình độ

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 2.1 | VĐV khác / HLV xem **Người chơi** | Thẻ VĐV **không** hiện block Trình độ | ☐ |
| 2.2 | VĐV xem **hồ sơ của mình** | Thấy điểm trình độ | ☐ |
| 2.3 | Chủ CLB xem hồ sơ VĐV thuộc CLB | Thấy điểm trình độ | ☐ |
| 2.4 | BTC mở **setup giải** (Internal/Official/Daily) | Thấy trình độ khi chọn VĐV (nếu có quyền organizer) | ☐ |

---

## 3. Elo chỉ từ giải đấu (không Daily Play)

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 3.1 | Ghi nhận `skillLevel` VĐV trước trận | — | ☐ |
| 3.2 | Nhập kết quả trận **giải nội bộ / bracket** có `leagueId` | `skillLevel` có thể tăng/giảm | ☐ |
| 3.3 | Nhập kết quả trận **Daily Play** | `skillLevel` **không đổi** | ☐ |
| 3.4 | Test tự động | `tests/skill-level-change-service.test.js` (daily skip) pass | ☐ |

---

## 4. VĐV yêu cầu thay đổi — kỹ thuật viên duyệt

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 4.1 | VĐV → **Hồ sơ** → form **Yêu cầu thay đổi trình độ** | Gửi thành công khi có lý do | ☐ |
| 4.2 | Gửi lần 2 khi còn pending | Bị chặn | ☐ |
| 4.3 | Kỹ thuật viên → `/admin/skill-level-requests` | Thấy hàng chờ | ☐ |
| 4.4 | Bấm **Duyệt** | `skillLevel` cập nhật; request `approved` | ☐ |
| 4.5 | Tạo request khác → **Từ chối** | `skillLevel` không đổi | ☐ |

---

## 5. Regression nhanh (smoke)

```bash
node --test tests/skill-level-change-service.test.js tests/skill-level-engine.test.js tests/skill-level-service.test.js tests/elo-engine.test.js
```

---

## Ghi chú kỹ thuật

| Field | Ý nghĩa |
|-------|---------|
| `skillLevel` | Điểm trình độ chính thức (riêng tư) |
| `skillLevelLockedAt` | Thời điểm khóa sau lần nhập đầu |
| `skillLevelChangeRequests[]` | Hàng chờ duyệt thay đổi thủ công (VĐV → kỹ thuật viên) |
| `level` / `rating` | Mirror của `skillLevel` (engine cũ) |
| `ratingInternal` | Theo dõi Elo; sau trận giải sync với `skillLevel` |

**Đề xuất tháng cũ** (`skillLevelProposals[]`): tắt mặc định (`enabled: false`). Luồng mới dùng `skillLevelChangeRequests`.

**Ngoài phạm vi:** Module **Xếp sân** không cộng Elo.

---

## Ký xác nhận

| Mục | Người test | Ngày | Pass/Fail |
|-----|------------|------|-----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

**Tester:** _______________  
**Phiên bản app:** _______________
