/**
 * Eligibility evaluation for CM-08 archive actions (fail-closed, no side effects).
 */

import { COMPETITION_ARCHIVE_ACTION } from "../constants/actions.js";
import { COMPETITION_ARCHIVE_STATE } from "../constants/states.js";
import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  projectCompetitionArchiveState,
  projectCurrentArchiveRevision,
  resolveArchiveTransition,
} from "../contracts/archive.js";
import {
  collectDefinitionContextErrors,
  collectPublicationContextErrors,
  collectRequiredVersionContextErrors,
  collectArchivePolicyErrors,
  collectFinalizationContextErrors,
  collectOperationalGuardErrors,
} from "../contracts/source.js";
import {
  collectActorErrors,
  collectAuthorityErrors,
} from "../contracts/actor.js";
import { collectReasonErrors } from "../contracts/reason.js";
import { isNonEmptyString, deepFreeze } from "../contracts/shared.js";
import { COMPETITION_OPTIONAL_CONTEXT_PRESENCE } from "../constants/policies.js";

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
 * Evaluate whether an archive / unarchive action is eligible (no mutation).
 *
 * @param {object} command
 */
export function evaluateCompetitionArchiveEligibility(command = {}) {
  const snap = snapshotInput(command);
  void snap;
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
  if (
    cmd.action !== COMPETITION_ARCHIVE_ACTION.ARCHIVE &&
    cmd.action !== COMPETITION_ARCHIVE_ACTION.UNARCHIVE
  ) {
    errors.push(
      createFieldError(
        "action",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_TRANSITION,
        "action must be ARCHIVE or UNARCHIVE",
        { value: cmd.action }
      )
    );
  }

  const policyProfileId = resolvePolicyProfileId(cmd);
  const policyGate = collectArchivePolicyErrors(policyProfileId);
  errors.push(...policyGate.errors);

  if (errors.length > 0) return validationFail(errors);

  const tenantId = String(cmd.tenantId).trim();
  const competitionId = String(cmd.competitionId).trim();
  const policy = policyGate.value;

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

  if (cmd.action === COMPETITION_ARCHIVE_ACTION.ARCHIVE) {
    const versionGate = collectRequiredVersionContextErrors(
      cmd.versionContext,
      tenantId,
      competitionId
    );
    errors.push(...versionGate.errors);

    const finalizationGate = collectFinalizationContextErrors(
      cmd,
      tenantId,
      competitionId,
      policy
    );
    errors.push(...finalizationGate.errors);

    errors.push(...collectOperationalGuardErrors(cmd));

    if (policy.requireRetentionAcknowledgement === true && cmd.retentionAcknowledged !== true) {
      errors.push(
        createFieldError(
          "retentionAcknowledged",
          COMPETITION_ARCHIVE_ERROR_CODE.MISSING_RETENTION_ACK,
          "explicit retentionAcknowledged=true is required under the selected archive policy",
          {}
        )
      );
    }

  }

  if (cmd.action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE) {
    if (policy.unarchiveAllowed !== true) {
      errors.push(
        createFieldError(
          "archivePolicyProfile",
          COMPETITION_ARCHIVE_ERROR_CODE.UNARCHIVE_FORBIDDEN,
          "unarchive is forbidden under the selected archive policy",
          {}
        )
      );
    }
  }

  /** @type {{ requireElevated?: boolean, elevatedMarker?: string }} */
  const authorityOpts = {};
  if (
    cmd.action === COMPETITION_ARCHIVE_ACTION.ARCHIVE &&
    policy.requireElevatedArchiveAuthority === true
  ) {
    authorityOpts.requireElevated = true;
    authorityOpts.elevatedMarker =
      policy.elevatedAuthorityMarker || "ELEVATED_ARCHIVE";
  } else if (
    cmd.action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE &&
    policy.unarchiveRequiresElevatedAuthority === true
  ) {
    authorityOpts.requireElevated = true;
    authorityOpts.elevatedMarker =
      policy.elevatedAuthorityMarker || "ELEVATED_UNARCHIVE";
  }

  const actorGate = collectActorErrors(cmd.actor, tenantId);
  const authorityGate = collectAuthorityErrors(cmd.authority, authorityOpts);
  errors.push(...actorGate.errors);
  errors.push(...authorityGate.errors);

  const reasonGate = collectReasonErrors(cmd.action, cmd.reason);
  errors.push(...reasonGate.errors);

  const currentRecord =
    cmd.currentRecord === undefined ? null : cmd.currentRecord;
  if (
    currentRecord != null &&
    (typeof currentRecord !== "object" || Array.isArray(currentRecord))
  ) {
    errors.push(
      createFieldError(
        "currentRecord",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
        "currentRecord must be an archive record object or null",
        {}
      )
    );
  }

  if (currentRecord) {
    if (String(currentRecord.tenantId).trim() !== tenantId) {
      errors.push(
        createFieldError(
          "currentRecord.tenantId",
          COMPETITION_ARCHIVE_ERROR_CODE.TENANT_MISMATCH,
          "currentRecord.tenantId must match command tenantId",
          {}
        )
      );
    }
    if (String(currentRecord.competitionId).trim() !== competitionId) {
      errors.push(
        createFieldError(
          "currentRecord.competitionId",
          COMPETITION_ARCHIVE_ERROR_CODE.COMPETITION_MISMATCH,
          "currentRecord.competitionId must match command competitionId",
          {}
        )
      );
    }
  }

  if (cmd.action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE) {
    const fromState = projectCompetitionArchiveState(currentRecord);
    if (fromState !== COMPETITION_ARCHIVE_STATE.ARCHIVED) {
      errors.push(
        createFieldError(
          "currentRecord",
          COMPETITION_ARCHIVE_ERROR_CODE.NOT_ARCHIVED,
          "unarchive requires current archive record in ARCHIVED state",
          { fromState }
        )
      );
    }
  }

  if (errors.length > 0) return validationFail(errors);

  const fromState = projectCompetitionArchiveState(currentRecord);
  const currentRevision = projectCurrentArchiveRevision(currentRecord);
  const transition = resolveArchiveTransition(cmd.action, fromState, policy);

  if (!transition.ok) {
    return validationFail([
      createFieldError(
        "action",
        mapTransitionError(transition.code),
        transition.message,
        { fromState, action: cmd.action }
      ),
    ]);
  }

  let finalizationKind = null;
  if (cmd.action === COMPETITION_ARCHIVE_ACTION.ARCHIVE) {
    const finalizationGate = collectFinalizationContextErrors(
      cmd,
      tenantId,
      competitionId,
      policy
    );
    finalizationKind = finalizationGate.value?.finalizationKind ?? null;
  }

  return validationOk(
    deepFreeze({
      eligible: true,
      action: cmd.action,
      fromState,
      toState: transition.toState,
      currentRevision,
      finalizationKind,
      policy,
      tenantId,
      competitionId,
      versionContext:
        cmd.action === COMPETITION_ARCHIVE_ACTION.UNARCHIVE &&
        (cmd.versionContext == null ||
          cmd.versionContext?.presence === COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT)
          ? { presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT }
          : undefined,
    })
  );
}
