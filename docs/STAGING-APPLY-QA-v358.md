# Staging Apply & Manual QA — v3.5.8

**Mục tiêu:** Apply Supabase staging sau Security Hardening v3.5.7, kiểm thử thủ công theo role, xác nhận Vercel **Preview** (không production).

**Phạm vi:** Chỉ docs + QA. Không thêm tính năng. Không sửa Tournament Engine / Scheduler.

**Tham chiếu:** `docs/SUPABASE-STAGING-CHECKLIST.md`, `docs/RLS-TEST-PLAN.md`, `docs/RBAC-MATRIX.md`, `docs/DEPLOY.md`

---

## 1. Checklist SQL Supabase staging

### 1.1 Trước khi chạy SQL

- [ ] Tạo Supabase project **staging** (tách biệt production)
- [ ] Authentication → Providers → **Email** bật
- [ ] (Khuyến nghị staging) Tắt **Confirm email** để QA nhanh, hoặc bật và xác nhận từng user
- [ ] Ghi lại `Project URL` + `anon public key` cho Vercel Preview
- [ ] **Không** deploy production Vercel

### 1.2 Thứ tự chạy SQL (bắt buộc)

Supabase Dashboard → **SQL Editor** → chạy **từng file**, **Run** theo thứ tự:

| # | File | Mục đích |
|---|------|----------|
| 1 | `docs/supabase-club-v3.sql` | Bảng `club_data_v3` (schema cloud sync) |
| 2 | `docs/supabase-rbac.sql` | `venues`, `profiles`, helpers, RLS profiles/payments |
| 3 | `docs/supabase-club-v3-rls.sql` | Khóa `club_data_v3` theo venue/club |
| 4 | `docs/supabase-match-live.sql` | Bảng `tournament_match_live` |
| 5 | `docs/supabase-match-live-rls.sql` | RLS match live + RPC referee (v3.5.6) |
| 6 | `docs/supabase-security-hardening-v357.sql` | PLAYER signup + profile update guards (v3.5.7) |
| 7 | `docs/supabase-match-live-v2.sql` | Cột `stage_label`, `audit_log` (nếu chưa có) |

**Không** chạy `docs/supabase-rls-rollback.sql` trừ rollback khẩn cấp.

### 1.3 Bật Realtime (Director Mode)

```sql
alter publication supabase_realtime add table tournament_match_live;
```

Hoặc Dashboard → Database → Publications → `supabase_realtime` → bật `tournament_match_live`.

### 1.4 Kiểm tra RLS đã bật

Chạy SQL sau khi apply xong bước 1–6:

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

**Kỳ vọng:** mọi dòng `rls_enabled = true`.

Kiểm tra policy tồn tại:

```sql
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'club_data_v3', 'tournament_match_live', 'payment_events'
  )
group by tablename
order by tablename;
```

**Kỳ vọng:** mỗi bảng có ≥ 1 policy.

Kiểm tra RPC referee:

```sql
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('referee_get_match_by_token', 'referee_update_match_score');
```

**Kỳ vọng:** 2 hàng.

### 1.5 Tạo admin đầu tiên

1. Mở app staging (local `.env.local` hoặc Preview sau khi set env) → `/login` → **Đăng ký** `admin@staging.local`
2. Signup tạo profile role **PLAYER** (v3.5.7 — không bypass qua metadata)
3. SQL Editor (lần đầu, chưa có SUPER_ADMIN trong app):

```sql
update public.profiles
set
  role = 'SUPER_ADMIN',
  status = 'active',
  display_name = 'Admin Staging'
where email = 'admin@staging.local';
```

4. Đăng xuất → đăng nhập lại → sidebar đầy đủ quyền admin

### 1.6 Tạo venue staging

```sql
insert into public.venues (id, name, slug, status)
values
  ('venue-staging-a', 'Sân Staging A', 'venue-staging-a', 'trial'),
  ('venue-staging-b', 'Sân Staging B', 'venue-staging-b', 'trial')
on conflict (id) do nothing;
```

Venue B dùng test **cô lập dữ liệu** (user venue A không đọc được club venue B).

### 1.7 Tạo bộ tài khoản test (đăng ký + promote SQL)

**Bước A — Đăng ký qua app** (`/login` → Đăng ký), mật khẩu gợi ý staging: `PickleStaging!358`

