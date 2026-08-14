import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  shouldBlockRouteForAuthLoading,
  isAuthenticatedOnlyRoute,
} from "../src/auth/authGuard.js";
import {
  buildClubRehydrateScopeKey,
  shouldRehydrateClubScope,
} from "../src/auth/authSemanticScope.js";
import {
  decideTournamentEngineRouteGate,
  isMyTournamentsHubPath,
  isTournamentDashboardPath,
  isTournamentEnginePath,
} from "../src/auth/tournamentEngineRouteAccess.js";
import { shouldBlockTournamentManageGate } from "../src/features/tournament/guards/tournamentManageGatePolicy.js";
import {
  DAILY_FAIR_DESKTOP_GRID_TEMPLATE,
  DAILY_FAIR_MATCH_PANEL_MIN_PX,
  DAILY_FAIR_COMPACT_BREAKPOINT_PX,
} from "../src/components/tournament/animation/daily/dailyFairMatchUtils.js";
import {
  beginPresenceOverride,
  resolvePresentedCheckedSet,
  shouldIgnoreConcurrentPresenceClick,
  normalizeDailyPlayServerSnapshot,
  resolveCreateMatchCount,
  listAvailableCourts,
  buildCourtRuntimeView,
  DAILY_PLAY_REFRESH_REASON,
  isSilentRefreshReason,
  DAILY_PLAY_GENERIC_ACTION_ERROR,
  DAILY_PLAY_MESSAGES,
  normalizeDailyPlayMutationResult,
  shouldClearSessionErrorAfterSnapshot,
  isObsoleteNoCourtAvailabilityError,
  resolveCreateCourtWaitingNote,
  selectEnabledCourts,
} from "../src/features/daily-play/canonical/index.js";
import { shouldShowDirectorBlockingLoad } from "../src/features/tournament/director/directorLoadingGate.js";

const root = path.resolve(".");

