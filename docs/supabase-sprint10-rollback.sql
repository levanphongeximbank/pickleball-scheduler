-- Rollback Sprint 10 tables
-- Dùng khi cần gỡ schema API/Marketplace/Payments/Notifications trên staging hoặc production.
--
-- LƯU Ý:
-- - DROP CASCADE xóa toàn bộ dữ liệu trong 8 bảng Sprint 10 (api_*, marketplace_*, payment_transactions,
--   notification_logs, webhook_events). Không ảnh hưởng venues, profiles, club_data_v3.
-- - Chạy SAU khi tắt VITE_API_ENABLED và VITE_MARKETPLACE_ENABLED trên Vercel.
-- - Không rollback nếu app đã ghi dữ liệu production quan trọng — backup trước.
-- - Lỗi FK uuid/text (bản sprint10 cũ): thường không tạo được bảng → rollback có thể no-op.
--
-- Thứ tự: con → cha (api_keys trước api_clients).

drop table if exists public.webhook_events cascade;
drop table if exists public.notification_logs cascade;
drop table if exists public.payment_transactions cascade;
drop table if exists public.marketplace_orders cascade;
drop table if exists public.marketplace_products cascade;
drop table if exists public.api_logs cascade;
drop table if exists public.api_keys cascade;
drop table if exists public.api_clients cascade;
