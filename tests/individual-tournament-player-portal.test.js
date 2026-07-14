import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ENTRY_STATUS, MATCH_STATUS, MATCH_STAGE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import {
  buildPlayerPortalDashboard,
  listPlayerTournaments,
  listUpcomingMatchesForEntry,
  listMatchHistoryForEntry,
} from "../src/features/individual-tournament/engines/playerPortalEngine.js";
import {
  PLAYER_NOTIFICATION_TYPE,
  buildPlayerNotifications,
  markAllNotificationsRead,
  bumpPortalOptimisticVersion,
  getPortalOptimisticVersion,
  dismissNotification,
} from "../src/features/individual-tournament/engines/playerNotificationEngine.js";
import { RESULTS_OPS_AUDIT } from "../src/features/individual-tournament/engines/walkoverEngine.js";
import { RESULT_AUDIT_ACTIONS } from "../src/features/individual-tournament/engines/matchResultEngine.js";
import { SCHEDULE_AUDIT_ACTIONS, SCHEDULE_PUBLISH_STATUS } from "../src/tournament/engines/publishScheduleEngine.js";
import { DRAW_PUBLISH_STATUS } from "../src/tournament/engines/publishDrawEngine.js";
import { TOURNAMENT_ROUTES } from "../src/config/tournamentRoutes.js";
import { collectTournamentInPageLabels } from "../src/config/v5Menu/tournamentInPageNav.js";

function makeTournament() {
  return {
    id: "t-s1-h",
    name: "S1-H Portal Cup",
    status: TOURNAMENT_STATUS.ACTIVE,
    settings: {
      draw: { status: DRAW_PUBLISH_STATUS.PUBLISHED, publishedAt: "2026-07-14T08:00:00.000Z" },
      schedule: {
        status: SCHEDULE_PUBLISH_STATUS.PUBLISHED,
        auditLog: [
          {
            id: "sa1",
            action: SCHEDULE_AUDIT_ACTIONS.PUBLISHED,
            timestamp: "2026-07-14T09:00:00.000Z",
          },
        ],
      },
      refereeAssignments: {
        m1: {
          matchId: "m1",
          rosterId: "r1",
          refereeName: "Ref A",
          assignedAt: "2026-07-14T10:00:00.000Z",
          status: "assigned",
        },
      },
      resultsOps: {
        closed: false,
        auditLog: [
          {
            id: "wo1",
            action: RESULTS_OPS_AUDIT.WALKOVER_DECLARED,
            matchId: "m2",
            entryId: "e1",
            winnerId: "e1",
            loserId: "e2",
            timestamp: "2026-07-14T11:00:00.000Z",
            reason: "no_show",
          },
        ],
        walkovers: [],
      },
      resultPropagation: {
        auditLog: [
          {
            id: "rc1",
            action: RESULT_AUDIT_ACTIONS.CONFIRMED,
            matchId: "m2",
            winnerId: "e1",
            loserId: "e2",
            scoreA: 11,
            scoreB: 0,
            timestamp: "2026-07-14T11:05:00.000Z",
          },
        ],
        processedCommandIds: [],
      },
      playerNotifications: { readIds: [], dismissedIds: [] },
      portalVersion: 0,
    },
    events: [
      {
        id: "ev1",
        name: "Đôi nam",
        entries: [
          { id: "e1", name: "Pair A", status: ENTRY_STATUS.APPROVED, playerIds: ["p-user"] },
          { id: "e2", name: "Pair B", status: ENTRY_STATUS.APPROVED, playerIds: ["p2"] },
        ],
        groups: [{ id: "A" }],
        matches: [
          {
            id: "m1",
            eventId: "ev1",
            groupId: "A",
            stage: MATCH_STAGE.GROUP,
            entryAId: "e1",
            entryBId: "e2",
            status: MATCH_STATUS.ASSIGNED,
            scheduledStart: "2026-07-15T08:00:00.000Z",
            courtId: "c1",
          },
          {
            id: "m2",
            eventId: "ev1",
            groupId: "A",
            stage: MATCH_STAGE.GROUP,
            entryAId: "e1",
            entryBId: "e2",
            status: MATCH_STATUS.FORFEIT,
            winnerId: "e1",
            loserId: "e2",
            scoreA: 11,
            scoreB: 0,
            completedAt: "2026-07-14T11:05:00.000Z",
            locked: true,
          },
        ],
        bracket: { rounds: [] },
      },
    ],
  };
}

