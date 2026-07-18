/**
 * Validation helpers — fail-safe, never throw for business-invalid input.
 */

import { assertExecutionContextShape } from "../contracts/executionContext.js";
import { createFeatureFlagSnapshot } from "../contracts/featureFlagSnapshot.js";
import { assertRuntimeOverrideShape } from "../contracts/runtimeOverrides.js";
import { isPlainObject } from "../contracts/jsonSafe.js";
import { createRuntimeDiagnostic, DIAGNOSTIC_SEVERITY } from "../contracts/decisionDiagnostics.js";
import { RUNTIME_DECISION_CODE } from "../constants/runtimeDecisionCodes.js";

/**
 * @param {unknown} context
 * @returns {{ ok: boolean, diagnostics: import('../contracts/decisionDiagnostics.js').RuntimeDiagnostic[] }}
 */
export function validateExecutionContext(context) {
  const { ok, errors } = assertExecutionContextShape(context);
  const diagnostics = errors.map((message) =>
    createRuntimeDiagnostic({
      code: RUNTIME_DECISION_CODE.INVALID_CONTEXT,
      severity: DIAGNOSTIC_SEVERITY.ERROR,
      path: "executionContext",
      message,
    })
  );
  return { ok, diagnostics };
}

/**
 * @param {unknown} snapshot
 * @returns {{ ok: boolean, snapshot: ReturnType<typeof createFeatureFlagSnapshot>, diagnostics: import('../contracts/decisionDiagnostics.js').RuntimeDiagnostic[] }}
 */
export function validateFeatureFlagSnapshot(snapshot) {
  const diagnostics = [];
  if (snapshot == null) {
    return {
      ok: true,
      snapshot: createFeatureFlagSnapshot(),
      diagnostics,
    };
  }
  if (!isPlainObject(snapshot)) {
    diagnostics.push(
      createRuntimeDiagnostic({
        code: RUNTIME_DECISION_CODE.INVALID_FLAG_SNAPSHOT,
        severity: DIAGNOSTIC_SEVERITY.ERROR,
        path: "featureFlagSnapshot",
        message: "featureFlagSnapshot must be a plain object",
      })
    );
    return {
      ok: false,
      snapshot: createFeatureFlagSnapshot(),
      diagnostics,
    };
  }
  if (snapshot.shadow && typeof snapshot.shadow.samplingRate === "number") {
    if (snapshot.shadow.samplingRate < 0 || snapshot.shadow.samplingRate > 1) {
      diagnostics.push(
        createRuntimeDiagnostic({
          code: RUNTIME_DECISION_CODE.INVALID_FLAG_SNAPSHOT,
          severity: DIAGNOSTIC_SEVERITY.WARNING,
          path: "featureFlagSnapshot.shadow.samplingRate",
          message: "samplingRate should be between 0 and 1",
        })
      );
    }
  }
  return {
    ok: diagnostics.every((d) => d.severity !== DIAGNOSTIC_SEVERITY.ERROR),
    snapshot: createFeatureFlagSnapshot(snapshot),
    diagnostics,
  };
}

/**
 * @param {unknown} overrides
 * @returns {{ ok: boolean, overrides: object[], diagnostics: import('../contracts/decisionDiagnostics.js').RuntimeDiagnostic[] }}
 */
export function validateRuntimeOverrides(overrides) {
  const diagnostics = [];
  if (overrides == null) {
    return { ok: true, overrides: [], diagnostics };
  }
  if (!Array.isArray(overrides)) {
    diagnostics.push(
      createRuntimeDiagnostic({
        code: RUNTIME_DECISION_CODE.INVALID_OVERRIDE,
        severity: DIAGNOSTIC_SEVERITY.ERROR,
        path: "overrides",
        message: "overrides must be an array when provided",
      })
    );
    return { ok: false, overrides: [], diagnostics };
  }
  const normalized = [];
  for (let i = 0; i < overrides.length; i += 1) {
    const item = overrides[i];
    const { ok, errors } = assertRuntimeOverrideShape(item);
    if (!ok) {
      for (const message of errors) {
        diagnostics.push(
          createRuntimeDiagnostic({
            code: RUNTIME_DECISION_CODE.INVALID_OVERRIDE,
            severity: DIAGNOSTIC_SEVERITY.ERROR,
            path: `overrides[${i}]`,
            message,
          })
        );
      }
      continue;
    }
    normalized.push(item);
  }
  return {
    ok: diagnostics.every((d) => d.severity !== DIAGNOSTIC_SEVERITY.ERROR),
    overrides: normalized,
    diagnostics,
  };
}
