import { loadClubData, saveClubData } from "../../../domain/clubStorage.js";
import { isTeamTournamentCloudEnabled } from "../repositories/teamTournamentRepository.js";

function findTournamentInData(data, tournamentId) {
  return (data?.tournaments || []).find((item) => item.id === tournamentId) || null;
}

/**
 * SSOT khi cloud bật: Supabase team_tournament_*.
 * Blob chỉ là cache denormalized — ghi một chiều cloud → blob sau pull/RPC.
 */
export function mirrorCloudTournamentToBlob(clubId, cloudTournament) {
  if (!clubId || !cloudTournament?.id) {
    return { ok: false, error: "Thiếu clubId hoặc tournament." };
  }

  const data = loadClubData(clubId);
  const existing = findTournamentInData(data, cloudTournament.id);
  const tournaments = Array.isArray(data.tournaments) ? [...data.tournaments] : [];
  const index = tournaments.findIndex((item) => item.id === cloudTournament.id);

  const merged = {
    ...(existing || {}),
    ...cloudTournament,
    teamData: cloudTournament.teamData ?? existing?.teamData,
    _cloudMirrorAt: new Date().toISOString(),
  };

  if (index >= 0) {
    tournaments[index] = merged;
  } else {
    tournaments.push(merged);
  }

  data.tournaments = tournaments;
  saveClubData(clubId, data, { source: "cloud" });
  return { ok: true, tournamentId: cloudTournament.id };
}

export function isTeamTournamentBlobMirrorMode() {
  return isTeamTournamentCloudEnabled();
}
