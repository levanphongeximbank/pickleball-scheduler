/**
 * Merge execution helpers (CUSTOMER-06).
 * In-memory atomic merge steps. Durable path uses customer_execute_merge RPC.
 *
 * No auto-merge. Identity/Player conflicts default BLOCK_MERGE.
 * Consent/preference default to more restrictive state.
 */

import { CUSTOMER_STATUS } from "../constants/customerStatuses.js";
import { CUSTOMER_CONSENT_STATUS } from "../constants/consentStatuses.js";
import { CUSTOMER_PREFERENCE_STATUS } from "../constants/preferenceStatuses.js";
import { CUSTOMER_LINKAGE_TYPE } from "../constants/linkageTypes.js";
import { isActiveCustomerLinkageStatus } from "../constants/linkageStatuses.js";
import {
  CUSTOMER_MERGE_RESOLUTION_ACTION,
} from "../constants/mergeResolutionActions.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { scopesMatch } from "./scope.js";
import {
  CUSTOMER_MERGE_APPROVAL_STATUS,
  CUSTOMER_MERGE_STATUS,
  createCustomerMergeHistoryRecord,
} from "./mergeContract.js";

/**
 * Restrictive consent status: REVOKED/DENIED beat GRANTED; never widen.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {string}
 */
export function mergeRestrictiveConsentStatus(a, b) {
  const rank = {
    [CUSTOMER_CONSENT_STATUS.REVOKED]: 0,
    [CUSTOMER_CONSENT_STATUS.DENIED]: 1,
    [CUSTOMER_CONSENT_STATUS.EXPIRED]: 2,
    [CUSTOMER_CONSENT_STATUS.NOT_RECORDED]: 3,
    [CUSTOMER_CONSENT_STATUS.GRANTED]: 4,
  };
  const left = String(a || CUSTOMER_CONSENT_STATUS.NOT_RECORDED);
  const right = String(b || CUSTOMER_CONSENT_STATUS.NOT_RECORDED);
  const lr = rank[left] ?? 3;
  const rr = rank[right] ?? 3;
  return lr <= rr ? left : right;
}

/**
 * Restrictive preference: OPTED_OUT beats OPTED_IN.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {string}
 */
export function mergeRestrictivePreferenceStatus(a, b) {
  const rank = {
    [CUSTOMER_PREFERENCE_STATUS.OPTED_OUT]: 0,
    [CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED]: 1,
    [CUSTOMER_PREFERENCE_STATUS.OPTED_IN]: 2,
  };
  const left = String(a || CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED);
  const right = String(b || CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED);
  const lr = rank[left] ?? 1;
  const rr = rank[right] ?? 1;
  return lr <= rr ? left : right;
}

/**
 * @param {object} proposal
 */
export function assertMergeProposalExecutable(proposal) {
  if (!proposal) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_FOUND,
      "Merge proposal not found."
    );
  }
  const approved =
    proposal.status === CUSTOMER_MERGE_STATUS.APPROVED ||
    proposal.approvalStatus === CUSTOMER_MERGE_APPROVAL_STATUS.APPROVED;
  if (!approved) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_APPROVED,
      "Merge proposal is not approved.",
      { mergeProposalId: proposal.mergeProposalId, status: proposal.status }
    );
  }
  if (!proposal.approvalReference || !String(proposal.approvalReference).trim()) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MERGE_APPROVAL_REQUIRED,
      "approvalReference is required to execute merge.",
      { mergeProposalId: proposal.mergeProposalId }
    );
  }
}

/**
 * @param {object} survivor
 * @param {object} absorbed
 * @param {object} proposal
 */
