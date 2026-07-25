/**
 * ECO-02b — legacy Vite secret cutover catalog for Sprint 10 integrations.
 * Declares removed browser env names + canonical credential requirements.
 * No secret values. No live resolver. No network.
 */

import {
  CREDENTIAL_PRESENCE,
  ENVIRONMENT_CLASS,
  createCredentialRequirementDescriptor,
  createServerCredentialCutoverMarkers,
  isBrowserForbiddenSecretFieldName,
  isBrowserProviderCredentialResolved,
  isLegacyViteCredentialEnvName,
  BROWSER_CLIENT_SAFE_CONFIG_KEYS,
} from "../../ecosystem-integrations/index.js";

/**
 * Legacy VITE_* names that must never be read from browser-side config.
 * Names only — never values.
 */
export const LEGACY_VITE_SECRET_ENV_NAMES = Object.freeze([
  "VITE_VNPAY_HASH_SECRET",
  "VITE_MOMO_ACCESS_KEY",
  "VITE_MOMO_SECRET_KEY",
  "VITE_STRIPE_SECRET_KEY",
  "VITE_STRIPE_WEBHOOK_SECRET",
  "VITE_ZALO_OA_SECRET",
  "VITE_ZALO_OA_ACCESS_TOKEN",
  "VITE_ZALO_OA_REFRESH_TOKEN",
  "VITE_SMTP_PASS",
  "VITE_SMTP_USER",
  "VITE_SMS_API_KEY",
  "VITE_SMS_API_SECRET",
]);

/**
 * Object fields removed from getIntegrationEnvConfig() public shape.
 */
export const REMOVED_BROWSER_SECRET_FIELDS = Object.freeze([
  "hashSecret",
  "accessKey",
  "secretKey",
  "webhookSecret",
  "secret",
  "accessToken",
  "refreshToken",
  "pass",
  "user",
  "apiKey",
  "apiSecret",
]);

/**
 * Client-safe VITE_* retained after audit (flags / public IDs / URLs / metadata).
 */
export const RETAINED_CLIENT_SAFE_VITE_ENV_NAMES = Object.freeze([
  "VITE_API_ENABLED",
  "VITE_MARKETPLACE_ENABLED",
  "VITE_PAYMENT_DEFAULT_PROVIDER",
  "VITE_VNPAY_ENABLED",
  "VITE_VNPAY_TMN_CODE",
  "VITE_VNPAY_RETURN_URL",
  "VITE_VNPAY_CALLBACK_URL",
  "VITE_MOMO_ENABLED",
  "VITE_MOMO_PARTNER_CODE",
  "VITE_MOMO_RETURN_URL",
  "VITE_MOMO_CALLBACK_URL",
  "VITE_STRIPE_ENABLED",
  "VITE_STRIPE_SUCCESS_URL",
  "VITE_STRIPE_CANCEL_URL",
  "VITE_ZALO_OA_ENABLED",
  "VITE_ZALO_OA_APP_ID",
  "VITE_EMAIL_ENABLED",
  "VITE_SMTP_HOST",
  "VITE_SMTP_PORT",
  "VITE_SMTP_FROM",
  "VITE_SMS_ENABLED",
  "VITE_SMS_PROVIDER",
]);

/**
 * @param {string} referenceId
 * @param {string} referenceName
 * @param {string[]} eligibleEnvironments
 */
function buildServerOnlyReferenceInput(
  referenceId,
  referenceName,
  eligibleEnvironments = ["TEST", "SANDBOX", "STAGING"]
) {
  return {
    referenceId,
    referenceName,
    sourceKind: "ENV_NAME",
    classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    eligibleEnvironments,
  };
}

/**
 * @param {object} input
 */
