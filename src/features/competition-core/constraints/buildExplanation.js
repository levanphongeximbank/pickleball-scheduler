import { CONSTRAINT_SEVERITY } from "../constants/constraintSeverity.js";
import {
  RULE_ERROR_CODE,
  RULE_ERROR_TITLES,
  RULE_SUGGESTED_RESOLUTIONS,
} from "./ruleConstants.js";

/**
 * @typedef {import('../types/index.js').ConstraintExplanation} ConstraintExplanation
 * @typedef {import('../types/index.js').EngineExplanation} EngineExplanation
 * @typedef {import('../types/index.js').ConstraintSeverityValue} ConstraintSeverityValue
 */

/**
 * @param {Partial<ConstraintExplanation>} partial
 * @returns {ConstraintExplanation}
 */
export function createConstraintExplanation(partial) {
  const reasonCode = String(partial.reasonCode || partial.code || RULE_ERROR_CODE.CONSTRAINT_CONFLICT);
  return {
    reasonCode,
    title: String(partial.title || RULE_ERROR_TITLES[reasonCode] || reasonCode),
    message: String(partial.message || ""),
    severity: partial.severity || CONSTRAINT_SEVERITY.HARD,
    affectedPlayers: Array.isArray(partial.affectedPlayers)
      ? [...partial.affectedPlayers]
      : undefined,
    suggestedResolution:
      partial.suggestedResolution ??
      RULE_SUGGESTED_RESOLUTIONS[reasonCode] ??
      undefined,
    details: partial.details ? { ...partial.details } : undefined,
  };
}

/**
 * @param {EngineExplanation|ConstraintExplanation} item
 * @param {ConstraintSeverityValue} [defaultSeverity]
 * @returns {ConstraintExplanation}
 */
export function toConstraintExplanation(item, defaultSeverity = CONSTRAINT_SEVERITY.HARD) {
  if (item && "reasonCode" in item && item.reasonCode) {
    return createConstraintExplanation(/** @type {ConstraintExplanation} */ (item));
  }

  const engineItem = /** @type {EngineExplanation} */ (item);
  const reasonCode = String(engineItem.code || RULE_ERROR_CODE.CONSTRAINT_CONFLICT);
  const affectedPlayers = Array.isArray(engineItem.details?.affectedPlayers)
    ? engineItem.details.affectedPlayers.map(String)
    : engineItem.details?.playerId
      ? [String(engineItem.details.playerId)]
      : engineItem.details?.anchor && engineItem.details?.target
        ? [String(engineItem.details.anchor), String(engineItem.details.target)]
        : undefined;

  return createConstraintExplanation({
    reasonCode,
    message: engineItem.message,
    severity: /** @type {ConstraintSeverityValue} */ (
      engineItem.details?.severity || defaultSeverity
    ),
    affectedPlayers,
    details: engineItem.details,
  });
}

/**
 * Merge hard violations, soft notes, and conflicts into explainability output.
 *
 * @param {Object} input
 * @param {ConstraintExplanation[]} [input.hardViolations]
 * @param {ConstraintExplanation[]} [input.softNotes]
 * @param {import('../types/index.js').ConstraintConflict[]} [input.conflicts]
 * @returns {ConstraintExplanation[]}
 */
export function buildExplanation(input = {}) {
  /** @type {ConstraintExplanation[]} */
  const explanations = [];

  (input.hardViolations || []).forEach((item) => {
    explanations.push(toConstraintExplanation(item, CONSTRAINT_SEVERITY.HARD));
  });

  (input.softNotes || []).forEach((item) => {
    explanations.push(toConstraintExplanation(item, CONSTRAINT_SEVERITY.SOFT));
  });

  (input.conflicts || []).forEach((conflict) => {
    explanations.push(
      createConstraintExplanation({
        reasonCode: conflict.code,
        message: conflict.message,
        severity: CONSTRAINT_SEVERITY.HARD,
        suggestedResolution: "Resolve conflicting constraints in the rule set configuration.",
        details: { constraints: conflict.constraints },
      })
    );
  });

  return explanations;
}
