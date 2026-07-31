-- TT-6B — Realtime publication (STAGING ONLY)
-- Adds narrowly scoped Team Tournament tables to supabase_realtime.
-- Apply only after TT6-B_REALTIME_SECURITY.sql RLS policies verified.

-- Idempotent publication adds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_tournament_matchups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_tournament_matchups;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_tournament_sub_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_tournament_sub_matches;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_sub_match_referee_links'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_sub_match_referee_links;
  END IF;
END $$;

-- Explicitly DO NOT publish:
--   team_tournament_command_log
--   team_tournament_referee_event_inbox
--   match_integration_outbox
--   team_tournament_lineups (lineup detail via get_visible_lineups RPC only)

COMMENT ON TABLE public.team_tournament_matchups IS 'TT-6B realtime: status/version hints only; RLS enforced.';
