import { extractDrawGroupMembership } from "./legacyDrawResultMappers.js";
import { evaluateCanonicalDraw } from "./drawRuntimeAdapter.js";

/**
 * @typedef {Object} DrawShadowComparison
 * @property {boolean} ok
 * @property {string} strategy
 * @property {number} entryCount
 * @property {number} groupCount
 * @property {ReturnType<typeof extractDrawGroupMembership>} legacyMembership
 * @property {ReturnType<typeof extractDrawGroupMembership>} adapterMembership
 * @property {boolean} membershipParity
 * @property {boolean} groupOrderParity
 * @property {boolean} seedOrderParity
 * @property {boolean} warningsParity
 * @property {string[]} warnings
 * @property {Record<string, unknown>} metadataDifference
 * @property {Record<string, unknown>} traceSummary
 */

function membershipMapKey(membership = []) {
  const grouped = {};
  for (const group of membership) {
    grouped[String(group.groupIndex)] = [...group.memberIds].sort().join(",");
  }
  return JSON.stringify(grouped);
}

function flattenMemberOrder(membership = []) {
  return membership.flatMap((group) => group.memberIds);
}

function compareWarnings(left = [], right = []) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

/**
 * Compare direct legacy draw output vs canonical adapter output.
 * Primary business output must remain direct legacy — this helper is shadow-only.
 *
 * @param {Object} input
 * @param {string} input.strategy
 * @param {import('./legacyDrawResultMappers.js').LegacyGroupDrawResult} input.directLegacy
 * @param {import('./legacyDrawResultMappers.js').LegacyGroupDrawResult} input.adapterLegacy
 * @param {import('./drawDecisionTrace.js').DrawDecisionTrace} [input.trace]
 */
export function compareDrawShadowParity(input = {}) {
  const directGroups = input.directLegacy?.groups || [];
  const adapterGroups = input.adapterLegacy?.groups || [];
  const legacyMembership = extractDrawGroupMembership(directGroups);
  const adapterMembership = extractDrawGroupMembership(adapterGroups);
  const entryCount = legacyMembership.reduce((sum, group) => sum + group.memberIds.length, 0);

  const membershipParity = membershipMapKey(legacyMembership) === membershipMapKey(adapterMembership);
  const groupOrderParity =
    JSON.stringify(legacyMembership.map((group) => group.memberIds)) ===
    JSON.stringify(adapterMembership.map((group) => group.memberIds));
  const seedOrderParity =
    JSON.stringify(flattenMemberOrder(legacyMembership)) ===
    JSON.stringify(flattenMemberOrder(adapterMembership));
  const warningsParity = compareWarnings(
    input.directLegacy?.warnings,
    input.adapterLegacy?.warnings
  );

  /** @type {string[]} */
  const warnings = [];
  if (!membershipParity) {
    warnings.push("Group membership mismatch between direct legacy and adapter legacy.");
  }
  if (!groupOrderParity) {
    warnings.push("Group order differs while membership may match.");
  }
  if (!warningsParity) {
    warnings.push("Warnings differ between direct legacy and adapter legacy.");
  }

  const metadataDifference = {
    directOk: input.directLegacy?.ok,
    adapterOk: input.adapterLegacy?.ok,
    directGroupCount: directGroups.length,
    adapterGroupCount: adapterGroups.length,
    directBalance: input.directLegacy?.balance ?? null,
    adapterBalance: input.adapterLegacy?.balance ?? null,
  };

  const traceSummary = input.trace
    ? {
        total: input.trace.records?.length || 0,
        usedCanonical: input.trace.records?.some((record) => record.usedCanonical) || false,
        lastConsumer: input.trace.records?.[input.trace.records.length - 1]?.consumer || null,
      }
    : {};

  return {
    ok: membershipParity && warningsParity,
    strategy: String(input.strategy || "unknown"),
    entryCount,
    groupCount: directGroups.length,
    legacyMembership,
    adapterMembership,
    membershipParity,
    groupOrderParity,
    seedOrderParity,
    warningsParity,
    warnings,
    metadataDifference,
    traceSummary,
  };
}

/**
 * Run direct legacy executor and adapter path, return direct legacy as primary output.
 *
 * @param {Object} input
 * @param {string} input.strategy
 * @param {import('./legacyDrawPayloadMappers.js').LegacyDrawPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {(payload: import('./legacyDrawPayloadMappers.js').LegacyDrawPayload) => import('./legacyDrawResultMappers.js').LegacyGroupDrawResult} input.legacyExecutor
 */
export function runDrawShadowComparison(input) {
  const directLegacy = input.legacyExecutor(input.legacyPayload);
  const bridge = evaluateCanonicalDraw({
    consumer: input.strategy,
    legacyPayload: input.legacyPayload,
    envSource: input.envSource,
    legacyExecutor: input.legacyExecutor,
  });
  const comparison = compareDrawShadowParity({
    strategy: input.strategy,
    directLegacy,
    adapterLegacy: bridge.legacyResult,
    trace: bridge.trace,
  });

  return {
    primary: directLegacy,
    bridge,
    comparison,
  };
}
