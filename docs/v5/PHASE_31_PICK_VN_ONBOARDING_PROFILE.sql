-- Phase 31 — Pick_VN Onboarding Profile & Assessment
-- Chạy SAU: PHASE_30_PICK_VN_PLAYER_RATING.sql
-- Staging: qyewbxjsiiyufanzcjcq

alter table public.profiles
  add column if not exists gender text,
  add column if not exists birth_year integer;

comment on column public.profiles.gender is 'male | female | other';
comment on column public.profiles.birth_year is 'Năm sinh VĐV — dùng suy age_band onboarding';

alter table public.pick_vn_player_ratings
  add column if not exists assessment_answers jsonb,
  add column if not exists suggested_rating numeric(3, 1);

create index if not exists pick_vn_player_ratings_assessment_idx
  on public.pick_vn_player_ratings
  using gin (assessment_answers);

-- Patch RPC: sync assessment + suggested fields
create or replace function public.pick_vn_sync_rating(p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_row jsonb;
begin
  if v_auth is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;

  if coalesce(p_row->>'authUserId', p_row->>'auth_user_id')::uuid is distinct from v_auth
     and not public.is_super_admin() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.pick_vn_player_ratings (
    id,
    auth_user_id,
    vpr_athlete_id,
    self_declared_rating,
    provisional_rating,
    verified_rating,
    current_rating,
    rating_status,
    rating_confidence,
    rating_match_count,
    last_rating_updated_at,
    rating_verified_by,
    rating_verification_note,
    rating_history,
    assessment_answers,
    suggested_rating,
    updated_at
  ) values (
    coalesce(p_row->>'id', 'pvn-rating-' || v_auth::text),
    coalesce((p_row->>'authUserId')::uuid, (p_row->>'auth_user_id')::uuid, v_auth),
    nullif(p_row->>'vprAthleteId', ''),
    nullif(p_row->>'selfDeclaredRating', '')::numeric,
    nullif(p_row->>'provisionalRating', '')::numeric,
    nullif(p_row->>'verifiedRating', '')::numeric,
    coalesce(nullif(p_row->>'currentRating', '')::numeric, 3.5),
    coalesce(p_row->>'ratingStatus', 'self_declared'),
    coalesce(nullif(p_row->>'ratingConfidence', '')::numeric, 0),
    coalesce(nullif(p_row->>'ratingMatchCount', '')::integer, 0),
    coalesce((p_row->>'lastRatingUpdatedAt')::timestamptz, now()),
    nullif(p_row->>'ratingVerifiedBy', '')::uuid,
    coalesce(p_row->>'ratingVerificationNote', ''),
    coalesce(p_row->'ratingHistory', '[]'::jsonb),
    coalesce(p_row->'assessmentAnswers', p_row->'assessment_answers'),
    nullif(p_row->>'suggestedRating', '')::numeric,
    now()
  )
  on conflict (auth_user_id) do update set
    vpr_athlete_id = excluded.vpr_athlete_id,
    self_declared_rating = excluded.self_declared_rating,
    provisional_rating = excluded.provisional_rating,
    verified_rating = excluded.verified_rating,
    current_rating = excluded.current_rating,
    rating_status = excluded.rating_status,
    rating_confidence = excluded.rating_confidence,
    rating_match_count = excluded.rating_match_count,
    last_rating_updated_at = excluded.last_rating_updated_at,
    rating_verified_by = excluded.rating_verified_by,
    rating_verification_note = excluded.rating_verification_note,
    rating_history = excluded.rating_history,
    assessment_answers = coalesce(excluded.assessment_answers, pick_vn_player_ratings.assessment_answers),
    suggested_rating = coalesce(excluded.suggested_rating, pick_vn_player_ratings.suggested_rating),
    updated_at = now();

  select to_jsonb(r.*) into v_row
  from public.pick_vn_player_ratings r
  where r.auth_user_id = coalesce((p_row->>'authUserId')::uuid, (p_row->>'auth_user_id')::uuid, v_auth);

  return jsonb_build_object('ok', true, 'record', v_row);
end;
$$;

grant execute on function public.pick_vn_sync_rating(jsonb) to authenticated;
