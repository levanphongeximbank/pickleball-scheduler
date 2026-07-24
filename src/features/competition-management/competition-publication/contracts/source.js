/**
 * Source reference assembly (CM-06).
 *
 * Every publication record and manifest carries the same explicit source
 * references back to the immutable CM-03 CompetitionVersion plus the
 * CM-01/CM-04/CM-05 revisions and fingerprints that were true at publish time.
 * CM-06 never re-derives these later from "latest" state.
 */

import { projectCompetitionConfigurationSnapshot } from "../../competition-configuration/index.js";
import { projectCompetitionBrandingSnapshot } from "../../competition-branding/index.js";
import { COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE } from "../constants/profiles.js";
import { deepFreeze, clonePlain } from "./shared.js";

/**
 * @typedef {Object} CompetitionPublicationSourceReferences
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} sourceCompetitionVersionId
 * @property {number} sourceCompetitionVersionNumber
 * @property {number} sourceDefinitionRevision
 * @property {number|null} sourceConfigurationRevision
 * @property {number} sourceBrandingRevision
 * @property {string|null} sourceTemplateId
 * @property {number|null} sourceTemplateVersion
 * @property {string} definitionFingerprint
 * @property {string|null} configurationFingerprint
 * @property {string} brandingFingerprint
 */

/**
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   competitionVersion: object,
 *   configurationPresence: string,
 *   configuration?: object|null,
 *   branding: object,
 * }} params
 * @returns {Readonly<CompetitionPublicationSourceReferences>}
 */
export function buildSourceReferences(params) {
  const {
    tenantId,
    competitionId,
    competitionVersion,
    configurationPresence,
    configuration,
    branding,
  } = params;

  const templateVersioned = competitionVersion.content?.templateVersioned ?? null;

  let configurationFingerprint = null;
  let sourceConfigurationRevision = null;
  if (configurationPresence === COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.PRESENT) {
    const projected = projectCompetitionConfigurationSnapshot({ configuration });
    if (!projected.ok) {
      throw new Error(
        "buildSourceReferences: configuration snapshot projection failed unexpectedly"
      );
    }
    configurationFingerprint = projected.value.fingerprint;
    sourceConfigurationRevision = configuration.revision;
  }

  const brandingProjected = projectCompetitionBrandingSnapshot({ branding });
  if (!brandingProjected.ok) {
    throw new Error(
      "buildSourceReferences: branding snapshot projection failed unexpectedly"
    );
  }

  return deepFreeze({
    tenantId: String(tenantId).trim(),
    competitionId: String(competitionId).trim(),
    sourceCompetitionVersionId: competitionVersion.versionId,
    sourceCompetitionVersionNumber: competitionVersion.versionNumber,
    sourceDefinitionRevision: competitionVersion.sourceDefinitionRevision,
    sourceConfigurationRevision,
    sourceBrandingRevision: branding.revision,
    sourceTemplateId: templateVersioned ? templateVersioned.templateId : null,
    sourceTemplateVersion: templateVersioned ? templateVersioned.templateVersion : null,
    definitionFingerprint: competitionVersion.contentFingerprint,
    configurationFingerprint,
    brandingFingerprint: brandingProjected.value.fingerprint,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationSourceReferences(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    typeof v.tenantId === "string" &&
    typeof v.competitionId === "string" &&
    typeof v.sourceCompetitionVersionId === "string" &&
    Number.isInteger(v.sourceCompetitionVersionNumber) &&
    Number.isInteger(v.sourceDefinitionRevision) &&
    (v.sourceConfigurationRevision === null ||
      Number.isInteger(v.sourceConfigurationRevision)) &&
    Number.isInteger(v.sourceBrandingRevision) &&
    typeof v.definitionFingerprint === "string" &&
    typeof v.brandingFingerprint === "string"
  );
}

/**
 * @param {object} source
 * @returns {object}
 */
export function cloneSourceReferences(source) {
  return clonePlain(source);
}
