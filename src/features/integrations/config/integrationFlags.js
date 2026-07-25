/**
 * Sprint 10 / ECO-02b — client-safe integration env flags.
 *
 * Browser-facing config must never read or export legacy VITE_* secrets,
 * tokens, passwords, or signing material. Credential-requiring providers are
 * marked fail-closed until a server-side resolver is injected (not in ECO-02b).
 */

import {
  isBrowserProviderCredentialResolved,
  withServerCredentialCutover,
} from "./legacyViteSecretCutover.js";

function readEnv(key, fallback = "") {
  if (typeof import.meta !== "undefined" && import.meta.env?.[key] !== undefined) {
    return import.meta.env[key];
  }
  const nodeEnv = globalThis.process?.env;
  if (nodeEnv?.[key] !== undefined) {
    return nodeEnv[key];
  }
  return fallback;
}

function readBool(key, fallback = false) {
  const value = String(readEnv(key, fallback ? "true" : "false")).toLowerCase();
  return value === "true" || value === "1";
}

export function isApiEnabled() {
  return readBool("VITE_API_ENABLED", false);
}

export function isMarketplaceEnabled() {
  return readBool("VITE_MARKETPLACE_ENABLED", false);
}

export function getDefaultPaymentProvider() {
  return readEnv("VITE_PAYMENT_DEFAULT_PROVIDER", "mock");
}

export function isVnpayEnabled() {
  return readBool("VITE_VNPAY_ENABLED", false);
}

export function isMomoEnabled() {
  return readBool("VITE_MOMO_ENABLED", false);
}

export function isStripeEnabled() {
  return readBool("VITE_STRIPE_ENABLED", false);
}

export function isZaloOaEnabled() {
  return readBool("VITE_ZALO_OA_ENABLED", false);
}

export function isEmailEnabled() {
  return readBool("VITE_EMAIL_ENABLED", false);
}

export function isSmsEnabled() {
  return readBool("VITE_SMS_ENABLED", false);
}

export function getSmsProvider() {
  return readEnv("VITE_SMS_PROVIDER", "mock");
}

/**
 * Client-safe integration env projection.
 * Does not read VITE_* secret / token / password variables.
 */
export function getIntegrationEnvConfig() {
  return {
    paymentDefaultProvider: getDefaultPaymentProvider(),
    vnpay: withServerCredentialCutover("vnpay", {
      enabled: isVnpayEnabled(),
      tmnCode: readEnv("VITE_VNPAY_TMN_CODE", ""),
      returnUrl: readEnv("VITE_VNPAY_RETURN_URL", ""),
      callbackUrl: readEnv("VITE_VNPAY_CALLBACK_URL", ""),
    }),
    momo: withServerCredentialCutover("momo", {
      enabled: isMomoEnabled(),
      partnerCode: readEnv("VITE_MOMO_PARTNER_CODE", ""),
      returnUrl: readEnv("VITE_MOMO_RETURN_URL", ""),
      callbackUrl: readEnv("VITE_MOMO_CALLBACK_URL", ""),
    }),
    stripe: withServerCredentialCutover("stripe", {
      enabled: isStripeEnabled(),
      successUrl: readEnv("VITE_STRIPE_SUCCESS_URL", ""),
      cancelUrl: readEnv("VITE_STRIPE_CANCEL_URL", ""),
    }),
    zalo: withServerCredentialCutover("zalo", {
      enabled: isZaloOaEnabled(),
      appId: readEnv("VITE_ZALO_OA_APP_ID", ""),
    }),
    email: withServerCredentialCutover("email", {
      enabled: isEmailEnabled(),
      host: readEnv("VITE_SMTP_HOST", ""),
      port: readEnv("VITE_SMTP_PORT", ""),
      from: readEnv("VITE_SMTP_FROM", ""),
    }),
    sms: withServerCredentialCutover("sms", {
      enabled: isSmsEnabled(),
      provider: getSmsProvider(),
    }),
  };
}

const PROVIDER_STATUS_META_KEYS = new Set([
  "enabled",
  "serverCredentialRequired",
  "credentialPresence",
  "productionReady",
  "credentialRequirementIds",
]);

/**
 * Resolve coarse provider status from browser-safe config.
 * Enabled public IDs/URLs never imply production-ready / active when
 * server credentials are required but unresolved.
 */
export function getProviderStatus(providerConfig) {
  if (!providerConfig?.enabled) return "not_configured";

  if (providerConfig.serverCredentialRequired === true) {
    if (isBrowserProviderCredentialResolved(providerConfig)) {
      return "active";
    }
    // Fail-closed: enabled flag + public metadata ≠ configured credentials.
    return "error";
  }

  const hasPublicConfig = Object.entries(providerConfig).some(
    ([key, value]) =>
      !PROVIDER_STATUS_META_KEYS.has(key) && String(value || "").length > 0
  );
  if (!hasPublicConfig && providerConfig.enabled) return "error";
  return "active";
}
