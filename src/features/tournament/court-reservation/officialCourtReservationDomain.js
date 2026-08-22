/**
 * Official court reservation + group-schedule domain.
 * Pure functions mirrored by SQL RPCs. One logical transaction per command.
 */

import {
  assertCourtAvailable,
  civilToTimestamptz,
  rangesOverlapHalfOpen,
} from "../../court-occupancy/courtAvailabilityDomain.js";
import {
  OFFICIAL_COURT_CODE,
  OFFICIAL_COURT_MESSAGES,
} from "./officialCourtReservationCodes.js";

function deny(code, extra = {}) {
  return {
    ok: false,
    code,
    error: extra.error || OFFICIAL_COURT_MESSAGES[code] || code,
    ...extra,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function fingerprintReserveRequest({ courtIds, date, startTime, endTime }) {
  return JSON.stringify({
    courtIds: [...(courtIds || [])].map(String).sort(),
    date: String(date || "").slice(0, 10),
    startTime: String(startTime || "").slice(0, 5),
    endTime: String(endTime || "").slice(0, 5),
  });
}

export function fingerprintGroupScheduleRequest(matches = []) {
  return JSON.stringify(
    [...(matches || [])]
      .map((match) => ({
        id: String(match.id || match.matchId || ""),
        courtId: String(match.courtId || ""),
        scheduledStart: String(match.scheduledStart || ""),
        scheduledEnd: String(match.scheduledEnd || ""),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

export function resolveOfficialCourtInventory(courts = []) {
  return (courts || [])
    .map((court, index) => {
      const id = String(court?.id || court?.courtId || "").trim();
      if (!id) return null;
      const active = court.active !== false;
      const status = String(court.status || "active").toLowerCase();
      if (!active || status === "locked" || status === "maintenance") {
        return { ...court, id, index, usable: false };
      }
      return { ...court, id, index, usable: true };
    })
    .filter(Boolean);
}

export function applyReserveOfficialCourts(state, input = {}) {
  const actor = state.actor || {};
  if (actor.authenticated === false) {
    return deny(OFFICIAL_COURT_CODE.NOT_AUTHENTICATED);
  }
  const tenantId = String(input.tenantId || "").trim();
  const clubId = String(input.clubId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  if (!actor.isSuperAdmin && tenantId && actor.tenantId && tenantId !== actor.tenantId) {
    return deny(OFFICIAL_COURT_CODE.TENANT_FORBIDDEN);
  }
  if (!actor.isSuperAdmin && actor.permissions instanceof Set && !actor.permissions.has("tournament.update")) {
    return deny(OFFICIAL_COURT_CODE.FORBIDDEN);
  }

  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!idempotencyKey) {
    return deny(OFFICIAL_COURT_CODE.IDEMPOTENCY_KEY_REQUIRED);
  }

  const fingerprint = fingerprintReserveRequest(input);
  const ledgerKey = `reserve_courts::${tenantId}::${tournamentId}::${idempotencyKey}`;
  const prior = state.ledger?.get(ledgerKey);
  if (prior) {
    if (prior.fingerprint === fingerprint) {
      return { ...prior.result, replay: true };
    }
    return deny(OFFICIAL_COURT_CODE.IDEMPOTENCY_CONFLICT);
  }

  const tournament = state.tournaments?.get(tournamentId);
  if (
    !tournament ||
    String(tournament.tenant_id || tournament.tenantId) !== tenantId ||
    String(tournament.club_id || tournament.clubId) !== clubId
  ) {
    return deny(OFFICIAL_COURT_CODE.TOURNAMENT_NOT_FOUND);
  }
  const mode = String(tournament.mode || "");
  if (mode !== "official_tournament") {
    return deny(OFFICIAL_COURT_CODE.TOURNAMENT_MODE_INVALID);
  }

  const actualVersion = Number(tournament.version ?? 1);
  const expected = Number(input.expectedVersion);
  if (!Number.isFinite(expected) || expected !== actualVersion) {
    return deny(OFFICIAL_COURT_CODE.VERSION_CONFLICT, {
      expectedVersion: expected,
      actualVersion,
    });
  }

  const date = String(input.date || "").slice(0, 10);
  const startTime = String(input.startTime || "").slice(0, 5);
  const endTime = String(input.endTime || "").slice(0, 5);
  const timezone = String(input.timezone || "").trim();
  const courtIds = [...new Set((input.courtIds || []).map(String).filter(Boolean))];
  if (!date || !startTime || !endTime || !timezone || courtIds.length === 0) {
    return deny(OFFICIAL_COURT_CODE.INVALID_WINDOW);
  }
  const startsAt = input.startsAt || civilToTimestamptz(date, startTime, timezone);
  const endsAt = input.endsAt || civilToTimestamptz(date, endTime, timezone);
  if (!startsAt || !endsAt || Date.parse(startsAt) >= Date.parse(endsAt)) {
    return deny(OFFICIAL_COURT_CODE.INVALID_WINDOW);
  }

  const inventory = resolveOfficialCourtInventory(state.clubCourts?.get(clubId) || []);
  const inventoryIds = new Set(inventory.map((court) => court.id));
  for (const courtId of courtIds) {
    if (!inventoryIds.has(courtId)) {
      return deny(OFFICIAL_COURT_CODE.COURT_NOT_FOUND, { courtId });
    }
    const court = inventory.find((item) => item.id === courtId);
    if (!court?.usable) {
      return deny(OFFICIAL_COURT_CODE.COURT_FORBIDDEN, { courtId });
    }
  }

  const nowMs = Date.parse(input.now || new Date().toISOString());
  const existingMine = (state.reservations || []).filter(
    (row) =>
      String(row.tournamentId) === tournamentId &&
      String(row.status || "active") === "active"
  );
  const existingStarted = existingMine.some(
    (row) => Date.parse(row.startsAt) <= nowMs
  );
  const nextFingerprint = fingerprint;
  const existingFingerprint = fingerprintReserveRequest({
    courtIds: existingMine.map((row) => row.courtId),
    date: tournament.payload?.courtSchedule?.date,
    startTime: tournament.payload?.courtSchedule?.startTime,
    endTime: tournament.payload?.courtSchedule?.endTime,
  });
  if (existingStarted && existingMine.length && existingFingerprint !== nextFingerprint) {
    return deny(OFFICIAL_COURT_CODE.RESERVATION_ALREADY_STARTED);
  }

  for (const courtId of courtIds) {
    const available = assertCourtAvailable({
      tenantId,
      clubId,
      courtId,
      startsAt,
      endsAt,
      ignoreTournamentId: tournamentId,
      liveUnbounded: false,
      reservations: state.reservations || [],
      dailyLeases: state.dailyLeases || [],
      blobBookings: state.blobBookingsByClub?.get(clubId) || [],
      timezone,
    });
    if (!available.ok) {
      return deny(available.code, available);
    }
  }

  const kept = (state.reservations || []).filter(
    (row) =>
      !(
        String(row.tournamentId) === tournamentId &&
        String(row.status || "active") === "active"
      )
  );
  const createdAt = new Date(input.now || Date.now()).toISOString();
  const nextReservations = [
    ...kept,
    ...courtIds.map((courtId) => ({
      id: `res-${tournamentId}-${courtId}`,
      tenantId,
      clubId,
      courtId,
      source: "official_tournament",
      ownerId: tournamentId,
      tournamentId,
      startsAt,
      endsAt,
      status: "active",
      idempotencyKey,
      createdAt,
      updatedAt: createdAt,
      cancelledAt: null,
    })),
  ];

  const payload = cloneJson(tournament.payload || {});
  payload.courtSchedule = {
    date,
    startTime,
    endTime,
    courtIds,
    syncedAt: createdAt,
    timezone,
  };
  payload.id = tournament.id;

  const nextTournament = {
    ...tournament,
    version: actualVersion + 1,
    payload,
    updated_at: createdAt,
  };

  const result = {
    ok: true,
    tournament: nextTournament,
    version: nextTournament.version,
    courtSchedule: payload.courtSchedule,
    reservationCount: courtIds.length,
  };

  return {
    ok: true,
    result,
    nextState: {
      ...state,
      tournaments: new Map(state.tournaments).set(tournamentId, nextTournament),
      reservations: nextReservations,
      ledger: new Map(state.ledger).set(ledgerKey, { fingerprint, result }),
    },
  };
}

function groupMatches(event) {
  return (event?.matches || []).filter((match) => !match.bracketMatchId);
}

export function applyCommitOfficialGroupSchedule(state, input = {}) {
  const actor = state.actor || {};
  if (actor.authenticated === false) {
    return deny(OFFICIAL_COURT_CODE.NOT_AUTHENTICATED);
  }
  const tenantId = String(input.tenantId || "").trim();
  const clubId = String(input.clubId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  if (!actor.isSuperAdmin && tenantId && actor.tenantId && tenantId !== actor.tenantId) {
    return deny(OFFICIAL_COURT_CODE.TENANT_FORBIDDEN);
  }
  if (!actor.isSuperAdmin && actor.permissions instanceof Set && !actor.permissions.has("tournament.update")) {
    return deny(OFFICIAL_COURT_CODE.FORBIDDEN);
  }

  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!idempotencyKey) {
    return deny(OFFICIAL_COURT_CODE.IDEMPOTENCY_KEY_REQUIRED);
  }
  const proposed = Array.isArray(input.matches) ? input.matches : [];
  const fingerprint = fingerprintGroupScheduleRequest(proposed);
  const ledgerKey = `commit_group_schedule::${tenantId}::${tournamentId}::${idempotencyKey}`;
  const prior = state.ledger?.get(ledgerKey);
  if (prior) {
    if (prior.fingerprint === fingerprint) {
      return { ...prior.result, replay: true };
    }
    return deny(OFFICIAL_COURT_CODE.IDEMPOTENCY_CONFLICT);
  }

  const tournament = state.tournaments?.get(tournamentId);
  if (
    !tournament ||
    String(tournament.tenant_id || tournament.tenantId) !== tenantId ||
    String(tournament.club_id || tournament.clubId) !== clubId
  ) {
    return deny(OFFICIAL_COURT_CODE.TOURNAMENT_NOT_FOUND);
  }
  if (String(tournament.mode || "") !== "official_tournament") {
    return deny(OFFICIAL_COURT_CODE.TOURNAMENT_MODE_INVALID);
  }

  const actualVersion = Number(tournament.version ?? 1);
  const expected = Number(input.expectedVersion);
  if (!Number.isFinite(expected) || expected !== actualVersion) {
    return deny(OFFICIAL_COURT_CODE.VERSION_CONFLICT, {
      expectedVersion: expected,
      actualVersion,
    });
  }

  const activeReservations = (state.reservations || []).filter(
    (row) =>
      String(row.tournamentId) === tournamentId &&
      String(row.status || "active") === "active"
  );
  const courtSchedule = tournament.payload?.courtSchedule;
  if (!activeReservations.length || !courtSchedule?.courtIds?.length) {
    return deny(OFFICIAL_COURT_CODE.SCHEDULE_RESERVATION_REQUIRED);
  }

  const reservedCourtIds = new Set(activeReservations.map((row) => String(row.courtId)));
  const windowStart = activeReservations[0].startsAt;
  const windowEnd = activeReservations[0].endsAt;

  const payload = cloneJson(tournament.payload || {});
  const events = Array.isArray(payload.events) ? payload.events : [];
  const event =
    events.find((item) => String(item.id) === String(input.eventId || "")) || events[0];
  if (!event) {
    return deny(OFFICIAL_COURT_CODE.TOURNAMENT_STATE_INVALID);
  }
  const existing = groupMatches(event);
  const existingIds = new Set(existing.map((match) => String(match.id)));
  const proposedById = new Map(
    proposed.map((match) => [String(match.id || match.matchId || ""), match])
  );

  if (proposed.some((match) => !existingIds.has(String(match.id || match.matchId || "")))) {
    return deny(OFFICIAL_COURT_CODE.SCHEDULE_MATCH_UNKNOWN);
  }
  if (existing.some((match) => !proposedById.has(String(match.id)))) {
    return deny(OFFICIAL_COURT_CODE.SCHEDULE_MATCH_UNKNOWN, {
      error: "Mọi trận vòng bảng hiện có phải có sân và giờ.",
    });
  }

  const scheduled = existing.map((match) => {
    const next = proposedById.get(String(match.id));
    return {
      ...match,
      courtId: String(next.courtId || ""),
      scheduledStart: next.scheduledStart,
      scheduledEnd: next.scheduledEnd,
    };
  });

  for (const match of scheduled) {
    if (!match.courtId || !match.scheduledStart || !match.scheduledEnd) {
      return deny(OFFICIAL_COURT_CODE.SCHEDULE_MATCH_UNKNOWN, {
        error: "Mọi trận vòng bảng phải có sân và giờ.",
      });
    }
    if (!reservedCourtIds.has(String(match.courtId))) {
      return deny(OFFICIAL_COURT_CODE.SCHEDULE_COURT_OUTSIDE_RESERVATION, {
        matchId: match.id,
        courtId: match.courtId,
      });
    }
    const start = match.scheduledStart;
    const end = match.scheduledEnd;
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    const win0 = Date.parse(windowStart);
    const win1 = Date.parse(windowEnd);
    if (!(startMs >= win0 && endMs <= win1 && startMs < endMs)) {
      return deny(OFFICIAL_COURT_CODE.SCHEDULE_TIME_OUTSIDE_RESERVATION, {
        matchId: match.id,
      });
    }
  }

  for (let i = 0; i < scheduled.length; i += 1) {
    for (let j = i + 1; j < scheduled.length; j += 1) {
      const a = scheduled[i];
      const b = scheduled[j];
      const aEnd = a.scheduledEnd;
      const bEnd = b.scheduledEnd;
      if (
        String(a.courtId) === String(b.courtId) &&
        rangesOverlapHalfOpen(a.scheduledStart, aEnd, b.scheduledStart, bEnd)
      ) {
        return deny(OFFICIAL_COURT_CODE.SCHEDULE_COURT_CONFLICT, {
          matchIds: [a.id, b.id],
        });
      }
      const aPairs = [a.entryAId, a.entryBId].filter(Boolean).map(String);
      const bPairs = [b.entryAId, b.entryBId].filter(Boolean).map(String);
      if (
        aPairs.some((id) => bPairs.includes(id)) &&
        rangesOverlapHalfOpen(a.scheduledStart, aEnd, b.scheduledStart, bEnd)
      ) {
        return deny(OFFICIAL_COURT_CODE.SCHEDULE_PAIR_CONFLICT, {
          matchIds: [a.id, b.id],
        });
      }
    }
  }

  const scheduledById = new Map(scheduled.map((match) => [String(match.id), match]));
  const nextEvent = {
    ...event,
    matches: (event.matches || []).map((match) => {
      const next = scheduledById.get(String(match.id));
      return next ? { ...match, ...next } : match;
    }),
  };
  payload.events = events.map((item) =>
    String(item.id) === String(event.id) ? nextEvent : item
  );
  const createdAt = new Date(input.now || Date.now()).toISOString();
  const nextTournament = {
    ...tournament,
    version: actualVersion + 1,
    payload,
    updated_at: createdAt,
  };
  const result = {
    ok: true,
    tournament: nextTournament,
    version: nextTournament.version,
  };
  return {
    ok: true,
    result,
    nextState: {
      ...state,
      tournaments: new Map(state.tournaments).set(tournamentId, nextTournament),
      ledger: new Map(state.ledger).set(ledgerKey, { fingerprint, result }),
    },
  };
}
