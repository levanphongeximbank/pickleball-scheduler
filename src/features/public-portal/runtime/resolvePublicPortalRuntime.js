/**
 * Resolve Public Portal catalog authority for clubs/courts discovery surfaces.
 *
 * HC ON: canonical public-catalog only — no localStorage SoT, no mock-on-empty,
 * no demo-club fallback. Fail closed to UNAVAILABLE when local/demo would be used.
 *
 * HC OFF: controlled legacy/demo preview may remain, explicitly labeled.
 */

import {
  getRuntimeAuthorityEntry,
  isPlatformHardCutoverEnabled,
} from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertPublicPortalLocalAuthorityAllowed,
  assertPublicPortalMockFallbackAllowed,
} from "../../platform-hard-cutover/legacyAuthorityPolicy.js";
import {
  PUBLIC_PORTAL_LEGACY_DEMO_BANNER,
  PUBLIC_PORTAL_MISSING_ID_USER_MESSAGE,
  PUBLIC_PORTAL_RUNTIME_ERROR_CODE,
  PUBLIC_PORTAL_RUNTIME_MODE,
  PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
} from "./constants.js";

/**
 * @param {{
 *   env?: Record<string, unknown>,
 *   hardCutover?: boolean,
 *   sourceMode?: "local"|"remote"|string|null,
 *   publicId?: string|null,
 * }} [input]
 */
export function resolvePublicPortalRuntime(input = {}) {
  const env = input.env && typeof input.env === "object" ? input.env : {};
  const hardCutover =
    input.hardCutover === true || isPlatformHardCutoverEnabled(env);
  const matrix = getRuntimeAuthorityEntry("public_catalog");
  const sourceMode = String(input.sourceMode || "").trim().toLowerCase() || null;
  const publicId =
    input.publicId == null || input.publicId === ""
      ? null
      : String(input.publicId).trim();

  if (hardCutover) {
    const localBlocked = assertPublicPortalLocalAuthorityAllowed(env);
    const mockBlocked = assertPublicPortalMockFallbackAllowed(env);
    return Object.freeze({
      mode: PUBLIC_PORTAL_RUNTIME_MODE.UNAVAILABLE,
      code:
        matrix?.failClosedError ||
        localBlocked.code ||
        mockBlocked.code ||
        PUBLIC_PORTAL_RUNTIME_ERROR_CODE.AUTHORITY_UNAVAILABLE,
      userMessage: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
      allowsLocalStorage: false,
      allowsMockFallback: false,
      allowsDemoClubFallback: false,
      requiresCanonicalRemote: true,
      isHardCutover: true,
      isDemoMode: false,
      demoBanner: null,
      legacyBlocked: true,
      sourceMode: "remote",
      publicId,
      matrixDomain: "public_catalog",
    });
  }

  if (publicId === "demo-club") {
    return Object.freeze({
      mode: PUBLIC_PORTAL_RUNTIME_MODE.MISSING_SCOPE,
      code: PUBLIC_PORTAL_RUNTIME_ERROR_CODE.INVALID_PUBLIC_ID,
      userMessage: PUBLIC_PORTAL_MISSING_ID_USER_MESSAGE,
      allowsLocalStorage: false,
      allowsMockFallback: false,
      allowsDemoClubFallback: false,
      requiresCanonicalRemote: false,
      isHardCutover: false,
      isDemoMode: false,
      demoBanner: null,
      legacyBlocked: false,
      sourceMode,
      publicId: null,
      matrixDomain: "public_catalog",
    });
  }

  if (sourceMode === "remote") {
    return Object.freeze({
      mode: PUBLIC_PORTAL_RUNTIME_MODE.CANONICAL_READY,
      code: null,
      userMessage: null,
      allowsLocalStorage: false,
      allowsMockFallback: false,
      allowsDemoClubFallback: false,
      requiresCanonicalRemote: true,
      isHardCutover: false,
      isDemoMode: false,
      demoBanner: null,
      legacyBlocked: false,
      sourceMode: "remote",
      publicId,
      matrixDomain: "public_catalog",
    });
  }

  return Object.freeze({
    mode: PUBLIC_PORTAL_RUNTIME_MODE.LEGACY_DEMO,
    code: null,
    userMessage: PUBLIC_PORTAL_LEGACY_DEMO_BANNER,
    allowsLocalStorage: true,
    allowsMockFallback: true,
    allowsDemoClubFallback: false,
    requiresCanonicalRemote: false,
    isHardCutover: false,
    isDemoMode: true,
    demoBanner: PUBLIC_PORTAL_LEGACY_DEMO_BANNER,
    legacyBlocked: false,
    sourceMode: sourceMode || "local",
    publicId,
    matrixDomain: "public_catalog",
  });
}

