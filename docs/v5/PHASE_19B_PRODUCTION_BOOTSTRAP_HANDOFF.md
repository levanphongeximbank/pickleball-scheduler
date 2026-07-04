# Phase 19B — Production Bootstrap Handoff (Tenant / Venue / Owner)

**Ngày:** 2026-07-04  
**Supabase Production:** `pickleball-scheduler-production` / `expuvcohlcjzvrrauvud`  
**Tiền đề:** Migrations SQL **#1–#22 PASS**; `public.venues = 0`; env flags vẫn OFF (xem § Env).  
**Ràng buộc:** Agent **không** chạy SQL Production. Owner review → apply thủ công.  
**Không chạy:** `supabase-staging-phase16-kn6-seed.sql`, `supabase-billing-phase9-staging-seed-minimal.sql`, `supabase-billing-phase10e-staging-tenant-align.sql` (staging-only).

---

## Tóm tắt

| Hạng mục | Trạng thái / hành động |
|----------|-------------------------|
| Schema migrations #1–#22 | ✅ PASS (owner confirmed) |
| `public.venues` | **0 rows** — cần bootstrap 1 venue production |
| Owner `auth.users` + `profiles` | ⏳ **Owner xác định** qua §0 Discovery (email **không** hard-code trong repo) |
| Role khuyến nghị | **`COURT_OWNER`** (canonical v4; trial RPC #17 chấp nhận `COURT_OWNER` / `VENUE_OWNER` / `CLUB_OWNER`) |
| Trial subscription | Gọi **`billing_create_trial_subscription`** từ app (owner JWT) — **không** insert trực tiếp |
| `VITE_BILLING_SUPABASE=true` | ✅ **Sau** bootstrap + verify — **Preview trước**, Production sau Preview PASS |
| `VITE_API_ENABLED` / `API_KEY_STORE=supabase` | ⛔ Giữ OFF Production; Preview QA riêng trước khi cân nhắc |
| Dữ liệu hiện có | DB mới post-migration — bootstrap **additive**; không DELETE/DROP |

**Thứ tự owner:**

1. §0 Discovery → xác định email/UUID owner  
2. (Nếu chưa có user) Đăng ký qua app Production `/login`  
3. §1 SQL bootstrap (venue + profile + `venues.owner_id`)  
4. §2 SQL verify (structural)  
5. §3 Trial qua app `/billing`  
6. §4 Functional verify (JWT / RLS smoke)  
7. §6 Env recommendation → Preview QA → Production

---

## Schema thật (Production post #1–#22)

### `public.venues`

| Cột | Kiểu | NOT NULL | Default | Ghi chú |
|-----|------|----------|---------|---------|
| `id` | text | ✅ PK | — | `tenant_id` app = `venues.id` |
| `name` | text | ✅ | — | Tên hiển thị |
| `slug` | text | ✅ UNIQUE | — | URL-safe, unique |
| `owner_id` | uuid | — | null | FK → `auth.users(id)` ON DELETE SET NULL |
| `timezone` | text | ✅ | `Asia/Ho_Chi_Minh` | |
| `status` | text | ✅ | `trial` | CHECK: `active`, `inactive`, `trial`, `suspended` (sprint2) |
| `subscription_id` | text | — | null | Legacy sprint4 — optional |
| `note` | text | — | `''` | |
| `created_at` | timestamptz | ✅ | `now()` | |
| `updated_at` | timestamptz | ✅ | `now()` | |

### `public.profiles`

| Cột | Kiểu | NOT NULL | Default | Ghi chú |
|-----|------|----------|---------|---------|
| `id` | uuid | ✅ PK | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text | ✅ | — | |
| `display_name` | text | — | `''` | |
| `role` | text | ✅ | — | CHECK (identity #8): `SUPER_ADMIN`, `VENUE_OWNER`, `VENUE_MANAGER`, `COURT_OWNER`, `COURT_MANAGER`, `CASHIER`, `ACCOUNTANT`, `REFEREE`, `CLUB_OWNER`, `PLAYER` |
| `venue_id` | text | — | null | FK → `venues(id)` ON DELETE **SET NULL** |
| `club_id` | text | — | null | |
| `player_id` | text | — | null | |
| `status` | text | ✅ | `active` | CHECK: `active`, `suspended`, `invited` |
| `phone` | text | — | `''` | identity #8 |
| `avatar_url` | text | — | `''` | identity #8 |
| `created_at` | timestamptz | ✅ | `now()` | |
| `updated_at` | timestamptz | ✅ | `now()` | |

**Trigger v3.5.7:** User authenticated **không** tự đổi `role`, `venue_id`, `club_id`, `status`. SQL Editor chạy với `postgres` / `service_role` **bypass** guard → dùng cho bootstrap lần đầu.

**Signup:** `handle_new_user()` tạo profile `role = PLAYER`, `status = active` (không đọc metadata role).

### Alignment model

```
auth.users.id = profiles.id
profiles.venue_id = venues.id = tenant_subscriptions.tenant_id
qr_tokens.tenant_id = checkins.tenant_id = profiles.venue_id
```

---

## §0 — Discovery (chạy trước bootstrap)

**Mục đích:** Xác định owner production — repo **không** ghi email production cố định.

```sql
-- 0.1 auth.users
select
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
from auth.users
order by created_at;

-- 0.2 profiles
select
  p.id,
  p.email,
  p.role,
  p.venue_id,
  p.status,
  p.display_name,
  p.created_at
from public.profiles p
order by p.email;

-- 0.3 venues (expect 0 trước bootstrap)
select id, name, slug, owner_id, status from public.venues;

-- 0.4 plans seed (expect 4 từ migration #16)
select code, name, is_active from public.plans order by sort_order;
```

### Bảng điền (owner)

| Câu hỏi | Giá trị (owner điền sau §0) |
|---------|----------------------------|
| Email owner production | `________________________` |
| `auth.users.id` | `________________________` |
| User đã có trong `auth.users`? | ☐ Có / ☐ Chưa — đăng ký `/login` trước |
| Profile đã có? | ☐ Có (`PLAYER`) / ☐ Chưa (trigger tạo sau signup) |
| Venue `id` chọn | `________________________` (vd. `venue-prod-main`) |

**Nếu chưa có user:** Mở app (Preview hoặc Production URL) → `/login` → **Đăng ký** → xác nhận email (nếu bật confirmation) → chạy lại §0.

**SUPER_ADMIN (tùy chọn, khác owner tenant):** Nếu cần platform admin, promote riêng sau bootstrap owner:

```sql
-- Thay OWNER_EMAIL — chỉ nếu account khác với COURT_OWNER tenant
-- update public.profiles
-- set role = 'SUPER_ADMIN', status = 'active', display_name = 'Platform Admin'
-- where email = 'OWNER_EMAIL';
```

---

## §1 — SQL Apply (bootstrap)

**File tham chiếu an toàn:** pattern từ `docs/SUPABASE-STAGING-CHECKLIST.md` (đã adapt production).  
**Placeholder owner thay trước khi Run:**

- `OWNER_EMAIL` — email từ §0  
- `OWNER_USER_UUID` — `auth.users.id` từ §0  
- `VENUE_ID` — id production (vd. `venue-prod-main`) — **không** dùng `tenant-demo`, `venue-staging*`

```sql
-- =============================================================================
-- Phase 19B Production Bootstrap — idempotent, additive only
-- Project: expuvcohlcjzvrrauvud
-- Chạy: Supabase Dashboard → pickleball-scheduler-production → SQL Editor
-- =============================================================================

begin;

-- Snapshot trước khi sửa (owner lưu kết quả)
select 'pre_bootstrap_profiles' as snap, p.*
from public.profiles p
where p.email = 'OWNER_EMAIL';

select 'pre_bootstrap_venues' as snap, v.* from public.venues v;

-- ─── 1) Venue production (1 row) ───────────────────────────────────────────
insert into public.venues (
  id,
  name,
  slug,
  owner_id,
  timezone,
  status,
  note
)
values (
  'VENUE_ID',
  'Pickleball Scheduler Production',  -- đổi tên CLB/sân thật
  'pickleball-prod-main',             -- slug unique, lowercase-hyphen
  'OWNER_USER_UUID'::uuid,
  'Asia/Ho_Chi_Minh',
  'trial',
  'Production bootstrap 2026-07-04'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  owner_id = coalesce(public.venues.owner_id, excluded.owner_id),
  status = excluded.status,
  updated_at = now();

-- ─── 2) Profile owner — role + venue_id ────────────────────────────────────
-- Guard: chỉ update nếu profile tồn tại (user đã signup)
update public.profiles
set
  role = 'COURT_OWNER',
  venue_id = 'VENUE_ID',
  status = 'active',
  display_name = coalesce(nullif(trim(display_name), ''), 'Production Owner'),
  updated_at = now()
where id = 'OWNER_USER_UUID'::uuid
  and email = 'OWNER_EMAIL';

-- Fail-safe: báo nếu không có profile
do $$
begin
  if not exists (
    select 1 from public.profiles where id = 'OWNER_USER_UUID'::uuid
  ) then
    raise exception 'PROFILE_MISSING: user chưa signup — tạo auth.users trước, rồi chạy lại';
  end if;
end $$;

-- ─── 3) Đồng bộ venues.owner_id (idempotent) ───────────────────────────────
update public.venues
set owner_id = 'OWNER_USER_UUID'::uuid, updated_at = now()
where id = 'VENUE_ID';

commit;
```

**Không làm trong bootstrap:**

- Không `DELETE` / `TRUNCATE`  
- Không insert `club_data_v3` demo  
- Không insert `tenant_subscriptions` trực tiếp (dùng RPC §3)  
- Không hard-code staging email/venue id

---

## §2 — SQL Verify (structural — SQL Editor)

```sql
-- V1 — Đúng 1 venue
select count(*) as venue_count from public.venues;
-- expect: 1

select id, name, slug, owner_id, status
from public.venues
where id = 'VENUE_ID';

-- V2 — Profile alignment
select
  p.id,
  p.email,
  p.role,
  p.venue_id,
  p.status,
  v.id as matched_venue,
  v.owner_id as venue_owner_id,
  case
    when p.venue_id = v.id and p.role in ('COURT_OWNER', 'VENUE_OWNER', 'CLUB_OWNER') then 'ok'
    else 'MISALIGNED'
  end as alignment
from public.profiles p
left join public.venues v on v.id = p.venue_id
where p.email = 'OWNER_EMAIL';

-- V3 — View tenants
select * from public.tenants where id = 'VENUE_ID';

-- V4 — Orphan check
select p.email, p.venue_id
from public.profiles p
left join public.venues v on v.id = p.venue_id
where p.venue_id is not null and v.id is null;

-- V5 — Plans ready for trial RPC
select code from public.plans where code = 'TRIAL' and is_active = true;
-- expect: 1 row

-- V6 — Trial RPC exists (#17)
select proname from pg_proc where proname = 'billing_create_trial_subscription';

-- V7 — KN-6 policies (không USING true)
select tablename, policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename, policyname;
```

**Lưu ý:** `user_role()` và `user_venue_id()` trả `NULL` trong SQL Editor (không có JWT). Verify functional ở §4.

---

## §3 — Trial subscription (RPC #17)

**Không gọi RPC trong SQL Editor thuần** — `billing_create_trial_subscription` yêu cầu `auth.uid()` authenticated.

**Cách đúng (khuyến nghị):**

1. Deploy Preview (hoặc Production) với `VITE_BILLING_SUPABASE=true` tạm **chỉ Preview**  
2. Login owner (`COURT_OWNER`)  
3. Mở `/billing` — app gọi RPC hoặc nút tạo trial (nếu SUPER_ADMIN)  
4. Verify:

```sql
select
  ts.id,
  ts.tenant_id,
  ts.plan_id,
  ts.status,
  ts.trial_start_date,
  ts.trial_end_date
from public.tenant_subscriptions ts
where ts.tenant_id = 'VENUE_ID'
order by ts.created_at desc
limit 1;
-- expect: plan_id = 'plan-TRIAL', status = 'trialing'

select event_type, metadata
from public.billing_events
where tenant_id = 'VENUE_ID'
order by created_at desc
limit 3;
```

RPC idempotent: gọi lại trả subscription hiện có (không duplicate).

---

## §4 — Functional verify (JWT / RLS smoke)

Chạy **sau** bootstrap + trial. Dùng Preview URL + owner login, hoặc script local với Production anon key.

| # | Kiểm tra | Cách | Kỳ vọng |
|---|----------|------|---------|
| F1 | `user_venue_id()` | App: owner login → Network tab RPC hoặc `scripts/verify-billing-phase9-staging.mjs` (đổi URL → prod) | = `VENUE_ID` |
| F2 | `user_role()` | Cùng session | = `COURT_OWNER` |
| F3 | `/billing` | Owner browser | Plan TRIAL visible; không `no_subscription` |
| F4 | `/court-engine` | Owner | Load OK |
| F5 | QR RLS | Owner tạo QR token (mobile ops) | INSERT `qr_tokens` với `tenant_id = VENUE_ID` OK |
| F6 | Cross-tenant block | (Optional) 2nd test account venue khác | Không đọc QR tenant A |
| F7 | API OFF | `GET /api/v1/health` | 503 / feature_disabled khi `VITE_API_ENABLED=false` |
| F8 | Anon QR | Không JWT | Không select `qr_tokens` (KN-6) |

**Script optional (owner creds, adapt staging guards):**

- `scripts/verify-billing-phase9-staging.mjs`  
- `scripts/verify-phase16-kn6-rls-staging.mjs` (đổi ref hoặc dùng queries V7)

---

## §5 — Rollback bootstrap

Chỉ khi bootstrap **sai venue id / sai user**. Lưu output §0 + `pre_bootstrap_*` trước khi apply.

### 5.1 Rollback trial only (an toàn nhất)

```sql
delete from public.billing_audit_logs
where tenant_id = 'VENUE_ID'
  and metadata->>'source' = 'billing_create_trial_subscription';

delete from public.billing_events
where tenant_id = 'VENUE_ID'
  and event_type = 'TrialStarted';

delete from public.tenant_subscriptions
where tenant_id = 'VENUE_ID' and status = 'trialing';
```

### 5.2 Rollback profile về trước bootstrap

```sql
-- Khôi phục từ snapshot owner đã lưu (vd. role=PLAYER, venue_id=null)
update public.profiles
set
  role = 'PLAYER',           -- hoặc giá trị pre_bootstrap
  venue_id = null,           -- hoặc giá trị pre_bootstrap
  display_name = '',         -- tùy snapshot
  updated_at = now()
where id = 'OWNER_USER_UUID'::uuid;
```

### 5.3 Rollback venue (⚠️ cascade)

**Cảnh báo:** `DELETE FROM venues WHERE id = 'VENUE_ID'` cascade xóa (nếu đã có data):

| Bảng / quan hệ | ON DELETE |
|----------------|-----------|
| `subscriptions` (legacy) | CASCADE |
| `tenant_subscriptions` | CASCADE |
| `invoices`, `invoice_items`, `payments` | CASCADE |
| `billing_events`, `billing_audit_logs` | CASCADE |
| `payment_events` | CASCADE |
| `api_clients`, `api_keys`, `api_logs`, … (sprint10) | CASCADE |
| `tenant_integration_settings`, `integration_audit_logs` | CASCADE |
| `webhook_endpoints` | CASCADE |
| `profiles.venue_id` | **SET NULL** (profile giữ, mất venue link) |

```sql
-- Chỉ khi chắc chắn — venue mới bootstrap, chưa có club/tournament prod
delete from public.venues where id = 'VENUE_ID';
```

Sau xóa venue: profile owner vẫn tồn tại nhưng `venue_id` → NULL (FK set null).

---

## §6 — Env recommendation

### Sau bootstrap — thứ tự bật flag

| Bước | Môi trường | Biến | Giá trị | Điều kiện |
|------|------------|------|---------|-----------|
| 1 | **Preview** | `VITE_BILLING_SUPABASE` | `true` | Bootstrap §1–2 PASS + trial §3 |
| 2 | **Preview** | `VITE_RBAC_ENABLED` | `true` | Đã có |
| 3 | **Preview** | `VITE_PAYMENT_MODE` | `dev` | RC1 |
| 4 | **Preview** | `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` | RC1 |
| 5 | Preview QA PASS → **Production** | `VITE_BILLING_SUPABASE` | `true` | §4 F1–F3 PASS |
| 6 | Production | Giữ OFF | `VITE_API_ENABLED=false` | RC1 |
| 6 | Production | Giữ OFF | `VITE_MARKETPLACE_ENABLED=false` | RC1 |
| 6 | Production | Giữ | `API_KEY_STORE=memory` / unset | API OFF |
| 6 | Production | Giữ | `AUDIT_STORE=memory` / unset | API OFF |
| 6 | Production | Giữ | `VITE_INTEGRATIONS_*` local/unset | RC1 |

**Redeploy** sau mỗi đổi env (Preview trước, Production sau).

### Preview QA — billing (`VITE_BILLING_SUPABASE=true`)

| Màn / flow | Role | Reference |
|------------|------|-----------|
| `/billing` | COURT_OWNER | Plan TRIAL, usage limits |
| `/billing/invoices` | COURT_OWNER | Read-only list |
| Subscription gate | COURT_OWNER | Không false lock khi trialing |
| `/admin/billing` | SUPER_ADMIN (nếu có) | Suspend/unlock smoke |

### Preview QA — API (`VITE_API_ENABLED=true` + `API_KEY_STORE=supabase`)

⛔ **Không bật Production** trước Preview PASS.

| Kiểm tra | Kỳ vọng |
|----------|---------|
| `VITE_INTEGRATIONS_SUPABASE=true` + `VITE_INTEGRATIONS_STORE_MODE=supabase` | Settings persist Supabase |
| API key create/revoke | `api_keys` row scoped `tenant_id` |
| `GET /api/v1/health` | 200 khi API ON |
| Cross-tenant API key | 403 / empty |
| Integration audit | `integration_audit_logs` ghi nhận |
| Rollback nhanh | `VITE_API_ENABLED=false` + redeploy |

---

## PASS checklist (owner tick)

### Pre-bootstrap

- [ ] Migrations #1–#22 CONFIRMED trên `expuvcohlcjzvrrauvud`
- [ ] §0 Discovery hoàn tất; email + UUID ghi vào bảng §0
- [ ] Owner đã signup + profile tồn tại (`PLAYER`)
- [ ] Placeholder SQL đã thay (`OWNER_EMAIL`, `OWNER_USER_UUID`, `VENUE_ID`)

### Bootstrap apply

- [ ] §1 SQL chạy success (transaction commit)
- [ ] V1: `venues` count = 1
- [ ] V2: `profiles.venue_id` = `venues.id`, role = `COURT_OWNER`
- [ ] V3–V7 structural PASS
- [ ] §3 Trial tạo qua app; `tenant_subscriptions` status `trialing`

### Functional

- [ ] F1–F3: JWT helpers + `/billing` OK
- [ ] F5–F6: QR RLS tenant-scoped (nếu test mobile)
- [ ] F7: API health disabled khi flag OFF

### Env

- [ ] Preview: `VITE_BILLING_SUPABASE=true` + QA billing PASS
- [ ] Production: `VITE_BILLING_SUPABASE=true` **sau** Preview PASS
- [ ] `VITE_API_ENABLED` vẫn `false` Production RC1
- [ ] Redeploy documented

### Safety

- [ ] Không chạy staging seed files
- [ ] Snapshot `pre_bootstrap_*` đã lưu
- [ ] Không ảnh hưởng data khác (DB hiện chỉ schema + seed plans)

---

## Xác nhận — không ảnh hưởng Production hiện có

| Khía cạnh | Đánh giá |
|-----------|----------|
| Migrations #1–#22 | Đã apply — bootstrap **không** re-run migration |
| Dữ liệu user khác | Bootstrap chỉ `UPDATE` 1 profile + `INSERT` 1 venue — không đụng user khác |
| Plan seed (#16) | `ON CONFLICT DO NOTHING` — bootstrap không sửa |
| `club_data_v3` / tournaments | Không tạo trong bootstrap — zero impact |
| Staging project | SQL chạy **chỉ** `expuvcohlcjzvrrauvud` |

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `docs/v5/PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` | Migrations #1–#22 |
| `docs/v5/PHASE_19A_PRODUCTION_PREFLIGHT.md` | ENV checklist |
| `docs/SUPABASE-STAGING-CHECKLIST.md` | Pattern gán role/venue (staging) |
| `docs/supabase-billing-phase9-trial-rpc.sql` | RPC #17 |
| `docs/v5/PHASE_18_PRODUCTION_READINESS.md` | Smoke S1–S10, env diff |

**Owner signature (bootstrap complete):** ________________ **Date:** __________
