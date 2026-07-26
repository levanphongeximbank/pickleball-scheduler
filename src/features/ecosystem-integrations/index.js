/**
 * Ecosystem & Integrations — public facade (ECO-01 … ECO-05).
 *
 * Canonical Connector & Event Foundation + Secret/Environment Boundary +
 * Legacy Vite browser-secret cutover + Provider Adapter Foundation +
 * Webhook Ingress Foundation + Observability & Structural Final
 * Certification (vendor-neutral, no live providers / no Production
 * webhook routes).
 *
 * Consumers must import from this index — not from internal file paths —
 * once wiring begins in later phases.
 *
 * Does NOT export:
 * - live vendor SDKs / network clients
 * - credential *values* or live env readers
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
  ENVIRONMENT_CLASS,
  ENVIRONMENT_CLASS_VALUES,
  SECRET_REFERENCE_SOURCE,
  SECRET_REFERENCE_SOURCE_VALUES,
  CREDENTIAL_PRESENCE,
  CREDENTIAL_PRESENCE_VALUES,
  ENDPOINT_CLASS,
  ENDPOINT_CLASS_VALUES,
  SECRET_BOUNDARY_READINESS,
  SECRET_BOUNDARY_READINESS_VALUES,
  SECRET_REFERENCE_VERSION,
  CREDENTIAL_REQUIREMENT_DESCRIPTOR_VERSION,
  CLIENT_SAFE_PUBLIC_CONFIG_VERSION,
  SERVER_ONLY_CREDENTIAL_BOUNDARY_VERSION,
  ADAPTER_LIFECYCLE,
  ADAPTER_LIFECYCLE_VALUES,
  INVOCATION_RESULT_STATUS,
  INVOCATION_RESULT_STATUS_VALUES,
  ADAPTER_READINESS,
  ADAPTER_READINESS_VALUES,
  ADAPTER_SELECTION_OUTCOME,
  ADAPTER_SELECTION_OUTCOME_VALUES,
  PROVIDER_ADAPTER_DESCRIPTOR_VERSION,
  PROVIDER_INVOCATION_REQUEST_VERSION,
  PROVIDER_INVOCATION_RESULT_VERSION,
  CONNECTOR_CAPABILITY_BINDING_VERSION,
  PROVIDER_ADAPTER_OBSERVATION_VERSION,
  DOMAIN_ADAPTER_READINESS_CONTRACT_VERSION,
  WEBHOOK_INGRESS_OUTCOME,
  WEBHOOK_INGRESS_OUTCOME_VALUES,
  WEBHOOK_ROUTE_LIFECYCLE,
  WEBHOOK_ROUTE_LIFECYCLE_VALUES,
  WEBHOOK_REPLAY_CLASSIFICATION,
  WEBHOOK_REPLAY_CLASSIFICATION_VALUES,
  WEBHOOK_ROUTING_OUTCOME,
  WEBHOOK_ROUTING_OUTCOME_VALUES,
  WEBHOOK_INGRESS_ENVELOPE_VERSION,
  WEBHOOK_ROUTE_DESCRIPTOR_VERSION,
  WEBHOOK_SUBSCRIPTION_DESCRIPTOR_VERSION,
  WEBHOOK_INGRESS_RECEIPT_VERSION,
  WEBHOOK_INGRESS_OBSERVATION_VERSION,
  WEBHOOK_TIMESTAMP_POLICY_VERSION,
  WEBHOOK_REPLAY_PROJECTION_VERSION,
  OBSERVATION_SOURCE_KIND,
  OBSERVATION_SOURCE_KIND_VALUES,
  CERTIFICATION_GATE_STATUS,
  CERTIFICATION_GATE_STATUS_VALUES,
  AGGREGATE_HEALTH_STATUS,
  AGGREGATE_HEALTH_STATUS_VALUES,
  INTEGRATION_OBSERVATION_VERSION,
  OBSERVATION_AGGREGATION_VERSION,
  AGGREGATE_HEALTH_READINESS_VERSION,
  AUDIT_SAFE_EVIDENCE_VERSION,
  CERTIFICATION_MATRIX_VERSION,
  STRUCTURAL_READINESS_VERSION,
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
  createSecretReference,
  isSecretReference,
  SECRET_REFERENCE_ERROR,
} from "./contracts/secretReference.js";

export {
  createCredentialRequirementDescriptor,
  isCredentialRequirementDescriptor,
  CREDENTIAL_REQUIREMENT_DESCRIPTOR_ERROR,
} from "./contracts/credentialRequirementDescriptor.js";

export {
  createEnvironmentClassification,
  evaluateEnvironmentEligibility,
  isEnvironmentClassification,
  ENVIRONMENT_CLASSIFICATION_ERROR,
} from "./contracts/environmentClassification.js";

export {
  createEndpointClassification,
  isEndpointClassPublicSafe,
  isEndpointClassification,
  ENDPOINT_CLASSIFICATION_ERROR,
} from "./contracts/endpointClassification.js";

export {
  projectClientSafePublicConfig,
  isClientSafePublicConfig,
  CLIENT_SAFE_PUBLIC_CONFIG_ERROR,
} from "./contracts/clientSafePublicConfigProjection.js";

export {
  createServerOnlyCredentialBoundary,
  isServerOnlyCredentialBoundary,
  SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR,
} from "./contracts/serverOnlyCredentialBoundary.js";

export {
  projectSecretBoundaryReadiness,
  SECRET_BOUNDARY_READINESS_ERROR,
} from "./contracts/secretBoundaryReadiness.js";

export {
  createRedactedDiagnostics,
  diagnosticsContainRedactedMarker,
  REDACTED_MARKER,
  REDACTED_DIAGNOSTICS_ERROR,
} from "./contracts/redactedDiagnostics.js";

export {
  isSecretShapedKey,
  isBrowserExposedSecretName,
  FORBIDDEN_SECRET_VALUE_FIELDS,
  SECRET_SHAPED_KEY_PATTERN,
  BROWSER_EXPOSED_SECRET_NAME_PATTERN,
} from "./contracts/secretBoundaryShared.js";

export {
  BROWSER_FORBIDDEN_SECRET_FIELD_NAMES,
  BROWSER_CLIENT_SAFE_CONFIG_KEYS,
  LEGACY_VITE_CREDENTIAL_ENV_NAME_PATTERN,
  isLegacyViteCredentialEnvName,
  isBrowserForbiddenSecretFieldName,
  isBrowserProviderCredentialResolved,
  createServerCredentialCutoverMarkers,
} from "./cutover/browserSecretCutoverPolicy.js";

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

export { createNoOpTestCredentialResolver } from "./resolvers/createNoOpTestCredentialResolver.js";

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

/** ECO-03 — provider adapter foundation */

