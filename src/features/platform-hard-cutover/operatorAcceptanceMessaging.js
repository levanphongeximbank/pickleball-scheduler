/**
 * Operator Acceptance A-MSG mode contract.
 * Runtime emits COMMUNICATION_RUNTIME_MODE uppercase (PRODUCTION | UNAVAILABLE | DEMO).
 * Acceptance accepts PRODUCTION/UNAVAILABLE case-insensitively; rejects DEMO/MOCK/LEGACY.
 */

export const MESSAGING_ACCEPTANCE_ALLOWED_MODES = Object.freeze([
  "PRODUCTION",
  "UNAVAILABLE",
]);

export const MESSAGING_ACCEPTANCE_FORBIDDEN_MODES = Object.freeze([
  "DEMO",
  "MOCK",
  "LEGACY",
]);

export const MESSAGING_ACCEPTANCE_CODE = Object.freeze({
  OK: "OK",
  MODE_MISSING: "MESSAGING_MODE_MISSING",
  MODE_FORBIDDEN: "MESSAGING_MODE_FORBIDDEN",
  MODE_UNEXPECTED: "MESSAGING_MODE_UNEXPECTED",
});

/**
 * @param {{ mode?: unknown, reason?: unknown, demoAllowed?: unknown }|null|undefined} runtimeStatus
 * @returns {{
 *   ok: boolean,
 *   code: string,
 *   normalizedMode: string|null,
 *   rawMode: string|null,
 *   reason: string|null,
 *   demoAllowed: boolean,
 * }}
 */
export function evaluateMessagingAcceptanceMode(runtimeStatus) {
  const rawMode =
    runtimeStatus == null || runtimeStatus.mode == null
      ? null
      : String(runtimeStatus.mode).trim();
  if (!rawMode) {
    return {
      ok: false,
      code: MESSAGING_ACCEPTANCE_CODE.MODE_MISSING,
      normalizedMode: null,
      rawMode: null,
      reason: runtimeStatus?.reason ? String(runtimeStatus.reason) : null,
      demoAllowed: Boolean(runtimeStatus?.demoAllowed),
    };
  }

  const normalizedMode = rawMode.toUpperCase();
  if (MESSAGING_ACCEPTANCE_FORBIDDEN_MODES.includes(normalizedMode)) {
    return {
      ok: false,
      code: MESSAGING_ACCEPTANCE_CODE.MODE_FORBIDDEN,
      normalizedMode,
      rawMode,
      reason: runtimeStatus?.reason ? String(runtimeStatus.reason) : null,
      demoAllowed: Boolean(runtimeStatus?.demoAllowed),
    };
  }

  if (MESSAGING_ACCEPTANCE_ALLOWED_MODES.includes(normalizedMode)) {
    return {
      ok: true,
      code: MESSAGING_ACCEPTANCE_CODE.OK,
      normalizedMode,
      rawMode,
      reason: runtimeStatus?.reason ? String(runtimeStatus.reason) : null,
      demoAllowed: Boolean(runtimeStatus?.demoAllowed),
    };
  }

  return {
    ok: false,
    code: MESSAGING_ACCEPTANCE_CODE.MODE_UNEXPECTED,
    normalizedMode,
    rawMode,
    reason: runtimeStatus?.reason ? String(runtimeStatus.reason) : null,
    demoAllowed: Boolean(runtimeStatus?.demoAllowed),
  };
}
