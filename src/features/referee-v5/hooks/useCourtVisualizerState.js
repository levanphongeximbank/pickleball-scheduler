import { useMemo } from "react";

import { COURT_END } from "../constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import { MATCH_STATUS } from "../constants/eventTypes.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { logicalPositionToScreenPosition } from "../engines/courtPositionEngine.js";
import { getTeamSideKey } from "../domain/matchState.js";
import { buildServeContext } from "../selectors/scoreboardSelector.js";
import { buildPresentationModel } from "../selectors/presentationSelector.js";
import { buildArrowGeometry } from "../selectors/serveArrowSelector.js";
import { getPlayerDisplayName } from "../prototype/refereeV5PrototypeFixtures.js";

function logicalSideLabel(side) {
  return side === LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT ? "Ô phải" : "Ô trái";
}

function statusLabel(status) {
  const map = {
    [MATCH_STATUS.NOT_STARTED]: "Chưa bắt đầu",
    [MATCH_STATUS.IN_PROGRESS]: "Đang đấu",
    [MATCH_STATUS.PAUSED]: "Tạm dừng",
    [MATCH_STATUS.LOCKED]: "Đã khóa",
    [MATCH_STATUS.COMPLETED]: "Hoàn tất",
  };
  return map[status] || status;
}

const EMPTY_VISUAL_STATE = Object.freeze({
  players: [],
  serveContext: null,
  arrow: null,
  scoreA: 0,
  scoreB: 0,
  sideOutLine: "",
  scoreLine: "",
  formatLabel: "",
  scoringLabel: "",
  showServerNumber: true,
  scoreLineMode: "",
  statusLabel: "Đang tải",
  servingTeamSide: "teamA",
  isDoubles: true,
  isSingles: false,
  servingTeamName: "Đội A",
  nearTeamSide: "teamA",
  farTeamSide: "teamB",
  currentGameNumber: 1,
});

export function useCourtVisualizerState(matchState, teamNames = {}) {
  return useMemo(() => {
    if (!matchState?.teams?.teamA?.players || !matchState?.teams?.teamB?.players) {
      return EMPTY_VISUAL_STATE;
    }

    const presentation = buildPresentationModel(matchState);
    const serveContext = buildServeContext(matchState);
    const arrow = buildArrowGeometry(serveContext);

    const players = [];
    for (const side of ["teamA", "teamB"]) {
      const team = matchState.teams[side];
      const teamName = teamNames[side] || team.teamName || (side === "teamA" ? "Đội A" : "Đội B");

      for (const player of team.players) {
        const isServer = String(player.playerId) === String(matchState.servingPlayerId);
        players.push({
          playerId: player.playerId,
          displayName: getPlayerDisplayName(player.playerId),
          shortName: getPlayerDisplayName(player.playerId).split(" ").slice(-1)[0],
          teamId: team.teamId,
          teamSide: side,
          teamName,
          courtEnd: team.courtEnd,
          logicalServiceSide: player.logicalServiceSide,
          logicalSideLabel: logicalSideLabel(player.logicalServiceSide),
          screenPosition: logicalPositionToScreenPosition({
            courtEnd: team.courtEnd,
            logicalServiceSide: player.logicalServiceSide,
          }),
          isServer,
          isReceiver: String(player.playerId) === String(matchState.receivingPlayerId),
          showServerNumber: presentation.showServerNumber,
          serverNumber:
            presentation.showServerNumber && isServer ? matchState.serverNumber : null,
        });
      }
    }

    const servingTeamKey = getTeamSideKey(matchState, matchState.servingTeamId);

    return {
      players,
      serveContext,
      arrow,
      scoreA: matchState.teams.teamA.score,
      scoreB: matchState.teams.teamB.score,
      sideOutLine: presentation.scoreLine,
      scoreLine: presentation.scoreLine,
      formatLabel: presentation.scoringLabel,
      scoringLabel: presentation.scoringLabel,
      showServerNumber: presentation.showServerNumber,
      scoreLineMode: presentation.scoreLineMode,
      scoringSystem: presentation.scoringSystem,
      scoringVariant: presentation.scoringVariant,
      statusLabel: statusLabel(matchState.status),
      servingTeamSide: servingTeamKey,
      isDoubles: matchState.matchType === MATCH_TYPE.DOUBLES,
      isSingles: matchState.matchType === MATCH_TYPE.SINGLES,
      servingTeamName:
        teamNames[servingTeamKey] ||
        (servingTeamKey === "teamA" ? "Đội A" : "Đội B"),
      nearTeamSide:
        matchState.teams.teamA.courtEnd === COURT_END.NEAR_END ? "teamA" : "teamB",
      farTeamSide:
        matchState.teams.teamA.courtEnd === COURT_END.FAR_END ? "teamA" : "teamB",
      currentGameNumber: matchState.currentGameNumber || 1,
    };
  }, [matchState, teamNames]);
}
