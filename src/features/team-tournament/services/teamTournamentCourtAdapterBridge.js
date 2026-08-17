/**
 * Team Tournament court capacity via Mode Adapter B (canonical path).
 * Dreambreaker / tie-break / stage rules stay outside this module.
 */
import {
  isCanonicalCompetitionCourtAdaptersEnabled,
  listCompetitionEligibleCourtsViaAdapterB,
  syncCompetitionCourtScheduleViaAdapterB,
  releaseCompetitionCourtScheduleViaAdapterB,
  createTeamTournamentCourtAdapter,
} from "../../competition-engine/integration/court-adapters/index.js";

/**
 * List eligible courts for Team Format & Venue via Adapter B → Head A.
 * Legacy path continues to use club_data_v3 cloud inventory when flag OFF.
 */
export async function listTeamTournamentEligibleCourts(input = {}) {
  if (!isCanonicalCompetitionCourtAdaptersEnabled() && input.forceCanonical !== true) {
    return {
      ok: false,
      code: "CANONICAL_PATH_UNAVAILABLE",
      error: "Canonical Competition Court Adapters are OFF.",
      courts: [],
      canonical: false,
    };
  }
  return listCompetitionEligibleCourtsViaAdapterB({
    ...input,
    mode: "team_tournament",
    forceCanonical: true,
  });
}

/**
 * Reserve Team Tournament courts for a schedule window via Adapter B.
 */
export async function reserveTeamTournamentCourts(teamTournament, options = {}) {
  const schedule = {
    date: options.date || teamTournament?.settings?.eventDate || teamTournament?.eventDate,
    startTime: options.startTime || teamTournament?.settings?.startTime,
    endTime: options.endTime || teamTournament?.settings?.endTime,
    courtIds:
      options.physicalCourtIds ||
      teamTournament?.settings?.physicalCourtIds ||
      teamTournament?.settings?.selectedCourtIds ||
      [],
    physicalCourtIds:
      options.physicalCourtIds ||
      teamTournament?.settings?.physicalCourtIds ||
      teamTournament?.settings?.selectedCourtIds ||
      [],
    clusterId: options.clusterId || teamTournament?.settings?.clusterId,
  };

  return syncCompetitionCourtScheduleViaAdapterB(
    {
      id: teamTournament?.id || options.competitionId,
      tenantId: options.tenantId || teamTournament?.tenantId,
      clubId: options.clubId || teamTournament?.clubId,
      mode: "team_tournament",
      courtSchedule: schedule,
      name: teamTournament?.name,
    },
    {
      ...options,
      mode: "team_tournament",
      adapter: options.adapter || createTeamTournamentCourtAdapter({ headA: options.headA }),
      forceCanonical: true,
    }
  );
}

export async function releaseTeamTournamentCourts(teamTournament, options = {}) {
  return releaseCompetitionCourtScheduleViaAdapterB(
    {
      id: teamTournament?.id || options.competitionId,
      tenantId: options.tenantId || teamTournament?.tenantId,
      clubId: options.clubId || teamTournament?.clubId,
      mode: "team_tournament",
      courtSchedule: {
        physicalCourtIds:
          options.physicalCourtIds ||
          teamTournament?.settings?.physicalCourtIds ||
          teamTournament?.settings?.selectedCourtIds ||
          [],
      },
    },
    {
      ...options,
      mode: "team_tournament",
      adapter: options.adapter || createTeamTournamentCourtAdapter({ headA: options.headA }),
      forceCanonical: true,
    }
  );
}
