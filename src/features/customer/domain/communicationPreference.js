/**
 * Communication preference + consent reference contracts (foundation only).
 * No consent governance engine.
 */

import {
  CUSTOMER_COMMUNICATION_CHANNEL,
  isCustomerCommunicationChannel,
} from "../constants/communicationChannels.js";
import {
  CUSTOMER_CONSENT_STATE,
  isCustomerConsentState,
} from "../constants/consentStates.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { optionalOpaqueId, requireOpaqueId } from "./identifiers.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createCommunicationPreference(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Communication preference input must be a plain object."
    );
  }
  const channel = String(input.channel || "");
  if (!isCustomerCommunicationChannel(channel)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Communication channel is invalid.",
      { field: "channel", channel }
    );
  }
  const state = String(input.state || CUSTOMER_CONSENT_STATE.UNKNOWN);
  if (!isCustomerConsentState(state)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Communication preference state is invalid.",
      { field: "state", state }
    );
  }
  const effectiveAt = input.effectiveAt
    ? String(input.effectiveAt)
    : null;
  return Object.freeze({
    preferenceId: requireOpaqueId(input.preferenceId, "preferenceId"),
    channel,
    state,
    effectiveAt,
    sourceReference: optionalOpaqueId(input.sourceReference, "sourceReference"),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createConsentReference(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Consent reference input must be a plain object."
    );
  }
  const channel = String(input.channel || CUSTOMER_COMMUNICATION_CHANNEL.EMAIL);
  if (!isCustomerCommunicationChannel(channel)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Consent channel is invalid.",
      { field: "channel", channel }
    );
  }
  const state = String(input.state || CUSTOMER_CONSENT_STATE.UNKNOWN);
  if (!isCustomerConsentState(state)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Consent state is invalid.",
      { field: "state", state }
    );
  }
  return Object.freeze({
    consentReferenceId: requireOpaqueId(
      input.consentReferenceId ?? input.consentId,
      "consentReferenceId"
    ),
    channel,
    state,
    effectiveAt: input.effectiveAt ? String(input.effectiveAt) : null,
    evidenceReference: optionalOpaqueId(
      input.evidenceReference,
      "evidenceReference"
    ),
    version: input.version != null ? String(input.version) : null,
  });
}
