# Supabase Staging Checklist — v4.0 RC (Sprint 1–10)

Checklist chạy RLS trên **Supabase staging** (project riêng, không production).

**QA đầy đủ v3.5.8:** `docs/STAGING-APPLY-QA-v358.md`  
**QA Identity Phase B:** `docs/STAGING-APPLY-QA-v40-phaseB.md`  
**QA v4.0 tổng hợp:** `docs/STAGING-APPLY-QA-v40.md`  
**RBAC RC QA:** `docs/RBAC-RC-QA.md`  
**Go/No-Go RC:** `docs/RELEASE-4.0-RC.md`

## Trước khi bắt đầu

- [ ] Tạo Supabase project **staging** (khác production)
- [ ] Bật **Email Auth** (Authentication → Providers)
- [ ] Copy `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` vào Vercel Preview hoặc `.env.local`
- [ ] `VITE_RBAC_ENABLED=true` trên staging
- [ ] `VITE_SEED_DEMO=false`

## Thứ tự chạy SQL (bắt buộc)

Chạy từng file trong **SQL Editor** → **Run** theo thứ tự. Mọi file **additive** (không drop dữ liệu hiện có).

| # | File | Mục đích | Rollback |
|---|------|----------|----------|
| 1 | `docs/supabase-club-v3.sql` | Bảng `club_data_v3` | — |
| 2 | `docs/supabase-rbac.sql` | `venues`, `profiles`, `subscriptions`, helpers | — |
| 3 | `docs/supabase-club-v3-rls.sql` | RLS `club_data_v3` theo venue/club | `supabase-rls-rollback.sql` |
| 4 | `docs/supabase-match-live.sql` | `tournament_match_live` | — |
| 5 | `docs/supabase-match-live-rls.sql` | RLS + RPC referee (v3.5.6) | — |
| 6 | `docs/supabase-security-hardening-v357.sql` | PLAYER signup + profile guards | — |
| 7 | `docs/supabase-match-live-v2.sql` | (Nếu có) cột status bổ sung | — |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | Identity A: roles/permissions/audit_logs | `supabase-identity-v40-sprint1-rollback.sql` |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | Phase B: audit, password_reset_tokens | `supabase-identity-v40-phaseB-rollback.sql` |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | Phase C: RPC user/audit + RLS venue admin | `supabase-identity-v40-phaseC-rollback.sql` |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | View `tenants`, mở rộng `venues.status`, index | `supabase-multi-tenant-sprint2-rollback.sql` |
| 12 | `docs/supabase-subscription-sprint4.sql` | Plan starter/pro/enterprise, auto_renew, locked_at | — |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | Bảng `ai_suggestions` + RLS tenant | — |
| 14 | `docs/supabase-mobile-sprint9.sql` | push_subscriptions, notifications, qr_tokens, checkins | `supabase-mobile-sprint9-rollback.sql` |
| 15 | `docs/supabase-sprint10.sql` | api_clients/keys/logs, marketplace, payments, webhooks | `supabase-sprint10-rollback.sql` |

**Không** chạy `docs/supabase-rls-rollback.sql` trừ khi cần khôi phục khẩn cấp.

### Chi tiết Sprint 2–10

#### 11 — Multi-tenant (`supabase-multi-tenant-sprint2.sql`)

- **Mục đích:** Alias tenant = venue; reporting view `public.tenants`
- **Tạo/sửa:** `CREATE OR REPLACE VIEW tenants`; `venues.status` check mở rộng; index `club_data_v3_venue_id_idx`
- **RLS:** Dùng RLS club-v3 đã có
- **Verify:** `select * from tenants limit 5;`

#### 12 — Subscription (`supabase-subscription-sprint4.sql`)

- **Mục đích:** Gói Trial/Starter/Professional/Enterprise
- **Cột mới:** `auto_renew`, `locked_at`, `last_renewed_at` trên `subscriptions`
- **Verify:** `select plan_id, status, auto_renew from subscriptions limit 5;`

#### 13 — AI Assistant (`supabase-ai-assistant-sprint7.sql`) — khi `VITE_ENABLE_AI_ENGINE=true`

- **Bảng:** `ai_suggestions` (type, status, input/output jsonb)
- **Indexes:** tenant+tournament, status pending
- **RLS:** select/insert/update theo `tenant_id`
- **Verify:** `select count(*) from ai_suggestions;`

#### 14 — Mobile/PWA (`supabase-mobile-sprint9.sql`)

- **Bảng:** `push_subscriptions`, `notifications`, `qr_tokens`, `checkins`
- **RLS:** user owns rows; qr/checkin authenticated
- **Verify:** `npm run test:verify-mobile-staging` hoặc `select tablename from pg_tables where tablename in ('qr_tokens','checkins');`
- **QA report:** `docs/v5/STAGING-APPLY-QA-v40-mobile.md`

#### 15 — API/Marketplace (`supabase-sprint10.sql`) — khi bật preview flags

- **Bảng:** `api_clients`, `api_keys`, `api_logs`, `marketplace_products`, `marketplace_orders`, `payment_transactions`, `notification_logs`, `webhook_events`
- **`tenant_id`:** kiểu **text** (cùng `venues.id`). Sprint 2: `tenantId === venueId`.
- **RLS:** enabled (policies server-side bổ sung sau)
- **Verify:** xem mục B2–B5 trong `docs/SUPABASE-PRODUCTION-CHECKLIST.md`

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

update public.profiles
set role = 'REFEREE', venue_id = 'venue-staging', status = 'active'
where email = 'referee@staging.local';
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
    'club_data_v3', 'tournament_match_live', 'audit_logs',
    'ai_suggestions', 'push_subscriptions', 'notifications',
    'qr_tokens', 'checkins', 'api_clients', 'api_keys'
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
| Referee legacy | Director gán TT → mở `/referee/:token` (RPC) |
| Referee session | Login REFEREE → `/referee` hub (Phase B) |
| Audit logs | SQL: `select * from audit_logs order by created_at desc limit 5` |
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

- Chạy `docs/STAGING-APPLY-QA-v358.md`
- Chạy `docs/STAGING-APPLY-QA-v40-phaseB.md`
- Chạy `docs/RBAC-RC-QA.md` (role-based QA RC)
- Chạy `docs/RLS-TEST-PLAN.md` đầy đủ
- Deploy **preview** Vercel với checklist `docs/RELEASE-4.0-RC.md`
- Khi pass → production với backup + SQL cùng thứ tự
