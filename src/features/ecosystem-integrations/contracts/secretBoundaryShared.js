/**
 * Shared helpers for ECO-02 secret / environment boundary contracts.
 * Pure — no env, no network, no globals, no secret values.
 */

import { fail } from "../../../core/platform/index.js";
import { contractError, isPlainObject } from "./shared.js";

/**
 * Keys that must never appear as credential *values* on descriptors or
 * public projections.
 */
export const FORBIDDEN_SECRET_VALUE_FIELDS = Object.freeze([
  "value",
  "secret",
  "secretValue",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "apiSecret",
  "hashSecret",
  "webhookSecret",
  "privateKey",
  "authorization",
  "authorizationHeader",
  "rawSignature",
  "signature",
  "credential",
  "material",
  "plaintext",
]);

/**
 * Key-name patterns that are secret-shaped and must be rejected from
 * client-safe / public projections.
 */
export const SECRET_SHAPED_KEY_PATTERN =
  /(secret|password|token|authorization|api[_-]?key|private[_-]?key|credential|webhook[_-]?secret|hash[_-]?secret|access[_-]?key|signing)/i;

/**
 * Browser-exposed Vite secret naming — classified as unsafe when used for secrets.
 */
export const BROWSER_EXPOSED_SECRET_NAME_PATTERN =
  /^VITE_.*_(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|API_SECRET|HASH_SECRET|WEBHOOK_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|PASS)$/i;

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isSecretShapedKey(key) {
  if (typeof key !== "string") return false;
  return SECRET_SHAPED_KEY_PATTERN.test(key);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isBrowserExposedSecretName(name) {
  if (typeof name !== "string") return false;
  return BROWSER_EXPOSED_SECRET_NAME_PATTERN.test(name.trim());
}

/**
 * Reject input objects that carry credential *values* (not mere references).
 * @param {Record<string, *>} input
 * @param {string} errorCode
 * @param {string} [contextLabel]
 */
export function rejectSecretValueFields(input, errorCode, contextLabel = "input") {
  if (!isPlainObject(input)) {
    return fail(
      contractError(errorCode, `${contextLabel} must be a plain object`)
    );
  }
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_SECRET_VALUE_FIELDS.includes(key)) {
      return fail(
        contractError(
          errorCode,
          `${contextLabel} must not include secret value field: ${key}`,
          key
        )
      );
    }
  }
  return null;
}

/**
 * Walk a plain object tree and return the first secret-shaped key path.
 * @param {*} value
 * @param {string} [path]
 * @returns {string|null}
 */
export function findSecretShapedKeyPath(value, path = "") {
  if (value === null || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findSecretShapedKeyPath(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (isSecretShapedKey(key)) {
      return next;
    }
    const hit = findSecretShapedKeyPath(item, next);
    if (hit) return hit;
  }
  return null;
}

/**
 * Opaque redaction marker — never the original value.
 */
export const REDACTED_MARKER = "[REDACTED]";
