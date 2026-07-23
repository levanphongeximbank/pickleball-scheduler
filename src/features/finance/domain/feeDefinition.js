/**
 * Fee Definition contract (Finance-owned, Phase 1B).
 *
 * Capable of representing competition, booking, club, and membership fees later
 * via optional opaque references — without importing those modules.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { requireSupportedCurrency } from "./currency.js";
import { createMoney, serializeMoney } from "./money.js";

export const FEE_TYPE = Object.freeze({
  COMPETITION: "COMPETITION",
  TOURNAMENT_ENTRY: "TOURNAMENT_ENTRY",
  VENUE_BOOKING: "VENUE_BOOKING",
  COURT_BOOKING: "COURT_BOOKING",
  CLUB_MEMBERSHIP: "CLUB_MEMBERSHIP",
  OPERATIONAL: "OPERATIONAL",
  OTHER: "OTHER",
});

export const FEE_TYPE_VALUES = Object.freeze(Object.values(FEE_TYPE));

export const FEE_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
});

export const FEE_STATUS_VALUES = Object.freeze(Object.values(FEE_STATUS));

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFERENCE,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
function optionalId(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFERENCE,
      `${field} must be a non-empty string when provided.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
function optionalIso(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      `${field} must be an ISO-8601 string.`,
      { field }
    );
  }
  const trimmed = value.trim();
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field }
    );
  }
  return new Date(ms).toISOString();
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createFeeDefinition(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      "Fee definition input must be an object."
    );
  }

  const feeId = requireId(input.feeId ?? input.id, "feeId");
  const feeType = String(input.feeType || "").trim();
  if (!FEE_TYPE_VALUES.includes(feeType)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      `Invalid fee type: ${feeType || "(empty)"}.`,
      { field: "feeType", allowed: FEE_TYPE_VALUES }
    );
  }

  const status = input.status == null ? FEE_STATUS.DRAFT : String(input.status).trim();
  if (!FEE_STATUS_VALUES.includes(status)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      `Invalid fee status: ${status}.`,
      { field: "status", allowed: FEE_STATUS_VALUES }
    );
  }

  const currency = requireSupportedCurrency(input.currency);
  const money = createMoney(input.amountMinor, currency);
  const effectiveFrom = optionalIso(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = optionalIso(input.effectiveTo, "effectiveTo");

  if (effectiveFrom && effectiveTo && Date.parse(effectiveFrom) > Date.parse(effectiveTo)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      "effectiveFrom must be <= effectiveTo.",
      { field: "effectivePeriod", effectiveFrom, effectiveTo }
    );
  }

  const policyVersionRaw = input.policyVersion == null ? 1 : input.policyVersion;
  if (
    typeof policyVersionRaw !== "number" ||
    !Number.isInteger(policyVersionRaw) ||
    policyVersionRaw < 1
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      "policyVersion must be a positive integer.",
      { field: "policyVersion" }
    );
  }

  const name =
    input.name == null || input.name === ""
      ? null
      : typeof input.name === "string"
        ? input.name.trim() || null
        : (() => {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
              "name must be a string when provided.",
              { field: "name" }
            );
          })();

  return Object.freeze({
    feeId,
    feeType,
    name,
    amount: serializeMoney(money),
    currency,
    amountMinor: money.amountMinor,
    effectiveFrom,
    effectiveTo,
    tenantId: requireId(input.tenantId, "tenantId"),
    venueId: optionalId(input.venueId, "venueId"),
    clubId: optionalId(input.clubId, "clubId"),
    /** Opaque competition reference — Finance never evaluates eligibility. */
    competitionRef: optionalId(input.competitionRef, "competitionRef"),
    /** Opaque booking reference. */
    bookingRef: optionalId(input.bookingRef, "bookingRef"),
    status,
    policyVersion: policyVersionRaw,
  });
}

/**
 * Deterministic, side-effect-free evaluation: returns the fee amount when the
 * definition is ACTIVE and the evaluation instant falls within the effective period.
 *
 * @param {object} feeDefinition
 * @param {{ at?: string, tenantId?: string, venueId?: string|null, clubId?: string|null }} [context]
 * @returns {Readonly<{ applicable: boolean, amount: object|null, reason: string|null }>}
 */
export function evaluateFeeDefinition(feeDefinition, context = {}) {
  const fee = createFeeDefinition(feeDefinition);

  if (context.tenantId != null && context.tenantId !== fee.tenantId) {
    return Object.freeze({
      applicable: false,
      amount: null,
      reason: "TENANT_SCOPE_MISMATCH",
    });
  }

  if (fee.venueId && context.venueId != null && context.venueId !== fee.venueId) {
    return Object.freeze({
      applicable: false,
      amount: null,
      reason: "VENUE_SCOPE_MISMATCH",
    });
  }

  if (fee.clubId && context.clubId != null && context.clubId !== fee.clubId) {
    return Object.freeze({
      applicable: false,
      amount: null,
      reason: "CLUB_SCOPE_MISMATCH",
    });
  }

  if (fee.status !== FEE_STATUS.ACTIVE) {
    return Object.freeze({
      applicable: false,
      amount: null,
      reason: "FEE_NOT_ACTIVE",
    });
  }

  const atRaw = context.at == null ? null : String(context.at).trim();
  const atMs = atRaw ? Date.parse(atRaw) : Date.parse("1970-01-01T00:00:00.000Z");
  if (atRaw && !Number.isFinite(atMs)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      "Evaluation context.at must be a valid ISO-8601 timestamp.",
      { field: "at" }
    );
  }

  if (fee.effectiveFrom && atMs < Date.parse(fee.effectiveFrom)) {
    return Object.freeze({
      applicable: false,
      amount: null,
      reason: "BEFORE_EFFECTIVE_PERIOD",
    });
  }
  if (fee.effectiveTo && atMs > Date.parse(fee.effectiveTo)) {
    return Object.freeze({
      applicable: false,
      amount: null,
      reason: "AFTER_EFFECTIVE_PERIOD",
    });
  }

  return Object.freeze({
    applicable: true,
    amount: serializeMoney(createMoney(fee.amountMinor, fee.currency)),
    reason: null,
  });
}
