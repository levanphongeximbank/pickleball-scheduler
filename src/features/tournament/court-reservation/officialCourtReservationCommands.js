/**
 * Official client commands — one RPC each. No club blob / compensation.
 */

import { resolveVenueTimezoneForClub } from "../../../domain/civilTime.js";
import { normalizeCourtSchedule } from "../../../models/tournament/courtSchedule.js";
import { createOfficialCourtReservationService } from "./officialCourtReservationService.js";
import {
  OFFICIAL_COURT_CODE,
  OFFICIAL_COURT_MESSAGES,
} from "./officialCourtReservationCodes.js";

function fail(code, extra = {}) {
  return {
    ok: false,
    code,
    error: extra.error || OFFICIAL_COURT_MESSAGES[code] || code,
    mutationCount: 0,
    tournamentPatchAttempted: false,
    ...extra,
  };
}

export async function reserveOfficialTournamentCourtsCommand(input = {}) {
  const courtSchedule = normalizeCourtSchedule(input.schedule || input);
  if (!courtSchedule) {
    return fail(OFFICIAL_COURT_CODE.INVALID_WINDOW, {
      error: "Vui lòng chọn ngày, giờ và ít nhất một sân.",
    });
  }

  const explicitTimezone = String(input.timezone || "").trim();
  const tz = explicitTimezone
    ? { ok: true, timezone: explicitTimezone }
    : resolveVenueTimezoneForClub(input.clubId);
  if (!tz.ok) {
    return fail(OFFICIAL_COURT_CODE.INVALID_WINDOW, { error: tz.error });
  }
  const tzResolved = tz.timezone;

  const service = createOfficialCourtReservationService({ rpc: input.rpc });
  const result = await service.reserveCourts({
    tenantId: input.tenantId,
    clubId: input.clubId,
    tournamentId: input.tournamentId,
    courtIds: courtSchedule.courtIds,
    date: courtSchedule.date,
    startTime: courtSchedule.startTime,
    endTime: courtSchedule.endTime,
    timezone: tzResolved,
    expectedVersion:
      input.expectedVersion ?? input.tournament?.version ?? 1,
    idempotencyKey: input.idempotencyKey,
  });
  if (!result.ok) {
    return {
      ...result,
      mutationCount: 0,
      tournamentPatchAttempted: false,
      tournament: input.tournament || result.tournament || null,
    };
  }
  return {
    ok: true,
    tournament: result.tournament,
    version: result.version,
    courtSchedule: result.courtSchedule || result.tournament?.courtSchedule,
    mutationCount: 1,
    readbackCount: 1,
    tournamentPatchAttempted: true,
    courtScheduleReadbackVerified: true,
    cloudWriteCount: 1,
  };
}

export async function commitOfficialGroupScheduleCommand(input = {}) {
  const matches = Array.isArray(input.matches) ? input.matches : [];
  if (!matches.length) {
    return fail(OFFICIAL_COURT_CODE.SCHEDULE_MATCH_UNKNOWN, {
      error: "Không có trận vòng bảng để xếp lịch.",
    });
  }
  const service = createOfficialCourtReservationService({ rpc: input.rpc });
  const result = await service.commitGroupSchedule({
    tenantId: input.tenantId,
    clubId: input.clubId,
    tournamentId: input.tournamentId,
    eventId: input.eventId,
    matches: matches.map((match) => ({
      id: match.id,
      courtId: match.courtId,
      scheduledStart: match.scheduledStart,
      scheduledEnd: match.scheduledEnd,
      entryAId: match.entryAId,
      entryBId: match.entryBId,
    })),
    expectedVersion: input.expectedVersion ?? input.tournament?.version ?? 1,
    idempotencyKey: input.idempotencyKey,
  });
  if (!result.ok) {
    return { ...result, mutationCount: 0 };
  }
  return {
    ok: true,
    tournament: result.tournament,
    version: result.version,
    mutationCount: 1,
    readbackCount: 1,
    cloudWriteCount: 1,
  };
}
