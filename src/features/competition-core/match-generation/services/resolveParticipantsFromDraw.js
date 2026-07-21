/**
 * CORE-09 Phase 1C — resolve ordered participants from frozen DrawSnapshot.
 * Does not shuffle, re-seed, or reassign Draw placements.
 */

import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { sortMatchGenerationIssues } from "../services/asciiCompare.js";

/**
 * @typedef {{ participantId: string, placementRef: string, groupId: string|null, position: number|null }} ResolvedParticipant
 */

/**
 * Validate placement ordering metadata for a scope (flat or one group).
 * Positions, when present, must be unique integers. Mixed null/non-null fails.
 *
 * @param {ReadonlyArray<object>} placements
 * @param {string} pathPrefix
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
function validatePositionConsistency(placements, pathPrefix) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];
  let sawNull = false;
  let sawValue = false;
  /** @type {Map<number, number>} */
  const posCounts = new Map();

  for (let i = 0; i < placements.length; i += 1) {
    const pos = placements[i]?.position;
    if (pos === null || pos === undefined) {
      sawNull = true;
    } else if (typeof pos === "number" && Number.isInteger(pos)) {
      sawValue = true;
      posCounts.set(pos, (posCounts.get(pos) || 0) + 1);
    } else {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
          path: `${pathPrefix}[${i}].position`,
          message: "Placement position is invalid",
          details: { position: pos ?? null },
        })
      );
    }
  }

  if (sawNull && sawValue) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.NON_DETERMINISTIC_INPUT,
        path: pathPrefix,
        message:
          "Participant ordering metadata is invalid: mixed null and integer positions",
      })
    );
  }

  for (const [position, count] of posCounts.entries()) {
    if (count > 1) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: pathPrefix,
          message: "Duplicate placement position within ordering scope",
          details: { position, count },
        })
      );
    }
  }

  return issues;
}

/**
 * Flat participant list for ROUND_ROBIN (Draw placement array order).
 * Skips Draw-level bye placements (isBye). Virtual RR byes are generator-owned.
 *
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} drawSnapshot
 * @returns {{
 *   ok: boolean,
 *   participants: ReadonlyArray<ResolvedParticipant>,
 *   issues: import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[],
 * }}
 */
export function resolveFlatParticipantsFromDraw(drawSnapshot) {
  const placements = Array.isArray(drawSnapshot?.participantPlacements)
    ? drawSnapshot.participantPlacements
    : [];

  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];

  if (placements.length === 0) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
        path: "participantPlacements",
        message: "Participant placement catalog is empty",
      })
    );
    return {
      ok: false,
      participants: Object.freeze([]),
      issues: sortMatchGenerationIssues(issues),
    };
  }

  const active = placements.filter((p) => p?.isBye !== true);
  issues.push(...validatePositionConsistency(active, "participantPlacements"));

  /** @type {ResolvedParticipant[]} */
  const participants = [];
  /** @type {Set<string>} */
  const seenIds = new Set();
  /** @type {Set<string>} */
  const seenRefs = new Set();

  for (let i = 0; i < active.length; i += 1) {
    const p = active[i];
    const participantId = String(p?.participantId || "").trim();
    const placementRef = String(p?.placementRef || "").trim();
    if (!placementRef) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `participantPlacements[${i}].placementRef`,
          message: "Placement reference is missing",
        })
      );
      continue;
    }
    if (!participantId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `participantPlacements[${i}].participantId`,
          message: "Participant placement is missing",
        })
      );
      continue;
    }
    if (seenIds.has(participantId)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: "participantPlacements",
          message: "Participant placement is duplicated",
          details: { participantId },
        })
      );
      continue;
    }
    if (seenRefs.has(placementRef)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: "participantPlacements",
          message: "Placement reference is duplicated",
          details: { placementRef },
        })
      );
      continue;
    }
    seenIds.add(participantId);
    seenRefs.add(placementRef);
    participants.push(
      Object.freeze({
        participantId,
        placementRef,
        groupId:
          typeof p.groupId === "string" && p.groupId.trim()
            ? p.groupId.trim()
            : null,
        position:
          typeof p.position === "number" && Number.isInteger(p.position)
            ? p.position
            : null,
      })
    );
  }

  if (participants.length < 2 && issues.length === 0) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
        path: "participantPlacements",
        message: "Round robin requires at least two participants",
        details: { participantCount: participants.length },
      })
    );
  }

  const sorted = sortMatchGenerationIssues(issues);
  return {
    ok: sorted.length === 0 && participants.length >= 2,
    participants: Object.freeze(participants),
    issues: sorted,
  };
}

/**
 * Group catalog order + per-group participants for GROUP_ROUND_ROBIN.
 *
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} drawSnapshot
 * @returns {{
 *   ok: boolean,
 *   groups: ReadonlyArray<{
 *     groupId: string,
 *     participants: ReadonlyArray<ResolvedParticipant>,
 *   }>,
 *   issues: import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[],
 * }}
 */
