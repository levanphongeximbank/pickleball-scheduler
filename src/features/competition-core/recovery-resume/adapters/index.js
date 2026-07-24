/**
 * CORE-23 adapters — consume dependency PUBLIC exports by reference only.
 * Do not import dependency-private internals.
 * Do not redefine dependency-owned state or business rules.
 * Fail closed when evidence is insufficient.
 */

import {
  CORE20_ENGINE_ID,
  CORE20_ENGINE_VERSION,
  COMPETITION_AUDIT_SCHEMA_VERSION,
} from "../../audit/index.js";

import {
  CORE21_ENGINE_ID,
  CORE21_ENGINE_VERSION,
  CORE21_REPLAY_CONTRACT_VERSION,
  createReplayInput,
  createReplayEvidence,
} from "../../deterministic-seed-replay/index.js";

import {
  CORE22_ENGINE_ID,
  CORE22_ENGINE_VERSION,
  createImportPlan,
  detectStaleImportPlan,
  IMPORT_PLAN_SCHEMA_VERSION,
} from "../../import-export/index.js";

import {
  MATCH_ACTION,
  MATCH_TRANSITION_MATRIX,
} from "../../matches/index.js";

import {
  WORKFLOW_STATUS,
  WORKFLOW_EFFECT_STATUS,
  isWorkflowStatus,
  isWorkflowEffectStatus,
} from "../../workflow/index.js";

import { DEPENDENCY_MODULE_ID } from "../constants.js";
import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import { isPlainObject, isNonEmptyString } from "../utils/helpers.js";

/**
 * Snapshot public CORE-15 identifiers for recovery evidence.
 * @returns {Readonly<object>}
 */
export function adaptCore15MatchEvidence() {
  return Object.freeze({
    moduleId: DEPENDENCY_MODULE_ID.CORE15,
    hasTransitionMatrix: MATCH_TRANSITION_MATRIX != null,
    sampleAction: MATCH_ACTION.START,
    note: "CORE-15 match lifecycle rules remain dependency-owned",
  });
}

