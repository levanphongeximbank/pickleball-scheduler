/**
 * Canonical admission-source precedence resolver (policy semantics).
 *
 * DIRECT > GROUP_DIRECT > WILDCARD
 *
 * Does NOT rank standings (CORE-18) or compose knockout brackets (CE/CORE-08/09).
 * Selects next-eligible candidates from already-ranked inputs with backfill.
 */

import { ADMISSION_SOURCE, ADMISSION_SOURCE_PRECEDENCE, ADMISSION_SOURCE_SEMANTICS } from "../constants/admissionSource.js";
import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";

const EXCLUDED_STATUSES = new Set([
  "WITHDRAWN",
  "DISQUALIFIED",
  "DQ",
  "VOID",
  "INVALID",
  "UNACCEPTED",
]);

/**
 * @param {string|null|undefined} status
 */
function isEligibleStatus(status) {
  const s = String(status || "").toUpperCase();
  return !EXCLUDED_STATUSES.has(s);
}

/**
 * @param {{ entryId: string, rank?: number }} a
 * @param {{ entryId: string, rank?: number }} b
 */
function compareRanked(a, b) {
  const ra = Number(a.rank);
  const rb = Number(b.rank);
  if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb;
  return String(a.entryId).localeCompare(String(b.entryId));
}

/**
 * Resolve admission populations with canonical precedence + backfill.
 *
 * @param {{
 *   directEntrants?: Array<{ entryId: string, effectiveTargetStage?: string|null, targetStage?: string|null, seedNumber?: number }>,
 *   directKnockoutEntrySlots?: number,
 *   groupStandingsByGroup?: Array<{
 *     groupId: string,
 *     rows: Array<{ entryId: string, rank: number, status?: string }>
 *   }>,
 *   groupDirectSlotsPerGroup?: number,
 *   groupDirectQualifierSlots?: number,
 *   wildcardCandidates?: Array<{ entryId: string, rank?: number, groupId?: string, status?: string }>,
 *   wildcardSlots?: number,
 *   excludedEntryIds?: string[],
 * }} input
 */
