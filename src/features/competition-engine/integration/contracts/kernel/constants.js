/**
 * Shared Canonical Competition Adapter Contract kernel — V1 freeze.
 *
 * Adapter contracts are integration boundaries. They must not become a second
 * database, business engine, or Competition Core authority.
 */

export const COMPETITION_ADAPTER_CONTRACT_VERSION_V1 = "1.0.0";

export const COMPETITION_ADAPTER_CONTRACT_LOCKED = true;

export const CAPABILITY_KIND = Object.freeze({
  QUERY: "QUERY",
  COMMAND: "COMMAND",
  EVENT: "EVENT",
});

export const CAPABILITY_KIND_VALUES = Object.freeze(Object.values(CAPABILITY_KIND));

export const ADAPTER_DIRECTION = Object.freeze({
  INBOUND_QUERY: "INBOUND_QUERY",
  OUTBOUND_COMMAND: "OUTBOUND_COMMAND",
  OUTBOUND_EVENT: "OUTBOUND_EVENT",
  MIXED: "MIXED",
});

export const RUNTIME_CLASSIFICATION = Object.freeze({
  EXISTING_CANONICAL_CAPABILITY: "EXISTING_CANONICAL_CAPABILITY",
  EXISTING_PARTIAL_CAPABILITY: "EXISTING_PARTIAL_CAPABILITY",
  CONTRACT_ONLY_NO_RUNTIME: "CONTRACT_ONLY_NO_RUNTIME",
  EXTERNAL_FUTURE_CAPABILITY: "EXTERNAL_FUTURE_CAPABILITY",
});

export const PRODUCTION_BINDING_STATUS = Object.freeze({
  BOUND: "BOUND",
  PARTIAL: "PARTIAL",
  NOT_CONFIGURED: "NOT_CONFIGURED",
});

export const SHARED_ADAPTER_ERROR_CODE = Object.freeze({
  UNKNOWN_CONTRACT: "COMPETITION_ADAPTER_UNKNOWN_CONTRACT",
  INCOMPATIBLE_CONTRACT_VERSION: "COMPETITION_ADAPTER_INCOMPATIBLE_CONTRACT_VERSION",
  MALFORMED_ADAPTER: "COMPETITION_ADAPTER_MALFORMED_ADAPTER",
  MISSING_REQUIRED_CONTEXT: "COMPETITION_ADAPTER_MISSING_REQUIRED_CONTEXT",
  CROSS_TENANT_CONTEXT: "COMPETITION_ADAPTER_CROSS_TENANT_CONTEXT",
  MISSING_CANONICAL_IDENTITY: "COMPETITION_ADAPTER_MISSING_CANONICAL_IDENTITY",
  FORBIDDEN_AUTHORITY: "COMPETITION_ADAPTER_FORBIDDEN_AUTHORITY",
  NOT_CONFIGURED: "COMPETITION_ADAPTER_NOT_CONFIGURED",
  CAPABILITY_NOT_SUPPORTED: "COMPETITION_ADAPTER_CAPABILITY_NOT_SUPPORTED",
  STALE_WRITE: "COMPETITION_ADAPTER_STALE_WRITE",
  MISSING_IDEMPOTENCY: "COMPETITION_ADAPTER_MISSING_IDEMPOTENCY",
  MALFORMED_RESPONSE: "COMPETITION_ADAPTER_MALFORMED_RESPONSE",
  FUZZY_IDENTITY_FORBIDDEN: "COMPETITION_ADAPTER_FUZZY_IDENTITY_FORBIDDEN",
  DUPLICATE_REGISTRATION: "COMPETITION_ADAPTER_DUPLICATE_REGISTRATION",
  REGISTRY_FROZEN: "COMPETITION_ADAPTER_REGISTRY_FROZEN",
  DISPLAY_NAME_IS_NOT_IDENTITY: "COMPETITION_ADAPTER_DISPLAY_NAME_IS_NOT_IDENTITY",
});

export const SHARED_ADAPTER_ERROR_CODE_VALUES = Object.freeze(
  Object.values(SHARED_ADAPTER_ERROR_CODE)
);