export {
  createProviderAdapterDescriptor,
  isProviderAdapterDescriptor,
  PROVIDER_ADAPTER_DESCRIPTOR_ERROR,
} from "./contracts/providerAdapterDescriptor.js";

export {
  createConnectorCapabilityBinding,
  isConnectorCapabilityBinding,
  CONNECTOR_CAPABILITY_BINDING_ERROR,
} from "./contracts/connectorCapabilityBinding.js";

export {
  createProviderInvocationRequest,
  isProviderInvocationRequest,
  PROVIDER_INVOCATION_REQUEST_ERROR,
} from "./contracts/providerInvocationRequest.js";

export {
  createProviderInvocationResult,
  isProviderInvocationResult,
  PROVIDER_INVOCATION_RESULT_ERROR,
} from "./contracts/providerInvocationResult.js";

export {
  projectProviderAdapterReadiness,
  PROVIDER_ADAPTER_READINESS_ERROR,
} from "./contracts/providerAdapterReadiness.js";

export {
  createProviderAdapterObservation,
  PROVIDER_ADAPTER_OBSERVATION_ERROR,
} from "./contracts/providerAdapterObservation.js";

export {
  createDomainAdapterReadinessContract,
  createPaymentAdapterReadinessContract,
  createMessagingAdapterReadinessContract,
  createCalendarAdapterReadinessContract,
  createIdentityAdapterReadinessContract,
  createDataExchangeAdapterReadinessContract,
  DOMAIN_ADAPTER_READINESS_CONTRACT_ERROR,
} from "./contracts/domainAdapterReadinessContracts.js";

