/**
 * CompetitionPublication aggregate contract (CM-06).
 *
 * CM-06 owns only the CompetitionPublication record. It never mutates the
 * CM-01 definition, CM-04 configuration, or CM-05 branding it reads, and it
 * never creates CM-03 versions — it only ever consumes an explicit, already
 * immutable CompetitionVersion.
 */

import { isCompetitionDefinition } from "../../competition-definition/index.js";
import {
  isCompetitionVersion,
  buildVersionContentFromDefinition,
} from "../../competition-versioning/index.js";
import { isCompetitionConfiguration } from "../../competition-configuration/index.js";
import { isCompetitionBranding } from "../../competition-branding/index.js";
import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
  canonicalizeJson,
  stableContentFingerprint,
} from "./shared.js";
import { isCompetitionPublicationChannel } from "../constants/channels.js";
import {
  isCompetitionPublicationProfileId,
  isCompetitionPublicationConfigurationPresence,
  COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE,
} from "../constants/profiles.js";
import { isCompetitionPublicationStatus } from "../constants/status.js";
import { isValidCompetitionPublicationRevision } from "../constants/revision.js";
import { isCompetitionPublicationSourceReferences } from "./source.js";
import { isVisibilityAllowedForChannel } from "../channels/registry.js";

/** External lifecycle statuses CM-06 never owns but must respect when explicitly reported. */
export const EXTERNAL_LIFECYCLE_BLOCKED_STATUSES = Object.freeze([
  "SUSPENDED",
  "CANCELLED",
  "ARCHIVED",
]);

/**
 * @param {unknown} profileId
 * @returns {object[]}
 */
export function collectProfileErrors(profileId) {
  /** @type {object[]} */
  const errors = [];
  if (!isNonEmptyString(profileId)) {
    errors.push(
      createFieldError(
        "profileId",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_PROFILE_ID,
        "explicit publicationProfileId is required (no hidden default)",
        {}
      )
    );
    return errors;
  }
  if (!isCompetitionPublicationProfileId(profileId)) {
    errors.push(
      createFieldError(
        "profileId",
        COMPETITION_PUBLICATION_ERROR_CODE.UNKNOWN_PROFILE,
        "unknown publicationProfileId",
        { value: profileId }
      )
    );
  }
  return errors;
}

/**
 * @param {unknown} channel
 * @returns {object[]}
 */
export function collectChannelErrors(channel) {
  /** @type {object[]} */
  const errors = [];
  if (!isCompetitionPublicationChannel(channel)) {
    errors.push(
      createFieldError(
        "channel",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CHANNEL,
        "channel must be an explicit known publication channel",
        { value: channel }
      )
    );
  }
  return errors;
}

/**
 * @param {unknown} competitionVersion
 * @param {{ tenantId: string, competitionId: string, expectedSourceVersionId: unknown, expectedSourceVersionNumber: unknown }} scope
 * @returns {object[]}
 */
