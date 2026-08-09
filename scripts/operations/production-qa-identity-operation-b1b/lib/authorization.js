/**
 * Operation B1B authorization — fail-closed Production (WP4/WP7) + explicit Staging rehearsal (WP6A).
 *
 * No hardcoded Production or Staging GO exists in this package.
 * Dry-run is the default.
 * Retired B1 GO / batches never authorize.
 * Staging mode is never auto-detected from project ref / URL / env fallback.
 *
 * Durable one-time authority consumption is NOT implemented in WP4.
 * Live mutation requires an injected WP7/Owner claimOneTimeLiveAuthority dependency.
 * Process-local Set is defense-in-depth only — not authoritative durability.
 */

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_STAGING_PROJECT_REF,
  FRESH_AUTHORIZATION_BINDING,
  FRESH_STAGING_AUTHORIZATION_BINDING,
  OPERATION_ID,
  OPERATION_TARGET_MODE,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
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
 * Resolve explicit operation target mode.
 * Unset/empty → production (preserves pre-WP6A semantics).
 * Never infers mode from project ref.
 *
 * @param {Record<string, unknown>} input
 * @returns {{ ok: boolean, mode?: string, reasons: string[] }}
 */
export function resolveOperationTargetMode(input = {}) {
  const raw = input.OPERATION_TARGET_MODE ?? input.operationTargetMode;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return {
      ok: true,
      mode: OPERATION_TARGET_MODE.PRODUCTION,
      reasons: [],
    };
  }
  const mode = String(raw).trim().toLowerCase();
  if (
    mode === OPERATION_TARGET_MODE.PRODUCTION ||
    mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL
  ) {
    return { ok: true, mode, reasons: [] };
  }
  return {
    ok: false,
    reasons: ["unknown_or_invalid_operation_target_mode"],
  };
}

function isRetiredOwnerGo(ownerGo) {
  return (
    ownerGo === RETIRED_OWNER_PRODUCTION_GO ||
    ownerGo === "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY"
  );
}

/**
 * Build a fail-closed fresh authorization binding for WP7 / WP6A / tests.
 * Rejects retired GO/batch and empty GO. Does not issue a Production or Staging GO.
 *
 * @param {object} partial
 * @returns {{ ok: boolean, binding?: object, reasons: string[] }}
 */
