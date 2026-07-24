/**
 * Fail-closed communication eligibility projector (CUSTOMER-04).
 *
 * Customer Management stores consent and communication preference facts.
 * It does not independently determine legal permission when Platform
 * Governance policy input is required.
 */

import {
  CUSTOMER_COMMUNICATION_CHANNEL,
  isCustomerCommunicationChannel,
} from "../constants/communicationChannels.js";
import {
  CUSTOMER_PURPOSES_REQUIRING_EXPLICIT_CONSENT,
  isCustomerCommunicationPurpose,
} from "../constants/communicationPurposes.js";
import {
  CONTACT_POINT_STATUS,
  CONTACT_POINT_TYPE,
  CONTACT_POINT_VERIFICATION_STATE,
} from "../constants/contactPointTypes.js";
import {
  CUSTOMER_CONSENT_STATUS,
} from "../constants/consentStatuses.js";
import {
  CUSTOMER_COMMUNICATION_ELIGIBILITY,
} from "../constants/eligibilityResults.js";
import {
  CUSTOMER_ELIGIBILITY_REASON,
} from "../constants/eligibilityReasonCodes.js";
import {
  CUSTOMER_PREFERENCE_STATUS,
} from "../constants/preferenceStatuses.js";

/**
 * Map communication channel → contact point type when applicable.
 * @param {string} channel
 * @returns {string|null}
 */
function contactTypeForChannel(channel) {
  if (channel === CUSTOMER_COMMUNICATION_CHANNEL.EMAIL) {
    return CONTACT_POINT_TYPE.EMAIL;
  }
  if (
    channel === CUSTOMER_COMMUNICATION_CHANNEL.SMS ||
    channel === CUSTOMER_COMMUNICATION_CHANNEL.PHONE
  ) {
    return CONTACT_POINT_TYPE.PHONE;
  }
  return null;
}

/**
 * @param {object} input
 * @param {object|null} [input.customer]
 * @param {object|null} [input.consent]
 * @param {object|null} [input.preference]
 * @param {string} input.purpose
 * @param {string} input.channel
 * @param {string} [input.evaluatedAt]
 * @param {boolean} [input.governancePolicyResolved]
 * @param {string|null} [input.requiredPolicyReference]
 * @param {boolean} [input.requireVerifiedContact]
 * @returns {Readonly<object>}
 */
