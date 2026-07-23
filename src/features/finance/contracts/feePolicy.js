/**
 * Fee Policy contract (Finance-owned, Phase 1B).
 *
 * A policy versions a set of fee definitions for a tenant scope.
 * Evaluation is deterministic and side-effect free.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import {
  createFeeDefinition,
  evaluateFeeDefinition,
  FEE_STATUS,
} from "../domain/feeDefinition.js";
import { requireSupportedCurrency } from "../domain/currency.js";
import { addMoney, createMoney, serializeMoney, zeroMoney } from "../domain/money.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createFeePolicy(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      "Fee policy input must be an object."
    );
  }

  const policyId = requireId(input.policyId ?? input.id, "policyId");
  const tenantId = requireId(input.tenantId, "tenantId");
  const versionRaw = input.version == null ? 1 : input.version;
  if (typeof versionRaw !== "number" || !Number.isInteger(versionRaw) || versionRaw < 1) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
      "Fee policy version must be a positive integer.",
      { field: "version" }
    );
  }

  const rawFees = Array.isArray(input.fees) ? input.fees : [];
  const fees = rawFees.map((fee, index) => {
    try {
      const normalized = createFeeDefinition({
        ...fee,
        tenantId: fee.tenantId ?? tenantId,
        policyVersion: fee.policyVersion ?? versionRaw,
      });
      if (normalized.tenantId !== tenantId) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
          "Fee definition tenantId must match policy tenantId.",
          { field: "tenantId", index }
        );
      }
      return normalized;
    } catch (err) {
      if (err instanceof FinanceError) {
        throw new FinanceError(err.code, err.message, {
          ...(err.context || {}),
          feeIndex: index,
        });
      }
      throw err;
    }
  });

  const feeIds = new Set();
  for (const fee of fees) {
    if (feeIds.has(fee.feeId)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION,
        `Duplicate feeId in policy: ${fee.feeId}.`,
        { field: "feeId", feeId: fee.feeId }
      );
    }
    feeIds.add(fee.feeId);
  }

  return Object.freeze({
    policyId,
    tenantId,
    version: versionRaw,
    currency: input.currency
      ? requireSupportedCurrency(input.currency)
      : fees[0]
        ? fees[0].currency
        : null,
    fees: Object.freeze(fees.slice()),
    name:
      input.name == null || input.name === ""
        ? null
        : typeof input.name === "string"
          ? input.name.trim() || null
          : null,
  });
}

/**
 * Evaluate all ACTIVE fees in a policy for a given context and sum applicable amounts.
 *
 * @param {object} policy
 * @param {{ at?: string, tenantId?: string, venueId?: string|null, clubId?: string|null, feeType?: string|null, currency?: string }} [context]
 * @returns {Readonly<{ applicableFees: object[], total: object|null, currency: string|null }>}
 */
export function evaluateFeePolicy(policy, context = {}) {
  const normalized = createFeePolicy(policy);
  const applicableFees = [];

  for (const fee of normalized.fees) {
    if (context.feeType && fee.feeType !== context.feeType) continue;
    if (fee.status !== FEE_STATUS.ACTIVE) continue;
    const result = evaluateFeeDefinition(fee, {
      at: context.at,
      tenantId: context.tenantId ?? normalized.tenantId,
      venueId: context.venueId,
      clubId: context.clubId,
    });
    if (result.applicable) {
      applicableFees.push(
        Object.freeze({
          feeId: fee.feeId,
          feeType: fee.feeType,
          amount: result.amount,
        })
      );
    }
  }

  if (applicableFees.length === 0) {
    const currency = context.currency || normalized.currency;
    return Object.freeze({
      applicableFees: Object.freeze([]),
      total: currency ? serializeMoney(zeroMoney(currency)) : null,
      currency: currency || null,
    });
  }

  let total = createMoney(
    applicableFees[0].amount.amountMinor,
    applicableFees[0].amount.currency
  );
  for (let i = 1; i < applicableFees.length; i += 1) {
    total = addMoney(total, applicableFees[i].amount);
  }

  return Object.freeze({
    applicableFees: Object.freeze(applicableFees.slice()),
    total: serializeMoney(total),
    currency: total.currency,
  });
}
