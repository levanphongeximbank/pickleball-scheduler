import { MATCH_STAGE } from "../../../models/tournament/constants.js";
import { DEFAULT_TIME_PREDICTION } from "../constants/defaults.js";

function participantRating(participant) {
  if (participant?.elo != null) {
    return Number(participant.elo);
  }
  if (participant?.skillLevel != null) {
    return Number(participant.skillLevel) * 200;
  }
  return 700;
}

function stageBaseMinutes(stage, config) {
  const key = String(stage || "group").toLowerCase();
  const map = {
    [MATCH_STAGE.GROUP]: config.groupStageMinutes,
    [MATCH_STAGE.QUARTERFINAL]: config.quarterfinalMinutes,
    [MATCH_STAGE.SEMIFINAL]: config.semifinalMinutes,
    [MATCH_STAGE.FINAL]: config.finalMinutes,
    [MATCH_STAGE.THIRD_PLACE]: config.thirdPlaceMinutes,
    group: config.groupStageMinutes,
  };
  return map[key] ?? config.groupStageMinutes;
}

function historyAverageMinutes(history = []) {
  if (!history.length) {
    return null;
  }
  const total = history.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
  return total / history.length;
}

/**
 * @param {Object} match
 * @param {Object} [options]
 */
export function predictMatchDuration(match = {}, options = {}) {
  const config = { ...DEFAULT_TIME_PREDICTION, ...options.timeConfig };
  const entryA = options.entryA || {};
  const entryB = options.entryB || {};
  const history = options.history || [];

  const ratingA = participantRating(entryA);
  const ratingB = participantRating(entryB);
  const gap = Math.abs(ratingA - ratingB);

  let minutes = stageBaseMinutes(match.stage || match.bracketStage, config);
  let confidence = 0.5;
  const reasons = [];

  const histAvg = historyAverageMinutes(history);
  if (histAvg != null) {
    minutes = minutes * 0.4 + histAvg * 0.6;
    confidence = Math.min(0.95, 0.5 + history.length * 0.05);
    reasons.push(`Dựa trên ${history.length} trận lịch sử (TB ${Math.round(histAvg)} phút).`);
  } else {
    reasons.push("Chưa có lịch sử — dùng quy tắc mặc định.");
  }

  if (gap < 80) {
    minutes *= 1.15;
    reasons.push("Hai đội cân bằng trình độ → trận có thể kéo dài hơn.");
  } else if (gap > 200) {
    minutes *= 0.85;
    reasons.push("Chênh lệch trình độ lớn → trận có thể kết thúc nhanh hơn.");
  }

  if (Number(config.bestOf) > 1) {
    minutes *= Number(config.bestOf) * 0.75;
    reasons.push(`Thể thức BO${config.bestOf}.`);
  }

  minutes += Number(options.bufferMinutes ?? 5);

  return {
    predictedDurationMinutes: Math.round(minutes),
    confidence: Math.round(confidence * 100) / 100,
    reason: reasons.join(" "),
  };
}

/**
 * @param {import('../types/tournamentTypes.js').EngineContext} context
 */
export function predictTournamentTime(context = {}) {
  const config = { ...DEFAULT_TIME_PREDICTION, ...context.timeConfig };
  const buffer = Number(context.scheduleConfig?.bufferMinutes ?? 5);
  const courts = (context.courts || []).filter((c) => !c.locked);
  const courtCount = Math.max(1, courts.length);
  const matches = context.matches || [];
  const warnings = [];
  const explain = [];

  const entryMap = new Map((context.participants || []).map((p) => [String(p.id), p]));

  let totalMinutes = 0;
  const predictions = matches.map((match) => {
    const entryA = entryMap.get(String(match.entryAId)) || {};
    const entryB = entryMap.get(String(match.entryBId)) || {};
    const prediction = predictMatchDuration(match, {
      entryA,
      entryB,
      bufferMinutes: buffer,
      timeConfig: config,
      history: context.matchHistory || [],
    });
    totalMinutes += prediction.predictedDurationMinutes;
    return {
      matchId: match.id,
      ...prediction,
    };
  });

  const parallelMinutes = Math.ceil(totalMinutes / courtCount);
  const startTime = context.scheduleConfig?.startTime || "08:00";
  const [startH, startM] = startTime.split(":").map(Number);
  const finishMinutes = (startH || 0) * 60 + (startM || 0) + parallelMinutes;
  const finishH = Math.floor(finishMinutes / 60) % 24;
  const finishM = finishMinutes % 60;
  const estimatedFinishTime = `${String(finishH).padStart(2, "0")}:${String(finishM).padStart(2, "0")}`;

  const endTime = context.scheduleConfig?.endTime;
  if (endTime) {
    const [endH, endM] = endTime.split(":").map(Number);
    const endMinutes = (endH || 0) * 60 + (endM || 0);
    if (finishMinutes > endMinutes) {
      warnings.push(
        `Dự kiến kết thúc ${estimatedFinishTime} vượt khung giờ ${endTime}. Cần thêm sân hoặc rút thời lượng.`
      );
    }
  }

  explain.push(
    `${matches.length} trận, ${courtCount} sân → ~${parallelMinutes} phút song song.`,
    `Tổng thời lượng tuần tự: ${totalMinutes} phút.`
  );

  return {
    ok: true,
    data: {
      predictions,
      totalTournamentEstimatedTime: parallelMinutes,
      totalSequentialMinutes: totalMinutes,
      estimatedFinishTime,
    },
    warnings,
    explain,
  };
}