export function collectVersionSourceErrors(competitionVersion, scope) {
  /** @type {object[]} */
  const errors = [];

  if (!isCompetitionVersion(competitionVersion)) {
    errors.push(
      createFieldError(
        "competitionVersion",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_COMPETITION_VERSION,
        "explicit valid, immutable CompetitionVersion is required (no UNVERSIONED_DRAFT_PUBLICATION, no latest-version fallback)",
        {}
      )
    );
    return errors;
  }

  const version = /** @type {any} */ (competitionVersion);

  if (version.tenantId !== scope.tenantId) {
    errors.push(
      createFieldError(
        "competitionVersion.tenantId",
        COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH,
        "competitionVersion.tenantId must match explicit tenantId",
        { expected: scope.tenantId, actual: version.tenantId }
      )
    );
  }
  if (version.competitionId !== scope.competitionId) {
    errors.push(
      createFieldError(
        "competitionVersion.competitionId",
        COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH,
        "competitionVersion.competitionId must match explicit competitionId",
        { expected: scope.competitionId, actual: version.competitionId }
      )
    );
  }

  if (!isNonEmptyString(scope.expectedSourceVersionId)) {
    errors.push(
      createFieldError(
        "expectedSourceVersionId",
        COMPETITION_PUBLICATION_ERROR_CODE.VERSION_SOURCE_MISMATCH,
        "explicit expectedSourceVersionId is required",
        {}
      )
    );
  } else if (scope.expectedSourceVersionId !== version.versionId) {
    errors.push(
      createFieldError(
        "expectedSourceVersionId",
        COMPETITION_PUBLICATION_ERROR_CODE.VERSION_SOURCE_MISMATCH,
        "expectedSourceVersionId does not match competitionVersion.versionId",
        { expected: scope.expectedSourceVersionId, actual: version.versionId }
      )
    );
  }

  if (!Number.isInteger(scope.expectedSourceVersionNumber)) {
    errors.push(
      createFieldError(
        "expectedSourceVersionNumber",
        COMPETITION_PUBLICATION_ERROR_CODE.VERSION_SOURCE_MISMATCH,
        "explicit expectedSourceVersionNumber is required",
        {}
      )
    );
  } else if (scope.expectedSourceVersionNumber !== version.versionNumber) {
    errors.push(
      createFieldError(
        "expectedSourceVersionNumber",
        COMPETITION_PUBLICATION_ERROR_CODE.VERSION_SOURCE_MISMATCH,
        "expectedSourceVersionNumber does not match competitionVersion.versionNumber",
        {
          expected: scope.expectedSourceVersionNumber,
          actual: version.versionNumber,
        }
      )
    );
  }

  return errors;
}

/**
 * Verify the explicit CM-01 definition matches the CM-03 version content it is
 * claimed to correspond to. Does not mutate the definition or the version.
 *
 * @param {unknown} definition
 * @param {object} competitionVersion
 * @param {{ tenantId: string, competitionId: string, expectedDefinitionRevision: unknown }} scope
 * @returns {object[]}
 */
export function collectDefinitionMatchErrors(definition, competitionVersion, scope) {
  /** @type {object[]} */
  const errors = [];

  if (!definition || typeof definition !== "object") {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_DEFINITION,
        "explicit CompetitionDefinition is required",
        {}
      )
    );
    return errors;
  }

  if (!isCompetitionDefinition(definition)) {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_DEFINITION,
        "definition failed CM-01 CompetitionDefinition contract",
        {}
      )
    );
    return errors;
  }

  const def = /** @type {any} */ (definition);

  if (def.tenantId !== scope.tenantId) {
    errors.push(
      createFieldError(
        "definition.tenantId",
        COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH,
        "definition.tenantId must match explicit tenantId",
        { expected: scope.tenantId, actual: def.tenantId }
      )
    );
  }
  if (def.competitionId !== scope.competitionId) {
    errors.push(
      createFieldError(
        "definition.competitionId",
        COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH,
        "definition.competitionId must match explicit competitionId",
        { expected: scope.competitionId, actual: def.competitionId }
      )
    );
  }

  if (!Number.isInteger(scope.expectedDefinitionRevision) || scope.expectedDefinitionRevision < 1) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedDefinitionRevision must be an integer >= 1",
        { value: scope.expectedDefinitionRevision }
      )
    );
  } else {
    if (def.revision !== scope.expectedDefinitionRevision) {
      errors.push(
        createFieldError(
          "expectedDefinitionRevision",
          COMPETITION_PUBLICATION_ERROR_CODE.STALE_DEFINITION_REVISION,
          "expectedDefinitionRevision does not match definition.revision",
          { expected: scope.expectedDefinitionRevision, actual: def.revision }
        )
      );
    }
    if (
      isCompetitionVersion(competitionVersion) &&
      competitionVersion.sourceDefinitionRevision !== scope.expectedDefinitionRevision
    ) {
      errors.push(
        createFieldError(
          "expectedDefinitionRevision",
          COMPETITION_PUBLICATION_ERROR_CODE.STALE_DEFINITION_REVISION,
          "expectedDefinitionRevision does not match competitionVersion.sourceDefinitionRevision",
          {
            expected: scope.expectedDefinitionRevision,
            actual: competitionVersion.sourceDefinitionRevision,
          }
        )
      );
    }
  }

  if (isCompetitionVersion(competitionVersion)) {
    const derivedContent = buildVersionContentFromDefinition(def, {
      templateVersioned: competitionVersion.content?.templateVersioned ?? null,
      instantiationPlanChecksum:
        competitionVersion.content?.instantiationPlanChecksum ?? null,
    });
    if (canonicalizeJson(derivedContent) !== canonicalizeJson(competitionVersion.content)) {
      errors.push(
        createFieldError(
          "definition",
          COMPETITION_PUBLICATION_ERROR_CODE.DEFINITION_VERSION_MISMATCH,
          "explicit definition does not match the content captured by competitionVersion",
          {}
        )
      );
    }
  }

  return errors;
}

