/**
 * Source provenance + definition / publication / finalization context validation (CM-08).
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  COMPETITION_ARCHIVE_FINALIZATION_KIND,
  COMPETITION_OPTIONAL_CONTEXT_PRESENCE,
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE,
  isCompetitionOptionalContextPresence,
  isCompetitionPublicationContextPresence,
  resolveCompetitionArchivePolicy,
} from "../constants/policies.js";
import {
  isValidExpectedArchiveRevision,
  normalizeExpectedArchiveRevision,
} from "../constants/revision.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPositiveInteger,
  clonePlain,
} from "./shared.js";

const LIFECYCLE_STATE_ACTIVE = "ACTIVE";
const LIFECYCLE_STATE_SUSPENDED = "SUSPENDED";
const LIFECYCLE_STATE_CANCELLED = "CANCELLED";

/**
 * @param {unknown} definition
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {unknown} expectedDefinitionRevision
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectDefinitionContextErrors(
  definition,
  tenantId,
  competitionId,
  expectedDefinitionRevision
) {
  /** @type {object[]} */
  const errors = [];

  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_DEFINITION,
        "explicit CompetitionDefinition (or definition context) is required",
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isNonEmptyString(definition.tenantId)) {
    errors.push(
      createFieldError(
        "definition.tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_DEFINITION,
        "definition.tenantId is required",
        {}
      )
    );
  } else if (String(definition.tenantId).trim() !== String(tenantId).trim()) {
    errors.push(
      createFieldError(
        "definition.tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.TENANT_MISMATCH,
        "definition.tenantId must match command tenantId",
        {
          expected: String(tenantId).trim(),
          actual: String(definition.tenantId).trim(),
        }
      )
    );
  }

  if (!isNonEmptyString(definition.competitionId)) {
    errors.push(
      createFieldError(
        "definition.competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_DEFINITION,
        "definition.competitionId is required",
        {}
      )
    );
  } else if (
    String(definition.competitionId).trim() !== String(competitionId).trim()
  ) {
    errors.push(
      createFieldError(
        "definition.competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.COMPETITION_MISMATCH,
        "definition.competitionId must match command competitionId",
        {
          expected: String(competitionId).trim(),
          actual: String(definition.competitionId).trim(),
        }
      )
    );
  }

  if (!isPositiveInteger(definition.revision)) {
    errors.push(
      createFieldError(
        "definition.revision",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_DEFINITION,
        "definition.revision must be a positive integer",
        { value: definition.revision }
      )
    );
  }

  if (!isPositiveInteger(expectedDefinitionRevision)) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_ARCHIVE_ERROR_CODE.STALE_DEFINITION_REVISION,
        "explicit expectedDefinitionRevision (positive integer) is required",
        { value: expectedDefinitionRevision }
      )
    );
  } else if (
    isPositiveInteger(definition.revision) &&
    definition.revision !== expectedDefinitionRevision
  ) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_ARCHIVE_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedDefinitionRevision does not match definition.revision",
        {
          expected: expectedDefinitionRevision,
          actual: definition.revision,
        }
      )
    );
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      tenantId: String(definition.tenantId).trim(),
      competitionId: String(definition.competitionId).trim(),
      revision: definition.revision,
      status: isNonEmptyString(definition.status)
        ? String(definition.status).trim()
        : null,
      fingerprintHint: isNonEmptyString(definition.fingerprint)
        ? String(definition.fingerprint).trim()
        : null,
    }),
  };
}

