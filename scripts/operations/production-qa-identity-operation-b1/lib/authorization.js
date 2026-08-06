/**
 * Authorization guards for Operation B1.
 * Dry-run is the default. Mutation requires exact future Owner GO.
 */

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  REQUIRED_OWNER_PRODUCTION_GO,
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
    if (ownerGo !== REQUIRED_OWNER_PRODUCTION_GO) {
      reasons.push("missing_or_invalid_owner_production_go");
    }
    if (confirm !== REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
      reasons.push("missing_or_invalid_explicit_execute_confirmation");
    }
  }

  const ok = reasons.length === 0;
  const authorized = !dryRun && ok;

  return {
    ok,
    dryRun,
    reasons,
    authorized,
    projectRef: structural.projectRef,
    batchId: structural.batchId,
    allowlistPath: structural.allowlistPath,
    allowlistSha: structural.allowlistSha,
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
