import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { validateTournamentStatusChange } from "../../../domain/tournamentService.js";
import { getTournamentQuery } from "../../tournament/services/tournamentQueries.js";
import { updateTournamentCommand } from "../../tournament/services/tournamentCommands.js";
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

  const loaded = await getTournamentQuery(clubId, tournamentId);
  if (!loaded.ok || !loaded.tournament) {
    return { ok: false, error: loaded.error || "Không tìm thấy giải." };
  }

  const isTeam =
    String(loaded.tournament.mode || "") === "team_tournament" ||
    Boolean(loaded.tournament.teamData);
  if (isTeam) {
    return {
      ok: false,
      code: "RANKING_MUST_NOT_CLOSE_TEAM_TOURNAMENT",
      error:
        "Ranking không được đóng Team Tournament hoặc xác nhận kết quả chính thức. Hãy đóng giải từ Team Awards/Close.",
    };
  }

  const validation = validateTournamentStatusChange(
    loaded.tournament,
    TOURNAMENT_STATUS.COMPLETED,
    { force }
  );
  if (!validation.ok && !force) {
    return validation;
  }

  const confirmPatch = await updateTournamentCommand(clubId, tournamentId, {
    status: TOURNAMENT_STATUS.COMPLETED,
    resultsConfirmation: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: actorUserId,
    },
  });
  if (!confirmPatch.ok) {
    return confirmPatch;
  }

  const award = await tryAwardTournamentVpr(clubId, tournamentId, { actorUserId });
  const refreshed = await getTournamentQuery(clubId, tournamentId);
  return {
    ok: true,
    tournament: refreshed.tournament || confirmPatch.tournament,
    award,
  };
}
