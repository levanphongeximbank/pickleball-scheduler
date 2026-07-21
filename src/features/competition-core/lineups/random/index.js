/**
 * CORE-06 Phase 1D — deterministic random selection surface.
 */

export {
  LINEUP_RANDOM_ALGORITHM,
  hashStringToUint32,
  createMulberry32,
  createRngFromMaterial,
  deterministicShuffle,
} from "./algorithm.js";

export {
  CANONICAL_SEED_FIELD_SEP,
  CANONICAL_SEED_FIELDS,
  normalizeSeedPart,
  normalizeSeed,
  composeCanonicalSeed,
} from "./seed.js";

export {
  canonicalizeJsonValue,
  serializeCanonical,
  fingerprintValue,
  fingerprintSeed,
  fingerprintInput,
  fingerprintSelection,
} from "./fingerprint.js";

export {
  compareCanonicalStrings,
  normalizeRosterCandidates,
  normalizeSlotTemplate,
} from "./candidates.js";

export { selectLineupDeterministic } from "./selectLineup.js";
