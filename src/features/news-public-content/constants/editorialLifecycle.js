/**
 * Editorial lifecycle statuses and allowed transitions (NEWS-01).
 * ARCHIVED is terminal.
 */

export const EDITORIAL_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  UNPUBLISHED: "UNPUBLISHED",
  ARCHIVED: "ARCHIVED",
});

export const EDITORIAL_STATUS_VALUES = Object.freeze(
  Object.values(EDITORIAL_STATUS)
);

export const EDITORIAL_TERMINAL_STATUSES = Object.freeze([
  EDITORIAL_STATUS.ARCHIVED,
]);

/**
 * Deterministic allowed transitions. Keys = from-status; values = to-status set.
 */
export const EDITORIAL_ALLOWED_TRANSITIONS = Object.freeze({
  [EDITORIAL_STATUS.DRAFT]: Object.freeze([EDITORIAL_STATUS.IN_REVIEW]),
  [EDITORIAL_STATUS.IN_REVIEW]: Object.freeze([
    EDITORIAL_STATUS.DRAFT,
    EDITORIAL_STATUS.APPROVED,
  ]),
  [EDITORIAL_STATUS.APPROVED]: Object.freeze([
    EDITORIAL_STATUS.SCHEDULED,
    EDITORIAL_STATUS.PUBLISHED,
  ]),
  [EDITORIAL_STATUS.SCHEDULED]: Object.freeze([
    EDITORIAL_STATUS.APPROVED,
    EDITORIAL_STATUS.PUBLISHED,
  ]),
  [EDITORIAL_STATUS.PUBLISHED]: Object.freeze([
    EDITORIAL_STATUS.UNPUBLISHED,
    EDITORIAL_STATUS.ARCHIVED,
  ]),
  [EDITORIAL_STATUS.UNPUBLISHED]: Object.freeze([
    EDITORIAL_STATUS.DRAFT,
    EDITORIAL_STATUS.APPROVED,
    EDITORIAL_STATUS.PUBLISHED,
    EDITORIAL_STATUS.ARCHIVED,
  ]),
  [EDITORIAL_STATUS.ARCHIVED]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEditorialStatus(value) {
  return EDITORIAL_STATUS_VALUES.includes(/** @type {string} */ (value));
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isEditorialTransitionAllowed(from, to) {
  const allowed = EDITORIAL_ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