/**
 * @param {unknown} publicationContext
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectPublicationContextErrors(
  publicationContext,
  tenantId,
  competitionId
) {
  /** @type {object[]} */
  const errors = [];

  if (
    !publicationContext ||
    typeof publicationContext !== "object" ||
    Array.isArray(publicationContext)
  ) {
    errors.push(
      createFieldError(
        "publicationContext",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_PUBLICATION_CONTEXT,
        "explicit publicationContext (PRESENT or ABSENT) is required — no latest lookup",
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isCompetitionPublicationContextPresence(publicationContext.presence)) {
    errors.push(
      createFieldError(
        "publicationContext.presence",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_PUBLICATION_CONTEXT,
        "publicationContext.presence must be PRESENT or ABSENT",
        { value: publicationContext.presence }
      )
    );
    return { errors, value: null };
  }

  if (
    publicationContext.presence === COMPETITION_PUBLICATION_CONTEXT_PRESENCE.ABSENT
  ) {
    if (
      publicationContext.publicationId != null ||
      publicationContext.publicationRevision != null
    ) {
      errors.push(
        createFieldError(
          "publicationContext",
          COMPETITION_ARCHIVE_ERROR_CODE.PUBLICATION_CONTEXT_MISMATCH,
          "ABSENT publicationContext must not include publicationId or publicationRevision",
          {}
        )
      );
    }
    if (errors.length > 0) return { errors, value: null };
    return {
      errors,
      value: deepFreeze({
        presence: COMPETITION_PUBLICATION_CONTEXT_PRESENCE.ABSENT,
        publicationId: null,
        publicationRevision: null,
        channel: null,
      }),
    };
  }

  if (!isNonEmptyString(publicationContext.publicationId)) {
    errors.push(
      createFieldError(
        "publicationContext.publicationId",
        COMPETITION_ARCHIVE_ERROR_CODE.PUBLICATION_CONTEXT_MISMATCH,
        "PRESENT publicationContext requires publicationId",
        {}
      )
    );
  }
  if (!isPositiveInteger(publicationContext.publicationRevision)) {
    errors.push(
      createFieldError(
        "publicationContext.publicationRevision",
        COMPETITION_ARCHIVE_ERROR_CODE.STALE_PUBLICATION_REVISION,
        "PRESENT publicationContext requires positive integer publicationRevision",
        { value: publicationContext.publicationRevision }
      )
    );
  }
  if (
    isNonEmptyString(publicationContext.tenantId) &&
    String(publicationContext.tenantId).trim() !== String(tenantId).trim()
  ) {
    errors.push(
      createFieldError(
        "publicationContext.tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.TENANT_MISMATCH,
        "publicationContext.tenantId must match command tenantId",
        {}
      )
    );
  }
  if (
    isNonEmptyString(publicationContext.competitionId) &&
    String(publicationContext.competitionId).trim() !==
      String(competitionId).trim()
  ) {
    errors.push(
      createFieldError(
        "publicationContext.competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.COMPETITION_MISMATCH,
        "publicationContext.competitionId must match command competitionId",
        {}
      )
    );
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      presence: COMPETITION_PUBLICATION_CONTEXT_PRESENCE.PRESENT,
      publicationId: String(publicationContext.publicationId).trim(),
      publicationRevision: publicationContext.publicationRevision,
      channel: isNonEmptyString(publicationContext.channel)
        ? String(publicationContext.channel).trim()
        : null,
    }),
  };
}

