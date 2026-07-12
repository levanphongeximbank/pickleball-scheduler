#!/usr/bin/env node
/**
 * V5-D.4 — Atomic command + finalize rollback on staging (service harness).
 */
import {
  assertStagingOnly,
  applyHarnessCommand,
  applyHarnessFinalize,
  createFaultHarness,
  createStagingService,
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

async function main() {
  assertStagingOnly();
  const service = createStagingService();
  const harness = createFaultHarness(service);

  // ─── 3.1 Command fault after_event ───
  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  const before31 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const idem31 = `rb-after-event-${Date.now()}`;
  const res31 = await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_DOUBLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: before31.version,
    expectedSequence: before31.sequence,
    idempotencyKey: idem31,
    fault: "after_event",
  });
  const after31 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const pass31 =
    !res31.ok &&
    after31.eventCount === before31.eventCount &&
    after31.version === before31.version &&
    after31.sequence === before31.sequence &&
    after31.completedMutations === before31.completedMutations;
  record("cmd_rollback_after_event", pass31, JSON.stringify({ before: before31, after: after31, code: res31.code }));

  // ─── 3.2 Command fault after_snapshot ───
  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  const before32 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const idem32 = `rb-after-snap-${Date.now()}`;
  await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_DOUBLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: before32.version,
    expectedSequence: before32.sequence,
    idempotencyKey: `start-${idem32}`,
  });
  const mid32 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const res32 = await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_DOUBLES,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: mid32.version,
    expectedSequence: mid32.sequence,
    idempotencyKey: idem32,
    fault: "after_snapshot",
  });
  const after32 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const pass32 =
    !res32.ok &&
    after32.eventCount === mid32.eventCount &&
    after32.version === mid32.version &&
    after32.sequence === mid32.sequence &&
    after32.stateHash === mid32.stateHash;
  record("cmd_rollback_after_snapshot", pass32, JSON.stringify({ mid: mid32, after: after32, code: res32.code }));

  // ─── 3.3 Retry after rollback ───
  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  const before33 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const idem33 = `retry-${Date.now()}`;
  await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_DOUBLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: before33.version,
    expectedSequence: before33.sequence,
    idempotencyKey: idem33,
    fault: "after_event",
  });
  const afterFail33 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const res33 = await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_DOUBLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: afterFail33.version,
    expectedSequence: afterFail33.sequence,
    idempotencyKey: idem33,
  });
  const after33 = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const pass33 =
    res33.ok &&
    after33.eventCount === before33.eventCount + 1 &&
    after33.version === before33.version + 1;
  record("cmd_retry_after_rollback", pass33, JSON.stringify({ afterFail: afterFail33, after: after33 }));

  // ─── 4.1 Finalize after_result_revision ───
  await resetMatchFromSeed(service, FIXTURE.MATCH_SINGLES);
  await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: `fin-start-${Date.now()}`,
  });
  const before41 = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const finId41 = `fin-rev-${Date.now()}`;
  const res41 = await applyHarnessFinalize(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    expectedVersion: before41.version,
    idempotencyKey: finId41,
    fault: "after_result_revision",
  });
  const after41 = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const pass41 =
    !res41.ok &&
    after41.revisionCount === 0 &&
    after41.status !== "locked" &&
    after41.outboxCount === 0 &&
    after41.completedMutations === before41.completedMutations;
  record("finalize_rollback_after_result_revision", pass41, JSON.stringify({ after: after41, code: res41.code }));

  // ─── 4.2 Finalize after_state_lock ───
  await resetMatchFromSeed(service, FIXTURE.MATCH_SINGLES);
  await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: `fin-start2-${Date.now()}`,
  });
  const before42 = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const finId42 = `fin-lock-${Date.now()}`;
  const res42 = await applyHarnessFinalize(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    expectedVersion: before42.version,
    idempotencyKey: finId42,
    fault: "after_state_lock",
  });
  const after42 = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const pass42 =
    !res42.ok &&
    after42.revisionCount === 0 &&
    after42.status !== "locked" &&
    after42.outboxCount === 0;
  record("finalize_rollback_after_state_lock", pass42, JSON.stringify({ after: after42, code: res42.code }));

  // ─── 4.3 Finalize after_outbox ───
  await resetMatchFromSeed(service, FIXTURE.MATCH_SINGLES);
  await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: `fin-start3-${Date.now()}`,
  });
  const before43 = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const finId43 = `fin-outbox-${Date.now()}`;
  const res43 = await applyHarnessFinalize(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    expectedVersion: before43.version,
    idempotencyKey: finId43,
    fault: "after_outbox",
  });
  const after43 = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const pass43 =
    !res43.ok &&
    after43.revisionCount === 0 &&
    after43.status !== "locked" &&
    after43.outboxCount === 0;
  record("finalize_rollback_after_outbox", pass43, JSON.stringify({ after: after43, code: res43.code }));

  // ─── 4.4 Finalize success after fault cleared + idempotent retry ───
  await resetMatchFromSeed(service, FIXTURE.MATCH_SINGLES);
  await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: `fin-start4-${Date.now()}`,
  });
  const before44 = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const finId44 = `fin-ok-${Date.now()}`;
  const res44a = await applyHarnessFinalize(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    expectedVersion: before44.version,
    idempotencyKey: finId44,
  });
  const after44a = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const res44b = await applyHarnessFinalize(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    expectedVersion: after44a.version,
    idempotencyKey: finId44,
  });
  const rallyAfterLock = await applyHarnessCommand(harness, {
    matchId: FIXTURE.MATCH_SINGLES,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: after44a.version,
    expectedSequence: after44a.sequence,
    idempotencyKey: `post-lock-${Date.now()}`,
  });
  const pass44 =
    res44a.ok &&
    after44a.revisionCount === 1 &&
    after44a.status === "locked" &&
    after44a.outboxCount >= 1 &&
    res44b.duplicate === true &&
    rallyAfterLock.code === "MATCH_LOCKED";
  record("finalize_success_and_idempotent_retry", pass44, JSON.stringify({ after: after44a, rallyCode: rallyAfterLock.code }));

  const cmdResults = results.filter((r) => r.id.startsWith("cmd_"));
  const finResults = results.filter((r) => r.id.startsWith("finalize_"));
  const report = {
    stagingRef: "qyewbxjsiiyufanzcjcq",
    commandRollback: { pass: cmdResults.every((r) => r.pass), results: cmdResults },
    finalizeRollback: { pass: finResults.every((r) => r.pass), results: finResults },
    allPass: results.every((r) => r.pass),
    results,
  };
  writeReport("ATOMIC_COMMAND_ROLLBACK_REPORT.json", report.commandRollback);
  writeReport("ATOMIC_FINALIZE_ROLLBACK_REPORT.json", report.finalizeRollback);
  console.log(`\nAtomic rollback: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
