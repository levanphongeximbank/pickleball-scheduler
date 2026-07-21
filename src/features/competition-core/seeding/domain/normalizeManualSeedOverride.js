import { deepFreeze } from "./deepFreeze.js";
import {
  AUTHORIZATION_DECISION,
  AUTHORIZATION_DECISION_VALUES,
  OVERRIDE_ACTION,
  OVERRIDE_ACTION_VALUES,
  OVERRIDE_STATUS,
} from "./constants.js";
import {
  normalizeExplicitTimestamp,
  normalizeOpaqueId,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * @typedef {Object} NormalizedManualSeedOverride
 * @property {string} overrideId
 * @property {string} entryId
 * @property {string} action
 * @property {number|null} requestedSeedNumber
 * @property {string|null} targetOverrideId
 * @property {unknown} actor
 * @property {string} reason
 * @property {import('./normalizeHelpers.js').NormalizedTimestamp|string|number} createdAt
 * @property {string} authorizationDecision
 * @property {string} status
 * @property {ReadonlyArray<string>} rejectionReasonCodes
 * @property {string|null} supersededOverrideId
 * @property {Readonly<Record<string, unknown>>|null} auditMetadata
 */

/**
 * Normalize a single ManualSeedOverride (doc 08 / 12). Does not mutate caller input.
 * Phase 1D: CLEAR requires targetOverrideId (exact DRAFT override reference).
 *
 * @param {unknown} raw
 * @returns {Readonly<NormalizedManualSeedOverride>}
 */
export function normalizeManualSeedOverride(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "ManualSeedOverride must be a non-null object"
    );
  }

  const input = /** @type {Record<string, unknown>} */ (raw);

  const overrideId = normalizeOpaqueId(input.overrideId);
  if (!overrideId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "overrideId is required",
      { field: "overrideId" }
    );
  }

  const entryId = normalizeOpaqueId(input.entryId);
  if (!entryId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "override entryId is required",
      { field: "entryId", overrideId }
    );
  }

  const action = normalizeOpaqueId(input.action);
  if (!action || !OVERRIDE_ACTION_VALUES.has(action)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "override action must be ASSIGN | PROTECT | CLEAR",
      { field: "action", overrideId, value: input.action }
    );
  }

  let requestedSeedNumber = null;
  let targetOverrideId = null;

  if (action === OVERRIDE_ACTION.CLEAR) {
    if (input.requestedSeedNumber != null && input.requestedSeedNumber !== "") {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "CLEAR override must not request a seed number",
        { field: "requestedSeedNumber", overrideId }
      );
    }
    targetOverrideId = normalizeOpaqueId(input.targetOverrideId);
    if (!targetOverrideId) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "CLEAR requires non-empty targetOverrideId",
        { field: "targetOverrideId", overrideId }
      );
    }
    if (targetOverrideId === overrideId) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "CLEAR targetOverrideId must not equal its own overrideId",
        { field: "targetOverrideId", overrideId }
      );
    }
  } else {
    if (input.targetOverrideId != null && input.targetOverrideId !== "") {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "targetOverrideId is only valid on CLEAR",
        { field: "targetOverrideId", overrideId }
      );
    }
    if (
      typeof input.requestedSeedNumber !== "number" ||
      !Number.isInteger(input.requestedSeedNumber) ||
      input.requestedSeedNumber < 1
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "ASSIGN/PROTECT require a positive integer requestedSeedNumber",
        {
          field: "requestedSeedNumber",
          overrideId,
          value: input.requestedSeedNumber,
        }
      );
    }
    requestedSeedNumber = input.requestedSeedNumber;
  }

  const reason = input.reason == null ? "" : String(input.reason).trim();
  if (!reason) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "override reason is required",
      { field: "reason", overrideId }
    );
  }

  if (input.createdAt == null || input.createdAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "override createdAt must be caller-supplied",
      { field: "createdAt", overrideId }
    );
  }
  const createdAt = normalizeExplicitTimestamp(input.createdAt, "createdAt");

  let authorizationDecision = normalizeOpaqueId(input.authorizationDecision);
  if (!authorizationDecision) {
    authorizationDecision = AUTHORIZATION_DECISION.NOT_EVALUATED;
  }
  if (!AUTHORIZATION_DECISION_VALUES.has(authorizationDecision)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "Invalid authorizationDecision",
      { field: "authorizationDecision", overrideId }
    );
  }

  const supersededOverrideId =
    input.supersededOverrideId == null || input.supersededOverrideId === ""
      ? null
      : normalizeOpaqueId(input.supersededOverrideId);

  let auditMetadata = null;
  if (input.auditMetadata != null) {
    if (
      typeof input.auditMetadata !== "object" ||
      Array.isArray(input.auditMetadata)
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "auditMetadata must be a plain object",
        { field: "auditMetadata", overrideId }
      );
    }
    auditMetadata = deepFreeze({
      .../** @type {Record<string, unknown>} */ (input.auditMetadata),
    });
  }

  return deepFreeze({
    overrideId,
    entryId,
    action,
    requestedSeedNumber,
    targetOverrideId,
    actor: input.actor == null ? null : input.actor,
    reason,
    createdAt,
    authorizationDecision,
    status: OVERRIDE_STATUS.PENDING,
    rejectionReasonCodes: deepFreeze([]),
    supersededOverrideId,
    auditMetadata,
  });
}
