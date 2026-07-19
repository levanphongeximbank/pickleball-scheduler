/**
 * Phase 3H — build empty group shells.
 */

import { createDrawGroup } from "../contracts/drawGroup.js";

/**
 * @param {{
 *   drawIdentityKey: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   groupCount: number,
 *   groupCapacity?: number|null,
 * }} options
 * @returns {import('../contracts/drawGroup.js').DrawGroup[]}
 */
export function buildGroups(options) {
  const groups = [];
  for (let i = 1; i <= options.groupCount; i += 1) {
    groups.push(
      createDrawGroup({
        drawIdentityKey: options.drawIdentityKey,
        competitionId: options.competitionId,
        contextId: options.contextId,
        groupNumber: i,
        capacity: options.groupCapacity ?? null,
      })
    );
  }
  return groups;
}

/**
 * Attach placements into group membership lists (mutates copies).
 * @param {import('../contracts/drawGroup.js').DrawGroup[]} groups
 * @param {import('../contracts/drawPlacement.js').DrawPlacement[]} placements
 * @returns {import('../contracts/drawGroup.js').DrawGroup[]}
 */
export function attachPlacementsToGroups(groups, placements) {
  const byGroup = new Map(
    groups.map((g) => [
      g.identityKey,
      {
        ...g,
        memberPlacementKeys: [],
        candidateIdentityKeys: [],
      },
    ])
  );

  for (const placement of placements) {
    if (!placement.groupIdentityKey) continue;
    const group = byGroup.get(placement.groupIdentityKey);
    if (!group) continue;
    group.memberPlacementKeys.push(placement.identityKey);
    group.candidateIdentityKeys.push(placement.candidateIdentityKey);
  }

  return groups.map((g) => byGroup.get(g.identityKey) || g);
}
