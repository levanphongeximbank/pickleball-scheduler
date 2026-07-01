# Phase 2 — Supabase Production SQL Checklist (Sprint 12 GA)

**Mục tiêu:** Checklist cuối cùng để **bạn chạy thủ công** trên Supabase **Production**.  
**Agent không tự chạy SQL.** Sau khi bạn xác nhận đã apply, dùng mục **Verify schema** bên dưới.

**Tham chiếu staging (đã QA RC):** `docs/SUPABASE-STAGING-CHECKLIST.md`

---

## Trước khi bắt đầu

- [ ] **Backup** database production (hoặc snapshot) trước migration
- [ ] Staging đã pass toàn bộ 15 bước SQL + RBAC QA (`docs/RBAC-RC-QA.md`)
- [ ] Có cửa sổ bảo trì ngắn (nếu production đang có user)
- [ ] `VITE_RBAC_ENABLED=true` trên Vercel **sau** SQL xong (hoặc giữ true nếu đã có admin)

---

## Thứ tự chạy SQL (bắt buộc — 15 bước)

Chạy từng file trong **SQL Editor → Run** theo thứ tự. Mọi file **additive** (không drop dữ liệu hiện có).

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
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | View `tenants`, `venues.status`, index | `supabase-multi-tenant-sprint2-rollback.sql` |
| 12 | `docs/supabase-subscription-sprint4.sql` | Plan starter/pro/enterprise, auto_renew | — |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | `ai_suggestions` + RLS | — |
| 14 | `docs/supabase-mobile-sprint9.sql` | push, notifications, qr_tokens, checkins | `supabase-mobile-sprint9-rollback.sql` |
| 15 | `docs/supabase-sprint10.sql` | api_*, marketplace, payments, webhooks (`tenant_id text` = `venues.id`) | `supabase-sprint10-rollback.sql` |

### Tick khi hoàn thành

- [ ] **1** — club-v3
- [ ] **2** — rbac
- [ ] **3** — club-v3-rls
- [ ] **4** — match-live
- [ ] **5** — match-live-rls
- [ ] **6** — security-hardening-v357
- [ ] **7** — match-live-v2 (nếu áp dụng)
- [ ] **8** — identity sprint1
- [ ] **9** — identity phaseB
- [ ] **10** — identity phaseC
- [ ] **11** — multi-tenant sprint2
- [ ] **12** — subscription sprint4
- [ ] **13** — ai-assistant sprint7
- [ ] **14** — mobile sprint9
- [ ] **15** — sprint10

**Lưu ý GA:** Bước 13–15 vẫn nên chạy dù feature flags OFF — schema sẵn sàng khi bật sau.

**Lưu ý Sprint 10 (bước 15):**

- `tenant_id` phải là **text** (cùng kiểu `venues.id`). Sprint 2: `tenantId === venueId` — không có bảng `tenants` uuid riêng.
- Nếu gặp lỗi `42804 ... api_clients_tenant_id_fkey ... uuid and text`: dùng bản `supabase-sprint10.sql` đã sửa (có block `do $fix_tenant_id$` idempotent).
- **Không** bật `VITE_API_ENABLED` hoặc `VITE_MARKETPLACE_ENABLED` trên production cho đến khi QA API/Marketplace xong (`docs/GA-PRODUCTION-ENV-CHECKLIST.md`).

---

## Sau SQL — Realtime & Auth

- [ ] Replication bật: `tournament_match_live`
- [ ] Tạo admin đầu tiên (nếu chưa có SUPER_ADMIN):

```sql
-- Sau khi user đăng ký qua /login
update public.profiles
set
  role = 'SUPER_ADMIN',
  status = 'active',
  display_name = 'Admin Production'
where email = 'admin@your-domain.com';
```

- [ ] Tạo venue production + gán role test (xem mẫu SQL trong `docs/SUPABASE-STAGING-CHECKLIST.md`)

---

## Verify schema (chạy sau khi bạn xác nhận SQL xong)

### A. RLS enabled

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

**Kỳ vọng:** `rls_enabled = true` cho mọi bảng.

### B. Bảng Sprint 7–10 tồn tại

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

### B2. Sprint 10 — kiểu `tenant_id` (phải là `text`, khớp `venues.id`)

```sql
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
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

**Kỳ vọng:** mọi dòng `data_type = 'text'`.

### B3. Sprint 10 — FK `api_clients` / `api_keys` → `venues`

```sql
select
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name as references_table,
  ccu.column_name as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name in ('api_clients', 'api_keys')
  and kcu.column_name = 'tenant_id';
```

**Kỳ vọng:** `references_table = venues`, `references_column = id`.

### B4. Sprint 10 — RLS enabled (8 bảng)

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
    'api_clients', 'api_keys', 'api_logs',
    'marketplace_products', 'marketplace_orders', 'payment_transactions',
    'notification_logs', 'webhook_events'
  )
order by tablename;
```

**Kỳ vọng:** `rls_enabled = true` cho mọi bảng.

### B5. Sprint 10 — đếm bản ghi (smoke, không bắt buộc có data)

```sql
select 'api_clients' as tbl, count(*)::bigint as rows from public.api_clients
union all select 'api_keys', count(*) from public.api_keys
union all select 'api_logs', count(*) from public.api_logs
union all select 'marketplace_products', count(*) from public.marketplace_products
union all select 'marketplace_orders', count(*) from public.marketplace_orders
union all select 'payment_transactions', count(*) from public.payment_transactions
union all select 'notification_logs', count(*) from public.notification_logs
union all select 'webhook_events', count(*) from public.webhook_events
order by tbl;
```

### C. RPC Identity & Referee

```sql
-- Referee (token-scoped)
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

### D. View tenants

```sql
select * from public.tenants limit 3;
```

### E. Subscription columns

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'subscriptions'
and column_name in ('auto_renew', 'locked_at', 'last_renewed_at');
```

---

## Rollback khẩn cấp

| Phạm vi | File |
|---------|------|
| Club/match RLS anon-open | `docs/supabase-rls-rollback.sql` |
| Identity sprint1 | `docs/supabase-identity-v40-sprint1-rollback.sql` |
| Phase B / C | `*-phaseB-rollback.sql`, `*-phaseC-rollback.sql` |
| Multi-tenant | `docs/supabase-multi-tenant-sprint2-rollback.sql` |
| Mobile | `docs/supabase-mobile-sprint9-rollback.sql` |
| Sprint 10 | `docs/supabase-sprint10-rollback.sql` — xóa 8 bảng Sprint 10; tắt `VITE_API_ENABLED` / `VITE_MARKETPLACE_ENABLED` trước |

Sau rollback nghiêm trọng: tạm `VITE_RBAC_ENABLED=false` trên Vercel cho đến khi khắc phục.

**Sprint 10 rollback:** Chỉ dùng khi chưa có dữ liệu API/Marketplace production quan trọng. Lỗi FK uuid/text thường không tạo bảng → rollback có thể no-op; chạy lại bản `supabase-sprint10.sql` đã sửa là đủ.

---

## Phase 2 — Kết luận

| Trạng thái | Điều kiện |
|------------|-----------|
| **PASS** | 15 bước tick + verify schema pass |
| **BLOCKED** | Thiếu bước SQL hoặc RLS/RPC không đúng |

**Sau PASS:** Báo agent / team → chạy `docs/GA-PRODUCTION-QA.md`
