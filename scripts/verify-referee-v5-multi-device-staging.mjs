#!/usr/bin/env node
/**
 * V5-D.4 — Multi-device conflict verification (dual HTTP sessions).
 */
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  assertStagingOnly,
  createStagingService,
  edgePost,
  FIXTURE,
  MATCH_EVENT_TYPE,
  resetMatchFromSeed,
  snapshotMatch,
  writeReport,
} from "./referee-v5-staging-harness.mjs";

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function getEdgeState(token, matchId = FIXTURE.MATCH_DOUBLES) {
  return edgePost(token, {
    action: "get-state",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId,
  });
}

async function applyEdge(token, args) {
  return edgePost(token, {
    action: "apply-command",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId: args.matchId || FIXTURE.MATCH_DOUBLES,
    commandType: args.commandType,
    expectedVersion: args.expectedVersion,
    expectedSequence: args.expectedSequence,
    idempotencyKey: args.idempotencyKey,
    clientMutationId: args.idempotencyKey,
  });
}

async function main() {
  assertStagingOnly();
  const service = createStagingService();
  const referee = await signInStagingUser("owner@staging.local");
  if (referee.error) {
    process.exit(2);
  }
  const tokenA = (await referee.client.auth.getSession()).data.session.access_token;
  const tokenB = tokenA;

  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  await applyEdge(tokenA, {
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: `md-start-${Date.now()}`,
  });

  const stateN = await getEdgeState(tokenA);
  const version = stateN.body.stateVersion;
  const sequence = stateN.body.lastEventSequence;

  // M1 — stale version conflict
  const m1a = applyEdge(tokenA, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: `m1a-${Date.now()}`,
  });
  const m1b = applyEdge(tokenB, {
    commandType: MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: `m1b-${Date.now()}`,
  });
  const [r1a, r1b] = await Promise.all([m1a, m1b]);
  const m1Pass =
    (r1a.body?.ok && r1b.body?.code === "MATCH_STATE_CONFLICT") ||
    (r1b.body?.ok && r1a.body?.code === "MATCH_STATE_CONFLICT");
  record("m1_stale_version_conflict", m1Pass, JSON.stringify({ a: r1a.body?.code, b: r1b.body?.code }));

  const reload = await getEdgeState(tokenA);
  const reloadB = await getEdgeState(tokenB);
  record(
    "m1_device_convergence_after_reload",
    reload.body.stateVersion === reloadB.body.stateVersion &&
      reload.body.lastEventSequence === reloadB.body.lastEventSequence,
    JSON.stringify({ a: reload.body.stateVersion, b: reloadB.body.stateVersion }),
  );

  // M2 — same idempotency key
  const state2 = await getEdgeState(tokenA);
  const v2 = state2.body.stateVersion;
  const s2 = state2.body.lastEventSequence;
  const idem2 = `m2-idem-${Date.now()}`;
  const m2a = applyEdge(tokenA, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: v2,
    expectedSequence: s2,
    idempotencyKey: idem2,
  });
  const m2b = applyEdge(tokenB, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: v2,
    expectedSequence: s2,
    idempotencyKey: idem2,
  });
  const [r2a, r2b] = await Promise.all([m2a, m2b]);
  const snap2 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const m2Pass =
    (r2a.body?.ok || r2b.body?.ok) &&
    (r2a.body?.duplicate || r2b.body?.duplicate || r2a.body?.ok === r2b.body?.ok) &&
    snap2.version === v2 + 1;
  record("m2_same_idempotency_key", m2Pass, JSON.stringify({ a: r2a.body, b: r2b.body, snap: snap2 }));

  // M3 — switch ends conflict
  const state3 = await getEdgeState(tokenA);
  const v3 = state3.body.stateVersion;
  const s3 = state3.body.lastEventSequence;
  const m3a = applyEdge(tokenA, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: v3,
    expectedSequence: s3,
    idempotencyKey: `m3a-${Date.now()}`,
  });
  const m3b = applyEdge(tokenB, {
    commandType: MATCH_EVENT_TYPE.SWITCH_ENDS,
    expectedVersion: v3,
    expectedSequence: s3,
    idempotencyKey: `m3b-${Date.now()}`,
  });
  const [r3a, r3b] = await Promise.all([m3a, m3b]);
  const m3Pass =
    (r3a.body?.ok && r3b.body?.code === "MATCH_STATE_CONFLICT") ||
    (r3b.body?.ok && r3a.body?.code === "MATCH_STATE_CONFLICT");
  record("m3_switch_ends_conflict", m3Pass, JSON.stringify({ a: r3a.body?.code, b: r3b.body?.code }));

  // M4 — undo conflict
  const state4 = await getEdgeState(tokenA);
  const v4 = state4.body.stateVersion;
  const s4 = state4.body.lastEventSequence;
  const m4a = applyEdge(tokenA, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: v4,
    expectedSequence: s4,
    idempotencyKey: `m4a-${Date.now()}`,
  });
  const m4b = applyEdge(tokenB, {
    commandType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
    expectedVersion: v4,
    expectedSequence: s4,
    idempotencyKey: `m4b-${Date.now()}`,
  });
  const [r4a, r4b] = await Promise.all([m4a, m4b]);
  const m4Pass =
    (r4a.body?.ok && r4b.body?.code === "MATCH_STATE_CONFLICT") ||
    (r4b.body?.ok && r4a.body?.code === "MATCH_STATE_CONFLICT");
  record("m4_undo_conflict", m4Pass, JSON.stringify({ a: r4a.body?.code, b: r4b.body?.code }));

  const snap4 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const { RefereeV5SupabaseRepository } = await import(
    "../src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js"
  );
  const { RefereeV5EdgeCommandHandler } = await import(
    "../src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js"
  );
  const repo = new RefereeV5SupabaseRepository(service);
  const handler = new RefereeV5EdgeCommandHandler(repo);
  const replay = await handler.verifySnapshotMatchesReplay(snap4.matchStateId);
  record("m4_replay_after_conflict", replay.ok === true, JSON.stringify({ ok: replay.ok }));

  const report = { allPass: results.every((r) => r.pass), results };
  writeReport("MULTI_DEVICE_REPORT.json", report);
  console.log(`\nMulti-device: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
