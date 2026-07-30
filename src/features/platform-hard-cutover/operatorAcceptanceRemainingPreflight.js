/**
 * Read-only remaining-acceptance preflight helpers (no business/DB writes).
 * Used by tests and documented Owner GO planning — not an Operator Runner.
 */

import { PUBLIC_CATALOG_RPC } from "../public-catalog/persistence/schema.js";
import { OPERATOR_ACCEPTANCE_STEPS } from "./operatorAcceptanceShared.js";

export const REMAINING_PREFLIGHT_STEPS = Object.freeze([
  "A-COACH",
  "A-MSG",
  "A-DASH",
  "A-CAT",
  "A-G1",
  "A-G2",
  "A-G3",
  "A-G4",
  "A-G5",
  "A-G6",
]);

export const PUBLIC_CATALOG_ACCEPTANCE_RPCS = Object.freeze([
  PUBLIC_CATALOG_RPC.LIST_CLUBS,
  PUBLIC_CATALOG_RPC.LIST_COURTS,
  PUBLIC_CATALOG_RPC.LIST_TOURNAMENTS,
  PUBLIC_CATALOG_RPC.LIST_RANKINGS,
]);

/**
 * Evaluate one public-catalog remote result for A-CAT preflight/acceptance.
 * Empty items = PASS. Missing RPC / permission denied / malformed = FAIL.
 */
export function evaluatePublicCatalogRpcProbe({ rpc, result } = {}) {
  if (!rpc || !PUBLIC_CATALOG_ACCEPTANCE_RPCS.includes(rpc)) {
    return {
      ok: false,
      code: "CATALOG_RPC_UNKNOWN",
      message: "Unknown public catalog RPC",
    };
  }
  if (!result || result.ok !== true) {
    return {
      ok: false,
      code: result?.code || "CATALOG_RPC_FAILED",
      message: result?.message || `Public catalog RPC failed: ${rpc}`,
    };
  }
  const items = result.value?.items;
  if (items !== undefined && !Array.isArray(items)) {
    return {
      ok: false,
      code: "CATALOG_MALFORMED_RESPONSE",
      message: `Malformed public catalog response: ${rpc}`,
    };
  }
  return {
    ok: true,
    code: "OK",
    empty: Array.isArray(items) ? items.length === 0 : true,
    count: Array.isArray(items) ? items.length : 0,
  };
}

export function buildRemainingAcceptancePreflightPlan() {
  return Object.freeze({
    mode: "READ_ONLY",
    noBusinessWrites: true,
    noDatabaseWrites: true,
    acceptanceStepsContract: OPERATOR_ACCEPTANCE_STEPS.length,
    ownerBoundaryStep: "A-SEC",
    remainingSteps: REMAINING_PREFLIGHT_STEPS,
    aCat: {
      rpcs: [...PUBLIC_CATALOG_ACCEPTANCE_RPCS],
      emptyResult: "PASS",
      missingPermissionOrMalformed: "FAIL",
    },
    aCoach: {
      acceptModes: ["durable", "unavailable"],
      writes: false,
    },
    aMsg: {
      acceptModes: ["PRODUCTION", "UNAVAILABLE"],
      caseInsensitive: true,
      writes: false,
    },
    aDash: {
      accept: "unavailable OR sourceState UNAVAILABLE OR isMock===false",
      writes: false,
    },
    aG: {
      probes: ["A-G1", "A-G2", "A-G3", "A-G4", "A-G5", "A-G6"],
      hardCutoverOff: "FAIL HARD_CUTOVER_REQUIRED",
      writes: false,
    },
  });
}
