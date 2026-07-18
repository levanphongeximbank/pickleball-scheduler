import { buildGroupStageSchedule } from "../../../tournament/engines/scheduleEngine.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { validateScheduleInput } from "../validation/tournamentValidation.js";
import {
  findMinimumRestViolations,
  validateScheduleConflicts,
} from "../../individual-tournament/engines/restTimeEngine.js";
import { createCompetitionAvailabilityChecker } from "../services/competitionAvailabilityGuard.js";

const COMPLETED_STATUSES = new Set(["completed", "forfeit"]);

export const DEFAULT_SESSIONS = Object.freeze({
  morning: { id: "morning", label: "Sáng", startTime: "06:00", endTime: "12:00" },
  afternoon: { id: "afternoon", label: "Chiều", startTime: "12:00", endTime: "17:00" },
  evening: { id: "evening", label: "Tối", startTime: "17:00", endTime: "23:00" },
});

function parseTimeToMinutes(timeStr) {
  const [h, m] = String(timeStr || "08:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeString(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addMinutesToIso(dateStr, startMinutes, durationMinutes) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  base.setMinutes(startMinutes + durationMinutes);
  return base.toISOString();
}

function isoToMinutesOnDate(iso, dateStr) {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return null;
  const base = new Date(`${dateStr || new Date(iso).toISOString().slice(0, 10)}T00:00:00`).getTime();
  return Math.round((start - base) / 60000);
}

function getParticipantIds(match) {
  return [match.entryAId, match.entryBId].filter(Boolean).map(String);
}

function resolveSessions(config = {}) {
  if (Array.isArray(config.sessions) && config.sessions.length > 0) {
    return config.sessions.map((session) => ({
      id: session.id || session.name || "session",
      label: session.label || session.name || session.id || "session",
      startTime: session.startTime,
      endTime: session.endTime,
      startMinutes: parseTimeToMinutes(session.startTime),
      endMinutes: parseTimeToMinutes(session.endTime),
    }));
  }

  const startMinutes = parseTimeToMinutes(config.startTime || "08:00");
  const endMinutes = parseTimeToMinutes(config.endTime || "22:00");
  return [
    {
      id: "full-day",
      label: "Cả ngày",
      startTime: config.startTime || "08:00",
      endTime: config.endTime || "22:00",
      startMinutes,
      endMinutes,
    },
  ];
}

function sessionForMinutes(sessions, minutes) {
  return (
    sessions.find((s) => minutes >= s.startMinutes && minutes < s.endMinutes) ||
    sessions[0] ||
    null
  );
}

function courtsByPriority(courts = []) {
  return [...courts]
    .filter((court) => !court.locked)
    .sort(
      (a, b) =>
        Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
        String(a.name || a.id).localeCompare(String(b.name || b.id), "vi")
    );
}

function courtAllowsSession(court, sessionId) {
  const allowed = court.availableSessions || court.sessions;
  if (!allowed || !allowed.length) return true;
  if (sessionId === "full-day") return true;
  return allowed.map(String).includes(String(sessionId));
}

function participantReadyAt(busyByParticipant, participantId, startMinutes, minRestMinutes) {
  const slots = busyByParticipant.get(participantId) || [];
  return slots.every((slot) => startMinutes >= slot.end + minRestMinutes);
}

function courtFreeAt(busyByCourt, courtId, startMinutes, endMinutes) {
  const slots = busyByCourt.get(courtId) || [];
  return slots.every((slot) => endMinutes <= slot.start || startMinutes >= slot.end);
}

function validateCourtAvailability(courts, sessions) {
  const errors = [];
  const available = courtsByPriority(courts);
  if (available.length === 0) {
    errors.push("Không có sân khả dụng (tất cả sân đang bị khóa).");
    return errors;
  }

  sessions.forEach((session) => {
    if (session.id === "full-day") return;
    const coverage = available.some((court) => courtAllowsSession(court, session.id));
    if (!coverage) {
      errors.push(`Không có sân khả dụng cho phiên ${session.label || session.id}.`);
    }
  });

  return errors;
}

/**
 * @param {import('../types/tournamentTypes.js').EngineContext} context
 * @param {Object} [options]
 */
export function generateSchedule(context = {}, options = {}) {
  const validation = validateScheduleInput(context);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const config = context.scheduleConfig || {};
  const warnings = [...validation.warnings];
  const errors = [];
  const explain = [];
  const courts = courtsByPriority(context.courts || []);
  const courtCount = Math.max(1, courts.length);
  const matchDuration = Number(config.averageMatchMinutes || 25);
  const buffer = Number(config.bufferMinutes || 5);
  const minRestMinutes = Number(
    config.minRestMinutes ?? config.restMinutes ?? buffer
  );
  const slotDuration = matchDuration + buffer;
  const date = config.date || new Date().toISOString().slice(0, 10);
  const sessions = resolveSessions(config);
  const strictRest = options.strictRest !== false && config.strictRest !== false;

  const venueAvailability = createCompetitionAvailabilityChecker({
    clubId: context.clubId || options.clubId || null,
    venueId: context.venueId || options.venueId || null,
    courtIds: courts.map((court) => court.id),
    context: options.availabilityContext || context.availabilityContext || null,
  });
  if (venueAvailability.enabled) {
    explain.push("Venue & Court availability: bật (lọc sân theo booking / giờ / trạng thái).");
  }

  const availabilityErrors = validateCourtAvailability(courts, sessions);
  if (availabilityErrors.length) {
    return {
      ok: false,
      errors: availabilityErrors,
      warnings,
    };
  }

  let matches = [...(context.matches || [])];

  if (matches.length === 0 && (context.groups || []).length > 0) {
    const schedule = buildGroupStageSchedule(context.groups, {
      tournamentId: context.tournamentId,
      eventId: context.eventId,
      players: context.players || [],
      privatePairingRules:
        context.privatePairingRules || options.privatePairingRules || [],
      pairingConstraints:
        context.pairingConstraints || options.pairingConstraints || [],
      competitionClass: context.competitionClass || options.competitionClass,
      clubId: context.clubId || options.clubId || null,
      envSource: context.envSource || options.envSource,
      allowedByPublishedRules:
        context.allowedByPublishedRules === true ||
        options.allowedByPublishedRules === true,
      seed: context.seed ?? options.seed,
      contextTime: context.contextTime || options.contextTime,
    });
    if (schedule.ok === false || schedule.privatePairingError) {
      return {
        ok: false,
        errors: [
          schedule.privatePairingError?.message ||
            "Không tạo được lịch vòng bảng thỏa quy tắc đối đầu.",
        ],
        warnings,
        privatePairingError: schedule.privatePairingError || null,
      };
    }
    matches = schedule.matches;
    explain.push("Tạo trận vòng bảng round-robin từ bảng draw.");
  }

  if (!options.regenerate) {
    matches = matches.map((m) => ({ ...m }));
  } else {
    matches = matches.map((match) => {
      if (COMPLETED_STATUSES.has(match.status) || match.manualScheduleLock) {
        return { ...match };
      }
      const rest = { ...match };
      delete rest.scheduledStart;
      delete rest.scheduledEnd;
      delete rest.slot;
      delete rest.courtId;
      delete rest.session;
      return { ...rest, status: match.status || MATCH_STATUS.WAITING };
    });
    explain.push("Regenerate: giữ nguyên trận đã hoàn thành / khóa thủ công.");
  }

  const pending = matches
    .filter((m) => !COMPLETED_STATUSES.has(m.status))
    .sort(
      (a, b) =>
        Number(a.round || 0) - Number(b.round || 0) ||
        Number(a.matchOrder || 0) - Number(b.matchOrder || 0) ||
        String(a.id).localeCompare(String(b.id))
    );

  const scheduled = [...matches.filter((m) => COMPLETED_STATUSES.has(m.status))];
  const busyByParticipant = new Map();
  const busyByCourt = new Map();

  scheduled.forEach((match) => {
    if (!match.scheduledStart) return;
    const start = isoToMinutesOnDate(match.scheduledStart, date);
    if (start == null) return;
    const end =
      isoToMinutesOnDate(match.scheduledEnd, date) ?? start + matchDuration;

    getParticipantIds(match).forEach((pid) => {
      const list = busyByParticipant.get(pid) || [];
      list.push({ start, end, matchId: match.id });
      busyByParticipant.set(pid, list);
    });
    if (match.courtId) {
      const list = busyByCourt.get(match.courtId) || [];
      list.push({ start, end, matchId: match.id });
      busyByCourt.set(match.courtId, list);
    }
  });

  let globalSlotIndex = 0;
  const dayEnd = Math.max(...sessions.map((s) => s.endMinutes));
  let availabilityFatalError = null;

  pending.forEach((match, index) => {
    if (availabilityFatalError) {
      return;
    }

    if (match.scheduledStart && match.manualScheduleLock) {
      scheduled.push(match);
      const restCheck = findMinimumRestViolations(
        [...scheduled.filter((m) => m.scheduledStart), match],
        minRestMinutes
      );
      restCheck.violations
        .filter((v) => v.type === "min_rest")
        .forEach((v) => warnings.push(`Cảnh báo nghỉ thủ công: ${v.message}`));
      return;
    }

    let assigned = false;
    let attempts = 0;
    let cursorMinutes = sessions[0].startMinutes;

    while (
      !assigned &&
      !availabilityFatalError &&
      attempts < 2000 &&
      cursorMinutes + matchDuration <= dayEnd + slotDuration
    ) {
      const session = sessionForMinutes(sessions, cursorMinutes);
      if (!session || cursorMinutes + matchDuration > session.endMinutes) {
        const nextSession = sessions.find((s) => s.startMinutes > cursorMinutes);
        if (!nextSession) {
          cursorMinutes += slotDuration;
          attempts += 1;
          continue;
        }
        cursorMinutes = nextSession.startMinutes;
        attempts += 1;
        continue;
      }

      const participantIds = getParticipantIds(match);
      const restOk = participantIds.every((pid) =>
        participantReadyAt(busyByParticipant, pid, cursorMinutes, minRestMinutes)
      );

      if (!restOk) {
        cursorMinutes += Math.max(1, Math.floor(slotDuration / 2));
        attempts += 1;
        continue;
      }

      const eligibleCourts = courts.filter((court) =>
        courtAllowsSession(court, session.id)
      );

      for (const court of eligibleCourts) {
        const endMinutes = cursorMinutes + matchDuration;
        if (!courtFreeAt(busyByCourt, court.id, cursorMinutes, endMinutes)) {
          continue;
        }

        if (venueAvailability.enabled) {
          const slotStart = minutesToTimeString(cursorMinutes);
          const slotEnd = minutesToTimeString(endMinutes);
          try {
            if (
              !venueAvailability.isCourtAvailable(
                court.id,
                date,
                slotStart,
                slotEnd
              )
            ) {
              continue;
            }
          } catch (error) {
            availabilityFatalError = error;
            break;
          }
        }

        const scheduledMatch = {
          ...match,
          matchOrder: match.matchOrder ?? index + 1,
          courtId: court.id,
          slot: globalSlotIndex,
          session: session.id,
          scheduledStart: addMinutesToIso(date, cursorMinutes, 0),
          scheduledEnd: addMinutesToIso(date, cursorMinutes, matchDuration),
          status: match.status || MATCH_STATUS.WAITING,
        };

        participantIds.forEach((pid) => {
          const list = busyByParticipant.get(pid) || [];
          list.push({ start: cursorMinutes, end: endMinutes, matchId: match.id });
          busyByParticipant.set(pid, list);
        });
        const courtList = busyByCourt.get(court.id) || [];
        courtList.push({ start: cursorMinutes, end: endMinutes, matchId: match.id });
        busyByCourt.set(court.id, courtList);

        scheduled.push(scheduledMatch);
        assigned = true;
        globalSlotIndex += 1;
        break;
      }

      if (!assigned) {
        cursorMinutes += Math.max(1, Math.floor(slotDuration / Math.max(1, courtCount)));
        attempts += 1;
      }
    }

    if (availabilityFatalError) {
      return;
    }

    if (!assigned) {
      const message = `Không xếp được slot cho trận ${match.id || index + 1} (nghỉ tối thiểu ${minRestMinutes} phút / sân).`;
      if (strictRest) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
      scheduled.push(match);
    }
  });

  if (availabilityFatalError) {
    const code = availabilityFatalError?.code || "DATA_UNAVAILABLE";
    return {
      ok: false,
      errors: [
        code === "DATA_UNAVAILABLE"
          ? "Không tải được availability từ Venue & Court (DATA_UNAVAILABLE)."
          : availabilityFatalError?.message || "Lỗi availability Venue & Court.",
      ],
      warnings,
      explain,
    };
  }
  explain.push(
    `${courtCount} sân (ưu tiên), nghỉ tối thiểu ${minRestMinutes} phút, slot ~${slotDuration} phút.`,
    `Phiên: ${sessions.map((s) => s.label || s.id).join(", ")}.`
  );

  const conflictCheck = validateScheduleConflicts(
    scheduled.filter((m) => m.scheduledStart),
    { minRestMinutes }
  );
  conflictCheck.warnings.forEach((w) => {
    if (!warnings.includes(w)) warnings.push(w);
  });

  if (strictRest && errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
      explain,
      data: {
        matches: scheduled,
        slotCount: globalSlotIndex,
        minRestMinutes,
        estimatedEndTime: minutesToTimeString(
          Math.max(
            sessions[0].startMinutes,
            ...scheduled
              .filter((m) => m.scheduledEnd)
              .map((m) => parseTimeToMinutes(new Date(m.scheduledEnd).toISOString().slice(11, 16)))
          )
        ),
      },
    };
  }

  return {
    ok: true,
    data: {
      matches: scheduled.sort(
        (a, b) => Number(a.slot ?? 9999) - Number(b.slot ?? 9999)
      ),
      slotCount: globalSlotIndex,
      minRestMinutes,
      estimatedEndTime: minutesToTimeString(
        Math.max(
          sessions[0].startMinutes,
          ...scheduled
            .filter((m) => m.scheduledEnd)
            .map((m) => parseTimeToMinutes(new Date(m.scheduledEnd).toISOString().slice(11, 16))),
          sessions[sessions.length - 1].endMinutes
        )
      ),
    },
    warnings,
    explain,
  };
}

export { parseTimeToMinutes, minutesToTimeString, validateScheduleConflicts };
