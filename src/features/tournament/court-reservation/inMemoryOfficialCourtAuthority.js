/**
 * In-memory Official court reservation authority — mirrors SQL RPCs for tests.
 */

import { canonicalRowToTournament } from "../mappers/canonicalTournamentMapper.js";
import {
  OFFICIAL_COURT_CODE,
  OFFICIAL_COURT_MESSAGES,
  OFFICIAL_COURT_RPC,
} from "./officialCourtReservationCodes.js";
import {
  applyCommitOfficialGroupSchedule,
  applyReserveOfficialCourts,
} from "./officialCourtReservationDomain.js";

function deny(code, extra = {}) {
  return {
    ok: false,
    code,
    error: extra.error || OFFICIAL_COURT_MESSAGES[code] || code,
    tournament: null,
    ...extra,
  };
}

export function createInMemoryOfficialCourtAuthority(seed = {}) {
  const tournaments =
    seed.rows instanceof Map ? seed.rows : new Map(Object.entries(seed.tournaments || {}));
  const clubCourts = new Map(Object.entries(seed.clubCourts || {}));
  const blobBookingsByClub = new Map(Object.entries(seed.blobBookingsByClub || {}));
  let reservations = [...(seed.reservations || [])];
  let dailyLeases = [...(seed.dailyLeases || [])];
  const ledger = new Map(Object.entries(seed.ledger || {}));

  const actor = {
    tenantId: seed.tenantId || "tenant-a",
    authenticated: seed.authenticated !== false,
    isSuperAdmin: Boolean(seed.isSuperAdmin),
    permissions: new Set(
      seed.permissions || ["tournament.view", "tournament.update", "tournament.create"]
    ),
  };

  function snapshotState() {
    return {
      actor,
      tournaments,
      clubCourts,
      blobBookingsByClub,
      reservations,
      dailyLeases,
      ledger,
    };
  }

  function applyNext(nextState) {
    if (!nextState) return;
    reservations = nextState.reservations || reservations;
    dailyLeases = nextState.dailyLeases || dailyLeases;
    if (nextState.tournaments) {
      for (const [id, row] of nextState.tournaments.entries()) {
        tournaments.set(id, row);
      }
    }
    if (nextState.ledger) {
      for (const [key, value] of nextState.ledger.entries()) {
        ledger.set(key, value);
      }
    }
  }

  function wrapTournament(result) {
    if (!result?.ok || !result.tournament) return result;
    const row = result.tournament;
    return {
      ...result,
      tournament: canonicalRowToTournament(row) || row,
      tournamentRow: row,
    };
  }

  async function rpc(name, args = {}) {
    if (actor.authenticated === false) {
      return deny(OFFICIAL_COURT_CODE.NOT_AUTHENTICATED);
    }

    if (name === OFFICIAL_COURT_RPC.RESERVE_COURTS) {
      const applied = applyReserveOfficialCourts(snapshotState(), {
        tenantId: args.p_tenant_id,
        clubId: args.p_club_id,
        tournamentId: args.p_tournament_id,
        courtIds: Array.isArray(args.p_court_ids)
          ? args.p_court_ids
          : args.p_court_ids?.ids || [],
        date: args.p_date,
        startTime: args.p_start_time,
        endTime: args.p_end_time,
        timezone: args.p_timezone,
        expectedVersion: args.p_expected_version,
        idempotencyKey: args.p_idempotency_key,
        now: seed.now,
      });
      if (!applied.ok) return applied;
      if (applied.nextState) applyNext(applied.nextState);
      return wrapTournament(applied.result || applied);
    }

    if (name === OFFICIAL_COURT_RPC.COMMIT_GROUP_SCHEDULE) {
      const applied = applyCommitOfficialGroupSchedule(snapshotState(), {
        tenantId: args.p_tenant_id,
        clubId: args.p_club_id,
        tournamentId: args.p_tournament_id,
        eventId: args.p_event_id,
        matches: args.p_matches || [],
        expectedVersion: args.p_expected_version,
        idempotencyKey: args.p_idempotency_key,
        now: seed.now,
      });
      if (!applied.ok) return applied;
      if (applied.nextState) applyNext(applied.nextState);
      return wrapTournament(applied.result || applied);
    }

    return deny(OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE, {
      error: `unknown rpc ${name}`,
    });
  }

  return {
    rpc,
    rows: tournaments,
    reservations: () => reservations,
    dailyLeases: () => dailyLeases,
    setActor(next) {
      Object.assign(actor, next);
      if (Array.isArray(next.permissions)) {
        actor.permissions = new Set(next.permissions);
      }
    },
    __setClubCourts(clubId, courts) {
      clubCourts.set(String(clubId), courts || []);
    },
    __setBlobBookings(clubId, bookings) {
      blobBookingsByClub.set(String(clubId), bookings || []);
    },
    __setDailyLeases(leases) {
      dailyLeases = [...(leases || [])];
    },
    __setReservations(rows) {
      reservations = [...(rows || [])];
    },
  };
}
