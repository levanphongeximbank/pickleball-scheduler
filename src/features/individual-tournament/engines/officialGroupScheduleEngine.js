/**
 * Official Group Stage schedule — assigns time/court onto existing event.matches.
 * Does not redraw groups, regenerate pairings, or invent a second match list.
 *
 * Canonical match authority: event.matches
 * Duration authority: DEFAULT_TIME_PREDICTION.groupStageMinutes
 * Scheduler: features/tournament-engine/engines/scheduleEngine.generateSchedule
 */

import { DEFAULT_TIMEZONE } from "../../../ai/config.js";
import { DEFAULT_SCHEDULE_CONFIG, DEFAULT_TIME_PREDICTION } from "../../tournament-engine/constants/defaults.js";
import { AVAILABILITY_MODE } from "../../tournament-engine/services/competitionAvailabilityGuard.js";
import { generateSchedule as generateScheduleDefault } from "../../tournament-engine/engines/scheduleEngine.js";
import { validateScheduleConflicts } from "./restTimeEngine.js";

export const OFFICIAL_GROUP_MATCH_DURATION_MINUTES = DEFAULT_TIME_PREDICTION.groupStageMinutes;
export const OFFICIAL_GROUP_SCHEDULE_BUFFER_MINUTES = DEFAULT_SCHEDULE_CONFIG.bufferMinutes;
export const OFFICIAL_GROUP_SCHEDULE_MIN_REST_MINUTES = DEFAULT_SCHEDULE_CONFIG.minRestMinutes;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function groupMatches(event) {
  return (event?.matches || []).filter((match) => !match.bracketMatchId);
}

function findEvent(tournament, eventId = "") {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  if (eventId) {
    return events.find((event) => String(event.id) === String(eventId)) || events[0] || null;
  }
  return events[0] || null;
}

export function isOfficialGroupScheduleReady(event) {
  const matches = groupMatches(event);
  if (!matches.length) return false;
  return matches.every((match) => Boolean(match.scheduledStart) && Boolean(match.courtId));
}

export function countOfficialRoundRobinMatches(pairCount) {
  const n = Number(pairCount) || 0;
  if (n < 2) return 0;
  return (n * (n - 1)) / 2;
}

function findPairTimeConflicts(matches = []) {
  const byPair = new Map();
  const conflicts = [];
  (matches || []).forEach((match) => {
    const start = match.scheduledStart ? new Date(match.scheduledStart).getTime() : NaN;
    const end = match.scheduledEnd
      ? new Date(match.scheduledEnd).getTime()
      : Number.isFinite(start)
        ? start + OFFICIAL_GROUP_MATCH_DURATION_MINUTES * 60 * 1000
        : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    [match.entryAId, match.entryBId].filter(Boolean).forEach((pairId) => {
      const list = byPair.get(String(pairId)) || [];
      list.push({ matchId: match.id, start, end });
      byPair.set(String(pairId), list);
    });
  });
  byPair.forEach((slots) => {
    const sorted = [...slots].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[i].end > sorted[j].start && sorted[j].end > sorted[i].start) {
          conflicts.push({
            message: `Cặp thi đấu bị trùng giờ (${sorted[i].matchId} / ${sorted[j].matchId}).`,
          });
        }
      }
    }
  });
  return conflicts;
}

function fingerprintDraw(event) {
  return {
    entries: cloneJson(event?.entries || []),
    drawEntries: cloneJson(event?.drawEntries || []),
    groups: cloneJson(
      (event?.groups || []).map((group) => ({
        id: group.id,
        label: group.label,
        name: group.name,
        entryIds: group.entryIds || [],
        entries: (group.entries || []).map((entry) => ({
          id: entry.id,
          playerIds: entry.playerIds || [],
        })),
      }))
    ),
    matchIds: (event?.matches || []).map((match) => String(match.id)),
    matchups: (event?.matches || []).map((match) => ({
      id: String(match.id),
      groupId: String(match.groupId || ""),
      entryAId: String(match.entryAId || ""),
      entryBId: String(match.entryBId || ""),
    })),
  };
}

