/**
 * Phase 11A — canonical integration provider registry.
 * All providers default disabled at tenant level; no network calls from registry.
 */
export const INTEGRATION_PROVIDER_IDS = Object.freeze([
  "zalo",
  "email",
  "sms",
  "vnpay",
  "momo",
  "stripe",
  "mock_payment",
]);

export const INTEGRATION_PROVIDERS = Object.freeze({
  zalo: Object.freeze({
    id: "zalo",
    label: "Zalo OA",
    category: "notification",
    tenantField: "zaloEnabled",
    envConfigKey: "zalo",
    mockOnly: false,
    productionReady: false,
    defaultEnabled: false,
  }),
  email: Object.freeze({
    id: "email",
    label: "Email (SMTP)",
    category: "notification",
    tenantField: "emailEnabled",
    envConfigKey: "email",
    mockOnly: false,
    productionReady: false,
    defaultEnabled: false,
  }),
  sms: Object.freeze({
    id: "sms",
    label: "SMS",
    category: "notification",
    tenantField: "smsEnabled",
    envConfigKey: "sms",
    mockOnly: false,
    productionReady: false,
    defaultEnabled: false,
  }),
  vnpay: Object.freeze({
    id: "vnpay",
    label: "VNPay",
    category: "payment",
    tenantField: "vnpayEnabled",
    envConfigKey: "vnpay",
    mockOnly: false,
    productionReady: false,
    defaultEnabled: false,
  }),
  momo: Object.freeze({
    id: "momo",
    label: "MoMo",
    category: "payment",
    tenantField: "momoEnabled",
    envConfigKey: "momo",
    mockOnly: false,
    productionReady: false,
    defaultEnabled: false,
  }),
  stripe: Object.freeze({
    id: "stripe",
    label: "Stripe",
    category: "payment",
    tenantField: "stripeEnabled",
    envConfigKey: "stripe",
    mockOnly: false,
    productionReady: false,
    defaultEnabled: false,
  }),
  mock_payment: Object.freeze({
    id: "mock_payment",
    label: "Mock Payment",
    category: "payment",
    tenantField: "mockPaymentEnabled",
    envConfigKey: null,
    mockOnly: true,
    productionReady: false,
    defaultEnabled: false,
  }),
});

export function listIntegrationProviders() {
  return INTEGRATION_PROVIDER_IDS.map((id) => INTEGRATION_PROVIDERS[id]);
}

export function getIntegrationProvider(providerId) {
  return INTEGRATION_PROVIDERS[String(providerId || "").trim()] || null;
}
