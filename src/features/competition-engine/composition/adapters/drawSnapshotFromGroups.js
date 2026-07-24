/**
 * Map composition pool groups → CORE-09 DrawSnapshot (group stage).
 */

import {
  createDrawPlacementRef,
  createDrawSnapshot,
  DRAW_COMPLETION_STATUS,
} from "../../../competition-core/match-generation/index.js";
import { computeDeterministicFingerprint } from "../fingerprint.js";

/**
 * @param {{
 *   competitionId: string,
 *   divisionId: string,
 *   categoryId?: string|null,
 *   stageId?: string,
 *   groups: Array<{ groupId: string, participantIds: string[] }>,
 *   deterministicSeed: string,
 * }} input
 */
export function buildGroupDrawSnapshotFromPools(input) {
  const competitionId = String(input.competitionId || "").trim();
  const divisionId = String(input.divisionId || "").trim();
  const categoryId =
    typeof input.categoryId === "string" && input.categoryId.trim()
      ? input.categoryId.trim()
      : null;
  const stageId = String(input.stageId || "stage-pool").trim();
  const groups = Array.isArray(input.groups) ? input.groups : [];

  /** @type {object[]} */
  const groupPlacements = [];
  /** @type {ReturnType<typeof createDrawPlacementRef>[]} */
  const participantPlacements = [];

  for (const group of groups) {
    const groupId = String(group.groupId || "").trim();
    groupPlacements.push({ groupId, id: groupId });
    const ids = Array.isArray(group.participantIds) ? group.participantIds : [];
    ids.forEach((pid, index) => {
      participantPlacements.push(
        createDrawPlacementRef({
          placementRef: `${groupId}-${pid}`,
          participantId: String(pid),
          groupId,
          position: index + 1,
          isBye: false,
        })
      );
    });
  }

  const drawFingerprint = computeDeterministicFingerprint(
    {
      competitionId,
      divisionId,
      stageId,
      groups: groups.map((g) => ({
        groupId: g.groupId,
        participantIds: g.participantIds,
      })),
      deterministicSeed: input.deterministicSeed,
    },
    "draw-pool"
  );

  return createDrawSnapshot({
    drawId: `draw-pool-${competitionId}`,
    drawVersion: "1",
    drawFingerprint,
    competitionId,
    divisionId,
    categoryId,
    completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
    stageDefinitions: [{ stageId, order: 1 }],
    groupPlacements,
    bracketPlacements: [],
    participantPlacements,
    byePlacements: [],
    seedReferences: [],
    deterministicOrderingMetadata: {
      seed: String(input.deterministicSeed || ""),
    },
  });
}
