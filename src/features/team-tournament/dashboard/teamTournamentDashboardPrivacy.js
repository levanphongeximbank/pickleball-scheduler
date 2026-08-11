/**
 * Dashboard privacy projections.
 * Viewer sections never receive private captain orders, referee-only
 * controls, private contact data, or organizer-only configuration.
 */
import { STAGE_TIE_BREAK_POLICY } from "../constants.js";
import { resolveStageTieBreakPolicyMap } from "../engines/teamStageTieBreakPolicy.js";

function publicPlayerName(member) {
  if (!member || typeof member !== "object") return null;
  return (
    member.displayName ||
    member.name ||
    member.playerName ||
    null
  );
}

export function projectPublicTeams(teams = [], { includeRosterNames = false } = {}) {
  return (teams || []).map((team) => {
    const projected = {
      id: team.id,
      name: team.name || "Đội",
      color: team.color || null,
      withdrawn: team.withdrawn === true,
    };
    if (includeRosterNames) {
      projected.roster = (team.members || []).map((member) => ({
        playerId: member.playerId || member.id || null,
        name: publicPlayerName(member),
      }));
    }
    return projected;
  });
}

export function projectPublicMatchups(matchups = []) {
  return (matchups || []).map((matchup) => ({
    id: matchup.id,
    stage: matchup.stage || matchup.scheduleMeta?.stage || null,
    teamAId: matchup.teamAId || null,
    teamBId: matchup.teamBId || null,
    scheduledAt: matchup.scheduledAt || null,
    courtLabel: matchup.courtLabel || null,
    status: matchup.status || null,
    result: projectPublicResult(matchup.result),
    needsDreambreaker: matchup.result?.needsDreambreaker === true,
    nextMatchupId: matchup.nextMatchupId || matchup.scheduleMeta?.nextMatchupId || null,
  }));
}

export function projectPublicResult(result) {
  if (!result || typeof result !== "object") return null;
  return {
    teamAWins: Number(result.teamAWins) || 0,
    teamBWins: Number(result.teamBWins) || 0,
    teamAPoints: Number(result.teamAPoints) || 0,
    teamBPoints: Number(result.teamBPoints) || 0,
    winnerTeamId: result.winnerTeamId || null,
    tieBreakPolicy: result.tieBreakPolicy || null,
    tieBreakStatus: result.tieBreakStatus || null,
    needsDreambreaker: result.needsDreambreaker === true,
  };
}

export function projectPublicStandings(standings = []) {
  return (standings || []).map((row) => ({
    teamId: row.teamId || row.teamExternalId || row.id,
    rank: row.rank ?? null,
    played: row.played ?? 0,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    subMatchWins: row.subMatchWins ?? row.sub_match_wins ?? 0,
    subMatchLosses: row.subMatchLosses ?? row.sub_match_losses ?? 0,
    pointsScored: row.pointsScored ?? row.points_scored ?? 0,
    pointsConceded: row.pointsConceded ?? row.points_conceded ?? 0,
  }));
}

export function projectStageTieBreakDisplay(teamData, tournament) {
  const map = resolveStageTieBreakPolicyMap(teamData, tournament);
  return {
    group: map.group || STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    round_of_16: map.round_of_16 || STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    quarterfinal: map.quarterfinal || STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    semifinal: map.semifinal || STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    final: map.final || STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
  };
}

export function stripPrivateCaptainFields(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const next = { ...payload };
  delete next.opponentOrder;
  delete next.teamBOrder;
  delete next.hiddenOrder;
  delete next.privateOrder;
  return next;
}

export function assertNoPrivateCaptainLeak(view) {
  const serialized = JSON.stringify(view || {});
  return !/opponentOrder|teamBOrder|hiddenOrder/.test(serialized);
}
