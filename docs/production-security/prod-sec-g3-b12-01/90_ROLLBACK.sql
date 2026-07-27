-- PROD-SEC-G3-B12-01 — Rollback (Owner emergency only)
-- Restores pre-lockdown anon surface ONLY if Owner explicitly accepts risk.
-- Prefer NOT to re-open anon write. Prefer forward-fix instead.

BEGIN;

DROP POLICY IF EXISTS club_ai_data_deny_all_clients ON public.club_ai_data;

ALTER TABLE public.club_ai_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_ai_data NO FORCE ROW LEVEL SECURITY;

-- Historical permissive policies (INSECURE — do not re-apply unless Owner forces)
-- Uncomment only with explicit Owner GO:
-- CREATE POLICY club_ai_data_anon_select ON public.club_ai_data FOR SELECT TO anon USING (true);
-- CREATE POLICY club_ai_data_anon_insert ON public.club_ai_data FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY club_ai_data_anon_update ON public.club_ai_data FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.club_ai_data TO anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.club_ai_data TO authenticated;

COMMIT;

-- Default rollback posture: leave table locked; restore app to club_data_v3 only.