/**
 * @param {unknown} configurationPresence
 * @param {unknown} configuration
 * @param {unknown} expectedConfigurationRevision
 * @param {{ tenantId: string, competitionId: string }} scope
 * @returns {object[]}
 */
export function collectConfigurationErrors(
  configurationPresence,
  configuration,
  expectedConfigurationRevision,
  scope
) {
  /** @type {object[]} */
  const errors = [];

  if (!isCompetitionPublicationConfigurationPresence(configurationPresence)) {
    errors.push(
      createFieldError(
        "configurationPresence",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_CONFIGURATION_PRESENCE,
        "explicit configurationPresence (PRESENT|ABSENT) is required — absence must never be implicit",
        {}
      )
    );
    return errors;
  }

  if (configurationPresence === COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.ABSENT) {
    if (configuration != null) {
      errors.push(
        createFieldError(
          "configuration",
          COMPETITION_PUBLICATION_ERROR_CODE.CONFIGURATION_PRESENCE_MISMATCH,
          "configuration must not be provided when configurationPresence=ABSENT",
          {}
        )
      );
    }
    if (expectedConfigurationRevision != null) {
      errors.push(
        createFieldError(
          "expectedConfigurationRevision",
          COMPETITION_PUBLICATION_ERROR_CODE.CONFIGURATION_PRESENCE_MISMATCH,
          "expectedConfigurationRevision must not be provided when configurationPresence=ABSENT",
          {}
        )
      );
    }
    return errors;
  }

  // PRESENT
  if (configuration == null) {
    errors.push(
      createFieldError(
        "configuration",
        COMPETITION_PUBLICATION_ERROR_CODE.CONFIGURATION_PRESENCE_MISMATCH,
        "configuration is required when configurationPresence=PRESENT",
        {}
      )
    );
    return errors;
  }

  if (!isCompetitionConfiguration(configuration)) {
    errors.push(
      createFieldError(
        "configuration",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CONFIGURATION,
        "configuration failed CM-04 CompetitionConfiguration contract",
        {}
      )
    );
    return errors;
  }

  const cfg = /** @type {any} */ (configuration);
  if (cfg.tenantId !== scope.tenantId) {
    errors.push(
      createFieldError(
        "configuration.tenantId",
        COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH,
        "configuration.tenantId must match explicit tenantId",
        { expected: scope.tenantId, actual: cfg.tenantId }
      )
    );
  }
  if (cfg.competitionId !== scope.competitionId) {
    errors.push(
      createFieldError(
        "configuration.competitionId",
        COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH,
        "configuration.competitionId must match explicit competitionId",
        { expected: scope.competitionId, actual: cfg.competitionId }
      )
    );
  }
  if (!Number.isInteger(expectedConfigurationRevision) || expectedConfigurationRevision < 1) {
    errors.push(
      createFieldError(
        "expectedConfigurationRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_CONFIGURATION_REVISION,
        "expectedConfigurationRevision must be an integer >= 1 when configurationPresence=PRESENT",
        { value: expectedConfigurationRevision }
      )
    );
  } else if (cfg.revision !== expectedConfigurationRevision) {
    errors.push(
      createFieldError(
        "expectedConfigurationRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_CONFIGURATION_REVISION,
        "expectedConfigurationRevision does not match configuration.revision",
        { expected: expectedConfigurationRevision, actual: cfg.revision }
      )
    );
  }

  return errors;
}

