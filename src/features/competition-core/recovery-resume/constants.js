/**
 * CORE-23 Competition Recovery & Resume — capability identity + schema locks.
 */

export const CORE23_ENGINE_ID = "competition-core.recovery-resume";
export const CORE23_ENGINE_VERSION = "1.0.0";

export const CORE23_CONTRACT_ID = "competition-core.recovery-resume";
export const CORE23_SCHEMA_VERSION = 1;

export const RECOVERY_CHECKPOINT_SCHEMA_VERSION = "core23.recovery-checkpoint.v1";
export const RESUME_TOKEN_SCHEMA_VERSION = "core23.resume-token.v1";
export const RECOVERY_PLAN_SCHEMA_VERSION = "core23.recovery-plan.v1";
export const RECOVERY_OUTCOME_SCHEMA_VERSION = "core23.recovery-outcome.v1";
export const RECOVERY_REQUEST_SCHEMA_VERSION = "core23.recovery-request.v1";

/** Checkpoint integrity fingerprint algorithm (identity hash, not cryptographic security). */
export const CORE23_CHECKPOINT_FINGERPRINT_VERSION =
  "CORE23_CHECKPOINT_FINGERPRINT_FNV1A32_V1";

export const CORE23_SOURCE = Object.freeze({
  capability: "CORE-23",
  moduleId: CORE23_CONTRACT_ID,
});

/** Dependency module ids referenced by evidence (public, by reference). */
export const DEPENDENCY_MODULE_ID = Object.freeze({
  CORE15: "competition-core.matches",
  CORE19: "competition-core.workflow",
  CORE20: "competition-core.audit",
  CORE21: "competition-core.deterministic-seed-replay",
  CORE22: "competition-core.import-export",
});
