/**
 * Duplicate signal detection + classification (CUSTOMER-06).
 * Rule-based and deterministic. Matching contact/name is evidence only.
 */

import { CONTACT_POINT_TYPE } from "../constants/contactPointTypes.js";
import {
  CUSTOMER_DUPLICATE_CLASSIFICATION,
} from "../constants/duplicateClassifications.js";
import {
  CUSTOMER_DUPLICATE_SIGNAL,
  CUSTOMER_MODERATE_DUPLICATE_SIGNALS,
  CUSTOMER_STRONG_DUPLICATE_SIGNALS,
  CUSTOMER_WEAK_DUPLICATE_SIGNALS,
  duplicateSignalStrength,
} from "../constants/duplicateSignals.js";
import { CUSTOMER_LINKAGE_TYPE } from "../constants/linkageTypes.js";
import { isActiveCustomerLinkageStatus } from "../constants/linkageStatuses.js";
import { buildAddressMatchKey } from "./searchQuery.js";

/**
 * @param {object} customer
 * @param {string} type
 * @returns {string[]}
 */
function activeContactValues(customer, type) {
  return (customer.contactPoints || [])
    .filter(
      (c) =>
        c &&
        String(c.type || "").toUpperCase() === type &&
        String(c.status || "ACTIVE").toUpperCase() !== "INACTIVE"
    )
    .map((c) => String(c.normalizedValue || c.value || "").trim())
    .filter(Boolean);
}

/**
 * @param {readonly object[]|undefined} linkages
 * @param {string} linkageType
 * @returns {object[]}
 */
function activeLinkagesOfType(linkages, linkageType) {
  return (linkages || []).filter(
    (l) =>
      l &&
      l.linkageType === linkageType &&
      isActiveCustomerLinkageStatus(l.status)
  );
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function namesEqual(a, b) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  return Boolean(left) && left === right;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function partialNameMatch(a, b) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  if (!left || !right || left === right) return false;
  const tokensA = left.split(/\s+/).filter((t) => t.length >= 2);
  const tokensB = new Set(right.split(/\s+/).filter((t) => t.length >= 2));
  if (tokensA.length === 0 || tokensB.size === 0) return false;
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared += 1;
  }
  return shared >= 1 && shared < Math.min(tokensA.length, tokensB.size);
}

/**
 * Collect duplicate signals between two customers.
 *
 * @param {object} customerA
 * @param {object} customerB
 * @param {{ linkagesA?: object[], linkagesB?: object[] }} [context]
 * @returns {readonly object[]}
 */