/**
 * @param {unknown} branding
 * @param {unknown} expectedBrandingRevision
 * @param {{ tenantId: string, competitionId: string }} scope
 * @returns {object[]}
 */
export function collectBrandingErrors(branding, expectedBrandingRevision, scope) {
  /** @type {object[]} */
  const errors = [];

  if (branding == null) {
    errors.push(
      createFieldError(
        "branding",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_BRANDING,
        "explicit CompetitionBranding is required for the CM06_STANDARD_V1 profile",
        {}
      )
    );
    return errors;
  }

  if (!isCompetitionBranding(branding)) {
    errors.push(
      createFieldError(
        "branding",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_BRANDING,
        "branding failed CM-05 CompetitionBranding contract",
        {}
      )
    );
    return errors;
  }

  const b = /** @type {any} */ (branding);
  if (b.tenantId !== scope.tenantId) {
    errors.push(
      createFieldError(
        "branding.tenantId",
        COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH,
        "branding.tenantId must match explicit tenantId",
        { expected: scope.tenantId, actual: b.tenantId }
      )
    );
  }
  if (b.competitionId !== scope.competitionId) {
    errors.push(
      createFieldError(
        "branding.competitionId",
        COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH,
        "branding.competitionId must match explicit competitionId",
        { expected: scope.competitionId, actual: b.competitionId }
      )
    );
  }
  if (!Number.isInteger(expectedBrandingRevision) || expectedBrandingRevision < 1) {
    errors.push(
      createFieldError(
        "expectedBrandingRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_BRANDING_REVISION,
        "expectedBrandingRevision must be an integer >= 1",
        { value: expectedBrandingRevision }
      )
    );
  } else if (b.revision !== expectedBrandingRevision) {
    errors.push(
      createFieldError(
        "expectedBrandingRevision",
        COMPETITION_PUBLICATION_ERROR_CODE.STALE_BRANDING_REVISION,
        "expectedBrandingRevision does not match branding.revision",
        { expected: expectedBrandingRevision, actual: b.revision }
      )
    );
  }

  return errors;
}

/**
 * @param {string} channel
 * @param {unknown} visibility
 * @returns {object[]}
 */
export function collectChannelVisibilityErrors(channel, visibility) {
  /** @type {object[]} */
  const errors = [];
  if (!isCompetitionPublicationChannel(channel)) return errors;
  if (!isVisibilityAllowedForChannel(channel, visibility)) {
    errors.push(
      createFieldError(
        "definition.visibility",
        COMPETITION_PUBLICATION_ERROR_CODE.CHANNEL_VISIBILITY_REJECTED,
        `channel=${channel} rejects definition.visibility=${visibility}`,
        { channel, visibility }
      )
    );
  }
  return errors;
}

/**
 * @param {unknown} externalLifecycleBlock
 * @returns {object[]}
 */
