/**
 * Resolve Finance ledger UI/runtime mode for /finance/* pages.
 */

import {
  HARD_CUTOVER_FLAG,
  getRuntimeAuthorityEntry,
  isPlatformHardCutoverEnabled,
} from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertFinanceDemoClubFallbackAllowed,
  assertFinanceLocalStorageAuthorityAllowed,
} from "../../platform-hard-cutover/legacyAuthorityPolicy.js";
import {
  DEMO_CLUB_ID,
  FINANCE_LEDGER_ERROR_CODE,
  FINANCE_LEDGER_LEGACY_DEMO_BANNER,
  FINANCE_LEDGER_MISSING_CLUB_USER_MESSAGE,
  FINANCE_LEDGER_RUNTIME_MODE,
  FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
} from "./constants.js";

export { HARD_CUTOVER_FLAG };

/**
 * @param {{ env?: Record<string, unknown>, clubId?: string|null, hardCutover?: boolean }} [input]
 */
export function resolveFinanceLedgerRuntime(input = {}) {
  const env = input.env && typeof input.env === "object" ? input.env : {};
  const hardCutover =
    input.hardCutover === true || isPlatformHardCutoverEnabled(env);
  const matrix = getRuntimeAuthorityEntry("finance");
  const rawClubId = String(input.clubId || "").trim();

  if (hardCutover) {
    return Object.freeze({
      mode: FINANCE_LEDGER_RUNTIME_MODE.UNAVAILABLE,
      code:
        matrix?.failClosedError || FINANCE_LEDGER_ERROR_CODE.AUTHORITY_UNAVAILABLE,
      userMessage: FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "finance",
    });
  }

  if (!rawClubId || rawClubId === DEMO_CLUB_ID) {
    return Object.freeze({
      mode: FINANCE_LEDGER_RUNTIME_MODE.MISSING_SCOPE,
      code: FINANCE_LEDGER_ERROR_CODE.MISSING_CLUB_SCOPE,
      userMessage: FINANCE_LEDGER_MISSING_CLUB_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "finance",
    });
  }

  const demoGate = assertFinanceDemoClubFallbackAllowed(rawClubId, env);
  if (!demoGate.ok) {
    return Object.freeze({
      mode: FINANCE_LEDGER_RUNTIME_MODE.MISSING_SCOPE,
      code: demoGate.code || FINANCE_LEDGER_ERROR_CODE.DEMO_CLUB_FORBIDDEN,
      userMessage: FINANCE_LEDGER_MISSING_CLUB_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "finance",
    });
  }

  const lsGate = assertFinanceLocalStorageAuthorityAllowed(env);
  if (!lsGate.ok) {
    return Object.freeze({
      mode: FINANCE_LEDGER_RUNTIME_MODE.UNAVAILABLE,
      code: lsGate.code || FINANCE_LEDGER_ERROR_CODE.LOCALSTORAGE_FORBIDDEN,
      userMessage: FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE,
      clubId: null,
      allowsLocalStorage: false,
      allowsWrites: false,
      isDemoMode: false,
      demoBanner: null,
      matrixDomain: "finance",
    });
  }

  return Object.freeze({
    mode: FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL,
    code: null,
    userMessage: null,
    clubId: rawClubId,
    allowsLocalStorage: true,
    allowsWrites: true,
    isDemoMode: true,
    demoBanner: FINANCE_LEDGER_LEGACY_DEMO_BANNER,
    matrixDomain: "finance",
  });
}

/**
 * Gate every Finance ledger localStorage read/write.
 * @param {string|null|undefined} clubId
 * @param {Record<string, unknown>|undefined} env
 */
export function guardFinanceLedgerLocalAccess(clubId, env) {
  const lsGate = assertFinanceLocalStorageAuthorityAllowed(env);
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
      code: FINANCE_LEDGER_ERROR_CODE.MISSING_CLUB_SCOPE,
      error: FINANCE_LEDGER_MISSING_CLUB_USER_MESSAGE,
      legacyBlocked: true,
    };
  }

  const demoGate = assertFinanceDemoClubFallbackAllowed(normalized, env);
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
