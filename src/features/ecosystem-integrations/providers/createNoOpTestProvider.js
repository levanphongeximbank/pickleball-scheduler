/**
 * Deterministic no-op / test provider.
 * No network. No env. No global registration.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { INTEGRATION_ERROR_CODE } from "../constants/catalogues.js";
import { createIntegrationError } from "../errors/errorTaxonomy.js";
import { createProviderCapabilityDescriptor } from "../contracts/providerCapabilityDescriptor.js";
import { createConnectorDescriptor } from "../contracts/connectorDescriptor.js";
import {
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";

/**
 * @param {object} [options]
 */
export function createNoOpTestProvider(options = {}) {
  if (options != null && !isPlainObject(options)) {
    throw new Error("createNoOpTestProvider options must be a plain object");
  }

  const connectorResult = createConnectorDescriptor({
    connectorId: options.connectorId ?? "eco.noop.test",
    kind: options.kind ?? "GENERIC",
    providerKey: options.providerKey ?? "noop.test",
    direction: options.direction ?? "BIDIRECTIONAL",
    supportedCapabilities: options.supportedCapabilities ?? [
      "eco.capability.noop.invoke",
    ],
    environmentEligibility: options.environmentEligibility ?? [
      "TEST",
      "SANDBOX",
    ],
    lifecycleState: options.lifecycleState ?? "READY",
    publicMetadata: {
      purpose: "deterministic-test-double",
      network: false,
    },
  });
  if (!connectorResult.ok) {
    throw new Error(`Invalid no-op connector: ${connectorResult.error.message}`);
  }

  const capabilityResult = createProviderCapabilityDescriptor({
    capabilityId: options.capabilityId ?? "eco.capability.noop.invoke",
    supportedOperations: options.supportedOperations ?? ["INVOKE", "PING"],
    deliveryModes: ["SYNC"],
    sandboxSupport: true,
    idempotencySupport: true,
    webhookSupport: false,
    credentialRequirement: "NONE",
    retrySemantics: { supportsRetry: false, maxAttemptsHint: 0 },
  });
  if (!capabilityResult.ok) {
    throw new Error(
      `Invalid no-op capability: ${capabilityResult.error.message}`
    );
  }

  const responses =
    options.responses && isPlainObject(options.responses)
      ? deepFreeze({ ...options.responses })
      : deepFreeze({
          PING: { ok: true, pong: true },
          INVOKE: { ok: true, echoed: true },
        });

  let invokeCount = 0;

  return deepFreeze({
    kind: "noop-test-provider",
    productionReady: false,
    connector: connectorResult.value,
    capability: capabilityResult.value,
    getConnectorDescriptor() {
      return connectorResult.value;
    },
    getCapabilityDescriptor() {
      return capabilityResult.value;
    },
    /**
     * @param {string} operation
     * @param {object} [payload]
     */
    invoke(operation, payload = {}) {
      if (typeof operation !== "string" || operation.trim().length === 0) {
        return fail(
          createIntegrationError(
            INTEGRATION_ERROR_CODE.VALIDATION,
            "operation must be a non-empty string",
            { field: "operation" }
          )
        );
      }
      const op = operation.trim();
      if (!capabilityResult.value.supportedOperations.includes(op)) {
        return fail(
          createIntegrationError(
            INTEGRATION_ERROR_CODE.UNSUPPORTED_CAPABILITY,
            `Unsupported operation: ${op}`,
            { operation: op }
          )
        );
      }
      invokeCount += 1;
      const canned = responses[op] ?? { ok: true, operation: op };
      return ok(
        deepFreeze({
          operation: op,
          invokeCount,
          payload: isPlainObject(payload) ? deepFreeze({ ...payload }) : null,
          result: canned,
        })
      );
    },
    getInvokeCount() {
      return invokeCount;
    },
  });
}
