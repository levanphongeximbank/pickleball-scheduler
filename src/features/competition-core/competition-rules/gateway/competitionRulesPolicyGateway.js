/**
 * Adapter A — Canonical Competition Rules Policy Gateway.
 *
 * MODE_AGNOSTIC=YES
 * TRANSLATION_OR_POLICY_GATEWAY=YES
 * PERSISTENCE_AUTHORITY=NO
 * EXECUTION_AUTHORITY=NO
 *
 * NOT Canonical Competition Adapter Contract #17.
 * Does not contain Official / Internal / Team / Daily mode logic.
 */

import {
  COMPETITION_RULES_POLICY_GATEWAY_ID,
  COMPETITION_RULES_POLICY_GATEWAY_VERSION,
  COMPETITION_RULES_CONTRACT_ID,
  COMPETITION_RULES_CONTRACT_VERSION,
} from "../constants/versions.js";
import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  CANONICAL_COMPETITION_RULES_CONTRACT,
  canonicalCompetitionRulesContractApi,
  resolveRefereeRequirement,
  resolveCourtRequirement,
  resolveScheduleConstraints,
  resolvePublicationPolicy,
  resolveKnockoutEntryRound,
} from "../contract/canonicalRulesContract.js";

const FORBIDDEN_MODE_KEYS = Object.freeze([
  "officialUi",
  "internalUi",
  "teamUi",
  "dailyUi",
  "mode",
  "tournamentMode",
  "officialRegistration",
  "dreambreaker",
  "publicFee",
]);

/**
 * Normalize a mode-agnostic gateway request.
 * Rejects mode-specific contamination fail-closed.
 * @param {object} [request]
 */
export function normalizeGatewayRequest(request = {}) {
  if (request == null || typeof request !== "object" || Array.isArray(request)) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_PROFILE,
      message: "Gateway request must be a plain object",
    });
  }

  for (const key of FORBIDDEN_MODE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(request, key)) {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.MODE_LOGIC_FORBIDDEN,
        message: `Adapter A forbids mode-specific key: ${key}`,
        details: Object.freeze({ key }),
      });
    }
  }

  return Object.freeze({
    ok: true,
    profile: request.profile ?? request,
    context: Object.freeze({
      stage: request.stage ?? request.context?.stage ?? null,
      ruleSource: request.ruleSource ?? request.context?.ruleSource ?? null,
      operation: request.operation ?? request.context?.operation ?? null,
      lifecycleMilestone:
        request.lifecycleMilestone ?? request.context?.lifecycleMilestone ?? null,
      ruleClass: request.ruleClass ?? request.context?.ruleClass ?? null,
      enforceExecutionCapability:
        request.enforceExecutionCapability === true ||
        request.context?.enforceExecutionCapability === true,
      requireTenant: request.requireTenant ?? request.context?.requireTenant,
      requireCompetition:
        request.requireCompetition ?? request.context?.requireCompetition,
    }),
  });
}

/**
 * Create the Adapter A policy gateway instance.
 * @param {{ now?: () => string }} [deps]
 */
