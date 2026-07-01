# Mobile Sprint 9 — QA Checklist

Apply SQL: `docs/supabase-mobile-sprint9.sql` (staging first).

## PWA

- [ ] `npm run build` tạo `dist/sw.js` + `manifest.webmanifest`
- [ ] Android Chrome: "Cài đặt" / Add to Home Screen
- [ ] iPhone Safari: Share → Add to Home Screen
- [ ] Mở từ màn hình chính: standalone, không thanh URL
- [ ] Banner "Cài app" hiện trên mobile (khi browser hỗ trợ)

## Mobile layout

- [ ] iPhone width (~390px): bottom nav, drawer menu, không sidebar cố định
- [ ] Android width (~412px): tương tự
- [ ] Tablet (~768px): chuyển sang sidebar desktop
- [ ] Desktop: layout cũ không đổi

## Offline

- [ ] Bật airplane mode → banner "Đang ở chế độ offline"
- [ ] Vẫn xem được dữ liệu cache gần nhất
- [ ] Check-in offline → pending queue
- [ ] Tắt airplane mode → tự đồng bộ (hoặc bấm Đồng bộ)
- [ ] Xung đột: hiển thị cảnh báo, không ghi đè âm thầm

## QR Check-in

- [ ] Tạo QR người chơi (`/mobile/qr-generate`)
- [ ] Quét QR hợp lệ (`/mobile/qr-scan`)
- [ ] QR hết hạn → lý do rõ
- [ ] QR sai tenant → từ chối
- [ ] QR đã check-in → "Đã check-in lúc..."
- [ ] Dashboard (`/mobile/check-in`): thống kê + lọc + tìm kiếm

## Notifications

- [ ] Không tự xin quyền khi mở app
- [ ] `/mobile/notifications` → Bật thông báo mới xin quyền
- [ ] Bật/tắt từng loại thông báo
- [ ] Referee chỉ thấy trận được phân công (filter)

## Referee / Player mobile

- [ ] `/referee` — nút lớn, quét QR trên mobile
- [ ] `/mobile/player` — lịch, QR cá nhân, thông báo

## Regression

- [ ] `npm test` pass
- [ ] `npm run build` pass
- [ ] Login/logout, Dashboard, Tournament desktop OK
