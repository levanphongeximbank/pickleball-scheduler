/**
 * E2E-07 certification operations ownership barrel (re-export only).
 */

export {
  COMPETITION_ENGINE_END_TO_END_CERTIFICATION,
  createCompetitionEndToEndCertificationHarness,
  runCompetitionEndToEndCertification,
  runStructuralCertification,
  runHappyPathCertification,
  runFailClosedCertification,
  runRecoveryReplayCertification,
  runPublicPrivacyCertification,
  runGovernanceCertification,
  runSuspensionCancellationArchiveCertification,
  runGov08PerformanceBenchmark,
  buildCapabilityTraceability,
  buildEvidenceDocuments,
} from "../../certification/index.js";
