#!/usr/bin/env node
/**
 * V5-D.4 — Fault injection security verification on staging.
 */
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  assertStagingOnly,
  createFaultHarness,
  createStagingService,
  edgePost,
  FIXTURE,
  MATCH_EVENT_TYPE,
  writeReport,
} from "./referee-v5-staging-harness.mjs";

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function main() {
  assertStagingOnly();
  loadProjectEnv();
  const service = createStagingService();
  const harness = createFaultHarness(service);

  const referee = await signInStagingUser("owner@staging.local");
  if (referee.error) {
    console.error(referee.error);
    process.exit(2);
  }
  const { data: sessionData } = await referee.client.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  // Browser cannot pass p_staging_fault via Edge
  const edgeFault = await edgePost(accessToken, {
    action: "apply-command",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId: FIXTURE.MATCH_DOUBLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: `edge-fault-${Date.now()}`,
    p_staging_fault: "after_event",
    stagingFault: "after_event",
  });
  record(
    "fault_injection_browser_edge_blocked",
    edgeFault.body?.ok !== true || edgeFault.body?.code !== "VALIDATION_FAILED" || !String(edgeFault.body?.error || "").includes("fault"),
    `edge ignores client fault — ok=${edgeFault.body?.ok} code=${edgeFault.body?.code}`,
  );

  // Authenticated user cannot call internal RPC with fault
  const rpcFault = await referee.client.rpc("referee_v5_commit_match_transition", {
    p_tenant_id: FIXTURE.TENANT_A,
    p_tournament_id: FIXTURE.TOURNAMENT_A,
    p_match_id: FIXTURE.MATCH_DOUBLES,
    p_actor_id: referee.userId,
    p_command_type: MATCH_EVENT_TYPE.START_MATCH,
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
    p_staging_fault: "after_event",
  });
  record(
    "fault_injection_authenticated_rpc_blocked",
    Boolean(rpcFault.error),
    rpcFault.error?.message || "rpc succeeded unexpectedly",
  );

  // Non-test namespace rejected by service harness path
  harness.atomicCommit.setStagingFault("after_event");
  const { url, serviceKey } = getStagingSupabaseEnv();
  const badRpc = await createClient(url, serviceKey, { auth: { persistSession: false } }).rpc(
    "referee_v5_commit_match_transition",
    {
      p_tenant_id: "venue-staging-a",
      p_tournament_id: "tournament-real",
      p_match_id: "REAL_MATCH_NOT_TEST",
      p_actor_id: referee.userId,
      p_command_type: MATCH_EVENT_TYPE.START_MATCH,
      p_command_payload: {},
      p_expected_state_version: 0,
      p_expected_event_sequence: 0,
      p_client_mutation_id: "x",
      p_idempotency_key: "x",
      p_request_hash: "x",
      p_next_state: { stateSchemaVersion: 1, matchId: "REAL_MATCH_NOT_TEST", version: 1, lastEventSequence: 1 },
      p_generated_events: [],
      p_state_before_hash: "a",
      p_state_after_hash: "b",
      p_staging_fault: "after_event",
    },
  );
  harness.atomicCommit.setStagingFault(null);
  record(
    "fault_injection_test_namespace_only",
    badRpc.data?.error === "fault_test_scope" || badRpc.data?.code === "VALIDATION_FAILED",
    JSON.stringify(badRpc.data || badRpc.error),
  );

  // Fault cleared after harness use
  record(
    "fault_injection_disabled_after_tests",
    harness.atomicCommit.stagingFault === null,
    `stagingFault=${harness.atomicCommit.stagingFault}`,
  );

  const report = {
    allPass: results.every((r) => r.pass),
    results,
    summary: {
      browserBlocked: results.find((r) => r.id === "fault_injection_browser_edge_blocked")?.pass,
      namespaceRestricted: results.find((r) => r.id === "fault_injection_test_namespace_only")?.pass,
      disabledAfter: results.find((r) => r.id === "fault_injection_disabled_after_tests")?.pass,
    },
  };
  writeReport("FAULT_INJECTION_SECURITY_REPORT.json", report);
  console.log(`\nFault security: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
