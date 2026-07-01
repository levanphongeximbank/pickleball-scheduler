import {
  generateDraw,
  computeDrawScore,
  mulberry32,
} from "../../tournament-engine/engines/drawEngine.js";
import { GROUP_SUGGESTION_MODE } from "../constants/aiConfig.js";
import { computeBalanceScore, average } from "../scoring/aiScoring.js";
import { explainGroupBalance } from "../explain/aiExplain.js";

function participantRating(participant) {
  if (participant.elo != null) {
    return Number(participant.elo);
  }
  if (participant.skillLevel != null) {
    return Number(participant.skillLevel) * 200;
  }
  return 700;
}

function groupsToSuggestion(groups, participants) {
  const participantMap = new Map(participants.map((p) => [String(p.id), p]));

  return groups.map((group) => {
    const entryIds = group.entryIds || (group.entries || []).map((e) => e.id);
    const members = entryIds.map((id) => participantMap.get(String(id))).filter(Boolean);
    const ratings = members.map(participantRating);
    const avgElo = average(ratings);
    const seedCount = members.filter((m) => m.seed != null && m.seed <= 8).length;
    const warnings = [];
    if (seedCount > 2) {
      warnings.push(`Bảng có ${seedCount} hạt giống mạnh — có thể lệch.`);
    }

    return {
      groupName: group.name || group.label || "?",
      teamIds: entryIds.map(String),
      averageElo: Math.round(avgElo),
      strengthScore: Math.round(avgElo),
      warnings,
      actionPlan: warnings.length > 0
        ? "Theo dõi bảng này kỹ và cân bằng đội nếu cần trước khi bắt đầu."
        : "Giữ bảng này và chuẩn bị các điều kiện vận hành cho vòng đầu.",
    };
  });
}

function analyzeManualGroups(context) {
  const groups = context.groups || [];
  const participants = context.participants || [];
  const suggestionGroups = groupsToSuggestion(groups, participants);
  const avgs = suggestionGroups.map((g) => g.averageElo);
  const balanceScore = computeBalanceScore(avgs);

  return {
    ok: true,
    data: {
      mode: GROUP_SUGGESTION_MODE.MANUAL_REVIEW,
      groups: suggestionGroups,
      overallBalanceScore: balanceScore,
      fairnessScore: balanceScore,
      explanation: explainGroupBalance(suggestionGroups),
    },
    warnings: suggestionGroups.flatMap((g) => g.warnings),
    confidence: balanceScore >= 70 ? "high" : balanceScore >= 50 ? "medium" : "low",
  };
}

/**
 * @param {import('../../tournament-engine/types/tournamentTypes.js').EngineContext} context
 * @param {string} mode
 */
export function buildGroupSuggestion(context = {}, mode = GROUP_SUGGESTION_MODE.COMPETITIVE_BALANCED) {
  if (mode === GROUP_SUGGESTION_MODE.MANUAL_REVIEW) {
    return analyzeManualGroups(context);
  }

  const drawContext = { ...context };
  if (mode === GROUP_SUGGESTION_MODE.LIGHT_RANDOM) {
    drawContext.randomSeed = Date.now() % 100000;
    drawContext.scheduleConfig = {
      ...context.scheduleConfig,
      randomSeed: drawContext.randomSeed,
    };
  }

  const result = generateDraw(drawContext);
  if (!result.ok) {
    return { ok: false, errors: result.errors, warnings: result.warnings };
  }

  const groups = result.data?.groups || [];
  const suggestionGroups = groupsToSuggestion(groups, context.participants || []);
  const avgs = suggestionGroups.map((g) => g.averageElo);
  const balanceScore = computeBalanceScore(avgs);
  const drawScore = result.data?.drawScore ?? computeDrawScore(
    groups.map((g, i) => ({
      label: g.label || String.fromCharCode(65 + i),
      members: (g.entries || []).map((e) => ({
        id: e.id,
        seed: e.seed,
        elo: e.rating,
        clubName: e.clubName,
      })),
    })),
    context.groupCount || groups.length
  );

  const modeLabel = {
    [GROUP_SUGGESTION_MODE.LIGHT_RANDOM]: "Random có điều kiện nhẹ",
    [GROUP_SUGGESTION_MODE.COMPETITIVE_BALANCED]: "Competitive Balanced",
  }[mode] || mode;

  return {
    ok: true,
    data: {
      mode,
      groups: suggestionGroups,
      rawGroups: groups,
      overallBalanceScore: balanceScore,
      fairnessScore: Math.round(drawScore / 10),
      drawScore,
      explanation: `${modeLabel}: ${explainGroupBalance(suggestionGroups)} ${result.explain?.join(" ") || ""}`.trim(),
    },
    warnings: [...(result.warnings || []), ...suggestionGroups.flatMap((g) => g.warnings)],
    confidence: balanceScore >= 75 ? "high" : balanceScore >= 55 ? "medium" : "low",
  };
}

export { mulberry32 };
