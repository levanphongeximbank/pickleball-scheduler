import { evaluateCanonicalFormation } from "./formationRuntimeAdapter.js";
import { extractFormationTeamMembership } from "./legacyFormationResultMappers.js";
import { resolveLegacyFormationRandomFn } from "./legacyFormationPayloadMappers.js";

/**
 * @typedef {Object} FormationShadowComparison
 * @property {boolean} ok
 * @property {string} strategy
 * @property {number} playerCount
 * @property {number} teamCount
 * @property {ReturnType<typeof extractFormationTeamMembership>} legacyMembership
 * @property {ReturnType<typeof extractFormationTeamMembership>} adapterMembership
 * @property {boolean} membershipParity
 * @property {boolean} waitingParity
 * @property {boolean} warningsParity
 * @property {boolean} randomFnPreserved
 * @property {string[]} warnings
 * @property {Record<string, unknown>} metadataDifference
 * @property {Record<string, unknown>} traceSummary
 */

function membershipMapKey(membership = []) {
  const grouped = {};
  for (const team of membership) {
    grouped[String(team.teamIndex)] = [...team.playerIds].sort().join(",");
  }
  return JSON.stringify(grouped);
}

function compareWarnings(left = [], right = []) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

/**
 * Compare direct legacy formation output vs canonical adapter output.
 * Primary business output must remain direct legacy — shadow-only helper.
 *
 * @param {Object} input
 * @param {string} input.strategy
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.directLegacy
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.adapterLegacy
 * @param {import('./formationDecisionTrace.js').FormationRuntimeDecisionTrace} [input.trace]
 * @param {boolean} [input.randomFnPreserved]
 */
export function compareFormationShadowParity(input = {}) {
  const directTeams = input.directLegacy?.teams || [];
  const adapterTeams = input.adapterLegacy?.teams || [];
  const legacyMembership = extractFormationTeamMembership(directTeams);
  const adapterMembership = extractFormationTeamMembership(adapterTeams);

  const membershipParity =
    membershipMapKey(legacyMembership) === membershipMapKey(adapterMembership);
  const waitingParity =
    JSON.stringify([...(input.directLegacy?.waitingPlayerIds || [])].map(String).sort()) ===
    JSON.stringify([...(input.adapterLegacy?.waitingPlayerIds || [])].map(String).sort());
  const warningsParity = compareWarnings(
    input.directLegacy?.warnings,
    input.adapterLegacy?.warnings
  );
  const randomFnPreserved = input.randomFnPreserved !== false;

  /** @type {string[]} */
  const warnings = [];
  if (!membershipParity) {
    warnings.push("Team membership mismatch between direct legacy and adapter legacy.");
  }
  if (!waitingParity) {
    warnings.push("Waiting player list differs between direct legacy and adapter legacy.");
  }
  if (!warningsParity) {
    warnings.push("Warnings differ between direct legacy and adapter legacy.");
  }
  if (!randomFnPreserved) {
    warnings.push("Adapter altered randomFn reference on payload snapshot.");
  }

  const metadataDifference = {
    directTeamCount: directTeams.length,
    adapterTeamCount: adapterTeams.length,
    directWaitingCount: input.directLegacy?.waitingPlayerIds?.length || 0,
    adapterWaitingCount: input.adapterLegacy?.waitingPlayerIds?.length || 0,
  };

  const traceSummary = input.trace
    ? {
        total: input.trace.records?.length || 0,
        usedCanonical: input.trace.records?.some((record) => record.usedCanonical) || false,
        lastConsumer: input.trace.records?.[input.trace.records.length - 1]?.consumer || null,
      }
    : {};

  return {
    ok: membershipParity && waitingParity && warningsParity && randomFnPreserved,
    strategy: String(input.strategy || "unknown"),
    playerCount: legacyMembership.reduce((sum, team) => sum + team.playerIds.length, 0),
    teamCount: directTeams.length,
    legacyMembership,
    adapterMembership,
    membershipParity,
    waitingParity,
    warningsParity,
    randomFnPreserved,
    warnings,
    metadataDifference,
    traceSummary,
  };
}

/**
 * Verify adapter does not inject a new randomFn when none was provided.
 *
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} payload
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} payloadAfterAdapter
 */
export function verifyFormationRandomParity(payload, payloadAfterAdapter) {
  const before = resolveLegacyFormationRandomFn(payload);
  const after = resolveLegacyFormationRandomFn(payloadAfterAdapter);
  return before === after;
}

/**
 * Run direct legacy executor and adapter path; return direct legacy as primary output.
 *
 * @param {Object} input
 * @param {string} input.strategy
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {(payload: import('./legacyFormationPayloadMappers.js').LegacyFormationPayload) => import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.legacyExecutor
 */
export function runFormationShadowComparison(input) {
  const directLegacy = input.legacyExecutor(input.legacyPayload);
  const bridge = evaluateCanonicalFormation({
    consumer: input.strategy,
    legacyPayload: input.legacyPayload,
    envSource: input.envSource,
    legacyExecutor: input.legacyExecutor,
  });
  const comparison = compareFormationShadowParity({
    strategy: input.strategy,
    directLegacy,
    adapterLegacy: bridge.legacyResult,
    trace: bridge.trace,
    randomFnPreserved: bridge.randomFnPreserved,
  });

  return {
    primary: directLegacy,
    bridge,
    comparison,
  };
}
