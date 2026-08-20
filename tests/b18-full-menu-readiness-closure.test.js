import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROLES } from "../src/auth/roles.js";
import { isNavItemActive } from "../src/components/nav/navPathMatchers.js";
import { isRouteRestrictedForUser, ROUTE_PERMISSIONS } from "../src/config/navigationConfig.js";
import {
  APPROVED_PARTIAL_MENU_PATHS,
  auditFullMenuCoverage,
  evaluateFullMenuReadinessGate,
} from "../src/config/v5Menu/fullMenuAudit.js";
import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import { TOURNAMENT_IN_PAGE_NAV } from "../src/config/v5Menu/tournamentInPageNav.js";
import { TOURNAMENT_MENU_ROOT } from "../src/config/v5Menu/tournamentMenu.js";
import {
  TOURNAMENT_ROUTES,
  directorPath,
  engineTabPath,
  teamTournamentPath,
  TEAM_TAB_QUERY,
} from "../src/config/tournamentRoutes.js";
import {
  ORGANIZE_INTENT,
  RESULTS_VIEW,
  isClubMisroutePath,
  resolveOrganizeDestination,
  resolveResultsDestination,
} from "../src/features/tournament/pages/canonicalTournamentHubDestinations.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ORGANIZE = "/tournament/organize";
const RESULTS = "/tournament/results";

function stripQuery(value) {
  return String(value || "").split("?")[0];
}

function flattenLeaves(items, rows = []) {
  for (const item of items || []) {
    if (item.children?.length) {
      flattenLeaves(item.children, rows);
      continue;
    }
    rows.push(item);
  }
  return rows;
}

function tournament(overrides) {
  return {
    id: "t-b18-1",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.ACTIVE,
    ...overrides,
  };
}

function playerUser() {
  return { role: ROLES.PLAYER, venueId: "venue-b18", clubId: "club-b18" };
}

test("B-18 — organize/results hubs stay LIVE and stay off the PARTIAL allowlist", () => {
  const audit = auditFullMenuCoverage();
  const gate = evaluateFullMenuReadinessGate(audit);

  assert.equal(gate.ok, true, `full-menu readiness gate failed: ${gate.errors.join("; ")}`);
  assert.equal(APPROVED_PARTIAL_MENU_PATHS.includes(ORGANIZE), false);
  assert.equal(APPROVED_PARTIAL_MENU_PATHS.includes(RESULTS), false);
  assert.equal(gate.actualPartialPaths.includes(ORGANIZE), false);
  assert.equal(gate.actualPartialPaths.includes(RESULTS), false);

  const relevant = audit.rows.filter((row) => {
    const base = stripQuery(row.path);
    return base === ORGANIZE || base === RESULTS;
  });
  assert.ok(relevant.length >= 2, "organize/results must remain in active menu readiness");
  for (const row of relevant) {
    assert.equal(
      row.featureStatus,
      FEATURE_STATUS.LIVE,
      `${row.key || row.path} must be LIVE, not ${row.featureStatus}`
    );
  }

  const sidebarLeaves = flattenLeaves(TOURNAMENT_MENU_ROOT.children);
  for (const key of ["tournament-organize-hub", "tournament-results-hub", "tournament-results-player"]) {
    const leaf = sidebarLeaves.find((item) => item.key === key);
    assert.ok(leaf, `missing sidebar leaf ${key}`);
    assert.equal(leaf.featureStatus, FEATURE_STATUS.LIVE);
  }
});

test("B-18 — in-page organize/results leaves converge to hubs, not club surfaces", () => {
  const pairing = TOURNAMENT_IN_PAGE_NAV.organize.sections[0].items.find(
    (item) => item.key === "tournament-pairing"
  );
  const director = TOURNAMENT_IN_PAGE_NAV.organize.sections[0].items.find(
    (item) => item.key === "tournament-director"
  );
  const courtChange = TOURNAMENT_IN_PAGE_NAV.operations.sections[0].items.find(
    (item) => item.key === "tournament-court-change"
  );
  const scoreboard = TOURNAMENT_IN_PAGE_NAV.results.sections[0].items.find(
    (item) => item.key === "tournament-scoreboard"
  );
  const rankings = TOURNAMENT_IN_PAGE_NAV.results.sections[0].items.find(
    (item) => item.key === "tournament-rankings"
  );
  const players = TOURNAMENT_IN_PAGE_NAV.results.sections[0].items.find(
    (item) => item.key === "tournament-player-stats"
  );
  const exported = TOURNAMENT_IN_PAGE_NAV.results.sections[0].items.find(
    (item) => item.key === "tournament-export-results"
  );

  assert.equal(stripQuery(TOURNAMENT_ROUTES.pairing), ORGANIZE);
  assert.equal(stripQuery(TOURNAMENT_ROUTES.director), ORGANIZE);
  assert.equal(stripQuery(TOURNAMENT_ROUTES.resultsScoreboard), RESULTS);
  assert.equal(stripQuery(TOURNAMENT_ROUTES.resultsRankings), RESULTS);
  assert.equal(stripQuery(TOURNAMENT_ROUTES.resultsPlayers), RESULTS);

  for (const item of [pairing, director, courtChange, scoreboard, rankings, players, exported]) {
    assert.ok(item, "missing in-page leaf");
    assert.equal(item.featureStatus, FEATURE_STATUS.LIVE);
    assert.equal(isClubMisroutePath(item.path), false, item.key);
  }

  assert.ok(pairing.permissions.includes(PERMISSIONS.SCHEDULING_RUN));
  assert.ok(director.permissions.includes(PERMISSIONS.DIRECTOR_USE));
  assert.ok(scoreboard.permissions.includes(PERMISSIONS.STATISTICS_VIEW));
});

