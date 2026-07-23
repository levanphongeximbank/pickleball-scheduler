/**
 * Finance-owned PaymentProviderPort (Phase 1D).
 *
 * Provider-neutral contract. Real adapters (VNPay, MoMo, Stripe, bank transfer,
 * QR, etc.) must implement these methods without changing Finance domain rules.
 *
 * A webhook/callback is evidence input only — Finance application rules still
 * decide whether a payment or refund transition is valid.
 */

export const PAYMENT_PROVIDER_PORT_METHODS = Object.freeze([
  "getCapabilities",
  "initiatePayment",
  "queryPaymentStatus",
  "verifyPaymentConfirmation",
  "cancelPayment",
  "initiateRefund",
  "queryRefundStatus",
  "parseWebhook",
]);

/**
 * @typedef {object} PaymentProviderPort
 * @property {() => object} getCapabilities
 * @property {(ctx: object, request: object) => object} initiatePayment
 * @property {(ctx: object, query: object) => object} queryPaymentStatus
 * @property {(ctx: object, evidence: object) => object} verifyPaymentConfirmation
 * @property {(ctx: object, request: object) => object} cancelPayment
 * @property {(ctx: object, request: object) => object} initiateRefund
 * @property {(ctx: object, query: object) => object} queryRefundStatus
 * @property {(input: object) => object} parseWebhook
 */

/**
 * @param {unknown} candidate
 * @returns {asserts candidate is PaymentProviderPort}
 */
export function assertPaymentProviderPort(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("PaymentProviderPort must be an object.");
  }
  for (const method of PAYMENT_PROVIDER_PORT_METHODS) {
    if (typeof candidate[method] !== "function") {
      throw new Error(`PaymentProviderPort missing method: ${method}`);
    }
  }
}
