/**
 * I&A-12 — AI and Advanced Intelligence Readiness enums.
 */

export const INTELLIGENCE_RISK_TIER = Object.freeze({
  LOW: "LOW",
  MODERATE: "MODERATE",
  HIGH: "HIGH",
  PROHIBITED: "PROHIBITED",
});

export const INTELLIGENCE_USE_CASE_LIFECYCLE = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  DEPRECATED: "DEPRECATED",
  RETIRED: "RETIRED",
  PROHIBITED: "PROHIBITED",
});

export const INTELLIGENCE_FEATURE_VALUE_TYPE = Object.freeze({
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  STRING_ENUM: "STRING_ENUM",
  CATEGORY: "CATEGORY",
  RATIO: "RATIO",
  COUNT: "COUNT",
  DURATION_MS: "DURATION_MS",
  MONEY_MINOR: "MONEY_MINOR",
  REFERENCE_ID: "REFERENCE_ID",
});

export const INTELLIGENCE_MISSING_VALUE_POLICY = Object.freeze({
  REJECT: "REJECT",
  ALLOW_NULL: "ALLOW_NULL",
  OMIT_FEATURE: "OMIT_FEATURE",
});

export const INTELLIGENCE_CANDIDATE_STATUS = Object.freeze({
  GENERATED: "GENERATED",
  ABSTAINED: "ABSTAINED",
  REJECTED: "REJECTED",
  REQUIRES_REVIEW: "REQUIRES_REVIEW",
  APPROVED_FOR_PRESENTATION: "APPROVED_FOR_PRESENTATION",
  EXPIRED: "EXPIRED",
});

export const INTELLIGENCE_CONFIDENCE_SOURCE = Object.freeze({
  PROVIDER_REPORTED: "PROVIDER_REPORTED",
  EVALUATION_DERIVED: "EVALUATION_DERIVED",
  UNKNOWN: "UNKNOWN",
  UNSPECIFIED: "UNSPECIFIED",
});

export const INTELLIGENCE_CONFIDENCE_SCALE = Object.freeze({
  UNIT_INTERVAL: "UNIT_INTERVAL",
  PERCENT: "PERCENT",
  ORDINAL_1_5: "ORDINAL_1_5",
  UNKNOWN: "UNKNOWN",
});

export const INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT = Object.freeze({
  REQUIRED: "REQUIRED",
  OPTIONAL: "OPTIONAL",
  NOT_ALLOWED: "NOT_ALLOWED",
});

export const INTELLIGENCE_HUMAN_REVIEW_OUTCOME = Object.freeze({
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  NEEDS_MORE_INFORMATION: "NEEDS_MORE_INFORMATION",
  PENDING: "PENDING",
});

export const INTELLIGENCE_FALLBACK_POLICY = Object.freeze({
  ABSTAIN: "ABSTAIN",
  RETURN_DETERMINISTIC_ANALYTICS: "RETURN_DETERMINISTIC_ANALYTICS",
  RETURN_NO_INSIGHT: "RETURN_NO_INSIGHT",
  REQUIRE_HUMAN_REVIEW: "REQUIRE_HUMAN_REVIEW",
  FAIL_CLOSED: "FAIL_CLOSED",
});

export const INTELLIGENCE_ABSTENTION_REASON = Object.freeze({
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  POLICY: "POLICY",
  PROVIDER_FAILURE: "PROVIDER_FAILURE",
  PRIVACY: "PRIVACY",
  CAPABILITY_MISMATCH: "CAPABILITY_MISMATCH",
  EMPTY_FEATURES: "EMPTY_FEATURES",
  EXPLICIT: "EXPLICIT",
});

export const INTELLIGENCE_PROVIDER_LIFECYCLE = Object.freeze({
  ACTIVE: "ACTIVE",
  DEPRECATED: "DEPRECATED",
  RETIRED: "RETIRED",
  CERTIFICATION_ONLY: "CERTIFICATION_ONLY",
});

export const INTELLIGENCE_MODEL_CAPABILITY = Object.freeze({
  STRUCTURED_OUTPUT: "STRUCTURED_OUTPUT",
  SUMMARY: "SUMMARY",
  EXPLANATION: "EXPLANATION",
  ANOMALY_CANDIDATE: "ANOMALY_CANDIDATE",
  FORECAST_CANDIDATE: "FORECAST_CANDIDATE",
  RECOMMENDATION_CANDIDATE: "RECOMMENDATION_CANDIDATE",
  NARRATIVE_CANDIDATE: "NARRATIVE_CANDIDATE",
});

export const INTELLIGENCE_OUTPUT_CLASSIFICATION = Object.freeze({
  ADVISORY_SUMMARY: "ADVISORY_SUMMARY",
  ADVISORY_INSIGHT: "ADVISORY_INSIGHT",
  ADVISORY_ANOMALY: "ADVISORY_ANOMALY",
  ADVISORY_FORECAST: "ADVISORY_FORECAST",
  ADVISORY_RECOMMENDATION: "ADVISORY_RECOMMENDATION",
  ADVISORY_NARRATIVE: "ADVISORY_NARRATIVE",
  ADVISORY_DATA_QUALITY: "ADVISORY_DATA_QUALITY",
  PROHIBITED_DECISION: "PROHIBITED_DECISION",
});

