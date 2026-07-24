/**
 * Deterministic configuration snapshot projection for future CM-03 capture (CM-04).
 * Does not create CompetitionVersion. Copy-safe / immutable.
 */

import { COMPETITION_CONFIGURATION_FINGERPRINT_ALGORITHM } from "../constants/comparison.js";
import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
  stableContentFingerprint,
} from "../contracts/shared.js";
import {
  isCompetitionConfiguration,
  semanticConfigurationPayload,
} from "../contracts/configuration.js";

/**
 * @typedef {Object} CompetitionConfigurationSnapshot
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} configurationId
 * @property {number} configurationRevision
 * @property {number} sourceDefinitionRevision
 * @property {string} competitionType
 * @property {string} scope
 * @property {string} status
 * @property {Readonly<Record<string, object>>} sections
 * @property {object} metadata
 * @property {string} fingerprint
 * @property {string} fingerprintAlgorithm
 */

/**
 * Project a configuration into a deterministic snapshot payload.
 *
 * @param {{ configuration: object }} command
 * @returns {import("../contracts/validation.js").CompetitionConfigurationValidationResult}
 */
export function projectCompetitionConfigurationSnapshot(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  const cmd = command && typeof command === "object" ? command : {};
  if (!isCompetitionConfiguration(cmd.configuration)) {
    return validationFail([
      createFieldError(
        "configuration",
        COMPETITION_CONFIGURATION_ERROR_CODE.MALFORMED_CONFIGURATION,
        "explicit valid CompetitionConfiguration is required",
        {}
      ),
    ]);
  }

  const configuration = /** @type {any} */ (cmd.configuration);
  const semantic = semanticConfigurationPayload(configuration);
  const fingerprintPayload = {
    tenantId: configuration.tenantId,
    competitionId: configuration.competitionId,
    configurationRevision: configuration.revision,
    ...semantic,
  };
  const fingerprint = stableContentFingerprint(fingerprintPayload);

  /** @type {CompetitionConfigurationSnapshot} */
  const snapshot = {
    tenantId: configuration.tenantId,
    competitionId: configuration.competitionId,
    configurationId: configuration.configurationId,
    configurationRevision: configuration.revision,
    sourceDefinitionRevision: configuration.sourceDefinitionRevision,
    competitionType: configuration.competitionType,
    scope: configuration.scope,
    status: configuration.status,
    sections: clonePlain(configuration.sections),
    metadata: clonePlain(semantic.metadata),
    fingerprint,
    fingerprintAlgorithm: COMPETITION_CONFIGURATION_FINGERPRINT_ALGORITHM.id,
  };

  const frozen = deepFreeze(clonePlain(snapshot));

  // Prove copy-safety: mutating returned object after freeze is no-op / throws in strict.
  return validationOk(frozen, {
    summary: "Competition configuration snapshot projected.",
    reasons: Object.freeze([
      `configurationId=${frozen.configurationId}`,
      `configurationRevision=${frozen.configurationRevision}`,
      `fingerprint=${frozen.fingerprint}`,
      "excludesUiState",
      "excludesRuntimeEngineState",
      "notCompetitionVersion",
    ]),
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionConfigurationSnapshot(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.tenantId) &&
    isNonEmptyString(v.competitionId) &&
    isNonEmptyString(v.configurationId) &&
    Number.isInteger(v.configurationRevision) &&
    v.configurationRevision >= 1 &&
    v.sections &&
    typeof v.sections === "object" &&
    isNonEmptyString(v.fingerprint) &&
    v.fingerprintAlgorithm === COMPETITION_CONFIGURATION_FINGERPRINT_ALGORITHM.id
  );
}
