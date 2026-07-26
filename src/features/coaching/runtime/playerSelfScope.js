/**
 * COACHING-04 PLAYER self-scope runtime contract.
 *
 * Uses PM-ID-01 resolveAuthenticatedCanonicalPlayerMapping.
 * Never accepts caller-supplied principalId / playerId as identity.
 * Never falls back to localStorage identity or first-club guess.
 */

import { PLAYER_IDENTITY_MAPPING_STATUS } from "../../player/constants/identityMapping.js";
import { resolveAuthenticatedCanonicalPlayerMapping } from "../../player/services/resolveAuthenticatedCanonicalPlayerMapping.js";
import {
  COACHING_RUNTIME_ERROR_CODES,
  createCoachingRuntimeError,
} from "./errors.js";
import { COACHING_04_PLAYER_SELF_SCOPE_STATUS } from "./constants.js";

/** Provenance / UI readiness states for durable PLAYER surfaces. */
export const COACHING_PLAYER_SCOPE_STATE = Object.freeze({
  LOADING: "LOADING",
  LIVE: "LIVE",
  EMPTY: "EMPTY",
  UNMAPPED: "UNMAPPED",
  FORBIDDEN: "FORBIDDEN",
  ERROR: "ERROR",
  INACTIVE: "INACTIVE",
  AMBIGUOUS: "AMBIGUOUS",
  INVALID: "INVALID",
});

export const COACHING_PLAYER_SELF_READ_PERMISSION = "coaching.self.read";

/**
 * @param {object} [input]
 * @param {string} [input.tenantId]
 * @param {string} [input.clubId]
 * @param {Function} [input.resolveMapping] test double
 * @param {object} [input.mappingAdapter]
 * @param {object} [input.mappingRepository]
 * @param {() => string|null} [input.getSessionUserId]
 */
export async function resolveCoachingPlayerSelfScope(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const clubId = String(input.clubId || "").trim();

  if (!tenantId || !clubId) {
    return Object.freeze({
      ok: false,
      state: COACHING_PLAYER_SCOPE_STATE.INVALID,
      status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
      playerId: null,
      tenantId: tenantId || null,
      clubId: clubId || null,
      reasonCode: "SCOPE_REQUIRED",
      provenance: "pm-id-01",
      authoredStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
      error: createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE,
        "PLAYER self-scope requires explicit tenantId and clubId; no first-club fallback."
      ),
    });
  }

  // Reject spoofed identity selectors at the Coaching boundary.
  for (const key of [
    "principalId",
    "principal_id",
    "authUserId",
    "auth_user_id",
    "playerId",
    "player_id",
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(input, key) &&
      input[key] != null &&
      input[key] !== ""
    ) {
      return Object.freeze({
        ok: false,
        state: COACHING_PLAYER_SCOPE_STATE.FORBIDDEN,
        status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
        playerId: null,
        tenantId,
        clubId,
        reasonCode: "CALLER_PRINCIPAL_FORBIDDEN",
        provenance: "pm-id-01",
        authoredStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
        error: createCoachingRuntimeError(
          COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED,
          "PLAYER self-scope forbids caller-supplied principal/player identity."
        ),
      });
    }
  }

  try {
    const resolveFn =
      typeof input.resolveMapping === "function"
        ? input.resolveMapping
        : resolveAuthenticatedCanonicalPlayerMapping;

    const mapping = await resolveFn({
      tenantId,
      clubId,
      adapter: input.mappingAdapter,
      repository: input.mappingRepository,
      getSessionUserId: input.getSessionUserId,
    });

    const status = String(mapping?.status || PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
    const playerId =
      status === PLAYER_IDENTITY_MAPPING_STATUS.MAPPED
        ? String(mapping.playerId || "").trim() || null
        : null;

    if (status === PLAYER_IDENTITY_MAPPING_STATUS.MAPPED && playerId) {
      return Object.freeze({
        ok: true,
        state: COACHING_PLAYER_SCOPE_STATE.LIVE,
        status,
        playerId,
        tenantId,
        clubId,
        reasonCode: mapping.reasonCode || "OK",
        provenance: "pm-id-01",
        authoredStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
        error: null,
      });
    }

    const stateByStatus = {
      [PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED]: COACHING_PLAYER_SCOPE_STATE.UNMAPPED,
      [PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE]: COACHING_PLAYER_SCOPE_STATE.INACTIVE,
      [PLAYER_IDENTITY_MAPPING_STATUS.AMBIGUOUS]: COACHING_PLAYER_SCOPE_STATE.AMBIGUOUS,
      [PLAYER_IDENTITY_MAPPING_STATUS.INVALID]: COACHING_PLAYER_SCOPE_STATE.INVALID,
    };

    const state = stateByStatus[status] || COACHING_PLAYER_SCOPE_STATE.ERROR;
    const code =
      status === PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED ||
      status === PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE ||
      status === PLAYER_IDENTITY_MAPPING_STATUS.AMBIGUOUS
        ? COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED
        : COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED;

    return Object.freeze({
      ok: false,
      state,
      status,
      playerId: null,
      tenantId,
      clubId,
      reasonCode: mapping?.reasonCode || status,
      provenance: "pm-id-01",
      authoredStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
      error: createCoachingRuntimeError(
        code,
        `PLAYER self-scope fail-closed: mapping status ${status}.`
      ),
    });
  } catch (err) {
    return Object.freeze({
      ok: false,
      state: COACHING_PLAYER_SCOPE_STATE.ERROR,
      status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
      playerId: null,
      tenantId,
      clubId,
      reasonCode: "RESOLVER_ERROR",
      provenance: "pm-id-01",
      authoredStatus: COACHING_04_PLAYER_SELF_SCOPE_STATUS,
      error: createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
        err?.message || "PLAYER self-scope resolver failed."
      ),
    });
  }
}

/**
 * Classify a successful durable list into LIVE vs EMPTY without treating ERROR as empty.
 * @param {{ ok?: boolean, data?: unknown[] }|null} listResult
 * @param {{ ok?: boolean, state?: string }|null} scopeResult
 */
export function classifyCoachingDurableCollectionResult(listResult, scopeResult) {
  if (scopeResult && scopeResult.ok === false) {
    return {
      state: scopeResult.state || COACHING_PLAYER_SCOPE_STATE.ERROR,
      rows: [],
      live: false,
      empty: false,
      error: scopeResult.error || null,
    };
  }
  if (!listResult || listResult.ok !== true) {
    return {
      state: COACHING_PLAYER_SCOPE_STATE.ERROR,
      rows: [],
      live: false,
      empty: false,
      error: listResult || createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
        "Durable coaching list failed."
      ),
    };
  }
  const rows = Array.isArray(listResult.data) ? listResult.data : [];
  if (rows.length === 0) {
    return {
      state: COACHING_PLAYER_SCOPE_STATE.EMPTY,
      rows,
      live: true,
      empty: true,
      error: null,
    };
  }
  return {
    state: COACHING_PLAYER_SCOPE_STATE.LIVE,
    rows,
    live: true,
    empty: false,
    error: null,
  };
}

/**
 * Fail-closed write gate for PLAYER durable mutations (currently denied).
 */
export function assertCoachingPlayerDurableWriteAllowed(scopeResult) {
  if (!scopeResult?.ok) {
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED,
      "Durable PLAYER write denied: self-scope not MAPPED."
    );
  }
  return createCoachingRuntimeError(
    COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED,
    "PLAYER durable mutations are not authorized in COACHING-04 (read-only self-scope)."
  );
}
