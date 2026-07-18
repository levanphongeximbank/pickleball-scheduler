export {
  MAPPING_DIAGNOSTIC_CODE,
  MAPPING_DIAGNOSTIC_SEVERITY,
  createMappingDiagnostic,
  hasMappingErrors,
} from "./diagnostics.js";

export {
  cloneSourceSnapshot,
  createMappingSuccess,
  createMappingFailure,
  finalizeMappingResult,
  assertSourceUnchanged,
} from "./mappingResult.js";

export {
  PARITY_CLASSIFICATION,
  createParityFinding,
  summarizeParityFindings,
  compareIdentityParity,
} from "./parity.js";

export { runShadowMapping, runSingleShadowMap } from "./shadowRunner.js";

export { resolvePersonReference, buildPlayerSnapshot } from "./personReference.js";
