/**
 * Canonical reliability policy evaluator for IND Pool+Knockout MVP.
 * Explicit, versioned, deterministic, fail-closed. Does not recompute standings/bracket.
 */

import {
  DEGRADED_CONTINUATION,
  DEPENDENCY_STATUS,
  E2E06_RELIABILITY_POLICY_VERSION,
  ISSUE_SEVERITY,
  ISSUE_SOURCE_OWNER,
  LIFECYCLE_PROJECTION,
  RELIABILITY_ISSUE_CODE,
  RUNTIME_HEALTH_STATE,
} from "../constants.js";
import { computeGovernanceFingerprint, deepFreeze, isNonEmptyString } from "../fingerprint.js";

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
 * @param {{
 *   code: string,
 *   severity: string,
 *   message: string,
 *   sourceOwner: string,
 *   continuation?: string,
 *   details?: Record<string, unknown>,
 * }} issue
 */
function makeIssue(issue) {
  return Object.freeze({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    sourceOwner: issue.sourceOwner,
    continuation: issue.continuation || null,
    details: Object.freeze({ ...(issue.details || {}) }),
  });
}

/**
 * Stable issue ordering: severity rank → code → message.
 * @param {ReadonlyArray<object>} issues
 */
export function sortReliabilityIssues(issues) {
  const rank = {
    [ISSUE_SEVERITY.CRITICAL]: 0,
    [ISSUE_SEVERITY.BLOCKING]: 1,
    [ISSUE_SEVERITY.WARNING]: 2,
    [ISSUE_SEVERITY.INFO]: 3,
  };
  return [...(issues || [])].sort((a, b) => {
    const ra = rank[a.severity] ?? 9;
    const rb = rank[b.severity] ?? 9;
    if (ra !== rb) return ra - rb;
    const ca = String(a.code || "");
    const cb = String(b.code || "");
    if (ca < cb) return -1;
    if (ca > cb) return 1;
    const ma = String(a.message || "");
    const mb = String(b.message || "");
    if (ma < mb) return -1;
    if (ma > mb) return 1;
    return 0;
  });
}

/**
 * @param {object} record
 * @param {{ requiredPorts?: string[] }} [options]
 */
