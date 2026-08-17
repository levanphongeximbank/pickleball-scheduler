/**
 * Shared lifecycle / capability / propagation policy builders for Adapter B.
 * Policy description only — no lifecycle/scoring/result authority.
 */

import { MATCH_STATUS } from "../../../../../competition-core/matches/index.js";
import { assertResultPropagationPayload } from "../../contract.js";
import { freezeClone } from "../../helpers.js";

/**
 * @param {object} [overrides]
 */
export function buildStandardLifecyclePolicy(overrides = {}) {
  const base = {
    policyId: "competition.referee.lifecycle.v1",
    requiresLineups: overrides.requiresLineups !== false,
    canStartFrom: overrides.canStartFrom || [
      MATCH_STATUS.READY_TO_START,
      MATCH_STATUS.SCHEDULED,
    ],
    completionRequiresAcceptedResult:
      overrides.completionRequiresAcceptedResult === true,
    ...overrides,
  };
  return freezeClone({
    ...base,
    // Locked invariants — cannot be overridden away
    requiresAssignment: true,
    standingsRequireAcceptedResult: true,
  });
}

/**
 * @param {object} [overrides]
 */
export function buildStandardCapabilities(overrides = {}) {
  const base = {
    scoring: overrides.scoring !== false,
    suspend: overrides.suspend !== false,
    resume: overrides.resume !== false,
    incidentReport: overrides.incidentReport !== false,
    childOverrideAssignment: overrides.childOverrideAssignment === true,
    dreambreakerInheritsParent: overrides.dreambreakerInheritsParent === true,
    ...overrides,
  };
  return freezeClone({
    ...base,
    // Locked — Adapter B never owns these
    ownsScoringAuthority: false,
    ownsResultAuthority: false,
    ownsRefereeIdentity: false,
    usesLegacyTokenAuthority: false,
    usesLocalStorageFallback: false,
    usesInMemoryProductionFallback: false,
  });
}

/**
 * @param {{
 *   targets?: string[],
 *   instructions?: object,
 * }} [options]
 */
export function buildAcceptedOnlyPropagation(options = {}) {
  return assertResultPropagationPayload({
    propagateOnlyIfAccepted: true,
    targets: options.targets || [
      "standings",
      "bracket",
      "qualification",
      "aggregate",
    ],
    instructions: {
      source: "CORE-17 accepted active result only",
      adapterMustNotAccept: true,
      adapterMustNotMutateScore: true,
      ...(options.instructions || {}),
    },
  });
}
