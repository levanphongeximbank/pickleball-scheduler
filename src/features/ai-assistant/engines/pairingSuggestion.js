import { getPlayerGenderKey } from "../../../models/player.js";
import { EVENT_TYPE } from "../../../models/tournament/constants.js";
import { suggestTeamsFromPlayers } from "../../../tournament/engines/teamPairingEngine.js";
import { PAIRING_STRATEGY } from "../constants/aiConfig.js";
import { computeFairnessScore, average } from "../scoring/aiScoring.js";

function playerRating(player) {
  if (player?.elo != null) {
    return Number(player.elo);
  }
  return Number(player?.rating ?? player?.level ?? player?.skillLevel ?? 3.5) * 200;
}

function filterActivePlayers(players = []) {
  return players.filter((p) => !["absent", "inactive", "injured"].includes(String(p.status)));
}

function countGenders(players = []) {
  let male = 0;
  let female = 0;
  players.forEach((p) => {
    const g = getPlayerGenderKey(p.gender);
    if (g === "male") {
      male += 1;
    } else if (g === "female") {
      female += 1;
    }
  });
  return { male, female };
}

function buildBalancedPairs(players, randomFn = Math.random) {
  const sorted = [...players].sort((a, b) => playerRating(b) - playerRating(a));
  const teams = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i += 1) {
    if (used.has(sorted[i].id)) {
      continue;
    }
    let partner = null;
    for (let j = sorted.length - 1; j > i; j -= 1) {
      if (!used.has(sorted[j].id)) {
        partner = sorted[j];
        break;
      }
    }
    if (!partner) {
      break;
    }
    used.add(sorted[i].id);
    used.add(partner.id);
    const scores = [playerRating(sorted[i]), playerRating(partner)];
    teams.push({
      playerIds: [String(sorted[i].id), String(partner.id)],
      combinedScore: average(scores),
      confidence: "medium",
      reasons: [
        `Ghép ${sorted[i].name} (mạnh hơn) với ${partner.name} để cân bằng tổng điểm đội.`,
      ],
      actionPlan: "Xem trước đội hình và đổi người nếu cần giữ sự cân bằng giữa các cặp.",
    });
  }

  if (randomFn() > 0.5 && teams.length > 1) {
    const swap = Math.floor(randomFn() * teams.length);
    teams[swap].reasons.push("Đảo nhẹ vị trí để giữ tính ngẫu nhiên.");
  }

  return teams;
}

function buildSameLevelPairs(players) {
  const sorted = [...players].sort((a, b) => playerRating(b) - playerRating(a));
  const teams = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const a = sorted[i];
    const b = sorted[i + 1];
    teams.push({
      playerIds: [String(a.id), String(b.id)],
      combinedScore: average([playerRating(a), playerRating(b)]),
      confidence: "high",
      reasons: [`Ghép cùng trình độ: ${a.name} và ${b.name}.`],
      actionPlan: "Duy trì cặp này nếu giải đấu ưu tiên sự công bằng của trình độ.",
    });
  }
  return teams;
}

function buildMixedGenderPairs(players) {
  const males = players.filter((p) => getPlayerGenderKey(p.gender) === "male");
  const females = players.filter((p) => getPlayerGenderKey(p.gender) === "female");
  const sortedM = [...males].sort((a, b) => playerRating(b) - playerRating(a));
  const sortedF = [...females].sort((a, b) => playerRating(b) - playerRating(a));
  const count = Math.min(sortedM.length, sortedF.length);
  const teams = [];

  for (let i = 0; i < count; i += 1) {
    const male = sortedM[i];
    const female = sortedF[count - 1 - i];
    teams.push({
      playerIds: [String(male.id), String(female.id)],
      combinedScore: average([playerRating(male), playerRating(female)]),
      confidence: "high",
      reasons: [`Đội nam-nữ: ${male.name} + ${female.name}, cân bằng trình độ.`],
      actionPlan: "Giữ cặp này nếu mục tiêu là tạo đội nam-nữ cân đối.",
    });
  }

  return teams;
}

