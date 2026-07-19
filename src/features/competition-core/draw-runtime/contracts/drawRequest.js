/**
 * Phase 3H — DrawRequest / resolve request contract.
 */

import { DRAW_MODE, isDrawMode } from "../enums/drawModes.js";
import { LAYOUT_TYPE, isLayoutType } from "../enums/layoutTypes.js";

/**
 * @typedef {Object} DrawResolveRequest
 * @property {string} competitionId
 * @property {string} contextId
 * @property {string|null} [formatType]
 * @property {unknown} [source]
 * @property {Array<Record<string, unknown>>} [candidates]
 * @property {Array<Record<string, unknown>>} [seedAssignments]
 * @property {number|null} [groupCount]
 * @property {number|null} [groupCapacity]
 * @property {number|null} [bracketSize]
 * @property {string} [layoutType]
 * @property {string} [drawMode]
 * @property {unknown} [deterministicSeed]
 * @property {Array<Record<string, unknown>>} [manualPlacements]
 * @property {Array<Record<string, unknown>>} [protectedPlacements]
 * @property {Record<string, unknown>|null} [byePolicy]
 * @property {string|null} [policyReference]
 * @property {boolean} [allowNonPowerOfTwo]
 * @property {Record<string, unknown>} [context]
 * @property {Record<string, unknown>} [options]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawResolveRequest>|null|undefined} partial
 * @returns {DrawResolveRequest}
 */
export function createDrawResolveRequest(partial = {}) {
  const drawMode = isDrawMode(partial?.drawMode)
    ? partial.drawMode
    : DRAW_MODE.SNAKE_GROUPS;

  let layoutType = isLayoutType(partial?.layoutType) ? partial.layoutType : null;
  if (!layoutType) {
    if (
      drawMode === DRAW_MODE.SEEDED_BRACKET ||
      drawMode === DRAW_MODE.OPEN_RANDOM_BRACKET
    ) {
      layoutType = LAYOUT_TYPE.BRACKET;
    } else if (drawMode === DRAW_MODE.NOOP) {
      layoutType = LAYOUT_TYPE.NOOP;
    } else if (drawMode === DRAW_MODE.HYBRID) {
      layoutType = LAYOUT_TYPE.HYBRID;
    } else {
      layoutType = LAYOUT_TYPE.GROUPS;
    }
  }

  return {
    competitionId: String(partial?.competitionId || ""),
    contextId: String(partial?.contextId || ""),
    formatType:
      typeof partial?.formatType === "string" && partial.formatType
        ? partial.formatType
        : null,
    source: partial?.source ?? null,
    candidates: Array.isArray(partial?.candidates)
      ? partial.candidates.map((item) =>
          item && typeof item === "object" ? { ...item } : {}
        )
      : [],
    seedAssignments: Array.isArray(partial?.seedAssignments)
      ? partial.seedAssignments.map((item) =>
          item && typeof item === "object" ? { ...item } : {}
        )
      : [],
    groupCount:
      partial?.groupCount != null && Number.isFinite(Number(partial.groupCount))
        ? Number(partial.groupCount)
        : null,
    groupCapacity:
      partial?.groupCapacity != null &&
      Number.isFinite(Number(partial.groupCapacity))
        ? Number(partial.groupCapacity)
        : null,
    bracketSize:
      partial?.bracketSize != null && Number.isFinite(Number(partial.bracketSize))
        ? Number(partial.bracketSize)
        : null,
    layoutType,
    drawMode,
    deterministicSeed:
      partial?.deterministicSeed !== undefined
        ? partial.deterministicSeed
        : undefined,
    manualPlacements: Array.isArray(partial?.manualPlacements)
      ? partial.manualPlacements.map((item) =>
          item && typeof item === "object" ? { ...item } : {}
        )
      : [],
    protectedPlacements: Array.isArray(partial?.protectedPlacements)
      ? partial.protectedPlacements.map((item) =>
          item && typeof item === "object" ? { ...item } : {}
        )
      : [],
    byePolicy:
      partial?.byePolicy &&
      typeof partial.byePolicy === "object" &&
      !Array.isArray(partial.byePolicy)
        ? { ...partial.byePolicy }
        : null,
    policyReference:
      typeof partial?.policyReference === "string"
        ? partial.policyReference
        : null,
    allowNonPowerOfTwo: partial?.allowNonPowerOfTwo === true,
    context:
      partial?.context &&
      typeof partial.context === "object" &&
      !Array.isArray(partial.context)
        ? { ...partial.context }
        : {},
    options:
      partial?.options &&
      typeof partial.options === "object" &&
      !Array.isArray(partial.options)
        ? { ...partial.options }
        : {},
    metadata:
      partial?.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : {},
  };
}

/** @deprecated Prefer createDrawResolveRequest */
export function createDrawRequest(partial) {
  return createDrawResolveRequest(partial);
}
