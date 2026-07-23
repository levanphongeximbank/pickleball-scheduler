/**
 * Finance runtime error helpers (Phase 1I).
 *
 * Safe, machine-readable FinanceError wrappers. Context must never include
 * secrets, database URLs, access tokens, or raw provider/error bodies.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError, throwFinanceError } from "../errors/FinanceError.js";

export const FINANCE_RUNTIME_ERROR_CODES = Object.freeze({
  RUNTIME_DISABLED: FINANCE_ERROR_CODES.RUNTIME_DISABLED,
  INVALID_RUNTIME_CONFIGURATION: FINANCE_ERROR_CODES.INVALID_RUNTIME_CONFIGURATION,
  UNSUPPORTED_RUNTIME_MODE: FINANCE_ERROR_CODES.UNSUPPORTED_RUNTIME_MODE,
  MISSING_RUNTIME_DEPENDENCY: FINANCE_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY,
  ENVIRONMENT_NOT_AUTHORIZED: FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED,
  PERSISTENCE_NOT_READY: FINANCE_ERROR_CODES.PERSISTENCE_NOT_READY,
  PROVIDER_NOT_CONFIGURED: FINANCE_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
  TENANT_RESOLUTION_UNAVAILABLE: FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE,
  APPLICATION_COMMANDS_UNAVAILABLE: FINANCE_ERROR_CODES.APPLICATION_COMMANDS_UNAVAILABLE,
});

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {FinanceError}
 */
export function createFinanceRuntimeError(code, message, context) {
  return new FinanceError(code, message, context);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {never}
 */
export function throwFinanceRuntimeError(code, message, context) {
  return throwFinanceError(code, message, context);
}

/**
 * @returns {never}
 */
export function throwRuntimeDisabled(message = "Finance runtime is disabled.") {
  return throwFinanceRuntimeError(
    FINANCE_ERROR_CODES.RUNTIME_DISABLED,
    message,
    { runtimeMode: "disabled", enabled: false }
  );
}

/**
 * @param {string} [message]
 * @param {object} [context]
 * @returns {never}
 */
export function throwApplicationCommandsUnavailable(
  message = "Finance application commands are unavailable for this runtime composition.",
  context = {}
) {
  return throwFinanceRuntimeError(
    FINANCE_ERROR_CODES.APPLICATION_COMMANDS_UNAVAILABLE,
    message,
    {
      applicationCommandsAvailable: false,
      ...context,
    }
  );
}