| Email | Role DB (sau promote) | Ghi chú |
|-------|----------------------|---------|
| `admin@staging.local` | `SUPER_ADMIN` | Bước 1.5 |
| `owner@staging.local` | `VENUE_OWNER` | Chủ sân venue A |
| `manager@staging.local` | `VENUE_MANAGER` | MANAGER = `VENUE_MANAGER` trong DB |
| `cashier@staging.local` | `CASHIER` | Thu ngân venue A |
| `club@staging.local` | `CLUB_OWNER` | Chủ CLB trên venue A |
| `player@staging.local` | `PLAYER` | VĐV venue A |

**Bước B — Promote bằng SQL** (sau khi tất cả đã đăng ký):

```sql
-- VENUE_OWNER
update public.profiles
set role = 'VENUE_OWNER', venue_id = 'venue-staging-a', club_id = null,
    status = 'active', display_name = 'Owner Staging A'
where email = 'owner@staging.local';

-- VENUE_MANAGER (MANAGER)
update public.profiles
set role = 'VENUE_MANAGER', venue_id = 'venue-staging-a', club_id = null,
    status = 'active', display_name = 'Manager Staging A'
where email = 'manager@staging.local';

-- CASHIER
update public.profiles
set role = 'CASHIER', venue_id = 'venue-staging-a', club_id = null,
    status = 'active', display_name = 'Cashier Staging A'
where email = 'cashier@staging.local';

-- CLUB_OWNER
update public.profiles
set role = 'CLUB_OWNER', venue_id = 'venue-staging-a', club_id = 'club-staging-a',
    status = 'active', display_name = 'Club Owner Staging A'
where email = 'club@staging.local';

-- PLAYER
update public.profiles
set role = 'PLAYER', venue_id = 'venue-staging-a', club_id = 'club-staging-a',
    player_id = 'player-staging-a-1', status = 'active', display_name = 'Player Staging A'
where email = 'player@staging.local';
```

**Bước C — Đồng bộ `venue_id` trên cloud** (sau khi CLUB_OWNER sync CLB lên cloud):

```sql
update public.club_data_v3
set venue_id = 'venue-staging-a'
where club_id = 'club-staging-a';
```

Tạo club `club-staging-a` trong app (đăng nhập `club@` hoặc `owner@`) trước khi chạy UPDATE trên.

### 1.8 Checklist nhanh sau SQL

- [ ] RLS bật trên 6 bảng (mục 1.4)
- [ ] RPC referee tồn tại
- [ ] Realtime bật `tournament_match_live`
- [ ] SUPER_ADMIN đăng nhập OK
- [ ] 6 role test promote xong, `status = active`

---

## 2. Danh sách user test (chuẩn v3.5.8)

| # | Email | Mật khẩu (gợi ý) | Role DB | venue_id | club_id | player_id |
|---|-------|-------------------|---------|----------|---------|-----------|
| 1 | admin@staging.local | `PickleStaging!358` | SUPER_ADMIN | — | — | — |
| 2 | owner@staging.local | `PickleStaging!358` | VENUE_OWNER | venue-staging-a | — | — |
| 3 | manager@staging.local | `PickleStaging!358` | VENUE_MANAGER | venue-staging-a | — | — |
| 4 | cashier@staging.local | `PickleStaging!358` | CASHIER | venue-staging-a | — | — |
| 5 | club@staging.local | `PickleStaging!358` | CLUB_OWNER | venue-staging-a | club-staging-a | — |
| 6 | player@staging.local | `PickleStaging!358` | PLAYER | venue-staging-a | club-staging-a | player-staging-a-1 |

**Referee:** không phải user — dùng link `/referee/:token` (anon, không đăng nhập).

**Venue B (cô lập):** tạo thêm `owner-b@staging.local` + club `club-staging-b` trên `venue-staging-b` khi test cross-venue.

---

## 3. Manual QA theo role

Môi trường: Vercel **Preview** (hoặc local với cùng env staging). `VITE_RBAC_ENABLED=true`.

Cột chung: **Đăng nhập** | **Sidebar** | **Route** | **Dữ liệu đúng scope** | **Không truy cập role khác**

### 3.1 SUPER_ADMIN (`admin@`)

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Đăng nhập `/login` | OK, redirect `/` |
| Sidebar | Tổng quan, Xếp sân, Live Courts, Người chơi, Mùa giải, Giải đấu, Kết quả, CLB & Giải, Cài đặt |
| Route `/`, `/players`, `/court-management`, `/select-players`, `/club`, `/settings` | Vào được |
| Cloud sync Cài đặt | Pull/push club bất kỳ |
| SQL `select * from profiles` (authenticated) | Thấy mọi profile |
| Đổi role user khác (Cài đặt → Nhân sự) | OK (chỉ SUPER_ADMIN) |

