/**
 * Application commands for Competition Versioning (CM-03).
 *
 * Pure / capability-local: no CM-01 mutation, no audit, no workflow, no replay,
 * no recovery, no production DB writes. Fail-closed lineage and tenant scope.
 */

import {
  COMPETITION_VERSION_INITIAL_NUMBER,
  nextCompetitionVersionNumber,
} from "../constants/versioning.js";
import { COMPETITION_VERSION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  clonePlain,
  isNonEmptyString,
  isValidTimestamp,
  canonicalizeJson,
} from "../contracts/shared.js";
import {
  buildVersionContentFromDefinition,
  assembleCompetitionVersion,
  collectDefinitionScopeErrors,
  parseOptionalTemplateVersioned,
  computeVersionContentFingerprint,
} from "../contracts/snapshot.js";
import { createInMemoryCompetitionVersionRepository } from "../repository/index.js";
import { compareCompetitionVersions } from "../comparison/index.js";
import { createCompetitionRestoreProposal } from "../restore/index.js";

/**
 * @param {object} [options]
 * @returns {{ ok: true, repository: object } | { ok: false, result: import("../contracts/validation.js").CompetitionVersionValidationResult }}
 */
function requireRepository(options = {}) {
  if (options.repository) {
    return { ok: true, repository: options.repository };
  }
  return {
    ok: false,
    result: validationFail([
      createFieldError(
        "repository",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "explicit capability-local repository is required (no implicit global store)",
        {}
      ),
    ]),
  };
}

/**
 * Create an immutable CompetitionVersion snapshot from an explicit definition.
 *
 * Root: expectedParentVersionId === null AND expectedLatestVersionNumber === 0
 * Next: expectedParentVersionId === latest.versionId AND expectedLatestVersionNumber === latest.versionNumber
 *
 * Does NOT mutate definition, bump CM-01 revision, publish, audit, or write production DB.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   expectedParentVersionId: string|null,
 *   expectedLatestVersionNumber: number,
 *   createdAt: string|number,
 *   createdBy?: string|null,
 *   reason?: string|null,
 *   idempotencyKey?: string|null,
 *   templateVersioned?: object|null,
 *   instantiationPlanChecksum?: string|null,
 *   repository?: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionVersionValidationResult}
 */
