/**
 * Shared current-state helpers for verification / adjustment workflows.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createRatingCurrentStateContract } from "../contracts/currentStateContract.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  isNonEmptyString,
  requireNonEmptyString,
  requireValidTimestamp,
} from "../contracts/shared.js";
import { scopesMatch } from "../history-snapshot/scopeMatch.js";

/**
 * @param {import('../contracts/scopeContract.js').PlayerRatingScope} scope
 * @param {string} playerId
 * @param {string} ratingMode
 * @returns {string}
 */
export function buildCurrentStateKey(playerId, scope, ratingMode) {
  const normalizedScope = requireExplicitPlayerRatingScope(scope);
  const mode = requireSupportedRatingMode(ratingMode);
  const id = requireNonEmptyString(playerId, "playerId");
  const scopeKey =
    normalizedScope.kind === "global"
      ? "global"
      : `tenant:${normalizedScope.tenantId}${
          normalizedScope.venueId ? `:venue:${normalizedScope.venueId}` : ""
        }`;
  return `${id}|${scopeKey}|${mode}`;
}

/**
 * Normalize and freeze a stored current-state record (workflow fields included).
 * @param {unknown} input
 * @returns {Readonly<Record<string, unknown>>}
 */
export function normalizeStoredCurrentState(input) {
  if (!input || typeof input !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Current state requires an object",
      { input }
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (input);

  if (!isNonEmptyString(raw.playerId)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "Current state requires a non-empty canonical playerId",
      { playerId: raw.playerId }
    );
  }

  if (
    raw.playerIdResolutionStatus != null &&
    String(raw.playerIdResolutionStatus).trim() !== "" &&
    String(raw.playerIdResolutionStatus).trim() !== "RESOLVED"
  ) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "Current state rejects unresolved or alias player identity",
      { playerIdResolutionStatus: raw.playerIdResolutionStatus }
    );
  }

  const base = createRatingCurrentStateContract(raw);
  const stateVersion = Number(raw.stateVersion);
  if (!Number.isInteger(stateVersion) || stateVersion < 1) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Current state requires integer stateVersion >= 1",
      { stateVersion: raw.stateVersion }
    );
  }

  const sourceScale = requireNonEmptyString(raw.sourceScale, "sourceScale");

  /** @type {Record<string, unknown>} */
  const stored = {
    ...clonePlain(base),
    stateVersion,
    sourceScale,
  };

  return deepFreeze(stored);
}

/**
 * @param {Readonly<Record<string, unknown>>} state
 * @param {string} playerId
 * @param {import('../contracts/scopeContract.js').PlayerRatingScope} scope
 * @param {string} ratingMode
 */
export function assertStateIdentityImmutable(state, playerId, scope, ratingMode) {
  if (state.playerId !== playerId) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Identity mutation is forbidden",
      { before: state.playerId, after: playerId }
    );
  }
  if (!scopesMatch(/** @type {any} */ (state.scope), scope)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
      "Scope mutation is forbidden",
      { before: state.scope, after: scope }
    );
  }
  if (state.ratingMode !== ratingMode) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Rating mode mutation is forbidden",
      { before: state.ratingMode, after: ratingMode }
    );
  }
}

/**
 * @param {Readonly<Record<string, unknown>>} before
 * @param {number} expectedVersion
 */
export function assertExpectedVersion(before, expectedVersion) {
  if (!Number.isInteger(expectedVersion)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "expectedVersion must be an integer",
      { expectedVersion }
    );
  }
  if (before.stateVersion !== expectedVersion) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_VERSION_CONFLICT,
      "Stale expectedVersion rejected",
      {
        expectedVersion,
        actualVersion: before.stateVersion,
      }
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {unknown}
 */
export function requireExplicitRatingValue(value, field) {
  if (value === undefined) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      `Missing explicit rating value: ${field}`,
      { field }
    );
  }
  if (value === null) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      `Rating value must not be null: ${field}`,
      { field }
    );
  }
  return value;
}

/**
 * @param {Readonly<Record<string, unknown>>} before
 * @param {Record<string, unknown>} patch
 * @param {string|number} effectiveAt
 * @returns {Readonly<Record<string, unknown>>}
 */
export function buildAfterState(before, patch, effectiveAt) {
  requireValidTimestamp(effectiveAt, "effectiveAt");
  /** @type {Record<string, unknown>} */
  const next = {
    ...clonePlain(before),
    ...clonePlain(patch),
    playerId: before.playerId,
    scope: clonePlain(before.scope),
    ratingMode: before.ratingMode,
    sourceScale: before.sourceScale,
    stateVersion: Number(before.stateVersion) + 1,
    effectiveAt,
  };
  return normalizeStoredCurrentState(next);
}

/**
 * Deterministic fingerprint for payload conflict detection.
 * @param {unknown} payload
 * @returns {string}
 */
export function fingerprintPayload(payload) {
  return JSON.stringify(payload);
}
