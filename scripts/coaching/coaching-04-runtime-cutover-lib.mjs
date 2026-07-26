/**
 * COACHING-04 — Guarded runtime cutover library.
 * Authoring + refuse-by-default evaluation only.
 * Does not flip COACHING_DURABLE_RUNTIME_DEFAULT.
 * Does not retire localStorage.
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

export const COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION =
  "COACHING_04_RUNTIME_CUTOVER_READY_WITH_PLAYER_UNMAPPED_GATE";

export const COACHING_04_PR292_CERTIFICATION_COMMIT =
  "fcecd79c2c0732e5bc7962fa1bfa91d6086818e6";
export const COACHING_04_PR292_MERGE_COMMIT =
  "98dedfc9814c4b81a6f3a5ffeae81aff9bf3bddd";

export const COACHING_04_RUNTIME_CUTOVER_DIR =
  "docs/coaching-training/coaching-04/runtime-cutover";
export const COACHING_04_RUNTIME_CUTOVER_EVIDENCE_DIR =
  "docs/coaching-training/coaching-04/runtime-cutover/evidence";
export const COACHING_04_RUNTIME_CUTOVER_APPROVAL_TEMPLATE =
  "docs/coaching-training/coaching-04/runtime-cutover/OWNER_RUNTIME_CUTOVER_APPROVAL.template.json";
export const COACHING_04_RUNTIME_CUTOVER_APPROVAL_PACKAGE =
  "docs/coaching-training/coaching-04/runtime-cutover/RUNTIME_CUTOVER_APPROVAL_PACKAGE.json";

export const COACHING_04_RUNTIME_CUTOVER_VERDICTS = Object.freeze({
  REFUSED_OWNER_GO_NOT_GRANTED:
    "COACHING_04_RUNTIME_CUTOVER_REFUSED_OWNER_GO_NOT_GRANTED",
  PRODUCTION_REFUSED: "COACHING_04_RUNTIME_CUTOVER_PRODUCTION_REFUSED",
  PACKAGE_READY_AWAITING_OWNER_GO:
    "COACHING_04_RUNTIME_CUTOVER_PACKAGE_READY_AWAITING_OWNER_GO",
  PR_OPEN_CI_GREEN_AWAITING_OWNER_GO:
    "COACHING_04_RUNTIME_CUTOVER_PR_OPEN_CI_GREEN_AWAITING_OWNER_GO",
});

export const COACHING_04_RUNTIME_CUTOVER_ENV = Object.freeze({
  OWNER_GO: "COACHING_04_RUNTIME_CUTOVER_OWNER_GO",
  TARGET_CONFIRM: "COACHING_04_RUNTIME_CUTOVER_STAGING_TARGET_CONFIRM",
  VITE_FLAG: "VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED",
  VITE_APP_ENV: "VITE_APP_ENV",
});

/**
 * @param {string} [fromUrl]
 */
export function getCoaching04RuntimeCutoverRepoRoot(fromUrl) {
  const here = path.dirname(fileURLToPath(fromUrl || import.meta.url));
  return path.resolve(here, "../..");
}

/**
 * @param {string|Buffer|Uint8Array} input
 */
export function sha256Canonical(input) {
  let text;
  if (typeof input === "string") text = input;
  else if (input instanceof Uint8Array) {
    text = new TextDecoder("utf8").decode(input);
  } else text = String(input ?? "");
  const canonical = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * @param {string} absolutePath
 */
export function sha256File(absolutePath) {
  return sha256Canonical(readFileSync(absolutePath));
}

/**
 * Refuse-by-default activation gate evaluation.
 * Never flips defaults. Never retires localStorage.
 *
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   ownerGoGranted?: boolean,
 *   productionTarget?: boolean,
 *   durableRuntimeDefault?: boolean,
 *   localStorageRetired?: boolean,
 *   mappingRowCount?: number,
 * }} [input]
 */
export function evaluateCoaching04RuntimeCutoverGates(input = {}) {
  const env = input.env && typeof input.env === "object" ? input.env : {};
  const ownerGoGranted =
    input.ownerGoGranted === true ||
    String(env[COACHING_04_RUNTIME_CUTOVER_ENV.OWNER_GO] || "").trim() ===
      COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING;
  const productionTarget = input.productionTarget === true;
  const durableRuntimeDefault = input.durableRuntimeDefault === true;
  const localStorageRetired = input.localStorageRetired === true;
  const mappingRowCount =
    typeof input.mappingRowCount === "number" ? input.mappingRowCount : 0;

  const errors = [];
  if (productionTarget) {
    errors.push("Production target refused for runtime cutover.");
  }
  if (!ownerGoGranted) {
    errors.push("Owner GO not granted for Staging durable runtime cutover.");
  }
  if (durableRuntimeDefault) {
    errors.push(
      "COACHING_DURABLE_RUNTIME_DEFAULT must remain false in this package phase."
    );
  }
  if (localStorageRetired) {
    errors.push(
      "LOCALSTORAGE_RETIRED must remain false; retirement requires a separate Owner GO."
    );
  }

  const viteFlag = String(
    env[COACHING_04_RUNTIME_CUTOVER_ENV.VITE_FLAG] || ""
  )
    .trim()
    .toLowerCase();
  if (viteFlag === "true" && !ownerGoGranted) {
    errors.push(
      "VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED=true refused without Owner GO."
    );
  }

  let verdict = COACHING_04_RUNTIME_CUTOVER_VERDICTS.PACKAGE_READY_AWAITING_OWNER_GO;
  if (productionTarget) {
    verdict = COACHING_04_RUNTIME_CUTOVER_VERDICTS.PRODUCTION_REFUSED;
  } else if (!ownerGoGranted || errors.length > 0) {
    verdict = COACHING_04_RUNTIME_CUTOVER_VERDICTS.REFUSED_OWNER_GO_NOT_GRANTED;
  }

  return Object.freeze({
    ok: errors.length === 0 && ownerGoGranted && !productionTarget,
    canActivate: false,
    ownerGoGranted,
    ownerGoToken: COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
    localStorageRetirementGoToken: COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT,
    localStorageRetirementGoGranted: false,
    stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
    productionProjectRef: COACHING_04_PRODUCTION_PROJECT_REF,
    mappingRowCount,
    mappingReadinessClassification: COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
    runtimeActivated: false,
    localStorageRetired: false,
    durableRuntimeDefault: false,
    productionTouched: false,
    silentFallbackAllowed: false,
    filesDeleted: 0,
    verdict,
    errors: Object.freeze([...errors]),
  });
}

/**
 * @param {string} repoRoot
 */
export function loadRuntimeCutoverApprovalPackage(repoRoot) {
  const abs = path.join(repoRoot, COACHING_04_RUNTIME_CUTOVER_APPROVAL_PACKAGE);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8"));
}