/**
 * Required competition version provenance (never inferred).
 * @param {unknown} versionContext
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectRequiredVersionContextErrors(
  versionContext,
  tenantId,
  competitionId
) {
  /** @type {object[]} */
  const errors = [];

  if (
    versionContext == null ||
    typeof versionContext !== "object" ||
    Array.isArray(versionContext)
  ) {
    errors.push(
      createFieldError(
        "versionContext",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION_VERSION,
        "explicit versionContext is required — no hidden default",
        {}
      )
    );
    return { errors, value: null };
  }

  if (versionContext.presence === COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT) {
    errors.push(
      createFieldError(
        "versionContext.presence",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION_VERSION,
        "versionContext must be PRESENT for archive commands",
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isNonEmptyString(versionContext.competitionVersionId)) {
    errors.push(
      createFieldError(
        "versionContext.competitionVersionId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION_VERSION,
        "versionContext.competitionVersionId is required",
        {}
      )
    );
  }
  if (!isPositiveInteger(versionContext.versionNumber)) {
    errors.push(
      createFieldError(
        "versionContext.versionNumber",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION_VERSION,
        "versionContext.versionNumber must be a positive integer",
        { value: versionContext.versionNumber }
      )
    );
  }

  if (
    isNonEmptyString(versionContext.tenantId) &&
    String(versionContext.tenantId).trim() !== String(tenantId).trim()
  ) {
    errors.push(
      createFieldError(
        "versionContext.tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.SOURCE_VERSION_TENANT_MISMATCH,
        "versionContext.tenantId must match command tenantId",
        {}
      )
    );
  }
  if (
    isNonEmptyString(versionContext.competitionId) &&
    String(versionContext.competitionId).trim() !== String(competitionId).trim()
  ) {
    errors.push(
      createFieldError(
        "versionContext.competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.SOURCE_VERSION_COMPETITION_MISMATCH,
        "versionContext.competitionId must match command competitionId",
        {}
      )
    );
  }

  if (
    isNonEmptyString(versionContext.expectedCompetitionVersionId) &&
    isNonEmptyString(versionContext.competitionVersionId) &&
    String(versionContext.expectedCompetitionVersionId).trim() !==
      String(versionContext.competitionVersionId).trim()
  ) {
    errors.push(
      createFieldError(
        "versionContext.expectedCompetitionVersionId",
        COMPETITION_ARCHIVE_ERROR_CODE.SOURCE_VERSION_MISMATCH,
        "expectedCompetitionVersionId does not match competitionVersionId",
        {}
      )
    );
  }
  if (
    isPositiveInteger(versionContext.expectedVersionNumber) &&
    isPositiveInteger(versionContext.versionNumber) &&
    versionContext.expectedVersionNumber !== versionContext.versionNumber
  ) {
    errors.push(
      createFieldError(
        "versionContext.expectedVersionNumber",
        COMPETITION_ARCHIVE_ERROR_CODE.SOURCE_VERSION_MISMATCH,
        "expectedVersionNumber does not match versionNumber",
        {
          expected: versionContext.expectedVersionNumber,
          actual: versionContext.versionNumber,
        }
      )
    );
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.PRESENT,
      competitionVersionId: String(versionContext.competitionVersionId).trim(),
      versionNumber: versionContext.versionNumber,
      fingerprint: isNonEmptyString(versionContext.fingerprint)
        ? String(versionContext.fingerprint).trim()
        : null,
    }),
  };
}

/**
 * Optional revision-only context (configuration / branding).
 * @param {string} fieldName
 * @param {unknown} context
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {string} mismatchCode
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectOptionalRevisionContextErrors(
  fieldName,
  context,
  tenantId,
  competitionId,
  mismatchCode
) {
  /** @type {object[]} */
  const errors = [];

  if (context == null) {
    return {
      errors,
      value: deepFreeze({
        presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT,
        revision: null,
      }),
    };
  }

  if (typeof context !== "object" || Array.isArray(context)) {
    errors.push(
      createFieldError(
        fieldName,
        mismatchCode,
        `${fieldName} must be an object when provided`,
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isCompetitionOptionalContextPresence(context.presence)) {
    errors.push(
      createFieldError(
        `${fieldName}.presence`,
        mismatchCode,
        `${fieldName}.presence must be PRESENT or ABSENT`,
        { value: context.presence }
      )
    );
    return { errors, value: null };
  }

  if (context.presence === COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT) {
    if (context.revision != null) {
      errors.push(
        createFieldError(
          fieldName,
          mismatchCode,
          `ABSENT ${fieldName} must not include revision`,
          {}
        )
      );
    }
    if (errors.length > 0) return { errors, value: null };
    return {
      errors,
      value: deepFreeze({
        presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT,
        revision: null,
      }),
    };
  }

  if (!isPositiveInteger(context.revision)) {
    errors.push(
      createFieldError(
        `${fieldName}.revision`,
        mismatchCode,
        `PRESENT ${fieldName} requires positive integer revision`,
        { value: context.revision }
      )
    );
  }
  if (
    isNonEmptyString(context.tenantId) &&
    String(context.tenantId).trim() !== String(tenantId).trim()
  ) {
    errors.push(
      createFieldError(
        `${fieldName}.tenantId`,
        COMPETITION_ARCHIVE_ERROR_CODE.TENANT_MISMATCH,
        `${fieldName}.tenantId must match command tenantId`,
        {}
      )
    );
  }
  if (
    isNonEmptyString(context.competitionId) &&
    String(context.competitionId).trim() !== String(competitionId).trim()
  ) {
    errors.push(
      createFieldError(
        `${fieldName}.competitionId`,
        COMPETITION_ARCHIVE_ERROR_CODE.COMPETITION_MISMATCH,
        `${fieldName}.competitionId must match command competitionId`,
        {}
      )
    );
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.PRESENT,
      revision: context.revision,
    }),
  };
}

