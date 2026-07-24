/**
 * Explicit read-only legacy tournament → CM-06 publication observation projector.
 *
 * Read-only. Provenance is always LEGACY_UNVERIFIED. This is NEVER treated as
 * a canonical CM-06 publication — it exists only to help an Integrator reason
 * about legacy state; it never creates, updates, or supersedes a
 * CompetitionPublication record, and it never writes to the legacy object.
 */

import { COMPETITION_PUBLICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { COMPETITION_PUBLICATION_SEVERITY } from "../constants/severity.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import { deepFreeze, clonePlain, isNonEmptyString } from "../contracts/shared.js";

export const LEGACY_PUBLICATION_COMPATIBILITY = Object.freeze({
  mode: "read-only-observation",
  provenance: "LEGACY_UNVERIFIED",
  writesLegacy: false,
  fullSafeMapping: false,
  isCanonicalPublication: false,
  note:
    "observation only — legacy isPublic/public/status/publishedAt/slug fields are not a CM-06 CompetitionPublication and are never promoted automatically",
});

/**
 * @param {string} path
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 */
function createIssue(path, code, message, details = {}) {
  return deepFreeze({
    path,
    code,
    severity: COMPETITION_PUBLICATION_SEVERITY.WARNING,
    message,
    details,
  });
}

/**
 * Project legacy tournament publication-shaped fields into a read-only
 * observation. Never canonical. Never mutates the legacy object.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   legacyTournament: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionPublicationValidationResult}
 */
export function projectLegacyTournamentPublicationObservation(command = {}) {
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
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required (never inferred from legacy blob)",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION,
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
        COMPETITION_PUBLICATION_ERROR_CODE.MALFORMED_LEGACY_PUBLICATION,
        "legacyTournament must be a plain object",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();

  // isPublic / public flags — ambiguous when both present and disagree.
  const hasIsPublic = Object.prototype.hasOwnProperty.call(raw, "isPublic");
  const hasPublic = Object.prototype.hasOwnProperty.call(raw, "public");
  let observedPublicFlag = null;

  if (hasIsPublic && typeof raw.isPublic !== "boolean") {
    issues.push(
      createIssue(
        "legacyTournament.isPublic",
        COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy isPublic is present but not a boolean",
        {}
      )
    );
  }
  if (hasPublic && typeof raw.public !== "boolean") {
    issues.push(
      createIssue(
        "legacyTournament.public",
        COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy public is present but not a boolean",
        {}
      )
    );
  }
  if (
    hasIsPublic &&
    hasPublic &&
    typeof raw.isPublic === "boolean" &&
    typeof raw.public === "boolean" &&
    raw.isPublic !== raw.public
  ) {
    issues.push(
      createIssue(
        "legacyTournament.isPublic|public",
        COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy isPublic and public flags disagree; observation cannot resolve a single public flag",
        { isPublic: raw.isPublic, public: raw.public }
      )
    );
  } else if (typeof raw.isPublic === "boolean") {
    observedPublicFlag = raw.isPublic;
  } else if (typeof raw.public === "boolean") {
    observedPublicFlag = raw.public;
  }

  // publishedAt — observation only, never proof of a canonical publication.
  let observedPublishedAt = null;
  if (Object.prototype.hasOwnProperty.call(raw, "publishedAt") && raw.publishedAt != null) {
    if (typeof raw.publishedAt === "string" || typeof raw.publishedAt === "number") {
      observedPublishedAt = raw.publishedAt;
    } else {
      issues.push(
        createIssue(
          "legacyTournament.publishedAt",
          COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy publishedAt is present but not a string/number timestamp",
          {}
        )
      );
    }
  }

  // status — free-form legacy status string; never mapped to CM-06 status enum automatically.
  let observedStatus = null;
  if (Object.prototype.hasOwnProperty.call(raw, "status") && raw.status != null) {
    if (typeof raw.status === "string" && raw.status.trim().length > 0) {
      observedStatus = raw.status.trim();
      issues.push(
        createIssue(
          "legacyTournament.status",
          COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy status is observed only; it is never mapped to a CM-06 publication status automatically",
          { value: observedStatus }
        )
      );
    } else {
      issues.push(
        createIssue(
          "legacyTournament.status",
          COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy status is present but not a non-empty string",
          {}
        )
      );
    }
  }

  // slug — observed only; never reserved/promoted to a CM-06 public reference automatically.
  let observedSlug = null;
  if (Object.prototype.hasOwnProperty.call(raw, "slug") && raw.slug != null) {
    if (typeof raw.slug === "string" && raw.slug.trim().length > 0) {
      observedSlug = raw.slug.trim();
      issues.push(
        createIssue(
          "legacyTournament.slug",
          COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy slug is observed only; it is never auto-reserved as a CM-06 public reference",
          { value: observedSlug }
        )
      );
    } else {
      issues.push(
        createIssue(
          "legacyTournament.slug",
          COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy slug is present but not a non-empty string",
          {}
        )
      );
    }
  }

  const result = deepFreeze({
    tenantId,
    competitionId,
    provenance: LEGACY_PUBLICATION_COMPATIBILITY.provenance,
    compatibility: LEGACY_PUBLICATION_COMPATIBILITY,
    observedPublicFlag,
    observedPublishedAt,
    observedStatus,
    observedSlug,
    issues: Object.freeze(issues),
    isCanonicalPublication: false,
    fullSafeMapping: false,
    writesLegacy: false,
  });

  return validationOk(clonePlain(result), {
    summary:
      "Legacy tournament publication read-only observation completed (never canonical).",
    reasons: Object.freeze([
      `issueCount=${issues.length}`,
      "provenance=LEGACY_UNVERIFIED",
      "isCanonicalPublication=false",
      "noWrite",
      "noPromotionToCompetitionPublication",
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyPublicationObservationResult(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    v.provenance === "LEGACY_UNVERIFIED" &&
    v.isCanonicalPublication === false &&
    v.fullSafeMapping === false
  );
}