export const INTELLIGENCE_QUALITY_GATE_STATUS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  WARN: "WARN",
});

export const INTELLIGENCE_DRIFT_SIGNAL_TYPE = Object.freeze({
  INPUT_SCHEMA_DRIFT: "INPUT_SCHEMA_DRIFT",
  FEATURE_DISTRIBUTION_DRIFT: "FEATURE_DISTRIBUTION_DRIFT",
  OUTPUT_SCHEMA_DRIFT: "OUTPUT_SCHEMA_DRIFT",
  QUALITY_DEGRADATION: "QUALITY_DEGRADATION",
  ABSTENTION_RATE_CHANGE: "ABSTENTION_RATE_CHANGE",
  SAFETY_FAILURE: "SAFETY_FAILURE",
  PRIVACY_FAILURE: "PRIVACY_FAILURE",
  STALE_MODEL: "STALE_MODEL",
  STALE_PROMPT: "STALE_PROMPT",
  STALE_POLICY: "STALE_POLICY",
  PROVIDER_CAPABILITY_CHANGE: "PROVIDER_CAPABILITY_CHANGE",
});

export const INTELLIGENCE_PRESENTATION_DATA_STATE = Object.freeze({
  GENERATED: "GENERATED",
  REQUIRES_REVIEW: "REQUIRES_REVIEW",
  ABSTAINED: "ABSTAINED",
  REJECTED: "REJECTED",
  DENIED: "DENIED",
  SUPPRESSED: "SUPPRESSED",
  EMPTY: "EMPTY",
  ERROR: "ERROR",
});

export const INTELLIGENCE_WARNING_CODE = Object.freeze({
  USE_CASE_DEPRECATED: "INTELLIGENCE_USE_CASE_DEPRECATED",
  STALE_MODEL: "INTELLIGENCE_STALE_MODEL",
  STALE_PROMPT: "INTELLIGENCE_STALE_PROMPT",
  STALE_POLICY: "INTELLIGENCE_STALE_POLICY",
  LOW_CONFIDENCE: "INTELLIGENCE_LOW_CONFIDENCE",
  EMPTY_FEATURE_SET: "INTELLIGENCE_EMPTY_FEATURE_SET",
});

export const AI_ADVANCED_INTELLIGENCE_READINESS_METHOD_VERSION = "1.0.0";

export const AI_ADVANCED_INTELLIGENCE_READINESS_COMPLETENESS = Object.freeze({
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
});

/** Prohibited use-case IDs that fail closed before provider invocation. */
export const PROHIBITED_INTELLIGENCE_USE_CASE_IDS = Object.freeze([
  "automated.financial.approval",
  "credit.lending.decision",
  "fraud.accusation",
  "disciplinary.decision",
  "player.suspension",
  "customer.rejection",
  "employee.performance.decision",
  "access.authorization",
  "role.permission.assignment",
  "medical.health.inference",
  "sensitive.demographic.inference",
  "identity.resolution",
  "face.recognition",
  "player.eligibility.decision",
  "automatic.ranking.rating.adjustment",
  "automatic.score.result.correction",
  "automatic.competition.winner.decision",
  "automatic.pricing",
  "automatic.refund",
  "automatic.payment.settlement",
  "automatic.legal.advice",
  "automatic.production.command.execution",
]);

export const FORBIDDEN_INTELLIGENCE_FEATURE_KEYS = Object.freeze([
  "email",
  "phone",
  "fullName",
  "name",
  "ssn",
  "dateOfBirth",
  "address",
  "nationalId",
  "passport",
  "token",
  "accessToken",
  "authToken",
  "password",
  "secret",
  "apiKey",
  "credentials",
  "cardNumber",
  "cvv",
  "paymentCredential",
  "privateNotes",
  "freeFormPrivateText",
  "rawUserText",
  "systemPrompt",
  "hiddenPrompt",
  "chainOfThought",
]);

export const FORBIDDEN_PROVIDER_SECRET_KEYS = Object.freeze([
  "apiKey",
  "token",
  "accessToken",
  "secret",
  "password",
  "credentials",
  "endpointCredential",
  "privateUrl",
  "authorizationHeader",
]);

export const ADVANCED_INTELLIGENCE_DEFERRED = Object.freeze([
  "anomaly-detection-model",
  "time-series-forecasting-algorithm",
  "optimization-engine",
  "recommendation-algorithm",
  "generative-provider-integration",
  "vector-database",
  "embedding-generation",
  "rag",
  "agent-execution",
  "tool-calling",
  "automated-workflow-execution",
]);

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 * @returns {boolean}
 */
export function isIntelligenceEnumValue(value, enumObject) {
  return typeof value === "string" && Object.values(enumObject).includes(value);
}
