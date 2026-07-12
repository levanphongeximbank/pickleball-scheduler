import {
  captainSaveLineup,
  captainSubmitLineup,
  organizerLockLineups,
  organizerPublishLineups,
  patchTeamTournament,
  refereeConfirmSubMatch,
  refereeForfeitSubMatch,
  refereeSaveSubMatchDraft,
} from "../services/teamTournamentService.js";
import { repositoryFailure, repositorySuccess } from "../repositories/TeamTournamentRepository.interface.js";
import { REPOSITORY_ERROR_CODES } from "../repositories/teamTournamentRepositoryTypes.js";
import { mapTournamentToAggregate } from "../repositories/teamTournamentRepositoryAggregate.js";

function mapServiceResult(result, tournament) {
  if (!result?.ok) {
    return repositoryFailure(
      result.code || REPOSITORY_ERROR_CODES.INVALID_COMMAND_OPTIONS,
      result.error || "Thao tác thất bại.",
      { details: result }
    );
  }

  const aggregate = tournament
    ? mapTournamentToAggregate(
        { ...tournament, teamData: tournament.teamData },
        "blob"
      )
    : undefined;

  return repositorySuccess(aggregate || result, {
    provider: "blob",
    version: aggregate?.version,
  });
}

export async function legacySaveDraftLineup(clubId, tournamentId, payload) {
  const result = await captainSaveLineup(clubId, tournamentId, payload);
  return mapServiceResult(result, result.tournament);
}

export async function legacySubmitLineup(clubId, tournamentId, payload) {
  const result = await captainSubmitLineup(clubId, tournamentId, payload);
  return mapServiceResult(result, result.tournament);
}

export async function legacyLockLineup(clubId, tournamentId, payload) {
  const result = await organizerLockLineups(clubId, tournamentId, payload);
  return mapServiceResult(result, result.tournament);
}

export async function legacyPublishLineups(clubId, tournamentId, payload) {
  const result = await organizerPublishLineups(clubId, tournamentId, payload);
  return mapServiceResult(result, result.tournament);
}

export async function legacyConfirmSubMatch(clubId, tournamentId, payload) {
  const result = await refereeConfirmSubMatch(clubId, tournamentId, payload);
  return mapServiceResult(result, result.tournament);
}

export async function legacySaveSubMatchDraft(clubId, tournamentId, payload) {
  const result = await refereeSaveSubMatchDraft(clubId, tournamentId, payload);
  return mapServiceResult(result, result.tournament);
}

export async function legacyApplyForfeit(clubId, tournamentId, payload) {
  const result = await refereeForfeitSubMatch(clubId, tournamentId, payload);
  return mapServiceResult(result, result.tournament);
}

export function legacyPatchTeamData(clubId, tournamentId, patch) {
  const result = patchTeamTournament(clubId, tournamentId, patch);
  return mapServiceResult(result, result.tournament);
}
