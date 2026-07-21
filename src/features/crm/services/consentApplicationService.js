/**
 * Phase 1F — CRM Consent application foundation.
 *
 * Append-only ConsentRecord history. Effective state derived deterministically.
 * No Notification or provider delivery.
 */

import { authorizeCrm, authorizeCrmResource } from "../authorization/crmAuthorize.js";
import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { isConsentChannel } from "../constants/consentChannels.js";
import { isConsentPurpose } from "../constants/consentPurposes.js";
import { CONSENT_STATUS } from "../constants/consentStatuses.js";
import { CRM_AUDIT_EVENT_TYPE } from "../constants/eventTypes.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createSystemCrmClock, createSequentialCrmIdGenerator } from "../contracts/ports.js";
import {
  createConsentRecord as createConsentRecordModel,
  deriveEffectiveConsent,
} from "../models/consentRecord.js";
import { createMemoryConsentRepository } from "../repositories/memory/memoryConsentRepository.js";
import { createMemoryContactReferenceRepository } from "../repositories/memory/memoryContactReferenceRepository.js";
import { buildCrmAuditEvent, toCrmFailure } from "./eventEmitHelpers.js";

/**
 * @param {object} [dependencies]
 */
export function createConsentApplicationService(dependencies = {}) {
  const clock = dependencies.clock || createSystemCrmClock();
  const ids = dependencies.ids || createSequentialCrmIdGenerator();
  const consentRepository =
    dependencies.consentRepository || createMemoryConsentRepository();
  const contactReferenceRepository =
    dependencies.contactReferenceRepository || createMemoryContactReferenceRepository();

  function pendingAudit(event) {
    return Object.freeze({ kind: "audit", delivery: "pending", event });
  }

  async function resolveContactRef(scope, contactRefId) {
    const id =
      contactRefId != null && String(contactRefId).trim()
        ? String(contactRefId).trim()
        : "";
    if (!id) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "contactRefId is required.");
    }
    const contactRef = await contactReferenceRepository.getById(scope, id);
    if (!contactRef) {
      return crmFailure(
        CRM_ERROR_CODES.NOT_FOUND,
        "ContactReference not found in the requested tenant/venue scope."
      );
    }
    return { ok: true, contactRef, contactRefId: id };
  }

  async function grantConsent(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.CONSENT_CREATE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const channel =
      input.channel != null ? String(input.channel).trim() : "";
    if (!isConsentChannel(channel)) {
      return crmFailure(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent channel: ${channel}`);
    }

    const purpose =
      input.purpose != null ? String(input.purpose).trim() : "";
    if (!isConsentPurpose(purpose)) {
      return crmFailure(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent purpose: ${purpose}`);
    }

    const policyVersion =
      input.policyVersion != null ? String(input.policyVersion).trim() : "";
    if (!policyVersion) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "policyVersion is required.");
    }

    const effectiveAt = normalizeIsoTimestamp(input.effectiveAt ?? now);
    if (!effectiveAt) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "effectiveAt must be a valid ISO-8601 timestamp."
      );
    }

    try {
      const contact = await resolveContactRef(scope, input.contactRefId);
      if (!contact.ok) return contact;

      const consent = createConsentRecordModel({
        consentId: ids.nextId("consent"),
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        contactRefId: contact.contactRefId,
        channel,
        purpose,
        status: CONSENT_STATUS.GRANTED,
        source: input.source,
        policyVersion,
        effectiveAt,
        expiresAt: input.expiresAt,
        recordedByActorId: auth.actor.userId,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.CONSENT_GRANTED,
        aggregateType: "ConsentRecord",
        aggregateId: consent.consentId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          consentId: consent.consentId,
          contactRefId: consent.contactRefId,
          channel: consent.channel,
          purpose: consent.purpose,
          policyVersion: consent.policyVersion,
          effectiveAt: consent.effectiveAt,
          expiresAt: consent.expiresAt,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await consentRepository.create(scope, consent);
      return {
        ok: true,
        consent: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function revokeConsent(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.CONSENT_REVOKE, input);
    if (!auth.ok) return auth;
    const { scope } = auth;
    const now = clock.nowIso();

    const channel =
      input.channel != null ? String(input.channel).trim() : "";
    if (!isConsentChannel(channel)) {
      return crmFailure(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent channel: ${channel}`);
    }

    const purpose =
      input.purpose != null ? String(input.purpose).trim() : "";
    if (!isConsentPurpose(purpose)) {
      return crmFailure(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent purpose: ${purpose}`);
    }

    const policyVersion =
      input.policyVersion != null ? String(input.policyVersion).trim() : "";
    if (!policyVersion) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "policyVersion is required.");
    }

    const effectiveAt = normalizeIsoTimestamp(input.effectiveAt ?? now);
    if (!effectiveAt) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "effectiveAt must be a valid ISO-8601 timestamp."
      );
    }

    const reason =
      input.reason != null && String(input.reason).trim()
        ? String(input.reason).trim()
        : "";
    if (!reason) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "revokeConsent requires a non-empty reason.");
    }

    try {
      const contact = await resolveContactRef(scope, input.contactRefId);
      if (!contact.ok) return contact;

      const consent = createConsentRecordModel({
        consentId: ids.nextId("consent"),
        tenantId: scope.tenantId,
        venueId: scope.venueId,
        contactRefId: contact.contactRefId,
        channel,
        purpose,
        status: CONSENT_STATUS.REVOKED,
        source: input.source,
        policyVersion,
        effectiveAt,
        revokedAt: now,
        reason,
        recordedByActorId: auth.actor.userId,
        createdAt: now,
        updatedAt: now,
      });

      const audit = buildCrmAuditEvent({
        scope,
        eventType: CRM_AUDIT_EVENT_TYPE.CONSENT_REVOKED,
        aggregateType: "ConsentRecord",
        aggregateId: consent.consentId,
        actorUserId: auth.actor.userId,
        occurredAt: now,
        payload: {
          consentId: consent.consentId,
          contactRefId: consent.contactRefId,
          channel: consent.channel,
          purpose: consent.purpose,
          policyVersion: consent.policyVersion,
          effectiveAt: consent.effectiveAt,
          reason: consent.reason,
        },
        ids,
      });
      if (!audit.ok) return audit;

      const saved = await consentRepository.create(scope, consent);
      return {
        ok: true,
        consent: saved,
        pendingApplicationEvents: Object.freeze([pendingAudit(audit.event)]),
        auditEvent: audit.event,
      };
    } catch (err) {
      return toCrmFailure(err);
    }
  }

  async function getConsent(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.CONSENT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const consentId =
      input.consentId != null && String(input.consentId).trim()
        ? String(input.consentId).trim()
        : "";
    if (!consentId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "consentId is required.");
    }

    const consent = await consentRepository.getById(scope, consentId);
    if (!consent) {
      return crmFailure(CRM_ERROR_CODES.NOT_FOUND, "Consent record not found in scope.");
    }

    const resourceAuth = authorizeCrmResource(actor, CRM_PERMISSIONS.CONSENT_VIEW, consent);
    if (!resourceAuth.ok) return resourceAuth;

    return { ok: true, consent };
  }

  async function listConsentHistory(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.CONSENT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const filters = {};
    if (input.contactRefId) filters.contactRefId = String(input.contactRefId);
    if (input.channel) filters.channel = String(input.channel);
    if (input.purpose) filters.purpose = String(input.purpose);
    if (input.status) filters.status = String(input.status);

    if (filters.contactRefId) {
      const contact = await resolveContactRef(scope, filters.contactRefId);
      if (!contact.ok) return contact;
    }

    const records = await consentRepository.list(scope, filters);
    return { ok: true, records: Object.freeze([...records]) };
  }

  async function getEffectiveConsent(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.CONSENT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const contactRefId =
      input.contactRefId != null && String(input.contactRefId).trim()
        ? String(input.contactRefId).trim()
        : "";
    const channel =
      input.channel != null ? String(input.channel).trim() : "";
    const purpose =
      input.purpose != null ? String(input.purpose).trim() : "";

    if (!contactRefId || !channel || !purpose) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "contactRefId, channel, and purpose are required."
      );
    }
    if (!isConsentChannel(channel)) {
      return crmFailure(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent channel: ${channel}`);
    }
    if (!isConsentPurpose(purpose)) {
      return crmFailure(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent purpose: ${purpose}`);
    }

    const contact = await resolveContactRef(scope, contactRefId);
    if (!contact.ok) return contact;

    const evaluationTime = normalizeIsoTimestamp(input.evaluationTime ?? clock.nowIso());
    if (!evaluationTime) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "evaluationTime must be a valid ISO-8601 timestamp when provided."
      );
    }

    const records = await consentRepository.list(scope, {
      contactRefId,
      channel,
      purpose,
    });
    const effective = deriveEffectiveConsent(
      records,
      scope,
      contactRefId,
      channel,
      purpose,
      evaluationTime
    );

    return {
      ok: true,
      effectiveConsent: effective,
      evaluationTime,
    };
  }

  async function listEffectiveConsents(actor, input = {}) {
    const auth = authorizeCrm(actor, CRM_PERMISSIONS.CONSENT_VIEW, input);
    if (!auth.ok) return auth;
    const { scope } = auth;

    const contactRefId =
      input.contactRefId != null && String(input.contactRefId).trim()
        ? String(input.contactRefId).trim()
        : "";
    if (!contactRefId) {
      return crmFailure(CRM_ERROR_CODES.INVALID_INPUT, "contactRefId is required.");
    }

    const contact = await resolveContactRef(scope, contactRefId);
    if (!contact.ok) return contact;

    const evaluationTime = normalizeIsoTimestamp(input.evaluationTime ?? clock.nowIso());
    if (!evaluationTime) {
      return crmFailure(
        CRM_ERROR_CODES.INVALID_INPUT,
        "evaluationTime must be a valid ISO-8601 timestamp when provided."
      );
    }

    const records = await consentRepository.list(scope, { contactRefId });
    /** @type {Map<string, object>} */
    const byKey = new Map();

    for (const row of records) {
      const key = `${row.channel}::${row.purpose}`;
      const effective = deriveEffectiveConsent(
        records,
        scope,
        contactRefId,
        row.channel,
        row.purpose,
        evaluationTime
      );
      if (effective) byKey.set(key, effective);
    }

    const effectiveConsents = [...byKey.values()].sort((a, b) => {
      const ch = String(a.channel).localeCompare(String(b.channel));
      if (ch !== 0) return ch;
      return String(a.purpose).localeCompare(String(b.purpose));
    });

    return {
      ok: true,
      effectiveConsents: Object.freeze(effectiveConsents),
      evaluationTime,
    };
  }

  return {
    grantConsent,
    revokeConsent,
    getConsent,
    listConsentHistory,
    getEffectiveConsent,
    listEffectiveConsents,
  };
}
