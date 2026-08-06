-- =============================================================================
-- OPERATION B1B — WP1 Schema and Migration Package
-- Object: public.qa_identity_quarantines
-- Status: AUTHORED ONLY — NOT APPLIED.
-- Do not apply to Staging or Production without a separate Owner GO (WP6+).
--
-- Scope (WP1 only):
--   - Additive table, CHECKs, FKs, indexes
--   - Immutable-field BEFORE UPDATE guard (applies to service_role)
--   - Normal-operation hard-delete denial
--
-- Explicitly deferred to WP2+:
--   - RLS policies
--   - Product runtime grants / SECURITY DEFINER lifecycle RPCs
--   - Canonical read view/RPC / runtime adapters
--
-- Preservation:
--   PROFILES_STATUS_CHANGE_REQUIRED=NO
--   PROFILES_STATUS_CHECK_CHANGE_REQUIRED=NO
--   PROFILE_STATUS_RUNTIME_SEMANTICS_PRESERVED=YES
--   No auth_ban_applied column.
--
-- Retired authority (non-reusable):
--   OLD_OWNER_GO_REUSABLE=NO
--   OLD_BATCH_REUSABLE=NO
--   EXECUTION_AUTHORIZED=NO
--   PRODUCTION_GO=NO
-- =============================================================================

SET search_path = public, pg_temp;

-- gen_random_uuid() is already used widely in this repository; ensure availability.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Fail-closed preflight: refuse incompatible pre-existing authority objects
-- -----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_has_auth_ban_applied boolean;
  v_missing_required text;
BEGIN
  IF to_regclass('public.qa_identity_quarantines') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'qa_identity_quarantines'
        AND c.column_name = 'auth_ban_applied'
    )
    INTO v_has_auth_ban_applied;

    IF v_has_auth_ban_applied THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: auth_ban_applied column is forbidden'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT string_agg(required.col, ', ' ORDER BY required.col)
    INTO v_missing_required
    FROM (
      VALUES
        ('id'),
        ('profile_id'),
        ('auth_user_id'),
        ('venue_id'),
        ('batch_id'),
        ('source_operation'),
        ('allowlist_sha256'),
        ('snapshot_sha256'),
        ('lifecycle_state'),
        ('auth_ban_state'),
        ('reason'),
        ('created_at'),
        ('created_by'),
        ('activated_at'),
        ('released_at'),
        ('released_by'),
        ('release_reason'),
        ('failure_classification'),
        ('lifecycle_version'),
        ('original_profile_status'),
        ('original_auth_banned'),
        ('expected_email'),
        ('allowlist_label'),
        ('metadata'),
        ('updated_at')
    ) AS required(col)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'qa_identity_quarantines'
        AND c.column_name = required.col
    );

    IF v_missing_required IS NOT NULL THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: missing required columns: %',
        v_missing_required
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END
$preflight$;

-- -----------------------------------------------------------------------------
-- Canonical table (additive). Does not alter public.profiles.
-- profiles.id is uuid; profiles.venue_id is text (repository contract).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_identity_quarantines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  auth_user_id uuid NOT NULL,
  venue_id text NULL,
  batch_id uuid NOT NULL,
  source_operation text NOT NULL,
  allowlist_sha256 text NULL,
  snapshot_sha256 text NULL,
  lifecycle_state text NOT NULL DEFAULT 'pending',
  auth_ban_state text NOT NULL DEFAULT 'pending',
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  activated_at timestamptz NULL,
  released_at timestamptz NULL,
  released_by text NULL,
  release_reason text NULL,
  failure_classification text NULL,
  lifecycle_version integer NOT NULL DEFAULT 1,
  original_profile_status text NOT NULL,
  original_auth_banned boolean NOT NULL,
  expected_email text NOT NULL,
  allowlist_label text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qa_identity_quarantines IS
  'OPERATION_B1B WP1: sole future canonical QA quarantine authority. NOT runtime-ready until WP2 (RLS + controlled writers). Does not alter profiles.status / profiles_status_check.';

COMMENT ON COLUMN public.qa_identity_quarantines.auth_ban_state IS
  'Auth ban lifecycle: pending | applied | not_required_preexisting | reverted | failed. Replaces retired auth_ban_applied boolean.';

COMMENT ON COLUMN public.qa_identity_quarantines.lifecycle_state IS
  'Authority lifecycle: pending | active | released | failed. No lifecycle_state=reverted (reverted belongs only to auth_ban_state).';

-- -----------------------------------------------------------------------------
-- Named CHECK constraints (idempotent; fail closed on incompatible definition)
-- -----------------------------------------------------------------------------
DO $constraints$
DECLARE
  v_def text;
