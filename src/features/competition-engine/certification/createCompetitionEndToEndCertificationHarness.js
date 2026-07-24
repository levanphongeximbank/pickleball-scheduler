/**
 * E2E-07 End-to-End Certification harness factory.
 */

import {
  CERTIFICATION_LEVEL,
  CERTIFICATION_VERDICT,
  E2E07_CERTIFICATION_VERSION,
  E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED,
} from "./constants.js";
import { createIndividualPoolKnockoutScenarioFixture } from "./fixtures/individualPoolKnockoutScenario.js";
import { computeCertificationFingerprint, deepFreeze, clonePlain } from "./fingerprint.js";
import { runStructuralCertification } from "./structural/runStructuralCertification.js";
import { runHappyPathCertification } from "./scenarios/runHappyPathCertification.js";
import { runFailClosedCertification } from "./scenarios/runFailClosedCertification.js";
import { runRecoveryReplayCertification } from "./scenarios/runRecoveryReplayCertification.js";
import { runPublicPrivacyCertification } from "./scenarios/runPublicPrivacyCertification.js";
import { runGovernanceCertification } from "./scenarios/runGovernanceCertification.js";
import { runSuspensionCancellationArchiveCertification } from "./scenarios/runSuspensionCancellationArchiveCertification.js";
import { runGov08PerformanceBenchmark } from "./benchmark/runGov08PerformanceBenchmark.js";
import { buildCapabilityTraceability } from "./capability/buildCapabilityTraceability.js";
import {
  buildEvidenceDocuments,
  buildFinalCertificationManifest,
} from "./evidence/buildEvidenceDocuments.js";

/**
 * @param {object} [deps]
 */
