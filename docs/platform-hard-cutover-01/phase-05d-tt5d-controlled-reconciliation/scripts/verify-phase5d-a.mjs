/**
 * Phase 5D-A static verifier (A.4 typed catalog guard closure).
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

function stripComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
}

function extractGuardIds(sql) {
  return [...sql.matchAll(/(?:^|\n)\s*--\s*GUARD_ID:\s*(\S+)/g)].map((m) => m[1]);
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
  "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
  "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
  "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
  "sql/20_TT5D_POST_APPLY_VERIFY.sql",
  "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  "scripts/verify-phase5d-a.mjs",
  "scripts/sync-phase5d-checksum-manifest.mjs",
  "scripts/phase5d-a4-guard-contracts.mjs",
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
if (decision.hardening !== "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE") {
  fail("decision hardening must be PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE");
}
for (const m of [
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_SELECT_ONLY_PREFLIGHT_PARITY_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_NO_SERIALIZED_CATALOG_GUARDS_VERIFIED",
  "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_READY_FOR_SELECT_ONLY_STAGING_PREFLIGHT_GO",
]) {
  if (!decision.markers?.includes(m)) fail(`missing A.4 marker ${m}`);
}

const registry = JSON.parse(
  fs.readFileSync(path.join(PKG, "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json"), "utf8"),
);
if (!registry.preMutation?.guardCount || registry.preMutation.guardCount < 1) {
  fail("registry guard count must be > 0");
}
if (registry.nextAuth !== "SELECT_ONLY_STAGING_PREFLIGHT_ONLY") {
  fail("registry nextAuth must be SELECT_ONLY_STAGING_PREFLIGHT_ONLY");
}

const baseline = JSON.parse(
  fs.readFileSync(path.join(PKG, "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json"), "utf8"),
);
if (baseline.functionCount !== 13 || baseline.functions?.length !== 13) fail("baseline must list exactly 13 functions");
if (baseline.typedCatalogGuardComparison?.version !== "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE") {
  fail("evidence/02 missing typedCatalogGuardComparison A.4 contract");
}

const delta = JSON.parse(fs.readFileSync(path.join(PKG, "evidence/03_TT5D_SEMANTIC_DELTA.json"), "utf8"));
for (const id of [1, 2, 3, 4, 5, 6, 7]) {
  const f = delta.findings?.find((x) => x.id === id);
  if (!f || !String(f.result).startsWith("CONFIRMED")) fail(`semantic finding ${id} not confirmed`);
}

const recon = fs.readFileSync(path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"), "utf8");
const verifySql = fs.readFileSync(path.join(PKG, "sql/20_TT5D_POST_APPLY_VERIFY.sql"), "utf8");
const rb = fs.readFileSync(path.join(PKG, "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql"), "utf8");
const sql00 = fs.readFileSync(path.join(PKG, "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql"), "utf8");

for (const bad of ["DROP TABLE", "TRUNCATE TABLE"]) {
  if (new RegExp(`\\b${bad.replace(" ", "\\s+")}\\b`, "i").test(stripComments(recon))) {
    fail(`destructive SQL in reconciliation: ${bad}`);
  }
}
if (/expuvcohlcjzvrrauvud/.test(recon) && !/Forbidden Production/.test(recon)) {
  fail("Production ref must not appear as executable target in reconciliation SQL");
}
if (/DELETE\s+FROM\s+(?!supabase_migrations\.schema_migrations\b)/i.test(stripComments(recon))) {
  fail("unexpected DELETE in reconciliation");
}
if (!/ALTER FUNCTION[\s\S]*STABLE/i.test(recon)) fail("reconciliation must correct STABLE");
if (!/REVOKE ALL[\s\S]*FROM PUBLIC,\s*anon/i.test(recon)) fail("reconciliation must revoke PUBLIC, anon");
if (!/phase5d_tt5d_controlled_reconciliation/.test(recon)) fail("missing provenance name");
if (!/tt5d_correction_referee_select/.test(recon)) fail("precondition missing policy checks");

const forbiddenPatterns = [
  [/relacl::text/i, "relacl::text"],
  [/proacl::text/i, "proacl::text"],
  [/pg_get_indexdef\([^)]*\)\s*IS\s+DISTINCT\s+FROM/i, "pg_get_indexdef IS DISTINCT FROM"],
  [/pg_get_constraintdef\([^)]*\)\s*IS\s+DISTINCT\s+FROM/i, "pg_get_constraintdef IS DISTINCT FROM"],
  [/column_default\s*=\s*'/i, "column_default="],
];
for (const [label, sql] of [
  ["sql/10", recon],
  ["sql/20", verifySql],
  ["sql/90", rb],
]) {
  const body = stripComments(sql);
  for (const [re, name] of forbiddenPatterns) {
    if (re.test(body)) fail(`${label} forbidden serialized guard: ${name}`);
  }
}

const sql10GuardIds = extractGuardIds(recon);
const registryIds = registry.preMutation.guardIds ?? registry.parity?.sql10PreGuardIds ?? [];
if (sql10GuardIds.length !== registryIds.length) {
  fail(`sql/10 guard_id count ${sql10GuardIds.length} != registry ${registryIds.length}`);
}
const regSet = new Set(registryIds);
const sql10Set = new Set(sql10GuardIds);
for (const id of registryIds) {
  if (!sql10Set.has(id)) fail(`sql/10 missing guard_id ${id}`);
}
for (const id of sql10GuardIds) {
  if (!regSet.has(id)) fail(`registry missing guard_id ${id}`);
}

const sql00Ids = [...new Set([...sql00.matchAll(/'([^']+)'\s+AS\s+guard_id/g)].map((m) => m[1]))];
if (sql00Ids.length !== registryIds.length) {
  fail(`sql/00 guard_id count ${sql00Ids.length} != registry ${registryIds.length}`);
}
for (const id of registryIds) {
  if (!sql00Ids.includes(id)) fail(`sql/00 missing guard_id ${id}`);
}

if (
  !/btrim\(\s*regexp_replace\(\s*\(?\s*pg_get_expr\(\s*pol\.polqual\s*,\s*pol\.polrelid\s*,\s*false\s*\)/.test(
    recon,
  )
) {
  fail("sql/10 missing WS_COLLAPSE_V1 normalized select-policy USING guard");
}
if (
  /pg_get_expr\(\s*pol\.polqual\s*,\s*pol\.polrelid\s*\)\s*=\s*'\(team_tournament_can_manage/.test(
    recon,
  )
) {
  fail("sql/10 still has raw direct select-policy USING comparison");
}

const promo = path.join(PKG, "evidence/06_PRODUCTION_PROMOTION_CONTRACT.json");
if (!fs.existsSync(promo)) fail("missing production promotion contract");
else {
  const p = JSON.parse(fs.readFileSync(promo, "utf8"));
  if (
    p.paths?.PREEXISTING_OBJECT_PATH?.productionReuseOfPr354StagingFingerprints !==
    "FORBIDDEN"
  ) {
    fail("promotion contract must forbid Staging fingerprint reuse on Production");
  }
}

if (!/hashtextextended\('phase5d_tt5d_controlled_reconciliation'/.test(rb)) {
  fail("rollback must share apply advisory lock key");
}
const normCount = [recon, verifySql, rb]
  .join("\n")
  .match(
    /btrim\(\s*regexp_replace\(\s*\(?\s*pg_get_expr\(\s*pol\.polqual\s*,\s*pol\.polrelid\s*,\s*false\s*\)/g,
  );
if (!normCount || normCount.length !== 4) {
  fail(`expected 4 WS_COLLAPSE_V1 select-policy guards, got ${normCount?.length ?? 0}`);
}

if (
  baseline.policyExpressionComparison?.version !== "WS_COLLAPSE_V1" ||
  baseline.policyExpressionComparison?.comparison !== "EXACT_AFTER_NORMALIZATION"
) {
  fail("evidence/02 missing WS_COLLAPSE_V1 policyExpressionComparison contract");
}
if (
  baseline.proconfigComparison?.version !== "PROCONFIG_TEXT_ARRAY_V1" ||
  baseline.proconfigComparison?.textSerializationCompared !== false ||
  baseline.proconfigComparison?.comparison !==
    "EXACT_ELEMENTWISE_AFTER_NULL_TO_EMPTY_ARRAY"
) {
  fail("evidence/02 missing PROCONFIG_TEXT_ARRAY_V1 contract");
}
for (const f of baseline.functions || []) {
  if (!Array.isArray(f.proconfig)) fail(`${f.name} proconfig must be array`);
}
const applyAdmin = (baseline.functions || []).find(
  (f) => f.name === "referee_v5_apply_admin_result_revision",
);
if (
  !applyAdmin ||
  applyAdmin.proconfig.length !== 1 ||
  applyAdmin.proconfig[0] !== "search_path=pg_catalog, public"
) {
  fail("apply_admin_result_revision proconfig must be one-element comma-containing array");
}

const sql00Body = stripComments(sql00);
if (!/preflight_all_pass/.test(sql00)) fail("sql/00 missing preflight_all_pass summary");
if (!/total_guard_count/.test(sql00) || !/passed_guard_count/.test(sql00) || !/failed_guard_count/.test(sql00)) {
  fail("sql/00 missing deterministic summary column names");
}
if (!/guard_id/.test(sql00) || !/matches_guard/.test(sql00)) fail("sql/00 missing registry shadow columns");
if (!/\(\([^)]*EXCEPT[^)]*\)\s*UNION ALL\s*\([^)]*EXCEPT/.test(sql00Body.replace(/\s+/g, " "))) {
  // soft structural check on parenthesized ACL set equality
  if (!sql00Body.includes("EXCEPT") || !sql00Body.includes("UNION ALL")) {
    fail("sql/00 ACL_EXPLODED_SET_V1 missing EXCEPT/UNION ALL set equality");
  }
}
if (!/\baclexplode\b/.test(sql00Body)) fail("sql/00 missing ACL_EXPLODED_SET_V1 aclexplode");
if (/relacl::text|proacl::text/.test(sql00Body)) fail("sql/00 must not use ACL text equality for matches_guard paths");

if (
  /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|ALTER\s+|DROP\s+|TRUNCATE\s+TABLE|CREATE\s+|GRANT\s+|REVOKE\s+|BEGIN\b|COMMIT\b|\bDO\s+\$)/i.test(
    sql00Body,
  )
) {
  fail("sql/00 must remain SELECT-only");
}

const proconfigGuardRe = /NOT \(\s*coalesce\(\(SELECT pp\.proconfig FROM pg_proc pp WHERE pp\.oid=/g;
const sql10Guards = recon.match(proconfigGuardRe) || [];
const sql20Guards = verifySql.match(proconfigGuardRe) || [];
const sql90Guards = rb.match(proconfigGuardRe) || [];
if (sql10Guards.length !== 13) fail(`sql/10 expected 13 proconfig text[] guards, got ${sql10Guards.length}`);
if (sql20Guards.length !== 13) fail(`sql/20 expected 13 proconfig text[] guards, got ${sql20Guards.length}`);
if (sql90Guards.length !== 26) fail(`sql/90 expected 26 proconfig text[] guards, got ${sql90Guards.length}`);
for (const [label, sql] of [
  ["sql/10", recon],
  ["sql/20", verifySql],
  ["sql/90", rb],
]) {
  const body = stripComments(sql);
  if (/pp\.proconfig::text/.test(body) || /coalesce\(\(SELECT pp\.proconfig::text/.test(body)) {
    fail(`${label} still compares via proconfig::text`);
  }
}

if (/aclexplode/.test(stripComments(recon))) {
  // typed ACL guards present
} else {
  fail("sql/10 missing ACL_EXPLODED_SET_V1 aclexplode guards");
}

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

if (!/ALTER FUNCTION[\s\S]*IMMUTABLE/i.test(rb)) fail("rollback must restore IMMUTABLE");
if (!/DELETE FROM supabase_migrations\.schema_migrations/i.test(rb)) {
  fail("rollback must remove provenance row");
}

if (fs.existsSync(path.join(ROOT, MANIFEST_REL))) {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_REL), "utf8"));
  if (!Array.isArray(man.files) || man.files.length < 1) fail("PHASE5D checksum manifest empty");
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

const protectedHistoricalEvidence = [
  "docs/platform-hard-cutover-01/phase-05b-execution-package/evidence/05_PHASE5B_DECISION_2026-07-31.json",
  "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/01_OWNER_GO_TARGET_AND_BACKUP_GATE_2026-07-31.json",
  "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/07_PHASE5C_M9_RECLASSIFICATION_DECISION_2026-07-31.json",
];
for (const p of protectedHistoricalEvidence) {
  try {
    git(["diff", "--quiet", "origin/main", "--", p]);
  } catch {
    fail(`protected historical evidence changed vs origin/main: ${p}`);
  }
}

for (const extra of [
  "evidence/06_PRODUCTION_PROMOTION_CONTRACT.json",
  "evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json",
  "evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json",
  "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
  "scripts/harden-phase5d-a1.mjs",
  "scripts/phase5d-a4-guard-contracts.mjs",
]) {
  if (!fs.existsSync(path.join(PKG, extra))) fail(`missing A.4 artefact ${extra}`);
}

if (errors.length) {
  console.error("FAIL Phase 5D-A verifier:");
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log("PASS Phase 5D-A verifier");
