/**
 * Sandbox / disabled provider adapters for the delivery worker — Phase 1.5.
 *
 * Rules:
 * - delivery_mode is always explicit (sandbox | disabled)
 * - live mode is blocked (no silent fallback)
 * - no provider secrets; no live Email/SMS/Zalo/Web Push
 */

import {
  classifyDeliveryFailure,
  sanitizeDeliveryErrorMessage,
} from "../services/deliveryFailureClassification.js";

export const DELIVERY_MODES = Object.freeze({
  SANDBOX: "sandbox",
  DISABLED: "disabled",
  LIVE: "live",
});

export const WORKER_PROVIDERS = Object.freeze({
  IN_APP: "in_app",
  EMAIL_SANDBOX: "email_sandbox",
  SMS_SANDBOX: "sms_sandbox",
  ZALO_SANDBOX: "zalo_sandbox",
  WEB_PUSH_DISABLED: "web_push_disabled",
});

const CHANNEL_TO_PROVIDER = Object.freeze({
  in_app: WORKER_PROVIDERS.IN_APP,
  email: WORKER_PROVIDERS.EMAIL_SANDBOX,
  sms: WORKER_PROVIDERS.SMS_SANDBOX,
  zalo: WORKER_PROVIDERS.ZALO_SANDBOX,
  push: WORKER_PROVIDERS.WEB_PUSH_DISABLED,
});

function baseResult(partial) {
  return {
    ok: false,
    deliveryMode: DELIVERY_MODES.SANDBOX,
    provider: null,
    providerMessageId: null,
    errorCode: null,
    error: null,
    retryable: false,
    ...partial,
  };
}

/**
 * Resolve worker-facing adapter for a channel.
 * Live mode is always rejected in Phase 1.5.
 */
export function resolveWorkerProviderAdapter(channel, { mode = DELIVERY_MODES.SANDBOX } = {}) {
  const ch = String(channel || "").trim().toLowerCase();
  if (mode === DELIVERY_MODES.LIVE) {
    return {
      channel: ch,
      provider: CHANNEL_TO_PROVIDER[ch] || "unknown",
      deliveryMode: DELIVERY_MODES.LIVE,
      async send() {
        return baseResult({
          ok: false,
          deliveryMode: DELIVERY_MODES.LIVE,
          provider: CHANNEL_TO_PROVIDER[ch] || "unknown",
          errorCode: "live_mode_blocked",
          error: sanitizeDeliveryErrorMessage("Live delivery is blocked in Phase 1.5."),
          retryable: false,
          ...classifyDeliveryFailure({ errorCode: "live_mode_blocked" }),
        });
      },
    };
  }

  if (ch === "push") {
    return {
      channel: ch,
      provider: WORKER_PROVIDERS.WEB_PUSH_DISABLED,
      deliveryMode: DELIVERY_MODES.DISABLED,
      async send() {
        return baseResult({
          ok: false,
          deliveryMode: DELIVERY_MODES.DISABLED,
          provider: WORKER_PROVIDERS.WEB_PUSH_DISABLED,
          errorCode: "disabled_provider",
          error: sanitizeDeliveryErrorMessage("Web Push is disabled in Phase 1.5."),
          retryable: false,
          class: "PERMANENT",
        });
      },
    };
  }

  if (ch === "in_app") {
    return {
      channel: ch,
      provider: WORKER_PROVIDERS.IN_APP,
      deliveryMode: DELIVERY_MODES.SANDBOX,
      async send(input = {}) {
        // In-app delivery is fulfilled by the existing notification_inbox row.
        if (!input.notificationId && !input.inboxRow) {
          return baseResult({
            ok: false,
            provider: WORKER_PROVIDERS.IN_APP,
            errorCode: "malformed_payload",
            error: sanitizeDeliveryErrorMessage("in_app requires notification inbox row."),
            retryable: false,
            class: "PERMANENT",
          });
        }
        const existingId =
          input.inboxRow?.notificationId ||
          input.inboxRow?.id ||
          input.notificationId;
        return baseResult({
          ok: true,
          deliveryMode: DELIVERY_MODES.SANDBOX,
          provider: WORKER_PROVIDERS.IN_APP,
          providerMessageId: `in_app:${existingId}`,
          reusedInbox: true,
          errorCode: null,
          error: null,
          retryable: false,
        });
      },
    };
  }

  if (ch === "email" || ch === "sms" || ch === "zalo") {
    const provider = CHANNEL_TO_PROVIDER[ch];
    return {
      channel: ch,
      provider,
      deliveryMode: DELIVERY_MODES.SANDBOX,
      async send(input = {}) {
        if (input.simulateFailure) {
          const errorCode = input.errorCode || "provider_unavailable";
          const classified = classifyDeliveryFailure({
            errorCode,
            message: input.errorMessage || "",
          });
          return baseResult({
            ok: false,
            provider,
            errorCode: classified.errorCode,
            error: sanitizeDeliveryErrorMessage(
              input.errorMessage || `Sandbox ${ch} failure (${errorCode})`
            ),
            retryable: classified.retryable,
            class: classified.class,
          });
        }
        if (input.simulatePermanentFailure) {
          const errorCode = input.errorCode || "invalid_recipient";
          const classified = classifyDeliveryFailure({ errorCode });
          return baseResult({
            ok: false,
            provider,
            errorCode: classified.errorCode,
            error: sanitizeDeliveryErrorMessage(
              input.errorMessage || `Sandbox ${ch} permanent failure`
            ),
            retryable: false,
            class: "PERMANENT",
          });
        }
        const seed =
          input.deliveryIdempotencyKey ||
          input.notificationId ||
          `${ch}_${Date.now()}`;
        return baseResult({
          ok: true,
          provider,
          deliveryMode: DELIVERY_MODES.SANDBOX,
          providerMessageId: `sandbox_${ch}_${String(seed).slice(0, 48)}`,
          errorCode: null,
          error: null,
          retryable: false,
        });
      },
    };
  }

  return {
    channel: ch,
    provider: "unsupported",
    deliveryMode: DELIVERY_MODES.DISABLED,
    async send() {
      return baseResult({
        ok: false,
        deliveryMode: DELIVERY_MODES.DISABLED,
        provider: "unsupported",
        errorCode: "unsupported_channel",
        error: sanitizeDeliveryErrorMessage(`Unsupported channel: ${ch}`),
        retryable: false,
        class: "PERMANENT",
      });
    },
  };
}
