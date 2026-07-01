import { generateSeed, playerSkill } from "../../tournament-engine/engines/seedEngine.js";
import { AI_CONFIDENCE } from "../constants/aiConfig.js";
import { confidenceFromDataCoverage } from "../scoring/aiScoring.js";
import { explainSeedChoice } from "../explain/aiExplain.js";

function participantConfidence(participant) {
  if (participant.elo != null && Number(participant.matchesPlayed || 0) >= 3) {
    return AI_CONFIDENCE.HIGH;
  }
  if (participant.skillLevel != null || participant.elo != null) {
    return AI_CONFIDENCE.MEDIUM;
  }
  return AI_CONFIDENCE.LOW;
}

/**
 * @param {import('../../tournament-engine/types/tournamentTypes.js').EngineContext} context
 */
export function buildSeedSuggestion(context = {}) {
  const result = generateSeed(context);
  if (!result.ok) {
    return { ok: false, errors: result.errors, warnings: result.warnings };
  }

  const participants = result.data?.participants || [];
  const seeded = participants.filter((p) => p.seed != null);
  const unknownCount = participants.filter(
    (p) => p.elo == null && p.skillLevel == null && !p.manualSeedOverride
  ).length;

  const items = seeded.map((participant) => {
    const confidence = participantConfidence(participant);
    const reasons = [explainSeedChoice(participant, participant.seed, seeded.length)];
    if (participant.seedReason) {
      reasons.push(participant.seedReason);
    }
    const warnings = [];
    if (confidence === AI_CONFIDENCE.LOW) {
      warnings.push("Thiếu dữ liệu lịch sử — seed dựa trên khai báo ban đầu.");
    }

    return {
      playerId: String(participant.id),
      seedRank: participant.seed,
      aiScore: Math.round((participant.seedScore || 0) * 1000) / 10,
      confidence,
      reasons,
      warnings: warnings.length ? warnings : undefined,
      actionPlan: confidence === AI_CONFIDENCE.LOW
        ? "Bổ sung dữ liệu lịch sử hoặc ELO trước khi công bố hạt giống."
        : "Kiểm tra lại thứ tự hạt giống và công bố cho vận động viên.",
    };
  });

  const overallConfidence = confidenceFromDataCoverage({
    total: participants.length,
    withElo: participants.filter((p) => p.elo != null).length,
    withHistory: participants.filter((p) => Number(p.matchesPlayed || 0) >= 3).length,
  });

  const globalWarnings = [...(result.warnings || [])];
  if (unknownCount > 0) {
    globalWarnings.push(
      `${unknownCount}/${participants.length} vận động viên chưa có lịch sử thi đấu. AI đề xuất dùng random có điều kiện nhẹ, kết hợp điểm trình độ khai báo ban đầu để tránh lệch bảng quá lớn.`
    );
  }

  return {
    ok: true,
    data: {
      seeds: items,
      unseeded: participants.filter((p) => p.seed == null).map((p) => String(p.id)),
      unknownCount,
      overallConfidence,
      explanation: result.explain?.join(" ") || "Xếp hạt giống theo ELO, trình độ và lịch sử.",
    },
    warnings: globalWarnings,
    confidence: overallConfidence,
  };
}

export { playerSkill };
