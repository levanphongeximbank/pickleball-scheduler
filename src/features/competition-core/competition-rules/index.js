/**
 * Canonical Competition Rules & Format
 * Policy / configuration domain + internal Adapter A policy gateway.
 *
 * Builds on CORE-01 constraint rule engine — does NOT replace it.
 * NOT Canonical Competition Adapter Contract #17.
 */

export * from "./constants/index.js";
export * from "./domain/index.js";
export * from "./services/index.js";

export {
  CANONICAL_COMPETITION_RULES_CONTRACT,
  canonicalCompetitionRulesContractApi,
  resolveRefereeRequirement,
  resolveCourtRequirement,
  resolveScheduleConstraints,
  resolvePublicationPolicy,
  resolveKnockoutEntryRound,
} from "./contract/canonicalRulesContract.js";

export {
  createCompetitionRulesPolicyGateway,
  competitionRulesPolicyGateway,
  normalizeGatewayRequest,
} from "./gateway/competitionRulesPolicyGateway.js";

export { composeCore01AuthorityContext } from "./adapters/core01Composition.js";
