import { createDrawGroup, createDrawResult } from "../drawContracts.js";
import {
  createDrawPlacement,
  createDistributionStep,
  createStrategyDrawResult,
} from "../strategy/strategyContracts.js";

/**
 * @typedef {Object} LegacyGroupDrawResult
 * @property {boolean} [ok]
 * @property {Array<Record<string, unknown>>} [groups]
 * @property {string[]} [warnings]
 * @property {string[]} [errors]
 * @property {Record<string, unknown>} [balance]
 * @property {number} [drawScore]
 */

function collectPlayerIdsFromEntries(entries = []) {
  const ids = [];
  for (const entry of entries) {
    for (const playerId of entry?.playerIds || []) {
      ids.push(String(playerId));
    }
  }
  return ids;
}

/**
 * Legacy group record → canonical DrawGroup.
 *
 * @param {Record<string, unknown>} legacyGroup
 * @param {number} [index]
 * @returns {import('../drawTypes.js').DrawGroup}
 */
export function mapLegacyGroupToDrawGroup(legacyGroup, index = 0) {
  const entryIds = Array.isArray(legacyGroup.entryIds)
    ? legacyGroup.entryIds.map((id) => String(id))
    : Array.isArray(legacyGroup.entries)
      ? legacyGroup.entries.map((entry) => String(entry.id))
      : Array.isArray(legacyGroup.teamIds)
        ? legacyGroup.teamIds.map((id) => String(id))
        : [];

  const playerIds = Array.isArray(legacyGroup.playerIds)
    ? legacyGroup.playerIds.map((id) => String(id))
    : collectPlayerIdsFromEntries(legacyGroup.entries || []);

  return createDrawGroup({
    id: legacyGroup.id != null ? String(legacyGroup.id) : null,
    label: legacyGroup.label != null ? String(legacyGroup.label) : legacyGroup.name != null ? String(legacyGroup.name) : null,
    index: Number.isFinite(Number(legacyGroup.index)) ? Number(legacyGroup.index) : index,
    entryIds,
    playerIds,
    seedNumbers: Array.isArray(legacyGroup.seedNumbers)
      ? legacyGroup.seedNumbers.map((value) => Number(value))
      : [],
    averageLevel: Number.isFinite(Number(legacyGroup.averageLevel))
      ? Number(legacyGroup.averageLevel)
      : null,
    metadata: {
      legacyShape: "group-record",
      warnings: legacyGroup.warnings,
      locked: legacyGroup.locked,
    },
  });
}

/**
 * @param {Array<Record<string, unknown>>} legacyGroups
 * @returns {import('../drawTypes.js').DrawGroup[]}
 */
export function mapLegacyGroupsToDrawGroups(legacyGroups = []) {
  if (!Array.isArray(legacyGroups)) {
    return [];
  }
  return legacyGroups.map((group, index) => mapLegacyGroupToDrawGroup(group, index));
}

/**
 * Canonical DrawGroup → legacy group record shape (preserves entryIds).
 *
 * @param {import('../drawTypes.js').DrawGroup} drawGroup
 * @param {Record<string, unknown>} [template]
 * @returns {Record<string, unknown>}
 */
export function mapDrawGroupToLegacyGroup(drawGroup, template = {}) {
  return {
    ...template,
    id: drawGroup.id ?? template.id,
    label: drawGroup.label ?? template.label,
    name: drawGroup.label ?? template.name,
    index: drawGroup.index ?? template.index,
    entryIds: [...(drawGroup.entryIds || template.entryIds || [])],
    teamIds: [...(drawGroup.entryIds || template.teamIds || [])],
    playerIds: [...(drawGroup.playerIds || template.playerIds || [])],
    averageLevel: drawGroup.averageLevel ?? template.averageLevel,
    warnings: template.warnings,
    locked: template.locked,
    entries: template.entries,
    matches: template.matches,
    standings: template.standings,
    pointsConfig: template.pointsConfig,
    tournamentId: template.tournamentId,
    eventId: template.eventId,
  };
}

/**
 * @param {import('../drawTypes.js').DrawGroup[]} drawGroups
 * @param {Array<Record<string, unknown>>} [legacyTemplates]
 * @returns {Array<Record<string, unknown>>}
 */
export function mapDrawGroupsToLegacyGroups(drawGroups = [], legacyTemplates = []) {
  return drawGroups.map((group, index) =>
    mapDrawGroupToLegacyGroup(group, legacyTemplates[index] || {})
  );
}

/**
 * Legacy executor result → CC-04A DrawResult.
 *
 * @param {LegacyGroupDrawResult} legacyResult
 * @returns {import('../drawTypes.js').DrawResult}
 */
