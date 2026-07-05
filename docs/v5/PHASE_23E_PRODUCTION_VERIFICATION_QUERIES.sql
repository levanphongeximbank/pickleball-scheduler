-- Phase 23E — Production verification queries (Phase 23C evidence)
-- Project: expuvcohlcjzvrrauvud ONLY — không chạy trên staging để kết luận Production.
-- Owner tick V23-1 → V23-5 sau mỗi query.

-- ─── V23-1: Tables exist (expect 10) ───────────────────────────
select count(*) as team_table_count
from pg_tables
where schemaname = 'public'
  and tablename like 'team_tournament%';

select tablename
from pg_tables
where schemaname = 'public'
  and tablename like 'team_tournament%'
order by tablename;

-- ─── V23-2: RLS enabled ─────────────────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'team_tournament%'
order by tablename;
-- Expect: rowsecurity = true for all rows

-- ─── V23-3: team.* permissions ──────────────────────────────────
select id, module, action
from public.permissions
where id like 'team.%'
order by id;
-- Expect: 8 rows

select role_id, permission_id
from public.role_permissions
where permission_id like 'team.%'
order by role_id, permission_id;

-- ─── V23-4: RPC functions + grants ──────────────────────────────
select p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'team_tournament_%'
  and p.prokind = 'f'
order by p.proname;
-- Expect: 13+ business RPCs (incl. helpers like resolve_header, write_audit)

-- ─── V23-5: Production clean — no probe/fixture seed ───────────
select count(*) as tournament_rows from public.team_tournaments;
-- Expect: 0 before Phase 23E blob migration of REAL data
-- After real migration: count = số giải thật đã migrate (document in migration report)

select tournament_id, tenant_id, club_id, name, status
from public.team_tournaments
order by created_at desc
limit 20;
-- Expect before migration: 0 rows
-- Expect after migration: NO rows matching phase23d-* or probe fixture IDs
