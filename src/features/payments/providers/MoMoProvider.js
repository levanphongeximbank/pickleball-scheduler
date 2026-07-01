import { PaymentProvider } from "./PaymentProvider.js";
import { getIntegrationEnvConfig } from "../../integrations/config/integrationFlags.js";

export class MoMoProvider extends PaymentProvider {
  constructor() {
    super("momo");
  }

  isConfigured() {
    const cfg = getIntegrationEnvConfig().momo;
    return cfg.enabled && cfg.partnerCode && cfg.secretKey;
  }

  async createPayment(input) {
    if (!this.isConfigured()) {
      return { ok: false, error: "MoMo chưa được cấu hình." };
    }
    const providerTransactionId = `momo_${input.orderId}_${Date.now()}`;
    const cfg = getIntegrationEnvConfig().momo;
    return {
      ok: true,
      providerTransactionId,
      paymentUrl: `${cfg.returnUrl || "/marketplace/pay/momo"}?txn=${providerTransactionId}`,
      rawResponse: { provider: "momo", sandbox: true },
    };
  }

  async verifyCallback(input) {
    if (!this.isConfigured()) {
      return { ok: false, verified: false, error: "MoMo chưa được cấu hình." };
    }
    const signature = input.payload?.signature || input.signature;
    const expected = input.payload?.expectedSignature;
    if (expected && signature !== expected) {
      return { ok: false, verified: false, error: "Chữ ký MoMo không hợp lệ." };
    }
    const amount = Number(input.payload?.amount || 0);
    if (input.expectedAmount && amount && amount !== input.expectedAmount) {
      return { ok: false, verified: false, error: "Số tiền callback không khớp." };
    }
    return {
      ok: true,
      verified: true,
      status: input.payload?.resultCode === 0 ? "success" : "failed",
      providerTransactionId: input.payload?.orderId,
      amount: input.expectedAmount || amount,
    };
  }

  async refund() {
    return { ok: false, error: "MoMo refund chưa triển khai (stub)." };
  }
}

export const momoProvider = new MoMoProvider();
