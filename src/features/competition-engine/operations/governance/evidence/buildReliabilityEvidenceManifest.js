/**
 * Reliability evidence manifest — CORE-20 handoff shape (no new persistence).
 * Excludes secrets, tokens, binary/base64, raw private profiles, client grants.
 */

import {
  GOVERNANCE_FORBIDDEN_PUBLIC_KEYS,
  ISSUE_SOURCE_OWNER,
} from "../constants.js";
import {
  computeGovernanceFingerprint,
  deepFreeze,
  isNonEmptyString,
  stripForbiddenKeys,
} from "../fingerprint.js";
import { buildAuditEvidenceHandoff } from "../adapters/handoffCore20Audit.js";

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
 *   record: object,
 *   action?: string,
 *   actor?: object,
 *   authz?: object,
 *   decision?: object,
 *   issues?: object[],
 * }} input
 */
export function buildReliabilityEvidenceManifest(input) {
  const record = asObject(input.record);
  const actor = asObject(input.actor);
  const authz = asObject(input.authz);
  const decision = asObject(input.decision);
  const issues = Array.isArray(input.issues) ? input.issues : [];

  const safeActor = stripForbiddenKeys(
    {
      actorId: actor.actorId || authz.subject?.actorId || null,
      role: actor.role || authz.subject?.role || null,
    },
    GOVERNANCE_FORBIDDEN_PUBLIC_KEYS
  );

  const manifest = {
    competitionId: isNonEmptyString(record.competitionId)
      ? String(record.competitionId)
      : null,
    tenantId: isNonEmptyString(record.tenantId)
      ? String(record.tenantId)
      : null,
    operation: input.action || null,
    actor: safeActor,
    sourceRevision: asObject(record.definition).version || null,
    workflowRevision: asObject(record.workflow).revision || null,
    lifecycleRevision: asObject(record.lifecycle).revision || null,
    publicationRevision: asObject(record.publication).revision || null,
    resultValidationRevision:
      asObject(record.resultValidation).revision || null,
    standingsFingerprint: asObject(record.standings).fingerprint || null,
    replaySeed: isNonEmptyString(asObject(record.replay).seed)
      ? String(asObject(record.replay).seed)
      : null,
    recoveryCheckpoint:
      asObject(record.recovery).checkpointFingerprint || null,
    exportChecksum: asObject(record.importExport).exportChecksum || null,
    decisionResult: stripForbiddenKeys(
      {
        allowed: decision.allowed ?? null,
        healthState: decision.healthState ?? null,
        ready: decision.ready ?? null,
      },
      GOVERNANCE_FORBIDDEN_PUBLIC_KEYS
    ),
    issues: issues.map((i) =>
      Object.freeze({
        code: i.code,
        severity: i.severity,
        message: i.message,
        sourceOwner: i.sourceOwner || ISSUE_SOURCE_OWNER.E2E06,
      })
    ),
  };

  const fingerprint = computeGovernanceFingerprint(
    manifest,
    "e2e06-evidence"
  );

  const auditHandoff = buildAuditEvidenceHandoff({
    manifest: { ...manifest, fingerprint },
    occurredAt: input.occurredAt || "2026-07-24T00:00:00.000Z",
    sequence: Number.isFinite(input.sequence) ? input.sequence : 1,
  });

  return deepFreeze({
    ...manifest,
    fingerprint,
    auditHandoff,
    persistenceSideEffect: false,
    ownsAuditStorage: false,
    sourceOwner: ISSUE_SOURCE_OWNER.CORE20,
  });
}