export function createCompetitionVersion(command = {}) {
  const commandSnap = snapshotInput(command);
  const definitionSnap = snapshotInput(command.definition);
  void commandSnap;

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
  if (!isValidTimestamp(cmd.createdAt)) {
    errors.push(
      createFieldError(
        "createdAt",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "explicit createdAt timestamp is required",
        { value: cmd.createdAt }
      )
    );
  }
  if (
    !Object.prototype.hasOwnProperty.call(cmd, "expectedParentVersionId")
  ) {
    errors.push(
      createFieldError(
        "expectedParentVersionId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_EXPECTED_PARENT,
        "expectedParentVersionId must be explicit (null for root, versionId for next)",
        {}
      )
    );
  }
  if (
    !Number.isInteger(cmd.expectedLatestVersionNumber) ||
    cmd.expectedLatestVersionNumber < 0
  ) {
    errors.push(
      createFieldError(
        "expectedLatestVersionNumber",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "expectedLatestVersionNumber must be an integer >= 0 (0 for root)",
        { value: cmd.expectedLatestVersionNumber }
      )
    );
  }

  const tenantId = isNonEmptyString(cmd.tenantId)
    ? String(cmd.tenantId).trim()
    : "";
  const competitionId = isNonEmptyString(cmd.competitionId)
    ? String(cmd.competitionId).trim()
    : "";

  if (tenantId && competitionId) {
    errors.push(
      ...collectDefinitionScopeErrors(cmd.definition, {
        tenantId,
        competitionId,
        expectedDefinitionRevision: cmd.expectedDefinitionRevision,
      })
    );
  }

  const templateParsed = parseOptionalTemplateVersioned(cmd.templateVersioned);
  if (templateParsed.error) errors.push(templateParsed.error);

  if (
    cmd.instantiationPlanChecksum != null &&
    cmd.instantiationPlanChecksum !== "" &&
    !isNonEmptyString(cmd.instantiationPlanChecksum)
  ) {
    errors.push(
      createFieldError(
        "instantiationPlanChecksum",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "instantiationPlanChecksum must be a non-empty string when provided",
        {}
      )
    );
  }

  if (errors.length > 0) {
    void definitionSnap;
    return validationFail(errors);
  }

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  // Idempotent retry: same key + same semantic payload → same version.
  if (isNonEmptyString(cmd.idempotencyKey)) {
    const existingIdem = repository.findByIdempotencyKey({
      tenantId,
      competitionId,
      idempotencyKey: String(cmd.idempotencyKey).trim(),
    });
    if (existingIdem.ok && existingIdem.value) {
      const content = buildVersionContentFromDefinition(cmd.definition, {
        templateVersioned: templateParsed.value ?? null,
        instantiationPlanChecksum: cmd.instantiationPlanChecksum ?? null,
      });
      const fingerprint = computeVersionContentFingerprint(
        content,
        cmd.expectedDefinitionRevision
      );
      if (existingIdem.value.contentFingerprint !== fingerprint) {
        return validationFail([
          createFieldError(
            "idempotencyKey",
            COMPETITION_VERSION_ERROR_CODE.IDEMPOTENCY_CONFLICT,
            "idempotency key already used with different snapshot content",
            {
              idempotencyKey: String(cmd.idempotencyKey).trim(),
              existingFingerprint: existingIdem.value.contentFingerprint,
              requestedFingerprint: fingerprint,
            }
          ),
        ]);
      }
      // Prove definition not mutated.
      if (canonicalizeJson(cmd.definition) !== canonicalizeJson(definitionSnap)) {
        return validationFail([
          createFieldError(
            "definition",
            COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
            "definition was mutated during version creation",
            {}
          ),
        ]);
      }
      return validationOk(clonePlain(existingIdem.value), {
        summary: "Idempotent retry returned existing competition version.",
        reasons: Object.freeze([
          `versionId=${existingIdem.value.versionId}`,
          "idempotent=true",
          "definitionNotMutated=true",
          "cm01RevisionUnchanged=true",
        ]),
      });
    }
  }

  const latestResult = repository.findLatestVersion({
    tenantId,
    competitionId,
  });
  if (!latestResult.ok) return latestResult;
  const latest = latestResult.value;

  const expectedLatest = cmd.expectedLatestVersionNumber;
  const expectedParent = cmd.expectedParentVersionId;

  if (expectedLatest === 0) {
    if (latest != null) {
      return validationFail([
        createFieldError(
          "expectedLatestVersionNumber",
          COMPETITION_VERSION_ERROR_CODE.STALE_LATEST_VERSION,
          "expected root creation but versions already exist",
          {
            expectedLatestVersionNumber: 0,
            actualLatestVersionNumber: latest.versionNumber,
            actualLatestVersionId: latest.versionId,
          }
        ),
      ]);
    }
    if (expectedParent !== null) {
      return validationFail([
        createFieldError(
          "expectedParentVersionId",
          COMPETITION_VERSION_ERROR_CODE.INVALID_LINEAGE,
          "root version requires expectedParentVersionId=null",
          { expectedParentVersionId: expectedParent }
        ),
      ]);
    }
  } else {
    if (latest == null) {
      return validationFail([
        createFieldError(
          "expectedParentVersionId",
          COMPETITION_VERSION_ERROR_CODE.PARENT_NOT_FOUND,
          "parent/latest version not found for non-root creation",
          {}
        ),
      ]);
    }
    if (latest.versionNumber !== expectedLatest) {
      return validationFail([
        createFieldError(
          "expectedLatestVersionNumber",
          COMPETITION_VERSION_ERROR_CODE.STALE_LATEST_VERSION,
          "expectedLatestVersionNumber does not match current latest",
          {
            expected: expectedLatest,
            actual: latest.versionNumber,
          }
        ),
      ]);
    }
    if (expectedParent !== latest.versionId) {
      return validationFail([
        createFieldError(
          "expectedParentVersionId",
          COMPETITION_VERSION_ERROR_CODE.STALE_PARENT_VERSION,
          "expectedParentVersionId must equal current latest versionId (linear lineage)",
          {
            expected: latest.versionId,
            actual: expectedParent,
          }
        ),
      ]);
    }

    // Parent tenant/competition already enforced by repository scope, but
    // re-check fail-closed for explicit clarity.
    if (latest.tenantId !== tenantId) {
      return validationFail([
        createFieldError(
          "expectedParentVersionId",
          COMPETITION_VERSION_ERROR_CODE.PARENT_TENANT_MISMATCH,
          "parent version belongs to another tenant",
          {}
        ),
      ]);
    }
    if (latest.competitionId !== competitionId) {
      return validationFail([
        createFieldError(
          "expectedParentVersionId",
          COMPETITION_VERSION_ERROR_CODE.PARENT_COMPETITION_MISMATCH,
          "parent version belongs to another competition",
          {}
        ),
      ]);
    }
  }

  // Explicit parent lookup rejection when parent id provided but missing in repo.
  if (expectedParent != null) {
    const parentLookup = repository.findVersionById({
      tenantId,
      competitionId,
      versionId: expectedParent,
    });
    if (!parentLookup.ok) {
      // Remap not-found to PARENT_NOT_FOUND for create semantics.
      return validationFail([
        createFieldError(
          "expectedParentVersionId",
          COMPETITION_VERSION_ERROR_CODE.PARENT_NOT_FOUND,
          "parent version not found for tenant/competition scope",
          { expectedParentVersionId: expectedParent }
        ),
      ]);
    }
  }

  const versionNumber =
    expectedLatest === 0
      ? COMPETITION_VERSION_INITIAL_NUMBER
      : nextCompetitionVersionNumber(expectedLatest);

  const content = buildVersionContentFromDefinition(cmd.definition, {
    templateVersioned: templateParsed.value ?? null,
    instantiationPlanChecksum:
      cmd.instantiationPlanChecksum == null || cmd.instantiationPlanChecksum === ""
        ? null
        : String(cmd.instantiationPlanChecksum),
  });

  const version = assembleCompetitionVersion({
    tenantId,
    competitionId,
    versionNumber,
    parentVersionId: expectedParent,
    sourceDefinitionRevision: cmd.expectedDefinitionRevision,
    content,
    createdAt: cmd.createdAt,
    createdBy: cmd.createdBy ?? null,
    reason: cmd.reason ?? null,
    idempotencyKey: cmd.idempotencyKey ?? null,
  });

  const saved = repository.saveVersion(version);
  if (!saved.ok) return saved;

  // Prove definition was not mutated and CM-01 revision unchanged.
  if (canonicalizeJson(cmd.definition) !== canonicalizeJson(definitionSnap)) {
    return validationFail([
      createFieldError(
        "definition",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "definition was mutated during version creation",
        {}
      ),
    ]);
  }
  if (
    /** @type {any} */ (cmd.definition).revision !==
    cmd.expectedDefinitionRevision
  ) {
    return validationFail([
      createFieldError(
        "definition.revision",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "CM-01 definition revision changed during version creation",
        {}
      ),
    ]);
  }

  return validationOk(saved.value, {
    summary: "Immutable competition version created.",
    reasons: Object.freeze([
      `versionId=${saved.value.versionId}`,
      `versionNumber=${saved.value.versionNumber}`,
      `parentVersionId=${saved.value.parentVersionId}`,
      `sourceDefinitionRevision=${saved.value.sourceDefinitionRevision}`,
      `contentFingerprint=${saved.value.contentFingerprint}`,
      "state=frozen",
      "definitionNotMutated=true",
      "cm01RevisionUnchanged=true",
      "noPublicationOwnership=true",
      "noAuditPersistence=true",
      "noReplayOrRecoveryCheckpoint=true",
      "noProductionDatabaseWrite=true",
    ]),
  });
}

