/**
 * Operational effect / integration intents (CM-07).
 * Proposal-only — never executed by this module.
 */

import { COMPETITION_LIFECYCLE_INTENT_EXECUTION_STATUS } from "../constants/comparison.js";
import {
  COMPETITION_SUSPENSION_PUBLICATION_POLICY,
  COMPETITION_CANCELLATION_PUBLICATION_POLICY,
} from "../constants/policies.js";
import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";

export const COMPETITION_LIFECYCLE_INTENT_TYPE = Object.freeze({
  // Suspend
  PAUSE_REGISTRATION_INTENT: "PAUSE_REGISTRATION_INTENT",
  FREEZE_DRAW_MUTATION_INTENT: "FREEZE_DRAW_MUTATION_INTENT",
  FREEZE_SCHEDULE_MUTATION_INTENT: "FREEZE_SCHEDULE_MUTATION_INTENT",
  FREEZE_MATCH_GENERATION_INTENT: "FREEZE_MATCH_GENERATION_INTENT",
  PUBLICATION_SUSPENSION_NOTICE_INTENT: "PUBLICATION_SUSPENSION_NOTICE_INTENT",
  PUBLICATION_WITHDRAWAL_INTENT: "PUBLICATION_WITHDRAWAL_INTENT",
  // Resume
  REGISTRATION_RESUME_REVIEW_INTENT: "REGISTRATION_RESUME_REVIEW_INTENT",
  DRAW_RESUME_REVIEW_INTENT: "DRAW_RESUME_REVIEW_INTENT",
  SCHEDULE_RESUME_REVIEW_INTENT: "SCHEDULE_RESUME_REVIEW_INTENT",
  MATCH_EXECUTION_RESUME_REVIEW_INTENT: "MATCH_EXECUTION_RESUME_REVIEW_INTENT",
  PUBLICATION_RESTORE_OR_REPUBLISH_REVIEW_INTENT:
    "PUBLICATION_RESTORE_OR_REPUBLISH_REVIEW_INTENT",
  // Cancel
  CLOSE_REGISTRATION_INTENT: "CLOSE_REGISTRATION_INTENT",
  PERMANENT_DRAW_FREEZE_INTENT: "PERMANENT_DRAW_FREEZE_INTENT",
  PERMANENT_SCHEDULE_FREEZE_INTENT: "PERMANENT_SCHEDULE_FREEZE_INTENT",
  PERMANENT_MATCH_GENERATION_FREEZE_INTENT:
    "PERMANENT_MATCH_GENERATION_FREEZE_INTENT",
  PERMANENT_PUBLICATION_WITHDRAWAL_INTENT:
    "PERMANENT_PUBLICATION_WITHDRAWAL_INTENT",
  ARCHIVE_ELIGIBILITY_REVIEW_INTENT: "ARCHIVE_ELIGIBILITY_REVIEW_INTENT",
  // Shared
  NOTIFICATION_INTENT: "NOTIFICATION_INTENT",
  AUDIT_EVENT_INTENT: "AUDIT_EVENT_INTENT",
  CM01_DEFINITION_STATUS_PATCH_PROPOSAL: "CM01_DEFINITION_STATUS_PATCH_PROPOSAL",
});

export const COMPETITION_LIFECYCLE_INTENT_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_LIFECYCLE_INTENT_TYPE)
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
    lifecycleRecordId: base.lifecycleRecordId,
    lifecycleRevision: base.lifecycleRevision,
    sourceReference: {
      recordId: base.lifecycleRecordId,
      revision: base.lifecycleRevision,
      action: base.action,
    },
    targetCapability,
    payload,
    executionStatus: COMPETITION_LIFECYCLE_INTENT_EXECUTION_STATUS.PROPOSED,
    proposedOnly: true,
    executed: false,
    description,
  };
}

/**
 * Deterministic operational effect plan — never executed by CM-07.
 * @param {object} params
 * @returns {Readonly<object>}
 */
