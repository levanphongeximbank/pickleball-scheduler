/**
 * CORE-14 — InputDiagnostic factory.
 * Throws DOMAIN_CONTRACT_ERROR_CODE for programmer misuse of the factory itself.
 * Valid catalog codes are accepted as input diagnostics.
 */

import { isInputDiagnosticCode } from "../enums/diagnosticCode.js";
import { DOMAIN_CONTRACT_ERROR_CODE } from "../enums/domainContractErrorCode.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import { deepFreezeClone, isPlainObject } from "../deterministic/serialize.js";

/**
 * @param {{
 *   code: string,
 *   message: string,
 *   path?: string | null,
 *   resourceKey?: object | null,
 *   occupancyId?: string | null,
 *   assignmentId?: string | null,
 *   details?: Record<string, unknown> | null,
 * }} input
 */
export function createInputDiagnostic(input) {
  if (!isInputDiagnosticCode(input?.code)) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.UNKNOWN_DIAGNOSTIC_CODE,
      "Input diagnostic code must be a frozen catalog value",
      { code: input?.code ?? null }
    );
  }
  if (typeof input.message !== "string" || input.message.length === 0) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.DIAGNOSTIC_MESSAGE_REQUIRED,
      "Input diagnostic message must be a non-empty string",
      {}
    );
  }
  const details =
    input.details == null
      ? null
      : isPlainObject(input.details)
        ? /** @type {Record<string, unknown>} */ (deepFreezeClone({ ...input.details }))
        : (() => {
            throw new ResourceConflictContractError(
              DOMAIN_CONTRACT_ERROR_CODE.INVALID_DIAGNOSTIC_DETAILS,
              "details must be a plain object or null",
              {}
            );
          })();

  return Object.freeze({
    code: input.code,
    message: input.message,
    path: input.path == null ? null : String(input.path),
    resourceKey: input.resourceKey == null ? null : input.resourceKey,
    occupancyId: input.occupancyId == null ? null : String(input.occupancyId),
    assignmentId: input.assignmentId == null ? null : String(input.assignmentId),
    details,
  });
}
