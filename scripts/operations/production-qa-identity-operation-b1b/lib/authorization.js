/**
 * Operation B1B authorization — fail-closed future binding for WP7.
 *
 * No hardcoded Production GO exists in WP4.
 * Dry-run is the default.
 * Retired B1 GO / batches never authorize.
 *
 * Durable one-time authority consumption is NOT implemented in WP4.
 * Live mutation requires an injected WP7 claimOneTimeLiveAuthority dependency.
 * Process-local Set is defense-in-depth only — not authoritative durability.
 */

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  FRESH_AUTHORIZATION_BINDING,
  OPERATION_ID,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  RETIRED_OPERATION_B1_BATCH_IDS,
  RETIRED_OWNER_PRODUCTION_GO,
} from "./constants.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Process-local defense-in-depth only — NOT durable cross-process consumption. */
const consumedAuthorityKeys = new Set();

export function authorityConsumptionKey(ownerGo, batchId) {
  return `${String(ownerGo || "").trim()}::${String(batchId || "").trim().toLowerCase()}`;
}

export function isAuthorityConsumed(ownerGo, batchId) {
  return consumedAuthorityKeys.has(authorityConsumptionKey(ownerGo, batchId));
}

export function markAuthorityConsumed(ownerGo, batchId) {
  consumedAuthorityKeys.add(authorityConsumptionKey(ownerGo, batchId));
}

/** Test-only reset of process-local defense-in-depth set. */
export function resetAuthorityConsumptionForTests() {
  consumedAuthorityKeys.clear();
}

