import { MATCH_STAGE } from "../../../models/tournament/constants.js";
import { validateCourtAssignmentInput } from "../validation/tournamentValidation.js";
import {
  AVAILABILITY_MODE,
  assertRuntimeAvailabilityScope,
  createCompetitionAvailabilityChecker,
  resolveAvailabilityMode,
  resolveMatchCivilWindow,
  resolveScheduleConfigWindow,
} from "../services/competitionAvailabilityGuard.js";
import { resolveVenueTimezoneForClub } from "../../../domain/civilTime.js";

const COMPLETED_STATUSES = new Set(["completed", "forfeit"]);

function matchImportance(match) {
  const stage = String(match.stage || match.bracketStage || "group").toLowerCase();
  const seedBonus = Math.max(0, 10 - Number(match.topSeed || 99));

  const stageScores = {
    [MATCH_STAGE.FINAL]: 100,
    [MATCH_STAGE.SEMIFINAL]: 80,
    [MATCH_STAGE.THIRD_PLACE]: 70,
    [MATCH_STAGE.QUARTERFINAL]: 60,
    [MATCH_STAGE.ROUND_OF_16]: 50,
    group: 30,
  };

  return (stageScores[stage] ?? 30) + seedBonus;
}

function courtsByPriority(courts = []) {
  return [...courts]
    .filter((court) => !court.locked)
    .sort(
      (a, b) =>
        Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
        String(a.name).localeCompare(String(b.name), "vi")
    );
}

function timeOverlaps(a, b) {
  if (!a.scheduledStart || !b.scheduledStart) {
    return false;
  }
  const aStart = new Date(a.scheduledStart).getTime();
  const aEnd = new Date(a.scheduledEnd || a.scheduledStart).getTime();
  const bStart = new Date(b.scheduledStart).getTime();
  const bEnd = new Date(b.scheduledEnd || b.scheduledStart).getTime();
  return aStart < bEnd && bStart < aEnd;
}

/**
 * @param {import('../types/tournamentTypes.js').EngineContext} context
 * @param {Object} [options]
 */
