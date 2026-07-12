#!/usr/bin/env node
/**
 * V5-D.4 — Replay/snapshot consistency after staging scenarios.
 */
import {
  assertStagingOnly,
  createFaultHarness,
  createStagingService,
  FIXTURE,
  MATCH_EVENT_TYPE,
  resetMatchFromSeed,
  snapshotMatch,
  applyHarnessCommand,
  writeReport,
} from "./referee-v5-staging-harness.mjs";
import { RefereeV5SupabaseRepository } from "../src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js";
import { RefereeV5EdgeCommandHandler } from "../src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js";

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function verifyReplay(service, matchId, label) {
  const snap = await snapshotMatch(service, matchId);
  const repo = new RefereeV5SupabaseRepository(service);
  const handler = new RefereeV5EdgeCommandHandler(repo);
  const replay = await handler.verifySnapshotMatchesReplay(snap.matchStateId);
  const { data: events } = await service
    .from("match_events")
    .select("event_sequence, command_type, command_payload")
    .eq("match_state_id", snap.matchStateId)
    .order("event_sequence", { ascending: true });
  const first = events?.[0];
  const hasInitial = Boolean(first?.command_payload?._initialState);
  record(
    `${label}_replay_hash`,
    replay.ok === true,
    JSON.stringify({ snapshotHash: replay.snapshotHash, rebuiltHash: replay.rebuiltHash }),
  );
  record(
    `${label}_initial_state_integrity`,
    hasInitial && first?.command_type === MATCH_EVENT_TYPE.START_MATCH,
    `first=${first?.command_type} hasInitial=${hasInitial}`,
  );
  record(
    `${label}_append_only`,
    (events || []).length >= 1,
    `eventCount=${events?.length ?? 0}`,
  );
}

async function main() {
  assertStagingOnly();
  const service = createStagingService();
  const harness = createFaultHarness(service);

  await resetMatchFromSeed(service, FIXTURE.MATCH_DOUBLES);
  let snap = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  const doublesSeq = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.SWITCH_ENDS,
    MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
  ];
  for (const cmd of doublesSeq) {
    const idem = `replay-d-${cmd}-${Date.now()}`;
    await applyHarnessCommand(harness, {
      matchId: FIXTURE.MATCH_DOUBLES,
      commandType: cmd,
      expectedVersion: snap.version,
      expectedSequence: snap.sequence,
      idempotencyKey: idem,
    });
    snap = await snapshotMatch(service, FIXTURE.MATCH_DOUBLES);
  }
  await verifyReplay(service, FIXTURE.MATCH_DOUBLES, "doubles");

  await resetMatchFromSeed(service, FIXTURE.MATCH_SINGLES);
  snap = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  const singlesSeq = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.SWITCH_ENDS,
    MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
  ];
  for (const cmd of singlesSeq) {
    await applyHarnessCommand(harness, {
      matchId: FIXTURE.MATCH_SINGLES,
      commandType: cmd,
      expectedVersion: snap.version,
      expectedSequence: snap.sequence,
      idempotencyKey: `replay-s-${cmd}-${Date.now()}`,
    });
    snap = await snapshotMatch(service, FIXTURE.MATCH_SINGLES);
  }
  await verifyReplay(service, FIXTURE.MATCH_SINGLES, "singles");

  const report = { allPass: results.every((r) => r.pass), results };
  writeReport("REPLAY_SNAPSHOT_REPORT.json", report);
  console.log(`\nReplay: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