function buildAvoidRepeatPairs(players, partnerHistory = {}) {
  const sorted = [...players].sort((a, b) => playerRating(b) - playerRating(a));
  const used = new Set();
  const teams = [];
  const warnings = [];

  sorted.forEach((player) => {
    if (used.has(player.id)) {
      return;
    }
    const history = partnerHistory[String(player.id)] || {};
    let best = null;
    let bestPenalty = Infinity;

    sorted.forEach((candidate) => {
      if (candidate.id === player.id || used.has(candidate.id)) {
        return;
      }
      const key = [String(player.id), String(candidate.id)].sort().join("|");
      const times = history[key] || history[String(candidate.id)] || 0;
      const penalty = times * 100 + Math.abs(playerRating(player) - playerRating(candidate));
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = candidate;
      }
    });

    if (!best) {
      return;
    }

    const repeatCount = (partnerHistory[String(player.id)] || {})[String(best.id)] || 0;
    if (repeatCount > 1) {
      warnings.push(`${player.name} và ${best.name} đã chơi cùng ${repeatCount} lần.`);
    }

    used.add(player.id);
    used.add(best.id);
    teams.push({
      playerIds: [String(player.id), String(best.id)],
      combinedScore: average([playerRating(player), playerRating(best)]),
      confidence: repeatCount > 0 ? "medium" : "high",
      reasons: [
        repeatCount > 0
          ? `Ghép lại (đã ${repeatCount} lần) vì không còn lựa chọn tốt hơn.`
          : `Tránh lặp partner — ghép ${player.name} với ${best.name}.`,
      ],
      actionPlan: repeatCount > 0
        ? "Đánh giá lại nếu muốn giảm lặp cặp giữa các vòng thi."
        : "Áp dụng cặp này và theo dõi phản hồi người chơi.",
    });
  });

  return { teams, warnings };
}

/**
 * @param {Object} context
 * @param {string} strategy
 */
export function buildPairingSuggestion(context = {}, strategy = PAIRING_STRATEGY.BALANCED) {
  const players = filterActivePlayers(context.players || []);
  const eventType = context.eventType || EVENT_TYPE.MIXED_DOUBLE;
  const warnings = [];
  const { male, female } = countGenders(players);

  if (players.length < 2) {
    return { ok: false, errors: ["Cần ít nhất 2 người chơi để ghép cặp."] };
  }

  if (eventType === EVENT_TYPE.MIXED_DOUBLE && Math.abs(male - female) > 1) {
    warnings.push(`Số nam (${male}) và nữ (${female}) không cân bằng.`);
  }

  const noRating = players.filter((p) => p.elo == null && p.rating == null && p.level == null);
  if (noRating.length > 0) {
    warnings.push(`${noRating.length} người chưa có điểm trình độ.`);
  }

  let teams;

  if (strategy === PAIRING_STRATEGY.MIXED_GENDER || eventType === EVENT_TYPE.MIXED_DOUBLE) {
    teams = buildMixedGenderPairs(players);
  } else if (strategy === PAIRING_STRATEGY.SAME_LEVEL) {
    teams = buildSameLevelPairs(players);
  } else if (strategy === PAIRING_STRATEGY.AVOID_REPEAT) {
    const result = buildAvoidRepeatPairs(players, context.partnerHistory || {});
    teams = result.teams;
    warnings.push(...result.warnings);
  } else if (strategy === PAIRING_STRATEGY.LIGHT_RANDOM) {
    const legacy = suggestTeamsFromPlayers(players, eventType, { mode: "random" });
    teams = legacy.map((team) => ({
      teamId: team.id,
      playerIds: (team.members || []).map((m) => String(m.id)),
      combinedScore: average((team.members || []).map(playerRating)),
      confidence: "medium",
      reasons: [`Bốc thăm có điều kiện: ${team.name}.`],
      actionPlan: "Dùng làm bản dự thảo và chỉnh lại nếu người chơi phản hồi bất lợi.",
    }));
  } else {
    teams = buildBalancedPairs(players);
  }

  const teamScores = teams.map((t) => t.combinedScore);
  const fairnessScore = computeFairnessScore(teamScores);

  if (fairnessScore < 50) {
    warnings.push("Có đội quá mạnh hoặc quá yếu so với trung bình.");
  }

  const strategyLabels = {
    [PAIRING_STRATEGY.BALANCED]: "Cân bằng sức mạnh",
    [PAIRING_STRATEGY.SAME_LEVEL]: "Cùng trình độ",
    [PAIRING_STRATEGY.MIXED_GENDER]: "Nam + nữ",
    [PAIRING_STRATEGY.AVOID_REPEAT]: "Tránh lặp partner",
    [PAIRING_STRATEGY.LIGHT_RANDOM]: "Random có điều kiện",
  };

  return {
    ok: true,
    data: {
      strategy,
      teams,
      fairnessScore,
      warnings,
      explanation: `Chiến lược "${strategyLabels[strategy] || strategy}": ${teams.length} đội, fairness ${fairnessScore}/100.`,
    },
    warnings,
    confidence: fairnessScore >= 75 ? "high" : fairnessScore >= 55 ? "medium" : "low",
  };
}