export function assertMergePreconditions(survivor, absorbed, proposal) {
  if (!survivor || !absorbed) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.NOT_FOUND,
      "Survivor or absorbed customer not found."
    );
  }
  if (!scopesMatch(survivor, absorbed) || !scopesMatch(survivor, proposal)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.SCOPE_MISMATCH,
      "Merge customers must share the same tenant/venue scope.",
      {
        survivorCustomerId: survivor.customerId,
        absorbedCustomerId: absorbed.customerId,
      }
    );
  }
  if (survivor.status === CUSTOMER_STATUS.MERGED) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CUSTOMER_ALREADY_MERGED,
      "Survivor customer is already merged.",
      { customerId: survivor.customerId }
    );
  }
  if (absorbed.status === CUSTOMER_STATUS.MERGED) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CUSTOMER_ALREADY_MERGED,
      "Absorbed customer is already merged.",
      { customerId: absorbed.customerId }
    );
  }
  if (absorbed.status === CUSTOMER_STATUS.ARCHIVED) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_STATUS_TRANSITION,
      "Archived customers cannot be merged.",
      { customerId: absorbed.customerId }
    );
  }
  if (survivor.customerId === absorbed.customerId) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_MERGE_SURVIVOR,
      "Survivor and absorbed must be distinct."
    );
  }
  if (
    proposal.expectedSurvivorVersion != null &&
    Number(proposal.expectedSurvivorVersion) !== Number(survivor.version)
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_STALE,
      "Survivor version does not match proposal expectation.",
      {
        expected: proposal.expectedSurvivorVersion,
        actual: survivor.version,
      }
    );
  }
  if (
    proposal.expectedAbsorbedVersion != null &&
    Number(proposal.expectedAbsorbedVersion) !== Number(absorbed.version)
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_STALE,
      "Absorbed version does not match proposal expectation.",
      {
        expected: proposal.expectedAbsorbedVersion,
        actual: absorbed.version,
      }
    );
  }
}

/**
 * @param {object} survivor
 * @param {object} absorbed
 * @param {object} proposal
 * @returns {object}
 */
export function resolveMergedProfile(survivor, absorbed, proposal) {
  const plan = proposal.profileResolution || {};
  const take = (field) =>
    plan[field] === CUSTOMER_MERGE_RESOLUTION_ACTION.TAKE_ABSORBED;

  if (plan.default === CUSTOMER_MERGE_RESOLUTION_ACTION.BLOCK_MERGE) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.MERGE_POLICY_DECISION_REQUIRED,
      "Profile resolution blocks merge.",
      { field: "profileResolution" }
    );
  }

  return Object.freeze({
    displayName: take("displayName")
      ? absorbed.displayName
      : survivor.displayName,
    legalName: take("legalName") ? absorbed.legalName : survivor.legalName,
    locale: take("locale") ? absorbed.locale : survivor.locale,
    individualProfile: take("individualProfile")
      ? absorbed.individualProfile
      : survivor.individualProfile,
    organizationProfile: take("organizationProfile")
      ? absorbed.organizationProfile
      : survivor.organizationProfile,
  });
}

/**
 * @param {readonly object[]} survivorContacts
 * @param {readonly object[]} absorbedContacts
 * @param {object} proposal
 * @param {{ nowIso: () => string, nextId: (prefix: string) => string }} deps
 */
export function transferContacts(
  survivorContacts,
  absorbedContacts,
  proposal,
  deps
) {
  const plan = proposal.contactResolution || {};
  if (plan.default === CUSTOMER_MERGE_RESOLUTION_ACTION.BLOCK_MERGE) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONTACT_MERGE_CONFLICT,
      "Contact resolution blocks merge."
    );
  }

  const now = deps.nowIso();
  /** @type {object[]} */
  const result = [...(survivorContacts || [])].map((c) => ({ ...c }));
  const normalized = new Set(
    result.map((c) => `${c.type}|${c.normalizedValue || c.value}`)
  );

  let survivorHasPrimaryEmail = result.some(
    (c) => c.type === "EMAIL" && c.primary === true
  );
  let survivorHasPrimaryPhone = result.some(
    (c) => c.type === "PHONE" && c.primary === true
  );

  for (const contact of absorbedContacts || []) {
    const key = `${contact.type}|${contact.normalizedValue || contact.value}`;
    if (normalized.has(key)) {
      // DROP_DUPLICATE
      continue;
    }
    let primary = contact.primary === true;
    if (contact.type === "EMAIL" && primary && survivorHasPrimaryEmail) {
      primary = false;
    }
    if (contact.type === "PHONE" && primary && survivorHasPrimaryPhone) {
      primary = false;
    }
    if (
      plan.primary === CUSTOMER_MERGE_RESOLUTION_ACTION.TAKE_ABSORBED &&
      contact.primary === true
    ) {
      if (contact.type === "EMAIL") {
        for (const c of result) {
          if (c.type === "EMAIL") c.primary = false;
        }
        primary = true;
        survivorHasPrimaryEmail = true;
      }
      if (contact.type === "PHONE") {
        for (const c of result) {
          if (c.type === "PHONE") c.primary = false;
        }
        primary = true;
        survivorHasPrimaryPhone = true;
      }
    } else if (primary) {
      if (contact.type === "EMAIL") survivorHasPrimaryEmail = true;
      if (contact.type === "PHONE") survivorHasPrimaryPhone = true;
    }

    result.push({
      ...contact,
      contactPointId: deps.nextId("cp"),
      primary,
      updatedAt: now,
      createdAt: contact.createdAt || now,
    });
    normalized.add(key);
  }

  return Object.freeze(result.map((c) => Object.freeze({ ...c })));
}

