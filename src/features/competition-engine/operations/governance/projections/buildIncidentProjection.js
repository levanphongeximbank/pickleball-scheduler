/**
 * Incident projection — competition-scoped operational incident view.
 * NOT a platform-wide incident management system (PGO owns that).
 * OPS-11 remains DEFERRED for full workflow; this is readiness/evidence only.
 */

import { ISSUE_SOURCE_OWNER } from "../constants.js";
import { computeGovernanceFingerprint, deepFreeze } from "../fingerprint.js";

/**
 * @param {object} record
 * @param {object} policyResult
 */
export function buildIncidentProjection(record, policyResult = {}) {
  const blocking = Array.isArray(policyResult.blockingIssues)
    ? policyResult.blockingIssues
    : [];
  const warnings = Array.isArray(policyResult.warnings)
    ? policyResult.warnings
    : [];

  const incidents = [
    ...blocking.map((issue, index) =>
      Object.freeze({
        id: `blocking:${issue.code}:${index}`,
        kind: "BLOCKING",
        code: issue.code,
        message: issue.message,
        sourceOwner: issue.sourceOwner || ISSUE_SOURCE_OWNER.E2E06,
        severity: issue.severity,
        platformHandoffRequired: false,
      })
    ),
    ...warnings.map((issue, index) =>
      Object.freeze({
        id: `warning:${issue.code}:${index}`,
        kind: "WARNING",
        code: issue.code,
        message: issue.message,
        sourceOwner: issue.sourceOwner || ISSUE_SOURCE_OWNER.E2E06,
        severity: issue.severity,
        platformHandoffRequired: false,
      })
    ),
  ];

  const fingerprint = computeGovernanceFingerprint(
    {
      tenantId: record?.tenantId,
      competitionId: record?.competitionId,
      incidents: incidents.map((i) => ({ id: i.id, code: i.code })),
    },
    "e2e06-incident"
  );

  return deepFreeze({
    scope: "competition",
    ownsPlatformIncidentManagement: false,
    platformOwner: "platform-governance-operations",
    count: incidents.length,
    incidents,
    fingerprint,
  });
}
