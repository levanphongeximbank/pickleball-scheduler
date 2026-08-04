-- Read-only verification. Expected: each result is zero except hardened_functions=22.
select count(*) as hardened_functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = any (array[
    'customer_consent_history_immutable_guard','customer_preference_history_immutable_guard',
    'customer_linkage_history_immutable_guard','customer_merge_history_immutable_guard',
    'communication_assert_reply_same_conversation','communication_assert_pin_same_conversation',
    'communication_allocate_message_position','communication_advance_read_cursor',
    'normalize_profile_role','set_updated_at','phase42_err','phase42_creator_gets_president',
    'rating_v5_rating_in_range','rating_v5_deviation_non_negative',
    'rating_v5_active_version_contract','rating_v5_anchor_to_mean',
    'team_tournament_version_conflict','referee_v5_match_state_id',
    'referee_v5_assignment_effective_status','private_pairing_err','private_pairing_ok',
    'notification_sanitize_reason'
  ])
  and 'search_path=pg_catalog, public' = any (coalesce(p.proconfig, array[]::text[]));

select count(*) as broad_target_policy_count
from pg_policies
where schemaname = 'public'
  and policyname in (
    'club_membership_requests_update',
    'court_claim_requests_update',
    'rating_v5_review_no_client_write'
  )
  and (
    coalesce(regexp_replace(qual, '[()[:space:]]', '', 'g'), '') in ('true','1=1')
    or coalesce(regexp_replace(with_check, '[()[:space:]]', '', 'g'), '') in ('true','1=1')
  );

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and policyname in (
    'club_membership_requests_update',
    'court_claim_requests_update',
    'rating_v5_review_no_client_write'
  )
order by tablename, policyname;

