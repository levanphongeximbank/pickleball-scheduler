#!/usr/bin/env node
/**
 * COACHING-03 — Read-only Staging re-cert after provenance remediation.
 * No SQL apply. No fixture writes. databaseWrites must remain 0.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  COACHING_03_CANONICAL_TABLES,
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_TEST_PREFIX,
  getCoaching03RepoRoot,
  loadCoaching03StagingEnv,
  redactSecrets,
} from "../../src/features/coaching/staging/index.js";

const P = COACHING_03_TEST_PREFIX;

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

function rows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function first(body) {
  return rows(body)[0] || {};
}

async function countN(accessToken, query) {
  // SELECT-only. No DDL/DML. Explicitly wrap when supported.
  const body = await mgmtQuery(
    accessToken,
    `BEGIN TRANSACTION READ ONLY; ${query}; ROLLBACK;`
  );
  const list = rows(body);
  const row =
    [...list].reverse().find((r) => r && Object.prototype.hasOwnProperty.call(r, "n")) ||
    first(body);
  return Number(row.n ?? NaN);
}

async function main() {
  const repoRoot = getCoaching03RepoRoot();
  loadCoaching03StagingEnv({ repoRoot });
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN required");

  const startedAt = new Date().toISOString();
  const tableList = COACHING_03_CANONICAL_TABLES.map((t) => `'${t}'`).join(",");

  const tables = await countN(
    accessToken,
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY(ARRAY[${tableList}])`
  );
  const rls = await countN(
    accessToken,
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY(ARRAY[${tableList}]) AND c.relrowsecurity AND c.relforcerowsecurity`
  );
  const rpcs = await countN(
    accessToken,
    `SELECT count(DISTINCT p.proname)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('coaching_apply_attendance_correction','coaching_consume_entitlement','coaching_02_scope_allows','coaching_02_has_action')`
  );
  const immutable = await countN(
    accessToken,
    `SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('coaching_attendance_corrections_immutable_trg','coaching_package_usage_events_immutable_trg','coaching_evaluations_submitted_immutable_trg')`
  );
  const coach = await countN(
    accessToken,
    `SELECT count(*)::int AS n FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id WHERE rp.role_id='COACH' AND (p.module='coaching' OR p.id LIKE 'coaching.%')`
  );
  const player = await countN(
    accessToken,
    `SELECT count(*)::int AS n FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id WHERE rp.role_id='PLAYER' AND (p.module='coaching' OR p.id LIKE 'coaching.%')`
  );
  const fixture = await countN(
    accessToken,
    `SELECT (
  (SELECT count(*)::int FROM public.coaching_programs WHERE program_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_packages WHERE package_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_training_sessions WHERE session_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_attendance_records WHERE attendance_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_attendance_corrections WHERE correction_id LIKE '${P}%' OR attendance_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_package_entitlements WHERE entitlement_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_package_usage_events WHERE usage_event_id LIKE '${P}%' OR entitlement_id LIKE '${P}%') +
  (SELECT count(*)::int FROM public.coaching_evaluations WHERE evaluation_id LIKE '${P}%')
)::int AS n`
  );
  const tempGrants = await countN(
    accessToken,
    `SELECT count(*)::int AS n FROM public.role_permissions WHERE permission_id LIKE '${P}%' OR role_id LIKE '${P}%'`
  );

  const results = [
    { name: "schema.13_tables", ok: tables === 13, n: tables },
    { name: "schema.rls_enable_force", ok: rls === 13, n: rls },
    { name: "schema.rpc_helpers", ok: rpcs === 4, n: rpcs },
    { name: "schema.immutable_triggers", ok: immutable === 3, n: immutable },
    { name: "authz.coach_grants_zero", ok: coach === 0, n: coach },
    { name: "authz.player_grants_zero", ok: player === 0, n: player },
    { name: "fixture.residual_zero", ok: fixture === 0, n: fixture },
    {
      name: "authz.temporary_grants_residual_zero",
      ok: tempGrants === 0,
      n: tempGrants,
    },
  ];

  const ok = results.every((r) => r.ok);
  const report = {
    phase: "COACHING-03",
    artifact: "PROVENANCE_READONLY_RECERT",
    mode: "read-only",
    ok,
    stagingProjectRef: COACHING_03_STAGING_PROJECT_REF,
    productionTouched: false,
    databaseWrites: 0,
    sqlAppliedAgain: false,
    rollbackExecuted: false,
    readOnlyTransaction: true,
    checks: results,
    secretsPrinted: false,
    startedAt,
    finishedAt: new Date().toISOString(),
  };

  const dir = path.join(repoRoot, COACHING_03_EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "PROVENANCE_READONLY_RECERT.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: redactSecrets(err?.message || String(err)),
        databaseWrites: 0,
        sqlAppliedAgain: false,
        secretsPrinted: false,
      },
      null,
      2
    )
  );
  process.exit(1);
});
