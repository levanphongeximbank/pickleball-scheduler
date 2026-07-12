#!/usr/bin/env node
/**
 * V5-D.4 — Rollback rehearsal on staging (non-destructive).
 */
import { execSync } from "node:child_process";
import { loadProjectEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  assertStagingOnly,
  createStagingService,
  edgePost,
  FIXTURE,
  snapshotMatch,
  writeReport,
} from "./referee-v5-staging-harness.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function main() {
  loadProjectEnv();
  assertStagingOnly();
  const service = createStagingService();

  // 11.1 Feature flag default off in repo build
  const flagOff = !String(process.env.VITE_REFEREE_V5_ENABLED || "").toLowerCase().includes("true");
  record("rollback_feature_flag_default_off", flagOff, `VITE_REFEREE_V5_ENABLED=${process.env.VITE_REFEREE_V5_ENABLED || "(unset)"}`);

  // Legacy referee RPC still callable (token-scoped pattern exists)
  let legacyOk = false;
  try {
    execSync("node --test tests/referee-rpc-security.test.js tests/referee-engine.test.js", {
      stdio: "pipe",
      encoding: "utf8",
    });
    legacyOk = true;
  } catch {
    legacyOk = false;
  }
  record("rollback_legacy_regression", legacyOk, "referee legacy unit tests");

  // 11.2 Edge path reachable (disable drill = probe only; no undeploy)
  const edgeProbe = await fetch(`https://${STAGING_REF}.supabase.co/functions/v1/referee-v5-match`, {
    method: "OPTIONS",
  });
  record("rollback_edge_path_probe", edgeProbe.status === 200 || edgeProbe.status === 204, `OPTIONS ${edgeProbe.status}`);

  // Remote error path: bad action should not return local fallback data
  const referee = await signInStagingUser("owner@staging.local");
  const token = (await referee.client.auth.getSession()).data.session?.access_token;
  const badEdge = await edgePost(token, { action: "invalid-action-xyz" });
  record(
    "rollback_remote_no_silent_fallback",
    badEdge.body?.ok === false,
    JSON.stringify(badEdge.body?.code || badEdge.status),
  );

  // 11.3 Restore — match data retained + command still works
  const before = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const stateRes = await edgePost(token, {
    action: "get-state",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId: FIXTURE.MATCH_DOUBLES,
  });
  const after = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  record(
    "rollback_data_retained",
    after.eventCount >= before.eventCount && stateRes.body?.ok !== false,
    JSON.stringify({ events: after.eventCount, version: after.version }),
  );

  // 11.4 Internal RPC browser blocked
  const internalRpc = await referee.client.rpc("referee_v5_commit_match_transition", {
    p_tenant_id: FIXTURE.TENANT_A,
    p_tournament_id: FIXTURE.TOURNAMENT_A,
    p_match_id: FIXTURE.MATCH_DOUBLES,
    p_actor_id: referee.userId,
    p_command_type: "START_MATCH",
    p_command_payload: {},
    p_expected_state_version: 0,
    p_expected_event_sequence: 0,
    p_client_mutation_id: "x",
    p_idempotency_key: "x",
    p_request_hash: "x",
    p_next_state: {},
    p_generated_events: [],
    p_state_before_hash: "a",
    p_state_after_hash: "b",
  });
  record("rollback_internal_rpc_browser_blocked", Boolean(internalRpc.error), internalRpc.error?.message || "ok");

  const report = { allPass: results.every((r) => r.pass), results, note: "Edge undeploy drill skipped — probe-only to avoid staging outage" };
  writeReport("ROLLBACK_REHEARSAL_REPORT.json", report);
  console.log(`\nRollback rehearsal: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