BEGIN
  -- 1) lifecycle_state domain
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_lifecycle_state_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_lifecycle_state_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'pending' OR v_def !~* 'active' OR v_def !~* 'released' OR v_def !~* 'failed'
       OR v_def ~* '''reverted''' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: lifecycle_state_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_lifecycle_state_check
      CHECK (lifecycle_state IN ('pending', 'active', 'released', 'failed'));
  END IF;

  -- 2) auth_ban_state domain
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_auth_ban_state_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_auth_ban_state_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'pending'
       OR v_def !~* 'applied'
       OR v_def !~* 'not_required_preexisting'
       OR v_def !~* 'reverted'
       OR v_def !~* 'failed' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: auth_ban_state_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_auth_ban_state_check
      CHECK (
        auth_ban_state IN (
          'pending',
          'applied',
          'not_required_preexisting',
          'reverted',
          'failed'
        )
      );
  END IF;

  -- 3) identity bind: profile_id = auth_user_id
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_identity_bind_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_identity_bind_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'profile_id\s*=\s*auth_user_id' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: identity_bind_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_identity_bind_check
      CHECK (profile_id = auth_user_id);
  END IF;

  -- 4) non-empty trimmed reason
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_reason_nonempty_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_reason_nonempty_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'length\s*\(\s*trim\s*\(\s*reason\s*\)\s*\)\s*>\s*0' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: reason_nonempty_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_reason_nonempty_check
      CHECK (length(trim(reason)) > 0);
  END IF;

  -- 5) original_profile_status domain (no quarantined)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_original_status_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_original_status_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'active' OR v_def !~* 'suspended' OR v_def !~* 'invited'
       OR v_def ~* 'quarantined' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: original_status_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_original_status_check
      CHECK (original_profile_status IN ('active', 'suspended', 'invited'));
  END IF;

  -- 6) lifecycle_version >= 1
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_lifecycle_version_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_lifecycle_version_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'lifecycle_version\s*>=\s*1' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: lifecycle_version_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_lifecycle_version_check
      CHECK (lifecycle_version >= 1);
  END IF;

  -- 7) metadata must be a JSON object
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_metadata_object_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_metadata_object_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'jsonb_typeof\s*\(\s*metadata\s*\)\s*=\s*''object''' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: metadata_object_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_metadata_object_check
      CHECK (jsonb_typeof(metadata) = 'object');
  END IF;

  -- 8) active success invariant
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_active_success_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_active_success_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'active'
       OR v_def !~* 'applied'
       OR v_def !~* 'not_required_preexisting'
       OR v_def !~* 'activated_at' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: active_success_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_active_success_check
      CHECK (
        (lifecycle_state <> 'active')
        OR (
          auth_ban_state IN ('applied', 'not_required_preexisting')
          AND activated_at IS NOT NULL
        )
      );
  END IF;

  -- 9) pending consistency (named pending_auth_check per data model)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_pending_auth_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_pending_auth_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'pending' OR v_def !~* 'activated_at' OR v_def !~* 'released_at' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: pending_auth_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_pending_auth_check
      CHECK (
        (lifecycle_state <> 'pending')
        OR (
          auth_ban_state = 'pending'
          AND activated_at IS NULL
          AND released_at IS NULL
          AND released_by IS NULL
        )
      );
  END IF;

  -- 10) release consistency
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_release_consistency_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_release_consistency_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'released'
       OR v_def !~* 'activated_at'
       OR v_def !~* 'released_at'
       OR v_def !~* 'released_by' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: release_consistency_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_release_consistency_check
      CHECK (
        (lifecycle_state <> 'released')
        OR (
          activated_at IS NOT NULL
          AND released_at IS NOT NULL
          AND released_by IS NOT NULL
          AND auth_ban_state IN ('applied', 'not_required_preexisting')
        )
      );
  END IF;

  -- 11) compensated failure: auth_ban_state='reverted' => lifecycle_state='failed'
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_reverted_failure_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_reverted_failure_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'reverted' OR v_def !~* 'failed' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: reverted_failure_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_reverted_failure_check
      CHECK (
        (auth_ban_state <> 'reverted')
        OR (lifecycle_state = 'failed')
      );
  END IF;

  -- 12) auth_ban_state='failed' must not create an active authority row
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_failed_auth_not_active_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_failed_auth_not_active_check'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'failed' OR v_def !~* 'active' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: failed_auth_not_active_check definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_failed_auth_not_active_check
      CHECK (
        (auth_ban_state <> 'failed')
        OR (lifecycle_state <> 'active')
      );
  END IF;
END
$constraints$;

-- -----------------------------------------------------------------------------
-- Foreign keys (ON DELETE RESTRICT / fail-closed). Idempotent + definition guard.
-- -----------------------------------------------------------------------------
DO $fks$
DECLARE
  v_def text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_profile_id_fkey'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_profile_id_fkey'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'FOREIGN KEY \(profile_id\) REFERENCES (public\.)?profiles\(id\)'
       OR v_def ~* 'ON DELETE CASCADE' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: profile_id_fkey definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_profile_id_fkey
      FOREIGN KEY (profile_id)
      REFERENCES public.profiles (id)
      ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_auth_user_id_fkey'
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  ) THEN
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conname = 'qa_identity_quarantines_auth_user_id_fkey'
      AND conrelid = 'public.qa_identity_quarantines'::regclass;
    IF v_def !~* 'FOREIGN KEY \(auth_user_id\) REFERENCES auth\.users\(id\)'
       OR v_def ~* 'ON DELETE CASCADE' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINES_INCOMPATIBLE: auth_user_id_fkey definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    ALTER TABLE public.qa_identity_quarantines
      ADD CONSTRAINT qa_identity_quarantines_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users (id)
      ON DELETE RESTRICT;
  END IF;
