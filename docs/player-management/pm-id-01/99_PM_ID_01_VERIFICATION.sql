-- =============================================================================
-- PM-ID-01 — Verification (read-style checks after authorized apply)
-- Safe to run inside BEGIN TRANSACTION READ ONLY … ROLLBACK for preflight.
-- Does not INSERT/UPDATE/DELETE mapping rows.
-- =============================================================================

-- Table present
SELECT to_regclass('public.player_identity_links') IS NOT NULL AS table_present;

-- player_id column type must be text
SELECT
  a.attname,
  format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'player_identity_links'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN (
    'link_id', 'tenant_id', 'club_id', 'principal_id', 'player_id',
    'status', 'version', 'provenance', 'created_at', 'created_by',
    'updated_at', 'revoked_at', 'revoked_by', 'source_system'
  )
ORDER BY a.attname;

-- Unique partial indexes
SELECT i.relname AS index_name, ix.indisunique
FROM pg_index ix
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'player_identity_links'
ORDER BY i.relname;

-- Helpers / RPCs present + SECURITY DEFINER
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) LIKE '%search_path = pg_catalog, public%'
    OR pg_get_functiondef(p.oid) LIKE '%search_path=pg_catalog, public%'
    AS fixed_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'player_identity_resolve_mapping',
    'player_identity_is_mapped',
    'player_identity_admin_can_manage',
    'player_identity_admin_upsert_link',
    'player_identity_admin_revoke_link',
    'player_identity_links_enforce_club_tenant'
  )
ORDER BY p.proname, args;

-- RLS enabled
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'player_identity_links';

-- No USING (true) policies on mapping table
SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'player_identity_links';

-- Grants: authenticated execute on resolve helpers; not PUBLIC/anon
SELECT
  p.proname,
  r.rolname,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname IN (
    'player_identity_resolve_mapping',
    'player_identity_is_mapped'
  )
  AND r.rolname IN ('public', 'anon', 'authenticated')
ORDER BY p.proname, r.rolname;

-- Aggregate counts only (no PII)
SELECT
  count(*)::int AS link_rows,
  count(*) FILTER (WHERE status = 'ACTIVE')::int AS active_rows,
  count(*) FILTER (WHERE status = 'REVOKED')::int AS revoked_rows
FROM public.player_identity_links;
