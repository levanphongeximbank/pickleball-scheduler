import { SCORING_SYSTEM } from "../constants.js";
import {
  getStageScoringModeLabel,
  normalizeStageScoringMode,
  resolveEffectiveStageScoringPolicy,
  STAGE_SCORING_MODE,
  stageScoringToFormat,
} from "./teamStageScoringPolicy.js";
import { resolveMatchupCompetitionStage } from "./teamStageTieBreakPolicy.js";

const DEFAULT_RULES = {
  targetScore: 21,
  winBy: 2,
  freezeAt: 20,
  sideSwitchAt: 11,
};

export function normalizeRallyRules(scoringFormat = {}) {
  const sideSwitchRaw =
    scoringFormat.sideSwitchAt != null && scoringFormat.sideSwitchAt !== ""
      ? scoringFormat.sideSwitchAt
      : scoringFormat.changeEndsAt;
  return {
    targetScore: Number(scoringFormat.targetScore) || DEFAULT_RULES.targetScore,
    winBy: Number(scoringFormat.winBy) || DEFAULT_RULES.winBy,
    freezeAt: Number(scoringFormat.freezeAt) || DEFAULT_RULES.freezeAt,
    sideSwitchAt: Number(sideSwitchRaw) || DEFAULT_RULES.sideSwitchAt,
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

/**
 * Traditional (side-out) validation: target + winBy only.
 * Freeze is a rally-format artifact and is not asserted here; serve possession
 * is enforced by Referee V5 / CORE-16, not by the legacy score boxes.
 */
export function validateSideOutScore({ scoreA, scoreB, rules = DEFAULT_RULES }) {
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
      error: `Tỷ số không hợp lệ. Cần đạt ${normalized.targetScore} điểm và thắng cách ${normalized.winBy} điểm.`,
    };
  }

  return { ok: true, winnerSide: winner };
}

/**
 * Stage-aware score validation entry point.
 * @param {{ scoreA: number, scoreB: number, rules?: object, scoringMode?: string }} input
 */
export function validateStageScore({
  scoreA,
  scoreB,
  rules = DEFAULT_RULES,
  scoringMode,
}) {
  const mode = normalizeStageScoringMode(
    scoringMode != null && String(scoringMode).trim()
      ? scoringMode
      : rules?.scoringMode ?? rules?.scoringSystem
  );
  return mode === STAGE_SCORING_MODE.TRADITIONAL
    ? validateSideOutScore({ scoreA, scoreB, rules })
    : validateRallyScore({ scoreA, scoreB, rules });
}

/**
 * Effective scoring mode for a sub-match (stage policy → discipline → default).
 * @param {{
 *   discipline?: object|null,
 *   teamData?: object|null,
 *   matchup?: object|null,
 *   tournament?: object|null,
 * }} input
 * @returns {"rally"|"traditional"}
 */
export function resolveStageScoringMode({
  discipline = null,
  teamData = null,
  matchup = null,
  tournament = null,
} = {}) {
  const effective = resolveEffectiveStageScoringPolicy({
    teamData,
    tournament,
    resolvedRound: resolveMatchupCompetitionStage(teamData, matchup),
    defaultScoring: discipline?.scoringFormat || null,
  });
  return normalizeStageScoringMode(effective.scoringMode);
}

/**
 * Referee-facing scoring hint for a sub-match.
 * Merges the resolved competition stage (#416) scoring policy with the
 * discipline scoringFormat so the hint always matches what confirm validates.
 *
 * @param {{
 *   discipline?: object|null,
 *   teamData?: object|null,
 *   matchup?: object|null,
 *   tournament?: object|null,
 * }} input
 * @returns {string}
 */
export function getStageScoringHints({
  discipline = null,
  teamData = null,
  matchup = null,
  tournament = null,
} = {}) {
  const resolvedRound = resolveMatchupCompetitionStage(teamData, matchup);
  const effective = resolveEffectiveStageScoringPolicy({
    teamData,
    tournament,
    resolvedRound,
    defaultScoring: discipline?.scoringFormat || null,
  });
  const format = stageScoringToFormat(effective);
  const rules = normalizeRallyRules({
    ...(discipline?.scoringFormat || {}),
    ...format,
  });

  const parts = [
    `${getStageScoringModeLabel(effective.scoringMode)} đến ${rules.targetScore}, thắng cách ${rules.winBy}`,
  ];

  const mode = normalizeStageScoringMode(effective.scoringMode);
  const changeEnds =
    effective.changeEndsAt != null && Number(effective.changeEndsAt) > 0
      ? Number(effective.changeEndsAt)
      : Number(format.sideSwitchAt) > 0
        ? Number(format.sideSwitchAt)
        : null;
  if (changeEnds != null && changeEnds > 0) {
    parts.push(`Đổi sân @${changeEnds}`);
  }
  if (mode === STAGE_SCORING_MODE.RALLY) {
    parts.push(`Freeze @${rules.freezeAt}`);
  }

  if (discipline?.scoringFormat?.rotationPoints) {
    parts.push(`Xoay vòng ${discipline.scoringFormat.rotationPoints} điểm`);
  }

  return parts.join(" · ");
}

/** @deprecated superseded by getStageScoringHints (stage-aware). */
export function getRallyScoringHints(discipline) {
  if (!isRallyScoring(discipline)) {
    return "";
  }

  return getStageScoringHints({ discipline });
}
