/*
==========================================================
AI Scoring Engine V2
Decision Engine
==========================================================
*/

import { AI_CONFIG } from "./config.js";

function getTeamTotal(team) {
  return team.reduce(
    (sum, player) => sum + Number(player?.level || 0),
    0
  );
}

function normalizeGender(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["nam", "male", "m"].includes(raw)) {
    return "male";
  }
  if (["nữ", "nu", "female", "f"].includes(raw)) {
    return "female";
  }
  return "unknown";
}

function getPairs(team = []) {
  const pairs = [];

  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      pairs.push([team[i], team[j]]);
    }
  }

  return pairs;
}

function getPlayerHistory(history, playerId) {
  if (!history[playerId]) {
    return {
      games: 0,
      partners: {},
      opponents: {},
    };
  }

  return history[playerId];
}

function calculateLevelScore(diff) {
  let score = 100 - diff * AI_CONFIG.scoring.levelScoreMultiplier;

  if (score < 0) {
    score = 0;
  }

  return score;
}

function calculateHistoryScore(option, history = {}) {
  let penalty = 0;

  const teamA = option.teamA || [];
  const teamB = option.teamB || [];

  // Trừ điểm nếu đã từng là đồng đội
  getPairs(teamA).forEach(([p1, p2]) => {
    const h = getPlayerHistory(history, p1.id);
    penalty += (h.partners[p2.id] || 0) * AI_CONFIG.penalties.repeatedPartner;
  });

  getPairs(teamB).forEach(([p1, p2]) => {
    const h = getPlayerHistory(history, p1.id);
    penalty += (h.partners[p2.id] || 0) * AI_CONFIG.penalties.repeatedPartner;
  });

  // Trừ điểm nếu đã gặp đối thủ nhiều lần
  teamA.forEach((playerA) => {
    const h = getPlayerHistory(history, playerA.id);

    teamB.forEach((playerB) => {
      penalty += (h.opponents[playerB.id] || 0) * AI_CONFIG.penalties.repeatedOpponent;
    });
  });

  let score = 100 - penalty;

  if (score < AI_CONFIG.penalties.minScore) {
    score = AI_CONFIG.penalties.minScore;
  }

  return score;
}

function calculateWaitingScore(option, context = {}) {
  const waitingSnapshot = context.waitingSnapshot || context.waitingData || {};
  const players = [...(option.teamA || []), ...(option.teamB || [])];

  if (players.length === 0) {
    return 100;
  }

  const maxWaitCount = Number(AI_CONFIG.thresholds.maxWaitCountForScore) || 5;
  const playCountStep = Number(AI_CONFIG.thresholds.playCountPenaltyStep) || 10;

  let totalScore = 0;

  players.forEach((player) => {
    const stats = waitingSnapshot[player.id] || { waitCount: 0, playCount: 0 };
    const waitScore = Math.min(100, (Math.max(0, stats.waitCount) / maxWaitCount) * 100);
    const playFairness = Math.max(0, 100 - Math.max(0, stats.playCount) * playCountStep);
    totalScore += waitScore * 0.7 + playFairness * 0.3;
  });

  return Math.round(totalScore / players.length);
}

function calculateCompetitionScore(option, competition = {}) {
  if (!competition.requiresMixedPairs) {
    return 100;
  }

  const teamA = option.teamA || [];
  const teamB = option.teamB || [];

  const isMixedTeam = (team) => {
    if (!Array.isArray(team) || team.length !== 2) {
      return false;
    }

    const genders = team.map((player) => normalizeGender(player?.gender));
    return genders.includes("male") && genders.includes("female");
  };

  let penalty = 0;
  if (!isMixedTeam(teamA)) {
    penalty += AI_CONFIG.scoring.mixedPairPenalty;
  }

  if (!isMixedTeam(teamB)) {
    penalty += AI_CONFIG.scoring.mixedPairPenalty;
  }

  return Math.max(0, 100 - penalty);
}

function calculateRuleScore(option, context = {}, diff = 0) {
  const rules = Array.isArray(context.rules) ? context.rules : [];
  const history = context.history || {};

  if (rules.length === 0) {
    return 100;
  }

  let penalty = 0;

  rules.forEach((rule) => {
    if (!rule || rule.enabled === false) {
      return;
    }

    if (rule.type === "team_level_diff_limit") {
      const defaults = AI_CONFIG.ruleDefaults.team_level_diff_limit;
      const maxDiff = Number(rule.maxDiff ?? defaults.maxDiff);
      const overDiffPenalty = Number(rule.penalty ?? defaults.penalty);

      if (diff > maxDiff) {
        penalty += overDiffPenalty;
      }
    }

    if (rule.type === "max_partner_repeat") {
      const defaults = AI_CONFIG.ruleDefaults.max_partner_repeat;
      const maxTimes = Number(rule.maxTimes ?? defaults.maxTimes);
      const partnerPenalty = Number(rule.penalty ?? defaults.penalty);
      const pairs = [
        ...getPairs(option.teamA || []),
        ...getPairs(option.teamB || []),
      ];

      pairs.forEach(([p1, p2]) => {
        if (!p1 || !p2) {
          return;
        }

        const p1History = getPlayerHistory(history, p1.id);
        const repeated = p1History.partners[p2.id] || 0;

        if (repeated > maxTimes) {
          penalty += (repeated - maxTimes) * partnerPenalty;
        }
      });
    }

    if (rule.type === "max_opponent_repeat") {
      const defaults = AI_CONFIG.ruleDefaults.max_opponent_repeat;
      const maxTimes = Number(rule.maxTimes ?? defaults.maxTimes);
      const opponentPenalty = Number(rule.penalty ?? defaults.penalty);

      (option.teamA || []).forEach((playerA) => {
        const h = getPlayerHistory(history, playerA.id);

        (option.teamB || []).forEach((playerB) => {
          const repeated = h.opponents[playerB.id] || 0;

          if (repeated > maxTimes) {
            penalty += (repeated - maxTimes) * opponentPenalty;
          }
        });
      });
    }
  });

  return Math.max(0, 100 - penalty);
}

