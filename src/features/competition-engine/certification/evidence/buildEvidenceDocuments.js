/**
 * Deterministic evidence document builders for E2E-07 certification pack.
 */

import {
  CERTIFICATION_VERDICT,
  E2E07_CERTIFICATION_VERSION,
  E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED,
} from "../constants.js";
import { deepFreeze, stripForbiddenKeys } from "../fingerprint.js";

/**
 * @param {object} params
 */
function baseEvidenceDoc(params) {
  return deepFreeze(
    stripForbiddenKeys({
      schemaVersion: E2E07_CERTIFICATION_VERSION,
      generatedAt: params.generatedAt ?? null,
      sourceCommit: params.sourceCommit ?? "TBD",
      scenarioId: params.scenarioId ?? "individual-pool-knockout-e2e07",
      certificationVersion: E2E07_CERTIFICATION_VERSION,
      testReferences: Object.freeze(params.testReferences || []),
      fingerprint: params.fingerprint ?? "e2e07:PLACEHOLDER",
      verdict: params.verdict ?? CERTIFICATION_VERDICT.BLOCKED,
      deferredChecks: Object.freeze(params.deferredChecks || []),
      payload: params.payload ?? {},
    })
  );
}

/**
 * @param {object} result
 * @param {object} [meta]
 */
export function buildStructuralCertificationEvidence(result, meta = {}) {
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["competition-engine-e2e-07-end-to-end-certification.test.js"],
    fingerprint: result.fingerprint,
    verdict: result.ok ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP : CERTIFICATION_VERDICT.BLOCKED,
    payload: { checks: result.checks, evidence: result.evidence },
  });
}

export function buildHappyPathCertificationEvidence(result, meta = {}) {
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["competition-engine-e2e-07-end-to-end-certification.test.js"],
    fingerprint: result.deterministicFingerprint,
    verdict: result.verdict,
    payload: {
      stages: result.stages,
      evidence: result.evidence,
      blockers: result.blockers,
    },
  });
}

export function buildFailClosedCertificationEvidence(result, meta = {}) {
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["competition-engine-e2e-07-end-to-end-certification.test.js"],
    fingerprint: result.deterministicFingerprint,
    verdict: result.ok ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP : CERTIFICATION_VERDICT.BLOCKED,
    payload: { matrix: result.matrix, evidence: result.evidence },
  });
}

export function buildRecoveryReplayCertificationEvidence(result, meta = {}) {
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["competition-engine-e2e-07-end-to-end-certification.test.js"],
    fingerprint: result.deterministicFingerprint,
    verdict: result.ok ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP : CERTIFICATION_VERDICT.BLOCKED,
    payload: { checks: result.checks, evidence: result.evidence },
  });
}

export function buildPublicPrivacyCertificationEvidence(result, meta = {}) {
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["competition-engine-e2e-07-end-to-end-certification.test.js"],
    fingerprint: result.deterministicFingerprint,
    verdict: result.ok ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP : CERTIFICATION_VERDICT.BLOCKED,
    payload: { checks: result.checks, evidence: result.evidence },
  });
}

export function buildGovernanceCertificationEvidence(result, meta = {}) {
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["competition-engine-e2e-07-end-to-end-certification.test.js"],
    fingerprint: result.deterministicFingerprint,
    verdict: result.ok ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP : CERTIFICATION_VERDICT.BLOCKED,
    payload: { checks: result.checks, evidence: result.evidence },
  });
}

