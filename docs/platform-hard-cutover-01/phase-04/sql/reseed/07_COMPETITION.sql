-- PLATFORM-HARD-CUTOVER-01 reseed step 07 — Competition SSOT
-- NOT EXECUTED. Requires M8 applied (text tenant_id).

INSERT INTO public.competition_ssot_competitions AS c (
  tenant_id, club_id, external_key, status, format_code, config
)
SELECT
  current_setting('app.reseed_tenant_id', true),
  current_setting('app.reseed_club_id', true),
  'hard-cutover-seed::' || current_setting('app.reseed_tenant_id', true) || '::competition::primary',
  'draft',
  'IND_POOL_KO',
  jsonb_build_object('seed', true, 'package', 'platform-hard-cutover-01')
WHERE current_setting('app.reseed_tenant_id', true) IS NOT NULL
  AND length(trim(current_setting('app.reseed_tenant_id', true))) > 0
ON CONFLICT (tenant_id, external_key) DO NOTHING;

-- VERIFY
-- SELECT id, external_key, status FROM public.competition_ssot_competitions
-- WHERE external_key LIKE 'hard-cutover-seed::%';