export function parseDryRunFlag(value, { defaultDryRun = true } = {}) {
  if (value === undefined || value === null || value === "") {
    return defaultDryRun;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return defaultDryRun;
}

/**
 * Build a fail-closed fresh authorization binding for WP7 / tests.
 * Rejects retired GO/batch and empty GO. Does not issue a Production GO.
 *
 * @param {object} partial
 * @returns {{ ok: boolean, binding?: object, reasons: string[] }}
 */
export function createFreshAuthorizationBinding(partial = {}) {
  const reasons = [];
  const ownerProductionGo = String(partial.ownerProductionGo || "").trim();
  const explicitExecuteConfirmation = String(
    partial.explicitExecuteConfirmation ||
      REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION
  ).trim();
  const expectedBatchId = String(partial.expectedBatchId || "").trim();
  const allowlistSha256 = String(partial.allowlistSha256 || "")
    .trim()
    .toLowerCase();
  const snapshotSha256 = String(partial.snapshotSha256 || "")
    .trim()
    .toLowerCase();
  const productionProjectRef = String(
    partial.productionProjectRef || EXPECTED_PRODUCTION_PROJECT_REF
  ).trim();

  if (!ownerProductionGo) {
    reasons.push("missing_fresh_owner_production_go");
  }
  if (
    ownerProductionGo === RETIRED_OWNER_PRODUCTION_GO ||
    ownerProductionGo === "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY"
  ) {
    reasons.push("retired_owner_production_go_not_reusable");
  }
  if (!UUID_RE.test(expectedBatchId)) {
    reasons.push("malformed_or_missing_batch_id");
  } else if (RETIRED_OPERATION_B1_BATCH_IDS.includes(expectedBatchId)) {
    reasons.push("retired_batch_id_not_reusable");
  }
  if (!/^[0-9a-f]{64}$/.test(allowlistSha256)) {
    reasons.push("invalid_or_missing_allowlist_sha256");
  }
  if (!/^[0-9a-f]{64}$/.test(snapshotSha256)) {
    reasons.push("invalid_or_missing_snapshot_sha256");
  }
  if (productionProjectRef !== EXPECTED_PRODUCTION_PROJECT_REF) {
    reasons.push("wrong_or_missing_production_project_ref");
  }
  if (explicitExecuteConfirmation !== REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
    reasons.push("missing_or_invalid_explicit_execute_confirmation");
  }

  if (reasons.length) {
    return { ok: false, reasons };
  }

  return {
    ok: true,
    reasons: [],
    binding: Object.freeze({
      ownerProductionGo,
      explicitExecuteConfirmation,
      expectedBatchId,
      allowlistSha256,
      snapshotSha256,
      productionProjectRef,
      issuedBy: "wp7_or_test_injection_only",
      productionGoIssued: false,
    }),
  };
}

function resolveFreshBinding(input = {}) {
  if (input.freshAuthorizationBinding && typeof input.freshAuthorizationBinding === "object") {
    return input.freshAuthorizationBinding;
  }
  if (input.FRESH_AUTHORIZATION_BINDING && typeof input.FRESH_AUTHORIZATION_BINDING === "object") {
    return input.FRESH_AUTHORIZATION_BINDING;
  }
  return FRESH_AUTHORIZATION_BINDING;
}

/**
 * @param {Record<string, unknown>} input
 */
export function evaluateAuthorization(input = {}) {
  const dryRun = parseDryRunFlag(input.DRY_RUN ?? input.dryRun, {
    defaultDryRun: true,
  });
  const reasons = [];

  const projectRef = String(
    input.PRODUCTION_PROJECT_REF ?? input.productionProjectRef ?? ""
  ).trim();
  if (!projectRef) {
    reasons.push("missing_production_project_ref");
  } else if (projectRef !== EXPECTED_PRODUCTION_PROJECT_REF) {
    reasons.push("wrong_or_missing_production_project_ref");
  }

  const batchId = String(
    input.OPERATION_B1B_BATCH_ID ??
      input.OPERATION_B1_BATCH_ID ??
      input.batchId ??
      ""
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

  const snapshotPath = String(
    input.RECOVERY_SNAPSHOT_PATH ??
      input.SNAPSHOT_PATH ??
      input.snapshotPath ??
      ""
  ).trim();
  const snapshotSha = String(
    input.SNAPSHOT_SHA256 ??
      input.RECOVERY_SNAPSHOT_SHA256 ??
      input.snapshotSha256 ??
      ""
  )
    .trim()
    .toLowerCase();
  if (!snapshotPath) {
    reasons.push("missing_recovery_snapshot_path");
  }
  if (!/^[0-9a-f]{64}$/.test(snapshotSha)) {
    reasons.push("invalid_or_missing_snapshot_sha256");
  }

  const ownerGo = String(
    input.OWNER_PRODUCTION_GO ?? input.ownerProductionGo ?? ""
  ).trim();
  const confirm = String(
    input.EXPLICIT_EXECUTE_CONFIRMATION ??
      input.explicitExecuteConfirmation ??
      ""
  ).trim();

  if (
    ownerGo === RETIRED_OWNER_PRODUCTION_GO ||
    ownerGo === "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY"
  ) {
    reasons.push("retired_owner_production_go_not_reusable");
  }

  const freshBinding = resolveFreshBinding(input);

  if (!dryRun) {
    if (!freshBinding || typeof freshBinding !== "object") {
      reasons.push("missing_fresh_authorization_binding");
    } else {
      const requiredGo = String(freshBinding.ownerProductionGo || "").trim();
      const requiredConfirm = String(
        freshBinding.explicitExecuteConfirmation || ""
      ).trim();
      const requiredBatch = String(freshBinding.expectedBatchId || "").trim();
      const requiredAllowlistSha = String(freshBinding.allowlistSha256 || "")
        .trim()
        .toLowerCase();
      const requiredSnapshotSha = String(freshBinding.snapshotSha256 || "")
        .trim()
        .toLowerCase();
      const requiredProject = String(
        freshBinding.productionProjectRef || ""
      ).trim();

      if (!requiredGo) {
        reasons.push("missing_fresh_owner_production_go");
      }
      if (
        requiredGo === RETIRED_OWNER_PRODUCTION_GO ||
        requiredGo === "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY"
      ) {
        reasons.push("retired_owner_production_go_not_reusable");
      }
      // Exact match — not a generic non-empty GO check.
      if (!ownerGo || ownerGo !== requiredGo) {
        reasons.push("missing_or_invalid_owner_production_go");
      }
      if (!confirm || confirm !== requiredConfirm) {
        reasons.push("missing_or_invalid_explicit_execute_confirmation");
      }
      if (batchId && requiredBatch && batchId !== requiredBatch) {
        reasons.push("batch_id_binding_mismatch");
      }
      if (
        allowlistSha &&
        requiredAllowlistSha &&
        allowlistSha !== requiredAllowlistSha
      ) {
        reasons.push("allowlist_sha256_binding_mismatch");
      }
      if (
        snapshotSha &&
        requiredSnapshotSha &&
        snapshotSha !== requiredSnapshotSha
      ) {
        reasons.push("snapshot_sha256_binding_mismatch");
      }
      if (
        projectRef &&
        requiredProject &&
        projectRef !== requiredProject
      ) {
        reasons.push("wrong_or_missing_production_project_ref");
      }
      if (RETIRED_OPERATION_B1_BATCH_IDS.includes(requiredBatch)) {
        reasons.push("retired_batch_id_not_reusable");
      }
    }

    // Process-local defense-in-depth only (not durable).
    if (ownerGo && batchId && isAuthorityConsumed(ownerGo, batchId)) {
      reasons.push("authority_already_consumed");
    }
  }

  const ok = reasons.length === 0;
  const authorized = !dryRun && ok;

  return {
    ok,
    dryRun,
    reasons,
    authorized,
    projectRef,
    batchId,
    allowlistPath,
    allowlistSha,
    snapshotPath,
    snapshotSha,
    ownerProductionGo: ownerGo,
    freshBindingPresent: Boolean(freshBinding),
    newProductionGoIssued: false,
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

/**
 * Build immutable bind fingerprint for durable WP7 consumption.
 */
export function buildOneTimeAuthorityBind(authResult) {
  return Object.freeze({
    operationId: OPERATION_ID,
    batchId: String(authResult?.batchId || "").trim(),
    allowlistSha256: String(authResult?.allowlistSha || "")
      .trim()
      .toLowerCase(),
    snapshotSha256: String(authResult?.snapshotSha || "")
      .trim()
      .toLowerCase(),
    ownerProductionGo: String(authResult?.ownerProductionGo || "").trim(),
    productionProjectRef: String(authResult?.projectRef || "").trim(),
  });
}

/**
 * Claim one-time live authority via required WP7 durable dependency.
 *
 * WP4 provides NO default success implementation.
 * Missing dependency => fail closed, zero mutation.
 * Process-local Set is defense-in-depth after durable claim succeeds.
 *
 * @param {object} authResult
 * @param {((bind: object) => Promise<{ok:boolean, reason?:string}>| {ok:boolean, reason?:string}) | undefined} claimOneTimeLiveAuthority
 */
export async function presentLiveAuthority(
  authResult,
  claimOneTimeLiveAuthority
) {
  if (!mutationAllowed(authResult)) {
    return { ok: false, consumed: false, reason: "mutation_not_authorized" };
  }

  if (typeof claimOneTimeLiveAuthority !== "function") {
    return {
      ok: false,
      consumed: false,
      reason: "durable_one_time_authority_dependency_required",
    };
  }

  const go = authResult.ownerProductionGo;
  const batchId = authResult.batchId;
  if (isAuthorityConsumed(go, batchId)) {
    return { ok: false, consumed: true, reason: "authority_already_consumed" };
  }

  const bind = buildOneTimeAuthorityBind(authResult);
  let claim;
  try {
    claim = await claimOneTimeLiveAuthority(bind);
  } catch (err) {
    return {
      ok: false,
      consumed: false,
      reason: `durable_authority_claim_threw:${String(err?.message || err)}`,
    };
  }

  if (!claim || claim.ok !== true) {
    return {
      ok: false,
      consumed: Boolean(claim?.consumed),
      reason:
        claim?.reason ||
        (claim?.consumed
          ? "authority_already_consumed"
          : "durable_authority_claim_rejected"),
    };
  }

  // Defense-in-depth only — not authoritative durability.
  markAuthorityConsumed(go, batchId);
  return { ok: true, consumed: true, durable: true };
}
