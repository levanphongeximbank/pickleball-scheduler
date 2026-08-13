/**
 * Client mirror of server team_tournament_assert_close_readiness.
 * Authority remains server SQL at close time; this powers UI preflight only.
 * Coarse stage: scheduleMeta.stage / stage = group|knockout (#416).
 */

export const CLOSE_READINESS_CODES = Object.freeze({
  GROUP_STAGE_INCOMPLETE: "GROUP_STAGE_INCOMPLETE",
  ELIMINATION_INCOMPLETE: "ELIMINATION_INCOMPLETE",
  FINAL_NOT_COMPLETED: "FINAL_NOT_COMPLETED",
  CHAMPION_UNRESOLVED: "CHAMPION_UNRESOLVED",
});

function coarseStage(matchup) {
  const raw = String(matchup?.stage || matchup?.scheduleMeta?.stage || "").trim();
  return raw === "knockout" ? "knockout" : "group";
}

function isCanonicallyCompleted(matchup) {
  const winner = String(matchup?.result?.winnerTeamId || "").trim();
  return matchup?.status === "completed" && Boolean(winner);
}

function resolveCompetitionStage(matchups, matchup) {
  const stored = String(
    matchup?.competitionStage || matchup?.scheduleMeta?.competitionStage || ""
  ).trim();
  if (["group", "round_of_16", "quarterfinal", "semifinal", "final"].includes(stored)) {
    return stored;
  }
  if (coarseStage(matchup) !== "knockout") return "group";
  let hops = 0;
  let current = matchup;
  const byId = new Map(
    (matchups || []).map((item) => [String(item.id || item.externalMatchupId || ""), item])
  );
  const seen = new Set();
  while (current) {
    const nextId = String(
      current.nextMatchupId || current.scheduleMeta?.nextMatchupId || ""
    ).trim();
    if (!nextId) break;
    const key = String(current.id || "");
    if (key) {
      if (seen.has(key)) return "";
      seen.add(key);
    }
    hops += 1;
    if (hops > 8) return "";
    current = byId.get(nextId) || null;
  }
  if (hops === 0) return "final";
  if (hops === 1) return "semifinal";
  if (hops === 2) return "quarterfinal";
  if (hops === 3) return "round_of_16";
  return "";
}

function deriveOneGroupChampion(teams, groupMatchups) {
  const rows = (teams || []).map((team) => {
    const teamId = String(team.id || team.externalTeamId || "");
    let wins = 0;
    let subDiff = 0;
    let pointsScored = 0;
    for (const matchup of groupMatchups || []) {
      if (!isCanonicallyCompleted(matchup)) continue;
      const winner = String(matchup.result?.winnerTeamId || "");
      if (winner === teamId) wins += 1;
      if (matchup.teamAId === teamId) {
        subDiff +=
          Number(matchup.result?.teamAWins || 0) - Number(matchup.result?.teamBWins || 0);
        pointsScored += Number(matchup.result?.teamAPoints || 0);
      } else if (matchup.teamBId === teamId) {
        subDiff +=
          Number(matchup.result?.teamBWins || 0) - Number(matchup.result?.teamAWins || 0);
        pointsScored += Number(matchup.result?.teamBPoints || 0);
      }
    }
    return { teamId, wins, subDiff, pointsScored };
  });
  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.subDiff - a.subDiff ||
      b.pointsScored - a.pointsScored ||
      String(a.teamId).localeCompare(String(b.teamId))
  );
  return rows[0]?.teamId || "";
}

/**
 * @param {{ teamData?: object, tournament?: object }} input
 */
export function assertCloseReadinessFromCanonical(input = {}) {
  const teamData = input.teamData || {};
  const settings = {
    ...(input.tournament?.settings || {}),
    ...(teamData.settings || {}),
  };
  const groupCount = Math.max(1, Number(settings.groupCount) || 1);
  const matchups = Array.isArray(teamData.matchups) ? teamData.matchups : [];
  const teams = Array.isArray(teamData.teams) ? teamData.teams : [];

  const groupMatchups = matchups.filter((m) => coarseStage(m) !== "knockout");
  const knockoutMatchups = matchups.filter((m) => coarseStage(m) === "knockout");

  if (groupMatchups.length < 1) {
    return {
      ok: false,
      code: CLOSE_READINESS_CODES.GROUP_STAGE_INCOMPLETE,
      error: "Required group round-robin matchups are missing",
      groupCount,
    };
  }

  const incompleteGroup = groupMatchups.filter((m) => !isCanonicallyCompleted(m));
  if (incompleteGroup.length > 0) {
    return {
      ok: false,
      code: CLOSE_READINESS_CODES.GROUP_STAGE_INCOMPLETE,
      error: "Required group matchups are not all completed",
      groupCount,
      incompleteGroupMatchups: incompleteGroup.length,
    };
  }

  if (groupCount <= 1) {
    const championTeamId = deriveOneGroupChampion(teams, groupMatchups);
    if (!championTeamId) {
      return {
        ok: false,
        code: CLOSE_READINESS_CODES.CHAMPION_UNRESOLVED,
        error: "Champion could not be resolved from completed group results",
        groupCount,
      };
    }
    return {
      ok: true,
      groupCount,
      mode: "one_group",
      championTeamId,
      championSource: "group_standings_derived",
    };
  }

  if (knockoutMatchups.length < 1) {
    return {
      ok: false,
      code: CLOSE_READINESS_CODES.ELIMINATION_INCOMPLETE,
      error: "Required elimination bracket is missing",
      groupCount,
    };
  }

  const incompleteKo = knockoutMatchups.filter((m) => !isCanonicallyCompleted(m));
  if (incompleteKo.length > 0) {
    return {
      ok: false,
      code: CLOSE_READINESS_CODES.ELIMINATION_INCOMPLETE,
      error: "Required elimination matchups are not all completed",
      groupCount,
      incompleteKnockoutMatchups: incompleteKo.length,
    };
  }

  const finalMatchup = knockoutMatchups.find(
    (m) => resolveCompetitionStage(matchups, m) === "final"
  );
  if (!finalMatchup) {
    return {
      ok: false,
      code: CLOSE_READINESS_CODES.FINAL_NOT_COMPLETED,
      error: "Canonical final matchup not found",
      groupCount,
    };
  }
  if (!isCanonicallyCompleted(finalMatchup)) {
    return {
      ok: false,
      code: CLOSE_READINESS_CODES.FINAL_NOT_COMPLETED,
      error: "Canonical final matchup is not completed with a winner",
      groupCount,
    };
  }

  const championTeamId = String(finalMatchup.result?.winnerTeamId || "").trim();
  if (!championTeamId) {
    return {
      ok: false,
      code: CLOSE_READINESS_CODES.CHAMPION_UNRESOLVED,
      error: "Champion could not be resolved from final winner",
      groupCount,
    };
  }

  return {
    ok: true,
    groupCount,
    mode: "multi_group",
    championTeamId,
    championSource: "final_winner",
    finalMatchupId: finalMatchup.id,
  };
}
