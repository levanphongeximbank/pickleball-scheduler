/**
 * CORE-06 Phase 1F — LineupFormatAdapter port (capability-local).
 * Format adapters map format-specific envelopes ↔ CORE-06 commands.
 * No Production imports. No Team Tournament deep imports.
 */

export const LINEUP_FORMAT_ADAPTER_KIND = "LINEUP_FORMAT_ADAPTER";

/**
 * @typedef {Object} LineupFormatAdapter
 * @property {string} id
 * @property {string} kind
 * @property {(input: object) => object} resolveAggregateIdentity
 * @property {(input: object) => object} mapCreateCommand
 * @property {(input: object) => object} mapSubmitCommand
 * @property {(input: object) => object} mapLockCommand
 * @property {(input: object) => object} mapPublishCommand
 * @property {(input: object) => object} mapCorrectionCommand
 * @property {(input: object) => object} mapRandomFallbackCommand
 * @property {(input: object) => object} mapVisibilityContext
 * @property {(input: object) => object} mapDeadlinePolicy
 * @property {(input: object) => object} mapHardeningPolicy
 * @property {(input: object) => object} mapActorContext
 * @property {(input: object) => object} mapIdempotencyContext
 * @property {(input: object) => object} mapExpectedVersion
 * @property {(result: object) => object} mapCanonicalResultToFormat
 */

const REQUIRED_METHODS = Object.freeze([
  "resolveAggregateIdentity",
  "mapCreateCommand",
  "mapSubmitCommand",
  "mapLockCommand",
  "mapPublishCommand",
  "mapCorrectionCommand",
  "mapRandomFallbackCommand",
  "mapVisibilityContext",
  "mapDeadlinePolicy",
  "mapHardeningPolicy",
  "mapActorContext",
  "mapIdempotencyContext",
  "mapExpectedVersion",
  "mapCanonicalResultToFormat",
]);

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function isLineupFormatAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") return false;
  if (typeof /** @type {{ id?: unknown }} */ (adapter).id !== "string") {
    return false;
  }
  if (
    /** @type {{ kind?: unknown }} */ (adapter).kind !==
    LINEUP_FORMAT_ADAPTER_KIND
  ) {
    return false;
  }
  return REQUIRED_METHODS.every(
    (name) => typeof /** @type {Record<string, unknown>} */ (adapter)[name] === "function"
  );
}

export { REQUIRED_METHODS as LINEUP_FORMAT_ADAPTER_METHODS };
