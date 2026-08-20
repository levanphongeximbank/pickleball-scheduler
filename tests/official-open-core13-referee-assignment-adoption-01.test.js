/**
 * Official/Open — CORE-13 referee assignment adoption (post-reconcile).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createScoringFormat } from "../src/features/competition-core/scoring/index.js";
import {
  ASSIGNMENT_COMPETITION_MODE,
  assertCanonicalRefereeId,
  createCompetitionRefereeAssignmentCommandService,
  createInMemoryCanonicalAssignmentPersistence,
  createModeAssignmentCommandBridge,
  ASSIGNMENT_COMMAND_ERROR_CODE,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import { REFEREE_ROLE_CODE } from "../src/features/competition-core/referee-assignment/index.js";
import {
  getRefereeAssignments,
  assignRefereeToIndividualMatch,
  LEGACY_INDIVIDUAL_ASSIGNMENT_AUTHORITY,
  buildIndividualRefereeAssignmentTable,
} from "../src/features/individual-tournament/engines/refereeAssignEngine.js";
import {
  projectCore13AssignmentOntoTournament,
  resolveCanonicalRefereeIdFromRoster,
} from "../src/features/individual-tournament/engines/core13AssignmentProjection.js";
import { createOfficialTournamentRefereeAdapter } from "../src/features/tournament/official-open-adapter-b/officialTournamentRefereeAdapter.js";
import { runCompetitionRefereeAdapterConformance } from "../src/features/competition-engine/integration/referee/conformance.js";
import { COMPETITION_REFEREE_MODE } from "../src/features/competition-engine/integration/referee/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function baseTournament(overrides = {}) {
  return {
    id: "tourn-official-1",
    tenantId: "11111111-1111-4111-8111-111111111111",
    clubId: "club-1",
    type: "official_open",
    name: "Official Open QA",
    settings: {
      refereeRoster: [
        {
          id: "roster-a",
          name: "Trọng tài 01",
          active: true,
          canonicalUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
        {
          id: "roster-b",
          name: "Trọng tài 02",
          active: true,
          canonicalUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
        {
          id: "roster-guest",
          name: "Khách không account",
          active: true,
        },
      ],
      refereeAssignments: {},
    },
    events: [
      {
        id: "ev-1",
        name: "MD",
        matches: [
          {
            id: "match-1",
            eventId: "ev-1",
            status: "scheduled",
            scheduledStart: "2026-08-17T08:00:00.000Z",
            courtId: "court-1",
            scoringRules: createScoringFormat({
              scoringSystem: "RALLY",
              pointsToWin: 11,
              winBy: 2,
            }),
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("Official CORE-13 assignment adoption", () => {
  it("legacy blob assign is neutralized", () => {
    const t = baseTournament();
    const result = assignRefereeToIndividualMatch(t, "match-1", "roster-a");
    assert.equal(result.ok, false);
    assert.equal(result.code, "LEGACY_ASSIGNMENT_AUTHORITY_RETIRED");
    assert.equal(LEGACY_INDIVIDUAL_ASSIGNMENT_AUTHORITY.productWriters, 0);
  });

  it("resolves canonicalUserId; rejects display-name / unbound roster", () => {
    const t = baseTournament();
    const a = resolveCanonicalRefereeIdFromRoster(t, "roster-a");
    assert.equal(a.ok, true);
    assert.equal(a.refereeId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    const byCanonical = resolveCanonicalRefereeIdFromRoster(
      t,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );
    assert.equal(byCanonical.ok, true);

    const guest = resolveCanonicalRefereeIdFromRoster(t, "roster-guest");
    assert.equal(guest.ok, false);
    assert.equal(guest.code, "CANONICAL_REFEREE_ID_REQUIRED");

    const display = resolveCanonicalRefereeIdFromRoster(t, "Trọng tài 01");
    assert.equal(display.ok, false);
  });

  it("assertCanonicalRefereeId rejects email/display authority", () => {
    assert.throws(
      () => assertCanonicalRefereeId("ref@example.com"),
      (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.EMAIL_AS_AUTHORITY_DENIED
    );
    assert.throws(
      () => assertCanonicalRefereeId("Trọng tài 01"),
      (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.DISPLAY_NAME_IDENTITY_DENIED
    );
  });

  it("CORE-13 assign → replace → unassign with Official mode bridge", async () => {
    const persistence = createInMemoryCanonicalAssignmentPersistence();
    const service = createCompetitionRefereeAssignmentCommandService({ persistence });
    const bridge = createModeAssignmentCommandBridge({
      commandService: service,
      competitionMode: ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN,
    });
    assert.equal(bridge.core13Bound, true);

    const base = {
      tenantId: "11111111-1111-4111-8111-111111111111",
      tournamentId: "tourn-official-1",
      matchId: "match-1",
      roleCode: REFEREE_ROLE_CODE.PRIMARY,
      actorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      actorAuthorized: true,
      authorizedTenantId: "11111111-1111-4111-8111-111111111111",
      authorizedTournamentId: "tourn-official-1",
      lifecycleState: "READY",
      expectedVersion: 0,
    };

    const assignA = await bridge.assignReferee({
      ...base,
      refereeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "official-assign-a",
      reason: "test-assign",
    });
    assert.equal(assignA.ok, true);

    const activeA = await bridge.getActiveAssignment({
      tenantId: base.tenantId,
      tournamentId: base.tournamentId,
      matchId: base.matchId,
      role: REFEREE_ROLE_CODE.PRIMARY,
    });
    assert.equal(activeA?.refereeId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    const idempotent = await bridge.assignReferee({
      ...base,
      refereeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expectedVersion: 0,
      idempotencyKey: "official-assign-a",
      reason: "test-assign",
    });
    assert.equal(idempotent.ok, true);
    assert.equal(idempotent.replayed, true);

    const replaceB = await bridge.replaceReferee({
      ...base,
      newRefereeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedVersion: Number(idempotent.version ?? assignA.version ?? 1),
      idempotencyKey: "official-replace-b",
      reason: "test-replace",
    });
    assert.equal(replaceB.ok, true);

    const activeB = await bridge.getActiveAssignment({
      tenantId: base.tenantId,
      tournamentId: base.tournamentId,
      matchId: base.matchId,
      role: REFEREE_ROLE_CODE.PRIMARY,
    });
    assert.equal(activeB?.refereeId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const listed = await service.listActiveAssignments({
      tenantId: base.tenantId,
      tournamentId: base.tournamentId,
    });
    const activeRows = listed.filter((r) => r.status === "active" || !r.status);
    assert.equal(
      activeRows.filter((r) => String(r.matchId) === "match-1").length,
      1
    );

    const unassign = await bridge.unassignReferee({
      ...base,
      expectedVersion: Number(replaceB.version ?? 2),
      idempotencyKey: "official-unassign",
      reason: "test-unassign",
    });
    assert.equal(unassign.ok, true);

    const after = await bridge.getActiveAssignment({
      tenantId: base.tenantId,
      tournamentId: base.tournamentId,
      matchId: base.matchId,
      role: REFEREE_ROLE_CODE.PRIMARY,
    });
    assert.equal(after, null);
  });

  it("projection is PROJECTION_ONLY and organizer readback uses canonical id", () => {
    let t = baseTournament();
    t = projectCore13AssignmentOntoTournament(t, {
      matchId: "match-1",
      refereeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      rosterId: "roster-a",
      assignment: {
        matchId: "match-1",
        refereeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "active",
        assignedAt: "2026-08-17T08:00:00.000Z",
      },
      version: 1,
    });

    assert.equal(t.settings.core13RefereeAssignments.authority, false);
    assert.equal(t.settings.core13RefereeAssignments.projectionOnly, true);

    const map = getRefereeAssignments(t);
    assert.equal(map["match-1"].canonicalUserId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    const table = buildIndividualRefereeAssignmentTable(t);
    assert.equal(table[0].canonicalUserId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(table[0].assigned, true);

    t = projectCore13AssignmentOntoTournament(t, {
      matchId: "match-1",
      refereeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      rosterId: "roster-b",
      assignment: {
        matchId: "match-1",
        refereeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "active",
      },
      version: 2,
    });
    assert.equal(
      getRefereeAssignments(t)["match-1"].canonicalUserId,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );

    t = projectCore13AssignmentOntoTournament(t, {
      matchId: "match-1",
      refereeId: "",
      version: 3,
    });
    assert.equal(getRefereeAssignments(t)["match-1"], undefined);
  });

  it("Official Adapter B exposes CORE-13 surface without forbidden assign methods", () => {
    const adapter = createOfficialTournamentRefereeAdapter({
      tournament: baseTournament(),
      tenantId: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(adapter.competitionMode, COMPETITION_REFEREE_MODE.OFFICIAL);
    assert.equal(typeof adapter.assignReferee, "undefined");
    assert.equal(typeof adapter.persistAssignment, "undefined");
    assert.equal(
      adapter.existingLifecycle.core13Assignment.competitionMode,
      ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN
    );
    assert.ok(
      adapter.existingLifecycle.core13Assignment.commands.includes("assignReferee")
    );
  });

  it("RefereeAssignPanel + discovery use CORE-13 (no fuzzy product path)", () => {
    const panel = read("src/components/tournament/RefereeAssignPanel.jsx");
    assert.match(panel, /createCompetitionRefereeAssignmentTrustedClient/);
    assert.match(panel, /resolveCanonicalRefereeIdFromRoster/);
    assert.match(panel, /OFFICIAL_OPEN/);
    assert.doesNotMatch(panel, /assignRefereeToIndividualMatch/);

    const session = read("src/features/identity/services/refereeSessionService.js");
    assert.match(session, /listCanonicalRefereeAssignmentsForActor/);
    assert.doesNotMatch(session, /refereeMatchesUser/);
    assert.doesNotMatch(session, /name\.includes/);

    const discovery = read(
      "src/features/identity/services/canonicalRefereeAssignmentDiscovery.js"
    );
    assert.match(discovery, /listActiveAssignments/);
    assert.match(discovery, /actorId/);
  });

  it("settings / pairing regression markers remain", () => {
    const settingsTest = read(
      "tests/official-open-settings-match-rules-pairing-final-closure-01.test.js"
    );
    assert.match(settingsTest, /officialSettingsDraftModel|PAIRING_REVEAL|Lưu cài đặt/);
  });

  it("runCompetitionRefereeAdapterConformance PASS for Official Adapter B", async () => {
    const tournament = baseTournament();
    const adapter = createOfficialTournamentRefereeAdapter({
      tournament,
      tenantId: tournament.tenantId,
    });
    const report = await runCompetitionRefereeAdapterConformance(adapter, {
      validRequest: {
        tenantId: tournament.tenantId,
        competitionId: tournament.id,
        matchId: "match-1",
      },
      unknownMatchRequest: {
        tenantId: tournament.tenantId,
        competitionId: tournament.id,
        matchId: "missing-match",
      },
      crossTenantRequest: {
        tenantId: "22222222-2222-4222-8222-222222222222",
        competitionId: tournament.id,
        matchId: "match-1",
      },
    });
    assert.equal(report.ok, true, JSON.stringify(report.failures || report, null, 2));
  });
});
