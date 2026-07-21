/**
 * Canonical opportunity stage codes (Phase 1B).
 * Full pipeline lifecycle / transitions belong in Phase 1D.
 */

export const OPPORTUNITY_STAGE = Object.freeze({
  QUALIFICATION: "qualification",
  PROPOSAL: "proposal",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
});

export const OPPORTUNITY_STAGE_VALUES = Object.freeze(Object.values(OPPORTUNITY_STAGE));

/** Default ordered stage path for a simple venue sales pipeline. */
export const DEFAULT_PIPELINE_STAGE_ORDER = Object.freeze([
  OPPORTUNITY_STAGE.QUALIFICATION,
  OPPORTUNITY_STAGE.PROPOSAL,
  OPPORTUNITY_STAGE.NEGOTIATION,
  OPPORTUNITY_STAGE.WON,
  OPPORTUNITY_STAGE.LOST,
]);

/**
 * @param {string} stage
 * @returns {boolean}
 */
export function isOpportunityStage(stage) {
  return OPPORTUNITY_STAGE_VALUES.includes(String(stage || ""));
}
