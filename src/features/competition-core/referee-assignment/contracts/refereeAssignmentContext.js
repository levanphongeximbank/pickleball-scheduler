import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import {
  normalizeOptionalStableId,
  normalizeStableIdArray,
} from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  normalizeOptionalInstant,
  ownedFreeze,
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "tenantId",
  "tournamentId",
  "divisionId",
  "scheduleWindow",
  "snapshotRefs",
  "matchIds",
  "metadata",
]);

const SNAPSHOT_REF_ALLOWED = Object.freeze([
  "snapshotId",
  "snapshotVersion",
  "fingerprint",
  "kind",
]);

const SCHEDULE_WINDOW_ALLOWED = Object.freeze([
  "startAt",
  "endAt",
  "timezone",
]);

/**
 * @param {object} [partial]
 */
export function createSnapshotRef(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    SNAPSHOT_REF_ALLOWED,
    "snapshotRef"
  );
  return ownedFreeze({
    snapshotId: requireStableId(partial.snapshotId, "snapshotRef.snapshotId"),
    snapshotVersion: requireStableId(
      partial.snapshotVersion,
      "snapshotRef.snapshotVersion"
    ),
    fingerprint: requireStableId(
      partial.fingerprint,
      "snapshotRef.fingerprint"
    ),
    kind:
      partial.kind == null || partial.kind === ""
        ? null
        : requireStableId(partial.kind, "snapshotRef.kind"),
  });
}

/**
 * Bound schedule horizon for the request (not wall-clock).
 * @param {object|null|undefined} partial
 */
export function createScheduleWindow(partial) {
  if (partial == null) return null;
  if (!isPlainObject(partial)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
      "scheduleWindow must be a plain object or null",
      {}
    );
  }
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    SCHEDULE_WINDOW_ALLOWED,
    "scheduleWindow"
  );
  const startAt = normalizeOptionalInstant(partial.startAt, "scheduleWindow.startAt");
  const endAt = normalizeOptionalInstant(partial.endAt, "scheduleWindow.endAt");
  if (!startAt || !endAt) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
      "scheduleWindow requires startAt and endAt",
      { startAt, endAt }
    );
  }
  let timezone = null;
  if (partial.timezone != null && partial.timezone !== "") {
    if (typeof partial.timezone !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "scheduleWindow.timezone must be a string or null",
        {}
      );
    }
    timezone = partial.timezone.trim() || null;
  }
  return ownedFreeze({ startAt, endAt, timezone });
}

/**
 * @param {object} [partial]
 */
export function createRefereeAssignmentContext(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAssignmentContext"
  );

  const tenantId = requireStableId(
    partial.tenantId,
    "RefereeAssignmentContext.tenantId",
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED
  );
  const tournamentId = requireStableId(
    partial.tournamentId,
    "RefereeAssignmentContext.tournamentId",
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED
  );

  const snapshotRefs = Object.freeze(
    (Array.isArray(partial.snapshotRefs) ? partial.snapshotRefs : []).map(
      (ref, i) => {
        if (!isPlainObject(ref)) {
          throw new RefereeAssignmentContractError(
            REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
            `snapshotRefs[${i}] must be a plain object`,
            { index: i }
          );
        }
        return createSnapshotRef(ref);
      }
    )
  );

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    tenantId,
    tournamentId,
    divisionId: normalizeOptionalStableId(
      partial.divisionId,
      "RefereeAssignmentContext.divisionId"
    ),
    scheduleWindow: createScheduleWindow(partial.scheduleWindow),
    snapshotRefs,
    matchIds: Object.freeze(
      normalizeStableIdArray(partial.matchIds, {
        field: "RefereeAssignmentContext.matchIds",
        sort: true,
        unique: true,
      })
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAssignmentContext.metadata"
    ),
  });
}
