import {
  derivePrivatePairingSource,
  PRIVATE_PAIRING_SOURCE,
  PRIVATE_PAIRING_SOURCE_ORDER,
} from "./privatePairingSource.js";

/**
 * @param {object} resolved
 * @param {string} [operation]
 * @returns {object}
 */
export function buildRuleResolutionMetadata(resolved = {}, operation = "") {
  const effectiveRules = resolved.effectiveRules || resolved.rules || [];
  const bySource = (source) =>
    effectiveRules.filter((rule) => derivePrivatePairingSource(rule) === source).map((rule) => rule.id);

  return {
    operation: operation || resolved.operation || "",
    priorityOrder: resolved.priorityOrder || PRIVATE_PAIRING_SOURCE_ORDER,
    appliedRuleIds: effectiveRules.map((rule) => rule.id).sort(),
    appliedSuperAdminRuleIds: bySource(PRIVATE_PAIRING_SOURCE.SUPER_ADMIN),
    appliedTournamentRuleIds: bySource(PRIVATE_PAIRING_SOURCE.TOURNAMENT),
    appliedClubRuleIds: bySource(PRIVATE_PAIRING_SOURCE.CLUB),
    appliedSessionRuleIds: bySource(PRIVATE_PAIRING_SOURCE.SESSION),
    overriddenRules: resolved.overriddenRules || [],
    ignoredRules: resolved.ignoredRules || [],
    fatalConflicts: resolved.fatalConflicts || [],
    blockedByPolicy: resolved.blockedByPolicy || [],
    hardRuleCount: (resolved.hardRules || []).length,
    softRuleCount: (resolved.softRules || []).length,
    ruleSetVersion: resolved.ruleSetVersion || "",
  };
}

/**
 * Empty ruleResolution for runs without active private-pairing rules.
 *
 * @param {string} [operation]
 * @returns {object}
 */
export function emptyRuleResolutionMetadata(operation = "") {
  return buildRuleResolutionMetadata(
    {
      effectiveRules: [],
      hardRules: [],
      softRules: [],
      overriddenRules: [],
      ignoredRules: [],
      fatalConflicts: [],
      blockedByPolicy: [],
      priorityOrder: PRIVATE_PAIRING_SOURCE_ORDER,
      ruleSetVersion: "",
    },
    operation
  );
}
