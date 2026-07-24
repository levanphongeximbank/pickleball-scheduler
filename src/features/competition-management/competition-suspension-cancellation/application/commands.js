/**
 * Application commands for Competition Suspension / Cancellation (CM-07).
 *
 * Pure / capability-local: does not mutate CM-01 definition, CM-06 publication,
 * matches, scores, standings, notifications, audit persistence, CORE-15/19/23,
 * or CM-08 archive. Fail-closed. Proposal-only effect plans.
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import { COMPETITION_LIFECYCLE_ACTION } from "../constants/actions.js";
import { COMPETITION_LIFECYCLE_STATE } from "../constants/states.js";
import {
  COMPETITION_LIFECYCLE_INITIAL_REVISION,
  normalizeExpectedLifecycleRevision,
} from "../constants/revision.js";
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
  collectPublicationPolicyErrors,
  collectOptionalVersionContextErrors,
  collectExpectedLifecycleRevisionErrors,
  buildSourceProvenance,
} from "../contracts/source.js";
import {
  projectCompetitionLifecycleState,
  projectCurrentLifecycleRevision,
  computeLifecycleRequestFingerprint,
  buildCompetitionLifecycleRecord,
  resolveTransition,
} from "../contracts/lifecycle.js";
import { createCompetitionLifecycleRecordId } from "../contracts/identity.js";
import { buildCompetitionLifecycleEffectPlan } from "../effects/plan.js";
import { evaluateLifecycleActionEligibility } from "../eligibility/evaluate.js";
import { createInMemoryCompetitionLifecycleRepository } from "../repository/index.js";

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
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
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
    case "ALREADY_SUSPENDED":
      return COMPETITION_LIFECYCLE_ERROR_CODE.ALREADY_SUSPENDED;
    case "NOT_SUSPENDED":
      return COMPETITION_LIFECYCLE_ERROR_CODE.NOT_SUSPENDED;
    case "ALREADY_CANCELLED":
      return COMPETITION_LIFECYCLE_ERROR_CODE.ALREADY_CANCELLED;
    case "CANCELLED_TERMINAL":
      return COMPETITION_LIFECYCLE_ERROR_CODE.CANCELLED_TERMINAL;
    case "RESUME_FORBIDDEN":
      return COMPETITION_LIFECYCLE_ERROR_CODE.RESUME_FORBIDDEN;
    default:
      return COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_TRANSITION;
  }
}

/**
 * Shared transition executor for suspend / resume / cancel.
 * @param {string} action
 * @param {object} command
 * @param {{ requireDataRetentionAck?: boolean }} [opts]
 */
