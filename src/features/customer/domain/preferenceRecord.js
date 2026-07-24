/**
 * Customer communication preference record domain (CUSTOMER-04).
 * Preference expresses desire for purpose×channel — not legal consent.
 */

import {
  isCustomerCommunicationChannel,
} from "../constants/communicationChannels.js";
import {
  isCustomerCommunicationPurpose,
} from "../constants/communicationPurposes.js";
import {
  CUSTOMER_CONSENT_SOURCE,
  isCustomerConsentSource,
} from "../constants/consentSources.js";
import {
  CUSTOMER_PREFERENCE_STATUS,
  isCustomerPreferenceStatus,
} from "../constants/preferenceStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { optionalOpaqueId, requireOpaqueId } from "./identifiers.js";
import { createCustomerScope } from "./scope.js";

const PREFERENCE_ID_PREFIX = "cpref";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
function optionalIso(value, field) {
  if (value == null || value === "") return null;
  const s = String(value);
  if (Number.isNaN(Date.parse(s))) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field, value: s }
    );
  }
  return s;
}

/**
 * Uniqueness key for active preference scope.
 * @param {{ customerId: string, purpose: string, channel: string }} parts
 */
export function preferenceScopeKey(parts) {
  return `${parts.customerId}\u0000${parts.purpose}\u0000${parts.channel}`;
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 * @returns {Readonly<object>}
 */
export function createCustomerPreferenceRecord(input = {}, deps = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      "Preference input must be a plain object."
    );
  }

  const scope = createCustomerScope(input);
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  const purpose = String(input.purpose || "").trim();
  if (!isCustomerCommunicationPurpose(purpose)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.UNSUPPORTED_COMMUNICATION_PURPOSE,
      "Unsupported communication purpose.",
      { field: "purpose", purpose }
    );
  }

  const channel = String(input.channel || "").trim();
  if (!isCustomerCommunicationChannel(channel)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.UNSUPPORTED_COMMUNICATION_CHANNEL,
      "Unsupported communication channel.",
      { field: "channel", channel }
    );
  }

  const status = String(
    input.status || CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED
  );
  if (!isCustomerPreferenceStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      "Preference status is invalid.",
      { field: "status", status }
    );
  }

  const source = String(input.source || CUSTOMER_CONSENT_SOURCE.CUSTOMER).trim();
  if (!isCustomerConsentSource(source)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      "Preference source is invalid.",
      { field: "source", source }
    );
  }

  const version = input.version != null ? Number(input.version) : 1;
  if (!Number.isInteger(version) || version < 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      "version must be an integer >= 1.",
      { field: "version", version }
    );
  }

  return Object.freeze({
    preferenceId: requireOpaqueId(
      input.preferenceId ?? nextId(PREFERENCE_ID_PREFIX),
      "preferenceId"
    ),
    customerId: requireOpaqueId(input.customerId, "customerId"),
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    purpose,
    channel,
    status,
    effectiveAt: optionalIso(input.effectiveAt ?? nowIso, "effectiveAt"),
    source,
    actorReference: optionalOpaqueId(input.actorReference, "actorReference"),
    version,
    createdAt: optionalIso(input.createdAt ?? nowIso, "createdAt"),
    updatedAt: optionalIso(input.updatedAt ?? nowIso, "updatedAt"),
  });
}

/**
 * @param {object|null|undefined} current
 * @param {string} nextStatus
 * @param {object} patch
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 * @returns {Readonly<object>}
 */
export function setCustomerPreferenceStatus(
  current,
  nextStatus,
  patch = {},
  deps = {}
) {
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const status = String(nextStatus || "");
  if (!isCustomerPreferenceStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      "Preference status is invalid.",
      { field: "status", status }
    );
  }

  const base = current
    ? { ...current }
    : {
        customerId: patch.customerId,
        tenantId: patch.tenantId,
        venueId: patch.venueId,
        purpose: patch.purpose,
        channel: patch.channel,
        preferenceId: patch.preferenceId,
        source: patch.source,
        actorReference: patch.actorReference,
        createdAt: nowIso,
        version: 0,
      };

  return createCustomerPreferenceRecord(
    {
      ...base,
      ...patch,
      status,
      effectiveAt: patch.effectiveAt ?? nowIso,
      version: (Number(base.version) || 0) + 1,
      updatedAt: nowIso,
    },
    deps
  );
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createCustomerPreferenceHistoryRecord(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      "Preference history input must be a plain object."
    );
  }
  const scope = createCustomerScope(input);
  const sequence = Number(input.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_COMMUNICATION_PREFERENCE,
      "history sequence must be an integer >= 1.",
      { field: "sequence", sequence }
    );
  }
  return Object.freeze({
    historyId: requireOpaqueId(input.historyId, "historyId"),
    preferenceId: requireOpaqueId(input.preferenceId, "preferenceId"),
    customerId: requireOpaqueId(input.customerId, "customerId"),
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    sequence,
    previousStatus: input.previousStatus
      ? String(input.previousStatus)
      : CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED,
    nextStatus: String(input.nextStatus || ""),
    purpose: String(input.purpose || ""),
    channel: String(input.channel || ""),
    effectiveAt: input.effectiveAt ? String(input.effectiveAt) : null,
    source: input.source ? String(input.source) : null,
    actorReference: optionalOpaqueId(input.actorReference, "actorReference"),
    reason: input.reason != null ? String(input.reason).slice(0, 500) : null,
    aggregateVersion: Number(input.aggregateVersion) || 1,
    recordedAt: String(input.recordedAt || new Date().toISOString()),
  });
}
