/**
 * Minimum rest time engine for individual tournament schedules (S1-E).
 */

function toMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function getParticipantIds(match) {
  return [match.entryAId, match.entryBId, match.teamAId, match.teamBId]
    .filter(Boolean)
    .map(String);
}

/**
 * @param {Array} matches
 * @param {number} minRestMinutes
 * @returns {{ ok: boolean, violations: Array, conflictCount: number }}
 */
export function findMinimumRestViolations(matches = [], minRestMinutes = 15) {
  const minMs = Math.max(0, Number(minRestMinutes) || 0) * 60 * 1000;
  const byParticipant = new Map();
  const violations = [];

  (matches || []).forEach((match) => {
    const start = toMs(match.scheduledStart);
    const end = toMs(match.scheduledEnd) ?? (start != null ? start + 25 * 60 * 1000 : null);
    if (start == null || end == null) return;

    getParticipantIds(match).forEach((pid) => {
      const list = byParticipant.get(pid) || [];
      list.push({ matchId: match.id, start, end });
      byParticipant.set(pid, list);
    });
  });

  byParticipant.forEach((slots, participantId) => {
    const sorted = [...slots].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        if (a.end > b.start && b.end > a.start) {
          violations.push({
            type: "time_conflict",
            severity: "error",
            participantId,
            matchIds: [a.matchId, b.matchId],
            message: `VĐV/cặp ${participantId} bị trùng giờ 2 trận.`,
            restMinutes: 0,
            requiredMinutes: minRestMinutes,
          });
        } else if (b.start >= a.end) {
          const restMs = b.start - a.end;
          if (restMs < minMs) {
            violations.push({
              type: "min_rest",
              severity: "warning",
              participantId,
              matchIds: [a.matchId, b.matchId],
              message: `VĐV/cặp ${participantId} chỉ nghỉ ${Math.round(restMs / 60000)} phút (tối thiểu ${minRestMinutes}).`,
              restMinutes: Math.round(restMs / 60000),
              requiredMinutes: minRestMinutes,
            });
          }
        }
      }
    }
  });

  const hard = violations.filter((v) => v.severity === "error" || v.type === "time_conflict");
  return {
    ok: hard.length === 0,
    violations,
    conflictCount: hard.length,
    restWarningCount: violations.filter((v) => v.type === "min_rest").length,
  };
}

export function hasHardScheduleConflicts(matches = [], minRestMinutes = 15) {
  const result = findMinimumRestViolations(matches, minRestMinutes);
  return result.conflictCount > 0;
}

/**
 * Soft check for organizer manual override — always returns warnings list.
 */
export function warnIfRestViolated(matches = [], minRestMinutes = 15) {
  const result = findMinimumRestViolations(matches, minRestMinutes);
  return {
    ok: true,
    warnings: result.violations.map((v) => v.message),
    violations: result.violations,
  };
}

export function findCourtConflicts(matches = []) {
  const byCourt = new Map();
  const conflicts = [];

  (matches || []).forEach((match) => {
    if (!match.courtId || !match.scheduledStart) return;
    const start = toMs(match.scheduledStart);
    const end = toMs(match.scheduledEnd) ?? (start != null ? start + 25 * 60 * 1000 : null);
    if (start == null) return;
    const key = String(match.courtId);
    const list = byCourt.get(key) || [];
    list.push({ matchId: match.id, start, end });
    byCourt.set(key, list);
  });

  byCourt.forEach((slots, courtId) => {
    const sorted = [...slots].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[i].end > sorted[j].start && sorted[j].end > sorted[i].start) {
          conflicts.push({
            type: "court_conflict",
            severity: "error",
            courtId,
            matchIds: [sorted[i].matchId, sorted[j].matchId],
            message: `Sân ${courtId} bị trùng lịch 2 trận.`,
          });
        }
      }
    }
  });

  return { ok: conflicts.length === 0, conflicts };
}

export function validateScheduleConflicts(matches = [], options = {}) {
  const minRestMinutes = Number(options.minRestMinutes ?? 15);
  const rest = findMinimumRestViolations(matches, minRestMinutes);
  const courts = findCourtConflicts(matches);
  const errors = [
    ...rest.violations.filter((v) => v.severity === "error"),
    ...courts.conflicts,
  ];
  const warnings = rest.violations.filter((v) => v.severity === "warning");

  return {
    ok: errors.length === 0,
    errors: errors.map((e) => e.message),
    warnings: warnings.map((w) => w.message),
    violations: [...rest.violations, ...courts.conflicts],
  };
}
