/**
 * Deterministic no-op provider adapter — no network, no env, no secrets.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { createProviderAdapterDescriptor } from "../contracts/providerAdapterDescriptor.js";
import { createProviderAdapterPort } from "../ports/providerAdapterPort.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

/**
 * @param {object} [options]
 */
export function createNoOpProviderAdapter(options = {}) {
  if (options != null && !isPlainObject(options)) {
    throw new Error("createNoOpProviderAdapter options must be a plain object");
  }

  const descriptorResult = createProviderAdapterDescriptor({
    adapterId: options.adapterId ?? "eco.adapter.noop",
    providerKey: options.providerKey ?? "noop.adapter",
    connectorKind: options.connectorKind ?? "GENERIC",
    supportedCapabilityIds: options.supportedCapabilityIds ?? [
      "eco.capability.noop.invoke",
    ],
    supportedInvocationModes: ["SYNC"],
    supportedEnvironments: options.supportedEnvironments ?? ["TEST", "SANDBOX"],
    lifecycleState: options.lifecycleState ?? "ACTIVE",
    credentialRequirement: options.credentialRequirement ?? "NONE",
    retrySupport: false,
    idempotencySupport: true,
    webhookSupport: false,
    enabled: options.enabled ?? true,
    priority: options.priority ?? 50,
    publicMetadata: {
      purpose: "deterministic-noop-adapter",
      network: false,
      productionBlocked: true,
    },
  });
  if (!descriptorResult.ok) {
    throw new Error(
      `Invalid no-op adapter descriptor: ${descriptorResult.error.message}`
    );
  }

  let invokeCount = 0;

  const portResult = createProviderAdapterPort({
    descriptor: descriptorResult.value,
    credentialPresent: options.credentialPresent === true,
    invokeHandler(request) {
      invokeCount += 1;
      if (request.operation === "PING") {
        return ok(
          deepFreeze({
            ok: true,
            pong: true,
            invokeCount,
            echoedPayload: request.payload,
          })
        );
      }
      if (request.operation === "INVOKE" || request.operation === "NOOP") {
        return ok(
          deepFreeze({
            ok: true,
            noop: true,
            invokeCount,
            echoedPayload: request.payload,
          })
        );
      }
      return fail({
        failureClass: "unsupported_capability",
        message: `Unsupported operation: ${request.operation}`,
        context: { operation: request.operation },
      });
    },
  });
  if (!portResult.ok) {
    throw new Error(`Invalid no-op adapter port: ${portResult.error.message}`);
  }

  return deepFreeze({
    kind: "noop-provider-adapter",
    productionReady: false,
    descriptor: descriptorResult.value,
    port: portResult.value,
    invoke(requestInput) {
      return portResult.value.invoke(requestInput);
    },
    getInvokeCount() {
      return invokeCount;
    },
  });
}
