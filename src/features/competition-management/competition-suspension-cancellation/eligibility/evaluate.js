/**
 * Eligibility evaluation for CM-07 lifecycle actions (fail-closed, no side effects).
 */

import { COMPETITION_LIFECYCLE_ACTION } from "../constants/actions.js";
import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  projectCompetitionLifecycleState,
  projectCurrentLifecycleRevision,
  resolveTransition,
} from "../contracts/lifecycle.js";
import { isNonEmptyString, deepFreeze } from "../contracts/shared.js";

/**
 * Map transition failure codes to typed CM-07 error codes.
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
 * Evaluate whether a lifecycle action is eligible given explicit current context.
 *
 * @param {{
 *   action: string,
 *   tenantId: string,
 *   competitionId: string,
 *   currentRecord?: object|null,
 * }} command
 */
export function evaluateLifecycleActionEligibility(command = {}) {
  const snap = snapshotInput(command);
  void snap;
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
  if (
    cmd.action !== COMPETITION_LIFECYCLE_ACTION.SUSPEND &&
    cmd.action !== COMPETITION_LIFECYCLE_ACTION.RESUME &&
    cmd.action !== COMPETITION_LIFECYCLE_ACTION.CANCEL
  ) {
    errors.push(
      createFieldError(
        "action",
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_TRANSITION,
        "action must be SUSPEND, RESUME, or CANCEL",
        { value: cmd.action }
      )
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const currentRecord =
    cmd.currentRecord === undefined ? null : cmd.currentRecord;
  if (
    currentRecord != null &&
    (typeof currentRecord !== "object" || Array.isArray(currentRecord))
  ) {
    return validationFail([
      createFieldError(
        "currentRecord",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_LIFECYCLE_CONTEXT,
        "currentRecord must be a lifecycle record object or null",
        {}
      ),
    ]);
  }

  if (currentRecord) {
    if (
      String(currentRecord.tenantId).trim() !== String(cmd.tenantId).trim()
    ) {
      errors.push(
        createFieldError(
          "currentRecord.tenantId",
          COMPETITION_LIFECYCLE_ERROR_CODE.TENANT_MISMATCH,
          "currentRecord.tenantId must match command tenantId",
          {}
        )
      );
    }
    if (
      String(currentRecord.competitionId).trim() !==
      String(cmd.competitionId).trim()
    ) {
      errors.push(
        createFieldError(
          "currentRecord.competitionId",
          COMPETITION_LIFECYCLE_ERROR_CODE.COMPETITION_MISMATCH,
          "currentRecord.competitionId must match command competitionId",
          {}
        )
      );
    }
  }

  if (errors.length > 0) return validationFail(errors);

  const fromState = projectCompetitionLifecycleState(currentRecord);
  const currentRevision = projectCurrentLifecycleRevision(currentRecord);
  const transition = resolveTransition(cmd.action, fromState);

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

  return validationOk(
    deepFreeze({
      eligible: true,
      action: cmd.action,
      fromState,
      toState: transition.toState,
      currentRevision,
      tenantId: String(cmd.tenantId).trim(),
      competitionId: String(cmd.competitionId).trim(),
    })
  );
}
