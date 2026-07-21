/**
 * CORE-09 — EvaluatedMatchGenerationRules (bound once before plan generation).
 *
 * Defaults (documented, only when field omitted):
 * - schemaVersion → MATCH_GENERATION_SCHEMA_VERSION
 * - roundRobinMode → SINGLE
 * - byePolicy → NONE
 * - bracketSizePolicy → POWER_OF_TWO
 * - thirdPlacePolicy → NONE
 * - encounterCount → 1
 * - rematchRestrictions → false
 * - sameClubRestrictions → false
 * - consolationOrPlacementPolicy → null
 * - deterministicSeedPolicy → null
 * - formatSpecificConstraints → []
 * - metadata → {}
 * - operation → always RULE_OPERATION.MATCHUP (canonical; not caller-selectable)
 *
 * generationStrategy is REQUIRED. Unknown / deferred → throws (never ROUND_ROBIN).
 * Present-but-invalid policy enums → throws (never silent normalize).
 */

import { MATCH_GENERATION_SCHEMA_VERSION } from "../constants.js";
import { isMatchGenerationStrategy } from "../enums/matchGenerationStrategy.js";
import { resolveSupportedStrategy } from "../enums/matchGenerationStrategy.js";
import { RULE_OPERATION } from "../../constraints/operations/ruleOperations.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";

export const ROUND_ROBIN_MODE = Object.freeze({
  SINGLE: "SINGLE",
  DOUBLE: "DOUBLE",
  CUSTOM: "CUSTOM",
});

/** @type {ReadonlySet<string>} */
export const ROUND_ROBIN_MODE_VALUES = new Set(Object.values(ROUND_ROBIN_MODE));

export const BYE_POLICY = Object.freeze({
  NONE: "NONE",
  TOP_SEEDS: "TOP_SEEDS",
  BOTTOM_SEEDS: "BOTTOM_SEEDS",
  EXPLICIT_PLACEMENTS: "EXPLICIT_PLACEMENTS",
});

/** @type {ReadonlySet<string>} */
export const BYE_POLICY_VALUES = new Set(Object.values(BYE_POLICY));

export const BRACKET_SIZE_POLICY = Object.freeze({
  POWER_OF_TWO: "POWER_OF_TWO",
  EXACT: "EXACT",
  NEXT_POWER_OF_TWO: "NEXT_POWER_OF_TWO",
});

/** @type {ReadonlySet<string>} */
export const BRACKET_SIZE_POLICY_VALUES = new Set(
  Object.values(BRACKET_SIZE_POLICY)
);

export const THIRD_PLACE_POLICY = Object.freeze({
  NONE: "NONE",
  PLAYOFF: "PLAYOFF",
});

/** @type {ReadonlySet<string>} */
export const THIRD_PLACE_POLICY_VALUES = new Set(
  Object.values(THIRD_PLACE_POLICY)
);

/**
 * @param {unknown} value
 * @param {ReadonlySet<string>} allowed
 * @param {string} field
 * @param {string} [defaultWhenOmitted]
 * @returns {string}
 */
function requireEnumOrDefault(value, allowed, field, defaultWhenOmitted) {
  if (value === undefined || value === null || value === "") {
    if (defaultWhenOmitted === undefined) {
      throw new MatchGenerationContractError(
        MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE,
        `${field} is required`,
        { field }
      );
    }
    return defaultWhenOmitted;
  }
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE,
      `Unknown ${field}`,
      { field, value }
    );
  }
  return value;
}

/**
 * @typedef {Object} EvaluatedMatchGenerationRules
 * @property {string} schemaVersion
 * @property {string} ruleSetId
 * @property {string} ruleSetVersion
 * @property {string} ruleEvaluationFingerprint
 * @property {string} operation
 * @property {string} generationStrategy
 * @property {string} roundRobinMode
 * @property {number} encounterCount
 * @property {string} bracketSizePolicy
 * @property {string} byePolicy
 * @property {string} thirdPlacePolicy
 * @property {string|null} consolationOrPlacementPolicy
 * @property {boolean} rematchRestrictions
 * @property {boolean} sameClubRestrictions
 * @property {ReadonlyArray<string>} formatSpecificConstraints
 * @property {string|null} deterministicSeedPolicy
 * @property {Readonly<Record<string, unknown>>} metadata
 */

