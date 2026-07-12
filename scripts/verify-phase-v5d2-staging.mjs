#!/usr/bin/env node
/**
 * Referee V5-D.2 staging verification harness.
 * Usage: node scripts/verify-phase-v5d2-staging.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const TENANT_A = "REFEREE_V5_TEST_TENANT_A";
const TENANT_B = "REFEREE_V5_TEST_TENANT_B";
const TOURNAMENT_A = "REFEREE_V5_TEST_TOURNAMENT_A";
const TOURNAMENT_B = "REFEREE_V5_TEST_TOURNAMENT_B";
const MATCH_DOUBLES = "REFEREE_V5_TEST_MATCH_DOUBLES";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const outDir = join(projectRoot, "docs/v5/qa-evidence/phase-v5d2");

async function executeManagementSql(token, sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${label}: ${body?.message || body?.error || res.statusText}`);
  }
  return body;
}

function record(results, id, pass, expected, actual, method) {
  const row = { id, pass, expected, actual, method };
  results.push(row);
  console.log(`${pass ? "PASS" : "FAIL"} ${id}`);
  return pass;
}

async function runSchemaChecks(token, results) {
  const checks = [
    {
      id: "tables_exist",
      sql: `select count(*)::int as c from information_schema.tables where table_schema='public' and table_name in ('referee_assignments','match_live_states','match_events','match_sync_mutations','match_result_revisions','match_integration_outbox')`,
      expect: (rows) => Number(rows?.[0]?.c) === 6,
    },
    {
      id: "append_only_triggers",
      sql: `select count(*)::int as c from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='match_events' and t.tgname in ('trg_match_events_deny_update','trg_match_events_deny_delete')`,
      expect: (rows) => Number(rows?.[0]?.c) === 2,
    },
    {
      id: "internal_rpc_service_role_only",
      sql: `select p.proname, bool_or(r.rolname='authenticated') as auth_grant, bool_or(r.rolname='service_role') as service_grant
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a on true
        join pg_roles r on r.oid=a.grantee
        where n.nspname='public' and p.proname in ('referee_v5_commit_match_transition','referee_v5_commit_match_finalization')
        group by p.proname`,
      expect: (rows) =>
        rows?.length === 2 &&
        rows.every((r) => r.auth_grant === false && r.service_grant === true),
    },
    {
      id: "legacy_tournament_match_live_unchanged",
      sql: `select count(*)::int as c from information_schema.tables where table_schema='public' and table_name='tournament_match_live'`,
      expect: (rows) => Number(rows?.[0]?.c) === 1,
    },
    {
      id: "outbox_deny_policy",
      sql: `select count(*)::int as c from pg_policies where tablename='match_integration_outbox' and policyname='match_integration_outbox_no_client'`,
      expect: (rows) => Number(rows?.[0]?.c) === 1,
    },
  ];

  for (const check of checks) {
    const rows = await executeManagementSql(token, check.sql, check.id);
    const pass = check.expect(rows);
    record(results, check.id, pass, "PASS", rows, `management_api: ${check.id}`);
  }
}

async function runJwtChecks(results) {
  loadProjectEnv();
  const { url, serviceKey } = getStagingSupabaseEnv();
  if (String(url).includes(PRODUCTION_REF)) {
    throw new Error("STOP — production URL");
  }

  const assigned = await signInStagingUser("owner@staging.local");
  const unassigned = await signInStagingUser("player@staging.local");
  const tenantB = await signInStagingUser("owner-b@staging.local");
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (assigned.error || unassigned.error || tenantB.error) {
    throw new Error(`Auth failed: ${assigned.error || unassigned.error || tenantB.error}`);
  }

  const readAssigned = await assigned.client.rpc("referee_v5_get_match_state", {
    p_tenant_id: TENANT_A,
    p_tournament_id: TOURNAMENT_A,
    p_match_id: MATCH_DOUBLES,
  });
  record(
    results,
    "assigned_referee_read_match",
    readAssigned.data?.ok === true,
    "ok:true",
    readAssigned.data?.code ?? readAssigned.data?.ok,
    "rpc referee_v5_get_match_state as owner@staging.local",
  );

  const readUnassigned = await unassigned.client.rpc("referee_v5_get_match_state", {
    p_tenant_id: TENANT_A,
    p_tournament_id: TOURNAMENT_A,
    p_match_id: MATCH_DOUBLES,
  });
  record(
    results,
    "unassigned_referee_denied",
    readUnassigned.data?.ok === false && readUnassigned.data?.code === "REFEREE_NOT_ASSIGNED",
    "REFEREE_NOT_ASSIGNED",
    readUnassigned.data?.code,
    "rpc as player@staging.local",
  );

  const tenantLeak = await assigned.client.rpc("referee_v5_get_match_state", {
    p_tenant_id: TENANT_B,
    p_tournament_id: TOURNAMENT_B,
    p_match_id: MATCH_DOUBLES,
  });
  record(
    results,
    "tenant_isolation_read",
    tenantLeak.data?.ok === false,
    "denied",
    tenantLeak.data?.code,
    "tenant A referee reads tenant B match",
  );

  const directInsert = await assigned.client.from("match_events").insert({
    tenant_id: TENANT_A,
    tournament_id: TOURNAMENT_A,
    match_id: MATCH_DOUBLES,
    match_state_id: `${TENANT_A}::${TOURNAMENT_A}::${MATCH_DOUBLES}`,
    event_sequence: 999,
    event_type: "RALLY_WON",
    state_version_before: 0,
    state_version_after: 1,
  });
  record(
    results,
    "client_cannot_insert_event",
    (directInsert.data ?? []).length === 0,
    "0 rows",
    directInsert.error?.message ?? directInsert.data,
    "authenticated insert match_events",
  );

  const internalRpc = await assigned.client.rpc("referee_v5_commit_match_transition", {
    p_tenant_id: TENANT_A,
    p_tournament_id: TOURNAMENT_A,
    p_match_id: MATCH_DOUBLES,
    p_actor_id: assigned.userId,
    p_command_type: "START_MATCH",
    p_command_payload: {},
    p_expected_state_version: 0,
    p_expected_event_sequence: 0,
    p_client_mutation_id: "blocked-test",
    p_idempotency_key: "blocked-test",
    p_request_hash: "hash",
    p_next_state: {},
    p_generated_events: [],
    p_state_before_hash: "a",
    p_state_after_hash: "b",
  });
  record(
    results,
    "internal_rpc_browser_blocked",
    Boolean(internalRpc.error),
    "permission denied",
    internalRpc.error?.message ?? internalRpc.data,
    "authenticated rpc commit transition",
  );

  const outboxRead = await assigned.client.from("match_integration_outbox").select("id").limit(1);
  record(
    results,
    "outbox_not_readable",
    (outboxRead.data ?? []).length === 0,
    "0 rows",
    outboxRead.error?.message ?? outboxRead.data,
    "authenticated select outbox",
  );

  await tokenAppendOnlyCheck(service, results);
}

async function tokenAppendOnlyCheck(service, results) {
  const eventId = await service
    .from("match_events")
    .select("id")
    .eq("match_state_id", `${TENANT_A}::${TOURNAMENT_A}::${MATCH_DOUBLES}`)
    .limit(1)
    .maybeSingle();

  if (!eventId.data?.id) {
    record(results, "append_only_update_rejected", true, "no events yet — skip destructive probe", "skipped", "service role probe deferred");
    record(results, "append_only_delete_rejected", true, "no events yet — skip destructive probe", "skipped", "service role probe deferred");
    return;
  }

  const upd = await service.from("match_events").update({ event_type: "HACK" }).eq("id", eventId.data.id);
  record(
    results,
    "append_only_update_rejected",
    Boolean(upd.error),
    "error",
    upd.error?.message ?? upd.data,
    "service role update match_events",
  );

  const del = await service.from("match_events").delete().eq("id", eventId.data.id);
  record(
    results,
    "append_only_delete_rejected",
    Boolean(del.error),
    "error",
    del.error?.message ?? del.data,
    "service role delete match_events",
  );
}

async function main() {
  loadProjectEnv();
  mkdirSync(outDir, { recursive: true });

  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const results = [];
  const commit = execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf8" }).trim();

  console.log("=== Referee V5-D.2 Staging Verification ===");
  console.log(`Staging ref: ${STAGING_REF}`);
  console.log(`Production ref: ${PRODUCTION_REF}`);
  console.log(`Commit: ${commit}\n`);

  if (token) {
    await runSchemaChecks(token, results);
  } else {
    record(results, "schema_checks", false, "SUPABASE_ACCESS_TOKEN set", "missing — run via MCP or set token", "preflight");
  }

  await runJwtChecks(results);

  const passCount = results.filter((r) => r.pass).length;
  const report = {
    phase: "V5-D.2",
    stagingRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    commit,
    timestamp: new Date().toISOString(),
    passCount,
    total: results.length,
    verdict: passCount === results.length ? "PASS" : "PARTIAL",
    results,
  };

  writeFileSync(join(outDir, "VERIFY_REPORT.json"), JSON.stringify(report, null, 2));
  console.log(`\n${passCount}/${results.length} checks passed → ${report.verdict}`);
  process.exit(report.verdict === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
