/**
 * Explicit read-only legacy tournament → CM-08 archive observation projector.
 *
 * Read-only. Provenance is always LEGACY_UNVERIFIED. Never creates a canonical
 * CompetitionArchiveRecord. Never writes the legacy object.
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import { COMPETITION_ARCHIVE_SEVERITY } from "../constants/severity.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";

export const LEGACY_ARCHIVE_COMPATIBILITY = Object.freeze({
  mode: "read-only-observation",
  provenance: "LEGACY_UNVERIFIED",
  writesLegacy: false,
  fullSafeMapping: false,
  isCanonicalArchiveRecord: false,
  note:
    "observation only — legacy tournament archive/hidden/deleted flags are never promoted to CM-08 records automatically",
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
    severity: COMPETITION_ARCHIVE_SEVERITY.WARNING,
    message,
    details,
  });
}

/**
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   legacyTournament: object,
 * }} command
 */
export function projectLegacyTournamentArchiveObservation(command = {}) {
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
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required (never inferred from legacy blob)",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION,
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
        COMPETITION_ARCHIVE_ERROR_CODE.MALFORMED_LEGACY_ARCHIVE,
        "legacyTournament must be a plain object",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();

  let observedArchivedFlag = false;
  if (
    raw.archived === true ||
    raw.isArchived === true ||
    String(raw.status || "").toLowerCase() === "archived"
  ) {
    observedArchivedFlag = true;
  }

  const observedArchivedAt = isNonEmptyString(raw.archivedAt)
    ? String(raw.archivedAt).trim()
    : null;
  const observedArchivedBy = isNonEmptyString(raw.archivedBy)
    ? String(raw.archivedBy).trim()
    : isNonEmptyString(raw.archivedByUserId)
      ? String(raw.archivedByUserId).trim()
      : null;

  if (raw.deletedAt != null || raw.deleted === true || raw.isDeleted === true) {
    issues.push(
      createIssue(
        "legacyTournament.deletedAt",
        COMPETITION_ARCHIVE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy deletedAt is not canonical archive",
        {}
      )
    );
  }

  if (raw.hidden === true || raw.isHidden === true) {
    issues.push(
      createIssue(
        "legacyTournament.hidden",
        COMPETITION_ARCHIVE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy hidden flag is not archive",
        {}
      )
    );
  }

  const statusRaw = isNonEmptyString(raw.status)
    ? String(raw.status).trim().toLowerCase()
    : null;

  if (statusRaw === "cancelled") {
    issues.push(
      createIssue(
        "legacyTournament.status",
        COMPETITION_ARCHIVE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "cancelled is not automatically archive",
        {}
      )
    );
  }

  if (statusRaw === "completed" || statusRaw === "finished") {
    issues.push(
      createIssue(
        "legacyTournament.status",
        COMPETITION_ARCHIVE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "completed is not automatically archive",
        {}
      )
    );
  }

  return validationOk(
    deepFreeze({
      tenantId,
      competitionId,
      provenance: LEGACY_ARCHIVE_COMPATIBILITY.provenance,
      isCanonicalArchiveRecord: false,
      observedArchivedFlag,
      observedArchivedAt,
      observedArchivedBy,
      observedStatus: statusRaw,
      sourcePath: "legacyTournament",
      issues: Object.freeze(issues),
      compatibility: LEGACY_ARCHIVE_COMPATIBILITY,
      claims: Object.freeze({
        actorInferred: false,
        authorityInferred: false,
        sourceRevisionInferred: false,
        deletionIsArchive: false,
        hiddenIsArchive: false,
        cancelledIsArchive: false,
        completedIsArchive: false,
      }),
    })
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyArchiveObservationResult(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      /** @type {any} */ (value).ok === true &&
      /** @type {any} */ (value).value?.provenance === "LEGACY_UNVERIFIED"
  );
}
