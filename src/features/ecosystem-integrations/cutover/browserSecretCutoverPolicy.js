/**
 * ECO-02b — vendor-neutral browser secret cutover policy.
 * Consumed by legacy integration config adapters.
 * No env reads, no network, no secret values, no vendor SDK names.
 */

import { CREDENTIAL_PRESENCE } from "../constants/catalogues.js";
import {
  BROWSER_EXPOSED_SECRET_NAME_PATTERN,
  isBrowserExposedSecretName,
  isSecretShapedKey,
} from "../contracts/secretBoundaryShared.js";
import { deepFreeze } from "../contracts/shared.js";

/**
 * Object field names that must never appear on browser-facing integration config.
 */
export const BROWSER_FORBIDDEN_SECRET_FIELD_NAMES = Object.freeze([
  "hashSecret",
  "secretKey",
  "accessKey",
  "webhookSecret",
  "secret",
  "accessToken",
  "refreshToken",
  "apiKey",
  "apiSecret",
  "pass",
  "password",
  "privateKey",
  "authorization",
  "authorizationHeader",
  "rawSignature",
  "signature",
  "credential",
  "material",
  "plaintext",
  // SMTP username is treated as credential material in this cutover.
  "user",
]);

/**
 * Public / client-safe keys allowed on provider slices after cutover.
 */
export const BROWSER_CLIENT_SAFE_CONFIG_KEYS = Object.freeze([
  "enabled",
  "tmnCode",
  "partnerCode",
  "appId",
  "returnUrl",
  "callbackUrl",
  "successUrl",
  "cancelUrl",
  "host",
  "port",
  "from",
  "provider",
  "serverCredentialRequired",
  "credentialPresence",
  "productionReady",
  "credentialRequirementIds",
]);

/**
 * Extended browser-exposed Vite credential naming (ECO-02b).
 * Includes ACCESS_KEY beyond the ECO-02 baseline pattern.
 */
export const LEGACY_VITE_CREDENTIAL_ENV_NAME_PATTERN =
  /^VITE_[A-Z0-9_]*(SECRET_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|API_SECRET|HASH_SECRET|WEBHOOK_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|ACCESS_KEY|PASS)$/i;

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isLegacyViteCredentialEnvName(name) {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed.startsWith("VITE_")) return false;
  // Explicit SMTP username credential (not matched by suffix catalogue alone).
  if (trimmed === "VITE_SMTP_USER") return true;
  if (isBrowserExposedSecretName(trimmed)) return true;
  if (LEGACY_VITE_CREDENTIAL_ENV_NAME_PATTERN.test(trimmed)) return true;
  return false;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isBrowserForbiddenSecretFieldName(key) {
  if (typeof key !== "string") return false;
  if (BROWSER_FORBIDDEN_SECRET_FIELD_NAMES.includes(key)) return true;
  return isSecretShapedKey(key);
}

/**
 * Fail-closed: browser config never resolves server-only credentials in ECO-02b.
 * @param {object|null|undefined} providerConfig
 * @returns {boolean}
 */
export function isBrowserProviderCredentialResolved(providerConfig) {
  if (!providerConfig || typeof providerConfig !== "object") return false;
  if (providerConfig.enabled !== true) return false;
  if (providerConfig.serverCredentialRequired === true) {
    return (
      providerConfig.credentialPresence === CREDENTIAL_PRESENCE.PRESENT &&
      providerConfig.productionReady === true
    );
  }
  // Providers that do not require server credentials (e.g. mock) may proceed
  // when explicitly enabled — never via secret-shaped fields.
  return providerConfig.productionReady === true;
}

/**
 * Marker fields attached to every credential-requiring browser provider slice.
 * @param {string[]} [credentialRequirementIds]
 */
export function createServerCredentialCutoverMarkers(
  credentialRequirementIds = []
) {
  return deepFreeze({
    serverCredentialRequired: true,
    credentialPresence: CREDENTIAL_PRESENCE.ABSENT,
    productionReady: false,
    credentialRequirementIds: Object.freeze([...credentialRequirementIds]),
  });
}

export {
  BROWSER_EXPOSED_SECRET_NAME_PATTERN,
  isBrowserExposedSecretName,
  isSecretShapedKey,
};