END
$fks$;

-- -----------------------------------------------------------------------------
-- Indexes
-- Unique partial active-by-profile also satisfies set-based active profile_id
-- directory/list reads; no redundant non-unique active profile_id index.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS qa_identity_quarantines_active_profile_uidx
  ON public.qa_identity_quarantines (profile_id)
  WHERE lifecycle_state = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS qa_identity_quarantines_active_auth_uidx
  ON public.qa_identity_quarantines (auth_user_id)
  WHERE lifecycle_state = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS qa_identity_quarantines_pending_profile_batch_uidx
  ON public.qa_identity_quarantines (profile_id, batch_id)
  WHERE lifecycle_state = 'pending';

CREATE INDEX IF NOT EXISTS qa_identity_quarantines_batch_lifecycle_idx
  ON public.qa_identity_quarantines (batch_id, lifecycle_state);

CREATE INDEX IF NOT EXISTS qa_identity_quarantines_lifecycle_created_at_idx
  ON public.qa_identity_quarantines (lifecycle_state, created_at DESC);

-- -----------------------------------------------------------------------------
-- Immutable-field enforcement (BEFORE UPDATE; no service_role exemption)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_identity_quarantines_immutable_fields_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.venue_id IS DISTINCT FROM OLD.venue_id
     OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
     OR NEW.source_operation IS DISTINCT FROM OLD.source_operation
     OR NEW.allowlist_sha256 IS DISTINCT FROM OLD.allowlist_sha256
     OR NEW.snapshot_sha256 IS DISTINCT FROM OLD.snapshot_sha256
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.original_profile_status IS DISTINCT FROM OLD.original_profile_status
     OR NEW.original_auth_banned IS DISTINCT FROM OLD.original_auth_banned
     OR NEW.expected_email IS DISTINCT FROM OLD.expected_email
     OR NEW.allowlist_label IS DISTINCT FROM OLD.allowlist_label
  THEN
    RAISE EXCEPTION 'QA_IDENTITY_QUARANTINE_IMMUTABLE_FIELD'
      USING ERRCODE = 'P0001',
            DETAIL = 'Immutable QA quarantine authority fields cannot be updated (including via service_role).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_identity_quarantines_immutable_fields_trg
  ON public.qa_identity_quarantines;

CREATE TRIGGER qa_identity_quarantines_immutable_fields_trg
  BEFORE UPDATE ON public.qa_identity_quarantines
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_identity_quarantines_immutable_fields_guard();

COMMENT ON FUNCTION public.qa_identity_quarantines_immutable_fields_guard() IS
  'OPERATION_B1B WP1: reject mutation of immutable quarantine authority fields. No role exemption (service_role included).';

-- -----------------------------------------------------------------------------
-- Normal-operation hard-delete denial (append-only history retention)
-- No unbounded destructive bypass is created in WP1.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_identity_quarantines_deny_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'QA_IDENTITY_QUARANTINE_HARD_DELETE_DENIED'
    USING ERRCODE = 'P0001',
          DETAIL = 'Hard DELETE of qa_identity_quarantines is forbidden for normal operations. Released/failed/reverted history is append-only.';
END;
$$;

DROP TRIGGER IF EXISTS qa_identity_quarantines_deny_hard_delete_trg
  ON public.qa_identity_quarantines;

CREATE TRIGGER qa_identity_quarantines_deny_hard_delete_trg
  BEFORE DELETE ON public.qa_identity_quarantines
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_identity_quarantines_deny_hard_delete();

COMMENT ON FUNCTION public.qa_identity_quarantines_deny_hard_delete() IS
  'OPERATION_B1B WP1: deny normal-operation hard DELETE of quarantine authority rows. Archival requires separate governance.';

-- Narrow function ACL (not product runtime table grants / not RLS).
REVOKE ALL ON FUNCTION public.qa_identity_quarantines_immutable_fields_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_identity_quarantines_immutable_fields_guard() FROM anon;
REVOKE ALL ON FUNCTION public.qa_identity_quarantines_immutable_fields_guard() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_identity_quarantines_deny_hard_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_identity_quarantines_deny_hard_delete() FROM anon;
REVOKE ALL ON FUNCTION public.qa_identity_quarantines_deny_hard_delete() FROM authenticated;

-- Fail-closed table posture marker: no anon/authenticated direct DML grants in WP1.
-- Full RLS + controlled writers belong to WP2. Table is not runtime-ready.
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM PUBLIC;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM anon;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM authenticated;
