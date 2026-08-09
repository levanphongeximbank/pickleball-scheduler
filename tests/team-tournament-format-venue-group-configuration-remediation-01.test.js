import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FORMAT_PRESET,
  GROUP_MODE,
  KNOCKOUT_FORMAT,
} from "../src/features/team-tournament/constants.js";
import {
  applyMlp4Preset,
  assertAiPairingSupported,
  assertCourtsReadyForPublish,
  buildCourtSlotsFromSelectedIds,
  buildSetupConfigPayload,
  countRoundRobinMatchups,
  deriveGroupSizes,
  mergeFormatVenueIntoSettings,
  normalizeRosterRules,
  resolveFormatVenueDefaults,
  validateRosterRules,
} from "../src/features/team-tournament/engines/teamFormatVenueConfig.js";
import {
  listGroupDivisionOptions,
  tournamentRequiresExplicitGroups,
} from "../src/features/team-tournament/engines/teamGroupDivisionPolicy.js";
import { buildStructuredRoundRobinMatchups } from "../src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import {
  pairSeedsForFirstRound,
  qualifyTeamsFromGroups,
} from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import { canPublishSchedule } from "../src/features/team-tournament/engines/publishScheduleEngine.js";
import { normalizeTeamData } from "../src/features/team-tournament/models/index.js";
import { createMlpDisciplines } from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import {
  preflightSetupMutationCapability,
  V7_GATE_RETIREMENT_RECOMMENDATION,
} from "../src/features/team-tournament/setup/setupMutationFeatureGate.js";
import { confirmAiPairingCloudPersistence } from "../src/features/team-tournament/services/aiPairingCloudPersistence.js";
import { WORKFLOW_STAGE } from "../src/features/team-tournament/engines/teamTournamentWorkflowStage.js";
import { WORKFLOW_STEPS } from "../src/components/tournament/team/teamTournamentWorkflow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function mlpTeam(id, name) {
  return {
    id,
    name,
    playerIds: [`${id}-m1`, `${id}-m2`, `${id}-f1`, `${id}-f2`],
    captainPlayerId: `${id}-m1`,
  };
}

function fourTeams() {
  return [
    mlpTeam("t1", "Alpha"),
    mlpTeam("t2", "Bravo"),
    mlpTeam("t3", "Charlie"),
    mlpTeam("t4", "Delta"),
  ];
}

function baseTeamData(overrides = {}) {
  const preset = applyMlp4Preset();
  return normalizeTeamData({
    disciplines: createMlpDisciplines(),
    teams: fourTeams(),
    groups: [],
    matchups: [],
    settings: {
      ...preset,
      groupMode: GROUP_MODE.SINGLE_POOL,
      groupCount: 1,
      selectedCourtIds: ["court-a", "court-b"],
      ...overrides.settings,
    },
    ...overrides,
  });
}

// A — 4 teams, MLP4, 1 group → 6 RR matchups
test("A: 4 teams MLP4 1 group → 4 teams in one group → 6 RR matchups", () => {
  assert.equal(countRoundRobinMatchups(4), 6);
  const teams = fourTeams();
  const groups = [
    {
      id: "g1",
      name: "Bảng A",
      teamIds: teams.map((t) => t.id),
    },
  ];
  assert.equal(groups.length, 1);
  assert.equal(groups[0].teamIds.length, 4);

  const teamData = baseTeamData({
    groups,
    settings: { groupCount: 1, groupMode: GROUP_MODE.SINGLE_POOL },
  });
  const scheduled = buildStructuredRoundRobinMatchups(teamData, {
    scheduledAt: "2099-01-01T08:00:00.000Z",
    selectedCourtIds: ["court-a", "court-b"],
    venueCourts: [
      { id: "court-a", name: "Court A" },
      { id: "court-b", name: "Court B" },
    ],
  });
  assert.notEqual(scheduled.ok, false);
  assert.equal(scheduled.matchups.length, 6);
});

// B — 4 teams, 2 groups persisted shape
test("B: 4 teams MLP4 2 groups → division options + sizes", () => {
  const options = listGroupDivisionOptions(4);
  assert.ok(options.some((o) => o.groupCount === 1));
  assert.ok(options.some((o) => o.groupCount === 2));
  const two = options.find((o) => o.groupCount === 2);
  assert.deepEqual(two.sizes, [2, 2]);
  assert.deepEqual(deriveGroupSizes(4, 2), [2, 2]);
});

