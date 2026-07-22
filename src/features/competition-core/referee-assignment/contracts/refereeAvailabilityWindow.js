import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import {
  REFEREE_AVAILABILITY_SOURCE,
  REFEREE_AVAILABILITY_SOURCE_VALUES,
} from "../enums/availabilitySource.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import {
  normalizeMetadata,
  normalizeOptionalInstant,
  ownedFreeze,
  rejectUnknownFields,
  requireEnum,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "windowId",
  "refereeId",
  "startAt",
  "endAt",
  "timezone",
  "source",
  "metadata",
]);

/**
 * @param {object} [partial]
 */
export function createRefereeAvailabilityWindow(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAvailabilityWindow"
  );

  const startAt = normalizeOptionalInstant(
    partial.startAt,
    "RefereeAvailabilityWindow.startAt"
  );
  const endAt = normalizeOptionalInstant(
    partial.endAt,
    "RefereeAvailabilityWindow.endAt"
  );
  if (!startAt || !endAt) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SCHEDULE_WINDOW_REQUIRED,
      "RefereeAvailabilityWindow requires startAt and endAt strings",
      { startAt, endAt }
    );
  }

  let timezone = null;
  if (partial.timezone != null && partial.timezone !== "") {
    if (typeof partial.timezone !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "RefereeAvailabilityWindow.timezone must be a string or null",
        { field: "timezone" }
      );
    }
    timezone = partial.timezone.trim() || null;
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    windowId: requireStableId(
      partial.windowId,
      "RefereeAvailabilityWindow.windowId"
    ),
    refereeId: requireStableId(
      partial.refereeId,
      "RefereeAvailabilityWindow.refereeId"
    ),
    startAt,
    endAt,
    timezone,
    source: requireEnum(
      partial.source ?? REFEREE_AVAILABILITY_SOURCE.DIRECTORY,
      "RefereeAvailabilityWindow.source",
      REFEREE_AVAILABILITY_SOURCE_VALUES
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAvailabilityWindow.metadata"
    ),
  });
}
