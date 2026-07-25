/**
 * Deterministic fake provider adapter — canned responses, no network.
 */

import { fail } from "../../../core/platform/index.js";
import { IDEMPOTENCY_OUTCOME } from "../constants/catalogues.js";
import { createProviderAdapterDescriptor } from "../contracts/providerAdapterDescriptor.js";
import { createProviderAdapterPort } from "../ports/providerAdapterPort.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

/**
 * @param {object} [options]
 */
export function createFakeProviderAdapter(options = {}) {
  if (options != null && !isPlainObject(options)) {
    throw new Error("createFakeProviderAdapter options must be a plain object");
  }

  const descriptorResult = createProviderAdapterDescriptor({
    adapterId: options.adapterId ?? "eco.adapter.fake",
    providerKey: options.providerKey ?? "fake.adapter",
    connectorKind: options.connectorKind ?? "GENERIC",
    supportedCapabilityIds: options.supportedCapabilityIds ?? [
      "eco.capability.fake.invoke",
    ],
    supportedInvocationModes: ["SYNC"],
    supportedEnvironments: options.supportedEnvironments ?? [
      "TEST",
      "SANDBOX",
      "STAGING",
    ],
    lifecycleState: options.lifecycleState ?? "ACTIVE",
    credentialRequirement: options.credentialRequirement ?? "NONE",
    retrySupport: options.retrySupport ?? true,
    idempotencySupport: true,
    webhookSupport: false,
    enabled: options.enabled ?? true,
    priority: options.priority ?? 100,
    publicMetadata: {
      purpose: "deterministic-fake-adapter",
      network: false,
      productionBlocked: true,
    },
  });
  if (!descriptorResult.ok) {
    throw new Error(
      `Invalid fake adapter descriptor: ${descriptorResult.error.message}`
    );
  }

  const responses =
    options.responses && isPlainObject(options.responses)
      ? deepFreeze({ ...options.responses })
      : deepFreeze({
          PING: { ok: true, fake: true, pong: true },
          INVOKE: { ok: true, fake: true, echoed: true },
        });

  /** @type {Map<string, string>} */
  const seenIdempotency = new Map();
  let invokeCount = 0;

  const portResult = createProviderAdapterPort({
    descriptor: descriptorResult.value,
    credentialPresent: options.credentialPresent === true,
    invokeHandler(request) {
      invokeCount += 1;
      const fingerprint = JSON.stringify({
        operation: request.operation,
        payload: request.payload,
      });

      if (request.idempotencyKey) {
        const prior = seenIdempotency.get(request.idempotencyKey);
        if (prior != null) {
          if (prior === fingerprint) {
            return {
              ok: true,
              value: deepFreeze({
                ok: true,
                fake: true,
                replayed: true,
                invokeCount,
              }),
              idempotencyOutcome: IDEMPOTENCY_OUTCOME.DUPLICATE,
              providerReceiptRef: `fake-receipt:${request.idempotencyKey}`,
            };
          }
          return {
            ok: false,
            error: {
              failureClass: "conflict",
              message: "Idempotency key conflict",
              context: { idempotencyKey: request.idempotencyKey },
            },
            idempotencyOutcome: IDEMPOTENCY_OUTCOME.CONFLICT,
          };
        }
        seenIdempotency.set(request.idempotencyKey, fingerprint);
      }

      if (options.forcedFailureClass) {
        return fail({
          failureClass: options.forcedFailureClass,
          message: options.forcedFailureMessage ?? "Forced fake failure",
        });
      }

      const canned = responses[request.operation];
      if (!canned) {
        return fail({
          failureClass: "unsupported_capability",
          message: `Unsupported operation: ${request.operation}`,
          context: { operation: request.operation },
        });
      }

      return {
        ok: true,
        value: deepFreeze({
          ...canned,
          invokeCount,
          echoedPayload: request.payload,
        }),
        idempotencyOutcome: request.idempotencyKey
          ? IDEMPOTENCY_OUTCOME.NEW
          : undefined,
        providerReceiptRef: request.idempotencyKey
          ? `fake-receipt:${request.idempotencyKey}`
          : `fake-receipt:${request.requestId}`,
      };
    },
  });
  if (!portResult.ok) {
    throw new Error(`Invalid fake adapter port: ${portResult.error.message}`);
  }

  return deepFreeze({
    kind: "fake-provider-adapter",
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
