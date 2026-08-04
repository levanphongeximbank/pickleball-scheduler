-- STAGING ONLY. Restores the pre-remediation catalog state.
begin;

alter function public.customer_consent_history_immutable_guard() reset search_path;
alter function public.customer_preference_history_immutable_guard() reset search_path;
alter function public.customer_linkage_history_immutable_guard() reset search_path;
alter function public.customer_merge_history_immutable_guard() reset search_path;
alter function public.communication_assert_reply_same_conversation() reset search_path;
alter function public.communication_assert_pin_same_conversation() reset search_path;
alter function public.communication_allocate_message_position(text) reset search_path;
alter function public.communication_advance_read_cursor(text, text, timestamptz, text, bigint) reset search_path;
alter function public.normalize_profile_role(text) reset search_path;
alter function public.set_updated_at() reset search_path;
alter function public.phase42_err(text, text) reset search_path;
alter function public.phase42_creator_gets_president() reset search_path;
alter function public.rating_v5_rating_in_range(numeric) reset search_path;
alter function public.rating_v5_deviation_non_negative(numeric) reset search_path;
alter function public.rating_v5_active_version_contract() reset search_path;
alter function public.rating_v5_anchor_to_mean(integer) reset search_path;
alter function public.team_tournament_version_conflict(text, integer, integer) reset search_path;
alter function public.referee_v5_match_state_id(text, text, text) reset search_path;
alter function public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) reset search_path;
alter function public.private_pairing_err(text, text) reset search_path;
alter function public.private_pairing_ok(jsonb) reset search_path;
alter function public.notification_sanitize_reason(text, integer) reset search_path;

drop policy if exists club_membership_requests_update on public.club_membership_requests;
create policy club_membership_requests_update
  on public.club_membership_requests for update to authenticated
  using (
    (user_id = auth.uid() and status = 'pending')
    or public.can_review_club_membership_for(club_id)
  )
  with check (true);

drop policy if exists court_claim_requests_update on public.court_claim_requests;
create policy court_claim_requests_update
  on public.court_claim_requests for update to authenticated
  using (
    (user_id = auth.uid() and status = 'pending')
    or public.can_review_court_claim()
  )
  with check (true);

drop policy if exists rating_v5_review_no_client_write on public.rating_review_cases;
create policy rating_v5_review_no_client_write
  on public.rating_review_cases for all to authenticated
  with check (false);

commit;
