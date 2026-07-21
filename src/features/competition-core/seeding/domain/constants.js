/**
 * CORE-07 Phase 1C — domain constants (docs 08 / 09 / 10).
 */

export const CORE07_COMPARISON_CONTRACT_VERSION = "core07-compare-v1";
export const CORE07_SEEDING_CONTRACT_VERSION = "core07-seeding-contracts-v1";

export const ENTRY_TYPE = Object.freeze({
  PARTICIPANT: "PARTICIPANT",
  ENTRY: "ENTRY",
  PAIR: "PAIR",
  TEAM: "TEAM",
});

/** @type {ReadonlySet<string>} */
export const ENTRY_TYPE_VALUES = new Set(Object.values(ENTRY_TYPE));

export const ELIGIBILITY_STATUS = Object.freeze({
  ELIGIBLE: "ELIGIBLE",
  INELIGIBLE: "INELIGIBLE",
  UNKNOWN: "UNKNOWN",
});

/** @type {ReadonlySet<string>} */
export const ELIGIBILITY_STATUS_VALUES = new Set(
  Object.values(ELIGIBILITY_STATUS)
);

export const PRIMARY_ORDERING_SOURCE = Object.freeze({
  RANKING_POSITION: "RANKING_POSITION",
  RATING_VALUE: "RATING_VALUE",
  RANKING_SCORE: "RANKING_SCORE",
  REGISTRATION_TIMESTAMP: "REGISTRATION_TIMESTAMP",
});

/** @type {ReadonlySet<string>} */
export const PRIMARY_ORDERING_SOURCE_VALUES = new Set(
  Object.values(PRIMARY_ORDERING_SOURCE)
);

/** Tie-break field keys allowed in policy sequences (plus stableCanonicalId). */
export const TIE_BREAK_FIELD = Object.freeze({
  ...PRIMARY_ORDERING_SOURCE,
  STABLE_CANONICAL_ID: "stableCanonicalId",
});

/** @type {ReadonlySet<string>} */
export const TIE_BREAK_FIELD_VALUES = new Set([
  ...PRIMARY_ORDERING_SOURCE_VALUES,
  TIE_BREAK_FIELD.STABLE_CANONICAL_ID,
]);

export const SORT_DIRECTION = Object.freeze({
  ASC: "ASC",
  DESC: "DESC",
});

/** @type {ReadonlySet<string>} */
export const SORT_DIRECTION_VALUES = new Set(Object.values(SORT_DIRECTION));

export const MISSING_VALUE_BEHAVIOUR = Object.freeze({
  SORT_LAST: "SORT_LAST",
  SORT_FIRST: "SORT_FIRST",
  EXCLUDE: "EXCLUDE",
  FAIL: "FAIL",
});

/** @type {ReadonlySet<string>} */
export const MISSING_VALUE_BEHAVIOUR_VALUES = new Set(
  Object.values(MISSING_VALUE_BEHAVIOUR)
);

/** Default direction per ordering field (doc 10 §4.3). */
export const DEFAULT_FIELD_SORT_DIRECTION = Object.freeze({
  [PRIMARY_ORDERING_SOURCE.RANKING_POSITION]: SORT_DIRECTION.ASC,
  [PRIMARY_ORDERING_SOURCE.RATING_VALUE]: SORT_DIRECTION.DESC,
  [PRIMARY_ORDERING_SOURCE.RANKING_SCORE]: SORT_DIRECTION.DESC,
  [PRIMARY_ORDERING_SOURCE.REGISTRATION_TIMESTAMP]: SORT_DIRECTION.ASC,
  [TIE_BREAK_FIELD.STABLE_CANONICAL_ID]: SORT_DIRECTION.ASC,
});

/** Provenance fields that must never participate in SeedingScope identity. */
export const SCOPE_PROVENANCE_EXCLUSIONS = Object.freeze([
  "policyId",
  "policyVersion",
  "snapshotId",
  "resultVersion",
  "resultId",
  "requestId",
  "deterministicFingerprint",
  "fingerprint",
]);

export const OVERRIDE_ACTION = Object.freeze({
  ASSIGN: "ASSIGN",
  PROTECT: "PROTECT",
  CLEAR: "CLEAR",
});

/** @type {ReadonlySet<string>} */
export const OVERRIDE_ACTION_VALUES = new Set(Object.values(OVERRIDE_ACTION));

export const OVERRIDE_STATUS = Object.freeze({
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
  CANCELLED: "CANCELLED",
});

/** @type {ReadonlySet<string>} */
export const OVERRIDE_STATUS_VALUES = new Set(Object.values(OVERRIDE_STATUS));

export const AUTHORIZATION_DECISION = Object.freeze({
  ALLOWED: "ALLOWED",
  DENIED: "DENIED",
  NOT_EVALUATED: "NOT_EVALUATED",
});

/** @type {ReadonlySet<string>} */
export const AUTHORIZATION_DECISION_VALUES = new Set(
  Object.values(AUTHORIZATION_DECISION)
);

export const MANUAL_OVERRIDE_MODE = Object.freeze({
  DISALLOW: "DISALLOW",
  ALLOW_PARTIAL: "ALLOW_PARTIAL",
  REQUIRE_AUTHORIZED: "REQUIRE_AUTHORIZED",
});

/** @type {ReadonlySet<string>} */
export const MANUAL_OVERRIDE_MODE_VALUES = new Set(
  Object.values(MANUAL_OVERRIDE_MODE)
);

export const ASSIGNMENT_SOURCE = Object.freeze({
  MANUAL_OVERRIDE: "MANUAL_OVERRIDE",
  PROTECTED: "PROTECTED",
  AUTO_ORDER: "AUTO_ORDER",
});

/** @type {ReadonlySet<string>} */
export const ASSIGNMENT_SOURCE_VALUES = new Set(
  Object.values(ASSIGNMENT_SOURCE)
);

export const FINALIZATION_STATE = Object.freeze({
  DRAFT: "DRAFT",
  FINALIZED: "FINALIZED",
  SUPERSEDED: "SUPERSEDED",
  CANCELLED: "CANCELLED",
});

export const CORE07_ELIGIBILITY_PORT_VERSION =
  "core07-eligibility-decision-port-v1";
export const CORE07_RULE_EVALUATION_PORT_VERSION =
  "core07-rule-evaluation-port-v1";
export const CORE07_FINGERPRINT_PORT_VERSION = "core07-fingerprint-port-v1";
