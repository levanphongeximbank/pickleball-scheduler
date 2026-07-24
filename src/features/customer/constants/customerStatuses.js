/**
 * Customer lifecycle statuses (CUSTOMER-01 + CUSTOMER-06 MERGED).
 */

export const CUSTOMER_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
  MERGED: "MERGED",
});

export const CUSTOMER_STATUS_VALUES = Object.freeze(Object.values(CUSTOMER_STATUS));

export const CUSTOMER_TERMINAL_STATUSES = Object.freeze([
  CUSTOMER_STATUS.ARCHIVED,
  CUSTOMER_STATUS.MERGED,
]);

/**
 * Allowed status transitions. Same-status is a no-op (rejected as invalid
 * transition so callers must be explicit about intent).
 *
 * MERGED is terminal (no outbound). ARCHIVED remains terminal.
 * Transitions INTO MERGED are allowed from ACTIVE/INACTIVE/SUSPENDED only
 * (not from ARCHIVED) — used by explicit merge execution.
 *
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const CUSTOMER_ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  [CUSTOMER_STATUS.ACTIVE]: Object.freeze([
    CUSTOMER_STATUS.INACTIVE,
    CUSTOMER_STATUS.SUSPENDED,
    CUSTOMER_STATUS.ARCHIVED,
    CUSTOMER_STATUS.MERGED,
  ]),
  [CUSTOMER_STATUS.INACTIVE]: Object.freeze([
    CUSTOMER_STATUS.ACTIVE,
    CUSTOMER_STATUS.ARCHIVED,
    CUSTOMER_STATUS.MERGED,
  ]),
  [CUSTOMER_STATUS.SUSPENDED]: Object.freeze([
    CUSTOMER_STATUS.ACTIVE,
    CUSTOMER_STATUS.INACTIVE,
    CUSTOMER_STATUS.ARCHIVED,
    CUSTOMER_STATUS.MERGED,
  ]),
  [CUSTOMER_STATUS.ARCHIVED]: Object.freeze([]),
  [CUSTOMER_STATUS.MERGED]: Object.freeze([]),
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerStatus(value) {
  return CUSTOMER_STATUS_VALUES.includes(String(value || ""));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerTerminalStatus(value) {
  return CUSTOMER_TERMINAL_STATUSES.includes(String(value || ""));
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isAllowedCustomerStatusTransition(from, to) {
  const allowed = CUSTOMER_ALLOWED_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}
