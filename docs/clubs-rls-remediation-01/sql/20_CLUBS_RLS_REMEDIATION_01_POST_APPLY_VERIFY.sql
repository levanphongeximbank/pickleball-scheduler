-- =============================================================================
-- CLUBS-RLS-REMEDIATION-01 — POST-APPLY VERIFICATION (read-only)
-- After Staging forward. Captures policy text + negative probes.
-- Fixture UIDs / club ids must be Owner-supplied Staging QA accounts.
-- Do NOT print secrets.
-- =============================================================================

-- A) Policy definition must NOT contain broad club-row status = 'active'
--    (cm.status = 'active' in membership EXISTS is allowed)
SELECT
  pol.polname,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  (
    pg_get_expr(pol.polqual, pol.polrelid)
      ~* '(^|[^.\w])status[[:space:]]*=[[:space:]]*''active'''
  ) AS still_has_broad_status_active
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'clubs'
  AND pol.polname = 'clubs_select';
-- EXPECT: still_has_broad_status_active = false
-- EXPECT using_expr contains phase42_is_platform_super_admin, phase42_is_tenant_member,
--        and phase42_active_club_member_id(id) — and NOT a bare (status = 'active'::text)
--        club-row branch, and NOT a direct EXISTS on club_members (recursion hazard).

-- B) Exactly one SELECT policy on clubs
SELECT count(*) AS select_policy_count
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'clubs' AND pol.polcmd = 'r';
-- EXPECT: 1

-- C) No INSERT/UPDATE/DELETE policies on clubs
SELECT count(*) AS writer_policy_count
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'clubs'
  AND pol.polcmd IN ('a', 'w', 'd', '*');
-- EXPECT: 0

-- D) Privileges unchanged (SELECT yes; INSERT/UPDATE/DELETE no for authenticated/anon)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'clubs'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- E) Public catalog RPC still executable
SELECT has_function_privilege(
         'anon',
         'public.public_catalog_list_clubs(integer, integer, text)',
         'EXECUTE'
       ) AS anon_catalog_exec,
       has_function_privilege(
         'authenticated',
         'public.public_catalog_list_clubs(integer, integer, text)',
         'EXECUTE'
       ) AS auth_catalog_exec;
-- EXPECT: both true

-- F) Smoke: catalog still returns allowlisted shape (no internal columns)
-- SELECT * FROM public.public_catalog_list_clubs(5, 0, 'name_asc');
-- Manual check: columns must be id, display_name, slug, description, logo_url,
-- image_url, location_summary, publication_state, public_contact, total_count only.

-- G) Negative runtime probes (Owner Staging JWT / SET ROLE — fill placeholders)
-- Replace :user_a_jwt / club_b_id with Staging fixtures before running.
--
-- N1/N2 — User A (tenant A, not member of Club B):
--   SET ROLE authenticated;  -- or set request.jwt.claim.sub via test harness
--   SELECT id, tenant_id, registered_cluster_id, created_by_user_id
--   FROM public.clubs WHERE id = '<club_b_id>';
--   EXPECT: 0 rows
--
-- N3 — Active member of own club: EXPECT 1 row for own club_id
-- N4 — Tenant member of tenant owning club: EXPECT row visible
-- N5 — Platform super admin: EXPECT row visible
-- N6 — SET ROLE anon; SELECT count(*) FROM public.clubs; EXPECT 0
-- N9 — Soft-deleted (deleted_at NOT NULL): EXPECT not returned for any authenticated non-bypass
