-- Rollback Phase 16 KN-6 — restore Sprint 9 open policies (staging/dev only)
-- NOT for production after KN-6 is closed.

DROP POLICY IF EXISTS qr_tokens_select ON public.qr_tokens;
DROP POLICY IF EXISTS qr_tokens_insert ON public.qr_tokens;
DROP POLICY IF EXISTS qr_tokens_update ON public.qr_tokens;

CREATE POLICY qr_tokens_select_authenticated ON public.qr_tokens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY qr_tokens_insert_authenticated ON public.qr_tokens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY qr_tokens_update_authenticated ON public.qr_tokens
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS checkins_select ON public.checkins;
DROP POLICY IF EXISTS checkins_insert ON public.checkins;

CREATE POLICY checkins_select_authenticated ON public.checkins
  FOR SELECT TO authenticated USING (true);

CREATE POLICY checkins_insert_authenticated ON public.checkins
  FOR INSERT TO authenticated WITH CHECK (true);
