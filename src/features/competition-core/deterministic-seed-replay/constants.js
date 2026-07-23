/**
 * CORE-21 Deterministic Seed & Replay — capability identity + version locks.
 *
 * Version constants are part of the frozen contract. Changing any value is a
 * breaking change for PRNG streams, fingerprints, and replay digests.
 */

export const CORE21_ENGINE_ID = "competition-core.deterministic-seed-replay";
export const CORE21_ENGINE_VERSION = "1.0.0";

export const CORE21_CONTRACT_ID = "competition-core.deterministic-seed-replay";
export const CORE21_SCHEMA_VERSION = 1;

/** Seed identity / NFC normalize + compose algorithm. */
export const CORE21_SEED_ALGORITHM_VERSION = "CORE21_SEED_NFC_V1";

/** Seeded PRNG algorithm + material version (hashed into stream). */
export const CORE21_PRNG_VERSION = "CORE21_PRNG_MULBERRY32_V1";

/** Canonical JSON serialization contract. */
export const CORE21_SERIALIZATION_VERSION = "CORE21_SERIALIZATION_V1";

/** Fingerprint algorithm (FNV-1a 32-bit — identity hash, not security). */
export const CORE21_FINGERPRINT_VERSION = "CORE21_FINGERPRINT_FNV1A32_V1";

/** UTF-16 code-unit comparator (no localeCompare). */
export const CORE21_COMPARATOR_VERSION = "CORE21_COMPARATOR_UTF16_V1";

/** Replay input / context / verification contract. */
export const CORE21_REPLAY_CONTRACT_VERSION = "CORE21_REPLAY_V1";

/** Unit separator for composed seed material (CORE-06 pattern). */
export const CANONICAL_SEED_FIELD_SEP = "\u001f";

/**
 * Canonical compose field order (documented + tested).
 * ownerSeed is required and must be non-empty after NFC + trim.
 */
export const CANONICAL_SEED_FIELDS = Object.freeze([
  "seedNamespace",
  "purpose",
  "tenantId",
  "competitionId",
  "contextId",
  "derivationFingerprint",
  "ownerSeed",
]);

export const NULLS_POLICY = Object.freeze({
  NULLS_LAST: "NULLS_LAST",
  NULLS_FIRST: "NULLS_FIRST",
});

export const EXECUTION_MODE = Object.freeze({
  REPLAY_VERIFY: "REPLAY_VERIFY",
  DETERMINISTIC_EXECUTE: "DETERMINISTIC_EXECUTE",
});

/** @type {ReadonlySet<string>} */
export const EXECUTION_MODE_VALUES = new Set(Object.values(EXECUTION_MODE));

export const REPLAY_MISMATCH_CATEGORY = Object.freeze({
  INPUT: "INPUT",
  SEED: "SEED",
  ALGORITHM_VERSION: "ALGORITHM_VERSION",
  RULE_SET: "RULE_SET",
  SERIALIZATION: "SERIALIZATION",
  EVENT_HISTORY: "EVENT_HISTORY",
  OUTPUT: "OUTPUT",
  ORDERING: "ORDERING",
  PRNG_CONSUMPTION: "PRNG_CONSUMPTION",
});

/** @type {ReadonlySet<string>} */
export const REPLAY_MISMATCH_CATEGORY_VALUES = new Set(
  Object.values(REPLAY_MISMATCH_CATEGORY)
);

/** Fields forbidden on replay contracts / evidence. */
export const REPLAY_FORBIDDEN_FIELDS = Object.freeze([
  "wallClockDurationMs",
  "machineIdentity",
  "timestamp",
  "processId",
  "memoryUsage",
  "runtimeTiming",
  "durationMs",
  "generatedAt",
  "Date.now",
  "Math.random",
]);

export const CORE21_SOURCE = Object.freeze({
  capability: "CORE-21",
  moduleId: CORE21_CONTRACT_ID,
});
