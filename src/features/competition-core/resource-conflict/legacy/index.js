/**
 * CORE-14 Phase 1F — legacy compatibility barrel.
 */

export {
  LEGACY_CC09_CONFLICT_CODE,
  LEGACY_CC09_CONFLICT_CODE_VALUES,
  LEGACY_CC09_UNMAPPED_WORKFLOW_CODES,
} from "./legacyConflictCodes.js";

export {
  mapLegacyConflictCodeToCore14,
  mapCore14FindingCodeToLegacy,
  mapLegacyConflictsToCore14,
  projectCore14FindingsToLegacy,
} from "./mapLegacyConflicts.js";
