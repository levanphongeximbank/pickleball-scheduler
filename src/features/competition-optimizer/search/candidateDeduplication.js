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
