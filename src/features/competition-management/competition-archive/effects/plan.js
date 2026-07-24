/**
 * Operational effect / integration intents (CM-08).
 * Proposal-only — never executed by this module.
 */

import { COMPETITION_ARCHIVE_INTENT_EXECUTION_STATUS } from "../constants/comparison.js";
import { COMPETITION_ARCHIVE_ACTION } from "../constants/actions.js";
import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";

export const COMPETITION_ARCHIVE_INTENT_TYPE = Object.freeze({
  CM01_ARCHIVED_STATUS_PATCH_INTENT: "CM01_ARCHIVED_STATUS_PATCH_INTENT",
  CM01_UNARCHIVE_STATUS_PATCH_INTENT: "CM01_UNARCHIVE_STATUS_PATCH_INTENT",
  PUBLICATION_ARCHIVE_VISIBILITY_REVIEW_INTENT:
    "PUBLICATION_ARCHIVE_VISIBILITY_REVIEW_INTENT",
  PUBLIC_DIRECTORY_REMOVAL_REVIEW_INTENT:
    "PUBLIC_DIRECTORY_REMOVAL_REVIEW_INTENT",
  REGISTRATION_READ_ONLY_REVIEW_INTENT:
    "REGISTRATION_READ_ONLY_REVIEW_INTENT",
  SCHEDULE_READ_ONLY_REVIEW_INTENT: "SCHEDULE_READ_ONLY_REVIEW_INTENT",
  ANALYTICS_ARCHIVE_CLASSIFICATION_INTENT:
    "ANALYTICS_ARCHIVE_CLASSIFICATION_INTENT",
  SEARCH_INDEX_VISIBILITY_REVIEW_INTENT:
    "SEARCH_INDEX_VISIBILITY_REVIEW_INTENT",
  DATA_RETENTION_REVIEW_INTENT: "DATA_RETENTION_REVIEW_INTENT",
  STORAGE_RETENTION_REVIEW_INTENT: "STORAGE_RETENTION_REVIEW_INTENT",
  PUBLICATION_RESTORE_REVIEW_INTENT: "PUBLICATION_RESTORE_REVIEW_INTENT",
  PUBLIC_DIRECTORY_RESTORE_REVIEW_INTENT:
    "PUBLIC_DIRECTORY_RESTORE_REVIEW_INTENT",
  ANALYTICS_RECLASSIFICATION_INTENT: "ANALYTICS_RECLASSIFICATION_INTENT",
  SEARCH_INDEX_RESTORE_REVIEW_INTENT: "SEARCH_INDEX_RESTORE_REVIEW_INTENT",
  NOTIFICATION_INTENT: "NOTIFICATION_INTENT",
  AUDIT_EVENT_INTENT: "AUDIT_EVENT_INTENT",
  ARCHIVE_AUDIT_EVENT_INTENT: "AUDIT_EVENT_INTENT",
});

export const COMPETITION_ARCHIVE_INTENT_TYPE_VALUES = Object.freeze(
  Object.values(
    Object.fromEntries(
      Object.entries(COMPETITION_ARCHIVE_INTENT_TYPE).filter(
        ([key]) => key !== "ARCHIVE_AUDIT_EVENT_INTENT"
      )
    )
  )
);

/**
 * @param {object} base
 * @param {string} type
 * @param {string} targetCapability
 * @param {object} [payload]
 * @param {string} [description]
 * @returns {object}
 */
function makeIntent(base, type, targetCapability, payload = {}, description = "") {
  return {
    type,
    tenantId: base.tenantId,
    competitionId: base.competitionId,
    archiveRecordId: base.archiveRecordId,
    archiveRevision: base.archiveRevision,
    sourceReference: {
      recordId: base.archiveRecordId,
      revision: base.archiveRevision,
      action: base.action,
    },
    targetCapability,
    payload,
    executionStatus: COMPETITION_ARCHIVE_INTENT_EXECUTION_STATUS.PROPOSED,
    proposedOnly: true,
    executed: false,
    description,
  };
}

/**
 * Deterministic operational effect plan — never executed by CM-08.
 * @param {object} params
 * @returns {Readonly<object>}
 */