/**
 * Competition Core engines adapters must never own.
 */
export const FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS = Object.freeze([
  "eligibilityDecisionEngine",
  "seedingEngine",
  "pairingEngine",
  "drawEngine",
  "scheduleEngine",
  "courtAssignmentEngine",
  "refereeAssignmentEngine",
  "scoringEngine",
  "standingsEngine",
  "qualificationEngine",
  "knockoutEngine",
  "championEngine",
  "competitionLifecycleEngine",
]);

export const SHARED_FORBIDDEN_METHODS = Object.freeze([
  "decideEligibility",
  "runSeeding",
  "runPairing",
  "runDraw",
  "runSchedule",
  "assignCourts",
  "assignReferees",
  "calculateScore",
  "writeCanonicalScore",
  "computeStandings",
  "decideQualification",
  "decideKnockout",
  "decideChampion",
  "advanceCompetitionLifecycle",
]);

export const CANONICAL_CONTEXT_FIELDS = Object.freeze({
  ALWAYS_APPLICABLE: Object.freeze([
    "contractVersion",
    "tenantId",
    "competitionId",
    "correlationId",
  ]),
  ACTOR_SENSITIVE: Object.freeze(["actorId"]),
  WHEN_APPLICABLE: Object.freeze([
    "organizationId",
    "clubId",
    "teamId",
    "participantId",
    "matchId",
    "sourceVersion",
    "snapshotId",
    "effectiveAt",
    "venueId",
  ]),
  MUTATION: Object.freeze(["expectedVersion", "idempotencyKey"]),
});

export const FUZZY_IDENTITY_FIELDS = Object.freeze([
  "displayName",
  "playerName",
  "email",
  "phone",
  "phoneNumber",
  "fullName",
  "name",
]);

export const DISTINCT_SCOPE_KEYS = Object.freeze([
  "tenantId",
  "organizationId",
  "clubId",
  "venueId",
]);

export const OFFICIAL_CONTRACT_COUNT = 16;
export const THIS_WORKSTREAM_CONTRACT_COUNT = 14;

export const WORKSTREAM_OWNED_CONTRACT_IDS = Object.freeze([
  "competition.identity-access.adapter.v1",
  "competition.tenant-organization.adapter.v1",
  "competition.participant.adapter.v1",
  "competition.club-team-membership.adapter.v1",
  "competition.rating.adapter.v1",
  "competition.ranking.adapter.v1",
  "competition.finance-payment.adapter.v1",
  "competition.notification-communication.adapter.v1",
  "competition.file-media.adapter.v1",
  "competition.streaming-scoreboard.adapter.v1",
  "competition.federation-external-authority.adapter.v1",
  "competition.crm-sponsor.adapter.v1",
  "competition.analytics-reporting.adapter.v1",
  "competition.audit.adapter.v1",
]);

export const COURT_CONTRACT_PROTECTED_PATHS = Object.freeze([
  "src/features/competition-core/contracts/competitionCourtAdapterContract.js",
  "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
  "docs/competition-core/COMPETITION_COURT_ADAPTER_CONTRACT.md",
  "tests/competition-core-court-adapter-contract.test.js",
  "tests/competition-core-court-adapter-architecture.test.js",
]);

export const REFEREE_CONTRACT_PROTECTED_PATHS = Object.freeze([
  "src/features/competition-engine/integration/referee/contract.js",
  "src/features/competition-engine/integration/referee/registry.js",
  "src/features/competition-engine/integration/referee/conformance.js",
  "src/features/competition-engine/integration/referee/errors.js",
  "src/features/competition-engine/integration/referee/referenceAdapter.js",
  "src/features/competition-engine/integration/referee/runtimePorts.js",
  "tests/competition-engine-referee-adapter-contract-v1.test.js",
]);

export const PRIVATE_PERSISTENCE_IMPORT_PATTERNS = Object.freeze([
  "domain/clubStorage",
  "auth/supabaseClient",
  "@supabase/supabase-js",
  "club_data_v3",
]);
