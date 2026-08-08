/**
 * Canonical Tournament write commands — single writer boundary.
 */
import { getTournamentRepository } from "../repositories/tournamentRepositoryFactory.js";
import { createTeamTournamentForUi } from "../../team-tournament/services/teamTournamentService.js";
import { TOURNAMENT_MODE, OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import { modeLabelVi } from "../constants/tournamentLabels.js";
import { TOURNAMENT_REPO_ERROR } from "../repositories/TournamentRepository.interface.js";

function buildDefaultName(mode) {
  const date = new Date().toLocaleDateString("vi-VN");
  return `${modeLabelVi(mode)} ${date}`;
}

/**
 * Create tournament via canonical boundary.
 * Team mode delegates to existing TT service (cloud/RPC path when configured) —
 * does NOT introduce a new local mirror.
 */
export function createTournamentCommand(clubId, input = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  const mode = input.mode;
  const name = String(input.name || buildDefaultName(mode)).trim();

  if (!String(clubId || "").trim()) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.MISSING_CLUB,
      error: "Chưa chọn CLB — hãy chọn CLB trước khi tạo giải.",
    };
  }

  if (mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    // Preserve Team Tournament cloud capability; no new blob mirror path.
    return createTeamTournamentForUi(clubId, {
      name,
      seasonId: input.seasonId,
      leagueId: input.leagueId,
      formatPreset: input.formatPreset || "mlp_4",
    });
  }

  return repo.create(clubId, {
    name,
    mode,
    officialMode:
      mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
        ? input.officialMode || OFFICIAL_MODE.OPEN
        : undefined,
    hostClubName: input.hostClubName,
    seasonId: input.seasonId,
    leagueId: input.leagueId,
    ...(input.extra || {}),
  });
}

export function updateTournamentCommand(clubId, tournamentId, patch = {}, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return repo.update(clubId, tournamentId, patch, options);
}

export function deleteTournamentCommand(clubId, tournamentId, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return repo.delete(clubId, tournamentId);
}

/**
 * EngineV4 → canonical persist (DW-02 cutover path).
 */
export function applyEngineV4StateCommand(clubId, tournamentId, engineState, options = {}) {
  const repo = options.repository || getTournamentRepository();
  return repo.applyEngineState(clubId, tournamentId, engineState, options);
}
