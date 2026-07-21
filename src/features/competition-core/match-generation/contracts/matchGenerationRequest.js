/**
 * CORE-09 — MatchGenerationRequest (no schedule/score/lifecycle fields).
 *
 * Defaults (documented):
 * - schemaVersion omitted → MATCH_GENERATION_SCHEMA_VERSION
 * - categoryId omitted / empty → null
 * - generatorVersion omitted → MATCH_GENERATOR_IDENTITY.version
 * - metadata omitted → {}
 *
 * strategy is REQUIRED and must be a supported MATCH_GENERATION_STRATEGY.
 * Deferred (SWISS, DOUBLE_ELIMINATION) and unknown values throw — never normalize
 * to ROUND_ROBIN.
 */

import {
  MATCH_GENERATION_SCHEMA_VERSION,
  MATCH_GENERATOR_IDENTITY,
} from "../constants.js";
import { resolveSupportedStrategy } from "../enums/matchGenerationStrategy.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";

/**
 * @typedef {Object} MatchGenerationRequest
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} divisionId
 * @property {string|null} categoryId
 * @property {string} stageId
 * @property {string} strategy
 * @property {Readonly<{ drawId: string, drawVersion: string, drawFingerprint: string }>} drawReference
 * @property {Readonly<{ ruleSetId: string, ruleSetVersion: string, ruleEvaluationFingerprint: string }>} evaluatedRuleReference
 * @property {Readonly<{ snapshotId: string, participantFingerprint: string }>} participantSnapshotReference
 * @property {string} generatorVersion
 * @property {Readonly<Record<string, unknown>>} metadata
 */

/**
 * @param {Partial<MatchGenerationRequest>} [partial]
 * @returns {MatchGenerationRequest}
 */
export function createMatchGenerationRequest(partial = {}) {
  const strategyCheck = resolveSupportedStrategy(partial?.strategy);
  if (!strategyCheck.ok) {
    const code =
      strategyCheck.reason === "STRATEGY_DEFERRED"
        ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_DEFERRED
        : strategyCheck.reason === "STRATEGY_REQUIRED"
          ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_REQUIRED
          : MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED;
    throw new MatchGenerationContractError(
      code,
      `MatchGenerationRequest.strategy rejected: ${partial?.strategy}`,
      { strategy: partial?.strategy ?? null, reason: strategyCheck.reason }
    );
  }

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    competitionId: String(partial.competitionId || "").trim(),
    divisionId: String(partial.divisionId || "").trim(),
    categoryId:
      typeof partial.categoryId === "string" && partial.categoryId.trim()
        ? partial.categoryId.trim()
        : null,
    stageId: String(partial.stageId || "").trim(),
    strategy: strategyCheck.strategy,
    drawReference: Object.freeze({
      drawId: String(partial.drawReference?.drawId || "").trim(),
      drawVersion: String(partial.drawReference?.drawVersion || "").trim(),
      drawFingerprint: String(
        partial.drawReference?.drawFingerprint || ""
      ).trim(),
    }),
    evaluatedRuleReference: Object.freeze({
      ruleSetId: String(partial.evaluatedRuleReference?.ruleSetId || "").trim(),
      ruleSetVersion: String(
        partial.evaluatedRuleReference?.ruleSetVersion || ""
      ).trim(),
      ruleEvaluationFingerprint: String(
        partial.evaluatedRuleReference?.ruleEvaluationFingerprint || ""
      ).trim(),
    }),
    participantSnapshotReference: Object.freeze({
      snapshotId: String(
        partial.participantSnapshotReference?.snapshotId || ""
      ).trim(),
      participantFingerprint: String(
        partial.participantSnapshotReference?.participantFingerprint || ""
      ).trim(),
    }),
    generatorVersion: String(
      partial.generatorVersion || MATCH_GENERATOR_IDENTITY.version
    ).trim(),
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
