/**
 * Stable signature helpers + Set-backed dedupe for optimizer candidates.
 */

export function stableJoinIds(ids = []) {
  return [...ids].map(String).sort().join(",");
}

/**
 * Signature for a list of teams: each team is sorted player ids; teams sorted.
 * @param {Array<{ playerIds?: string[] }>} teams
 */
export function teamFormationSignature(teams = []) {
  return (teams || [])
    .map((team) => stableJoinIds(team.playerIds || []))
    .sort()
    .join("|");
}

/**
 * Signature for partner pairs (teams of size 2).
 */
export function partnerPairingSignature(teams = []) {
  return teamFormationSignature(teams);
}

/**
 * Signature for group plans (group → sorted team/entry ids).
 */
export function groupDrawSignature(groups = [], idKey = "teamIds") {
  return (groups || [])
    .map((group) => {
      const ids = group?.[idKey] || group?.entryIds || group?.playerIds || [];
      return stableJoinIds(ids);
    })
    .sort()
    .join("||");
}

/**
 * Signature for lineup selections: disciplineId → sorted player ids (order preserved for slots).
 * @param {Record<string, string[]>} selections
 */
export function lineupFormationSignature(selections = {}) {
  return Object.keys(selections || {})
    .map(String)
    .sort()
    .map((disciplineId) => {
      const ids = (selections[disciplineId] || []).map(String);
      return `${disciplineId}:${ids.join(",")}`;
    })
    .join("|");
}

/**
 * Signature for matchup set (unordered edges + round).
 * @param {Array<{ teamAId?: string, teamBId?: string, roundNumber?: number }>} matchups
 */
export function matchupPairingSignature(matchups = []) {
  return (matchups || [])
    .map((matchup) => {
      const a = String(matchup.teamAId || "");
      const b = String(matchup.teamBId || "");
      const edge = [a, b].sort().join("-");
      return `${Number(matchup.roundNumber) || 0}:${edge}`;
    })
    .sort()
    .join("|");
}

/**
 * Signature for schedule assignment: matchId → slot/time.
 * @param {Array<{ id?: string, matchupId?: string, scheduledAt?: string|null, slotIndex?: number }>} assignments
 */
export function scheduleAssignmentSignature(assignments = []) {
  return (assignments || [])
    .map((row) => {
      const id = String(row.id || row.matchupId || "");
      const slot =
        row.slotIndex != null
          ? String(row.slotIndex)
          : String(row.scheduledAt || "");
      return `${id}@${slot}`;
    })
    .sort()
    .join("|");
}

/**
 * Signature for court assignment: matchId → court.
 * @param {Array<{ id?: string, matchupId?: string, courtId?: string, courtLabel?: string }>} assignments
 */
export function courtAssignmentSignature(assignments = []) {
  return (assignments || [])
    .map((row) => {
      const id = String(row.id || row.matchupId || "");
      const court = String(row.courtId || row.courtLabel || "");
      return `${id}->${court}`;
    })
    .sort()
    .join("|");
}

/**
 * @returns {{ seen: Set<string>, add: (sig: string) => boolean, size: () => number }}
 */
export function createCandidateDeduper() {
  const seen = new Set();
  return {
    seen,
    add(signature) {
      const key = String(signature || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    size() {
      return seen.size;
    },
  };
}
