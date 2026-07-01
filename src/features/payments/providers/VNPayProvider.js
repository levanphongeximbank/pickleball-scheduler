import { PaymentProvider } from "./PaymentProvider.js";
import { getIntegrationEnvConfig } from "../../integrations/config/integrationFlags.js";

export class VNPayProvider extends PaymentProvider {
  constructor() {
    super("vnpay");
  }

  isConfigured() {
    const cfg = getIntegrationEnvConfig().vnpay;
    return cfg.enabled && cfg.tmnCode && cfg.hashSecret;
  }

  async createPayment(input) {
    if (!this.isConfigured()) {
      return { ok: false, error: "VNPay chưa được cấu hình." };
    }
    const providerTransactionId = `vnp_${input.orderId}_${Date.now()}`;
    const cfg = getIntegrationEnvConfig().vnpay;
    const paymentUrl = `${cfg.returnUrl || "/marketplace/pay/vnpay"}?txn=${providerTransactionId}`;
    return {
      ok: true,
      providerTransactionId,
      paymentUrl,
      rawResponse: { provider: "vnpay", sandbox: true },
    };
  }

  async verifyCallback(input) {
    if (!this.isConfigured()) {
      return { ok: false, verified: false, error: "VNPay chưa được cấu hình." };
    }
    const signature = input.payload?.vnp_SecureHash || input.signature;
    const expected = input.payload?.expectedSignature;
    if (expected && signature !== expected) {
      return { ok: false, verified: false, error: "Chữ ký VNPay không hợp lệ." };
    }
    const amount = Number(input.payload?.vnp_Amount || 0) / 100;
    if (input.expectedAmount && amount && amount !== input.expectedAmount) {
      return { ok: false, verified: false, error: "Số tiền callback không khớp." };
    }
    return {
      ok: true,
      verified: true,
      status: input.payload?.vnp_ResponseCode === "00" ? "success" : "failed",
      providerTransactionId: input.payload?.vnp_TxnRef,
      amount: input.expectedAmount || amount,
    };
  }

  async refund() {
    return { ok: false, error: "VNPay refund chưa triển khai (stub)." };
  }
}

export const vnpayProvider = new VNPayProvider();