function executeLifecycleTransition(action, command = {}, opts = {}) {
  const definitionSnap = snapshotInput(command.definition);
  void definitionSnap;
  const cmd = command && typeof command === "object" ? command : {};

  /** @type {object[]} */
  const errors = [];

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.idempotencyKey)) {
    errors.push(
      createFieldError(
        "idempotencyKey",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_IDEMPOTENCY_KEY,
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

  // Idempotency check first (before mutation) so retries are safe.
  const idemLookup = repository.findByIdempotencyKey({
    tenantId,
    competitionId,
    idempotencyKey,
  });
  if (!idemLookup.ok) return idemLookup;

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

  const policyGate = collectPublicationPolicyErrors(action, cmd.publicationPolicy);
  errors.push(...policyGate.errors);

  const versionGate = collectOptionalVersionContextErrors(
    cmd.versionContext,
    tenantId,
    competitionId
  );
  errors.push(...versionGate.errors);

  const actorGate = collectActorErrors(cmd.actor, tenantId);
  errors.push(...actorGate.errors);

  const authorityGate = collectAuthorityErrors(cmd.authority);
  errors.push(...authorityGate.errors);

  const reasonGate = collectReasonErrors(action, cmd.reason);
  errors.push(...reasonGate.errors);

  const effectiveResolved = resolveEffectiveAt(cmd.effectiveAt, cmd.clock);
  if (!effectiveResolved.ok) {
    errors.push(
      createFieldError(
        "effectiveAt",
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_EFFECTIVE_TIME,
        effectiveResolved.reason,
        {}
      )
    );
  }

  let intendedResumeAt = null;
  if (action === COMPETITION_LIFECYCLE_ACTION.SUSPEND && cmd.intendedResumeAt != null) {
    if (
      typeof cmd.intendedResumeAt !== "string" ||
      Number.isNaN(Date.parse(cmd.intendedResumeAt))
    ) {
      errors.push(
        createFieldError(
          "intendedResumeAt",
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_INTENDED_RESUME_TIME,
          "intendedResumeAt must be a valid timestamp when provided",
          {}
        )
      );
    } else {
      intendedResumeAt = new Date(cmd.intendedResumeAt).toISOString();
    }
  }

  if (
    opts.requireDataRetentionAck === true &&
    cmd.dataRetentionAcknowledged !== true
  ) {
    errors.push(
      createFieldError(
        "dataRetentionAcknowledged",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_DATA_RETENTION_ACK,
        "explicit dataRetentionAcknowledged=true is required for cancellation",
        {}
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const effectiveAt = effectiveResolved.value;
  if (
    intendedResumeAt != null &&
    Date.parse(intendedResumeAt) <= Date.parse(effectiveAt)
  ) {
    return validationFail([
      createFieldError(
        "intendedResumeAt",
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_INTENDED_RESUME_TIME,
        "intendedResumeAt must be strictly after effectiveAt",
        { effectiveAt, intendedResumeAt }
      ),
    ]);
  }

  const requestFingerprint = computeLifecycleRequestFingerprint({
    action,
    tenantId,
    competitionId,
    expectedLifecycleRevision: normalizeExpectedLifecycleRevision(
      cmd.expectedLifecycleRevision
    ),
    expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    reason: reasonGate.value,
    actor: actorGate.value,
    authority: authorityGate.value,
    publicationPolicy: policyGate.value,
    publicationContext: publicationGate.value,
    versionContext: versionGate.value,
    effectiveAt,
    intendedResumeAt,
    dataRetentionAcknowledged:
      opts.requireDataRetentionAck === true
        ? true
        : cmd.dataRetentionAcknowledged ?? null,
  });

  // Idempotent replay MUST run before concurrency/transition gates so retries
  // with the original expectedLifecycleRevision remain safe.
  if (idemLookup.value) {
    const prior = idemLookup.value;
    if (prior.requestFingerprint !== requestFingerprint) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_LIFECYCLE_ERROR_CODE.IDEMPOTENCY_CONFLICT,
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
        replayed: true,
        definitionMutated: false,
        publicationMutated: false,
        matchesCancelled: false,
        archived: false,
        deleted: false,
        core23Invoked: false,
        notificationSent: false,
        auditPersisted: false,
      }),
      buildExplanation([], "Idempotent lifecycle replay.")
    );
  }

  const currentLookup = repository.findCurrentLifecycle({
    tenantId,
    competitionId,
  });
  if (!currentLookup.ok) return currentLookup;
  const currentRecord = currentLookup.value;

  // Caller may also pass explicit currentLifecycleContext for fail-closed checks.
  if (cmd.currentLifecycleContext != null) {
    if (
      typeof cmd.currentLifecycleContext !== "object" ||
      Array.isArray(cmd.currentLifecycleContext)
    ) {
      return validationFail([
        createFieldError(
          "currentLifecycleContext",
          COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_LIFECYCLE_CONTEXT,
          "currentLifecycleContext must be an object when provided",
          {}
        ),
      ]);
    }
    const ctx = cmd.currentLifecycleContext;
    const projected = projectCompetitionLifecycleState(currentRecord);
    if (
      isNonEmptyString(ctx.state) &&
      String(ctx.state).trim() !== projected
    ) {
      return validationFail([
        createFieldError(
          "currentLifecycleContext.state",
          COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_LIFECYCLE_CONTEXT,
          "currentLifecycleContext.state does not match repository current state",
          { expected: projected, actual: ctx.state }
        ),
      ]);
    }
    const currentRev = projectCurrentLifecycleRevision(currentRecord);
    if (
      ctx.revision !== undefined &&
      normalizeExpectedLifecycleRevision(ctx.revision) !== currentRev
    ) {
      return validationFail([
        createFieldError(
          "currentLifecycleContext.revision",
          COMPETITION_LIFECYCLE_ERROR_CODE.STALE_LIFECYCLE_REVISION,
          "currentLifecycleContext.revision does not match repository current revision",
          { expected: currentRev, actual: ctx.revision }
        ),
      ]);
    }
  }

  const fromState = projectCompetitionLifecycleState(currentRecord);
  const currentRevision = projectCurrentLifecycleRevision(currentRecord);

  const revisionErrors = collectExpectedLifecycleRevisionErrors(
    cmd.expectedLifecycleRevision,
    currentRevision
  );
  if (revisionErrors.length > 0) return validationFail(revisionErrors);

  // Resume effectiveAt must not precede the suspension effectiveAt.
  if (
    action === COMPETITION_LIFECYCLE_ACTION.RESUME &&
    currentRecord &&
    currentRecord.toState === COMPETITION_LIFECYCLE_STATE.SUSPENDED
  ) {
    if (Date.parse(effectiveAt) < Date.parse(currentRecord.effectiveAt)) {
      return validationFail([
        createFieldError(
          "effectiveAt",
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_EFFECTIVE_TIME,
          "resume effectiveAt must not be before suspension effectiveAt",
          {
            suspensionEffectiveAt: currentRecord.effectiveAt,
            resumeEffectiveAt: effectiveAt,
          }
        ),
      ]);
    }
  }

  const transition = resolveTransition(action, fromState);
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
      ? COMPETITION_LIFECYCLE_INITIAL_REVISION
      : currentRevision + 1;
  const recordId = createCompetitionLifecycleRecordId(
    tenantId,
    competitionId,
    nextRevision
  );
  const createdAt = effectiveAt;

  const effectPlan = buildCompetitionLifecycleEffectPlan({
    action,
    tenantId,
    competitionId,
    lifecycleRecordId: recordId,
    lifecycleRevision: nextRevision,
    publicationPolicy: policyGate.value,
    publicationContext: publicationGate.value,
    definitionStatus: definitionGate.value?.status ?? null,
    expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    reasonCode: reasonGate.value?.code,
  });

  const source = buildSourceProvenance({
    tenantId,
    competitionId,
    sourceDefinitionRevision: definitionGate.value.revision,
    sourceCompetitionVersionId: versionGate.value?.competitionVersionId ?? null,
    sourceCompetitionVersionNumber: versionGate.value?.versionNumber ?? null,
    sourcePublicationPresence: publicationGate.value.presence,
    sourcePublicationId: publicationGate.value.publicationId,
    sourcePublicationRevision: publicationGate.value.publicationRevision,
    sourceLifecycleRevision: currentRevision,
    policyId: authorityGate.value.authorizationPolicyId,
    policyVersion: authorityGate.value.authorizationPolicyVersion,
    publicationPolicy: policyGate.value,
    idempotencyKeyFingerprint: stableContentFingerprint({
      tenantId,
      competitionId,
      idempotencyKey,
    }),
    effectiveAt,
    createdAt,
  });

  const record = buildCompetitionLifecycleRecord({
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
    intendedResumeAt,
    previousRecordId: currentRecord ? currentRecord.recordId : null,
    publicationPolicy: policyGate.value,
    effectPlan,
    idempotencyKey,
    requestFingerprint,
    createdAt,
    dataRetentionAcknowledged:
      opts.requireDataRetentionAck === true ? true : null,
  });

  // Prove inputs were not mutated by comparing to snapshots taken earlier —
  // caller-side immutability is enforced by never writing into command.definition.
  const appendResult = repository.appendLifecycleTransitionAtomically({
    record,
  });
  if (!appendResult.ok) return appendResult;

  return validationOk(
    deepFreeze({
      record: appendResult.value,
      effectPlan: clonePlain(effectPlan),
      replayed: false,
      definitionMutated: false,
      publicationMutated: false,
      matchesCancelled: false,
      archived: false,
      deleted: false,
      core23Invoked: false,
      notificationSent: false,
      auditPersisted: false,
    }),
    buildExplanation([], `Competition ${action.toLowerCase()} recorded.`)
  );
}

/**
 * Suspend a competition (ACTIVE → SUSPENDED).
 */
export function suspendCompetition(command = {}) {
  return executeLifecycleTransition(
    COMPETITION_LIFECYCLE_ACTION.SUSPEND,
    command
  );
}

/**
 * Resume a suspended competition (SUSPENDED → ACTIVE).
 * Does not invoke CORE-23 recovery, reopen registration, or republish.
 */
export function resumeCompetition(command = {}) {
  return executeLifecycleTransition(
    COMPETITION_LIFECYCLE_ACTION.RESUME,
    command
  );
}

/**
 * Cancel a competition (ACTIVE|SUSPENDED → CANCELLED). Terminal in CM-07.
 */
export function cancelCompetition(command = {}) {
  return executeLifecycleTransition(
    COMPETITION_LIFECYCLE_ACTION.CANCEL,
    command,
    { requireDataRetentionAck: true }
  );
}

/**
 * Evaluate eligibility without mutating repository.
 */
export function evaluateCompetitionLifecycleActionCommand(command = {}) {
  return evaluateLifecycleActionEligibility(command);
}

/**
 * Get current effective lifecycle projection (tenant/competition scoped).
 */
export function getCurrentCompetitionLifecycle(command = {}) {
  const cmd = command && typeof command === "object" ? command : {};
  /** @type {object[]} */
  const errors = [];
  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_COMPETITION,
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
  const lookup = repoGate.repository.findCurrentLifecycle({
    tenantId,
    competitionId,
  });
  if (!lookup.ok) return lookup;

  const record = lookup.value;
  return validationOk(
    deepFreeze({
      tenantId,
      competitionId,
      state: projectCompetitionLifecycleState(record),
      revision: projectCurrentLifecycleRevision(record),
      currentRecord: record ? clonePlain(record) : null,
      hasLifecycleRecord: Boolean(record),
    })
  );
}

/**
 * List linear lifecycle history for a tenant+competition.
 */
export function listCompetitionLifecycleHistory(command = {}) {
  const cmd = command && typeof command === "object" ? command : {};
  /** @type {object[]} */
  const errors = [];
  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (errors.length > 0) return validationFail(errors);

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;

  const history = repoGate.repository.listLifecycleHistory({
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
export function createCapabilityLocalLifecycleRepository() {
  return createInMemoryCompetitionLifecycleRepository();
}
