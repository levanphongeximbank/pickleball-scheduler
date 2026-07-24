/**
 * CompetitionArchiveRecord builder + projection helpers (CM-08).
 */

import { COMPETITION_ARCHIVE_STATE } from "../constants/states.js";
import { COMPETITION_ARCHIVE_ACTION } from "../constants/actions.js";
import {
  isValidCompetitionArchiveRevision,
} from "../constants/revision.js";
import { COMPETITION_ARCHIVE_RECORD_SCHEMA_VERSION } from "../constants/comparison.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
  stableContentFingerprint,
} from "./shared.js";
import { createCompetitionArchiveRecordId } from "./identity.js";

/**
 * Project effective archive state from the latest record (or UNARCHIVED if none).
 * @param {object|null|undefined} latestRecord
 * @returns {string}
 */
export function projectCompetitionArchiveState(latestRecord) {
  if (!latestRecord || typeof latestRecord !== "object") {
    return COMPETITION_ARCHIVE_STATE.UNARCHIVED;
  }
  if (isNonEmptyString(latestRecord.toState)) {
    return latestRecord.toState;
  }
  return COMPETITION_ARCHIVE_STATE.UNARCHIVED;
}

/**
 * @param {object|null|undefined} latestRecord
 * @returns {number}
 */
export function projectCurrentArchiveRevision(latestRecord) {
  if (
    latestRecord &&
    typeof latestRecord === "object" &&
    isValidCompetitionArchiveRevision(latestRecord.revision)
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
export function computeArchiveRequestFingerprint(semantic) {
  return stableContentFingerprint({
    action: semantic.action,
    tenantId: semantic.tenantId,
    competitionId: semantic.competitionId,
    expectedArchiveRevision: semantic.expectedArchiveRevision,
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
    archivePolicyId: semantic.archivePolicyId ?? null,
    publicationContext: semantic.publicationContext,
    versionContext: semantic.versionContext,
    configurationContext: semantic.configurationContext ?? null,
    brandingContext: semantic.brandingContext ?? null,
    lifecycleContext: semantic.lifecycleContext ?? null,
    completionContext: semantic.completionContext ?? null,
    effectiveAt: semantic.effectiveAt,
    retentionAcknowledged: semantic.retentionAcknowledged ?? null,
  });
}

/**
 * Record content fingerprint (deterministic over immutable fields).
 * @param {object} recordWithoutFingerprint
 * @returns {string}
 */
export function computeArchiveRecordFingerprint(recordWithoutFingerprint) {
  const clone = clonePlain(recordWithoutFingerprint);
  delete clone.fingerprint;
  return stableContentFingerprint(clone);
}

/**
 * Build an immutable archive decision record.
 * @param {object} params
 * @returns {Readonly<object>}
 */
export function buildCompetitionArchiveRecord(params = {}) {
  const tenantId = String(params.tenantId).trim();
  const competitionId = String(params.competitionId).trim();
  const revision = params.revision;
  const recordId =
    params.recordId ??
    createCompetitionArchiveRecordId(tenantId, competitionId, revision);

  const base = {
    schemaVersion: COMPETITION_ARCHIVE_RECORD_SCHEMA_VERSION,
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
    previousRecordId: params.previousRecordId ?? null,
    manifest: params.manifest,
    effectPlan: params.effectPlan,
    idempotencyKey: params.idempotencyKey,
    requestFingerprint: params.requestFingerprint,
    createdAt: params.createdAt,
    retentionAcknowledged: params.retentionAcknowledged ?? null,
  };

  const fingerprint = computeArchiveRecordFingerprint(base);
  return deepFreeze({ ...base, fingerprint });
}

/**
 * Structural guard for stored records.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveRecord(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    v.schemaVersion === COMPETITION_ARCHIVE_RECORD_SCHEMA_VERSION &&
    isNonEmptyString(v.recordId) &&
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    isValidCompetitionArchiveRevision(v.revision) &&
    isNonEmptyString(v.action) &&
    isNonEmptyString(v.fromState) &&
    isNonEmptyString(v.toState) &&
    isNonEmptyString(v.effectiveAt) &&
    isNonEmptyString(v.fingerprint) &&
    isNonEmptyString(v.idempotencyKey) &&
    v.manifest &&
    typeof v.manifest === "object" &&
    v.effectPlan &&
    typeof v.effectPlan === "object" &&
    v.effectPlan.executed === false
  );
}

/**
 * @param {string} action
 * @param {string} fromState
 * @param {Readonly<object>} policy
 * @returns {{ ok: true, toState: string } | { ok: false, code: string, message: string }}
 */
export function resolveArchiveTransition(action, fromState, policy) {
  if (action === COMPETITION_ARCHIVE_ACTION.ARCHIVE) {
    if (fromState === COMPETITION_ARCHIVE_STATE.UNARCHIVED) {
      return { ok: true, toState: COMPETITION_ARCHIVE_STATE.ARCHIVED };
    }
    if (fromState === COMPETITION_ARCHIVE_STATE.ARCHIVED) {
      return {
        ok: false,
        code: "ALREADY_ARCHIVED",
        message: "competition is already ARCHIVED",
      };
    }
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `cannot ARCHIVE from ${fromState}`,
    };
  }

  if (action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE) {
    if (fromState === COMPETITION_ARCHIVE_STATE.UNARCHIVED) {
      return {
        ok: false,
        code: "NOT_ARCHIVED",
        message: "cannot unarchive an UNARCHIVED competition",
      };
    }
    if (policy?.unarchiveAllowed !== true) {
      return {
        ok: false,
        code: "UNARCHIVE_FORBIDDEN",
        message: "unarchive is forbidden under the selected archive policy",
      };
    }
    if (fromState === COMPETITION_ARCHIVE_STATE.ARCHIVED) {
      return { ok: true, toState: COMPETITION_ARCHIVE_STATE.UNARCHIVED };
    }
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `cannot UNARCHIVE from ${fromState}`,
    };
  }

  return {
    ok: false,
    code: "INVALID_TRANSITION",
    message: `unknown action ${action}`,
  };
}
