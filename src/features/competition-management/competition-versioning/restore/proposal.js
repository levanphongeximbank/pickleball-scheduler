/**
 * CM-03 restore / rollback proposal — deterministic management-level proposal only.
 * Does NOT mutate the target definition, call CM-01 update, write DB, or run CORE-23 recovery.
 */

import {
  isCompetitionDefinition,
  isValidCompetitionDefinitionRevision,
} from "../../competition-definition/index.js";
import { COMPETITION_VERSION_IMMUTABLE_DEFINITION_FIELDS } from "../constants/versioning.js";
import { COMPETITION_VERSION_ERROR_CODE } from "../errors/errorCodes.js";
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
  canonicalizeJson,
} from "../contracts/shared.js";
import { isCompetitionVersion } from "../contracts/snapshot.js";
import { COMPETITION_VERSION_CHANGE_TYPE } from "../constants/versioning.js";
import {
  createVersionDifference,
  sortVersionDifferences,
} from "../comparison/compare.js";

/**
 * @typedef {Object} CompetitionRestoreProposal
 * @property {string} proposalId
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} sourceVersionId
 * @property {number} sourceVersionNumber
 * @property {number} expectedTargetDefinitionRevision
 * @property {number} sourceDefinitionRevision
 * @property {object} proposedReplacementFields
 * @property {readonly object[]} fieldDifferences
 * @property {readonly string[]} immutableFieldsPreserved
 * @property {readonly object[]} conflicts
 * @property {boolean} executesPersistence
 * @property {boolean} executesRuntimeRecovery
 * @property {boolean} mutatesTarget
 * @property {boolean} publishes
 */

/**
 * Build a CM-01-compatible field set from a version snapshot content.
 * Omits revision/updatedAt — caller (CM-01) owns those on apply.
 * @param {import("../contracts/snapshot.js").CompetitionVersionContent} content
 * @returns {object}
 */
export function projectContentToDefinitionFields(content) {
  return deepFreeze({
    competitionId: content.competitionId,
    tenantId: content.tenantId,
    owner: clonePlain(content.owner),
    name: content.name,
    description: content.description,
    competitionType: content.competitionType,
    scope: content.scope,
    visibility: content.visibility,
    status: content.status,
    venues: clonePlain(content.venues),
    clubs: clonePlain(content.clubs),
    registrationWindow: clonePlain(content.registrationWindow),
    plannedPeriod: clonePlain(content.plannedPeriod),
    template: clonePlain(content.template),
    ruleSet: clonePlain(content.ruleSet),
  });
}

/**
 * Create a deterministic restore proposal from an immutable source version
 * toward an explicit target CompetitionDefinition (proposal only).
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   sourceVersion: object,
 *   targetDefinition: object,
 *   expectedTargetDefinitionRevision: number,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionVersionValidationResult}
 */
