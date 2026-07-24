/**
 * CompetitionLifecycleRecord builder + projection helpers (CM-07).
 */

import { COMPETITION_LIFECYCLE_STATE } from "../constants/states.js";
import { COMPETITION_LIFECYCLE_ACTION } from "../constants/actions.js";
import {
  COMPETITION_LIFECYCLE_INITIAL_REVISION,
  isValidCompetitionLifecycleRevision,
} from "../constants/revision.js";
import {
  COMPETITION_LIFECYCLE_RECORD_SCHEMA_VERSION,
} from "../constants/comparison.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
  stableContentFingerprint,
} from "./shared.js";
import { createCompetitionLifecycleRecordId } from "./identity.js";

/**
 * Project effective state from the latest lifecycle record (or ACTIVE if none).
 * @param {object|null|undefined} latestRecord
 * @returns {string}
 */
export function projectCompetitionLifecycleState(latestRecord) {
  if (!latestRecord || typeof latestRecord !== "object") {
    return COMPETITION_LIFECYCLE_STATE.ACTIVE;
  }
  if (isNonEmptyString(latestRecord.toState)) {
    return latestRecord.toState;
  }
  return COMPETITION_LIFECYCLE_STATE.ACTIVE;
}

/**
 * @param {object|null|undefined} latestRecord
 * @returns {number}
 */
export function projectCurrentLifecycleRevision(latestRecord) {
  if (
    latestRecord &&
    typeof latestRecord === "object" &&
    isValidCompetitionLifecycleRevision(latestRecord.revision)
  ) {
    return latestRecord.revision;
  }
  return 0;
}

/**
 * Semantic fingerprint payload (excludes secrets / UI state).
 * @param {object} semantic
 * @returns {string}
 */
export function computeLifecycleRequestFingerprint(semantic) {
  return stableContentFingerprint({
    action: semantic.action,
    tenantId: semantic.tenantId,
    competitionId: semantic.competitionId,
    expectedLifecycleRevision: semantic.expectedLifecycleRevision,
    expectedDefinitionRevision: semantic.expectedDefinitionRevision,
    reason: semantic.reason,
    actor: {
      actorId: semantic.actor?.actorId,
      actorType: semantic.actor?.actorType,
      tenantId: semantic.actor?.tenantId,
    },
    authority: {
      authorizationDecision: semantic.authority?.authorizationDecision,
      authorizationPolicyId: semantic.authority?.authorizationPolicyId,
      authorizationPolicyVersion: semantic.authority?.authorizationPolicyVersion,
      decisionReference: semantic.authority?.decisionReference,
    },
    publicationPolicy: semantic.publicationPolicy ?? null,
    publicationContext: semantic.publicationContext,
    versionContext: semantic.versionContext ?? null,
    effectiveAt: semantic.effectiveAt,
    intendedResumeAt: semantic.intendedResumeAt ?? null,
    dataRetentionAcknowledged: semantic.dataRetentionAcknowledged ?? null,
  });
}

/**
 * Record content fingerprint (deterministic over immutable fields).
 * @param {object} recordWithoutFingerprint
 * @returns {string}
 */
export function computeLifecycleRecordFingerprint(recordWithoutFingerprint) {
  const clone = clonePlain(recordWithoutFingerprint);
  delete clone.fingerprint;
  return stableContentFingerprint(clone);
}

/**
 * Build an immutable lifecycle decision record.
 * @param {object} params
 * @returns {Readonly<object>}
 */
export function buildCompetitionLifecycleRecord(params = {}) {
  const tenantId = String(params.tenantId).trim();
  const competitionId = String(params.competitionId).trim();
  const revision = params.revision;
  const recordId =
    params.recordId ??
    createCompetitionLifecycleRecordId(tenantId, competitionId, revision);

  const base = {
    schemaVersion: COMPETITION_LIFECYCLE_RECORD_SCHEMA_VERSION,
    recordId,
    tenantId,
    competitionId,
    revision,
    action: params.action,
    fromState: params.fromState,
    toState: params.toState,
    reason: params.reason,
    actor: params.actor,
    authority: params.authority,
    source: params.source,
    effectiveAt: params.effectiveAt,
    intendedResumeAt: params.intendedResumeAt ?? null,
    previousRecordId: params.previousRecordId ?? null,
    publicationPolicy: params.publicationPolicy ?? null,
    effectPlan: params.effectPlan,
    idempotencyKey: params.idempotencyKey,
    requestFingerprint: params.requestFingerprint,
    createdAt: params.createdAt,
    dataRetentionAcknowledged: params.dataRetentionAcknowledged ?? null,
  };

  const fingerprint = computeLifecycleRecordFingerprint(base);
  return deepFreeze({ ...base, fingerprint });
}

