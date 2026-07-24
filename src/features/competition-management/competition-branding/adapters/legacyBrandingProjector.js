/**
 * Explicit read-only legacy tournament → CM-05 branding projector.
 *
 * Partial projection only. No write to legacy objects.
 * No full safe mapping. No inference of tenant/competition/asset ownership.
 * No platform/tenant/venue/club brand inheritance.
 */

import { COMPETITION_BRAND_ASSET_KIND } from "../constants/assetKinds.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import { deepFreeze, clonePlain, isNonEmptyString } from "../contracts/shared.js";
import { normalizeBrandColor } from "../contracts/colors.js";
import { isSignedOrTokenizedUri } from "../contracts/assets.js";

export const LEGACY_BRANDING_COMPATIBILITY = Object.freeze({
  mode: "partial-projection",
  writesLegacy: false,
  fullSafeMapping: false,
  sponsorMarksSupported: false,
  note:
    "no safe full legacy branding mapping — only explicit field projections with typed issues for ambiguous/unsupported fields; regulations/registrationPolicy copy is not CM-05 visual branding ownership",
});

/**
 * Project legacy tournament blob fragments into CM-05 branding proposals.
 *
 * Requires explicit tenantId + competitionId (never inferred).
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   legacyTournament: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionBrandingValidationResult}
 */
export function projectLegacyTournamentToBranding(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  /** @type {object[]} */
  const errors = [];
  /** @type {object[]} */
  const issues = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required (never inferred from legacy blob)",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required (never inferred from legacy blob)",
        {}
      )
    );
  }

  const raw = cmd.legacyTournament;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(
      createFieldError(
        "legacyTournament",
        COMPETITION_BRANDING_ERROR_CODE.MALFORMED_LEGACY_BRANDING,
        "legacyTournament must be a plain object",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();

  /** @type {object[]} */
  const assetProposals = [];
  /** @type {Record<string, string>} */
  const paletteProposal = {};
  /** @type {object} */
  const presentationProposal = {};
  /** @type {object[]} */
  const unsupportedFields = [];

  // Soft-read tournament.image — ambiguous ownership / no assetId
  if (Object.prototype.hasOwnProperty.call(raw, "image") && raw.image != null) {
    if (typeof raw.image !== "string" || !raw.image.trim()) {
      issues.push(
        createFieldError(
          "legacyTournament.image",
          COMPETITION_BRANDING_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy image is present but not a non-empty string",
          {}
        )
      );
    } else if (isSignedOrTokenizedUri(raw.image)) {
      issues.push(
        createFieldError(
          "legacyTournament.image",
          COMPETITION_BRANDING_ERROR_CODE.SIGNED_OR_PRIVATE_ASSET_NOT_PUBLIC_SAFE,
          "legacy image looks like a signed/tokenized URL and cannot become a canonical asset",
          {}
        )
      );
    } else {
      issues.push(
        createFieldError(
          "legacyTournament.image",
          COMPETITION_BRANDING_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy image URL lacks explicit assetId and ownership metadata; not auto-promoted to PRIMARY_LOGO/COVER",
          { kindHint: COMPETITION_BRAND_ASSET_KIND.COVER }
        )
      );
      unsupportedFields.push({
        path: "image",
        reason: "missing_asset_identity_and_ownership",
      });
    }
  }

  // Explicit branding.colors if present (rare/ad-hoc)
  const brandingBag =
    raw.branding && typeof raw.branding === "object" ? raw.branding : null;
  if (brandingBag) {
    const colors =
      brandingBag.colors && typeof brandingBag.colors === "object"
        ? brandingBag.colors
        : null;
    if (colors) {
      for (const key of [
        "primary",
        "secondary",
        "accent",
        "background",
        "surface",
        "textPrimary",
        "textSecondary",
        "border",
      ]) {
        if (!Object.prototype.hasOwnProperty.call(colors, key)) continue;
        const normalized = normalizeBrandColor(colors[key]);
        if (normalized) {
          paletteProposal[key] = normalized;
        } else {
          issues.push(
            createFieldError(
              `legacyTournament.branding.colors.${key}`,
              COMPETITION_BRANDING_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
              "legacy color is not a valid #RRGGBB value",
              { value: colors[key] }
            )
          );
        }
      }
    }
    if (isNonEmptyString(brandingBag.tagline)) {
      presentationProposal.tagline = String(brandingBag.tagline).trim();
    }
    if (isNonEmptyString(brandingBag.shortLabel)) {
      presentationProposal.shortLabel = String(brandingBag.shortLabel).trim();
    }
    if (brandingBag.logoUrl != null) {
      issues.push(
        createFieldError(
          "legacyTournament.branding.logoUrl",
          COMPETITION_BRANDING_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy logoUrl lacks assetId/ownership; not auto-promoted",
          {}
        )
      );
      unsupportedFields.push({
        path: "branding.logoUrl",
        reason: "missing_asset_identity_and_ownership",
      });
    }
  }

  // Name/description are CM-01 — never map into branding presentation as overrides
  if (raw.name != null) {
    unsupportedFields.push({
      path: "name",
      reason: "owned_by_cm01_canonical_name",
    });
  }
  if (raw.description != null) {
    unsupportedFields.push({
      path: "description",
      reason: "owned_by_cm01_canonical_description",
    });
  }

  const settings =
    raw.settings && typeof raw.settings === "object" ? raw.settings : null;
  if (settings) {
    // Regulation / registration copy — NOT CM-05 visual branding ownership
    if (settings.regulations) {
      unsupportedFields.push({
        path: "settings.regulations",
        reason: "not_cm05_visual_branding_deferred_copy_capability",
      });
    }
    if (settings.registrationPolicy) {
      unsupportedFields.push({
        path: "settings.registrationPolicy",
        reason: "not_cm05_visual_branding_deferred_copy_capability",
      });
    }
  }

  // Club/venue/platform inheritance markers — reject if present as branding source
  for (const path of ["clubLogo", "venueCover", "platformTheme", "tenantBrand"]) {
    if (Object.prototype.hasOwnProperty.call(raw, path)) {
      issues.push(
        createFieldError(
          `legacyTournament.${path}`,
          COMPETITION_BRANDING_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "platform/tenant/venue/club brand fields are not competition branding and are not inferred",
          {}
        )
      );
      unsupportedFields.push({
        path,
        reason: "out_of_scope_non_competition_brand",
      });
    }
  }

  const paletteKeys = Object.keys(paletteProposal);
  const result = deepFreeze({
    tenantId,
    competitionId,
    compatibility: LEGACY_BRANDING_COMPATIBILITY,
    assetProposals: Object.freeze(assetProposals),
    paletteProposal:
      paletteKeys.length > 0 ? deepFreeze(paletteProposal) : null,
    presentationProposal: deepFreeze(presentationProposal),
    issues: Object.freeze(issues),
    unsupportedFields: Object.freeze(unsupportedFields),
    fullSafeMapping: false,
    inferredFromPlatform: false,
    inferredFromTenant: false,
    inferredFromVenue: false,
    inferredFromClub: false,
    writesLegacy: false,
  });

  return validationOk(clonePlain(result), {
    summary:
      "Legacy tournament branding partial projection completed (no full safe mapping).",
    reasons: Object.freeze([
      `issueCount=${issues.length}`,
      `unsupportedFieldCount=${unsupportedFields.length}`,
      "noWrite",
      "noOwnershipInference",
      "noPlatformInheritance",
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyBrandingProjectionResult(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    v.compatibility?.mode === "partial-projection" &&
    v.fullSafeMapping === false
  );
}
