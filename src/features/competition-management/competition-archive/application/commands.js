/**
 * Application commands for Competition Archive (CM-08).
 *
 * Pure / capability-local: does not mutate CM-01 definition, CM-06 publication,
 * CM-07 lifecycle, retention jobs, storage, notifications, audit persistence,
 * CORE-22 export, or CORE-23 recovery. Fail-closed. Proposal-only effect plans.
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import { COMPETITION_ARCHIVE_ACTION } from "../constants/actions.js";
import { COMPETITION_ARCHIVE_STATE } from "../constants/states.js";
import {
  COMPETITION_ARCHIVE_INITIAL_REVISION,
  normalizeExpectedArchiveRevision,
} from "../constants/revision.js";
import { COMPETITION_OPTIONAL_CONTEXT_PRESENCE } from "../constants/policies.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
  buildExplanation,
} from "../contracts/validation.js";
import {
  isNonEmptyString,
  deepFreeze,
  clonePlain,
  resolveEffectiveAt,
  stableContentFingerprint,
} from "../contracts/shared.js";
import {
  collectActorErrors,
  collectAuthorityErrors,
} from "../contracts/actor.js";
import { collectReasonErrors } from "../contracts/reason.js";
import {
  collectDefinitionContextErrors,
  collectPublicationContextErrors,
  collectRequiredVersionContextErrors,
  collectConfigurationContextErrors,
  collectBrandingContextErrors,
  collectArchivePolicyErrors,
  collectExpectedArchiveRevisionErrors,
  collectFinalizationContextErrors,
  collectOperationalGuardErrors,
  buildSourceProvenance,
} from "../contracts/source.js";
import {
  projectCompetitionArchiveState,
  projectCurrentArchiveRevision,
  computeArchiveRequestFingerprint,
  buildCompetitionArchiveRecord,
  resolveArchiveTransition,
} from "../contracts/archive.js";
import { createCompetitionArchiveRecordId } from "../contracts/identity.js";
import { buildCompetitionArchiveEffectPlan } from "../effects/plan.js";
import { buildCompetitionArchiveManifest } from "../manifest/build.js";
import { evaluateCompetitionArchiveEligibility } from "../eligibility/evaluate.js";
import { createInMemoryCompetitionArchiveRepository } from "../repository/index.js";

/**
 * @param {object} [options]
 * @returns {{ ok: true, repository: object } | { ok: false, result: object }}
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
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
        "explicit capability-local repository is required (no implicit global store)",
        {}
      ),
    ]),
  };
}

/**
 * @param {string} code
 * @returns {string}
 */
function mapTransitionError(code) {
  switch (code) {
    case "ALREADY_ARCHIVED":
      return COMPETITION_ARCHIVE_ERROR_CODE.ALREADY_ARCHIVED;
    case "NOT_ARCHIVED":
      return COMPETITION_ARCHIVE_ERROR_CODE.NOT_ARCHIVED;
    case "UNARCHIVE_FORBIDDEN":
      return COMPETITION_ARCHIVE_ERROR_CODE.UNARCHIVE_FORBIDDEN;
    default:
      return COMPETITION_ARCHIVE_ERROR_CODE.INVALID_TRANSITION;
  }
}

/**
 * @param {object} cmd
 * @returns {string|null}
 */
function resolvePolicyProfileId(cmd) {
  if (isNonEmptyString(cmd.archivePolicyProfile)) {
    return String(cmd.archivePolicyProfile).trim();
  }
  if (isNonEmptyString(cmd.archivePolicyId)) {
    return String(cmd.archivePolicyId).trim();
  }
  return null;
}

/**
 * @param {string} action
 * @param {object} command
 */
