import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import {
  resolveTeamTournamentOpenPath,
  TEAM_TAB_QUERY,
} from "../src/config/tournamentRoutes.js";
import {
  resolveA1OpenPath,
  individualOverviewPath,
} from "../src/features/tournament/experience-a1/routes.js";
import {
  TEAM_DOMAIN_AUTHORITIES,
  TEAM_EXPERIENCE_ADAPTER_ID,
  TEAM_EXPERIENCE_COMMANDS,
  TEAM_LEGACY_TAB_COMPAT,
  buildTeamExperienceNav,
  createTeamExperienceCommandDelegate,
  projectTeamOverview,
  projectTeamParticipants,
  projectTeamSchedule,
  projectTeamSettings,
  resolveSafeTeamLegacyRedirect,
  resolveTeamExperienceOpenPath,
  teamExperiencePath,
  teamTournamentLegacyPath,
  teamOverviewPath,
} from "../src/features/tournament/experience-a1/team/index.js";
import { buildTeamTournamentDashboardView } from "../src/features/team-tournament/dashboard/teamTournamentDashboardModel.js";
import {
  isTeamTournamentExperiencePath,
  isTournamentEnginePath,
} from "../src/auth/tournamentEngineRouteAccess.js";
import { getRouteAccessPermissions } from "../src/auth/menuAccess.js";
import { isAuthenticatedOnlyRoute } from "../src/auth/authGuard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEAM_DIR = path.join(root, "src/features/tournament/experience-a1/team");

function walkSources(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkSources(full));
    else if (/\.(js|jsx)$/.test(entry.name)) {
      files.push({
        file: path.relative(root, full).replaceAll("\\", "/"),
        source: readFileSync(full, "utf8"),
      });
    }
  }
  return files;
}

function sampleTournament(status = TOURNAMENT_STATUS.DRAFT) {
  return {
    id: "team-t3",
    name: "Team Cup T3",
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status,
    clubId: "club-a",
    tenantId: "tenant-a",
  };
}

function sampleTeamData() {
  return {
    settings: {
      formatPreset: "mlp_4",
      groupMode: "manual",
      groupCount: 2,
      qualifiersPerGroup: 2,
      selectedCourtIds: ["c1", "c2"],
      dreambreakerEnabled: true,
      knockoutFormat: "semifinals",
      rosterRules: { teamSize: 4, minPlayers: 4, maxPlayers: 6 },
    },
    teams: [
      {
        id: "a",
        name: "Alpha",
        captainPlayerId: "p1",
        playerIds: ["p1", "p2"],
      },
      {
        id: "b",
        name: "Beta",
        captainPlayerId: "p3",
        playerIds: ["p3"],
      },
    ],
    disciplines: [
      { id: "d1", name: "Đôi nam" },
      { id: "d2", name: "Đôi nữ" },
    ],
    groups: [{ id: "g1", name: "Bảng A", teamIds: ["a", "b"] }],
    matchups: [
      {
        id: "mu-keep",
        teamAId: "a",
        teamBId: "b",
        status: "scheduled",
        stage: "group",
        groupId: "g1",
        roundNumber: 1,
        scheduledAt: "2026-08-21T10:00:00.000Z",
        courtLabel: "Sân 1",
        courtId: "c1",
        subMatches: [{ id: "sm1" }, { id: "sm2" }],
      },
      {
        id: "mu-2",
        teamAId: "b",
        teamBId: "a",
        status: "completed",
        stage: "knockout",
        scheduledAt: null,
        subMatches: [{ id: "sm3" }],
      },
    ],
    standings: [{ teamId: "a", rank: 1 }],
  };
}

