/**
 * Shared command validation helpers for Finance application services.
 * All timestamps and identities must be supplied explicitly (no Date.now / random).
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireCommandId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
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
export function optionalCommandId(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${field} must be a non-empty string when provided.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireIsoTimestamp(value, field) {
  const raw = requireCommandId(value, field);
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field }
    );
  }
  return new Date(ms).toISOString();
}

/**
 * @param {object} command
 * @returns {{
 *   tenantId: string,
 *   idempotencyKey: string,
 *   correlationId: string,
 *   causationId: string|null,
 *   actor: Readonly<{ actorId: string|null, actorType: string|null }>|null,
 *   occurredAt: string
 * }}
 */
export function requireCommandContext(command = {}) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Command must be a plain object.",
      { field: "command" }
    );
  }

  const actorRaw = command.actor;
  let actor = null;
  if (actorRaw != null) {
    if (typeof actorRaw !== "object" || Array.isArray(actorRaw)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "actor must be an object when provided.",
        { field: "actor" }
      );
    }
    actor = Object.freeze({
      actorId: optionalCommandId(actorRaw.actorId, "actor.actorId"),
      actorType: optionalCommandId(actorRaw.actorType, "actor.actorType"),
    });
  } else if (command.actorId != null || command.actorType != null) {
    actor = Object.freeze({
      actorId: optionalCommandId(command.actorId, "actorId"),
      actorType: optionalCommandId(command.actorType, "actorType"),
    });
  }

  return Object.freeze({
    tenantId: requireCommandId(command.tenantId, "tenantId"),
    idempotencyKey: requireCommandId(command.idempotencyKey, "idempotencyKey"),
    correlationId: requireCommandId(command.correlationId, "correlationId"),
    causationId: optionalCommandId(command.causationId, "causationId"),
    actor,
    occurredAt: requireIsoTimestamp(
      command.occurredAt ?? command.requestedAt,
      "occurredAt"
    ),
  });
}

/**
 * @param {object} deps
 * @param {string} name
 * @returns {Function}
 */
export function requireIdGenerator(deps, name = "idGenerator") {
  const gen = deps?.[name];
  if (typeof gen !== "function") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${name} dependency must be a function (no implicit random IDs).`,
      { field: name }
    );
  }
  return gen;
}
