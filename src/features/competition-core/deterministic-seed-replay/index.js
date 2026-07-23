/**
 * CORE-21 Deterministic Seed & Replay — public capability surface (Phase 1B–1D).
 *
 * Ownership boundary (what CORE-21 owns):
 * - Canonical seed identity / normalize / compose
 * - Versioned seeded PRNG contract (Mulberry32)
 * - Deterministic ordering primitives + identity tie-break helpers
 * - Stable serialization + fingerprint primitives
 * - Replay input / context / verification / mismatch evidence
 * - Typed DETERMINISTIC_SEED_REPLAY_* errors
 *
 * Ownership boundary (what CORE-21 does NOT own):
 * - Seeding ranking / seed-number rules (CORE-07)
 * - Draw / group placement algorithms (CORE-08)
 * - Match structure generators (CORE-09)
 * - Optimizer objectives / search (CORE-10)
 * - Schedule placement rules (CORE-11)
 * - Rule-set content (CORE-01)
 * - Audit persistence (CORE-20)
 * - Workflow orchestration (CORE-19)
 * - Import transport (CORE-22) / recovery (CORE-23) / UI
 * - Root competition-core barrel re-exports (integrator-owned)
 *
 * Deterministic input requirement:
 * - Callers supply seeds, pinned domain time (when needed), and fingerprints.
 * - Kernel never invents ambient Math.random, Date.now, or random identities.
 */

export {
  CORE21_ENGINE_ID,
  CORE21_ENGINE_VERSION,
  CORE21_CONTRACT_ID,
  CORE21_SCHEMA_VERSION,
  CORE21_SEED_ALGORITHM_VERSION,
  CORE21_PRNG_VERSION,
  CORE21_SERIALIZATION_VERSION,
  CORE21_FINGERPRINT_VERSION,
  CORE21_COMPARATOR_VERSION,
  CORE21_REPLAY_CONTRACT_VERSION,
  CANONICAL_SEED_FIELD_SEP,
  CANONICAL_SEED_FIELDS,
  NULLS_POLICY,
  EXECUTION_MODE,
  EXECUTION_MODE_VALUES,
  REPLAY_MISMATCH_CATEGORY,
  REPLAY_MISMATCH_CATEGORY_VALUES,
  REPLAY_FORBIDDEN_FIELDS,
  CORE21_SOURCE,
} from "./constants.js";

export {
  DETERMINISTIC_SEED_REPLAY_ERROR_CODE,
  DETERMINISTIC_SEED_REPLAY_ERROR_CODE_VALUES,
  isDeterministicSeedReplayErrorCode,
  DeterministicSeedReplayError,
  isDeterministicSeedReplayError,
  createDeterministicSeedReplayError,
} from "./errors/index.js";

export {
  normalizeSeedPart,
  normalizeSeed,
  composeCanonicalSeed,
  createSeedIdentity,
} from "./seed/index.js";

export { createSeededRandom } from "./random/index.js";

export {
  compareStableString,
  compareStableId,
  compareStableNumber,
  compareNullable,
  compareKeyTuple,
  sortStableIds,
  sortedObjectKeys,
} from "./ordering/index.js";

export {
  isPlainObject,
  deepFreezeCanonical,
  canonicalizeJsonValue,
  serializeCanonical,
} from "./serialize/index.js";

export {
  hashStringToUint32,
  fingerprintValue,
  fingerprintAccepted,
} from "./fingerprint/index.js";

export {
  createReplayInput,
  createReplayContext,
  createReplayMismatch,
  createReplayEvidence,
} from "./contracts/index.js";

export { verifyReplay } from "./replay/index.js";
