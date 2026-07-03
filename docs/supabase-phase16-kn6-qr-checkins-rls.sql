-- Phase 16 — KN-6: Harden RLS for qr_tokens and checkins (V5 SaaS multi-tenant)
-- Apply on staging first. Rollback: docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql
-- Seed (staging QA): docs/supabase-staging-phase16-kn6-seed.sql
--
-- Tenant model (Phase 10E):
--   profiles.venue_id = venues.id = qr_tokens.tenant_id = checkins.tenant_id
--
-- Intentional exceptions:
--   • No anon policies — public QR scan uses authenticated staff JWT, not anon.
--   • SUPER_ADMIN may read/write all tenants (operational).
--   • service_role bypasses RLS (unchanged).

-- ─── qr_tokens ────────────────────────────────────────────────────
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_tokens_select_authenticated ON public.qr_tokens;
DROP POLICY IF EXISTS qr_tokens_insert_authenticated ON public.qr_tokens;
DROP POLICY IF EXISTS qr_tokens_update_authenticated ON public.qr_tokens;
DROP POLICY IF EXISTS qr_tokens_select ON public.qr_tokens;
DROP POLICY IF EXISTS qr_tokens_insert ON public.qr_tokens;
DROP POLICY IF EXISTS qr_tokens_update ON public.qr_tokens;

CREATE POLICY qr_tokens_select ON public.qr_tokens
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id = public.user_venue_id()
  );

CREATE POLICY qr_tokens_insert ON public.qr_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id = public.user_venue_id()
  );

CREATE POLICY qr_tokens_update ON public.qr_tokens
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id = public.user_venue_id()
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id = public.user_venue_id()
  );

-- ─── checkins ─────────────────────────────────────────────────────
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkins_select_authenticated ON public.checkins;
DROP POLICY IF EXISTS checkins_insert_authenticated ON public.checkins;
DROP POLICY IF EXISTS checkins_select ON public.checkins;
DROP POLICY IF EXISTS checkins_insert ON public.checkins;

CREATE POLICY checkins_select ON public.checkins
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id = public.user_venue_id()
  );

CREATE POLICY checkins_insert ON public.checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id = public.user_venue_id()
  );

COMMENT ON POLICY qr_tokens_select ON public.qr_tokens IS
  'Phase 16 KN-6 — tenant isolation via profiles.venue_id';
COMMENT ON POLICY checkins_select ON public.checkins IS
  'Phase 16 KN-6 — tenant isolation via profiles.venue_id';