function executeArchiveTransition(action, command = {}) {
  const definitionSnap = snapshotInput(command.definition);
  void definitionSnap;
  const cmd = command && typeof command === "object" ? command : {};

  /** @type {object[]} */
  const errors = [];

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.idempotencyKey)) {
    errors.push(
      createFieldError(
        "idempotencyKey",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_IDEMPOTENCY_KEY,
        "explicit idempotencyKey is required",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();
  const idempotencyKey = String(cmd.idempotencyKey).trim();

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  const idemLookup = repository.findByIdempotencyKey({
    tenantId,
    competitionId,
    idempotencyKey,
  });
  if (!idemLookup.ok) return idemLookup;

  const policyGate = collectArchivePolicyErrors(resolvePolicyProfileId(cmd));
  errors.push(...policyGate.errors);

  const definitionGate = collectDefinitionContextErrors(
    cmd.definition,
    tenantId,
    competitionId,
    cmd.expectedDefinitionRevision
  );
  errors.push(...definitionGate.errors);

  const publicationGate = collectPublicationContextErrors(
    cmd.publicationContext,
    tenantId,
    competitionId
  );
  errors.push(...publicationGate.errors);

  const configurationGate = collectConfigurationContextErrors(
    cmd.configurationContext,
    tenantId,
    competitionId
  );
  errors.push(...configurationGate.errors);

  const brandingGate = collectBrandingContextErrors(
    cmd.brandingContext,
    tenantId,
    competitionId
  );
  errors.push(...brandingGate.errors);

  const policy = policyGate.value;

  /** @type {{ errors: object[], value: object|null }} */
  let versionGate;
  /** @type {{ errors: object[], value: object|null }} */
  let finalizationGate = { errors: [], value: null };

  if (action === COMPETITION_ARCHIVE_ACTION.ARCHIVE) {
    versionGate = collectRequiredVersionContextErrors(
      cmd.versionContext,
      tenantId,
      competitionId
    );
    errors.push(...versionGate.errors);

    if (policy) {
      finalizationGate = collectFinalizationContextErrors(
        cmd,
        tenantId,
        competitionId,
        policy
      );
      errors.push(...finalizationGate.errors);
    }

    errors.push(...collectOperationalGuardErrors(cmd));

    if (policy?.requireRetentionAcknowledgement === true && cmd.retentionAcknowledged !== true) {
      errors.push(
        createFieldError(
          "retentionAcknowledged",
          COMPETITION_ARCHIVE_ERROR_CODE.MISSING_RETENTION_ACK,
          "explicit retentionAcknowledged=true is required under the selected archive policy",
          {}
        )
      );
    }
  } else {
    // Unarchive does not re-validate competition version provenance.
    versionGate = {
      errors: [],
      value: deepFreeze({
        presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT,
        competitionVersionId: null,
        versionNumber: null,
      }),
    };
  }

  const actorGate = collectActorErrors(cmd.actor, tenantId);
  errors.push(...actorGate.errors);

  /** @type {{ requireElevated?: boolean, elevatedMarker?: string }} */
  const authorityOpts = {};
  if (
    action === COMPETITION_ARCHIVE_ACTION.ARCHIVE &&
    policy?.requireElevatedArchiveAuthority === true
  ) {
    authorityOpts.requireElevated = true;
    authorityOpts.elevatedMarker =
      policy.elevatedAuthorityMarker || "ELEVATED_ARCHIVE";
  } else if (
    action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE &&
    policy?.unarchiveRequiresElevatedAuthority === true
  ) {
    authorityOpts.requireElevated = true;
    authorityOpts.elevatedMarker =
      policy.elevatedAuthorityMarker || "ELEVATED_UNARCHIVE";
  }

  const authorityGate = collectAuthorityErrors(cmd.authority, authorityOpts);
  errors.push(...authorityGate.errors);

  const reasonGate = collectReasonErrors(action, cmd.reason);
  errors.push(...reasonGate.errors);

  const effectiveResolved = resolveEffectiveAt(cmd.effectiveAt, cmd.clock);
  if (!effectiveResolved.ok) {
    errors.push(
      createFieldError(
        "effectiveAt",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_EFFECTIVE_TIME,
        effectiveResolved.reason,
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const effectiveAt = effectiveResolved.value;

  const requestFingerprint = computeArchiveRequestFingerprint({
    action,
    tenantId,
    competitionId,
    expectedArchiveRevision: normalizeExpectedArchiveRevision(
      cmd.expectedArchiveRevision
    ),
    expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    reason: reasonGate.value,
    actor: actorGate.value,
    authority: authorityGate.value,
    archivePolicyId: policy?.profileId ?? null,
    publicationContext: publicationGate.value,
    versionContext: versionGate.value,
    configurationContext: configurationGate.value,
    brandingContext: brandingGate.value,
    lifecycleContext:
      action === COMPETITION_ARCHIVE_ACTION.ARCHIVE
        ? finalizationGate.value?.lifecycleContext ?? null
        : null,
    completionContext:
      action === COMPETITION_ARCHIVE_ACTION.ARCHIVE
        ? finalizationGate.value?.completionContext ?? null
        : null,
    effectiveAt,
    retentionAcknowledged:
      action === COMPETITION_ARCHIVE_ACTION.ARCHIVE &&
      policy?.requireRetentionAcknowledgement === true
        ? true
        : cmd.retentionAcknowledged ?? null,
  });

  if (idemLookup.value) {
    const prior = idemLookup.value;
    if (prior.requestFingerprint !== requestFingerprint) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_ARCHIVE_ERROR_CODE.IDEMPOTENCY_CONFLICT,
          "same idempotency key with different semantic command",
          {
            priorRecordId: prior.recordId,
            priorFingerprint: prior.requestFingerprint,
            requestFingerprint,
          }
        ),
      ]);
    }
    return validationOk(
      deepFreeze({
        record: clonePlain(prior),
        effectPlan: clonePlain(prior.effectPlan),
        manifest: clonePlain(prior.manifest),
        replayed: true,
        definitionMutated: false,
        publicationMutated: false,
        lifecycleMutated: false,
        versionMutated: false,
        deleted: false,
        purged: false,
        retentionExecuted: false,
        storageDeleted: false,
        publicRouteChanged: false,
        core22ExportCreated: false,
        core23RecoveryInvoked: false,
        notificationSent: false,
        auditPersisted: false,
        productionEffectsExecuted: false,
      }),
      buildExplanation(
        [],
        "Idempotent archive replay. Canonical archive record already exists; production/runtime archival effects not executed."
      )
    );
  }

  const currentLookup = repository.findCurrentArchiveState({
    tenantId,
    competitionId,
  });
  if (!currentLookup.ok) return currentLookup;
  const currentRecord = currentLookup.value;

  if (action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE) {
    const fromState = projectCompetitionArchiveState(currentRecord);
    if (fromState !== COMPETITION_ARCHIVE_STATE.ARCHIVED) {
      return validationFail([
        createFieldError(
          "action",
          COMPETITION_ARCHIVE_ERROR_CODE.NOT_ARCHIVED,
          "unarchive requires current archive record in ARCHIVED state",
          { fromState }
        ),
      ]);
    }
  }

  const fromState = projectCompetitionArchiveState(currentRecord);
  const currentRevision = projectCurrentArchiveRevision(currentRecord);

  const revisionErrors = collectExpectedArchiveRevisionErrors(
    cmd.expectedArchiveRevision,
    currentRevision
  );
  if (revisionErrors.length > 0) return validationFail(revisionErrors);

  const transition = resolveArchiveTransition(action, fromState, policy);
  if (!transition.ok) {
    return validationFail([
      createFieldError(
        "action",
        mapTransitionError(transition.code),
        transition.message,
        { fromState, action }
      ),
    ]);
  }

  const nextRevision =
    currentRevision === 0
      ? COMPETITION_ARCHIVE_INITIAL_REVISION
      : currentRevision + 1;
  const recordId = createCompetitionArchiveRecordId(
    tenantId,
    competitionId,
    nextRevision
  );
  const createdAt = effectiveAt;

  const retentionClassification = {
    classification: "ARCHIVE_RECORD_ONLY",
    deleteAllowed: policy?.delete === true,
    purgeAllowed: policy?.purge === true,
  };

  const effectPlan = buildCompetitionArchiveEffectPlan({
    action,
    tenantId,
    competitionId,
    archiveRecordId: recordId,
    archiveRevision: nextRevision,
    publicationContext: publicationGate.value,
    definitionStatus: definitionGate.value?.status ?? null,
    expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    reasonCode: reasonGate.value?.code,
    archivePolicyId: policy?.profileId ?? null,
    retentionClassification,
  });

  const source = buildSourceProvenance({
    tenantId,
    competitionId,
    sourceDefinitionRevision: definitionGate.value.revision,
    sourceCompetitionVersionId: versionGate.value?.competitionVersionId ?? null,
    sourceCompetitionVersionNumber: versionGate.value?.versionNumber ?? null,
    sourceConfigurationRevision:
      configurationGate.value?.presence === COMPETITION_OPTIONAL_CONTEXT_PRESENCE.PRESENT
        ? configurationGate.value.revision
        : null,
    sourceBrandingRevision:
      brandingGate.value?.presence === COMPETITION_OPTIONAL_CONTEXT_PRESENCE.PRESENT
        ? brandingGate.value.revision
        : null,
    sourcePublicationPresence: publicationGate.value.presence,
    sourcePublicationId: publicationGate.value.publicationId,
    sourcePublicationRevision: publicationGate.value.publicationRevision,
    sourceLifecycleRecordId:
      finalizationGate.value?.lifecycleContext?.lifecycleRecordId ?? null,
    sourceLifecycleRevision:
      finalizationGate.value?.lifecycleContext?.lifecycleRevision ?? null,
    sourceFinalizationKind: finalizationGate.value?.finalizationKind ?? null,
    sourceCompletionEvidenceReference:
      finalizationGate.value?.completionContext?.evidenceReference ?? null,
    sourceArchiveRevision: currentRevision,
    archivePolicyId: policy?.profileId ?? null,
    archivePolicyVersion: policy?.version ?? null,
    idempotencyKeyFingerprint: stableContentFingerprint({
      tenantId,
      competitionId,
      idempotencyKey,
    }),
    effectiveAt,
    createdAt,
  });

  const manifest = buildCompetitionArchiveManifest({
    recordId,
    tenantId,
    competitionId,
    archiveRevision: nextRevision,
    action,
    source,
    finalizationSummary: {
      finalizationKind: finalizationGate.value?.finalizationKind ?? null,
      lifecycleState: finalizationGate.value?.lifecycleContext?.state ?? null,
      completionEvidenceReference:
        finalizationGate.value?.completionContext?.evidenceReference ?? null,
    },
    publicationContext: publicationGate.value,
    versionContext: versionGate.value,
    configurationContext: configurationGate.value,
    brandingContext: brandingGate.value,
    reason: reasonGate.value,
    archivePolicy: policy,
    actor: actorGate.value,
    authority: authorityGate.value,
    effectiveAt,
    retentionClassification,
    integrationIntentSummary: {
      intentTypes: effectPlan.intents.map((i) => i.type),
    },
    clock: cmd.clock ?? null,
  });

  const record = buildCompetitionArchiveRecord({
    recordId,
    tenantId,
    competitionId,
    revision: nextRevision,
    action,
    fromState,
    toState: transition.toState,
    reason: reasonGate.value,
    actor: actorGate.value,
    authority: authorityGate.value,
    source,
    effectiveAt,
    previousRecordId: currentRecord ? currentRecord.recordId : null,
    manifest,
    effectPlan,
    idempotencyKey,
    requestFingerprint,
    createdAt,
    retentionAcknowledged:
      action === COMPETITION_ARCHIVE_ACTION.ARCHIVE &&
      policy?.requireRetentionAcknowledgement === true
        ? true
        : null,
  });

  const appendResult = repository.appendArchiveActionAtomically({ record });
  if (!appendResult.ok) return appendResult;

  const actionLabel =
    action === COMPETITION_ARCHIVE_ACTION.ARCHIVE ? "archive" : "unarchive";

  return validationOk(
    deepFreeze({
      record: appendResult.value,
      effectPlan: clonePlain(effectPlan),
      manifest: clonePlain(manifest),
      replayed: false,
      definitionMutated: false,
      publicationMutated: false,
      lifecycleMutated: false,
      versionMutated: false,
      deleted: false,
      purged: false,
      retentionExecuted: false,
      storageDeleted: false,
      publicRouteChanged: false,
      core22ExportCreated: false,
      core23RecoveryInvoked: false,
      notificationSent: false,
      auditPersisted: false,
      productionEffectsExecuted: false,
    }),
    buildExplanation(
      [],
      `Competition ${actionLabel} recorded. Canonical archive record created, production/runtime archival effects not executed.`
    )
  );
}

/**
 * Archive a competition (UNARCHIVED → ARCHIVED).
 */
export function archiveCompetition(command = {}) {
  return executeArchiveTransition(COMPETITION_ARCHIVE_ACTION.ARCHIVE, command);
}

/**
 * Unarchive a competition (ARCHIVED → UNARCHIVED).
 */
export function unarchiveCompetition(command = {}) {
  return executeArchiveTransition(COMPETITION_ARCHIVE_ACTION.UNARCHIVE, command);
}

/**
 * Evaluate eligibility without mutating repository.
 */
export function evaluateCompetitionArchiveEligibilityCommand(command = {}) {
  return evaluateCompetitionArchiveEligibility(command);
}

/**
 * Get current effective archive projection (tenant/competition scoped).
 */
export function getCurrentCompetitionArchiveState(command = {}) {
  const cmd = command && typeof command === "object" ? command : {};
  /** @type {object[]} */
  const errors = [];
  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (errors.length > 0) return validationFail(errors);

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();
  const lookup = repoGate.repository.findCurrentArchiveState({
    tenantId,
    competitionId,
  });
  if (!lookup.ok) return lookup;

  const record = lookup.value;
  return validationOk(
    deepFreeze({
      tenantId,
      competitionId,
      state: projectCompetitionArchiveState(record),
      revision: projectCurrentArchiveRevision(record),
      currentRecord: record ? clonePlain(record) : null,
      hasArchiveRecord: Boolean(record),
    })
  );
}

/**
 * List linear archive history for a tenant+competition.
 */
export function listCompetitionArchiveHistory(command = {}) {
  const cmd = command && typeof command === "object" ? command : {};
  /** @type {object[]} */
  const errors = [];
  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (errors.length > 0) return validationFail(errors);

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;

  const history = repoGate.repository.listArchiveHistory({
    tenantId: String(cmd.tenantId).trim(),
    competitionId: String(cmd.competitionId).trim(),
  });
  if (!history.ok) return history;

  return validationOk(
    deepFreeze({
      tenantId: String(cmd.tenantId).trim(),
      competitionId: String(cmd.competitionId).trim(),
      records: history.value,
    })
  );
}

/**
 * Convenience factory used by tests — wraps in-memory repository creation.
 */
export function createCapabilityLocalArchiveRepository() {
  return createInMemoryCompetitionArchiveRepository();
}
