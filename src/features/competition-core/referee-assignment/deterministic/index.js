export {
  compareStableString,
  compareStableId,
  sortStableIds,
  sortedObjectKeys,
} from "./compare.js";

export {
  isPlainObject,
  deepFreezeCanonical,
  freezePlainObject,
  assertCanonicalPlainValue,
} from "./canonicalize.js";

export {
  normalizeStableId,
  normalizeOptionalStableId,
  normalizeStableIdArray,
  normalizePreferenceTags,
} from "./normalize.js";

export {
  prepareFingerprintMaterial,
  prepareCanonicalObjectProjection,
} from "./fingerprintPrep.js";

export {
  CORE13_DIGEST_VERSION,
  CORE13_FINGERPRINT_VERSION,
  CORE13_DIGEST_DOMAIN,
  CORE13_ID_PREFIX,
  CORE13_ID_DIGEST_HEX_LEN,
  sha256HexUtf8,
  canonicalizeJsonValue,
  serializeCanonical,
  digestCanonical,
  fingerprintValue,
  buildNamespacedId,
  buildAssignmentId,
  buildPlanId,
  buildReplacementId,
  seedExplorationKey,
  normalizePlannerSeed,
} from "./fingerprint.js";
