export {
  validateCanonicalResourceKey,
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
  validateEventScopeIdentity,
  compareCanonicalResourceKeys,
} from "./CanonicalResourceKey.js";

export {
  validateResourceOccupancy,
  normalizeResourceOccupancy,
  createResourceOccupancy,
  createResourceOccupancyFromPartial,
} from "./ResourceOccupancy.js";

export {
  createOccupancyIndexKey,
  serializeOccupancyIndexKey,
  compareOccupancyIndexKeys,
  compareOccupancyIds,
} from "./OccupancyIndexKey.js";

export {
  resolveActivityIdentity,
  createLogicalAssignmentKeyV1,
  serializeLogicalAssignmentKeyV1,
  logicalAssignmentKeyIdentity,
  compareLogicalAssignmentKeys,
} from "./LogicalAssignmentKey.js";

export { evaluateDuplicateIntegrity } from "./duplicateIntegrity.js";

export { createInputDiagnostic } from "./InputDiagnostic.js";

export { createResourceFinding } from "./ResourceFinding.js";

export {
  createDetectionResult,
  createRejectedInvalidInputResult,
} from "./DetectionResult.js";
