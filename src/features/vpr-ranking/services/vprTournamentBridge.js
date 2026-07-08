import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import {
  advanceTournamentStatus,
  getTournament,
  updateTournament,
} from "../../../domain/tournamentService.js";
import { guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { resolveCertificationForLevel } from "../../../models/tournament/tournament.js";
import { syncCertificationRequest } from "./tournamentCertificationService.js";
import { tryAwardTournamentVpr } from "./vprAwardService.js";

export async function onTournamentSaved(clubId, tournament) {
  if (!tournament) {
    return { ok: false };
  }
  return syncCertificationRequest(clubId, tournament);
}

export function applyTournamentLevelPatch(existing, tournamentLevel) {
  return resolveCertificationForLevel(tournamentLevel, existing || {});
}

export async function confirmTournamentResults(
  clubId,
  tournamentId,
  { actorUserId = null, force = false } = {}
) {
  const check = guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
  if (!check.ok) {
    return check;
  }

  const tournament = getTournament(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải." };
  }

  const confirmPatch = updateTournament(clubId, tournamentId, {
    resultsConfirmation: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: actorUserId,
    },
  });
  if (!confirmPatch.ok) {
    return confirmPatch;
  }

  const advance = advanceTournamentStatus(
    clubId,
    tournamentId,
    TOURNAMENT_STATUS.COMPLETED,
    {},
    { force }
  );
  if (!advance.ok) {
    return advance;
  }

  const award = await tryAwardTournamentVpr(clubId, tournamentId, { actorUserId });
  return {
    ok: true,
    tournament: getTournament(clubId, tournamentId),
    award,
  };
}