export function collectDuplicateSignals(customerA, customerB, context = {}) {
  /** @type {object[]} */
  const signals = [];
  const linkagesA = context.linkagesA || [];
  const linkagesB = context.linkagesB || [];

  const identityA = activeLinkagesOfType(
    linkagesA,
    CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT
  );
  const identityB = activeLinkagesOfType(
    linkagesB,
    CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT
  );
  const playerA = activeLinkagesOfType(linkagesA, CUSTOMER_LINKAGE_TYPE.PLAYER);
  const playerB = activeLinkagesOfType(linkagesB, CUSTOMER_LINKAGE_TYPE.PLAYER);
  const crmA = activeLinkagesOfType(linkagesA, CUSTOMER_LINKAGE_TYPE.CRM_CONTACT);
  const crmB = activeLinkagesOfType(linkagesB, CUSTOMER_LINKAGE_TYPE.CRM_CONTACT);

  const sameIdentity = identityA.some((a) =>
    identityB.some((b) => a.externalReferenceId === b.externalReferenceId)
  );
  if (sameIdentity) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_ACTIVE_IDENTITY,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_ACTIVE_IDENTITY
        ),
      })
    );
  }

  const samePlayer = playerA.some((a) =>
    playerB.some((b) => a.externalReferenceId === b.externalReferenceId)
  );
  if (samePlayer) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_ACTIVE_PLAYER,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_ACTIVE_PLAYER
        ),
      })
    );
  }

  const sameCrm = crmA.some((a) =>
    crmB.some(
      (b) =>
        a.externalReferenceId === b.externalReferenceId &&
        a.externalSystem === b.externalSystem
    )
  );
  if (sameCrm) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_TRUSTED_CRM_REF,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_TRUSTED_CRM_REF
        ),
      })
    );
  }

  const emailsA = new Set(activeContactValues(customerA, CONTACT_POINT_TYPE.EMAIL));
  const emailsB = new Set(activeContactValues(customerB, CONTACT_POINT_TYPE.EMAIL));
  const sameEmail = [...emailsA].some((e) => emailsB.has(e));
  if (sameEmail) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_EMAIL,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_EMAIL
        ),
      })
    );
  }

  const phonesA = new Set(activeContactValues(customerA, CONTACT_POINT_TYPE.PHONE));
  const phonesB = new Set(activeContactValues(customerB, CONTACT_POINT_TYPE.PHONE));
  const samePhone = [...phonesA].some((p) => phonesB.has(p));
  if (samePhone) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_PHONE,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_PHONE
        ),
      })
    );
  }

  if (namesEqual(customerA.legalName, customerB.legalName)) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_LEGAL_NAME,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_LEGAL_NAME
        ),
      })
    );
  }

  if (namesEqual(customerA.displayName, customerB.displayName)) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_DISPLAY_NAME,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_DISPLAY_NAME
        ),
      })
    );
  }

  const orgA = customerA.organizationProfile?.organizationName;
  const orgB = customerB.organizationProfile?.organizationName;
  if (namesEqual(orgA, orgB)) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_ORG_NAME,
        strength: duplicateSignalStrength(CUSTOMER_DUPLICATE_SIGNAL.SAME_ORG_NAME),
      })
    );
  }

  const keysA = new Set(
    (customerA.addresses || [])
      .map((a) => buildAddressMatchKey(a))
      .filter(Boolean)
  );
  const keysB = new Set(
    (customerB.addresses || [])
      .map((a) => buildAddressMatchKey(a))
      .filter(Boolean)
  );
  if ([...keysA].some((k) => keysB.has(k))) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_ADDRESS_KEY,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.SAME_ADDRESS_KEY
        ),
      })
    );
  }

  const moderateCodes = new Set(
    signals
      .map((s) => s.code)
      .filter((c) => CUSTOMER_MODERATE_DUPLICATE_SIGNALS.includes(c))
  );
  const corroborating = [...moderateCodes].filter(
    (c) =>
      c !== CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_EMAIL &&
      c !== CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_PHONE
  );

  if (
    sameEmail &&
    (corroborating.length > 0 ||
      moderateCodes.has(CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_PHONE))
  ) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.EMAIL_PLUS_CORROBORATION,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.EMAIL_PLUS_CORROBORATION
        ),
      })
    );
  }

  if (
    samePhone &&
    (corroborating.length > 0 ||
      moderateCodes.has(CUSTOMER_DUPLICATE_SIGNAL.SAME_NORMALIZED_EMAIL))
  ) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.PHONE_PLUS_CORROBORATION,
        strength: duplicateSignalStrength(
          CUSTOMER_DUPLICATE_SIGNAL.PHONE_PLUS_CORROBORATION
        ),
      })
    );
  }

  if (
    partialNameMatch(customerA.displayName, customerB.displayName) ||
    partialNameMatch(customerA.legalName, customerB.legalName)
  ) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.PARTIAL_NAME,
        strength: duplicateSignalStrength(CUSTOMER_DUPLICATE_SIGNAL.PARTIAL_NAME),
      })
    );
  }

  if (
    customerA.locale &&
    customerB.locale &&
    String(customerA.locale).toLowerCase() ===
      String(customerB.locale).toLowerCase()
  ) {
    signals.push(
      Object.freeze({
        code: CUSTOMER_DUPLICATE_SIGNAL.SAME_LOCALE,
        strength: duplicateSignalStrength(CUSTOMER_DUPLICATE_SIGNAL.SAME_LOCALE),
      })
    );
  }

  return Object.freeze(signals);
}

/**
 * Detect Identity / Player conflicts between two customers.
 * @param {{ linkagesA?: object[], linkagesB?: object[] }} context
 * @returns {readonly object[]}
 */
export function collectDuplicateConflicts(context = {}) {
  const linkagesA = context.linkagesA || [];
  const linkagesB = context.linkagesB || [];
  /** @type {object[]} */
  const conflicts = [];

  const identityA = activeLinkagesOfType(
    linkagesA,
    CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT
  );
  const identityB = activeLinkagesOfType(
    linkagesB,
    CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT
  );
  if (
    identityA.length > 0 &&
    identityB.length > 0 &&
    !identityA.some((a) =>
      identityB.some((b) => a.externalReferenceId === b.externalReferenceId)
    )
  ) {
    conflicts.push(
      Object.freeze({
        type: "IDENTITY",
        code: "DIFFERENT_ACTIVE_IDENTITY",
        reason: "Both customers have different active Identity linkages.",
      })
    );
  }

  const playerA = activeLinkagesOfType(linkagesA, CUSTOMER_LINKAGE_TYPE.PLAYER);
  const playerB = activeLinkagesOfType(linkagesB, CUSTOMER_LINKAGE_TYPE.PLAYER);
  if (
    playerA.length > 0 &&
    playerB.length > 0 &&
    !playerA.some((a) =>
      playerB.some((b) => a.externalReferenceId === b.externalReferenceId)
    )
  ) {
    conflicts.push(
      Object.freeze({
        type: "PLAYER",
        code: "DIFFERENT_ACTIVE_PLAYER",
        reason: "Both customers have different active Player linkages.",
      })
    );
  }

  return Object.freeze(conflicts);
}

