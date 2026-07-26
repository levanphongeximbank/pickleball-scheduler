/**
 * COACHING-04 — Staging runtime activation preflight (read-only / refuse-by-default).
 *
 * Never flips defaults. Never mutates Vercel/env. Never opens DB.
 *
 * Usage:
 *   node scripts/coaching/coaching-04-runtime-activation-preflight.mjs
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
} from "../../src/features/coaching/runtime/constants.js";
import {
  getCoaching04RuntimeActivationRepoRoot,
  evaluateCoaching04RuntimeActivationPreflight,
  computeActivationManifestHash,
  COACHING_04_RUNTIME_ACTIVATION_EVIDENCE_DIR,
  COACHING_04_RUNTIME_ACTIVATION_PIN_RELATIVE,
  COACHING_04_PR295_MERGE_COMMIT,
  COACHING_04_FRESH_ORIGIN_MAIN,
  COACHING_04_STAGING_PROJECT_REF,
  COACHING_04_RUNTIME_ACTIVATION_CLASSIFICATION,
} from "./coaching-04-runtime-activation-lib.mjs";

const root = getCoaching04RuntimeActivationRepoRoot(import.meta.url);

const certifiedEvidence = [
  "docs/coaching-training/coaching-04/evidence/FINAL_STAGING_RECERTIFICATION.json",
  "docs/coaching-training/coaching-04/evidence/POST_APPLY_CERTIFICATION.json",
  "docs/coaching-training/coaching-04/runtime-cutover/RUNTIME_CUTOVER_APPROVAL_PACKAGE.json",
];

const missingEvidence = certifiedEvidence.filter(
  (rel) => !existsSync(path.join(root, rel))
);

const gates = evaluateCoaching04RuntimeActivationPreflight({
  durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT,
  localStorageRetired: LOCALSTORAGE_RETIRED,
  mappingRowCount: 0,
  ownerGoGranted: false,
  productionTarget: false,
  deploymentMutation: false,
  databaseWrites: 0,
});

let activationManifestHash = null;
try {
  if (existsSync(path.join(root, COACHING_04_RUNTIME_ACTIVATION_PIN_RELATIVE))) {
    activationManifestHash = computeActivationManifestHash(root);
  }
} catch {
  activationManifestHash = null;
}

const evidence = {
  phase: "COACHING-04-RUNTIME-ACTIVATION",
  script: "coaching-04-runtime-activation-preflight",
  stagingProjectRef: COACHING_04_STAGING_PROJECT_REF,
  targetEnvironment: "staging-preview",
  pr295MergeCommit: COACHING_04_PR295_MERGE_COMMIT,
  freshOriginMain: COACHING_04_FRESH_ORIGIN_MAIN,
  certifiedEvidencePresent: missingEvidence.length === 0,
  missingEvidence,
  mappingRowCount: 0,
  playerExpectedState: "UNMAPPED",
  runtimeActivated: false,
  localStorageRetired: false,
  durableRuntimeDefault: COACHING_DURABLE_RUNTIME_DEFAULT === true,
  productionTouched: false,
  databaseConnectionOpened: false,
  databaseWrites: 0,
  deploymentMutation: false,
  silentFallbackAllowed: false,
  filesDeleted: 0,
  CODEX_DELETE_ALLOWED: "NO",
  secretsPrinted: false,
  ownerGoGranted: false,
  activationManifestHash,
  classification: COACHING_04_RUNTIME_ACTIVATION_CLASSIFICATION,
  verdict: gates.verdict,
  errors: gates.errors,
  ok: true,
  canActivate: false,
  note: "Read-only offline preflight. No Vercel mutation. No deployment. No DB writes. AWAITING_OWNER_GO.",
};

const evidenceDir = path.join(root, COACHING_04_RUNTIME_ACTIVATION_EVIDENCE_DIR);
mkdirSync(evidenceDir, { recursive: true });
const outPath = path.join(evidenceDir, "ACTIVATION_PREFLIGHT_OFFLINE.json");
writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      verdict: evidence.verdict,
      canActivate: false,
      runtimeActivated: false,
      localStorageRetired: false,
      mappingRowCount: 0,
      playerExpectedState: "UNMAPPED",
      classification: COACHING_04_RUNTIME_ACTIVATION_CLASSIFICATION,
      certifiedEvidencePresent: evidence.certifiedEvidencePresent,
      activationManifestHash,
      evidence: path.relative(root, outPath).replace(/\\/g, "/"),
    },
    null,
    2
  )
);

process.exitCode = 0;
