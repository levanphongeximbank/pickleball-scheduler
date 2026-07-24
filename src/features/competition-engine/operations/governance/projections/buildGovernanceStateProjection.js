/**
 * Governance state projection — read-model over explicit evidence snapshot.
 * Does not recompute standings, winners, brackets, or schedules.
 */

import { LIFECYCLE_PROJECTION, RUNTIME_HEALTH_STATE } from "../constants.js";
import {
  computeGovernanceFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "../fingerprint.js";
import { evaluateReliabilityPolicy } from "../policy/reliabilityPolicy.js";
import { buildDegradedModeProjection } from "../policy/degradedModePolicy.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {boolean} ready
 * @param {string} [reason]
 */
function readinessFlag(ready, reason = null) {
  return Object.freeze({
    ready: ready === true,
    reason: reason || null,
  });
}

/**
 * @param {object} record
 * @param {object} [authz]
 */
export function buildGovernanceStateProjection(record, authz = {}) {
  const r = asObject(record);
  const policy = evaluateReliabilityPolicy(r);
  const degraded = buildDegradedModeProjection(r, policy);

  const lifecycleState = String(
    asObject(r.lifecycle).state || LIFECYCLE_PROJECTION.ACTIVE
  );

  const allowedActions = [];
  const deniedActions = [];

  const candidates = [
    "governance.read",
    "governance.reliability.evaluate",
    "governance.export.evaluate",
    "governance.evidence.build",
    "governance.certification.read",
    "governance.replay.evaluate",
    "governance.import.evaluate",
    "governance.recovery.evaluate",
    "governance.archive.evaluate",
  ];

  for (const action of candidates) {
    if (lifecycleState === LIFECYCLE_PROJECTION.ARCHIVED) {
      if (
        action.includes("import") ||
        action.includes("recovery") ||
        action.includes("archive.evaluate")
      ) {
        deniedActions.push(
          Object.freeze({
            action,
            reason: "ARCHIVED_DESTRUCTIVE_DENIED",
          })
        );
        continue;
      }
    }
    if (
      lifecycleState === LIFECYCLE_PROJECTION.SUSPENDED &&
      action.includes("archive")
    ) {
      deniedActions.push(
        Object.freeze({
          action,
          reason: "SUSPENDED_ARCHIVE_DENIED",
        })
      );
      continue;
    }
    allowedActions.push(action);
  }

  const projection = {
    tenantId: isNonEmptyString(r.tenantId) ? String(r.tenantId) : null,
    competitionId: isNonEmptyString(r.competitionId)
      ? String(r.competitionId)
      : null,
    definition: Object.freeze({
      version: asObject(r.definition).version || null,
      ruleSetVersion: asObject(r.definition).ruleSetVersion || null,
      configurationFingerprint:
        asObject(r.definition).configurationFingerprint || null,
    }),
    publication: Object.freeze({ ...asObject(r.publication) }),
    lifecycle: Object.freeze({ ...asObject(r.lifecycle) }),
    workflow: Object.freeze({ ...asObject(r.workflow) }),
    participantLock: readinessFlag(
      asObject(r.participantLock).locked === true,
      asObject(r.participantLock).locked === true ? null : "NOT_LOCKED"
    ),
    scheduleCourtCertification: readinessFlag(
      asObject(r.scheduleCourt).certified === true,
      asObject(r.scheduleCourt).certified === true ? null : "UNCERTIFIED"
    ),
    checkInReadiness: readinessFlag(asObject(r.checkIn).ready === true),
    refereeAssignmentReadiness: readinessFlag(
      asObject(r.refereeAssignment).ready === true
    ),
    scoringReadiness: readinessFlag(asObject(r.scoring).ready === true),
    resultValidationReadiness: readinessFlag(
      asObject(r.resultValidation).ready === true
    ),
    standingsReadiness: readinessFlag(asObject(r.standings).ready === true),
    qualificationReadiness: readinessFlag(
      asObject(r.qualification).ready === true
    ),
    finalResultReadiness: readinessFlag(asObject(r.finalResult).ready === true),
    archiveReadiness: readinessFlag(asObject(r.archive).ready === true),
    auditReadiness: readinessFlag(asObject(r.audit).evidencePresent === true),
    replayReadiness: readinessFlag(isNonEmptyString(asObject(r.replay).seed)),
    importExportReadiness: readinessFlag(
      asObject(r.importExport).ready === true
    ),
    recoveryResumeReadiness: readinessFlag(
      asObject(r.recovery).checkpointPresent === true
    ),
    publicVisibilityReadiness: readinessFlag(
      asObject(r.publicVisibility).ready === true
    ),
    degradedMode: degraded,
    healthState: policy.healthState,
    blockingIssues: policy.blockingIssues,
    warnings: policy.warnings,
    evidenceReferences: Object.freeze([
      ...(Array.isArray(r.evidenceRefs) ? r.evidenceRefs : []),
    ]),
    allowedActions: Object.freeze(allowedActions),
    deniedActions: Object.freeze(deniedActions),
    actor: authz.subject
      ? Object.freeze({ ...authz.subject })
      : null,
    capability: authz.capability || null,
  };

  const fingerprint = computeGovernanceFingerprint(
    {
      tenantId: projection.tenantId,
      competitionId: projection.competitionId,
      healthState: projection.healthState,
      lifecycle: projection.lifecycle,
      publication: projection.publication,
      blocking: projection.blockingIssues.map((i) => i.code),
      warnings: projection.warnings.map((i) => i.code),
    },
    "e2e06-state"
  );

  return deepFreeze({
    ...projection,
    fingerprint,
    policyFingerprint: policy.fingerprint,
    healthExplanation: Object.freeze({
      healthState: policy.healthState || RUNTIME_HEALTH_STATE.BLOCKED,
      blockingEvidence: policy.blockingIssues.map((i) =>
        Object.freeze({
          code: i.code,
          message: i.message,
          sourceOwner: i.sourceOwner,
        })
      ),
      warningEvidence: policy.warnings.map((i) =>
        Object.freeze({
          code: i.code,
          message: i.message,
          sourceOwner: i.sourceOwner,
        })
      ),
    }),
  });
}
