-- M8 rollback — drops SSOT objects (Owner emergency only). Data loss.
-- Drops both legacy uuid-tenant and text-tenant function signatures.
BEGIN;

DROP FUNCTION IF EXISTS public.competition_ssot_finalize_match_result(uuid, uuid, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.competition_ssot_upsert_working_score(uuid, uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.competition_ssot_append_command(uuid, uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.competition_ssot_upsert_working_score(text, uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.competition_ssot_append_command(text, uuid, text, jsonb, text);

DROP TABLE IF EXISTS public.competition_ssot_idempotency;
DROP TABLE IF EXISTS public.competition_ssot_audit_events;
DROP TABLE IF EXISTS public.competition_ssot_command_log;
DROP TABLE IF EXISTS public.competition_ssot_standings_snapshots;
DROP TABLE IF EXISTS public.competition_ssot_finalized_results;
DROP TABLE IF EXISTS public.competition_ssot_matches;
DROP TABLE IF EXISTS public.competition_ssot_participants;
DROP TABLE IF EXISTS public.competition_ssot_competitions;

COMMIT;