export function buildPerformanceCertificationEvidence(result, meta = {}) {
  const perf = result.performanceResults || {};
  // Wall-clock medians stay out of committed evidence; keep gate metadata only.
  const sanitizedSizes = Object.freeze(
    (perf.sizes || []).map((row) =>
      Object.freeze({
        size: row.size,
        measuredRuns: row.measuredRuns,
        poolWithinBudget: row.poolWithinBudget,
        knockoutWithinBudget: row.knockoutWithinBudget,
        fullWithinBudget: row.fullWithinBudget,
        poolCompositionMedianMs: null,
        knockoutCompositionMedianMs: null,
        fullCertificationScenarioMedianMs: null,
      })
    )
  );
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["competition-engine-e2e-07-gov08-benchmark.test.js"],
    fingerprint: result.deterministicFingerprint,
    verdict: result.ok ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP : CERTIFICATION_VERDICT.BLOCKED,
    payload: {
      performanceResults: Object.freeze({
        budgetVersion: perf.budgetVersion,
        budgetClass: perf.budgetClass,
        productionSlaClaimForbidden: perf.productionSlaClaimForbidden,
        environment: Object.freeze({
          nodeVersion: null,
          platform: null,
        }),
        sizes: sanitizedSizes,
        regressionDetected: perf.regressionDetected,
        gatePassed: perf.gatePassed,
      }),
      checks: result.checks,
    },
  });
}

export function buildDeferredRemoteCertificationEvidence(meta = {}) {
  return baseEvidenceDoc({
    ...meta,
    testReferences: ["docs/competition-engine/e2e-07/09_REMOTE_STAGING_CERTIFICATION_RUNBOOK.md"],
    fingerprint: "e2e07:deferred-remote-v1",
    verdict: CERTIFICATION_VERDICT.DEGRADED,
    deferredChecks: Object.freeze([
      Object.freeze({
        id: "remote-staging-certification",
        ownerMarker: E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED,
        status: "DEFERRED",
        note: "Not executed in local MVP certification harness",
      }),
      Object.freeze({
        id: "production-runtime-wiring",
        status: "DEFERRED",
        note: "INT-01/02/05/09 production adapters require Owner Go",
      }),
    ]),
    payload: Object.freeze({
      remoteExecutionForbiddenInHarness: true,
    }),
  });
}

/**
 * @param {object} pack
 * @param {object} [meta]
 */
export function buildFinalCertificationManifest(pack, meta = {}) {
  const evidence = pack.evidence || {};
  const documentIndex = Object.freeze(
    [
      ["structural-certification.json", evidence.structural],
      ["happy-path-certification.json", evidence.happyPath],
      ["fail-closed-certification.json", evidence.failClosed],
      ["recovery-replay-certification.json", evidence.recoveryReplay],
      ["public-privacy-certification.json", evidence.publicPrivacy],
      ["governance-certification.json", evidence.governance],
      ["performance-certification.json", evidence.performance],
      ["deferred-remote-certification.json", evidence.deferredRemote],
    ].map(([name, doc]) =>
      Object.freeze({
        document: name,
        fingerprint: doc?.fingerprint ?? null,
        verdict: doc?.verdict ?? null,
      })
    )
  );

  return baseEvidenceDoc({
    ...meta,
    testReferences: Object.freeze([
      "competition-engine-e2e-07-end-to-end-certification.test.js",
      "competition-engine-e2e-07-gov08-benchmark.test.js",
    ]),
    fingerprint: pack.deterministicFingerprint,
    verdict: pack.finalVerdict,
    deferredChecks: pack.deferredChecks,
    payload: Object.freeze({
      certificationId: pack.certificationId,
      documents: Object.freeze(documentIndex.map((d) => d.document)),
      documentIndex,
      capabilitySummary: pack.capabilitySummary ?? null,
      performanceGatePassed: pack.performanceGatePassed ?? null,
    }),
  });
}

/**
 * @param {object} results
 * @param {object} [meta]
 */
export function buildEvidenceDocuments(results, meta = {}) {
  return deepFreeze({
    structural: buildStructuralCertificationEvidence(results.structural, meta),
    happyPath: buildHappyPathCertificationEvidence(results.happyPath, meta),
    failClosed: buildFailClosedCertificationEvidence(results.failClosed, meta),
    recoveryReplay: buildRecoveryReplayCertificationEvidence(results.recoveryReplay, meta),
    publicPrivacy: buildPublicPrivacyCertificationEvidence(results.publicPrivacy, meta),
    governance: buildGovernanceCertificationEvidence(results.governance, meta),
    performance: buildPerformanceCertificationEvidence(results.performance, meta),
    deferredRemote: buildDeferredRemoteCertificationEvidence(meta),
    finalManifest: buildFinalCertificationManifest(results.full || {}, meta),
  });
}