export function buildCompetitionLifecycleEffectPlan(params = {}) {
  const {
    action,
    tenantId,
    competitionId,
    lifecycleRecordId,
    lifecycleRevision,
    publicationPolicy = null,
    publicationContext,
    definitionStatus = null,
    expectedDefinitionRevision,
    reasonCode,
  } = params;

  const base = {
    tenantId,
    competitionId,
    lifecycleRecordId,
    lifecycleRevision,
    action,
  };

  /** @type {object[]} */
  const intents = [];

  if (action === "SUSPEND") {
    intents.push(
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.PAUSE_REGISTRATION_INTENT,
        "registration",
        { mode: "PAUSE" },
        "Proposal to pause registration. Not executed by CM-07."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.FREEZE_DRAW_MUTATION_INTENT,
        "draw",
        { mode: "FREEZE" },
        "Proposal to freeze draw mutations. Not executed by CM-07."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.FREEZE_SCHEDULE_MUTATION_INTENT,
        "schedule",
        { mode: "FREEZE" },
        "Proposal to freeze schedule mutations. Not executed by CM-07."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.FREEZE_MATCH_GENERATION_INTENT,
        "match-generation",
        { mode: "FREEZE" },
        "Proposal to freeze match generation. Not executed by CM-07. Does not cancel matches."
      )
    );

    if (
      publicationPolicy ===
      COMPETITION_SUSPENSION_PUBLICATION_POLICY.KEEP_PUBLIC_WITH_SUSPENDED_NOTICE
    ) {
      intents.push(
        makeIntent(
          base,
          COMPETITION_LIFECYCLE_INTENT_TYPE.PUBLICATION_SUSPENSION_NOTICE_INTENT,
          "competition-publication",
          {
            publicationPresence: publicationContext?.presence ?? null,
            publicationId: publicationContext?.publicationId ?? null,
            publicationRevision: publicationContext?.publicationRevision ?? null,
            notice: "SUSPENDED",
          },
          "Proposal for a public suspension notice. Does not mutate CM-06 records."
        )
      );
    } else if (
      publicationPolicy ===
      COMPETITION_SUSPENSION_PUBLICATION_POLICY.REQUEST_TEMPORARY_WITHDRAWAL
    ) {
      intents.push(
        makeIntent(
          base,
          COMPETITION_LIFECYCLE_INTENT_TYPE.PUBLICATION_WITHDRAWAL_INTENT,
          "competition-publication",
          {
            mode: "TEMPORARY",
            publicationPresence: publicationContext?.presence ?? null,
            publicationId: publicationContext?.publicationId ?? null,
            publicationRevision: publicationContext?.publicationRevision ?? null,
          },
          "Proposal for temporary publication withdrawal. Does not mutate CM-06 records."
        )
      );
    }

    intents.push(
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.CM01_DEFINITION_STATUS_PATCH_PROPOSAL,
        "competition-definition",
        {
          proposedStatus: "suspended",
          expectedDefinitionRevision,
          priorStatus: definitionStatus,
          applied: false,
        },
        "Proposal only — CM-07 does not mutate CompetitionDefinition."
      )
    );
  }

  if (action === "RESUME") {
    intents.push(
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.REGISTRATION_RESUME_REVIEW_INTENT,
        "registration",
        { mode: "REVIEW" },
        "Proposal for registration resume review. Does not reopen registration."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.DRAW_RESUME_REVIEW_INTENT,
        "draw",
        { mode: "REVIEW" },
        "Proposal for draw resume review. Does not mutate draws."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.SCHEDULE_RESUME_REVIEW_INTENT,
        "schedule",
        { mode: "REVIEW" },
        "Proposal for schedule resume review. Does not run schedule."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.MATCH_EXECUTION_RESUME_REVIEW_INTENT,
        "match-lifecycle",
        { mode: "REVIEW", note: "Not CORE-23 recovery; not match resume." },
        "Proposal for match-execution resume review. Does not invoke CORE-15/23."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.PUBLICATION_RESTORE_OR_REPUBLISH_REVIEW_INTENT,
        "competition-publication",
        {
          publicationPresence: publicationContext?.presence ?? null,
          publicationId: publicationContext?.publicationId ?? null,
          publicationRevision: publicationContext?.publicationRevision ?? null,
        },
        "Proposal for publication restore/republish review. Does not republish."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.CM01_DEFINITION_STATUS_PATCH_PROPOSAL,
        "competition-definition",
        {
          proposedStatus:
            definitionStatus && definitionStatus !== "suspended"
              ? definitionStatus
              : "published",
          expectedDefinitionRevision,
          priorStatus: definitionStatus,
          applied: false,
        },
        "Proposal only — CM-07 does not mutate CompetitionDefinition."
      )
    );
  }

  if (action === "CANCEL") {
    intents.push(
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.CLOSE_REGISTRATION_INTENT,
        "registration",
        { mode: "CLOSE" },
        "Proposal to close registration. Not executed by CM-07."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.PERMANENT_DRAW_FREEZE_INTENT,
        "draw",
        { mode: "PERMANENT_FREEZE" },
        "Proposal for permanent draw freeze. Not executed by CM-07."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.PERMANENT_SCHEDULE_FREEZE_INTENT,
        "schedule",
        { mode: "PERMANENT_FREEZE" },
        "Proposal for permanent schedule freeze. Not executed by CM-07."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.PERMANENT_MATCH_GENERATION_FREEZE_INTENT,
        "match-generation",
        { mode: "PERMANENT_FREEZE" },
        "Proposal for permanent match-generation freeze. Does not cancel matches."
      )
    );

    if (
      publicationPolicy ===
        COMPETITION_CANCELLATION_PUBLICATION_POLICY.REQUEST_PERMANENT_WITHDRAWAL ||
      publicationPolicy == null
    ) {
      intents.push(
        makeIntent(
          base,
          COMPETITION_LIFECYCLE_INTENT_TYPE.PERMANENT_PUBLICATION_WITHDRAWAL_INTENT,
          "competition-publication",
          {
            mode: "PERMANENT",
            publicationPresence: publicationContext?.presence ?? null,
            publicationId: publicationContext?.publicationId ?? null,
            publicationRevision: publicationContext?.publicationRevision ?? null,
          },
          "Proposal for permanent publication withdrawal. Does not delete CM-06 history."
        )
      );
    }

    intents.push(
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.ARCHIVE_ELIGIBILITY_REVIEW_INTENT,
        "competition-archive",
        { mode: "REVIEW_ONLY", note: "CM-08 ownership — not archived by CM-07." },
        "Proposal for CM-08 archive eligibility review. Does not archive."
      ),
      makeIntent(
        base,
        COMPETITION_LIFECYCLE_INTENT_TYPE.CM01_DEFINITION_STATUS_PATCH_PROPOSAL,
        "competition-definition",
        {
          proposedStatus: "cancelled",
          expectedDefinitionRevision,
          priorStatus: definitionStatus,
          applied: false,
        },
        "Proposal only — CM-07 does not mutate CompetitionDefinition."
      )
    );
  }

  intents.push(
    makeIntent(
      base,
      COMPETITION_LIFECYCLE_INTENT_TYPE.NOTIFICATION_INTENT,
      "notification",
      { event: `COMPETITION_${action}`, reasonCode },
      "Proposal for notification. CM-07 never sends notifications."
    ),
    makeIntent(
      base,
      COMPETITION_LIFECYCLE_INTENT_TYPE.AUDIT_EVENT_INTENT,
      "audit",
      { event: `COMPETITION_${action}`, reasonCode },
      "Proposal for audit persistence. CM-07 never persists audit records."
    )
  );

  // Stable ordering by type for determinism.
  intents.sort((a, b) => String(a.type).localeCompare(String(b.type), "en"));

  return deepFreeze({
    tenantId,
    competitionId,
    lifecycleRecordId,
    lifecycleRevision,
    action,
    intents: deepFreeze(intents),
    executed: false,
    reasons: Object.freeze([
      "proposalsOnly",
      "noExecution",
      "noNetwork",
      "noProductionWrite",
      "noMatchCancellation",
      "noPublicationMutation",
      "noDefinitionMutation",
      "noNotificationSent",
      "noAuditPersistence",
      "noArchive",
      "noCore15",
      "noCore23Recovery",
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleEffectPlan(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    Array.isArray(v.intents) &&
    v.executed === false
  );
}
