/**
 * Resolve CRM legacy UI/runtime mode for /crm/* pages.
 */

import {
  HARD_CUTOVER_FLAG,
  getRuntimeAuthorityEntry,
  isPlatformHardCutoverEnabled,
} from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertCrmDemoClubFallbackAllowed,
  assertCrmLocalStorageAuthorityAllowed,
} from "../../platform-hard-cutover/legacyAuthorityPolicy.js";
import {
  CRM_LEGACY_DEMO_BANNER,
  CRM_LEGACY_ERROR_CODE,
  CRM_LEGACY_MISSING_CLUB_USER_MESSAGE,
  CRM_LEGACY_RUNTIME_MODE,
  CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
  DEMO_CLUB_ID,
} from "./constants.js";

export { HARD_CUTOVER_FLAG };

/**
 * @param {{ env?: Record<string, unknown>, clubId?: string|null, hardCutover?: boolean }} [input]
 */
export function resolveCrmLegacyRuntime(input = {}) {
  const env = input.env && typeof input.env === "object" ? input.env : {};
  const hardCutover =
    input.hardCutover === true || isPlatformHardCutoverEnabled(env);
  const matrix = getRuntimeAuthorityEntry("crm");
  const rawClubId = String(input.clubId || "").trim();

  if (hardCutover) {
    return Object.freeze({
      mode: CRM_LEGACY_RUNTIME_MODE.UNAVAILABLE,
      code: matrix?.failClosedError || CRM_LEGACY_ERROR_CODE.AUTHORITY_UNAVAILABLE,
      userMessage: CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "crm",
    });
  }

  if (!rawClubId || rawClubId === DEMO_CLUB_ID) {
    return Object.freeze({
      mode: CRM_LEGACY_RUNTIME_MODE.MISSING_SCOPE,
      code: CRM_LEGACY_ERROR_CODE.MISSING_CLUB_SCOPE,
      userMessage: CRM_LEGACY_MISSING_CLUB_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "crm",
    });
  }

  const demoGate = assertCrmDemoClubFallbackAllowed(rawClubId, env);
  if (!demoGate.ok) {
    return Object.freeze({
      mode: CRM_LEGACY_RUNTIME_MODE.MISSING_SCOPE,
      code: demoGate.code || CRM_LEGACY_ERROR_CODE.DEMO_CLUB_FORBIDDEN,
      userMessage: CRM_LEGACY_MISSING_CLUB_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "crm",
    });
  }

  const lsGate = assertCrmLocalStorageAuthorityAllowed(env);
  if (!lsGate.ok) {
    return Object.freeze({
      mode: CRM_LEGACY_RUNTIME_MODE.UNAVAILABLE,
      code: lsGate.code || CRM_LEGACY_ERROR_CODE.LOCALSTORAGE_FORBIDDEN,
      userMessage: CRM_LEGACY_UNAVAILABLE_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "crm",
    });
  }

  return Object.freeze({
    mode: CRM_LEGACY_RUNTIME_MODE.LEGACY_LOCAL,
    code: null,
    userMessage: null,
    clubId: rawClubId,
    allowsLocalStorage: true,
    allowsWrites: true,
    isDemoMode: true,
    demoBanner: CRM_LEGACY_DEMO_BANNER,
    matrixDomain: "crm",
  });
}

/**
 * Gate every CRM localStorage read/write.
 * @param {string|null|undefined} clubId
 * @param {Record<string, unknown>|undefined} env
 */
export function guardCrmLegacyLocalAccess(clubId, env) {
  const lsGate = assertCrmLocalStorageAuthorityAllowed(env);
  if (!lsGate.ok) {
    return {
      ok: false,
      code: lsGate.code,
      error: lsGate.error,
      legacyBlocked: true,
    };
  }

  const normalized = String(clubId || "").trim();
  if (!normalized) {
    return {
      ok: false,
      code: CRM_LEGACY_ERROR_CODE.MISSING_CLUB_SCOPE,
      error: CRM_LEGACY_MISSING_CLUB_USER_MESSAGE,
      legacyBlocked: true,
    };
  }

  const demoGate = assertCrmDemoClubFallbackAllowed(normalized, env);
  if (!demoGate.ok) {
    return {
      ok: false,
      code: demoGate.code,
      error: demoGate.error,
      legacyBlocked: true,
    };
  }

  return { ok: true, clubId: normalized };
}