/**
 * @param {unknown} context
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectConfigurationContextErrors(context, tenantId, competitionId) {
  return collectOptionalRevisionContextErrors(
    "configurationContext",
    context,
    tenantId,
    competitionId,
    COMPETITION_ARCHIVE_ERROR_CODE.CONFIGURATION_CONTEXT_MISMATCH
  );
}

/**
 * @param {unknown} context
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectBrandingContextErrors(context, tenantId, competitionId) {
  return collectOptionalRevisionContextErrors(
    "brandingContext",
    context,
    tenantId,
    competitionId,
    COMPETITION_ARCHIVE_ERROR_CODE.BRANDING_CONTEXT_MISMATCH
  );
}

/**
 * @param {unknown} policyProfileId
 * @returns {{ errors: object[], value: Readonly<object>|null }}
 */
export function collectArchivePolicyErrors(policyProfileId) {
  /** @type {object[]} */
  const errors = [];

  if (!isNonEmptyString(policyProfileId)) {
    errors.push(
      createFieldError(
        "archivePolicyId",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_ARCHIVE_POLICY,
        "explicit archivePolicyId is required (no hidden default)",
        {}
      )
    );
    return { errors, value: null };
  }

  const policy = resolveCompetitionArchivePolicy(policyProfileId);
  if (!policy) {
    errors.push(
      createFieldError(
        "archivePolicyId",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_ARCHIVE_POLICY,
        "unknown archive policy profile",
        { value: policyProfileId }
      )
    );
    return { errors, value: null };
  }

  return { errors, value: deepFreeze(clonePlain(policy)) };
}

/**
 * @param {unknown} expectedArchiveRevision
 * @param {number} actualCurrentRevision
 * @returns {object[]}
 */
export function collectExpectedArchiveRevisionErrors(
  expectedArchiveRevision,
  actualCurrentRevision
) {
  /** @type {object[]} */
  const errors = [];
  if (!isValidExpectedArchiveRevision(expectedArchiveRevision)) {
    errors.push(
      createFieldError(
        "expectedArchiveRevision",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_EXPECTED_ARCHIVE_REVISION,
        "explicit expectedArchiveRevision (integer >= 0 or null) is required",
        { value: expectedArchiveRevision }
      )
    );
    return errors;
  }
  const expected = normalizeExpectedArchiveRevision(expectedArchiveRevision);
  if (expected !== actualCurrentRevision) {
    errors.push(
      createFieldError(
        "expectedArchiveRevision",
        COMPETITION_ARCHIVE_ERROR_CODE.STALE_ARCHIVE_REVISION,
        "expectedArchiveRevision does not match current archive revision",
        { expected, actual: actualCurrentRevision }
      )
    );
  }
  return errors;
}

/**
 * @param {unknown} timestamp
 * @returns {string|null}
 */
function parseValidTimestamp(timestamp) {
  if (typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp))) {
    return new Date(timestamp).toISOString();
  }
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }
  return null;
}

/**
 * @param {unknown} lifecycleContext
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {Readonly<object>} policy
 * @returns {{ errors: object[], value: object|null }}
 */
