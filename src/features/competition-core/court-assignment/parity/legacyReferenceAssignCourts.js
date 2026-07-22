/**
 * CORE-12 Phase 1C — isolated legacy TE assignCourts reference harness.
 *
 * Pure reimplementation of the audited Tournament Engine court-assignment
 * algorithm under LEGACY availability mode (no Venue live calls).
 *
 * Used only for shadow-parity fixtures. Does not modify production TE.
 * Does not write assignments, access Supabase, or touch UI state.
 */

const COMPLETED_STATUSES = new Set(["completed", "forfeit"]);

const STAGE_SCORES = Object.freeze({
  final: 100,
  semifinal: 80,
  third_place: 70,
  quarterfinal: 60,
  round_of_16: 50,
  group: 30,
});

/**
 * Mirrors TE matchImportance.
 * @param {object} match
 */
export function legacyMatchImportance(match) {
  const stage = String(match.stage || match.bracketStage || "group").toLowerCase();
  const seedBonus = Math.max(0, 10 - Number(match.topSeed || 99));
  return (STAGE_SCORES[stage] ?? 30) + seedBonus;
}

/**
 * Mirrors TE courtsByPriority (including localeCompare 'vi').
 * @param {object[]} courts
 */
export function legacyCourtsByPriority(courts = []) {
  return [...courts]
    .filter((court) => !court.locked)
    .sort(
      (a, b) =>
        Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
        String(a.name).localeCompare(String(b.name), "vi")
    );
}

/**
 * Mirrors TE timeOverlaps (including missing-end → start collapse).
 * @param {object} a
 * @param {object} b
 */
export function legacyTimeOverlaps(a, b) {
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
 * Mirrors TE validateCourtAssignmentInput.
 * @param {object} context
 */
export function legacyValidateCourtAssignmentInput(context = {}) {
  const errors = [];
  const warnings = [];
  const courts = context.courts || [];
  const matches = (context.matches || []).filter(
    (match) => match.status !== "completed" && match.status !== "forfeit"
  );

  if (matches.length === 0) {
    errors.push("Không có trận cần gán sân.");
  }

  const availableCourts = courts.filter((court) => !court.locked);
  if (availableCourts.length === 0) {
    errors.push("Không có sân khả dụng.");
  }

  const lockedCount = courts.filter((court) => court.locked).length;
  if (lockedCount > 0) {
    warnings.push(`${lockedCount} sân đang bị khóa sẽ bỏ qua khi gán tự động.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Isolated legacy assignCourts (LEGACY availability / no live venue filter).
 * @param {object} [context]
 * @param {object} [options]
 */
export function runLegacyAssignCourtsReference(context = {}, options = {}) {
  const validation = legacyValidateCourtAssignmentInput(context);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const overrideManual = options.overrideManual === true;
  const warnings = [...validation.warnings];
  const explain = [];
  const courts = legacyCourtsByPriority(context.courts || []);
  const assignments = [];
  const conflicts = [];

  const matches = [...(context.matches || [])].sort(
    (a, b) => legacyMatchImportance(b) - legacyMatchImportance(a)
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
      // TE audited behavior: skip reassignment and do NOT register occupancy
      // on courtSchedule — known LEGACY_UNSAFE overlap gap vs CORE-12 locks.
      explain.push(`Trận ${match.id}: giữ sân thủ công (${match.courtId}).`);
      continue;
    }

    const importance = legacyMatchImportance(match);
    let assignedCourt = null;
    let reason = "";

    for (const court of courts) {
      const scheduled = courtSchedule.get(court.id) || [];
      const overlap = scheduled.some((other) => legacyTimeOverlaps(match, other));
      if (overlap) {
        continue;
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
    const assignment = assignments.find(
      (a) => String(a.matchId) === String(match.id)
    );
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
    errors:
      conflicts.length === assignments.length && assignments.length === 0
        ? ["Không gán được sân cho trận nào."]
        : undefined,
  };
}