export function createFreshAuthorizationBinding(partial = {}) {
  const reasons = [];
  const modeResolved = resolveOperationTargetMode(partial);
  if (!modeResolved.ok) {
    return { ok: false, reasons: modeResolved.reasons };
  }
  const mode = modeResolved.mode;
  const isStaging = mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL;

  const ownerGo = String(
    (isStaging
      ? partial.ownerStagingGo || partial.ownerProductionGo
      : partial.ownerProductionGo || partial.ownerStagingGo) || ""
  ).trim();

  const defaultConfirm = isStaging
    ? REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION
    : REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION;
  const explicitExecuteConfirmation = String(
    partial.explicitExecuteConfirmation || defaultConfirm
  ).trim();
  const expectedBatchId = String(partial.expectedBatchId || "").trim();
  const allowlistSha256 = String(partial.allowlistSha256 || "")
    .trim()
    .toLowerCase();
  const snapshotSha256 = String(partial.snapshotSha256 || "")
    .trim()
    .toLowerCase();

  const projectRef = String(
    isStaging
      ? partial.stagingProjectRef ||
          partial.productionProjectRef ||
          EXPECTED_STAGING_PROJECT_REF
      : partial.productionProjectRef || EXPECTED_PRODUCTION_PROJECT_REF
  ).trim();

  if (!ownerGo) {
    reasons.push(
      isStaging
        ? "missing_fresh_owner_staging_go"
        : "missing_fresh_owner_production_go"
    );
  }
  if (isRetiredOwnerGo(ownerGo)) {
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

  if (isStaging) {
    if (projectRef !== EXPECTED_STAGING_PROJECT_REF) {
      reasons.push("wrong_or_missing_staging_project_ref");
    }
    if (projectRef === EXPECTED_PRODUCTION_PROJECT_REF) {
      reasons.push("production_project_ref_rejected_in_staging_mode");
    }
    if (
      explicitExecuteConfirmation !==
      REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION
    ) {
      reasons.push("missing_or_invalid_explicit_staging_execute_confirmation");
    }
    if (
      explicitExecuteConfirmation === REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION
    ) {
      reasons.push("production_execute_confirmation_rejected_in_staging_mode");
    }
  } else {
    if (projectRef !== EXPECTED_PRODUCTION_PROJECT_REF) {
      reasons.push("wrong_or_missing_production_project_ref");
    }
    if (projectRef === EXPECTED_STAGING_PROJECT_REF) {
      reasons.push("staging_project_ref_rejected_in_production_mode");
    }
    if (explicitExecuteConfirmation !== REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
      reasons.push("missing_or_invalid_explicit_execute_confirmation");
    }
    if (
      explicitExecuteConfirmation ===
      REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION
    ) {
      reasons.push("staging_execute_confirmation_rejected_in_production_mode");
    }
  }

  if (reasons.length) {
    return { ok: false, reasons };
  }

  const binding = isStaging
    ? Object.freeze({
        operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
        ownerStagingGo: ownerGo,
        ownerProductionGo: null,
        explicitExecuteConfirmation,
        expectedBatchId,
        allowlistSha256,
        snapshotSha256,
        stagingProjectRef: projectRef,
        productionProjectRef: null,
        issuedBy: "wp6a_or_test_injection_only",
        productionGoIssued: false,
        stagingGoIssued: false,
      })
    : Object.freeze({
        operationTargetMode: OPERATION_TARGET_MODE.PRODUCTION,
        ownerProductionGo: ownerGo,
        ownerStagingGo: null,
        explicitExecuteConfirmation,
        expectedBatchId,
        allowlistSha256,
        snapshotSha256,
        productionProjectRef: projectRef,
        stagingProjectRef: null,
        issuedBy: "wp7_or_test_injection_only",
        productionGoIssued: false,
        stagingGoIssued: false,
      });

  return { ok: true, reasons: [], binding };
}

function resolveFreshBinding(input = {}, mode) {
  if (input.freshAuthorizationBinding && typeof input.freshAuthorizationBinding === "object") {
    return input.freshAuthorizationBinding;
  }
  if (input.FRESH_AUTHORIZATION_BINDING && typeof input.FRESH_AUTHORIZATION_BINDING === "object") {
    return input.FRESH_AUTHORIZATION_BINDING;
  }
  if (mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL) {
    if (
      input.freshStagingAuthorizationBinding &&
      typeof input.freshStagingAuthorizationBinding === "object"
    ) {
      return input.freshStagingAuthorizationBinding;
    }
    return FRESH_STAGING_AUTHORIZATION_BINDING;
  }
  return FRESH_AUTHORIZATION_BINDING;
}

function readProjectRef(input = {}) {
  return String(
    input.TARGET_PROJECT_REF ??
      input.targetProjectRef ??
      input.STAGING_PROJECT_REF ??
      input.stagingProjectRef ??
      input.PRODUCTION_PROJECT_REF ??
      input.productionProjectRef ??
      ""
  ).trim();
}

function readOwnerGo(input = {}, isStaging) {
  if (isStaging) {
    return String(
      input.OWNER_STAGING_GO ??
        input.ownerStagingGo ??
        input.OWNER_PRODUCTION_GO ??
        input.ownerProductionGo ??
        ""
    ).trim();
  }
  return String(
    input.OWNER_PRODUCTION_GO ??
      input.ownerProductionGo ??
      input.OWNER_STAGING_GO ??
      input.ownerStagingGo ??
      ""
  ).trim();
}

/**
 * @param {Record<string, unknown>} input
 */
export function evaluateAuthorization(input = {}) {
  const dryRun = parseDryRunFlag(input.DRY_RUN ?? input.dryRun, {
    defaultDryRun: true,
  });
  const reasons = [];

  const modeResolved = resolveOperationTargetMode(input);
  if (!modeResolved.ok) {
    return {
      ok: false,
      dryRun,
      reasons: modeResolved.reasons,
      authorized: false,
      operationTargetMode: null,
      projectRef: "",
      batchId: "",
      allowlistPath: "",
      allowlistSha: "",
      snapshotPath: "",
      snapshotSha: "",
      ownerProductionGo: "",
      ownerStagingGo: "",
      freshBindingPresent: false,
      newProductionGoIssued: false,
      newStagingGoIssued: false,
      oldOwnerGoReusable: false,
      oldBatchReusable: false,
    };
  }
  const mode = modeResolved.mode;
  const isStaging = mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL;

  const projectRef = readProjectRef(input);
  if (!projectRef) {
    reasons.push(
      isStaging
        ? "missing_staging_project_ref"
        : "missing_production_project_ref"
    );
  } else if (isStaging) {
    if (projectRef === EXPECTED_PRODUCTION_PROJECT_REF) {
      reasons.push("production_project_ref_rejected_in_staging_mode");
    } else if (projectRef !== EXPECTED_STAGING_PROJECT_REF) {
      reasons.push("wrong_or_missing_staging_project_ref");
    }
  } else if (projectRef === EXPECTED_STAGING_PROJECT_REF) {
    reasons.push("staging_project_ref_rejected_in_production_mode");
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

  const ownerGo = readOwnerGo(input, isStaging);
  const confirm = String(
    input.EXPLICIT_EXECUTE_CONFIRMATION ??
      input.explicitExecuteConfirmation ??
      ""
  ).trim();

  if (isRetiredOwnerGo(ownerGo)) {
    reasons.push("retired_owner_production_go_not_reusable");
  }

  const freshBinding = resolveFreshBinding(input, mode);

  if (!dryRun) {
    if (!freshBinding || typeof freshBinding !== "object") {
      reasons.push(
        isStaging
          ? "missing_fresh_staging_authorization_binding"
          : "missing_fresh_authorization_binding"
      );
    } else {
      const bindingMode = String(
        freshBinding.operationTargetMode || OPERATION_TARGET_MODE.PRODUCTION
      ).trim();
      if (bindingMode !== mode) {
        reasons.push("authorization_binding_mode_mismatch");
      }

      const requiredGo = String(
        isStaging
          ? freshBinding.ownerStagingGo || freshBinding.ownerProductionGo || ""
          : freshBinding.ownerProductionGo || freshBinding.ownerStagingGo || ""
      ).trim();
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
        isStaging
          ? freshBinding.stagingProjectRef ||
              freshBinding.productionProjectRef ||
              ""
          : freshBinding.productionProjectRef ||
              freshBinding.stagingProjectRef ||
              ""
      ).trim();

      if (!requiredGo) {
        reasons.push(
          isStaging
            ? "missing_fresh_owner_staging_go"
            : "missing_fresh_owner_production_go"
        );
      }
      if (isRetiredOwnerGo(requiredGo)) {
        reasons.push("retired_owner_production_go_not_reusable");
      }
      if (!ownerGo || ownerGo !== requiredGo) {
        reasons.push(
          isStaging
            ? "missing_or_invalid_owner_staging_go"
            : "missing_or_invalid_owner_production_go"
        );
      }
      if (!confirm || confirm !== requiredConfirm) {
        reasons.push(
          isStaging
            ? "missing_or_invalid_explicit_staging_execute_confirmation"
            : "missing_or_invalid_explicit_execute_confirmation"
        );
      }
      if (isStaging) {
        if (confirm === REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION) {
          reasons.push(
            "production_execute_confirmation_rejected_in_staging_mode"
          );
        }
      } else if (confirm === REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION) {
        reasons.push("staging_execute_confirmation_rejected_in_production_mode");
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
      if (projectRef && requiredProject && projectRef !== requiredProject) {
        reasons.push(
          isStaging
            ? "wrong_or_missing_staging_project_ref"
            : "wrong_or_missing_production_project_ref"
        );
      }
      if (RETIRED_OPERATION_B1_BATCH_IDS.includes(requiredBatch)) {
        reasons.push("retired_batch_id_not_reusable");
      }
    }

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
    operationTargetMode: mode,
    projectRef,
    batchId,
    allowlistPath,
    allowlistSha,
    snapshotPath,
    snapshotSha,
    ownerProductionGo: isStaging ? "" : ownerGo,
    ownerStagingGo: isStaging ? ownerGo : "",
    freshBindingPresent: Boolean(freshBinding),
    newProductionGoIssued: false,
    newStagingGoIssued: false,
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
 * Build immutable bind fingerprint for durable WP7 / Staging consumption.
 */
export function buildOneTimeAuthorityBind(authResult) {
  const mode =
    authResult?.operationTargetMode || OPERATION_TARGET_MODE.PRODUCTION;
  const isStaging = mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL;
  return Object.freeze({
    operationId: OPERATION_ID,
    operationTargetMode: mode,
    batchId: String(authResult?.batchId || "").trim(),
    allowlistSha256: String(authResult?.allowlistSha || "")
      .trim()
      .toLowerCase(),
    snapshotSha256: String(authResult?.snapshotSha || "")
      .trim()
      .toLowerCase(),
    ownerProductionGo: isStaging
      ? ""
      : String(authResult?.ownerProductionGo || "").trim(),
    ownerStagingGo: isStaging
      ? String(authResult?.ownerStagingGo || "").trim()
      : "",
    productionProjectRef: isStaging
      ? ""
      : String(authResult?.projectRef || "").trim(),
    stagingProjectRef: isStaging
      ? String(authResult?.projectRef || "").trim()
      : "",
  });
}

/**
 * Claim one-time live authority via required durable dependency.
 *
 * WP4/WP6A provides NO default success implementation.
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

  const isStaging =
    authResult.operationTargetMode === OPERATION_TARGET_MODE.STAGING_REHEARSAL;
  const go = isStaging
    ? authResult.ownerStagingGo
    : authResult.ownerProductionGo;
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

  markAuthorityConsumed(go, batchId);
  return { ok: true, consumed: true, durable: true };
}
