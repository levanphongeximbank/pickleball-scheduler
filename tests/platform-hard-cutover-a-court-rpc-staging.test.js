import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/court-cluster-admin-rpc-staging"
);
const evidencePath = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/15_A_COURT_RPC_NOT_DEPLOYED_DIAGNOSIS_2026-07-30.json"
);
const rpcServicePath = path.join(
  root,
  "src/features/court-cluster/services/courtClaimRequestRpcService.js"
);
const runnerPath = path.join(
  root,
  "src/features/platform-hard-cutover/operatorAcceptanceRunner.js"
);

test("staging court admin rpc package contains canonical apply order", () => {
  const files = fs.readdirSync(packageDir).sort();
  assert.ok(files.includes("10_PHASE_33_COURT_CLAIM_REQUESTS.sql"));
  assert.ok(files.includes("20_PHASE_36_COURT_CLUSTER_CLOUD_SYNC.sql"));
  assert.ok(files.includes("30_PHASE_37_CLUB_REGISTERABLE_CLUSTERS.sql"));
  assert.ok(files.includes("99_VERIFY.sql"));
  assert.ok(files.includes("README.md"));
});

test("PHASE_36 package SQL defines exact json upsert signature", () => {
  const sql = fs.readFileSync(
    path.join(packageDir, "20_PHASE_36_COURT_CLUSTER_CLOUD_SYNC.sql"),
    "utf8"
  );
  assert.match(sql, /create or replace function public\.court_admin_upsert_cluster\(p_cluster json\)/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /grant execute on function public\.court_admin_upsert_cluster\(json\) to authenticated/i);
  assert.doesNotMatch(sql, /TRUNCATE\s+.*CASCADE/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
});

test("PHASE_37 package SQL defines registerable list used by A-COURT read-back", () => {
  const sql = fs.readFileSync(
    path.join(packageDir, "30_PHASE_37_CLUB_REGISTERABLE_CLUSTERS.sql"),
    "utf8"
  );
  assert.match(sql, /create or replace function public\.court_list_registerable_clusters\(/i);
});

test("app call site still targets canonical court_admin_upsert_cluster", () => {
  const rpcService = fs.readFileSync(rpcServicePath, "utf8");
  const runner = fs.readFileSync(runnerPath, "utf8");
  assert.match(rpcService, /client\.rpc\(\s*"court_admin_upsert_cluster"\s*,\s*\{\s*p_cluster:\s*cluster/);
  assert.match(runner, /rpcAdminUpsertCluster\(\{\s*cluster\s*\}\)/);
  assert.doesNotMatch(rpcService, /court_upsert_cluster_legacy|cluster_admin_upsert/);
});

test("diagnosis evidence records migration-not-applied root cause", () => {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.rootCause, "canonical_migration_not_applied_on_staging");
  assert.equal(evidence.stagingLiveAudit.court_admin_upsert_cluster_exists, false);
  assert.equal(evidence.databaseMutations, 0);
  assert.equal(evidence.productionMutations, 0);
  assert.equal(evidence.remediation.ownerGoRequired, true);
  assert.equal(evidence.remediation.autoApply, false);
});
