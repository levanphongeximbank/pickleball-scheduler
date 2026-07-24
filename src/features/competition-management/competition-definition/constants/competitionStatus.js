/**
 * Competition Management lifecycle classification (CM-01 baseline).
 *
 * DRAFT — editable via update-draft command.
 * PUBLISHED — definition locked for CM-01 update-draft; publication process owned by CM-06.
 *
 * SUSPENDED / CANCELLED / ARCHIVED transitions are deferred to CM-07 / CM-08.
 * They are reserved values for read-compatibility only and are not produced by CM-01 commands.
 */

export const COMPETITION_DEFINITION_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  /** @deprecated Deferred to CM-07 — reserved, not transitioned by CM-01 commands. */
  SUSPENDED: "suspended",
  /** @deprecated Deferred to CM-07 — reserved, not transitioned by CM-01 commands. */
  CANCELLED: "cancelled",
  /** @deprecated Deferred to CM-08 — reserved, not transitioned by CM-01 commands. */
  ARCHIVED: "archived",
});

export const COMPETITION_DEFINITION_STATUS_VALUES = Object.freeze(
  Object.values(COMPETITION_DEFINITION_STATUS)
);

/** Statuses that CM-01 create/update-draft may produce or edit. */
export const COMPETITION_DEFINITION_EDITABLE_STATUSES = Object.freeze([
  COMPETITION_DEFINITION_STATUS.DRAFT,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionDefinitionStatus(value) {
  return (
    typeof value === "string" &&
    COMPETITION_DEFINITION_STATUS_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDraftEditableStatus(value) {
  return value === COMPETITION_DEFINITION_STATUS.DRAFT;
}
