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
} from "./canonicalize.js";

export {
  hashStringToUint32,
  canonicalizeJsonValue,
  serializeCanonical,
  fingerprintValue,
  fingerprintAccepted,
  CORE10_FINGERPRINT_VERSION,
} from "./fingerprint.js";

export {
  normalizeSeed,
  createSeededRandom,
  CORE10_PRNG_VERSION,
} from "./seededRandom.js";