function readSrc(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const PRODUCTION_LIKE_COURTS = [
  {
    id: "court-club-prod-n3",
    name: "Sân 3",
    active: true,
    number: 3,
    status: "active",
  },
  {
    id: "court-club-prod-n4",
    name: "Sân 4",
    active: true,
    number: 4,
    status: "active",
  },
  {
    id: "court-club-prod-n5",
    name: "Sân 5",
    active: true,
    number: 5,
    status: "active",
  },
  {
    id: "court-club-prod-n6",
    name: "Sân 6",
    active: true,
    number: 6,
    status: "active",
  },
];

describe("PROD-DP-01 player presence — integrated main", () => {
  test("select and unselect are immediate presentation-only", () => {
    const selected = beginPresenceOverride([], "p1");
    const presentedIn = resolvePresentedCheckedSet([], selected);
    assert.equal(presentedIn.has("p1"), true);
    assert.equal(selected.checked, true);

    const cleared = beginPresenceOverride(["p1"], "p1");
    const presentedOut = resolvePresentedCheckedSet(["p1"], cleared);
    assert.equal(presentedOut.has("p1"), false);
    assert.equal(cleared.checked, false);
  });

  test("no blocking loader on the athlete row or setup page", () => {
    const setup = readSrc("src/pages/tournament/DailyPlaySetup.jsx");
    const row = setup.slice(
      setup.indexOf("function PlayerPresenceRow"),
      setup.indexOf("export default function DailyPlaySetup")
    );
    assert.equal(row.includes("CircularProgress"), false);
    assert.equal(setup.includes("CircularProgress"), false);
    assert.match(
      setup,
      /\(tournamentLoading && !tournament\) \|\| \(session\.loading && !session\.state\)/
    );
  });

  test("concurrent mutation is blocked; F5 remains canonical", () => {
    assert.equal(
      shouldIgnoreConcurrentPresenceClick({
        lockHeld: true,
        mutating: false,
      }),
      true
    );
    assert.equal(
      shouldIgnoreConcurrentPresenceClick({
        mutating: true,
      }),
      true
    );
    const setup = readSrc("src/pages/tournament/DailyPlaySetup.jsx");
    assert.match(setup, /session\.checkIn\(playerId\)/);
    assert.match(setup, /session\.checkOut\(playerId\)/);
    assert.equal(setup.includes("presentedCheckedSet"), true);
    const createBlock = setup.slice(
      setup.indexOf("handleCreateMatches"),
      setup.indexOf("handleAssignCourt")
    );
    assert.equal(createBlock.includes("presentedCheckedSet"), false);
  });

  test("TournamentManageGate does not unmount a loaded Daily shell", () => {
    assert.equal(
      shouldBlockTournamentManageGate({
        rbacEnabled: true,
        isAuthenticated: true,
        tournamentId: "t1",
        loading: true,
        tournament: { id: "t1", clubId: "c1" },
      }),
      false
    );
    assert.equal(
      shouldBlockTournamentManageGate({
        rbacEnabled: true,
        isAuthenticated: true,
        tournamentId: "t1",
        loading: true,
        tournament: null,
      }),
      true
    );
    assert.equal(
      shouldBlockTournamentManageGate({
        rbacEnabled: false,
        isAuthenticated: true,
        tournamentId: "t1",
        loading: true,
        tournament: null,
      }),
      false
    );
    const gate = readSrc("src/components/tournament/TournamentManageGate.jsx");
    const setup = readSrc("src/pages/tournament/DailyPlaySetup.jsx");
    assert.match(gate, /shouldBlockTournamentManageGate/);
    assert.match(gate, /loadedTournament/);
    assert.match(setup, /loadedTournament=\{tournament\}/);
    assert.equal(
      /if \(tournamentId && loading\) \{\s*return/.test(gate),
      false
    );
  });
});

describe("PROD-DP-02 tab/window resume — integrated main", () => {
  test("TOKEN_REFRESHED / repeated SIGNED_IN same user do not block the route", () => {
    const user = { id: "u1", role: "TENANT_OWNER" };
    assert.equal(
      shouldBlockRouteForAuthLoading({
        authLoading: true,
        isAuthenticated: true,
        user,
        pathname: "/tournament/daily/t1",
      }),
      false
    );
    assert.equal(
      shouldBlockRouteForAuthLoading({
        authLoading: true,
        isAuthenticated: false,
        user: null,
        pathname: "/tournament/daily/t1",
      }),
      true
    );
  });

  test("ClubContext stays READY across async cluster enrichment", () => {
    const before = {
      id: "u1",
      role: "TENANT_OWNER",
      tenantId: "venue-prod-main",
      venueId: "venue-prod-main",
      clubId: "club-1",
      email: "owner@club.local",
      status: "active",
    };
    const after = {
      ...before,
      assignedClusterIds: ["venue-prod-main-pickleball-nam-long-sports"],
      playerId: "athlete-1",
    };
    assert.equal(buildClubRehydrateScopeKey(before), buildClubRehydrateScopeKey(after));
    assert.equal(
      shouldRehydrateClubScope(
        buildClubRehydrateScopeKey(before),
        buildClubRehydrateScopeKey(after)
      ),
      false
    );
    const club = readSrc("src/context/ClubContext.jsx");
    assert.match(club, /buildClubRehydrateScopeKey\(user\)/);
    assert.match(club, /clubRehydrateScopeKey/);
    const tenant = readSrc("src/context/TenantContext.jsx");
    assert.match(tenant, /buildClubRehydrateScopeKey\(user\)/);
  });

  test("visibility resume is silent and Daily/Director shells stay mounted", () => {
    assert.equal(
      isSilentRefreshReason(DAILY_PLAY_REFRESH_REASON.VISIBILITY_RESUME),
      true
    );
    assert.equal(
      shouldShowDirectorBlockingLoad({
        tournament: { id: "t1" },
        tournamentLoading: true,
        accessPending: false,
        isDaily: true,
        dailyState: { revision: 2 },
        dailyLoading: true,
      }),
      false
    );
    const hook = readSrc("src/features/daily-play/canonical/useDailyPlayCanonicalSession.js");
    assert.match(hook, /VISIBILITY_RESUME/);
    assert.equal(hook.includes("setRefreshing(true)"), false);
  });

  test("real auth scope change still fail closed", () => {
    const previous = buildClubRehydrateScopeKey({
      id: "u1",
      role: "TENANT_OWNER",
      tenantId: "tenant-a",
      venueId: "venue-a",
      clubId: "club-a",
      email: "a@x.local",
      status: "active",
    });
    assert.equal(
      shouldRehydrateClubScope(
        previous,
        buildClubRehydrateScopeKey({
          id: "u2",
          role: "TENANT_OWNER",
          tenantId: "tenant-a",
          venueId: "venue-a",
          clubId: "club-a",
          email: "a@x.local",
          status: "active",
        })
      ),
      true
    );
    assert.equal(
      shouldBlockRouteForAuthLoading({
        authLoading: true,
        isAuthenticated: false,
        user: null,
        pathname: "/tournament/daily/t1",
      }),
      true
    );
  });
});

describe("PROD-DP-03 Fair Match layout — integrated main", () => {
  test("desktop right result panel cannot collapse below 240px", () => {
    assert.equal(DAILY_FAIR_MATCH_PANEL_MIN_PX, 240);
    assert.match(DAILY_FAIR_DESKTOP_GRID_TEMPLATE, /minmax\(240px,\s*3fr\)/);
    assert.match(DAILY_FAIR_DESKTOP_GRID_TEMPLATE, /minmax\(0,\s*6fr\)/);
    const css = readSrc("src/components/tournament/animation/daily/dailyFairMatch.css");
    assert.match(css, /\.daily-fair-layout \[data-panel="matches"\][\s\S]*min-width:\s*240px/);
    assert.match(css, /\.daily-fair-panel--matches \{[\s\S]*min-width:\s*240px/);
    const screen = readSrc("src/components/tournament/animation/daily/DailyFairMatchScreen.jsx");
    assert.match(screen, /DAILY_FAIR_MATCH_PANEL_MIN_PX/);
  });

  test("names never wrap character-by-character", () => {
    const card = readSrc("src/components/tournament/animation/daily/DailyMatchCard.jsx");
    const css = readSrc("src/components/tournament/animation/daily/dailyFairMatch.css");
    assert.equal(card.includes("anywhere"), false);
    assert.equal(css.includes("overflow-wrap: anywhere"), false);
    assert.match(card, /overflowWrap:\s*"break-word"/);
    assert.match(css, /overflow-wrap:\s*break-word/);
    assert.match(card, /An Tường|teamA/i);
    assert.match(card, />\s*\{\s*teamA\s*\}\s*</);
  });

  test("long Vietnamese names stay on a readable wrap strategy", () => {
    const sample = "Nguyễn Thị Bích Phương / Trần Văn Hoàng";
    assert.equal(sample.includes(" "), true);
    const card = readSrc("src/components/tournament/animation/daily/DailyMatchCard.jsx");
    assert.match(card, /wordBreak:\s*"normal"/);
    assert.equal(card.includes("break-all"), false);
  });

  test("1 match and multiple match layouts keep the result column mounted", () => {
    const screen = readSrc("src/components/tournament/animation/daily/DailyFairMatchScreen.jsx");
    assert.match(screen, /data-testid="daily-fair-result-panel"/);
    assert.match(screen, /display:\s*showMatches\s*\?\s*"block"\s*:\s*"none"/);
    assert.match(screen, /DailyMatchListPanel/);
  });

  test("standard desktop stays 3-column; narrow desktop/mobile may stack", () => {
    assert.equal(DAILY_FAIR_COMPACT_BREAKPOINT_PX >= 900, true);
    const screen = readSrc("src/components/tournament/animation/daily/DailyFairMatchScreen.jsx");
    assert.match(screen, /gridTemplateColumns:\s*DAILY_FAIR_DESKTOP_GRID_TEMPLATE/);
    assert.match(screen, /daily-fair-compact-tabs/);
    assert.equal(/\bsize=\{\{/.test(screen), false);
  });

  test("DP-11B — no viewport lg Grid sizing", () => {
    const screen = readSrc("src/components/tournament/animation/daily/DailyFairMatchScreen.jsx");
    assert.equal(/\blg:\s*DAILY_FAIR_DESKTOP_GRID/.test(screen), false);
    const dialog = readSrc("src/components/tournament/animation/TournamentAnimationDialog.jsx");
    assert.match(dialog, /DAILY_FAIR_MATCH[\s\S]*\? "xl"/);
  });
});

describe("PROD-DP-04 court projection — no false zero", () => {
  test("canonical inventory of 4 free courts is not projected as zero", () => {
    const waiting = [
      {
        id: "m1",
        status: "waiting",
        courtId: null,
        teamAPlayerIds: ["a", "b"],
        teamBPlayerIds: ["c", "d"],
      },
    ];
    const snapshot = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: "3bea23cf-f3b8-4a1f-8154-34b258e8b799",
      state: {
        revision: 1,
        checkedInPlayerIds: ["a", "b", "c", "d"],
        enabledCourtIds: [],
        matches: waiting,
      },
      courts: PRODUCTION_LIKE_COURTS,
      activeLeases: [],
    });
    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.courts.length, 4);
    assert.equal(snapshot.hasCourtCapability, true);
    assert.equal(snapshot.courtStates.length, 4);
    assert.equal(snapshot.availableCourts.length, 4);

    const available = listAvailableCourts({
      courts: snapshot.courts,
      matches: waiting,
      leases: [],
    });
    assert.equal(available.length, 4);

    const view = buildCourtRuntimeView({
      courts: snapshot.courts,
      matches: waiting,
      leases: [],
    });
    assert.equal(view.length, 4);
    assert.equal(view.every((court) => court.status === "available"), true);

    const plan = resolveCreateMatchCount({
      enabledCourts: snapshot.courts,
      availableCourts: snapshot.availableCourts,
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, false);
    assert.equal(plan.matchCount >= 1, true);
  });

  test("busy courts correctly produce waiting state without false zero inventory", () => {
    const leases = [
      { courtId: "court-club-prod-n3", status: "active", matchId: "m1" },
      { courtId: "court-club-prod-n4", status: "active", matchId: "m2" },
      { courtId: "court-club-prod-n5", status: "active", matchId: "m3" },
      { courtId: "court-club-prod-n6", status: "active", matchId: "m4" },
    ];
    const available = listAvailableCourts({
      courts: PRODUCTION_LIKE_COURTS,
      matches: [],
      leases,
    });
    assert.equal(available.length, 0);
    const plan = resolveCreateMatchCount({
      enabledCourts: PRODUCTION_LIKE_COURTS,
      availableCourts: available,
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.waitingForCourt, true);
    assert.equal(PRODUCTION_LIKE_COURTS.length, 4);
  });
});

describe("TEST 4 generic/stale Daily mutation error", () => {
  test("successful create does not keep the generic fallback", () => {
    const success = normalizeDailyPlayMutationResult({
      ok: true,
      revision: 4,
      matches: [
        { id: "m1", status: "waiting", courtId: null },
        { id: "m2", status: "waiting", courtId: null },
      ],
    });
    assert.equal(success.ok, true);
    assert.notEqual(success.error, DAILY_PLAY_GENERIC_ACTION_ERROR);
    assert.equal(
      shouldClearSessionErrorAfterSnapshot({
        snapshotOk: true,
        replaced: false,
        reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
      }),
      true
    );
  });

  test("waiting matches with available courts are not a NO_COURT failure", () => {
    const snapshot = normalizeDailyPlayServerSnapshot({
      ok: true,
      tournamentId: "3bea23cf-f3b8-4a1f-8154-34b258e8b799",
      state: {
        revision: 4,
        checkedInPlayerIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
        matches: [
          {
            id: "m1",
            status: "waiting",
            courtId: null,
            teamAPlayerIds: ["a", "b"],
            teamBPlayerIds: ["c", "d"],
          },
          {
            id: "m2",
            status: "waiting",
            courtId: null,
            teamAPlayerIds: ["e", "f"],
            teamBPlayerIds: ["g", "h"],
          },
        ],
      },
      courts: PRODUCTION_LIKE_COURTS,
      activeLeases: [],
    });
    assert.equal(snapshot.hasCourtCapability, true);
    assert.equal(snapshot.availableCourts.length, 4);
    const plan = resolveCreateMatchCount({
      enabledCourts: snapshot.courts,
      availableCourts: snapshot.availableCourts,
      eligiblePlayerCount: 8,
    });
    assert.equal(plan.waitingForCourt, false);
    assert.notEqual(plan.code, "NO_COURT_CAPABILITY");
    assert.equal(
      resolveCreateCourtWaitingNote({
        availableCourtCount: snapshot.availableCourts.length,
        waitingForCourt: true,
      }),
      ""
    );
    assert.equal(
      isObsoleteNoCourtAvailabilityError(DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING, 4),
      true
    );
    assert.equal(selectEnabledCourts(PRODUCTION_LIKE_COURTS, []).length, 4);
  });
});

describe("Team Tournament shared-gate regression", () => {
  test("Daily Play path is not claimed by Team hub/dashboard/engine gates", () => {
    const daily = "/tournament/daily/daily-1";
    assert.equal(isMyTournamentsHubPath(daily), false);
    assert.equal(isTournamentDashboardPath(daily), false);
    assert.equal(isTournamentEnginePath(daily), false);
    assert.equal(decideTournamentEngineRouteGate({ pathname: daily }).apply, false);
  });

  test("Team hub and dashboard remain authenticated-only", () => {
    assert.equal(isMyTournamentsHubPath("/tournaments"), true);
    assert.equal(isTournamentDashboardPath("/tournaments/team-1"), true);
    assert.equal(isAuthenticatedOnlyRoute("/tournaments"), true);
    assert.equal(isAuthenticatedOnlyRoute("/tournaments/team-1"), true);
    assert.equal(
      shouldBlockRouteForAuthLoading({
        authLoading: true,
        isAuthenticated: true,
        user: { id: "u1" },
        pathname: "/tournaments",
      }),
      false
    );
  });
});
