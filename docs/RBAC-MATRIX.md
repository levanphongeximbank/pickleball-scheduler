# RBAC Permission Matrix — v3.5.0

Ma trận quyền production. Nguồn code: `src/auth/rolePermissions.js`, `src/auth/permissions.js`.

## Roles

| Role | Phạm vi |
|------|---------|
| `SUPER_ADMIN` | Toàn hệ thống |
| `VENUE_OWNER` | Chủ sân / tenant |
| `VENUE_MANAGER` | Quản lý vận hành sân |
| `CASHIER` | Thu ngân |
| `ACCOUNTANT` | Kế toán |
| `CLUB_OWNER` | Chủ CLB trong venue |
| `PLAYER` | VĐV (self-service) |

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

## Bật RBAC

```env
VITE_RBAC_ENABLED=true
```

Chạy SQL: `docs/supabase-rbac.sql` + `docs/supabase-club-v3-rls.sql`

Đăng nhập: `/login` hoặc **Cài đặt → Đăng nhập & Phân quyền**
