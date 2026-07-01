import { createPaymentProvider } from "./paymentProviderInterface.js";

/** Stripe — interface only; production disabled until staging credentials + webhook QA. */
export const stripeProvider = createPaymentProvider("stripe", {
  async createPaymentIntent() {
    return { ok: false, error: "stripe_not_enabled", code: "GATEWAY_DISABLED" };
  },
});
