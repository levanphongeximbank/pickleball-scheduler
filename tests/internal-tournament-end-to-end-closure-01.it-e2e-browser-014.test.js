/**
 * IT-E2E-BROWSER-014 — authenticated referee Giải của tôi includes Internal assignments.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  assignInternalMatchReferee,
  listInternalRefereeHubAssignments,
} from "../src/features/tournament/internal/index.js";
import {
  MY_TOURNAMENTS_SHARED_AGGREGATOR,
  aggregateMyTournamentDashboards,
  mergeMyTournamentDashboardCards,
} from "../src/features/tournament/my-tournaments/aggregateMyTournamentDashboards.js";
import {
  addCanonicalRefereeToRoster,
  createRefereeRosterEntry,
  REFEREE_ROSTER_SOURCE,
} from "../src/models/tournament/refereeRoster.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { getDefaultHomePath } from "../src/auth/menuAccess.js";
import { projectMyDashboardCard } from "../src/features/team-tournament/my-dashboards/myDashboardsModel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERNAL_ID = "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3";
const TEAM_ID = "team-dash-tt418-01";
const UNASSIGNED_ID = "unassigned-internal-014";
const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";
const AUTH_UID = "ca78575b-c5bf-4d32-bd7c-cc3027fea2a5";
const AUTH_EMAIL = "tt418.referee01@staging.local";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const refereeUser = {
  id: AUTH_UID,
  email: AUTH_EMAIL,
  role: ROLES.REFEREE,
  venueId: TENANT_ID,
};

function makeMatches() {
  return [
    {
      id: "GA-R1-M1",
      groupId: "G1",
      round: 1,
      stage: "group",
      entryAId: "e1",
      entryBId: "e2",
      courtId: "tt412-court-01",
      scheduledStart: "2026-08-14T10:00:00.000Z",
    },
  ];
}

function makeInternalTournament({
  id = INTERNAL_ID,
  refereeRoster = [],
  matches = makeMatches(),
  tenantId = TENANT_ID,
  clubId = CLUB_ID,
} = {}) {
  return {
    id,
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.READY,
    clubId,
    tenantId,
    settings: { refereeRoster },
    events: [
      {
        id: "event-1",
        type: EVENT_TYPE.MEN_DOUBLE,
        groups: [
          { id: "G1", name: "Bảng A" },
          { id: "G2", name: "Bảng B" },
        ],
        entries: [
          { id: "e1", name: "IT421 Nam 01 / IT421 Nam 02" },
          { id: "e2", name: "IT421 Nam 03 / IT421 Nam 04" },
        ],
        matches,
      },
    ],
  };
}

function roundTrip(tournament) {
  const row = tournamentToCanonicalRow(tournament, {
    tenantId: tournament.tenantId,
    clubId: tournament.clubId,
  });
  row.version = 19;
  row.created_at = "2026-08-14T00:00:00.000Z";
  row.updated_at = "2026-08-14T00:00:00.000Z";
  return canonicalRowToTournament(row);
}

function assignCanonical(tournament) {
  const rosterAdd = addCanonicalRefereeToRoster(tournament.settings.refereeRoster || [], {
    userId: AUTH_UID,
    email: AUTH_EMAIL,
    displayName: "Trọng tài 01",
  });
  assert.equal(rosterAdd.ok, true);
  const withRoster = {
    ...tournament,
    settings: { ...tournament.settings, refereeRoster: rosterAdd.roster },
  };
  const assigned = assignInternalMatchReferee({
    tournament: withRoster,
    event: withRoster.events[0],
    matchId: "GA-R1-M1",
    rosterId: rosterAdd.entry.id,
  });
  assert.equal(assigned.ok, true);
  return roundTrip({
    ...withRoster,
    events: [assigned.event],
  });
}

describe("IT-E2E-BROWSER-014 referee Giải của tôi includes Internal", () => {
  it("wires the actual /tournaments hub to the shared aggregator", () => {
    const hub = readSrc("src/pages/tournament/MyTournamentsHubPage.jsx");
    const hook = readSrc("src/features/team-tournament/my-dashboards/useMyTournamentDashboards.js");
    const landing = readSrc("src/auth/menuAccess.js");
    assert.match(hub, /Giải của tôi/);
    assert.match(hub, /useMyTournamentDashboards/);
    assert.match(hub, /item\.modeLabel/);
    assert.match(hook, /aggregateMyTournamentDashboards/);
    assert.match(hook, /listTournamentsQuery/);
    assert.match(hook, /rpcTeamTournamentListMyDashboards/);
    assert.equal(MY_TOURNAMENTS_SHARED_AGGREGATOR.includes("listInternalRefereeHubAssignments"), true);
    assert.equal(getDefaultHomePath(refereeUser, true), "/tournaments");
    assert.match(landing, /case ROLES\.REFEREE:[\s\S]*return "\/tournaments"/);
  });

  it("A/B/C. Team assigned stays; Internal assigned visible; unassigned Internal absent", async () => {
    const assigned = assignCanonical(makeInternalTournament());
    const unassigned = roundTrip(makeInternalTournament({ id: UNASSIGNED_ID }));
    const teamCard = projectMyDashboardCard({
      id: TEAM_ID,
      name: "Giải đồng đội TT418",
      status: "active",
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
      roles: ["referee"],
      refereeHref: `/team-referee/${TEAM_ID}`,
    });

    const result = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [teamCard] }),
      listCanonicalTournaments: async () => ({
        ok: true,
        tournaments: [assigned, unassigned],
      }),
    });

    assert.equal(result.ok, true);
    const ids = result.tournaments.map((item) => item.id);
    assert.equal(ids.includes(TEAM_ID), true);
    assert.equal(ids.includes(INTERNAL_ID), true);
    assert.equal(ids.includes(UNASSIGNED_ID), false);
    const internal = result.tournaments.find((item) => item.id === INTERNAL_ID);
    assert.equal(internal.modeLabel, "Giải nội bộ");
    assert.deepEqual(internal.roles, ["referee"]);
    const team = result.tournaments.find((item) => item.id === TEAM_ID);
    assert.equal(team.refereeHref, `/team-referee/${TEAM_ID}`);
  });

  it("D/E. assigned Internal match and scoring token link are correct", async () => {
    const assigned = assignCanonical(makeInternalTournament());
    const result = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    const card = result.tournaments[0];
    assert.equal(card.assignedMatches.length, 1);
    assert.equal(card.assignedMatches[0].matchId, "GA-R1-M1");
    assert.equal(card.nextMatchup.matchId, "GA-R1-M1");
    assert.match(card.refereeHref, /^\/referee\//);
    assert.equal(card.assignedMatches[0].accessPath, card.refereeHref);
    assert.equal(card.assignedMatches[0].scoringAction, card.refereeHref);
    assert.equal(card.assignedMatches[0].team1Name.includes("IT421 Nam 01"), true);
  });

  it("F. canonical uid mapping succeeds", () => {
    const assigned = assignCanonical(makeInternalTournament());
    const discovered = listInternalRefereeHubAssignments({
      tournaments: [assigned],
      user: refereeUser,
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
    });
    assert.equal(discovered.ok, true);
    assert.equal(discovered.matches.length, 1);
    assert.equal(
      assigned.settings.refereeRoster[0].canonicalUserId,
      AUTH_UID
    );
    assert.equal(assigned.events[0].matches[0].referee.canonicalUserId, AUTH_UID);
  });

  it("G. same-email manual duplicate does not override account-linked identity", async () => {
    const assigned = assignCanonical(makeInternalTournament());
    const manual = createRefereeRosterEntry({
      name: AUTH_EMAIL,
      source: REFEREE_ROSTER_SOURCE.MANUAL,
    });
    const withDuplicate = roundTrip({
      ...assigned,
      settings: {
        ...assigned.settings,
        refereeRoster: [...(assigned.settings.refereeRoster || []), manual],
      },
    });
    const result = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [withDuplicate] }),
    });
    assert.equal(result.tournaments.length, 1);
    assert.equal(result.tournaments[0].id, INTERNAL_ID);
    assert.equal(withDuplicate.settings.refereeRoster.length >= 2, true);
  });

  it("H. cross-tenant Internal assignment is denied", async () => {
    const assigned = assignCanonical(
      makeInternalTournament({ tenantId: "other-tenant" })
    );
    const result = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    assert.equal(result.tournaments.length, 0);
  });

  it("I. F5/fresh mapper mount keeps the same Internal discovery", async () => {
    const assigned = assignCanonical(makeInternalTournament());
    const first = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [assigned] }),
    });
    const fresh = roundTrip(assigned);
    const second = await aggregateMyTournamentDashboards({
      user: refereeUser,
      clubs: [{ id: CLUB_ID, tenantId: TENANT_ID }],
      listTeamDashboards: async () => ({ ok: true, tournaments: [] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [fresh] }),
    });
    assert.equal(first.tournaments[0].id, second.tournaments[0].id);
    assert.equal(first.tournaments[0].refereeHref, second.tournaments[0].refereeHref);
    assert.equal(second.tournaments[0].assignedMatches[0].matchId, "GA-R1-M1");
  });

  it("anonymous user cannot aggregate the authenticated hub", async () => {
    const result = await aggregateMyTournamentDashboards({
      user: null,
      listTeamDashboards: async () => ({ ok: true, tournaments: [{ id: TEAM_ID }] }),
      listCanonicalTournaments: async () => ({ ok: true, tournaments: [] }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_AUTHENTICATED");
    assert.equal(result.tournaments.length, 0);
  });

  it("does not replace Team cards when merging Internal", () => {
    const merged = mergeMyTournamentDashboardCards(
      [{ id: TEAM_ID, name: "Team", roles: ["referee"] }],
      [{ id: INTERNAL_ID, name: "Internal", roles: ["referee"] }]
    );
    assert.deepEqual(
      merged.map((item) => item.id),
      [TEAM_ID, INTERNAL_ID]
    );
  });
});