export function scheduleOfficialGroupMatches(tournament, input = {}, deps = {}) {
  const generateSchedule = deps.generateSchedule || generateScheduleDefault;
  const event = findEvent(tournament, input.eventId);
  if (!tournament || !event) {
    return { ok: false, error: "Không tìm thấy nội dung thi đấu.", mutationCount: 0 };
  }

  const existingMatches = groupMatches(event);
  if (!existingMatches.length) {
    return {
      ok: false,
      error: "Chưa có trận vòng bảng. Hãy bốc thăm trước.",
      mutationCount: 0,
    };
  }

  const courts = Array.isArray(input.courts) ? input.courts.filter(Boolean) : [];
  const selectedIds = Array.isArray(input.courtIds)
    ? input.courtIds.map(String).filter(Boolean)
    : courts.map((court) => String(court.id));
  const selectedCourts = courts.filter((court) => selectedIds.includes(String(court.id)));

  if (!selectedCourts.length) {
    return {
      ok: false,
      error: "Chưa chọn sân khả dụng cho đơn vị hiện tại.",
      code: "ZERO_COURTS_SELECTED",
      mutationCount: 0,
    };
  }

  const date = String(input.date || tournament?.courtSchedule?.date || "").trim();
  const startTime = String(input.startTime || tournament?.courtSchedule?.startTime || "").trim();
  const endTime = String(input.endTime || tournament?.courtSchedule?.endTime || "").trim();
  if (!date || !startTime || !endTime) {
    return {
      ok: false,
      error: "Cần ngày, giờ bắt đầu và giờ kết thúc trước khi xếp lịch.",
      code: "SCHEDULE_WINDOW_MISSING",
      mutationCount: 0,
    };
  }

  // Civil ISO conversion for Tournament-owned date/start/end only.
  // Do not resolve venue.timezone — real reservation is deferred.
  const timezone = String(input.timezone || "").trim() || DEFAULT_TIMEZONE;

  const before = fingerprintDraw(event);
  // Court list is already tenant-scoped from club_data_v3. Do not re-query
  // loadCourtsForClub via Venue & Court availability (that is the empty-court bug).
  // Court/time and pair/time conflicts still run inside generateSchedule.
  const generated = generateSchedule(
    {
      matches: existingMatches.map((match) => ({ ...match })),
      groups: [],
      courts: selectedCourts,
      tournamentId: tournament.id,
      eventId: event.id,
      players: input.players || [],
      availabilityMode: AVAILABILITY_MODE.LEGACY,
      timezone,
      scheduleConfig: {
        date,
        startTime,
        endTime,
        averageMatchMinutes: OFFICIAL_GROUP_MATCH_DURATION_MINUTES,
        bufferMinutes: OFFICIAL_GROUP_SCHEDULE_BUFFER_MINUTES,
        minRestMinutes: OFFICIAL_GROUP_SCHEDULE_MIN_REST_MINUTES,
        timezone,
      },
    },
    {
      regenerate: true,
      availabilityMode: AVAILABILITY_MODE.LEGACY,
      timezone,
    }
  );

  if (!generated.ok) {
    return {
      ok: false,
      error: (generated.errors || []).join(" ") || "Không xếp được lịch vòng bảng.",
      code: generated.code || "SCHEDULE_FAILED",
      mutationCount: 0,
    };
  }

  const scheduled = generated.data?.matches || [];
  if (scheduled.length !== existingMatches.length) {
    return {
      ok: false,
      error: "Số trận sau khi xếp lịch không khớp trận vòng bảng hiện có.",
      mutationCount: 0,
    };
  }

  const incomplete = scheduled.filter((match) => !match.scheduledStart || !match.courtId);
  if (incomplete.length) {
    return {
      ok: false,
      error: "Lịch công bố không được thiếu giờ hoặc sân.",
      code: "PUBLISHED_SCHEDULE_INCOMPLETE",
      mutationCount: 0,
    };
  }

  const conflicts = validateScheduleConflicts(scheduled, {
    minRestMinutes: OFFICIAL_GROUP_SCHEDULE_MIN_REST_MINUTES,
  });
  const pairConflicts = findPairTimeConflicts(scheduled);
  if (!conflicts.ok || pairConflicts.length) {
    return {
      ok: false,
      error:
        [...(conflicts.errors || []), ...pairConflicts.map((item) => item.message)].join(" ") ||
        "Lịch bị trùng sân hoặc trùng cặp.",
      code: "SCHEDULE_CONFLICT",
      mutationCount: 0,
    };
  }

  const scheduledById = new Map(scheduled.map((match) => [String(match.id), match]));
  const nextMatches = (event.matches || []).map((match) => {
    const next = scheduledById.get(String(match.id));
    return next ? { ...match, ...next } : match;
  });

  const nextEvent = {
    ...event,
    entries: event.entries,
    drawEntries: event.drawEntries,
    groups: event.groups,
    matches: nextMatches,
  };
  const after = fingerprintDraw(nextEvent);
  if (JSON.stringify(before.entries) !== JSON.stringify(after.entries)) {
    return { ok: false, error: "Xếp lịch không được đổi đăng ký.", mutationCount: 0 };
  }
  if (JSON.stringify(before.drawEntries) !== JSON.stringify(after.drawEntries)) {
    return { ok: false, error: "Xếp lịch không được đổi cặp bốc thăm.", mutationCount: 0 };
  }
  if (JSON.stringify(before.groups) !== JSON.stringify(after.groups)) {
    return { ok: false, error: "Xếp lịch không được đổi bảng.", mutationCount: 0 };
  }
  if (JSON.stringify(before.matchups) !== JSON.stringify(after.matchups)) {
    return { ok: false, error: "Xếp lịch không được đổi cặp đấu.", mutationCount: 0 };
  }

  const nextEvents = (tournament.events || []).map((item) =>
    String(item.id) === String(event.id) ? nextEvent : item
  );

  return {
    ok: true,
    mutationCount: 1,
    readbackCount: 1,
    events: nextEvents,
    matches: nextMatches,
    tournament: { ...tournament, events: nextEvents },
    durationMinutes: OFFICIAL_GROUP_MATCH_DURATION_MINUTES,
  };
}
