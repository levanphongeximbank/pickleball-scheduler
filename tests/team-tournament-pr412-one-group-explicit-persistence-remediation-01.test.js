/**
 * TEAM-TOURNAMENT-PR412-ONE-GROUP-EXPLICIT-PERSISTENCE-REMEDIATION-01
 *
 * Owner "1 bảng" must persist exactly one explicit canonical group.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import { FORMAT_PRESET, GROUP_MODE } from "../src/features/team-tournament/constants.js";
import {
  EXPLICIT_SINGLE_GROUP_ID,
  hasOrganizerConfiguredGroupCount,
  listGroupDivisionOptions,
  materializeExplicitGroupsFromTeams,
  tournamentRequiresExplicitGroups,
} from "../src/features/team-tournament/engines/teamGroupDivisionPolicy.js";
import {
  countRoundRobinMatchups,
  resolveFormatVenueDefaults,
} from "../src/features/team-tournament/engines/teamFormatVenueConfig.js";
import { buildStructuredRoundRobinMatchups } from "../src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import { buildSnakeGroupsFromSortedTeams } from "../src/features/team-tournament/engines/teamGroupSeedEngine.js";
import {
  deriveWorkflowStage,
  WORKFLOW_STAGE,
} from "../src/features/team-tournament/engines/teamTournamentWorkflowStage.js";
import { buildAiGroupRevealSession } from "../src/features/team-tournament/showcase/buildAiGroupRevealSession.js";
import {
  __resetConfirmAiPairingCloudPersistenceDepsForTests,
  __setConfirmAiPairingCloudPersistenceDepsForTests,
  confirmAiPairingCloudPersistence,
} from "../src/features/team-tournament/services/aiPairingCloudPersistence.js";
import { confirmAiPairingUiTransaction } from "../src/features/team-tournament/services/confirmAiPairingUiTransaction.js";
import {
  createCanonicalSetupRefreshController,
  refreshCanonicalSetupAfterMutation,
} from "../src/features/team-tournament/ui/canonicalSetupRefresh.js";
import { normalizeTeamData } from "../src/features/team-tournament/models/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function buildTeams(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Đội ${index + 1}`,
    playerIds: [
      `m${index + 1}a`,
      `m${index + 1}b`,
      `f${index + 1}a`,
      `f${index + 1}b`,
    ],
    captainPlayerId: `m${index + 1}a`,
    avgLevel: 4,
    seed: index + 1,
  }));
}

afterEach(() => {
  __resetConfirmAiPairingCloudPersistenceDepsForTests();
});

describe("team-tournament-pr412-one-group-explicit-persistence-remediation-01", () => {
  it("A ONE_GROUP_PREVIEW: 4 teams + groupCount=1 → preview groups.length=1", () => {
    const teams = buildTeams(4);
    const players = teams.flatMap((team) =>
      team.playerIds.map((id) => ({
        id,
        name: id,
        gender: String(id).startsWith("m") ? "male" : "female",
        rating: 4,
      }))
    );
    const built = buildAiGroupRevealSession({
      teams,
      players,
      groupCount: 1,
      randomFn: () => 0.25,
    });
    assert.equal(built.ok, true, built.error);
    assert.equal(built.teamData?.groups?.length, 1);
    assert.equal(built.teamData.groups[0].id, EXPLICIT_SINGLE_GROUP_ID);
    assert.equal(built.teamData.groups[0].name, "Bảng A");
    assert.equal(built.teamData.groups[0].teamIds.length, 4);

    const snake = buildSnakeGroupsFromSortedTeams(teams, 1);
    assert.equal(snake.length, 1);
    assert.equal(snake[0].id, EXPLICIT_SINGLE_GROUP_ID);
  });

  it("B/C/D/H ONE_GROUP_CONFIRM: empty preview materializes → commit_pairing once → readback=1 + all team ids", async () => {
    const teams = buildTeams(4);
    let commitCalls = 0;
    let persistCalls = 0;
    let applyCalls = 0;
    let persistedGroups = null;

    __setConfirmAiPairingCloudPersistenceDepsForTests({
      preflightSetupMutationCapability: () => ({ ok: true, gateEnabled: true }),
      applyAiGeneratedTeamsToTournament: async () => {
        applyCalls += 1;
        return { ok: false, code: "MUST_NOT_CALL" };
      },
    });

    const result = await confirmAiPairingCloudPersistence({
      clubId: "club-1",
      tournamentId: "tt-one-group",
      tournament: {
        id: "tt-one-group",
        clubId: "club-1",
        tenantId: "venue-1",
        settings: {
          formatPreset: FORMAT_PRESET.MLP_4,
          groupMode: GROUP_MODE.SINGLE_POOL,
          groupCount: 1,
        },
      },
      currentTenantId: "venue-1",
      nextTeamData: {
        teams,
        groups: [],
        matchups: [],
        settings: {
          formatPreset: FORMAT_PRESET.MLP_4,
          groupMode: GROUP_MODE.SINGLE_POOL,
          groupCount: 1,
        },
      },
      rulesVersion: "ppr-runtime-v1",
      expectedTournamentVersion: 1,
      persistSetupTeamData: async () => {
        persistCalls += 1;
        return { ok: false, code: "MUST_NOT_CALL" };
      },
      commitPairing: async ({ groups }) => {
        commitCalls += 1;
        persistedGroups = groups || [];
        assert.equal(persistedGroups.length, 1);
        assert.equal(persistedGroups[0].id, EXPLICIT_SINGLE_GROUP_ID);
        return {
          ok: true,
          version: 2,
          teamData: {
            teams,
            groups: persistedGroups,
            matchups: [],
          },
        };
      },
      reload: async () => ({
        ok: true,
        version: 2,
        teamData: {
          teams,
          groups: persistedGroups,
          matchups: [],
        },
      }),
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(commitCalls, 1);
    assert.equal(persistCalls, 0);
    assert.equal(applyCalls, 0);
    assert.equal(result.groupsExpected, 1);
    assert.equal(result.groupsPersisted, 1);
    assert.equal(persistedGroups?.length, 1);
    assert.deepEqual(
      [...persistedGroups[0].teamIds].sort(),
      teams.map((team) => team.id).sort()
    );
  });

  it("E FOUR_TEAMS_ONE_GROUP_RR: exactly 6 matchups, no self/dupes", () => {
    assert.equal(countRoundRobinMatchups(4), 6);
    const teams = buildTeams(4);
    const groups = [
      {
        id: EXPLICIT_SINGLE_GROUP_ID,
        name: "Bảng A",
        teamIds: teams.map((t) => t.id),
      },
    ];
    const scheduled = buildStructuredRoundRobinMatchups(
      normalizeTeamData({
        teams,
        groups,
        matchups: [],
        settings: {
          formatPreset: FORMAT_PRESET.MLP_4,
          groupMode: GROUP_MODE.SINGLE_POOL,
          groupCount: 1,
          selectedCourtIds: ["c1", "c2"],
        },
      }),
      {
        scheduledAt: "2099-01-01T08:00:00.000Z",
        selectedCourtIds: ["c1", "c2"],
        venueCourts: [
          { id: "c1", name: "Sân 1" },
          { id: "c2", name: "Sân 2" },
        ],
      }
    );
    assert.notEqual(scheduled.ok, false, scheduled.error);
    assert.equal(scheduled.matchups.length, 6);
    const pairs = new Set();
    for (const matchup of scheduled.matchups) {
      assert.notEqual(matchup.teamAId, matchup.teamBId);
      const key = [matchup.teamAId, matchup.teamBId].sort().join("|");
      assert.equal(pairs.has(key), false, `duplicate pair ${key}`);
      pairs.add(key);
    }
    assert.equal(pairs.size, 6);
  });

  it("F TWO_GROUP_REGRESSION: 2-group option + snake still length 2", () => {
    const options = listGroupDivisionOptions(4);
    assert.ok(options.some((o) => o.groupCount === 2));
    const teams = buildTeams(4);
    const groups = buildSnakeGroupsFromSortedTeams(teams, 2);
    assert.equal(groups.length, 2);
    assert.equal(
      groups.reduce((sum, g) => sum + g.teamIds.length, 0),
      4
    );
    assert.notEqual(groups[0].id, EXPLICIT_SINGLE_GROUP_ID);
  });

  it("G N_GROUP_REGRESSION: 8 teams / 4 groups unchanged", () => {
    const options = listGroupDivisionOptions(8);
    assert.ok(options.some((o) => o.groupCount === 4));
    const teams = buildTeams(8);
    const groups = buildSnakeGroupsFromSortedTeams(teams, 4);
    assert.equal(groups.length, 4);
    assert.equal(
      groups.reduce((sum, g) => sum + g.teamIds.length, 0),
      8
    );
  });

  it("H EMPTY_GROUP_FALSE_SUCCESS: groupCount>1 empty fails; groupCount=1 materializes; legacy missing config untouched", () => {
    const teams = buildTeams(4);
    const fail = materializeExplicitGroupsFromTeams({
      teams,
      groupCount: 2,
      existingGroups: [],
    });
    assert.equal(fail.ok, false);
    assert.equal(fail.code, "GROUPS_REQUIRED");

    const one = materializeExplicitGroupsFromTeams({
      teams,
      groupCount: 1,
      existingGroups: [],
    });
    assert.equal(one.ok, true);
    assert.equal(one.materialized, true);
    assert.equal(one.groups.length, 1);

    assert.equal(
      tournamentRequiresExplicitGroups(4, {
        settings: { groupMode: GROUP_MODE.SINGLE_POOL, groupCount: 1 },
      }),
      true
    );
    assert.equal(tournamentRequiresExplicitGroups(4, { settings: {} }), false);
    assert.equal(hasOrganizerConfiguredGroupCount({ settings: { groupCount: 1 } }), true);
    assert.equal(hasOrganizerConfiguredGroupCount({ settings: {} }), false);
  });

  it("I CAPTAIN_GROUP_NO_F5: UI transaction final get_setup + no location.reload", async () => {
    const teams = buildTeams(4);
    const groups = [
      {
        id: EXPLICIT_SINGLE_GROUP_ID,
        name: "Bảng A",
        teamIds: teams.map((t) => t.id),
      },
    ];
    const controller = createCanonicalSetupRefreshController();
    const applied = [];
    let refreshCalls = 0;

    const result = await confirmAiPairingUiTransaction({
      beginMutationBarrier: () => controller.beginMutationBarrier(),
      endMutationBarrier: () => controller.endMutationBarrier(),
      refreshAfterMutation: async () => {
        refreshCalls += 1;
        return refreshCanonicalSetupAfterMutation({
          controller,
          loadSetup: async () => ({
            ok: true,
            version: 8,
            teamData: { teams, groups, disciplines: [], matchups: [] },
            tournament: { id: "tt-1", teamData: { teams, groups } },
          }),
          applyLoadResult: (r) => applied.push(r),
        });
      },
      nextTeamData: { teams, groups, matchups: [] },
      confirmFn: async () => ({
        ok: true,
        writeCount: 2,
        captainsPersisted: 4,
        groupsExpected: 1,
        groupsPersisted: 1,
        groupResult: { ok: true, teamData: { teams, groups } },
        teamData: { teams, groups, matchups: [] },
        tournament: { id: "tt-1" },
      }),
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(refreshCalls, 1);
    assert.equal(applied[0].teamData.groups.length, 1);
    assert.equal(result.reactCanonicalCommitted, true);
    assert.notEqual(deriveWorkflowStage(applied[0].teamData), WORKFLOW_STAGE.TEAMS);

    const persistSrc = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );
    assert.match(persistSrc, /materializeExplicitGroupsFromTeams/);
    assert.doesNotMatch(persistSrc, /location\.reload/);
    const dialogSrc = readSrc("src/components/tournament/team/TeamAiPairingDialog.jsx");
    assert.match(dialogSrc, /materializeExplicitGroupsFromTeams/);
    assert.doesNotMatch(dialogSrc, /location\.reload/);

    const defaults = resolveFormatVenueDefaults({
      settings: { groupMode: GROUP_MODE.SINGLE_POOL, groupCount: 1 },
    });
    assert.equal(defaults.groupMode, GROUP_MODE.SINGLE_POOL);
    assert.equal(defaults.groupCount, 1);
  });
});
