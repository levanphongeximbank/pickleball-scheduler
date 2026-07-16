import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isGetSetupV7Payload,
  mapGetSetupV7Meta,
  mapSetupDiagnostic,
  mapSetupSnapshotMetadata,
  normalizeV7TournamentForAggregate,
} from "../src/features/team-tournament/repositories/mapGetSetupV7.js";
import { mapTournamentToAggregate } from "../src/features/team-tournament/repositories/teamTournamentRepositoryAggregate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(
  __dirname,
  "../docs/v5/team-tournament/p1/PHASE_P1_2_S1C_GET_SETUP_V7.sql"
);
const reportPath = join(
  __dirname,
  "../docs/v5/team-tournament/p1/PHASE_P1_2_S1C_GET_SETUP_V7_REPORT.md"
);
const sql = readFileSync(sqlPath, "utf8");
const report = readFileSync(reportPath, "utf8");
const rpcService = readFileSync(
  join(__dirname, "../src/features/team-tournament/services/teamTournamentRpcService.js"),
  "utf8"
);
const cloudRepo = readFileSync(
  join(__dirname, "../src/features/team-tournament/repositories/cloudTeamTournamentRepository.js"),
  "utf8"
);

describe("P1.2 S1-C — get_setup v7 SQL contract", () => {
  it("replaces get_setup with schemaVersion and diagnostic params", () => {
    assert.match(sql, /drop function if exists public\.team_tournament_get_setup\(text, text\)/i);
    assert.match(sql, /p_schema_version integer default null/i);
    assert.match(sql, /p_diagnostic boolean default false/i);
    assert.match(sql, /as \$ttsetup\$/i);
  });

  it("rejects unsupported schema versions", () => {
    assert.match(sql, /VALIDATION_ERROR/i);
    assert.match(sql, /Unsupported schemaVersion/i);
  });

  it("returns unchanged v6 shape when schema version omitted", () => {
    assert.match(sql, /v_schema_version is null or v_schema_version = 6/i);
    assert.match(sql, /'teamData', json_build_object\(/i);
    assert.doesNotMatch(sql, /insert into public\.team_tournament_setup_snapshots/i);
  });

  it("authors v7 top-level contract keys", () => {
    for (const key of [
      "'schemaVersion', 7",
      "'snapshot'",
      "'diagnostic'",
      "'viewer'",
      "'permissions'",
      "'operations'",
    ]) {
      assert.match(sql, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("exposes snapshot metadata fields and null when absent", () => {
    assert.match(sql, /team_tournament_setup_snapshots/i);
    assert.match(sql, /snapshotId/i);
    assert.match(sql, /normalizedReadHash/i);
    assert.match(sql, /v_snapshot_json := null/i);
    assert.match(sql, /SNAPSHOT_NOT_INITIALIZED/i);
  });

  it("diagnostic is authorized and read-only", () => {
    assert.match(sql, /team_tournament_can_manage\(\)/i);
    assert.match(sql, /is_super_admin\(\)/i);
    assert.match(sql, /team_tournament_normalized_read_hash/i);
    assert.match(sql, /NORMALIZED_READ_DRIFT/i);
    assert.doesNotMatch(sql, /create_setup_snapshot/i);
  });

  it("locks groups empty and disciplineKind null pending schema", () => {
    assert.match(sql, /v_groups := '\[\]'::json/i);
    assert.match(sql, /'disciplineKind', null/i);
    assert.match(sql, /'activationRule', null/i);
    assert.match(report, /P1\.3/i);
  });

  it("maps schedule_meta fidelity on matchups", () => {
    assert.match(sql, /scheduleMeta/i);
    assert.match(sql, /schedule_meta->>'groupId'/i);
    assert.match(sql, /roundNumber/i);
    assert.match(sql, /matchNumberInRound/i);
    assert.match(sql, /nextMatchupId/i);
  });

  it("reads dreambreaker awards closing from persisted state", () => {
    assert.match(sql, /team_tournament_dreambreaker_states/i);
    assert.match(sql, /schedulePublish/i);
    assert.match(sql, /resultsLocked/i);
  });

  it("is authoring-only — no production apply", () => {
    assert.match(sql, /Production: DO NOT APPLY/i);
    assert.match(report, /NOT in this pre-commit phase/i);
  });
});

describe("P1.2 S1-C — application mapping", () => {
  it("RPC accepts optional schemaVersion and diagnostic", () => {
    assert.match(rpcService, /p_schema_version/);
    assert.match(rpcService, /p_diagnostic/);
  });

  it("cloud repository maps v7 meta without defaulting Preview to v7", () => {
    assert.match(cloudRepo, /mapGetSetupV7Meta/);
    assert.match(cloudRepo, /readOptions\.schemaVersion/);
    assert.match(cloudRepo, /setupBlocked/);
  });

  it("v6 payload mapping leaves schemaVersion null", () => {
    const meta = mapGetSetupV7Meta({
      ok: true,
      serverTime: "2026-07-16T00:00:00.000Z",
      tournament: { id: "t1", teamData: { teams: [], matchups: [] } },
    });
    assert.equal(meta.schemaVersion, null);
    assert.equal(meta.snapshot, null);
    assert.equal(meta.diagnostic, null);
    assert.equal(meta.setupBlocked, false);
  });

  it("v7 snapshot and diagnostic mapping", () => {
    assert.equal(isGetSetupV7Payload({ schemaVersion: 7 }), true);
    const snapshot = mapSetupSnapshotMetadata({
      snapshotId: "s1",
      snapshotVersion: 2,
      snapshotHash: "a".repeat(64),
      normalizedReadHash: "b".repeat(64),
      engineInputHash: "c".repeat(64),
      engineOutputHash: "d".repeat(64),
      engineVersion: "team-tournament-engines@1.0.0",
      rulesVersion: null,
      commandName: "discipline.save",
      createdAt: "2026-07-16T00:00:00.000Z",
    });
    assert.equal(snapshot.snapshotId, "s1");
    assert.equal(snapshot.snapshotVersion, 2);

    const diagFalse = mapSetupDiagnostic({
      driftDetected: false,
      driftCode: null,
      latestSnapshotHash: "a".repeat(64),
      latestNormalizedReadHash: "b".repeat(64),
      currentNormalizedHash: "b".repeat(64),
      engineVersionMismatch: false,
      rulesVersionMismatch: false,
    });
    assert.equal(diagFalse.driftDetected, false);

    const diagTrue = mapGetSetupV7Meta({
      schemaVersion: 7,
      snapshot: snapshot,
      diagnostic: {
        driftDetected: true,
        driftCode: "NORMALIZED_READ_DRIFT",
        latestSnapshotHash: "a".repeat(64),
        latestNormalizedReadHash: "b".repeat(64),
        currentNormalizedHash: "e".repeat(64),
        engineVersionMismatch: false,
        rulesVersionMismatch: false,
      },
    });
    assert.equal(diagTrue.driftDetected, true);
    assert.equal(diagTrue.setupBlocked, true);
  });

  it("no-snapshot diagnostic maps SNAPSHOT_NOT_INITIALIZED", () => {
    const meta = mapGetSetupV7Meta({
      schemaVersion: 7,
      snapshot: null,
      diagnostic: {
        driftDetected: false,
        driftCode: "SNAPSHOT_NOT_INITIALIZED",
        latestSnapshotHash: null,
        latestNormalizedReadHash: null,
        currentNormalizedHash: "f".repeat(64),
        engineVersionMismatch: false,
        rulesVersionMismatch: false,
      },
    });
    assert.equal(meta.snapshot, null);
    assert.equal(meta.diagnostic.driftCode, "SNAPSHOT_NOT_INITIALIZED");
  });

  it("normalizeV7Tournament keeps groups empty and maps into aggregate", () => {
    const normalized = normalizeV7TournamentForAggregate({
      id: "t-1",
      clubId: "c-1",
      tenantId: "venue-staging-a",
      version: 1,
      settings: {},
      teams: [{ id: "team-a", name: "A", playerIds: ["p1"] }],
      groups: [],
      disciplines: [{ id: "d1", disciplineKind: null, activationRule: null }],
      matchups: [
        {
          id: "m1",
          teamAId: "team-a",
          teamBId: "team-b",
          scheduledAt: null,
          scheduleMeta: {},
          groupId: null,
          roundNumber: null,
          subMatches: [{ id: "sm1", matchupId: "m1", sortOrder: 1 }],
        },
      ],
      lineups: {},
      standings: [],
      awards: {},
      closing: { closed: false, closedAt: null, closedBy: "", resultsLocked: false },
      schedulePublish: { status: "draft" },
      dreambreaker: {},
    });
    assert.deepEqual(normalized.teamData.groups, []);
    const aggregate = mapTournamentToAggregate(normalized, "cloud");
    assert.equal(aggregate.id, "t-1");
    assert.equal(aggregate.groups.length, 0);
    assert.equal(aggregate.teams.length, 1);
    assert.equal(aggregate.matchups[0].id, "m1");
    assert.equal(aggregate.subMatches.length, 1);
  });

  it("does not wire setup mutation methods in S1-C", () => {
    assert.doesNotMatch(cloudRepo, /create_setup_snapshot/);
    assert.doesNotMatch(rpcService, /discipline\.save/);
  });
});
