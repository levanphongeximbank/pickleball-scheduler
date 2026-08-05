/**
 * RATING-V5-CUTOVER-02 feature flags — all default OFF.
 * Production deny forces OFF regardless of env values.
 */

import {
  isProductionDenyActive,
  isStagingRehearsalEnvironmentAllowed,
  resolveAppEnvironmentLabel,
} from "./environmentGuards.js";
import { WRITER_FREEZE_MODE, WRITER_FREEZE_MODE_SET } from "../constants/writerIds.js";
import { SCALE_MAPPING_STATUS, SCALE_MAPPING_STRATEGY } from "../constants/scaleIds.js";

export const CUTOVER_02_ENV_NAMES = Object.freeze({
  DUAL_READ_COMPARE: "VITE_RATING_V5_DUAL_READ_COMPARE_ENABLED",
  WRITER_FREEZE_MODE: "VITE_RATING_V5_WRITER_FREEZE_MODE",
  COHORT: "VITE_RATING_V5_DUAL_READ_COHORT",
  SAMPLE_RATE: "VITE_RATING_V5_DUAL_READ_SAMPLE_RATE",
  TENANT_ALLOWLIST: "VITE_RATING_V5_CUTOVER_02_TENANT_ALLOWLIST",
  SCALE_MAPPING_STATUS: "VITE_RATING_V5_SCALE_MAPPING_STATUS",
  SCALE_MAPPING_STRATEGY: "VITE_RATING_V5_SCALE_MAPPING_STRATEGY",
  FIXTURE_PREP: "VITE_RATING_V5_CUTOVER_02_FIXTURE_PREP_ENABLED",
  APP_ENV: "VITE_APP_ENV",
  SUPABASE_URL: "VITE_SUPABASE_URL",
});

function readEnvBag(env, name) {
  if (env && typeof env === "object" && name in env) {
    return env[name];
  }
  return undefined;
}

function parseBool(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseCsvSet(value) {
  const raw = String(value || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function parseSampleRate(value) {
  if (value == null || value === "") return 1;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function resolveFreezeMode(raw) {
  const mode = String(raw || WRITER_FREEZE_MODE.OFF).trim().toUpperCase();
  return WRITER_FREEZE_MODE_SET.has(mode) ? mode : WRITER_FREEZE_MODE.OFF;
}

function resolveMappingStatus(raw) {
  const status = String(raw || SCALE_MAPPING_STATUS.UNAPPROVED).trim().toUpperCase();
  return Object.values(SCALE_MAPPING_STATUS).includes(status)
    ? status
    : SCALE_MAPPING_STATUS.UNAPPROVED;
}

function resolveMappingStrategy(raw) {
  const strategy = String(raw || SCALE_MAPPING_STRATEGY.RAW_ONLY).trim().toUpperCase();
  return Object.values(SCALE_MAPPING_STRATEGY).includes(strategy)
    ? strategy
    : SCALE_MAPPING_STRATEGY.RAW_ONLY;
}

/**
 * Resolve CUTOVER-02 runtime config. Missing flags → OFF.
 * Explicit `env` bags are closed (no ambient merge) for deterministic tests.
 * When `env` is omitted, ambient process/import.meta env is used.
 * @param {Record<string, unknown>|null|undefined} [env]
 */
export function resolveCutover02Config(env) {
  const explicitProvided = env != null && typeof env === "object";
  /** @type {Record<string, unknown>} */
  const bag = explicitProvided ? { ...env } : {};

  if (!explicitProvided) {
    const nodeProcess =
      typeof globalThis !== "undefined" && globalThis.process
        ? globalThis.process
        : null;
    const ambient =
      nodeProcess && nodeProcess.env && typeof nodeProcess.env === "object"
        ? nodeProcess.env
        : {};
    const metaEnv =
      typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
        ? import.meta.env
        : {};
    for (const name of [
      ...Object.values(CUTOVER_02_ENV_NAMES),
      "VITE_SUPABASE_URL",
      "SUPABASE_URL",
      "VITE_APP_ENV",
      "APP_ENV",
      "MODE",
      "NODE_ENV",
    ]) {
      if (!(name in bag) && name in metaEnv) bag[name] = metaEnv[name];
      if (!(name in bag) && name in ambient) bag[name] = ambient[name];
    }
  }

  const productionDenied = isProductionDenyActive(bag);
  const stagingAllowed = isStagingRehearsalEnvironmentAllowed(bag);

  const requestedCompare = parseBool(
    readEnvBag(bag, CUTOVER_02_ENV_NAMES.DUAL_READ_COMPARE),
    false
  );
  const requestedFreeze = resolveFreezeMode(
    readEnvBag(bag, CUTOVER_02_ENV_NAMES.WRITER_FREEZE_MODE)
  );

  const denyReason = productionDenied
    ? "PRODUCTION_DENY_GUARD"
    : !stagingAllowed && (requestedCompare || requestedFreeze !== WRITER_FREEZE_MODE.OFF)
      ? "ENVIRONMENT_NOT_ALLOWED"
      : null;

  const dualReadEnabled =
    !productionDenied && stagingAllowed && requestedCompare === true;
  const writerFreezeMode =
    productionDenied || !stagingAllowed
      ? WRITER_FREEZE_MODE.OFF
      : requestedFreeze;

  return Object.freeze({
    dualReadCompareEnabled: dualReadEnabled,
    writerFreezeMode,
    cohortIds: parseCsvSet(readEnvBag(bag, CUTOVER_02_ENV_NAMES.COHORT)),
    sampleRate: parseSampleRate(readEnvBag(bag, CUTOVER_02_ENV_NAMES.SAMPLE_RATE)),
    tenantAllowlist: parseCsvSet(readEnvBag(bag, CUTOVER_02_ENV_NAMES.TENANT_ALLOWLIST)),
    scaleMappingStatus: resolveMappingStatus(
      readEnvBag(bag, CUTOVER_02_ENV_NAMES.SCALE_MAPPING_STATUS)
    ),
    scaleMappingStrategy: resolveMappingStrategy(
      readEnvBag(bag, CUTOVER_02_ENV_NAMES.SCALE_MAPPING_STRATEGY)
    ),
    environmentLabel: resolveAppEnvironmentLabel(bag),
    productionDenied,
    stagingRehearsalAllowed: stagingAllowed,
    denyReason,
    requested: Object.freeze({
      dualReadCompareEnabled: requestedCompare,
      writerFreezeMode: requestedFreeze,
    }),
  });
}

export function isDualReadCompareEnabled(env) {
  return resolveCutover02Config(env).dualReadCompareEnabled === true;
}

export function getWriterFreezeMode(env) {
  return resolveCutover02Config(env).writerFreezeMode;
}

/**
 * Cohort gate: empty cohort = all eligible when compare enabled.
 * @param {string|null|undefined} playerId
 * @param {ReturnType<typeof resolveCutover02Config>} config
 */
export function isPlayerInDualReadCohort(playerId, config) {
  if (!config?.dualReadCompareEnabled) return false;
  const id = String(playerId || "").trim();
  if (!id) return false;
  if (config.cohortIds.size === 0) return true;
  return config.cohortIds.has(id);
}

/**
 * Tenant gate: empty allowlist = all tenants when compare enabled.
 * @param {string|null|undefined} tenantId
 * @param {ReturnType<typeof resolveCutover02Config>} config
 */
export function isTenantAllowedForCutover02(tenantId, config) {
  if (!config) return false;
  if (config.tenantAllowlist.size === 0) return true;
  const tid = String(tenantId || "").trim();
  if (!tid) return false;
  return config.tenantAllowlist.has(tid);
}
