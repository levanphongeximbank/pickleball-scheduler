import { MATCH_STAGE } from "../../../models/tournament/constants.js";
import { validateCourtAssignmentInput } from "../validation/tournamentValidation.js";

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

  const matches = [...(context.matches || [])].sort(
    (a, b) => matchImportance(b) - matchImportance(a)
  );

  const courtSchedule = new Map();

  matches.forEach((match) => {
    if (COMPLETED_STATUSES.has(match.status)) {
      if (match.courtId) {
        const list = courtSchedule.get(match.courtId) || [];
        list.push(match);
        courtSchedule.set(match.courtId, list);
      }
      return;
    }

    if (match.manualCourtLock && match.courtId && !overrideManual) {
      explain.push(`Trận ${match.id}: giữ sân thủ công (${match.courtId}).`);
      return;
    }

    const importance = matchImportance(match);
    let assignedCourt = null;
    let reason = "";

    for (const court of courts) {
      const scheduled = courtSchedule.get(court.id) || [];
      const overlap = scheduled.some((other) => timeOverlaps(match, other));
      if (!overlap) {
        assignedCourt = court;
        reason =
          importance >= 70
            ? `Trận quan trọng → sân ưu tiên ${court.name}`
            : `Sân trống phù hợp: ${court.name}`;
        scheduled.push({ ...match, courtId: court.id });
        courtSchedule.set(court.id, scheduled);
        break;
      }
    }

    if (!assignedCourt) {
      conflicts.push({
        matchId: match.id,
        message: "Không có sân trống trong khung giờ trận đấu.",
      });
      warnings.push(`Trận ${match.id}: không gán được sân.`);
      return;
    }

    assignments.push({
      matchId: match.id,
      courtId: assignedCourt.id,
      courtName: assignedCourt.name,
      reason,
      importance,
    });
  });

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
