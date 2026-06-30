# Supabase Staging Checklist — v3.5.8

Checklist chạy RLS trên **Supabase staging** (project riêng, không production).

**QA đầy đủ v3.5.8:** `docs/STAGING-APPLY-QA-v358.md` (user test, manual QA theo role, Go/No-Go Preview).

## Trước khi bắt đầu

- [ ] Tạo Supabase project **staging** (khác production)
- [ ] Bật **Email Auth** (Authentication → Providers)
- [ ] Copy `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` vào Vercel Preview hoặc `.env.local`
- [ ] `VITE_RBAC_ENABLED=true` trên staging
- [ ] `VITE_SEED_DEMO=false`

## Thứ tự chạy SQL (bắt buộc)

Chạy từng file trong **SQL Editor** → **Run** theo thứ tự:

| # | File | Mục đích |
|---|------|----------|
| 1 | `docs/supabase-club-v3.sql` | Bảng `club_data_v3` (anon-open tạm) |
| 2 | `docs/supabase-rbac.sql` | `venues`, `profiles`, helpers, RLS profiles/payments |
| 3 | `docs/supabase-club-v3-rls.sql` | Khóa `club_data_v3` theo venue/club |
| 4 | `docs/supabase-match-live.sql` | Bảng `tournament_match_live` |
| 5 | `docs/supabase-match-live-rls.sql` | RLS match live + RPC referee (v3.5.6) |
| 6 | `docs/supabase-security-hardening-v357.sql` | PLAYER signup + profile update guards (v3.5.7) |
| 7 | `docs/supabase-match-live-v2.sql` | (Nếu có) cột status bổ sung |

**Không** chạy `docs/supabase-rls-rollback.sql` trừ khi cần khôi phục khẩn cấp.

## Tạo admin đầu tiên

1. Mở app staging → `/login` → **Đăng ký** tài khoản admin (role tự tạo là **PLAYER** — v3.5.7).
2. Xác nhận email (nếu bật confirmation).
3. SQL Editor (chỉ SUPER_ADMIN được đổi role qua app; lần đầu dùng SQL Editor):

```sql
update public.profiles
set
  role = 'SUPER_ADMIN',
  status = 'active',
  display_name = 'Admin Staging'
where email = 'admin@staging.local';
```

4. Đăng xuất → đăng nhập lại → kiểm tra menu đầy đủ.

## Gán role / venue / club

### Tạo venue

```sql
insert into public.venues (id, name, slug, status)
values ('venue-staging', 'Sân Staging', 'venue-staging', 'trial')
on conflict (id) do nothing;
```

### Gán VENUE_OWNER

```sql
update public.profiles
set role = 'VENUE_OWNER', venue_id = 'venue-staging', club_id = null, status = 'active'
where email = 'owner@staging.local';
```

### Gán CLUB_OWNER / PLAYER

```sql
update public.profiles
set role = 'CLUB_OWNER', venue_id = 'venue-staging', club_id = 'default-club', status = 'active'
where email = 'club@staging.local';

update public.profiles
set role = 'PLAYER', venue_id = 'venue-staging', club_id = 'default-club',
    player_id = 'player-staging-1', status = 'active'
where email = 'player@staging.local';
```

### Gán VENUE_MANAGER / CASHIER

```sql
update public.profiles
set role = 'VENUE_MANAGER', venue_id = 'venue-staging', status = 'active'
where email = 'manager@staging.local';

update public.profiles
set role = 'CASHIER', venue_id = 'venue-staging', status = 'active'
where email = 'cashier@staging.local';
```

### Đồng bộ `venue_id` trên club_data_v3

Sau khi sync CLB lên cloud, cập nhật:

```sql
update public.club_data_v3
set venue_id = 'venue-staging'
where club_id = 'default-club';
```

## Kiểm tra RLS đã bật

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles', 'venues', 'subscriptions', 'payment_events',
    'club_data_v3', 'tournament_match_live'
  )
order by tablename;
```

Kỳ vọng: `rls_enabled = true` cho mọi bảng.

## Kiểm tra nhanh sau SQL

| Kiểm tra | Cách |
|----------|------|
| RLS profiles | User thường chỉ đọc được profile của mình |
| RLS club_data | User venue A không đọc club venue B |
| Cloud sync | Đăng nhập → Cài đặt → Đồng bộ lên cloud |
| Referee | Director gán TT → mở `/referee/:token` (RPC, không anon select) |
| RPC referee | SQL: `select referee_get_match_by_token('token-dai-...')` trả 1 JSON |
| Realtime | Replication bật cho `tournament_match_live` (Director authenticated) |

Chi tiết test case: `docs/RLS-TEST-PLAN.md`.

## Rollback nếu lỗi

1. **Chỉ club/match live** — chạy `docs/supabase-rls-rollback.sql` (khôi phục anon-open).
2. **Xóa policy thủ công** — Table Editor → RLS → disable tạm (không khuyến nghị).
3. **Project staging mới** — xóa project, tạo lại, chạy lại checklist từ đầu.

Sau rollback: `VITE_RBAC_ENABLED=false` tạm để dev local không bị chặn.

## Env staging (Vercel Preview)

| Biến | Giá trị staging |
|------|-----------------|
| `VITE_SUPABASE_URL` | URL project staging |
| `VITE_SUPABASE_ANON_KEY` | Anon key staging |
| `VITE_RBAC_ENABLED` | `true` |
| `VITE_PAYMENT_MODE` | `dev` (không Stripe) |
| `VITE_SEED_DEMO` | `false` |

## Bước tiếp theo

- Chạy `docs/STAGING-APPLY-QA-v358.md` (user test + QA theo role + Go/No-Go)
- Chạy `docs/RLS-TEST-PLAN.md` đầy đủ
- Deploy **preview** Vercel (không production)
- Khi pass → lặp lại trên production với backup
