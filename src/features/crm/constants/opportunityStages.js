/**
 * Canonical opportunity stage codes and pipeline stage semantics (Phase 1B + 1D).
 */

export const OPPORTUNITY_STAGE = Object.freeze({
  QUALIFICATION: "qualification",
  PROPOSAL: "proposal",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
});

export const OPPORTUNITY_STAGE_VALUES = Object.freeze(Object.values(OPPORTUNITY_STAGE));

/**
 * Semantic category for pipeline stages.
 * Open stages may receive advances; won/lost are terminal.
 */
export const PIPELINE_STAGE_CATEGORY = Object.freeze({
  OPEN: "open",
  WON: "won",
  LOST: "lost",
});

export const PIPELINE_STAGE_CATEGORY_VALUES = Object.freeze(
  Object.values(PIPELINE_STAGE_CATEGORY)
);

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

/**
 * @param {string} category
 * @returns {boolean}
 */
export function isPipelineStageCategory(category) {
  return PIPELINE_STAGE_CATEGORY_VALUES.includes(String(category || ""));
}

/**
 * Infer category from a known stage code when not explicitly provided.
 * @param {string} code
 * @returns {string|null}
 */
export function inferStageCategoryFromCode(code) {
  const c = String(code || "");
  if (c === OPPORTUNITY_STAGE.WON) return PIPELINE_STAGE_CATEGORY.WON;
  if (c === OPPORTUNITY_STAGE.LOST) return PIPELINE_STAGE_CATEGORY.LOST;
  if (isOpportunityStage(c)) return PIPELINE_STAGE_CATEGORY.OPEN;
  return null;
}

/**
 * Normalize pipeline or stage codes deterministically.
 * Lowercase, trim, collapse internal whitespace to single underscore.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePipelineCode(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
