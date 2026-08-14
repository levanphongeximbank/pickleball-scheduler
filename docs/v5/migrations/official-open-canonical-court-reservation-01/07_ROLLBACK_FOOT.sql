DROP FUNCTION IF EXISTS public.official_tournament_commit_group_schedule(text, text, uuid, text, jsonb, bigint, text);
DROP FUNCTION IF EXISTS public.official_tournament_reserve_courts(text, text, uuid, jsonb, text, text, text, text, bigint, text);
DROP FUNCTION IF EXISTS public.official_tournament_inventory_courts(text);
DROP FUNCTION IF EXISTS public.court_assert_available(text, text, text, timestamptz, timestamptz, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.court_reservation_finish_command(text, uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.court_reservation_begin_command(text, uuid, text, text, text);

DROP TABLE IF EXISTS public.court_reservation_command_ledger;
DROP TABLE IF EXISTS public.court_reservations;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.canonical_tournaments WHERE coalesce(version, 1) > 1
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_UNSAFE: canonical_tournaments.version already used';
  END IF;
  ALTER TABLE public.canonical_tournaments DROP COLUMN IF EXISTS version;
END
$$;

REVOKE ALL ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canonical_tournament_update(text, text, uuid, jsonb) TO authenticated;

COMMIT;
