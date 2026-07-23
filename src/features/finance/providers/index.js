/**
 * Finance provider-neutral payment port exports (Phase 1D).
 */

export {
  FINANCE_PROVIDER_PORT_VERSION,
  FINANCE_PROVIDER_CODE,
  PROVIDER_PAYMENT_STATUS,
  PROVIDER_PAYMENT_STATUS_VALUES,
  PROVIDER_REFUND_STATUS,
  PROVIDER_REFUND_STATUS_VALUES,
  PROVIDER_WEBHOOK_EVENT_TYPE,
  PROVIDER_WEBHOOK_EVENT_TYPE_VALUES,
  PROVIDER_OPERATION,
  PROVIDER_OPERATION_VALUES,
} from "./catalogue.js";

export {
  createProviderCapabilities,
  assertProviderOperationSupported,
  assertProviderCurrencySupported,
} from "./capabilities.js";

export {
  createProviderError,
  throwProviderError,
  PROVIDER_ERROR_RETRYABLE,
} from "./errors.js";

export {
  createProviderOperationContext,
  createPaymentInitiationRequest,
  createPaymentInitiationResult,
  createPaymentVerificationResult,
  createNormalizedProviderEvidence,
  createRefundInitiationRequest,
  createRefundProviderResult,
  createProviderWebhookInput,
  createNormalizedWebhookEvent,
  normalizeSafeMetadata,
  MAX_WEBHOOK_BODY_CHARS,
} from "./contracts.js";

export {
  PAYMENT_PROVIDER_PORT_METHODS,
  assertPaymentProviderPort,
} from "./PaymentProviderPort.js";

/**
 * Mock adapter — tests / development capability proof only.
 * Not a production payment provider.
 */
export { createMockPaymentProvider } from "./mock/createMockPaymentProvider.js";
