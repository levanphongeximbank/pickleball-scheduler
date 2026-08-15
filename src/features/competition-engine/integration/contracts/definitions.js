/**
 * Frozen V1 definitions for the 14 Canonical Competition Adapter Contracts
 * owned by this workstream. Court and Referee are catalogued separately
 * from their existing merged identities and are not redefined here.
 */

import {
  ADAPTER_DIRECTION,
  CAPABILITY_KIND,
  COMPETITION_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
  PRODUCTION_BINDING_STATUS,
  RUNTIME_CLASSIFICATION,
  SHARED_ADAPTER_ERROR_CODE,
  SHARED_FORBIDDEN_METHODS,
} from "./kernel/constants.js";
import { freezeClone } from "./kernel/helpers.js";

function capability(name, kind, extra = {}) {
  return Object.freeze({ name, kind, required: extra.required !== false, ...extra });
}

function defineContract(spec) {
  const {
    forbiddenAuthorityKeys = [],
    forbiddenMethods = [],
    errorCodes = [],
    ...rest
  } = spec;
  return freezeClone({
    contractVersion: COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
    locked: COMPETITION_ADAPTER_CONTRACT_LOCKED,
    ...rest,
    forbiddenAuthorityKeys: [
      ...FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
      ...forbiddenAuthorityKeys,
    ],
    forbiddenMethods: [...SHARED_FORBIDDEN_METHODS, ...forbiddenMethods],
    errorCodes: [...Object.values(SHARED_ADAPTER_ERROR_CODE), ...errorCodes],
  });
}

