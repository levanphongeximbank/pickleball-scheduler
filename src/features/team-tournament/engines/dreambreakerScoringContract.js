/**
 * Canonical Dreambreaker scoring-format resolution.
 *
 * Reuses existing scoringFormat { targetScore, winBy, rotationPoints }.
 * targetPoints is accepted as an alias for targetScore.
 *
 * Resolution (most specific wins):
 * 1. matchup.dreambreaker.scoringFormat — explicit match-level override
 * 2. matchup.scheduleMeta.dreambreakerScoringFormat
 *    or matchup.scheduleMeta.dreambreaker.scoringFormat
 * 3. catalog Dreambreaker discipline scoringFormat
 * 4. canonical fallback: targetScore=21, winBy=2, rotationPoints=4
 *
 * 21 is the DEFAULT, not the only allowed value.
 * Freeze / side-switch live on scoringFormat for documentation only;
 * they are not server-enforced rally rules.
 */

import { getDreambreakerDiscipline } from "./mlpPresetEngine.js";

export const DEFAULT_DREAMBREAKER_TARGET_SCORE = 21;
export const DEFAULT_DREAMBREAKER_WIN_BY = 2;
export const DEFAULT_DREAMBREAKER_ROTATION_POINTS = 4;

export const DEFAULT_DREAMBREAKER_SCORING = Object.freeze({
  targetScore: DEFAULT_DREAMBREAKER_TARGET_SCORE,
  winBy: DEFAULT_DREAMBREAKER_WIN_BY,
  rotationPoints: DEFAULT_DREAMBREAKER_ROTATION_POINTS,
});

function pickPositiveInt(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.trunc(number);
}

export function pickDreambreakerScoringFields(source) {
  if (!source || typeof source !== "object") {
    return {};
  }

  const targetScore = pickPositiveInt(source.targetScore ?? source.targetPoints);
  const winBy = pickPositiveInt(source.winBy);
  const rotationPoints = pickPositiveInt(source.rotationPoints);
  const next = {};
  if (targetScore != null) {
    next.targetScore = targetScore;
  }
  if (winBy != null) {
    next.winBy = winBy;
  }
  if (rotationPoints != null) {
    next.rotationPoints = rotationPoints;
  }
  return next;
}

export function resolveDreambreakerScoringFormat({
  matchup = null,
  disciplines = [],
} = {}) {
  const catalog = getDreambreakerDiscipline(disciplines);
  return {
    ...DEFAULT_DREAMBREAKER_SCORING,
    ...pickDreambreakerScoringFields(catalog?.scoringFormat),
    ...pickDreambreakerScoringFields(matchup?.scheduleMeta?.dreambreakerScoringFormat),
    ...pickDreambreakerScoringFields(matchup?.scheduleMeta?.dreambreaker?.scoringFormat),
    ...pickDreambreakerScoringFields(matchup?.dreambreaker?.scoringFormat),
  };
}

export function getDreambreakerScoringHints(matchup, disciplines = []) {
  const rules = resolveDreambreakerScoringFormat({ matchup, disciplines });
  return `Rally đến ${rules.targetScore}, cách ${rules.winBy} · Xoay ${rules.rotationPoints} điểm/lượt`;
}
