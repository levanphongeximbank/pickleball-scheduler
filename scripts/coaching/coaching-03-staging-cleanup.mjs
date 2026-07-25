#!/usr/bin/env node
/**
 * COACHING-03 — Fixture cleanup (Gate F).
 * Default: plan-only. Live: --execute (requires Owner GO).
 * Deletes only COACHING_03_CERT_FIXTURE_* rows. Idempotent.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_OWNER_GO_TOKEN,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_TEST_PREFIX,
  COACHING_03_VERDICTS,
  getCoaching03RepoRoot,
  loadCoaching03OwnerApprovalEvidence,
  loadCoaching03StagingEnv,
  redactSecrets,
} from "../../src/features/coaching/staging/index.js";

const P = COACHING_03_TEST_PREFIX;

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, COACHING_03_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

async function mgmtQuery(accessToken, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${COACHING_03_STAGING_PROJECT_REF}/database/query`,
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
    throw new Error(
      redactSecrets(body?.message || body?.error || `HTTP ${res.status}`)
    );
  }
  return body;
}

function first(body) {
  const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  return rows[0] || {};
}

async function residualCount(accessToken) {
  const body = await mgmtQuery(
    accessToken,
    `
SET row_security = off;
SELECT
  (SELECT count(*)::int FROM public.coaching_programs WHERE program_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_packages WHERE package_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_training_sessions WHERE session_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_attendance_records WHERE attendance_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_attendance_corrections WHERE correction_id LIKE '${P}%' OR attendance_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_package_entitlements WHERE entitlement_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_package_usage_events WHERE usage_event_id LIKE '${P}%' OR entitlement_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_evaluations WHERE evaluation_id LIKE '${P}%')
AS n;
`
  );
  return Number(first(body).n || 0);
}

async function cleanupOnce(accessToken) {
  await mgmtQuery(
    accessToken,
    `
SET row_security = off;
ALTER TABLE public.coaching_attendance_corrections
  DISABLE TRIGGER coaching_attendance_corrections_immutable_trg;
ALTER TABLE public.coaching_package_usage_events
  DISABLE TRIGGER coaching_package_usage_events_immutable_trg;
ALTER TABLE public.coaching_evaluations
  DISABLE TRIGGER coaching_evaluations_submitted_immutable_trg;

DELETE FROM public.coaching_attendance_corrections WHERE correction_id LIKE '${P}%' OR attendance_id LIKE '${P}%';
DELETE FROM public.coaching_package_usage_events WHERE usage_event_id LIKE '${P}%' OR entitlement_id LIKE '${P}%';
DELETE FROM public.coaching_evaluations WHERE evaluation_id LIKE '${P}%';
DELETE FROM public.coaching_attendance_records WHERE attendance_id LIKE '${P}%';
DELETE FROM public.coaching_package_entitlements WHERE entitlement_id LIKE '${P}%';
DELETE FROM public.coaching_training_sessions WHERE session_id LIKE '${P}%';
DELETE FROM public.coaching_packages WHERE package_id LIKE '${P}%';
DELETE FROM public.coaching_programs WHERE program_id LIKE '${P}%';

ALTER TABLE public.coaching_attendance_corrections
  ENABLE TRIGGER coaching_attendance_corrections_immutable_trg;
ALTER TABLE public.coaching_package_usage_events
  ENABLE TRIGGER coaching_package_usage_events_immutable_trg;
ALTER TABLE public.coaching_evaluations
  ENABLE TRIGGER coaching_evaluations_submitted_immutable_trg;
`
  );
}

async function main() {
  const repoRoot = getCoaching03RepoRoot();
  const execute = process.argv.includes("--execute");
  loadCoaching03StagingEnv({ repoRoot });

  if (!execute) {
    const report = {
      phase: "COACHING-03",
      script: "coaching-03-staging-cleanup",
      mode: "plan-only",
      ok: true,
      fixturePrefix: P,
      databaseWrites: 0,
      secretsPrinted: false,
      finishedAt: new Date().toISOString(),
    };
    writeEvidence(repoRoot, "CLEANUP_PLAN.json", report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const approval = loadCoaching03OwnerApprovalEvidence(repoRoot);
  const ownerGo = String(process.env.COACHING_03_OWNER_GO || "").trim();
  if (!approval.ok || ownerGo !== COACHING_03_OWNER_GO_TOKEN) {
    const blocked = {
      ok: false,
      verdict: COACHING_03_VERDICTS.STAGING_CERTIFIED_CLEANUP_BLOCKED,
      message: "Cleanup --execute requires Owner approval + COACHING_03_OWNER_GO.",
      secretsPrinted: false,
    };
    writeEvidence(repoRoot, "CLEANUP_REFUSED.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exit(1);
  }

  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN required");

  const startedAt = new Date().toISOString();
  const before = await residualCount(accessToken);
  await cleanupOnce(accessToken);
  const afterFirst = await residualCount(accessToken);
  await cleanupOnce(accessToken);
  const afterSecond = await residualCount(accessToken);

  const tempGrantResidual = Number(
    first(
      await mgmtQuery(
        accessToken,
        `SELECT count(*)::int AS n FROM public.role_permissions
         WHERE permission_id LIKE '${P}%' OR role_id LIKE '${P}%'`
      )
    ).n || 0
  );

  const ok = afterFirst === 0 && afterSecond === 0 && tempGrantResidual === 0;
  const report = {
    phase: "COACHING-03",
    script: "coaching-03-staging-cleanup",
    mode: "execute",
    ok,
    verdict: ok
      ? "COACHING_03_FIXTURE_CLEANUP_PASS"
      : COACHING_03_VERDICTS.STAGING_CERTIFIED_CLEANUP_BLOCKED,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    productionTouched: false,
    fixturePrefix: P,
    residualBefore: before,
    residualAfterFirst: afterFirst,
    residualAfterSecond: afterSecond,
    temporaryRoleGrantResidual: tempGrantResidual,
    idempotent: afterFirst === afterSecond,
    sharedQaPrincipalsDeleted: false,
    schemaDropped: false,
    secretsPrinted: false,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  writeEvidence(repoRoot, "CLEANUP_LIVE.json", report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        verdict: COACHING_03_VERDICTS.STAGING_CERTIFIED_CLEANUP_BLOCKED,
        error: redactSecrets(err?.message || String(err)),
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
