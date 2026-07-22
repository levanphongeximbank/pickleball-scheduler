#!/usr/bin/env node
/**
 * CRM Phase 1H-B — re-evaluate gates after Owner limited Staging approval.
 * No SQL apply. No DB connection. Secrets never printed.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  evaluateCrmPhase1hBPreWriteGates,
  CRM_PHASE_1H_B_REQUIRED_QA_IDENTITY_ROLES,
  CRM_PHASE_1H_B_ENV_NAMES,
} from "../../src/features/crm/staging/phase1hBGates.js";
import {
  getCrmPhase1hRepoRoot,
  CRM_STAGING_PROJECT_REF_ALLOWLIST,
} from "../../src/features/crm/staging/migrationManifest.js";

const root = getCrmPhase1hRepoRoot();

const gates = evaluateCrmPhase1hBPreWriteGates({
  env: process.env,
  flags: { environment: "staging" },
  repoRoot: root,
  requireQaIdentities: true,
  loadOwnerDecision: true,
});

const evidenceDir = path.join(root, "docs/crm/phase-1h-b");
if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });

const report = {
  phase: "1H-B",
  script: "phase-1h-b-gate-rerun",
  mode: "gates-only-no-db",
  verdict: gates.verdict,
  canWrite: gates.canWrite,
  sqlApplied: false,
  stagingConnected: false,
  productionConnected: false,
  deploy: false,
  ownerDecisionLoaded: gates.ownerDecisionLoaded,
  ownerDecisionPath: gates.ownerDecisionPath,
  approvalsOk: gates.approvals.ok,
  roleMatrixDeferred: gates.approvals.roleMatrix.deferred,
  migrationPlan: gates.migrationPlan,
  identityOk: gates.identity.ok,
  identityErrors: gates.identity.errors,
  stagingProjectProven:
    gates.identity.urlIdentity.projectRefHint ===
    CRM_STAGING_PROJECT_REF_ALLOWLIST[0],
  expectedStagingRef: CRM_STAGING_PROJECT_REF_ALLOWLIST[0],
  backupOk: gates.backup.ok,
  backupErrors: gates.backup.errors,
  credentialsOk: gates.credentials.ok,
  credentialsErrors: gates.credentials.errors,
  qaIdentitiesOk: gates.qaIdentities.ok,
  requiredQaRoles: [...CRM_PHASE_1H_B_REQUIRED_QA_IDENTITY_ROLES],
  runtime: {
    durableRuntime: gates.runtime.durableRuntime,
    defaultPersistenceMode: gates.runtime.defaultPersistenceMode,
  },
  envPresence: Object.fromEntries(
    Object.entries(gates.envPresence).map(([k, v]) => [
      k,
      v.set ? "set" : "unset",
    ])
  ),
  requiredEnvNamesOnly: Object.values(CRM_PHASE_1H_B_ENV_NAMES),
  localSecureEnvSourcesChecked: gates.localSecureEnvSourcesChecked,
  secretsPrinted: false,
};

writeFileSync(
  path.join(evidenceDir, "GATE_RERUN_AFTER_OWNER_LIMITED_APPROVAL.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify(report, null, 2));
process.exit(gates.canWrite ? 0 : 1);
