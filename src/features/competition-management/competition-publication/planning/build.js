/**
 * Integration plan assembly (CM-06).
 *
 * The plan is a set of typed integration *intents* — proposals only. CM-06
 * never executes them: no deploy, no route activation, no cache write, no
 * notification send, no audit persistence. Downstream capabilities may later
 * choose to act on these proposals.
 */

import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";

export const COMPETITION_PUBLICATION_INTENT_TYPE = Object.freeze({
  PUBLIC_PORTAL_PROJECTION_WRITE: "PUBLIC_PORTAL_PROJECTION_WRITE",
  CACHE_INVALIDATION: "CACHE_INVALIDATION",
  NOTIFICATION_INTENT: "NOTIFICATION_INTENT",
  AUDIT_INTENT: "AUDIT_INTENT",
});

export const COMPETITION_PUBLICATION_INTENT_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_INTENT_TYPE)
);

/**
 * @param {{
 *   publicationId: string,
 *   tenantId: string,
 *   competitionId: string,
 *   channel: string,
 *   revision: number,
 *   manifestFingerprint: string,
 *   channelDescriptor: { outputReferenceType: string },
 *   isRepublish?: boolean,
 * }} params
 * @returns {Readonly<object>}
 */
export function buildCompetitionPublicationPlan(params = {}) {
  const {
    publicationId,
    tenantId,
    competitionId,
    channel,
    revision,
    manifestFingerprint,
    channelDescriptor,
    isRepublish = false,
  } = params;

  const intents = [
    {
      type: COMPETITION_PUBLICATION_INTENT_TYPE.PUBLIC_PORTAL_PROJECTION_WRITE,
      proposedOnly: true,
      executed: false,
      target: { tenantId, competitionId, channel, publicationId, revision },
      description:
        "Proposal to write the deterministic manifest projection to the public portal store. Not executed by CM-06.",
    },
    {
      type: COMPETITION_PUBLICATION_INTENT_TYPE.CACHE_INVALIDATION,
      proposedOnly: true,
      executed: false,
      target: {
        tenantId,
        competitionId,
        channel,
        scopeHint: channelDescriptor?.outputReferenceType ?? null,
      },
      description:
        "Proposal to invalidate downstream cache/CDN entries for this publication scope. Not executed by CM-06.",
    },
    {
      type: COMPETITION_PUBLICATION_INTENT_TYPE.NOTIFICATION_INTENT,
      proposedOnly: true,
      executed: false,
      target: {
        tenantId,
        competitionId,
        channel,
        event: isRepublish ? "COMPETITION_REPUBLISHED" : "COMPETITION_PUBLISHED",
      },
      description:
        "Proposal for a notification capability to notify interested parties. CM-06 does not own notifications and never sends any.",
    },
    {
      type: COMPETITION_PUBLICATION_INTENT_TYPE.AUDIT_INTENT,
      proposedOnly: true,
      executed: false,
      target: { tenantId, competitionId, channel, publicationId, revision },
      description:
        "Proposal for an audit capability to record this publication event. CM-06 does not persist audit records.",
    },
  ];

  return deepFreeze({
    tenantId,
    competitionId,
    channel,
    publicationId,
    revision,
    manifestFingerprint,
    intents: deepFreeze(intents),
    executed: false,
    reasons: Object.freeze([
      "proposalsOnly",
      "noExecution",
      "noNetwork",
      "noProductionActivation",
      "noNotificationSent",
      "noAuditPersistence",
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationPlan(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.publicationId) &&
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    Array.isArray(v.intents) &&
    v.executed === false
  );
}
