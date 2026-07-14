# Private Pairing Rules V2 — PR-4 Apply Runbook

| Field | Value |
|-------|-------|
| Migration file | `docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql` |
| Environments | Local / Staging **only** |
| Production | **DO NOT APPLY** |
| Owner confirm | Required before staging apply |

---

## 1. Pre-checks

```bash
git branch --show-current   # feature/private-pairing-rules-v2
git log -1 --oneline
```

Confirm helpers exist on target DB:

```sql
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_super_admin','user_has_permission','user_venue_id','user_role')
order by 1;
```

Confirm `permissions` / `role_permissions` / `roles` tables exist.

---

## 2. Staging apply (owner confirmation required)

**STOP here until owner replies GO for staging.**

Option A — Supabase SQL editor: paste entire `PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql`.

Option B — MCP `apply_migration` with name `private_pairing_rules_v2_pr4` and full file contents.

After apply:

```sql
select tablename from pg_tables
where schemaname = 'public' and tablename like 'private_pairing%'
order by 1;

select id from public.permissions where id like 'pairing.private_rules.%';

select role_id, permission_id from public.role_permissions
where permission_id like 'pairing.private_rules.%'
order by 1, 2;

select pr.rolname, c.relname, pol.polname
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_roles pr on true
where c.relname like 'private_pairing%'
limit 20;

-- Realtime must NOT include private tables
select * from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename like 'private_pairing%';
-- expect 0 rows
```

---

## 3. Verification SQL (post-apply)

```sql
-- Permission matrix: only SUPER_ADMIN / PLATFORM_ADMIN
select role_id, permission_id
from public.role_permissions
where permission_id like 'pairing.private_rules.%';

-- RPC list
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname like 'private_pairing_%'
order by 1;
```

JWT probes (manual with staging users):

| Actor | Expect |
|-------|--------|
| Unauthenticated | RPC → PERMISSION_DENIED |
| PLAYER / REFEREE / CLUB_OWNER / TOURNAMENT_DIRECTOR / SYSTEM_TECHNICIAN | PERMISSION_DENIED |
| SUPER_ADMIN tenant A | can create/list tenant A |
| SUPER_ADMIN tenant A | CROSS_TENANT / empty for tenant B data |
| Direct SELECT without view perm | 0 rows |
| Direct INSERT | permission denied |
| Audit UPDATE/DELETE | AUDIT_APPEND_ONLY |

---

## 4. Local / unit verification (no DB)

```bash
node --test tests/private-pairing-rules-pr4-database-security.test.js
node --test tests/private-pairing-rules-pr4-repository.test.js
node --test tests/private-pairing-rules-pr2.test.js
node --test tests/private-pairing-rules-pr3-runtime.test.js
```

---

## 5. Rollback method (staging/local)

Order:

1. `revoke execute` / `drop function` for all `private_pairing_*` RPCs.
2. Drop triggers/policies on the four tables.
3. Optionally retain audit table; or `drop table ... cascade` for all four if empty.
4. `delete from role_permissions where permission_id like 'pairing.private_rules.%';`
5. Optional: `delete from permissions where id like 'pairing.private_rules.%';`

Do **not** rollback Production without a separate GO.

---

## 6. What PR-4 does not do

- No Production migration / deploy / feature flag ON
- No merge to main
- No SUPER_ADMIN UI (PR-5)
- No legacy `founderPairingConstraints` data migration