export function resolveGroupedParticipantsFromDraw(drawSnapshot) {
  const groupCatalog = Array.isArray(drawSnapshot?.groupPlacements)
    ? drawSnapshot.groupPlacements
    : [];
  const placements = Array.isArray(drawSnapshot?.participantPlacements)
    ? drawSnapshot.participantPlacements
    : [];

  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];

  if (groupCatalog.length === 0) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_CATALOG_EMPTY,
        path: "groupPlacements",
        message: "Group catalog is missing for group-stage generation",
      })
    );
    return {
      ok: false,
      groups: Object.freeze([]),
      issues: sortMatchGenerationIssues(issues),
    };
  }

  /** @type {string[]} */
  const groupOrder = [];
  /** @type {Set<string>} */
  const catalogIds = new Set();
  for (let i = 0; i < groupCatalog.length; i += 1) {
    const g = groupCatalog[i];
    const groupId = String(g?.groupId || g?.id || "").trim();
    if (!groupId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
          path: `groupPlacements[${i}]`,
          message: "Group catalog entry missing groupId",
        })
      );
      continue;
    }
    if (catalogIds.has(groupId)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: `groupPlacements[${i}]`,
          message: "Duplicate groupId in group catalog",
          details: { groupId },
        })
      );
      continue;
    }
    catalogIds.add(groupId);
    groupOrder.push(groupId);
  }

  /** @type {Map<string, object[]>} */
  const byGroup = new Map();
  for (const id of groupOrder) byGroup.set(id, []);

  /** @type {Set<string>} */
  const seenParticipantIds = new Set();
  /** @type {Set<string>} */
  const seenPlacementRefs = new Set();

  for (let i = 0; i < placements.length; i += 1) {
    const p = placements[i];
    if (p?.isBye === true) continue;

    const path = `participantPlacements[${i}]`;
    const participantId = String(p?.participantId || "").trim();
    const placementRef = String(p?.placementRef || "").trim();
    const groupId = String(p?.groupId || "").trim();

    if (!placementRef) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `${path}.placementRef`,
          message: "Placement reference is missing",
        })
      );
      continue;
    }
    if (!participantId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `${path}.participantId`,
          message: "Participant placement is missing",
        })
      );
      continue;
    }
    if (!groupId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
          path: `${path}.groupId`,
          message: "Group reference is unresolved for group-stage generation",
        })
      );
      continue;
    }
    if (!catalogIds.has(groupId)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
          path: `${path}.groupId`,
          message: "Group reference is invalid",
          details: { groupId },
        })
      );
      continue;
    }
    if (seenParticipantIds.has(participantId)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: "participantPlacements",
          message: "Participant placement is duplicated across groups",
          details: { participantId },
        })
      );
      continue;
    }
    if (seenPlacementRefs.has(placementRef)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
          path: "participantPlacements",
          message: "Placement reference is duplicated",
          details: { placementRef },
        })
      );
      continue;
    }

    seenParticipantIds.add(participantId);
    seenPlacementRefs.add(placementRef);
    byGroup.get(groupId).push(p);
  }

  /** @type {Array<{ groupId: string, participants: ResolvedParticipant[] }>} */
  const groups = [];

  for (const groupId of groupOrder) {
    const groupPlacements = byGroup.get(groupId) || [];
    issues.push(
      ...validatePositionConsistency(
        groupPlacements,
        `groupPlacements[${groupId}]`
      )
    );

    /** @type {ResolvedParticipant[]} */
    const participants = [];
    /** @type {Set<string>} */
    const inGroupIds = new Set();

    for (const p of groupPlacements) {
      const participantId = String(p.participantId).trim();
      if (inGroupIds.has(participantId)) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
            path: `group:${groupId}`,
            message: "A participant must not appear twice in one group",
            details: { participantId, groupId },
          })
        );
        continue;
      }
      inGroupIds.add(participantId);
      participants.push(
        Object.freeze({
          participantId,
          placementRef: String(p.placementRef).trim(),
          groupId,
          position:
            typeof p.position === "number" && Number.isInteger(p.position)
              ? p.position
              : null,
        })
      );
    }

    if (participants.length === 0) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `group:${groupId}`,
          message: "Group has no participant placements",
          details: { groupId },
        })
      );
    } else if (participants.length < 2) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
          path: `group:${groupId}`,
          message: "Group round robin requires at least two participants",
          details: { groupId, participantCount: participants.length },
        })
      );
    }

    groups.push(
      Object.freeze({
        groupId,
        participants: Object.freeze(participants),
      })
    );
  }

  const sorted = sortMatchGenerationIssues(issues);
  return {
    ok: sorted.length === 0 && groups.every((g) => g.participants.length >= 2),
    groups: Object.freeze(groups),
    issues: sorted,
  };
}
