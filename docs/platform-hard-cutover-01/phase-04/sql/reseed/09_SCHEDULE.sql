-- PLATFORM-HARD-CUTOVER-01 reseed step 09 — Schedule anchors
-- NOT EXECUTED. Schedule metadata on competition config (no separate schedule SoT invent).

UPDATE public.competition_ssot_competitions c
SET
  config = coalesce(c.config, '{}'::jsonb) || jsonb_build_object(
    'schedule_seed_key',
    'hard-cutover-seed::' || c.tenant_id || '::schedule::primary',
    'scheduled_window',
    jsonb_build_object('from', '2030-01-01T00:00:00Z', 'to', '2030-01-02T00:00:00Z')
  ),
  updated_at = now()
WHERE c.external_key =
  'hard-cutover-seed::' || c.tenant_id || '::competition::primary'
  AND coalesce(c.config->>'schedule_seed_key', '') = '';
