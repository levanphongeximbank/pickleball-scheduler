/**
 * Server gender canonical closure — package + client parity contracts.
 * Does not mutate Staging; asserts local SQL package + client validation for TT412 F04 shape.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FORMAT_PRESET, GENDER_REQUIREMENT } from "../src/features/team-tournament/constants.js";
import {
  CAPTAIN_PORTAL_SCOPED_ROSTER,
  buildCaptainLineupRuntime,
} from "../src/features/team-tournament/engines/captainPortalRosterProjection.js";
import { applyCanonicalMlpDisciplineMetadata } from "../src/features/team-tournament/engines/mlpDisciplineSlotContract.js";
import { validateLineupSelections } from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { findTeamForCaptain } from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { getTeamData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { mapCaptainPortalResponse } from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";
import { mapTournamentToAggregate } from "../src/features/team-tournament/repositories/teamTournamentRepositoryAggregate.js";
import { aggregateToTournamentView } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = join(
  root,
  "docs/v5/migrations/team-tournament-lineup-server-gender-canonical-01"
);

const F04 = "c412a101-7e57-4000-8000-00000000000c";
const F08 = "c412a101-7e57-4000-8000-000000000010";
const M04 = "c412a101-7e57-4000-8000-000000000002";
const M08 = "c412a101-7e57-4000-8000-000000000008";

const TEAM = {
  id: "team-3xnvw71s",
  name: "Đội 4",
  captain: M04,
  roster: [
    { athleteId: M04, displayName: "TT412-SEED-M02", gender: "male" },
    { athleteId: M08, displayName: "TT412-SEED-M08", gender: "male" },
    { athleteId: F04, displayName: "TT412-SEED-F04", gender: "female" },
    { athleteId: F08, displayName: "TT412-SEED-F08", gender: "female" },
  ],
};

function sha256(rel) {
  return createHash("sha256").update(readFileSync(join(pkg, rel))).digest("hex");
}

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
        { id: "mlp-md", name: "Đôi nam", playerCount: 2, sortOrder: 1, genderRequirement: "any", categoryType: "doubles" },
        { id: "mlp-wd", name: "Đôi nữ", playerCount: 2, sortOrder: 2, genderRequirement: "any", categoryType: "doubles" },
        { id: "mlp-xd1", name: "Đôi nam nữ 1", playerCount: 2, sortOrder: 3, genderRequirement: "any", categoryType: "doubles" },
        { id: "mlp-xd2", name: "Đôi nam nữ 2", playerCount: 2, sortOrder: 4, genderRequirement: "any", categoryType: "doubles" },
        {
          id: "dreambreaker",
          name: "Dreambreaker",
          playerCount: 1,
          sortOrder: 5,
          genderRequirement: "any",
          categoryType: "singles",
          disciplineKind: "dreambreaker",
          activationRule: "tie_at_2_2",
        },
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

describe("team-tournament-lineup-server-gender-canonical-01", () => {
  it("package files exist and APPLY uses athletes→profiles (no profiles.player_id / club blob)", () => {
    const apply = readFileSync(join(pkg, "02_APPLY.sql"), "utf8");
    const genderFn = apply.slice(
      apply.indexOf("create or replace function public.team_tournament_resolve_player_gender_key"),
      apply.indexOf("create or replace function public.team_tournament_resolve_player_status")
    );
    assert.match(genderFn, /from public\.athletes a/);
    assert.match(genderFn, /on p\.id = a\.user_id/);
    assert.doesNotMatch(genderFn, /where nullif\(trim\(p\.player_id\)/);
    assert.doesNotMatch(genderFn, /from public\.club_data_v3/);
    assert.match(apply, /team_tournament_effective_lineup_gender_requirement/);
    assert.match(apply, /DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION/);
    for (const f of ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"]) {
      assert.ok(readFileSync(join(pkg, f), "utf8").length > 100, f);
    }
    // Stable fingerprint helper for README lock table.
    assert.equal(typeof sha256("02_APPLY.sql"), "string");
    assert.equal(sha256("02_APPLY.sql").length, 64);
  });

  it("client validation PASS for Owner F04 MLP selections (locked good client)", () => {
    const { teamData, runtime } = loadRuntime();
    assert.equal(runtime.authority, CAPTAIN_PORTAL_SCOPED_ROSTER);
    const byReq = (req) =>
      teamData.disciplines.find((d) => d.genderRequirement === req && d.disciplineKind !== "dreambreaker");
    const wd = byReq(GENDER_REQUIREMENT.FEMALE);
    const md = byReq(GENDER_REQUIREMENT.MALE);
    const mixed = teamData.disciplines.filter(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
    );
    assert.ok(wd && md && mixed.length >= 2);

    const selections = {
      [wd.id]: [F04, F08],
      [md.id]: [M04, M08],
      [mixed[0].id]: [M04, F04],
      [mixed[1].id]: [M08, F08],
    };

    const draft = validateLineupSelections({
      teamData,
      team: runtime.team,
      teamId: TEAM.id,
      selections,
      players: runtime.athletePool,
      partial: true,
      requireCaptainPortalRoster: true,
    });
    assert.equal(draft.ok, true, draft.errors?.join(" "));

    const submit = validateLineupSelections({
      teamData,
      team: runtime.team,
      teamId: TEAM.id,
      selections,
      players: runtime.athletePool,
      requireCaptainPortalRoster: true,
    });
    assert.equal(submit.ok, true, submit.errors?.join(" "));
  });

  it("client still fail-closed for invalid gender / wrong-team; Dreambreaker not ordinary fifth", () => {
    const { teamData, runtime } = loadRuntime();
    const wd = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
    );
    const badGender = validateLineupSelections({
      teamData,
      team: runtime.team,
      teamId: TEAM.id,
      selections: { [wd.id]: [M04, M08] },
      players: runtime.athletePool,
      partial: true,
      requireCaptainPortalRoster: true,
    });
    assert.equal(badGender.ok, false);
    assert.match(badGender.errors.join(" "), /giới tính|nam|nữ|gender/i);

    const wrongTeam = validateLineupSelections({
      teamData,
      team: runtime.team,
      teamId: TEAM.id,
      selections: { [wd.id]: [F04, "c412a101-7e57-4000-8000-000000000099"] },
      players: runtime.athletePool,
      partial: true,
      requireCaptainPortalRoster: true,
    });
    assert.equal(wrongTeam.ok, false);

    const active = teamData.disciplines.filter(
      (d) =>
        d.disciplineKind !== "dreambreaker" && d.activationRule !== "tie_at_2_2"
    );
    assert.equal(active.length, 4);
    assert.ok(teamData.disciplines.some((d) => d.id === "dreambreaker"));
  });

  it("save/submit RPC wiring unchanged (shared server validate)", () => {
    const rpc = readFileSync(
      join(root, "src/features/team-tournament/services/teamTournamentRpcService.js"),
      "utf8"
    );
    assert.match(rpc, /team_tournament_save_lineup_draft/);
    assert.match(rpc, /team_tournament_submit_lineup/);
    const cloud = readFileSync(
      join(root, "src/features/team-tournament/repositories/cloudTeamTournamentRepository.js"),
      "utf8"
    );
    assert.match(cloud, /saveDraftLineup/);
    assert.match(cloud, /submitLineup/);
    const portal = readFileSync(join(root, "src/pages/tournament/TeamPortal.jsx"), "utf8");
    assert.doesNotMatch(portal, /ttLineupDebug/);
    assert.doesNotMatch(portal, /saveBoundary/);
    assert.doesNotMatch(portal, /captainLineupSaveBoundaryDiagnostics/);
  });
});
