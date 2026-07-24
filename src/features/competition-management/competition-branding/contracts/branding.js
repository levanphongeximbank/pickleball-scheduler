/**
 * CompetitionBranding aggregate validation (CM-05).
 */

import {
  isDraftEditableStatus,
  isValidCompetitionDefinitionRevision,
  isCompetitionDefinition,
} from "../../competition-definition/index.js";
import {
  isCompetitionBrandingStatus,
  isBrandingEditableStatus,
} from "../constants/status.js";
import {
  COMPETITION_BRANDING_INITIAL_REVISION,
  isValidCompetitionBrandingRevision,
} from "../constants/revision.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError, validationOk, validationFail } from "./validation.js";
import { deepFreeze, clonePlain, isNonEmptyString, canonicalizeJson } from "./shared.js";
import { createCompetitionBrandingId } from "./identity.js";
import { parseBrandAssets } from "./assets.js";
import { parseBrandPalette } from "./colors.js";
import { parseTypographyReference } from "./presentation.js";
import { parsePresentationMetadata } from "./presentationMetadata.js";
import {
  evaluateBrandingAccessibility,
  accessibilityIssuesToFieldErrors,
} from "../accessibility/index.js";

/**
 * @typedef {Object} CompetitionBranding
 * @property {string} brandingId
 * @property {string} competitionId
 * @property {string} tenantId
 * @property {number} revision
 * @property {string} status
 * @property {number} sourceDefinitionRevision
 * @property {ReadonlyArray<object>} assets
 * @property {Readonly<object>|null} palette
 * @property {Readonly<object>|null} typography
 * @property {Readonly<object>} presentation
 * @property {Readonly<object>} accessibility
 * @property {object} metadata
 */

/**
 * Collect CM-01 definition scope / editability / revision errors.
 * @param {unknown} definition
 * @param {{ tenantId: string, competitionId: string, expectedDefinitionRevision: number, requireEditable?: boolean }} scope
 * @returns {object[]}
 */
export function collectDefinitionScopeErrors(definition, scope) {
  /** @type {object[]} */
  const errors = [];

  if (!definition || typeof definition !== "object") {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_BRANDING_ERROR_CODE.INVALID_DEFINITION,
        "explicit CompetitionDefinition is required",
        {}
      )
    );
    return errors;
  }

  const def = /** @type {any} */ (definition);

  if (!isCompetitionDefinition(def)) {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_BRANDING_ERROR_CODE.INVALID_DEFINITION,
        "definition failed CM-01 CompetitionDefinition contract",
        {}
      )
    );
  }

  if (!isNonEmptyString(def.tenantId) || def.tenantId !== scope.tenantId) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_BRANDING_ERROR_CODE.TENANT_MISMATCH,
        "definition.tenantId must match explicit tenantId",
        {
          expected: scope.tenantId,
          actual: def.tenantId,
        }
      )
    );
  }

  if (
    !isNonEmptyString(def.competitionId) ||
    def.competitionId !== scope.competitionId
  ) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_BRANDING_ERROR_CODE.COMPETITION_MISMATCH,
        "definition.competitionId must match explicit competitionId",
        {
          expected: scope.competitionId,
          actual: def.competitionId,
        }
      )
    );
  }

  if (scope.requireEditable !== false) {
    if (!isDraftEditableStatus(def.status)) {
      errors.push(
        createFieldError(
          "definition.status",
          COMPETITION_BRANDING_ERROR_CODE.NON_EDITABLE_DEFINITION,
          "definition must be in editable draft status",
          { status: def.status }
        )
      );
    }
  }

  if (!isValidCompetitionDefinitionRevision(scope.expectedDefinitionRevision)) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_BRANDING_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedDefinitionRevision must be an integer >= 1",
        { value: scope.expectedDefinitionRevision }
      )
    );
  } else if (def.revision !== scope.expectedDefinitionRevision) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_BRANDING_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedDefinitionRevision does not match definition.revision",
        {
          expected: scope.expectedDefinitionRevision,
          actual: def.revision,
        }
      )
    );
  }

  return errors;
}