/**
 * @param {readonly object[]} survivorAddresses
 * @param {readonly object[]} absorbedAddresses
 * @param {object} proposal
 * @param {{ nowIso: () => string, nextId: (prefix: string) => string }} deps
 */
export function transferAddresses(
  survivorAddresses,
  absorbedAddresses,
  proposal,
  deps
) {
  const plan = proposal.addressResolution || {};
  if (plan.default === CUSTOMER_MERGE_RESOLUTION_ACTION.BLOCK_MERGE) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Address resolution blocks merge."
    );
  }

  const now = deps.nowIso();
  /** @type {object[]} */
  const result = [...(survivorAddresses || [])].map((a) => ({ ...a }));
  const keys = new Set(
    result.map(
      (a) =>
        `${a.countryCode}|${a.adminArea}|${a.locality}|${a.postalCode}|${a.addressLine1}`
          .toLowerCase()
    )
  );
  let hasPrimary = result.some((a) => a.primary === true);

  for (const address of absorbedAddresses || []) {
    const key =
      `${address.countryCode}|${address.adminArea}|${address.locality}|${address.postalCode}|${address.addressLine1}`
        .toLowerCase();
    if (keys.has(key)) continue;
    let primary = address.primary === true;
    if (primary && hasPrimary) {
      if (plan.primary === CUSTOMER_MERGE_RESOLUTION_ACTION.TAKE_ABSORBED) {
        for (const a of result) a.primary = false;
        primary = true;
        hasPrimary = true;
      } else {
        primary = false;
      }
    } else if (primary) {
      hasPrimary = true;
    }
    result.push({
      ...address,
      addressId: deps.nextId("addr"),
      primary,
      updatedAt: now,
      createdAt: address.createdAt || now,
    });
    keys.add(key);
  }

  return Object.freeze(result.map((a) => Object.freeze({ ...a })));
}

/**
 * @param {object[]} survivorConsents
 * @param {object[]} absorbedConsents
 * @param {object} proposal
 * @param {string} survivorCustomerId
 * @param {{ nowIso: () => string, nextId: (prefix: string) => string }} deps
 */
