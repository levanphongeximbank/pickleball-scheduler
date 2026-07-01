import { PaymentProvider } from "./PaymentProvider.js";
import { getIntegrationEnvConfig } from "../../integrations/config/integrationFlags.js";

export class StripeProvider extends PaymentProvider {
  constructor() {
    super("stripe");
  }

  isConfigured() {
    const cfg = getIntegrationEnvConfig().stripe;
    return cfg.enabled && cfg.secretKey;
  }

  async createPayment(input) {
    if (!this.isConfigured()) {
      return { ok: false, error: "Stripe chưa được cấu hình." };
    }
    const providerTransactionId = `stripe_${input.orderId}_${Date.now()}`;
    const cfg = getIntegrationEnvConfig().stripe;
    return {
      ok: true,
      providerTransactionId,
      paymentUrl: `${cfg.successUrl || "/marketplace/pay/stripe"}?session=${providerTransactionId}`,
      rawResponse: { provider: "stripe", sandbox: true },
    };
  }

  async verifyCallback(input) {
    if (!this.isConfigured()) {
      return { ok: false, verified: false, error: "Stripe chưa được cấu hình." };
    }
    const signature = input.payload?.stripeSignature || input.signature;
    const expected = input.payload?.expectedSignature;
    if (expected && signature !== expected) {
      return { ok: false, verified: false, error: "Stripe webhook signature không hợp lệ." };
    }
    return {
      ok: true,
      verified: true,
      status: input.payload?.type === "checkout.session.completed" ? "success" : "failed",
      providerTransactionId: input.payload?.sessionId,
      amount: input.expectedAmount,
    };
  }

  async refund() {
    return { ok: false, error: "Stripe refund chưa triển khai (stub)." };
  }
}

export const stripeProvider = new StripeProvider();
