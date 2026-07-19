/**
 * Phase 2B — Generate Production-safe Notification SQL packs from Staging sources.
 * Deterministic transform: strips Staging seeds, injects fail-closed Production config.
 * Does NOT connect to any database.
 *
 * Usage: node scripts/generate-notification-phase2b-production-sql.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const STAGING_REF = "qyewbxjsiiyufanzcjcq";

const PROD_RUNTIME_CONFIG_PHASE15 = `INSERT INTO public.notification_runtime_config (key, value, updated_at)
VALUES
  ('environment', 'production', now()),
  ('project_ref', '${PRODUCTION_REF}', now()),
  ('allow_qa_cleanup', 'false', now()),
  ('allow_worker', 'false', now()),
  ('live_delivery_enabled', 'false', now()),
  ('external_providers_enabled', 'false', now()),
  ('worker_concurrency', '0', now()),
  ('production_worker_enable', 'false', now()),
  ('production_rollout_approved', 'false', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();`;

const PROD_RUNTIME_CONFIG_PHASE16 = `INSERT INTO public.notification_runtime_config (key, value, updated_at)
VALUES
  ('environment', 'production', now()),
  ('project_ref', '${PRODUCTION_REF}', now()),
  ('allow_qa_cleanup', 'false', now()),
  ('allow_worker', 'false', now()),
  ('live_delivery_enabled', 'false', now()),
  ('external_providers_enabled', 'false', now()),
  ('worker_concurrency', '0', now()),
  ('production_worker_enable', 'false', now()),
  ('production_rollout_approved', 'false', now()),
  ('allow_replay', 'false', now()),
  ('allow_cancel', 'false', now()),
  ('allow_stale_lease_recovery', 'false', now()),
  ('max_replay_count', '3', now()),
  ('worker_heartbeat_stale_seconds', '120', now()),
  ('phase16_ops_enabled', 'true', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();`;

function assertSafe(out, dest) {
  if (out.includes(STAGING_REF)) {
    throw new Error(`${dest}: contains Staging project ref`);
  }
  if (/allow_worker',\s*'true'/i.test(out)) {
    throw new Error(`${dest}: allow_worker=true seed`);
  }
  if (/allow_qa_cleanup',\s*'true'/i.test(out)) {
    throw new Error(`${dest}: allow_qa_cleanup=true seed`);
  }
  if (/environment',\s*'staging'/i.test(out)) {
    throw new Error(`${dest}: environment=staging seed`);
  }
  if (/live_delivery_enabled',\s*'true'/i.test(out)) {
    throw new Error(`${dest}: live_delivery_enabled=true seed`);
  }
}

function write(destRel, contents) {
  assertSafe(contents, destRel);
  const dest = path.join(rootDir, destRel);
  fs.writeFileSync(dest, contents, "utf8");
  console.log(`Wrote ${destRel} (${contents.length} bytes)`);
}

function transformPhase13(src) {
  const body = src.replace(/^--[\s\S]*?(?=CREATE TABLE IF NOT EXISTS public\.notification_inbox)/m, "");
  return `-- PICK_VN Notification Phase 2B — Production Foundation (from Phase 1.3)
-- PRODUCTION ONLY. Project ref: ${PRODUCTION_REF}
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql
-- Dependencies: none (Notification-owned objects only)
-- Re-run: CREATE IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE safe
-- Transaction: apply as a single SQL Editor run; stop on first error
--
-- No Staging identifiers. No QA credentials. No sample jobs. No worker enablement.
-- Leaves legacy public.notifications intact for compatibility.

${body}`;
}

function transformHardening(src) {
  const body = src.replace(/^--[\s\S]*?(?=CREATE OR REPLACE FUNCTION)/m, "");
  return `-- PICK_VN Notification Phase 2B — Production RPC hardening
-- PRODUCTION ONLY. Project ref: ${PRODUCTION_REF}
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql
-- Dependencies: docs/supabase-notification-phase2b-production-13-foundation.sql
-- Re-run: CREATE OR REPLACE safe
-- Fail-closed: tenant_id mandatory; no first-tenant / first-venue fallback.
-- NEVER apply Staging QA profile bootstrap SQL to Production.

${body}`;
}

function transformPhase15(src) {
  let out = src;
  out = out.replace(
    /^--[\s\S]*?(?=CREATE TABLE IF NOT EXISTS public\.notification_runtime_config)/m,
    `-- PICK_VN Notification Phase 2B — Production Delivery Worker Schema (from Phase 1.5)
-- PRODUCTION ONLY. Project ref: ${PRODUCTION_REF}
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql
-- Dependencies: production-13-foundation + production-13-rpc-hardening
-- Re-run: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT config upsert safe
--
-- FAIL-CLOSED seeds: environment=production, allow_worker=false, allow_qa_cleanup=false,
-- live_delivery_enabled=false, external_providers_enabled=false, worker_concurrency=0
-- Live Email/SMS/Zalo/Web Push are NOT enabled by this migration.

`
  );
  out = out.replace(
    /INSERT INTO public\.notification_runtime_config[\s\S]*?ON CONFLICT \(key\) DO UPDATE[\s\S]*?updated_at = now\(\);/,
    PROD_RUNTIME_CONFIG_PHASE15
  );
  out = out.split(STAGING_REF).join(PRODUCTION_REF);
  return out;
}

function transformPhase16(src) {
  let out = src;
  out = out.replace(
    /^--[\s\S]*?(?=INSERT INTO public\.notification_runtime_config)/m,
    `-- PICK_VN Notification Phase 2B — Production Ops Schema (from Phase 1.6)
-- PRODUCTION ONLY. Project ref: ${PRODUCTION_REF}
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql
-- Dependencies: docs/supabase-notification-phase2b-production-15-delivery-worker.sql
-- Re-run: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT config upsert safe
--
-- FAIL-CLOSED seeds: allow_worker=false, allow_qa_cleanup=false, allow_replay=false,
-- allow_cancel=false, allow_stale_lease_recovery=false, live_delivery_enabled=false
-- Environment column DEFAULT = production. No Staging seeds. No QA cleanup enablement.
-- Live Email/SMS/Zalo/Web Push remain disabled. Worker remains structurally disabled.

`
  );
  out = out.replace(
    /INSERT INTO public\.notification_runtime_config[\s\S]*?ON CONFLICT \(key\) DO UPDATE[\s\S]*?updated_at = now\(\);/,
    PROD_RUNTIME_CONFIG_PHASE16
  );

  // Production pack defaults environment to production (not staging)
  out = out.replace(
    /public\.notification_runtime_config_get\('environment'\),\s*'staging'/g,
    "public.notification_runtime_config_get('environment'),\n  'production'"
  );
  out = out.replace(
    /ALTER COLUMN environment SET DEFAULT 'staging';/g,
    "ALTER COLUMN environment SET DEFAULT 'production';"
  );
  out = out.replace(
    /v_env := coalesce\(public\.notification_runtime_config_get\('environment'\), 'staging'\);/g,
    "v_env := coalesce(public.notification_runtime_config_get('environment'), 'production');"
  );
  out = out.replace(
    /coalesce\(([^,]+),\s*'staging'\)/g,
    (match, expr) => {
      // Only rewrite environment-related coalesces that still say staging
      if (/environment|v_env|p_environment/i.test(expr) || /notification_runtime_config_get/i.test(expr)) {
        return `coalesce(${expr}, 'production')`;
      }
      return match;
    }
  );

  out = out.split(STAGING_REF).join(PRODUCTION_REF);

  // Fail-closed Production claim: require tenant + namespace when runtime env is production
  if (!out.includes("tenant_scope_required")) {
    const claimGuard = `
  -- Phase 2B: Production claim requires explicit tenant + namespace (no open claim)
  IF coalesce(public.notification_runtime_config_get('environment'), 'production') = 'production' THEN
    IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 THEN
      RAISE EXCEPTION 'tenant_scope_required';
    END IF;
    IF p_run_namespace IS NULL OR length(trim(p_run_namespace)) = 0 THEN
      RAISE EXCEPTION 'namespace_scope_required';
    END IF;
  END IF;
`;
    const replaced = out.replace(
      /RAISE EXCEPTION 'worker_disabled';\s*END IF;/i,
      `RAISE EXCEPTION 'worker_disabled';\n  END IF;\n${claimGuard}`
    );
    if (replaced === out) {
      throw new Error("phase16 transform: could not inject Production claim scope guard");
    }
    out = replaced;
  }

  return out;
}

function main() {
  const map = [
    ["docs/supabase-notification-phase13.sql", "docs/supabase-notification-phase2b-production-13-foundation.sql", transformPhase13],
    ["docs/supabase-notification-phase13-rpc-hardening.sql", "docs/supabase-notification-phase2b-production-13-rpc-hardening.sql", transformHardening],
    ["docs/supabase-notification-phase15.sql", "docs/supabase-notification-phase2b-production-15-delivery-worker.sql", transformPhase15],
    ["docs/supabase-notification-phase16.sql", "docs/supabase-notification-phase2b-production-16-ops.sql", transformPhase16],
  ];

  for (const [srcRel, destRel, fn] of map) {
    const src = fs.readFileSync(path.join(rootDir, srcRel), "utf8");
    write(destRel, fn(src));
  }

  // Dedicated runtime-config-only pack (idempotent re-apply / remediation)
  write(
    "docs/supabase-notification-phase2b-production-runtime-config.sql",
    `-- PICK_VN Notification Phase 2B — Production runtime config (fail-closed)
-- PRODUCTION ONLY. Project ref: ${PRODUCTION_REF}
-- Rollback: docs/supabase-notification-phase2b-production-rollback.sql (config section)
-- Dependencies: notification_runtime_config table (from production-15)
-- Re-run: ON CONFLICT upsert safe
-- Transaction: single statement batch; stop on first error
--
-- Mandatory Production defaults — NEVER inherit Staging values.
-- Worker remains disabled until a FUTURE phase sets BOTH:
--   production_worker_enable=true AND production_rollout_approved=true
-- (Phase 2B does NOT enable the worker.)

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_runtime_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_runtime_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_runtime_config_no_client ON public.notification_runtime_config;
CREATE POLICY notification_runtime_config_no_client ON public.notification_runtime_config
  FOR ALL
  USING (false)
  WITH CHECK (false);

${PROD_RUNTIME_CONFIG_PHASE16}

-- Guard: refuse if Staging namespace markers somehow appear as config values
DO $$
DECLARE
  v_env text;
  v_worker text;
  v_cleanup text;
  v_ref text;
BEGIN
  SELECT value INTO v_env FROM public.notification_runtime_config WHERE key = 'environment';
  SELECT value INTO v_worker FROM public.notification_runtime_config WHERE key = 'allow_worker';
  SELECT value INTO v_cleanup FROM public.notification_runtime_config WHERE key = 'allow_qa_cleanup';
  SELECT value INTO v_ref FROM public.notification_runtime_config WHERE key = 'project_ref';

  IF coalesce(v_env, '') <> 'production' THEN
    RAISE EXCEPTION 'phase2b_config_invalid_environment: %', v_env;
  END IF;
  IF coalesce(v_worker, 'true') <> 'false' THEN
    RAISE EXCEPTION 'phase2b_config_worker_must_be_false';
  END IF;
  IF coalesce(v_cleanup, 'true') <> 'false' THEN
    RAISE EXCEPTION 'phase2b_config_qa_cleanup_must_be_false';
  END IF;
  IF coalesce(v_ref, '') <> '${PRODUCTION_REF}' THEN
    RAISE EXCEPTION 'phase2b_config_invalid_project_ref: %', v_ref;
  END IF;
END $$;

COMMIT;
`
  );

  // Manifest / ordered apply index
  write(
    "docs/supabase-notification-phase2b-production-pack.sql",
    `-- PICK_VN Notification Phase 2B — Production SQL Pack MANIFEST
-- PRODUCTION ONLY. Project ref: ${PRODUCTION_REF}
-- DO NOT execute this file as SQL — it is an ordered index.
-- Apply via: node scripts/apply-notification-phase2b-production-sql.mjs --dry-run
-- Explicit apply: NOTIFICATION_PHASE2B_PRODUCTION_GO=1 ... --apply
--
-- Ordered apply (deterministic):
--   1. docs/supabase-notification-phase2b-production-13-foundation.sql
--   2. docs/supabase-notification-phase2b-production-13-rpc-hardening.sql
--   3. docs/supabase-notification-phase2b-production-15-delivery-worker.sql
--   4. docs/supabase-notification-phase2b-production-16-ops.sql
--   5. docs/supabase-notification-phase2b-production-runtime-config.sql  (re-assert fail-closed)
--   6. docs/supabase-notification-phase2b-production-security-hardening.sql
--
-- NEVER apply:
--   Staging QA profile bootstrap SQL
--   Staging phase15/phase16 SQL (seeds allow_worker/allow_qa_cleanup=true)
--
-- Rollback:
--   docs/supabase-notification-phase2b-production-rollback.sql
--
-- Verify:
--   node scripts/verify-notification-phase2b-production.mjs
`
  );

  console.log("Phase 2B Production SQL generation complete.");
}

main();