test("T-S1-H01 Player portal dashboard includes upcoming, history, standing hooks", () => {
  const tournament = makeTournament();
  const dash = buildPlayerPortalDashboard(tournament, { playerId: "p-user" });
  assert.equal(dash.ok, true);
  assert.equal(dash.enrolled, true);
  assert.equal(dash.entry.id, "e1");
  assert.equal(dash.upcomingMatches.length, 1);
  assert.equal(dash.upcomingMatches[0].id, "m1");
  assert.equal(dash.matchHistory.length, 1);
  assert.equal(dash.matchHistory[0].didWin, true);
  assert.equal(dash.schedule.published, true);
  assert.equal(dash.bracket.drawPublished, true);
});

test("T-S1-H02 listPlayerTournaments filters by enrollment", () => {
  const listed = listPlayerTournaments([makeTournament()], "p-user");
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "t-s1-h");
  assert.equal(listPlayerTournaments([makeTournament()], "unknown").length, 0);
});

test("T-S1-H03 Notifications cover assign/schedule/walkover/result/complete", () => {
  let tournament = makeTournament();
  let feed = buildPlayerNotifications(tournament, { entryId: "e1" });
  const types = new Set(feed.notifications.map((n) => n.type));
  assert.ok(types.has(PLAYER_NOTIFICATION_TYPE.MATCH_ASSIGNED));
  assert.ok(types.has(PLAYER_NOTIFICATION_TYPE.SCHEDULE_CHANGED));
  assert.ok(types.has(PLAYER_NOTIFICATION_TYPE.WALKOVER_NOTICE));
  assert.ok(types.has(PLAYER_NOTIFICATION_TYPE.RESULT_PUBLISHED));
  assert.ok(feed.unreadCount >= 3);

  tournament = {
    ...tournament,
    settings: {
      ...tournament.settings,
      resultsOps: { ...tournament.settings.resultsOps, closed: true, closedAt: "2026-07-14T18:00:00.000Z" },
    },
  };
  feed = buildPlayerNotifications(tournament, { entryId: "e1" });
  assert.ok(feed.notifications.some((n) => n.type === PLAYER_NOTIFICATION_TYPE.TOURNAMENT_COMPLETED));

  const marked = markAllNotificationsRead(tournament, { entryId: "e1" });
  assert.equal(marked.ok, true);
  const after = buildPlayerNotifications(marked.tournament, { entryId: "e1" });
  assert.equal(after.unreadCount, 0);

  const dismissed = dismissNotification(marked.tournament, after.notifications[0].id);
  assert.equal(dismissed.ok, true);
});

test("T-S1-H04 Optimistic portal version conflict", () => {
  const tournament = makeTournament();
  assert.equal(getPortalOptimisticVersion(tournament), 0);
  const bumped = bumpPortalOptimisticVersion(tournament, 0);
  assert.equal(bumped.ok, true);
  assert.equal(bumped.version, 1);
  const conflict = bumpPortalOptimisticVersion(bumped.tournament, 0);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "VERSION_CONFLICT");
});

test("T-S1-H05 upcoming vs history helpers", () => {
  const tournament = makeTournament();
  assert.equal(listUpcomingMatchesForEntry(tournament, "e1").length, 1);
  assert.equal(listMatchHistoryForEntry(tournament, "e1").length, 1);
});

test("v5 menu includes individual player portal route", () => {
  assert.equal(TOURNAMENT_ROUTES.playerPortal, "/tournament/my");
  const labels = collectTournamentInPageLabels();
  assert.ok(
    labels.includes("Cổng VĐV (Individual)") ||
      labels.some((l) => String(l).includes("Cổng VĐV")),
    `expected portal label in in-page nav, got: ${JSON.stringify(labels.slice(0, 20))}`
  );
});

test("standings panel uses VĐV labels (S1-GAP-094)", () => {
  const source = fs.readFileSync(
    path.resolve("src/components/tournament/bracket/BracketGroupStandingsPanel.jsx"),
    "utf8"
  );
  assert.equal(source.includes("VĐV / Cặp"), true);
  assert.equal(source.includes("{teamCount} ĐỘI"), false);
});

test("player portal page + public page exist and are not team portal", () => {
  const portal = fs.readFileSync(
    path.resolve("src/pages/tournament/IndividualPlayerPortalPage.jsx"),
    "utf8"
  );
  const pub = fs.readFileSync(
    path.resolve("src/pages/tournament/IndividualTournamentPublicPage.jsx"),
    "utf8"
  );
  const router = fs.readFileSync(path.resolve("src/router.jsx"), "utf8");
  assert.equal(portal.includes("buildPlayerPortalDashboard"), true);
  assert.equal(portal.includes("TeamPortal"), false);
  assert.equal(pub.includes("Trang công khai"), true);
  assert.equal(router.includes("/tournament/my"), true);
  assert.equal(router.includes("/tournament/:tournamentId/public"), true);
});
