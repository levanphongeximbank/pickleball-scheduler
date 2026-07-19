import {
  REGISTRATION_DECISION_TYPE,
  isRegistrationDecisionType,
} from "../enums/registrationDecisionType.js";
import { REGISTRATION_STATUS, isRegistrationStatus } from "../enums/registrationStatus.js";
import {
  createAuditMetadata,
  isNonEmptyString,
  REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
} from "./shared.js";

/**
 * RegistrationDecision — approval / rejection / conditional / review outcome.
 *
 * @typedef {Object} RegistrationDecision
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} registrationId
 * @property {string} decisionType
 * @property {string} resultingStatus
 * @property {string} decidedAt
 * @property {string|null} decidedBy
 * @property {string|null} reasonCode
 * @property {string|null} reasonText
 * @property {string[]} [conditions]
 * @property {string|null} [eligibilityDecisionId]
 * @property {Record<string, unknown>|null} [metadata]
 * @property {import('./shared.js').RegistrationAuditMetadata} [audit]
 */

/**
 * @param {Partial<RegistrationDecision>} partial
 * @returns {RegistrationDecision}
 */
export function createRegistrationDecision(partial = {}) {
  const decisionType = isRegistrationDecisionType(partial.decisionType)
    ? partial.decisionType
    : null;
  if (!decisionType) {
    throw new TypeError("RegistrationDecision requires a valid decisionType");
  }
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("RegistrationDecision requires registrationId");
  }
  if (!isNonEmptyString(partial.decidedAt)) {
    throw new TypeError("RegistrationDecision requires decidedAt from ClockPort");
  }

  const resultingStatus = isRegistrationStatus(partial.resultingStatus)
    ? partial.resultingStatus
    : mapDecisionTypeToStatus(decisionType);

  return {
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    id: String(partial.id || ""),
    registrationId: String(partial.registrationId).trim(),
    decisionType,
    resultingStatus,
    decidedAt: String(partial.decidedAt).trim(),
    decidedBy:
      partial.decidedBy != null && String(partial.decidedBy).trim() !== ""
        ? String(partial.decidedBy).trim()
        : null,
    reasonCode:
      partial.reasonCode != null && String(partial.reasonCode).trim() !== ""
        ? String(partial.reasonCode).trim()
        : null,
    reasonText:
      partial.reasonText != null && String(partial.reasonText).trim() !== ""
        ? String(partial.reasonText).trim()
        : null,
    conditions: Array.isArray(partial.conditions)
      ? partial.conditions.map((c) => String(c))
      : [],
    eligibilityDecisionId:
      partial.eligibilityDecisionId != null &&
      String(partial.eligibilityDecisionId).trim() !== ""
        ? String(partial.eligibilityDecisionId).trim()
        : null,
    metadata:
      partial.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : null,
    audit: createAuditMetadata(partial.audit),
  };
}

/**
 * @param {string} decisionType
 * @returns {string}
 */
export function mapDecisionTypeToStatus(decisionType) {
  switch (decisionType) {
    case REGISTRATION_DECISION_TYPE.APPROVE:
      return REGISTRATION_STATUS.APPROVED;
    case REGISTRATION_DECISION_TYPE.REJECT:
      return REGISTRATION_STATUS.REJECTED;
    case REGISTRATION_DECISION_TYPE.CONDITIONAL_APPROVE:
      return REGISTRATION_STATUS.CONDITIONAL;
    case REGISTRATION_DECISION_TYPE.MANUAL_REVIEW:
      return REGISTRATION_STATUS.UNDER_REVIEW;
    case REGISTRATION_DECISION_TYPE.WAITLIST:
      return REGISTRATION_STATUS.WAITLISTED;
    case REGISTRATION_DECISION_TYPE.WITHDRAW:
      return REGISTRATION_STATUS.WITHDRAWN;
    case REGISTRATION_DECISION_TYPE.CANCEL:
      return REGISTRATION_STATUS.CANCELLED;
    case REGISTRATION_DECISION_TYPE.EXPIRE:
      return REGISTRATION_STATUS.EXPIRED;
    default:
      throw new TypeError(`Unsupported decisionType: ${decisionType}`);
  }
}
