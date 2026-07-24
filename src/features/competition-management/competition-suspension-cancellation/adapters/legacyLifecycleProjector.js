/**
 * Explicit read-only legacy tournament → CM-07 lifecycle observation projector.
 *
 * Read-only. Provenance is always LEGACY_UNVERIFIED. Never creates a canonical
 * CompetitionLifecycleRecord. Never writes the legacy object.
 *
 * Safe mappings:
 * - status === "cancelled" → observedCancelledFlag
 * - ambiguous pause/suspend flags without clear tournament-level suspend → issues
 *
 * Unsafe / rejected as canonical:
 * - deleted / missing tournaments ≠ cancellation
 * - archived ≠ cancellation
 * - match-level cancelled ≠ competition cancellation
 * - unpublished schedule ≠ suspension
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import { COMPETITION_LIFECYCLE_SEVERITY } from "../constants/severity.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";

export const LEGACY_LIFECYCLE_COMPATIBILITY = Object.freeze({
  mode: "read-only-observation",
  provenance: "LEGACY_UNVERIFIED",
  writesLegacy: false,
  fullSafeMapping: false,
  isCanonicalLifecycleRecord: false,
  note:
    "observation only — legacy tournament status/pause/cancel flags are never promoted to CM-07 records automatically",
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
    severity: COMPETITION_LIFECYCLE_SEVERITY.WARNING,
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
export function projectLegacyTournamentLifecycleObservation(command = {}) {
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
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required (never inferred from legacy blob)",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_COMPETITION,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.MALFORMED_LEGACY_LIFECYCLE,
        "legacyTournament must be a plain object",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();

  // Deletion / archive are NOT canonical cancellation.
  if (raw.deleted === true || raw.isDeleted === true || raw.deletedAt != null) {
    issues.push(
      createIssue(
        "legacyTournament.deleted",
        COMPETITION_LIFECYCLE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy deletion is not treated as canonical CM-07 cancellation",
        {}
      )
    );
  }
  if (
    raw.archived === true ||
    raw.isArchived === true ||
    String(raw.status || "").toLowerCase() === "archived"
  ) {
    issues.push(
      createIssue(
        "legacyTournament.archived",
        COMPETITION_LIFECYCLE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy archive is CM-08 territory — not CM-07 cancellation",
        {}
      )
    );
  }

  // Match-level cancellation must not be treated as competition cancellation.
  if (
    Array.isArray(raw.matches) &&
    raw.matches.some(
      (m) =>
        m &&
        typeof m === "object" &&
        (String(m.status || "").toLowerCase() === "cancelled" ||
          m.cancelled === true)
    ) &&
    String(raw.status || "").toLowerCase() !== "cancelled"
  ) {
    issues.push(
      createIssue(
        "legacyTournament.matches",
        COMPETITION_LIFECYCLE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "match cancellation is not competition cancellation (CORE-15 ownership)",
        {}
      )
    );
  }

  const statusRaw = isNonEmptyString(raw.status)
    ? String(raw.status).trim().toLowerCase()
    : null;

  let observedStatus = statusRaw;
  let observedCancelledFlag = false;
  let observedPausedFlag = false;
  let observedSuspendedFlag = false;

  if (statusRaw === "cancelled") {
    observedCancelledFlag = true;
  } else if (statusRaw === "paused") {
    observedPausedFlag = true;
    issues.push(
      createIssue(
        "legacyTournament.status",
        COMPETITION_LIFECYCLE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        "legacy status=paused has no safe canonical CM-07 suspension mapping without additional evidence",
        {}
      )
    );
  } else if (statusRaw === "suspended") {
    observedSuspendedFlag = true;
  } else if (
    statusRaw != null &&
    ![
      "draft",
      "registration",
      "ready",
      "active",
      "completed",
      "live",
    ].includes(statusRaw)
  ) {
    issues.push(
      createIssue(
        "legacyTournament.status",
        COMPETITION_LIFECYCLE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
        `legacy status '${statusRaw}' has no safe CM-07 mapping`,
        {}
      )
    );
  }

  if (raw.paused === true || raw.isPaused === true) {
    observedPausedFlag = true;
    if (!observedSuspendedFlag && statusRaw !== "suspended") {
      issues.push(
        createIssue(
          "legacyTournament.paused",
          COMPETITION_LIFECYCLE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING,
          "legacy paused flag is observed but not promoted to canonical SUSPENDED",
          {}
        )
      );
    }
  }

  if (raw.suspended === true || raw.isSuspended === true) {
    observedSuspendedFlag = true;
  }

  if (raw.cancelled === true || raw.isCancelled === true) {
    observedCancelledFlag = true;
  }

  const observedReason = isNonEmptyString(raw.cancelReason)
    ? String(raw.cancelReason).trim()
    : isNonEmptyString(raw.cancellationReason)
      ? String(raw.cancellationReason).trim()
      : isNonEmptyString(raw.reason)
        ? String(raw.reason).trim()
        : null;

  const observedAt = isNonEmptyString(raw.cancelledAt)
    ? String(raw.cancelledAt).trim()
    : isNonEmptyString(raw.updatedAt)
      ? String(raw.updatedAt).trim()
      : null;

  return validationOk(
    deepFreeze({
      tenantId,
      competitionId,
      provenance: LEGACY_LIFECYCLE_COMPATIBILITY.provenance,
      isCanonicalLifecycleRecord: false,
      observedStatus,
      observedPausedFlag,
      observedSuspendedFlag,
      observedCancelledFlag,
      observedReason,
      observedAt,
      sourcePath: "legacyTournament",
      issues: Object.freeze(issues),
      compatibility: LEGACY_LIFECYCLE_COMPATIBILITY,
      // Explicit non-claims
      claims: Object.freeze({
        actorInferred: false,
        authorityInferred: false,
        sourceRevisionInferred: false,
        cancellationPermanenceInferred: false,
        deletionIsCancellation: false,
        archiveIsCancellation: false,
        matchCancelIsCompetitionCancel: false,
      }),
    })
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegacyLifecycleObservationResult(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      /** @type {any} */ (value).ok === true &&
      /** @type {any} */ (value).value?.provenance === "LEGACY_UNVERIFIED"
  );
}