/**
 * Snapshot public CORE-19 identifiers for recovery evidence.
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function adaptCore19WorkflowEvidence(partial = {}) {
  const status =
    partial.workflowStatus == null
      ? null
      : isWorkflowStatus(partial.workflowStatus)
        ? partial.workflowStatus
        : (() => {
            throw new RecoveryError(
              RECOVERY_ERROR_CODE.DEPENDENCY_EVIDENCE_MISMATCH,
              "Invalid CORE-19 workflow status in recovery evidence",
              { workflowStatus: partial.workflowStatus }
            );
          })();

  const effectStatus =
    partial.effectStatus == null
      ? null
      : isWorkflowEffectStatus(partial.effectStatus)
        ? partial.effectStatus
        : (() => {
            throw new RecoveryError(
              RECOVERY_ERROR_CODE.DEPENDENCY_EVIDENCE_MISMATCH,
              "Invalid CORE-19 effect status in recovery evidence",
              { effectStatus: partial.effectStatus }
            );
          })();

  return Object.freeze({
    moduleId: DEPENDENCY_MODULE_ID.CORE19,
    workflowStatus: status,
    effectStatus,
    knownStatuses: Object.freeze([...Object.values(WORKFLOW_STATUS)]),
    knownEffectStatuses: Object.freeze([
      ...Object.values(WORKFLOW_EFFECT_STATUS),
    ]),
    note: "CORE-19 resumeWorkflow is workflow control, not CORE-23 recovery",
  });
}

/**
 * Snapshot public CORE-20 identifiers for recovery evidence.
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function adaptCore20AuditEvidence(partial = {}) {
  if (partial.requireEventId === true && !isNonEmptyString(partial.eventId)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.DEPENDENCY_EVIDENCE_MISMATCH,
      "CORE-20 event evidence required but eventId missing"
    );
  }
  return Object.freeze({
    moduleId: DEPENDENCY_MODULE_ID.CORE20,
    engineId: CORE20_ENGINE_ID,
    engineVersion: CORE20_ENGINE_VERSION,
    schemaVersion: COMPETITION_AUDIT_SCHEMA_VERSION,
    eventId:
      partial.eventId == null || partial.eventId === ""
        ? null
        : String(partial.eventId).trim(),
    streamComplete: partial.streamComplete === true,
    note: "CORE-20 owns audit persistence; CORE-23 only references evidence",
  });
}

/**
 * Build CORE-21 replay evidence reference without owning replay algorithms.
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function adaptCore21ReplayEvidence(partial = {}) {
  if (!isPlainObject(partial) || Object.keys(partial).length === 0) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.REPLAY_EVIDENCE_MISSING,
      "CORE-21 replay evidence is absent"
    );
  }

  // Prefer caller-supplied sealed replay evidence object.
  if (partial.replayEvidence != null) {
    return Object.freeze({
      moduleId: DEPENDENCY_MODULE_ID.CORE21,
      engineId: CORE21_ENGINE_ID,
      engineVersion: CORE21_ENGINE_VERSION,
      replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
      replayEvidence: partial.replayEvidence,
      seedEvidence: partial.seedEvidence ?? null,
    });
  }

  if (partial.replayInput != null) {
    const input = createReplayInput(partial.replayInput);
    const evidence =
      partial.createEvidence === true
        ? createReplayEvidence({
            ok: partial.ok === true,
            seedIdentity: input.seedIdentity,
            normalizedInputFingerprint: input.normalizedInputFingerprint,
            expectedOutputFingerprint: input.expectedOutputFingerprint,
            ...(partial.replayEvidenceFields ?? {}),
          })
        : null;
    return Object.freeze({
      moduleId: DEPENDENCY_MODULE_ID.CORE21,
      engineId: CORE21_ENGINE_ID,
      engineVersion: CORE21_ENGINE_VERSION,
      replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
      replayInput: input,
      replayEvidence: evidence,
      seedEvidence: partial.seedEvidence ?? { seedIdentity: input.seedIdentity },
    });
  }

  if (partial.seedEvidence != null) {
    return Object.freeze({
      moduleId: DEPENDENCY_MODULE_ID.CORE21,
      engineId: CORE21_ENGINE_ID,
      engineVersion: CORE21_ENGINE_VERSION,
      replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
      seedEvidence: partial.seedEvidence,
      replayEvidence: null,
    });
  }

  throw new RecoveryError(
    RECOVERY_ERROR_CODE.REPLAY_EVIDENCE_MISSING,
    "Insufficient CORE-21 public evidence for replay adaptation"
  );
}

/**
 * Adapt CORE-22 import plan / stale detection for recovery evidence.
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function adaptCore22ImportRestoreEvidence(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.DEPENDENCY_EVIDENCE_MISMATCH,
      "CORE-22 import restore evidence must be a plain object"
    );
  }

  let importPlan = partial.importPlan ?? null;
  if (importPlan == null && partial.createPlan === true) {
    importPlan = createImportPlan(partial.planFields ?? {});
  }

  let stale = null;
  if (importPlan != null && partial.current != null) {
    stale = detectStaleImportPlan(importPlan, partial.current);
  }

  return Object.freeze({
    moduleId: DEPENDENCY_MODULE_ID.CORE22,
    engineId: CORE22_ENGINE_ID,
    engineVersion: CORE22_ENGINE_VERSION,
    importPlanSchemaVersion: IMPORT_PLAN_SCHEMA_VERSION,
    importPlan,
    stale,
    importRestorePartial: partial.importRestorePartial === true,
    recoveryExecutable: importPlan?.recoveryExecutable === true,
    note: "CORE-22 plans are handoff evidence only; CORE-23 owns recovery decisions",
  });
}
