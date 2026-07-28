-- PLATFORM-HARD-CUTOVER-01 reseed step 08 — Participants
-- NOT EXECUTED. Depends on competition + player.

INSERT INTO public.competition_ssot_participants (
  competition_id, tenant_id, player_id, seed, entry_status, meta
)
SELECT
  c.id,
  c.tenant_id,
  coalesce(nullif(current_setting('app.reseed_player_id', true), ''), 'hard-cutover-seed-player-p1'),
  1,
  'registered',
  jsonb_build_object(
    'seed_key',
    'hard-cutover-seed::' || c.tenant_id || '::participant::p1'
  )
FROM public.competition_ssot_competitions c
WHERE c.external_key =
  'hard-cutover-seed::' || c.tenant_id || '::competition::primary'
ON CONFLICT (competition_id, player_id) DO NOTHING;
