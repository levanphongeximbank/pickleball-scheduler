import { PaymentProvider } from "./PaymentProvider.js";

export class MockPaymentProvider extends PaymentProvider {
  constructor() {
    super("mock");
  }

  async createPayment(input) {
    const providerTransactionId = `mock_${input.orderId}_${Date.now()}`;
    const paymentUrl = `/marketplace/pay/mock?tx=${providerTransactionId}&order=${input.orderId}`;
    return {
      ok: true,
      providerTransactionId,
      paymentUrl,
      rawResponse: { mode: "mock", amount: input.amount },
    };
  }

  async verifyCallback(input) {
    const status = input.payload?.status === "failed" ? "failed" : "success";
    return {
      ok: true,
      verified: true,
      status,
      providerTransactionId: input.payload?.providerTransactionId || input.transactionId,
      amount: input.expectedAmount,
    };
  }

  async refund(input) {
    return {
      ok: true,
      status: "refunded",
      providerRefundId: `mock_ref_${input.transactionId}`,
    };
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
