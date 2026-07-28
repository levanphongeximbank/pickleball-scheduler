-- PLATFORM-HARD-CUTOVER-01 Phase 4 — M8 Competition Remote SSOT (tables)
-- Canonical durable competition aggregate + match finalize pipeline.
-- Authoritative finalize writer: competition_ssot_finalize_match_result (40_RPC).
-- Tenant model: tenant_id text — matches public.venues.id + public.user_venue_id().
-- NOT applied by this PR. Staging rehearsal / Production require Owner GO.
-- If a prior uuid-typed apply left objects, run 90_ROLLBACK.sql first.

BEGIN;

CREATE TABLE IF NOT EXISTS public.competition_ssot_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  club_id text,
  external_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','active','suspended','completed','archived','cancelled')),
  format_code text NOT NULL DEFAULT 'IND_POOL_KO',
  config_version integer NOT NULL DEFAULT 1,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_key)
);

CREATE TABLE IF NOT EXISTS public.competition_ssot_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competition_ssot_competitions(id) ON DELETE CASCADE,
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  player_id text NOT NULL,
  seed integer,
  entry_status text NOT NULL DEFAULT 'registered'
    CHECK (entry_status IN ('registered','checked_in','withdrawn','disqualified')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.competition_ssot_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competition_ssot_competitions(id) ON DELETE CASCADE,
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  match_key text NOT NULL,
  round_key text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','score_pending','finalized','void','cancelled')),
  court_descriptor jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  side_a jsonb NOT NULL DEFAULT '[]'::jsonb,
  side_b jsonb NOT NULL DEFAULT '[]'::jsonb,
  working_score jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, match_key)
);

-- SINGLE finalized-result writer target (RPC-only inserts)
CREATE TABLE IF NOT EXISTS public.competition_ssot_finalized_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competition_ssot_competitions(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.competition_ssot_matches(id) ON DELETE CASCADE,
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  idempotency_key text NOT NULL,
  result_payload jsonb NOT NULL,
  winner_side text,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  finalized_by uuid,
  source text NOT NULL DEFAULT 'competition_ssot_finalize'
    CHECK (source IN ('competition_ssot_finalize','referee_pipeline','system_recovery')),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (match_id)
);

CREATE TABLE IF NOT EXISTS public.competition_ssot_standings_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competition_ssot_competitions(id) ON DELETE CASCADE,
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  snapshot_version integer NOT NULL,
  standings jsonb NOT NULL DEFAULT '[]'::jsonb,
  tiebreak_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, snapshot_version)
);

CREATE TABLE IF NOT EXISTS public.competition_ssot_command_log (
  id bigserial PRIMARY KEY,
  competition_id uuid NOT NULL REFERENCES public.competition_ssot_competitions(id) ON DELETE CASCADE,
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  command_type text NOT NULL,
  command_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.competition_ssot_audit_events (
  id bigserial PRIMARY KEY,
  competition_id uuid REFERENCES public.competition_ssot_competitions(id) ON DELETE SET NULL,
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competition_ssot_idempotency (
  tenant_id text NOT NULL
    CHECK (length(trim(tenant_id)) > 0),
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scope, idempotency_key)
);

COMMIT;
