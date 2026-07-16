/**
 * P1.5A — engine hash annotation for showcase preview (setup gateway).
 */

import {
  hashEngineInput,
  hashEngineOutput,
} from "../canonical/teamTournamentCanonical.js";

export function buildShowcaseTeamEngineHashes({ players = [], selectedPlayerIds = [], teamCount, rulesVersion, teams = [], waitingPlayerIds = [] } = {}) {
  const engineInput = {
    kind: "showcase_team_draw",
    players: (players || []).map((player) => String(player.id)),
    selectedPlayerIds: (selectedPlayerIds || []).map(String),
    teamCount: Number(teamCount) || 0,
    rulesVersion: String(rulesVersion || ""),
  };
  const engineOutput = {
    teams,
    waitingPlayerIds,
  };
  return {
    engineInputHash: hashEngineInput(engineInput),
    engineOutputHash: hashEngineOutput(engineOutput),
  };
}

export function annotateShowcaseSessionEngineHashes(session, input = {}) {
  if (!session) return session;
  const hashes = buildShowcaseTeamEngineHashes({
    players: input.players || session.players,
    selectedPlayerIds: input.selectedPlayerIds,
    teamCount: input.teamCount,
    rulesVersion: input.rulesVersion || session.rulesVersion,
    teams: session.teamData?.teams || [],
    waitingPlayerIds: session.waitingPlayerIds || [],
  });
  return {
    ...session,
    ...hashes,
  };
}
