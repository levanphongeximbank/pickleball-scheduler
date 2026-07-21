/**
 * CORE-06 Phase 1E — visibility projection result contract.
 * Fail-closed redaction; no hidden slot / identity leakage by default.
 */

import { LINEUP_VISIBILITY_STATE } from "./lineupVisibilityState.js";

/**
 * @typedef {Object} LineupVisibilityProjection
 * @property {boolean} visible
 * @property {string} visibilityState
 * @property {string|null} reason
 * @property {ReadonlyArray<string>} permittedFields
 * @property {ReadonlyArray<string>} redactedFields
 * @property {unknown|null} projectedLineup
 * @property {Readonly<Record<string, unknown>>} metadata
 */

export const LINEUP_PROJECTION_FIELD = Object.freeze({
  IDENTITY: "identity",
  STATUS: "status",
  VISIBILITY_STATE: "visibilityState",
  REVISION: "revision",
  SLOT_COUNT: "slotCount",
  SLOTS: "slots",
  PARTICIPANT_IDS: "participantIds",
  TEAM_ID: "teamId",
  COMPETITION_ID: "competitionId",
  TENANT_ID: "tenantId",
  CONTEXT_ID: "contextId",
});

/**
 * @param {Partial<LineupVisibilityProjection> & { visible?: boolean }} [partial]
 * @returns {LineupVisibilityProjection}
 */
export function createLineupVisibilityProjection(partial = {}) {
  const visible = partial.visible === true;
  const permitted = Array.isArray(partial.permittedFields)
    ? [...partial.permittedFields]
    : [];
  const redacted = Array.isArray(partial.redactedFields)
    ? [...partial.redactedFields]
    : [];
  return Object.freeze({
    visible,
    visibilityState:
      typeof partial.visibilityState === "string" &&
      partial.visibilityState.trim() !== ""
        ? partial.visibilityState.trim()
        : LINEUP_VISIBILITY_STATE.PRIVATE,
    reason:
      partial.reason != null && String(partial.reason).trim() !== ""
        ? String(partial.reason).trim()
        : null,
    permittedFields: Object.freeze(permitted),
    redactedFields: Object.freeze(redacted),
    projectedLineup: visible ? (partial.projectedLineup ?? null) : null,
    metadata: Object.freeze({
      ...(partial.metadata && typeof partial.metadata === "object"
        ? { ...partial.metadata }
        : {}),
    }),
  });
}
