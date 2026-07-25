/**
 * Server-only credential boundary — marks resolution surface as non-browser.
 * Does not hold secret values or vendor clients.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  ENVIRONMENT_CLASS,
  ENVIRONMENT_CLASS_VALUES,
  SERVER_ONLY_CREDENTIAL_BOUNDARY_VERSION,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireNonEmptyString,
  requireStringArray,
} from "./shared.js";
import {
  isBrowserExposedSecretName,
  rejectSecretValueFields,
} from "./secretBoundaryShared.js";

export const SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR = Object.freeze({
  INVALID: "SERVER_ONLY_CREDENTIAL_BOUNDARY_INVALID",
  ID_INVALID: "SERVER_ONLY_CREDENTIAL_BOUNDARY_ID_INVALID",
  CLASS_INVALID: "SERVER_ONLY_CREDENTIAL_BOUNDARY_CLASS_INVALID",
  FLAG_INVALID: "SERVER_ONLY_CREDENTIAL_BOUNDARY_FLAG_INVALID",
  VALUE_FORBIDDEN: "SERVER_ONLY_CREDENTIAL_BOUNDARY_VALUE_FORBIDDEN",
  BROWSER_EXPOSED: "SERVER_ONLY_CREDENTIAL_BOUNDARY_BROWSER_EXPOSED",
  CREDENTIAL_INVALID: "SERVER_ONLY_CREDENTIAL_BOUNDARY_CREDENTIAL_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createServerOnlyCredentialBoundary(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.INVALID,
        "ServerOnlyCredentialBoundary input must be a plain object"
      )
    );
  }

  const valueReject = rejectSecretValueFields(
    input,
    SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.VALUE_FORBIDDEN,
    "ServerOnlyCredentialBoundary"
  );
  if (valueReject) return valueReject;

  const boundaryId = requireNonEmptyString(
    input.boundaryId,
    "boundaryId",
    SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.ID_INVALID,
    "boundaryId"
  );
  if (!boundaryId.ok) return boundaryId;

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? SERVER_ONLY_CREDENTIAL_BOUNDARY_VERSION,
    "contractVersion",
    SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const classification = requireEnumMember(
    input.classification ?? ENVIRONMENT_CLASS.SERVER_ONLY_SECRET,
    ENVIRONMENT_CLASS_VALUES,
    "classification",
    SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.CLASS_INVALID,
    "classification"
  );
  if (!classification.ok) return classification;

  if (
    classification.value !== ENVIRONMENT_CLASS.SERVER_ONLY_SECRET &&
    classification.value !== ENVIRONMENT_CLASS.CANONICAL_BOUNDARY &&
    classification.value !== ENVIRONMENT_CLASS.MOCK_ONLY
  ) {
    return fail(
      contractError(
        SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.CLASS_INVALID,
        "boundary classification must be SERVER_ONLY_SECRET, CANONICAL_BOUNDARY, or MOCK_ONLY",
        "classification"
      )
    );
  }

  const browserExportForbidden = requireBoolean(
    input.browserExportForbidden ?? true,
    "browserExportForbidden",
    SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.FLAG_INVALID
  );
  if (!browserExportForbidden.ok) return browserExportForbidden;

  if (browserExportForbidden.value !== true) {
    return fail(
      contractError(
        SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.FLAG_INVALID,
        "server-only boundary must set browserExportForbidden=true",
        "browserExportForbidden"
      )
    );
  }

  const credentialIds = requireStringArray(
    input.credentialIds ?? [],
    "credentialIds",
    SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.CREDENTIAL_INVALID,
    "credentialIds"
  );
  if (!credentialIds.ok) return credentialIds;

  /** @type {ReadonlyArray<string>} */
  let referenceNames = Object.freeze([]);
  if ("referenceNames" in input && input.referenceNames !== undefined) {
    const names = requireStringArray(
      input.referenceNames,
      "referenceNames",
      SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.CREDENTIAL_INVALID,
      "referenceNames"
    );
    if (!names.ok) return names;
    for (const name of names.value) {
      if (
        classification.value !== ENVIRONMENT_CLASS.MOCK_ONLY &&
        isBrowserExposedSecretName(name)
      ) {
        return fail(
          contractError(
            SERVER_ONLY_CREDENTIAL_BOUNDARY_ERROR.BROWSER_EXPOSED,
            `server-only boundary rejects browser-exposed reference name: ${name}`,
            "referenceNames"
          )
        );
      }
    }
    referenceNames = names.value;
  }

  return ok(
    deepFreeze({
      boundaryId: boundaryId.value,
      contractVersion: contractVersion.value,
      classification: classification.value,
      browserExportForbidden: true,
      credentialIds: credentialIds.value,
      referenceNames,
      surface: "server-only",
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isServerOnlyCredentialBoundary(value) {
  return createServerOnlyCredentialBoundary(value).ok === true;
}
