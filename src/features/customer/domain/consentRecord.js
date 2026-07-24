/**
 * Customer consent record domain (CUSTOMER-04).
 * Business facts only — not a legal-policy engine.
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
  CUSTOMER_CONSENT_STATUS,
  isCustomerConsentStatus,
} from "../constants/consentStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { optionalOpaqueId, requireOpaqueId } from "./identifiers.js";
import { createCustomerScope } from "./scope.js";

const CONSENT_ID_PREFIX = "cns";

/**
 * Allowed transitions for current consent status.
 * NOT_RECORDED is the virtual absence state (no row) — not stored as current.
 */
export const CUSTOMER_CONSENT_ALLOWED_TRANSITIONS = Object.freeze({
  [CUSTOMER_CONSENT_STATUS.GRANTED]: Object.freeze([
    CUSTOMER_CONSENT_STATUS.REVOKED,
    CUSTOMER_CONSENT_STATUS.EXPIRED,
    CUSTOMER_CONSENT_STATUS.DENIED,
  ]),
  [CUSTOMER_CONSENT_STATUS.DENIED]: Object.freeze([
    CUSTOMER_CONSENT_STATUS.GRANTED,
    CUSTOMER_CONSENT_STATUS.REVOKED,
  ]),
  [CUSTOMER_CONSENT_STATUS.REVOKED]: Object.freeze([
    CUSTOMER_CONSENT_STATUS.GRANTED,
    CUSTOMER_CONSENT_STATUS.DENIED,
  ]),
  [CUSTOMER_CONSENT_STATUS.EXPIRED]: Object.freeze([
    CUSTOMER_CONSENT_STATUS.GRANTED,
    CUSTOMER_CONSENT_STATUS.DENIED,
  ]),
  [CUSTOMER_CONSENT_STATUS.NOT_RECORDED]: Object.freeze([
    CUSTOMER_CONSENT_STATUS.GRANTED,
    CUSTOMER_CONSENT_STATUS.DENIED,
  ]),
});

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isAllowedCustomerConsentTransition(from, to) {
  const allowed = CUSTOMER_CONSENT_ALLOWED_TRANSITIONS[String(from || "")] || [];
  return allowed.includes(String(to || ""));
}

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
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field, value: s }
    );
  }
  return s;
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 * @returns {Readonly<object>}
 */