export const IDENTITY_ACCESS_CONTRACT = defineContract({
  ordinal: 1,
  contractId: "competition.identity-access.adapter.v1",
  domain: "identity-access",
  authorityOwner: "src/features/identity",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.BOUND,
  requiredContext: ["contractVersion", "tenantId", "actorId", "correlationId"],
  capabilities: [
    capability("resolveActorIdentity", CAPABILITY_KIND.QUERY),
    capability("getAuthorizationEvidence", CAPABILITY_KIND.QUERY),
    capability("getCapabilityEvidence", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: [
    "resolveActorIdentity",
    "getAuthorizationEvidence",
    "getCapabilityEvidence",
  ],
  forbiddenMethods: [
    "authenticateCredentials",
    "mintSession",
    "storePassword",
    "grantPermission",
    "createRole",
    "inferIdentityByDisplayName",
  ],
});

export const TENANT_ORGANIZATION_CONTRACT = defineContract({
  ordinal: 2,
  contractId: "competition.tenant-organization.adapter.v1",
  domain: "tenant-organization",
  authorityOwner: "src/features/tenant",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("resolveTenantIdentity", CAPABILITY_KIND.QUERY),
    capability("validateScope", CAPABILITY_KIND.QUERY),
    capability("distinguishScopeIds", CAPABILITY_KIND.QUERY),
    capability("resolveOrganizationIdentity", CAPABILITY_KIND.QUERY),
    capability("getOrganizationStatus", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: [
    "resolveTenantIdentity",
    "validateScope",
    "distinguishScopeIds",
    "resolveOrganizationIdentity",
    "getOrganizationStatus",
  ],
  forbiddenMethods: [
    "createTenant",
    "createOrganization",
    "inferTenantFromDisplayName",
  ],
});

export const PARTICIPANT_CONTRACT = defineContract({
  ordinal: 3,
  contractId: "competition.participant.adapter.v1",
  domain: "participant",
  authorityOwner: "src/features/player",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.BOUND,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("resolveCanonicalParticipant", CAPABILITY_KIND.QUERY),
    capability("getCompetitionSafeProfile", CAPABILITY_KIND.QUERY),
    capability("verifySourceStatus", CAPABILITY_KIND.QUERY),
    capability("getParticipantSnapshot", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: [
    "resolveCanonicalParticipant",
    "getCompetitionSafeProfile",
    "verifySourceStatus",
    "getParticipantSnapshot",
  ],
  forbiddenMethods: [
    "mutatePlayerProfile",
    "createPlayer",
    "inferParticipantByDisplayName",
  ],
});

export const CLUB_TEAM_MEMBERSHIP_CONTRACT = defineContract({
  ordinal: 4,
  contractId: "competition.club-team-membership.adapter.v1",
  domain: "club-team-membership",
  authorityOwner: "src/features/club",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_CANONICAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getClubAffiliation", CAPABILITY_KIND.QUERY),
    capability("getMembershipStatus", CAPABILITY_KIND.QUERY),
    capability("getMembershipEvidence", CAPABILITY_KIND.QUERY),
    capability("getTeamIdentity", CAPABILITY_KIND.QUERY),
    capability("getTeamRoster", CAPABILITY_KIND.QUERY),
    capability("getCaptainRelationship", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: [
    "getClubAffiliation",
    "getMembershipStatus",
    "getMembershipEvidence",
    "getTeamIdentity",
    "getTeamRoster",
    "getCaptainRelationship",
  ],
  forbiddenMethods: [
    "decideSeed",
    "decideDraw",
    "decideMatchup",
    "decideStandings",
    "decideChampion",
    "decideEligibilityFinal",
  ],
});

export const RATING_CONTRACT = defineContract({
  ordinal: 5,
  contractId: "competition.rating.adapter.v1",
  domain: "rating",
  authorityOwner: "src/features/player-rating",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getRatingSnapshot", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: ["getRatingSnapshot"],
  forbiddenMethods: [
    "calculateSeed",
    "formPairs",
    "mutateLockedDraw",
    "ownRatingEngine",
  ],
});

export const RANKING_CONTRACT = defineContract({
  ordinal: 6,
  contractId: "competition.ranking.adapter.v1",
  domain: "ranking",
  authorityOwner: "src/features/vpr-ranking",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getRankingSnapshot", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: ["getRankingSnapshot"],
  forbiddenMethods: ["runRankingEngine", "mutateLockedDrawFromRanking"],
});

export const FINANCE_PAYMENT_CONTRACT = defineContract({
  ordinal: 9,
  contractId: "competition.finance-payment.adapter.v1",
  domain: "finance-payment",
  authorityOwner: "src/features/finance",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "competitionId", "correlationId"],
  capabilities: [
    capability("getEntryFeeStatus", CAPABILITY_KIND.QUERY),
    capability("getPaymentState", CAPABILITY_KIND.QUERY),
    capability("getWaiverStatus", CAPABILITY_KIND.QUERY),
    capability("getRefundState", CAPABILITY_KIND.QUERY),
    capability("getSettlementReference", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: [
    "getEntryFeeStatus",
    "getPaymentState",
    "getWaiverStatus",
    "getRefundState",
    "getSettlementReference",
  ],
  forbiddenMethods: [
    "postLedgerEntry",
    "ownAccounting",
    "createPaymentProcessor",
    "createPaymentIntent",
    "refundPayment",
  ],
});

export const NOTIFICATION_COMMUNICATION_CONTRACT = defineContract({
  ordinal: 10,
  contractId: "competition.notification-communication.adapter.v1",
  domain: "notification-communication",
  authorityOwner: "src/features/notifications",
  direction: ADAPTER_DIRECTION.OUTBOUND_EVENT,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.PARTIAL,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("publishCompetitionCommunicationEvent", CAPABILITY_KIND.EVENT, {
      requiresIdempotencyKey: true,
    }),
  ],
  requiredMethods: ["publishCompetitionCommunicationEvent"],
  forbiddenMethods: ["decideCompetitionLifecycle", "mutateMatchResult"],
});

export const FILE_MEDIA_CONTRACT = defineContract({
  ordinal: 11,
  contractId: "competition.file-media.adapter.v1",
  domain: "file-media",
  authorityOwner: "none-canonical",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getDocumentReference", CAPABILITY_KIND.QUERY),
    capability("getMediaReference", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: ["getDocumentReference", "getMediaReference"],
  forbiddenMethods: ["ownFileStorage", "bindStorageProvider"],
});

export const STREAMING_SCOREBOARD_CONTRACT = defineContract({
  ordinal: 12,
  contractId: "competition.streaming-scoreboard.adapter.v1",
  domain: "streaming-scoreboard",
  authorityOwner: "src/features/tournament-broadcast",
  direction: ADAPTER_DIRECTION.OUTBOUND_EVENT,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "competitionId", "correlationId"],
  capabilities: [
    capability("publishScoreboardProjection", CAPABILITY_KIND.EVENT),
    capability("getStreamingMetadata", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: ["publishScoreboardProjection", "getStreamingMetadata"],
  forbiddenMethods: ["writeCanonicalScore", "decideScoring"],
});

export const FEDERATION_EXTERNAL_AUTHORITY_CONTRACT = defineContract({
  ordinal: 13,
  contractId: "competition.federation-external-authority.adapter.v1",
  domain: "federation-external-authority",
  authorityOwner: "src/features/ecosystem-integrations",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getFederationPlayerEvidence", CAPABILITY_KIND.QUERY),
    capability("getLicenseEvidence", CAPABILITY_KIND.QUERY),
    capability("getSanctionEvidence", CAPABILITY_KIND.QUERY),
    capability("getExternalEligibilityEvidence", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: [
    "getFederationPlayerEvidence",
    "getLicenseEvidence",
    "getSanctionEvidence",
    "getExternalEligibilityEvidence",
  ],
  forbiddenMethods: ["inventFederationData", "decideFinalEligibility"],
});

export const CRM_SPONSOR_CONTRACT = defineContract({
  ordinal: 14,
  contractId: "competition.crm-sponsor.adapter.v1",
  domain: "crm-sponsor",
  authorityOwner: "src/features/crm",
  direction: ADAPTER_DIRECTION.INBOUND_QUERY,
  runtimeClassification: RUNTIME_CLASSIFICATION.CONTRACT_ONLY_NO_RUNTIME,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("getSponsorReference", CAPABILITY_KIND.QUERY),
    capability("getSponsorPackageReference", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: ["getSponsorReference", "getSponsorPackageReference"],
  forbiddenMethods: ["ownTournament", "exposeSensitiveCrmStorage"],
});

export const ANALYTICS_REPORTING_CONTRACT = defineContract({
  ordinal: 15,
  contractId: "competition.analytics-reporting.adapter.v1",
  domain: "analytics-reporting",
  authorityOwner: "src/features/intelligence-analytics",
  direction: ADAPTER_DIRECTION.OUTBOUND_EVENT,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "correlationId"],
  capabilities: [
    capability("publishCompetitionAnalyticsFact", CAPABILITY_KIND.EVENT),
    capability("getNonAuthoritativeReport", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: [
    "publishCompetitionAnalyticsFact",
    "getNonAuthoritativeReport",
  ],
  forbiddenMethods: ["writeCanonicalResult", "feedDerivedAsTruth"],
});

export const AUDIT_CONTRACT = defineContract({
  ordinal: 16,
  contractId: "competition.audit.adapter.v1",
  domain: "audit",
  authorityOwner: "src/features/identity/services/auditService.js + competition-core/audit",
  direction: ADAPTER_DIRECTION.MIXED,
  runtimeClassification: RUNTIME_CLASSIFICATION.EXISTING_PARTIAL_CAPABILITY,
  productionBinding: PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  requiredContext: ["contractVersion", "tenantId", "actorId", "correlationId"],
  capabilities: [
    capability("appendAuditRecord", CAPABILITY_KIND.COMMAND),
    capability("queryAuditEvidence", CAPABILITY_KIND.QUERY),
  ],
  requiredMethods: ["appendAuditRecord", "queryAuditEvidence"],
  forbiddenMethods: [
    "approveBusinessOperation",
    "mutateCompetitionDecision",
    "replaceDomainPersistence",
    "dropRequiredAuditEvent",
  ],
});

export const WORKSTREAM_CONTRACT_DEFINITIONS = Object.freeze([
  IDENTITY_ACCESS_CONTRACT,
  TENANT_ORGANIZATION_CONTRACT,
  PARTICIPANT_CONTRACT,
  CLUB_TEAM_MEMBERSHIP_CONTRACT,
  RATING_CONTRACT,
  RANKING_CONTRACT,
  FINANCE_PAYMENT_CONTRACT,
  NOTIFICATION_COMMUNICATION_CONTRACT,
  FILE_MEDIA_CONTRACT,
  STREAMING_SCOREBOARD_CONTRACT,
  FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
  CRM_SPONSOR_CONTRACT,
  ANALYTICS_REPORTING_CONTRACT,
  AUDIT_CONTRACT,
]);

export const WORKSTREAM_CONTRACTS_BY_ID = Object.freeze(
  Object.fromEntries(
    WORKSTREAM_CONTRACT_DEFINITIONS.map((def) => [def.contractId, def])
  )
);

export function getWorkstreamContractDefinition(contractId) {
  return WORKSTREAM_CONTRACTS_BY_ID[contractId] || null;
}