export function collectExternalLifecycleBlockErrors(externalLifecycleBlock) {
  /** @type {object[]} */
  const errors = [];
  if (externalLifecycleBlock == null) return errors;
  if (typeof externalLifecycleBlock !== "object") {
    errors.push(
      createFieldError(
        "externalLifecycleBlock",
        COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CONTRACT,
        "externalLifecycleBlock must be an object when provided",
        {}
      )
    );
    return errors;
  }
  const status = /** @type {any} */ (externalLifecycleBlock).status;
  if (EXTERNAL_LIFECYCLE_BLOCKED_STATUSES.includes(status)) {
    errors.push(
      createFieldError(
        "externalLifecycleBlock.status",
        COMPETITION_PUBLICATION_ERROR_CODE.EXTERNAL_LIFECYCLE_BLOCKED,
        `publication is blocked by an external lifecycle status (${status}); CM-06 does not own this state`,
        { status }
      )
    );
  }
  return errors;
}

/**
 * Assemble a frozen CompetitionPublication record (pure — assumes inputs
 * already passed structural + readiness validation).
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   channel: string,
 *   status: string,
 *   revision: number,
 *   previousPublicationId: string|null,
 *   profileId: string,
 *   profileVersion: number,
 *   idempotencyKey: string,
 *   requestFingerprint: string,
 *   source: object,
 *   audience: { classification: string, requiredProfileId: string, outputReferenceType: string },
 *   publicReference: { slug: string } | null,
 *   manifest: object,
 * }} params
 * @returns {Readonly<object>}
 */
export function buildCompetitionPublicationRecord(params) {
  return deepFreeze({
    publicationId: params.publicationId,
    tenantId: String(params.tenantId).trim(),
    competitionId: String(params.competitionId).trim(),
    channel: params.channel,
    status: params.status,
    revision: params.revision,
    previousPublicationId: params.previousPublicationId ?? null,
    profileId: params.profileId,
    profileVersion: params.profileVersion,
    idempotencyKey: params.idempotencyKey,
    requestFingerprint: params.requestFingerprint,
    source: clonePlain(params.source),
    audience: clonePlain(params.audience),
    publicReference: params.publicReference ? clonePlain(params.publicReference) : null,
    manifest: clonePlain(params.manifest),
  });
}

/**
 * Structural guard for a stored CompetitionPublication record (fail-closed).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublication(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.publicationId) &&
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    isCompetitionPublicationChannel(v.channel) &&
    isCompetitionPublicationStatus(v.status) &&
    isValidCompetitionPublicationRevision(v.revision) &&
    (v.previousPublicationId === null || isNonEmptyString(v.previousPublicationId)) &&
    isCompetitionPublicationProfileId(v.profileId) &&
    Number.isInteger(v.profileVersion) &&
    isNonEmptyString(v.idempotencyKey) &&
    isNonEmptyString(v.requestFingerprint) &&
    isCompetitionPublicationSourceReferences(v.source) &&
    v.audience &&
    typeof v.audience === "object" &&
    (v.publicReference === null ||
      (typeof v.publicReference === "object" && isNonEmptyString(v.publicReference.slug))) &&
    v.manifest &&
    typeof v.manifest === "object"
  );
}

/**
 * Deterministic semantic fingerprint of a publish/republish request, used for
 * idempotency comparison (same key + same fingerprint => same result;
 * same key + different fingerprint => IDEMPOTENCY_CONFLICT).
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   channel: string,
 *   profileId: string,
 *   source: object,
 *   configurationPresence: string,
 *   publicReference: { slug: string } | null,
 *   expectedCurrentPublicationRevision: number,
 *   currentPublicationId?: string | null,
 * }} payload
 * @returns {string}
 */
export function computePublicationRequestFingerprint(payload) {
  return stableContentFingerprint({
    tenantId: payload.tenantId,
    competitionId: payload.competitionId,
    channel: payload.channel,
    profileId: payload.profileId,
    source: payload.source,
    configurationPresence: payload.configurationPresence,
    publicReference: payload.publicReference,
    expectedCurrentPublicationRevision: payload.expectedCurrentPublicationRevision,
    currentPublicationId: payload.currentPublicationId ?? null,
  });
}
