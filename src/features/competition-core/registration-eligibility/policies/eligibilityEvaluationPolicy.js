import { ELIGIBILITY_CHECK_TYPE } from "../enums/eligibilityCheckType.js";
import { REGISTRATION_STATUS } from "../enums/registrationStatus.js";
import { REGISTRATION_TARGET_TYPE } from "../enums/registrationTargetType.js";
import { createEligibilityPolicy } from "../contracts/eligibility.js";

/** Statuses eligible for eligibility evaluation orchestration. */
export const ELIGIBILITY_EVALUATION_ELIGIBLE_STATUSES = Object.freeze([
  REGISTRATION_STATUS.SUBMITTED,
  REGISTRATION_STATUS.UNDER_REVIEW,
]);

/**
 * Deterministic execution order for checks (alphabetical by check type code).
 * @type {string[]}
 */
export const ELIGIBILITY_CHECK_EXECUTION_ORDER = Object.freeze(
  Object.values(ELIGIBILITY_CHECK_TYPE).sort()
);

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isRegistrationStatusEligibleForEvaluation(status) {
  return ELIGIBILITY_EVALUATION_ELIGIBLE_STATUSES.includes(status);
}

/**
 * @param {import('../contracts/eligibility.js').EligibilityPolicy|null|undefined} policy
 * @param {import('../contracts/registrationTarget.js').RegistrationTarget} target
 * @returns {string[]}
 */
export function resolveRequiredCheckTypes(policy, target) {
  const fromPolicy = Array.isArray(policy?.requiredCheckTypes)
    ? policy.requiredCheckTypes.filter(Boolean)
    : [];

  if (fromPolicy.length > 0) {
    return [...fromPolicy].sort();
  }

  /** @type {string[]} */
  const defaults = [ELIGIBILITY_CHECK_TYPE.REGISTRATION_WINDOW, ELIGIBILITY_CHECK_TYPE.PARTICIPANT_STATUS];
  if (target.targetType === REGISTRATION_TARGET_TYPE.TEAM) {
    defaults.push(ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT);
  }
  return [...defaults].sort();
}

/**
 * @param {string} checkType
 * @param {import('../contracts/eligibility.js').EligibilityPolicy|null|undefined} policy
 * @returns {boolean}
 */
export function isOptionalEligibilityCheck(checkType, policy) {
  const optional = policy?.parameters?.optionalCheckTypes;
  return Array.isArray(optional) && optional.includes(checkType);
}

/**
 * @param {unknown} competitionPolicy
 * @returns {import('../contracts/eligibility.js').EligibilityPolicy|null}
 */
export function resolveEligibilityPolicyFromCompetitionPolicy(competitionPolicy) {
  if (!competitionPolicy || typeof competitionPolicy !== "object") {
    return null;
  }
  const raw = /** @type {{ eligibilityPolicy?: unknown, policyRef?: string|null }} */ (
    competitionPolicy
  ).eligibilityPolicy;
  if (raw && typeof raw === "object") {
    return createEligibilityPolicy(/** @type {any} */ (raw));
  }
  const policyRef = /** @type {{ policyRef?: string|null }} */ (competitionPolicy).policyRef;
  if (policyRef != null && String(policyRef).trim() !== "") {
    return createEligibilityPolicy({ policyId: String(policyRef).trim() });
  }
  return null;
}

/**
 * Sort check types into deterministic orchestration order.
 * @param {string[]} checkTypes
 * @returns {string[]}
 */
export function orderCheckTypesForExecution(checkTypes = []) {
  const set = new Set(checkTypes);
  return ELIGIBILITY_CHECK_EXECUTION_ORDER.filter((t) => set.has(t));
}
