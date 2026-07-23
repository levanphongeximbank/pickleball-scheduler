/**
 * Platform Error Descriptor contract (Platform Core Phase 1F–1J).
 *
 * Plain descriptor for a platform-level error representation. Not an Error
 * class, does not carry stack traces, HTTP mapping, or module error imports.
 */

import { fail, ok } from "./result.js";

/**
 * @typedef {{
 *   code: string,
 *   message: string,
 *   category?: string,
 *   field?: string,
 *   retryable?: boolean,
 * }} PlatformErrorDescriptor
 */

export const PLATFORM_ERROR_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "PLATFORM_ERROR_DESCRIPTOR_INVALID",
  CODE_INVALID: "PLATFORM_ERROR_DESCRIPTOR_CODE_INVALID",
  MESSAGE_INVALID: "PLATFORM_ERROR_DESCRIPTOR_MESSAGE_INVALID",
  CATEGORY_INVALID: "PLATFORM_ERROR_DESCRIPTOR_CATEGORY_INVALID",
  FIELD_INVALID: "PLATFORM_ERROR_DESCRIPTOR_FIELD_INVALID",
  RETRYABLE_INVALID: "PLATFORM_ERROR_DESCRIPTOR_RETRYABLE_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function platformErrorDescriptorError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @param {string} field
 * @param {string} errorCode
 * @param {string} label
 * @returns {import("./result.js").Result}
 */
function normalizeOptionalTrimmedString(input, field, errorCode, label) {
  if (!(field in input) || input[field] === undefined) {
    return ok(undefined);
  }

  if (typeof input[field] !== "string") {
    return fail(
      platformErrorDescriptorError(
        errorCode,
        `PlatformErrorDescriptor ${label} must be a string`,
        field
      )
    );
  }

  const normalized = input[field].trim();
  if (normalized.length === 0) {
    return fail(
      platformErrorDescriptorError(
        errorCode,
        `PlatformErrorDescriptor ${label} must be a non-empty string`,
        field
      )
    );
  }

  return ok(normalized);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createPlatformErrorDescriptor(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      platformErrorDescriptorError(
        PLATFORM_ERROR_DESCRIPTOR_ERROR.INVALID,
        "PlatformErrorDescriptor input must be a plain object"
      )
    );
  }

  if (typeof input.code !== "string") {
    return fail(
      platformErrorDescriptorError(
        PLATFORM_ERROR_DESCRIPTOR_ERROR.CODE_INVALID,
        "PlatformErrorDescriptor code must be a string",
        "code"
      )
    );
  }

  const code = input.code.trim();
  if (code.length === 0) {
    return fail(
      platformErrorDescriptorError(
        PLATFORM_ERROR_DESCRIPTOR_ERROR.CODE_INVALID,
        "PlatformErrorDescriptor code must be a non-empty string",
        "code"
      )
    );
  }

  if (typeof input.message !== "string") {
    return fail(
      platformErrorDescriptorError(
        PLATFORM_ERROR_DESCRIPTOR_ERROR.MESSAGE_INVALID,
        "PlatformErrorDescriptor message must be a string",
        "message"
      )
    );
  }

  const message = input.message.trim();
  if (message.length === 0) {
    return fail(
      platformErrorDescriptorError(
        PLATFORM_ERROR_DESCRIPTOR_ERROR.MESSAGE_INVALID,
        "PlatformErrorDescriptor message must be a non-empty string",
        "message"
      )
    );
  }

  const categoryResult = normalizeOptionalTrimmedString(
    input,
    "category",
    PLATFORM_ERROR_DESCRIPTOR_ERROR.CATEGORY_INVALID,
    "category"
  );
  if (!categoryResult.ok) return categoryResult;

  const fieldResult = normalizeOptionalTrimmedString(
    input,
    "field",
    PLATFORM_ERROR_DESCRIPTOR_ERROR.FIELD_INVALID,
    "field"
  );
  if (!fieldResult.ok) return fieldResult;

  /** @type {PlatformErrorDescriptor} */
  const descriptor = { code, message };

  if (categoryResult.value !== undefined) {
    descriptor.category = categoryResult.value;
  }
  if (fieldResult.value !== undefined) {
    descriptor.field = fieldResult.value;
  }

  if ("retryable" in input && input.retryable !== undefined) {
    if (typeof input.retryable !== "boolean") {
      return fail(
        platformErrorDescriptorError(
          PLATFORM_ERROR_DESCRIPTOR_ERROR.RETRYABLE_INVALID,
          "PlatformErrorDescriptor retryable must be a boolean",
          "retryable"
        )
      );
    }
    descriptor.retryable = input.retryable;
  }

  return ok(Object.freeze(descriptor));
}

/**
 * @param {*} value
 * @returns {value is PlatformErrorDescriptor}
 */
export function isPlatformErrorDescriptor(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (typeof value.code !== "string" || typeof value.message !== "string") {
    return false;
  }
  return createPlatformErrorDescriptor(value).ok === true;
}