/**
 * @param {Partial<EvaluatedMatchGenerationRules>} [partial]
 * @returns {EvaluatedMatchGenerationRules}
 */
export function createEvaluatedMatchGenerationRules(partial = {}) {
  const strategyCheck = resolveSupportedStrategy(partial?.generationStrategy);
  if (!strategyCheck.ok) {
    const code =
      strategyCheck.reason === "STRATEGY_DEFERRED"
        ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_DEFERRED
        : strategyCheck.reason === "STRATEGY_REQUIRED"
          ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_REQUIRED
          : MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED;
    throw new MatchGenerationContractError(
      code,
      `EvaluatedMatchGenerationRules.generationStrategy rejected`,
      {
        generationStrategy: partial?.generationStrategy ?? null,
        reason: strategyCheck.reason,
      }
    );
  }
  if (!isMatchGenerationStrategy(strategyCheck.strategy)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED,
      "generationStrategy must be a supported strategy",
      { generationStrategy: strategyCheck.strategy }
    );
  }

  const roundRobinMode = requireEnumOrDefault(
    partial.roundRobinMode,
    ROUND_ROBIN_MODE_VALUES,
    "roundRobinMode",
    ROUND_ROBIN_MODE.SINGLE
  );
  const byePolicy = requireEnumOrDefault(
    partial.byePolicy,
    BYE_POLICY_VALUES,
    "byePolicy",
    BYE_POLICY.NONE
  );
  const bracketSizePolicy = requireEnumOrDefault(
    partial.bracketSizePolicy,
    BRACKET_SIZE_POLICY_VALUES,
    "bracketSizePolicy",
    BRACKET_SIZE_POLICY.POWER_OF_TWO
  );
  const thirdPlacePolicy = requireEnumOrDefault(
    partial.thirdPlacePolicy,
    THIRD_PLACE_POLICY_VALUES,
    "thirdPlacePolicy",
    THIRD_PLACE_POLICY.NONE
  );

  let encounterCount = 1;
  if (partial.encounterCount !== undefined && partial.encounterCount !== null) {
    const n = partial.encounterCount;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
      throw new MatchGenerationContractError(
        MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE,
        "encounterCount must be a positive integer when provided",
        { encounterCount: n }
      );
    }
    encounterCount = n;
  }

  const formatSpecificConstraints = Object.freeze(
    (Array.isArray(partial.formatSpecificConstraints)
      ? partial.formatSpecificConstraints
      : []
    ).map((c) => {
      if (typeof c !== "string" || !c.trim()) {
        throw new MatchGenerationContractError(
          MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
          "formatSpecificConstraints entries must be non-empty strings"
        );
      }
      return c.trim();
    })
  );

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    ruleSetId: String(partial.ruleSetId || "").trim(),
    ruleSetVersion: String(partial.ruleSetVersion || "").trim(),
    ruleEvaluationFingerprint: String(
      partial.ruleEvaluationFingerprint || ""
    ).trim(),
    operation: RULE_OPERATION.MATCHUP,
    generationStrategy: strategyCheck.strategy,
    roundRobinMode,
    encounterCount,
    bracketSizePolicy,
    byePolicy,
    thirdPlacePolicy,
    consolationOrPlacementPolicy:
      typeof partial.consolationOrPlacementPolicy === "string" &&
      partial.consolationOrPlacementPolicy.trim()
        ? partial.consolationOrPlacementPolicy.trim()
        : null,
    rematchRestrictions: partial.rematchRestrictions === true,
    sameClubRestrictions: partial.sameClubRestrictions === true,
    formatSpecificConstraints,
    deterministicSeedPolicy:
      typeof partial.deterministicSeedPolicy === "string" &&
      partial.deterministicSeedPolicy.trim()
        ? partial.deterministicSeedPolicy.trim()
        : null,
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
