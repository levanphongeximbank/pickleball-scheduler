-- Phase 16 KN-6 — Staging cross-tenant seed for qr_tokens / checkins RLS QA
-- Project: qyewbxjsiiyufanzcjcq ONLY — không chạy production.
--
-- Prerequisites:
--   1. docs/supabase-phase16-kn6-qr-checkins-rls.sql applied
--   2. venues venue-staging-a / venue-staging-b exist (Phase 10E)
--
-- Run in SQL Editor as postgres (bypasses RLS).

-- Fixed token hashes for JWT verify script probes
INSERT INTO public.qr_tokens (
  id,
  tenant_id,
  entity_type,
  entity_id,
  tournament_id,
  token_hash,
  expires_at
) VALUES
  (
    '00000000-0000-4000-8000-0000000000a1',
    'venue-staging-a',
    'player',
    'phase16-seed-player-a',
    'tournament-seed-a',
    'phase16kn6seedhash000000000000000000000000000000000000000000000000a1',
    now() + interval '30 days'
  ),
  (
    '00000000-0000-4000-8000-0000000000b1',
    'venue-staging-b',
    'player',
    'phase16-seed-player-b',
    'tournament-seed-b',
    'phase16kn6seedhash000000000000000000000000000000000000000000000000b1',
    now() + interval '30 days'
  )
ON CONFLICT (token_hash) DO UPDATE SET
  tenant_id = excluded.tenant_id,
  entity_id = excluded.entity_id,
  expires_at = excluded.expires_at,
  revoked_at = null;

INSERT INTO public.checkins (
  id,
  tenant_id,
  tournament_id,
  club_id,
  entity_type,
  entity_id,
  source,
  status,
  note
) VALUES
  (
    '00000000-0000-4000-8000-0000000000a2',
    'venue-staging-a',
    'tournament-seed-a',
    null,
    'player',
    'phase16-seed-player-a',
    'seed',
    'checked_in',
    'Phase 16 KN-6 seed tenant A'
  ),
  (
    '00000000-0000-4000-8000-0000000000b2',
    'venue-staging-b',
    'tournament-seed-b',
    null,
    'player',
    'phase16-seed-player-b',
    'seed',
    'checked_in',
    'Phase 16 KN-6 seed tenant B'
  )
ON CONFLICT (tenant_id, tournament_id, entity_type, entity_id, status) DO UPDATE SET
  note = excluded.note;

-- Verify seed (service role / SQL editor):
-- select tenant_id, entity_id, token_hash from public.qr_tokens
-- where token_hash like 'phase16kn6seedhash%'
-- order by tenant_id;
