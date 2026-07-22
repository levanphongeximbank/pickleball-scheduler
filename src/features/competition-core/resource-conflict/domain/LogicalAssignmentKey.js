/**
 * CORE-14 — LogicalAssignmentKeyV1.
 * resourceKey + activity identity (assignmentId → activityId → matchId).
 * source is provenance only and is NOT part of the key.
 */

import { CORE14_LAK_V1 } from "../constants/versions.js";
import { ACTIVITY_IDENTITY_TYPE } from "../enums/activityIdentityType.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { escapeCore14Token } from "../deterministic/escape.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import {
  serializeCanonicalResourceKey,
  validateCanonicalResourceKey,
} from "./CanonicalResourceKey.js";

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function nonEmpty(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Resolve activity identity with frozen precedence.
 * @param {{ assignmentId?: unknown, activityId?: unknown, matchId?: unknown }} occupancy
 * @returns {{ ok: true, activityIdentityType: string, activityIdentityValue: string } | { ok: false, code: string }}
 */
export function resolveActivityIdentity(occupancy) {
  const assignmentId = nonEmpty(occupancy?.assignmentId);
  if (assignmentId) {
    return {
      ok: true,
      activityIdentityType: ACTIVITY_IDENTITY_TYPE.ASSIGNMENT_ID,
      activityIdentityValue: assignmentId,
    };
  }
  const activityId = nonEmpty(occupancy?.activityId);
  if (activityId) {
    return {
      ok: true,
      activityIdentityType: ACTIVITY_IDENTITY_TYPE.ACTIVITY_ID,
      activityIdentityValue: activityId,
    };
  }
  const matchId = nonEmpty(occupancy?.matchId);
  if (matchId) {
    return {
      ok: true,
      activityIdentityType: ACTIVITY_IDENTITY_TYPE.MATCH_ID,
      activityIdentityValue: matchId,
    };
  }
  return { ok: false, code: INPUT_DIAGNOSTIC_CODE.ACTIVITY_IDENTITY_MISSING };
}

/**
 * @param {{ resourceKey: object, assignmentId?: unknown, activityId?: unknown, matchId?: unknown }} input
 * @returns {Readonly<{
 *   resourceKey: object,
 *   activityIdentityType: string,
 *   activityIdentityValue: string,
 *   resourceKeyCanonical: string,
 * }>}
 */
export function createLogicalAssignmentKeyV1(input) {
  const keyResult = validateCanonicalResourceKey(input?.resourceKey);
  if (!keyResult.ok) {
    throw new ResourceConflictContractError(keyResult.diagnostics[0].code, keyResult.diagnostics[0].message, {
      diagnostics: keyResult.diagnostics,
    });
  }
  const identity = resolveActivityIdentity(input || {});
  if (!identity.ok) {
    throw new ResourceConflictContractError(
      INPUT_DIAGNOSTIC_CODE.ACTIVITY_IDENTITY_MISSING,
      "LogicalAssignmentKeyV1 requires assignmentId, activityId, or matchId",
      {}
    );
  }
  return Object.freeze({
    resourceKey: keyResult.value,
    activityIdentityType: identity.activityIdentityType,
    activityIdentityValue: identity.activityIdentityValue,
    resourceKeyCanonical: serializeCanonicalResourceKey(keyResult.value),
  });
}

/**
 * CORE14_LAK_V1 serialization.
 * Accepts occupancy-shaped input or an already-built LogicalAssignmentKeyV1.
 * @param {object} input
 * @returns {string}
 */
export function serializeLogicalAssignmentKeyV1(input) {
  let key;
  if (
    input &&
    typeof input.activityIdentityType === "string" &&
    typeof input.activityIdentityValue === "string" &&
    typeof input.resourceKeyCanonical === "string"
  ) {
    key = input;
  } else if (
    input &&
    typeof input.activityIdentityType === "string" &&
    typeof input.activityIdentityValue === "string" &&
    input.resourceKey
  ) {
    const keyResult = validateCanonicalResourceKey(input.resourceKey);
    if (!keyResult.ok) {
      throw new ResourceConflictContractError(keyResult.diagnostics[0].code, keyResult.diagnostics[0].message, {
        diagnostics: keyResult.diagnostics,
      });
    }
    key = {
      resourceKeyCanonical: serializeCanonicalResourceKey(keyResult.value),
      activityIdentityType: input.activityIdentityType,
      activityIdentityValue: input.activityIdentityValue,
    };
  } else {
    key = createLogicalAssignmentKeyV1(input);
  }
  return (
    `${CORE14_LAK_V1}` +
    `|rk=${escapeCore14Token(key.resourceKeyCanonical)}` +
    `|ait=${escapeCore14Token(key.activityIdentityType)}` +
    `|aiv=${escapeCore14Token(key.activityIdentityValue)}`
  );
}

/**
 * Deterministic hash identity string for LAK (serialization itself is the identity material).
 * @param {object} input
 * @returns {string}
 */
export function logicalAssignmentKeyIdentity(input) {
  return serializeLogicalAssignmentKeyV1(input);
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareLogicalAssignmentKeys(a, b) {
  return compareUtf8Bytewise(serializeLogicalAssignmentKeyV1(a), serializeLogicalAssignmentKeyV1(b));
}
