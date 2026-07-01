import { SCHEDULE_ISSUE_SEVERITY } from "../constants/aiConfig.js";

function parseTimeToMinutes(timeStr) {
  if (!timeStr) {
    return null;
  }
  const [h, m] = String(timeStr).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function matchTeamIds(match) {
  return [match.entryAId, match.entryBId, match.teamAId, match.teamBId]
    .filter(Boolean)
    .map(String);
}

function matchCourtId(match) {
  return match.courtId || match.court || match.courtNumber || null;
}

function matchScheduledMinutes(match) {
  if (match.scheduledStart) {
    return parseTimeToMinutes(match.scheduledStart);
  }
  if (match.startTime) {
    return parseTimeToMinutes(match.startTime);
  }
  if (match.slotIndex != null) {
    return Number(match.slotIndex) * (match.slotDuration || 25);
  }
  return null;
}

/**
 * @param {import('../../tournament-engine/types/tournamentTypes.js').EngineContext} context
 */
export function validateSchedule(context = {}) {
  const issues = [];
  const matches = context.matches || [];
  const scheduleConfig = context.scheduleConfig || {};
  const minRestMinutes = Number(scheduleConfig.restMinutes ?? scheduleConfig.bufferMinutes ?? 10);

  if (matches.length === 0) {
    issues.push({
      issueId: "no-matches",
      severity: SCHEDULE_ISSUE_SEVERITY.INFO,
      type: "unbalanced_schedule",
      message: "Chưa có lịch thi đấu để kiểm tra.",
      affectedMatchIds: [],
    });
    return { ok: true, data: { issues }, warnings: [], confidence: "low" };
  }

  const teamSlots = new Map();
  const courtSlots = new Map();
  const teamMatchCounts = new Map();

  matches.forEach((match) => {
    const minute = matchScheduledMinutes(match);
    const duration = Number(match.durationMinutes || scheduleConfig.averageMatchMinutes || 25);
    const teams = matchTeamIds(match);
    const court = matchCourtId(match);

    teams.forEach((teamId) => {
      teamMatchCounts.set(teamId, (teamMatchCounts.get(teamId) || 0) + 1);
      if (minute == null) {
        return;
      }
      const slots = teamSlots.get(teamId) || [];
      slots.push({ matchId: match.id, start: minute, end: minute + duration });
      teamSlots.set(teamId, slots);
    });

    if (court != null && minute != null) {
      const key = String(court);
      const slots = courtSlots.get(key) || [];
      slots.push({ matchId: match.id, start: minute, end: minute + duration });
      courtSlots.set(key, slots);
    }
  });

  teamSlots.forEach((slots, teamId) => {
    const sorted = [...slots].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[i].end > sorted[j].start && sorted[j].end > sorted[i].start) {
          issues.push({
            issueId: `team-conflict-${teamId}-${sorted[i].matchId}-${sorted[j].matchId}`,
            severity: SCHEDULE_ISSUE_SEVERITY.CRITICAL,
            type: "team_conflict",
            message: `Đội ${teamId} bị xếp 2 trận trùng thời gian.`,
            affectedMatchIds: [sorted[i].matchId, sorted[j].matchId].filter(Boolean),
            suggestedFix: "Dời một trong hai trận sang slot khác.",
          });
        } else if (sorted[j].start - sorted[i].end < minRestMinutes && sorted[j].start >= sorted[i].end) {
          const rest = sorted[j].start - sorted[i].end;
          issues.push({
            issueId: `short-rest-${teamId}-${sorted[j].matchId}`,
            severity: SCHEDULE_ISSUE_SEVERITY.WARNING,
            type: "short_rest",
            message: `Đội ${teamId} chỉ nghỉ ${rest} phút giữa 2 trận (tối thiểu ${minRestMinutes} phút).`,
            affectedMatchIds: [sorted[i].matchId, sorted[j].matchId].filter(Boolean),
            suggestedFix: "Tăng khoảng nghỉ hoặc đổi thứ tự trận.",
          });
        }
      }
    }
  });

  courtSlots.forEach((slots, courtId) => {
    const sorted = [...slots].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[i].end > sorted[j].start && sorted[j].end > sorted[i].start) {
          issues.push({
            issueId: `court-conflict-${courtId}-${sorted[i].matchId}-${sorted[j].matchId}`,
            severity: SCHEDULE_ISSUE_SEVERITY.CRITICAL,
            type: "court_conflict",
            message: `Sân ${courtId} bị trùng lịch 2 trận.`,
            affectedMatchIds: [sorted[i].matchId, sorted[j].matchId].filter(Boolean),
            suggestedFix: "Gán lại sân hoặc dời thời gian.",
          });
        }
      }
    }
  });

  const groupMatchCounts = new Map();
  (context.groups || []).forEach((group) => {
    const count = (group.matches || []).length;
    groupMatchCounts.set(group.id || group.label, count);
  });
  if (groupMatchCounts.size > 1) {
    const counts = [...groupMatchCounts.values()];
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max - min > 2) {
      issues.push({
        issueId: "unbalanced-groups",
        severity: SCHEDULE_ISSUE_SEVERITY.WARNING,
        type: "unbalanced_schedule",
        message: `Số trận giữa các bảng chênh lệch lớn (${min}–${max} trận/bảng).`,
        affectedMatchIds: [],
        suggestedFix: "Cân bằng lại số đội mỗi bảng hoặc thể thức vòng bảng.",
      });
    }
  }

  const endTime = scheduleConfig.endTime;
  const startTime = scheduleConfig.startTime || "08:00";
  if (endTime) {
    const endMinutes = parseTimeToMinutes(endTime);
    const startMinutes = parseTimeToMinutes(startTime) || 0;
    let lastEnd = startMinutes;
    matches.forEach((match) => {
      const minute = matchScheduledMinutes(match);
      if (minute != null) {
        const duration = Number(match.durationMinutes || 25);
        lastEnd = Math.max(lastEnd, minute + duration);
      }
    });
    if (lastEnd > endMinutes) {
      issues.push({
        issueId: "late-finish",
        severity: SCHEDULE_ISSUE_SEVERITY.CRITICAL,
        type: "late_finish",
        message: `Lịch kết thúc sau khung thuê sân (${endTime}).`,
        affectedMatchIds: [],
        suggestedFix: "Thêm sân, rút thời lượng trận, hoặc giảm số vòng đấu.",
      });
    }
  }

  const bracketMatches = matches.filter((m) => m.bracketMatchId || m.stage === "knockout");
  const groupIncomplete = (context.groups || []).some((g) =>
    (g.matches || []).some((m) => m.status !== "completed" && m.status !== "forfeit")
  );
  if (bracketMatches.length > 0 && groupIncomplete) {
    issues.push({
      issueId: "knockout-premature",
      severity: SCHEDULE_ISSUE_SEVERITY.CRITICAL,
      type: "unbalanced_schedule",
      message: "Có trận knock-out khi vòng bảng chưa đủ kết quả.",
      affectedMatchIds: bracketMatches.map((m) => m.id).filter(Boolean),
      suggestedFix: "Hoàn tất vòng bảng trước khi mở knock-out.",
    });
  }

  teamMatchCounts.forEach((count, teamId) => {
    if (count > 5) {
      issues.push({
        issueId: `too-many-matches-${teamId}`,
        severity: SCHEDULE_ISSUE_SEVERITY.WARNING,
        type: "unbalanced_schedule",
        message: `Đội ${teamId} thi đấu ${count} trận — có thể mệt.`,
        affectedMatchIds: [],
        suggestedFix: "Xem xét chia nhóm nhỏ hơn hoặc rút ngắn thể thức.",
      });
    }
  });

  const courtUsage = new Map();
  matches.forEach((match) => {
    const court = matchCourtId(match);
    if (court != null) {
      courtUsage.set(String(court), (courtUsage.get(String(court)) || 0) + 1);
    }
  });
  if (courtUsage.size > 1) {
    const counts = [...courtUsage.values()];
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max - min > 3) {
      issues.push({
        issueId: "uneven-courts",
        severity: SCHEDULE_ISSUE_SEVERITY.INFO,
        type: "unbalanced_schedule",
        message: "Phân bổ sân chưa đều giữa các sân.",
        affectedMatchIds: [],
        suggestedFix: "Cân bằng số trận trên mỗi sân.",
      });
    }
  }

  const critical = issues.filter((i) => i.severity === SCHEDULE_ISSUE_SEVERITY.CRITICAL).length;
  const warning = issues.filter((i) => i.severity === SCHEDULE_ISSUE_SEVERITY.WARNING).length;

  return {
    ok: true,
    data: {
      issues,
      summary: { critical, warning, info: issues.length - critical - warning },
    },
    warnings: issues.filter((i) => i.severity !== SCHEDULE_ISSUE_SEVERITY.INFO).map((i) => i.message),
    confidence: critical > 0 ? "low" : warning > 0 ? "medium" : "high",
  };
}
