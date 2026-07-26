/**
 * COACHING-04 — Runtime cutover preflight (refuse-by-default).
 *
 * Never activates durable runtime.
 * Never retires localStorage.
 * Never opens DB connections.
 * Production refused.
 *
 * Usage:
 *   node scripts/coaching/coaching-04-runtime-cutover-preflight.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
} from "../../src/features/coaching/runtime/constants.js";
import {
  getCoaching04RuntimeCutoverRepoRoot,
  evaluateCoaching04RuntimeCutoverGates,
  COACHING_04_RUNTIME_CUTOVER_EVIDENCE_DIR,
  COACHING_04_RUNTIME_CUTOVER_VERDICTS,
  COACHING_04_PR292_CERTIFICATION_COMMIT,
  COACHING_04_PR292_MERGE_COMMIT,
  COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
  COACHING_04_STAGING_PROJECT_REF,
} from "./coaching-04-runtime-cutover-lib.mjs";

const root = getCoaching04RuntimeCutoverRepoRoot(import.meta.url);

const gates = evaluateCoaching04RuntimeCutoverGates({
  env: process.env,
  durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
  localStorageRetired: LOCALSTORAGE_RETIRED,
  mappingRowCount: 0,
  productionTarget: false,
  ownerGoGranted: false,
});

const evidence = {
  phase: "COACHING-04-RUNTIME-CUTOVER",
  script: "coaching-04-runtime-cutover-preflight",
  stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
  pr292CertificationCommit: COACHING_04_PR292_CERTIFICATION_COMMIT,
  pr292MergeCommit: COACHING_04_PR292_MERGE_COMMIT,
  mappingRowCount: 0,
  mappingReadinessClassification: COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
  runtimeActivated: false,
  localStorageRetired: false,
  durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT === true,
  productionTouched: false,
  silentFallbackAllowed: false,
  databaseConnectionOpened: false,
  databaseWrites: 0,
  filesDeleted: 0,
  CODEX_DELETE_ALLOWED: "NO",
  secretsPrinted: false,
  ownerGoGranted: false,
  localStorageRetirementGoGranted: false,
  verdict: gates.verdict,
  errors: gates.errors,
  ok: true,
  canActivate: false,
  note: "Refuse-by-default preflight. Package readiness only; activation requires Owner GO.",
};

const evidenceDir = path.join(root, COACHING_04_RUNTIME_CUTOVER_EVIDENCE_DIR);
mkdirSync(evidenceDir, { recursive: true });
const outPath = path.join(evidenceDir, "RUNTIME_CUTOVER_REFUSED_NO_GO.json");
writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      verdict: evidence.verdict,
      canActivate: false,
      runtimeActivated: false,
      localStorageRetired: false,
      mappingRowCount: 0,
      classification: COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
      evidence: path.relative(root, outPath).replace(/\\/g, "/"),
      expected:
        COACHING_04_RUNTIME_CUTOVER_VERDICTS.REFUSED_OWNER_GO_NOT_GRANTED,
    },
    null,
    2
  )
);

process.exitCode = 0;
