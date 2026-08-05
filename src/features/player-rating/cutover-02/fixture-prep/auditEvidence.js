/**
 * Redacted audit / evidence builders for A3c fixture preparation.
 */

import { sanitizeEvidenceValue, evidenceContainsForbiddenPii } from "../evidence/sanitizeEvidence.js";
import {
  FIXTURE_PREP_VERSION,
  MAPPING_STATUS,
  NORMALIZED_EQUIVALENCE,
  V2_SCALE_ID,
  V5_SCALE_ID,
} from "./constants.js";

/**
 * @param {Record<string, unknown>} raw
 */
export function buildRedactedPrepAudit(raw = {}) {
  const payload = {
    kind: "cutover_02_a3c_fixture_prep",
    candidateLabel: raw.candidateLabel ?? null,
    candidateIdHash: raw.candidateIdHash ?? null,
    cohortLabel: raw.cohortLabel ?? null,
    preparationVersion: raw.preparationVersion ?? FIXTURE_PREP_VERSION,
    projectRef: raw.projectRef ?? null,
    environment: raw.environment ?? "staging",
    outcome: raw.outcome ?? null,
    beforeStateFingerprint: raw.beforeStateFingerprint ?? null,
    afterStateFingerprint: raw.afterStateFingerprint ?? null,
    v2Raw: raw.v2Raw ?? null,
    v5ScorerOutput: raw.v5ScorerOutput ?? null,
    v2ScaleId: V2_SCALE_ID,
    v5ScaleId: V5_SCALE_ID,
    mappingStatus: MAPPING_STATUS,
    normalizedEquivalence: NORMALIZED_EQUIVALENCE,
    createdUpdatedRowCounts: raw.createdUpdatedRowCounts ?? {},
    idempotencyOutcome: raw.idempotencyOutcome ?? raw.outcome ?? null,
    rollbackHandle: raw.rollbackHandle ?? null,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    errorClassification: raw.errorClassification ?? null,
    // caller identity only for internal audit sinks — never email
    callerIdHash: raw.callerIdHash ?? null,
  };

  const redacted = sanitizeEvidenceValue(payload);
  return {
    payload: redacted,
    containsForbiddenPii: evidenceContainsForbiddenPii(redacted),
  };
}

export function buildStateFingerprint(parts = {}) {
  const keys = [
    "enrollment",
    "v2",
    "assessment",
    "event",
    "profile",
    "prepAudit",
  ];
  const normalized = {};
  for (const key of keys) {
    normalized[key] = parts[key] == null ? "absent" : String(parts[key]);
  }
  return JSON.stringify(normalized);
}
