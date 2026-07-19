/** Lifecycle for CompetitionDivisionCategory lanes. */
export const DIVISION_CATEGORY_LIFECYCLE = Object.freeze({
  DRAFT: "draft",
  OPEN: "open",
  LOCKED: "locked",
  CLOSED: "closed",
  ARCHIVED: "archived",
});

/** @type {ReadonlySet<string>} */
export const DIVISION_CATEGORY_LIFECYCLE_VALUES = new Set(
  Object.values(DIVISION_CATEGORY_LIFECYCLE)
);

/**
 * Allowed explicit transitions (no skipping).
 * OPEN → DRAFT is conditional (reference checker + audit reason) — gated at service layer.
 */
export const DIVISION_CATEGORY_ALLOWED_TRANSITIONS = Object.freeze({
  [DIVISION_CATEGORY_LIFECYCLE.DRAFT]: Object.freeze([DIVISION_CATEGORY_LIFECYCLE.OPEN]),
  [DIVISION_CATEGORY_LIFECYCLE.OPEN]: Object.freeze([
    DIVISION_CATEGORY_LIFECYCLE.LOCKED,
    DIVISION_CATEGORY_LIFECYCLE.CLOSED,
    DIVISION_CATEGORY_LIFECYCLE.DRAFT,
  ]),
  [DIVISION_CATEGORY_LIFECYCLE.LOCKED]: Object.freeze([DIVISION_CATEGORY_LIFECYCLE.CLOSED]),
  [DIVISION_CATEGORY_LIFECYCLE.CLOSED]: Object.freeze([DIVISION_CATEGORY_LIFECYCLE.ARCHIVED]),
  [DIVISION_CATEGORY_LIFECYCLE.ARCHIVED]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDivisionCategoryLifecycle(value) {
  return typeof value === "string" && DIVISION_CATEGORY_LIFECYCLE_VALUES.has(value);
}