export function resolveAdmissionSourcePrecedence(input = {}) {
  const directSlots = Math.max(0, Math.floor(Number(input.directKnockoutEntrySlots) || 0));
  const groupSlotsPerGroup = Math.max(
    0,
    Math.floor(Number(input.groupDirectSlotsPerGroup) || 0)
  );
  const groupDirectQualifierSlots =
    input.groupDirectQualifierSlots != null
      ? Math.max(0, Math.floor(Number(input.groupDirectQualifierSlots) || 0))
      : null;
  const wildcardSlots = Math.max(0, Math.floor(Number(input.wildcardSlots) || 0));

  const excluded = new Set(
    (input.excludedEntryIds || []).map((id) => String(id).trim()).filter(Boolean)
  );

  /** @type {Map<string, object>} */
  const reservedDirect = new Map();
  for (const raw of input.directEntrants || []) {
    const entryId = String(raw?.entryId || "").trim();
    if (!entryId) {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.MISSING_ENTRANT_IDENTITY,
        message: "DIRECT entrant requires canonical entryId",
        details: Object.freeze({}),
      });
    }
    if (reservedDirect.has(entryId)) {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.DUPLICATE_ENTRANT_REF,
        message: "Duplicate DIRECT entryId",
        details: Object.freeze({ entryId }),
      });
    }
    reservedDirect.set(
      entryId,
      Object.freeze({
        entryId,
        admissionSource: ADMISSION_SOURCE.DIRECT,
        effectiveTargetStage:
          raw.effectiveTargetStage || raw.targetStage || null,
        seedNumber:
          Number.isFinite(Number(raw.seedNumber)) && Number(raw.seedNumber) >= 1
            ? Number(raw.seedNumber)
            : null,
      })
    );
  }

  if (reservedDirect.size > directSlots) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
      message: "Resolved DIRECT entrants exceed directKnockoutEntrySlots",
      details: Object.freeze({
        resolved: reservedDirect.size,
        directKnockoutEntrySlots: directSlots,
      }),
    });
  }

  const directReservedIds = new Set(reservedDirect.keys());

  /** @type {object[]} */
  const groupDirectSelected = [];
  const groups = Array.isArray(input.groupStandingsByGroup)
    ? input.groupStandingsByGroup
    : [];

  for (const block of groups) {
    const groupId = String(block.groupId || "").trim();
    const rows = [...(block.rows || [])]
      .filter((r) => {
        const entryId = String(r.entryId || "").trim();
        if (!entryId) return false;
        if (excluded.has(entryId)) return false;
        if (directReservedIds.has(entryId)) return false; // DIRECT does not consume GROUP_DIRECT
        return isEligibleStatus(r.status);
      })
      .sort(compareRanked);

    let filled = 0;
    for (const row of rows) {
      if (filled >= groupSlotsPerGroup) break;
      const entryId = String(row.entryId).trim();
      if (groupDirectSelected.some((g) => g.entryId === entryId)) continue;
      groupDirectSelected.push(
        Object.freeze({
          entryId,
          admissionSource: ADMISSION_SOURCE.GROUP_DIRECT,
          groupId,
          poolRank: Number(row.rank) || filled + 1,
          effectiveTargetStage: null,
          seedNumber: null,
        })
      );
      filled += 1;
    }

    if (groupSlotsPerGroup > 0 && filled < groupSlotsPerGroup) {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
        message:
          "Unable to fill GROUP_DIRECT slots with next-eligible ranked entrants",
        details: Object.freeze({
          groupId,
          needed: groupSlotsPerGroup,
          filled,
          NEXT_ELIGIBLE_GROUP_BACKFILL:
            ADMISSION_SOURCE_SEMANTICS.NEXT_ELIGIBLE_GROUP_BACKFILL,
        }),
      });
    }
  }

  if (
    groupDirectQualifierSlots != null &&
    groupDirectSelected.length !== groupDirectQualifierSlots
  ) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
      message: "GROUP_DIRECT count does not equal groupDirectQualifierSlots",
      details: Object.freeze({
        actual: groupDirectSelected.length,
        expected: groupDirectQualifierSlots,
      }),
    });
  }

  const groupDirectIds = new Set(groupDirectSelected.map((g) => g.entryId));

  /** @type {object[]} */
  const wildcardSelected = [];
  const wildcardPool = [...(input.wildcardCandidates || [])]
    .filter((c) => {
      const entryId = String(c.entryId || "").trim();
      if (!entryId) return false;
      if (excluded.has(entryId)) return false;
      if (directReservedIds.has(entryId)) return false;
      if (groupDirectIds.has(entryId)) return false;
      return isEligibleStatus(c.status);
    })
    .sort(compareRanked);

  for (const cand of wildcardPool) {
    if (wildcardSelected.length >= wildcardSlots) break;
    const entryId = String(cand.entryId).trim();
    if (wildcardSelected.some((w) => w.entryId === entryId)) continue;
    wildcardSelected.push(
      Object.freeze({
        entryId,
        admissionSource: ADMISSION_SOURCE.WILDCARD,
        groupId: cand.groupId != null ? String(cand.groupId) : null,
        poolRank: Number.isFinite(Number(cand.rank)) ? Number(cand.rank) : null,
        effectiveTargetStage: null,
        seedNumber: null,
        crossGroupRank:
          Number.isFinite(Number(cand.crossGroupRank))
            ? Number(cand.crossGroupRank)
            : wildcardSelected.length + 1,
      })
    );
  }

  if (wildcardSlots > 0 && wildcardSelected.length < wildcardSlots) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_KNOCKOUT_ADMISSION,
      message:
        "Unable to fill WILDCARD slots with next-eligible ranked candidates",
      details: Object.freeze({
        needed: wildcardSlots,
        filled: wildcardSelected.length,
        NEXT_ELIGIBLE_WILDCARD_BACKFILL:
          ADMISSION_SOURCE_SEMANTICS.NEXT_ELIGIBLE_WILDCARD_BACKFILL,
      }),
    });
  }

  return Object.freeze({
    ok: true,
    semantics: ADMISSION_SOURCE_SEMANTICS,
    precedence: Object.freeze([...ADMISSION_SOURCE_PRECEDENCE]),
    direct: Object.freeze([...reservedDirect.values()]),
    groupDirect: Object.freeze(groupDirectSelected),
    wildcard: Object.freeze(wildcardSelected),
    reservedDirectEntryIds: Object.freeze([...directReservedIds].sort()),
    reservedGroupDirectEntryIds: Object.freeze([...groupDirectIds].sort()),
    counts: Object.freeze({
      direct: reservedDirect.size,
      groupDirect: groupDirectSelected.length,
      wildcard: wildcardSelected.length,
    }),
    code: null,
    message: null,
  });
}

export { ADMISSION_SOURCE, ADMISSION_SOURCE_SEMANTICS };