/**
 * Tenant/competition scoped version lookup.
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   versionId: string,
 *   repository?: object,
 * }} command
 */
export function getCompetitionVersion(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;
  return repository.findVersionById({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    versionId: command.versionId,
  });
}

/**
 * Tenant/competition scoped version list (stable by versionNumber).
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   repository?: object,
 * }} command
 */
export function listCompetitionVersions(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;
  return repository.listVersions({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
  });
}

/**
 * Compare two versions by explicit identity via repository lookups.
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   leftVersionId: string,
 *   rightVersionId: string,
 *   allowCrossCompetition?: boolean,
 *   repository?: object,
 * }} command
 */
export function compareCompetitionVersionsCommand(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  /** @type {import("../contracts/validation.js").CompetitionVersionFieldError[]} */
  const errors = [];
  if (!isNonEmptyString(command.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(command.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(command.leftVersionId)) {
    errors.push(
      createFieldError(
        "leftVersionId",
        COMPETITION_VERSION_ERROR_CODE.INVALID_IDENTIFIER,
        "explicit leftVersionId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(command.rightVersionId)) {
    errors.push(
      createFieldError(
        "rightVersionId",
        COMPETITION_VERSION_ERROR_CODE.INVALID_IDENTIFIER,
        "explicit rightVersionId is required",
        {}
      )
    );
  }
  if (errors.length > 0) return validationFail(errors);

  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;
  const left = repository.findVersionById({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    versionId: command.leftVersionId,
  });
  if (!left.ok) return left;
  const right = repository.findVersionById({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    versionId: command.rightVersionId,
  });
  if (!right.ok) return right;

  return compareCompetitionVersions({
    tenantId: command.tenantId,
    left: left.value,
    right: right.value,
    allowCrossCompetition: command.allowCrossCompetition === true,
  });
}

/**
 * Create restore proposal from a stored source version + explicit target definition.
 * Proposal only — does not execute CM-01 update / persistence / recovery.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   sourceVersionId: string,
 *   targetDefinition: object,
 *   expectedTargetDefinitionRevision: number,
 *   repository?: object,
 * }} command
 */
export function createCompetitionRestoreProposalCommand(command = {}) {
  const snap = snapshotInput(command);
  const targetSnap = snapshotInput(command.targetDefinition);
  void snap;

  /** @type {import("../contracts/validation.js").CompetitionVersionFieldError[]} */
  const errors = [];
  if (!isNonEmptyString(command.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(command.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_VERSION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(command.sourceVersionId)) {
    errors.push(
      createFieldError(
        "sourceVersionId",
        COMPETITION_VERSION_ERROR_CODE.INVALID_IDENTIFIER,
        "explicit sourceVersionId is required",
        {}
      )
    );
  }
  if (errors.length > 0) return validationFail(errors);

  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;
  const source = repository.findVersionById({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    versionId: command.sourceVersionId,
  });
  if (!source.ok) return source;

  const proposal = createCompetitionRestoreProposal({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
    sourceVersion: source.value,
    targetDefinition: command.targetDefinition,
    expectedTargetDefinitionRevision: command.expectedTargetDefinitionRevision,
  });

  // Prove target not mutated by proposal creation.
  if (
    command.targetDefinition &&
    canonicalizeJson(command.targetDefinition) !== canonicalizeJson(targetSnap)
  ) {
    return validationFail([
      createFieldError(
        "targetDefinition",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "targetDefinition was mutated during restore proposal creation",
        {}
      ),
    ]);
  }

  return proposal;
}

/**
 * Convenience: create a dedicated capability-local repository instance.
 * @returns {ReturnType<typeof createInMemoryCompetitionVersionRepository>}
 */
export function createCapabilityLocalVersionRepository() {
  return createInMemoryCompetitionVersionRepository();
}

// Re-export pure compare/restore for callers that already hold version objects.
export { compareCompetitionVersions, createCompetitionRestoreProposal };
