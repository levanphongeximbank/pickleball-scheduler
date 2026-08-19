-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Post-VERIFY intended public command surface ONLY.
-- Run after 03_VERIFY canonical/body PASS while still quiesced.
-- Explicit signatures. Not a generic GRANT. Not 07C snapshot replay.

BEGIN;

REVOKE ALL ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.platform_is_canonical_tenant_entitled(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.club_create(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_update(uuid, text, integer, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_assign_owner(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_clear_owner(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_transfer_president(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_assign_vice_president(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_clear_vice_president(uuid, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_add_member(uuid, text, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_remove_member(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_restore_member(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_leave_membership(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_submit_membership_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_cancel_membership_request(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_review_membership_request(uuid, uuid, text, text, integer) TO authenticated;

DO $$
BEGIN
  IF has_function_privilege(
       'authenticated',
       'public.wave5_ensure_athlete_for_club_member(uuid,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: authenticated EXECUTE must stay DENIED on wave5_ensure_athlete_for_club_member';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'public.wave5_resolve_club_facility_venue_id(text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: authenticated EXECUTE must stay DENIED on wave5_resolve_club_facility_venue_id';
  END IF;
  IF NOT has_function_privilege(
       'authenticated',
       'public.club_create(uuid,text,text,text,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: authenticated EXECUTE missing on club_create';
  END IF;
  RAISE NOTICE 'WAVE5_RESTORE_INTENDED_WRITES_OK INTERNAL_HELPER_AUTHENTICATED_EXECUTE=DENIED';
END $$;

COMMIT;
