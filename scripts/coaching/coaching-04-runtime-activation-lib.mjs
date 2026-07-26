/**
 * COACHING-04 — Staging runtime activation pin library.
 * Read-only / refuse-by-default. Does not flip defaults or mutate deployments.
 * CODEX_DELETE_ALLOWED=NO.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COACHING_04_STAGING_PROJECT_REF = "qyewbxjsiiyufanzcjcq";
export const COACHING_04_PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud";

export const COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING =
  "COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING";
export const COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT =
  "COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT";

export const COACHING_04_PR295_NUMBER = 295;
export const COACHING_04_PR295_HEAD_OID =
  "0e76c97a7fa9aabd9581f23c41d86f142b128feb";
export const COACHING_04_PR295_MERGE_COMMIT =
  "12b4b8592a8c06a1cf2601226178f72ae7079b5f";
export const COACHING_04_RUNTIME_PACKAGE_COMMIT =
  "0e76c97a7fa9aabd9581f23c41d86f142b128feb";
export const COACHING_04_PR292_CERTIFICATION_COMMIT =
  "fcecd79c2c0732e5bc7962fa1bfa91d6086818e6";
export const COACHING_04_PR292_MERGE_COMMIT =
  "98dedfc9814c4b81a6f3a5ffeae81aff9bf3bddd";

/** Fresh origin/main at pin authoring (post #294/#295). */
export const COACHING_04_FRESH_ORIGIN_MAIN =
  "8ce23a6d1320d0a1c8d267ace885be227cbcd27c";

export const COACHING_04_RUNTIME_ACTIVATION_DIR =
  "docs/coaching-training/coaching-04/runtime-activation";
export const COACHING_04_RUNTIME_ACTIVATION_PIN_RELATIVE =
  "docs/coaching-training/coaching-04/runtime-activation/STAGING_RUNTIME_ACTIVATION_PIN.json";
export const COACHING_04_RUNTIME_ACTIVATION_MANIFEST_RELATIVE =
  "docs/coaching-training/coaching-04/runtime-activation/activation-manifest.json";
export const COACHING_04_RUNTIME_ACTIVATION_APPROVAL_TEMPLATE =
  "docs/coaching-training/coaching-04/runtime-activation/OWNER_STAGING_RUNTIME_ACTIVATION_APPROVAL.template.json";
export const COACHING_04_RUNTIME_ACTIVATION_EVIDENCE_DIR =
  "docs/coaching-training/coaching-04/runtime-activation/evidence";

export const COACHING_04_RUNTIME_ACTIVATION_CLASSIFICATION =
  "COACHING_04_STAGING_RUNTIME_ACTIVATION_READY_AWAITING_OWNER_GO";

export const COACHING_04_RUNTIME_ACTIVATION_VERDICTS = Object.freeze({
  READY_AWAITING_OWNER_GO:
    "COACHING_04_STAGING_RUNTIME_ACTIVATION_READY_AWAITING_OWNER_GO",
  PREFLIGHT_REFUSED_OWNER_GO_NOT_GRANTED:
    "COACHING_04_RUNTIME_ACTIVATION_PREFLIGHT_REFUSED_OWNER_GO_NOT_GRANTED",
  PRODUCTION_REFUSED: "COACHING_04_RUNTIME_ACTIVATION_PRODUCTION_REFUSED",
});

/** Non-secret expected values for Staging Preview activation (post-GO only). */
export const COACHING_04_STAGING_RUNTIME_EXPECTED_ENV = Object.freeze({
  VITE_APP_ENV: "staging",
  VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED: "true",
  VITE_COACHING_STAGING_OWNER_GO_GRANTED: "true",
  VITE_SUPABASE_URL: "https://qyewbxjsiiyufanzcjcq.supabase.co",
});

/** Current certified state before Owner GO — durable + Owner GO flags must remain off. */
export const COACHING_04_STAGING_RUNTIME_CURRENT_ENV = Object.freeze({
  VITE_APP_ENV: "staging",
  VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED: "false",
  VITE_COACHING_STAGING_OWNER_GO_GRANTED: "false",
  VITE_SUPABASE_URL: "https://qyewbxjsiiyufanzcjcq.supabase.co",
});

export const COACHING_04_RUNTIME_ACTIVATION_MANIFEST_FILES = Object.freeze([
  "docs/coaching-training/coaching-04/runtime-activation/00_COACHING_04_STAGING_RUNTIME_ACTIVATION_PIN.md",
  "docs/coaching-training/coaching-04/runtime-activation/STAGING_RUNTIME_ACTIVATION_PIN.json",
  "docs/coaching-training/coaching-04/runtime-activation/activation-manifest.json",
  "docs/coaching-training/coaching-04/runtime-activation/OWNER_STAGING_RUNTIME_ACTIVATION_APPROVAL.template.json",
  "scripts/coaching/coaching-04-runtime-activation-lib.mjs",
  "scripts/coaching/coaching-04-runtime-activation-preflight.mjs",
  "tests/coaching-04-runtime-activation-pin.test.js",
  "tests/coaching-04-runtime-gate-wiring.test.js",
]);