/**
 * Validate and assemble a CompetitionBranding aggregate.
 *
 * Empty draft: assets=[], palette=null/{} , presentation empty — allowed.
 * Sponsor marks: deferred (reject if provided).
 *
 * @param {object} input
 * @param {{ requireEditableStatus?: boolean, enforceContrast?: boolean }} [options]
 * @returns {import("./validation.js").CompetitionBrandingValidationResult}
 */
export function validateCompetitionBrandingInput(input, options = {}) {
  /** @type {object[]} */
  const errors = [];
  const src = input && typeof input === "object" ? input : {};
  const enforceContrast = options.enforceContrast !== false;

  if (!isNonEmptyString(src.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(src.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }

  const tenantId = isNonEmptyString(src.tenantId)
    ? String(src.tenantId).trim()
    : "";
  const competitionId = isNonEmptyString(src.competitionId)
    ? String(src.competitionId).trim()
    : "";

  if (!isCompetitionBrandingStatus(src.status)) {
    errors.push(
      createFieldError(
        "status",
        COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
        "status must be draft|locked",
        { value: src.status }
      )
    );
  } else if (
    options.requireEditableStatus === true &&
    !isBrandingEditableStatus(src.status)
  ) {
    errors.push(
      createFieldError(
        "status",
        COMPETITION_BRANDING_ERROR_CODE.NON_EDITABLE_BRANDING,
        "branding must be draft for this operation",
        { status: src.status }
      )
    );
  }

  if (!isValidCompetitionBrandingRevision(src.revision)) {
    errors.push(
      createFieldError(
        "revision",
        COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
        "revision must be an integer >= 1",
        { value: src.revision }
      )
    );
  }

  if (!isValidCompetitionDefinitionRevision(src.sourceDefinitionRevision)) {
    errors.push(
      createFieldError(
        "sourceDefinitionRevision",
        COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
        "sourceDefinitionRevision must be an integer >= 1",
        { value: src.sourceDefinitionRevision }
      )
    );
  }

  // Sponsor marks deferred — reject if present (no fake commercial ownership)
  if (src.sponsorMarks != null) {
    if (Array.isArray(src.sponsorMarks) && src.sponsorMarks.length === 0) {
      // empty array tolerated as explicit absence
    } else {
      errors.push(
        createFieldError(
          "sponsorMarks",
          COMPETITION_BRANDING_ERROR_CODE.SPONSOR_MARKS_DEFERRED,
          "sponsor/partner marks are deferred; commercial ownership is not inferred in CM-05",
          {}
        )
      );
    }
  }

  // Reject CM-01 name/description smuggling at aggregate root
  for (const forbidden of ["name", "description", "canonicalName", "canonicalDescription"]) {
    if (Object.prototype.hasOwnProperty.call(src, forbidden)) {
      errors.push(
        createFieldError(
          forbidden,
          COMPETITION_BRANDING_ERROR_CODE.CANONICAL_NAME_OWNERSHIP,
          "canonical name/description remain owned by CM-01",
          {}
        )
      );
    }
  }

  const assetsParsed =
    tenantId
      ? parseBrandAssets(src.assets, { tenantId })
      : { errors: [], value: deepFreeze([]) };
  errors.push(...assetsParsed.errors);

  const paletteParsed = parseBrandPalette(src.palette);
  errors.push(...paletteParsed.errors);

  const typographyParsed = parseTypographyReference(src.typography);
  errors.push(...typographyParsed.errors);

  const presentationParsed = parsePresentationMetadata(src.presentation);
  errors.push(...presentationParsed.errors);

  if (src.metadata != null) {
    if (typeof src.metadata !== "object" || Array.isArray(src.metadata)) {
      errors.push(
        createFieldError(
          "metadata",
          COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
          "metadata must be a plain object when provided",
          {}
        )
      );
    } else {
      for (const forbidden of [
        "uiWizardState",
        "formState",
        "muiTheme",
        "cssVariables",
        "runtimeTheme",
        "uploadSession",
        "localFilePath",
      ]) {
        if (Object.prototype.hasOwnProperty.call(src.metadata, forbidden)) {
          errors.push(
            createFieldError(
              `metadata.${forbidden}`,
              COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
              "metadata must not contain UI/runtime/upload state",
              {}
            )
          );
        }
      }
    }
  }

  let accessibility = evaluateBrandingAccessibility({
    palette: paletteParsed.value,
    assets: assetsParsed.value,
  });

  if (enforceContrast && paletteParsed.value && Object.keys(paletteParsed.value).length > 0) {
    errors.push(...accessibilityIssuesToFieldErrors(accessibility));
  }

  if (errors.length > 0) {
    return validationFail(errors);
  }

  // Recompute accessibility on successful palette (deterministic)
  accessibility = evaluateBrandingAccessibility({
    palette: paletteParsed.value,
    assets: assetsParsed.value,
  });

  const expectedId = createCompetitionBrandingId(tenantId, competitionId);
  if (
    src.brandingId != null &&
    String(src.brandingId).trim() !== expectedId
  ) {
    return validationFail([
      createFieldError(
        "brandingId",
        COMPETITION_BRANDING_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE,
        "brandingId must equal cb::{tenantId}::{competitionId}",
        {
          expected: expectedId,
          actual: src.brandingId,
        }
      ),
    ]);
  }

  const metadataSrc =
    src.metadata && typeof src.metadata === "object" ? src.metadata : {};

  /** @type {CompetitionBranding} */
  const value = {
    brandingId: expectedId,
    competitionId,
    tenantId,
    revision: /** @type {number} */ (src.revision),
    status: /** @type {string} */ (src.status),
    sourceDefinitionRevision: /** @type {number} */ (src.sourceDefinitionRevision),
    assets: assetsParsed.value,
    palette:
      paletteParsed.value && Object.keys(paletteParsed.value).length === 0
        ? null
        : paletteParsed.value,
    typography: typographyParsed.value,
    presentation: presentationParsed.value,
    accessibility: deepFreeze({
      algorithm: accessibility.algorithm,
      threshold: accessibility.threshold,
      passed: accessibility.passed,
      issueCount: accessibility.issues.length,
      ratios: accessibility.ratios,
    }),
    metadata: deepFreeze({
      externalEditabilityConstraint: metadataSrc.externalEditabilityConstraint
        ? clonePlain(metadataSrc.externalEditabilityConstraint)
        : null,
      inferredFromPlatform: false,
      inferredFromTenant: false,
      inferredFromVenue: false,
      inferredFromClub: false,
    }),
  };

  return validationOk(deepFreeze(value));
}

/**
 * @param {unknown} value
 * @returns {value is CompetitionBranding}
 */
export function isCompetitionBranding(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.brandingId) &&
    isNonEmptyString(v.competitionId) &&
    isNonEmptyString(v.tenantId) &&
    isValidCompetitionBrandingRevision(v.revision) &&
    isCompetitionBrandingStatus(v.status) &&
    isValidCompetitionDefinitionRevision(v.sourceDefinitionRevision) &&
    Array.isArray(v.assets) &&
    v.presentation &&
    typeof v.presentation === "object" &&
    v.accessibility &&
    typeof v.accessibility === "object" &&
    v.metadata &&
    typeof v.metadata === "object"
  );
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function brandingsSemanticallyEqual(a, b) {
  return (
    canonicalizeJson(semanticBrandingPayload(a)) ===
    canonicalizeJson(semanticBrandingPayload(b))
  );
}

/**
 * Semantic payload for comparison/fingerprint (excludes volatile nothing —
 * accessibility ratios are derived; include for determinism of stored aggregate).
 * Snapshot fingerprint uses a narrower payload that excludes derived accessibility.
 *
 * @param {object} branding
 * @returns {object}
 */
export function semanticBrandingPayload(branding) {
  return {
    competitionId: branding.competitionId,
    tenantId: branding.tenantId,
    status: branding.status,
    sourceDefinitionRevision: branding.sourceDefinitionRevision,
    assets: branding.assets,
    palette: branding.palette,
    typography: branding.typography,
    presentation: branding.presentation,
    metadata: {
      externalEditabilityConstraint:
        branding.metadata?.externalEditabilityConstraint ?? null,
      inferredFromPlatform: false,
      inferredFromTenant: false,
      inferredFromVenue: false,
      inferredFromClub: false,
    },
  };
}

export { COMPETITION_BRANDING_INITIAL_REVISION };
