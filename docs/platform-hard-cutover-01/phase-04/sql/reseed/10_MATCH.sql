-- PLATFORM-HARD-CUTOVER-01 reseed step 10 — Match
-- NOT EXECUTED. Unique (competition_id, match_key).

INSERT INTO public.competition_ssot_matches (
  competition_id, tenant_id, match_key, round_key, status, side_a, side_b
)
SELECT
  c.id,
  c.tenant_id,
  'hard-cutover-seed::match::m1',
  'R1',
  'scheduled',
  '[{"player_id":"hard-cutover-seed-player-p1"}]'::jsonb,
  '[{"player_id":"hard-cutover-seed-player-p2"}]'::jsonb
FROM public.competition_ssot_competitions c
WHERE c.external_key =
  'hard-cutover-seed::' || c.tenant_id || '::competition::primary'
ON CONFLICT (competition_id, match_key) DO NOTHING;
