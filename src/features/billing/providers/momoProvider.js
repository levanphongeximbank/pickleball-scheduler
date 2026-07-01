import { createPaymentProvider } from "./paymentProviderInterface.js";

/** MoMo — interface only; production disabled until staging credentials + webhook QA. */
export const momoProvider = createPaymentProvider("momo", {
  async createPaymentIntent() {
    return { ok: false, error: "momo_not_enabled", code: "GATEWAY_DISABLED" };
  },
});
