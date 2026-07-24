/**
 * Source provenance + definition / publication context validation (CM-07).
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE,
  isCompetitionPublicationContextPresence,
  isCompetitionSuspensionPublicationPolicy,
  isCompetitionCancellationPublicationPolicy,
} from "../constants/policies.js";
import {
  isValidExpectedLifecycleRevision,
  normalizeExpectedLifecycleRevision,
} from "../constants/revision.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPositiveInteger,
  clonePlain,
} from "./shared.js";

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
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_DEFINITION,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_DEFINITION,
        "definition.tenantId is required",
        {}
      )
    );
  } else if (String(definition.tenantId).trim() !== String(tenantId).trim()) {
    errors.push(
      createFieldError(
        "definition.tenantId",
        COMPETITION_LIFECYCLE_ERROR_CODE.TENANT_MISMATCH,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_DEFINITION,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.COMPETITION_MISMATCH,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_DEFINITION,
        "definition.revision must be a positive integer",
        { value: definition.revision }
      )
    );
  }

  if (!isPositiveInteger(expectedDefinitionRevision)) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_LIFECYCLE_ERROR_CODE.STALE_DEFINITION_REVISION,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.STALE_DEFINITION_REVISION,
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
      // Snapshot only identity + revision + status — never mutate caller definition.
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
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_PUBLICATION_CONTEXT,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_PUBLICATION_CONTEXT,
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
          COMPETITION_LIFECYCLE_ERROR_CODE.PUBLICATION_CONTEXT_MISMATCH,
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

  // PRESENT
  if (!isNonEmptyString(publicationContext.publicationId)) {
    errors.push(
      createFieldError(
        "publicationContext.publicationId",
        COMPETITION_LIFECYCLE_ERROR_CODE.PUBLICATION_CONTEXT_MISMATCH,
        "PRESENT publicationContext requires publicationId",
        {}
      )
    );
  }
  if (!isPositiveInteger(publicationContext.publicationRevision)) {
    errors.push(
      createFieldError(
        "publicationContext.publicationRevision",
        COMPETITION_LIFECYCLE_ERROR_CODE.STALE_PUBLICATION_REVISION,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.TENANT_MISMATCH,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.COMPETITION_MISMATCH,
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
 * @param {"SUSPEND"|"CANCEL"|"RESUME"} action
 * @param {unknown} policy
 * @returns {{ errors: object[], value: string|null }}
 */
export function collectPublicationPolicyErrors(action, policy) {
  /** @type {object[]} */
  const errors = [];

  if (action === "RESUME") {
    // Resume does not require a publication policy — restore is review-only.
    return { errors, value: null };
  }

  if (!isNonEmptyString(policy)) {
    errors.push(
      createFieldError(
        "publicationPolicy",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_PUBLICATION_POLICY,
        "explicit publicationPolicy is required (no hidden default)",
        {}
      )
    );
    return { errors, value: null };
  }

  if (action === "SUSPEND") {
    if (!isCompetitionSuspensionPublicationPolicy(policy)) {
      errors.push(
        createFieldError(
          "publicationPolicy",
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_SUSPENSION_POLICY,
          "unknown suspension publication policy",
          { value: policy }
        )
      );
      return { errors, value: null };
    }
  } else if (action === "CANCEL") {
    if (!isCompetitionCancellationPublicationPolicy(policy)) {
      errors.push(
        createFieldError(
          "publicationPolicy",
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CANCELLATION_POLICY,
          "unknown cancellation publication policy",
          { value: policy }
        )
      );
      return { errors, value: null };
    }
  }

  return { errors, value: String(policy) };
}

/**
 * Optional competition version provenance (never inferred).
 * @param {unknown} versionContext
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectOptionalVersionContextErrors(
  versionContext,
  tenantId,
  competitionId
) {
  /** @type {object[]} */
  const errors = [];
  if (versionContext == null) {
    return {
      errors,
      value: deepFreeze({
        presence: "ABSENT",
        competitionVersionId: null,
        versionNumber: null,
      }),
    };
  }
  if (typeof versionContext !== "object" || Array.isArray(versionContext)) {
    errors.push(
      createFieldError(
        "versionContext",
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
        "versionContext must be an object when provided",
        {}
      )
    );
    return { errors, value: null };
  }
  if (!isNonEmptyString(versionContext.competitionVersionId)) {
    errors.push(
      createFieldError(
        "versionContext.competitionVersionId",
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
        "versionContext.competitionVersionId is required when versionContext is provided",
        {}
      )
    );
  }
  if (!isPositiveInteger(versionContext.versionNumber)) {
    errors.push(
      createFieldError(
        "versionContext.versionNumber",
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
        "versionContext.versionNumber must be a positive integer",
        {}
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
        COMPETITION_LIFECYCLE_ERROR_CODE.TENANT_MISMATCH,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.COMPETITION_MISMATCH,
        "versionContext.competitionId must match command competitionId",
        {}
      )
    );
  }
  if (errors.length > 0) return { errors, value: null };
  return {
    errors,
    value: deepFreeze({
      presence: "PRESENT",
      competitionVersionId: String(versionContext.competitionVersionId).trim(),
      versionNumber: versionContext.versionNumber,
    }),
  };
}

/**
 * @param {unknown} expectedLifecycleRevision
 * @param {number} actualCurrentRevision
 * @returns {object[]}
 */
export function collectExpectedLifecycleRevisionErrors(
  expectedLifecycleRevision,
  actualCurrentRevision
) {
  /** @type {object[]} */
  const errors = [];
  if (!isValidExpectedLifecycleRevision(expectedLifecycleRevision)) {
    errors.push(
      createFieldError(
        "expectedLifecycleRevision",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_EXPECTED_LIFECYCLE_REVISION,
        "explicit expectedLifecycleRevision (integer >= 0 or null) is required",
        { value: expectedLifecycleRevision }
      )
    );
    return errors;
  }
  const expected = normalizeExpectedLifecycleRevision(expectedLifecycleRevision);
  if (expected !== actualCurrentRevision) {
    errors.push(
      createFieldError(
        "expectedLifecycleRevision",
        COMPETITION_LIFECYCLE_ERROR_CODE.STALE_LIFECYCLE_REVISION,
        "expectedLifecycleRevision does not match current lifecycle revision",
        { expected, actual: actualCurrentRevision }
      )
    );
  }
  return errors;
}

/**
 * Build frozen source provenance block for a lifecycle record.
 */
export function buildSourceProvenance(params = {}) {
  return deepFreeze(
    clonePlain({
      tenantId: params.tenantId,
      competitionId: params.competitionId,
      sourceDefinitionRevision: params.sourceDefinitionRevision,
      sourceCompetitionVersionId: params.sourceCompetitionVersionId ?? null,
      sourceCompetitionVersionNumber:
        params.sourceCompetitionVersionNumber ?? null,
      sourcePublicationPresence: params.sourcePublicationPresence,
      sourcePublicationId: params.sourcePublicationId ?? null,
      sourcePublicationRevision: params.sourcePublicationRevision ?? null,
      sourceLifecycleRevision: params.sourceLifecycleRevision,
      policyId: params.policyId ?? null,
      policyVersion: params.policyVersion ?? null,
      publicationPolicy: params.publicationPolicy ?? null,
      idempotencyKeyFingerprint: params.idempotencyKeyFingerprint,
      effectiveAt: params.effectiveAt,
      createdAt: params.createdAt,
    })
  );
}
