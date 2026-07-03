-- Sprint 9: Mobile PWA / QR Check-in / Push Notifications
-- Apply on staging first. Rollback: docs/supabase-mobile-sprint9-rollback.sql

-- ─── push_subscriptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL DEFAULT '',
  auth text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'web',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_user
  ON public.push_subscriptions (tenant_id, user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── notifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'unread',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user
  ON public.notifications (tenant_id, user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── qr_tokens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  tournament_id text,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_tenant_entity
  ON public.qr_tokens (tenant_id, entity_type, entity_id);

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
CREATE TABLE IF NOT EXISTS public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  tournament_id text,
  club_id text,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  checked_in_by uuid REFERENCES auth.users(id),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'qr_scan',
  status text NOT NULL DEFAULT 'checked_in',
  note text NOT NULL DEFAULT '',
  UNIQUE (tenant_id, tournament_id, entity_type, entity_id, status)
);

CREATE INDEX IF NOT EXISTS idx_checkins_tenant_tournament
  ON public.checkins (tenant_id, tournament_id, checked_in_at DESC);

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

-- Extend audit_logs actions (if using enum, skip; text column accepts new values)
COMMENT ON TABLE public.checkins IS 'Sprint 9 QR check-in records';
COMMENT ON TABLE public.qr_tokens IS 'Sprint 9 opaque QR tokens (hash only)';
