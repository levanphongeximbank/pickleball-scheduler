/**
 * Provider-neutral adapter port — invoke contract without live network.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { INVOCATION_RESULT_STATUS } from "../constants/catalogues.js";
import { createProviderInvocationRequest } from "../contracts/providerInvocationRequest.js";
import { createProviderInvocationResult } from "../contracts/providerInvocationResult.js";
import { projectProviderAdapterReadiness } from "../contracts/providerAdapterReadiness.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";
import { mapProviderFailureToIntegrationError } from "../errors/mapProviderFailureToIntegrationError.js";
import { createProviderAdapterObservation } from "../contracts/providerAdapterObservation.js";

export const PROVIDER_ADAPTER_PORT_ERROR = Object.freeze({
  INVALID: "PROVIDER_ADAPTER_PORT_INVALID",
  DESCRIPTOR_INVALID: "PROVIDER_ADAPTER_PORT_DESCRIPTOR_INVALID",
  HANDLER_INVALID: "PROVIDER_ADAPTER_PORT_HANDLER_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createProviderAdapterPort(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_ADAPTER_PORT_ERROR.INVALID,
        "ProviderAdapterPort input must be a plain object"
      )
    );
  }

  const descriptor = input.descriptor;
  if (!descriptor || typeof descriptor.adapterId !== "string") {
    return fail(
      contractError(
        PROVIDER_ADAPTER_PORT_ERROR.DESCRIPTOR_INVALID,
        "descriptor is required",
        "descriptor"
      )
    );
  }

  if (typeof input.invokeHandler !== "function") {
    return fail(
      contractError(
        PROVIDER_ADAPTER_PORT_ERROR.HANDLER_INVALID,
        "invokeHandler must be a function",
        "invokeHandler"
      )
    );
  }

  const credentialPresent = input.credentialPresent === true;
  const productionReady = false;

  const port = {
    kind: "provider-adapter-port",
    productionReady,
    descriptor,
    getDescriptor() {
      return descriptor;
    },
    /**
     * @param {*} requestInput
     */
    invoke(requestInput) {
      const requestResult = createProviderInvocationRequest({
        ...requestInput,
        adapterId: requestInput?.adapterId ?? descriptor.adapterId,
      });
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const readiness = projectProviderAdapterReadiness({
        descriptor,
        environment: request.requestedEnvironment,
        capabilityId: request.capabilityId,
        credentialPresent,
      });
      if (!readiness.ok) return readiness;

      if (!readiness.value.operationallyReady) {
        const mapped = mapProviderFailureToIntegrationError({
          failureClass:
            readiness.value.blockedReason === "credential_required_absent"
              ? "authentication"
              : readiness.value.blockedReason === "capability_unsupported"
                ? "unsupported_capability"
                : "configuration",
          message: `Adapter not ready: ${readiness.value.blockedReason ?? "not_ready"}`,
          context: {
            adapterId: descriptor.adapterId,
            blockedReason: readiness.value.blockedReason,
          },
        });
        return ok(
          createProviderInvocationResult({
            requestId: request.requestId,
            resultStatus: INVOCATION_RESULT_STATUS.NO_READY_ADAPTER,
            adapterId: descriptor.adapterId,
            providerKey: descriptor.providerKey,
            completedAt: new Date().toISOString(),
            integrationError: mapped.integrationError,
            correlationId: request.correlationId,
            causationId: request.causationId,
            idempotencyKey: request.idempotencyKey,
            diagnostics: {
              readinessStatus: readiness.value.readinessStatus,
              blockedReason: readiness.value.blockedReason,
            },
          }).value
        );
      }

      if (!descriptor.supportedCapabilityIds.includes(request.capabilityId)) {
        const mapped = mapProviderFailureToIntegrationError({
          failureClass: "unsupported_capability",
          message: `Unsupported capability: ${request.capabilityId}`,
          context: { capabilityId: request.capabilityId },
        });
        return ok(
          createProviderInvocationResult({
            requestId: request.requestId,
            resultStatus: INVOCATION_RESULT_STATUS.UNSUPPORTED,
            adapterId: descriptor.adapterId,
            providerKey: descriptor.providerKey,
            completedAt: new Date().toISOString(),
            integrationError: mapped.integrationError,
            correlationId: request.correlationId,
            causationId: request.causationId,
            idempotencyKey: request.idempotencyKey,
          }).value
        );
      }

      /** @type {*} */
      let handlerResult;
      try {
        handlerResult = input.invokeHandler(request);
      } catch (err) {
        const mapped = mapProviderFailureToIntegrationError({
          failureClass: "internal",
          message: err instanceof Error ? err.message : "invokeHandler threw",
        });
        return ok(
          createProviderInvocationResult({
            requestId: request.requestId,
            resultStatus: INVOCATION_RESULT_STATUS.FAILED,
            adapterId: descriptor.adapterId,
            providerKey: descriptor.providerKey,
            completedAt: new Date().toISOString(),
            integrationError: mapped.integrationError,
            correlationId: request.correlationId,
            causationId: request.causationId,
            idempotencyKey: request.idempotencyKey,
          }).value
        );
      }

      if (handlerResult && handlerResult.ok === false && handlerResult.error) {
        const mapped = mapProviderFailureToIntegrationError(
          handlerResult.error
        );
        return ok(
          createProviderInvocationResult({
            requestId: request.requestId,
            resultStatus: INVOCATION_RESULT_STATUS.FAILED,
            adapterId: descriptor.adapterId,
            providerKey: descriptor.providerKey,
            completedAt: new Date().toISOString(),
            integrationError: mapped.integrationError,
            correlationId: request.correlationId,
            causationId: request.causationId,
            idempotencyKey: request.idempotencyKey,
            idempotencyOutcome: handlerResult.idempotencyOutcome,
          }).value
        );
      }

      const output =
        handlerResult && handlerResult.ok === true
          ? handlerResult.value
          : handlerResult;

      const result = createProviderInvocationResult({
        requestId: request.requestId,
        resultStatus:
          handlerResult?.resultStatus ?? INVOCATION_RESULT_STATUS.SUCCEEDED,
        adapterId: descriptor.adapterId,
        providerKey: descriptor.providerKey,
        completedAt: new Date().toISOString(),
        output: output ?? {},
        correlationId: request.correlationId,
        causationId: request.causationId,
        idempotencyKey: request.idempotencyKey,
        idempotencyOutcome: handlerResult?.idempotencyOutcome,
        providerReceiptRef: handlerResult?.providerReceiptRef,
        diagnostics: handlerResult?.diagnostics,
      });
      if (!result.ok) return result;

      const observation = createProviderAdapterObservation({
        observationId: `obs:${request.requestId}`,
        adapterId: descriptor.adapterId,
        requestId: request.requestId,
        correlationId: request.correlationId,
        resultStatus: result.value.resultStatus,
        attributes: {
          capabilityId: request.capabilityId,
          operation: request.operation,
          environment: request.requestedEnvironment,
        },
      });

      return ok(
        deepFreeze({
          ...result.value,
          ...(observation.ok ? { observation: observation.value } : {}),
        })
      );
    },
  };

  return ok(deepFreeze(port));
}
