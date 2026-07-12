/**
 * Canonical domain/skill codes — single source of truth.
 * Database, API, scoring, gates, and weights MUST use these snake_case codes.
 */
export const DOMAIN_CODES = Object.freeze({
  SERVE: "serve",
  RETURN: "return",
  GROUNDSTROKE: "groundstroke",
  DINK_SOFT_GAME: "dink_soft_game",
  THIRD_SHOT: "third_shot",
  TRANSITION: "transition",
  VOLLEY: "volley",
  BLOCK_RESET: "block_reset",
  FOOTWORK: "footwork",
  DOUBLES_POSITIONING: "doubles_positioning",
  COMMUNICATION: "communication",
  TACTICAL_DECISION: "tactical_decision",
  CONSISTENCY: "consistency",
  PRESSURE_EXECUTION: "pressure_execution",
  RULES: "rules",
  RALLY_CONSISTENCY: "rally_consistency",
  ERROR_CONTROL: "error_control",
});

/** Scored in questions + gates; not in doubles weight table (gate-only auxiliary). */
export const GATE_AUXILIARY_DOMAIN_CODES = Object.freeze([
  DOMAIN_CODES.RALLY_CONSISTENCY,
  DOMAIN_CODES.ERROR_CONTROL,
]);

/** Singles domains — spec only (V5-B.1); not used in V5-B.0 scoring. */
export const SINGLES_DOMAIN_CODES = Object.freeze({
  COURT_COVERAGE: "court_coverage",
  PASSING_SHOT: "passing_shot",
  SERVE_PLUS_ONE: "serve_plus_one",
  RETURN_PLUS_ONE: "return_plus_one",
  ENDURANCE: "endurance",
  FULL_COURT_DEFENSE: "full_court_defense",
});

export const ALL_KNOWN_DOMAIN_CODES = Object.freeze([
  ...Object.values(DOMAIN_CODES),
  ...Object.values(SINGLES_DOMAIN_CODES),
]);

/** Legacy alias map — read-only; semantic normalization may be required. */
export const DOMAIN_CODE_ALIASES = Object.freeze({
  thirdShot: DOMAIN_CODES.THIRD_SHOT,
  "third-shot": DOMAIN_CODES.THIRD_SHOT,
  dinkSoftGame: DOMAIN_CODES.DINK_SOFT_GAME,
  blockReset: DOMAIN_CODES.BLOCK_RESET,
  doublesPositioning: DOMAIN_CODES.DOUBLES_POSITIONING,
  tacticalDecision: DOMAIN_CODES.TACTICAL_DECISION,
  pressureExecution: DOMAIN_CODES.PRESSURE_EXECUTION,
  rallyConsistency: DOMAIN_CODES.RALLY_CONSISTENCY,
  errorControl: DOMAIN_CODES.ERROR_CONTROL,
  courtCoverage: SINGLES_DOMAIN_CODES.COURT_COVERAGE,
});

/**
 * Legacy skill subcodes — NOT equivalent to full domain.
 * legacy compatibility only | semantic normalization required
 */
export const LEGACY_SKILL_SUBCODE_ALIASES = Object.freeze({
  third_shot_drop: {
    glossary_code: "third_shot_drop",
    related_domain: DOMAIN_CODES.THIRD_SHOT,
    legacy_compatibility_only: true,
    semantic_normalization_required: true,
  },
  third_shot_drive: {
    glossary_code: "third_shot_drive",
    related_domain: DOMAIN_CODES.THIRD_SHOT,
    legacy_compatibility_only: true,
    semantic_normalization_required: true,
  },
});

export function normalizeLegacySkillSubcode(code) {
  return LEGACY_SKILL_SUBCODE_ALIASES[code] ?? null;
}

export function normalizeDomainCode(code) {
  const raw = String(code ?? "").trim();
  if (!raw) return null;
  if (ALL_KNOWN_DOMAIN_CODES.includes(raw)) return raw;
  return DOMAIN_CODE_ALIASES[raw] ?? null;
}

export function isValidDomainCode(code) {
  return normalizeDomainCode(code) != null;
}

/** @deprecated Import DOMAIN_CODES — kept for backward compatibility */
export const SKILL_DOMAINS = DOMAIN_CODES;
