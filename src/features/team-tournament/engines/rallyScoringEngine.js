import { SCORING_SYSTEM } from "../constants.js";

const DEFAULT_RULES = {
  targetScore: 21,
  winBy: 2,
  freezeAt: 20,
  sideSwitchAt: 11,
};

export function normalizeRallyRules(scoringFormat = {}) {
  return {
    targetScore: Number(scoringFormat.targetScore) || DEFAULT_RULES.targetScore,
    winBy: Number(scoringFormat.winBy) || DEFAULT_RULES.winBy,
    freezeAt: Number(scoringFormat.freezeAt) || DEFAULT_RULES.freezeAt,
    sideSwitchAt: Number(scoringFormat.sideSwitchAt) || DEFAULT_RULES.sideSwitchAt,
  };
}

export function isRallyScoring(discipline) {
  return discipline?.scoringFormat?.scoringSystem === SCORING_SYSTEM.RALLY;
}

export function getRallyWinner(scoreA, scoreB, rules = DEFAULT_RULES) {
  const normalized = normalizeRallyRules(rules);
  const a = Number(scoreA) || 0;
  const b = Number(scoreB) || 0;

  if (a === b) {
    return "";
  }

  const leader = Math.max(a, b);
  const trailer = Math.min(a, b);

  if (leader < normalized.targetScore) {
    return "";
  }

  if (leader - trailer < normalized.winBy) {
    return "";
  }

  return a > b ? "teamA" : "teamB";
}

export function validateRallyScore({ scoreA, scoreB, rules = DEFAULT_RULES }) {
  const normalized = normalizeRallyRules(rules);
  const a = Number(scoreA) || 0;
  const b = Number(scoreB) || 0;

  if (a < 0 || b < 0) {
    return { ok: false, error: "Điểm số không được âm." };
  }

  if (a === b) {
    return { ok: false, error: "Hai bên không được bằng điểm khi xác nhận kết quả." };
  }

  const winner = getRallyWinner(a, b, normalized);
  if (!winner) {
    return {
      ok: false,
      error: `Tỷ số không hợp lệ. Cần đạt ${normalized.targetScore} điểm và thắng cách ${normalized.winBy} điểm (VD: 21-19, 22-20).`,
    };
  }

  const freezeError = validateFreezeScenario(a, b, normalized);
  if (freezeError) {
    return { ok: false, error: freezeError };
  }

  return { ok: true, winnerSide: winner };
}

function validateFreezeScenario(scoreA, scoreB, rules) {
  const { freezeAt, targetScore, winBy } = rules;
  const winner = scoreA > scoreB ? "A" : "B";
  const winScore = Math.max(scoreA, scoreB);
  const loseScore = Math.min(scoreA, scoreB);

  if (winScore !== targetScore) {
    return null;
  }

  if (loseScore === freezeAt) {
    return `Không hợp lệ với Freeze @${freezeAt}: đội dẫn ${freezeAt} không thể thắng ${targetScore}-${freezeAt} khi không cầm giao bóng. Thử ${targetScore + 1}-${freezeAt} hoặc ${freezeAt}-${freezeAt} rồi tiếp.`;
  }

  if (loseScore === freezeAt - 1 && winScore === targetScore) {
    return null;
  }

  if (loseScore >= freezeAt && winScore - loseScore < winBy) {
    return `Cần thắng cách ${winBy} điểm.`;
  }

  return null;
}

export function getRallyScoringHints(discipline) {
  if (!isRallyScoring(discipline)) {
    return "";
  }

  const rules = normalizeRallyRules(discipline.scoringFormat);
  const parts = [
    `Rally đến ${rules.targetScore}, thắng cách ${rules.winBy}`,
    `Đổi sân @${rules.sideSwitchAt}`,
    `Freeze @${rules.freezeAt}`,
  ];

  if (discipline.scoringFormat?.rotationPoints) {
    parts.push(`Xoay vòng ${discipline.scoringFormat.rotationPoints} điểm`);
  }

  return parts.join(" · ");
}
