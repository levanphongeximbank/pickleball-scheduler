/**
 * Explicit Finance / Ranking / Performance analytical fact contracts
 * (I&A-09). Facts are immutable, module-neutral, and carry explicit tenant
 * identity + provenance. No mutation methods, callbacks, DB table
 * identities, React state, or business-rule recalculation (no ledger
 * posting, revenue recognition, ranking/rating/standings/score/winner
 * calculation). No PII or payment credentials. No floating-point money.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { rejectForbiddenSensitiveFields } from "./privacy.js";
import { createAnalyticalMoney } from "./money.js";
import {
  PERFORMANCE_ENTITY_TYPE,
  PERFORMANCE_OUTCOME,
  RANK_DIRECTION,
} from "./enums.js";

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function requireTenant(input, field) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        `${field} must be a plain object`,
        field
      )
    );
  }
  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        `${field}.tenantId is required`,
        `${field}.tenantId`
      )
    );
  }
  return ok(null);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function requireNonEmptyString(input, key, field) {
  if (!isNonEmptyString(input[key])) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        `${key} is required`,
        field
      )
    );
  }
  return ok(String(input[key]).trim());
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalIso(input, field) {
  if (input === undefined) return ok(undefined);
  if (!isValidIsoTimestamp(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TIMESTAMP_INVALID,
        `${field} must be a valid ISO timestamp`,
        field
      )
    );
  }
  return ok(String(input).trim());
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalProvenance(input, field) {
  if (input === undefined) return ok(undefined);
  const result = createAnalyticsMetricProvenance(input);
  if (!result.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        result.error.message,
        `${field}.provenance`,
        result.error.details
      )
    );
  }
  return ok(result.value);
}

/**
 * @param {Record<string, unknown>} base
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function attachCommonOptional(base, input) {
  if (input.canonicalSourceRef !== undefined) {
    if (!isNonEmptyString(input.canonicalSourceRef)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
          "canonicalSourceRef must be a non-empty string when provided",
          "canonicalSourceRef"
        )
      );
    }
    base.canonicalSourceRef = String(input.canonicalSourceRef).trim();
  }
  if (input.sourceTimestamp !== undefined) {
    const ts = optionalIso(input.sourceTimestamp, "sourceTimestamp");
    if (!ts.ok) return ts;
    base.sourceTimestamp = ts.value;
  }
  const provenance = optionalProvenance(input.provenance, "fact");
  if (!provenance.ok) return provenance;
  if (provenance.value !== undefined) base.provenance = provenance.value;
  return ok(base);
}

/**
 * @param {Record<string, unknown>} base
 * @param {unknown} input
 * @param {string[]} keys
 * @returns {import("../contracts/result.js").Result}
 */
function attachOptionalStrings(base, input, keys) {
  for (const key of keys) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
            `${key} must be a non-empty string when provided`,
            key
          )
        );
      }
      base[key] = String(input[key]).trim();
    }
  }
  return ok(base);
}

