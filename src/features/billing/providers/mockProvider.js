import { createPaymentProvider } from "./paymentProviderInterface.js";

export const mockProvider = createPaymentProvider("mock", {
  async createPaymentIntent({ amount, currency, invoiceId }) {
    return {
      ok: true,
      provider: "mock",
      status: "pending",
      amount,
      currency,
      invoiceId,
      paymentUrl: `/billing/payment?mock=1&invoice=${invoiceId}`,
    };
  },
  async confirmPayment({ paymentId, succeed = true }) {
    return {
      ok: true,
      provider: "mock",
      paymentId,
      status: succeed ? "succeeded" : "failed",
    };
  },
  async handleWebhook({ payload }) {
    return {
      ok: true,
      provider: "mock",
      status: payload?.status || "succeeded",
      raw: payload,
    };
  },
  async refund({ paymentId }) {
    return { ok: true, provider: "mock", paymentId, status: "refunded" };
  },
});
