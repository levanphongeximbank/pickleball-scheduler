/**
 * Competition Engine feature root — E2E integration + composition boundary.
 * Capability engines remain under competition-core / competition-management.
 */

export * from "./integration/index.js";
export * from "./templates/index.js";
export * from "./formats/index.js";
export * from "./composition/index.js";
export * from "./application/index.js";
export * from "./operations/index.js";
export * from "./presentation/index.js";

export {
  E2E07_CERTIFICATION_VERSION,
  E2E07_CERTIFICATION_PHASE,
  CERTIFICATION_LEVEL,
  CERTIFICATION_VERDICT,
  CERTIFICATION_STAGE,
  CERTIFICATION_STAGE_VALUES,
  CERTIFICATION_CHECK,
  CERTIFICATION_ERROR_CODE,
  CERTIFICATION_FORBIDDEN_KEYS,
  COMPETITION_ENGINE_END_TO_END_CERTIFICATION,
  E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED,
  CertificationError,
  isCertificationError,
  failCertification,
  normalizeCertificationError,
  computeCertificationFingerprint,
  createIndividualPoolKnockoutScenarioFixture,
  E2E07_PLAYER_IDS,
  createCertificationRuntimePorts,
  runStructuralCertification,
  runHappyPathCertification,
  runFailClosedCertification,
  runRecoveryReplayCertification,
  runPublicPrivacyCertification,
  runGovernanceCertification,
  runSuspensionCancellationArchiveCertification,
  GOV08_MVP_LOCAL_BUDGETS,
  runGov08PerformanceBenchmark,
  buildCapabilityTraceability,
  CAPABILITY_TRACEABILITY_STATUS,
  CAPABILITY_MAP,
  buildEvidenceDocuments,
  buildStructuralCertificationEvidence,
  buildHappyPathCertificationEvidence,
  buildFailClosedCertificationEvidence,
  buildRecoveryReplayCertificationEvidence,
  buildPublicPrivacyCertificationEvidence,
  buildGovernanceCertificationEvidence,
  buildPerformanceCertificationEvidence,
  buildDeferredRemoteCertificationEvidence,
  buildFinalCertificationManifest,
  createCompetitionEndToEndCertificationHarness,
  runCompetitionEndToEndCertification,
} from "./certification/index.js";