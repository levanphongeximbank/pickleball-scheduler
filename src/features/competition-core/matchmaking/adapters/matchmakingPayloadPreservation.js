import { cloneLegacyMatchmakingPayload, resolveLegacyMatchmakingRandomFn } from "./legacyMatchmakingPayloadMappers.js";
import {
  extractMatchmakingCourtMembership,
  extractMatchmakingWaitingIds,
} from "./legacyMatchmakingResultMappers.js";

const PRESERVED_TOP_LEVEL_KEYS = [
  "strategyKey",
  "legacyStrategyKey",
  "sessionId",
  "clubId",
  "tournamentId",
  "randomSeed",
  "randomFn",
  "players",
  "courts",
  "options",
];

export function verifyMatchmakingPayloadPreservation(payload = {}) {
  const cloned = cloneLegacyMatchmakingPayload(payload);
  const warnings = [];
  const unmappedFields = [];

  for (const key of Object.keys(payload)) {
    if (!PRESERVED_TOP_LEVEL_KEYS.includes(key)) {
      if (payload[key] !== undefined) {
        unmappedFields.push(key);
        warnings.push(`UNMAPPED_LEGACY_FIELD:${key}`);
      }
      if (payload[key] !== undefined && cloned[key] === undefined) {
        warnings.push(`DROPPED_LEGACY_FIELD:${key}`);
      }
    }
  }

  if (typeof payload.randomFn === "function" && cloned.randomFn !== payload.randomFn) {
    warnings.push("RANDOM_FN_REFERENCE_CHANGED:payload.randomFn");
  }
  if (
    typeof payload.options?.randomFn === "function" &&
    cloned.options?.randomFn !== payload.options.randomFn
  ) {
    warnings.push("RANDOM_FN_REFERENCE_CHANGED:options.randomFn");
  }

  return {
    preserved: warnings.filter((w) => w.startsWith("DROPPED_LEGACY_FIELD")).length === 0,
    warnings,
    unmappedFields,
  };
}

export function verifyMatchmakingRandomParity(payload, payloadAfter) {
  return resolveLegacyMatchmakingRandomFn(payload) === resolveLegacyMatchmakingRandomFn(payloadAfter);
}

export function buildMatchmakingParityComparison(input = {}) {
  const legacyCourts = extractMatchmakingCourtMembership(input.directLegacy?.courts);
  const adapterCourts = extractMatchmakingCourtMembership(input.adapterLegacy?.courts);
  const courtParity = JSON.stringify(legacyCourts) === JSON.stringify(adapterCourts);

  const legacyWaiting = extractMatchmakingWaitingIds(input.directLegacy?.waiting);
  const adapterWaiting = extractMatchmakingWaitingIds(input.adapterLegacy?.waiting);
  const waitingParity = JSON.stringify(legacyWaiting) === JSON.stringify(adapterWaiting);

  const warningsParity =
    JSON.stringify([...(input.directLegacy?.errors || [])].sort()) ===
    JSON.stringify([...(input.adapterLegacy?.errors || [])].sort());

  const scoreParity =
    JSON.stringify(input.directLegacy?.aiScore || {}) ===
    JSON.stringify(input.adapterLegacy?.aiScore || {});

  const randomParity = input.randomFnPreserved !== false;
  const payloadPreservation = input.payloadPreserved !== false;

  const mismatches = [...(input.mismatches || [])];
  if (!courtParity) {
    mismatches.push("COURT_ASSIGNMENT_MISMATCH");
  }
  if (!waitingParity) {
    mismatches.push("WAITING_LIST_MISMATCH");
  }
  if (!scoreParity) {
    mismatches.push("AI_SCORE_MISMATCH");
  }
  if (!randomParity) {
    mismatches.push("RANDOM_FN_NOT_PRESERVED");
  }

  return {
    ok: courtParity && waitingParity && scoreParity && warningsParity && randomParity && payloadPreservation,
    courtAllocationParity: courtParity,
    waitingListParity: waitingParity,
    scoreParity,
    warningsParity,
    randomParity,
    payloadPreservation,
    mismatches: [...new Set(mismatches)],
    legacyCourts,
    adapterCourts,
    playerCount:
      legacyCourts.reduce((sum, c) => sum + c.teamAIds.length + c.teamBIds.length, 0) +
      legacyWaiting.length,
    courtCount: legacyCourts.length,
  };
}
