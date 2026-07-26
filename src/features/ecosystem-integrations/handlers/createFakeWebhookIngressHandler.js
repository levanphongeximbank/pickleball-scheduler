/**
 * Deterministic fake webhook ingress handler — in-memory only, no network.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  IDEMPOTENCY_OUTCOME,
  WEBHOOK_INGRESS_OUTCOME,
  WEBHOOK_ROUTING_OUTCOME,
  WEBHOOK_VERIFICATION_OUTCOME,
} from "../constants/catalogues.js";
import { createWebhookIngressEnvelope } from "../contracts/webhookIngressEnvelope.js";
import { createWebhookIngressReceipt } from "../contracts/webhookIngressReceipt.js";
import { createWebhookIngressObservation } from "../contracts/webhookIngressObservation.js";
import { evaluateWebhookReplayProjection } from "../contracts/webhookReplayProjection.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import {
  createFakeWebhookVerifier,
  verifyWebhookRequestFailClosed,
} from "../ports/webhookVerificationPort.js";
import { routeWebhookIngress } from "../routing/routeWebhookIngress.js";
import { mapWebhookFailureToIntegrationError } from "../errors/mapWebhookFailureToIntegrationError.js";

/**
 * @param {{
 *   expectedBodyDigest: string,
 *   maxSkewSeconds?: number,
 *   registry?: object,
 *   priorProjections?: ReadonlyArray<*>,
 * }} config
 */