export {
  createProviderAdapterRegistry,
  PROVIDER_ADAPTER_REGISTRY_ERROR,
} from "./registry/createProviderAdapterRegistry.js";

export {
  selectProviderAdapter,
  PROVIDER_ADAPTER_SELECTION_ERROR,
} from "./selection/selectProviderAdapter.js";

export {
  createProviderAdapterPort,
  PROVIDER_ADAPTER_PORT_ERROR,
} from "./ports/providerAdapterPort.js";

export { mapProviderFailureToIntegrationError } from "./errors/mapProviderFailureToIntegrationError.js";

export { createNoOpProviderAdapter } from "./providers/createNoOpProviderAdapter.js";

export { createFakeProviderAdapter } from "./providers/createFakeProviderAdapter.js";

/** ECO-04 — webhook ingress foundation */

export {
  createWebhookIngressEnvelope,
  isWebhookIngressEnvelope,
  WEBHOOK_INGRESS_ENVELOPE_ERROR,
} from "./contracts/webhookIngressEnvelope.js";

export {
  createWebhookTimestampPolicy,
  classifyWebhookTimestampTolerance,
  DEFAULT_WEBHOOK_MAX_SKEW_SECONDS,
  WEBHOOK_TIMESTAMP_TOLERANCE_ERROR,
} from "./contracts/webhookTimestampTolerance.js";

export {
  createWebhookReplayProjection,
  evaluateWebhookReplayProjection,
  WEBHOOK_REPLAY_PROJECTION_ERROR,
} from "./contracts/webhookReplayProjection.js";

export {
  createWebhookRouteDescriptor,
  isWebhookRouteDescriptor,
  WEBHOOK_ROUTE_DESCRIPTOR_ERROR,
} from "./contracts/webhookRouteDescriptor.js";

export {
  createWebhookSubscriptionDescriptor,
  isWebhookSubscriptionDescriptor,
  WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR,
} from "./contracts/webhookSubscriptionDescriptor.js";

export {
  createWebhookIngressReceipt,
  isWebhookIngressReceipt,
  WEBHOOK_INGRESS_RECEIPT_ERROR,
} from "./contracts/webhookIngressReceipt.js";

export {
  createWebhookIngressObservation,
  WEBHOOK_INGRESS_OBSERVATION_ERROR,
} from "./contracts/webhookIngressObservation.js";

export {
  createWebhookRouteRegistry,
  WEBHOOK_ROUTE_REGISTRY_ERROR,
} from "./registry/createWebhookRouteRegistry.js";

export {
  routeWebhookIngress,
  WEBHOOK_INGRESS_ROUTING_ERROR,
} from "./routing/routeWebhookIngress.js";

export { mapWebhookFailureToIntegrationError } from "./errors/mapWebhookFailureToIntegrationError.js";

export { createFakeWebhookIngressHandler } from "./handlers/createFakeWebhookIngressHandler.js";

/** ECO-05 — observability & structural final certification */

export {
  createIntegrationObservation,
  projectCanonicalFromProviderAdapterObservation,
  projectCanonicalFromWebhookIngressObservation,
  INTEGRATION_OBSERVATION_ERROR,
} from "./contracts/integrationObservation.js";

export {
  aggregateIntegrationObservations,
  OBSERVATION_AGGREGATION_ERROR,
} from "./contracts/observationAggregation.js";

export {
  projectAggregateIntegrationHealth,
  AGGREGATE_HEALTH_READINESS_ERROR,
} from "./contracts/aggregateHealthReadiness.js";

export {
  projectAuditSafeEvidence,
  projectAuditSafeEvidenceFromObservation,
  AUDIT_SAFE_EVIDENCE_ERROR,
} from "./contracts/auditSafeEvidenceProjection.js";

export {
  projectCertificationMatrix,
  projectStructuralFoundationReadiness,
  CERTIFICATION_MATRIX_ERROR,
  STRUCTURAL_READINESS_ERROR,
} from "./contracts/certificationMatrix.js";