export function createCompetitionRulesPolicyGateway(deps = {}) {
  const api = canonicalCompetitionRulesContractApi;

  return Object.freeze({
    adapterId: COMPETITION_RULES_POLICY_GATEWAY_ID,
    adapterVersion: COMPETITION_RULES_POLICY_GATEWAY_VERSION,
    contractId: COMPETITION_RULES_CONTRACT_ID,
    contractVersion: COMPETITION_RULES_CONTRACT_VERSION,
    translationOrPolicyGateway: "POLICY_GATEWAY",
    modeAgnostic: true,
    persistenceAuthority: false,
    executionAuthority: false,
    isCatalogContract17: false,
    catalogContractNumber: null,
    contractDescriptor: CANONICAL_COMPETITION_RULES_CONTRACT,

    getCompetitionRulesProfile(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return Object.freeze({
        ok: true,
        profile: api.getCompetitionRulesProfile(normalized.profile),
      });
    },

    validateCompetitionRulesProfile(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return api.validateCompetitionRulesProfile(normalized.profile, {
        enforceExecutionCapability:
          normalized.context.enforceExecutionCapability,
        requireTenant: normalized.context.requireTenant,
        requireCompetition: normalized.context.requireCompetition,
      });
    },

    resolveEffectiveCompetitionRules(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return api.resolveEffectiveCompetitionRules(normalized.profile, {
        stage: normalized.context.stage || undefined,
        ruleSource: normalized.context.ruleSource || undefined,
        operation: normalized.context.operation || undefined,
        enforceExecutionCapability:
          normalized.context.enforceExecutionCapability,
        requireTenant: normalized.context.requireTenant,
        requireCompetition: normalized.context.requireCompetition,
      });
    },

    resolveStageMatchRules(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      if (!normalized.context.stage) {
        return Object.freeze({
          ok: false,
          code: COMPETITION_RULES_ERROR_CODE.UNKNOWN_STAGE,
          message: "stage is required for resolveStageMatchRules",
        });
      }
      return api.resolveStageMatchRules(
        normalized.profile,
        normalized.context.stage
      );
    },

    deriveQualificationPlan(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      const profile = api.getCompetitionRulesProfile(normalized.profile);
      return api.deriveQualificationPlan({
        groupCount: profile.groupStage.groupCount,
        totalQualifiers: profile.qualification.totalQualifiers,
        directQualifiersPerGroup:
          profile.qualification.directQualifiersPerGroup,
        groupStageEnabled: profile.groupStage.groupStageEnabled,
      });
    },

    resolveTieBreakPolicy(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return api.resolveTieBreakPolicy(normalized.profile);
    },

    resolveWildcardRankingPolicy(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return api.resolveWildcardRankingPolicy(normalized.profile, {
        requestAuthoritativeRanking:
          request?.requestAuthoritativeRanking === true ||
          request?.context?.requestAuthoritativeRanking === true,
      });
    },

    resolveKnockoutEntryRound(request) {
      const count =
        request?.qualifierCount ??
        request?.profile?.knockout?.qualifierCount ??
        request?.knockout?.qualifierCount;
      return resolveKnockoutEntryRound(count);
    },

    canMutateCompetitionRule(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return api.canMutateCompetitionRule({
        profile: normalized.profile,
        ruleClass: normalized.context.ruleClass,
        lifecycleMilestone: normalized.context.lifecycleMilestone,
      });
    },

    resolveRefereeRequirement(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      if (!normalized.context.stage) {
        return Object.freeze({
          ok: false,
          code: COMPETITION_RULES_ERROR_CODE.UNKNOWN_STAGE,
          message: "stage is required for resolveRefereeRequirement",
        });
      }
      return resolveRefereeRequirement(
        normalized.profile,
        normalized.context.stage
      );
    },

    resolveCourtRequirement(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return resolveCourtRequirement(
        normalized.profile,
        normalized.context.stage || undefined
      );
    },

    resolveScheduleConstraints(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return resolveScheduleConstraints(
        normalized.profile,
        normalized.context.stage || undefined
      );
    },

    resolvePublicationPolicy(request) {
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return resolvePublicationPolicy(normalized.profile);
    },

    resolveCapabilityState(request) {
      if (request?.capabilityId) {
        return api.resolveCapabilityState(request.capabilityId);
      }
      const normalized = normalizeGatewayRequest(request);
      if (!normalized.ok) return normalized;
      return api.resolveProfileCapabilityState(normalized.profile);
    },

    /** Explicit denial — Adapter A never assigns referees. */
    assignReferee() {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.CAPABILITY_UNSUPPORTED,
        message: "Adapter A does not assign referees; CORE-13 remains authority",
      });
    },

    /** Explicit denial — Adapter A never scores matches. */
    scoreMatch() {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.CAPABILITY_UNSUPPORTED,
        message: "Adapter A does not score matches; CORE-16 remains authority",
      });
    },

    /** Explicit denial — Adapter A never accepts results. */
    acceptResult() {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.CAPABILITY_UNSUPPORTED,
        message:
          "Adapter A does not accept results; CORE-17 remains authority",
      });
    },
  });
}

/** Singleton default gateway for convenient import. */
export const competitionRulesPolicyGateway =
  createCompetitionRulesPolicyGateway();
