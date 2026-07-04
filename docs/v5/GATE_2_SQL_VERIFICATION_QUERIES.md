# Gate 2 — SQL Verification Queries

**Project:** Production `expuvcohlcjzvrrauvud` only  
**Cách dùng:** Supabase Dashboard → SQL Editor → New query → paste → Run  
**Ngày:** 2026-07-04

Mỗi query có **Kỳ vọng**. Nếu không khớp → **FAIL** — dừng apply, báo engineering.

---

## Venue count (ghi nhận trước V21/C functional)

```sql
select count(*) as venue_count from public.venues;
```

| Kết quả | Ý nghĩa |
|---------|---------|
| `0` | Functional JWT/mobile QR E2E **SKIP** — schema checks vẫn bắt buộc |
| `> 0` | Có thể chạy thêm functional probe (optional, sau Gate 2) |

---

## Batch A — sau migration #15

### A1. RLS enabled

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

**Kỳ vọng:** Mọi dòng `rls_enabled = true`.

---

### A2. Bảng Sprint 7–10 tồn tại

```sql
select tablename from pg_tables
where schemaname = 'public'
and tablename in (
  'ai_suggestions', 'push_subscriptions', 'notifications',
  'qr_tokens', 'checkins', 'api_clients', 'api_keys', 'api_logs',
  'marketplace_products', 'marketplace_orders', 'payment_transactions',
  'notification_logs', 'webhook_events'
)
order by tablename;
```

**Kỳ vọng:** 13 dòng (13 bảng).

---

### A3. Sprint 10 — tenant_id kiểu text

```sql
select c.table_name, c.column_name, c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'api_clients', 'api_keys', 'api_logs',
    'marketplace_products', 'marketplace_orders', 'payment_transactions',
    'notification_logs', 'webhook_events'
  )
  and c.column_name = 'tenant_id'
order by c.table_name;
```

**Kỳ vọng:** Mọi dòng `data_type = text` (8 dòng).

---

### A4. RPC Identity & Referee

```sql
select proname from pg_proc
where proname in (
  'referee_get_match_by_token',
  'referee_update_match_score',
  'identity_list_users',
  'identity_admin_update_user',
  'identity_list_audit_logs'
)
order by proname;
```

**Kỳ vọng:** 5 dòng.

---

### A5. View tenants + subscription columns

```sql
select * from public.tenants limit 3;

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'subscriptions'
and column_name in ('auto_renew', 'locked_at', 'last_renewed_at');
```

**Kỳ vọng:** Query 1 chạy không lỗi (0–3 rows OK). Query 2 trả 3 cột.

---

## Batch A — spot check giữa batch (optional)

### Spot — sau #1 (club tables)

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('club_data_v3', 'club_ai_data')
order by tablename;
```

**Kỳ vọng:** 2 bảng.

---

### Spot — sau #14 (mobile tables — prerequisite #22)

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename;
```

**Kỳ vọng:** 2 bảng.

---

## Batch B — sau #16–#20

### B1. Billing tables

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans', 'plan_limits', 'tenant_subscriptions', 'invoices',
    'invoice_items', 'payments', 'billing_events', 'billing_audit_logs'
  )
order by table_name;
```

**Kỳ vọng:** 8 bảng.

---

### B2. Plan seed

```sql
select code, name, is_active from public.plans
where code in ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')
order by sort_order;
```

**Kỳ vọng:** 4 dòng.

---

### B3. Trial RPC

```sql
select proname, proargnames
from pg_proc
where proname = 'billing_create_trial_subscription';
```

**Kỳ vọng:** 1 dòng.

---

### B4. Phase 11 tables + api_keys.expires_at

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'webhook_endpoints', 'tenant_integration_settings', 'integration_audit_logs'
  )
order by tablename;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'api_keys'
  and column_name = 'expires_at';
```

**Kỳ vọng:** 3 bảng RLS enabled; 1 cột `expires_at`.

---

## Migration #21 — V21-1 → V21-8 (bắt buộc trước #22)

### V21-1. Schema columns

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'integration_audit_logs'
  and column_name in (
    'request_id', 'tenant_id', 'api_client_id', 'api_key_id', 'key_prefix',
    'event_type', 'route', 'method', 'status_code', 'result_code',
    'scope_required', 'scopes_granted', 'metadata', 'created_at'
  )
order by column_name;
```

**Kỳ vọng:** 14 cột; `event_type` NOT NULL; `created_at` NOT NULL.

---

### V21-2. Legacy nullable (nếu upgrade từ 11B)

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'integration_audit_logs'
  and column_name in ('action', 'meta')
order by column_name;
```

**Kỳ vọng:** Nếu cột tồn tại → `is_nullable = YES`. Nếu không có cột → OK (fresh install).

---

### V21-3. Indexes 11E

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'integration_audit_logs'
  and indexname in (
    'integration_audit_logs_created_at_idx',
    'integration_audit_logs_tenant_created_at_idx',
    'integration_audit_logs_request_id_idx',
    'integration_audit_logs_event_created_at_idx',
    'integration_audit_logs_key_prefix_created_at_idx'
  )
order by indexname;
```

**Kỳ vọng:** 5 indexes.

---

### V21-4. RLS enabled + policies

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'integration_audit_logs';

select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'integration_audit_logs'
order by policyname;
```

