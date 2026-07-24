/**
 * Duplicate candidate domain factory (CUSTOMER-06).
 */

import {
  CUSTOMER_DUPLICATE_CANDIDATE_STATUS,
  isCustomerDuplicateCandidateStatus,
} from "../constants/duplicateCandidateStatuses.js";
import { isCustomerDuplicateClassification } from "../constants/duplicateClassifications.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { createCustomerScope } from "./scope.js";

/**
 * Canonical ordered pair — lexicographic by customerId to prevent A-B / B-A dupes.
 * Uses JavaScript `<` (code-unit / C-locale order). Database CHECK must use
 * `COLLATE "C"` so Staging/Production en_US.UTF-8 does not disagree
 * (e.g. `cust_id1_` vs `cust_id15_`).
 *
 * @param {string} customerIdA
 * @param {string} customerIdB
 * @returns {{ customerIdA: string, customerIdB: string }}
 */
export function orderCustomerPair(customerIdA, customerIdB) {
  const a = String(customerIdA || "").trim();
  const b = String(customerIdB || "").trim();
  if (!a || !b) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Both customerIds are required for a duplicate candidate pair.",
      { field: "customerId" }
    );
  }
  if (a === b) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Duplicate candidate requires two distinct customers.",
      { customerId: a }
    );
  }
  return a < b
    ? { customerIdA: a, customerIdB: b }
    : { customerIdA: b, customerIdB: a };
}

/**
 * Deterministic candidate key within scope.
 * @param {{ tenantId: string, venueId: string }} scope
 * @param {string} customerIdA
 * @param {string} customerIdB
 */
export function duplicateCandidatePairKey(scope, customerIdA, customerIdB) {
  const ordered = orderCustomerPair(customerIdA, customerIdB);
  return `${scope.tenantId}\u0000${scope.venueId}\u0000${ordered.customerIdA}\u0000${ordered.customerIdB}`;
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createDuplicateCandidate(input = {}, deps = {}) {
  const scope = createCustomerScope(input);
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  const ordered = orderCustomerPair(input.customerIdA, input.customerIdB);
  const classification = String(input.classification || "");
  if (!isCustomerDuplicateClassification(classification)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Duplicate candidate classification is invalid.",
      { field: "classification", classification }
    );
  }

  const status = String(
    input.status || CUSTOMER_DUPLICATE_CANDIDATE_STATUS.OPEN
  );
  if (!isCustomerDuplicateCandidateStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Duplicate candidate status is invalid.",
      { field: "status", status }
    );
  }

  const evaluatedSurvivorVersion =
    input.evaluatedSurvivorVersion != null
      ? Number(input.evaluatedSurvivorVersion)
      : input.evaluatedVersions?.customerIdA != null
        ? Number(input.evaluatedVersions.customerIdA)
        : null;
  const evaluatedAbsorbedVersion =
    input.evaluatedAbsorbedVersion != null
      ? Number(input.evaluatedAbsorbedVersion)
      : input.evaluatedVersions?.customerIdB != null
        ? Number(input.evaluatedVersions.customerIdB)
        : null;

  const evaluatedVersions = Object.freeze({
    [ordered.customerIdA]:
      input.evaluatedVersions?.[ordered.customerIdA] != null
        ? Number(input.evaluatedVersions[ordered.customerIdA])
        : evaluatedSurvivorVersion,
    [ordered.customerIdB]:
      input.evaluatedVersions?.[ordered.customerIdB] != null
        ? Number(input.evaluatedVersions[ordered.customerIdB])
        : evaluatedAbsorbedVersion,
  });

  return Object.freeze({
    candidateId: String(input.candidateId || nextId("dcand")),
    customerIdA: ordered.customerIdA,
    customerIdB: ordered.customerIdB,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    classification,
    score:
      Number.isInteger(input.score) || typeof input.score === "number"
        ? Number(input.score)
        : null,
    signals: Object.freeze([...(input.signals || [])].map((s) => Object.freeze({ ...s }))),
    conflicts: Object.freeze(
      [...(input.conflicts || [])].map((c) => Object.freeze({ ...c }))
    ),
    reasonCodes: Object.freeze(
      [...(input.reasonCodes || [])].map((r) => String(r))
    ),
    status,
    detectedAt: String(input.detectedAt || nowIso),
    evaluatedAt: String(input.evaluatedAt || nowIso),
    evaluatedSurvivorVersion:
      evaluatedVersions[ordered.customerIdA] ?? null,
    evaluatedAbsorbedVersion:
      evaluatedVersions[ordered.customerIdB] ?? null,
    evaluatedVersions,
    version:
      Number.isInteger(input.version) && input.version > 0
        ? input.version
        : 1,
    source: String(input.source || "SYSTEM"),
    reviewedAt: input.reviewedAt ? String(input.reviewedAt) : null,
    reviewReference: input.reviewReference
      ? String(input.reviewReference)
      : null,
    updatedAt: String(input.updatedAt || nowIso),
  });
}

/**
 * @param {object} candidate
 * @param {object} customerA
 * @param {object} customerB
 * @returns {boolean}
 */
export function isDuplicateCandidateStale(candidate, customerA, customerB) {
  if (!candidate || !customerA || !customerB) return true;
  // Lookup by customerId — callers may pass survivor/absorbed in any order,
  // while candidate.customerIdA/B are lexicographically ordered.
  const versionById = Object.freeze({
    [String(customerA.customerId)]: customerA.version,
    [String(customerB.customerId)]: customerB.version,
  });
  const vA = candidate.evaluatedVersions?.[candidate.customerIdA];
  const vB = candidate.evaluatedVersions?.[candidate.customerIdB];
  if (
    vA != null &&
    Number(vA) !== Number(versionById[candidate.customerIdA])
  ) {
    return true;
  }
  if (
    vB != null &&
    Number(vB) !== Number(versionById[candidate.customerIdB])
  ) {
    return true;
  }
  return false;
}
