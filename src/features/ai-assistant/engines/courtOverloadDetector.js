import { SCHEDULE_ISSUE_SEVERITY } from "../constants/aiConfig.js";

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function countOverlapping(entries, windowStart, windowEnd) {
  let maxConcurrent = 0;
  const events = [];

  entries.forEach((entry) => {
    const start = parseTimeToMinutes(entry.startTime || entry.start);
    const end = parseTimeToMinutes(entry.endTime || entry.end);
    if (start == null || end == null) return;
    if (end <= windowStart || start >= windowEnd) return;
    events.push({ t: Math.max(start, windowStart), delta: 1 });
    events.push({ t: Math.min(end, windowEnd), delta: -1 });
  });

  events.sort((a, b) => a.t - b.t || a.delta - b.delta);
  let current = 0;
  events.forEach((event) => {
    current += event.delta;
    if (current > maxConcurrent) maxConcurrent = current;
  });

  return maxConcurrent;
}

/**
 * Detect court overload when concurrent bookings exceed available courts.
 * @param {object} context
 * @param {Array} [context.bookings]
 * @param {Array} [context.coachingSchedule]
 * @param {number} [context.courtCount]
 * @param {number} [context.overloadThreshold] — ratio above 1 triggers warning (default 0.85)
 * @param {string} [context.date]
 * @param {string} [context.dayStart] — HH:mm
 * @param {string} [context.dayEnd] — HH:mm
 */
export function detectCourtOverload(context = {}) {
  const issues = [];
  const courtCount = Math.max(1, Number(context.courtCount || 1));
  const threshold = Number(context.overloadThreshold ?? 0.85);
  const dateFilter = context.date || null;
  const dayStart = parseTimeToMinutes(context.dayStart || "06:00") ?? 360;
  const dayEnd = parseTimeToMinutes(context.dayEnd || "22:00") ?? 1320;

  const entries = [
    ...(context.bookings || []),
    ...(context.coachingSchedule || []),
  ].filter((item) => !dateFilter || String(item.date) === String(dateFilter));

  if (entries.length === 0) {
    return {
      ok: true,
      data: {
        issues: [],
        peakUtilization: 0,
        courtCount,
        summary: { critical: 0, warning: 0, info: 0 },
      },
      warnings: [],
      confidence: "low",
    };
  }

  const peakConcurrent = countOverlapping(entries, dayStart, dayEnd);
  const utilization = peakConcurrent / courtCount;

  if (utilization > 1) {
    issues.push({
      issueId: "court-overload-critical",
      severity: SCHEDULE_ISSUE_SEVERITY.CRITICAL,
      type: "court_overload",
      message: `Quá tải sân: ${peakConcurrent} ca đồng thời trên ${courtCount} sân (${Math.round(utilization * 100)}%).`,
      peakConcurrent,
      courtCount,
      suggestedFix: "Giảm ca trùng, thêm sân, hoặc dời lịch.",
    });
  } else if (utilization >= threshold) {
    issues.push({
      issueId: "court-overload-warning",
      severity: SCHEDULE_ISSUE_SEVERITY.WARNING,
      type: "court_overload",
      message: `Sân gần đầy: ${peakConcurrent}/${courtCount} ca đồng thời (${Math.round(utilization * 100)}%).`,
      peakConcurrent,
      courtCount,
      suggestedFix: "Theo dõi thêm booking hoặc mở thêm khung giờ.",
    });
  }

  const hourlyPeaks = [];
  for (let hour = dayStart; hour < dayEnd; hour += 60) {
    const concurrent = countOverlapping(entries, hour, hour + 60);
    if (concurrent > 0) {
      hourlyPeaks.push({ hour, concurrent, utilization: concurrent / courtCount });
    }
  }

  hourlyPeaks
    .filter((slot) => slot.utilization >= threshold)
    .slice(0, 3)
    .forEach((slot, index) => {
      const hourLabel = `${String(Math.floor(slot.hour / 60)).padStart(2, "0")}:00`;
      issues.push({
        issueId: `court-overload-hour-${index}`,
        severity: slot.utilization > 1 ? SCHEDULE_ISSUE_SEVERITY.CRITICAL : SCHEDULE_ISSUE_SEVERITY.INFO,
        type: "court_overload_hour",
        message: `Khung ${hourLabel}: ${slot.concurrent}/${courtCount} sân bận.`,
        hour: hourLabel,
        peakConcurrent: slot.concurrent,
      });
    });

  const critical = issues.filter((i) => i.severity === SCHEDULE_ISSUE_SEVERITY.CRITICAL).length;
  const warning = issues.filter((i) => i.severity === SCHEDULE_ISSUE_SEVERITY.WARNING).length;

  return {
    ok: true,
    data: {
      issues,
      peakUtilization: utilization,
      peakConcurrent,
      courtCount,
      summary: { critical, warning, info: issues.length - critical - warning },
    },
    warnings: issues.filter((i) => i.severity !== SCHEDULE_ISSUE_SEVERITY.INFO).map((i) => i.message),
    confidence: critical > 0 ? "low" : warning > 0 ? "medium" : "high",
  };
}
