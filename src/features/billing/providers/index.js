import { manualProvider } from "./manualProvider.js";
import { bankTransferProvider } from "./bankTransferProvider.js";
import { mockProvider } from "./mockProvider.js";
import { vnpayProvider } from "./vnpayProvider.js";
import { momoProvider } from "./momoProvider.js";
import { stripeProvider } from "./stripeProvider.js";

const REGISTRY = Object.freeze({
  manual: manualProvider,
  bank_transfer: bankTransferProvider,
  mock: mockProvider,
  vnpay: vnpayProvider,
  momo: momoProvider,
  stripe: stripeProvider,
});

export function getPaymentProvider(name) {
  return REGISTRY[name] || null;
}

export function listEnabledPaymentProviders(env = import.meta.env || {}) {
  return Object.values(REGISTRY).filter((provider) => provider.isEnabled(env));
}

export * from "./paymentProviderInterface.js";
export { manualProvider, bankTransferProvider, mockProvider, vnpayProvider, momoProvider, stripeProvider };
