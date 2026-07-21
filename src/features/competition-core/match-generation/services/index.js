export {
  buildLogicalMatchKey,
  isWellFormedLogicalMatchKey,
  parseLogicalMatchKey,
  encodeRequiredSegment,
  encodeOptionalSegment,
  LOGICAL_MATCH_KEY_VERSION,
} from "./buildLogicalMatchKey.js";

export {
  asciiCompare,
  sortMatchGenerationIssues,
} from "./asciiCompare.js";

export {
  hashStringToUint32,
  canonicalizeJsonValue,
  serializeCanonical,
  fingerprintValue,
  fingerprintGeneration,
  projectMatchPlanForFingerprint,
  fingerprintMatchPlan,
} from "./fingerprint.js";

export {
  validateDrawSnapshotForGeneration,
  validateDrawSnapshotNotMutated,
} from "./validateDrawSnapshot.js";

export {
  validateMatchGenerationRequest,
} from "./validateMatchGenerationRequest.js";

export {
  detectDependencyCycle,
  validateMatchPlanInvariants,
  assertMatchPlanValid,
} from "./validateMatchPlanInvariants.js";

export {
  rejectUnsupportedStrategy,
} from "./rejectUnsupportedStrategy.js";

export {
  DETERMINISM_POLICY,
  findForbiddenNondeterminismPatterns,
} from "./determinismPolicy.js";

export {
  deepFreezeCanonical,
  freezeMetadata,
} from "./canonicalFreeze.js";
