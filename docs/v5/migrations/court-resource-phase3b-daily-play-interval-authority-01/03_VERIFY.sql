-- Court Resource Phase 3B/4D Daily Play interval authority.
-- READ-ONLY VERIFY. LOCAL AUTHORING ONLY.

DO $$
DECLARE
  v_acquire_def text;
  v_missing text[] := '{}';
  v_cutover boolean;
BEGIN
  IF to_regclass('public.daily_play_court_capacity_windows') IS NULL THEN
    v_missing := array_append(v_missing, 'daily_play_court_capacity_windows');
  END IF;
  IF to_regprocedure(
    'public.court_resource_daily_play_venue_capacity_end(text,timestamptz)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_daily_play_venue_capacity_end');
  END IF;
  IF to_regprocedure(
    'public.court_resource_daily_play_extend_capacity_if_needed(text,uuid,text,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_daily_play_extend_capacity_if_needed');
  END IF;
  IF to_regprocedure(
    'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'
  ) IS NULL THEN
    v_missing := array_append(v_missing, 'court_resource_daily_play_acquire');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL missing 4D objects: %', array_to_string(v_missing, ', ');
  END IF;

  v_acquire_def := pg_get_functiondef(
    'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'::regprocedure
  );

  IF v_acquire_def ILIKE '%now() + interval ''12 hours''%'
     OR v_acquire_def ILIKE '%clock_timestamp() +%'
     OR v_acquire_def ILIKE '%current_timestamp +%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL arbitrary now()+X authority still present in acquire';
  END IF;

  IF v_acquire_def NOT ILIKE '%daily_play_court_capacity_windows%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL acquire does not persist capacity windows';
  END IF;

  IF v_acquire_def NOT ILIKE '%court_resource_daily_play_venue_capacity_end%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL acquire missing venue civil-day end policy';
  END IF;

  IF pg_get_functiondef(
       'public.daily_play_start_match(text,text,uuid,text,integer,text)'::regprocedure
     ) NOT ILIKE '%court_resource_daily_play_extend_capacity_if_needed%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL start_match missing capacity extension touch';
  END IF;

  SELECT enabled INTO v_cutover
  FROM public.court_resource_reservation_cutover
  WHERE cutover_id = 'canonical-reservation-phase3b';
  IF v_cutover IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY_FAIL SQL cutover must remain false (enabled=%)', v_cutover;
  END IF;

  IF to_regclass('public.court_resource_reservations') IS NULL
     OR to_regprocedure(
       'public.court_resource_reserve_core(text,text,uuid[],text,text,text,timestamptz,timestamptz,text,uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL Phase3B schema not intact';
  END IF;

  RAISE NOTICE 'VERIFY_OK Phase4D interval authority; cutover=false; Phase3B intact';
END
$$;

SELECT 'NO_ARBITRARY_NOW_PLUS_X' AS check_item,
  (
    pg_get_functiondef(
      'public.court_resource_daily_play_acquire(text,text,uuid,text,text,text)'::regprocedure
    ) NOT ILIKE '%now() + interval ''12 hours''%'
  ) AS ok;

SELECT 'PERSISTED_CAPACITY_WINDOWS' AS check_item,
  (to_regclass('public.daily_play_court_capacity_windows') IS NOT NULL) AS ok;

SELECT 'SQL_CUTOVER_FALSE' AS check_item,
  EXISTS (
    SELECT 1 FROM public.court_resource_reservation_cutover
    WHERE cutover_id = 'canonical-reservation-phase3b' AND enabled = false
  ) AS ok;

SELECT 'PHASE3B_RESERVATIONS_INTACT' AS check_item,
  (to_regclass('public.court_resource_reservations') IS NOT NULL) AS ok;