test("B-18 — picker destinations adopt Engine / Director / standings only", () => {
  const engine = tournament();
  const team = tournament({
    id: "team-b18",
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
  });
  const daily = tournament({
    id: "daily-b18",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });

  assert.equal(
    resolveOrganizeDestination(engine, ORGANIZE_INTENT.PAIRING),
    engineTabPath(engine.id, "seed")
  );
  assert.equal(
    resolveOrganizeDestination(engine, ORGANIZE_INTENT.DIRECTOR),
    directorPath(engine.id)
  );
  assert.equal(resolveOrganizeDestination(engine), engineTabPath(engine.id, "engine"));
  assert.equal(
    resolveOrganizeDestination(team, ORGANIZE_INTENT.PAIRING),
    teamTournamentPath(team.id, TEAM_TAB_QUERY.matchups)
  );

  for (const view of Object.values(RESULTS_VIEW)) {
    assert.equal(resolveResultsDestination(engine, view), engineTabPath(engine.id, "ranking"));
    assert.equal(
      resolveResultsDestination(team, view),
      teamTournamentPath(team.id, TEAM_TAB_QUERY.standings)
    );
  }

  assert.equal(isClubMisroutePath(resolveOrganizeDestination(engine, ORGANIZE_INTENT.PAIRING)), false);
  assert.equal(isClubMisroutePath(resolveResultsDestination(engine)), false);
  assert.equal(isClubMisroutePath(resolveOrganizeDestination(daily)), false);
  assert.equal(isClubMisroutePath(resolveResultsDestination(daily)), false);
});

test("B-18 — no new writer / scoring / results authority in hub destination module", () => {
  const destSource = readFileSync(
    path.join(root, "src/features/tournament/pages/canonicalTournamentHubDestinations.js"),
    "utf8"
  );
  const pageSource = readFileSync(
    path.join(root, "src/features/tournament/pages/CanonicalTournamentCapabilityPages.jsx"),
    "utf8"
  );

  for (const source of [destSource, pageSource]) {
    assert.equal(/createTournamentCommand|setTournamentStatusCommand/.test(source), false);
    assert.equal(/from ["'].*rankingEngine/.test(source), false);
    assert.equal(/from ["'].*refereeEngine/.test(source), false);
    assert.equal(/localStorage/.test(source), false);
  }

  assert.match(destSource, /engineTabPath/);
  assert.match(destSource, /directorPath/);
  assert.match(destSource, /teamTournamentPath/);
});

test("B-18 — routes remain registered and access controls are unchanged", () => {
  const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
  assert.match(router, /path="\/tournament\/organize"/);
  assert.match(router, /path="\/tournament\/results"/);
  assert.match(router, /TournamentOrganizeHubPage/);
  assert.match(router, /TournamentResultsHubPage/);

  assert.deepEqual(ROUTE_PERMISSIONS[ORGANIZE], [PERMISSIONS.TOURNAMENT_VIEW]);
  assert.deepEqual(ROUTE_PERMISSIONS[RESULTS], [PERMISSIONS.TOURNAMENT_VIEW]);
  assert.deepEqual(ROUTE_PERMISSIONS["/select-players"], [PERMISSIONS.SCHEDULING_VIEW]);
  assert.ok(ROUTE_PERMISSIONS["/court-engine"].includes(PERMISSIONS.DIRECTOR_USE));

  const player = playerUser();
  assert.equal(isRouteRestrictedForUser(player, RESULTS), false);
  assert.equal(isRouteRestrictedForUser(player, "/tournament/operations"), true);
  assert.equal(isRouteRestrictedForUser(player, "/tournament/config"), true);
  assert.equal(isRouteRestrictedForUser(player, ORGANIZE), false);
});

test("B-18 — sidebar highlight follows tournament destinations, not club pairing/stats", () => {
  const organizeItem = { match: "tournament-organize-hub", path: ORGANIZE };
  const resultsItem = { match: "tournament-results-hub", path: RESULTS };

  assert.equal(isNavItemActive(ORGANIZE, organizeItem), true);
  assert.equal(isNavItemActive("/tournaments/t-b18-1/seed", organizeItem), true);
  assert.equal(isNavItemActive("/tournament/director/t-b18-1", organizeItem), true);
  assert.equal(isNavItemActive("/select-players", organizeItem), false);
  assert.equal(isNavItemActive("/court-engine", organizeItem), false);

  assert.equal(isNavItemActive(RESULTS, resultsItem), true);
  assert.equal(isNavItemActive("/tournaments/t-b18-1/ranking", resultsItem), true);
  assert.equal(isNavItemActive("/statistics?view=scoreboard", resultsItem), false);
});
