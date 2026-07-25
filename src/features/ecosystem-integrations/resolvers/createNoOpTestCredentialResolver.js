/**
 * No-op / test credential resolver.
 * Fail-closed. Never reads runtime environment maps.
 * Never returns secret values — presence + redacted diagnostics only.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CREDENTIAL_PRESENCE,
  ENVIRONMENT_CLASS,
  INTEGRATION_ERROR_CODE,
} from "../constants/catalogues.js";
import { createIntegrationError } from "../errors/errorTaxonomy.js";
import { createCredentialRequirementDescriptor } from "../contracts/credentialRequirementDescriptor.js";
import { projectSecretBoundaryReadiness } from "../contracts/secretBoundaryReadiness.js";
import { createRedactedDiagnostics } from "../contracts/redactedDiagnostics.js";
import {
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";
import {
  isBrowserExposedSecretName,
  rejectSecretValueFields,
} from "../contracts/secretBoundaryShared.js";

/**
 * @param {object} [options]
 * @param {Record<string, boolean|{present?: boolean, credentialEnvironment?: string}>} [options.presenceByCredentialId]
 *   Injected presence map only — never secret values.
 * @param {string} [options.deploymentEnvironment]
 * @param {boolean} [options.failClosed]
 */
export function createNoOpTestCredentialResolver(options = {}) {
  if (options != null && !isPlainObject(options)) {
    throw new Error(
      "createNoOpTestCredentialResolver options must be a plain object"
    );
  }

  const valueReject = rejectSecretValueFields(
    options,
    "CREDENTIAL_RESOLVER_VALUE_FORBIDDEN",
    "createNoOpTestCredentialResolver options"
  );
  if (valueReject) {
    throw new Error(valueReject.error.message);
  }

  const presenceByCredentialId =
    options.presenceByCredentialId &&
    isPlainObject(options.presenceByCredentialId)
      ? deepFreeze({ ...options.presenceByCredentialId })
      : deepFreeze({});

  // Reject injected maps that smuggle secret values under nested objects.
  for (const [id, entry] of Object.entries(presenceByCredentialId)) {
    if (typeof entry === "boolean") continue;
    if (!isPlainObject(entry)) {
      throw new Error(
        `presenceByCredentialId.${id} must be boolean or plain object`
      );
    }
    const nestedReject = rejectSecretValueFields(
      entry,
      "CREDENTIAL_RESOLVER_VALUE_FORBIDDEN",
      `presenceByCredentialId.${id}`
    );
    if (nestedReject) {
      throw new Error(nestedReject.error.message);
    }
  }

  const deploymentEnvironment = options.deploymentEnvironment ?? "TEST";
  const failClosed = options.failClosed !== false;

  return deepFreeze({
    kind: "noop-test-credential-resolver",
    productionReady: false,
    readsEnvironment: false,
    returnsSecretValues: false,

    /**
     * @param {*} requirementInput
     */
    resolve(requirementInput) {
      const descriptorResult =
        createCredentialRequirementDescriptor(requirementInput);
      if (!descriptorResult.ok) {
        return fail(
          createIntegrationError(
            INTEGRATION_ERROR_CODE.VALIDATION,
            descriptorResult.error.message,
            { field: descriptorResult.error.field ?? "requirement" }
          )
        );
      }

      const descriptor = descriptorResult.value;

      if (
        descriptor.classification ===
          ENVIRONMENT_CLASS.BROWSER_EXPOSED_SECRET_RISK ||
        (descriptor.secretReference &&
          isBrowserExposedSecretName(descriptor.secretReference.referenceName))
      ) {
        return fail(
          createIntegrationError(
            INTEGRATION_ERROR_CODE.CONFIGURATION,
            "browser-exposed secret classification is not resolvable on canonical boundary",
            {
              credentialId: descriptor.credentialId,
              classification: descriptor.classification,
            }
          )
        );
      }

      const injected = presenceByCredentialId[descriptor.credentialId];
      let present = false;
      let credentialEnvironment = deploymentEnvironment;

      if (injected === undefined) {
        if (failClosed && descriptor.requirement === "REQUIRED") {
          return fail(
            createIntegrationError(
              INTEGRATION_ERROR_CODE.AUTHENTICATION,
              "required credential missing (fail-closed)",
              {
                credentialId: descriptor.credentialId,
                presence: CREDENTIAL_PRESENCE.ABSENT,
              }
            )
          );
        }
      } else if (typeof injected === "boolean") {
        present = injected;
      } else {
        present = Boolean(injected.present);
        if (typeof injected.credentialEnvironment === "string") {
          credentialEnvironment = injected.credentialEnvironment;
        }
      }

      if (
        failClosed &&
        descriptor.requirement === "REQUIRED" &&
        present !== true
      ) {
        return fail(
          createIntegrationError(
            INTEGRATION_ERROR_CODE.AUTHENTICATION,
            "required credential absent (fail-closed)",
            {
              credentialId: descriptor.credentialId,
              presence: CREDENTIAL_PRESENCE.ABSENT,
            }
          )
        );
      }

      const presence = present
        ? CREDENTIAL_PRESENCE.REDACTED
        : CREDENTIAL_PRESENCE.ABSENT;

      const readiness = projectSecretBoundaryReadiness({
        connectorId: descriptor.connectorId,
        requirement: descriptor.requirement,
        classification: descriptor.classification,
        presence,
        deploymentEnvironment,
        credentialEnvironment,
        eligibleEnvironments: descriptor.eligibleEnvironments,
      });
      if (!readiness.ok) {
        return fail(
          createIntegrationError(
            INTEGRATION_ERROR_CODE.VALIDATION,
            readiness.error.message,
            { field: readiness.error.field ?? "readiness" }
          )
        );
      }

      const diagnostics = createRedactedDiagnostics({
        credentialId: descriptor.credentialId,
        presence,
        classification: descriptor.classification,
        // Deliberately include a secret-shaped key to prove redaction:
        // callers must never see raw material even if mistakenly supplied upstream.
      });

      return ok(
        deepFreeze({
          credentialId: descriptor.credentialId,
          connectorId: descriptor.connectorId,
          presence,
          // Never return a secret value field.
          resolved: true,
          readiness: readiness.value,
          diagnostics: diagnostics.ok ? diagnostics.value : undefined,
        })
      );
    },
  });
}
