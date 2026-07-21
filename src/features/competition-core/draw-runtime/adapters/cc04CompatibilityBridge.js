/**
 * CORE-08 Phase 1B — Target E: CC-04 compatibility bridge (facade helper).
 * Does not modify competition-core/draw/**.
 * Does not rewire evaluateCanonicalDraw.
 * Accepts plain CC-04-shaped fixtures and optionally delegates to Phase 3H.
 */

import { DRAW_MODE } from "../enums/drawModes.js";
import {
  DRAW_CERTIFICATION_ERROR_CODE,
  createDrawCertificationError,
  createDrawCertificationOk,
} from "./certificationErrors.js";
import { mapLegacyModeToPhase3h } from "./modeMapping.js";
import { runCertificationResolve } from "./runCertificationResolve.js";

export const CC04_COMPAT_BRIDGE_ID = "CORE08_CC04_COMPAT_BRIDGE";

export const CC04_BRIDGE_POLICY = Object.freeze({
  REMAIN_AS_FACADE: "REMAIN_AS_FACADE",
  DELEGATE_TO_PHASE3H: "DELEGATE_TO_PHASE3H",
  BYPASS_WITH_BOUNDED_ADAPTER: "BYPASS_WITH_BOUNDED_ADAPTER",
});

/**
 * Documentary + executable bridge decision for a CC-04-shaped payload.
 *
 * @param {object} input
 * @param {'facade'|'delegate'} [input.bridgeMode] default facade (no resolve)
 * @param {string} [input.canonicalDrawMode] CC-04 mode string (snake/open/...)
 * @param {string} [input.legacyMode]
 */
export async function runCc04CompatibilityBridge(input = {}, resolverOptions = {}) {
  const bridgeMode = input.bridgeMode === "delegate" ? "delegate" : "facade";

  const legacyMode =
    input.legacyMode ||
    input.canonicalDrawMode ||
    input.mode ||
    input.drawMode ||
    "";

  const mapping = mapLegacyModeToPhase3h(legacyMode, {
    allowConditional: true,
    explicitPhase3hMode: input.phase3hMode || null,
  });

  if (bridgeMode === "facade") {
    if (mapping.ok === false) {
      return {
        ...mapping,
        bridgePolicy: CC04_BRIDGE_POLICY.REMAIN_AS_FACADE,
        evaluateCanonicalDrawRewired: false,
        calledPhase3h: false,
      };
    }
    return createDrawCertificationOk({
      target: "E_CC04_COMPATIBILITY_BRIDGE",
      parity: "STRUCTURAL_PARITY",
      legacyMode: mapping.legacyMode,
      phase3hMode: mapping.phase3hMode,
      mappingStatus: mapping.status,
      request: null,
      canonical: null,
      legacy: {
        bridgePolicy: CC04_BRIDGE_POLICY.REMAIN_AS_FACADE,
        note:
          "CC-04 evaluateCanonicalDraw remains legacy-executor facade until Integrator Wave. No production rewiring in Phase 1B.",
      },
      acceptedDifferences: [
        "Facade mode does not execute Phase 3H.",
        "CC-04 APIs remain untouched and available.",
      ],
      unsupportedBehavior: [
        "Automatic delegation from evaluateCanonicalDraw (Integrator-owned)",
      ],
      diagnostics: {
        calledPhase3h: false,
        evaluateCanonicalDrawRewired: false,
        bridgePolicy: CC04_BRIDGE_POLICY.REMAIN_AS_FACADE,
        modeConditions: mapping.conditions,
      },
    });
  }

  // delegate mode — bounded adapter bypasses CC-04 executor and calls Phase 3H
  if (mapping.ok === false) {
    return mapping;
  }

  if (!Array.isArray(input.entries) && !Array.isArray(input.candidates) && !Array.isArray(input.teams)) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
      "CC-04 delegate bridge requires entries, teams, or candidates",
      {}
    );
  }

  const result = await runCertificationResolve(
    {
      ...input,
      legacyMode: mapping.legacyMode,
      drawMode: mapping.phase3hMode || DRAW_MODE.SNAKE_GROUPS,
      allowConditionalMode: true,
    },
    {
      target: "E_CC04_COMPATIBILITY_BRIDGE",
      parity: "STRUCTURAL_PARITY",
      resolverOptions,
      namePrefix: input.namePrefix || "Bảng ",
      acceptedDifferences: [
        "Delegate path bypasses CC-04 evaluateCanonicalDraw legacy executor.",
        "CC-04 strategy catalog / shadow trace are not produced here.",
      ],
      unsupportedBehavior: [
        "In-place modification of draw/adapters/drawRuntimeAdapter.js",
        "Feature-flag DRAW_V2 cutover",
      ],
    }
  );

  if (result.ok) {
    result.diagnostics = {
      ...result.diagnostics,
      bridgePolicy: CC04_BRIDGE_POLICY.BYPASS_WITH_BOUNDED_ADAPTER,
      evaluateCanonicalDrawRewired: false,
    };
  }
  return result;
}
