# S2 — Staging Smoke Checklist (Preview)

**Mục đích:** kiểm tra nhanh 5 luồng mới của Sprint 2 trên bản Preview trước khi merge.  
**Preview:** https://pickleball-scheduler-git-feature-to-77a967-pickleball-scheduler.vercel.app  
**Vai trò đăng nhập:** BTC / Director của một CLB có giải đồng đội.

| # | Thao tác | Đường dẫn | Kết quả mong đợi | Đạt? |
|---|----------|-----------|------------------|------|
| SM-1 | Sao chép đội có sẵn vào giải | Giải đấu → **Đội có sẵn** → chọn giải đích → **Sao chép vào giải** | Đội (VĐV + đội trưởng) xuất hiện trong giải đích; tên trùng được thêm hậu tố | ☐ |
| SM-2a | Thay người **trước** khóa | Giải đồng đội → tab **Đội** → **Thay người** | Đổi được VĐV; ghi log thay người | ☐ |
| SM-2b | Thay người **sau** khóa/công bố | Khóa/công bố đội hình rồi thử lại | **Bị chặn** (thông báo giải/đội hình đã khóa) | ☐ |
| SM-3 | Tạo nhánh knockout | Có chia bảng + kết quả → tab **Trận đấu** → **Tạo nhánh knockout** | Sinh nhánh loại trực tiếp; giữ nguyên lịch vòng bảng; thắng → tự điền vòng sau | ☐ |
| SM-4a | Trao giải | Tab **Trao giải** → **Gán tự động** | Vô địch/á quân theo chung kết (nếu có KO) hoặc theo BXH | ☐ |
| SM-4b | Đóng giải | Tab **Trao giải** → **Đóng giải ngay** | Kết quả + BXH khóa; không gán lại được; có tóm tắt | ☐ |
| SM-5a | Sẵn sàng trọng tài | Tab **Lịch đối đầu** → panel **Sẵn sàng trọng tài** | Staging: READY · Production: NOT_APPLIED | ☐ |
| SM-5b | Cổng realtime | Tab **Lịch đối đầu** → panel **Cổng realtime** | Stage hiển thị; Production flag OFF; reconnect/poll PASS | ☐ |

**Ghi chú:** Đây là smoke thủ công (deferred). Regression tự động đã xanh: **320/320** (`node --test tests/team-tournament*.test.js`).

**Kết luận smoke:** ☐ Đạt → tiến hành merge PR #11 · ☐ Có lỗi → ghi lại và báo trước khi merge.
