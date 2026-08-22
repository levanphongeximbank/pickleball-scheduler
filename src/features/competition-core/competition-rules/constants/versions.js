/**
 * Canonical Competition Rules & Format — capability identity.
 * Internal Competition Platform policy surface — NOT Adapter Contract #17.
 */

export const COMPETITION_RULES_DOMAIN_ID = "competition-core.competition-rules";
/**
 * Semantic domain version — additive knockout admission / qualification extension.
 * Schema identity remains competition.rules.profile.v1 (backward-compatible).
 */
export const COMPETITION_RULES_DOMAIN_VERSION = "1.1.0";

export const COMPETITION_RULES_PROFILE_SCHEMA_V1 = "competition.rules.profile.v1";

/** Adapter A — internal canonical policy gateway (not a numbered catalog contract). */
export const COMPETITION_RULES_POLICY_GATEWAY_ID =
  "competition.rules.policy.gateway.v1";
/** Additive API / profile fields (knockout admission) — compatible minor bump. */
export const COMPETITION_RULES_POLICY_GATEWAY_VERSION = "1.1.0";

export const COMPETITION_RULES_CONTRACT_ID = "competition.rules.contract.v1";
/** Additive contract methods — compatible minor bump; identity stays v1. */
export const COMPETITION_RULES_CONTRACT_VERSION = "1.1.0";
