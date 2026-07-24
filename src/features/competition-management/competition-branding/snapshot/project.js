/**
 * Deterministic branding snapshot projection for future CM-03 capture (CM-05).
 * Does not create CompetitionVersion. Copy-safe / immutable.
 * Excludes signed URL tokens, binary/base64, UI state.
 */

import { COMPETITION_BRANDING_FINGERPRINT_ALGORITHM } from "../constants/comparison.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
  stableContentFingerprint,
} from "../contracts/shared.js";
import {
  isCompetitionBranding,
  semanticBrandingPayload,
} from "../contracts/branding.js";

/**
 * Strip referenceUri from assets for snapshot identity stability
 * (signed URL noise must not affect fingerprint; we already reject signed URIs
 * at validation — still omit referenceUri from fingerprint payload).
 * @param {object[]} assets
 * @returns {object[]}
 */
function canonicalAssetsForSnapshot(assets) {
  return (assets || []).map((a) => {
    const copy = clonePlain(a);
    // Keep referenceUri in snapshot payload only when present and already validated
    // as public-safe; fingerprint uses assetId/objectKey without query noise.
    return {
      kind: copy.kind,
      assetId: copy.assetId,
      tenantId: copy.tenantId,
      ownershipScope: copy.ownershipScope,
      storageProvider: copy.storageProvider,
      objectKey: copy.objectKey,
      referenceUri: copy.referenceUri,
      accessClassification: copy.accessClassification,
      mimeType: copy.mimeType,
      width: copy.width,
      height: copy.height,
      altText: copy.altText,
      contentHash: copy.contentHash,
      assetRevision: copy.assetRevision,
    };
  });
}

/**
 * @typedef {Object} CompetitionBrandingSnapshot
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} brandingId
 * @property {number} brandingRevision
 * @property {number} sourceDefinitionRevision
 * @property {string} status
 * @property {ReadonlyArray<object>} assets
 * @property {object|null} palette
 * @property {object|null} typography
 * @property {object} presentation
 * @property {object} accessibility
 * @property {object} metadata
 * @property {string} fingerprint
 * @property {string} fingerprintAlgorithm
 */

/**
 * Project branding into a deterministic snapshot payload.
 *
 * @param {{ branding: object }} command
 * @returns {import("../contracts/validation.js").CompetitionBrandingValidationResult}
 */
export function projectCompetitionBrandingSnapshot(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  const cmd = command && typeof command === "object" ? command : {};
  if (!isCompetitionBranding(cmd.branding)) {
    return validationFail([
      createFieldError(
        "branding",
        COMPETITION_BRANDING_ERROR_CODE.MALFORMED_BRANDING,
        "explicit valid CompetitionBranding is required",
        {}
      ),
    ]);
  }

  const branding = /** @type {any} */ (cmd.branding);
  const semantic = semanticBrandingPayload(branding);
  const assets = canonicalAssetsForSnapshot(semantic.assets);

  const fingerprintPayload = {
    tenantId: branding.tenantId,
    competitionId: branding.competitionId,
    brandingRevision: branding.revision,
    status: semantic.status,
    sourceDefinitionRevision: semantic.sourceDefinitionRevision,
    assets: assets.map((a) => ({
      kind: a.kind,
      assetId: a.assetId,
      tenantId: a.tenantId,
      ownershipScope: a.ownershipScope,
      storageProvider: a.storageProvider,
      objectKey: a.objectKey,
      accessClassification: a.accessClassification,
      mimeType: a.mimeType,
      width: a.width,
      height: a.height,
      altText: a.altText,
      contentHash: a.contentHash,
      assetRevision: a.assetRevision,
      // deliberately omit referenceUri from fingerprint
    })),
    palette: semantic.palette,
    typography: semantic.typography,
    presentation: semantic.presentation,
    metadata: semantic.metadata,
  };
  const fingerprint = stableContentFingerprint(fingerprintPayload);

  /** @type {CompetitionBrandingSnapshot} */
  const snapshot = {
    tenantId: branding.tenantId,
    competitionId: branding.competitionId,
    brandingId: branding.brandingId,
    brandingRevision: branding.revision,
    sourceDefinitionRevision: branding.sourceDefinitionRevision,
    status: branding.status,
    assets: deepFreeze(assets),
    palette: clonePlain(branding.palette),
    typography: clonePlain(branding.typography),
    presentation: clonePlain(branding.presentation),
    accessibility: clonePlain(branding.accessibility),
    metadata: clonePlain(semantic.metadata),
    fingerprint,
    fingerprintAlgorithm: COMPETITION_BRANDING_FINGERPRINT_ALGORITHM.id,
  };

  const frozen = deepFreeze(clonePlain(snapshot));

  return validationOk(frozen, {
    summary: "Competition branding snapshot projected.",
    reasons: Object.freeze([
      `brandingId=${frozen.brandingId}`,
      `brandingRevision=${frozen.brandingRevision}`,
      `fingerprint=${frozen.fingerprint}`,
      "excludesUiState",
      "excludesBinary",
      "excludesSignedUrlTokensFromFingerprint",
      "notCompetitionVersion",
      "notPublished",
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionBrandingSnapshot(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    isNonEmptyString(v.brandingId) &&
    Number.isInteger(v.brandingRevision) &&
    v.brandingRevision >= 1 &&
    Array.isArray(v.assets) &&
    isNonEmptyString(v.fingerprint) &&
    v.fingerprintAlgorithm === COMPETITION_BRANDING_FINGERPRINT_ALGORITHM.id
  );
}
