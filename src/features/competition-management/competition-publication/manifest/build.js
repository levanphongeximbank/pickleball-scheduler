/**
 * Deterministic public manifest projection (CM-06).
 *
 * The manifest is the public-safe projection of a CompetitionPublication:
 * schema version "cm06-manifest-v1", fingerprint algorithm "cm06-fnv1a32-v1".
 * Excludes secrets, signed URLs, binary content, UI state, and runtime engine
 * state (the CM-04/CM-05 snapshot projectors already enforce this; CM-06 adds
 * no further raw fields on top). `generatedAt` is included only when an
 * explicit clock/value is provided by the caller — never derived from an
 * implicit wall clock.
 */

import { projectCompetitionConfigurationSnapshot } from "../../competition-configuration/index.js";
import { projectCompetitionBrandingSnapshot } from "../../competition-branding/index.js";
import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CompetitionPublicationError } from "../errors/CompetitionPublicationError.js";
import { COMPETITION_PUBLICATION_MANIFEST_SCHEMA_VERSION, COMPETITION_PUBLICATION_FINGERPRINT_ALGORITHM } from "../constants/comparison.js";
import { COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE } from "../constants/profiles.js";
import { deepFreeze, clonePlain, stableContentFingerprint, isNonEmptyString } from "../contracts/shared.js";

/**
 * @typedef {Object} CompetitionPublicationManifest
 * @property {string} schemaVersion
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} channel
 * @property {string} publicationId
 * @property {number} revision
 * @property {string} profileId
 * @property {number} profileVersion
 * @property {object} source
 * @property {{ classification: string, requiredProfileId: string, outputReferenceType: string }} audience
 * @property {object} definition
 * @property {object|null} configuration
 * @property {object} branding
 * @property {{ slug: string } | null} publicReference
 * @property {string|number|null} generatedAt
 * @property {string} fingerprint
 * @property {string} fingerprintAlgorithm
 */

/**
 * Pure assembly — assumes inputs already passed readiness/structural validation.
 *
 * @param {{
 *   publicationId: string,
 *   tenantId: string,
 *   competitionId: string,
 *   channel: string,
 *   revision: number,
 *   profileId: string,
 *   profileVersion: number,
 *   source: object,
 *   competitionVersion: object,
 *   configurationPresence: string,
 *   configuration?: object|null,
 *   branding: object,
 *   channelDescriptor: { audienceClassification: string, requiredProfileId: string, outputReferenceType: string },
 *   publicReference?: { slug: string } | null,
 *   clock?: (() => (string|number)) | string | number | null,
 * }} params
 * @returns {Readonly<CompetitionPublicationManifest>}
 */
export function buildCompetitionPublicationManifest(params = {}) {
  const {
    publicationId,
    tenantId,
    competitionId,
    channel,
    revision,
    profileId,
    profileVersion,
    source,
    competitionVersion,
    configurationPresence,
    configuration,
    branding,
    channelDescriptor,
    publicReference,
    clock,
  } = params;

  let configurationProjection = null;
  if (configurationPresence === COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.PRESENT) {
    const projected = projectCompetitionConfigurationSnapshot({ configuration });
    if (!projected.ok) {
      throw new CompetitionPublicationError(
        COMPETITION_PUBLICATION_ERROR_CODE.MALFORMED_MANIFEST,
        "configuration snapshot projection failed while building manifest",
        {}
      );
    }
    configurationProjection = projected.value;
  }

  const brandingProjected = projectCompetitionBrandingSnapshot({ branding });
  if (!brandingProjected.ok) {
    throw new CompetitionPublicationError(
      COMPETITION_PUBLICATION_ERROR_CODE.MALFORMED_MANIFEST,
      "branding snapshot projection failed while building manifest",
      {}
    );
  }

  const corePayload = {
    schemaVersion: COMPETITION_PUBLICATION_MANIFEST_SCHEMA_VERSION,
    tenantId: String(tenantId).trim(),
    competitionId: String(competitionId).trim(),
    channel,
    publicationId,
    revision,
    profileId,
    profileVersion,
    source: clonePlain(source),
    audience: {
      classification: channelDescriptor.audienceClassification,
      requiredProfileId: channelDescriptor.requiredProfileId,
      outputReferenceType: channelDescriptor.outputReferenceType,
    },
    definition: clonePlain(competitionVersion.content),
    configuration: configurationProjection ? clonePlain(configurationProjection) : null,
    branding: clonePlain(brandingProjected.value),
    publicReference: publicReference ? clonePlain(publicReference) : null,
  };

  const fingerprint = stableContentFingerprint(corePayload);

  const hasExplicitClock =
    Object.prototype.hasOwnProperty.call(params, "clock") && clock != null;
  const generatedAt = hasExplicitClock
    ? typeof clock === "function"
      ? clock()
      : clock
    : null;

  return deepFreeze({
    ...corePayload,
    generatedAt,
    fingerprint,
    fingerprintAlgorithm: COMPETITION_PUBLICATION_FINGERPRINT_ALGORITHM.id,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationManifest(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    v.schemaVersion === COMPETITION_PUBLICATION_MANIFEST_SCHEMA_VERSION &&
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    isNonEmptyString(v.publicationId) &&
    Number.isInteger(v.revision) &&
    isNonEmptyString(v.fingerprint) &&
    v.fingerprintAlgorithm === COMPETITION_PUBLICATION_FINGERPRINT_ALGORITHM.id
  );
}
