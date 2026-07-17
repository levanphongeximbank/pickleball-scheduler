/**
 * Structural validation for matchup pairing candidates.
 */

function pairKey(teamAId, teamBId) {
  const a = String(teamAId || "");
  const b = String(teamBId || "");
  return [a, b].sort().join("-");
}

/**
 * @param {Array} matchups
 */
export function cloneMatchups(matchups = []) {
  return (matchups || []).map((matchup) => ({
    ...matchup,
    id: matchup.id,
    teamAId: String(matchup.teamAId || ""),
    teamBId: String(matchup.teamBId || ""),
    roundNumber: Number(matchup.roundNumber) || 0,
    groupId: matchup.groupId != null ? String(matchup.groupId) : "",
    matchNumberInRound:
      Number(matchup.matchNumberInRound) > 0 ? Number(matchup.matchNumberInRound) : 0,
  }));
}

/**
 * @param {object} input
 * @param {Array} input.matchups
 * @param {boolean} [input.allowRematch]
 * @param {Set<string>|string[]} [input.lockedMatchupIds]
 */
export function validateMatchupStructure(input = {}) {
  const matchups = cloneMatchups(input.matchups || []);
  const allowRematch = input.allowRematch === true;
  const locked = new Set((input.lockedMatchupIds || []).map(String));
  const rejectionCodes = [];
  const errors = [];

  const pairCounts = new Map();
  const roundTeams = new Map();

  for (const matchup of matchups) {
    const a = String(matchup.teamAId || "");
    const b = String(matchup.teamBId || "");

    if (!a || !b) {
      rejectionCodes.push("MISSING_TEAM");
      errors.push("Thiếu đội trong cặp đấu.");
      continue;
    }

    if (a === b) {
      rejectionCodes.push("SELF_MATCH");
      errors.push(`Đội tự đấu: ${a}.`);
    }

    const key = pairKey(a, b);
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);

    const roundKey = `${matchup.groupId || ""}:${matchup.roundNumber}`;
    if (!roundTeams.has(roundKey)) {
      roundTeams.set(roundKey, new Set());
    }
    const playing = roundTeams.get(roundKey);
    if (playing.has(a) || playing.has(b)) {
      rejectionCodes.push("TEAM_DOUBLE_BOOKED_ROUND");
      errors.push(`Đội trùng vòng ${matchup.roundNumber}.`);
    }
    playing.add(a);
    playing.add(b);

    if (locked.has(String(matchup.id))) {
      const baseline = (input.baselineMatchups || []).find(
        (row) => String(row.id) === String(matchup.id)
      );
      if (baseline) {
        const samePair =
          pairKey(baseline.teamAId, baseline.teamBId) === key &&
          Number(baseline.roundNumber) === Number(matchup.roundNumber);
        if (!samePair) {
          rejectionCodes.push("LOCKED_MATCHUP_CHANGED");
          errors.push(`Trận khóa ${matchup.id} bị thay đổi.`);
        }
      }
    }
  }

  if (!allowRematch) {
    for (const [key, count] of pairCounts.entries()) {
      if (count > 1) {
        rejectionCodes.push("DUPLICATE_PAIR");
        errors.push(`Cặp trùng: ${key}.`);
      }
    }
  }

  return {
    ok: rejectionCodes.length === 0,
    rejectionCodes: [...new Set(rejectionCodes)],
    errors,
  };
}
