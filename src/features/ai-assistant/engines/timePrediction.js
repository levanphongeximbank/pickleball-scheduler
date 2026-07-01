import { predictTournamentTime } from "../../tournament-engine/engines/timePredictionEngine.js";
import { DEFAULT_TIME_FORMULA } from "../constants/aiConfig.js";
import { explainTimePrediction } from "../explain/aiExplain.js";

function countRoundRobinMatches(teamCount) {
  if (teamCount < 2) {
    return 0;
  }
  return (teamCount * (teamCount - 1)) / 2;
}

function countGroupStageMatches(groups = []) {
  return groups.reduce((sum, group) => {
    const n = group.entryIds?.length || group.entries?.length || 0;
    return sum + countRoundRobinMatches(n);
  }, 0);
}

function estimateKnockoutMatches(teamCount) {
  if (teamCount < 2) {
    return 0;
  }
  let matches = 0;
  let remaining = teamCount;
  while (remaining > 1) {
    matches += Math.floor(remaining / 2);
    remaining = Math.ceil(remaining / 2);
  }
  return matches;
}

function formulaFallback(context = {}) {
  const formula = { ...DEFAULT_TIME_FORMULA, ...context.timeFormula };
  const groups = context.groups || [];
  const courtCount = Math.max(1, (context.courts || []).filter((c) => !c.locked).length);
  const groupMatches = context.matches?.length || countGroupStageMatches(groups);
  const teamCount = (context.participants || []).length;
  const knockoutMatches = estimateKnockoutMatches(Math.max(2, Math.ceil(teamCount / 2)));
  const totalMatches = groupMatches || countGroupStageMatches(groups) + knockoutMatches;

  const pointsToWin = context.scheduleConfig?.pointsToWin || 11;
  let baseMatchMinutes = formula.baseMatchMinutes;
  if (pointsToWin >= 15) {
    baseMatchMinutes = 18;
  } else if (pointsToWin <= 11) {
    baseMatchMinutes = 12;
  }

  const bestOf = Number(context.scheduleConfig?.bestOf || 1);
  if (bestOf > 1) {
    baseMatchMinutes *= bestOf * 0.75;
  }

  const estimatedMatchMinutes = baseMatchMinutes + formula.bufferMinutes;
  const totalCourtMinutes = totalMatches * estimatedMatchMinutes;
  const parallelMinutes = Math.ceil(totalCourtMinutes / courtCount);
  const delayBuffer = Math.round(parallelMinutes * formula.delayBufferPercent);
  const finalEstimate =
    parallelMinutes + formula.openingBuffer + formula.knockoutBuffer + delayBuffer;

  const warnings = [];
  const endTime = context.scheduleConfig?.endTime;
  const startTime = context.scheduleConfig?.startTime || "08:00";
  const [startH, startM] = startTime.split(":").map(Number);
  const finishMinutes = (startH || 0) * 60 + (startM || 0) + finalEstimate;
  const finishH = Math.floor(finishMinutes / 60) % 24;
  const finishMin = finishMinutes % 60;
  const estimatedFinishTime = `${String(finishH).padStart(2, "0")}:${String(finishMin).padStart(2, "0")}`;

  let exceedsWindow = false;
  if (endTime) {
    const [endH, endM] = endTime.split(":").map(Number);
    const endMinutes = (endH || 0) * 60 + (endM || 0);
    if (finishMinutes > endMinutes) {
      exceedsWindow = true;
      const over = finishMinutes - endMinutes;
      warnings.push(
        `Giải dự kiến kết thúc ${estimatedFinishTime}, vượt khung thuê sân ${endTime} ${over} phút.`
      );
    }
  }

  return {
    ok: true,
    data: {
      totalMatches,
      averageMatchMinutes: Math.round(estimatedMatchMinutes),
      minTotalMinutes: Math.round(parallelMinutes + formula.openingBuffer),
      reasonableTotalMinutes: finalEstimate,
      riskTotalMinutes: finalEstimate + Math.round(delayBuffer * 0.5),
      estimatedFinishTime,
      totalCourtMinutes,
      courtCount,
      explanation: explainTimePrediction({
        matchCount: totalMatches,
        courtCount,
        estimatedMinutes: finalEstimate,
        endTime,
        exceedsWindow,
      }),
      formulaUsed: true,
      actionPlan: exceedsWindow
        ? "Rút ngắn thời lượng trận hoặc đổi khung giờ để khớp với thuê sân."
        : "Giữ lịch hiện tại và theo dõi tiến độ thực tế trong ngày thi đấu.",
    },
    warnings,
    confidence: "medium",
  };
}

/**
 * @param {import('../../tournament-engine/types/tournamentTypes.js').EngineContext} context
 */
export function buildTimePrediction(context = {}) {
  const hasMatches = (context.matches || []).length > 0;

  if (hasMatches) {
    const result = predictTournamentTime(context);
    if (!result.ok) {
      return formulaFallback(context);
    }

    const parallel = result.data?.totalTournamentEstimatedTime || 0;
    const formula = { ...DEFAULT_TIME_FORMULA };
    const delayBuffer = Math.round(parallel * formula.delayBufferPercent);
    const finalEstimate = parallel + formula.openingBuffer + formula.knockoutBuffer + delayBuffer;

    return {
      ok: true,
      data: {
        totalMatches: (context.matches || []).length,
        averageMatchMinutes: Math.round(parallel / Math.max(1, (context.matches || []).length)),
        minTotalMinutes: parallel + formula.openingBuffer,
        reasonableTotalMinutes: finalEstimate,
        riskTotalMinutes: finalEstimate + delayBuffer,
        estimatedFinishTime: result.data?.estimatedFinishTime,
        predictions: result.data?.predictions,
        explanation: result.explain?.join(" ") || explainTimePrediction({
          matchCount: (context.matches || []).length,
          courtCount: Math.max(1, (context.courts || []).filter((c) => !c.locked).length),
          estimatedMinutes: finalEstimate,
          endTime: context.scheduleConfig?.endTime,
          exceedsWindow: (result.warnings || []).length > 0,
        }),
        formulaUsed: false,
        actionPlan: (result.warnings || []).length > 0
          ? "Điều chỉnh lịch hoặc giảm số vòng đấu để tránh chậm hết khung giờ."
          : "Giữ lịch hiện tại và chỉ cập nhật nếu tình hình thực tế vượt dự báo.",
      },
      warnings: result.warnings || [],
      confidence: (context.matchHistory || []).length > 5 ? "high" : "medium",
    };
  }

  return formulaFallback(context);
}
