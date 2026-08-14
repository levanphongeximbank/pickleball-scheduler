/**
 * IT-E2E-BROWSER-018 — Internal tournament-level referee portal.
 * Reuses Team's tournament workspace pattern without MLP semantics.
 * Scoring stays 016 ensure + shared live + 017 canonical commit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { addCanonicalRefereeToRoster } from "../src/models/tournament/refereeRoster.js";
import {
  assignInternalMatchReferee,
  buildInternalRefereeCanonicalHref,
  buildInternalRefereePortalHref,
  canAssignedInternalRefereeWriteMatch,
  INTERNAL_REFEREE_PORTAL_FILTER,
  listInternalRefereePortalAssignments,
  projectInternalRefereeCanonicalEventResult,
  projectInternalRefereePortalAfterCommit,
  resolveInternalRefereePortalLoadPresentation,
  standingsFromInternalEvent,
} from "../src/features/tournament/internal/index.js";
import { aggregateMyTournamentDashboards } from "../src/features/tournament/my-tournaments/aggregateMyTournamentDashboards.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { isAuthenticatedOnlyRoute } from "../src/auth/authGuard.js";
import { isInternalRefereePortalPath } from "../src/features/tournament/internal/internalRefereeCanonicalPath.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERNAL_ID = "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3";
const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";
const AUTH_UID = "ca78575b-c5bf-4d32-bd7c-cc3027fea2a5";
const AUTH_EMAIL = "tt418.referee01@staging.local";
const OTHER_UID = "7b381912-2190-415c-b099-6b1e87567b7a";
const ASSIGNED_MATCH_IDS = [
  "GA-R1-M1",
  "GA-R2-M1",
  "GA-R3-M1",
  "GB-R1-M1",
  "GB-R2-M1",
  "GB-R3-M1",
];

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const refereeUser = {
  id: AUTH_UID,
  email: AUTH_EMAIL,
  role: ROLES.REFEREE,
  venueId: TENANT_ID,
};

function ownerMatches({ includeUnassigned = false, completedIds = ["GA-R1-M1"] } = {}) {
  const rows = [
    ["GA-R1-M1", "G1", 1, "e1", "e2", "tt412-court-01", "TT412 Sân 1", "2026-08-14T08:00:00"],
    ["GA-R2-M1", "G1", 2, "e1", "e2", "tt412-court-02", "TT412 Sân 2", "2026-08-14T08:30:00"],
    ["GA-R3-M1", "G1", 3, "e1", "e2", "tt412-court-01", "TT412 Sân 1", "2026-08-14T09:00:00"],
    ["GB-R1-M1", "G2", 1, "e3", "e4", "tt412-court-02", "TT412 Sân 2", "2026-08-14T09:30:00"],
    ["GB-R2-M1", "G2", 2, "e3", "e4", "tt412-court-01", "TT412 Sân 1", "2026-08-14T10:00:00"],
    ["GB-R3-M1", "G2", 3, "e3", "e4", "tt412-court-02", "TT412 Sân 2", "2026-08-14T10:30:00"],
  ];
  const matches = rows.map(([id, groupId, round, entryAId, entryBId, courtId, courtName, scheduledStart]) => ({
    id,
    groupId,
    round,
    stage: "group",
    entryAId,
    entryBId,
    courtId,
    courtName,
    scheduledStart,
    status: completedIds.includes(id) ? MATCH_STATUS.COMPLETED : MATCH_STATUS.WAITING,
    scoreA: completedIds.includes(id) ? 11 : 0,
    scoreB: completedIds.includes(id) ? 5 : 0,
  }));
  if (includeUnassigned) {
    matches.push({
      id: "KO-R1-M1",
      stage: "knockout",
      round: 1,
      entryAId: "e1",
      entryBId: "e3",
      courtId: "tt412-court-01",
      courtName: "TT412 Sân 1",
      scheduledStart: "2026-08-14T11:00:00",
      status: MATCH_STATUS.WAITING,
    });
  }
  return matches;
}

function makeBaseTournament({ matches = ownerMatches(), tenantId = TENANT_ID } = {}) {
  return {
    id: INTERNAL_ID,
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.READY,
    clubId: CLUB_ID,
    tenantId,
    version: 19,
    settings: { refereeRoster: [] },
    events: [
      {
        id: "event-1",
        type: EVENT_TYPE.MEN_DOUBLE,
        groups: [
          { id: "G1", name: "Bảng A", entryIds: ["e1", "e2"] },
          { id: "G2", name: "Bảng B", entryIds: ["e3", "e4"] },
        ],
        entries: [
          { id: "e1", name: "IT421 Nam 01 / IT421 Nam 02" },
          { id: "e2", name: "IT421 Nam 03 / IT421 Nam 04" },
          { id: "e3", name: "IT421 Nam 05 / IT421 Nam 06" },
          { id: "e4", name: "IT421 Nam 07 / IT421 Nam 08" },
        ],
        matches,
      },
    ],
  };
}

function assignMatches(tournament, matchIds) {
  const rosterAdd = addCanonicalRefereeToRoster(tournament.settings.refereeRoster || [], {
    userId: AUTH_UID,
    email: AUTH_EMAIL,
    displayName: "Trọng tài 01",
  });
  assert.equal(rosterAdd.ok, true);
  let next = {
    ...tournament,
    settings: { ...tournament.settings, refereeRoster: rosterAdd.roster },
  };
  for (const matchId of matchIds) {
    const assigned = assignInternalMatchReferee({
      tournament: next,
      event: next.events[0],
      matchId,
      rosterId: rosterAdd.entry.id,
    });
    assert.equal(assigned.ok, true);
    next = { ...next, events: [assigned.event] };
  }
  return next;
}

function roundTrip(tournament) {
  const row = tournamentToCanonicalRow(tournament, {
    tenantId: tournament.tenantId,
    clubId: tournament.clubId,
  });
  row.version = tournament.version ?? 19;
  row.created_at = "2026-08-14T00:00:00.000Z";
  row.updated_at = "2026-08-14T00:00:00.000Z";
  return canonicalRowToTournament(row);
}

describe("IT-E2E-BROWSER-018 Internal referee tournament portal", () => {
  it("A. hub Chấm trận opens tournament portal listing all six assigned matches", async () => {
    const assigned = assignMatches(makeBaseTournament({ matches: ownerMatches({ includeUnassigned: true }) }), ASSIGNED_MATCH_IDS);
    const portalHref = buildInternalRefereePortalHref({
      tournamentId: INTERNAL_ID,
      clubId: CLUB_ID,
    });
    const result = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    const card = result.tournaments[0];
    assert.equal(card.refereeHref, portalHref);
    assert.equal(card.href, portalHref);
    assert.doesNotMatch(card.refereeHref, /\/referee\/match\//);

    const portal = listInternalRefereePortalAssignments({
      tournament: assigned,
      user: refereeUser,
    });
    assert.equal(portal.ok, true);
    assert.equal(portal.matches.length, 6);
    assert.deepEqual(
      portal.matches.map((item) => item.matchId).sort(),
      [...ASSIGNED_MATCH_IDS].sort()
    );
    assert.equal(portal.matches.some((item) => item.matchId === "KO-R1-M1"), false);
    const completed = portal.matches.find((item) => item.matchId === "GA-R1-M1");
    assert.equal(completed.status, MATCH_STATUS.COMPLETED);
    assert.equal(completed.scoreLabel, "11–5");
    assert.equal(completed.actionLabel, "Xem kết quả");
    assert.equal(completed.bucket, INTERNAL_REFEREE_PORTAL_FILTER.COMPLETED);
    const pending = portal.matches.filter((item) => item.matchId !== "GA-R1-M1");
    assert.equal(pending.length, 5);
    assert.equal(pending.every((item) => item.actionLabel === "Chấm trận"), true);
    assert.equal(portal.nextMatch.matchId, "GA-R2-M1");
    assert.equal(portal.matches.find((item) => item.matchId === "GA-R2-M1").isNext, true);
  });

  it("B. selecting GA-R2-M1 then commit updates portal and next match in place", () => {
    const assigned = assignMatches(makeBaseTournament(), ASSIGNED_MATCH_IDS);
    const sessionHref = buildInternalRefereeCanonicalHref({
      tournamentId: INTERNAL_ID,
      matchId: "GA-R2-M1",
      clubId: CLUB_ID,
    });
    assert.match(sessionHref, /\/referee\/match\/GA-R2-M1/);
    assert.equal(
      canAssignedInternalRefereeWriteMatch({
        user: refereeUser,
        tournament: assigned,
        match: assigned.events[0].matches.find((item) => item.id === "GA-R2-M1"),
        roster: assigned.settings.refereeRoster,
      }),
      true
    );
    assert.equal(
      canAssignedInternalRefereeWriteMatch({
        user: refereeUser,
        tournament: assigned,
        match: { id: "KO-R1-M1" },
        roster: assigned.settings.refereeRoster,
      }),
      false
    );

    const projected = projectInternalRefereeCanonicalEventResult(
      assigned.events[0],
      "GA-R2-M1",
      { scoreA: 11, scoreB: 7 }
    );
    assert.equal(projected.ok, true);
    const after = projectInternalRefereePortalAfterCommit({
      tournament: assigned,
      user: refereeUser,
      completedMatchId: "GA-R2-M1",
      scoreA: 11,
      scoreB: 7,
    });
    assert.equal(after.ok, true);
    const ga1 = after.portal.matches.find((item) => item.matchId === "GA-R1-M1");
    const ga2 = after.portal.matches.find((item) => item.matchId === "GA-R2-M1");
    assert.equal(ga1.scoreLabel, "11–5");
    assert.equal(ga2.scoreLabel, "11–7");
    assert.equal(ga2.statusLabel, "Đã chốt");
    assert.equal(after.portal.nextMatch.matchId, "GA-R3-M1");
    const standings = standingsFromInternalEvent(projected.event);
    assert.equal(Array.isArray(standings), true);
    assert.equal(standings.length >= 1, true);
  });

  it("C. F5 mapper remount keeps assignment list and completed score", () => {
    const assigned = assignMatches(makeBaseTournament(), ASSIGNED_MATCH_IDS);
    const first = listInternalRefereePortalAssignments({
      tournament: assigned,
      user: refereeUser,
    });
    const second = listInternalRefereePortalAssignments({
      tournament: roundTrip(assigned),
      user: refereeUser,
    });
    assert.deepEqual(
      first.matches.map((item) => [item.matchId, item.scoreLabel, item.status]),
      second.matches.map((item) => [item.matchId, item.scoreLabel, item.status])
    );
    const presentation = resolveInternalRefereePortalLoadPresentation({ hasPortal: true });
    assert.equal(presentation.initialLoading, false);
    assert.equal(presentation.backgroundRefresh, true);
    const firstPaint = resolveInternalRefereePortalLoadPresentation({ hasPortal: false });
    assert.equal(firstPaint.initialLoading, true);
  });

  it("D. one match, subset, none, and cross-tenant stay fail-closed", async () => {
    const one = assignMatches(
      makeBaseTournament({ matches: ownerMatches().filter((item) => item.id === "GA-R1-M1") }),
      ["GA-R1-M1"]
    );
    const onePortal = listInternalRefereePortalAssignments({ tournament: one, user: refereeUser });
    assert.equal(onePortal.matches.length, 1);
    assert.match(onePortal.portalHref, /\/tournament\/internal\/.+\/referee/);

    const subset = assignMatches(makeBaseTournament(), ["GA-R1-M1", "GA-R2-M1", "GB-R1-M1"]);
    const subsetPortal = listInternalRefereePortalAssignments({
      tournament: subset,
      user: refereeUser,
    });
    assert.deepEqual(
      subsetPortal.matches.map((item) => item.matchId).sort(),
      ["GA-R1-M1", "GA-R2-M1", "GB-R1-M1"]
    );

    const none = makeBaseTournament();
    const nonePortal = listInternalRefereePortalAssignments({
      tournament: none,
      user: refereeUser,
    });
    assert.equal(nonePortal.ok, true);
    assert.equal(nonePortal.matches.length, 0);

    const noneHub = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [none] }),
    });
    assert.equal(noneHub.tournaments.length, 0);

    const other = { ...refereeUser, id: OTHER_UID, email: "other@staging.local" };
    const assigned = assignMatches(makeBaseTournament(), ASSIGNED_MATCH_IDS);
    const otherPortal = listInternalRefereePortalAssignments({
      tournament: assigned,
      user: other,
    });
    assert.equal(otherPortal.matches.length, 0);

    const cross = listInternalRefereePortalAssignments({
      tournament: assignMatches(makeBaseTournament({ tenantId: "venue-staging-b" }), ASSIGNED_MATCH_IDS),
      user: refereeUser,
    });
    assert.equal(cross.ok, false);
    assert.equal(cross.code, "CROSS_TENANT");
    assert.equal(cross.matches.length, 0);
  });

  it("E. Team referee portal and public token compatibility stay unchanged", () => {
    const teamPortal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
    const teamDash = readSrc("src/features/team-tournament/my-dashboards/myDashboardsModel.js");
    const internalPortal = readSrc("src/pages/tournament/InternalRefereePortalPage.jsx");
    const router = readSrc("src/router.jsx");
    const scoreboard = readSrc("src/pages/referee/RefereeScoreboard.jsx");
    const hub = readSrc("src/pages/tournament/MyTournamentsHubPage.jsx");
    assert.match(teamPortal, /rpcTeamTournamentListMyRefereeAssignments/);
    assert.match(teamPortal, /canAssignedRefereeWriteMatchup/);
    assert.match(teamDash, /\/team-referee\/\$\{id\}/);
    assert.equal(internalPortal.includes("dreambreaker"), false);
    assert.equal(internalPortal.includes("parent_matchup"), false);
    assert.equal(internalPortal.includes("useClub"), false);
    assert.equal(internalPortal.includes("Link token legacy"), false);
    assert.match(internalPortal, /data-testid="internal-referee-tournament-portal"/);
    assert.match(internalPortal, /canonicalCommit/);
    assert.match(internalPortal, /commitInternalRefereeMatchResult/);
    assert.match(internalPortal, /Trận tiếp theo/);
    assert.match(internalPortal, /resolveInternalRefereePortalLoadPresentation/);
    assert.match(router, /path="\/tournament\/internal\/:tournamentId\/referee"/);
    assert.match(router, /path="\/referee\/:token"/);
    assert.match(router, /path="\/referee\/match\/:matchId"/);
    assert.match(scoreboard, /Link token legacy/);
    assert.match(scoreboard, /onCanonicalCommitted/);
    assert.match(hub, /item\.refereeHref/);
    assert.equal(isInternalRefereePortalPath(`/tournament/internal/${INTERNAL_ID}/referee`), true);
    assert.equal(isAuthenticatedOnlyRoute(`/tournament/internal/${INTERNAL_ID}/referee`), true);
    assert.equal(isInternalRefereePortalPath(`/tournament/internal/${INTERNAL_ID}`), false);
  });

  it("F. no new scoring engine and no portal SQL", () => {
    const portalEngine = readSrc("src/features/tournament/internal/internalRefereePortal.js");
    const portalPage = readSrc("src/pages/tournament/InternalRefereePortalPage.jsx");
    const scoreboardLoader = readSrc("src/features/tournament/internal/internalRefereeTokenScoreboard.js");
    assert.match(portalPage, /RefereeScoreboard/);
    assert.match(scoreboardLoader, /ensureInternalRefereeMatchLive/);
    assert.doesNotMatch(portalEngine, /CREATE OR REPLACE FUNCTION/);
    assert.doesNotMatch(portalPage, /dreambreaker/i);
    assert.doesNotMatch(portalEngine, /parent matchup/i);
  });
});
