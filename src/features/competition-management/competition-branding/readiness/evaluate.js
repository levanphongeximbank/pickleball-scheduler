/**
 * Branding readiness evaluation (CM-05).
 * Metadata-only — no network, no physical asset existence check, no publish.
 */

import { COMPETITION_BRAND_ASSET_KIND } from "../constants/assetKinds.js";
import { COMPETITION_BRAND_PALETTE_REQUIRED_KEYS } from "../constants/colors.js";
import { COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY } from "../constants/accessibility.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  deepFreeze,
  compareFieldPath,
  isNonEmptyString,
} from "../contracts/shared.js";
import { isCompetitionBranding } from "../contracts/branding.js";
import { evaluateBrandingAccessibility } from "../accessibility/index.js";

/**
 * @param {string} path
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {object} [details]
 */
function createIssue(path, code, severity, message, details = {}) {
  return deepFreeze({
    path,
    code,
    severity,
    message,
    details,
  });
}

/**
 * Evaluate competition branding readiness for a publication profile baseline.
 *
 * Does not publish. Does not call network. Does not verify physical storage.
 *
 * @param {{
 *   branding: object,
 *   profile?: "draft" | "publication_facing",
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionBrandingValidationResult}
 */
export function evaluateCompetitionBrandingReadiness(command = {}) {
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
  const profile =
    cmd.profile === "publication_facing" ? "publication_facing" : "draft";

  /** @type {object[]} */
  const issues = [];

  const assetsByKind = new Map(
    (branding.assets || []).map((a) => [a.kind, a])
  );

  if (profile === "publication_facing") {
    if (!assetsByKind.has(COMPETITION_BRAND_ASSET_KIND.PRIMARY_LOGO)) {
      issues.push(
        createIssue(
          "assets.PRIMARY_LOGO",
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR,
          "primary logo is required for publication_facing readiness",
          { required: true }
        )
      );
    }

    const palette = branding.palette;
    if (!palette || typeof palette !== "object") {
      issues.push(
        createIssue(
          "palette",
          COMPETITION_BRANDING_ERROR_CODE.INCOMPLETE_PALETTE,
          COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR,
          "complete palette is required for publication_facing readiness",
          { requiredKeys: COMPETITION_BRAND_PALETTE_REQUIRED_KEYS }
        )
      );
    } else {
      for (const key of COMPETITION_BRAND_PALETTE_REQUIRED_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(palette, key)) {
          issues.push(
            createIssue(
              `palette.${key}`,
              COMPETITION_BRANDING_ERROR_CODE.INCOMPLETE_PALETTE,
              COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR,
              `palette.${key} is required for publication_facing readiness`,
              {}
            )
          );
        }
      }
    }

    for (const asset of branding.assets || []) {
      if (asset.accessClassification === "private") {
        issues.push(
          createIssue(
            `assets.${asset.kind}.accessClassification`,
            COMPETITION_BRANDING_ERROR_CODE.SIGNED_OR_PRIVATE_ASSET_NOT_PUBLIC_SAFE,
            COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR,
            "private assets are not public-safe for publication_facing profile",
            { kind: asset.kind }
          )
        );
      }
    }
  } else {
    // draft profile: informational missing primary logo
    if (!assetsByKind.has(COMPETITION_BRAND_ASSET_KIND.PRIMARY_LOGO)) {
      issues.push(
        createIssue(
          "assets.PRIMARY_LOGO",
          COMPETITION_BRANDING_ERROR_CODE.INVALID_ASSET_REFERENCE,
          COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.INFO,
          "primary logo is optional for empty draft but recommended",
          { required: false }
        )
      );
    }
  }

  const accessibility = evaluateBrandingAccessibility({
    palette: branding.palette,
    assets: branding.assets,
  });
  for (const aIssue of accessibility.issues) {
    issues.push(
      createIssue(
        aIssue.path,
        aIssue.code,
        aIssue.severity,
        aIssue.message,
        aIssue.details || {}
      )
    );
  }

  issues.sort((a, b) => {
    const byPath = compareFieldPath(a.path, b.path);
    if (byPath !== 0) return byPath;
    const bySev = String(a.severity).localeCompare(String(b.severity), "en");
    if (bySev !== 0) return bySev;
    return String(a.code).localeCompare(String(b.code), "en");
  });

  const errorCount = issues.filter(
    (i) => i.severity === COMPETITION_BRANDING_ACCESSIBILITY_SEVERITY.ERROR
  ).length;

  const result = deepFreeze({
    tenantId: branding.tenantId,
    competitionId: branding.competitionId,
    brandingId: branding.brandingId,
    brandingRevision: branding.revision,
    profile,
    ready: errorCount === 0,
    issueCount: issues.length,
    errorCount,
    issues: Object.freeze(issues),
    networkCallsPerformed: 0,
    published: false,
    storageChecked: false,
  });

  return validationOk(result, {
    summary: result.ready
      ? `Competition branding readiness PASS for profile=${profile}.`
      : `Competition branding readiness FAIL for profile=${profile} (${errorCount} errors).`,
    reasons: Object.freeze([
      `profile=${profile}`,
      `ready=${result.ready}`,
      `issueCount=${issues.length}`,
      "noNetwork",
      "noPublish",
      "noStorageExistenceCheck",
    ]),
  });
}

export { isNonEmptyString };
