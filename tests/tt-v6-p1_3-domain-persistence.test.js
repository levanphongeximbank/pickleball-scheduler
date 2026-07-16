import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SETUP_MUTATION_GATE_ENV,
  buildSetupMutationFromTeamDataDiff,
  buildSetupMutationPayload,
  buildSetupMutationSnapshotPackage,
  executeSetupMutation,
  isSetupMutationRpcDeployed,
  resolveSetupMutationRpcName,
} from "../src/features/team-tournament/setup/index.js";

const GATE_ON = { [SETUP_MUTATION_GATE_ENV]: "true" };
const ROOT = process.cwd();
const base = {
  tournamentId: "tt-p13",
  expectedTournamentVersion: 4,
  rulesVersion: "rules@1",
};

function snapshot() {
  return buildSetupMutationSnapshotPackage({
    tournament: { id: base.tournamentId, version: 4 },
    teams: [{ id: "team-a", name: "A" }],
    expectedTournamentVersion: base.expectedTournamentVersion,
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("P1.3 domain persistence", () => {
  it("matches owner-locked schedule RPC names and deployment set", () => {
    assert.equal(
      resolveSetupMutationRpcName("schedule.update"),
      "team_tournament_update_matchup_schedule"
    );
    assert.equal(
      resolveSetupMutationRpcName("schedule.batch"),
      "team_tournament_apply_schedule_batch"
    );
    for (const command of [
      "discipline.save",
      "discipline.remove",
      "discipline.reorder",
      "groups.replace",
      "groups.clear",
      "matchups.replace",
      "schedule.update",
      "schedule.batch",
      "schedule.publish",
      "schedule.lock",
    ]) {
      assert.equal(isSetupMutationRpcDeployed(resolveSetupMutationRpcName(command)), true);
    }
    assert.equal(isSetupMutationRpcDeployed(resolveSetupMutationRpcName("awards.update")), false);
  });

  it("builds a canonical snapshot package", () => {
    const result = snapshot();
    assert.match(result.snapshotHash, /^[0-9a-f]{64}$/);
    assert.equal(result.normalizedReadHash, result.snapshotHash);
    assert.equal(result.snapshotJson.tournament.version, 5);
    assert.ok(result.snapshotCanonicalText.includes('"schemaVersion"'));
  });

  it("infers discipline, groups, matchup, and schedule commands", () => {
    const discipline = buildSetupMutationFromTeamDataDiff({
      ...base,
      previous: { disciplines: [] },
      next: { disciplines: [{ id: "d1", name: "MD", sortOrder: 1 }] },
    });
    assert.equal(discipline.commandName, "discipline.save");

    const groups = buildSetupMutationFromTeamDataDiff({
      ...base,
      previous: { groups: [] },
      next: { groups: [{ id: "g1", name: "A", teamIds: ["team-a"] }] },
    });
    assert.equal(groups.commandName, "groups.replace");

    const matchups = buildSetupMutationFromTeamDataDiff({
      ...base,
      previous: { matchups: [] },
      next: { matchups: [{ id: "m1", teamAId: "team-a", teamBId: "team-b" }] },
    });
    assert.equal(matchups.commandName, "matchups.replace");

    const schedule = buildSetupMutationFromTeamDataDiff({
      ...base,
      previous: {
        matchups: [{ id: "m1", teamAId: "team-a", teamBId: "team-b", scheduledAt: null }],
      },
      next: {
        matchups: [{
          id: "m1",
          teamAId: "team-a",
          teamBId: "team-b",
          scheduledAt: "2026-01-01T10:00:00.000Z",
          courtLabel: "Court 1",
        }],
      },
    });
    assert.equal(schedule.commandName, "schedule.update");

    const scheduleBatch = buildSetupMutationFromTeamDataDiff({
      ...base,
      previous: {
        matchups: [
          { id: "m1", teamAId: "team-a", teamBId: "team-b", scheduledAt: null },
          { id: "m2", teamAId: "team-b", teamBId: "team-a", scheduledAt: null },
        ],
      },
      next: {
        matchups: [
          { id: "m1", teamAId: "team-a", teamBId: "team-b", scheduledAt: "2026-01-01T10:00:00.000Z", courtLabel: "Court 1" },
          { id: "m2", teamAId: "team-b", teamBId: "team-a", scheduledAt: "2026-01-01T11:00:00.000Z", courtLabel: "Court 1" },
        ],
      },
    });
    assert.equal(scheduleBatch.commandName, "schedule.batch");
  });

  it("executes deployed RPC success, replay, and version conflict without blob fallback", async () => {
    const built = buildSetupMutationPayload({
      method: "discipline.save",
      ...base,
      idempotencyKey: "p13-success",
      payload: { discipline: { id: "d1", name: "MD" }, snapshot: snapshot() },
      engineInput: {},
      engineOutput: {},
    });
    const success = await executeSetupMutation({
      provider: "cloud",
      tournamentId: base.tournamentId,
      envelope: built.envelope,
      envSource: GATE_ON,
      callRpc: async () => ({
        ok: true,
        version: 5,
        snapshot: { snapshotId: "s1", snapshotVersion: 5, snapshotHash: snapshot().snapshotHash },
      }),
    });
    assert.equal(success.ok, true);
    assert.equal(success.version, 5);
    assert.equal(success.data.snapshot.snapshotId, "s1");

    const replay = await executeSetupMutation({
      provider: "cloud",
      tournamentId: base.tournamentId,
      envelope: built.envelope,
      envSource: GATE_ON,
      callRpc: async () => ({ ok: true, replayed: true, version: 5, snapshot: { snapshotId: "s1" } }),
    });
    assert.equal(replay.replayed, true);

    const conflict = await executeSetupMutation({
      provider: "cloud",
      tournamentId: base.tournamentId,
      envelope: built.envelope,
      envSource: GATE_ON,
      callRpc: async () => ({ ok: false, code: "version_conflict", error: "stale" }),
    });
    assert.equal(conflict.code, "version_conflict");

    const blob = await executeSetupMutation({
      provider: "blob",
      tournamentId: base.tournamentId,
      envelope: built.envelope,
      envSource: GATE_ON,
    });
    assert.equal(blob.code, "BLOB_FALLBACK_FORBIDDEN");
  });

  it("keeps the P1.3 SQL contract present", () => {
    const schema = readFileSync(
      join(ROOT, "docs/v5/team-tournament/p1/PHASE_P1_3_DOMAIN_PERSISTENCE_SCHEMA.sql"),
      "utf8"
    );
    const rpcs = readFileSync(
      join(ROOT, "docs/v5/team-tournament/p1/PHASE_P1_3_DOMAIN_PERSISTENCE_RPCS.sql"),
      "utf8"
    );
    const getSetup = readFileSync(
      join(ROOT, "docs/v5/team-tournament/p1/PHASE_P1_3_GET_SETUP_V7_GROUPS.sql"),
      "utf8"
    );
    assert.match(schema, /team_tournament_groups/);
    assert.match(schema, /discipline_kind/);
    assert.match(rpcs, /team_tournament_update_matchup_schedule/);
    assert.match(rpcs, /team_tournament_apply_schedule_batch/);
    assert.match(rpcs, /team_tournament_create_setup_snapshot/);
    assert.match(rpcs, /COURT_CONFLICT/);
    assert.match(getSetup, /team_tournament_groups/);
  });
});
