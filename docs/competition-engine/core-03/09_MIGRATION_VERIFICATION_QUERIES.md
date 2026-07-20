# CORE-03 Phase 1G — Migration Verification Query Pack

**Status:** DOCUMENTATION ONLY — DO NOT RUN against Staging/Production from this phase.
**MIGRATION_STATUS:** `AUTHORED_NOT_APPLIED`
**Owner decisions:**
- `TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED`
- `CORE02_ENTRY_CREATION = DEFERRED_FAIL_CLOSED`
- No database connection from Core-03 Phase 1G
- No SQL apply from Core-03 Phase 1G

These queries are authored for a future Staging-first rollout under Owner GO.
They are **read-only** verification intents. Do not execute them in this repository phase.

SQL artifact:
- `docs/competition-engine/core-03/supabase-core03-phase1f-persistence.sql`
- `docs/competition-engine/core-03/supabase-core03-phase1f-persistence-rollback.sql`

---

## 1. All Core-03 tables exist

```sql
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'core03_competition_registrations',
    'core03_registration_idempotency',
    'core03_eligibility_evidence',
    'core03_capacity_state',
    'core03_capacity_reservations',
    'core03_waitlist_entries',
    'core03_registration_audit_events',
    'core03_persistence_reconciliation'
  )
order by 1;
-- Expect: 8 rows
```

## 2. Expected indexes exist

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename like 'core03_%'
order by indexname;
-- Expect unique indexes for request_id, active identity, active reservation,
-- active waitlist, evaluation request/fingerprint, and supporting competition indexes.
```

## 3. Expected constraints exist

```sql
select conrelid::regclass as table_name, conname, contype
from pg_constraint
where conrelid::regclass::text like 'public.core03_%'
order by 1, 2;
-- Expect PK, CHECK (state_version, capacity bounds, status enums), and unique constraints.
```

## 4. RLS enabled on every Core-03 table

```sql
select c.relname, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'core03_%'
  and c.relkind = 'r'
order by 1;
-- Expect rls_enabled = true for every Core-03 table
```

## 5. No permissive client policies

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename like 'core03_%'
order by tablename, policyname;
-- Expect deny-all policies only (qual/with_check equivalent to false).
-- Expect no USING (true) / WITH CHECK (true).
```

## 6. No client write grants

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'core03_%'
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;
-- Expect zero INSERT/UPDATE/DELETE grants to anon/authenticated/public.
```

## 7. Duplicate active reservation detection

```sql
select registration_id, count(*) as active_count
from public.core03_capacity_reservations
where status = 'ACTIVE'
group by registration_id
having count(*) > 1;
-- Expect: 0 rows
```

## 8. Duplicate active waitlist detection

```sql
select registration_id, count(*) as active_count
from public.core03_waitlist_entries
where status = 'ACTIVE'
group by registration_id
having count(*) > 1;
-- Expect: 0 rows
```

## 9. Negative or over-limit capacity detection

```sql
select *
from public.core03_capacity_state
where used < 0
   or reserved < 0
   or (configured_limit is not null and used + reserved > configured_limit);
-- Column names must match authored SQL (limit / used / reserved).
-- Expect: 0 rows
```

## 10. Stale or invalid stateVersion detection

```sql
select id, state_version
from public.core03_competition_registrations
where state_version is null or state_version < 0;
-- Expect: 0 rows

select competition_id, division_id, state_version
from public.core03_capacity_state
where state_version is null or state_version < 0;
-- Expect: 0 rows
```

## 11. Orphan registration / evidence / reservation / waitlist records

```sql
-- Evidence without registration
select e.id
from public.core03_eligibility_evidence e
left join public.core03_competition_registrations r on r.id = e.registration_id
where r.id is null;

-- Active reservation without registration
select c.reservation_id
from public.core03_capacity_reservations c
left join public.core03_competition_registrations r on r.id = c.registration_id
where c.status = 'ACTIVE' and r.id is null;

-- Active waitlist without registration
select w.waitlist_entry_id
from public.core03_waitlist_entries w
left join public.core03_competition_registrations r on r.id = w.registration_id
where w.status = 'ACTIVE' and r.id is null;
-- Expect: 0 rows each (or documented orphans under reconciliation)
```

## 12. Audit event count and immutability checks

```sql
select registration_id, count(*) as audit_count
from public.core03_registration_audit_events
group by registration_id
order by audit_count desc;

-- Immutability is enforced by trigger + repository reject of UPDATE/DELETE.
-- Verification intent (do not run mutating probes in Production):
-- Confirm UPDATE/DELETE triggers exist on core03_registration_audit_events.
select tgname, tgtype
from pg_trigger
where tgrelid = 'public.core03_registration_audit_events'::regclass
  and not tgisinternal;
```

## 13. reconciliationRequired records

```sql
select *
from public.core03_persistence_reconciliation
where reconciliation_required = true
   or status in ('OPEN', 'PENDING')
order by created_at desc
limit 100;

select id, registration_id, reconciliation_required, partial_success
from public.core03_registration_audit_events
where reconciliation_required = true
order by occurred_at desc
limit 100;
```

## 14. Migration metadata / status

```sql
-- Prefer project-owned migration ledger if present. Example intent only:
-- select * from public.schema_migrations where name like '%core03%';
-- Until applied: MIGRATION_STATUS remains AUTHORED_NOT_APPLIED in code/docs.
```

---

## Static safety affirmation (Phase 1G)

- Queries above are documentation only.
- Phase 1G does not open a database connection.
- Phase 1G does not apply SQL.
- Phase 1G does not mutate Staging or Production.
