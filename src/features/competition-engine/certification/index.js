/**
 * E2E-07 End-to-End Certification public barrel.
 */

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
} from "./constants.js";

export {
  CertificationError,
  isCertificationError,
  failCertification,
  normalizeCertificationError,
} from "./errors.js";

export {
  stableStringify,
  computeCertificationFingerprint,
  deepFreeze,
  clonePlain,
  snapshotInput,
  isNonEmptyString,
  stripForbiddenKeys,
} from "./fingerprint.js";

export {
  createIndividualPoolKnockoutScenarioFixture,
  E2E07_PLAYER_IDS,
} from "./fixtures/individualPoolKnockoutScenario.js";

export { createCertificationRuntimePorts } from "./ports/createCertificationRuntimePorts.js";

export { runStructuralCertification } from "./structural/runStructuralCertification.js";
export { runHappyPathCertification } from "./scenarios/runHappyPathCertification.js";
export { runFailClosedCertification } from "./scenarios/runFailClosedCertification.js";
export { runRecoveryReplayCertification } from "./scenarios/runRecoveryReplayCertification.js";
export { runPublicPrivacyCertification } from "./scenarios/runPublicPrivacyCertification.js";
export { runGovernanceCertification } from "./scenarios/runGovernanceCertification.js";
export { runSuspensionCancellationArchiveCertification } from "./scenarios/runSuspensionCancellationArchiveCertification.js";

export { GOV08_MVP_LOCAL_BUDGETS } from "./benchmark/gov08Budgets.js";
export { runGov08PerformanceBenchmark } from "./benchmark/runGov08PerformanceBenchmark.js";

export {
  buildCapabilityTraceability,
  CAPABILITY_TRACEABILITY_STATUS,
  CAPABILITY_MAP,
} from "./capability/buildCapabilityTraceability.js";

export {
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
} from "./evidence/buildEvidenceDocuments.js";

export {
  createCompetitionEndToEndCertificationHarness,
} from "./createCompetitionEndToEndCertificationHarness.js";

export { runCompetitionEndToEndCertification } from "./runCompetitionEndToEndCertification.js";
