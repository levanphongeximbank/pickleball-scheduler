/**
 * Customer merge / deduplication foundation contract (no runtime merge engine).
 */

export const CUSTOMER_MERGE_STATUS = Object.freeze({
  CANDIDATE: "CANDIDATE",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
});

export const CUSTOMER_MERGE_STATUS_VALUES = Object.freeze(
  Object.values(CUSTOMER_MERGE_STATUS)
);

export const CUSTOMER_DEDUPE_MATCH_KIND = Object.freeze({
  CUSTOMER_NUMBER: "CUSTOMER_NUMBER",
  PRIMARY_EMAIL: "PRIMARY_EMAIL",
  PRIMARY_PHONE: "PRIMARY_PHONE",
  ACCOUNT_LINK: "ACCOUNT_LINK",
  PLAYER_LINK: "PLAYER_LINK",
});

export const CUSTOMER_DEDUPE_MATCH_KIND_VALUES = Object.freeze(
  Object.values(CUSTOMER_DEDUPE_MATCH_KIND)
);

/**
 * @typedef {Readonly<{
 *   survivorCustomerId: string,
 *   duplicateCustomerId: string,
 *   matchKinds: readonly string[],
 *   status: string,
 * }>} CustomerMergeProposal
 */

/**
 * Build an immutable merge proposal contract object.
 * Runtime execution is deferred to a later phase.
 *
 * @param {object} input
 * @returns {CustomerMergeProposal}
 */
export function createCustomerMergeProposal(input = {}) {
  const survivorCustomerId = String(input.survivorCustomerId || "").trim();
  const duplicateCustomerId = String(input.duplicateCustomerId || "").trim();
  const status = String(input.status || CUSTOMER_MERGE_STATUS.CANDIDATE);
  const matchKinds = Array.isArray(input.matchKinds)
    ? Object.freeze(input.matchKinds.map((k) => String(k)))
    : Object.freeze([]);

  return Object.freeze({
    survivorCustomerId,
    duplicateCustomerId,
    matchKinds,
    status,
  });
}
