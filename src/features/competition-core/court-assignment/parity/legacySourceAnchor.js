/**
 * CORE-12 Phase 1C-R — frozen legacy TE source anchor (Model B).
 *
 * The shadow harness does NOT import live Tournament Engine at runtime.
 * It reimplements the audited LEGACY-mode algorithm and binds to the TE
 * source via path + SHA-256 + behavioral marker drift detection.
 *
 * If the TE source fingerprint or markers change, certification fails
 * (cannot silently stay green after legacy drift).
 */

import { createHash } from "node:crypto";

/** Classification / anchor contract version. */
export const CORE12_LEGACY_SOURCE_ANCHOR_V1 = "CORE12_LEGACY_SOURCE_ANCHOR_V1";

/**
 * Audited TE assignCourts source as of Phase 1C-R certification HEAD.
 * Path is repository-relative from workspace root.
 */
export const LEGACY_TE_COURT_ASSIGNMENT_SOURCE_PATH =
  "src/features/tournament-engine/engines/courtAssignmentEngine.js";

/**
 * Commit at which Phase 1C-R certified the source fingerprint
 * (post FF of CORE-13 onto this branch).
 */
export const LEGACY_TE_COURT_ASSIGNMENT_AUDITED_COMMIT =
  "500cfc4474477d8da31fae63dcb52d5992d27b35";

/**
 * SHA-256 (hex, uppercase) of the audited source file bytes (UTF-8 as on disk).
 */
export const LEGACY_TE_COURT_ASSIGNMENT_SOURCE_SHA256 =
  "A5FDDB6E4E98F4092A5F88E460F1011883152115C3213869DE3FAAC3B6D34AFE";

/**
 * Behavioral markers that must remain present in the audited TE source.
 * These pin unsafe + ordering semantics the frozen reference mirrors.
 */
export const LEGACY_TE_COURT_ASSIGNMENT_BEHAVIOR_MARKERS = Object.freeze([
  'localeCompare(String(b.name), "vi")',
  "if (!a.scheduledStart || !b.scheduledStart)",
  "a.scheduledEnd || a.scheduledStart",
  "manualCourtLock && match.courtId && !overrideManual",
  "conflicts.length === 0 || assignments.length > 0",
  "export function assignCourts",
  "courtsByPriority",
  "matchImportance",
  "timeOverlaps",
]);

export const LEGACY_SOURCE_ANCHOR = Object.freeze({
  model: "FROZEN_BEHAVIORAL_REFERENCE",
  anchorVersion: CORE12_LEGACY_SOURCE_ANCHOR_V1,
  sourcePath: LEGACY_TE_COURT_ASSIGNMENT_SOURCE_PATH,
  auditedCommit: LEGACY_TE_COURT_ASSIGNMENT_AUDITED_COMMIT,
  sourceSha256: LEGACY_TE_COURT_ASSIGNMENT_SOURCE_SHA256,
  behaviorMarkers: LEGACY_TE_COURT_ASSIGNMENT_BEHAVIOR_MARKERS,
  referenceModule:
    "src/features/competition-core/court-assignment/parity/legacyReferenceAssignCourts.js",
  notes: Object.freeze([
    "Reference mirrors TE LEGACY availability mode only (no live Venue calls).",
    "LocaleCompare('vi') is isolated to the legacy reference and must not drive CORE-12 ordering.",
    "Manual locks are skipped without courtSchedule registration (LEGACY_UNSAFE gap).",
  ]),
});

/**
 * @param {string} sourceText
 * @returns {string} uppercase hex SHA-256
 */
export function sha256HexUpper(sourceText) {
  return createHash("sha256")
    .update(String(sourceText ?? ""), "utf8")
    .digest("hex")
    .toUpperCase();
}

/**
 * Drift detector: compare live TE source text to the certified fingerprint.
 * @param {string} sourceText
 * @returns {Readonly<{ ok: boolean, drifted: boolean, actualSha256: string, missingMarkers: readonly string[], details: object }>}
 */
export function detectLegacyTeCourtAssignmentDrift(sourceText) {
  const actualSha256 = sha256HexUpper(sourceText);
  const missingMarkers = LEGACY_TE_COURT_ASSIGNMENT_BEHAVIOR_MARKERS.filter(
    (marker) => !String(sourceText).includes(marker)
  );
  const hashMatch = actualSha256 === LEGACY_TE_COURT_ASSIGNMENT_SOURCE_SHA256;
  const markersOk = missingMarkers.length === 0;
  const ok = hashMatch && markersOk;
  return Object.freeze({
    ok,
    drifted: !ok,
    actualSha256,
    expectedSha256: LEGACY_TE_COURT_ASSIGNMENT_SOURCE_SHA256,
    missingMarkers: Object.freeze([...missingMarkers]),
    details: Object.freeze({
      sourcePath: LEGACY_TE_COURT_ASSIGNMENT_SOURCE_PATH,
      auditedCommit: LEGACY_TE_COURT_ASSIGNMENT_AUDITED_COMMIT,
      model: LEGACY_SOURCE_ANCHOR.model,
    }),
  });
}