export function evaluateReliabilityPolicy(record, options = {}) {
  const r = asObject(record);
  const deps = asObject(r.dependencies);
  const issues = [];

  const requiredPorts = Array.isArray(options.requiredPorts)
    ? options.requiredPorts
    : ["identity", "workflow", "audit", "replay", "recovery"];

  for (const portName of requiredPorts) {
    const status = String(deps[portName] || DEPENDENCY_STATUS.UNKNOWN);
    if (status === DEPENDENCY_STATUS.UNAVAILABLE) {
      issues.push(
        makeIssue({
          code: RELIABILITY_ISSUE_CODE.MISSING_PORTS,
          severity: ISSUE_SEVERITY.BLOCKING,
          message: `Required canonical port unavailable: ${portName}`,
          sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
          continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
          details: { portName, status },
        })
      );
    }
  }

  if (!isNonEmptyString(r.tenantId)) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.MISSING_TENANT,
        severity: ISSUE_SEVERITY.CRITICAL,
        message: "tenantId missing from governance record",
        sourceOwner: ISSUE_SOURCE_OWNER.E2E01,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }
  if (!isNonEmptyString(r.competitionId)) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.MISSING_COMPETITION,
        severity: ISSUE_SEVERITY.CRITICAL,
        message: "competitionId missing from governance record",
        sourceOwner: ISSUE_SOURCE_OWNER.E2E01,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const workflow = asObject(r.workflow);
  if (workflow.consistent === false) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.WORKFLOW_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Workflow state inconsistent with canonical CORE-19 evidence",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE19,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const lifecycle = asObject(r.lifecycle);
  const lifecycleState = String(lifecycle.state || "");
  if (lifecycle.consistent === false) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.LIFECYCLE_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Lifecycle state inconsistent with CM-07 evidence",
        sourceOwner: ISSUE_SOURCE_OWNER.CM07,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const publication = asObject(r.publication);
  if (publication.consistent === false) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.PUBLICATION_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Publication state inconsistent with CM-06 evidence",
        sourceOwner: ISSUE_SOURCE_OWNER.CM06,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const participantLock = asObject(r.participantLock);
  if (participantLock.required === true && participantLock.locked !== true) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.PARTICIPANT_LOCK_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Participant field lock required but not locked",
        sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const scheduleCourt = asObject(r.scheduleCourt);
  if (scheduleCourt.required === true && scheduleCourt.certified !== true) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.SCHEDULE_COURT_UNCERTIFIED,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Schedule/court certification missing",
        sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const scoring = asObject(r.scoring);
  const resultValidation = asObject(r.resultValidation);
  if (
    scoring.required === true &&
    (scoring.ready !== true || resultValidation.ready !== true)
  ) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.SCORING_VALIDATION_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Scoring/result validation evidence incomplete",
        sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
        details: {
          scoringReady: scoring.ready === true,
          validationReady: resultValidation.ready === true,
        },
      })
    );
  }

  const standings = asObject(r.standings);
  const qualification = asObject(r.qualification);
  if (
    standings.required === true &&
    (standings.ready !== true ||
      (qualification.required === true && qualification.ready !== true))
  ) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.STANDINGS_QUAL_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Standings/qualification evidence incomplete",
        sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const finalResult = asObject(r.finalResult);
  if (finalResult.required === true && finalResult.ready !== true) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.FINAL_PUBLICATION_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Final result / final publication evidence missing",
        sourceOwner: ISSUE_SOURCE_OWNER.CM06,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const audit = asObject(r.audit);
  if (audit.required !== false && audit.evidencePresent !== true) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.AUDIT_EVIDENCE_MISSING,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Audit evidence missing (CORE-20 handoff required)",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE20,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const replay = asObject(r.replay);
  if (replay.required === true && !isNonEmptyString(replay.seed)) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.REPLAY_SEED_MISSING,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Explicit replay seed missing (CORE-21)",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE21,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }
  if (replay.lineageConflict === true) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.REPLAY_LINEAGE_CONFLICT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Replay event lineage conflict detected",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE21,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }

  const recovery = asObject(r.recovery);
  if (recovery.required === true && recovery.checkpointPresent !== true) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.RECOVERY_CHECKPOINT_MISSING,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Recovery checkpoint missing (CORE-23)",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE23,
        continuation: DEGRADED_CONTINUATION.HARD_BLOCK,
      })
    );
  }
  if (recovery.conflict === true) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.RECOVERY_CONFLICT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Conflicting recovery request",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE23,
        continuation: DEGRADED_CONTINUATION.MANUAL_INTERVENTION_REQUIRED,
      })
    );
  }

  // Soft / degraded dependency signals (safe partial).
  const softDeps = [
    "ratingSnapshot",
    "venueCourt",
    "publicProjection",
    "importExport",
  ];
  for (const name of softDeps) {
    const status = String(deps[name] || DEPENDENCY_STATUS.AVAILABLE);
    if (status === DEPENDENCY_STATUS.UNAVAILABLE) {
      issues.push(
        makeIssue({
          code: RELIABILITY_ISSUE_CODE.DEGRADED_SAFE_PARTIAL,
          severity: ISSUE_SEVERITY.WARNING,
          message: `Optional dependency unavailable: ${name}`,
          sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
          continuation: DEGRADED_CONTINUATION.CONTINUE_SAFE,
          details: { dependency: name, status },
        })
      );
    } else if (status === DEPENDENCY_STATUS.PARTIAL) {
      issues.push(
        makeIssue({
          code: RELIABILITY_ISSUE_CODE.DEPENDENCY_UNAVAILABLE,
          severity: ISSUE_SEVERITY.WARNING,
          message: `Dependency partially available: ${name}`,
          sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
          continuation: DEGRADED_CONTINUATION.READ_ONLY_FALLBACK,
          details: { dependency: name, status },
        })
      );
    }
  }

  if (String(deps.auditPersistence) === DEPENDENCY_STATUS.UNAVAILABLE) {
    issues.push(
      makeIssue({
        code: RELIABILITY_ISSUE_CODE.DEPENDENCY_UNAVAILABLE,
        severity: ISSUE_SEVERITY.WARNING,
        message: "Audit persistence unavailable — handoff-only mode",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE20,
        continuation: DEGRADED_CONTINUATION.READ_ONLY_FALLBACK,
        details: { dependency: "auditPersistence" },
      })
    );
  }

  const sorted = sortReliabilityIssues(issues);
  const blocking = sorted.filter(
    (i) =>
      i.severity === ISSUE_SEVERITY.BLOCKING ||
      i.severity === ISSUE_SEVERITY.CRITICAL
  );
  const warnings = sorted.filter((i) => i.severity === ISSUE_SEVERITY.WARNING);

  let healthState = RUNTIME_HEALTH_STATE.READY;
  if (lifecycleState === LIFECYCLE_PROJECTION.ARCHIVED) {
    healthState = RUNTIME_HEALTH_STATE.ARCHIVED;
  } else if (lifecycleState === LIFECYCLE_PROJECTION.SUSPENDED) {
    healthState = RUNTIME_HEALTH_STATE.SUSPENDED;
  } else if (recovery.inProgress === true) {
    healthState = RUNTIME_HEALTH_STATE.RECOVERING;
  } else if (lifecycleState === LIFECYCLE_PROJECTION.COMPLETED) {
    const archive = asObject(r.archive);
    healthState =
      archive.ready === true
        ? RUNTIME_HEALTH_STATE.ARCHIVE_READY
        : RUNTIME_HEALTH_STATE.COMPLETED;
  } else if (blocking.length > 0) {
    healthState = RUNTIME_HEALTH_STATE.BLOCKED;
  } else if (warnings.length > 0) {
    healthState = RUNTIME_HEALTH_STATE.DEGRADED;
  }

  const fingerprint = computeGovernanceFingerprint(
    {
      policyVersion: E2E06_RELIABILITY_POLICY_VERSION,
      tenantId: r.tenantId,
      competitionId: r.competitionId,
      healthState,
      issues: sorted.map((i) => ({
        code: i.code,
        severity: i.severity,
        message: i.message,
      })),
    },
    "e2e06-policy"
  );

  return deepFreeze({
    policyVersion: E2E06_RELIABILITY_POLICY_VERSION,
    healthState,
    ready: healthState === RUNTIME_HEALTH_STATE.READY,
    blocked: blocking.length > 0,
    degraded: healthState === RUNTIME_HEALTH_STATE.DEGRADED,
    issues: sorted,
    blockingIssues: blocking,
    warnings,
    fingerprint,
  });
}
