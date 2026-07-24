/**
 * Ecosystem & Integrations — public facade (ECO-01).
 *
 * Canonical Connector & Event Foundation.
 *
 * Consumers must import from this index — not from internal file paths —
 * once wiring begins in later phases.
 *
 * Does NOT export:
 * - live vendor SDKs / network clients
 * - credentials, secrets, or env readers
 * - Sprint 10 marketplace integrations settings UI
 * - Finance ledger / payment posting
 * - Notification delivery worker
 * - Platform Core internals
 * - Production webhook HTTP routes
 */

export { ECOSYSTEM_INTEGRATIONS_PHASE } from "./constants/catalogues.js";

export {
  CONNECTOR_KIND,
  CONNECTOR_KIND_VALUES,
  CONNECTOR_DIRECTION,
  CONNECTOR_DIRECTION_VALUES,
  CONNECTOR_ENVIRONMENT,
  CONNECTOR_ENVIRONMENT_VALUES,
  CONNECTOR_LIFECYCLE,
  CONNECTOR_LIFECYCLE_VALUES,
  INVOCATION_MODE,
  INVOCATION_MODE_VALUES,
  CREDENTIAL_REQUIREMENT,
  CREDENTIAL_REQUIREMENT_VALUES,
  INTEGRATION_ERROR_CODE,
  INTEGRATION_ERROR_CODE_VALUES,
  WEBHOOK_VERIFICATION_OUTCOME,
  WEBHOOK_VERIFICATION_OUTCOME_VALUES,
  IDEMPOTENCY_OUTCOME,
  IDEMPOTENCY_OUTCOME_VALUES,
  OPERATIONAL_STATUS,
  OPERATIONAL_STATUS_VALUES,
  ENVELOPE_VERSION,
  CONNECTOR_DESCRIPTOR_VERSION,
  PROVIDER_CAPABILITY_VERSION,
} from "./constants/catalogues.js";

export {
  createConnectorDescriptor,
  isConnectorDescriptor,
  CONNECTOR_DESCRIPTOR_ERROR,
} from "./contracts/connectorDescriptor.js";

export {
  createProviderCapabilityDescriptor,
  isProviderCapabilityDescriptor,
  PROVIDER_CAPABILITY_DESCRIPTOR_ERROR,
} from "./contracts/providerCapabilityDescriptor.js";

export {
  createInboundIntegrationEnvelope,
  createOutboundIntegrationEnvelope,
  isInboundIntegrationEnvelope,
  isOutboundIntegrationEnvelope,
  INTEGRATION_ENVELOPE_ERROR,
} from "./contracts/envelopes.js";

export {
  createIdempotencyProjection,
  evaluateIdempotencyProjection,
  IDEMPOTENCY_PROJECTION_ERROR,
} from "./contracts/idempotencyProjection.js";

export {
  projectIntegrationReadiness,
  HEALTH_READINESS_ERROR,
} from "./contracts/healthReadinessProjection.js";

export {
  createIntegrationRegistry,
  INTEGRATION_REGISTRY_ERROR,
} from "./registry/createIntegrationRegistry.js";

export {
  createIntegrationError,
  classifyIntegrationRetry,
  isRetryableIntegrationErrorCode,
  INTEGRATION_ERROR_RETRYABLE,
} from "./errors/errorTaxonomy.js";

export {
  createWebhookVerificationRequest,
  verifyWebhookRequestFailClosed,
  createFakeWebhookVerifier,
  WEBHOOK_VERIFICATION_ERROR,
} from "./ports/webhookVerificationPort.js";

export { createNoOpTestProvider } from "./providers/createNoOpTestProvider.js";

export {
  projectConnectorToIntegrationPort,
  projectIntegrationPortDescriptor,
  projectPlatformCapabilityDescriptor,
  createPlatformCapabilityDescriptor,
  hasPlatformCapability,
  findPlatformCapability,
  assertPlatformIntegrationCapabilitySurface,
  ECO_PLATFORM_ADAPTER_ERROR,
} from "./platform/platformAdoption.js";
