/**
 * CORE-08 Phase 1B — map Phase 3H DrawResolveResult → legacy-shaped groups.
 * Deterministic ids/labels only. No wall-clock identity. No non-deterministic RNG.
 */

/**
 * @param {number} groupNumber 1-based
 * @returns {string}
 */
export function groupNumberToLabel(groupNumber) {
  const n = Number(groupNumber);
  if (!Number.isInteger(n) || n < 1) return "G?";
  if (n <= 26) return String.fromCharCode(64 + n);
  return `G${n}`;
}

/**
 * @param {import('../contracts/drawResult.js').DrawResolveResult} canonical
 * @param {{
 *   entriesById?: Map<string, unknown>|Record<string, unknown>,
 *   namePrefix?: string,
 *   includeEntries?: boolean,
 * }} [options]
 */
export function mapCanonicalResultToLegacyGroups(canonical, options = {}) {
  const namePrefix =
    typeof options.namePrefix === "string" ? options.namePrefix : "Bảng ";
  const includeEntries = options.includeEntries !== false;

  /** @type {Map<string, unknown>} */
  let entriesById;
  if (options.entriesById instanceof Map) {
    entriesById = options.entriesById;
  } else if (options.entriesById && typeof options.entriesById === "object") {
    entriesById = new Map(Object.entries(options.entriesById));
  } else {
    entriesById = new Map();
  }

  const groups = Array.isArray(canonical?.groups) ? canonical.groups : [];
  const placements = Array.isArray(canonical?.placements)
    ? canonical.placements
    : [];

  /** @type {Map<string, Array<{ candidateReference: string, positionNumber: number|null, seedNumber: number|null, candidateIdentityKey: string }>>} */
  const byGroupKey = new Map();
  for (const group of groups) {
    byGroupKey.set(String(group.identityKey), []);
  }

  for (const placement of placements) {
    const key = String(placement.groupIdentityKey || "");
    if (!key || !byGroupKey.has(key)) continue;
    const ref =
      placement.metadata?.candidateReference != null
        ? String(placement.metadata.candidateReference)
        : String(placement.candidateIdentityKey || "")
            .split("::CANDIDATE::")
            .pop();
    byGroupKey.get(key).push({
      candidateReference: ref,
      positionNumber: placement.positionNumber ?? null,
      seedNumber: placement.seedNumber ?? null,
      candidateIdentityKey: String(placement.candidateIdentityKey || ""),
    });
  }

  for (const list of byGroupKey.values()) {
    list.sort((a, b) => {
      const ap = a.positionNumber == null ? Number.POSITIVE_INFINITY : a.positionNumber;
      const bp = b.positionNumber == null ? Number.POSITIVE_INFINITY : b.positionNumber;
      if (ap !== bp) return ap - bp;
      const ak = String(a.candidateIdentityKey);
      const bk = String(b.candidateIdentityKey);
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      return 0;
    });
  }

  const legacyGroups = groups
    .slice()
    .sort((a, b) => Number(a.groupNumber) - Number(b.groupNumber))
    .map((group) => {
      const label =
        group.label != null && String(group.label)
          ? String(group.label)
          : groupNumberToLabel(group.groupNumber);
      const members = byGroupKey.get(String(group.identityKey)) || [];
      const entryIds = members.map((m) => m.candidateReference);
      const entries = includeEntries
        ? entryIds
            .map((id) => entriesById.get(String(id)))
            .filter(Boolean)
        : [];

      return {
        id: String(group.identityKey || `group-${label}`),
        label,
        name: `${namePrefix}${label}`,
        group: label,
        groupNumber: Number(group.groupNumber),
        capacity: group.capacity ?? null,
        entryIds,
        entries,
        teamIds: entryIds,
        teams: entries,
        memberPlacements: members,
        matches: [],
        standings: [],
        pointsConfig: { win: 2, loss: 1, forfeit: 0 },
      };
    });

  const byes = Array.isArray(canonical?.byes)
    ? canonical.byes.map((bye) => ({
        identityKey: bye.identityKey,
        slotNumber: bye.slotNumber,
        bracketIdentityKey: bye.bracketIdentityKey ?? null,
      }))
    : [];

  return {
    groups: legacyGroups,
    byes,
    unresolvedCandidates: Array.isArray(canonical?.unresolvedCandidates)
      ? canonical.unresolvedCandidates
      : [],
    excludedCandidates: Array.isArray(canonical?.excludedCandidates)
      ? canonical.excludedCandidates
      : [],
    decisionTrace: Array.isArray(canonical?.decisionTrace)
      ? canonical.decisionTrace
      : [],
  };
}

/**
 * Membership sets by group label for parity compares.
 * @param {Array<{ label?: string, entryIds?: string[], teamIds?: string[] }>} groups
 * @returns {Record<string, string[]>}
 */
export function membershipByLabel(groups = []) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const group of groups) {
    const label = String(group.label || group.group || "");
    const ids = Array.isArray(group.entryIds)
      ? group.entryIds
      : Array.isArray(group.teamIds)
        ? group.teamIds
        : [];
    out[label] = ids.map((id) => String(id)).sort();
  }
  return out;
}
