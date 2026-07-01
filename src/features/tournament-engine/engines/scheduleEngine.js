import { buildGroupStageSchedule } from "../../../tournament/engines/scheduleEngine.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { validateScheduleInput } from "../validation/tournamentValidation.js";

const COMPLETED_STATUSES = new Set(["completed", "forfeit"]);

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

function getParticipantIds(match) {
  return [match.entryAId, match.entryBId].filter(Boolean).map(String);
}

function participantBusyAt(matchByParticipant, participantId, slotStart) {
  const slots = matchByParticipant.get(participantId) || [];
  return slots.some((slot) => slot === slotStart);
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
  const explain = [];
  const courts = (context.courts || []).filter((c) => !c.locked);
  const courtCount = Math.max(1, courts.length);
  const matchDuration = Number(config.averageMatchMinutes || 25);
  const buffer = Number(config.bufferMinutes || 5);
  const slotDuration = matchDuration + buffer;
  const startMinutes = parseTimeToMinutes(config.startTime);
  const endMinutes = parseTimeToMinutes(config.endTime || "22:00");
  const date = config.date || new Date().toISOString().slice(0, 10);

  let matches = [...(context.matches || [])];

  if (matches.length === 0 && (context.groups || []).length > 0) {
    const schedule = buildGroupStageSchedule(context.groups, {
      tournamentId: context.tournamentId,
      eventId: context.eventId,
      players: [],
    });
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
  const matchByParticipant = new Map();

  scheduled.forEach((match) => {
    if (match.slot != null) {
      getParticipantIds(match).forEach((pid) => {
        const list = matchByParticipant.get(pid) || [];
        list.push(match.slot);
        matchByParticipant.set(pid, list);
      });
    }
  });

  let slotIndex = 0;
  let currentMinutes = startMinutes;

  pending.forEach((match, index) => {
    if (match.scheduledStart && match.manualScheduleLock) {
      scheduled.push(match);
      return;
    }

    let assigned = false;
    let attempts = 0;

    while (!assigned && attempts < 500) {
      const courtIndex = slotIndex % courtCount;
      const court = courts[courtIndex];
      const participantIds = getParticipantIds(match);

      const conflict = participantIds.some((pid) =>
        participantBusyAt(matchByParticipant, pid, slotIndex)
      );

      if (!conflict) {
        const endMinutesSlot = currentMinutes + matchDuration;
        if (endMinutesSlot > endMinutes) {
          warnings.push(
            `Trận ${match.id || index + 1} có thể vượt khung giờ giải (${config.endTime}).`
          );
        }

        const scheduledMatch = {
          ...match,
          matchOrder: match.matchOrder ?? index + 1,
          courtId: court?.id || null,
          slot: slotIndex,
          scheduledStart: addMinutesToIso(date, currentMinutes, 0),
          scheduledEnd: addMinutesToIso(date, currentMinutes, matchDuration),
          status: match.status || MATCH_STATUS.WAITING,
        };

        participantIds.forEach((pid) => {
          const list = matchByParticipant.get(pid) || [];
          list.push(slotIndex);
          matchByParticipant.set(pid, list);
        });

        scheduled.push(scheduledMatch);
        assigned = true;

        if ((slotIndex + 1) % courtCount === 0) {
          currentMinutes += slotDuration;
        }
        slotIndex += 1;
      } else {
        slotIndex += 1;
        if (slotIndex % courtCount === 0) {
          currentMinutes += slotDuration;
        }
      }

      attempts += 1;
    }

    if (!assigned) {
      warnings.push(`Không xếp được slot cho trận ${match.id || index + 1} — xung đột lịch.`);
      scheduled.push(match);
    }
  });

  explain.push(
    `${courtCount} sân, ${slotDuration} phút/slot (gồm buffer ${buffer} phút).`,
    `Khung giờ ${config.startTime}–${config.endTime}.`
  );

  return {
    ok: true,
    data: {
      matches: scheduled.sort(
        (a, b) => Number(a.slot ?? 9999) - Number(b.slot ?? 9999)
      ),
      slotCount: slotIndex,
      estimatedEndTime: minutesToTimeString(currentMinutes + matchDuration),
    },
    warnings,
    explain,
  };
}

export { parseTimeToMinutes, minutesToTimeString };