### 3.2 VENUE_OWNER (`owner@`)

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Đăng nhập | OK |
| Sidebar | Người chơi, Xếp sân, Live Courts, CLB & Giải, Cài đặt |
| Route | `/`, `/players`, `/court-management`, `/select-players`, `/settings` OK |
| Tạo CLB mới | OK |
| Cloud sync club venue A | OK |
| Pull club `venue-staging-b` | Từ chối / empty |
| Không vào route admin hệ thống ngoài scope | Không bypass SUPER_ADMIN actions |

### 3.3 VENUE_MANAGER / MANAGER (`manager@`)

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Đăng nhập | OK |
| Sidebar | Xếp sân, Người chơi, Live Courts, Giải đấu — **không** Cài đặt manage-only đầy đủ |
| Route | `/`, `/players`, `/court-management`, `/select-players` OK |
| Route `/settings` | Chỉ xem nếu có `SETTINGS_VIEW`; không cloud sync / staff manage như OWNER |
| Push cloud sync ghi club | Theo quyền MANAGER (ghi nếu policy cho phép) |
| Route `/court-management/revenue` | Từ chối (không ACCOUNTANT) |

### 3.4 CASHIER (`cashier@`)

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Đăng nhập | Redirect `/court-management/bookings` |
| Sidebar | Chỉ **Live Courts** (bookings) |
| Route `/court-management/bookings` | OK |
| Route `/players`, `/select-players`, `/club` | Từ chối (Access denied / redirect) |
| Tạo booking | OK |
| Xóa booking / revenue | Từ chối |
| Pull club (read) venue A | OK nếu venue khớp |
| Push sync ghi club | Từ chối |

### 3.5 CLUB_OWNER (`club@`)

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Đăng nhập | OK |
| Sidebar | CLB & Giải, Danh sách giải, Xếp sân — **không** Live Courts |
| Route `/club`, `/tournament`, `/select-players` | OK |
| Route `/court-management/revenue` | Từ chối |
| Director Mode `/tournament/director/:id` | OK (JWT session) |
| Pull club `club-staging-a` | OK |
| Pull club `club-staging-b` | Từ chối |

### 3.6 PLAYER (`player@`)

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Đăng nhập | Redirect `/tournament` |
| Sidebar | Danh sách giải, Sơ đồ, Kết quả, Hồ sơ cá nhân (nhóm VĐV) |
| Route `/statistics`, `/tournament` | OK |
| Route `/players` (quản lý) | Từ chối |
| Route `/settings` cloud sync | Từ chối ghi |
| Chỉ thấy dữ liệu CLB `club-staging-a` | OK |

---

## 4. Kiểm tra bảo mật v3.5.7 (bắt buộc)

### 4.1 Director Mode — JWT thật

**Người thực hiện:** `club@` hoặc `owner@` (có `TOURNAMENT_DIRECTOR` / manage)

- [ ] Tạo giải → vào **Director Mode**
- [ ] Gán trận lên sân → upsert `tournament_match_live` thành công (không lỗi RLS)
- [ ] DevTools → Network: request Supabase dùng **Bearer JWT** (session user), không phải anon key thuần cho upsert
- [ ] Realtime: điểm cập nhật trên board Director (authenticated channel)
- [ ] Preview build: **không** có `RbacDevPanel`, **không** dev login bypass

### 4.2 Referee link — RPC

- [ ] Director copy link trọng tài → mở `/referee/:token` (incognito, không login)
- [ ] Thấy đúng 1 trận
- [ ] Đổi token sai → không thấy trận
- [ ] DevTools: gọi `referee_get_match_by_token` / `referee_update_match_score`, **không** REST `GET tournament_match_live?select=*`
- [ ] SQL: `select referee_get_match_by_token('token-đúng-dài-≥16')` → 1 JSON, không lộ `club_id`
- [ ] Preview: **không** fallback direct-table (chỉ RPC)

### 4.3 Signup mới chỉ PLAYER

- [ ] Đăng ký `newuser@staging.local` qua app
- [ ] SQL: `select role from profiles where email = 'newuser@staging.local'` → `PLAYER`
- [ ] Thử signup với metadata role (nếu test API): vẫn `PLAYER` (trigger v3.5.7)

### 4.4 User không tự sửa role / venue / club / status

Đăng nhập `player@`, thử (SQL Editor giả lập user hoặc API):

```sql
-- Phải FAIL với exception "Cannot modify protected profile fields"
update public.profiles
set venue_id = 'venue-staging-b'
where email = 'player@staging.local';

-- Phải FAIL "Only SUPER_ADMIN can change profile role"
update public.profiles
set role = 'SUPER_ADMIN'
where email = 'player@staging.local';
```