function calculatePolicyScore(option = {}, context = {}) {
  const policies = context.policies || [];

  return policies.reduce((score, policy) => {
    if (!policy || policy.enabled === false) {
      return score;
    }

    if (policy.type === "prefer_teammate") {
      const hasPair = policy.playerA && policy.playerB;
      const inTeamAPlayerA = option.teamA?.some((player) => player.id === policy.playerA);
      const inTeamAPlayerB = option.teamA?.some((player) => player.id === policy.playerB);
      const inTeamBPlayerA = option.teamB?.some((player) => player.id === policy.playerA);
      const inTeamBPlayerB = option.teamB?.some((player) => player.id === policy.playerB);

      if (!hasPair) {
        return score;
      }

      const isSameTeam =
        (inTeamAPlayerA && inTeamAPlayerB) ||
        (inTeamBPlayerA && inTeamBPlayerB);

      if (isSameTeam) {
        return score + AI_CONFIG.scoring.preferTeammateBonus;
      }

      const isOppositeTeams =
        (inTeamAPlayerA && inTeamBPlayerB) ||
        (inTeamBPlayerA && inTeamAPlayerB);

      if (isOppositeTeams) {
        return score - AI_CONFIG.scoring.preferTeammatePenalty;
      }

      return score;
    }

    return score;
  }, 0);
}

export function calculatePairScore(
  option,
  context = {}
) {
  const history = context.history || {};

  const teamATotal = getTeamTotal(option.teamA);
  const teamBTotal = getTeamTotal(option.teamB);

  const diff = Math.abs(teamATotal - teamBTotal);
  if (diff > AI_CONFIG.thresholds.levelDiffAllowed) {
  return {
    totalScore: -AI_CONFIG.penalties.largeLevelDiff,
    levelScore: 0,
    historyScore: 0,
    waitingScore: 0,
    ruleScore: 0,
    policyScore: 0,
    competitionScore: 0,
    teamATotal,
    teamBTotal,
    diff,
  };
}

  const levelScore = calculateLevelScore(diff);
  const historyScore = calculateHistoryScore(
    option,
    history
  );
  const waitingScore = calculateWaitingScore(option, context);
  const ruleScore = calculateRuleScore(option, context, diff);
  const policyScore = calculatePolicyScore(option, context);
  const competitionScore = calculateCompetitionScore(option, context.competition || {});

  const totalScore =
    levelScore * AI_CONFIG.weights.level +
    historyScore * AI_CONFIG.weights.history +
    waitingScore * AI_CONFIG.weights.waiting +
    ruleScore * AI_CONFIG.weights.rules +
    policyScore * AI_CONFIG.weights.policy +
    competitionScore * AI_CONFIG.weights.competition;

  const totalWeight =
    AI_CONFIG.weights.level +
    AI_CONFIG.weights.history +
    AI_CONFIG.weights.waiting +
    AI_CONFIG.weights.rules +
    AI_CONFIG.weights.policy +
    AI_CONFIG.weights.competition;

  const normalizedTotalScore = totalWeight > 0 ? totalScore / totalWeight : totalScore;

  return {
    totalScore: normalizedTotalScore,
    levelScore,
    historyScore,
    waitingScore,
    ruleScore,
    policyScore,
    competitionScore,
    teamATotal,
    teamBTotal,
    diff,
  };
}

function averageScore(courts, selector, fallback = 100) {
  if (!courts || courts.length === 0) {
    return 0;
  }

  const total = courts.reduce((sum, court) => {
    const value = selector(court);
    return sum + (typeof value === "number" ? value : fallback);
  }, 0);

  return Math.round(total / courts.length);
}

export function calculateAIScore(courts, waitingCount = 0, playersPerCourt = 4) {
  void waitingCount;
  void playersPerCourt;
  if (!courts || courts.length === 0) {
    return {
      total: 0,
      balance: 0,
      history: 0,
      waiting: 0,
      rules: 0,
      policy: 0,
      competition: 0,
    };
  }

  const total = Math.max(
    0,
    averageScore(courts, (court) => court.score ?? 0, 0)
  );

  const balance = Math.max(
    0,
    averageScore(courts, (court) => court.detailScore?.levelScore ?? court.score ?? 0, 0)
  );

  const history = Math.max(
    0,
    averageScore(courts, (court) => court.detailScore?.historyScore ?? court.score ?? 0, 0)
  );

  const rules = Math.max(
    0,
    averageScore(courts, (court) => court.detailScore?.ruleScore ?? 100, 100)
  );

  const policy = Math.max(
    0,
    averageScore(courts, (court) => {
      const raw = court.detailScore?.policyScore;
      if (typeof raw === "number") {
        return Math.max(0, Math.min(100, 100 + raw));
      }
      return 100;
    }, 100)
  );

  const competition = Math.max(
    0,
    averageScore(courts, (court) => court.detailScore?.competitionScore ?? 100, 100)
  );

  const waiting = courts.length > 0
    ? Math.max(
      0,
      Math.min(
        100,
        Math.round(
          averageScore(
            courts,
            (court) => court.detailScore?.waitingScore ?? court.score ?? 0,
            0
          )
        )
      )
    )
    : 0;

  return {
    total,
    balance,
    history,
    waiting,
    rules,
    policy,
    competition,
  };
}