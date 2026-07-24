/**
 * E2E-07 certification presentation view-model.
 */

import { CERTIFICATION_VERDICT } from "../../certification/constants.js";

/**
 * @param {object} certificationResult
 * @returns {ReadonlyArray<{ id: string, title: string, available: boolean, detail: string }>}
 */
export function buildCertificationSections(certificationResult) {
  const r =
    certificationResult && typeof certificationResult === "object"
      ? certificationResult
      : {};

  const verdict = String(r.finalVerdict || CERTIFICATION_VERDICT.BLOCKED);
  const stageCount = Array.isArray(r.stages) ? r.stages.length : 0;
  const passedStages = Array.isArray(r.stages)
    ? r.stages.filter((s) => s.ok).length
    : 0;
  const checkCount = Array.isArray(r.checks) ? r.checks.length : 0;
  const passedChecks = Array.isArray(r.checks)
    ? r.checks.filter((c) => c.ok).length
    : 0;
  const blockerCount = Array.isArray(r.blockers) ? r.blockers.length : 0;
  const deferredCount = Array.isArray(r.deferredChecks) ? r.deferredChecks.length : 0;
  const perfGate = r.performanceResults?.gatePassed === true;

  return Object.freeze([
    Object.freeze({
      id: "overview",
      title: "Certification Overview",
      available: verdict === CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP,
      detail: `${r.certificationId || "-"} · ${verdict}`,
    }),
    Object.freeze({
      id: "stages",
      title: "Happy Path Stages",
      available: passedStages === stageCount && stageCount > 0,
      detail: `${passedStages}/${stageCount} stages passed`,
    }),
    Object.freeze({
      id: "checks",
      title: "Certification Checks",
      available: passedChecks === checkCount && checkCount > 0,
      detail: `${passedChecks}/${checkCount} checks passed`,
    }),
    Object.freeze({
      id: "evidence",
      title: "Evidence Pack",
      available: Boolean(r.evidence?.finalManifest),
      detail: r.deterministicFingerprint || "no fingerprint",
    }),
    Object.freeze({
      id: "performance",
      title: "GOV-08 Benchmark",
      available: perfGate,
      detail: perfGate ? "within MVP local budgets" : "benchmark gate not passed",
    }),
    Object.freeze({
      id: "deferred",
      title: "Deferred Remote Checks",
      available: deferredCount > 0,
      detail: `${deferredCount} deferred (not executed locally)`,
    }),
    Object.freeze({
      id: "verdict",
      title: "Final Verdict",
      available: blockerCount === 0,
      detail: `${verdict} · blockers=${blockerCount}`,
    }),
  ]);
}