export function evaluateCommunicationEligibility(input = {}) {
  const purpose = String(input.purpose || "").trim();
  const channel = String(input.channel || "").trim();
  const evaluatedAt = String(
    input.evaluatedAt || new Date().toISOString()
  );
  /** @type {string[]} */
  const reasonCodes = [];

  const customer = input.customer || null;
  const customerId = customer?.customerId
    ? String(customer.customerId)
    : input.customerId
      ? String(input.customerId)
      : null;

  if (!isCustomerCommunicationPurpose(purpose)) {
    return freezeEligibility({
      customerId,
      purpose,
      channel,
      eligibility: CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE,
      reasonCodes: [CUSTOMER_ELIGIBILITY_REASON.UNSUPPORTED_COMMUNICATION_PURPOSE],
      evaluatedAt,
      requiredPolicyReference: null,
    });
  }

  if (!isCustomerCommunicationChannel(channel)) {
    return freezeEligibility({
      customerId,
      purpose,
      channel,
      eligibility: CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE,
      reasonCodes: [CUSTOMER_ELIGIBILITY_REASON.UNSUPPORTED_COMMUNICATION_CHANNEL],
      evaluatedAt,
      requiredPolicyReference: null,
    });
  }

  if (!customer) {
    return freezeEligibility({
      customerId,
      purpose,
      channel,
      eligibility: CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE,
      reasonCodes: [CUSTOMER_ELIGIBILITY_REASON.CUSTOMER_NOT_FOUND],
      evaluatedAt,
      requiredPolicyReference: null,
    });
  }

  const contactType = contactTypeForChannel(channel);
  if (contactType) {
    const contacts = Array.isArray(customer.contactPoints)
      ? customer.contactPoints
      : [];
    const matching = contacts.filter((c) => c.type === contactType);
    if (matching.length === 0) {
      reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONTACT_POINT_NOT_FOUND);
    } else {
      const active = matching.filter(
        (c) => (c.status || CONTACT_POINT_STATUS.ACTIVE) === CONTACT_POINT_STATUS.ACTIVE
      );
      if (active.length === 0) {
        reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONTACT_POINT_INACTIVE);
      } else if (
        input.requireVerifiedContact === true ||
        CUSTOMER_PURPOSES_REQUIRING_EXPLICIT_CONSENT.includes(purpose)
      ) {
        const verified = active.some(
          (c) =>
            c.verificationState === CONTACT_POINT_VERIFICATION_STATE.VERIFIED
        );
        if (!verified) {
          reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONTACT_POINT_UNVERIFIED);
        }
      }
    }
  } else if (channel === CUSTOMER_COMMUNICATION_CHANNEL.PUSH) {
    // PUSH has no Customer contact-point type; channel supported but contact gate N/A.
  }

  const preference = input.preference || null;
  if (!preference) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.PREFERENCE_UNSPECIFIED);
  } else if (preference.status === CUSTOMER_PREFERENCE_STATUS.OPTED_OUT) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.PREFERENCE_OPTED_OUT);
  } else if (preference.status === CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.PREFERENCE_UNSPECIFIED);
  }

  const consent = input.consent || null;
  if (!consent) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONSENT_NOT_RECORDED);
  } else if (consent.status === CUSTOMER_CONSENT_STATUS.DENIED) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONSENT_DENIED);
  } else if (consent.status === CUSTOMER_CONSENT_STATUS.REVOKED) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONSENT_REVOKED);
  } else if (consent.status === CUSTOMER_CONSENT_STATUS.EXPIRED) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONSENT_EXPIRED);
  } else if (consent.status === CUSTOMER_CONSENT_STATUS.NOT_RECORDED) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONSENT_NOT_RECORDED);
  } else if (
    consent.status === CUSTOMER_CONSENT_STATUS.GRANTED &&
    consent.expiresAt &&
    evaluatedAt >= String(consent.expiresAt)
  ) {
    reasonCodes.push(CUSTOMER_ELIGIBILITY_REASON.CONSENT_EXPIRED);
  }

  const requiresExplicitConsent =
    CUSTOMER_PURPOSES_REQUIRING_EXPLICIT_CONSENT.includes(purpose);
  const governanceResolved = input.governancePolicyResolved === true;
  const requiredPolicyReference =
    input.requiredPolicyReference != null
      ? String(input.requiredPolicyReference)
      : requiresExplicitConsent
        ? "platform-governance:communication-consent"
        : null;

  if (
    requiresExplicitConsent &&
    !governanceResolved &&
    reasonCodes.length === 0
  ) {
    return freezeEligibility({
      customerId: customer.customerId,
      purpose,
      channel,
      eligibility: CUSTOMER_COMMUNICATION_ELIGIBILITY.REQUIRES_POLICY_DECISION,
      reasonCodes: [CUSTOMER_ELIGIBILITY_REASON.REQUIRES_GOVERNANCE_POLICY],
      evaluatedAt,
      requiredPolicyReference,
    });
  }

  if (reasonCodes.length > 0) {
    return freezeEligibility({
      customerId: customer.customerId,
      purpose,
      channel,
      eligibility: CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE,
      reasonCodes: dedupe(reasonCodes),
      evaluatedAt,
      requiredPolicyReference: requiresExplicitConsent
        ? requiredPolicyReference
        : null,
    });
  }

  // Fail-closed: ELIGIBLE only when preference OPTED_IN and consent GRANTED,
  // and Governance policy gate (if any) already passed above.
  if (
    preference?.status === CUSTOMER_PREFERENCE_STATUS.OPTED_IN &&
    consent?.status === CUSTOMER_CONSENT_STATUS.GRANTED
  ) {
    return freezeEligibility({
      customerId: customer.customerId,
      purpose,
      channel,
      eligibility: CUSTOMER_COMMUNICATION_ELIGIBILITY.ELIGIBLE,
      reasonCodes: Object.freeze([]),
      evaluatedAt,
      requiredPolicyReference: null,
    });
  }

  return freezeEligibility({
    customerId: customer.customerId,
    purpose,
    channel,
    eligibility: CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE,
    reasonCodes: Object.freeze([
      CUSTOMER_ELIGIBILITY_REASON.CONSENT_NOT_RECORDED,
    ]),
    evaluatedAt,
    requiredPolicyReference: null,
  });
}

/**
 * @param {string[]} codes
 */
function dedupe(codes) {
  return Object.freeze([...new Set(codes)]);
}

/**
 * @param {object} view
 */
function freezeEligibility(view) {
  return Object.freeze({
    customerId: view.customerId,
    purpose: view.purpose,
    channel: view.channel,
    eligibility: view.eligibility,
    reasonCodes: Object.freeze([...(view.reasonCodes || [])]),
    evaluatedAt: view.evaluatedAt,
    requiredPolicyReference: view.requiredPolicyReference,
  });
}