/**
 * Map a PublicDataResult (+ runtime) into a discrete UI state mode.
 * Does not invent data.
 *
 * @param {{
 *   runtime?: ReturnType<typeof resolvePublicPortalRuntime>,
 *   status?: string|null,
 *   source?: string|null,
 *   data?: unknown,
 *   loading?: boolean,
 * }} [input]
 */
export function resolvePublicPortalViewState(input = {}) {
  if (input.loading) {
    return PUBLIC_PORTAL_RUNTIME_MODE.LOADING;
  }

  const runtime = input.runtime;
  if (runtime?.isHardCutover && runtime.requiresCanonicalRemote) {
    // Canonical remote path still owns empty/ready/error after load completes.
    // Pre-load / blocked local authority stays UNAVAILABLE only when no result yet.
    if (input.status == null) {
      return PUBLIC_PORTAL_RUNTIME_MODE.UNAVAILABLE;
    }
  }

  const status = String(input.status || "").trim().toUpperCase();
  const data = input.data;
  const isEmptyArray = Array.isArray(data) && data.length === 0;

  if (status === "ERROR") return PUBLIC_PORTAL_RUNTIME_MODE.ERROR;
  if (status === "UNAVAILABLE") return PUBLIC_PORTAL_RUNTIME_MODE.UNAVAILABLE;
  if (status === "EMPTY" || isEmptyArray) {
    return PUBLIC_PORTAL_RUNTIME_MODE.CANONICAL_EMPTY;
  }
  if (status === "SUCCESS") {
    if (runtime?.isDemoMode || String(input.source || "").toLowerCase() === "mock") {
      return PUBLIC_PORTAL_RUNTIME_MODE.LEGACY_DEMO;
    }
    if (String(input.source || "").toLowerCase() === "mixed") {
      return PUBLIC_PORTAL_RUNTIME_MODE.LEGACY_DEMO;
    }
    return PUBLIC_PORTAL_RUNTIME_MODE.CANONICAL_READY;
  }

  if (runtime?.mode === PUBLIC_PORTAL_RUNTIME_MODE.MISSING_SCOPE) {
    return PUBLIC_PORTAL_RUNTIME_MODE.MISSING_SCOPE;
  }

  return PUBLIC_PORTAL_RUNTIME_MODE.UNAVAILABLE;
}

/**
 * Sanitize operational errors for public UI — never leak raw backend details.
 * @param {unknown} error
 * @param {string} [fallback]
 */
export function sanitizePublicPortalUserMessage(
  error,
  fallback = PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE
) {
  if (error == null) return fallback;
  if (typeof error === "string") {
    const text = error.trim();
    if (!text) return fallback;
    if (
      /supabase|postgres|stack|rpc|jwt|service_role|eyJ[A-Za-z0-9_-]{10,}/i.test(
        text
      ) ||
      text.length > 220
    ) {
      return fallback;
    }
    // Prefer Vietnamese operational copy over raw English codes.
    if (/^[A-Z][A-Z0-9_]{3,}$/.test(text)) return fallback;
    return text;
  }
  if (typeof error === "object") {
    const userMessage =
      /** @type {{ userMessage?: unknown, message?: unknown }} */ (error)
        .userMessage;
    if (typeof userMessage === "string" && userMessage.trim()) {
      return sanitizePublicPortalUserMessage(userMessage, fallback);
    }
    const message =
      /** @type {{ message?: unknown }} */ (error).message;
    if (typeof message === "string" && message.trim()) {
      return sanitizePublicPortalUserMessage(message, fallback);
    }
  }
  return fallback;
}
