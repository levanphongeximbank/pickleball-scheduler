import {
  DEFAULT_COMPETITION_ELO,
  DEFAULT_PUBLIC_SKILL_ANCHOR,
  ELO_PER_SKILL_POINT_V1,
  RATING_MAPPING_VERSION_V1,
} from "./ratingConstants.js";

/**
 * @typedef {Object} CompetitionEloSkillMapping
 * @property {number} estimatedSkillLevel
 * @property {number} confidence
 * @property {string} mappingVersion
 */

function clampSkill(value, min = 1.0, max = 8.0) {
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

function normalizeConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  if (parsed <= 1) {
    return Math.round(Math.min(100, Math.max(0, parsed * 100)));
  }
  return Math.round(Math.min(100, Math.max(0, parsed)));
}

/**
 * Map public skill level to competition Elo (mapping v1).
 *
 * @param {number} skillLevel
 * @param {Object} [options]
 * @param {number} [options.anchorSkill]
 * @param {number} [options.anchorElo]
 * @param {number} [options.eloPerSkillPoint]
 * @returns {number}
 */
export function mapSkillToCompetitionElo(
  skillLevel,
  options = {}
) {
  const anchorSkill = Number(options.anchorSkill ?? DEFAULT_PUBLIC_SKILL_ANCHOR);
  const anchorElo = Number(options.anchorElo ?? DEFAULT_COMPETITION_ELO);
  const eloPerSkill = Number(options.eloPerSkillPoint ?? ELO_PER_SKILL_POINT_V1);
  const skill = Number(skillLevel);

  if (!Number.isFinite(skill)) {
    return anchorElo;
  }

  return Math.round(anchorElo + (skill - anchorSkill) * eloPerSkill);
}

/**
 * Map competition Elo to estimated public skill level.
 *
 * @param {number} competitionElo
 * @param {Object} [options]
 * @param {number} [options.confidence] 0–100 or 0–1
 * @param {string} [options.mappingVersion]
 * @param {number} [options.minLevel]
 * @param {number} [options.maxLevel]
 * @returns {CompetitionEloSkillMapping}
 */
export function mapCompetitionEloToSkill(competitionElo, options = {}) {
  const anchorSkill = Number(options.anchorSkill ?? DEFAULT_PUBLIC_SKILL_ANCHOR);
  const anchorElo = Number(options.anchorElo ?? DEFAULT_COMPETITION_ELO);
  const eloPerSkill = Number(options.eloPerSkillPoint ?? ELO_PER_SKILL_POINT_V1);
  const minLevel = Number(options.minLevel ?? 1.0);
  const maxLevel = Number(options.maxLevel ?? 8.0);
  const elo = Number(competitionElo);

  const safeElo = Number.isFinite(elo) ? elo : anchorElo;
  const estimatedSkillLevel = clampSkill(
    anchorSkill + (safeElo - anchorElo) / eloPerSkill,
    minLevel,
    maxLevel
  );

  return {
    estimatedSkillLevel,
    confidence: normalizeConfidence(options.confidence ?? 0),
    mappingVersion: options.mappingVersion ?? RATING_MAPPING_VERSION_V1,
  };
}

/**
 * Detect whether a stored value is legacy skill-scale (≤10) vs competition Elo.
 *
 * @param {number} value
 * @returns {'skill'|'competition_elo'}
 */
export function detectRatingStorageScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "skill";
  }
  return parsed > 10 ? "competition_elo" : "skill";
}
