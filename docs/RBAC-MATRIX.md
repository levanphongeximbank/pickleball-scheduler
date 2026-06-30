# RBAC Permission Matrix — v3.5.4

Ma trận quyền production. Nguồn code: `src/auth/rolePermissions.js`, `src/auth/permissions.js`.

## Roles

| Role DB (`profiles.role`) | Tên hiển thị | Phạm vi |
|---------------------------|--------------|---------|
| `SUPER_ADMIN` | Quản trị hệ thống (admin) | Toàn hệ thống |
| `VENUE_OWNER` | Chủ sân | Tenant / venue |
| `VENUE_MANAGER` | Quản lý sân (manager) | Vận hành venue |
| `CASHIER` | Thu ngân | Thu ngân venue |
| `ACCOUNTANT` | Kế toán | Kế toán venue |
| `CLUB_OWNER` | Chủ CLB | CLB trong venue |
| `PLAYER` | VĐV | Self-service |

**Trọng tài (referee):** không phải RBAC role — dùng link token `/referee/:token` (không đăng nhập). Gán trọng tài trong Director Mode.

## Profile mapping (`public.profiles`)

| Cột DB | App field | Ghi chú |
|--------|-----------|---------|
| `id` | `userId` | = `auth.users.id` |
| `email` | `email` | |
| `display_name` | `displayName` | |
| `role` | `role` | Một trong các role trên |
| `club_id` | `clubId` | Bắt buộc cho CLUB_OWNER, PLAYER |
| `venue_id` | `venueId` | Bắt buộc cho role venue-scoped |
| `status` | `status` | `active` / `suspended` / `invited` |

Khi `VITE_RBAC_ENABLED=true`, app **bắt buộc** profile hợp lệ — không fallback `PLAYER` từ metadata.

## Permission groups

### Venue operations (VENUE_MANAGER+)
`VENUE_VIEW`, `COURTS_*`, `BOOKINGS_*`, `CUSTOMERS_*`, `REVENUE_VIEW`, `CLUB_VIEW`, `PLAYERS_VIEW`, `TOURNAMENT_*`, `SCHEDULING_*`, `STATISTICS_VIEW`, `SETTINGS_VIEW`

### Venue owner extras
`VENUE_MANAGE`, `VENUE_STAFF_MANAGE`, `VENUE_SUBSCRIPTION_VIEW`, `REVENUE_MANAGE`, `CLUB_MANAGE`, `CLUB_DELETE`, `SEASONS_MANAGE`, `LEAGUES_MANAGE`, `PLAYERS_MANAGE`, `STATISTICS_EXPORT`, `SETTINGS_MANAGE`, `SETTINGS_CLOUD_SYNC`, `PAYMENTS_*`, `ACCOUNTING_*`

### Cashier
`COURTS_VIEW`, `BOOKINGS_VIEW`, `BOOKINGS_CREATE`, `CUSTOMERS_VIEW`, `PAYMENTS_VIEW`, `PAYMENTS_COLLECT`

### Accountant
`BOOKINGS_VIEW`, `CUSTOMERS_VIEW`, `REVENUE_VIEW`, `PAYMENTS_VIEW`, `ACCOUNTING_*`, `STATISTICS_VIEW`

### Club owner
`CLUB_*`, `SEASONS_*`, `LEAGUES_*`, `PLAYERS_*`, `TOURNAMENT_*`, `SCHEDULING_*`, `STATISTICS_*`, `SETTINGS_VIEW`

### Player
`PLAYER_SCHEDULE_VIEW`, `PLAYER_REGISTRATION_MANAGE`, `PLAYER_RESULTS_VIEW`, `PLAYER_PROFILE_*`

## Scope rules

| Permission scope | Kiểm tra |
|------------------|----------|
| `venue` | `user.venueId === scope.venueId` hoặc SUPER_ADMIN |
| `club` | `user.clubId === scope.clubId` hoặc venue staff |
| `player` | `user.playerId === scope.playerId` |

## Enforcement points (client)

| Layer | File |
|-------|------|
| Route | `RouteAccessGate.jsx` + `menuAccess.js` |
| Sidebar | `Sidebar.jsx` + `filterMenuGroups()` |
| UI action | `PermissionGate.jsx` |
| Domain | `guardAction.js` (club, booking, tournament, director, cloud sync) |

## Bật RBAC production

### 1. Env

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_RBAC_ENABLED=true
```

### 2. SQL (Supabase SQL Editor)

Chạy theo thứ tự:

1. `docs/supabase-club-v3.sql` (nếu chưa có `club_data_v3`)
2. `docs/supabase-rbac.sql` — venues, subscriptions, profiles, trigger `handle_new_user`
3. `docs/supabase-club-v3-rls.sql` — RLS `club_data_v3` (staging)
4. `docs/supabase-match-live.sql` + `docs/supabase-match-live-rls.sql` (referee)
5. Checklist đầy đủ: `docs/SUPABASE-STAGING-CHECKLIST.md`

### 3. Tạo admin đầu tiên

Sau khi user đăng ký, cập nhật role trong SQL:

```sql
update public.profiles
set role = 'SUPER_ADMIN', status = 'active'
where email = 'admin@yourdomain.com';
```

### 4. Đăng nhập

`/login` — session restore đọc `profiles`; thiếu profile → từ chối đăng nhập khi RBAC bật.