**Kỳ vọng:** `rowsecurity = true`; có policies `integration_audit_logs_select`, `integration_audit_logs_insert`, `integration_audit_logs_manage_admin` (hoặc tương đương tenant-scoped).

---

### V21-5. Comments

```sql
select obj_description('public.integration_audit_logs'::regclass) as table_comment;

select
  pol.polname as policy_name,
  pg_catalog.obj_description(pol.oid, 'pg_policy') as policy_comment
from pg_policy pol
join pg_class cls on pol.polrelid = cls.oid
join pg_namespace nsp on cls.relnamespace = nsp.oid
where nsp.nspname = 'public'
  and cls.relname = 'integration_audit_logs';
```

**Kỳ vọng:** Table comment chứa `Phase 11E`; ít nhất 1 policy có comment (nếu SQL đã apply đầy đủ).

---

### V21-6. Backfill OK (no null event_type)

```sql
select count(*) as null_event_type_count
from public.integration_audit_logs
where event_type is null;
```

**Kỳ vọng:** `0`.

---

### V21-7. Regression #15–#20

```sql
-- Billing intact
select count(*) as billing_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans', 'tenant_subscriptions', 'api_clients', 'api_keys',
    'tenant_integration_settings', 'webhook_endpoints'
  );

-- Sprint 10 tenant_id still text
select count(*) as text_tenant_cols
from information_schema.columns
where table_schema = 'public'
  and table_name = 'api_clients'
  and column_name = 'tenant_id'
  and data_type = 'text';
```

**Kỳ vọng:** `billing_table_count = 6`; `text_tenant_cols = 1`.

---

### V21-8. No raw API key columns

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'integration_audit_logs'
  and column_name in (
    'api_key', 'raw_api_key', 'hashed_key', 'secret', 'api_key_secret'
  );
```

**Kỳ vọng:** 0 dòng (chỉ `key_prefix` được phép, không lưu full key).

---

## Migration #22 — C0 → C7 (chỉ sau V21 PASS)

### C0. Functions + tables

```sql
select proname from pg_proc
where proname in ('user_venue_id', 'is_super_admin')
order by proname;

select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename;
```

**Kỳ vọng:** 2 functions; 2 bảng.

---

### C1. RLS enabled

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename;
```

**Kỳ vọng:** Cả hai `rowsecurity = true`.

---

### C2. Policy count

```sql
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
group by tablename
order by tablename;
```

**Kỳ vọng:** `checkins` = **2**; `qr_tokens` = **3**.

---

### C3. No open policies

```sql
select tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
  and (
    qual::text ilike '%true%'
    or with_check::text ilike '%true%'
  )
order by tablename, policyname;
```

**Kỳ vọng:** 0 dòng với bare `USING (true)` / `WITH CHECK (true)`.

---

### C4. No legacy *_authenticated policies

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
  and policyname like '%_authenticated'
order by tablename, policyname;
```

**Kỳ vọng:** 0 dòng.

---

### C5. No anon policy

```sql
select tablename, policyname, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
  and 'anon' = any(roles)
order by tablename;
```

**Kỳ vọng:** 0 dòng.

---

### C6. Policy comments (KN-6)

```sql
select
  cls.relname as table_name,
  pol.polname as policy_name,
  pg_catalog.obj_description(pol.oid, 'pg_policy') as policy_comment
from pg_policy pol
join pg_class cls on pol.polrelid = cls.oid
join pg_namespace nsp on cls.relnamespace = nsp.oid
where nsp.nspname = 'public'
  and cls.relname in ('qr_tokens', 'checkins')
  and pol.polname in ('qr_tokens_select', 'checkins_select');
```

**Kỳ vọng:** Comments chứa `Phase 16 KN-6` hoặc `tenant isolation`.

---

### C7. Regression #15–#21

```sql
select count(*) as integration_audit_cols
from information_schema.columns
where table_schema = 'public'
  and table_name = 'integration_audit_logs'
  and column_name = 'event_type';

select count(*) as billing_plans
from public.plans
where code in ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
```

**Kỳ vọng:** `integration_audit_cols = 1`; `billing_plans = 4`.

---

## Batch C — quick queries (alias C1/C2 from apply pack)

### C1-alt. Policy detail (KN-6)

```sql
select tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename, policyname;
```

**Kỳ vọng:** Policies dùng `user_venue_id()` hoặc `is_super_admin()` — không open `true`.

---

## Ghi kết quả verify

| ID | PASS | FAIL | Ngày | Operator |
|----|------|------|------|----------|
| A1–A5 | ☐ | ☐ | | |
| B1–B4 | ☐ | ☐ | | |
| V21-1 | ☐ | ☐ | | |
| V21-2 | ☐ | ☐ | | |
| V21-3 | ☐ | ☐ | | |
| V21-4 | ☐ | ☐ | | |
| V21-5 | ☐ | ☐ | | |
| V21-6 | ☐ | ☐ | | |
| V21-7 | ☐ | ☐ | | |
| V21-8 | ☐ | ☐ | | |
| C0 | ☐ | ☐ | | |
| C1 | ☐ | ☐ | | |
| C2 | ☐ | ☐ | | |
| C3 | ☐ | ☐ | | |
| C4 | ☐ | ☐ | | |
| C5 | ☐ | ☐ | | |
| C6 | ☐ | ☐ | | |
| C7 | ☐ | ☐ | | |

**Tham chiếu:** `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md`, `PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md`