export function mapLegacyDrawResultToDrawResult(legacyResult = {}) {
  const groups = mapLegacyGroupsToDrawGroups(legacyResult.groups || []);

  return createDrawResult({
    ok: legacyResult.ok !== false,
    groups,
    warnings: legacyResult.warnings || [],
    errors: legacyResult.errors || [],
    metadata: {
      drawScore: legacyResult.drawScore,
      balance: legacyResult.balance,
      mappedFrom: "legacy-draw-result",
    },
  });
}

/**
 * Canonical DrawResult → legacy consumer shape (groups unchanged in membership).
 *
 * @param {import('../drawTypes.js').DrawResult} drawResult
 * @param {LegacyGroupDrawResult} [originalLegacyResult]
 * @returns {LegacyGroupDrawResult}
 */
export function adaptDrawResultForLegacyConsumer(drawResult, originalLegacyResult = {}) {
  const legacyTemplates = originalLegacyResult.groups || [];
  const groups = mapDrawGroupsToLegacyGroups(drawResult.groups || [], legacyTemplates);

  return {
    ...originalLegacyResult,
    ok: drawResult.ok !== false,
    groups,
    warnings: drawResult.warnings?.length
      ? drawResult.warnings
      : originalLegacyResult.warnings || [],
    errors: drawResult.errors?.length ? drawResult.errors : originalLegacyResult.errors || [],
    teamData: originalLegacyResult.teamData
      ? {
          ...originalLegacyResult.teamData,
          groups,
        }
      : undefined,
    balance: originalLegacyResult.balance,
  };
}

/**
 * Build CC-04C strategy result envelope from canonical draw result.
 *
 * @param {import('../drawTypes.js').DrawResult} drawResult
 * @param {import('../strategy/strategyTypes.js').StrategyDrawRequest} [strategyRequest]
 * @returns {import('../strategy/strategyTypes.js').StrategyDrawResult}
 */
export function mapDrawResultToStrategyDrawResult(drawResult, strategyRequest) {
  const distributionSteps = (drawResult.groups || []).flatMap((group, order) =>
    (group.entryIds || []).map((entryId, stepIndex) =>
      createDistributionStep({
        order: order * 100 + stepIndex,
        action: "place",
        entryId,
        groupId: group.id,
        reason: "legacy-runtime-result",
      })
    )
  );

  return createStrategyDrawResult({
    ok: drawResult.ok !== false,
    groups: drawResult.groups,
    placements: distributionSteps.map((step) =>
      createDrawPlacement({
        entryId: step.entryId,
        groupId: step.groupId,
        slotIndex: step.order,
      })
    ),
    distributionSteps,
    warnings: drawResult.warnings || [],
    explanations: drawResult.explanations || [],
    audit: strategyRequest?.selection
      ? {
          strategy: strategyRequest.selection.strategy,
          distributionType: strategyRequest.selection.distributionType,
          seedUsed: (strategyRequest.seeds || []).length > 0,
          constraintSummary: {},
          balanceSummary: {},
          randomSeed: strategyRequest.configuration?.randomSeed ?? null,
        }
      : undefined,
    metadata: drawResult.metadata,
  });
}

/**
 * @param {LegacyGroupDrawResult} directLegacy
 * @param {LegacyGroupDrawResult} adaptedLegacy
 * @returns {boolean}
 */
export function isLegacyDrawOutputPreserved(directLegacy, adaptedLegacy) {
  const directGroups = JSON.stringify(normalizeGroupsForCompare(directLegacy.groups));
  const adaptedGroups = JSON.stringify(normalizeGroupsForCompare(adaptedLegacy.groups));
  return directGroups === adaptedGroups && directLegacy.ok === adaptedLegacy.ok;
}

function normalizeGroupsForCompare(groups = []) {
  return (groups || []).map((group) => ({
    id: group.id != null ? String(group.id) : null,
    label: group.label ?? group.name ?? null,
    entryIds: [...(group.entryIds || group.teamIds || [])].map(String).sort(),
  }));
}

/**
 * Extract group membership by entry/team IDs for shadow parity checks.
 *
 * @param {Array<Record<string, unknown>>} [groups]
 * @returns {Array<{ groupIndex: number, groupId: string|null, label: string|null, memberIds: string[] }>}
 */
export function extractDrawGroupMembership(groups = []) {
  return (groups || []).map((group, groupIndex) => ({
    groupIndex,
    groupId: group.id != null ? String(group.id) : null,
    label: group.label != null ? String(group.label) : group.name != null ? String(group.name) : null,
    memberIds: [...(group.entryIds || group.teamIds || [])].map(String).sort(),
  }));
}
