/**
 * Safe Daily Director referee metadata patch.
 *
 * Reloads latest canonical tournament, then writes ONLY referee metadata keys.
 * Never replaces settings.dailyPlay / match lifecycle / revision from a stale snapshot.
 *
 * dailyRefereeAssignments is DISPLAY/PROJECTION ONLY after CORE-13 cutover.
 * DAILY_WRITER_AS_ASSIGNMENT_AUTHORITY=DENY
 */

import { getTournamentQuery } from "../../services/tournamentQueries.js";
import { updateTournamentCommand } from "../../services/tournamentCommands.js";
import { DAILY_REFEREE_ASSIGNMENTS_KEY } from "./dailyDirectorProjection.js";

export const DAILY_DIRECTOR_METADATA_KEYS = Object.freeze([
  "refereeRoster",
  "courtReferees",
  DAILY_REFEREE_ASSIGNMENTS_KEY,
]);

export const DAILY_REFEREE_ASSIGNMENT_PROJECTION_META = Object.freeze({
  authority: false,
  projectionOnly: true,
  assignmentAuthority: "CORE-13",
  dailyWriterAsAssignmentAuthority: "DENY",
});

export function mergeDailyRefereeMetadata(latestSettings = {}, metadataPatch = {}) {
  const next = { ...(latestSettings || {}) };

  if (Object.prototype.hasOwnProperty.call(metadataPatch, "refereeRoster")) {
    next.refereeRoster = metadataPatch.refereeRoster;
  }
  if (Object.prototype.hasOwnProperty.call(metadataPatch, "courtReferees")) {
    next.courtReferees = metadataPatch.courtReferees;
  }
  if (Object.prototype.hasOwnProperty.call(metadataPatch, DAILY_REFEREE_ASSIGNMENTS_KEY)) {
    next[DAILY_REFEREE_ASSIGNMENTS_KEY] = {
      ...(latestSettings?.[DAILY_REFEREE_ASSIGNMENTS_KEY] || {}),
      ...metadataPatch[DAILY_REFEREE_ASSIGNMENTS_KEY],
    };
  }

  return next;
}

/**
 * @deprecated Prefer buildDailyCore13AssignmentProjection after CORE-13 assign.
 * Kept for non-assignment roster metadata only — does NOT mint authority.
 */
export function buildDailyMatchRefereeAssignmentPatch(matchId, referee) {
  if (!matchId || !referee) {
    return null;
  }
  return {
    [DAILY_REFEREE_ASSIGNMENTS_KEY]: {
      [String(matchId)]: {
        ...referee,
        ...DAILY_REFEREE_ASSIGNMENT_PROJECTION_META,
      },
    },
  };
}

/**
 * Persist referee metadata against the latest tournament row.
 * This is NOT assignment authority — CORE-13 owns assign/replace/unassign.
 * @param {{ clubOrScope: object, tournamentId: string, metadataPatch: object, tenantId?: string }} input
 */
export async function persistDailyRefereeMetadata({
  clubOrScope,
  tournamentId,
  metadataPatch,
  tenantId = null,
} = {}) {
  if (!clubOrScope || !tournamentId || !metadataPatch) {
    return { ok: false, error: "Thiếu phạm vi để lưu trọng tài." };
  }

  const loaded = await getTournamentQuery(clubOrScope, tournamentId, { tenantId });
  if (!loaded.ok || !loaded.tournament) {
    return {
      ok: false,
      error: loaded.error || "Không tải được giải để lưu trọng tài.",
    };
  }

  const latestSettings = loaded.tournament.settings || {};
  const nextSettings = mergeDailyRefereeMetadata(latestSettings, metadataPatch);

  return updateTournamentCommand(
    clubOrScope,
    tournamentId,
    { settings: nextSettings },
    { tenantId, directorMode: true }
  );
}
