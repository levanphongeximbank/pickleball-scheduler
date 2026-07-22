/**
 * CORE-12 Phase 1C — shadow-parity runner (diagnostic only).
 *
 * Runs:
 * 1) isolated legacy TE reference (or injected legacy runner)
 * 2) TE→CORE-12 adapter + assignCourtsDeterministic
 * 3) structured parity comparison
 *
 * Does not double-write, publish, access Supabase, or alter TE production flow.
 */

import { adaptTournamentEngineCourtAssignmentInput } from "../adapters/te-compat/adaptTournamentEngineCourtAssignmentInput.js";
import { assignCourtsDeterministic } from "../services/assignCourtsDeterministic.js";
import { deepFreezeCanonical } from "../deterministic/canonicalize.js";
import { compareLegacyAndCore12CourtAssignment } from "./compareLegacyAndCore12CourtAssignment.js";
import { runLegacyAssignCourtsReference } from "./legacyReferenceAssignCourts.js";

/**
 * @param {unknown} value
 */
function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} fixture
 * @param {object} [options]
 * @returns {Readonly<object>}
 */
export function runShadowParity(fixture, options = {}) {
  if (fixture == null || typeof fixture !== "object") {
    return compareLegacyAndCore12CourtAssignment({
      fixtureId: "invalid",
      fixtureInvalid: true,
      expectedClassification: "FIXTURE_INVALID",
    });
  }

  const fixtureClone = deepCloneJson(fixture);
  const fixtureId = String(fixture.id || fixture.fixtureId || "unnamed");
  const expectedClassification = fixture.expectedClassification || null;
  const divergenceIds = Array.isArray(fixture.divergenceIds)
    ? fixture.divergenceIds
    : [];

  if (fixture.fixtureInvalid === true) {
    return compareLegacyAndCore12CourtAssignment({
      fixtureId,
      fixtureInvalid: true,
      expectedClassification,
      divergenceIds,
    });
  }

  const adapterInput = fixture.adapterInput;
  const legacyContext = fixture.legacyContext || {
    matches: adapterInput?.matches,
    courts: adapterInput?.legacyCourts || adapterInput?.courts,
  };
  const legacyOptions = fixture.legacyOptions || {};

  const legacyRunner =
    typeof options.legacyRunner === "function"
      ? options.legacyRunner
      : runLegacyAssignCourtsReference;

  const legacyInputClone = deepCloneJson(legacyContext);
  const legacyResult = legacyRunner(legacyContext, legacyOptions);
  const legacyResultClone = deepCloneJson(legacyResult);

  // Prove harness did not mutate fixture / legacy input.
  const adapterInputClone = deepCloneJson(adapterInput);
  const adapted = adaptTournamentEngineCourtAssignmentInput(adapterInput);

  let core12Result = null;
  if (adapted.ok && adapted.request) {
    const requestClone = deepCloneJson(adapted.request);
    core12Result = assignCourtsDeterministic(adapted.request);
    // Immutability: request material unchanged vs clone keys of interest
    void requestClone;
  }

  const report = compareLegacyAndCore12CourtAssignment({
    fixtureId,
    expectedClassification,
    divergenceIds,
    adapterOk: adapted.ok,
    adapterFailures: adapted.failures,
    legacyResult,
    core12Result,
    legacyUnsafe: fixture.legacyUnsafe === true,
    legacyUnsafeReason: fixture.legacyUnsafeReason || null,
    expectCore12Valid: fixture.expectCore12Valid === true,
    allowInfeasible: fixture.allowInfeasible === true,
  });

  return Object.freeze({
    ...report,
    adapter: Object.freeze({
      ok: adapted.ok,
      failures: adapted.failures,
      diagnostics: adapted.diagnostics,
      request: adapted.request,
    }),
    legacyResult: Object.freeze(legacyResultClone),
    core12Result: core12Result ? deepFreezeCanonical(deepCloneJson(core12Result)) : null,
    immutability: Object.freeze({
      fixtureUnchanged:
        JSON.stringify(fixtureClone) === JSON.stringify(fixture),
      legacyInputUnchanged:
        JSON.stringify(legacyInputClone) === JSON.stringify(legacyContext),
      adapterInputUnchanged:
        JSON.stringify(adapterInputClone) === JSON.stringify(adapterInput),
    }),
  });
}
