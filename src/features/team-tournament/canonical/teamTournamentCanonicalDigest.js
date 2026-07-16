import { createHash } from "node:crypto";

const textEncoder = new TextEncoder();

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToSha256Hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 hex digest for UTF-8 text.
 * Browser: SubtleCrypto only (no sync / no insecure fallback).
 * Node: SubtleCrypto when present, else createHash.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function hashUtf8Sha256Async(text) {
  const payload = String(text ?? "");
  const data = textEncoder.encode(payload);
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return bytesToSha256Hex(new Uint8Array(digest));
  }
  const nodeProcess = globalThis.process;
  if (nodeProcess?.versions?.node) {
    return createHash("sha256").update(payload, "utf8").digest("hex");
  }
  throw new Error(
    "hashUtf8Sha256Async requires SubtleCrypto in browser runtime (HASH_RUNTIME_ERROR)."
  );
}

/**
 * Synchronous SHA-256 for Node unit tests and scripts only.
 * @param {string} text
 * @returns {string}
 */
export function hashUtf8Sha256Sync(text) {
  const payload = String(text ?? "");
  const nodeProcess = globalThis.process;
  if (nodeProcess?.versions?.node) {
    return createHash("sha256").update(payload, "utf8").digest("hex");
  }
  throw new Error(
    "hashUtf8Sha256Sync is unavailable in browser runtime; use hashUtf8Sha256Async."
  );
}

/**
 * @param {string} hash
 * @returns {boolean}
 */
export function isValidSha256Hex(hash) {
  return typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash);
}
