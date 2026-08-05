/**
 * Staging / Production identity guards for CUTOVER-02.
 * Exact refs from repo scripts — never guess by name alone.
 */

export const CUTOVER_02_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";
export const CUTOVER_02_PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";

const PRODUCTION_DENYLIST = Object.freeze([CUTOVER_02_PRODUCTION_PROJECT_REF]);

/**
 * Extract Supabase project ref from URL or bare ref string.
 * @param {string|null|undefined} urlOrRef
 */
export function extractSupabaseProjectRef(urlOrRef) {
  const raw = String(urlOrRef || "").trim();
  if (!raw) return null;
  if (/^[a-z0-9]{20}$/i.test(raw)) return raw.toLowerCase();
  try {
    const host = new URL(raw).hostname || "";
    const match = host.match(/^([a-z0-9]+)\.supabase\.(co|in)$/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    const match = raw.match(/([a-z0-9]{20})\.supabase\.(co|in)/i);
    return match ? match[1].toLowerCase() : null;
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function resolveAppEnvironmentLabel(env = {}) {
  const bag = env && typeof env === "object" ? env : {};
  const appEnv = String(bag.VITE_APP_ENV || bag.APP_ENV || "").trim().toLowerCase();
  if (appEnv) return appEnv;
  const mode = String(bag.MODE || bag.NODE_ENV || "").trim().toLowerCase();
  return mode || "unknown";
}

/**
 * Production deny: any Production project ref or production app label forces controls OFF.
 * @param {Record<string, unknown>|null|undefined} env
 */
export function isProductionDenyActive(env = {}) {
  const bag = env && typeof env === "object" ? env : {};
  const label = resolveAppEnvironmentLabel(bag);
  if (label === "production" || label === "prod") return true;

  const url = String(bag.VITE_SUPABASE_URL || bag.SUPABASE_URL || "").trim();
  const ref = extractSupabaseProjectRef(url);
  if (ref && PRODUCTION_DENYLIST.includes(ref)) return true;
  if (url.includes(CUTOVER_02_PRODUCTION_PROJECT_REF)) return true;
  return false;
}

/**
 * Staging proof checklist evaluator (local/read-only). Does not mutate remote.
 * @param {{
 *   stagingProjectRef?: string|null,
 *   productionProjectRef?: string|null,
 *   connectedTargetRef?: string|null,
 *   mcpMode?: string|null,
 *   databaseIdentity?: string|null,
 *   environmentLabel?: string|null,
 *   deploymentTarget?: string|null,
 *   branch?: string|null,
 *   sha?: string|null,
 *   rollbackAuthority?: string|null,
 * }} proof
 */
export function evaluateStagingEnvironmentProof(proof = {}) {
  const staging = String(proof.stagingProjectRef || "").trim().toLowerCase();
  const production = String(
    proof.productionProjectRef || CUTOVER_02_PRODUCTION_PROJECT_REF
  )
    .trim()
    .toLowerCase();
  const connected = String(proof.connectedTargetRef || "").trim().toLowerCase();

  const checks = {
    exactStagingProjectRef:
      staging === CUTOVER_02_STAGING_PROJECT_REF
        ? "PASS"
        : staging
          ? "FAIL_MISMATCH"
          : "BLOCKED_UNKNOWN",
    exactProductionProjectRef:
      production === CUTOVER_02_PRODUCTION_PROJECT_REF ? "PASS" : "FAIL",
    refsDiffer:
      staging && production && staging !== production ? "PASS" : "FAIL",
    connectedTargetMatchesStaging:
      connected && connected === staging && staging === CUTOVER_02_STAGING_PROJECT_REF
        ? "PASS"
        : connected
          ? "FAIL"
          : "BLOCKED_UNKNOWN",
    mcpModeDocumented: proof.mcpMode ? "PASS" : "BLOCKED_UNKNOWN",
    databaseIdentityDocumented: proof.databaseIdentity ? "PASS" : "BLOCKED_UNKNOWN",
    environmentLabelDocumented: proof.environmentLabel ? "PASS" : "BLOCKED_UNKNOWN",
    deploymentTargetDocumented: proof.deploymentTarget ? "PASS" : "BLOCKED_UNKNOWN",
    branchDocumented: proof.branch ? "PASS" : "BLOCKED_UNKNOWN",
    shaDocumented: proof.sha ? "PASS" : "BLOCKED_UNKNOWN",
    rollbackAuthorityDocumented: proof.rollbackAuthority ? "PASS" : "BLOCKED_UNKNOWN",
  };

  const blocked = Object.values(checks).some(
    (v) => v === "BLOCKED_UNKNOWN" || String(v).startsWith("FAIL")
  );

  return Object.freeze({
    STAGING_ENVIRONMENT_PROOF: blocked ? "BLOCKED" : "PASS",
    expectedStagingRef: CUTOVER_02_STAGING_PROJECT_REF,
    expectedProductionRef: CUTOVER_02_PRODUCTION_PROJECT_REF,
    checks,
  });
}

/**
 * Whether Staging-only rehearsal controls may activate (still requires flags).
 * @param {Record<string, unknown>|null|undefined} env
 */
export function isStagingRehearsalEnvironmentAllowed(env = {}) {
  if (isProductionDenyActive(env)) return false;
  const bag = env && typeof env === "object" ? env : {};
  const label = resolveAppEnvironmentLabel(bag);
  if (label === "production" || label === "prod") return false;

  const url = String(bag.VITE_SUPABASE_URL || bag.SUPABASE_URL || "").trim();
  const ref = extractSupabaseProjectRef(url);
  if (ref === CUTOVER_02_PRODUCTION_PROJECT_REF) return false;
  if (ref === CUTOVER_02_STAGING_PROJECT_REF) return true;
  if (label === "staging" || label === "test" || label === "development" || label === "dev") {
    return true;
  }
  // Missing / unknown URL: allow local unit tests with explicit flags only when not Production.
  return !ref && (label === "unknown" || label === "test" || !label);
}