function collectLifecycleContextErrors(
  lifecycleContext,
  tenantId,
  competitionId,
  policy
) {
  /** @type {object[]} */
  const errors = [];

  if (
    lifecycleContext == null ||
    typeof lifecycleContext !== "object" ||
    Array.isArray(lifecycleContext)
  ) {
    errors.push(
      createFieldError(
        "lifecycleContext",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
        "lifecycleContext must be an object when provided",
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isNonEmptyString(lifecycleContext.state)) {
    errors.push(
      createFieldError(
        "lifecycleContext.state",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
        "lifecycleContext.state must be a non-empty string",
        {}
      )
    );
    return { errors, value: null };
  }

  const state = String(lifecycleContext.state).trim().toUpperCase();

  if (state === LIFECYCLE_STATE_ACTIVE && policy.allowActive !== true) {
    errors.push(
      createFieldError(
        "lifecycleContext.state",
        COMPETITION_ARCHIVE_ERROR_CODE.LIFECYCLE_STATE_NOT_ARCHIVABLE,
        "ACTIVE lifecycle state is not archivable under the selected archive policy",
        { state }
      )
    );
  }
  if (state === LIFECYCLE_STATE_SUSPENDED && policy.allowSuspended !== true) {
    errors.push(
      createFieldError(
        "lifecycleContext.state",
        COMPETITION_ARCHIVE_ERROR_CODE.LIFECYCLE_STATE_NOT_ARCHIVABLE,
        "SUSPENDED lifecycle state is not archivable under the selected archive policy",
        { state }
      )
    );
  }

  const requiresLifecycleRecord =
    state === LIFECYCLE_STATE_CANCELLED ||
    ((state === LIFECYCLE_STATE_ACTIVE || state === LIFECYCLE_STATE_SUSPENDED) &&
      (policy.allowActive === true || policy.allowSuspended === true));

  if (requiresLifecycleRecord) {
    if (!isNonEmptyString(lifecycleContext.lifecycleRecordId)) {
      errors.push(
        createFieldError(
          "lifecycleContext.lifecycleRecordId",
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
          "lifecycleContext.lifecycleRecordId is required for this lifecycle state",
          { state }
        )
      );
    }
    if (!isPositiveInteger(lifecycleContext.lifecycleRevision)) {
      errors.push(
        createFieldError(
          "lifecycleContext.lifecycleRevision",
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
          "lifecycleContext.lifecycleRevision must be a positive integer",
          { value: lifecycleContext.lifecycleRevision }
        )
      );
    }
  }

  if (
    isNonEmptyString(lifecycleContext.tenantId) &&
    String(lifecycleContext.tenantId).trim() !== String(tenantId).trim()
  ) {
    errors.push(
      createFieldError(
        "lifecycleContext.tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.TENANT_MISMATCH,
        "lifecycleContext.tenantId must match command tenantId",
        {}
      )
    );
  }
  if (
    isNonEmptyString(lifecycleContext.competitionId) &&
    String(lifecycleContext.competitionId).trim() !== String(competitionId).trim()
  ) {
    errors.push(
      createFieldError(
        "lifecycleContext.competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.COMPETITION_MISMATCH,
        "lifecycleContext.competitionId must match command competitionId",
        {}
      )
    );
  }

  if (state === LIFECYCLE_STATE_CANCELLED) {
    if (!isNonEmptyString(lifecycleContext.evidenceType)) {
      errors.push(
        createFieldError(
          "lifecycleContext.evidenceType",
          COMPETITION_ARCHIVE_ERROR_CODE.CANCELLATION_EVIDENCE_MISMATCH,
          "CANCELLED lifecycleContext requires evidenceType",
          {}
        )
      );
    }
    if (!isNonEmptyString(lifecycleContext.evidenceReference)) {
      errors.push(
        createFieldError(
          "lifecycleContext.evidenceReference",
          COMPETITION_ARCHIVE_ERROR_CODE.CANCELLATION_EVIDENCE_MISMATCH,
          "CANCELLED lifecycleContext requires evidenceReference",
          {}
        )
      );
    } else if (
      isNonEmptyString(lifecycleContext.lifecycleRecordId) &&
      String(lifecycleContext.evidenceReference).trim() !==
        String(lifecycleContext.lifecycleRecordId).trim()
    ) {
      errors.push(
        createFieldError(
          "lifecycleContext.evidenceReference",
          COMPETITION_ARCHIVE_ERROR_CODE.CANCELLATION_EVIDENCE_MISMATCH,
          "evidenceReference must match lifecycleRecordId for CANCELLED lifecycle",
          {}
        )
      );
    }
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      state,
      lifecycleRecordId: isNonEmptyString(lifecycleContext.lifecycleRecordId)
        ? String(lifecycleContext.lifecycleRecordId).trim()
        : null,
      lifecycleRevision: isPositiveInteger(lifecycleContext.lifecycleRevision)
        ? lifecycleContext.lifecycleRevision
        : null,
      evidenceType: isNonEmptyString(lifecycleContext.evidenceType)
        ? String(lifecycleContext.evidenceType).trim()
        : null,
      evidenceReference: isNonEmptyString(lifecycleContext.evidenceReference)
        ? String(lifecycleContext.evidenceReference).trim()
        : null,
    }),
  };
}

/**
 * @param {unknown} completionContext
 * @param {Readonly<object>} policy
 * @returns {{ errors: object[], value: object|null }}
 */
