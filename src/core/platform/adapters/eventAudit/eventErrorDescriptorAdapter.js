/**
 * Event Error Descriptor Adapter — projects an already-resolved error-like
 * plain input into Platform Core PlatformErrorDescriptor.
 *
 * Does not accept arbitrary Error objects for hidden-field inference,
 * carry stacks, map HTTP status, rewrite registries, log, or emit telemetry.
 */

import { fail } from "../../contracts/result.js";
import { createPlatformErrorDescriptor } from "../../contracts/platformErrorDescriptor.js";

export const EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR = Object.freeze({
  INVALID: "EVENT_ERROR_DESCRIPTOR_ADAPTER_INVALID",
  CODE_REQUIRED: "EVENT_ERROR_DESCRIPTOR_ADAPTER_CODE_REQUIRED",
  MESSAGE_REQUIRED: "EVENT_ERROR_DESCRIPTOR_ADAPTER_MESSAGE_REQUIRED",
  RETRYABLE_INVALID: "EVENT_ERROR_DESCRIPTOR_ADAPTER_RETRYABLE_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * Project an explicit plain error-like input into PlatformErrorDescriptor.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectEventErrorDescriptor(input) {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input instanceof Error
  ) {
    return fail(
      adapterError(
        EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR.INVALID,
        "Event error descriptor input must be a plain object (not an Error)"
      )
    );
  }

  if (!("code" in input) || input.code === undefined) {
    return fail(
      adapterError(
        EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR.CODE_REQUIRED,
        "Event error descriptor projection requires an explicit code",
        "code"
      )
    );
  }

  if (!("message" in input) || input.message === undefined) {
    return fail(
      adapterError(
        EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR.MESSAGE_REQUIRED,
        "Event error descriptor projection requires an explicit message",
        "message"
      )
    );
  }

  if ("retryable" in input && input.retryable !== undefined) {
    if (typeof input.retryable !== "boolean") {
      return fail(
        adapterError(
          EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR.RETRYABLE_INVALID,
          "Event error descriptor retryable must be a strict boolean",
          "retryable"
        )
      );
    }
  }

  /** @type {{ code: *, message: *, category?: *, field?: *, retryable?: * }} */
  const payload = {
    code: input.code,
    message: input.message,
  };

  if ("category" in input && input.category !== undefined) {
    payload.category = input.category;
  }
  if ("field" in input && input.field !== undefined) {
    payload.field = input.field;
  }
  if ("retryable" in input && input.retryable !== undefined) {
    payload.retryable = input.retryable;
  }

  return createPlatformErrorDescriptor(payload);
}