Trong app Cài đặt: user chỉ sửa được `display_name` / `player_id`.

### 4.5 `VITE_RBAC_ENABLED=true`

- [ ] Chưa đăng nhập: sidebar chỉ **Cài đặt**; route khác redirect `/login`
- [ ] User không có profile (xóa row thủ công): login từ chối
- [ ] `status = suspended`: login từ chối / không permission
- [ ] Unit: `npm run test:unit` — 410 tests pass (đã verify local)

---

## 5. Vercel Preview env

Vercel → Project → Settings → Environment Variables → scope **Preview** (không Production):

| Biến | Giá trị staging | Kiểm tra |
|------|-----------------|----------|
| `VITE_SUPABASE_URL` | URL project staging | Khớp Supabase Dashboard |
| `VITE_SUPABASE_ANON_KEY` | Anon key staging | Khớp Dashboard → API |
| `VITE_RBAC_ENABLED` | `true` | Build log / app yêu cầu login |
| `VITE_SEED_DEMO` | `false` | Không auto seed ~60 VĐV |
| `VITE_PAYMENT_MODE` | `dev` | Nâng cấp gói local, không Stripe |

Sau khi set env: **Redeploy Preview** (env Vite chỉ inject lúc build).

Smoke Preview URL:

- [ ] `/login` hiện form Supabase (không dev registry)
- [ ] `admin@` đăng nhập OK
- [ ] Không thấy panel dev RBAC trong Cài đặt

---

## 6. Unit tests (trước Preview)

```powershell
cd C:\Users\LePhong\pickleball-scheduler
npm run test:unit
```

Bao gồm: `tests/rls-access.test.js`, `tests/referee-rpc-security.test.js`, `tests/security-hardening.test.js`, `tests/rbac.test.js`.

---

## 7. Go / No-Go — Vercel Preview

### Điều kiện Go

| # | Tiêu chí | Trạng thái |
|---|----------|------------|
| G1 | SQL staging chạy đủ thứ tự 1→7 | ☐ Manual |
| G2 | RLS bật 6 bảng + RPC referee | ☐ Manual |
| G3 | 6 user test + SUPER_ADMIN promote | ☐ Manual |
| G4 | Realtime `tournament_match_live` | ☐ Manual |
| G5 | Preview env 5 biến đúng (mục 5) | ☐ Manual |
| G6 | QA role §3 pass (6 role) | ☐ Manual |
| G7 | Security §4 pass (Director JWT, Referee RPC, signup, profile guard) | ☐ Manual |
| G8 | `npm run test:unit` pass | ✅ 410/410 (local) |

**Go khi:** G1–G7 đều tick ✅.

### Blocker No-Go (nếu gặp)

| Blocker | Triệu chứng | Cách xử lý |
|---------|-------------|------------|
| SQL thiếu / sai thứ tự | RLS off, RPC missing | Chạy lại checklist §1.2 |
| Chưa promote SUPER_ADMIN | Không ai đổi role | SQL §1.5 |
| `venue_id` null trên `club_data_v3` | Pull/push từ chối | Sync CLB + UPDATE §1.7C |
| Referee anon select | Lộ toàn bộ match live | Chạy lại `supabase-match-live-rls.sql` |
| Preview thiếu env | Dev login / seed demo / RBAC off | Set env §5 + redeploy |
| Director RLS fail | Upsert match live 401/403 | Đăng nhập JWT; kiểm tra `club_id` scope |
| Signup không PLAYER | Role escalation | Chạy `supabase-security-hardening-v357.sql` |
| User tự đổi role | Escalation | Kiểm tra trigger `profiles_guard_privileged_update` |

### Quyết định hiện tại (trước khi QA thủ công)

| Hạng mục | Kết luận |
|----------|----------|
| Code + unit tests | **Go** (410/410) |
| Supabase staging apply | **Chưa xác nhận** — cần operator chạy §1 |
| Vercel Preview deploy | **Conditional Go** — deploy Preview sau G1–G5; **No-Go production** |

**Không deploy production** cho đến khi staging QA §3–§4 pass và ghi nhận trong checklist này.

---

## 8. Rollback

1. `docs/supabase-rls-rollback.sql` — khôi phục anon-open (chỉ staging khẩn)
2. Hoặc xóa project staging → tạo lại → chạy lại §1
3. Tạm `VITE_RBAC_ENABLED=false` trên Preview nếu cần unblock (không khuyến nghị)

---

## 9. Ghi nhận QA (điền khi hoàn tất)

| Ngày | Người QA | Preview URL | G1–G7 | Quyết định |
|------|----------|-------------|-------|------------|
| | | | | Go / No-Go |