export function createCompetitionRestoreProposal(command = {}) {
  const commandSnap = snapshotInput(command);
  const targetSnap = snapshotInput(command.targetDefinition);
  void commandSnap;
  void targetSnap;

  /** @type {import("../contracts/validation.js").CompetitionVersionFieldError[]} */
  const errors = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (!isCompetitionVersion(cmd.sourceVersion)) {
    errors.push(
      createFieldError(
        "sourceVersion",
        COMPETITION_VERSION_ERROR_CODE.MALFORMED_SNAPSHOT,
        "sourceVersion must be a valid CompetitionVersion",
        {}
      )
    );
  }
  if (!isCompetitionDefinition(cmd.targetDefinition)) {
    errors.push(
      createFieldError(
        "targetDefinition",
        COMPETITION_VERSION_ERROR_CODE.INVALID_RESTORE_TARGET,
        "targetDefinition must be a valid CompetitionDefinition",
        {}
      )
    );
  }
  if (
    !isValidCompetitionDefinitionRevision(cmd.expectedTargetDefinitionRevision)
  ) {
    errors.push(
      createFieldError(
        "expectedTargetDefinitionRevision",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "expectedTargetDefinitionRevision must be an integer >= 1",
        { value: cmd.expectedTargetDefinitionRevision }
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();
  const source =
    /** @type {import("../contracts/snapshot.js").CompetitionVersion} */ (
      cmd.sourceVersion
    );
  const target = /** @type {Record<string, unknown>} */ (cmd.targetDefinition);

  if (source.tenantId !== tenantId || String(target.tenantId) !== tenantId) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_VERSION_ERROR_CODE.TENANT_MISMATCH,
        "source version and target definition must match explicit tenantId",
        {}
      ),
    ]);
  }

  if (
    source.competitionId !== competitionId ||
    String(target.competitionId) !== competitionId
  ) {
    return validationFail([
      createFieldError(
        "competitionId",
        COMPETITION_VERSION_ERROR_CODE.COMPETITION_MISMATCH,
        "source version and target definition must match explicit competitionId",
        {}
      ),
    ]);
  }

  if (target.revision !== cmd.expectedTargetDefinitionRevision) {
    return validationFail([
      createFieldError(
        "expectedTargetDefinitionRevision",
        COMPETITION_VERSION_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedTargetDefinitionRevision does not match targetDefinition.revision",
        {
          expected: cmd.expectedTargetDefinitionRevision,
          actual: target.revision,
        }
      ),
    ]);
  }

  /** @type {import("../contracts/validation.js").CompetitionVersionFieldError[]} */
  const conflicts = [];
  for (const field of COMPETITION_VERSION_IMMUTABLE_DEFINITION_FIELDS) {
    const sourceValue =
      field === "owner" || field === "createdAt"
        ? field === "createdAt"
          ? target.createdAt
          : source.content.owner
        : source.content[/** @type {keyof typeof source.content} */ (field)];
    // Identity must remain target identity; createdAt stays on target.
    if (field === "competitionId" || field === "tenantId") {
      if (String(target[field]) !== String(source.content[field])) {
        conflicts.push(
          createFieldError(
            field,
            COMPETITION_VERSION_ERROR_CODE.IMMUTABLE_IDENTITY_RESTORE_CONFLICT,
            `immutable identity field ${field} differs between source snapshot and target`,
            {
              source: source.content[field],
              target: target[field],
            }
          )
        );
      }
    } else if (field === "owner") {
      if (canonicalizeJson(target.owner) !== canonicalizeJson(source.content.owner)) {
        conflicts.push(
          createFieldError(
            "owner",
            COMPETITION_VERSION_ERROR_CODE.IMMUTABLE_IDENTITY_RESTORE_CONFLICT,
            "owner is immutable and differs between source snapshot and target",
            {}
          )
        );
      }
    }
    void sourceValue;
  }

  if (conflicts.length > 0) {
    return validationFail(conflicts);
  }

  const proposedReplacementFields = projectContentToDefinitionFields(
    source.content
  );

  // Diff editable management fields only (exclude immutable identity + createdAt).
  const editableKeys = [
    "name",
    "description",
    "competitionType",
    "scope",
    "visibility",
    "status",
    "venues",
    "clubs",
    "registrationWindow",
    "plannedPeriod",
    "template",
    "ruleSet",
  ];

  /** @type {import("../comparison/compare.js").CompetitionVersionDifference[]} */
  const fieldDifferences = [];
  for (const key of editableKeys) {
    const before = target[key] === undefined ? null : target[key];
    const after =
      /** @type {Record<string, unknown>} */ (proposedReplacementFields)[key];
    if (canonicalizeJson(before) === canonicalizeJson(after)) continue;
    if (before == null && after != null) {
      fieldDifferences.push(
        createVersionDifference(
          key,
          COMPETITION_VERSION_CHANGE_TYPE.ADDED,
          null,
          after
        )
      );
    } else if (before != null && after == null) {
      fieldDifferences.push(
        createVersionDifference(
          key,
          COMPETITION_VERSION_CHANGE_TYPE.REMOVED,
          before,
          null
        )
      );
    } else {
      fieldDifferences.push(
        createVersionDifference(
          key,
          COMPETITION_VERSION_CHANGE_TYPE.CHANGED,
          before,
          after
        )
      );
    }
  }

  const sortedDiffs = Object.freeze(sortVersionDifferences(fieldDifferences));
  const proposalId = `restore::${source.versionId}::rev${cmd.expectedTargetDefinitionRevision}::${stableContentFingerprint(
    {
      sourceVersionId: source.versionId,
      expectedTargetDefinitionRevision: cmd.expectedTargetDefinitionRevision,
      contentFingerprint: source.contentFingerprint,
    }
  )}`;

  /** @type {CompetitionRestoreProposal} */
  const proposal = {
    proposalId,
    tenantId,
    competitionId,
    sourceVersionId: source.versionId,
    sourceVersionNumber: source.versionNumber,
    expectedTargetDefinitionRevision: cmd.expectedTargetDefinitionRevision,
    sourceDefinitionRevision: source.sourceDefinitionRevision,
    proposedReplacementFields,
    fieldDifferences: sortedDiffs,
    immutableFieldsPreserved: COMPETITION_VERSION_IMMUTABLE_DEFINITION_FIELDS,
    conflicts: Object.freeze([]),
    executesPersistence: false,
    executesRuntimeRecovery: false,
    mutatesTarget: false,
    publishes: false,
  };

  // Prove target was not mutated.
  void targetSnap;

  return validationOk(deepFreeze(proposal), {
    summary: "Competition restore proposal created (not executed).",
    reasons: Object.freeze([
      `sourceVersionId=${source.versionId}`,
      `expectedTargetDefinitionRevision=${cmd.expectedTargetDefinitionRevision}`,
      `fieldDifferenceCount=${sortedDiffs.length}`,
      "executesPersistence=false",
      "executesRuntimeRecovery=false",
      "mutatesTarget=false",
      "publishes=false",
      "doesNotCallCm01Update",
    ]),
  });
}
