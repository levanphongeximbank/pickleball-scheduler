/**
 * Deterministic Daily Play mutation error contract.
 * SQL often returns { ok:false, code } without error — never leave that
 * as an empty failure that collapses to a generic UI string.
 */

import { DAILY_PLAY_CODE, DAILY_PLAY_MESSAGES } from "./dailyPlayCodes.js";
import { DAILY_PLAY_REFRESH_REASON } from "./dailyPlaySessionRefresh.js";

export const DAILY_PLAY_GENERIC_ACTION_ERROR = "Thao tác Daily Play thất bại.";

function isExplicitOk(result) {
  return result?.ok === true || result?.ok === "true";
}

function readTechnicalError(result) {
  if (!result || typeof result !== "object") return null;
  const raw = result.error || result.message || null;
  if (raw == null || raw === "") return null;
  return String(raw);
}

/**
 * Normalize an RPC/mutation payload so failures always have code + error.
 * Success payloads keep their fields. Unknown faults keep a diagnostic while
 * the UI error stays the safe Vietnamese fallback.
 */
export function normalizeDailyPlayMutationResult(result) {
  if (result == null || typeof result !== "object") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.VALIDATION,
      error: DAILY_PLAY_GENERIC_ACTION_ERROR,
      diagnostic: result == null ? "null_result" : typeof result,
    };
  }

  if (isExplicitOk(result)) {
    return { ...result, ok: true };
  }

  const technical = readTechnicalError(result);
  const code = result.code ? String(result.code) : DAILY_PLAY_CODE.VALIDATION;
  const mapped = result.code ? DAILY_PLAY_MESSAGES[code] : null;
  const knownDomain = Boolean(mapped) || Boolean(technical);
  return {
    ...result,
    ok: false,
    code,
    error: mapped || technical || DAILY_PLAY_GENERIC_ACTION_ERROR,
    diagnostic: technical || (result.code ? code : "empty_failure"),
    unknownFault: !knownDomain,
  };
}

/**
 * After an authoritative snapshot, decide whether a previously shown action
 * error is obsolete.
 *
 * Mutation readback always clears — even when the signature is unchanged —
 * so a successful create cannot keep a stale generic alert.
 * Identical silent polls must not hide a currently applicable domain error.
 */
export function shouldClearSessionErrorAfterSnapshot({
  snapshotOk = false,
  replaced = false,
  reason = null,
} = {}) {
  if (!snapshotOk) return false;
  if (replaced) return true;
  return reason === DAILY_PLAY_REFRESH_REASON.MUTATION;
}

export function resolveSessionErrorAfterSnapshot({
  currentError = null,
  snapshotOk = false,
  replaced = false,
  reason = null,
} = {}) {
  if (shouldClearSessionErrorAfterSnapshot({ snapshotOk, replaced, reason })) {
    return null;
  }
  return currentError;
}
