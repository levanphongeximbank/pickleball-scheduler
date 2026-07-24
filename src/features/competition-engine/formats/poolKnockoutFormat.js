/**
 * E2E-02 — Pool + Knockout Format Definition.
 */

import {
  BRACKET_SIZE_POLICY,
  BYE_POLICY,
  MATCH_GENERATION_STRATEGY,
} from "../../competition-core/match-generation/index.js";
import {
  E2E02_FORMAT_ID,
  E2E02_FORMAT_VERSION,
  E2E02_GROUPING_STRATEGY,
  E2E02_POOL_SIZING_POLICY,
  E2E02_QUALIFICATION_POLICY,
  E2E02_RULE_REFERENCES,
  E2E02_STAGE,
  E2E02_STAGE_SEQUENCE,
  E2E02_UNRESOLVED_TIE_BEHAVIOR,
} from "../composition/constants.js";
import { E2E02_ERROR_CODE, failE2E02 } from "../composition/errors.js";
import {
  computeDeterministicFingerprint,
  deepFreeze,
  isNonEmptyString,
  isPositiveInteger,
} from "../composition/fingerprint.js";

/**
 * @typedef {Object} PoolKnockoutFormatDefinition
 * @property {string} formatId
 * @property {string} formatVersion
 * @property {readonly string[]} stageSequence
 * @property {object} poolStage
 * @property {object} qualification
 * @property {object} knockoutStage
 * @property {object} participantCountPolicy
 * @property {object} invalidConfigurationBehavior
 * @property {string} standingsStrategyId
 * @property {string} workflowId
 * @property {string} configurationFingerprint
 */

/**
 * Create canonical Pool + Knockout format definition.
 *
 * @param {Partial<{
 *   poolCount: number,
 *   targetPoolSize: number,
 *   poolSizingPolicy: string,
 *   groupingStrategy: string,
 *   qualifiersPerPool: number,
 *   globalQualifierCount: number,
 *   qualificationPolicy: string,
 *   minParticipants: number,
 *   maxParticipants: number|null,
 *   bracketSizePolicy: string,
 *   byePolicy: string,
 *   unresolvedTieBehavior: string,
 * }>} [overrides]
 * @returns {Readonly<PoolKnockoutFormatDefinition>}
 */
