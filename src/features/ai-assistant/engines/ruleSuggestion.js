import { buildTimePrediction } from "./timePrediction.js";
import { buildGroupSuggestion } from "./groupSuggestion.js";
import { GROUP_SUGGESTION_MODE } from "../constants/aiConfig.js";

function skillSpread(participants = []) {
  const ratings = participants
    .map((p) => p.elo ?? (p.skillLevel != null ? p.skillLevel * 200 : null))
    .filter((v) => v != null);
  if (ratings.length < 2) {
    return 0;
  }
  return Math.max(...ratings) - Math.min(...ratings);
}

/**
 * @param {import('../../tournament-engine/types/tournamentTypes.js').EngineContext} context
 */
export function buildRuleSuggestions(context = {}) {
  const suggestions = [];
  const participants = context.participants || [];
  const courtCount = Math.max(1, (context.courts || []).filter((c) => !c.locked).length);
  const teamCount = participants.length;
  const groupCount = Number(context.groupCount || 4);
  const timeResult = buildTimePrediction(context);
  const estimatedMinutes = timeResult.data?.reasonableTotalMinutes || 0;
  const endTime = context.scheduleConfig?.endTime;
  const startTime = context.scheduleConfig?.startTime || "08:00";
  const pointsToWin = context.scheduleConfig?.pointsToWin || 11;
  const bestOf = Number(context.scheduleConfig?.bestOf || 1);

  const [startH, startM] = startTime.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  let windowMinutes = 300;
  if (endTime) {
    const [endH, endM] = endTime.split(":").map(Number);
    windowMinutes = (endH || 0) * 60 + (endM || 0) - startMinutes;
  }

  if (estimatedMinutes > windowMinutes) {
    const saving = Math.round(estimatedMinutes - windowMinutes);
    suggestions.push({
      suggestionId: `rule-reduce-points-${context.tournamentId}`,
      title: "Giảm điểm mỗi set",
      reason: `Giải dự kiến ${estimatedMinutes} phút, vượt khung ${windowMinutes} phút.`,
      impact: { timeSavingMinutes: Math.min(saving, 45), complexityChange: "lower" },
      recommendation:
        pointsToWin > 11
          ? `Giảm điểm mỗi set từ ${pointsToWin} xuống 11.`
          : "Chỉ đánh 1 set ở vòng bảng, knock-out BO1, chung kết BO3.",
      canAutoApply: false,
    });
  }

  if (bestOf > 1 && estimatedMinutes > windowMinutes * 0.9) {
    suggestions.push({
      suggestionId: `rule-bo1-group-${context.tournamentId}`,
      title: "Rút gọn best-of vòng bảng",
      reason: "Best of 3 làm giải quá dài so với khung giờ.",
      impact: { timeSavingMinutes: 30, complexityChange: "lower" },
      recommendation: "Vòng bảng BO1, knock-out BO1, chung kết BO3.",
      canAutoApply: false,
    });
  }

  const matchCount = timeResult.data?.totalMatches || 0;
  const matchesPerCourt = matchCount / courtCount;
  if (matchesPerCourt > 12) {
    suggestions.push({
      suggestionId: `rule-more-courts-${context.tournamentId}`,
      title: "Tăng số sân",
      reason: `${matchCount} trận trên ${courtCount} sân (~${Math.round(matchesPerCourt)} trận/sân).`,
      impact: { timeSavingMinutes: Math.round(estimatedMinutes * 0.2), complexityChange: "same" },
      recommendation: `Thêm ít nhất ${Math.ceil(matchCount / 10) - courtCount} sân hoặc giảm số đội.`,
      canAutoApply: false,
    });
  }

  const groupReview = buildGroupSuggestion(context, GROUP_SUGGESTION_MODE.MANUAL_REVIEW);
  if (groupReview.ok && groupReview.data?.overallBalanceScore < 60) {
    suggestions.push({
      suggestionId: `rule-rebalance-groups-${context.tournamentId}`,
      title: "Chia bảng lại",
      reason: "Chia bảng hiện tại chưa cân bằng.",
      impact: { fairnessImprovement: 20, complexityChange: "same" },
      recommendation: "Dùng random có điều kiện nhẹ hoặc competitive balanced.",
      canAutoApply: false,
    });
  }

  const unknown = participants.filter((p) => p.elo == null && p.skillLevel == null).length;
  if (unknown > participants.length * 0.3) {
    suggestions.push({
      suggestionId: `rule-temp-seeds-${context.tournamentId}`,
      title: "Hạt giống tạm thời",
      reason: `${unknown}/${participants.length} VĐV chưa có dữ liệu ELO.`,
      impact: { fairnessImprovement: 15, complexityChange: "same" },
      recommendation: "Dùng self-rating hoặc random có điều kiện nhẹ thay vì seed cứng.",
      canAutoApply: false,
    });
  }

  const spread = skillSpread(participants);
  if (spread > 400) {
    suggestions.push({
      suggestionId: `rule-split-levels-${context.tournamentId}`,
      title: "Tách giải theo trình độ",
      reason: `Chênh lệch trình độ lớn (~${Math.round(spread)} điểm ELO).`,
      impact: { fairnessImprovement: 30, complexityChange: "higher" },
      recommendation: "Tách Beginner và Intermediate thành 2 bảng/giải riêng.",
      canAutoApply: false,
    });
  }

  const teamsPerGroup = Math.ceil(teamCount / groupCount);
  if (teamsPerGroup > 6) {
    suggestions.push({
      suggestionId: `rule-more-groups-${context.tournamentId}`,
      title: "Tăng số bảng",
      reason: `Mỗi bảng ~${teamsPerGroup} đội — quá nhiều trận vòng bảng.`,
      impact: { timeSavingMinutes: 20, complexityChange: "same" },
      recommendation: `Tăng từ ${groupCount} lên ${groupCount + 2} bảng.`,
      canAutoApply: false,
    });
  }

  const isPowerOfTwo = teamCount > 0 && (teamCount & (teamCount - 1)) === 0;
  if (teamCount > 4 && !isPowerOfTwo) {
    suggestions.push({
      suggestionId: `rule-playoff-${context.tournamentId}`,
      title: "Thêm vòng play-off",
      reason: `${teamCount} đội không phù hợp bracket knock-out chuẩn.`,
      impact: { complexityChange: "higher" },
      recommendation: "Thêm vòng play-off hoặc giảm/xóa đội để đủ lũy thừa 2.",
      canAutoApply: false,
    });
  }

  return {
    ok: true,
    data: { suggestions },
    warnings: [],
    confidence: suggestions.length > 3 ? "medium" : "high",
  };
}
