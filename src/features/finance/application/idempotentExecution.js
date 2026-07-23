/**
 * Application-level idempotent command execution (Phase 1C).
 *
 * First valid command records fingerprint + result.
 * Exact replay returns the stored result without re-execution.
 * Conflicting request for the same tenant/operation/key throws IDEMPOTENCY_CONFLICT.
 *
 * Database uniqueness for (tenantId, operationType, idempotencyKey) is still
 * required in a later persistence phase — this layer alone is not durable.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { buildCanonicalRequestFingerprint } from "./canonicalFingerprint.js";
import { requireCommandContext } from "./commandSupport.js";

/**
 * @param {object} deps
 * @param {object} deps.idempotencyRepository
 * @param {string} operationType
 * @param {object} command
 * @param {object} canonicalRequest
 * @param {() => object} execute
 * @returns {Promise<object>|object}
 */
export function executeIdempotent(deps, operationType, command, canonicalRequest, execute) {
  const ctx = requireCommandContext(command);
  const fingerprint = buildCanonicalRequestFingerprint(canonicalRequest);
  const repo = deps.idempotencyRepository;
  if (!repo || typeof repo.find !== "function" || typeof repo.save !== "function") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "idempotencyRepository dependency is required.",
      { field: "idempotencyRepository" }
    );
  }

  const existing = repo.find(ctx.tenantId, operationType, ctx.idempotencyKey);
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        "Idempotency key reused with a conflicting request.",
        {
          tenantId: ctx.tenantId,
          operationType,
          idempotencyKey: ctx.idempotencyKey,
        }
      );
    }
    return Object.freeze({
      ...cloneResult(existing.result),
      replayed: true,
      financialEffectApplied: false,
    });
  }

  const executed = execute({ ctx, fingerprint });
  const result =
    executed && typeof executed.then === "function"
      ? null
      : executed;

  if (result && typeof result.then === "function") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Async execute is not supported in Phase 1C idempotent executor.",
      { field: "execute" }
    );
  }

  const storedResult = stripReplayFlags(result);
  repo.save({
    tenantId: ctx.tenantId,
    operationType,
    idempotencyKey: ctx.idempotencyKey,
    requestFingerprint: fingerprint,
    result: storedResult,
    eventIds: Array.isArray(storedResult?.eventIds) ? storedResult.eventIds : [],
    createdAt: ctx.occurredAt,
  });

  return Object.freeze({
    ...cloneResult(storedResult),
    replayed: false,
    financialEffectApplied:
      storedResult?.financialEffectApplied === undefined
        ? true
        : Boolean(storedResult.financialEffectApplied),
  });
}

/**
 * @param {object|null|undefined} result
 * @returns {object}
 */
function stripReplayFlags(result) {
  if (!result || typeof result !== "object") {
    return Object.freeze({ value: result });
  }
  const rest = { ...result };
  delete rest.replayed;
  return Object.freeze(rest);
}

/**
 * @param {unknown} value
 * @returns {object}
 */
function cloneResult(value) {
  if (value == null) return Object.freeze({});
  if (typeof value !== "object") return Object.freeze({ value });
  return Object.freeze(JSON.parse(JSON.stringify(value)));
}
