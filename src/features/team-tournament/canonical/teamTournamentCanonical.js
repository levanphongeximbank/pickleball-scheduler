import { hashUtf8Sha256Async, hashUtf8Sha256Sync, isValidSha256Hex } from "./teamTournamentCanonicalDigest.js";
import {
  stableCanonicalStringify,
} from "./teamTournamentCanonicalRules.js";
import { buildCanonicalSetupSnapshot } from "./teamTournamentSetupSnapshot.js";

export {
  CANONICAL_SCHEMA_VERSION,
  SETUP_COMMAND_NAMES,
  SETUP_COMMAND_REGISTRY,
  CanonicalValidationError,
  canonicalizeValue,
  canonicalizeDomainCollection,
  normalizeCanonicalString,
  normalizeCanonicalDate,
  normalizeCanonicalNumber,
  stableCanonicalStringify,
} from "./teamTournamentCanonicalRules.js";

export { buildCanonicalSetupSnapshot, validateCanonicalSetupSnapshot } from "./teamTournamentSetupSnapshot.js";

export {
  buildSetupMutationEnvelope,
  buildSetupMutationEnvelopeAsync,
  validateSetupMutationEnvelope,
  validateSetupMutationEnvelopeAsync,
  calculateSetupMutationPayloadHash,
  calculateSetupMutationPayloadHashAsync,
  DEFAULT_ENGINE_VERSION,
} from "./teamTournamentMutationEnvelope.js";

export { hashUtf8Sha256Async, hashUtf8Sha256Sync, isValidSha256Hex } from "./teamTournamentCanonicalDigest.js";

/**
 * @param {unknown} snapshotInput
 * @returns {object}
 */
export function canonicalizeSetupSnapshot(snapshotInput) {
  return buildCanonicalSetupSnapshot(snapshotInput || {});
}

/**
 * @param {unknown} snapshot
 * @returns {string}
 */
export function serializeCanonicalSetupSnapshot(snapshot) {
  return stableCanonicalStringify(canonicalizeSetupSnapshot(snapshot));
}

/**
 * Node/tests/scripts only — browser UI must use hashCanonicalSetupSnapshotAsync.
 * @param {unknown} snapshot
 * @returns {string}
 */
export function hashCanonicalSetupSnapshot(snapshot) {
  return hashUtf8Sha256Sync(serializeCanonicalSetupSnapshot(snapshot));
}

/**
 * Node/tests/scripts only — browser UI must use hashEngineInputAsync.
 * @param {unknown} engineInput
 * @returns {string}
 */
export function hashEngineInput(engineInput) {
  return hashUtf8Sha256Sync(stableCanonicalStringify(engineInput));
}

/**
 * Node/tests/scripts only — browser UI must use hashEngineOutputAsync.
 * @param {unknown} engineOutput
 * @returns {string}
 */
export function hashEngineOutput(engineOutput) {
  return hashUtf8Sha256Sync(stableCanonicalStringify(engineOutput));
}

/**
 * @param {string} leftHash
 * @param {string} rightHash
 * @returns {{ equal: boolean, mismatches: string[] }}
 */
export function compareSnapshotHashes(leftHash, rightHash) {
  const left = String(leftHash || "").toLowerCase();
  const right = String(rightHash || "").toLowerCase();
  const mismatches = [];
  if (!isValidSha256Hex(left)) {
    mismatches.push("left");
  }
  if (!isValidSha256Hex(right)) {
    mismatches.push("right");
  }
  return {
    equal: left === right && mismatches.length === 0,
    mismatches,
  };
}

/**
 * Browser-safe SHA-256 via SubtleCrypto async or pure sync digest (no node:crypto).
 * @param {unknown} snapshot
 * @returns {Promise<string>}
 */
export async function hashCanonicalSetupSnapshotAsync(snapshot) {
  return hashUtf8Sha256Async(serializeCanonicalSetupSnapshot(snapshot));
}

/**
 * @param {unknown} engineInput
 * @returns {Promise<string>}
 */
export async function hashEngineInputAsync(engineInput) {
  return hashUtf8Sha256Async(stableCanonicalStringify(engineInput));
}

/**
 * @param {unknown} engineOutput
 * @returns {Promise<string>}
 */
export async function hashEngineOutputAsync(engineOutput) {
  return hashUtf8Sha256Async(stableCanonicalStringify(engineOutput));
}