export function assignCourts(context = {}, options = {}) {
  const validation = validateCourtAssignmentInput(context);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const overrideManual = options.overrideManual === true;
  const warnings = [...validation.warnings];
  const explain = [];
  const courts = courtsByPriority(context.courts || []);
  const assignments = [];
  const conflicts = [];

  const availabilityMode = resolveAvailabilityMode(options, context);
  const clubId = context.clubId || options.clubId || null;
  const configWindow = resolveScheduleConfigWindow(context.scheduleConfig || {});
  const tzResolve = resolveVenueTimezoneForClub(clubId, {
    timezone: context.timezone || options.timezone || context.scheduleConfig?.timezone,
  });
  const venueTimezone = tzResolve.ok ? tzResolve.timezone : null;
  const matchTzOptions = venueTimezone ? { timezone: venueTimezone } : {};

  const scope = assertRuntimeAvailabilityScope({
    clubId,
    scheduleConfig: context.scheduleConfig || {},
    matchWindow: configWindow,
    mode: availabilityMode,
    // Window may come per-match; require clubId always in REQUIRED mode.
    // Per-match window checked below before assign.
    requireWindow: false,
  });
  if (!scope.ok) {
    return {
      ok: false,
      errors: scope.errors,
      code: scope.code,
      warnings,
      explain,
    };
  }

  if (availabilityMode === AVAILABILITY_MODE.REQUIRED && !configWindow) {
    const sample = (context.matches || []).find(
      (m) => m?.scheduledStart && !COMPLETED_STATUSES.has(m.status)
    );
    const sampleWindow = sample
      ? resolveMatchCivilWindow(
          sample,
          context.scheduleConfig?.date || null,
          matchTzOptions
        )
      : null;
    if (!sampleWindow && !(context.matches || []).some((m) => m?.scheduledStart)) {
      return {
        ok: false,
        code: "SCHEDULE_WINDOW_MISSING",
        errors: [
          "Thiếu khung giờ dân sự (scheduleConfig hoặc scheduledStart/End) — bắt buộc cho Venue & Court availability.",
        ],
        warnings,
        explain,
      };
    }
  }

  const venueAvailability = createCompetitionAvailabilityChecker({
    clubId: scope.clubId,
    venueId: context.venueId || options.venueId || null,
    courtIds: courts.map((court) => court.id),
    clusterId: context.clusterId || options.clusterId || null,
    context: options.availabilityContext || context.availabilityContext || null,
    mode: availabilityMode,
  });
  if (venueAvailability.enabled) {
    explain.push("Venue & Court availability: bật (lọc sân theo booking / giờ / trạng thái).");
  }

  const matches = [...(context.matches || [])].sort(
    (a, b) => matchImportance(b) - matchImportance(a)
  );

  const courtSchedule = new Map();

  for (const match of matches) {
    if (COMPLETED_STATUSES.has(match.status)) {
      if (match.courtId) {
        const list = courtSchedule.get(match.courtId) || [];
        list.push(match);
        courtSchedule.set(match.courtId, list);
      }
      continue;
    }

    if (match.manualCourtLock && match.courtId && !overrideManual) {
      explain.push(`Trận ${match.id}: giữ sân thủ công (${match.courtId}).`);
      continue;
    }

    const importance = matchImportance(match);
    let assignedCourt = null;
    let reason = "";
    const matchWindow =
      resolveMatchCivilWindow(
        match,
        configWindow?.date || context.scheduleConfig?.date || null,
        matchTzOptions
      ) || configWindow;

    if (availabilityMode === AVAILABILITY_MODE.REQUIRED && venueAvailability.enabled) {
      if (!matchWindow) {
        return {
          ok: false,
          code: "SCHEDULE_WINDOW_MISSING",
          errors: [
            `Trận ${match.id}: thiếu khung giờ dân sự — không gán sân (fail-closed).`,
          ],
          warnings,
          explain,
          data: {
            assignments,
            matches: context.matches || [],
            conflicts,
          },
        };
      }
    }

    for (const court of courts) {
      const scheduled = courtSchedule.get(court.id) || [];
      const overlap = scheduled.some((other) => timeOverlaps(match, other));
      if (overlap) {
        continue;
      }

      if (venueAvailability.enabled && matchWindow) {
        try {
          if (
            !venueAvailability.isCourtAvailable(
              court.id,
              matchWindow.date,
              matchWindow.startTime,
              matchWindow.endTime
            )
          ) {
            continue;
          }
        } catch (error) {
          const code = error?.code || "DATA_UNAVAILABLE";
          return {
            ok: false,
            errors: [
              code === "DATA_UNAVAILABLE"
                ? "Không tải được availability từ Venue & Court (DATA_UNAVAILABLE)."
                : error?.message || "Lỗi availability Venue & Court.",
            ],
            code,
            warnings,
            explain,
            data: {
              assignments,
              matches: context.matches || [],
              conflicts,
            },
          };
        }
      }

      assignedCourt = court;
      reason =
        importance >= 70
          ? `Trận quan trọng → sân ưu tiên ${court.name}`
          : `Sân trống phù hợp: ${court.name}`;
      scheduled.push({ ...match, courtId: court.id });
      courtSchedule.set(court.id, scheduled);
      break;
    }

    if (!assignedCourt) {
      conflicts.push({
        matchId: match.id,
        message: "Không có sân trống trong khung giờ trận đấu.",
      });
      warnings.push(`Trận ${match.id}: không gán được sân.`);
      continue;
    }

    assignments.push({
      matchId: match.id,
      courtId: assignedCourt.id,
      courtName: assignedCourt.name,
      reason,
      importance,
    });
  }

  explain.push(`${assignments.length} trận được gán sân tự động.`);

  const updatedMatches = (context.matches || []).map((match) => {
    const assignment = assignments.find((a) => String(a.matchId) === String(match.id));
    if (!assignment) {
      return match;
    }
    if (match.manualCourtLock && !overrideManual) {
      return match;
    }
    return {
      ...match,
      courtId: assignment.courtId,
      courtAssignmentReason: assignment.reason,
    };
  });

  return {
    ok: conflicts.length === 0 || assignments.length > 0,
    data: {
      assignments,
      matches: updatedMatches,
      conflicts,
    },
    warnings,
    explain,
    errors: conflicts.length === assignments.length && assignments.length === 0
      ? ["Không gán được sân cho trận nào."]
      : undefined,
  };
}

export { matchImportance, courtsByPriority };