export function mergeConsentCurrentState(
  survivorConsents,
  absorbedConsents,
  proposal,
  survivorCustomerId,
  deps
) {
  const plan = proposal.consentResolution || {};
  if (plan.default === CUSTOMER_MERGE_RESOLUTION_ACTION.BLOCK_MERGE) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONSENT_MERGE_CONFLICT,
      "Consent resolution blocks merge."
    );
  }

  const now = deps.nowIso();
  /** @type {Map<string, object>} */
  const byKey = new Map();
  for (const c of survivorConsents || []) {
    const key = `${c.purpose}|${c.channel ?? ""}`;
    byKey.set(key, { ...c });
  }

  /** @type {object[]} */
  const transferred = [];

  for (const c of absorbedConsents || []) {
    const key = `${c.purpose}|${c.channel ?? ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      const next = {
        ...c,
        consentId: deps.nextId("cns"),
        customerId: survivorCustomerId,
        updatedAt: now,
        version: 1,
      };
      byKey.set(key, next);
      transferred.push(next);
      continue;
    }
    const restrictive = mergeRestrictiveConsentStatus(
      existing.status,
      c.status
    );
    if (restrictive !== existing.status) {
      const next = {
        ...existing,
        status: restrictive,
        updatedAt: now,
        version: (existing.version || 1) + 1,
      };
      byKey.set(key, next);
    }
  }

  return Object.freeze({
    consents: Object.freeze([...byKey.values()].map((c) => Object.freeze(c))),
    transferred: Object.freeze(transferred.map((c) => Object.freeze(c))),
  });
}

/**
 * @param {object[]} survivorPrefs
 * @param {object[]} absorbedPrefs
 * @param {object} proposal
 * @param {string} survivorCustomerId
 * @param {{ nowIso: () => string, nextId: (prefix: string) => string }} deps
 */
export function mergePreferenceCurrentState(
  survivorPrefs,
  absorbedPrefs,
  proposal,
  survivorCustomerId,
  deps
) {
  const plan = proposal.preferenceResolution || {};
  if (plan.default === CUSTOMER_MERGE_RESOLUTION_ACTION.BLOCK_MERGE) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.PREFERENCE_MERGE_CONFLICT,
      "Preference resolution blocks merge."
    );
  }

  const now = deps.nowIso();
  /** @type {Map<string, object>} */
  const byKey = new Map();
  for (const p of survivorPrefs || []) {
    const key = `${p.purpose}|${p.channel}`;
    byKey.set(key, { ...p });
  }

  /** @type {object[]} */
  const transferred = [];

  for (const p of absorbedPrefs || []) {
    const key = `${p.purpose}|${p.channel}`;
    const existing = byKey.get(key);
    if (!existing) {
      const next = {
        ...p,
        preferenceId: deps.nextId("pref"),
        customerId: survivorCustomerId,
        updatedAt: now,
        version: 1,
      };
      byKey.set(key, next);
      transferred.push(next);
      continue;
    }
    const restrictive = mergeRestrictivePreferenceStatus(
      existing.status,
      p.status
    );
    if (restrictive !== existing.status) {
      byKey.set(key, {
        ...existing,
        status: restrictive,
        updatedAt: now,
        version: (existing.version || 1) + 1,
      });
    }
  }

  return Object.freeze({
    preferences: Object.freeze([...byKey.values()].map((p) => Object.freeze(p))),
    transferred: Object.freeze(transferred.map((p) => Object.freeze(p))),
  });
}

/**
 * Linkage merge plan. Identity/Player conflict → BLOCK by default.
 *
 * @param {object[]} survivorLinkages
 * @param {object[]} absorbedLinkages
 * @param {object} proposal
 * @param {string} survivorCustomerId
 * @param {{ nowIso: () => string, nextId: (prefix: string) => string }} deps
 */
export function transferLinkages(
  survivorLinkages,
  absorbedLinkages,
  proposal,
  survivorCustomerId,
  deps
) {
  const plan = proposal.linkageResolution || {};
  const now = deps.nowIso();

  const activeSurvivor = (survivorLinkages || []).filter((l) =>
    isActiveCustomerLinkageStatus(l.status)
  );
  const activeAbsorbed = (absorbedLinkages || []).filter((l) =>
    isActiveCustomerLinkageStatus(l.status)
  );

  function activeOfType(list, type) {
    return list.filter((l) => l.linkageType === type);
  }

  for (const type of [
    CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT,
    CUSTOMER_LINKAGE_TYPE.PLAYER,
  ]) {
    const s = activeOfType(activeSurvivor, type);
    const a = activeOfType(activeAbsorbed, type);
    if (s.length > 0 && a.length > 0) {
      const same = s.some((x) =>
        a.some((y) => x.externalReferenceId === y.externalReferenceId)
      );
      if (!same) {
        const action =
          plan[type] ||
          plan.default ||
          CUSTOMER_MERGE_RESOLUTION_ACTION.BLOCK_MERGE;
        if (action === CUSTOMER_MERGE_RESOLUTION_ACTION.BLOCK_MERGE) {
          throwCustomerError(
            type === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT
              ? CUSTOMER_ERROR_CODES.IDENTITY_MERGE_CONFLICT
              : CUSTOMER_ERROR_CODES.PLAYER_MERGE_CONFLICT,
            `Cannot merge customers with different active ${type} linkages.`,
            { linkageType: type }
          );
        }
        if (action === CUSTOMER_MERGE_RESOLUTION_ACTION.REQUIRE_MANUAL_RESOLUTION) {
          throwCustomerError(
            CUSTOMER_ERROR_CODES.MERGE_POLICY_DECISION_REQUIRED,
            `${type} linkage requires manual resolution.`,
            { linkageType: type }
          );
        }
      }
    }
  }

  /** @type {object[]} */
  const transferred = [];
  /** @type {object[]} */
  const dropped = [];

  for (const link of activeAbsorbed) {
    const sameOnSurvivor = activeSurvivor.find(
      (s) =>
        s.linkageType === link.linkageType &&
        s.externalReferenceId === link.externalReferenceId &&
        s.externalSystem === link.externalSystem
    );
    if (sameOnSurvivor) {
      dropped.push(link);
      continue;
    }

    if (
      (link.linkageType === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT ||
        link.linkageType === CUSTOMER_LINKAGE_TYPE.PLAYER) &&
      activeOfType(activeSurvivor, link.linkageType).length > 0
    ) {
      // Conflict already handled above; remaining means KEEP_SURVIVOR → drop absorbed
      dropped.push(link);
      continue;
    }

    transferred.push(
      Object.freeze({
        ...link,
        linkageId: deps.nextId("lnk"),
        customerId: survivorCustomerId,
        updatedAt: now,
        version: 1,
      })
    );
  }

  return Object.freeze({
    transferred: Object.freeze(transferred),
    dropped: Object.freeze(dropped.map((d) => Object.freeze({ ...d }))),
  });
}

/**
 * Build survivor + absorbed customer snapshots after merge (domain-only).
 *
 * @param {object} args
 * @param {{ nowIso: () => string, nextId: (prefix: string) => string }} deps
 */
export function buildMergeResultSnapshots(args, deps) {
  const {
    survivor,
    absorbed,
    proposal,
    consentsSurvivor = [],
    consentsAbsorbed = [],
    preferencesSurvivor = [],
    preferencesAbsorbed = [],
    linkagesSurvivor = [],
    linkagesAbsorbed = [],
  } = args;

  assertMergeProposalExecutable(proposal);
  assertMergePreconditions(survivor, absorbed, proposal);

  const now = deps.nowIso();
  const profile = resolveMergedProfile(survivor, absorbed, proposal);
  const contactPoints = transferContacts(
    survivor.contactPoints,
    absorbed.contactPoints,
    proposal,
    deps
  );
  const addresses = transferAddresses(
    survivor.addresses,
    absorbed.addresses,
    proposal,
    deps
  );
  const consentMerge = mergeConsentCurrentState(
    consentsSurvivor,
    consentsAbsorbed,
    proposal,
    survivor.customerId,
    deps
  );
  const preferenceMerge = mergePreferenceCurrentState(
    preferencesSurvivor,
    preferencesAbsorbed,
    proposal,
    survivor.customerId,
    deps
  );
  const linkageMerge = transferLinkages(
    linkagesSurvivor,
    linkagesAbsorbed,
    proposal,
    survivor.customerId,
    deps
  );

  const mergeHistoryId = deps.nextId("mhist");
  const survivorNext = Object.freeze({
    ...survivor,
    ...profile,
    contactPoints,
    addresses,
    updatedAt: now,
    version: survivor.version + 1,
  });

  const absorbedNext = Object.freeze({
    ...absorbed,
    status: CUSTOMER_STATUS.MERGED,
    mergedIntoCustomerId: survivor.customerId,
    mergedAt: now,
    mergeHistoryId,
    mergeProposalId: proposal.mergeProposalId || null,
    updatedAt: now,
    version: absorbed.version + 1,
  });

  const history = createCustomerMergeHistoryRecord(
    {
      mergeHistoryId,
      mergeProposalId: proposal.mergeProposalId,
      candidateId: proposal.candidateId,
      survivorCustomerId: survivor.customerId,
      absorbedCustomerId: absorbed.customerId,
      tenantId: survivor.tenantId,
      venueId: survivor.venueId,
      approvalReference: proposal.approvalReference,
      actorReference: proposal.approvedBy,
      survivorVersionAfter: survivorNext.version,
      absorbedVersionAtMerge: absorbed.version,
      resolutionSummary: {
        contactsTransferred:
          contactPoints.length - (survivor.contactPoints || []).length,
        addressesTransferred:
          addresses.length - (survivor.addresses || []).length,
        linkagesTransferred: linkageMerge.transferred.length,
        linkagesDropped: linkageMerge.dropped.length,
      },
      reasonCodes: ["MERGE_COMPLETED"],
      recordedAt: now,
    },
    deps
  );

  return Object.freeze({
    survivor: survivorNext,
    absorbed: absorbedNext,
    history,
    consents: consentMerge.consents,
    preferences: preferenceMerge.preferences,
    transferredConsents: consentMerge.transferred,
    transferredPreferences: preferenceMerge.transferred,
    transferredLinkages: linkageMerge.transferred,
    droppedLinkages: linkageMerge.dropped,
  });
}
