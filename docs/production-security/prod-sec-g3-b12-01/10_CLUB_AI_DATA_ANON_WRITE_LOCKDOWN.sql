-- PROD-SEC-G3-B12-01 — club_ai_data Anonymous Write Lockdown
-- Workstream: PROD-SEC-G3-B12-01
-- Tip baseline: fresh origin/main at PR open
--
-- Intent:
--   Remove anonymous (and authenticated client) write/read surface on
--   public.club_ai_data. Canonical cloud club authority is public.club_data_v3.
--
-- Safety:
--   Idempotent. Does NOT touch public_catalog_*, club_data_v3, or public RPCs.
--   Does NOT DROP the table (rollback / forensic retention).
--   service_role retains table privileges for emergency admin only.
--
-- Apply: Owner GO only — Staging first, then Production (separate apply plan).
-- NOT applied by this PR alone.

BEGIN;

-- 1) Drop permissive anon policies (USING/WITH CHECK true write surface)
DROP POLICY IF EXISTS club_ai_data_anon_insert ON public.club_ai_data;
DROP POLICY IF EXISTS club_ai_data_anon_update ON public.club_ai_data;
DROP POLICY IF EXISTS club_ai_data_anon_select ON public.club_ai_data;

-- 2) Ensure RLS is enabled; force so table owner paths cannot silently bypass
ALTER TABLE public.club_ai_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_ai_data FORCE ROW LEVEL SECURITY;

-- 3) Revoke client-facing privileges (anon + authenticated)
--    No public SELECT requirement was certified; legacy pull is client-cutover.
REVOKE ALL ON TABLE public.club_ai_data FROM anon;
REVOKE ALL ON TABLE public.club_ai_data FROM authenticated;
REVOKE ALL ON TABLE public.club_ai_data FROM PUBLIC;

-- 4) Keep service_role usable for break-glass ops (Supabase bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.club_ai_data TO service_role;

-- 5) Deny-by-default marker policy: no roles attached → no anon/auth access
--    (Explicit documentation policy; RLS with zero matching policies also denies.)
DROP POLICY IF EXISTS club_ai_data_deny_all_clients ON public.club_ai_data;
CREATE POLICY club_ai_data_deny_all_clients
  ON public.club_ai_data
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;

-- Verification helper (run separately after apply):
-- SELECT polname, cmd FROM ... (see 11_VERIFY.sql)
