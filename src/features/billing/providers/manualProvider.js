import { createPaymentProvider } from "./paymentProviderInterface.js";

export const manualProvider = createPaymentProvider("manual", {
  async createPaymentIntent({ amount, currency, invoiceId, metadata = {} }) {
    return {
      ok: true,
      provider: "manual",
      status: "pending",
      amount,
      currency,
      invoiceId,
      instructions: "Liên hệ quản trị viên để ghi nhận thanh toán thủ công.",
      metadata,
    };
  },
  async confirmPayment({ paymentId, actorUserId }) {
    return {
      ok: true,
      provider: "manual",
      paymentId,
      status: "succeeded",
      actorUserId,
    };
  },
});