/**
 * Classify a customer pair from signals + conflicts.
 *
 * @param {readonly object[]} signals
 * @param {readonly object[]} conflicts
 * @returns {{ classification: string, reasonCodes: readonly string[], score: number }}
 */
export function classifyDuplicatePair(signals = [], conflicts = []) {
  const codes = (signals || []).map((s) => s.code);
  const reasonCodes = [];
  const conflictTypes = new Set((conflicts || []).map((c) => c.type));

  if (conflictTypes.has("IDENTITY")) {
    reasonCodes.push("CONFLICTING_ACTIVE_IDENTITY");
    return Object.freeze({
      classification: CUSTOMER_DUPLICATE_CLASSIFICATION.CONFLICTING_IDENTITIES,
      reasonCodes: Object.freeze(reasonCodes),
      score: 0,
    });
  }

  if (conflictTypes.has("PLAYER")) {
    reasonCodes.push("CONFLICTING_ACTIVE_PLAYER");
    return Object.freeze({
      classification: CUSTOMER_DUPLICATE_CLASSIFICATION.REQUIRES_MANUAL_REVIEW,
      reasonCodes: Object.freeze([
        ...reasonCodes,
        "PLAYER_CONFLICT_REQUIRES_REVIEW",
      ]),
      score: 10,
    });
  }

  if (
    codes.includes(CUSTOMER_DUPLICATE_SIGNAL.SAME_ACTIVE_IDENTITY) ||
    codes.includes(CUSTOMER_DUPLICATE_SIGNAL.SAME_ACTIVE_PLAYER) ||
    codes.includes(CUSTOMER_DUPLICATE_SIGNAL.SAME_TRUSTED_CRM_REF)
  ) {
    reasonCodes.push("EXACT_EXTERNAL_REFERENCE");
    return Object.freeze({
      classification: CUSTOMER_DUPLICATE_CLASSIFICATION.EXACT_REFERENCE_MATCH,
      reasonCodes: Object.freeze(reasonCodes),
      score: 100,
    });
  }

  const hasStrong = codes.some((c) =>
    CUSTOMER_STRONG_DUPLICATE_SIGNALS.includes(c)
  );
  if (hasStrong) {
    reasonCodes.push("STRONG_SIGNAL_PRESENT");
    return Object.freeze({
      classification:
        CUSTOMER_DUPLICATE_CLASSIFICATION.STRONG_DUPLICATE_CANDIDATE,
      reasonCodes: Object.freeze(reasonCodes),
      score: 80,
    });
  }

  const hasModerate = codes.some((c) =>
    CUSTOMER_MODERATE_DUPLICATE_SIGNALS.includes(c)
  );
  if (hasModerate) {
    reasonCodes.push("MODERATE_SIGNAL_PRESENT");
    return Object.freeze({
      classification: CUSTOMER_DUPLICATE_CLASSIFICATION.POSSIBLE_DUPLICATE,
      reasonCodes: Object.freeze(reasonCodes),
      score: 50,
    });
  }

  const hasWeak = codes.some((c) => CUSTOMER_WEAK_DUPLICATE_SIGNALS.includes(c));
  if (hasWeak) {
    reasonCodes.push("WEAK_SIGNAL_ONLY");
    return Object.freeze({
      classification: CUSTOMER_DUPLICATE_CLASSIFICATION.INSUFFICIENT_EVIDENCE,
      reasonCodes: Object.freeze(reasonCodes),
      score: 20,
    });
  }

  reasonCodes.push("NO_MATCHING_SIGNALS");
  return Object.freeze({
    classification: CUSTOMER_DUPLICATE_CLASSIFICATION.NOT_DUPLICATE,
    reasonCodes: Object.freeze(reasonCodes),
    score: 0,
  });
}

/**
 * Evaluate a pair end-to-end.
 *
 * @param {object} customerA
 * @param {object} customerB
 * @param {{ linkagesA?: object[], linkagesB?: object[] }} [context]
 */
export function evaluateCustomerPair(customerA, customerB, context = {}) {
  const signals = collectDuplicateSignals(customerA, customerB, context);
  const conflicts = collectDuplicateConflicts(context);
  const classified = classifyDuplicatePair(signals, conflicts);
  return Object.freeze({
    signals,
    conflicts,
    classification: classified.classification,
    reasonCodes: classified.reasonCodes,
    score: classified.score,
  });
}
