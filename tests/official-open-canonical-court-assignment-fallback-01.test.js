/**
 * Official/Open temporary canonical court assignment (record-only).
 * Real venue reservation is deferred. Does not apply SQL.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  hydrateCourtScheduleDraft,
} from "../src/components/tournament/tournamentCourtScheduleDraft.js";
import {
  getActiveTournamentCourtBookings,
} from "../src/domain/tournamentBookingService.js";
import {
  getDefaultClubData,
  loadBookingsForClub,
  saveClubData,
} from "../src/domain/clubStorage.js";
import { markClubDataSynced } from "../src/domain/clubSyncMetadata.js";
import { setActiveClubId, DEFAULT_CLUB, loadClubs, saveClubs } from "../src/data/club.js";
import {
  setTournamentCourtScheduleCommand,
  updateTournamentCommand,
  getTournamentQuery,
  createTournamentCommand,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  createInMemoryOfficialCourtAuthority,
  __setOfficialCourtReservationRpcForTests,
  __resetOfficialCourtReservationRpcForTests,
} from "../src/features/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
  formOfficialIndividualPairs,
  applyOfficialGroupDrawPreservingRegistration,
  listOfficialDrawEntries,
  scheduleOfficialGroupMatches,
} from "../src/features/individual-tournament/index.js";
import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";
import { buildGroupStageSchedule } from "../src/tournament/engines/scheduleEngine.js";
import { courtScheduleFieldsMatch } from "../src/models/tournament/courtSchedule.js";
import {
  TOURNAMENT_MODE,
  OFFICIAL_MODE,
  TOURNAMENT_STATUS,
  ENTRY_STATUS,
  EVENT_TYPE,
} from "../src/models/tournament/index.js";

function src(path) {
  return readFileSync(path, "utf8");
}

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const CLUB_ID = DEFAULT_CLUB.id;
const TENANT_ID = "tenant-a";
const CLUB_SCOPE = { id: CLUB_ID, tenantId: TENANT_ID, venueId: TENANT_ID };

const CANONICAL_COURTS = [
  {
    id: "tt412-court-01",
    name: "TT412 Sân 1",
    number: 1,
    active: true,
    status: "active",
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
  {
    id: "tt412-court-02",
    name: "TT412 Sân 2",
    number: 2,
    active: true,
    status: "active",
    clubId: CLUB_ID,
    tenantId: TENANT_ID,
  },
];

const OWNER_DRAFT = {
  date: "2026-08-14",
  startTime: "13:00",
  endTime: "17:00",
  courtIds: ["tt412-court-01", "tt412-court-02"],
};

const RESERVE_RPC = "official_tournament_reserve_courts";
const COMMIT_RPC = "official_tournament_commit_group_schedule";

function twelvePlayers() {
  const names = [
    ["p1", "Nguyễn A"],
    ["p2", "Trần B"],
    ["p3", "Lê C"],
    ["p4", "Phạm D"],
    ["p5", "Hoàng E"],
    ["p6", "Vũ F"],
    ["p7", "Đặng G"],
    ["p8", "Bùi H"],
    ["p9", "Đỗ I"],
    ["p10", "Ngô J"],
    ["p11", "Dương K"],
    ["p12", "Lý L"],
  ];
  return names.map(([id, name], index) => ({
    id,
    name,
    gender: "male",
    rating: 3.5 + (index % 5) * 0.1,
    status: ENTRY_STATUS.ACTIVE,
    source: "system",
  }));
}

function stubOpenPairing(players) {
  const out = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1];
    out.push({
      id: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee${String(i / 2 + 1).padStart(2, "0")}`,
      name: `${a.name} / ${b.name}`,
      playerIds: [String(a.id), String(b.id)],
      status: ENTRY_STATUS.ACTIVE,
      rating: 4,
      origin: "official_draw_materialization",
    });
  }
  return out;
}

function groupedEventsFor(tournamentId) {
  const players = twelvePlayers();
  const formed = formOfficialIndividualPairs({
    tournament: patchOfficialCompetitionSettings(
      {
        id: tournamentId,
        name: "Official Open TT412",
        mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
        officialMode: OFFICIAL_MODE.OPEN,
        status: TOURNAMENT_STATUS.DRAFT,
        clubId: CLUB_ID,
        settings: {
          officialCompetition: {
            registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
          },
          registration: { locked: true },
        },
        events: [
          {
            id: "ev1",
            name: "Đôi nam",
            eventType: EVENT_TYPE.MEN_DOUBLE,
            entries: players.map((player) => ({
              id: `e-${player.id}`,
              name: player.name,
              playerIds: [player.id],
              status: player.status,
              source: player.source,
            })),
            drawEntries: [],
            groups: [],
            matches: [],
          },
        ],
      },
      { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
    ),
    eventId: "ev1",
    players,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    pairingFn: stubOpenPairing,
  });
  assert.equal(formed.ok, true);
  const pairs = listOfficialDrawEntries(formed.tournament.events[0]);
  assert.equal(pairs.length, 6);
  const groups = [
    {
      id: "group-A-1786600000000-0",
      label: "A",
      name: "Bang A",
      entries: pairs.slice(0, 3),
      entryIds: pairs.slice(0, 3).map((pair) => pair.id),
    },
    {
      id: "group-B-1786600000000-1",
      label: "B",
      name: "Bang B",
      entries: pairs.slice(3, 6),
      entryIds: pairs.slice(3, 6).map((pair) => pair.id),
    },
  ];
  const schedule = buildGroupStageSchedule(groups, {
    tournamentId,
    eventId: "ev1",
    players,
  });
  const applied = applyOfficialGroupDrawPreservingRegistration(formed.tournament, {
    ...formed.tournament.events[0],
    groups: schedule.groups,
    matches: schedule.matches,
  });
  assert.equal(applied.ok, true);
  return {
    events: applied.tournament.events,
    settings: applied.tournament.settings,
    players,
    pairs,
    matchIds: applied.event.matches.map((match) => String(match.id)),
    pairIds: pairs.map((pair) => String(pair.id)),
  };
}

describe("official-open-canonical-court-assignment-fallback-01", () => {
  let memory;
  let courtAuth;
  let rpcCalls;

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __resetTournamentRepositorySingleton();
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id
        ? { ...club, tenantId: TENANT_ID, venueId: TENANT_ID }
        : club
    );
    saveClubs(clubs);
    setActiveClubId(CLUB_ID);
    const data = getDefaultClubData(CLUB_ID);
    data.courts = [];
    data.bookings = [];
    saveClubData(CLUB_ID, data);
    markClubDataSynced(CLUB_ID, { pull: true });
    memory = createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID });
    courtAuth = createInMemoryOfficialCourtAuthority({
      rows: memory.rows,
      tenantId: TENANT_ID,
      now: "2026-08-14T00:00:00.000Z",
      clubCourts: { [CLUB_ID]: CANONICAL_COURTS },
    });
    rpcCalls = [];
    const rpc = async (name, args) => {
      rpcCalls.push(String(name));
      if (String(name).startsWith("official_tournament_")) {
        return courtAuth.rpc(name, args);
      }
      return memory.rpc(name, args);
    };
    __setTournamentRepositoryRpcForTests(rpc);
    __setOfficialCourtReservationRpcForTests(rpc);
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
    __resetOfficialCourtReservationRpcForTests();
  });

  it("A/B. active Official UI/runtime does not invoke reservation RPCs", () => {
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const panel = src("src/components/tournament/TournamentCourtSchedulePanel.jsx");
    const group = src(
      "src/components/tournament/official/OfficialTournamentGroupStageScreen.jsx"
    );
    assert.doesNotMatch(setup, /reserveOfficialTournamentCourtsCommand/);
    assert.doesNotMatch(setup, /commitOfficialGroupScheduleCommand/);
    assert.doesNotMatch(setup, /official_tournament_reserve_courts/);
    assert.doesNotMatch(setup, /official_tournament_commit_group_schedule/);
    assert.doesNotMatch(setup, /resolveVenueTimezoneForClub/);
    const officialStart = command.indexOf(
      "loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT"
    );
    const officialBranch = command.slice(officialStart, officialStart + 1400);
    assert.match(officialBranch, /updateTournamentCommand/);
    assert.match(officialBranch, /expectedVersion/);
    assert.doesNotMatch(officialBranch, /reserveOfficialTournamentCourtsCommand/);
    assert.doesNotMatch(officialBranch, /resolveVenueTimezoneForClub/);
    assert.match(setup, /scheduleOfficialGroupMatches/);
    assert.match(setup, /expectedVersion: tournament\.version/);
    assert.match(setup, /Hãy lưu sân & thời gian trước khi xếp lịch vòng bảng/);
    assert.match(panel, /Sân & thời gian thi đấu/);
    assert.match(
      panel,
      /Ghi nhận sân và khung giờ sử dụng cho giải\. Việc giữ chỗ trên lịch vận hành sân sẽ được hoàn thiện ở module Vận hành sân\./
    );
    assert.match(panel, /Lưu sân & thời gian/);
    assert.match(panel, /Đã ghi nhận sân & thời gian cho giải/);
    assert.match(group, /recordOnly/);
  });

  it("C–H. assignment is one canonical CAS write; no bookings/reservations/timezone", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      name: "Official Open TT412",
      createdBy: "owner-1",
    });
    assert.equal(created.ok, true, created.error);
    rpcCalls.length = 0;

    saveClubs([]);
    const result = await setTournamentCourtScheduleCommand(
      CLUB_SCOPE,
      created.tournament.id,
      OWNER_DRAFT,
      {
        tenantId: TENANT_ID,
        courts: CANONICAL_COURTS,
        expectedVersion: created.tournament.version ?? 1,
      }
    );
    assert.equal(result.ok, true, result.error);
    assert.equal(result.cloudWriteCount, 1);
    assert.equal(
      rpcCalls.filter((name) => name === "canonical_tournament_update").length,
      1
    );
    assert.equal(rpcCalls.filter((name) => name === RESERVE_RPC).length, 0);
    assert.equal(rpcCalls.filter((name) => name === COMMIT_RPC).length, 0);
    assert.equal(
      courtScheduleFieldsMatch(result.tournament.courtSchedule, OWNER_DRAFT),
      true
    );
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, created.tournament.id).length, 0);
    assert.equal(loadBookingsForClub(CLUB_ID).length, 0);

    const f5 = await getTournamentQuery(CLUB_SCOPE, created.tournament.id, {
      tenantId: TENANT_ID,
    });
    assert.equal(f5.ok, true, f5.error);
    const hydrated = hydrateCourtScheduleDraft(f5.tournament.courtSchedule, "2099-01-01");
    assert.equal(hydrated.date, "2026-08-14");
    assert.equal(hydrated.startTime, "13:00");
    assert.equal(hydrated.endTime, "17:00");
    assert.deepEqual(new Set(hydrated.courtIds.map(String)), new Set(OWNER_DRAFT.courtIds));

    const stale = await setTournamentCourtScheduleCommand(
      CLUB_SCOPE,
      created.tournament.id,
      { ...OWNER_DRAFT, startTime: "14:00", endTime: "18:00" },
      {
        tenantId: TENANT_ID,
        courts: CANONICAL_COURTS,
        expectedVersion: created.tournament.version ?? 1,
      }
    );
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "VERSION_CONFLICT");
    const afterConflict = await getTournamentQuery(CLUB_SCOPE, created.tournament.id, {
      tenantId: TENANT_ID,
    });
    assert.equal(afterConflict.tournament.courtSchedule.startTime, "13:00");
    assert.equal(afterConflict.tournament.courtSchedule.endTime, "17:00");
  });

  it("I–L. group schedule uses existing match IDs, 6 matches, one CAS write, F5 durable", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      name: "Official Open TT412",
      createdBy: "owner-1",
    });
    assert.equal(created.ok, true, created.error);
    const grouped = groupedEventsFor(created.tournament.id);
    const withDraw = await updateTournamentCommand(
      CLUB_SCOPE,
      created.tournament.id,
      { events: grouped.events, settings: grouped.settings },
      { tenantId: TENANT_ID, expectedVersion: created.tournament.version ?? 1 }
    );
    assert.equal(withDraw.ok, true, withDraw.error);
    const locked = await setTournamentCourtScheduleCommand(
      CLUB_SCOPE,
      created.tournament.id,
      OWNER_DRAFT,
      {
        tenantId: TENANT_ID,
        courts: CANONICAL_COURTS,
        expectedVersion: withDraw.tournament.version,
      }
    );
    assert.equal(locked.ok, true, locked.error);

    const beforeEvent = locked.tournament.events[0];
    const beforeMatchIds = beforeEvent.matches.map((match) => String(match.id));
    const beforePairIds = listOfficialDrawEntries(beforeEvent).map((pair) => String(pair.id));
    const beforeMatchups = beforeEvent.matches.map((match) => ({
      id: String(match.id),
      groupId: String(match.groupId || ""),
      entryAId: String(match.entryAId || ""),
      entryBId: String(match.entryBId || ""),
    }));
    assert.equal(beforeMatchIds.length, 6);
    assert.deepEqual(beforePairIds, grouped.pairIds);

    rpcCalls.length = 0;
    const scheduled = scheduleOfficialGroupMatches(locked.tournament, {
      eventId: beforeEvent.id,
      clubId: CLUB_ID,
      courts: CANONICAL_COURTS,
      courtIds: OWNER_DRAFT.courtIds,
      date: OWNER_DRAFT.date,
      startTime: OWNER_DRAFT.startTime,
      endTime: OWNER_DRAFT.endTime,
      players: grouped.players,
    }, { generateSchedule });
    assert.equal(scheduled.ok, true, scheduled.error);
    assert.equal(scheduled.matches.length, 6);
    assert.deepEqual(
      scheduled.matches.map((match) => String(match.id)),
      beforeMatchIds
    );
    assert.deepEqual(
      scheduled.matches.map((match) => ({
        id: String(match.id),
        groupId: String(match.groupId || ""),
        entryAId: String(match.entryAId || ""),
        entryBId: String(match.entryBId || ""),
      })),
      beforeMatchups
    );
    assert.deepEqual(
      listOfficialDrawEntries(scheduled.events[0]).map((pair) => String(pair.id)),
      beforePairIds
    );
    scheduled.matches.forEach((match) => {
      assert.ok(match.scheduledStart, match.id);
      assert.ok(match.courtId, match.id);
    });

    const persisted = await updateTournamentCommand(
      CLUB_SCOPE,
      created.tournament.id,
      { events: scheduled.events },
      { tenantId: TENANT_ID, expectedVersion: locked.tournament.version }
    );
    assert.equal(persisted.ok, true, persisted.error);
    assert.equal(
      rpcCalls.filter((name) => name === "canonical_tournament_update").length,
      1
    );
    assert.equal(rpcCalls.filter((name) => name === RESERVE_RPC).length, 0);
    assert.equal(rpcCalls.filter((name) => name === COMMIT_RPC).length, 0);
    assert.equal(getActiveTournamentCourtBookings(CLUB_ID, created.tournament.id).length, 0);

    const f5 = await getTournamentQuery(CLUB_SCOPE, created.tournament.id, {
      tenantId: TENANT_ID,
    });
    assert.equal(f5.ok, true, f5.error);
    const f5Matches = (f5.tournament.events[0].matches || []).filter(
      (match) => !match.bracketMatchId
    );
    assert.equal(f5Matches.length, 6);
    assert.deepEqual(
      f5Matches.map((match) => String(match.id)),
      beforeMatchIds
    );
    f5Matches.forEach((match) => {
      assert.ok(match.scheduledStart, match.id);
      assert.ok(match.courtId, match.id);
    });
    assert.deepEqual(
      listOfficialDrawEntries(f5.tournament.events[0]).map((pair) => String(pair.id)),
      beforePairIds
    );
  });

  it("M. no newly skipped tests in Official assignment fallback sources", () => {
    const files = [
      "tests/official-open-canonical-court-assignment-fallback-01.test.js",
      "src/features/tournament/services/tournamentCommands.js",
      "src/pages/tournament/OfficialTournamentSetup.jsx",
      "src/components/tournament/TournamentCourtSchedulePanel.jsx",
      "src/components/tournament/official/OfficialTournamentGroupStageScreen.jsx",
      "src/features/individual-tournament/engines/officialGroupScheduleEngine.js",
    ];
    files.forEach((file) => {
      const text = src(file);
      assert.doesNotMatch(text, /\bit\.skip\s*\(/);
      assert.doesNotMatch(text, /\bdescribe\.skip\s*\(/);
      assert.doesNotMatch(text, /\bxit\s*\(/);
    });
  });
});
