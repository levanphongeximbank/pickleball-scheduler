/**
 * IT-E2E-BROWSER-009 / 010 / 011 — Internal courts, schedule lock/publish, referee discovery.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
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
  INTERNAL_COURT_AUTHORITY,
  INTERNAL_COURT_AVAILABILITY,
  INTERNAL_COURT_COPY,
  INTERNAL_COURT_READER,
  INTERNAL_REFEREE_DISCOVERY_READER,
  assignCourtsAndTimesToExistingInternalMatches,
  assignInternalMatchReferee,
  classifyInternalCourtAvailability,
  listInternalRefereeHubAssignments,
  loadInternalScheduleCourts,
  lockInternalSchedule,
  matchInternalRefereeIdentity,
  projectInternalScheduleCourts,
  publishInternalSchedule,
  resolveInternalScheduleLifecycle,
} from "../src/features/tournament/internal/index.js";
import { listRefereeAssignments } from "../src/features/identity/services/refereeSessionService.js";
import { canLockSchedule, canPublishSchedule } from "../src/tournament/engines/publishScheduleEngine.js";
import { getDrawPublishStatus } from "../src/tournament/engines/publishDrawEngine.js";
import { getSchedulePublishStatus } from "../src/tournament/engines/publishScheduleEngine.js";
import { addCanonicalRefereeToRoster } from "../src/models/tournament/refereeRoster.js";
import { ROLES } from "../src/features/identity/constants/roles.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOURNAMENT_ID = "a09e05ba-ae8d-489f-bcbb-2b93645c9a47";
const CLUB_ID = "club-ecebf64c78f948ccb2b59842441eb26c";
const TENANT_ID = "venue-staging-a";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makeGroupMatches(count = 6) {
  return Array.from({ length: count }, (_, index) => ({
    id: `GA-R1-M${index + 1}`,
    groupId: index < 3 ? "G1" : "G2",
    entryAId: `e${index * 2 + 1}`,
    entryBId: `e${index * 2 + 2}`,
    courtId: null,
    scheduledStart: null,
  }));
}

function makeTournament({ matches = makeGroupMatches(), settings = {}, refereeRoster = [] } = {}) {
  return {
    id: TOURNAMENT_ID,
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.ACTIVE,
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
    settings: { refereeRoster, ...settings },
    events: [
      {
        id: "event-1",
        type: EVENT_TYPE.MIXED_DOUBLE,
        groups: [
          { id: "G1", name: "Bảng A" },
          { id: "G2", name: "Bảng B" },
        ],
        entries: [
          { id: "e1", name: "Đội 1" },
          { id: "e2", name: "Đội 2" },
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

const BOOKABLE_COURTS = [
  { id: "tt412-court-01", name: "Sân 1", active: true, status: "active", clubId: CLUB_ID },
  { id: "tt412-court-02", name: "Sân 2", active: true, status: "active", clubId: CLUB_ID },
];

describe("IT-E2E-BROWSER-009 Internal court inventory", () => {
  it("projects Physical Courts through Court Adapter V1 and does not invent an Internal court table", () => {
    const setupSrc = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const stageSrc = readSrc("src/components/tournament/internal/InternalScheduleStage.jsx");
    const courtSrc = readSrc("src/features/tournament/internal/internalScheduleCourts.js");
    const adapterSrc = readSrc(
      "src/features/tournament/internal/InternalTournamentCourtAdapter.js"
    );

    assert.match(setupSrc, /loadInternalScheduleCourts/);
    assert.doesNotMatch(setupSrc, /loadCourtsForClub/);
    assert.match(adapterSrc, /createCourtResourceCompetitionAdapter/);
    assert.match(courtSrc, /listEligibleCourts/);
    assert.doesNotMatch(courtSrc, /listCanonicalClubCourtsForFormatVenue/);
    assert.doesNotMatch(courtSrc, /club_data_v3/);
    assert.equal(INTERNAL_COURT_AUTHORITY, "competition-court-adapter-v1");
    assert.equal(INTERNAL_COURT_READER, "listEligibleCourts");
    assert.doesNotMatch(courtSrc + setupSrc + stageSrc, /internal_courts/);
    assert.doesNotMatch(stageSrc, /generateSchedule/);
    assert.doesNotMatch(stageSrc, /tất cả sân đang bị khóa/);
  });

  it("classifies none configured vs all unavailable vs available", () => {
    const none = classifyInternalCourtAvailability([]);
    assert.equal(none.state, INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED);
    assert.equal(none.availableCount, 0);
    assert.equal(
      none.message,
      INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED]
    );
    assert.doesNotMatch(none.message, /khóa/);

    const locked = classifyInternalCourtAvailability([
      { id: "c1", name: "Sân khóa", active: true, status: "locked" },
    ]);
    assert.equal(locked.state, INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE);
    assert.equal(locked.sourceCount, 1);
    assert.equal(locked.availableCount, 0);
    assert.equal(
      locked.message,
      INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE]
    );
    assert.doesNotMatch(locked.message, /khóa/);

    const available = classifyInternalCourtAvailability(BOOKABLE_COURTS);
    assert.equal(available.state, INTERNAL_COURT_AVAILABILITY.AVAILABLE);
    assert.equal(available.sourceCount, 2);
    assert.equal(available.availableCount, 2);
    assert.equal(available.message, null);
  });

  it("loads courts through the Competition Court Adapter Contract V1", async () => {
    const result = await loadInternalScheduleCourts({
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
      competitionId: TOURNAMENT_ID,
      courtAdapter: {
        listEligibleCourts: () => ({
          ok: true,
          courts: BOOKABLE_COURTS.map((court) => ({
            physicalCourtId: court.id,
            displayName: court.name,
            active: true,
            status: "active",
          })),
        }),
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.authority, INTERNAL_COURT_AUTHORITY);
    assert.equal(result.reader, INTERNAL_COURT_READER);
    assert.equal(result.availability.availableCount, 2);
    assert.equal(projectInternalScheduleCourts(result.courts).length, 2);
    assert.equal(result.courts[0].physicalCourtId, "tt412-court-01");
  });

  it("assigns court/time onto existing match IDs without duplication and survives F5 mapper", () => {
    const before = makeGroupMatches(6);
    const assigned = assignCourtsAndTimesToExistingInternalMatches({
      matches: before,
      courts: BOOKABLE_COURTS,
      date: "2026-08-14",
      startTime: "08:00",
    });
    assert.equal(assigned.ok, true);
    assert.equal(assigned.matchCount, 6);
    assert.equal(assigned.duplicateCount, 0);
    assert.deepEqual(
      assigned.matches.map((match) => match.id),
      before.map((match) => match.id)
    );
    assert.ok(assigned.matches.every((match) => match.courtId && match.scheduledStart));

    const tournament = makeTournament({ matches: assigned.matches });
    const hydrated = roundTrip(tournament);
    assert.equal(hydrated.events[0].matches.length, 6);
    assert.deepEqual(
      hydrated.events[0].matches.map((match) => match.id),
      before.map((match) => match.id)
    );
    assert.ok(
      hydrated.events[0].matches.every((match) => match.courtId && match.scheduledStart)
    );
  });
});

describe("IT-E2E-BROWSER-010 Internal lock/publish state machine", () => {
  it("does not require draw publish to lock Internal schedule and is not circular", () => {
    const matches = assignCourtsAndTimesToExistingInternalMatches({
      matches: makeGroupMatches(6),
      courts: BOOKABLE_COURTS,
      date: "2026-08-14",
    }).matches;
    const tournament = makeTournament({ matches });
    const lifecycle = resolveInternalScheduleLifecycle({
      tournament,
      event: tournament.events[0],
      matches,
      courtAvailability: classifyInternalCourtAvailability(BOOKABLE_COURTS),
    });

    assert.equal(lifecycle.drawConfirmed, true);
    assert.equal(lifecycle.drawPublished, false);
    assert.equal(lifecycle.scheduleStatus, "draft");
    assert.equal(lifecycle.circularLockPublish, false);
    assert.equal(lifecycle.actions.lock.enabled, true);
    assert.equal(lifecycle.actions.publish.enabled, false);
    assert.match(lifecycle.actions.publish.reason, /Khóa lịch trước khi công bố/);
    assert.doesNotMatch(lifecycle.actions.lock.reason || "", /công bố/);
    assert.doesNotMatch(lifecycle.actions.publish.reason || "", /bốc thăm/);

    const locked = lockInternalSchedule(tournament, matches);
    assert.equal(locked.ok, true);
    assert.equal(getSchedulePublishStatus(locked.tournament).status, "locked");

    const afterLock = resolveInternalScheduleLifecycle({
      tournament: locked.tournament,
      event: locked.tournament.events[0],
      matches,
      courtAvailability: classifyInternalCourtAvailability(BOOKABLE_COURTS),
    });
    assert.equal(afterLock.actions.lock.enabled, false);
    assert.equal(afterLock.actions.publish.enabled, true);

    const published = publishInternalSchedule(locked.tournament, matches);
    assert.equal(published.ok, true);
    assert.equal(getSchedulePublishStatus(published.tournament).status, "published");
  });

  it("persists lock then publish across F5 mapper", () => {
    const matches = assignCourtsAndTimesToExistingInternalMatches({
      matches: makeGroupMatches(6),
      courts: BOOKABLE_COURTS,
      date: "2026-08-14",
    }).matches;
    let tournament = makeTournament({ matches });
    tournament = lockInternalSchedule(tournament, matches).tournament;
    let hydrated = roundTrip(tournament);
    assert.equal(getSchedulePublishStatus(hydrated).status, "locked");
    assert.equal(getDrawPublishStatus(hydrated).status, "draft");

    tournament = publishInternalSchedule(hydrated, matches).tournament;
    hydrated = roundTrip(tournament);
    assert.equal(getSchedulePublishStatus(hydrated).status, "published");
  });

  it("keeps Official/shared lock requiring draw publish by default", () => {
    const matches = assignCourtsAndTimesToExistingInternalMatches({
      matches: makeGroupMatches(6),
      courts: BOOKABLE_COURTS,
      date: "2026-08-14",
    }).matches;
    const tournament = makeTournament({ matches });
    const lock = canLockSchedule(tournament, matches);
    assert.equal(lock.ok, false);
    assert.match(lock.error, /bốc thăm/);
    const publish = canPublishSchedule(tournament, matches);
    assert.equal(publish.ok, false);
    assert.match(publish.error, /khóa lịch/i);
  });

  it("disables lock until every match has court and time", () => {
    const tournament = makeTournament();
    const lifecycle = resolveInternalScheduleLifecycle({
      tournament,
      event: tournament.events[0],
      matches: tournament.events[0].matches,
      courtAvailability: classifyInternalCourtAvailability(BOOKABLE_COURTS),
    });
    assert.equal(lifecycle.actions.lock.enabled, false);
    assert.match(lifecycle.actions.lock.reason, /Phân sân và giờ/);
  });

  it("wires Internal schedule buttons to the one lifecycle resolver", () => {
    const stageSrc = readSrc("src/components/tournament/internal/InternalScheduleStage.jsx");
    assert.match(stageSrc, /resolveInternalScheduleLifecycle/);
    assert.match(stageSrc, /lockInternalSchedule/);
    assert.match(stageSrc, /publishInternalSchedule/);
    assert.match(stageSrc, /assignCourtsAndTimesToExistingInternalMatches/);
    assert.doesNotMatch(stageSrc, /lockSchedule\(/);
    assert.doesNotMatch(stageSrc, /publishSchedule\(/);
  });
});

describe("IT-E2E-BROWSER-011 Internal referee discovery", () => {
  const refereeUser = {
    id: "ref-auth-uid-418",
    email: "tt418.referee01@staging.local",
    role: ROLES.REFEREE,
    venueId: TENANT_ID,
  };

  it("links assignment to login identity and discovers from the shared hub reader", async () => {
    const rosterAdd = addCanonicalRefereeToRoster([], {
      userId: refereeUser.id,
      email: refereeUser.email,
      displayName: "TT418 Referee",
    });
    assert.equal(rosterAdd.ok, true);
    const tournament = makeTournament({
      matches: makeGroupMatches(6),
      refereeRoster: rosterAdd.roster,
    });
    const assigned = assignInternalMatchReferee({
      tournament,
      event: tournament.events[0],
      matchId: "GA-R1-M1",
      rosterId: rosterAdd.entry.id,
    });
    assert.equal(assigned.ok, true);
    assert.equal(assigned.referee.canonicalUserId, refereeUser.id);
    assert.equal(assigned.referee.email, refereeUser.email);
    assert.ok(assigned.referee.token);

    const nextTournament = {
      ...tournament,
      events: [assigned.event],
      settings: { ...tournament.settings, refereeRoster: rosterAdd.roster },
    };
    const hydrated = roundTrip(nextTournament);
    assert.equal(hydrated.events[0].matches[0].referee.canonicalUserId, refereeUser.id);

    const discovered = listInternalRefereeHubAssignments({
      tournaments: [hydrated],
      user: refereeUser,
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
    });
    assert.equal(discovered.ok, true);
    assert.equal(discovered.matches.length, 1);
    assert.equal(discovered.matches[0].matchId, "GA-R1-M1");
    assert.equal(discovered.matches[0].tournamentName, "Giải nội bộ 14/8/2026");
    assert.match(discovered.matches[0].accessPath, /^\/referee\//);

    const hub = await listRefereeAssignments(
      { clubId: CLUB_ID, tenantId: TENANT_ID },
      {
        getCurrentUser: () => refereeUser,
        isRbacEnabled: () => true,
        loadAIData: () => ({ tournaments: {} }),
        listTournaments: async () => ({ ok: true, tournaments: [hydrated] }),
        fetchMatchLiveForTournament: async () => ({ ok: true, rows: [] }),
      }
    );
    assert.equal(hub.ok, true);
    assert.equal(hub.matches.length, 1);
    assert.equal(INTERNAL_REFEREE_DISCOVERY_READER.includes("listTournamentsQuery"), true);
  });

  it("denies anonymous, wrong user, and cross-tenant discovery", async () => {
    const rosterAdd = addCanonicalRefereeToRoster([], {
      userId: refereeUser.id,
      email: refereeUser.email,
      displayName: "TT418 Referee",
    });
    const tournament = makeTournament({ refereeRoster: rosterAdd.roster });
    const assigned = assignInternalMatchReferee({
      tournament,
      event: tournament.events[0],
      matchId: "GA-R1-M1",
      rosterId: rosterAdd.entry.id,
    });
    const nextTournament = { ...tournament, events: [assigned.event] };

    const anonymous = listInternalRefereeHubAssignments({
      tournaments: [nextTournament],
      user: null,
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
    });
    assert.equal(anonymous.ok, false);
    assert.equal(anonymous.code, "NOT_AUTHENTICATED");

    const wrongUser = listInternalRefereeHubAssignments({
      tournaments: [nextTournament],
      user: { id: "other-user", email: "other@staging.local", role: ROLES.REFEREE },
      clubId: CLUB_ID,
      tenantId: TENANT_ID,
    });
    assert.equal(wrongUser.matches.length, 0);

    const wrongTenant = listInternalRefereeHubAssignments({
      tournaments: [nextTournament],
      user: refereeUser,
      clubId: CLUB_ID,
      tenantId: "other-tenant",
    });
    assert.equal(wrongTenant.matches.length, 0);

    const unauthHub = await listRefereeAssignments(
      { clubId: CLUB_ID, tenantId: TENANT_ID },
      { getCurrentUser: () => null, isRbacEnabled: () => true }
    );
    assert.equal(unauthHub.ok, false);
    assert.equal(unauthHub.code, "NOT_AUTHENTICATED");
  });

  it("matches email-as-name fixture referees and preserves token portal", () => {
    assert.equal(
      matchInternalRefereeIdentity(
        refereeUser,
        { name: "tt418.referee01@staging.local", token: "abc" },
        null
      ),
      true
    );

    const hubSrc = readSrc("src/pages/referee/RefereeHub.jsx");
    const refereeSrc = readSrc("src/components/tournament/internal/InternalRefereeStage.jsx");
    const assignSrc = readSrc("src/features/tournament/internal/internalMatchRefereeAssignment.js");
    assert.match(hubSrc, /\/referee\/:token/);
    assert.match(hubSrc, /internal_canonical/);
    assert.match(hubSrc, /accessPath/);
    assert.doesNotMatch(hubSrc + refereeSrc + assignSrc, /internal_referee_accounts/);
    assert.match(refereeSrc, /enableCanonicalDirectory/);
    assert.match(assignSrc, /canonicalUserId/);
  });
});
