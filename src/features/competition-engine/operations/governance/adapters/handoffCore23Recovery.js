/**
 * CORE-23 recovery/resume governance readiness — no direct match resume / state mutation.
 */

import {
  ISSUE_SEVERITY,
  ISSUE_SOURCE_OWNER,
  LIFECYCLE_PROJECTION,
  RELIABILITY_ISSUE_CODE,
} from "../constants.js";
import {
  computeGovernanceFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "../fingerprint.js";

/**
 * @param {object} record
 * @param {object} [query]
 * @param {object} [authz]
 */
export function evaluateRecoveryReadiness(record, query = {}, authz = {}) {
  const recovery =
    record?.recovery && typeof record.recovery === "object"
      ? record.recovery
      : {};
  const issues = [];

  const checkpointPresent =
    recovery.checkpointPresent === true ||
    isNonEmptyString(query.checkpointFingerprint) ||
    isNonEmptyString(recovery.checkpointFingerprint);

  if (!checkpointPresent) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.RECOVERY_CHECKPOINT_MISSING,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Recovery checkpoint required (CORE-23)",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE23,
      })
    );
  }

  if (recovery.conflict === true || query.conflict === true) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.RECOVERY_CONFLICT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Conflicting recovery request",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE23,
      })
    );
  }

  const resumeTarget =
    query.resumeTarget || recovery.resumeTarget || recovery.target || null;
  if (query.requireResumeTarget === true && !isNonEmptyString(resumeTarget)) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.RECOVERY_CONFLICT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Resume target validation failed",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE23,
      })
    );
  }

  const lifecycleState = String(record?.lifecycle?.state || "");
  if (lifecycleState === LIFECYCLE_PROJECTION.ARCHIVED) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.HARD_BLOCK,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Recovery not permitted on archived competition without unarchive",
        sourceOwner: ISSUE_SOURCE_OWNER.CM08,
      })
    );
  }

  // Authority is enforced by authorizeGovernanceCommand (elevated perms).
  // Here we only project readiness once authorized.
  const elevated = authz.elevated === true;
  const fingerprint = computeGovernanceFingerprint(
    {
      ready: issues.length === 0,
      checkpointPresent,
      resumeTarget,
      workflowStatus: record?.workflow?.status || null,
      lifecycleState,
      recoveryReason: query.reason || recovery.reason || null,
      idempotencyKey: query.idempotencyKey || recovery.idempotencyKey || null,
      issues: issues.map((i) => i.code),
    },
    "e2e06-recovery"
  );

  return deepFreeze({
    ready: issues.length === 0,
    blocked: issues.length > 0,
    issues,
    checkpointPresent,
    workflowState: record?.workflow?.status || null,
    lifecycleState,
    recoveryReason: query.reason || recovery.reason || null,
    actorAuthorityElevated: elevated,
    replaySeedPresent: isNonEmptyString(record?.replay?.seed),
    auditEvidencePresent: record?.audit?.evidencePresent === true,
    idempotent: true,
    conflictDetected: recovery.conflict === true || query.conflict === true,
    resumeTarget,
    recoveryCompletion: recovery.completed === true,
    mutatesState: false,
    directMatchResume: false,
    ownsRecoveryEngine: false,
    core23Handoff: true,
    core19WorkflowHandoff: true,
    fingerprint,
  });
}
