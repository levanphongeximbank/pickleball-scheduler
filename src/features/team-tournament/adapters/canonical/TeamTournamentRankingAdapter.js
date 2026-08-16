/**
 * Team Tournament Adapter ĐẦU B — Ranking.
 * Ranking must not close Team Tournament or confirm official Competition result.
 */

import {
  PRODUCTION_BINDING_STATUS,
  RANKING_CONTRACT,
  SHARED_ADAPTER_ERROR_CODE,
  createNotConfiguredContractAdapter,
  createRankingBinding,
  failCompetitionAdapter,
} from "../../../competition-engine/integration/contracts/index.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../../models/tournament/constants.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";
import { isTeamRankingActivated } from "./activation.js";
import { wrapTeamBAdapter } from "./surface.js";

export function isTeamTournamentRecord(tournament) {
  if (!tournament || typeof tournament !== "object") return false;
  return (
    String(tournament.mode || "") === TOURNAMENT_MODE.TEAM_TOURNAMENT ||
    Boolean(tournament.teamData)
  );
}

export function assertRankingDoesNotControlTeamLifecycle(tournament) {
  if (!isTeamTournamentRecord(tournament)) return tournament;
  failCompetitionAdapter(
    SHARED_ADAPTER_ERROR_CODE.FORBIDDEN_AUTHORITY,
    "Ranking must not close Team Tournament or confirm official Competition result",
    { competitionId: tournament.id || null }
  );
}

export function teamRankingMayAward(tournament) {
  if (!isTeamTournamentRecord(tournament)) return false;
  return (
    String(tournament.status || "") === TOURNAMENT_STATUS.COMPLETED &&
    tournament.resultsConfirmation?.confirmed === true
  );
}

export function createTeamTournamentRankingAdapter(deps = {}) {
  const activated = isTeamRankingActivated(deps);
  const inner =
    deps.contractA ||
    (typeof deps.resolveRankings === "function"
      ? createRankingBinding(deps)
      : createNotConfiguredContractAdapter(RANKING_CONTRACT));
  const view = wrapTeamBAdapter(inner, {
    adapterBName: TEAM_ADAPTER_B_NAMES[6],
    ordinal: 6,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.CONDITIONAL,
    activation: activated,
    requiredMethods: RANKING_CONTRACT.requiredMethods,
    sharedRuntime: inner.productionBinding || PRODUCTION_BINDING_STATUS.NOT_CONFIGURED,
  });
  return Object.freeze({
    ...view,
    controlsTeamLifecycle: false,
    confirmOfficialResult: false,
    projectAcceptedTeamResult(tournament) {
      if (!activated) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.NOT_CONFIGURED,
          "Ranking adapter is not activated for this Team Tournament",
          {}
        );
      }
      if (!teamRankingMayAward(tournament)) {
        failCompetitionAdapter(
          SHARED_ADAPTER_ERROR_CODE.FORBIDDEN_AUTHORITY,
          "Ranking may consume only an already-accepted Team Competition result",
          { status: tournament?.status || null }
        );
      }
      return Object.freeze({
        ok: true,
        competitionId: tournament.id,
        accepted: true,
        lifecycleOwnedByTeam: true,
      });
    },
  });
}
