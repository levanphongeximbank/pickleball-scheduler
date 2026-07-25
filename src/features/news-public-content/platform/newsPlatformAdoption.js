/**
 * Platform Core adoption — consume public barrel only (NEWS-01).
 */

import {
  fail,
  ok,
  isOk,
  isFail,
  parseIsoStrict,
  projectTenantScope,
  projectIdentityActor,
} from "../../../core/platform/index.js";
import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

export const NEWS_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "NEWS_PLATFORM_ADAPTER_INVALID",
  ACTOR_REQUIRED: "NEWS_PLATFORM_ADAPTER_ACTOR_REQUIRED",
  TENANT_REQUIRED: "NEWS_PLATFORM_ADAPTER_TENANT_REQUIRED",
  INSTANT_INVALID: "NEWS_PLATFORM_ADAPTER_INSTANT_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) error.field = field;
  return Object.freeze(error);
}

/**
 * Wrap a successful News domain value in Platform Result.
 * @param {*} value
 * @param {*} [metadata]
 */
export function newsOk(value, metadata) {
  return arguments.length > 1 ? ok(value, metadata) : ok(value);
}

/**
 * Wrap a News typed error / descriptor in Platform Result fail.
 * @param {*} error
 * @param {*} [metadata]
 */
export function newsFail(error, metadata) {
  return arguments.length > 1 ? fail(error, metadata) : fail(error);
}

/**
 * Normalize caught errors into Platform fail results.
 * @param {unknown} err
 */
export function newsFailFromCaught(err) {
  if (
    err &&
    typeof err === "object" &&
    /** @type {{ name?: string, code?: string, message?: string, details?: * }} */ (err)
      .name === "NewsPublicContentError"
  ) {
    const e = /** @type {{ code: string, message: string, details?: * }} */ (err);
    return fail(
      Object.freeze({
        code: e.code,
        message: e.message,
        details: e.details || {},
      })
    );
  }
  return fail(
    Object.freeze({
      code: NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      message: err instanceof Error ? err.message : "Unknown news error",
      details: {},
    })
  );
}

/**
 * Project editorial actor onto Platform identity actor contract.
 * @param {*} input
 */
export function projectNewsActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NEWS_PLATFORM_ADAPTER_ERROR.INVALID,
        "News actor input must be a plain object"
      )
    );
  }
  const actorId =
    input.actorId ?? input.userId ?? input.authUserId ?? input.authorId;
  if (actorId == null || actorId === "") {
    return fail(
      adapterError(
        NEWS_PLATFORM_ADAPTER_ERROR.ACTOR_REQUIRED,
        "News actor projection requires actorId",
        "actorId"
      )
    );
  }
  return projectIdentityActor({
    actorId: String(actorId),
    actorType: input.actorType || "USER",
  });
}

/**
 * Project tenant scope for scoped content operations.
 * @param {*} input
 */
export function projectNewsTenantScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NEWS_PLATFORM_ADAPTER_ERROR.INVALID,
        "News tenant scope input must be a plain object"
      )
    );
  }
  if (input.tenantId == null || input.tenantId === "") {
    return fail(
      adapterError(
        NEWS_PLATFORM_ADAPTER_ERROR.TENANT_REQUIRED,
        "tenantId is required for tenant-scoped news projection",
        "tenantId"
      )
    );
  }
  return projectTenantScope({
    scopeType: input.scopeType || "TENANT",
    tenantId: String(input.tenantId),
  });
}

/**
 * Validate an operation timestamp via Platform parseIsoStrict.
 * @param {unknown} value
 */
export function projectNewsOperationInstant(value) {
  const parsed = parseIsoStrict(value);
  if (!parsed.ok) {
    return fail(
      adapterError(
        NEWS_PLATFORM_ADAPTER_ERROR.INSTANT_INVALID,
        "Operation instant must be a strict ISO timestamp with timezone",
        "now"
      )
    );
  }
  return parsed;
}

/**
 * Assert Platform Core Result + clock surface is available (read-only).
 */
export function assertNewsPlatformSurface() {
  return deepFreeze({
    hasResultEnvelope: typeof ok === "function" && typeof fail === "function",
    hasIsoClock: typeof parseIsoStrict === "function",
    hasTenantScope: typeof projectTenantScope === "function",
    hasIdentityActor: typeof projectIdentityActor === "function",
    ready:
      typeof ok === "function" &&
      typeof fail === "function" &&
      typeof parseIsoStrict === "function",
  });
}

export { ok, fail, isOk, isFail, parseIsoStrict };
