/**
 * Provider endpoint classification — public-safe metadata only.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  ENDPOINT_CLASS,
  ENDPOINT_CLASS_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireNonEmptyString,
} from "./shared.js";
import {
  findSecretShapedKeyPath,
  rejectSecretValueFields,
} from "./secretBoundaryShared.js";

export const ENDPOINT_CLASSIFICATION_ERROR = Object.freeze({
  INVALID: "ENDPOINT_CLASSIFICATION_INVALID",
  ID_INVALID: "ENDPOINT_CLASSIFICATION_ID_INVALID",
  CLASS_INVALID: "ENDPOINT_CLASSIFICATION_CLASS_INVALID",
  FLAG_INVALID: "ENDPOINT_CLASSIFICATION_FLAG_INVALID",
  VALUE_FORBIDDEN: "ENDPOINT_CLASSIFICATION_VALUE_FORBIDDEN",
  METADATA_INVALID: "ENDPOINT_CLASSIFICATION_METADATA_INVALID",
});

/**
 * Whether an endpoint class may appear in a client-safe public projection.
 * @param {string} endpointClass
 * @returns {boolean}
 */
export function isEndpointClassPublicSafe(endpointClass) {
  return (
    endpointClass === ENDPOINT_CLASS.PUBLIC ||
    endpointClass === ENDPOINT_CLASS.MOCK ||
    endpointClass === ENDPOINT_CLASS.SANDBOX
  );
}

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createEndpointClassification(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        ENDPOINT_CLASSIFICATION_ERROR.INVALID,
        "EndpointClassification input must be a plain object"
      )
    );
  }

  const valueReject = rejectSecretValueFields(
    input,
    ENDPOINT_CLASSIFICATION_ERROR.VALUE_FORBIDDEN,
    "EndpointClassification"
  );
  if (valueReject) return valueReject;

  const endpointId = requireNonEmptyString(
    input.endpointId,
    "endpointId",
    ENDPOINT_CLASSIFICATION_ERROR.ID_INVALID,
    "endpointId"
  );
  if (!endpointId.ok) return endpointId;

  const endpointClass = requireEnumMember(
    input.endpointClass ?? input.classification ?? "MOCK",
    ENDPOINT_CLASS_VALUES,
    "endpointClass",
    ENDPOINT_CLASSIFICATION_ERROR.CLASS_INVALID,
    "endpointClass"
  );
  if (!endpointClass.ok) return endpointClass;

  const defaultPublicSafe = isEndpointClassPublicSafe(endpointClass.value);
  const allowInPublicProjection = requireBoolean(
    input.allowInPublicProjection ?? defaultPublicSafe,
    "allowInPublicProjection",
    ENDPOINT_CLASSIFICATION_ERROR.FLAG_INVALID
  );
  if (!allowInPublicProjection.ok) return allowInPublicProjection;

  // Production / Internal endpoints must never be forced into public projection.
  if (
    (endpointClass.value === ENDPOINT_CLASS.PRODUCTION ||
      endpointClass.value === ENDPOINT_CLASS.INTERNAL) &&
    allowInPublicProjection.value === true
  ) {
    return fail(
      contractError(
        ENDPOINT_CLASSIFICATION_ERROR.FLAG_INVALID,
        "PRODUCTION/INTERNAL endpoints must not allowInPublicProjection",
        "allowInPublicProjection"
      )
    );
  }

  let publicMetadata = Object.freeze({});
  if ("publicMetadata" in input && input.publicMetadata !== undefined) {
    if (!isPlainObject(input.publicMetadata)) {
      return fail(
        contractError(
          ENDPOINT_CLASSIFICATION_ERROR.METADATA_INVALID,
          "publicMetadata must be a plain object",
          "publicMetadata"
        )
      );
    }
    const forbidden = findSecretShapedKeyPath(input.publicMetadata);
    if (forbidden) {
      return fail(
        contractError(
          ENDPOINT_CLASSIFICATION_ERROR.METADATA_INVALID,
          `publicMetadata must not include secret-shaped key: ${forbidden}`,
          "publicMetadata"
        )
      );
    }
    publicMetadata = deepFreeze({ ...input.publicMetadata });
  }

  return ok(
    deepFreeze({
      endpointId: endpointId.value,
      endpointClass: endpointClass.value,
      allowInPublicProjection: allowInPublicProjection.value,
      publicMetadata,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isEndpointClassification(value) {
  return createEndpointClassification(value).ok === true;
}
