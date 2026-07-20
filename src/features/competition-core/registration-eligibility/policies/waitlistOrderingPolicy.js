import { normalizePriorityRank } from "./capacityAccounting.js";

/**
 * Deterministic waitlist ordering tuple (ascending):
 * 1. priorityRank
 * 2. submittedAt
 * 3. waitlistedAt
 * 4. registrationId (lexicographic)
 *
 * Never uses random ordering, object insertion order, or async completion order.
 */

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function sortableTimestamp(value) {
  if (value == null || String(value).trim() === "") {
    return "9999-12-31T23:59:59.999Z";
  }
  return String(value).trim();
}

/**
 * @param {{
 *   priorityRank?: unknown,
 *   submittedAt?: string|null,
 *   waitlistedAt?: string|null,
 *   registrationId?: string,
 * }} a
 * @param {{
 *   priorityRank?: unknown,
 *   submittedAt?: string|null,
 *   waitlistedAt?: string|null,
 *   registrationId?: string,
 * }} b
 * @returns {number}
 */
export function compareWaitlistEntries(a, b) {
  const rankA = normalizePriorityRank(a?.priorityRank);
  const rankB = normalizePriorityRank(b?.priorityRank);
  if (rankA !== rankB) return rankA < rankB ? -1 : 1;

  const submittedA = sortableTimestamp(a?.submittedAt);
  const submittedB = sortableTimestamp(b?.submittedAt);
  if (submittedA !== submittedB) return submittedA < submittedB ? -1 : 1;

  const waitlistedA = sortableTimestamp(a?.waitlistedAt);
  const waitlistedB = sortableTimestamp(b?.waitlistedAt);
  if (waitlistedA !== waitlistedB) return waitlistedA < waitlistedB ? -1 : 1;

  const idA = String(a?.registrationId || "");
  const idB = String(b?.registrationId || "");
  if (idA === idB) return 0;
  return idA < idB ? -1 : 1;
}

/**
 * @template {Record<string, unknown>} T
 * @param {T[]} entries
 * @returns {T[]}
 */
export function sortWaitlistEntries(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort(compareWaitlistEntries);
}

/**
 * One-based positions for an already-sorted or unsorted active waitlist.
 * @param {Array<{
 *   waitlistEntryId?: string,
 *   registrationId: string,
 *   competitionId: string,
 *   divisionId?: string|null,
 *   priorityRank?: unknown,
 *   submittedAt?: string|null,
 *   waitlistedAt?: string|null,
 * }>} entries
 * @param {{ calculatedAt: string, waitlistVersion?: number }} meta
 * @returns {import('../contracts/capacity.js').RegistrationWaitlistPosition[]}
 */
export function calculateWaitlistPositions(entries, meta) {
  const ordered = sortWaitlistEntries(entries);
  const totalCount = ordered.length;
  const waitlistVersion = Number(meta.waitlistVersion ?? 0);
  const calculatedAt = String(meta.calculatedAt);

  return ordered.map((entry, index) => {
    const position = index + 1;
    return {
      schemaVersion: "1",
      waitlistEntryId: entry.waitlistEntryId ?? null,
      registrationId: String(entry.registrationId),
      competitionId: String(entry.competitionId),
      divisionId: entry.divisionId ?? null,
      position,
      priorityRank: normalizePriorityRank(entry.priorityRank),
      submittedAt: entry.submittedAt ?? null,
      waitlistedAt: entry.waitlistedAt ?? null,
      queuedAt: entry.waitlistedAt ?? null,
      calculatedAt,
      waitlistVersion,
      aheadCount: index,
      totalCount,
      policyRef: "core03-waitlist-order-v1",
      metadata: null,
    };
  });
}
