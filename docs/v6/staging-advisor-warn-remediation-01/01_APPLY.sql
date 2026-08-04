-- PHASE 6 / STAGING ONLY / AUTHORED ONLY — DO NOT APPLY WITHOUT OWNER GO.
begin;

-- Supabase Advisor function_search_path_mutable remediation.
alter function public.customer_consent_history_immutable_guard() set search_path = pg_catalog, public;
alter function public.customer_preference_history_immutable_guard() set search_path = pg_catalog, public;
alter function public.customer_linkage_history_immutable_guard() set search_path = pg_catalog, public;
alter function public.customer_merge_history_immutable_guard() set search_path = pg_catalog, public;
alter function public.communication_assert_reply_same_conversation() set search_path = pg_catalog, public;
alter function public.communication_assert_pin_same_conversation() set search_path = pg_catalog, public;
alter function public.communication_allocate_message_position(text) set search_path = pg_catalog, public;
alter function public.communication_advance_read_cursor(text, text, timestamptz, text, bigint) set search_path = pg_catalog, public;
alter function public.normalize_profile_role(text) set search_path = pg_catalog, public;
alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.phase42_err(text, text) set search_path = pg_catalog, public;
alter function public.phase42_creator_gets_president() set search_path = pg_catalog, public;
alter function public.rating_v5_rating_in_range(numeric) set search_path = pg_catalog, public;
alter function public.rating_v5_deviation_non_negative(numeric) set search_path = pg_catalog, public;
alter function public.rating_v5_active_version_contract() set search_path = pg_catalog, public;
alter function public.rating_v5_anchor_to_mean(integer) set search_path = pg_catalog, public;
alter function public.team_tournament_version_conflict(text, integer, integer) set search_path = pg_catalog, public;
alter function public.referee_v5_match_state_id(text, text, text) set search_path = pg_catalog, public;
alter function public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) set search_path = pg_catalog, public;
alter function public.private_pairing_err(text, text) set search_path = pg_catalog, public;
alter function public.private_pairing_ok(jsonb) set search_path = pg_catalog, public;
alter function public.notification_sanitize_reason(text, integer) set search_path = pg_catalog, public;

drop policy if exists club_membership_requests_update on public.club_membership_requests;
create policy club_membership_requests_update
  on public.club_membership_requests
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists court_claim_requests_update on public.court_claim_requests;
create policy court_claim_requests_update
  on public.court_claim_requests
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists rating_v5_review_no_client_write on public.rating_review_cases;
create policy rating_v5_review_no_client_write
  on public.rating_review_cases
  for all to authenticated
  using (false)
  with check (false);

commit;
