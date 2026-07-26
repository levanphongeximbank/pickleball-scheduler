/**
 * Player Rating-side adapter over Player Management resolveCanonicalPlayerId.
 * Does not modify Player Management internals.
 * Fail closed on UNMAPPED / INVALID / AMBIGUOUS — never picks "first match".
 *
 * PM resolver is loaded lazily so V2 compatibility reads do not pull the
 * Player Management / auth module graph at import time.
 */

import { RESOLUTION_OUTCOME } from "../../../../player/constants/resolutionOutcomes.js";
import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../../errors/PlayerRatingFoundationError.js";
import { requireExplicitPlayerRatingScope } from "../../contracts/scopeContract.js";
import { matchesCanonicalPlayerIdResolverPort } from "../../ports/canonicalPlayerIdResolverPort.js";

/**
 * Map PM resolution outcome to foundation typed errors / mapped result.
 * @param {import('../../../../player/models/resolutionResult.js').PlayerResolutionResult} result
 * @param {unknown} reference
 */
export function mapPlayerManagementResolution(result, reference) {
  if (!result || typeof result !== "object") {
    throw new PlayerRatingFoundationError(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_UNRESOLVED,
      "Canonical player identity unresolved",
      { reference, reason: "empty_resolution" }
    );
  }

  const outcome = String(result.outcome || "");

  if (outcome === RESOLUTION_OUTCOME.AMBIGUOUS) {
    throw new PlayerRatingFoundationError(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_AMBIGUOUS,
      "Canonical player identity is ambiguous (fail closed)",
      {
        reference,
        candidatePlayerIds: result.candidatePlayerIds || [],
        warnings: result.warnings || [],
      }
    );
  }

  if (
    outcome === RESOLUTION_OUTCOME.UNMAPPED ||
    outcome === RESOLUTION_OUTCOME.INVALID ||
    !result.playerId
  ) {
    throw new PlayerRatingFoundationError(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_UNRESOLVED,
      "Canonical player identity unresolved (fail closed)",
      {
        reference,
        outcome,
        warnings: result.warnings || [],
        meta: result.meta || {},
      }
    );
  }

  if (
    outcome !== RESOLUTION_OUTCOME.MAPPED &&
    outcome !== RESOLUTION_OUTCOME.DERIVED
  ) {
    throw new PlayerRatingFoundationError(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.IDENTITY_UNRESOLVED,
      "Canonical player identity unresolved: unsupported outcome",
      { reference, outcome }
    );
  }

  return Object.freeze({
    outcome,
    playerId: String(result.playerId),
    authUserId: result.authUserId ?? null,
    reason: "resolved",
  });
}

/**
 * @param {{
 *   resolve?: Function,
 *   resolveOptions?: object,
 * }} [deps]
 */
export function createCanonicalPlayerIdResolverAdapter(deps = {}) {
  const resolveOptions = deps.resolveOptions || {};
  const injectedResolve = deps.resolve || null;

  const adapter = {
    /**
     * @param {unknown} reference
     * @param {unknown} scope
     */
    async resolveCanonicalPlayerId(reference, scope) {
      requireExplicitPlayerRatingScope(scope);

      let resolve = injectedResolve;
      if (!resolve) {
        const mod = await import(
          "../../../../player/services/resolveCanonicalPlayerId.js"
        );
        resolve = mod.resolveCanonicalPlayerId;
      }

      // Aliases are accepted only as resolution input — never stored as owner FK.
      const result = resolve(reference, {
        ...resolveOptions,
        scope,
      });

      return mapPlayerManagementResolution(result, reference);
    },
  };

  if (!matchesCanonicalPlayerIdResolverPort(adapter)) {
    throw new Error(
      "CanonicalPlayerIdResolverAdapter does not match CanonicalPlayerIdResolverPort"
    );
  }

  return adapter;
}
