/**
 * OFFICIAL_TOURNAMENT_CORE13_ASSIGNMENT_CUTOVER_01
 * Focused proof: Official assign/replace/unassign → CORE-13 only;
 * Director shares the same facade; blob never authority before ACK.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import {
  OFFICIAL_CORE13_ASSIGNMENT_ACTIONS,
  executeOfficialCore13RefereeAssignment,
  officialAssignReferee,
  officialReplaceReferee,
  officialUnassignReferee,
  resolveOfficialCore13RefereeSubject,
  resolveOfficialAssignmentTenantId,
  resolveOfficialAssignmentMatchId,
  MATCH_ID_TRANSLATION_REQUIRED,
} from "../src/features/tournament/official-tournament-experience/officialCore13AssignmentCommands.js";
import {
  getRefereeAssignments,
  assignRefereeToIndividualMatch,
  LEGACY_INDIVIDUAL_ASSIGNMENT_AUTHORITY,
} from "../src/features/individual-tournament/engines/refereeAssignEngine.js";
import { resolveCanonicalRefereeIdFromRoster } from "../src/features/individual-tournament/engines/core13AssignmentProjection.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "../src/features/tournament/official-tournament-experience/authorityLock.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_REF = "8bb178b3-c0d8-4965-848d-2de9d73fa9d6";
const TENANT = "11111111-1111-4111-8111-111111111111";

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function baseTournament(overrides = {}) {
  return {
    id: "fc6da50a-b174-4187-af88-e38a025f22a5",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    tenantId: TENANT,
    clubId: "club-fixture",
    name: "Giải đấu 17/8/2026 Test 1",
    settings: {
      refereeRoster: [
        {
          id: "roster-local-01",
          name: "Trọng tài 01",
          active: true,
          canonicalUserId: CANONICAL_REF,
        },
        {
          id: "roster-guest",
          name: "Trọng tài không account",
          active: true,
        },
      ],
      refereeAssignments: {
        "GA-R1-M1": {
          matchId: "GA-R1-M1",
          rosterId: "legacy-row",
          refereeName: "Legacy blob only",
          status: "assigned",
        },
      },
    },
    events: [
      {
        id: "ev-1",
        matches: [{ id: "GA-R1-M1", status: "scheduled", referee: null }],
      },
    ],
    ...overrides,
  };
}

function createMockApi({
  version = 0,
  active = null,
  assignOk = true,
  replaceOk = true,
  unassignOk = true,
  failCode = null,
} = {}) {
  const calls = [];
  return {
    calls,
    api: {
      getMatchAssignmentVersion: async (scope) => {
        calls.push({ op: "getMatchAssignmentVersion", scope });
        return { ok: true, version };
      },
      getActiveAssignment: async (scope) => {
        calls.push({ op: "getActiveAssignment", scope });
        return { ok: true, assignment: active };
      },
      assignReferee: async (command) => {
        calls.push({ op: "assignReferee", command });
        if (!assignOk) {
          return { ok: false, code: failCode || "ASSIGN_FAILED", error: "assign failed" };
        }
        return {
          ok: true,
          version: version + 1,
          assignment: {
            matchId: command.matchId,
            refereeId: command.refereeId,
            status: "active",
            assignedAt: "2026-08-21T00:00:00.000Z",
          },
        };
      },
      replaceReferee: async (command) => {
        calls.push({ op: "replaceReferee", command });
        if (!replaceOk) {
          return { ok: false, code: failCode || "REPLACE_FAILED", error: "replace failed" };
        }
        return {
          ok: true,
          version: version + 1,
          assignment: {
            matchId: command.matchId,
            refereeId: command.newRefereeId,
            status: "active",
          },
        };
      },
      unassignReferee: async (command) => {
        calls.push({ op: "unassignReferee", command });
        if (!unassignOk) {
          return { ok: false, code: failCode || "UNASSIGN_FAILED", error: "unassign failed" };
        }
        return { ok: true, version: version + 1, assignment: null };
      },
    },
  };
}

describe("OFFICIAL_TOURNAMENT_CORE13_ASSIGNMENT_CUTOVER_01", () => {
  it("1-10 ASSIGN: Official assign calls CORE-13 with canonical identity, CAS, idempotency, scopes", async () => {
    const t = baseTournament();
    const mock = createMockApi({ version: 3 });
    const beforeBlob = JSON.stringify(getRefereeAssignments(t));

    const result = await officialAssignReferee(
      t,
      {
        matchId: "GA-R1-M1",
        rosterOrCanonicalId: "roster-local-01",
        tenantId: TENANT,
      },
      { api: mock.api }
    );

    assert.equal(result.ok, true);
    assert.equal(result.core13, true);
    assert.equal(result.refereeId, CANONICAL_REF);
    assert.equal(result.matchId, "GA-R1-M1");
    assert.equal(result.authority, OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT);
    assert.equal(result.settingsRefereeAssignmentsAuthority, "COMPATIBILITY_PROJECTION_ONLY");

    const assignCall = mock.calls.find((c) => c.op === "assignReferee");
    assert.ok(assignCall, "must call CORE-13 assignReferee");
    assert.equal(assignCall.command.refereeId, CANONICAL_REF);
    assert.equal(assignCall.command.tenantId, TENANT);
    assert.equal(assignCall.command.tournamentId, t.id);
    assert.equal(assignCall.command.matchId, "GA-R1-M1");
    assert.equal(assignCall.command.expectedVersion, 3);
    assert.match(String(assignCall.command.idempotencyKey), /official-assign-/);
    assert.notEqual(assignCall.command.tenantId, t.clubId);

    // Projection only after ACK — original blob snapshot taken before mutation.
    assert.equal(beforeBlob.includes("Legacy blob only"), true);
    assert.equal(getRefereeAssignments(result.tournament)["GA-R1-M1"].canonicalUserId, CANONICAL_REF);
    assert.equal(result.tournament.settings.core13RefereeAssignments.authority, false);
    assert.equal(result.tournament.settings.core13RefereeAssignments.projectionOnly, true);
  });

  it("5 FAIL CLOSED: missing canonicalUserId never calls CORE-13 mutate", async () => {
    const t = baseTournament();
    const mock = createMockApi();
    const result = await officialAssignReferee(
      t,
      { matchId: "GA-R1-M1", rosterOrCanonicalId: "roster-guest", tenantId: TENANT },
      { api: mock.api }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "CANONICAL_REFEREE_ID_REQUIRED");
    assert.match(result.error, /danh tính canonical/);
    assert.equal(mock.calls.some((c) => c.op === "assignReferee"), false);
  });

  it("4 displayName is never identity", () => {
    const t = baseTournament();
    const subject = resolveOfficialCore13RefereeSubject(t, "Trọng tài 01");
    assert.equal(subject.ok, false);
    const resolved = resolveCanonicalRefereeIdFromRoster(t, "Trọng tài 01");
    assert.equal(resolved.ok, false);
  });

  it("8 TENANT_REQUIRED: clubId is not tenant substitute", async () => {
    const t = baseTournament({ tenantId: "" });
    const tenant = resolveOfficialAssignmentTenantId(t, {});
    assert.equal(tenant.ok, false);
    assert.equal(tenant.code, "TENANT_REQUIRED");

    const mock = createMockApi();
    const result = await officialAssignReferee(
      t,
      { matchId: "GA-R1-M1", rosterOrCanonicalId: CANONICAL_REF },
      { api: mock.api }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "TENANT_REQUIRED");
    assert.equal(mock.calls.length, 0);
  });

  it("10 match id GA-R1-M1 is opaque CORE-13 key (no translation)", () => {
    assert.equal(MATCH_ID_TRANSLATION_REQUIRED, false);
    const match = resolveOfficialAssignmentMatchId("GA-R1-M1");
    assert.equal(match.ok, true);
    assert.equal(match.matchId, "GA-R1-M1");
    assert.equal(match.translationRequired, false);
  });

  it("2 assign failure does not claim blob success", async () => {
    const t = baseTournament();
    const mock = createMockApi({ assignOk: false, failCode: "CAS_CONFLICT" });
    const result = await officialAssignReferee(
      t,
      { matchId: "GA-R1-M1", rosterOrCanonicalId: CANONICAL_REF, tenantId: TENANT },
      { api: mock.api }
    );
    assert.equal(result.ok, false);
    assert.equal(result.projected, false);
    assert.equal(getRefereeAssignments(t)["GA-R1-M1"].refereeName, "Legacy blob only");
  });

  it("11-15 REPLACE: CORE-13 replace with CAS + projection after ACK", async () => {
    const t = baseTournament();
    const mock = createMockApi({
      version: 5,
      active: { refereeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "active" },
    });
    const result = await officialReplaceReferee(
      t,
      {
        matchId: "GA-R1-M1",
        rosterOrCanonicalId: CANONICAL_REF,
        tenantId: TENANT,
        expectedVersion: 5,
      },
      { api: mock.api }
    );
    assert.equal(result.ok, true);
    const replaceCall = mock.calls.find((c) => c.op === "replaceReferee");
    assert.ok(replaceCall);
    assert.equal(replaceCall.command.newRefereeId, CANONICAL_REF);
    assert.equal(replaceCall.command.expectedVersion, 5);
    assert.match(String(replaceCall.command.idempotencyKey), /official-replace-/);
    assert.equal(getRefereeAssignments(result.tournament)["GA-R1-M1"].canonicalUserId, CANONICAL_REF);
  });

  it("12 stale expectedVersion fails closed", async () => {
    const t = baseTournament();
    const mock = createMockApi({
      version: 1,
      replaceOk: false,
      failCode: "VERSION_CONFLICT",
      active: { refereeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
    const result = await officialReplaceReferee(
      t,
      {
        matchId: "GA-R1-M1",
        rosterOrCanonicalId: CANONICAL_REF,
        tenantId: TENANT,
        expectedVersion: 1,
      },
      { api: mock.api }
    );
    assert.equal(result.ok, false);
    assert.equal(result.projected, false);
  });

  it("16-20 UNASSIGN: CORE-13 unassign + projection clear after ACK", async () => {
    const t = baseTournament();
    const mock = createMockApi({
      version: 2,
      active: { refereeId: CANONICAL_REF, status: "active" },
    });
    const result = await officialUnassignReferee(
      t,
      { matchId: "GA-R1-M1", tenantId: TENANT },
      { api: mock.api }
    );
    assert.equal(result.ok, true);
    const un = mock.calls.find((c) => c.op === "unassignReferee");
    assert.ok(un);
    assert.equal(un.command.expectedVersion, 2);
    assert.match(String(un.command.idempotencyKey), /official-unassign-/);
    assert.equal(getRefereeAssignments(result.tournament)["GA-R1-M1"], undefined);
  });

  it("21-24 Director uses same facade; no private blob-first writer", () => {
    const director = read("src/features/tournament/director/hooks/useDirectorActions.js");
    assert.match(director, /executeOfficialCore13RefereeAssignment/);
    assert.match(director, /official-core13/);
    // Blob patch only after CORE-13 path for non-daily
    assert.match(director, /COMPATIBILITY_PROJECTION_ONLY/);
    assert.doesNotMatch(
      director,
      /isDaily[\s\S]{0,40}false[\s\S]{0,200}patchRefereeInTournament\(currentTournament/
    );
  });

  it("25-29 LEGACY: settings/match/engine not authority; no displayName fallback", () => {
    assert.equal(LEGACY_INDIVIDUAL_ASSIGNMENT_AUTHORITY.productWriters, 0);
    const legacy = assignRefereeToIndividualMatch(baseTournament(), "GA-R1-M1", "roster-local-01");
    assert.equal(legacy.ok, false);
    assert.equal(legacy.code, "LEGACY_ASSIGNMENT_AUTHORITY_RETIRED");

    const panel = read("src/components/tournament/RefereeAssignPanel.jsx");
    assert.match(panel, /executeOfficialCore13RefereeAssignment/);
    assert.doesNotMatch(panel, /tournament\.clubId/);

    const dialog = read("src/components/tournament/RefereeAssignDialog.jsx");
    assert.match(dialog, /requireCanonicalIdentity/);
    assert.match(dialog, /danh tính canonical/);
    assert.match(dialog, /No blob write before CORE-13 ACK/);
  });

  it("35-38 Adapter B translation-only; Panel/facade are integration; Experience Match Center stays null writer", () => {
    const adapterB = read(
      "src/features/tournament/official-open-adapter-b/officialTournamentRefereeAdapter.js"
    );
    assert.match(adapterB, /resolveCanonicalRefereeIdFromRoster/);
    assert.doesNotMatch(adapterB, /async\s+assignReferee\s*\(/);

    const experience = read(
      "src/features/tournament/official-tournament-experience/officialTournamentExperienceAdapter.js"
    );
    assert.match(experience, /assignReferee:\s*null/);

    const facade = read(
      "src/features/tournament/official-tournament-experience/officialCore13AssignmentCommands.js"
    );
    assert.match(facade, /createCompetitionRefereeAssignmentTrustedClient/);
    assert.match(facade, /projectCore13AssignmentOntoTournament/);
    assert.match(facade, /Compatibility projection ONLY after durable ACK/);
  });

  it("assign then auto-replace when active exists (Panel semantics via facade)", async () => {
    const t = baseTournament();
    const mock = createMockApi({
      version: 4,
      active: { refereeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
    const result = await executeOfficialCore13RefereeAssignment(
      t,
      {
        action: OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.ASSIGN,
        matchId: "GA-R1-M1",
        rosterOrCanonicalId: CANONICAL_REF,
        tenantId: TENANT,
      },
      { api: mock.api }
    );
    assert.equal(result.ok, true);
    assert.equal(result.action, OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.REPLACE);
    assert.ok(mock.calls.some((c) => c.op === "replaceReferee"));
    assert.equal(mock.calls.some((c) => c.op === "assignReferee"), false);
  });
});
