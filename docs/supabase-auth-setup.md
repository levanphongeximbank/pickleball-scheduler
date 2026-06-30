# Supabase Auth + RBAC — hướng dẫn nhanh

## 1. Chạy SQL

Trong Supabase SQL Editor, chạy lần lượt:

1. `docs/supabase-club-v3.sql` (nếu chưa có)
2. `docs/supabase-rbac.sql`

## 2. Cấu hình app

File `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
# Auth production tự bật khi có 2 biến trên → bắt buộc đăng nhập
VITE_RBAC_ENABLED=false
```

Bật RBAC permission (bước sau): `VITE_RBAC_ENABLED=true`

## 3. Tạo user + profile

1. Supabase Dashboard → **Authentication** → tạo user (email/password)
2. Copy `user.id` (uuid)
3. Insert profile (ví dụ chủ sân):

```sql
insert into public.profiles (id, email, display_name, role, venue_id, status)
values (
  'USER_UUID_HERE',
  'owner@sanabc.vn',
  'Chủ sân ABC',
  'VENUE_OWNER',
  'venue-demo',
  'active'
);
```

4. Đảm bảo venue tồn tại (`venues` table) hoặc dùng app → **Cài đặt** → tạo venue demo

## 4. Đăng nhập trong app

- **Production:** mở `/login` hoặc **Cài đặt** → panel **Đăng nhập & Phân quyền**

- Khi có Supabase env → form email/mật khẩu
- Khi không có Supabase → dev registry (`owner@venue.local`, …)

## 5. Lưu ý

- Referee: anon client + RPC token-scoped (`matchLiveSync` referee path).
- Director/staff: JWT session qua `getSupabaseAuthClient()` (giống `cloudSync`).
- Auth client (`src/auth/supabaseClient.js`) persist session trong trình duyệt.
- Đăng ký luôn tạo profile `PLAYER` — không gửi role trong metadata.
- Chỉ SUPER_ADMIN đổi role (trigger SQL); user tự sửa chỉ `display_name`, `player_id`.
- Chưa có payment gateway — nâng cấp gói chỉ lưu local (`upgradeSubscription`).

## 6. Nhân sự venue

**Cài đặt → Nhân sự venue** — mời MANAGER / CASHIER / ACCOUNTANT / CLUB_OWNER.

Giới hạn `maxUsers` theo gói subscription (trial: 5 user).

## 7. Thanh toán

- Dev: `VITE_PAYMENT_MODE=dev` — nâng cấp gói ngay trong app
- Production: `VITE_PAYMENT_MODE=stripe` + Payment Links — xem `docs/supabase-payment-webhook.md`

## 8. Bước production

- Chạy `docs/supabase-club-v3-rls.sql` để bật RLS trên `club_data_v3`
- Deploy Edge Function webhook (mẫu trong `docs/supabase-payment-webhook.md`)
