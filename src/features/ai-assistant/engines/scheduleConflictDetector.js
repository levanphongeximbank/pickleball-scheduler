import { SCHEDULE_ISSUE_SEVERITY } from "../constants/aiConfig.js";

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function slotRange(entry) {
  const start = parseTimeToMinutes(entry.startTime || entry.start);
  const end = parseTimeToMinutes(entry.endTime || entry.end);
  if (start == null || end == null) return null;
  return { start, end };
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Detect overlapping bookings, coaching sessions, or court blocks.
 * @param {object} context
 * @param {Array} [context.bookings]
 * @param {Array} [context.coachingSchedule]
 * @param {Array} [context.courtBlocks]
 * @param {string} [context.date] — optional filter YYYY-MM-DD
 */
export function detectScheduleConflicts(context = {}) {
  const issues = [];
  const dateFilter = context.date || null;

  const entries = [
    ...(context.bookings || []).map((item) => ({ ...item, source: "booking" })),
    ...(context.coachingSchedule || []).map((item) => ({ ...item, source: "coaching" })),
    ...(context.courtBlocks || []).map((item) => ({ ...item, source: "block" })),
  ].filter((item) => !dateFilter || String(item.date) === String(dateFilter));

  if (entries.length === 0) {
    return {
      ok: true,
      data: { issues: [], summary: { critical: 0, warning: 0, info: 0 } },
      warnings: [],
      confidence: "low",
    };
  }

  const byCourt = new Map();
  entries.forEach((entry) => {
    const courtKey = String(entry.courtId || entry.courtName || entry.court || "unknown");
    const range = slotRange(entry);
    if (!range) return;
    const bucket = byCourt.get(courtKey) || [];
    bucket.push({ entry, range });
    byCourt.set(courtKey, bucket);
  });

  byCourt.forEach((slots, courtKey) => {
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        if (overlaps(slots[i].range, slots[j].range)) {
          const a = slots[i].entry;
          const b = slots[j].entry;
          issues.push({
            issueId: `schedule-conflict-${courtKey}-${a.id || i}-${b.id || j}`,
            severity: SCHEDULE_ISSUE_SEVERITY.CRITICAL,
            type: "schedule_conflict",
            message: `Trùng lịch sân ${courtKey}: ${a.source} vs ${b.source}.`,
            courtKey,
            affectedIds: [a.id, b.id].filter(Boolean),
            suggestedFix: "Dời một trong hai ca hoặc đổi sân.",
          });
        }
      }
    }
  });

  const coachSlots = new Map();
  entries.forEach((entry) => {
    const coachKey = entry.coachId || entry.coachName;
    if (!coachKey) return;
    const range = slotRange(entry);
    if (!range) return;
    const bucket = coachSlots.get(String(coachKey)) || [];
    bucket.push({ entry, range });
    coachSlots.set(String(coachKey), bucket);
  });

  coachSlots.forEach((slots, coachKey) => {
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        if (overlaps(slots[i].range, slots[j].range)) {
          issues.push({
            issueId: `coach-conflict-${coachKey}-${i}-${j}`,
            severity: SCHEDULE_ISSUE_SEVERITY.WARNING,
            type: "coach_conflict",
            message: `HLV ${coachKey} bị xếp 2 ca trùng thời gian.`,
            affectedIds: [slots[i].entry.id, slots[j].entry.id].filter(Boolean),
            suggestedFix: "Phân công HLV khác hoặc dời ca.",
          });
        }
      }
    }
  });

  const critical = issues.filter((i) => i.severity === SCHEDULE_ISSUE_SEVERITY.CRITICAL).length;
  const warning = issues.filter((i) => i.severity === SCHEDULE_ISSUE_SEVERITY.WARNING).length;

  return {
    ok: true,
    data: {
      issues,
      summary: { critical, warning, info: issues.length - critical - warning },
    },
    warnings: issues.map((i) => i.message),
    confidence: critical > 0 ? "low" : warning > 0 ? "medium" : "high",
  };
}