function buildRequirement(input) {
  const result = createCredentialRequirementDescriptor(input);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

const REF_VNPAY_HASH = buildServerOnlyReferenceInput(
  "eco.ref.payment.vnpay.hash",
  "INTEGRATION_VNPAY_HASH_SECRET"
);
const REF_MOMO_ACCESS = buildServerOnlyReferenceInput(
  "eco.ref.payment.momo.access",
  "INTEGRATION_MOMO_ACCESS_KEY"
);
const REF_MOMO_SECRET = buildServerOnlyReferenceInput(
  "eco.ref.payment.momo.secret",
  "INTEGRATION_MOMO_SECRET_KEY"
);
const REF_STRIPE_SECRET = buildServerOnlyReferenceInput(
  "eco.ref.payment.stripe.secret",
  "INTEGRATION_STRIPE_SECRET_KEY"
);
const REF_STRIPE_WEBHOOK = buildServerOnlyReferenceInput(
  "eco.ref.payment.stripe.webhook",
  "INTEGRATION_STRIPE_WEBHOOK_SECRET"
);
const REF_ZALO_SECRET = buildServerOnlyReferenceInput(
  "eco.ref.notification.zalo.secret",
  "INTEGRATION_ZALO_OA_SECRET"
);
const REF_ZALO_ACCESS = buildServerOnlyReferenceInput(
  "eco.ref.notification.zalo.access",
  "INTEGRATION_ZALO_OA_ACCESS_TOKEN"
);
const REF_ZALO_REFRESH = buildServerOnlyReferenceInput(
  "eco.ref.notification.zalo.refresh",
  "INTEGRATION_ZALO_OA_REFRESH_TOKEN"
);
const REF_SMTP_USER = buildServerOnlyReferenceInput(
  "eco.ref.notification.smtp.user",
  "INTEGRATION_SMTP_USER"
);
const REF_SMTP_PASS = buildServerOnlyReferenceInput(
  "eco.ref.notification.smtp.pass",
  "INTEGRATION_SMTP_PASS"
);
const REF_SMS_KEY = buildServerOnlyReferenceInput(
  "eco.ref.notification.sms.key",
  "INTEGRATION_SMS_API_KEY"
);
const REF_SMS_SECRET = buildServerOnlyReferenceInput(
  "eco.ref.notification.sms.secret",
  "INTEGRATION_SMS_API_SECRET"
);

export const LEGACY_PROVIDER_CREDENTIAL_REQUIREMENTS = Object.freeze({
  vnpay: Object.freeze([
    buildRequirement({
      credentialId: "eco.cred.payment.vnpay.hash",
      connectorId: "eco.payment.vnpay",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_VNPAY_HASH,
    }),
  ]),
  momo: Object.freeze([
    buildRequirement({
      credentialId: "eco.cred.payment.momo.access",
      connectorId: "eco.payment.momo",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_MOMO_ACCESS,
    }),
    buildRequirement({
      credentialId: "eco.cred.payment.momo.secret",
      connectorId: "eco.payment.momo",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_MOMO_SECRET,
    }),
  ]),
  stripe: Object.freeze([
    buildRequirement({
      credentialId: "eco.cred.payment.stripe.secret",
      connectorId: "eco.payment.stripe",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_STRIPE_SECRET,
    }),
    buildRequirement({
      credentialId: "eco.cred.payment.stripe.webhook",
      connectorId: "eco.payment.stripe",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_STRIPE_WEBHOOK,
    }),
  ]),
  zalo: Object.freeze([
    buildRequirement({
      credentialId: "eco.cred.notification.zalo.secret",
      connectorId: "eco.notification.zalo",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_ZALO_SECRET,
    }),
    buildRequirement({
      credentialId: "eco.cred.notification.zalo.access",
      connectorId: "eco.notification.zalo",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_ZALO_ACCESS,
    }),
    buildRequirement({
      credentialId: "eco.cred.notification.zalo.refresh",
      connectorId: "eco.notification.zalo",
      requirement: "OPTIONAL",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_ZALO_REFRESH,
    }),
  ]),
  email: Object.freeze([
    buildRequirement({
      credentialId: "eco.cred.notification.smtp.user",
      connectorId: "eco.notification.email",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_SMTP_USER,
    }),
    buildRequirement({
      credentialId: "eco.cred.notification.smtp.pass",
      connectorId: "eco.notification.email",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_SMTP_PASS,
    }),
  ]),
  sms: Object.freeze([
    buildRequirement({
      credentialId: "eco.cred.notification.sms.key",
      connectorId: "eco.notification.sms",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_SMS_KEY,
    }),
    buildRequirement({
      credentialId: "eco.cred.notification.sms.secret",
      connectorId: "eco.notification.sms",
      requirement: "REQUIRED",
      classification: ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
      eligibleEnvironments: ["TEST", "SANDBOX", "STAGING"],
      secretReference: REF_SMS_SECRET,
    }),
  ]),
});
/**
 * @param {string} providerKey
 * @returns {string[]}
 */
export function getLegacyCredentialRequirementIds(providerKey) {
  const list = LEGACY_PROVIDER_CREDENTIAL_REQUIREMENTS[providerKey] || [];
  return list.map((item) => item.credentialId);
}

/**
 * Attach fail-closed cutover markers to a client-safe provider slice.
 * @param {string} providerKey
 * @param {Record<string, *>} clientSafeFields
 */
export function withServerCredentialCutover(providerKey, clientSafeFields) {
  const markers = createServerCredentialCutoverMarkers(
    getLegacyCredentialRequirementIds(providerKey)
  );
  return {
    ...clientSafeFields,
    ...markers,
  };
}

/**
 * Assert a config object has no browser secret fields or sentinel values.
 * @param {unknown} config
 * @param {string} [sentinel]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assertClientSafeIntegrationConfig(
  config,
  sentinel = "TEST_ONLY_SENTINEL_DO_NOT_USE"
) {
  if (!config || typeof config !== "object") {
    return { ok: false, reason: "config must be an object" };
  }
  const json = JSON.stringify(config);
  if (json.includes(sentinel)) {
    return { ok: false, reason: "sentinel credential value leaked into config" };
  }
  for (const [key, value] of Object.entries(config)) {
    const allowlisted =
      BROWSER_CLIENT_SAFE_CONFIG_KEYS.includes(key) ||
      key === "paymentDefaultProvider";
    if (!allowlisted && isBrowserForbiddenSecretFieldName(key)) {
      return { ok: false, reason: `forbidden secret field: ${key}` };
    }
    if (REMOVED_BROWSER_SECRET_FIELDS.includes(key)) {
      return { ok: false, reason: `removed secret field present: ${key}` };
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = assertClientSafeIntegrationConfig(value, sentinel);
      if (!nested.ok) return nested;
    }
  }
  return { ok: true };
}

export {
  CREDENTIAL_PRESENCE,
  createServerCredentialCutoverMarkers,
  isBrowserForbiddenSecretFieldName,
  isBrowserProviderCredentialResolved,
  isLegacyViteCredentialEnvName,
};
