/**
 * COMMS-ACT-01 — Staging target identity (fail-closed).
 * Never prints secrets. Never connects to a database.
 */

export const COMMS_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";
export const COMMS_PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";

export const COMMS_STAGING_PROJECT_REF_ALLOWLIST = Object.freeze([
  COMMS_STAGING_PROJECT_REF,
]);

export const COMMS_PRODUCTION_PROJECT_REF_BLOCKLIST = Object.freeze([
  COMMS_PRODUCTION_PROJECT_REF,
]);

/** Env var names only — values must never be logged. */
export const COMMS_ACT_01_ENV_NAMES = Object.freeze({
  APP_ENV: "VITE_APP_ENV",
  SUPABASE_URL: "VITE_SUPABASE_URL",
  SUPABASE_URL_ALT: "SUPABASE_URL",
  STAGING_SUPABASE_URL: "STAGING_SUPABASE_URL",
  ANON_KEY: "VITE_SUPABASE_ANON_KEY",
  STAGING_ANON_KEY: "STAGING_SUPABASE_ANON_KEY",
  STAGING_SERVICE_ROLE: "STAGING_SUPABASE_SERVICE_ROLE_KEY",
  STAGING_DB_URL: "STAGING_SUPABASE_DB_URL",
  ACCESS_TOKEN: "SUPABASE_ACCESS_TOKEN",
  OWNER_GO: "COMMS_STAGING_OWNER_GO",
  BACKUP_EVIDENCE: "COMMS_STAGING_BACKUP_EVIDENCE",
  BACKUP_EVIDENCE_PATH: "COMMS_STAGING_BACKUP_EVIDENCE_PATH",
  TARGET_CONFIRM: "COMMS_STAGING_TARGET_CONFIRM",
  RUNTIME_MODE: "VITE_COMMUNICATION_RUNTIME_MODE",
});

export const COMMS_ACT_01_FORWARD_SQL_RELATIVE =
  "docs/supabase-communication-comms05.sql";

export const COMMS_ACT_01_ROLLBACK_SQL_RELATIVE =
  "docs/supabase-communication-comms05-rollback.sql";

export const COMMS_ACT_01_EVIDENCE_DIR_RELATIVE =
  "docs/communication-foundation/activation/comms-act-01/evidence";

/**
 * @param {string|undefined|null} urlOrHost
 * @returns {string}
 */
export function extractSupabaseProjectRef(urlOrHost) {
  const raw = String(urlOrHost || "").trim();
  if (!raw) return "";
  const httpsMatch = raw.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (httpsMatch) return httpsMatch[1].toLowerCase();
  const postgresMatch = raw.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  if (postgresMatch) return postgresMatch[1].toLowerCase();
  const bare = raw.match(/^([a-z0-9]{20})$/i);
  if (bare) return bare[1].toLowerCase();
  return "";
}

/**
 * @param {string|undefined|null} value
 * @returns {boolean}
 */
export function isEnvTokenPresent(value) {
  return value != null && String(value).trim() !== "";
}

/**
 * Fail-closed Staging identity check (static; no network).
 * @param {{ url?: string, dbUrl?: string, targetConfirm?: string, environment?: string }} input
 */
export function evaluateCommsStagingTargetIdentity(input = {}) {
  const environment = String(input.environment || "staging").toLowerCase();
  const url = String(input.url || "").trim();
  const dbUrl = String(input.dbUrl || "").trim();
  const targetConfirm = String(input.targetConfirm || "").trim();
  const urlRef = extractSupabaseProjectRef(url);
  const dbRef = extractSupabaseProjectRef(dbUrl);

  /** @type {Array<{ code: string, level: string, message: string }>} */
  const findings = [];

  if (environment !== "staging") {
    findings.push({
      level: "error",
      code: "ENVIRONMENT_NOT_STAGING",
      message: `Environment must be staging (got ${environment}).`,
    });
  }

  for (const prodRef of COMMS_PRODUCTION_PROJECT_REF_BLOCKLIST) {
    if (url.includes(prodRef) || dbUrl.includes(prodRef)) {
      findings.push({
        level: "error",
        code: "PRODUCTION_REF_DETECTED",
        message: `Production project ref detected in target URL/DB URL: ${prodRef}`,
      });
    }
  }

  if (url && urlRef && !COMMS_STAGING_PROJECT_REF_ALLOWLIST.includes(urlRef)) {
    findings.push({
      level: "error",
      code: "URL_REF_NOT_STAGING",
      message: `Supabase URL project ref is not Staging allowlist (${urlRef}).`,
    });
  }

  if (dbUrl && dbRef && !COMMS_STAGING_PROJECT_REF_ALLOWLIST.includes(dbRef)) {
    findings.push({
      level: "error",
      code: "DB_REF_NOT_STAGING",
      message: `Database URL project ref is not Staging allowlist (${dbRef}).`,
    });
  }

  if (url && urlRef && dbUrl && dbRef && urlRef !== dbRef) {
    findings.push({
      level: "error",
      code: "URL_DB_REF_MISMATCH",
      message: "Supabase URL and DB URL project refs do not match.",
    });
  }

  if (
    isEnvTokenPresent(targetConfirm) &&
    targetConfirm !== COMMS_STAGING_PROJECT_REF
  ) {
    findings.push({
      level: "error",
      code: "TARGET_CONFIRM_MISMATCH",
      message:
        "COMMS_STAGING_TARGET_CONFIRM must equal Staging project ref allowlist entry.",
    });
  }

  const pass =
    findings.filter((f) => f.level === "error").length === 0 &&
    (Boolean(urlRef) || Boolean(dbRef) || isEnvTokenPresent(targetConfirm)
      ? (urlRef || dbRef || targetConfirm) === COMMS_STAGING_PROJECT_REF ||
        COMMS_STAGING_PROJECT_REF_ALLOWLIST.includes(urlRef) ||
        COMMS_STAGING_PROJECT_REF_ALLOWLIST.includes(dbRef)
      : false);

  // Offline readiness package may run without env loaded — then identity is
  // "not verified" rather than hard PASS. Callers treat missing refs as block
  // for live/remote modes.
  const status = (() => {
    if (findings.some((f) => f.level === "error")) return "FAIL";
    if (!urlRef && !dbRef && !isEnvTokenPresent(targetConfirm)) {
      return "UNVERIFIED";
    }
    return pass ? "PASS" : "FAIL";
  })();

  return Object.freeze({
    status,
    stagingRef: COMMS_STAGING_PROJECT_REF,
    productionRefBlocklist: [...COMMS_PRODUCTION_PROJECT_REF_BLOCKLIST],
    observedUrlRef: urlRef || null,
    observedDbRef: dbRef || null,
    targetConfirmPresent: isEnvTokenPresent(targetConfirm),
    findings,
    secretsPrinted: false,
  });
}
