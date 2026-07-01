import { createPaymentProvider } from "./paymentProviderInterface.js";

/** VNPay — interface only; production disabled until staging credentials + webhook QA. */
export const vnpayProvider = createPaymentProvider("vnpay", {
  async createPaymentIntent() {
    return { ok: false, error: "vnpay_not_enabled", code: "GATEWAY_DISABLED" };
  },
});