export function createFakeWebhookIngressHandler(config) {
  if (!isPlainObject(config) || typeof config.expectedBodyDigest !== "string") {
    throw new Error(
      "createFakeWebhookIngressHandler requires explicit expectedBodyDigest"
    );
  }

  const expectedBodyDigest = config.expectedBodyDigest.trim();
  const maxSkewSeconds =
    Number.isFinite(Number(config.maxSkewSeconds))
      ? Number(config.maxSkewSeconds)
      : 300;

  // Standalone verifier for tests. Ingress handle() does not consume its
  // seen-event memory — NEW/DUPLICATE/CONFLICT belong to replay projection.
  const verifier = createFakeWebhookVerifier({
    expectedBodyDigest,
    maxSkewSeconds,
    initialSeenEventIds: config.initialSeenEventIds,
  });

  /** @type {Array<object>} */
  const priorProjections = Array.isArray(config.priorProjections)
    ? [...config.priorProjections]
    : [];

  /** @type {Array<object>} */
  const receipts = [];

  return deepFreeze({
    kind: "fake-webhook-ingress-handler",
    verifier,
    listReceipts() {
      return Object.freeze([...receipts]);
    },
    listPriorProjections() {
      return Object.freeze([...priorProjections]);
    },
    /**
     * Process a webhook ingress request deterministically.
     * @param {*} requestInput
     */
    handle(requestInput) {
      const envelopeResult = createWebhookIngressEnvelope(requestInput);
      if (!envelopeResult.ok) {
        const mapped = mapWebhookFailureToIntegrationError({
          failureClass: "validation",
          message: envelopeResult.error.message,
          context: { field: envelopeResult.error.field },
        });
        const receipt = createWebhookIngressReceipt({
          ingressId:
            typeof requestInput?.ingressId === "string"
              ? requestInput.ingressId
              : "ingress-invalid",
          outcome: WEBHOOK_INGRESS_OUTCOME.FAILED,
          accepted: false,
          reason: "envelope_invalid",
          completedAt: new Date().toISOString(),
          retryClassification: mapped.retryClassification,
          diagnostics: { errorCode: mapped.integrationError.code },
        });
        if (receipt.ok) receipts.push(receipt.value);
        return receipt.ok ? ok(receipt.value) : receipt;
      }

      const envelope = envelopeResult.value;

      if (
        envelope.environment === "PRODUCTION" ||
        envelope.endpointClass === "PRODUCTION"
      ) {
        const mapped = mapWebhookFailureToIntegrationError({
          outcome: WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED,
          reason: "production_blocked",
        });
        const receipt = createWebhookIngressReceipt({
          ingressId: envelope.ingressId,
          outcome: WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED,
          accepted: false,
          reason: "production_blocked",
          completedAt: envelope.receivedAt,
          retryClassification: mapped.retryClassification,
        });
        if (receipt.ok) receipts.push(receipt.value);
        return receipt.ok ? ok(receipt.value) : receipt;
      }

      // Signature/timestamp only here — event replay is classified by
      // evaluateWebhookReplayProjection (NEW/DUPLICATE/CONFLICT).
      const verification = verifyWebhookRequestFailClosed({
        connectorId: envelope.connectorId,
        signatureHeader: envelope.signaturePresent ? "present" : "",
        timestamp: envelope.providerTimestamp,
        bodyDigest: envelope.bodyDigest,
        expectedBodyDigest,
        now: envelope.receivedAt,
        maxSkewSeconds,
      });

      if (!verification.ok || !verification.value.accepted) {
        const verificationOutcome =
          verification.ok && verification.value.outcome
            ? verification.value.outcome
            : WEBHOOK_VERIFICATION_OUTCOME.MALFORMED;
        const mapped = mapWebhookFailureToIntegrationError({
          verificationOutcome,
          reason: verification.ok ? verification.value.reason : "verify_failed",
        });
        const receipt = createWebhookIngressReceipt({
          ingressId: envelope.ingressId,
          outcome: WEBHOOK_INGRESS_OUTCOME.REJECTED_VERIFICATION,
          accepted: false,
          verificationOutcome,
          reason: verification.ok ? verification.value.reason : "verify_failed",
          completedAt: envelope.receivedAt,
          retryClassification: mapped.retryClassification,
        });
        if (receipt.ok) receipts.push(receipt.value);
        return receipt.ok ? ok(receipt.value) : receipt;
      }

      if (!config.registry) {
        const mapped = mapWebhookFailureToIntegrationError({
          outcome: WEBHOOK_INGRESS_OUTCOME.REJECTED_ROUTING,
          reason: "registry_missing",
        });
        const receipt = createWebhookIngressReceipt({
          ingressId: envelope.ingressId,
          outcome: WEBHOOK_INGRESS_OUTCOME.REJECTED_ROUTING,
          accepted: false,
          routingOutcome: WEBHOOK_ROUTING_OUTCOME.NO_MATCH,
          reason: "registry_missing",
          completedAt: envelope.receivedAt,
          retryClassification: mapped.retryClassification,
        });
        if (receipt.ok) receipts.push(receipt.value);
        return receipt.ok ? ok(receipt.value) : receipt;
      }

      const routing = routeWebhookIngress({
        registry: config.registry,
        routeKey: envelope.routeKey,
        environment: envelope.environment,
        providerEventType: envelope.providerEventType,
      });
      if (!routing.ok) return routing;

      if (routing.value.outcome !== WEBHOOK_ROUTING_OUTCOME.ROUTED) {
        const mapped = mapWebhookFailureToIntegrationError({
          outcome:
            routing.value.outcome === WEBHOOK_ROUTING_OUTCOME.PRODUCTION_BLOCKED
              ? WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED
              : WEBHOOK_INGRESS_OUTCOME.REJECTED_ROUTING,
          reason: routing.value.reason,
        });
        const receipt = createWebhookIngressReceipt({
          ingressId: envelope.ingressId,
          outcome:
            routing.value.outcome === WEBHOOK_ROUTING_OUTCOME.PRODUCTION_BLOCKED
              ? WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED
              : WEBHOOK_INGRESS_OUTCOME.REJECTED_ROUTING,
          accepted: false,
          routingOutcome: routing.value.outcome,
          reason: routing.value.reason,
          completedAt: envelope.receivedAt,
          retryClassification: mapped.retryClassification,
        });
        if (receipt.ok) receipts.push(receipt.value);
        return receipt.ok ? ok(receipt.value) : receipt;
      }

      const replay = evaluateWebhookReplayProjection(
        {
          scope: routing.value.selectedRouteId,
          providerEventId: envelope.providerEventId,
          bodyDigest: envelope.bodyDigest,
          fingerprint: envelope.bodyDigest,
        },
        priorProjections
      );
      if (!replay.ok) {
        return fail(replay.error);
      }

      if (replay.value.outcome === IDEMPOTENCY_OUTCOME.DUPLICATE) {
        const receipt = createWebhookIngressReceipt({
          ingressId: envelope.ingressId,
          outcome: WEBHOOK_INGRESS_OUTCOME.DUPLICATE,
          accepted: true,
          routeId: routing.value.selectedRouteId,
          subscriptionId: routing.value.selectedSubscriptionId,
          verificationOutcome: WEBHOOK_VERIFICATION_OUTCOME.VERIFIED,
          routingOutcome: WEBHOOK_ROUTING_OUTCOME.ROUTED,
          idempotencyOutcome: IDEMPOTENCY_OUTCOME.DUPLICATE,
          reason: "duplicate_ingress",
          completedAt: envelope.receivedAt,
        });
        if (receipt.ok) receipts.push(receipt.value);
        return receipt.ok ? ok(receipt.value) : receipt;
      }

      if (replay.value.outcome === IDEMPOTENCY_OUTCOME.CONFLICT) {
        const mapped = mapWebhookFailureToIntegrationError({
          outcome: WEBHOOK_INGRESS_OUTCOME.CONFLICT,
          reason: "idempotency_conflict",
        });
        const receipt = createWebhookIngressReceipt({
          ingressId: envelope.ingressId,
          outcome: WEBHOOK_INGRESS_OUTCOME.CONFLICT,
          accepted: false,
          routeId: routing.value.selectedRouteId,
          subscriptionId: routing.value.selectedSubscriptionId,
          verificationOutcome: WEBHOOK_VERIFICATION_OUTCOME.VERIFIED,
          routingOutcome: WEBHOOK_ROUTING_OUTCOME.ROUTED,
          idempotencyOutcome: IDEMPOTENCY_OUTCOME.CONFLICT,
          reason: "idempotency_conflict",
          completedAt: envelope.receivedAt,
          retryClassification: mapped.retryClassification,
        });
        if (receipt.ok) receipts.push(receipt.value);
        return receipt.ok ? ok(receipt.value) : receipt;
      }

      priorProjections.push(replay.value.projection);

      const receipt = createWebhookIngressReceipt({
        ingressId: envelope.ingressId,
        outcome: WEBHOOK_INGRESS_OUTCOME.ACCEPTED,
        accepted: true,
        routeId: routing.value.selectedRouteId,
        subscriptionId: routing.value.selectedSubscriptionId,
        verificationOutcome: WEBHOOK_VERIFICATION_OUTCOME.VERIFIED,
        routingOutcome: WEBHOOK_ROUTING_OUTCOME.ROUTED,
        idempotencyOutcome: IDEMPOTENCY_OUTCOME.NEW,
        reason: "accepted",
        completedAt: envelope.receivedAt,
        diagnostics: {
          handlerKey: routing.value.selectedSubscription?.handlerKey ?? null,
        },
      });
      if (!receipt.ok) return receipt;
      receipts.push(receipt.value);

      createWebhookIngressObservation({
        observationId: `obs:${envelope.ingressId}`,
        ingressId: envelope.ingressId,
        observedAt: envelope.receivedAt,
        routeId: routing.value.selectedRouteId,
        outcome: receipt.value.outcome,
        correlationId: envelope.correlationId,
        attributes: {
          verificationOutcome: WEBHOOK_VERIFICATION_OUTCOME.VERIFIED,
          idempotencyOutcome: IDEMPOTENCY_OUTCOME.NEW,
        },
      });

      return ok(receipt.value);
    },
  });
}
