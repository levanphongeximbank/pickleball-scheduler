/**
 * CM-06/07/08 readiness handoffs — evaluate only, no direct mutation/delete/purge.
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
} from "../fingerprint.js";

/**
 * @param {object} record
 * @param {object} [query]
 */
export function evaluatePublicationGovernanceReadiness(record, query = {}) {
  const publication =
    record?.publication && typeof record.publication === "object"
      ? record.publication
      : {};
  const issues = [];

  if (publication.consistent === false) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.PUBLICATION_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Publication evidence inconsistent",
        sourceOwner: ISSUE_SOURCE_OWNER.CM06,
      })
    );
  }

  if (query.requireFinal === true && record?.finalResult?.ready !== true) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.FINAL_PUBLICATION_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Final publication evidence missing",
        sourceOwner: ISSUE_SOURCE_OWNER.CM06,
      })
    );
  }

  const ready = issues.length === 0 && publication.ready !== false;
  return deepFreeze({
    ready,
    blocked: !ready,
    issues,
    publicationState: publication.state || null,
    revision: publication.revision || null,
    mutatesPublication: false,
    cm06Handoff: true,
    fingerprint: computeGovernanceFingerprint(
      { ready, state: publication.state, issues: issues.map((i) => i.code) },
      "e2e06-publication"
    ),
  });
}

/**
 * @param {object} record
 */
export function evaluateCompletionReadiness(record) {
  const lifecycle = record?.lifecycle || {};
  const issues = [];
  const state = String(lifecycle.state || "");

  if (state === LIFECYCLE_PROJECTION.CANCELLED) {
    // Cancelled is a valid completion path (policy), not ACTIVE archive.
    return deepFreeze({
      ready: true,
      blocked: false,
      path: "CANCELLED",
      issues: Object.freeze([]),
      requiresFinalResult: false,
      mutatesLifecycle: false,
      cm07Handoff: true,
      fingerprint: computeGovernanceFingerprint(
        { ready: true, path: "CANCELLED" },
        "e2e06-completion"
      ),
    });
  }

  if (record?.finalResult?.ready !== true) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.FINAL_PUBLICATION_INCONSISTENT,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Completion requires final result evidence",
        sourceOwner: ISSUE_SOURCE_OWNER.CM06,
      })
    );
  }
  if (record?.audit?.evidencePresent !== true) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.AUDIT_EVIDENCE_MISSING,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Completion requires audit evidence",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE20,
      })
    );
  }

  const ready =
    issues.length === 0 &&
    (state === LIFECYCLE_PROJECTION.COMPLETED ||
      state === LIFECYCLE_PROJECTION.ACTIVE);

  return deepFreeze({
    ready,
    blocked: !ready,
    path: "COMPLETED",
    issues,
    requiresFinalResult: true,
    mutatesLifecycle: false,
    cm07Handoff: true,
    fingerprint: computeGovernanceFingerprint(
      { ready, path: "COMPLETED", issues: issues.map((i) => i.code) },
      "e2e06-completion"
    ),
  });
}

/**
 * @param {object} record
 */
export function evaluateArchiveGovernanceReadiness(record) {
  const lifecycle = record?.lifecycle || {};
  const state = String(lifecycle.state || "");
  const issues = [];

  if (state === LIFECYCLE_PROJECTION.ARCHIVED) {
    return deepFreeze({
      ready: false,
      alreadyArchived: true,
      blocked: true,
      issues: Object.freeze([
        Object.freeze({
          code: RELIABILITY_ISSUE_CODE.ARCHIVE_NOT_READY,
          severity: ISSUE_SEVERITY.INFO,
          message: "Competition already archived",
          sourceOwner: ISSUE_SOURCE_OWNER.CM08,
        }),
      ]),
      mutatesArchive: false,
      deleteOrPurge: false,
      cm08Handoff: true,
      fingerprint: computeGovernanceFingerprint(
        { ready: false, alreadyArchived: true },
        "e2e06-archive"
      ),
    });
  }

  if (state === LIFECYCLE_PROJECTION.ACTIVE) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.ARCHIVE_ACTIVE_BLOCKED,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "ACTIVE competition is not archive-ready",
        sourceOwner: ISSUE_SOURCE_OWNER.CM08,
      })
    );
  }

  if (state === LIFECYCLE_PROJECTION.SUSPENDED) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.ARCHIVE_SUSPENDED_BLOCKED,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "SUSPENDED competition cannot archive under MVP policy",
        sourceOwner: ISSUE_SOURCE_OWNER.CM08,
      })
    );
  }

  if (
    state === LIFECYCLE_PROJECTION.COMPLETED ||
    state === LIFECYCLE_PROJECTION.CANCELLED
  ) {
    if (
      state === LIFECYCLE_PROJECTION.COMPLETED &&
      record?.finalResult?.ready !== true
    ) {
      issues.push(
        Object.freeze({
          code: RELIABILITY_ISSUE_CODE.FINAL_PUBLICATION_INCONSISTENT,
          severity: ISSUE_SEVERITY.BLOCKING,
          message: "COMPLETED archive requires final result evidence",
          sourceOwner: ISSUE_SOURCE_OWNER.CM06,
        })
      );
    }
    if (record?.audit?.evidencePresent !== true) {
      issues.push(
        Object.freeze({
          code: RELIABILITY_ISSUE_CODE.AUDIT_EVIDENCE_MISSING,
          severity: ISSUE_SEVERITY.BLOCKING,
          message: "Archive requires audit evidence",
          sourceOwner: ISSUE_SOURCE_OWNER.CORE20,
        })
      );
    }
  }

  const ready =
    issues.length === 0 &&
    (state === LIFECYCLE_PROJECTION.COMPLETED ||
      state === LIFECYCLE_PROJECTION.CANCELLED);

  return deepFreeze({
    ready,
    alreadyArchived: false,
    blocked: !ready,
    issues,
    lifecycleState: state,
    mutatesArchive: false,
    deleteOrPurge: false,
    cm08Handoff: true,
    fingerprint: computeGovernanceFingerprint(
      {
        ready,
        lifecycleState: state,
        issues: issues.map((i) => i.code),
      },
      "e2e06-archive"
    ),
  });
}