function collectCompletionContextErrors(completionContext, policy) {
  /** @type {object[]} */
  const errors = [];

  if (
    completionContext == null ||
    typeof completionContext !== "object" ||
    Array.isArray(completionContext)
  ) {
    errors.push(
      createFieldError(
        "completionContext",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
        "completionContext must be an object when provided",
        {}
      )
    );
    return { errors, value: null };
  }

  if (completionContext.completed !== true) {
    return { errors, value: null };
  }

  if (policy.allowCompletedWithExplicitEvidence !== true) {
    errors.push(
      createFieldError(
        "completionContext.completed",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_COMPLETION_EVIDENCE,
        "completed archive is not allowed under the selected archive policy",
        {}
      )
    );
  }

  if (!isNonEmptyString(completionContext.evidenceType)) {
    errors.push(
      createFieldError(
        "completionContext.evidenceType",
        COMPETITION_ARCHIVE_ERROR_CODE.COMPLETION_EVIDENCE_MISSING,
        "completionContext.evidenceType is required when completed is true",
        {}
      )
    );
  }
  if (!isNonEmptyString(completionContext.evidenceReference)) {
    errors.push(
      createFieldError(
        "completionContext.evidenceReference",
        COMPETITION_ARCHIVE_ERROR_CODE.COMPLETION_EVIDENCE_MISSING,
        "completionContext.evidenceReference is required when completed is true",
        {}
      )
    );
  }

  const completedAt = parseValidTimestamp(completionContext.completedAt);
  if (completedAt == null) {
    errors.push(
      createFieldError(
        "completionContext.completedAt",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_COMPLETION_EVIDENCE,
        "completionContext.completedAt must be a valid timestamp when completed is true",
        { value: completionContext.completedAt }
      )
    );
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      completed: true,
      evidenceType: String(completionContext.evidenceType).trim(),
      evidenceReference: String(completionContext.evidenceReference).trim(),
      completedAt,
    }),
  };
}

/**
 * @param {unknown} cmd
 * @param {string} tenantId
 * @param {string} competitionId
 * @param {Readonly<object>} policy
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectFinalizationContextErrors(
  cmd,
  tenantId,
  competitionId,
  policy
) {
  /** @type {object[]} */
  const errors = [];

  const hasLifecycle =
    cmd != null &&
    typeof cmd === "object" &&
    !Array.isArray(cmd) &&
    cmd.lifecycleContext != null;
  const hasCompletion =
    cmd != null &&
    typeof cmd === "object" &&
    !Array.isArray(cmd) &&
    cmd.completionContext != null;

  if (!hasLifecycle && !hasCompletion) {
    errors.push(
      createFieldError(
        "lifecycleContext",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_LIFECYCLE_OR_COMPLETION_CONTEXT,
        "explicit lifecycleContext or completionContext is required",
        {}
      )
    );
    return { errors, value: null };
  }

  const lifecycleGate = hasLifecycle
    ? collectLifecycleContextErrors(
        /** @type {object} */ (cmd).lifecycleContext,
        tenantId,
        competitionId,
        policy
      )
    : { errors: [], value: null };
  errors.push(...lifecycleGate.errors);

  const completionGate = hasCompletion
    ? collectCompletionContextErrors(
        /** @type {object} */ (cmd).completionContext,
        policy
      )
    : { errors: [], value: null };
  errors.push(...completionGate.errors);

  if (errors.length > 0) return { errors, value: null };

  const lifecycleValue = lifecycleGate.value;
  const completionValue = completionGate.value;
  const completionClaimed =
    hasCompletion &&
    /** @type {object} */ (cmd).completionContext?.completed === true;

  if (completionClaimed && completionValue == null) {
    errors.push(
      createFieldError(
        "completionContext",
        COMPETITION_ARCHIVE_ERROR_CODE.COMPLETION_EVIDENCE_MISSING,
        "completion claimed without valid explicit evidence",
        {}
      )
    );
    return { errors, value: null };
  }

  /** @type {string|null} */
  let finalizationKind;

  if (lifecycleValue?.state === LIFECYCLE_STATE_CANCELLED) {
    finalizationKind = COMPETITION_ARCHIVE_FINALIZATION_KIND.CANCELLED;
  } else if (completionValue?.completed === true) {
    finalizationKind = COMPETITION_ARCHIVE_FINALIZATION_KIND.COMPLETED;
  } else if (
    lifecycleValue &&
    (lifecycleValue.state === LIFECYCLE_STATE_ACTIVE ||
      lifecycleValue.state === LIFECYCLE_STATE_SUSPENDED)
  ) {
    // Exceptional policy path — lifecycle interruption without finalization kind.
    finalizationKind = null;
  } else if (hasCompletion && !completionClaimed && !hasLifecycle) {
    errors.push(
      createFieldError(
        "completionContext.completed",
        COMPETITION_ARCHIVE_ERROR_CODE.COMPLETION_EVIDENCE_MISSING,
        "completionContext without lifecycleContext requires completed === true",
        {}
      )
    );
    return { errors, value: null };
  } else if (hasLifecycle && lifecycleValue == null) {
    return { errors, value: null };
  } else {
    errors.push(
      createFieldError(
        "lifecycleContext",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_LIFECYCLE_OR_COMPLETION_CONTEXT,
        "archive finalization requires CANCELLED lifecycle or explicit completion evidence",
        {}
      )
    );
    return { errors, value: null };
  }

  return {
    errors,
    value: deepFreeze({
      finalizationKind,
      lifecycleContext: lifecycleValue,
      completionContext: completionValue,
    }),
  };
}

