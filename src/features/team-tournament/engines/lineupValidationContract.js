/**
 * TT-2C — Shared lineup validation contract (client UX + server parity tests).
 * Server/RPC is SoT on cloud; client uses the same codes for display.
 */

export const LINEUP_VALIDATION_CODE = Object.freeze({
  OK: "ok",
  PLAYER_NOT_IN_TEAM: "player_not_in_team",
  PLAYER_INACTIVE: "player_inactive",
  PLAYER_NOT_ELIGIBLE: "player_not_eligible",
  INVALID_GENDER: "invalid_gender",
  INVALID_DISCIPLINE: "invalid_discipline",
  DUPLICATE_PLAYER: "duplicate_player",
  DUPLICATE_SLOT: "duplicate_slot",
  ROSTER_LIMIT_EXCEEDED: "roster_limit_exceeded",
  LINEUP_INCOMPLETE: "lineup_incomplete",
  LINEUP_LOCKED: "lineup_locked",
  DEADLINE_PASSED: "deadline_passed",
  CAPTAIN_SCOPE_DENIED: "captain_scope_denied",
  CROSS_TENANT_DENIED: "cross_tenant_denied",
  VERSION_CONFLICT: "version_conflict",
  VALIDATION: "validation",
});

/** @typedef {Object} LineupValidationResult */
export const LINEUP_VALIDATION_RESULT_SHAPE = Object.freeze({
  ok: false,
  code: LINEUP_VALIDATION_CODE.VALIDATION,
  message: "",
  fieldErrors: {},
  ruleViolations: [],
  invalidPlayerIds: [],
  invalidDisciplineIds: [],
  serverTime: null,
  lineupVersion: null,
  warnings: [],
  selections: null,
});

/**
 * @param {Partial<LineupValidationResult> & { ok: boolean }} patch
 */
export function createLineupValidationResult(patch = {}) {
  const ok = patch.ok === true;
  const fieldErrors =
    patch.fieldErrors && typeof patch.fieldErrors === "object" ? patch.fieldErrors : {};
  const ruleViolations = Array.isArray(patch.ruleViolations) ? patch.ruleViolations : [];
  const invalidPlayerIds = Array.isArray(patch.invalidPlayerIds) ? patch.invalidPlayerIds : [];
  const invalidDisciplineIds = Array.isArray(patch.invalidDisciplineIds)
    ? patch.invalidDisciplineIds
    : [];
  const warnings = Array.isArray(patch.warnings) ? patch.warnings : [];

  return {
    ok,
    code: patch.code || (ok ? LINEUP_VALIDATION_CODE.OK : LINEUP_VALIDATION_CODE.VALIDATION),
    message: patch.message || "",
    fieldErrors,
    ruleViolations,
    invalidPlayerIds,
    invalidDisciplineIds,
    serverTime: patch.serverTime ?? null,
    lineupVersion: patch.lineupVersion ?? null,
    warnings,
    selections: patch.selections ?? null,
  };
}

export function validationFailure(code, message, extras = {}) {
  return createLineupValidationResult({
    ok: false,
    code,
    message,
    ...extras,
  });
}

export function validationSuccess(extras = {}) {
  return createLineupValidationResult({
    ok: true,
    code: LINEUP_VALIDATION_CODE.OK,
    ...extras,
  });
}

/**
 * Map legacy string errors / RPC payload into contract shape.
 * @param {object|null} payload
 */
export function mapRpcLineupValidationPayload(payload) {
  if (!payload || payload.ok !== false) {
    return payload?.ok === true ? validationSuccess(payload) : null;
  }

  const code = payload.code || LINEUP_VALIDATION_CODE.VALIDATION;
  const knownCodes = new Set(Object.values(LINEUP_VALIDATION_CODE));

  return createLineupValidationResult({
    ok: false,
    code: knownCodes.has(code) ? code : LINEUP_VALIDATION_CODE.VALIDATION,
    message: payload.message || payload.error || "Dữ liệu đội hình không hợp lệ.",
    fieldErrors: payload.fieldErrors || {},
    ruleViolations: payload.ruleViolations || [],
    invalidPlayerIds: payload.invalidPlayerIds || [],
    invalidDisciplineIds: payload.invalidDisciplineIds || [],
    serverTime: payload.serverTime ?? null,
    lineupVersion: payload.lineupVersion ?? payload.version ?? null,
    warnings: payload.warnings || [],
  });
}

const LINEUP_VALIDATION_ERROR_CODES = new Set(Object.values(LINEUP_VALIDATION_CODE));

export function isLineupValidationErrorCode(code) {
  return LINEUP_VALIDATION_ERROR_CODES.has(code);
}

/**
 * Format RPC/repository payload into a user-facing error string.
 * @param {object|null|undefined} payload
 * @param {string} [fallback]
 */
export function formatLineupValidationError(payload, fallback = "Dữ liệu đội hình không hợp lệ.") {
  const validation = mapRpcLineupValidationPayload(payload);
  if (validation && !validation.ok) {
    const messages = mergeValidationMessages(validation);
    return messages.join(" ") || validation.message || fallback;
  }

  return payload?.message || payload?.error || fallback;
}

export function mergeValidationMessages(result) {
  if (!result) {
    return [];
  }
  const messages = [];
  if (result.message) {
    messages.push(result.message);
  }
  for (const violation of result.ruleViolations || []) {
    if (typeof violation === "string") {
      messages.push(violation);
    } else if (violation?.message) {
      messages.push(violation.message);
    }
  }
  for (const fieldMessages of Object.values(result.fieldErrors || {})) {
    if (Array.isArray(fieldMessages)) {
      messages.push(...fieldMessages);
    } else if (fieldMessages) {
      messages.push(String(fieldMessages));
    }
  }
  return messages;
}