export function createCompetitionEndToEndCertificationHarness(deps = {}) {
  const defaults = {
    sourceCommit: deps.sourceCommit ?? null,
    generatedAt: deps.generatedAt ?? null,
    fixture:
      deps.fixture ||
      createIndividualPoolKnockoutScenarioFixture(deps.fixtureOverrides),
  };

  return Object.freeze({
    runStructuralCertification(input = {}) {
      return runStructuralCertification({ ...defaults, ...input });
    },
    runHappyPathCertification(input = {}) {
      return runHappyPathCertification({ ...defaults, ...input });
    },
    runFailClosedCertification(input = {}) {
      return runFailClosedCertification({ ...defaults, ...input });
    },
    runRecoveryReplayCertification(input = {}) {
      return runRecoveryReplayCertification({ ...defaults, ...input });
    },
    runPublicPrivacyCertification(input = {}) {
      return runPublicPrivacyCertification({ ...defaults, ...input });
    },
    runGovernanceCertification(input = {}) {
      return runGovernanceCertification({ ...defaults, ...input });
    },
    runSuspensionCancellationArchiveCertification(input = {}) {
      return runSuspensionCancellationArchiveCertification({ ...defaults, ...input });
    },
    runGov08PerformanceBenchmark(input = {}) {
      return runGov08PerformanceBenchmark({ ...defaults, ...input });
    },
    buildCapabilityTraceability(input = {}) {
      return buildCapabilityTraceability(input);
    },
    buildEvidenceDocuments(results, meta = {}) {
      return buildEvidenceDocuments(results, {
        sourceCommit: defaults.sourceCommit,
        generatedAt: defaults.generatedAt,
        scenarioId: defaults.fixture.scenarioId,
        ...meta,
      });
    },
    async runFullCertification(input = {}) {
      const fixture = input.fixture || defaults.fixture;
      const meta = {
        sourceCommit: input.sourceCommit ?? defaults.sourceCommit,
        generatedAt: input.generatedAt ?? defaults.generatedAt,
        scenarioId: fixture.scenarioId,
      };

      const structural = runStructuralCertification(meta);
      const happyPath = await runHappyPathCertification({ fixture, ...meta });
      const failClosed = await runFailClosedCertification({ fixture, ...meta });
      const recoveryReplay = await runRecoveryReplayCertification({ fixture, ...meta });
      const publicPrivacy = await runPublicPrivacyCertification({ fixture, ...meta });
      const governance = await runGovernanceCertification({ fixture, ...meta });
      const suspensionArchive = await runSuspensionCancellationArchiveCertification({
        fixture,
        ...meta,
      });
      const performance = await runGov08PerformanceBenchmark({ fixture, ...meta });
      const capability = buildCapabilityTraceability({
        gov08Passed: performance.ok,
      });

      /** @type {object[]} */
      const checks = [
        ...structural.checks,
        ...happyPath.checks,
        ...failClosed.checks,
        ...recoveryReplay.checks,
        ...publicPrivacy.checks,
        ...governance.checks,
        ...suspensionArchive.checks,
        ...performance.checks,
        ...capability.checks,
      ];

      /** @type {object[]} */
      const blockers = [
        ...structural.blockers,
        ...happyPath.blockers,
        ...failClosed.blockers,
        ...recoveryReplay.blockers,
        ...publicPrivacy.blockers,
        ...governance.blockers,
        ...suspensionArchive.blockers,
      ].filter(Boolean);

      if (!performance.ok) {
        blockers.push(
          Object.freeze({
            code: "E2E07_BENCHMARK_REGRESSION",
            message: "GOV-08 local benchmark gate failed",
          })
        );
      }
      if (!capability.ok) {
        blockers.push(
          Object.freeze({
            code: "E2E07_CAPABILITY_GAP",
            message: "Capability traceability has blocked entries",
          })
        );
      }

      const deferredChecks = Object.freeze([
        Object.freeze({
          id: "remote-staging-certification",
          level: CERTIFICATION_LEVEL.REMOTE,
          ownerMarker: E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED,
          status: "DEFERRED",
        }),
        Object.freeze({
          id: "production-runtime-wiring",
          level: CERTIFICATION_LEVEL.REMOTE,
          status: "DEFERRED",
        }),
      ]);

      const allLocalOk =
        structural.ok &&
        happyPath.ok &&
        failClosed.ok &&
        recoveryReplay.ok &&
        publicPrivacy.ok &&
        governance.ok &&
        suspensionArchive.ok &&
        performance.ok &&
        capability.ok;

      const finalVerdict = allLocalOk
        ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP
        : blockers.length > 0
          ? CERTIFICATION_VERDICT.BLOCKED
          : CERTIFICATION_VERDICT.DEGRADED;

      const baseDocs = buildEvidenceDocuments(
        {
          structural,
          happyPath,
          failClosed,
          recoveryReplay,
          publicPrivacy,
          governance,
          performance,
          full: {},
        },
        meta
      );

      const deterministicFingerprint = computeCertificationFingerprint({
        kind: "full-certification",
        finalVerdict,
        checks: checks.map((c) => ({ id: c.id, ok: c.ok })),
        structural: structural.fingerprint,
        happyPath: happyPath.deterministicFingerprint,
        failClosed: failClosed.deterministicFingerprint,
        recoveryReplay: recoveryReplay.deterministicFingerprint,
        publicPrivacy: publicPrivacy.deterministicFingerprint,
        governance: governance.deterministicFingerprint,
        suspensionArchive: suspensionArchive.deterministicFingerprint,
        performance: performance.deterministicFingerprint,
        capability: capability.deterministicFingerprint,
      });

      const evidenceDocs = deepFreeze({
        ...clonePlain(baseDocs),
        finalManifest: buildFinalCertificationManifest(
          {
            certificationId: fixture.certificationId,
            deterministicFingerprint,
            finalVerdict,
            deferredChecks,
            evidence: baseDocs,
            capabilitySummary: capability.traceability.summary,
            performanceGatePassed: performance.ok,
          },
          meta
        ),
      });

      return deepFreeze({
        certificationId: fixture.certificationId,
        certificationVersion: E2E07_CERTIFICATION_VERSION,
        tenantId: fixture.tenantId,
        competitionId: fixture.competitionId,
        scenarioId: fixture.scenarioId,
        formatId: fixture.formatId,
        templateId: fixture.templateId,
        startedFromRevision: 0,
        finalRevision: happyPath.evidence?.finalRevision ?? null,
        stages: happyPath.stages,
        checks: Object.freeze(checks),
        evidence: evidenceDocs,
        warnings: Object.freeze([]),
        blockers: Object.freeze(blockers),
        deferredChecks,
        performanceResults: performance.performanceResults,
        capabilityTraceability: capability.traceability,
        deterministicFingerprint,
        finalVerdict,
        results: Object.freeze({
          structural,
          happyPath,
          failClosed,
          recoveryReplay,
          publicPrivacy,
          governance,
          suspensionArchive,
          performance,
          capability,
        }),
      });
    },
  });
}
