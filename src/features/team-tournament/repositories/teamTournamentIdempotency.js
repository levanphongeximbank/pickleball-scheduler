import {
  canonicalizeTeamTournamentValue,
  hashTeamTournamentCanonicalValue,
} from "./teamTournamentCanonical.js";

/** @deprecated Use canonicalizeTeamTournamentValue from teamTournamentCanonical.js */
export const canonicalizeTeamTournamentPayload = canonicalizeTeamTournamentValue;

/**
 * Stable payload hash for idempotency (canonical JSON → sha256 hex).
 * @param {unknown} payload
 * @returns {string}
 */
export function hashTeamTournamentPayload(payload) {
  return hashTeamTournamentCanonicalValue(payload);
}

/**
 * @param {object} params
 * @param {string} [params.idempotencyKey]
 * @param {unknown} params.payload
 * @param {{ replay?: boolean, result?: object, code?: string, payloadHash?: string }} stored
 */
export function resolveIdempotencyReplay(params, stored) {
  if (!params.idempotencyKey) {
    return { action: "execute" };
  }

  if (!stored) {
    return { action: "execute" };
  }

  const hash = hashTeamTournamentPayload(params.payload);
  if (stored.payloadHash && stored.payloadHash !== hash) {
    return {
      action: "reject",
      code: "idempotency_payload_mismatch",
      error: "Idempotency key đã dùng với payload khác.",
    };
  }

  if (stored.result) {
    return { action: "replay", result: stored.result };
  }

  return { action: "execute" };
}

export {
  canonicalizeTeamTournamentValue,
  hashTeamTournamentCanonicalValue,
  stableStringifyTeamTournamentValue,
} from "./teamTournamentCanonical.js";
