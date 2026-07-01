import { createPaymentProvider } from "./paymentProviderInterface.js";

export const bankTransferProvider = createPaymentProvider("bank_transfer", {
  async createPaymentIntent({ amount, currency, invoiceId, bankAccount = "1234567890", bankName = "Vietcombank" }) {
    return {
      ok: true,
      provider: "bank_transfer",
      status: "pending",
      amount,
      currency,
      invoiceId,
      instructions: `Chuyển khoản ${amount} ${currency} tới ${bankName} — STK ${bankAccount}. Nội dung: INV-${invoiceId}`,
    };
  },
  async confirmPayment({ paymentId, reference }) {
    return {
      ok: true,
      provider: "bank_transfer",
      paymentId,
      status: "succeeded",
      reference,
    };
  },
});
