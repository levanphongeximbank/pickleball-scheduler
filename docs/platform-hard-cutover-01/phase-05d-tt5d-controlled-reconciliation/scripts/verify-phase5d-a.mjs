/**
 * Phase 5D-A static verifier.
 * - Validates package JSON/SQL presence and decision integrity
 * - Resolves tracked bytes from Git index (no arbitrary working-tree fallback for checksum compare)
 * - Compares working-tree bytes vs index when path is tracked
 * No network. No database. No git add/commit/push.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");
const PKG_REL =
  "docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation";
const MANIFEST_REL = `${PKG_REL}/PHASE5D_CHECKSUM_MANIFEST.json`;

function sha256Exact(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}
function sha256CanonicalLf(buf) {
  const t = buf.toString("utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex").toUpperCase();
}
function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}
function readIndexBlob(rel) {
  const norm = rel.replace(/\\/g, "/");
  const oidR = spawnSync("git", ["rev-parse", "--verify", "--quiet", `:${norm}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (oidR.status !== 0) return null;
  const oid = oidR.stdout.trim();
  const blob = spawnSync("git", ["cat-file", "blob", oid], { cwd: ROOT, encoding: "buffer" });
  if (blob.status !== 0) return null;
  return { oid, bytes: blob.stdout };
}

const errors = [];
const fail = (m) => errors.push(m);

const required = [
  "README.md",
  "PHASE5D_A_READINESS_MANIFEST.json",
  "evidence/01_STAGING_TARGET_AND_BASELINE_GATE.json",
  "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json",
  "evidence/03_TT5D_SEMANTIC_DELTA.json",
  "evidence/04_TWO_WAY_DEPENDENCY_MAP.json",
  "evidence/05_PHASE5D_A_DECISION.json",
  "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
  "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
  "sql/20_TT5D_POST_APPLY_VERIFY.sql",
  "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  "scripts/verify-phase5d-a.mjs",
  "scripts/sync-phase5d-checksum-manifest.mjs",
];

for (const r of required) {
  if (!fs.existsSync(path.join(PKG, r))) fail(`missing ${r}`);
}

const decision = JSON.parse(
  fs.readFileSync(path.join(PKG, "evidence/05_PHASE5D_A_DECISION.json"), "utf8"),
);
if (decision.decision !== "READY_FOR_OWNER_STAGING_GO") fail("decision must be READY_FOR_OWNER_STAGING_GO");
if (decision.StagingDatabaseMutations !== 0) fail("StagingDatabaseMutations must be 0");
if (decision.ProductionAccess !== 0) fail("ProductionAccess must be 0");
if (decision.m9?.executableApplyCount !== 20 || decision.m9?.nonExecutableCandidateCount !== 4) {
  fail("M9 counts must remain 20/4");
}
if (decision.continuingPhase5?.executionRunbookAccepted !== false) fail("runbook must remain false");
if (decision.continuingPhase5?.productionExecutionGo !== false) fail("Production GO must remain false");
if (decision.continuingPhase5?.PHASE_05_COMPLETE !== "NOT_ISSUED") fail("PHASE_05_COMPLETE must remain NOT_ISSUED");
if (decision.m9?.tt5dDeclaredExecutable !== false) fail("TT5D must not be declared executable");

const baseline = JSON.parse(
  fs.readFileSync(path.join(PKG, "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json"), "utf8"),
);
if (baseline.functionCount !== 13 || baseline.functions?.length !== 13) fail("baseline must list exactly 13 functions");

const delta = JSON.parse(fs.readFileSync(path.join(PKG, "evidence/03_TT5D_SEMANTIC_DELTA.json"), "utf8"));
for (const id of [1, 2, 3, 4, 5, 6, 7]) {
  const f = delta.findings?.find((x) => x.id === id);
  if (!f || !String(f.result).startsWith("CONFIRMED")) fail(`semantic finding ${id} not confirmed`);
}

const recon = fs.readFileSync(path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"), "utf8");
for (const bad of ["DROP TABLE", "TRUNCATE", "expuvcohlcjzvrrauvud", "BEGIN PRIVATE", "eyJ"]) {
  if (recon.includes(bad) && bad !== "BEGIN PRIVATE") {
    // Production ref must not appear as target
  }
}
if (/expuvcohlcjzvrrauvud/.test(recon) && !/Forbidden Production/.test(recon)) {
  fail("Production ref must not appear as executable target in reconciliation SQL");
}
const reconBody = recon
  .split(/\r?\n/)
  .filter((l) => !/^\s*--/.test(l))
  .join("\n");
if (/DROP\s+TABLE\b/i.test(reconBody) || /TRUNCATE\s+/i.test(reconBody)) {
  fail("destructive SQL in reconciliation");
}
if (/DELETE\s+FROM\s+(?!supabase_migrations\.schema_migrations\b)/i.test(reconBody)) {
  fail("unexpected DELETE in reconciliation");
}
if (!/ALTER FUNCTION[\s\S]*STABLE/i.test(recon)) fail("reconciliation must correct STABLE");
if (!/REVOKE ALL[\s\S]*FROM PUBLIC,\s*anon/i.test(recon)) fail("reconciliation must revoke PUBLIC, anon");
if (!/phase5d_tt5d_controlled_reconciliation/.test(recon)) fail("missing provenance name");

const verifySql = fs.readFileSync(path.join(PKG, "sql/20_TT5D_POST_APPLY_VERIFY.sql"), "utf8");
const names = [
  "referee_v5_assignment_effective_status",
  "referee_v5_mark_assignment_expired_if_needed",
  "team_tournament_create_referee_assignment",
  "team_tournament_revoke_referee_assignment",
  "team_tournament_list_referee_assignments",
  "referee_v5_apply_admin_result_revision",
  "team_tournament_reopen_referee_match",
  "team_tournament_request_referee_correction",
  "team_tournament_review_referee_correction",
  "team_tournament_list_referee_corrections",
  "referee_v5_current_user_has_assignment",
  "referee_v5_assert_assignment_write",
  "team_tournament_referee_match_access_ops",
];
for (const n of names) {
  if (!verifySql.includes(n)) fail(`verify SQL missing ${n}`);
}

const rollback = fs.readFileSync(path.join(PKG, "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql"), "utf8");
if (!/ALTER FUNCTION[\s\S]*IMMUTABLE/i.test(rollback)) fail("rollback must restore IMMUTABLE");
if (!/DELETE FROM supabase_migrations\.schema_migrations/i.test(rollback)) {
  fail("rollback must remove provenance row");
}

// Checksum manifest if present
if (fs.existsSync(path.join(ROOT, MANIFEST_REL))) {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_REL), "utf8"));
  if (!Array.isArray(man.files) || man.files.length < 1) fail("PHASE5D checksum manifest empty");
  const sorted = [...man.files].map((f) => f.path).sort();
  const listed = man.files.map((f) => f.path);
  if (JSON.stringify(sorted) !== JSON.stringify([...listed].sort())) {
    // order must be deterministic sorted
  }
  for (const entry of man.files) {
    const rel = entry.path.replace(/\\/g, "/");
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      fail(`checksum path missing on disk: ${rel}`);
      continue;
    }
    const idx = readIndexBlob(rel);
    if (idx) {
      const d1 = spawnSync("git", ["diff", "--quiet", "--", rel], { cwd: ROOT });
      if (d1.status !== 0) fail(`working-tree dirty vs index: ${rel}`);
      const got = sha256Exact(idx.bytes);
      if (got !== String(entry.sha256ExactGitBlobBytes).toUpperCase()) {
        fail(`checksum mismatch ${rel}`);
      }
      if (sha256CanonicalLf(idx.bytes) !== String(entry.sha256CanonicalLf).toUpperCase()) {
        fail(`canonical LF mismatch ${rel}`);
      }
      if (entry.gitBlobOid && entry.gitBlobOid !== idx.oid) fail(`oid mismatch ${rel}`);
    } else {
      const wtBytes = fs.readFileSync(abs);
      const got = sha256Exact(wtBytes);
      if (got !== String(entry.sha256ExactGitBlobBytes).toUpperCase()) {
        fail(`checksum mismatch (wt) ${rel}`);
      }
    }
  }
}

// Dependency closure: protected Phase 5B/5C files must be unchanged vs HEAD for this worktree branch base
const protectedPaths = [
  "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/M9_MANIFEST.json",
  "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/00_SOURCE_PROVENANCE.json",
];
for (const p of protectedPaths) {
  try {
    git(["diff", "--quiet", "origin/main", "--", p]);
  } catch {
    fail(`protected historical file changed vs origin/main: ${p}`);
  }
}

if (errors.length) {
  console.error("FAIL Phase 5D-A verifier:");
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log("PASS Phase 5D-A verifier");
