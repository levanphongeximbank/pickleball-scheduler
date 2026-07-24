/**
 * CORE-20 audit evidence handoff — builds sanitized envelope, does not persist.
 * Uses CORE-20 contracts only; does not invent a parallel audit store.
 */

import {
  createActorReference,
  createSubjectReference,
  createCompetitionScope,
  createAuditSource,
  sanitizeAuditPayload,
  ACTOR_KIND,
  SUBJECT_TYPE,
} from "../../../../competition-core/audit/index.js";
import { computeGovernanceFingerprint, deepFreeze } from "../fingerprint.js";
import { ISSUE_SOURCE_OWNER } from "../constants.js";

/**
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
function omitUndefined(obj) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * @param {{
 *   manifest: object,
 *   occurredAt: string,
 *   sequence: number,
 * }} input
 */
export function buildAuditEvidenceHandoff(input) {
  const manifest = input.manifest || {};
  const actorId = String(manifest.actor?.actorId || "system");
  const actorRole = String(manifest.actor?.role || "UNKNOWN");
  const competitionId = String(manifest.competitionId || "");
  const tenantId = String(manifest.tenantId || "");

  const actor = createActorReference({
    actorKind: ACTOR_KIND.USER,
    actorId,
    actorRole,
  });
  const subject = createSubjectReference({
    subjectType: SUBJECT_TYPE.COMPETITION,
    subjectId: competitionId,
    competitionId,
  });
  const competitionScope = createCompetitionScope({
    competitionId,
  });
  const source = createAuditSource({
    capability: "GOV-02",
    moduleId: ISSUE_SOURCE_OWNER.E2E06,
  });

  const { sanitized, redactionMetadata } = sanitizeAuditPayload(
    omitUndefined({
      tenantId,
      operation: manifest.operation || null,
      fingerprint: manifest.fingerprint || null,
      sourceRevision: manifest.sourceRevision || null,
      workflowRevision: manifest.workflowRevision || null,
      lifecycleRevision: manifest.lifecycleRevision || null,
      publicationRevision: manifest.publicationRevision || null,
      resultValidationRevision: manifest.resultValidationRevision || null,
      standingsFingerprint: manifest.standingsFingerprint || null,
      replaySeedPresent: Boolean(manifest.replaySeed),
      recoveryCheckpointPresent: Boolean(manifest.recoveryCheckpoint),
      exportChecksumPresent: Boolean(manifest.exportChecksum),
      decisionResult: manifest.decisionResult || null,
      issueCodes: Array.isArray(manifest.issues)
        ? manifest.issues.map((i) => i.code)
        : [],
      sequence: input.sequence,
      occurredAt: input.occurredAt,
    })
  );

  const contentFingerprint = computeGovernanceFingerprint(
    {
      eventType: "GOVERNANCE.RELIABILITY_EVIDENCE",
      source,
      occurredAt: input.occurredAt,
      competitionScope,
      streamKey: `governance:${competitionId}`,
      sequence: input.sequence,
      actor,
      subject,
      safePayload: sanitized,
      redactionMetadata,
    },
    "e2e06-audit-handoff"
  );

  return deepFreeze({
    kind: "CORE20_AUDIT_HANDOFF",
    ownsPersistence: false,
    persistenceSideEffect: false,
    actor,
    subject,
    competitionScope,
    source,
    occurredAt: input.occurredAt,
    sequence: input.sequence,
    safePayload: sanitized,
    redactionMetadata,
    contentFingerprint,
    sourceOwner: ISSUE_SOURCE_OWNER.CORE20,
    note: "Integrator may append via CORE-20 sink; E2E-06 does not persist.",
  });
}