describe("team-tournament-canonical-experience-t3", () => {
  it("SETTINGS 1-6 route + adapter + save delegation + no second authority", async () => {
    assert.equal(teamExperiencePath("abc", "settings"), "/tournaments/abc/settings");
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes('path="/tournaments/:tournamentId/settings"'));
    assert.ok(router.includes("TeamSettingsPage"));

    const settings = projectTeamSettings({
      tournament: sampleTournament(),
      teamData: sampleTeamData(),
    });
    assert.equal(settings.adapterId, TEAM_EXPERIENCE_ADAPTER_ID);
    assert.equal(settings.format.formatPreset, "mlp_4");
    assert.equal(settings.format.groupCount, 2);
    assert.equal(settings.format.qualifiersPerGroup, 2);
    assert.equal(settings.format.selectedCourtIds.length, 2);
    assert.equal(settings.authority.ownsPersistence, false);
    assert.ok(settings.authority.settingsWriter.includes("persistFormatVenueSetup"));

    let saved = null;
    const delegate = createTeamExperienceCommandDelegate({
      [TEAM_EXPERIENCE_COMMANDS.SAVE_FORMAT_VENUE]: async (config) => {
        saved = config;
        return { ok: true, readback: true };
      },
    });
    const result = await delegate.execute(TEAM_EXPERIENCE_COMMANDS.SAVE_FORMAT_VENUE, {
      formatPreset: "custom",
    });
    assert.equal(result.ok, true);
    assert.equal(saved.formatPreset, "custom");

    const settingsPage = readFileSync(path.join(TEAM_DIR, "TeamSettingsPage.jsx"), "utf8");
    assert.ok(settingsPage.includes("persistFormatVenueSetup"));
    assert.ok(settingsPage.includes("TeamFormatVenueSetupPanel"));
    assert.ok(settingsPage.includes("reload({ silent: true"));
    assert.ok(settingsPage.includes("onFormatDirtyDiagnostic"));
    assert.equal(settingsPage.includes("localStorage.setItem"), false);
  });

  it("PARTICIPANTS 7-12 real teams/roster + playerId identity + no duplicate store", () => {
    assert.equal(teamExperiencePath("abc", "participants"), "/tournaments/abc/participants");
    const model = projectTeamParticipants({
      tournament: sampleTournament(),
      teamData: sampleTeamData(),
      players: [
        { id: "p1", name: "Cap A" },
        { id: "p2", name: "P2" },
        { id: "p3", name: "Cap B" },
      ],
    });
    assert.equal(model.teamCount, 2);
    assert.equal(model.teams[0].memberCount, 2);
    assert.equal(model.teams[0].members[0].playerId, "p1");
    assert.equal(model.teams[0].members[0].identityAuthority, "playerId");
    assert.equal(model.authority.identityField, "playerId");
    assert.ok(model.authority.rosterWriter.includes("assign_member"));

    const page = readFileSync(path.join(TEAM_DIR, "TeamParticipantsPage.jsx"), "utf8");
    assert.ok(page.includes("TeamRosterPanel"));
    assert.equal(page.includes("localStorage.setItem"), false);
    assert.equal(page.includes("displayName ==="), false);
  });

  it("SCHEDULE 13-20 matchup IDs preserved; no regen on read; hierarchy kept", () => {
    assert.equal(teamExperiencePath("abc", "schedule"), "/tournaments/abc/schedule");
    const beforeIds = sampleTeamData().matchups.map((m) => m.id);
    const model = projectTeamSchedule({
      tournament: sampleTournament(TOURNAMENT_STATUS.ACTIVE),
      teamData: sampleTeamData(),
    });
    assert.equal(model.matchupCount, 2);
    assert.deepEqual(
      model.matchups.map((m) => m.id),
      beforeIds
    );
    assert.equal(model.authority.regeneratesOnRead, false);
    assert.equal(model.matchups[0].teamAName, "Alpha");
    assert.equal(model.matchups[0].teamBName, "Beta");
    assert.equal(model.matchups[0].courtLabel, "Sân 1");
    assert.equal(model.matchups[0].hierarchy.includes("subMatches"), true);
    assert.equal(model.matchups[0].subMatchCount, 2);

    const page = readFileSync(path.join(TEAM_DIR, "TeamSchedulePage.jsx"), "utf8");
    assert.ok(page.includes("buildRoundRobinMatchups"));
    assert.ok(page.includes("persistSetupTeamData"));
    assert.equal(page.includes("useEffect(() => {\n    buildRoundRobinMatchups"), false);
    assert.ok(page.includes("không tạo lại lịch khi tải trang"));

    // Project twice — IDs stable (read projection only).
    const again = projectTeamSchedule({
      tournament: sampleTournament(TOURNAMENT_STATUS.ACTIVE),
      teamData: sampleTeamData(),
    });
    assert.deepEqual(
      again.matchups.map((m) => m.id),
      beforeIds
    );
  });

  it("ROUTES 21-28 legacy redirects + no loop + individual/daily unchanged", () => {
    assert.equal(
      resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "format" }),
      "/tournaments/abc/settings"
    );
    assert.equal(
      resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "teams" }),
      "/tournaments/abc/participants"
    );
    assert.equal(
      resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "matchups" }),
      "/tournaments/abc/schedule"
    );
    assert.equal(resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "disciplines" }), null);
    assert.equal(resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "standings" }), null);
    assert.equal(resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "awards" }), null);
    assert.equal(resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "diagram" }), null);
    assert.equal(TEAM_LEGACY_TAB_COMPAT.disciplines.adopted, false);

    const legacyBypass = teamTournamentLegacyPath("abc", TEAM_TAB_QUERY.matchups);
    assert.ok(legacyBypass.includes("experience=legacy"));
    assert.ok(legacyBypass.includes("tab=matchups"));

    const draft = sampleTournament(TOURNAMENT_STATUS.DRAFT);
    const active = sampleTournament(TOURNAMENT_STATUS.ACTIVE);
    assert.equal(resolveTeamTournamentOpenPath(draft), teamOverviewPath("team-t3"));
    assert.equal(resolveTeamExperienceOpenPath(active), teamOverviewPath("team-t3"));
    assert.equal(resolveA1OpenPath(draft), "/tournaments/team-t3/overview");

    assert.equal(
      resolveA1OpenPath({ id: "ind-1", mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT }),
      individualOverviewPath("ind-1")
    );
    assert.equal(
      resolveA1OpenPath({ id: "d1", mode: TOURNAMENT_MODE.DAILY_PLAY }),
      "/tournament/daily/d1"
    );

    const setup = readFileSync(
      path.join(root, "src/pages/tournament/TeamTournamentSetup.jsx"),
      "utf8"
    );
    assert.ok(setup.includes("resolveSafeTeamLegacyRedirect"));
    assert.ok(setup.includes("experience=legacy") || setup.includes('=== "legacy"'));
  });

  it("ARCHITECTURE 29-32 shell reused; no second UX/design/authority", () => {
    const files = walkSources(TEAM_DIR);
    for (const item of files) {
      assert.equal(item.source.includes("TeamTournamentExperienceShell"), false, item.file);
      assert.equal(item.source.includes("TeamTournamentTheme"), false, item.file);
      assert.equal(item.source.includes("createTheme("), false, item.file);
    }
    const settings = readFileSync(path.join(TEAM_DIR, "TeamSettingsPage.jsx"), "utf8");
    assert.ok(settings.includes("TeamExperiencePageFrame"));
    assert.ok(settings.includes("TournamentExperienceWorkspace") === false); // via frame
    const frame = readFileSync(path.join(TEAM_DIR, "TeamExperiencePageFrame.jsx"), "utf8");
    assert.ok(frame.includes("TournamentExperienceWorkspace"));
    assert.ok(frame.includes("tournamentExperienceTokens"));
    assert.deepEqual(Object.keys(TEAM_DOMAIN_AUTHORITIES).includes("standings"), true);
  });

  it("REGRESSION 33-37 domain engines untouched by adapter ownership", () => {
    for (const rel of [
      "src/features/team-tournament/engines/dreambreakerEngine.js",
      "src/features/team-tournament/engines/lineupEngine.js",
      "src/features/team-tournament/engines/teamStandingsEngine.js",
      "src/features/team-tournament/engines/refereeAssignEngine.js",
      "src/features/team-tournament/services/canonicalClubCourtInventory.js",
    ]) {
      const source = readFileSync(path.join(root, rel), "utf8");
      assert.equal(source.includes("TeamTournamentExperienceAdapter"), false, rel);
      assert.equal(source.includes("projectTeamSchedule"), false, rel);
    }
  });

  it("nav marks settings/participants/schedule adopted", () => {
    const nav = buildTeamExperienceNav("abc");
    for (const key of ["overview", "settings", "participants", "schedule"]) {
      const item = nav.find((n) => n.key === key);
      assert.equal(item.adopted, true, key);
      assert.equal(item.kind, "canonical", key);
    }
    assert.equal(nav.find((n) => n.key === "standings").adopted, false);
  });

  it("auth: settings/participants authenticated shell; schedule remains engine path", () => {
    assert.equal(isTeamTournamentExperiencePath("/tournaments/t1/settings"), true);
    assert.equal(isTeamTournamentExperiencePath("/tournaments/t1/participants"), true);
    assert.deepEqual(getRouteAccessPermissions("/tournaments/t1/settings"), []);
    assert.equal(isAuthenticatedOnlyRoute("/tournaments/t1/participants"), true);
    assert.equal(isTournamentEnginePath("/tournaments/t1/schedule"), true);
    assert.equal(isTeamTournamentExperiencePath("/tournaments/t1/schedule"), false);
  });

  it("schedule mode resolver registered for plural schedule route", () => {
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes("TournamentsPluralScheduleRoute"));
    const gate = readFileSync(path.join(TEAM_DIR, "TournamentsPluralScheduleRoute.jsx"), "utf8");
    assert.ok(gate.includes("isTeamTournament"));
    assert.ok(gate.includes("TeamSchedulePage"));
    assert.ok(gate.includes("TournamentEnginePage"));
  });

  it("overview projection still works through adapter", () => {
    const view = buildTeamTournamentDashboardView({
      tournament: sampleTournament(TOURNAMENT_STATUS.ACTIVE),
      teamData: sampleTeamData(),
      canOrganize: true,
      serverVisibilityAuthorized: true,
      isAuthenticated: true,
    });
    const overview = projectTeamOverview(view, { teamData: sampleTeamData() });
    assert.equal(overview.kpis.teamCount, 2);
    assert.equal(overview.kpis.disciplineCount, 2);
  });
});
