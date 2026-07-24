/**
 * Customer merge / deduplication contract (CUSTOMER-01 foundation + CUSTOMER-06).
 * Backward-compatible exports preserved. Rich proposal factory added.
 */

import {
  CUSTOMER_MERGE_RESOLUTION_ACTION,
  isCustomerMergeResolutionAction,
} from "../constants/mergeResolutionActions.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { createCustomerScope } from "./scope.js";

export const CUSTOMER_MERGE_STATUS = Object.freeze({
  CANDIDATE: "CANDIDATE",
  DRAFT: "DRAFT",
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

export const CUSTOMER_MERGE_APPROVAL_STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerMergeStatus(value) {
  return CUSTOMER_MERGE_STATUS_VALUES.includes(String(value || ""));
}

/**
 * @param {object} [plan]
 * @returns {Readonly<object>}
 */
function normalizeResolutionPlan(plan = {}) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [field, action] of Object.entries(plan || {})) {
    const a = String(action || CUSTOMER_MERGE_RESOLUTION_ACTION.KEEP_SURVIVOR);
    if (!isCustomerMergeResolutionAction(a)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_INPUT,
        `Invalid merge resolution action for ${field}.`,
        { field, action: a }
      );
    }
    out[field] = a;
  }
  return Object.freeze(out);
}

/**
 * Rich merge proposal factory (CUSTOMER-06).
 *
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createRichCustomerMergeProposal(input = {}, deps = {}) {
  const scope = createCustomerScope(input);
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  const survivorCustomerId = String(
    input.survivorCustomerId || input.survivorId || ""
  ).trim();
  const absorbedCustomerId = String(
    input.absorbedCustomerId ||
      input.duplicateCustomerId ||
      input.absorbId ||
      ""
  ).trim();

  if (!survivorCustomerId || !absorbedCustomerId) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "survivorCustomerId and absorbedCustomerId are required.",
      { field: "survivorCustomerId" }
    );
  }
  if (survivorCustomerId === absorbedCustomerId) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_MERGE_SURVIVOR,
      "Survivor and absorbed customer must be distinct.",
      { survivorCustomerId }
    );
  }

  const approvalStatus = String(
    input.approvalStatus || CUSTOMER_MERGE_APPROVAL_STATUS.PENDING
  );
  const status = String(
    input.status ||
      (approvalStatus === CUSTOMER_MERGE_APPROVAL_STATUS.APPROVED
        ? CUSTOMER_MERGE_STATUS.APPROVED
        : CUSTOMER_MERGE_STATUS.DRAFT)
  );
  if (!isCustomerMergeStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Merge proposal status is invalid.",
      { field: "status", status }
    );
  }

  const expectedSurvivorVersion =
    input.expectedSurvivorVersion != null
      ? Number(input.expectedSurvivorVersion)
      : null;
  const expectedAbsorbedVersion =
    input.expectedAbsorbedVersion != null
      ? Number(input.expectedAbsorbedVersion)
      : null;

  return Object.freeze({
    mergeProposalId: String(input.mergeProposalId || nextId("mprop")),
    candidateId: input.candidateId ? String(input.candidateId) : null,
    survivorCustomerId,
    absorbedCustomerId,
    // Backward-compat aliases
    duplicateCustomerId: absorbedCustomerId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    expectedSurvivorVersion,
    expectedAbsorbedVersion,
    profileResolution: normalizeResolutionPlan(input.profileResolution),
    contactResolution: normalizeResolutionPlan(input.contactResolution),
    addressResolution: normalizeResolutionPlan(input.addressResolution),
    consentResolution: normalizeResolutionPlan(input.consentResolution),
    preferenceResolution: normalizeResolutionPlan(input.preferenceResolution),
    linkageResolution: normalizeResolutionPlan(input.linkageResolution),
    conflicts: Object.freeze(
      [...(input.conflicts || [])].map((c) => Object.freeze({ ...c }))
    ),
    matchKinds: Object.freeze(
      Array.isArray(input.matchKinds)
        ? input.matchKinds.map((k) => String(k))
        : []
    ),
    approvalStatus,
    approvalReference: input.approvalReference
      ? String(input.approvalReference)
      : null,
    approvedBy: input.approvedBy ? String(input.approvedBy) : null,
    approvedAt: input.approvedAt ? String(input.approvedAt) : null,
    status,
    createdAt: String(input.createdAt || nowIso),
    updatedAt: String(input.updatedAt || nowIso),
    version:
      Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
  });
}

/**
 * Build an immutable merge proposal contract object.
 * Backward-compatible thin wrapper used by CUSTOMER-01 exports.
 * Runtime execution is available via MergeApplicationService (CUSTOMER-06).
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createCustomerMergeProposal(input = {}) {
  const survivorCustomerId = String(input.survivorCustomerId || "").trim();
  const duplicateCustomerId = String(
    input.duplicateCustomerId || input.absorbedCustomerId || ""
  ).trim();
  const status = String(input.status || CUSTOMER_MERGE_STATUS.CANDIDATE);
  const matchKinds = Array.isArray(input.matchKinds)
    ? Object.freeze(input.matchKinds.map((k) => String(k)))
    : Object.freeze([]);

  // Preserve original thin shape when only foundation fields are provided.
  if (
    input.mergeProposalId == null &&
    input.expectedSurvivorVersion == null &&
    input.profileResolution == null &&
    input.tenantId == null
  ) {
    return Object.freeze({
      survivorCustomerId,
      duplicateCustomerId,
      matchKinds,
      status,
    });
  }

  try {
    const rich = createRichCustomerMergeProposal({
      ...input,
      survivorCustomerId,
      absorbedCustomerId: duplicateCustomerId,
      status,
      matchKinds: [...matchKinds],
    });
    return Object.freeze({
      ...rich,
      survivorCustomerId: rich.survivorCustomerId,
      duplicateCustomerId: rich.absorbedCustomerId,
      matchKinds: rich.matchKinds,
      status: rich.status,
    });
  } catch {
    return Object.freeze({
      survivorCustomerId,
      duplicateCustomerId,
      matchKinds,
      status,
    });
  }
}

/**
 * Immutable merge history record.
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCustomerMergeHistoryRecord(input = {}, deps = {}) {
  const scope = createCustomerScope(input);
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  return Object.freeze({
    mergeHistoryId: String(input.mergeHistoryId || nextId("mhist")),
    mergeProposalId: input.mergeProposalId
      ? String(input.mergeProposalId)
      : null,
    candidateId: input.candidateId ? String(input.candidateId) : null,
    survivorCustomerId: String(input.survivorCustomerId || "").trim(),
    absorbedCustomerId: String(input.absorbedCustomerId || "").trim(),
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    approvalReference: input.approvalReference
      ? String(input.approvalReference)
      : null,
    actorReference: input.actorReference
      ? String(input.actorReference)
      : null,
    survivorVersionAfter:
      input.survivorVersionAfter != null
        ? Number(input.survivorVersionAfter)
        : null,
    absorbedVersionAtMerge:
      input.absorbedVersionAtMerge != null
        ? Number(input.absorbedVersionAtMerge)
        : null,
    resolutionSummary: Object.freeze({ ...(input.resolutionSummary || {}) }),
    reasonCodes: Object.freeze(
      [...(input.reasonCodes || [])].map((r) => String(r))
    ),
    recordedAt: String(input.recordedAt || nowIso),
  });
}