/**
 * @param {string} [fromUrl]
 */
export function getCoaching04RuntimeActivationRepoRoot(fromUrl) {
  const here = path.dirname(fileURLToPath(fromUrl || import.meta.url));
  return path.resolve(here, "../..");
}

/**
 * @param {string|Buffer|Uint8Array} input
 */
export function canonicalizeLf(input) {
  let text;
  if (typeof input === "string") text = input;
  else if (input instanceof Uint8Array) {
    text = new TextDecoder("utf8").decode(input);
  } else text = String(input ?? "");
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * @param {string|Buffer|Uint8Array} input
 */
export function sha256Canonical(input) {
  return createHash("sha256")
    .update(canonicalizeLf(input), "utf8")
    .digest("hex");
}

/**
 * @param {string} absolutePath
 */
export function sha256File(absolutePath) {
  return sha256Canonical(readFileSync(absolutePath));
}

/**
 * Combined activation manifest hash: ordered file relative paths + content hashes.
 * @param {string} repoRoot
 * @param {readonly string[]} [files]
 */
export function computeActivationManifestHash(
  repoRoot,
  files = COACHING_04_RUNTIME_ACTIVATION_MANIFEST_FILES
) {
  const lines = [];
  for (const rel of files) {
    const abs = path.join(repoRoot, rel);
    if (!existsSync(abs)) {
      throw new Error(`Missing activation manifest file: ${rel}`);
    }
    lines.push(`${rel}:${sha256File(abs)}`);
  }
  return sha256Canonical(`${lines.join("\n")}\n`);
}

/**
 * Offline / refuse-by-default preflight evaluation.
 * @param {{
 *   durableRuntimeDefault?: boolean,
 *   localStorageRetired?: boolean,
 *   mappingRowCount?: number,
 *   ownerGoGranted?: boolean,
 *   productionTarget?: boolean,
 *   deploymentMutation?: boolean,
 *   databaseWrites?: number,
 * }} [input]
 */
export function evaluateCoaching04RuntimeActivationPreflight(input = {}) {
  const durableRuntimeDefault = input.durableRuntimeDefault === true;
  const localStorageRetired = input.localStorageRetired === true;
  const mappingRowCount =
    typeof input.mappingRowCount === "number" ? input.mappingRowCount : 0;
  const ownerGoGranted = input.ownerGoGranted === true;
  const productionTarget = input.productionTarget === true;
  const deploymentMutation = input.deploymentMutation === true;
  const databaseWrites =
    typeof input.databaseWrites === "number" ? input.databaseWrites : 0;

  const errors = [];
  if (productionTarget) errors.push("Production target refused.");
  if (deploymentMutation) errors.push("Deployment mutation refused.");
  if (databaseWrites !== 0) errors.push("Database writes must be 0.");
  if (durableRuntimeDefault) {
    errors.push("COACHING_DURABLE_RUNTIME_DEFAULT must remain false.");
  }
  if (localStorageRetired) {
    errors.push("LOCALSTORAGE_RETIRED must remain false.");
  }
  if (!ownerGoGranted) {
    errors.push("Owner GO not granted — activation pin only.");
  }

  let verdict =
    COACHING_04_RUNTIME_ACTIVATION_VERDICTS.READY_AWAITING_OWNER_GO;
  if (productionTarget) {
    verdict = COACHING_04_RUNTIME_ACTIVATION_VERDICTS.PRODUCTION_REFUSED;
  } else if (!ownerGoGranted || errors.length > 0) {
    verdict =
      COACHING_04_RUNTIME_ACTIVATION_VERDICTS.PREFLIGHT_REFUSED_OWNER_GO_NOT_GRANTED;
  }

  return Object.freeze({
    ok: true,
    canActivate: false,
    ownerGoGranted: false,
    ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    localStorageRetirementGoGranted: false,
    stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
    productionProjectRef: COACHING_04_PRODUCTION_PROJECT_REF,
    targetEnvironment: "staging-preview",
    mappingRowCount,
    playerExpectedState: "UNMAPPED",
    runtimeActivated: false,
    localStorageRetired: false,
    durableRuntimeDefault: false,
    productionTouched: false,
    databaseWrites: 0,
    deploymentMutation: false,
    silentFallbackAllowed: false,
    filesDeleted: 0,
    CODEX_DELETE_ALLOWED: "NO",
    classification: COACHING_04_RUNTIME_ACTIVATION_CLASSIFICATION,
    verdict,
    errors: Object.freeze([...errors]),
  });
}
