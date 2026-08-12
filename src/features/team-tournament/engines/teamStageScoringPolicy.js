/**
 * Per-stage scoring policy — parallel to #416 stageTieBreakPolicy.
 * Lookup key = resolveMatchupCompetitionStage(...) resolved round.
 * Does not change matchup.stage coarse taxonomy.
 */

import {
  COMPETITION_STAGE,
  SCORING_SYSTEM,
  STAGE_TIE_BREAK_POLICY_KEYS,
} from "../constants.js";

export const STAGE_SCORING_POLICY_INVALID_CODE = "INVALID_STAGE_SCORING_POLICY";

/** UI-level scoring mode per stage. Engines consume SCORING_SYSTEM. */
export const STAGE_SCORING_MODE = Object.freeze({
  RALLY: "rally",
  TRADITIONAL: "traditional",
});

export const STAGE_SCORING_MODE_LABELS = Object.freeze({
  [STAGE_SCORING_MODE.RALLY]: "Trực tiếp (Rally)",
  [STAGE_SCORING_MODE.TRADITIONAL]: "Truyền thống",
});

/**
 * Accepts scoringMode (rally|traditional) and scoringSystem aliases
 * (rally|side_out, any case). Unknown → rally (default).
 * @param {unknown} raw
 * @returns {"rally"|"traditional"}
 */
export function normalizeStageScoringMode(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (
    value === STAGE_SCORING_MODE.TRADITIONAL ||
    value === SCORING_SYSTEM.SIDE_OUT ||
    value === "sideout"
  ) {
    return STAGE_SCORING_MODE.TRADITIONAL;
  }
  return STAGE_SCORING_MODE.RALLY;
}

/**
 * @param {unknown} mode
 * @returns {string} SCORING_SYSTEM value
 */
export function mapStageScoringModeToScoringSystem(mode) {
  return normalizeStageScoringMode(mode) === STAGE_SCORING_MODE.TRADITIONAL
    ? SCORING_SYSTEM.SIDE_OUT
    : SCORING_SYSTEM.RALLY;
}

/**
 * @param {unknown} scoringSystem
 * @returns {"rally"|"traditional"}
 */
export function mapScoringSystemToStageScoringMode(scoringSystem) {
  return normalizeStageScoringMode(scoringSystem);
}

/**
 * @param {unknown} mode
 * @returns {string}
 */
export function getStageScoringModeLabel(mode) {
  return STAGE_SCORING_MODE_LABELS[normalizeStageScoringMode(mode)];
}

/** Default scoring shape — matches existing MLP rally defaults (not authority). */
export const DEFAULT_STAGE_SCORING_ENTRY = Object.freeze({
  scoringMode: STAGE_SCORING_MODE.RALLY,
  targetPoints: 21,
  winBy: 2,
  changeEndsAt: null,
  freezeAt: null,
});

export const DEFAULT_STAGE_SCORING_POLICY = Object.freeze(
  Object.fromEntries(
    STAGE_TIE_BREAK_POLICY_KEYS.map((key) => [key, { ...DEFAULT_STAGE_SCORING_ENTRY }])
  )
);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEntry(raw) {
  const source = isPlainObject(raw) ? raw : {};
  // Accept existing engine aliases: targetScore ↔ targetPoints
  const targetPoints = Number(
    source.targetPoints != null ? source.targetPoints : source.targetScore
  );
  const winBy = Number(source.winBy);
  const changeEndsAt =
    source.changeEndsAt == null || source.changeEndsAt === ""
      ? null
      : Number(source.changeEndsAt);
  const freezeAt =
    source.freezeAt == null || source.freezeAt === "" ? null : Number(source.freezeAt);

  const scoringMode = normalizeStageScoringMode(
    source.scoringMode != null && String(source.scoringMode).trim()
      ? source.scoringMode
      : source.scoringSystem
  );

  return {
    scoringMode,
    targetPoints:
      Number.isFinite(targetPoints) && targetPoints > 0
        ? Math.floor(targetPoints)
        : DEFAULT_STAGE_SCORING_ENTRY.targetPoints,
    winBy:
      Number.isFinite(winBy) && winBy >= 1
        ? Math.floor(winBy)
        : DEFAULT_STAGE_SCORING_ENTRY.winBy,
    changeEndsAt:
      changeEndsAt != null && Number.isFinite(changeEndsAt) && changeEndsAt > 0
        ? Math.floor(changeEndsAt)
        : null,
    freezeAt:
      freezeAt != null && Number.isFinite(freezeAt) && freezeAt > 0
        ? Math.floor(freezeAt)
        : null,
  };
}

export function normalizeStageScoringPolicy(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const next = {};
  for (const key of STAGE_TIE_BREAK_POLICY_KEYS) {
    next[key] = normalizeEntry(source[key]);
  }
  return next;
}

export function validateStageScoringPolicyShape(raw) {
  if (raw == null) {
    return { ok: true, policy: normalizeStageScoringPolicy(null) };
  }
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      code: STAGE_SCORING_POLICY_INVALID_CODE,
      error: "stageScoringPolicy phải là object theo stage.",
    };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!STAGE_TIE_BREAK_POLICY_KEYS.includes(key)) {
      return {
        ok: false,
        code: STAGE_SCORING_POLICY_INVALID_CODE,
        error: `Stage scoring không hợp lệ: ${key}`,
      };
    }
    if (value != null && !isPlainObject(value)) {
      return {
        ok: false,
        code: STAGE_SCORING_POLICY_INVALID_CODE,
        error: `stageScoringPolicy.${key} phải là object.`,
      };
    }
  }
  return { ok: true, policy: normalizeStageScoringPolicy(raw) };
}

/**
 * Effective scoring for a resolved competition stage.
 * stage policy → tournament defaultScoring → DEFAULT_STAGE_SCORING_ENTRY
 */
export function resolveEffectiveStageScoringPolicy({
  teamData,
  tournament,
  resolvedRound,
  defaultScoring = null,
} = {}) {
  const settings = {
    ...(isPlainObject(tournament?.settings) ? tournament.settings : {}),
    ...(isPlainObject(teamData?.settings) ? teamData.settings : {}),
  };
  const policy = normalizeStageScoringPolicy(settings.stageScoringPolicy);
  const stage = String(resolvedRound || COMPETITION_STAGE.GROUP).trim();
  const stageEntry = policy[stage] || policy[COMPETITION_STAGE.GROUP];
  if (stageEntry && settings.stageScoringPolicy?.[stage]) {
    return { ...stageEntry, source: "stageScoringPolicy", stage };
  }
  if (isPlainObject(defaultScoring)) {
    return { ...normalizeEntry(defaultScoring), source: "tournamentDefault", stage };
  }
  if (isPlainObject(settings.defaultScoring)) {
    return {
      ...normalizeEntry(settings.defaultScoring),
      source: "settings.defaultScoring",
      stage,
    };
  }
  return {
    ...normalizeEntry(stageEntry),
    source: "default",
    stage,
  };
}

/** Map to existing scoringFormat-like object used by engines. */
export function stageScoringToFormat(entry) {
  const normalized = normalizeEntry(entry);
  return {
    scoringMode: normalized.scoringMode,
    scoringSystem: mapStageScoringModeToScoringSystem(normalized.scoringMode),
    targetScore: normalized.targetPoints,
    targetPoints: normalized.targetPoints,
    winBy: normalized.winBy,
    changeEndsAt: normalized.changeEndsAt,
    freezeAt: normalized.freezeAt,
  };
}