/**
 * Resolves an optional/required AnalyticalMoney amount either from an
 * `amount` object or from flattened `currencyCode`/`amountMinor`/`scale`
 * fields.
 * @param {unknown} input
 * @param {string} field
 * @param {{ required?: boolean }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
function resolveAmount(input, field, options = {}) {
  const hasAmountObject = input.amount !== undefined;
  const hasFlatFields =
    input.amountMinor !== undefined || input.currencyCode !== undefined;

  if (!hasAmountObject && !hasFlatFields) {
    if (options.required) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
          `${field} is required`,
          field
        )
      );
    }
    return ok(undefined);
  }

  const draft = hasAmountObject
    ? input.amount
    : {
        currencyCode: input.currencyCode,
        amountMinor: input.amountMinor,
        scale: input.scale,
      };

  const moneyResult = createAnalyticalMoney(draft);
  if (!moneyResult.ok) {
    return fail(
      analyticsError(
        moneyResult.error.code,
        moneyResult.error.message,
        field,
        moneyResult.error.details
      )
    );
  }
  return ok(moneyResult.value);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function requireEntityType(input, field) {
  const raw = input.entityType;
  if (!isNonEmptyString(raw)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "entityType is required",
        field
      )
    );
  }
  const normalized = String(raw).trim().toLowerCase();
  if (!Object.values(PERFORMANCE_ENTITY_TYPE).includes(normalized)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        `entityType must be one of: ${Object.values(PERFORMANCE_ENTITY_TYPE).join(", ")}`,
        field,
        { entityType: raw }
      )
    );
  }
  return ok(normalized);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalEntityType(input, field) {
  if (input.entityType === undefined) return ok(undefined);
  return requireEntityType(input, field);
}

// ---------------------------------------------------------------------------
// Finance facts
// ---------------------------------------------------------------------------

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceTransactionFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "FinanceTransactionFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "FinanceTransactionFact");
  if (!identity.ok) return identity;
  const transactionId = requireNonEmptyString(input, "transactionId", "transactionId");
  if (!transactionId.ok) return transactionId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;
  const amount = resolveAmount(input, "amount", { required: true });
  if (!amount.ok) return amount;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    transactionId: transactionId.value,
    status: status.value,
    amount: amount.value,
  };
  const strings = attachOptionalStrings(fact, input, [
    "recognitionBasis",
    "postingStatus",
    "sourceVersion",
    "accountingContextId",
  ]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceInvoiceFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "FinanceInvoiceFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "FinanceInvoiceFact");
  if (!identity.ok) return identity;
  const invoiceId = requireNonEmptyString(input, "invoiceId", "invoiceId");
  if (!invoiceId.ok) return invoiceId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;
  const amount = resolveAmount(input, "amount", { required: false });
  if (!amount.ok) return amount;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    invoiceId: invoiceId.value,
    status: status.value,
  };
  if (amount.value !== undefined) fact.amount = amount.value;
  for (const key of ["issuedAt", "effectiveAt"]) {
    if (input[key] !== undefined) {
      const ts = optionalIso(input[key], key);
      if (!ts.ok) return ts;
      fact[key] = ts.value;
    }
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinancePaymentFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "FinancePaymentFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "FinancePaymentFact");
  if (!identity.ok) return identity;
  const paymentId = requireNonEmptyString(input, "paymentId", "paymentId");
  if (!paymentId.ok) return paymentId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;
  const amount = resolveAmount(input, "amount", { required: true });
  if (!amount.ok) return amount;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    paymentId: paymentId.value,
    status: status.value,
    amount: amount.value,
  };
  if (input.settled !== undefined) {
    if (typeof input.settled !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
          "settled must be a boolean when provided",
          "settled"
        )
      );
    }
    fact.settled = input.settled;
  }
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRefundFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "FinanceRefundFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "FinanceRefundFact");
  if (!identity.ok) return identity;
  const refundId = requireNonEmptyString(input, "refundId", "refundId");
  if (!refundId.ok) return refundId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;
  const amount = resolveAmount(input, "amount", { required: true });
  if (!amount.ok) return amount;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    refundId: refundId.value,
    status: status.value,
    amount: amount.value,
  };
  if (input.settled !== undefined) {
    if (typeof input.settled !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
          "settled must be a boolean when provided",
          "settled"
        )
      );
    }
    fact.settled = input.settled;
  }
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceSettlementFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "FinanceSettlementFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "FinanceSettlementFact");
  if (!identity.ok) return identity;
  const settlementId = requireNonEmptyString(input, "settlementId", "settlementId");
  if (!settlementId.ok) return settlementId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;
  const amount = resolveAmount(input, "amount", { required: false });
  if (!amount.ok) return amount;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    settlementId: settlementId.value,
    status: status.value,
  };
  if (amount.value !== undefined) fact.amount = amount.value;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit receivable fact. `overdue` is only ever set from an explicit
 * boolean or an explicit OVERDUE status — never inferred from due dates.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceReceivableFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "FinanceReceivableFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "FinanceReceivableFact");
  if (!identity.ok) return identity;
  const receivableId = requireNonEmptyString(input, "receivableId", "receivableId");
  if (!receivableId.ok) return receivableId;
  const status = requireNonEmptyString(input, "status", "status");
  if (!status.ok) return status;
  const amount = resolveAmount(input, "amount", { required: true });
  if (!amount.ok) return amount;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    receivableId: receivableId.value,
    status: status.value,
    amount: amount.value,
  };
  if (input.overdue !== undefined) {
    if (typeof input.overdue !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
          "overdue must be a boolean when provided (never inferred from dates)",
          "overdue"
        )
      );
    }
    fact.overdue = input.overdue;
  }
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit recognized revenue/expense fact. Booking/payment facts are
 * separate contracts and must never be substituted here — recognition must
 * be explicit (RECOGNIZED status or recognized === true).
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRecognizedAmountFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(
    input,
    "FinanceRecognizedAmountFact"
  );
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "FinanceRecognizedAmountFact");
  if (!identity.ok) return identity;
  const recognitionId = requireNonEmptyString(input, "recognitionId", "recognitionId");
  if (!recognitionId.ok) return recognitionId;

  if (!isNonEmptyString(input.kind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "kind is required",
        "kind"
      )
    );
  }
  const kind = String(input.kind).trim().toLowerCase();
  if (kind !== "revenue" && kind !== "expense") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "kind must be 'revenue' or 'expense'",
        "kind",
        { kind: input.kind }
      )
    );
  }

  const amount = resolveAmount(input, "amount", { required: true });
  if (!amount.ok) return amount;

  const explicitlyRecognized =
    input.recognized === true ||
    (isNonEmptyString(input.recognitionStatus) &&
      String(input.recognitionStatus).trim().toUpperCase() === "RECOGNIZED");
  if (!explicitlyRecognized) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RECOGNITION_INVALID,
        "Recognized amount facts require an explicit RECOGNIZED status or recognized === true; booking/payment facts must not be substituted",
        "recognitionStatus"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    recognitionId: recognitionId.value,
    kind,
    amount: amount.value,
    recognitionStatus: "RECOGNIZED",
    recognized: true,
  };
  const strings = attachOptionalStrings(fact, input, ["recognitionBasis"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

// ---------------------------------------------------------------------------
// Ranking facts
// ---------------------------------------------------------------------------

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createRankingSystemFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "RankingSystemFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "RankingSystemFact");
  if (!identity.ok) return identity;
  const rankingSystemId = requireNonEmptyString(input, "rankingSystemId", "rankingSystemId");
  if (!rankingSystemId.ok) return rankingSystemId;
  const rankingSystemVersion = requireNonEmptyString(
    input,
    "rankingSystemVersion",
    "rankingSystemVersion"
  );
  if (!rankingSystemVersion.ok) return rankingSystemVersion;
  const entityType = optionalEntityType(input, "entityType");
  if (!entityType.ok) return entityType;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    rankingSystemId: rankingSystemId.value,
    rankingSystemVersion: rankingSystemVersion.value,
  };
  if (entityType.value !== undefined) fact.entityType = entityType.value;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * `rankDirection` is always stored explicitly (defaulting to UNKNOWN) so
 * downstream movement comparisons never silently assume a direction.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createRankingSnapshotFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "RankingSnapshotFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "RankingSnapshotFact");
  if (!identity.ok) return identity;
  const snapshotId = requireNonEmptyString(input, "snapshotId", "snapshotId");
  if (!snapshotId.ok) return snapshotId;
  const rankingSystemId = requireNonEmptyString(input, "rankingSystemId", "rankingSystemId");
  if (!rankingSystemId.ok) return rankingSystemId;
  const rankingSystemVersion = requireNonEmptyString(
    input,
    "rankingSystemVersion",
    "rankingSystemVersion"
  );
  if (!rankingSystemVersion.ok) return rankingSystemVersion;
  const entityType = optionalEntityType(input, "entityType");
  if (!entityType.ok) return entityType;

  let rankDirection = RANK_DIRECTION.UNKNOWN;
  if (input.rankDirection !== undefined) {
    const normalized = String(input.rankDirection).trim().toLowerCase();
    if (!Object.values(RANK_DIRECTION).includes(normalized)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
          `rankDirection must be one of: ${Object.values(RANK_DIRECTION).join(", ")}`,
          "rankDirection",
          { rankDirection: input.rankDirection }
        )
      );
    }
    rankDirection = normalized;
  }

  if (input.published !== undefined && typeof input.published !== "boolean") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "published must be a boolean when provided",
        "published"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    snapshotId: snapshotId.value,
    rankingSystemId: rankingSystemId.value,
    rankingSystemVersion: rankingSystemVersion.value,
    rankDirection,
  };
  if (entityType.value !== undefined) fact.entityType = entityType.value;
  if (input.published !== undefined) fact.published = input.published;
  const strings = attachOptionalStrings(fact, input, ["periodId"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createRankingPositionFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "RankingPositionFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "RankingPositionFact");
  if (!identity.ok) return identity;
  const snapshotId = requireNonEmptyString(input, "snapshotId", "snapshotId");
  if (!snapshotId.ok) return snapshotId;
  const rankingSystemId = requireNonEmptyString(input, "rankingSystemId", "rankingSystemId");
  if (!rankingSystemId.ok) return rankingSystemId;
  const rankingSystemVersion = requireNonEmptyString(
    input,
    "rankingSystemVersion",
    "rankingSystemVersion"
  );
  if (!rankingSystemVersion.ok) return rankingSystemVersion;
  const entityId = requireNonEmptyString(input, "entityId", "entityId");
  if (!entityId.ok) return entityId;
  const entityType = optionalEntityType(input, "entityType");
  if (!entityType.ok) return entityType;

  if (
    !Number.isFinite(input.rank) ||
    !Number.isInteger(input.rank) ||
    input.rank < 1
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "rank must be a finite integer >= 1",
        "rank",
        { rank: input.rank }
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    snapshotId: snapshotId.value,
    rankingSystemId: rankingSystemId.value,
    rankingSystemVersion: rankingSystemVersion.value,
    entityId: entityId.value,
    rank: input.rank,
  };
  if (entityType.value !== undefined) fact.entityType = entityType.value;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

// ---------------------------------------------------------------------------
// Rating facts
// ---------------------------------------------------------------------------

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createRatingSnapshotFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "RatingSnapshotFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "RatingSnapshotFact");
  if (!identity.ok) return identity;
  const snapshotId = requireNonEmptyString(input, "snapshotId", "snapshotId");
  if (!snapshotId.ok) return snapshotId;
  const ratingSystemId = requireNonEmptyString(input, "ratingSystemId", "ratingSystemId");
  if (!ratingSystemId.ok) return ratingSystemId;
  const ratingSystemVersion = requireNonEmptyString(
    input,
    "ratingSystemVersion",
    "ratingSystemVersion"
  );
  if (!ratingSystemVersion.ok) return ratingSystemVersion;
  const entityId = requireNonEmptyString(input, "entityId", "entityId");
  if (!entityId.ok) return entityId;

  if (!Number.isFinite(input.ratingValue)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "ratingValue must be a finite number",
        "ratingValue",
        { ratingValue: input.ratingValue }
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    snapshotId: snapshotId.value,
    ratingSystemId: ratingSystemId.value,
    ratingSystemVersion: ratingSystemVersion.value,
    entityId: entityId.value,
    ratingValue: input.ratingValue,
  };
  const strings = attachOptionalStrings(fact, input, ["privacyClassification"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * `delta` must be explicit or derivable via simple subtraction of
 * before/after values. This module never recalculates a rating algorithm.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createRatingChangeFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "RatingChangeFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "RatingChangeFact");
  if (!identity.ok) return identity;
  const changeId = requireNonEmptyString(input, "changeId", "changeId");
  if (!changeId.ok) return changeId;
  const ratingSystemId = requireNonEmptyString(input, "ratingSystemId", "ratingSystemId");
  if (!ratingSystemId.ok) return ratingSystemId;
  const ratingSystemVersion = requireNonEmptyString(
    input,
    "ratingSystemVersion",
    "ratingSystemVersion"
  );
  if (!ratingSystemVersion.ok) return ratingSystemVersion;
  const entityId = requireNonEmptyString(input, "entityId", "entityId");
  if (!entityId.ok) return entityId;

  const hasDelta = input.delta !== undefined;
  const hasBeforeAfter =
    input.beforeValue !== undefined && input.afterValue !== undefined;

  if (!hasDelta && !hasBeforeAfter) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "Either delta or both beforeValue and afterValue are required",
        "delta"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    changeId: changeId.value,
    ratingSystemId: ratingSystemId.value,
    ratingSystemVersion: ratingSystemVersion.value,
    entityId: entityId.value,
  };

  if (hasBeforeAfter) {
    if (!Number.isFinite(input.beforeValue) || !Number.isFinite(input.afterValue)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
          "beforeValue and afterValue must be finite numbers",
          "beforeValue"
        )
      );
    }
    fact.beforeValue = input.beforeValue;
    fact.afterValue = input.afterValue;
  }

  if (hasDelta) {
    if (!Number.isFinite(input.delta)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
          "delta must be a finite number",
          "delta",
          { delta: input.delta }
        )
      );
    }
    fact.delta = input.delta;
    fact.deltaDerived = false;
  } else {
    fact.delta = input.afterValue - input.beforeValue;
    fact.deltaDerived = true;
  }

  const strings = attachOptionalStrings(fact, input, ["privacyClassification"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

// ---------------------------------------------------------------------------
// Performance facts
// ---------------------------------------------------------------------------

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPerformanceParticipationFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(
    input,
    "PerformanceParticipationFact"
  );
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "PerformanceParticipationFact");
  if (!identity.ok) return identity;
  const participationId = requireNonEmptyString(input, "participationId", "participationId");
  if (!participationId.ok) return participationId;
  const entityId = requireNonEmptyString(input, "entityId", "entityId");
  if (!entityId.ok) return entityId;
  const entityType = requireEntityType(input, "entityType");
  if (!entityType.ok) return entityType;

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    participationId: participationId.value,
    entityId: entityId.value,
    entityType: entityType.value,
  };
  const strings = attachOptionalStrings(fact, input, ["competitionId", "status"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPerformanceMatchFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "PerformanceMatchFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "PerformanceMatchFact");
  if (!identity.ok) return identity;
  const matchId = requireNonEmptyString(input, "matchId", "matchId");
  if (!matchId.ok) return matchId;
  const entityId = requireNonEmptyString(input, "entityId", "entityId");
  if (!entityId.ok) return entityId;
  const entityType = requireEntityType(input, "entityType");
  if (!entityType.ok) return entityType;
  const lifecycleStatus = requireNonEmptyString(input, "lifecycleStatus", "lifecycleStatus");
  if (!lifecycleStatus.ok) return lifecycleStatus;

  if (input.completed !== undefined && typeof input.completed !== "boolean") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "completed must be a boolean when provided",
        "completed"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    matchId: matchId.value,
    entityId: entityId.value,
    entityType: entityType.value,
    lifecycleStatus: lifecycleStatus.value,
  };
  if (input.completed !== undefined) fact.completed = input.completed;
  const strings = attachOptionalStrings(fact, input, ["competitionId"]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * `outcome` and `validationStatus` are always explicit — this module never
 * infers a winner from a raw score.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPerformanceOutcomeFact(input) {
  const sensitive = rejectForbiddenSensitiveFields(input, "PerformanceOutcomeFact");
  if (!sensitive.ok) return sensitive;
  const identity = requireTenant(input, "PerformanceOutcomeFact");
  if (!identity.ok) return identity;
  const outcomeId = requireNonEmptyString(input, "outcomeId", "outcomeId");
  if (!outcomeId.ok) return outcomeId;
  const entityId = requireNonEmptyString(input, "entityId", "entityId");
  if (!entityId.ok) return entityId;
  const entityType = requireEntityType(input, "entityType");
  if (!entityType.ok) return entityType;

  if (!isNonEmptyString(input.outcome)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "outcome is required",
        "outcome"
      )
    );
  }
  const outcome = String(input.outcome).trim().toLowerCase();
  if (!Object.values(PERFORMANCE_OUTCOME).includes(outcome)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        `outcome must be one of: ${Object.values(PERFORMANCE_OUTCOME).join(", ")}`,
        "outcome",
        { outcome: input.outcome }
      )
    );
  }

  const validationStatus = requireNonEmptyString(input, "validationStatus", "validationStatus");
  if (!validationStatus.ok) return validationStatus;

  if (input.scorePresent !== undefined && typeof input.scorePresent !== "boolean") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_FACT_INVALID,
        "scorePresent must be a boolean when provided",
        "scorePresent"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    outcomeId: outcomeId.value,
    entityId: entityId.value,
    entityType: entityType.value,
    outcome,
    validationStatus: validationStatus.value,
  };
  if (input.scorePresent !== undefined) fact.scorePresent = input.scorePresent;
  const strings = attachOptionalStrings(fact, input, [
    "matchId",
    "competitionId",
    "validatedResultRef",
  ]);
  if (!strings.ok) return strings;
  if (input.effectiveAt !== undefined) {
    const ts = optionalIso(input.effectiveAt, "effectiveAt");
    if (!ts.ok) return ts;
    fact.effectiveAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}
