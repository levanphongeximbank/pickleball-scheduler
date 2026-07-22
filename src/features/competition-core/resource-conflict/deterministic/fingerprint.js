/**
 * CORE-14 — deterministic fingerprint helpers (SHA-256 lowercase hex).
 */

import { CORE14_FID_V1, CORE14_FP_V1 } from "../constants/versions.js";
import { canonicalSerialize } from "./serialize.js";
import { hashUtf8Sha256Hex } from "./sha256.js";
import { sortIdentifiers } from "./compare.js";

/**
 * @param {string} canonicalText
 * @returns {string}
 */
export function fingerprintCanonicalText(canonicalText) {
  return hashUtf8Sha256Hex(canonicalText);
}

/**
 * Fingerprint a supported structure (metadata excluded unless selected).
 * @param {unknown} value
 * @param {{ includeMetadata?: boolean }} [options]
 * @returns {string}
 */
export function fingerprintValue(value, options = {}) {
  const serialized = canonicalSerialize(value, {
    includeMetadata: options.includeMetadata === true,
  });
  return fingerprintCanonicalText(serialized);
}

/**
 * CORE14_FP_V1 envelope fingerprint.
 * @param {Record<string, unknown>} material
 * @returns {string}
 */
export function fingerprintCore14Material(material) {
  const payload = {
    fingerprintVersion: CORE14_FP_V1,
    ...(material && typeof material === "object" ? material : {}),
  };
  return fingerprintValue(payload, { includeMetadata: false });
}

/**
 * Deterministic finding identity tuple → CORE14_FID_V1:<hex>
 * @param {{
 *   code: string,
 *   resourceKeyCanonical: string,
 *   occupancyIds: readonly string[],
 *   violationStartMs: number | null,
 *   violationEndMs: number | null,
 *   reasonCode: string,
 *   policyVersion: string,
 * }} tuple
 * @returns {string}
 */
export function createFindingId(tuple) {
  const material = {
    code: tuple.code,
    resourceKeyCanonical: tuple.resourceKeyCanonical,
    occupancyIdsSorted: sortIdentifiers(tuple.occupancyIds || []),
    violationStartMs: tuple.violationStartMs,
    violationEndMs: tuple.violationEndMs,
    reasonCode: tuple.reasonCode,
    policyVersion: tuple.policyVersion,
  };
  const hex = fingerprintValue(material, { includeMetadata: false });
  return `${CORE14_FID_V1}:${hex}`;
}
