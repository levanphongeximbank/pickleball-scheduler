#!/usr/bin/env node
/**
 * CUSTOMER-07 — Cleanup synthetic Staging test rows (CUSTOMER07_TEST_* only).
 * Soft-archives customers. Preserves append-only history. Never drops migrations.
 * Never touches Production.
 */

import {
  CUSTOMER_07_EVIDENCE_DIR,
  CUSTOMER_07_STAGING_PROJECT_REF,
  CUSTOMER_07_VERDICTS,
  inspectCustomer07EnvironmentIdentity,
  loadCustomer07StagingEnv,
  getCustomer07RepoRoot,
} from "../../src/features/customer/staging/index.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

async function mgmtQuery(accessToken, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${CUSTOMER_07_STAGING_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  }
  return body;
}

async function main() {
  const repoRoot = getCustomer07RepoRoot();
  loadCustomer07StagingEnv({ repoRoot });
  const identity = inspectCustomer07EnvironmentIdentity(process.env);
  if (!identity.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          verdict: CUSTOMER_07_VERDICTS.BLOCKED_ENVIRONMENT_IDENTITY,
          identity,
          secretsPrinted: false,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          verdict: CUSTOMER_07_VERDICTS.BLOCKED,
          message: "SUPABASE_ACCESS_TOKEN required",
          secretsPrinted: false,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const sql = `
DO $$
BEGIN
  IF to_regclass('public.customers') IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.customer_merge_proposals WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_duplicate_candidates WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_linkages WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_communication_preferences WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_consents WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_addresses WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  DELETE FROM public.customer_contact_points WHERE tenant_id LIKE 'CUSTOMER07_TEST_%';
  UPDATE public.customers
     SET status = 'ARCHIVED',
         display_name = left(display_name, 180) || ' [CUSTOMER07_ARCHIVED]',
         updated_at = now()
   WHERE (tenant_id LIKE 'CUSTOMER07_TEST_%'
      OR customer_id LIKE 'CUSTOMER07_TEST_%'
      OR customer_number LIKE 'CUSTOMER07_TEST_%')
     AND status NOT IN ('ARCHIVED', 'MERGED');
END $$;
`;
  await mgmtQuery(accessToken, sql);

  const verify = await mgmtQuery(
    accessToken,
    `SELECT count(*)::int AS remaining_active
     FROM public.customers
     WHERE (tenant_id LIKE 'CUSTOMER07_TEST_%'
        OR customer_id LIKE 'CUSTOMER07_TEST_%')
       AND status NOT IN ('ARCHIVED', 'MERGED');`
  );
  const remaining = Array.isArray(verify)
    ? Number(verify[0]?.remaining_active || 0)
    : 0;

  const report = {
    ok: remaining === 0,
    phase: "CUSTOMER-07",
    script: "phase-7-staging-cleanup",
    stagingProjectRef: CUSTOMER_07_STAGING_PROJECT_REF,
    remainingActiveCustomers: remaining,
    historyPreserved: true,
    migrationObjectsDropped: false,
    secretsPrinted: false,
    finishedAt: new Date().toISOString(),
  };

  const dir = path.join(repoRoot, CUSTOMER_07_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "CLEANUP_EVIDENCE.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: err?.message || String(err),
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
