/**
 * CORE-14 — OccupancyIndexKey (separate from CanonicalResourceKey).
 */

import { CORE14_OIK_V1 } from "../constants/versions.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { escapeCore14Token } from "../deterministic/escape.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import {
  serializeCanonicalResourceKey,
  validateCanonicalResourceKey,
} from "./CanonicalResourceKey.js";

/**
 * @param {{ resourceKey: object, occupancyId: string }} input
 * @returns {Readonly<{ resourceKey: object, occupancyId: string, resourceKeyCanonical: string }>}
 */
export function createOccupancyIndexKey(input) {
  const keyResult = validateCanonicalResourceKey(input?.resourceKey);
  if (!keyResult.ok) {
    throw new ResourceConflictContractError(keyResult.diagnostics[0].code, keyResult.diagnostics[0].message, {
      diagnostics: keyResult.diagnostics,
    });
  }
  if (typeof input?.occupancyId !== "string" || input.occupancyId.length === 0) {
    throw new ResourceConflictContractError(
      INPUT_DIAGNOSTIC_CODE.OCCUPANCY_ID_MISSING,
      "occupancyId must be a non-empty string",
      {
        fieldName: "occupancyId",
        expectedType: "string",
        actualType: input?.occupancyId === null ? "null" : typeof input?.occupancyId,
      }
    );
  }
  const resourceKeyCanonical = serializeCanonicalResourceKey(keyResult.value);
  return Object.freeze({
    resourceKey: keyResult.value,
    occupancyId: input.occupancyId,
    resourceKeyCanonical,
  });
}

/**
 * @param {{ resourceKey: object, occupancyId: string }} input
 * @returns {string}
 */
export function serializeOccupancyIndexKey(input) {
  const key = createOccupancyIndexKey(input);
  return (
    `${CORE14_OIK_V1}` +
    `|rk=${escapeCore14Token(key.resourceKeyCanonical)}` +
    `|oid=${escapeCore14Token(key.occupancyId)}`
  );
}

/**
 * @param {{ resourceKey: object, occupancyId: string }} a
 * @param {{ resourceKey: object, occupancyId: string }} b
 * @returns {number}
 */
export function compareOccupancyIndexKeys(a, b) {
  return compareUtf8Bytewise(serializeOccupancyIndexKey(a), serializeOccupancyIndexKey(b));
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareOccupancyIds(a, b) {
  return compareUtf8Bytewise(a, b);
}
