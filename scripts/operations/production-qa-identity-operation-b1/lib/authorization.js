/**
 * Authorization guards for Operation B1.
 * Dry-run is the default.
 *
 * Forward live Production mutation is permanently RETIRED / INERT.
 * APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY must never authorize mutation.
 * Retired batch IDs must never authorize mutation.
 *
 * Live entrypoints must call evaluateAuthorization(); synthetic authResult
 * objects are only for historical engine unit tests and must never come from
 * evaluateAuthorization in forward mode.
 */

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  FORWARD_LIVE_EXECUTION_RETIRED,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK,
  RETIRED_OPERATION_B1_BATCH_IDS,
  RETIRED_OWNER_PRODUCTION_GO,
} from "./constants.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDryRunFlag(value, { defaultDryRun = true } = {}) {
  if (value === undefined || value === null || value === "") {
    return defaultDryRun;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return defaultDryRun;
}

function collectStructuralReasons(input = {}) {
  const reasons = [];
  const projectRef = String(
    input.PRODUCTION_PROJECT_REF ?? input.productionProjectRef ?? ""
  ).trim();
  if (projectRef !== EXPECTED_PRODUCTION_PROJECT_REF) {
    reasons.push("wrong_or_missing_production_project_ref");
  }

  const batchId = String(
    input.OPERATION_B1_BATCH_ID ?? input.batchId ?? ""
  ).trim();
  if (!UUID_RE.test(batchId)) {
    reasons.push("malformed_or_missing_batch_id");
  } else if (RETIRED_OPERATION_B1_BATCH_IDS.includes(batchId)) {
    reasons.push("retired_batch_id_not_reusable");
  }

  const allowlistPath = String(
    input.ALLOWLIST_PATH ?? input.allowlistPath ?? ""
  ).trim();
  if (!allowlistPath) {
    reasons.push("missing_allowlist_path");
  }

  const allowlistSha = String(
    input.ALLOWLIST_SHA256 ?? input.allowlistSha256 ?? ""
  )
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(allowlistSha)) {
    reasons.push("invalid_or_missing_allowlist_sha256");
  }

  return { reasons, projectRef, batchId, allowlistPath, allowlistSha };
}

/**
 * @param {Record<string, unknown>} input
 */
export function evaluateAuthorization(input = {}) {
  const dryRun = parseDryRunFlag(input.DRY_RUN ?? input.dryRun, {
    defaultDryRun: true,
  });
  const mode = String(input.mode ?? input.AUTHORIZATION_MODE ?? "execute")
    .trim()
    .toLowerCase();
  const structural = collectStructuralReasons(input);
  const reasons = [...structural.reasons];

  const ownerGo = String(
    input.OWNER_PRODUCTION_GO ?? input.ownerProductionGo ?? ""
  ).trim();
  const confirm = String(
    input.EXPLICIT_EXECUTE_CONFIRMATION ??
      input.explicitExecuteConfirmation ??
      ""
  ).trim();

  if (!dryRun) {
    if (mode === "rollback") {
      if (
        ownerGo === RETIRED_OWNER_PRODUCTION_GO ||
        ownerGo === "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY"
      ) {
        reasons.push("forward_go_cannot_authorize_rollback");
      } else if (ownerGo !== REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK) {
        reasons.push("missing_or_invalid_owner_production_go");
      }
      if (confirm !== REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
        reasons.push("missing_or_invalid_explicit_execute_confirmation");
      }
    } else {
      // Forward live path permanently retired — never authorize via B1 GO/batch.
      reasons.push("forward_live_execution_retired");
      if (
        ownerGo === RETIRED_OWNER_PRODUCTION_GO ||
        ownerGo === "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY"
      ) {
        reasons.push("retired_owner_production_go_not_reusable");
      } else {
        reasons.push("missing_or_invalid_owner_production_go");
      }
      if (confirm !== REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
        reasons.push("missing_or_invalid_explicit_execute_confirmation");
      }
    }
  }

  const ok = reasons.length === 0;
  // evaluateAuthorization never authorizes B1 forward mutation.
  const authorized =
    !dryRun &&
    ok &&
    mode === "rollback" &&
    FORWARD_LIVE_EXECUTION_RETIRED === true;

  return {
    ok,
    dryRun,
    mode,
    reasons,
    authorized,
    projectRef: structural.projectRef,
    batchId: structural.batchId,
    allowlistPath: structural.allowlistPath,
    allowlistSha: structural.allowlistSha,
    requiredOwnerGo:
      mode === "rollback"
        ? REQUIRED_OWNER_PRODUCTION_GO_ROLLBACK
        : RETIRED_OWNER_PRODUCTION_GO,
    forwardLiveExecutionRetired: FORWARD_LIVE_EXECUTION_RETIRED,
    oldOwnerGoReusable: false,
    oldBatchReusable: false,
  };
}

export function mutationAllowed(authResult) {
  return Boolean(
    authResult &&
      authResult.dryRun === false &&
      authResult.authorized === true &&
      authResult.ok === true
  );
}
