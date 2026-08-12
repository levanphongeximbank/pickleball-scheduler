/**
 * Save-boundary diagnostic: does not change validation outcomes.
 * Proves client pre-validation vs mutation gate with F04 focus probe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FORMAT_PRESET, GENDER_REQUIREMENT } from "../src/features/team-tournament/constants.js";
import {
  TT412_F04_ATHLETE_ID,
  beginLineupValidationProbe,
  buildPreValidationSnapshot,
  clearCaptainLineupSaveBoundary,
  endLineupValidationProbe,
  getCaptainLineupSaveBoundary,
  recordCaptainLineupSaveBoundary,
} from "../src/features/team-tournament/diagnostics/captainLineupSaveBoundaryDiagnostics.js";
import {
  CAPTAIN_PORTAL_SCOPED_ROSTER,
  buildCaptainLineupRuntime,
} from "../src/features/team-tournament/engines/captainPortalRosterProjection.js";
import { applyCanonicalMlpDisciplineMetadata } from "../src/features/team-tournament/engines/mlpDisciplineSlotContract.js";
import { validateLineupSelections } from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { mapCaptainPortalResponse } from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";
import { mapTournamentToAggregate } from "../src/features/team-tournament/repositories/teamTournamentRepositoryAggregate.js";
import { aggregateToTournamentView } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { getTeamData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { findTeamForCaptain } from "../src/features/team-tournament/engines/teamPermissionEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const TEAM = {
  id: "team-3xnvw71s",
  name: "Đội 4",
  captain: "c412a101-7e57-4000-8000-000000000002",
  roster: [
    { athleteId: "c412a101-7e57-4000-8000-000000000002", displayName: "TT412-SEED-M02", gender: "male" },
    { athleteId: "c412a101-7e57-4000-8000-000000000008", displayName: "TT412-SEED-M08", gender: "male" },
    { athleteId: TT412_F04_ATHLETE_ID, displayName: "TT412-SEED-F04", gender: "female" },
    { athleteId: "c412a101-7e57-4000-8000-000000000010", displayName: "TT412-SEED-F08", gender: "female" },
  ],
};

function loadRuntime() {
  const mapped = mapCaptainPortalResponse({
    ok: true,
    schemaVersion: 7,
    captainAccessEnabled: true,
    viewerTeamId: TEAM.id,
    viewer: { captain: true, viewerTeamId: TEAM.id },
    tournament: {
      id: "team-tournament-4zllu71z",
      clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
      tenantId: "venue-staging-a",
      name: "Giải đồng đội",
      status: "draft",
      version: 9,
      settings: {
        captainAccessEnabled: true,
        formatPreset: FORMAT_PRESET.MLP_4,
        allowPlayerReusePerMatchup: true,
      },
      myTeam: {
        id: TEAM.id,
        name: TEAM.name,
        captainPlayerId: TEAM.captain,
        playerIds: TEAM.roster.map((r) => r.athleteId),
        rosterAthletes: TEAM.roster,
      },
      opponentTeams: [],
      disciplines: [
        { id: "disc-male", name: "Đôi nam", playerCount: 2, sortOrder: 1, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-female", name: "Đôi nữ", playerCount: 2, sortOrder: 2, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-mx1", name: "Đôi nam nữ", playerCount: 2, sortOrder: 3, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-mx2", name: "Đôi nam nữ", playerCount: 2, sortOrder: 4, genderRequirement: "any", categoryType: "doubles" },
      ],
      matchups: [{ id: "mu-1", teamAId: TEAM.id, teamBId: "other", status: "lineup_open" }],
      lineups: {},
    },
  });
  const tournament = aggregateToTournamentView(mapTournamentToAggregate(mapped.tournament, "cloud"));
  const teamData = applyCanonicalMlpDisciplineMetadata(getTeamData(tournament));
  const captainTeam = findTeamForCaptain(teamData, TEAM.captain);
  const runtime = buildCaptainLineupRuntime({
    teamData,
    captainTeam,
    teamId: TEAM.id,
  });
  return { teamData, runtime };
}

describe("captain lineup save boundary diagnostic", () => {
  it("client validation PASS for F04 female doubles → mutation gate YES; probe sees female", () => {
    clearCaptainLineupSaveBoundary();
    const { teamData, runtime } = loadRuntime();
    assert.equal(runtime.authority, CAPTAIN_PORTAL_SCOPED_ROSTER);
    const female = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
    );
    const selections = {
      [female.id]: [TT412_F04_ATHLETE_ID, "c412a101-7e57-4000-8000-000000000010"],
    };

    beginLineupValidationProbe({ focusAthleteId: TT412_F04_ATHLETE_ID });
    recordCaptainLineupSaveBoundary({
      ...buildPreValidationSnapshot({
        action: "saveDraft",
        team: runtime.team,
        teamId: TEAM.id,
        selections,
        validationPlayers: runtime.athletePool,
      }),
      CLIENT_VALIDATION_CALLED: true,
      MUTATION_CALLED: false,
    });

    const result = validateLineupSelections({
      teamData,
      team: runtime.team,
      teamId: TEAM.id,
      selections,
      players: runtime.athletePool,
      partial: true,
      requireCaptainPortalRoster: true,
    });
    const probe = endLineupValidationProbe();
    recordCaptainLineupSaveBoundary({
      CLIENT_VALIDATION_OK: result.ok === true,
      CLIENT_VALIDATION_CODE: result.validation?.code || null,
      CLIENT_VALIDATION_ERROR: result.ok ? null : result.errors?.join(" ") || null,
      ...(probe?.focus || {}),
      MUTATION_CALLED: result.ok === true,
      MUTATION_METHOD: result.ok ? "saveDraftLineup" : null,
    });

    const boundary = getCaptainLineupSaveBoundary();
    assert.equal(result.ok, true, result.errors?.join(" "));
    assert.equal(boundary.CLIENT_VALIDATION_OK, true);
    assert.equal(boundary.MUTATION_CALLED, true);
    assert.equal(boundary.F04_VALIDATION_PLAYER_FOUND, true);
    assert.equal(boundary.F04_VALIDATION_PLAYER_GENDER, "female");
    assert.equal(boundary.F04_VALIDATION_GENDER_SOURCE, CAPTAIN_PORTAL_SCOPED_ROSTER);
    assert.equal(boundary.F04_PLAYERMAP_FOUND, true);
    assert.equal(boundary.F04_FINAL_GENDER_KEY, "female");
  });

  it("source contracts: TeamPortal records saveBoundary under ttLineupDebug", () => {
    const src = readFileSync(join(root, "src/pages/tournament/TeamPortal.jsx"), "utf8");
    assert.match(src, /saveBoundary/);
    assert.match(src, /beginLineupValidationProbe/);
    assert.match(src, /CLIENT_VALIDATION_OK/);
    assert.match(src, /MUTATION_CALLED/);
    assert.match(src, /F04_FINAL_GENDER_KEY/);
    const engine = readFileSync(
      join(root, "src/features/team-tournament/engines/lineupValidationEngine.js"),
      "utf8"
    );
    assert.match(engine, /notePlayerMapLookup/);
  });
});