/**
 * @param {unknown} cmd
 * @returns {object[]}
 */
export function collectOperationalGuardErrors(cmd) {
  /** @type {object[]} */
  const errors = [];
  if (
    cmd != null &&
    typeof cmd === "object" &&
    !Array.isArray(cmd) &&
    cmd.pendingPublicationOperation === true
  ) {
    errors.push(
      createFieldError(
        "pendingPublicationOperation",
        COMPETITION_ARCHIVE_ERROR_CODE.PENDING_PUBLICATION_OPERATION,
        "archive is blocked while a publication operation is pending",
        {}
      )
    );
  }
  if (
    cmd != null &&
    typeof cmd === "object" &&
    !Array.isArray(cmd) &&
    cmd.activeRecoveryOperation === true
  ) {
    errors.push(
      createFieldError(
        "activeRecoveryOperation",
        COMPETITION_ARCHIVE_ERROR_CODE.ACTIVE_RECOVERY_OPERATION,
        "archive is blocked while a recovery operation is active",
        {}
      )
    );
  }
  if (
    cmd != null &&
    typeof cmd === "object" &&
    !Array.isArray(cmd) &&
    cmd.unresolvedCriticalOperation === true
  ) {
    errors.push(
      createFieldError(
        "unresolvedCriticalOperation",
        COMPETITION_ARCHIVE_ERROR_CODE.UNRESOLVED_CRITICAL_OPERATION,
        "archive is blocked while a critical operation remains unresolved",
        {}
      )
    );
  }
  return errors;
}

/**
 * Build frozen source provenance block for an archive record.
 */
export function buildSourceProvenance(params = {}) {
  const block = clonePlain({
    tenantId: params.tenantId,
    competitionId: params.competitionId,
    sourceDefinitionRevision: params.sourceDefinitionRevision,
    sourceCompetitionVersionId: params.sourceCompetitionVersionId ?? null,
    sourceCompetitionVersionNumber:
      params.sourceCompetitionVersionNumber ?? null,
    sourceConfigurationRevision: params.sourceConfigurationRevision ?? null,
    sourceBrandingRevision: params.sourceBrandingRevision ?? null,
    sourcePublicationPresence: params.sourcePublicationPresence,
    sourcePublicationId: params.sourcePublicationId ?? null,
    sourcePublicationRevision: params.sourcePublicationRevision ?? null,
    sourceLifecycleRecordId: params.sourceLifecycleRecordId ?? null,
    sourceLifecycleRevision: params.sourceLifecycleRevision ?? null,
    sourceFinalizationKind: params.sourceFinalizationKind ?? null,
    sourceCompletionEvidenceReference:
      params.sourceCompletionEvidenceReference ?? null,
    sourceArchiveRevision: params.sourceArchiveRevision,
    archivePolicyId: params.archivePolicyId ?? null,
    archivePolicyVersion: params.archivePolicyVersion ?? null,
    idempotencyKeyFingerprint: params.idempotencyKeyFingerprint,
    effectiveAt: params.effectiveAt,
    createdAt: params.createdAt,
  });

  if (params.schemaVersion != null) {
    block.schemaVersion = params.schemaVersion;
  }

  return deepFreeze(block);
}
