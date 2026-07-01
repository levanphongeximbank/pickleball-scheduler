import { PAYMENT_PROVIDERS } from "../models/paymentModels.js";
import { mockPaymentProvider } from "./MockPaymentProvider.js";
import { vnpayProvider } from "./VNPayProvider.js";
import { momoProvider } from "./MoMoProvider.js";
import { stripeProvider } from "./StripeProvider.js";
import { getDefaultPaymentProvider } from "../../integrations/config/integrationFlags.js";

const PROVIDERS = {
  [PAYMENT_PROVIDERS.MOCK]: mockPaymentProvider,
  [PAYMENT_PROVIDERS.VNPAY]: vnpayProvider,
  [PAYMENT_PROVIDERS.MOMO]: momoProvider,
  [PAYMENT_PROVIDERS.STRIPE]: stripeProvider,
};

export function resolvePaymentProvider(provider) {
  const name = provider || getDefaultPaymentProvider() || PAYMENT_PROVIDERS.MOCK;
  return PROVIDERS[name] || mockPaymentProvider;
}

export function listPaymentProviders() {
  return Object.keys(PROVIDERS);
}