/**
 * Structural guard for stored records.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionLifecycleRecord(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    v.schemaVersion === COMPETITION_LIFECYCLE_RECORD_SCHEMA_VERSION &&
    isNonEmptyString(v.recordId) &&
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    isValidCompetitionLifecycleRevision(v.revision) &&
    isNonEmptyString(v.action) &&
    isNonEmptyString(v.fromState) &&
    isNonEmptyString(v.toState) &&
    isNonEmptyString(v.effectiveAt) &&
    isNonEmptyString(v.fingerprint) &&
    isNonEmptyString(v.idempotencyKey) &&
    v.effectPlan &&
    typeof v.effectPlan === "object" &&
    v.effectPlan.executed === false
  );
}

/**
 * @param {string} action
 * @param {string} fromState
 * @returns {{ ok: true, toState: string } | { ok: false, code: string, message: string }}
 */
export function resolveTransition(action, fromState) {
  if (action === COMPETITION_LIFECYCLE_ACTION.SUSPEND) {
    if (fromState === COMPETITION_LIFECYCLE_STATE.CANCELLED) {
      return {
        ok: false,
        code: "CANCELLED_TERMINAL",
        message: "cannot suspend a CANCELLED competition",
      };
    }
    if (fromState === COMPETITION_LIFECYCLE_STATE.SUSPENDED) {
      return {
        ok: false,
        code: "ALREADY_SUSPENDED",
        message: "competition is already SUSPENDED",
      };
    }
    if (fromState !== COMPETITION_LIFECYCLE_STATE.ACTIVE) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `cannot SUSPEND from ${fromState}`,
      };
    }
    return { ok: true, toState: COMPETITION_LIFECYCLE_STATE.SUSPENDED };
  }

  if (action === COMPETITION_LIFECYCLE_ACTION.RESUME) {
    if (fromState === COMPETITION_LIFECYCLE_STATE.CANCELLED) {
      return {
        ok: false,
        code: "CANCELLED_TERMINAL",
        message: "cannot resume a CANCELLED competition",
      };
    }
    if (fromState === COMPETITION_LIFECYCLE_STATE.ACTIVE) {
      return {
        ok: false,
        code: "NOT_SUSPENDED",
        message: "cannot resume an ACTIVE competition",
      };
    }
    if (fromState !== COMPETITION_LIFECYCLE_STATE.SUSPENDED) {
      return {
        ok: false,
        code: "RESUME_FORBIDDEN",
        message: `cannot RESUME from ${fromState}`,
      };
    }
    return { ok: true, toState: COMPETITION_LIFECYCLE_STATE.ACTIVE };
  }

  if (action === COMPETITION_LIFECYCLE_ACTION.CANCEL) {
    if (fromState === COMPETITION_LIFECYCLE_STATE.CANCELLED) {
      return {
        ok: false,
        code: "ALREADY_CANCELLED",
        message: "competition is already CANCELLED",
      };
    }
    if (
      fromState !== COMPETITION_LIFECYCLE_STATE.ACTIVE &&
      fromState !== COMPETITION_LIFECYCLE_STATE.SUSPENDED
    ) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `cannot CANCEL from ${fromState}`,
      };
    }
    return { ok: true, toState: COMPETITION_LIFECYCLE_STATE.CANCELLED };
  }

  return {
    ok: false,
    code: "INVALID_TRANSITION",
    message: `unknown action ${action}`,
  };
}

export { COMPETITION_LIFECYCLE_INITIAL_REVISION };