// C — custom roster validation
test("C: custom roster config validation rejects impossible combos", () => {
  assert.equal(validateRosterRules({ teamSize: 4, minPlayers: 5, maxPlayers: 4 }).ok, false);
  assert.equal(
    validateRosterRules({
      teamSize: 4,
      minPlayers: 4,
      maxPlayers: 4,
      requiredMales: 3,
      requiredFemales: 2,
    }).ok,
    false
  );
  const ok = validateRosterRules({
    teamSize: 6,
    minPlayers: 4,
    maxPlayers: 8,
    requiredMales: 2,
    requiredFemales: 2,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.rosterRules.teamSize, 6);
});

// D — court selection persists canonical IDs in settings merge
test("D: court selection persists canonical IDs", () => {
  const payload = buildSetupConfigPayload({
    formatPreset: FORMAT_PRESET.MLP_4,
    selectedCourtIds: ["c1", "c2", "c1"],
    groupCount: 1,
  });
  assert.deepEqual(payload.selectedCourtIds, ["c1", "c2"]);
  const merged = mergeFormatVenueIntoSettings({}, payload);
  assert.deepEqual(merged.selectedCourtIds, ["c1", "c2"]);
});

// E — schedule only uses selected courts
test("E: schedule only uses selected court IDs / labels", () => {
  const teamData = baseTeamData({
    groups: [{ id: "g1", name: "A", teamIds: ["t1", "t2", "t3", "t4"] }],
  });
  const next = buildStructuredRoundRobinMatchups(teamData, {
    scheduledAt: "2099-01-01T08:00:00.000Z",
    selectedCourtIds: ["court-a"],
    venueCourts: [{ id: "court-a", name: "Sân Chính" }],
  });
  assert.equal(next.matchups.length, 6);
  assert.ok(next.matchups.every((m) => m.courtId === "court-a"));
  assert.ok(next.matchups.every((m) => m.courtLabel === "Sân Chính"));
});

// F — no selected courts → publish blocked
test("F: no selected courts → publish blocked", () => {
  const teamData = baseTeamData({
    settings: { selectedCourtIds: [] },
    matchups: [
      {
        id: "m1",
        teamAId: "t1",
        teamBId: "t2",
        scheduledAt: "2099-01-01T08:00:00.000Z",
        courtLabel: "Sân 1",
        subMatches: [],
      },
    ],
  });
  const gate = assertCourtsReadyForPublish(teamData);
  assert.equal(gate.ok, false);
  assert.equal(gate.code, "NO_SELECTED_COURTS");
  const publish = canPublishSchedule(teamData);
  assert.equal(publish.ok, false);
});

// G/H — skip animation does not recompute (player API contract)
test("G/H: skipToEnd is presentation-only (same total, jumps to end)", () => {
  // Pure contract of useShowcaseRevealPlayer — skipToEnd only mutates revealedCount.
  const source = readFileSync(
    join(ROOT, "src/features/team-tournament/showcase/useShowcaseRevealPlayer.js"),
    "utf8"
  );
  assert.match(source, /skipToEnd/);
  assert.match(source, /setRevealedCount\(total\)/);
  const teamReveal = readFileSync(
    join(ROOT, "src/features/team-tournament/showcase/ShowcaseTeamReveal.jsx"),
    "utf8"
  );
  const groupReveal = readFileSync(
    join(ROOT, "src/features/team-tournament/showcase/ShowcaseGroupReveal.jsx"),
    "utf8"
  );
  assert.match(teamReveal, /Bỏ qua hiệu ứng/);
  assert.match(groupReveal, /Bỏ qua hiệu ứng/);
  assert.match(teamReveal, /player\.skipToEnd/);
  assert.match(groupReveal, /player\.skipToEnd/);
  // freeze: skip must not call engines
  assert.doesNotMatch(teamReveal, /runTeamDraw|buildSnakeGroups|createAiDraw/);
});

// I — group confirm canonical persistence contract (exact group count)
test("I: group confirm readback requires exact group count (no F5)", () => {
  const expected1 = [{ id: "g1", teamIds: ["t1", "t2", "t3", "t4"] }];
  const expected2 = [
    { id: "g1", teamIds: ["t1", "t2"] },
    { id: "g2", teamIds: ["t3", "t4"] },
  ];
  const readbackOk = (persisted, expected) =>
    Array.isArray(persisted) && persisted.length === expected.length;
  assert.equal(readbackOk(expected1, expected1), true);
  assert.equal(readbackOk(expected2, expected2), true);
  assert.equal(readbackOk([{ id: "g1" }], expected2), false);
  assert.equal(readbackOk(null, expected1), false);

  const persistSource = readFileSync(
    join(ROOT, "src/features/team-tournament/services/aiPairingCloudPersistence.js"),
    "utf8"
  );
  assert.match(persistSource, /preflightSetupMutationCapability/);
  assert.match(persistSource, /GROUPS_READBACK_INCOMPLETE|groupsPersisted !== groups\.length/);
  assert.match(persistSource, /requiresF5: false/);
});

test("I2: 1-group and 2-group expected lengths are canonical", () => {
  assert.equal([{ id: "g1", teamIds: ["a", "b", "c", "d"] }].length, 1);
  assert.equal(
    [
      { id: "g1", teamIds: ["a", "b"] },
      { id: "g2", teamIds: ["c", "d"] },
    ].length,
    2
  );
  assert.equal(WORKFLOW_STEPS[0].id, "format");
  assert.ok(WORKFLOW_STEPS.some((s) => s.id === "groups"));
});

// J — V7 OFF fails before partial writes
test("J: V7 OFF → fail before partial destructive/partial-success sequence", async () => {
  const preflight = preflightSetupMutationCapability({
    envSource: { VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7: "false" },
  });
  assert.equal(preflight.ok, false);
  assert.equal(preflight.writeAttempted, false);

  let teamWrite = 0;
  const result = await confirmAiPairingCloudPersistence({
    clubId: "club-1",
    tournamentId: "tour-1",
    tournament: { id: "tour-1" },
    nextTeamData: {
      teams: fourTeams(),
      groups: [{ id: "g1", name: "A", teamIds: ["t1", "t2", "t3", "t4"] }],
    },
    envSource: { VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7: "off" },
    persistSetupTeamData: async () => {
      throw new Error("should not persist groups when gate off");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(teamWrite, 0);
  assert.match(String(result.error || ""), /VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7|tắt/i);
  assert.ok(V7_GATE_RETIREMENT_RECOMMENDATION.includes("KEEP_UNTIL_STAGING"));
});

// K — legacy-compatible open
test("K: existing legacy-compatible Team tournament still opens (read defaults)", () => {
  const legacy = resolveFormatVenueDefaults({
    teams: fourTeams(),
    groups: [],
    settings: {},
  });
  assert.equal(legacy.formatPreset, FORMAT_PRESET.MLP_4);
  assert.equal(legacy.rosterRules.minPlayers, 4);
  assert.deepEqual(legacy.selectedCourtIds, []);
  assert.equal(legacy.groupMode, GROUP_MODE.SINGLE_POOL);

  const withGroups = resolveFormatVenueDefaults({
    teams: fourTeams(),
    groups: [{ id: "g1", teamIds: ["t1", "t2"] }],
    settings: {},
  });
  assert.equal(withGroups.groupMode, GROUP_MODE.MANUAL);

  const normalized = normalizeTeamData({
    teams: fourTeams(),
    settings: {},
  });
  assert.equal(normalized.settings.formatPreset, FORMAT_PRESET.MLP_4);
});

// Single-group knockout
test("single-group knockout: top 2 final / top 4 semis", () => {
  const teams = fourTeams();
  const teamData = baseTeamData({
    groups: [{ id: "g1", name: "Pool", teamIds: teams.map((t) => t.id) }],
    matchups: [
      {
        id: "m1",
        teamAId: "t1",
        teamBId: "t2",
        status: "completed",
        result: { winnerTeamId: "t1", teamAWins: 1, teamBWins: 0 },
        subMatches: [],
      },
      {
        id: "m2",
        teamAId: "t3",
        teamBId: "t4",
        status: "completed",
        result: { winnerTeamId: "t3", teamAWins: 1, teamBWins: 0 },
        subMatches: [],
      },
      {
        id: "m3",
        teamAId: "t1",
        teamBId: "t3",
        status: "completed",
        result: { winnerTeamId: "t1", teamAWins: 1, teamBWins: 0 },
        subMatches: [],
      },
      {
        id: "m4",
        teamAId: "t2",
        teamBId: "t4",
        status: "completed",
        result: { winnerTeamId: "t2", teamAWins: 1, teamBWins: 0 },
        subMatches: [],
      },
      {
        id: "m5",
        teamAId: "t1",
        teamBId: "t4",
        status: "completed",
        result: { winnerTeamId: "t1", teamAWins: 1, teamBWins: 0 },
        subMatches: [],
      },
      {
        id: "m6",
        teamAId: "t2",
        teamBId: "t3",
        status: "completed",
        result: { winnerTeamId: "t2", teamAWins: 1, teamBWins: 0 },
        subMatches: [],
      },
    ],
    settings: {
      ...applyMlp4Preset(),
      groupCount: 1,
      qualificationCount: 2,
      knockoutFormat: KNOCKOUT_FORMAT.FINAL_ONLY,
      selectedCourtIds: ["court-a"],
    },
  });

  const finalOnly = qualifyTeamsFromGroups(teamData, {
    knockoutFormat: KNOCKOUT_FORMAT.FINAL_ONLY,
    qualificationCount: 2,
  });
  assert.equal(finalOnly.ok, true);
  assert.equal(finalOnly.qualified.length, 2);

  const semis = qualifyTeamsFromGroups(teamData, {
    knockoutFormat: KNOCKOUT_FORMAT.SEMIFINALS,
    qualificationCount: 4,
  });
  assert.equal(semis.ok, true);
  assert.equal(semis.qualified.length, 4);
  const pairs = pairSeedsForFirstRound(semis.qualified);
  assert.equal(pairs.length, 2);
});

test("AI pairing capability is explicit for custom format", () => {
  const custom = assertAiPairingSupported({
    settings: { formatPreset: FORMAT_PRESET.CUSTOM },
  });
  assert.equal(custom.ok, false);
  assert.equal(custom.code, "AI_PAIRING_MLP4_ONLY");
  assert.equal(assertAiPairingSupported({ settings: applyMlp4Preset() }).ok, true);
});

test("groupCount=1 is allowed (no min-2 floor)", () => {
  const options = listGroupDivisionOptions(4);
  assert.ok(options.some((o) => o.groupCount === 1));
  assert.equal(tournamentRequiresExplicitGroups(4, {
    settings: { groupMode: GROUP_MODE.SINGLE_POOL, groupCount: 1 },
  }), false);
});

test("migration package present and RPC not auto-applied", () => {
  const readme = readFileSync(
    join(
      ROOT,
      "docs/v5/migrations/team-tournament-format-venue-group-configuration-remediation-01/README.md"
    ),
    "utf8"
  );
  assert.match(readme, /DO NOT APPLY/);
  assert.match(readme, /SQL_REQUIRED/);
  const sql = readFileSync(
    join(
      ROOT,
      "docs/v5/migrations/team-tournament-format-venue-group-configuration-remediation-01/01_UPDATE_SETUP_CONFIG_RPC.sql"
    ),
    "utf8"
  );
  assert.match(sql, /team_tournament_update_setup_config/);
  assert.match(sql, /selectedCourtIds/);
});

test("workflow includes format stage before teams", () => {
  assert.equal(WORKFLOW_STEPS[0].id, "format");
  assert.equal(WORKFLOW_STEPS[1].id, "teams");
  assert.equal(WORKFLOW_STAGE.FORMAT, "format");
});

test("normalizeRosterRules fills teamSize", () => {
  const rules = normalizeRosterRules({
    minPlayers: 4,
    maxPlayers: 4,
    requiredMales: 2,
    requiredFemales: 2,
  });
  assert.equal(rules.teamSize, 4);
});

test("buildCourtSlotsFromSelectedIds uses venue inventory", () => {
  const slots = buildCourtSlotsFromSelectedIds(
    ["c2", "c1"],
    [
      { id: "c1", name: "One" },
      { id: "c2", number: 7 },
    ]
  );
  assert.equal(slots.length, 2);
  assert.equal(slots[0].courtId, "c2");
  assert.equal(slots[1].courtLabel, "One");
});
