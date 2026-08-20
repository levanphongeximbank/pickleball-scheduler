import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import {
  resolveTeamTournamentOpenPath,
  teamTournamentDashboardPath,
  teamTournamentOverviewPath,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../src/config/tournamentRoutes.js";
import {
  resolveA1OpenPath,
  individualOverviewPath,
} from "../src/features/tournament/experience-a1/routes.js";
import {
  TEAM_DOMAIN_AUTHORITIES,
  TEAM_EXPERIENCE_ADAPTER_ID,
  TEAM_LEGACY_TAB_COMPAT,
  projectTeamOverview,
  resolveSafeTeamLegacyRedirect,
  resolveTeamExperienceOpenPath,
  resolveTeamLegacyCompatPath,
  teamOverviewPath,
  TeamTournamentExperienceAdapter,
  createTeamExperienceCommandDelegate,
  resolveTournamentExperienceMode,
  resolveCanonicalExperienceOpenPath,
  TOURNAMENT_EXPERIENCE_MODE,
  buildTeamExperienceNav,
} from "../src/features/tournament/experience-a1/team/index.js";
import { buildTeamTournamentDashboardView } from "../src/features/team-tournament/dashboard/teamTournamentDashboardModel.js";
import {
  isTeamTournamentExperiencePath,
  isTournamentDashboardPath,
  isTournamentEnginePath,
} from "../src/auth/tournamentEngineRouteAccess.js";
import { getRouteAccessPermissions } from "../src/auth/menuAccess.js";
import { isAuthenticatedOnlyRoute } from "../src/auth/authGuard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A1_DIR = path.join(root, "src/features/tournament/experience-a1");
const TEAM_DIR = path.join(A1_DIR, "team");

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

function sampleTeamTournament(status = TOURNAMENT_STATUS.DRAFT) {
  return {
    id: "team-t1",
    name: "Team Cup",
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status,
    clubId: "club-a",
    tenantId: "tenant-a",
  };
}

function sampleDashboardView() {
  return buildTeamTournamentDashboardView({
    tournament: sampleTeamTournament(TOURNAMENT_STATUS.ACTIVE),
    teamData: {
      settings: { formatPreset: "mlp_4" },
      teams: [
        { id: "a", name: "Alpha", members: [{ playerId: "p1" }] },
        { id: "b", name: "Beta", members: [{ playerId: "p2" }] },
      ],
      matchups: [
        { id: "m1", teamAId: "a", teamBId: "b", status: "completed", stage: "group", result: { winnerTeamId: "a" } },
        { id: "m2", teamAId: "a", teamBId: "b", status: "scheduled", stage: "group" },
        { id: "m3", teamAId: "a", teamBId: "b", status: "scheduled", stage: "knockout" },
      ],
      standings: [{ teamId: "a", rank: 1, wins: 1 }],
      disciplines: [{ id: "d1" }, { id: "d2" }],
      groups: [{ id: "g1", teamIds: ["a", "b"] }],
    },
    canOrganize: true,
    sameTenant: true,
    serverVisibilityAuthorized: true,
    isAuthenticated: true,
  });
}

describe("team-tournament-canonical-experience-t1-t2", () => {
  it("1_2_3 DRAFT and ACTIVE open same canonical overview; no status split", () => {
    const draft = sampleTeamTournament(TOURNAMENT_STATUS.DRAFT);
    const active = sampleTeamTournament(TOURNAMENT_STATUS.ACTIVE);
    assert.equal(resolveTeamTournamentOpenPath(draft), "/tournaments/team-t1/overview");
    assert.equal(resolveTeamTournamentOpenPath(active), "/tournaments/team-t1/overview");
    assert.equal(resolveTeamExperienceOpenPath(draft), resolveTeamExperienceOpenPath(active));
    assert.equal(resolveA1OpenPath(draft), "/tournaments/team-t1/overview");
    assert.equal(resolveA1OpenPath(active), "/tournaments/team-t1/overview");
    assert.equal(teamTournamentOverviewPath("team-t1"), teamOverviewPath("team-t1"));
  });

  it("4 Individual Tournament routes unchanged", () => {
    const internal = {
      id: "ind-1",
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      status: TOURNAMENT_STATUS.DRAFT,
    };
    assert.equal(resolveA1OpenPath(internal), "/tournament/ind-1/overview");
    assert.equal(individualOverviewPath("ind-1"), "/tournament/ind-1/overview");
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes('path="/tournament/:tournamentId/overview"'));
    assert.ok(router.includes("IndividualOverviewPage"));
  });

  it("5 Daily Play routes unchanged", () => {
    const daily = {
      id: "daily-1",
      mode: TOURNAMENT_MODE.DAILY_PLAY,
      status: TOURNAMENT_STATUS.DRAFT,
    };
    assert.equal(resolveA1OpenPath(daily), "/tournament/daily/daily-1");
    assert.equal(
      resolveCanonicalExperienceOpenPath(daily),
      "/tournament/daily/daily-1"
    );
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes('path="/tournament/daily/:tournamentId"'));
  });

  it("6_7 legacy Team route compatibility works; no unsafe redirects / no loop", () => {
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes('path="/tournament/team/:tournamentId"'));
    assert.ok(router.includes("TeamTournamentSetup"));
    assert.equal(
      resolveTeamLegacyCompatPath("abc", TEAM_TAB_QUERY.standings),
      teamTournamentPath("abc", TEAM_TAB_QUERY.standings)
    );
    assert.equal(resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "standings" }), null);
    assert.equal(resolveSafeTeamLegacyRedirect({ tournamentId: "abc", tab: "teams" }), null);
    assert.equal(TEAM_LEGACY_TAB_COMPAT.format.adopted, false);
    assert.equal(TEAM_LEGACY_TAB_COMPAT.diagram.canonicalScreen, "bracket");
    // Open path never points back at legacy setup (avoids redirect loop with future bridges).
    assert.equal(resolveTeamTournamentOpenPath({ id: "abc" }).includes("/tournament/team/"), false);
    assert.equal(teamTournamentDashboardPath("abc"), "/tournaments/abc");
  });

  it("8_9 Team Overview reads through adapter with real KPI projection", () => {
    const view = sampleDashboardView();
    assert.equal(view.ok, true);
    const model = projectTeamOverview(view, {
      teamData: {
        disciplines: [{ id: "d1" }, { id: "d2" }],
        groups: [{ id: "g1" }],
      },
    });
    assert.equal(model.adapterId, TEAM_EXPERIENCE_ADAPTER_ID);
    assert.equal(model.context.mode, TOURNAMENT_MODE.TEAM_TOURNAMENT);
    assert.equal(model.kpis.teamCount, 2);
    assert.equal(model.kpis.disciplineCount, 2);
    assert.equal(model.kpis.matchupCount, 3);
    assert.equal(model.kpis.completedMatchupCount, 1);
    assert.equal(model.kpis.groupCount, 1);
    assert.equal(model.kpis.knockoutMatchupCount, 1);
    assert.equal(model.authority.ownsDomainRules, false);
    // Without enrichment, discipline/group stay unknown — never invent.
    const lean = projectTeamOverview(view);
    assert.equal(lean.kpis.disciplineCount, null);
    assert.equal(lean.kpis.groupCount, null);
  });

  it("10 no new Team authority; command delegate does not own domain", async () => {
    assert.equal(TeamTournamentExperienceAdapter.ownsDomainRules, undefined);
    assert.deepEqual(
      Object.keys(TEAM_DOMAIN_AUTHORITIES).sort(),
      [
        "court",
        "discipline",
        "dreambreaker",
        "knockout",
        "lineup",
        "matchup",
        "qualification",
        "referee",
        "result",
        "roster",
        "standings",
      ]
    );
    const delegate = createTeamExperienceCommandDelegate({});
    const missing = await delegate.execute("inventStandings", {});
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "COMMAND_NOT_DELEGATED");
    let called = false;
    const wired = createTeamExperienceCommandDelegate({
      saveTeam: async () => {
        called = true;
        return { ok: true, via: "existing" };
      },
    });
    const result = await wired.execute("saveTeam", { id: "t" });
    assert.equal(called, true);
    assert.equal(result.via, "existing");
  });

  it("11_15 domain authority files unchanged (composition only)", () => {
    const locks = [
      ["dreambreaker", "src/features/team-tournament/engines/dreambreakerEngine.js"],
      ["lineup", "src/features/team-tournament/engines/lineupEngine.js"],
      ["standings", "src/features/team-tournament/engines/teamStandingsEngine.js"],
      ["referee", "src/features/team-tournament/engines/refereeAssignEngine.js"],
      ["court", "src/features/team-tournament/services/canonicalClubCourtInventory.js"],
    ];
    for (const [, rel] of locks) {
      const source = readFileSync(path.join(root, rel), "utf8");
      assert.ok(source.length > 100, rel);
      assert.equal(source.includes("TeamTournamentExperienceAdapter"), false, rel);
    }
  });

  it("16_17 canonical shell / design system reused; no second shell", () => {
    const overview = readFileSync(path.join(TEAM_DIR, "TeamOverviewPage.jsx"), "utf8");
    assert.ok(overview.includes("TournamentExperienceWorkspace"));
    assert.ok(overview.includes("ExperienceHero"));
    assert.ok(overview.includes("CenterKpiCard"));
    assert.ok(overview.includes("tournamentExperienceTokens"));
    assert.equal(overview.includes("TeamTournamentExperienceShell"), false);
    assert.equal(overview.includes("TeamTournamentTheme"), false);
    const teamSources = walkSources(TEAM_DIR);
    for (const item of teamSources) {
      assert.equal(item.source.includes("createTheme("), false, item.file);
      assert.equal(item.source.includes("TeamTournamentDesignSystem"), false, item.file);
    }
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes("TeamOverviewPage"));
    assert.ok(router.includes('path="/tournaments/:tournamentId/overview"'));
  });

  it("mode resolver distinguishes Team vs Individual", () => {
    assert.equal(
      resolveTournamentExperienceMode(sampleTeamTournament()),
      TOURNAMENT_EXPERIENCE_MODE.TEAM_TOURNAMENT
    );
    assert.equal(
      resolveTournamentExperienceMode({
        id: "i",
        mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      }),
      TOURNAMENT_EXPERIENCE_MODE.INDIVIDUAL
    );
  });

  it("nav exposes future structure with legacy links for non-adopted screens", () => {
    const nav = buildTeamExperienceNav("abc");
    const overview = nav.find((item) => item.key === "overview");
    const standings = nav.find((item) => item.key === "standings");
    assert.equal(overview.adopted, true);
    assert.equal(overview.to, "/tournaments/abc/overview");
    assert.equal(standings.adopted, false);
    assert.equal(standings.kind, "legacy");
    assert.ok(standings.to.includes("/tournament/team/abc"));
  });

  it("auth: overview is authenticated shell like dashboard, not Engine UPDATE", () => {
    const overview = "/tournaments/team-t1/overview";
    assert.equal(isTeamTournamentExperiencePath(overview), true);
    assert.equal(isTournamentDashboardPath(overview), false);
    assert.equal(isTournamentEnginePath(overview), false);
    assert.equal(isTournamentEnginePath("/tournaments/team-t1/draw"), true);
    assert.deepEqual(getRouteAccessPermissions(overview), []);
    assert.equal(isAuthenticatedOnlyRoute(overview), true);
  });
});
