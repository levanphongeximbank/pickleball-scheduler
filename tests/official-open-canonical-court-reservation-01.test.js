/**
 * Official Open — canonical court reservation cutover 01.
 * In-memory authority + SQL source contracts. Does not apply SQL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertCourtAvailable,
  classifyClubBlobBooking,
  COURT_TIME_RANGE_SEMANTICS,
  DAILY_VS_FUTURE_RESERVATION_POLICY,
  MALFORMED_ACTIVE_BOOKING_POLICY,
  rangesOverlapHalfOpen,
} from "../src/features/court-occupancy/courtAvailabilityDomain.js";
import {
  applyCommitOfficialGroupSchedule,
  applyReserveOfficialCourts,
} from "../src/features/tournament/court-reservation/officialCourtReservationDomain.js";
import { createInMemoryOfficialCourtAuthority } from "../src/features/tournament/court-reservation/inMemoryOfficialCourtAuthority.js";
import { createInMemoryDailyPlayAuthority } from "../src/features/daily-play/canonical/inMemoryDailyPlayAuthority.js";
import {
  OFFICIAL_COURT_CODE,
  OFFICIAL_COURT_RPC,
} from "../src/features/tournament/court-reservation/officialCourtReservationCodes.js";
import { DAILY_PLAY_RPC } from "../src/features/daily-play/canonical/dailyPlayCodes.js";
import { createInMemoryCanonicalTournamentRpc } from "../src/features/tournament/repositories/inMemoryCanonicalTournamentRpc.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sqlDir = path.join(
  root,
  "docs/v5/migrations/official-open-canonical-court-reservation-01"
);

function src(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function sql(name) {
  return readFileSync(path.join(sqlDir, name), "utf8");
}

const TENANT = "tenant-a";
const CLUB = "club-ecebf64c78f948ccb2b59842441eb26c";
const TZ = "Asia/Ho_Chi_Minh";
const COURTS = [
  { id: "tt412-court-01", name: "TT412 Sân 1", active: true, clubId: CLUB },
  { id: "tt412-court-02", name: "TT412 Sân 2", active: true, clubId: CLUB },
];

function officialRow(id, extra = {}) {
  return {
    id,
    tenant_id: TENANT,
    club_id: CLUB,
    name: "Official Open TT412",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    status: "draft",
    version: 1,
    payload: {
      id,
      events: extra.events || [],
      courtSchedule: extra.courtSchedule || null,
    },
    ...extra,
  };
}

function emptyState(row, extras = {}) {
  return {
    actor: {
      authenticated: true,
      tenantId: TENANT,
      permissions: new Set(["tournament.update"]),
    },
    tournaments: new Map([[row.id, row]]),
    clubCourts: new Map([[CLUB, COURTS]]),
    blobBookingsByClub: new Map([[CLUB, extras.blobBookings || []]]),
    reservations: extras.reservations || [],
    dailyLeases: extras.dailyLeases || [],
    ledger: new Map(),
  };
}

function reserveInput(tournamentId, extra = {}) {
  return {
    tenantId: TENANT,
    clubId: CLUB,
    tournamentId,
    courtIds: extra.courtIds || ["tt412-court-01"],
    date: extra.date || "2026-08-14",
    startTime: extra.startTime || "10:00",
    endTime: extra.endTime || "11:00",
    timezone: TZ,
    expectedVersion: extra.expectedVersion ?? 1,
    idempotencyKey: extra.idempotencyKey || "key-a",
    now: extra.now || "2026-08-14T00:00:00.000Z",
  };
}

describe("official-open-canonical-court-reservation-01", () => {
  it("SQL package exists and does not replay Daily #424", () => {
    const apply = sql("02_APPLY_SCHEMA.sql");
    const precheck = sql("01_PRECHECK.sql");
    const verify = sql("03_VERIFY_SCHEMA.sql");
    const rollback = sql("07_ROLLBACK.sql");
    const backfill = sql("05_BACKFILL.sql");
    assert.match(precheck, /READ-ONLY|read-only/i);
    assert.match(precheck, /daily_play_court_leases/);
    assert.match(precheck, /btree_gist is not installed/);
    assert.doesNotMatch(apply, /CREATE EXTENSION IF NOT EXISTS btree_gist/);
    assert.doesNotMatch(apply, /CREATE TABLE public\.daily_play_court_leases/);
    assert.match(apply, /CREATE TABLE IF NOT EXISTS public\.court_reservations/);
    assert.match(apply, /tstzrange\(starts_at, ends_at, '\[\)'\)/);
    assert.match(apply, /official_tournament_reserve_courts/);
    assert.match(apply, /official_tournament_commit_group_schedule/);
    assert.match(apply, /court_assert_available/);
    assert.match(apply, /p_expected_version/);
    assert.match(apply, /FOR UPDATE/);
    assert.match(apply, /Do NOT filter venue_id/);
    assert.match(apply, /daily_play_assign_court/);
    assert.match(apply, /daily_play_session_write_denied/);
    assert.match(apply, /SECURITY DEFINER SET search_path = public/);
    assert.match(apply, /REVOKE ALL ON public\.court_reservations FROM PUBLIC, anon, authenticated/);
    assert.match(apply, /version = t\.version \+ 1/);
    assert.match(backfill, /origin.*package_backfill|package_backfill/);
    assert.match(backfill, /NOT EXISTS/);
    assert.match(verify, /anon can execute/);
    assert.match(rollback, /ROLLBACK_UNSAFE/);
    assert.match(rollback, /CREATE OR REPLACE FUNCTION public\.daily_play_assign_court/);
    assert.match(rollback, /CREATE OR REPLACE FUNCTION public\.daily_play_change_court/);
    assert.equal(COURT_TIME_RANGE_SEMANTICS, "[)");
    assert.match(DAILY_VS_FUTURE_RESERVATION_POLICY, /OPEN_ENDED/);
  });

  it("A–B. one court and multiple courts reserve", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    let state = emptyState(officialRow(id));
    const one = applyReserveOfficialCourts(state, reserveInput(id, { idempotencyKey: "a1" }));
    assert.equal(one.ok, true, one.error);
    assert.equal(one.result.reservationCount, 1);
    const two = applyReserveOfficialCourts(one.nextState, reserveInput(id, {
      courtIds: ["tt412-court-01", "tt412-court-02"],
      expectedVersion: 2,
      idempotencyKey: "a2",
    }));
    assert.equal(two.ok, true, two.error);
    assert.equal(two.result.reservationCount, 2);
    assert.equal(two.result.tournament.payload.courtSchedule.courtIds.length, 2);
  });

  it("C–D. adjacent ranges allowed; overlap blocked", () => {
    assert.equal(
      rangesOverlapHalfOpen(
        "2026-08-14T03:00:00.000Z",
        "2026-08-14T04:00:00.000Z",
        "2026-08-14T04:00:00.000Z",
        "2026-08-14T05:00:00.000Z"
      ),
      false
    );
    assert.equal(
      rangesOverlapHalfOpen(
        "2026-08-14T03:00:00.000Z",
        "2026-08-14T04:00:00.000Z",
        "2026-08-14T03:59:00.000Z",
        "2026-08-14T05:00:00.000Z"
      ),
      true
    );
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    let state = emptyState(officialRow(a));
    state.tournaments.set(b, officialRow(b));
    const first = applyReserveOfficialCourts(
      state,
      reserveInput(a, { startTime: "10:00", endTime: "11:00", idempotencyKey: "c1" })
    );
    assert.equal(first.ok, true, first.error);
    const adjacent = applyReserveOfficialCourts(
      first.nextState,
      reserveInput(b, { startTime: "11:00", endTime: "12:00", idempotencyKey: "c2" })
    );
    assert.equal(adjacent.ok, true, adjacent.error);
    const overlap = applyReserveOfficialCourts(
      first.nextState,
      reserveInput(b, { startTime: "10:30", endTime: "12:00", idempotencyKey: "c3" })
    );
    assert.equal(overlap.ok, false);
    assert.equal(overlap.code, OFFICIAL_COURT_CODE.COURT_OCCUPIED);
  });

  it("E–G. wrong tenant, wrong club, foreign court", () => {
    const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const state = emptyState(officialRow(id));
    const tenant = applyReserveOfficialCourts(state, {
      ...reserveInput(id),
      tenantId: "other-tenant",
    });
    assert.equal(tenant.ok, false);
    assert.equal(tenant.code, OFFICIAL_COURT_CODE.TENANT_FORBIDDEN);
    const club = applyReserveOfficialCourts(state, {
      ...reserveInput(id),
      clubId: "club-other",
    });
    assert.equal(club.ok, false);
    assert.equal(club.code, OFFICIAL_COURT_CODE.TOURNAMENT_NOT_FOUND);
    const foreign = applyReserveOfficialCourts(
      state,
      reserveInput(id, { courtIds: ["not-a-club-court"] })
    );
    assert.equal(foreign.ok, false);
    assert.equal(foreign.code, OFFICIAL_COURT_CODE.COURT_NOT_FOUND);
  });

  it("H–J. version conflict, same-key replay, same-key different request", () => {
    const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const state = emptyState(officialRow(id));
    const conflict = applyReserveOfficialCourts(
      state,
      reserveInput(id, { expectedVersion: 9 })
    );
    assert.equal(conflict.code, OFFICIAL_COURT_CODE.VERSION_CONFLICT);
    const first = applyReserveOfficialCourts(state, reserveInput(id, { idempotencyKey: "same" }));
    assert.equal(first.ok, true, first.error);
    const replay = applyReserveOfficialCourts(
      first.nextState,
      reserveInput(id, { idempotencyKey: "same" })
    );
    assert.equal(replay.ok, true);
    assert.equal(replay.replay, true);
    const different = applyReserveOfficialCourts(
      first.nextState,
      reserveInput(id, { idempotencyKey: "same", startTime: "12:00", endTime: "13:00" })
    );
    assert.equal(different.code, OFFICIAL_COURT_CODE.IDEMPOTENCY_CONFLICT);
  });

  it("K–L. second tournament overlap blocked; validation error does not persist", () => {
    const a = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const b = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    let state = emptyState(officialRow(a));
    state.tournaments.set(b, officialRow(b));
    const first = applyReserveOfficialCourts(state, reserveInput(a));
    assert.equal(first.ok, true);
    const second = applyReserveOfficialCourts(first.nextState, reserveInput(b, { idempotencyKey: "k2" }));
    assert.equal(second.code, OFFICIAL_COURT_CODE.COURT_OCCUPIED);
    const invalid = applyReserveOfficialCourts(state, reserveInput(a, { endTime: "09:00" }));
    assert.equal(invalid.ok, false);
    assert.equal((state.reservations || []).length, 0);
  });

  it("M. active Daily lease blocks Official", () => {
    const id = "12121212-1212-4121-8121-121212121212";
    const state = emptyState(officialRow(id), {
      dailyLeases: [
        {
          tenantId: TENANT,
          clubId: CLUB,
          courtId: "tt412-court-01",
          status: "active",
          leasedAt: "2026-08-14T02:00:00.000Z",
        },
      ],
    });
    const result = applyReserveOfficialCourts(state, reserveInput(id));
    assert.equal(result.code, OFFICIAL_COURT_CODE.COURT_OCCUPIED);
  });

  it("N–O. Official reservation blocks Daily lease; release permits later lock", async () => {
    const daily = createInMemoryDailyPlayAuthority({
      tenantId: TENANT,
      clubCourts: { [CLUB]: COURTS },
      calendarReservations: [
        {
          tenantId: TENANT,
          clubId: CLUB,
          courtId: "tt412-court-01",
          status: "active",
          startsAt: "2026-08-20T03:00:00.000Z",
          endsAt: "2026-08-20T08:00:00.000Z",
        },
      ],
    });
    daily.__seedTournament({
      id: "daily-1",
      tenant_id: TENANT,
      club_id: CLUB,
      payload: {
        settings: {
          dailyPlay: {
            revision: 1,
            matchType: "open_double",
            checkedInPlayerIds: ["p1", "p2", "p3", "p4"],
            matches: [
              {
                id: "m1",
                status: "waiting",
                teamAPlayerIds: ["p1", "p2"],
                teamBPlayerIds: ["p3", "p4"],
              },
            ],
          },
        },
      },
    });
    daily.__setEligibleAthletes(TENANT, CLUB, ["p1", "p2", "p3", "p4"]);
    const blocked = await daily.rpc(DAILY_PLAY_RPC.ASSIGN_COURT, {
      p_tenant_id: TENANT,
      p_club_id: CLUB,
      p_tournament_id: "daily-1",
      p_match_id: "m1",
      p_court_id: "tt412-court-01",
      p_expected_version: 1,
      p_idempotency_key: "d1",
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "COURT_OCCUPIED");

    const id = "13131313-1313-4131-8131-131313131313";
    const withLease = emptyState(officialRow(id), {
      dailyLeases: [
        {
          tenantId: TENANT,
          clubId: CLUB,
          courtId: "tt412-court-01",
          status: "released",
          leasedAt: "2026-08-14T02:00:00.000Z",
        },
      ],
    });
    const afterRelease = applyReserveOfficialCourts(withLease, reserveInput(id));
    assert.equal(afterRelease.ok, true, afterRelease.error);
  });

  it("Q–R. normal/maintenance blob bookings block Official; no dual Official writer", () => {
    const id = "14141414-1414-4141-8141-141414141414";
    const maintenance = emptyState(officialRow(id), {
      blobBookings: [
        {
          courtId: "tt412-court-01",
          date: "2026-08-14",
          startTime: "10:00",
          endTime: "11:00",
          bookingType: "maintenance",
          status: "confirmed",
        },
      ],
    });
    const blocked = applyReserveOfficialCourts(maintenance, reserveInput(id));
    assert.equal(blocked.code, OFFICIAL_COURT_CODE.COURT_OCCUPIED);
    const classified = classifyClubBlobBooking({
      bookingType: "maintenance",
      courtId: "tt412-court-01",
      date: "2026-08-14",
      startTime: "10:00",
      endTime: "11:00",
    });
    assert.equal(classified.action, "READ_COMPAT_ONLY");
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const officialStart = command.indexOf(
      "loaded.tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT"
    );
    const officialBranch = command.slice(officialStart, officialStart + 900);
    assert.match(officialBranch, /reserveOfficialTournamentCourtsCommand/);
    assert.doesNotMatch(officialBranch, /syncClubToCloud/);
    assert.doesNotMatch(officialBranch, /compensateOfficialCourtLock/);
  });

  it("S–X. group schedule requires reservation, existing ids, window, court/pair conflicts", () => {
    const id = "15151515-1515-4151-8151-151515151515";
    const matches = [
      {
        id: "m1",
        entryAId: "pair-a",
        entryBId: "pair-b",
        scheduledStart: "2026-08-14T03:00:00.000Z",
        scheduledEnd: "2026-08-14T03:30:00.000Z",
        courtId: "tt412-court-01",
      },
      {
        id: "m2",
        entryAId: "pair-a",
        entryBId: "pair-d",
        scheduledStart: "2026-08-14T03:30:00.000Z",
        scheduledEnd: "2026-08-14T04:00:00.000Z",
        courtId: "tt412-court-02",
      },
    ];
    const row = officialRow(id, {
      events: [{ id: "ev1", matches }],
    });
    const reserved = applyReserveOfficialCourts(
      emptyState(row),
      reserveInput(id, {
        courtIds: ["tt412-court-01", "tt412-court-02"],
        startTime: "10:00",
        endTime: "17:00",
        idempotencyKey: "gs1",
      })
    );
    assert.equal(reserved.ok, true, reserved.error);
    const missing = applyCommitOfficialGroupSchedule(emptyState(row), {
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: id,
      eventId: "ev1",
      matches,
      expectedVersion: 1,
      idempotencyKey: "gs0",
    });
    assert.equal(missing.code, OFFICIAL_COURT_CODE.SCHEDULE_RESERVATION_REQUIRED);

    const ok = applyCommitOfficialGroupSchedule(reserved.nextState, {
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: id,
      eventId: "ev1",
      matches,
      expectedVersion: 2,
      idempotencyKey: "gs2",
    });
    assert.equal(ok.ok, true, ok.error);

    const unknown = applyCommitOfficialGroupSchedule(reserved.nextState, {
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: id,
      eventId: "ev1",
      matches: [...matches, { id: "m-new", courtId: "tt412-court-01", scheduledStart: matches[0].scheduledStart }],
      expectedVersion: 2,
      idempotencyKey: "gs3",
    });
    assert.equal(unknown.code, OFFICIAL_COURT_CODE.SCHEDULE_MATCH_UNKNOWN);

    const outsideCourt = applyCommitOfficialGroupSchedule(reserved.nextState, {
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: id,
      eventId: "ev1",
      matches: matches.map((match, index) =>
        index === 0 ? { ...match, courtId: "foreign-court" } : match
      ),
      expectedVersion: 2,
      idempotencyKey: "gs4",
    });
    assert.equal(outsideCourt.code, OFFICIAL_COURT_CODE.SCHEDULE_COURT_OUTSIDE_RESERVATION);

    const courtConflict = applyCommitOfficialGroupSchedule(reserved.nextState, {
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: id,
      eventId: "ev1",
      matches: [
        matches[0],
        {
          ...matches[1],
          courtId: "tt412-court-01",
          scheduledStart: matches[0].scheduledStart,
          scheduledEnd: matches[0].scheduledEnd,
        },
      ],
      expectedVersion: 2,
      idempotencyKey: "gs5",
    });
    assert.equal(courtConflict.code, OFFICIAL_COURT_CODE.SCHEDULE_COURT_CONFLICT);

    const pairConflict = applyCommitOfficialGroupSchedule(reserved.nextState, {
      tenantId: TENANT,
      clubId: CLUB,
      tournamentId: id,
      eventId: "ev1",
      matches: [
        matches[0],
        {
          ...matches[1],
          scheduledStart: matches[0].scheduledStart,
          scheduledEnd: matches[0].scheduledEnd,
        },
      ],
      expectedVersion: 2,
      idempotencyKey: "gs6",
    });
    assert.equal(pairConflict.code, OFFICIAL_COURT_CODE.SCHEDULE_PAIR_CONFLICT);
  });

  it("Y. F5 canonical roundtrip keeps courtSchedule", () => {
    const id = "16161616-1616-4161-8161-161616161616";
    const reserved = applyReserveOfficialCourts(
      emptyState(officialRow(id)),
      reserveInput(id, { courtIds: ["tt412-court-01", "tt412-court-02"], startTime: "13:00", endTime: "17:00" })
    );
    assert.equal(reserved.ok, true, reserved.error);
    const schedule = reserved.result.tournament.payload.courtSchedule;
    assert.equal(schedule.date, "2026-08-14");
    assert.equal(schedule.startTime, "13:00");
    assert.equal(schedule.endTime, "17:00");
    assert.deepEqual(schedule.courtIds, ["tt412-court-01", "tt412-court-02"]);
  });

  it("Z–AB. anon / cross-tenant / cross-club denied by in-memory authority", async () => {
    const id = "17171717-1717-4171-8171-171717171717";
    const anon = createInMemoryOfficialCourtAuthority({
      authenticated: false,
      tenantId: TENANT,
      tournaments: { [id]: officialRow(id) },
      clubCourts: { [CLUB]: COURTS },
    });
    const anonResult = await anon.rpc(OFFICIAL_COURT_RPC.RESERVE_COURTS, {
      p_tenant_id: TENANT,
      p_club_id: CLUB,
      p_tournament_id: id,
      p_court_ids: ["tt412-court-01"],
      p_date: "2026-08-14",
      p_start_time: "13:00",
      p_end_time: "17:00",
      p_timezone: TZ,
      p_expected_version: 1,
      p_idempotency_key: "z1",
    });
    assert.equal(anonResult.code, OFFICIAL_COURT_CODE.NOT_AUTHENTICATED);

    const auth = createInMemoryOfficialCourtAuthority({
      tenantId: TENANT,
      tournaments: { [id]: officialRow(id) },
      clubCourts: { [CLUB]: COURTS },
    });
    const crossTenant = await auth.rpc(OFFICIAL_COURT_RPC.RESERVE_COURTS, {
      p_tenant_id: "other-tenant",
      p_club_id: CLUB,
      p_tournament_id: id,
      p_court_ids: ["tt412-court-01"],
      p_date: "2026-08-14",
      p_start_time: "13:00",
      p_end_time: "17:00",
      p_timezone: TZ,
      p_expected_version: 1,
      p_idempotency_key: "z2",
    });
    assert.equal(crossTenant.code, OFFICIAL_COURT_CODE.TENANT_FORBIDDEN);
    const crossClub = await auth.rpc(OFFICIAL_COURT_RPC.RESERVE_COURTS, {
      p_tenant_id: TENANT,
      p_club_id: "club-other",
      p_tournament_id: id,
      p_court_ids: ["tt412-court-01"],
      p_date: "2026-08-14",
      p_start_time: "13:00",
      p_end_time: "17:00",
      p_timezone: TZ,
      p_expected_version: 1,
      p_idempotency_key: "z3",
    });
    assert.equal(crossClub.code, OFFICIAL_COURT_CODE.TOURNAMENT_NOT_FOUND);
  });

  it("Official client hard-cutover source contracts", () => {
    const command = src("src/features/tournament/services/tournamentCommands.js");
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    const inventory = src(
      "src/features/tournament/court-reservation/../services/tournamentCommands.js"
    );
    assert.match(command, /reserveOfficialTournamentCourtsCommand/);
    assert.match(setup, /commitOfficialGroupScheduleCommand/);
    assert.match(setup, /Hãy khóa sân trên lịch booking trước khi xếp lịch vòng bảng/);
    assert.doesNotMatch(
      src("src/features/tournament/guards/tournamentCourtInventoryScope.js"),
      /\.eq\(["']venue_id["'],\s*tenantId\)/
    );
    const apply = sql("02_APPLY_SCHEMA.sql");
    assert.doesNotMatch(apply, /\.eq\("venue_id"/);
    assert.match(apply, /official_tournament_inventory_courts/);
    void inventory;
  });

  it("shared availability is the single conflict authority", () => {
    const available = assertCourtAvailable({
      tenantId: TENANT,
      clubId: CLUB,
      courtId: "tt412-court-01",
      startsAt: "2026-08-14T03:00:00.000Z",
      endsAt: "2026-08-14T04:00:00.000Z",
      reservations: [],
      dailyLeases: [],
      blobBookings: [],
    });
    assert.equal(available.ok, true);
  });

  it("A–C. generic canonical update increments version; stale reserve conflicts", async () => {
    const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const memory = createInMemoryCanonicalTournamentRpc({
      tenantId: TENANT,
    });
    memory.rows.set(id, officialRow(id));
    const updated = await memory.rpc("canonical_tournament_update", {
      p_tenant_id: TENANT,
      p_club_id: CLUB,
      p_tournament_id: id,
      p_patch: { name: "Renamed Official" },
    });
    assert.equal(updated.ok, true, updated.error);
    assert.equal(updated.tournament.version, 2);
    assert.equal(updated.tournament.name, "Renamed Official");
    const stale = await memory.rpc("canonical_tournament_update", {
      p_tenant_id: TENANT,
      p_club_id: CLUB,
      p_tournament_id: id,
      p_patch: { name: "Should fail" },
      p_expected_version: 1,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, "VERSION_CONFLICT");
    assert.equal(memory.rows.get(id).version, 2);

    const state = emptyState(memory.rows.get(id));
    state.tournaments = memory.rows;
    const reserve = applyReserveOfficialCourts(state, reserveInput(id, { expectedVersion: 1 }));
    assert.equal(reserve.ok, false);
    assert.equal(reserve.code, OFFICIAL_COURT_CODE.VERSION_CONFLICT);
    assert.equal(memory.rows.get(id).payload.courtSchedule, null);
  });

  it("D. Daily assign/change rollback definitions match pre-apply #424 contract", () => {
    const dailyApply = src(
      "docs/v5/migrations/daily-play-canonical-session-close-final-lifecycle-01/02_APPLY.sql"
    );
    const rollback = sql("07_ROLLBACK.sql");
    const restoreAssign = sql("_restore_daily_play_assign_court.sql");
    const restoreChange = sql("_restore_daily_play_change_court.sql");
    assert.equal(dailyApply.includes(restoreAssign.trim()), true);
    assert.equal(dailyApply.includes(restoreChange.trim()), true);
    assert.equal(rollback.includes(restoreAssign.trim()), true);
    assert.equal(rollback.includes(restoreChange.trim()), true);
    assert.doesNotMatch(restoreAssign, /court_assert_available/);
    assert.doesNotMatch(restoreChange, /court_assert_available/);
    assert.match(sql("02_APPLY_SCHEMA.sql"), /court_assert_available/);
  });

  it("E–G. rollback and backfill package contracts", () => {
    const rollback = sql("07_ROLLBACK.sql");
    const backfill = sql("05_BACKFILL.sql");
    const schema = sql("02_APPLY_SCHEMA.sql");
    assert.match(rollback, /origin = 'runtime'/);
    assert.match(rollback, /origin = 'package_backfill'/);
    assert.match(rollback, /DELETE FROM public\.court_reservations/);
    assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.court_reservations/);
    assert.doesNotMatch(schema, /backfill-official:/);
    assert.match(backfill, /package_backfill/);
    assert.match(backfill, /backfill-official:/);
    assert.match(backfill, /NOT EXISTS/);
    assert.match(schema, /court_reservations_idempotency_uidx/);
    assert.match(sql("02_APPLY.sql"), /DO_NOT_APPLY/);
    assert.match(sql("04_ROLLBACK.sql"), /Use 07_ROLLBACK/);
  });

  it("H–I. malformed active booking fails closed; cancelled does not block", () => {
    assert.equal(MALFORMED_ACTIVE_BOOKING_POLICY, "FAIL_CLOSED");
    const malformed = assertCourtAvailable({
      tenantId: TENANT,
      clubId: CLUB,
      courtId: "tt412-court-01",
      startsAt: "2026-08-14T06:00:00.000Z",
      endsAt: "2026-08-14T07:00:00.000Z",
      timezone: TZ,
      blobBookings: [
        {
          courtId: "tt412-court-01",
          bookingType: "single",
          bookingStatus: "confirmed",
          date: "2026-08-14",
        },
      ],
    });
    assert.equal(malformed.ok, false);
    assert.equal(malformed.code, "COURT_OCCUPIED");
    const cancelled = assertCourtAvailable({
      tenantId: TENANT,
      clubId: CLUB,
      courtId: "tt412-court-01",
      startsAt: "2026-08-14T06:00:00.000Z",
      endsAt: "2026-08-14T07:00:00.000Z",
      timezone: TZ,
      blobBookings: [
        {
          courtId: "tt412-court-01",
          bookingType: "single",
          bookingStatus: "cancelled",
          date: "not-a-date",
        },
      ],
    });
    assert.equal(cancelled.ok, true);
  });

  it("J. no newly skipped Court cutover tests", () => {
    const files = [
      "tests/official-open-tournament-phase2m-club-version-cas-retry-01.test.js",
      "tests/official-open-tournament-phase2m1-dirty-pending-push-01.test.js",
      "tests/official-open-tournament-phase2m2-dirty-root-cause-01.test.js",
      "tests/official-open-tournament-phase2m3-semantic-diff-01.test.js",
      "tests/official-open-canonical-court-reservation-01.test.js",
    ];
    for (const file of files) {
      assert.doesNotMatch(src(file), /it\.skip\(/);
    }
  });
});