export function createPoolKnockoutFormatDefinition(overrides = {}) {
  const poolSizingPolicy =
    overrides.poolSizingPolicy || E2E02_POOL_SIZING_POLICY.FIXED_POOL_COUNT;
  const qualificationPolicy =
    overrides.qualificationPolicy || E2E02_QUALIFICATION_POLICY.TOP_N_PER_POOL;
  const groupingStrategy =
    overrides.groupingStrategy || E2E02_GROUPING_STRATEGY.SNAKE;
  const unresolvedTieBehavior =
    overrides.unresolvedTieBehavior ||
    E2E02_UNRESOLVED_TIE_BEHAVIOR.FAIL_CLOSED;

  const poolCount =
    overrides.poolCount != null ? overrides.poolCount : 4;
  const targetPoolSize =
    overrides.targetPoolSize != null ? overrides.targetPoolSize : 4;
  const qualifiersPerPool =
    overrides.qualifiersPerPool != null ? overrides.qualifiersPerPool : 2;
  const globalQualifierCount =
    overrides.globalQualifierCount != null
      ? overrides.globalQualifierCount
      : null;
  const minParticipants =
    overrides.minParticipants != null ? overrides.minParticipants : 4;
  const maxParticipants =
    overrides.maxParticipants === undefined ? null : overrides.maxParticipants;
  const bracketSizePolicy =
    overrides.bracketSizePolicy || BRACKET_SIZE_POLICY.POWER_OF_TWO;
  const byePolicy =
    overrides.byePolicy || BYE_POLICY.EXPLICIT_PLACEMENTS;

  const format = {
    formatId: E2E02_FORMAT_ID,
    formatVersion: E2E02_FORMAT_VERSION,
    stageSequence: [...E2E02_STAGE_SEQUENCE],
    poolStage: {
      stageId: E2E02_STAGE.POOL,
      matchGenerationStrategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
      poolSizingPolicy,
      poolCount,
      targetPoolSize,
      groupingStrategy,
      matchesPerPoolBehavior: "FULL_SINGLE_ROUND_ROBIN",
      emptyPoolRejected: true,
      unevenPoolSizesAllowed: true,
    },
    qualification: {
      stageId: E2E02_STAGE.QUALIFICATION,
      policy: qualificationPolicy,
      qualifiersPerPool,
      globalQualifierCount,
      standingsSource: "CORE_18_CANONICAL_STANDINGS",
      tieBreakDependency: E2E02_RULE_REFERENCES.standingsStrategyId,
      unresolvedTieBehavior,
      withdrawnDisqualifiedExcluded: true,
      invalidOrUnacceptedResultsExcluded: true,
      requiresPoolStageComplete: true,
    },
    knockoutStage: {
      stageId: E2E02_STAGE.KNOCKOUT,
      matchGenerationStrategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
      bracketSizePolicy,
      byePolicy,
      seedingIntoKnockout: "QUALIFIER_RANK_ORDER",
      winnerAdvancement: true,
      thirdPlacePolicy: "NONE",
    },
    participantCountPolicy: {
      minParticipants,
      maxParticipants,
      supportedRangeDescription:
        "Generalized participant counts supported via pool sizing + power-of-two knockout padding",
    },
    standingsStrategyId: E2E02_RULE_REFERENCES.standingsStrategyId,
    workflowId: E2E02_RULE_REFERENCES.workflowId,
    invalidConfigurationBehavior: {
      mode: "FAIL_CLOSED",
      silentFallback: false,
      typedErrors: true,
    },
  };

  const validated = validatePoolKnockoutFormatDefinition(format);
  if (!validated.ok) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_FORMAT,
      "Pool+Knockout format definition invalid",
      { errors: validated.errors }
    );
  }

  return validated.value;
}

/**
 * @param {unknown} input
 */
