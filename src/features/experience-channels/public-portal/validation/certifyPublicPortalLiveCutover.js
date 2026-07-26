/**
 * EC-06 — Certify Public Portal LIVE cutover readiness from the frozen matrix.
 * Pure validation — no network, retry, or adapter mutation.
 */

import { deepFreeze } from "../../contracts/shared.js";
import { PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION } from "../constants/liveCutoverClassifications.js";
import {
  listCertifiedLiveCutoverRows,
  listPublicPortalLiveCutoverMatrix,
} from "../certification/liveCutoverCertificationMatrix.js";

const C = PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION;

const GATE_KEYS = Object.freeze([
  "remotePublicSource",
  "noPrivateAuthOrTenant",
  "stableCanonicalAdapter",
  "errorNotEmptySuccess",
  "noMockFallbackOnLiveFail",
  "distinctPresentationStates",
  "noSensitivePayload",
  "noBusinessLogicInUi",
  "targetedTests",
  "clearOwnership",
  "productionReadyEvidence",
  "noEngineOrBackendContractChange",
]);

/**
 * @param {Readonly<{ classification: string, implementCutover: boolean, gates: Record<string, boolean> }>} row
 * @returns {string[]}
 */
function validateRowConsistency(row) {
  const issues = [];
  if (row.classification === C.CERTIFIED_LIVE_CUTOVER) {
    for (const key of GATE_KEYS) {
      if (row.gates[key] !== true) {
        issues.push(`${row.classification} requires gate ${key}=true`);
      }
    }
    if (row.implementCutover !== true) {
      issues.push("CERTIFIED_LIVE_CUTOVER requires implementCutover=true");
    }
  } else if (row.implementCutover === true) {
    issues.push(`${row.classification} cannot set implementCutover=true`);
  }
  return issues;
}

/**
 * @returns {Readonly<{
 *   ok: boolean,
 *   auditComplete: boolean,
 *   certifiedCutoverCount: number,
 *   verdict: string,
 *   classifications: Readonly<Record<string, number>>,
 *   issues: ReadonlyArray<string>,
 *   matrixSize: number,
 * }>}
 */
export function certifyPublicPortalLiveCutover() {
  const matrix = listPublicPortalLiveCutoverMatrix();
  const issues = [];
  /** @type {Record<string, number>} */
  const classifications = {};

  for (const row of matrix) {
    classifications[row.classification] = (classifications[row.classification] || 0) + 1;
    issues.push(...validateRowConsistency(row).map((msg) => `${row.id}: ${msg}`));
  }

  const certified = listCertifiedLiveCutoverRows();
  const certifiedCutoverCount = certified.length;
  const auditComplete = issues.length === 0;
  const verdict =
    !auditComplete
      ? "EC_06_BLOCKED_MATRIX_INCONSISTENT"
      : certifiedCutoverCount === 0
        ? "EC_06_AUDIT_COMPLETE_NO_CERTIFIED_CUTOVER"
        : "EC_06_CERTIFIED_CUTOVERS_AVAILABLE";

  return deepFreeze({
    ok: auditComplete,
    auditComplete,
    certifiedCutoverCount,
    verdict,
    classifications: deepFreeze(classifications),
    issues: deepFreeze(issues),
    matrixSize: matrix.length,
  });
}