export function buildCompetitionArchiveEffectPlan(params = {}) {
  const {
    action,
    tenantId,
    competitionId,
    archiveRecordId,
    archiveRevision,
    publicationContext,
    definitionStatus = null,
    expectedDefinitionRevision,
    reasonCode,
    archivePolicyId = null,
    retentionClassification = null,
  } = params;

  const base = {
    tenantId,
    competitionId,
    archiveRecordId,
    archiveRevision,
    action,
  };

  /** @type {object[]} */
  const intents = [];

  if (action === COMPETITION_ARCHIVE_ACTION.ARCHIVE) {
    intents.push(
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.CM01_ARCHIVED_STATUS_PATCH_INTENT,
        "competition-definition",
        {
          proposedStatus: "archived",
          expectedDefinitionRevision,
          priorStatus: definitionStatus,
          applied: false,
        },
        "Proposal only — CM-08 does not mutate CompetitionDefinition."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.PUBLICATION_ARCHIVE_VISIBILITY_REVIEW_INTENT,
        "competition-publication",
        {
          publicationPresence: publicationContext?.presence ?? null,
          publicationId: publicationContext?.publicationId ?? null,
          publicationRevision: publicationContext?.publicationRevision ?? null,
        },
        "Proposal for publication archive visibility review. Does not mutate CM-06 records."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.PUBLIC_DIRECTORY_REMOVAL_REVIEW_INTENT,
        "public-directory",
        { mode: "REVIEW" },
        "Proposal for public directory removal review. Not executed by CM-08."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.REGISTRATION_READ_ONLY_REVIEW_INTENT,
        "registration",
        { mode: "READ_ONLY_REVIEW" },
        "Proposal for registration read-only review. Not executed by CM-08."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.SCHEDULE_READ_ONLY_REVIEW_INTENT,
        "schedule",
        { mode: "READ_ONLY_REVIEW" },
        "Proposal for schedule read-only review. Not executed by CM-08."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.ANALYTICS_ARCHIVE_CLASSIFICATION_INTENT,
        "analytics",
        {
          classification: retentionClassification?.classification ?? "ARCHIVED",
        },
        "Proposal for analytics archive classification. Not executed by CM-08."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.SEARCH_INDEX_VISIBILITY_REVIEW_INTENT,
        "search-index",
        { mode: "ARCHIVE_VISIBILITY_REVIEW" },
        "Proposal for search index visibility review. Not executed by CM-08."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.DATA_RETENTION_REVIEW_INTENT,
        "data-retention",
        {
          archivePolicyId,
          mode: "REVIEW_ONLY",
          note: "No retention execution by CM-08.",
        },
        "Proposal for data retention review. Does not execute retention jobs."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.STORAGE_RETENTION_REVIEW_INTENT,
        "storage",
        {
          archivePolicyId,
          mode: "REVIEW_ONLY",
          note: "No storage deletion by CM-08.",
        },
        "Proposal for storage retention review. Does not delete storage."
      )
    );
  }

  if (action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE) {
    intents.push(
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.CM01_UNARCHIVE_STATUS_PATCH_INTENT,
        "competition-definition",
        {
          proposedStatus: "draft-or-published",
          expectedDefinitionRevision,
          priorStatus: definitionStatus,
          applied: false,
          note: "Restoration target is draft-or-published; CM-08 does not apply the patch.",
        },
        "Proposal only — CM-08 does not mutate CompetitionDefinition."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.PUBLICATION_RESTORE_REVIEW_INTENT,
        "competition-publication",
        {
          publicationPresence: publicationContext?.presence ?? null,
          publicationId: publicationContext?.publicationId ?? null,
          publicationRevision: publicationContext?.publicationRevision ?? null,
        },
        "Proposal for publication restore review. Does not mutate CM-06 records."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.PUBLIC_DIRECTORY_RESTORE_REVIEW_INTENT,
        "public-directory",
        { mode: "RESTORE_REVIEW" },
        "Proposal for public directory restore review. Not executed by CM-08."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.ANALYTICS_RECLASSIFICATION_INTENT,
        "analytics",
        { mode: "RECLASSIFY_REVIEW" },
        "Proposal for analytics reclassification review. Not executed by CM-08."
      ),
      makeIntent(
        base,
        COMPETITION_ARCHIVE_INTENT_TYPE.SEARCH_INDEX_RESTORE_REVIEW_INTENT,
        "search-index",
        { mode: "RESTORE_REVIEW" },
        "Proposal for search index restore review. Not executed by CM-08."
      )
    );
  }

  intents.push(
    makeIntent(
      base,
      COMPETITION_ARCHIVE_INTENT_TYPE.NOTIFICATION_INTENT,
      "notification",
      { event: `COMPETITION_${action}`, reasonCode },
      "Proposal for notification. CM-08 never sends notifications."
    ),
    makeIntent(
      base,
      COMPETITION_ARCHIVE_INTENT_TYPE.AUDIT_EVENT_INTENT,
      "audit",
      { event: action, reasonCode },
      "Proposal for audit persistence. CM-08 never persists audit records."
    )
  );

  intents.sort((a, b) => String(a.type).localeCompare(String(b.type), "en"));

  return deepFreeze({
    tenantId,
    competitionId,
    archiveRecordId,
    archiveRevision,
    action,
    intents: deepFreeze(intents),
    executed: false,
    reasons: Object.freeze([
      "proposalsOnly",
      "noDelete",
      "noPurge",
      "noRetentionExecution",
      "noStorageDeletion",
      "noPublicationMutation",
      "noDefinitionMutation",
      "noCore22Export",
      "noCore23Recovery",
      "noNetwork",
      "noProductionWrite",
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveEffectPlan(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    Array.isArray(v.intents) &&
    v.executed === false
  );
}
