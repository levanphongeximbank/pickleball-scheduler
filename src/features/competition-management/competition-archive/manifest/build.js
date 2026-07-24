/**
 * Deterministic archive manifest projection (CM-08).
 *
 * Safe metadata summary only — no secrets, dumps, retention jobs, or
 * production runtime state. Same semantic input + same clock → same fingerprint.
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionArchiveError } from "../errors/CompetitionArchiveError.js";
import {
  COMPETITION_ARCHIVE_MANIFEST_SCHEMA_VERSION,
  COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM,
} from "../constants/comparison.js";
import {
  deepFreeze,
  stableContentFingerprint,
  isNonEmptyString,
  collectForbiddenManifestMarkers,
} from "../contracts/shared.js";

/**
 * @param {object} params
 * @returns {Readonly<object>}
 */
export function buildCompetitionArchiveManifest(params = {}) {
  const forbiddenHits = collectForbiddenManifestMarkers(params);
  if (forbiddenHits.length > 0) {
    throw new CompetitionArchiveError(
      COMPETITION_ARCHIVE_ERROR_CODE.MALFORMED_MANIFEST,
      "manifest params contain forbidden markers — only explicit safe fields are allowed",
      { paths: forbiddenHits.slice(0, 20) }
    );
  }

  const {
    recordId,
    tenantId,
    competitionId,
    archiveRevision,
    action,
    source,
    finalizationSummary,
    publicationContext,
    versionContext,
    configurationContext,
    brandingContext,
    reason,
    archivePolicy,
    actor,
    authority,
    effectiveAt,
    retentionClassification,
    integrationIntentSummary,
    clock,
  } = params;

  if (
    !isNonEmptyString(recordId) ||
    !isNonEmptyString(tenantId) ||
    !isNonEmptyString(competitionId) ||
    !isNonEmptyString(action) ||
    !isNonEmptyString(effectiveAt)
  ) {
    throw new CompetitionArchiveError(
      COMPETITION_ARCHIVE_ERROR_CODE.MALFORMED_MANIFEST,
      "manifest requires recordId, tenantId, competitionId, action, effectiveAt",
      {}
    );
  }

  const actorRef = actor
    ? {
        actorId: actor.actorId,
        actorType: actor.actorType,
        tenantId: actor.tenantId,
        roleReference: actor.roleReference ?? null,
      }
    : null;

  const authorityRef = authority
    ? {
        authorizationDecision: authority.authorizationDecision,
        authorizationPolicyId: authority.authorizationPolicyId,
        authorizationPolicyVersion: authority.authorizationPolicyVersion,
        decisionReference: authority.decisionReference,
        authorityScope: authority.authorityScope ?? null,
        elevated: authority.elevated === true,
      }
    : null;

  const publicationRef = publicationContext
    ? {
        presence: publicationContext.presence,
        publicationId: publicationContext.publicationId ?? null,
        publicationRevision: publicationContext.publicationRevision ?? null,
        channel: publicationContext.channel ?? null,
      }
    : null;

  const versionRef = versionContext
    ? {
        presence: versionContext.presence ?? "PRESENT",
        competitionVersionId: versionContext.competitionVersionId ?? null,
        versionNumber: versionContext.versionNumber ?? null,
      }
    : null;

  const configurationRef = configurationContext
    ? {
        presence: configurationContext.presence,
        revision: configurationContext.revision ?? null,
      }
    : null;

  const brandingRef = brandingContext
    ? {
        presence: brandingContext.presence,
        revision: brandingContext.revision ?? null,
      }
    : null;

  const reasonRef = reason
    ? {
        code: reason.code,
        category: reason.category ?? null,
        summary: reason.summary,
      }
    : null;

  const policyRef = archivePolicy
    ? {
        profileId: archivePolicy.profileId,
        version: archivePolicy.version,
      }
    : null;

  const retentionRef = retentionClassification
    ? {
        classification: retentionClassification.classification,
        deleteAllowed: retentionClassification.deleteAllowed === true,
        purgeAllowed: retentionClassification.purgeAllowed === true,
      }
    : {
        classification: "ARCHIVE_RECORD_ONLY",
        deleteAllowed: false,
        purgeAllowed: false,
      };

  const intentTypes = Array.isArray(integrationIntentSummary?.intentTypes)
    ? [...integrationIntentSummary.intentTypes].sort((a, b) =>
        String(a).localeCompare(String(b), "en")
      )
    : [];

  const sourceRef = source
    ? {
        sourceDefinitionRevision: source.sourceDefinitionRevision ?? null,
        sourceCompetitionVersionId: source.sourceCompetitionVersionId ?? null,
        sourceCompetitionVersionNumber:
          source.sourceCompetitionVersionNumber ?? null,
        sourceConfigurationRevision: source.sourceConfigurationRevision ?? null,
        sourceBrandingRevision: source.sourceBrandingRevision ?? null,
        sourcePublicationPresence: source.sourcePublicationPresence ?? null,
        sourcePublicationId: source.sourcePublicationId ?? null,
        sourcePublicationRevision: source.sourcePublicationRevision ?? null,
        sourceLifecycleRecordId: source.sourceLifecycleRecordId ?? null,
        sourceLifecycleRevision: source.sourceLifecycleRevision ?? null,
        sourceFinalizationKind: source.sourceFinalizationKind ?? null,
        sourceArchiveRevision: source.sourceArchiveRevision ?? null,
        archivePolicyId: source.archivePolicyId ?? null,
      }
    : null;

  const finalizationRef = finalizationSummary
    ? {
        finalizationKind: finalizationSummary.finalizationKind ?? null,
        lifecycleState: finalizationSummary.lifecycleState ?? null,
        completionEvidenceReference:
          finalizationSummary.completionEvidenceReference ?? null,
      }
    : null;

  let generatedAt = null;
  if (clock != null) {
    if (typeof clock === "function") {
      const v = clock();
      generatedAt = v != null ? v : null;
    } else {
      generatedAt = clock;
    }
  }

  const corePayload = {
    schemaVersion: COMPETITION_ARCHIVE_MANIFEST_SCHEMA_VERSION,
    archiveId: String(recordId).trim(),
    recordId: String(recordId).trim(),
    tenantId: String(tenantId).trim(),
    competitionId: String(competitionId).trim(),
    archiveRevision,
    action: String(action).trim(),
    source: sourceRef,
    finalizationSummary: finalizationRef,
    publicationContext: publicationRef,
    versionContext: versionRef,
    configurationRevision: configurationRef,
    brandingRevision: brandingRef,
    reason: reasonRef,
    archivePolicy: policyRef,
    actor: actorRef,
    authority: authorityRef,
    effectiveAt: String(effectiveAt).trim(),
    retentionClassification: retentionRef,
    integrationIntentSummary: Object.freeze({
      intentTypes: Object.freeze(intentTypes),
    }),
    generatedAt,
    fingerprintAlgorithm: COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM.id,
  };

  const fingerprint = stableContentFingerprint(corePayload);

  return deepFreeze({
    ...corePayload,
    contentFingerprint: fingerprint,
    fingerprint,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionArchiveManifest(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    v.schemaVersion === COMPETITION_ARCHIVE_MANIFEST_SCHEMA_VERSION &&
    isNonEmptyString(v.recordId) &&
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    isNonEmptyString(v.fingerprint) &&
    isNonEmptyString(v.contentFingerprint) &&
    v.fingerprint === v.contentFingerprint
  );
}
