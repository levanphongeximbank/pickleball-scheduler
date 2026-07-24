/**
 * Template availability baseline (CM-02).
 */

export const COMPETITION_TEMPLATE_AVAILABILITY = Object.freeze({
  AVAILABLE: "available",
  DISABLED: "disabled",
  DEPRECATED: "deprecated",
});

export const COMPETITION_TEMPLATE_AVAILABILITY_VALUES = Object.freeze(
  Object.values(COMPETITION_TEMPLATE_AVAILABILITY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionTemplateAvailability(value) {
  return (
    typeof value === "string" &&
    COMPETITION_TEMPLATE_AVAILABILITY_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTemplateSelectable(value) {
  return value === COMPETITION_TEMPLATE_AVAILABILITY.AVAILABLE;
}
