/** Payment provider interface — Phase 9. Real gateways stay disabled until staging credentials exist. */

export const PROVIDER_CAPABILITIES = Object.freeze({
  manual: { supportsRefund: false, supportsWebhook: false, productionReady: true },
  bank_transfer: { supportsRefund: false, supportsWebhook: false, productionReady: true },
  mock: { supportsRefund: true, supportsWebhook: true, productionReady: false },
  vnpay: { supportsRefund: false, supportsWebhook: true, productionReady: false },
  momo: { supportsRefund: false, supportsWebhook: true, productionReady: false },
  stripe: { supportsRefund: true, supportsWebhook: true, productionReady: false },
});

export function createPaymentProvider(name, implementation = {}) {
  const caps = PROVIDER_CAPABILITIES[name] || {};
  return {
    name,
    ...caps,
    isEnabled(env = {}) {
      if (name === "manual" || name === "bank_transfer") {
        return true;
      }
      if (name === "mock") {
        return env.VITE_BILLING_MOCK_PAYMENT === "true" || env.NODE_ENV !== "production";
      }
      return Boolean(env[`VITE_${name.toUpperCase()}_ENABLED`]);
    },
    async createPaymentIntent(input) {
      return implementation.createPaymentIntent?.(input) ?? { ok: false, error: "not_implemented" };
    },
    async confirmPayment(input) {
      return implementation.confirmPayment?.(input) ?? { ok: false, error: "not_implemented" };
    },
    async handleWebhook(input) {
      return implementation.handleWebhook?.(input) ?? { ok: false, error: "not_implemented" };
    },
    async refund(input) {
      return implementation.refund?.(input) ?? { ok: false, error: "refund_not_supported" };
    },
  };
}