export function createCustomerConsentRecord(input = {}, deps = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "Consent input must be a plain object."
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

  const channel =
    input.channel == null || input.channel === ""
      ? null
      : String(input.channel).trim();
  if (channel != null && !isCustomerCommunicationChannel(channel)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.UNSUPPORTED_COMMUNICATION_CHANNEL,
      "Unsupported communication channel.",
      { field: "channel", channel }
    );
  }

  const status = String(input.status || CUSTOMER_CONSENT_STATUS.NOT_RECORDED);
  if (!isCustomerConsentStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "Consent status is invalid.",
      { field: "status", status }
    );
  }
  if (status === CUSTOMER_CONSENT_STATUS.NOT_RECORDED) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "NOT_RECORDED is not a storable current-state status.",
      { field: "status", status }
    );
  }

  const effectiveAt = optionalIso(input.effectiveAt ?? nowIso, "effectiveAt");
  const expiresAt = optionalIso(input.expiresAt, "expiresAt");
  const revokedAt = optionalIso(input.revokedAt, "revokedAt");
  const capturedAt = optionalIso(input.capturedAt ?? nowIso, "capturedAt");

  if (expiresAt && effectiveAt && expiresAt <= effectiveAt) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "expiresAt must be after effectiveAt.",
      { field: "expiresAt" }
    );
  }

  if (status === CUSTOMER_CONSENT_STATUS.REVOKED && !revokedAt) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "revokedAt is required when status is REVOKED.",
      { field: "revokedAt" }
    );
  }
  if (status !== CUSTOMER_CONSENT_STATUS.REVOKED && revokedAt) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "revokedAt is only valid for REVOKED status.",
      { field: "revokedAt" }
    );
  }

  const source = String(input.source || CUSTOMER_CONSENT_SOURCE.CUSTOMER).trim();
  if (!isCustomerConsentSource(source)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "Consent source is invalid.",
      { field: "source", source }
    );
  }

  const evidenceReference = optionalOpaqueId(
    input.evidenceReference,
    "evidenceReference"
  );
  if (
    status === CUSTOMER_CONSENT_STATUS.GRANTED &&
    !evidenceReference
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONSENT_EVIDENCE_REQUIRED,
      "evidenceReference is required when granting consent.",
      { field: "evidenceReference" }
    );
  }

  const version =
    input.version != null ? Number(input.version) : 1;
  if (!Number.isInteger(version) || version < 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "version must be an integer >= 1.",
      { field: "version", version }
    );
  }

  return Object.freeze({
    consentId: requireOpaqueId(
      input.consentId ?? nextId(CONSENT_ID_PREFIX),
      "consentId"
    ),
    customerId: requireOpaqueId(input.customerId, "customerId"),
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    purpose,
    channel,
    status,
    effectiveAt,
    expiresAt,
    revokedAt,
    source,
    evidenceReference,
    actorReference: optionalOpaqueId(input.actorReference, "actorReference"),
    capturedAt,
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
export function transitionCustomerConsent(current, nextStatus, patch = {}, deps = {}) {
  const from = current?.status || CUSTOMER_CONSENT_STATUS.NOT_RECORDED;
  const to = String(nextStatus || "");
  if (!isAllowedCustomerConsentTransition(from, to)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT_TRANSITION,
      `Invalid consent transition from ${from} to ${to}.`,
      { from, to, consentId: current?.consentId }
    );
  }
  if (
    from === CUSTOMER_CONSENT_STATUS.REVOKED &&
    to === CUSTOMER_CONSENT_STATUS.REVOKED
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONSENT_ALREADY_REVOKED,
      "Consent is already revoked.",
      { consentId: current?.consentId }
    );
  }

  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();

  const base = current
    ? { ...current }
    : {
        customerId: patch.customerId,
        tenantId: patch.tenantId,
        venueId: patch.venueId,
        purpose: patch.purpose,
        channel: patch.channel,
        source: patch.source,
        evidenceReference: patch.evidenceReference,
        actorReference: patch.actorReference,
        consentId: patch.consentId,
        createdAt: nowIso,
        version: 0,
      };

  const preservedEffectiveAt =
    to === CUSTOMER_CONSENT_STATUS.EXPIRED && base.effectiveAt
      ? base.effectiveAt
      : nowIso;

  let expiresAt =
    to === CUSTOMER_CONSENT_STATUS.EXPIRED
      ? patch.expiresAt ?? nowIso
      : patch.expiresAt !== undefined
        ? patch.expiresAt
        : base.expiresAt;

  if (
    to === CUSTOMER_CONSENT_STATUS.EXPIRED &&
    expiresAt &&
    preservedEffectiveAt &&
    String(expiresAt) <= String(preservedEffectiveAt)
  ) {
    expiresAt = new Date(
      Date.parse(String(preservedEffectiveAt)) + 1000
    ).toISOString();
  }

  return createCustomerConsentRecord(
    {
      ...base,
      ...patch,
      status: to,
      revokedAt:
        to === CUSTOMER_CONSENT_STATUS.REVOKED
          ? patch.revokedAt ?? nowIso
          : null,
      expiresAt: to === CUSTOMER_CONSENT_STATUS.EXPIRED ? expiresAt : expiresAt ?? null,
      effectiveAt: patch.effectiveAt ?? preservedEffectiveAt,
      version: (Number(base.version) || 0) + 1,
      updatedAt: nowIso,
      capturedAt: patch.capturedAt ?? nowIso,
    },
    deps
  );
}

/**
 * Append-only consent history record.
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createCustomerConsentHistoryRecord(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "Consent history input must be a plain object."
    );
  }
  const scope = createCustomerScope(input);
  const sequence = Number(input.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONSENT,
      "history sequence must be an integer >= 1.",
      { field: "sequence", sequence }
    );
  }
  return Object.freeze({
    historyId: requireOpaqueId(input.historyId, "historyId"),
    consentId: requireOpaqueId(input.consentId, "consentId"),
    customerId: requireOpaqueId(input.customerId, "customerId"),
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    sequence,
    previousStatus: input.previousStatus
      ? String(input.previousStatus)
      : CUSTOMER_CONSENT_STATUS.NOT_RECORDED,
    nextStatus: String(input.nextStatus || ""),
    purpose: String(input.purpose || ""),
    channel: input.channel == null ? null : String(input.channel),
    effectiveAt: input.effectiveAt ? String(input.effectiveAt) : null,
    source: input.source ? String(input.source) : null,
    evidenceReference: optionalOpaqueId(input.evidenceReference, "evidenceReference"),
    actorReference: optionalOpaqueId(input.actorReference, "actorReference"),
    reason: input.reason != null ? String(input.reason).slice(0, 500) : null,
    aggregateVersion: Number(input.aggregateVersion) || 1,
    recordedAt: String(input.recordedAt || new Date().toISOString()),
  });
}
