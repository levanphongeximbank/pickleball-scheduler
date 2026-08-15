-- Official/Open referee-to-completion 01 ROLLBACK.
-- Fail closed if package runtime has been used.
-- Does NOT drop tournament_match_live or canonical_tournaments.
-- Does NOT touch court_reservations.
-- Does NOT mutate fixture business rows.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.official_open_assert_unused_for_rollback()') IS NOT NULL THEN
    PERFORM public.official_open_assert_unused_for_rollback();
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.official_open_get_public_results(text, text, uuid);
DROP FUNCTION IF EXISTS public.official_open_generate_knockout(text, text, uuid, text, bigint, text);
DROP FUNCTION IF EXISTS public.official_open_complete_tournament(text, text, uuid, bigint, text);
DROP FUNCTION IF EXISTS public.official_open_admin_commit_match_result(text, text, uuid, text, int, int, bigint, text);
DROP FUNCTION IF EXISTS public.official_open_commit_match_result(text, int, int, text);
DROP FUNCTION IF EXISTS public.official_open_adjust_live_score(text, text, int, int, int);
DROP FUNCTION IF EXISTS public.official_open_referee_get_match(text);
DROP FUNCTION IF EXISTS public.official_open_revoke_match_live(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.official_open_ensure_match_live(text, text, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.official_open_ledger_put(text, text, uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.official_open_ledger_replay(text, text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.official_open_ledger_get(text, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.official_open_commit_core(public.canonical_tournaments, text, int, int);
DROP FUNCTION IF EXISTS public.official_open_sanitize_public(public.canonical_tournaments);
DROP FUNCTION IF EXISTS public.official_open_completion_check(public.canonical_tournaments);
DROP FUNCTION IF EXISTS public.official_open_build_knockout(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.official_open_ko_stage(text);
DROP FUNCTION IF EXISTS public.official_open_ko_round_name(int);
DROP FUNCTION IF EXISTS public.official_open_event_qualification(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.official_open_stat_add(jsonb, text, int, int, int, int, int, int, int);
DROP FUNCTION IF EXISTS public.official_open_sporting_equal(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.official_open_qualifiers_per_group(jsonb);
DROP FUNCTION IF EXISTS public.official_open_apply_match_result(jsonb, text, int, int, text, text);
DROP FUNCTION IF EXISTS public.official_open_is_closed(public.canonical_tournaments);
DROP FUNCTION IF EXISTS public.official_open_validate_rally(int, int, int);
DROP FUNCTION IF EXISTS public.official_open_round_target(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.official_open_assignment_token(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.official_open_find_match(jsonb, text);
DROP FUNCTION IF EXISTS public.official_open_entry_name(jsonb, text);
DROP FUNCTION IF EXISTS public.official_open_json_err(text, text, jsonb);
DROP FUNCTION IF EXISTS public.official_open_assert_unused_for_rollback();

DROP TABLE IF EXISTS public.official_open_lifecycle_commands;

ALTER TABLE public.tournament_match_live DROP COLUMN IF EXISTS scheduled_start;
ALTER TABLE public.tournament_match_live DROP COLUMN IF EXISTS scoring_method;
ALTER TABLE public.tournament_match_live DROP COLUMN IF EXISTS scoring_target;
ALTER TABLE public.tournament_match_live DROP COLUMN IF EXISTS live_revision;

COMMIT;