export function validatePoolKnockoutFormatDefinition(input) {
  /** @type {object[]} */
  const errors = [];
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      code: E2E02_ERROR_CODE.INVALID_FORMAT,
      errors: [
        {
          field: "format",
          code: E2E02_ERROR_CODE.INVALID_FORMAT,
          message: "format must be an object",
        },
      ],
    };
  }

  const raw = /** @type {Record<string, any>} */ (input);

  if (raw.formatId !== E2E02_FORMAT_ID) {
    errors.push({
      field: "formatId",
      code: E2E02_ERROR_CODE.INVALID_FORMAT,
      message: `formatId must be ${E2E02_FORMAT_ID}`,
    });
  }
  if (!isNonEmptyString(raw.formatVersion)) {
    errors.push({
      field: "formatVersion",
      code: E2E02_ERROR_CODE.INVALID_FORMAT,
      message: "formatVersion must be a non-empty string",
    });
  }

  const sequence = Array.isArray(raw.stageSequence) ? raw.stageSequence : [];
  if (
    sequence.length !== E2E02_STAGE_SEQUENCE.length ||
    E2E02_STAGE_SEQUENCE.some((s, i) => sequence[i] !== s)
  ) {
    errors.push({
      field: "stageSequence",
      code: E2E02_ERROR_CODE.INVALID_STAGE_SEQUENCE,
      message: "stageSequence must be POOL → QUALIFICATION → KNOCKOUT",
    });
  }

  const pool = raw.poolStage || {};
  if (
    pool.matchGenerationStrategy !==
    MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN
  ) {
    errors.push({
      field: "poolStage.matchGenerationStrategy",
      code: E2E02_ERROR_CODE.INVALID_FORMAT,
      message: "pool stage must use GROUP_ROUND_ROBIN",
    });
  }

  const sizing = pool.poolSizingPolicy;
  if (
    sizing !== E2E02_POOL_SIZING_POLICY.FIXED_POOL_COUNT &&
    sizing !== E2E02_POOL_SIZING_POLICY.TARGET_POOL_SIZE
  ) {
    errors.push({
      field: "poolStage.poolSizingPolicy",
      code: E2E02_ERROR_CODE.INVALID_POOL_SIZING,
      message: "unsupported poolSizingPolicy",
    });
  }
  if (
    sizing === E2E02_POOL_SIZING_POLICY.FIXED_POOL_COUNT &&
    !isPositiveInteger(pool.poolCount)
  ) {
    errors.push({
      field: "poolStage.poolCount",
      code: E2E02_ERROR_CODE.INVALID_POOL_SIZING,
      message: "poolCount must be a positive integer",
    });
  }
  if (
    sizing === E2E02_POOL_SIZING_POLICY.TARGET_POOL_SIZE &&
    !isPositiveInteger(pool.targetPoolSize)
  ) {
    errors.push({
      field: "poolStage.targetPoolSize",
      code: E2E02_ERROR_CODE.INVALID_POOL_SIZING,
      message: "targetPoolSize must be a positive integer",
    });
  }

  const grouping = pool.groupingStrategy;
  if (
    grouping !== E2E02_GROUPING_STRATEGY.SNAKE &&
    grouping !== E2E02_GROUPING_STRATEGY.SEEDED &&
    grouping !== E2E02_GROUPING_STRATEGY.SERPENTINE
  ) {
    errors.push({
      field: "poolStage.groupingStrategy",
      code: E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      message: "unsupported groupingStrategy",
    });
  }

  const qual = raw.qualification || {};
  if (
    qual.policy !== E2E02_QUALIFICATION_POLICY.TOP_N_PER_POOL &&
    qual.policy !== E2E02_QUALIFICATION_POLICY.GLOBAL_TOP_N
  ) {
    errors.push({
      field: "qualification.policy",
      code: E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      message: "unsupported qualification policy",
    });
  }
  if (
    qual.policy === E2E02_QUALIFICATION_POLICY.TOP_N_PER_POOL &&
    !isPositiveInteger(qual.qualifiersPerPool)
  ) {
    errors.push({
      field: "qualification.qualifiersPerPool",
      code: E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      message: "qualifiersPerPool must be a positive integer",
    });
  }
  if (
    qual.policy === E2E02_QUALIFICATION_POLICY.GLOBAL_TOP_N &&
    !isPositiveInteger(qual.globalQualifierCount)
  ) {
    errors.push({
      field: "qualification.globalQualifierCount",
      code: E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      message: "globalQualifierCount must be a positive integer",
    });
  }
  if (
    qual.unresolvedTieBehavior !== E2E02_UNRESOLVED_TIE_BEHAVIOR.FAIL_CLOSED
  ) {
    errors.push({
      field: "qualification.unresolvedTieBehavior",
      code: E2E02_ERROR_CODE.UNRESOLVED_TIE,
      message: "unresolved ties must fail-closed",
    });
  }

  const ko = raw.knockoutStage || {};
  if (
    ko.matchGenerationStrategy !== MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION
  ) {
    errors.push({
      field: "knockoutStage.matchGenerationStrategy",
      code: E2E02_ERROR_CODE.INVALID_FORMAT,
      message: "knockout stage must use SINGLE_ELIMINATION",
    });
  }
  if (
    ko.bracketSizePolicy !== BRACKET_SIZE_POLICY.POWER_OF_TWO &&
    ko.bracketSizePolicy !== BRACKET_SIZE_POLICY.NEXT_POWER_OF_TWO &&
    ko.bracketSizePolicy !== BRACKET_SIZE_POLICY.EXACT
  ) {
    errors.push({
      field: "knockoutStage.bracketSizePolicy",
      code: E2E02_ERROR_CODE.INVALID_BRACKET_SIZE,
      message: "unsupported bracketSizePolicy",
    });
  }
  if (
    ko.byePolicy !== BYE_POLICY.NONE &&
    ko.byePolicy !== BYE_POLICY.TOP_SEEDS &&
    ko.byePolicy !== BYE_POLICY.BOTTOM_SEEDS &&
    ko.byePolicy !== BYE_POLICY.EXPLICIT_PLACEMENTS
  ) {
    errors.push({
      field: "knockoutStage.byePolicy",
      code: E2E02_ERROR_CODE.INVALID_BYE_CONFIGURATION,
      message: "unsupported byePolicy",
    });
  }

  if (!isNonEmptyString(raw.standingsStrategyId)) {
    errors.push({
      field: "standingsStrategyId",
      code: E2E02_ERROR_CODE.MISSING_RULE_REFERENCE,
      message: "standings strategy reference required",
    });
  }
  if (!isNonEmptyString(raw.workflowId)) {
    errors.push({
      field: "workflowId",
      code: E2E02_ERROR_CODE.MISSING_WORKFLOW_REFERENCE,
      message: "workflow reference required",
    });
  }

  const participantPolicy = raw.participantCountPolicy || {};
  if (!isPositiveInteger(participantPolicy.minParticipants)) {
    errors.push({
      field: "participantCountPolicy.minParticipants",
      code: E2E02_ERROR_CODE.INVALID_PARTICIPANT_COUNT,
      message: "minParticipants must be a positive integer",
    });
  }
  if (
    participantPolicy.maxParticipants != null &&
    (!Number.isInteger(participantPolicy.maxParticipants) ||
      participantPolicy.maxParticipants < participantPolicy.minParticipants)
  ) {
    errors.push({
      field: "participantCountPolicy.maxParticipants",
      code: E2E02_ERROR_CODE.INVALID_PARTICIPANT_COUNT,
      message: "maxParticipants must be >= minParticipants when set",
    });
  }

  if (errors.length > 0) {
    return { ok: false, code: E2E02_ERROR_CODE.INVALID_FORMAT, errors };
  }

  const fingerprint = computeDeterministicFingerprint(
    {
      formatId: raw.formatId,
      formatVersion: raw.formatVersion,
      stageSequence: sequence,
      poolStage: pool,
      qualification: qual,
      knockoutStage: ko,
      participantCountPolicy: participantPolicy,
      standingsStrategyId: raw.standingsStrategyId,
      workflowId: raw.workflowId,
    },
    "fmt"
  );

  return {
    ok: true,
    value: deepFreeze({
      ...raw,
      stageSequence: Object.freeze([...sequence]),
      configurationFingerprint: fingerprint,
    }),
    fingerprint,
  };
}

/**
 * Resolve pool count from participant count + format policy.
 *
 * @param {number} participantCount
 * @param {PoolKnockoutFormatDefinition} format
 * @returns {number}
 */
export function resolvePoolCount(participantCount, format) {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_PARTICIPANT_COUNT,
      "participantCount must be a positive integer",
      { participantCount }
    );
  }
  const policy = format.poolStage.poolSizingPolicy;
  if (policy === E2E02_POOL_SIZING_POLICY.FIXED_POOL_COUNT) {
    const poolCount = format.poolStage.poolCount;
    if (poolCount > participantCount) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_POOL_SIZING,
        "poolCount cannot exceed participantCount",
        { poolCount, participantCount }
      );
    }
    return poolCount;
  }
  const target = format.poolStage.targetPoolSize;
  const poolCount = Math.max(1, Math.ceil(participantCount / target));
  if (poolCount > participantCount) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_POOL_SIZING,
      "resolved poolCount exceeds participantCount",
      { poolCount, participantCount, target }
    );
  }
  return poolCount;
}
