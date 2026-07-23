/**
 * Rating current-state contract (runtime-neutral, Phase 1B).
 * Does not calculate displayRating or select an algorithm.
 */

import { requireSupportedRatingMode } from "./ratingModes.js";
import { requireExplicitPlayerRatingScope } from "./scopeContract.js";
import {
  deepFreeze,
  requireNonEmptyString,
  requireValidTimestamp,
} from "./shared.js";

/**
 * @typedef {Object} RatingCurrentStateContract
 * @property {string} playerId
 * @property {import('./scopeContract.js').PlayerRatingScope} scope
 * @property {'overall'|'singles'|'doubles'} ratingMode
 * @property {unknown} [selfAssessedRating]
 * @property {unknown} [provisionalRating]
 * @property {unknown} [verifiedRating]
 * @property {unknown} [calculatedRating]
 * @property {unknown} [displayRating]
 * @property {unknown} [confidence]
 * @property {string} status
 * @property {string} source
 * @property {string|number} effectiveAt
 * @property {string} [algorithmVersion]
 * @property {string} [lastEventId]
 */

/**
 * @param {unknown} input
 * @returns {Readonly<RatingCurrentStateContract>}
 */
export function createRatingCurrentStateContract(input) {
  if (!input || typeof input !== "object") {
    requireNonEmptyString(null, "currentState");
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const playerId = requireNonEmptyString(raw.playerId, "playerId");
  const scope = requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId);
  const ratingMode = requireSupportedRatingMode(raw.ratingMode);
  const status = requireNonEmptyString(raw.status, "status");
  const source = requireNonEmptyString(raw.source, "source");
  const effectiveAt = requireValidTimestamp(raw.effectiveAt, "effectiveAt");

  /** @type {RatingCurrentStateContract} */
  const contract = {
    playerId,
    scope,
    ratingMode,
    status,
    source,
    effectiveAt,
  };

  if ("selfAssessedRating" in raw) contract.selfAssessedRating = raw.selfAssessedRating;
  if ("provisionalRating" in raw) contract.provisionalRating = raw.provisionalRating;
  if ("verifiedRating" in raw) contract.verifiedRating = raw.verifiedRating;
  if ("calculatedRating" in raw) contract.calculatedRating = raw.calculatedRating;
  if ("displayRating" in raw) contract.displayRating = raw.displayRating;
  if ("confidence" in raw) contract.confidence = raw.confidence;
  if (raw.algorithmVersion != null) {
    contract.algorithmVersion = requireNonEmptyString(
      raw.algorithmVersion,
      "algorithmVersion"
    );
  }
  if (raw.lastEventId != null) {
    contract.lastEventId = requireNonEmptyString(raw.lastEventId, "lastEventId");
  }

  return deepFreeze(contract);
}

/**
 * @param {unknown} value
 * @returns {value is RatingCurrentStateContract}
 */
export function isRatingCurrentStateContract(value) {
  try {
    createRatingCurrentStateContract(value);
    return true;
  } catch {
    return false;
  }
}
