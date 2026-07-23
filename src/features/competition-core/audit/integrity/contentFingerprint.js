/**
 * CORE-20 — content fingerprint for integrityMetadata.
 */

import { COMPETITION_AUDIT_CONTENT_FINGERPRINT_V1 } from "../constants.js";
import {
  hashStringToUint32,
  serializeCanonicalJson,
} from "../utils/helpers.js";

/**
 * @param {object} eventLike
 * @returns {string}
 */
export function createAuditContentFingerprint(eventLike) {
  const material = {
    scheme: COMPETITION_AUDIT_CONTENT_FINGERPRINT_V1,
    eventId: eventLike.eventId,
    eventType: eventLike.eventType,
    eventVersion: eventLike.eventVersion,
    source: eventLike.source,
    occurredAt: eventLike.occurredAt,
    competitionScope: eventLike.competitionScope,
    streamKey: eventLike.streamKey,
    sequence: eventLike.sequence,
    actor: eventLike.actor,
    subject: eventLike.subject,
    correlationId: eventLike.correlationId ?? null,
    causationId: eventLike.causationId ?? null,
    reason: eventLike.reason ?? null,
    beforeSummary: eventLike.beforeSummary ?? null,
    afterSummary: eventLike.afterSummary ?? null,
    evidenceReferences: eventLike.evidenceReferences ?? [],
    explanationMetadata: eventLike.explanationMetadata ?? {},
    safePayload: eventLike.safePayload ?? {},
    redactionMetadata: eventLike.redactionMetadata ?? {
      redacted: false,
      paths: [],
    },
  };
  const canonical = serializeCanonicalJson(material);
  const hash = hashStringToUint32(canonical).toString(16).padStart(8, "0");
  return `${COMPETITION_AUDIT_CONTENT_FINGERPRINT_V1}:${hash}`;
}
