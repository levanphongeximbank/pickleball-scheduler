/**
 * Phase 5D-A / A.1 / A.2 readiness package static tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(
  ROOT,
  "docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation",
);

const COMPACT_USING =
  "(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))";

const PRETTY_USING =
  "(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM referee_assignments ra\n  WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))";

/** JS mirror of WS_COLLAPSE_V1 (POSIX whitespace → single space + trim). */
function wsCollapseV1(s) {
  return String(s).replace(/[\s]+/g, " ").trim();
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(PKG, rel), "utf8"));
}

function shaFile(rel) {
  const norm = rel.replace(/\\/g, "/");
  const oidR = spawnSync("git", ["rev-parse", "--verify", "--quiet", ":" + norm], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (oidR.status === 0) {
    const blob = spawnSync("git", ["cat-file", "blob", oidR.stdout.trim()], {
      cwd: ROOT,
      encoding: "buffer",
    });
    if (blob.status === 0) {
      return crypto.createHash("sha256").update(blob.stdout).digest("hex").toUpperCase();
    }
  }
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(ROOT, rel)))
    .digest("hex")
    .toUpperCase();
}

const NORM_GUARD_RE =
  /btrim\(\s*regexp_replace\(\s*\(?\s*pg_get_expr\(\s*pol\.polqual\s*,\s*pol\.polrelid\s*,\s*false\s*\)\s*\)?::text\s*,\s*'\[\[:space:\]\]\+'\s*,\s*' '\s*,\s*'g'\s*\)\s*\)\s*=\s*btrim\(\s*regexp_replace\(/g;

test("Phase 5D-A package files exist including A.1/A.2 artefacts", () => {
  for (const f of [
    "README.md",
    "PHASE5D_A_READINESS_MANIFEST.json",
    "PHASE5D_CHECKSUM_MANIFEST.json",
    "evidence/01_STAGING_TARGET_AND_BASELINE_GATE.json",
    "evidence/02_TT5D_EXACT_CATALOG_BASELINE.json",
    "evidence/03_TT5D_SEMANTIC_DELTA.json",
    "evidence/04_TWO_WAY_DEPENDENCY_MAP.json",
    "evidence/05_PHASE5D_A_DECISION.json",
    "evidence/06_PRODUCTION_PROMOTION_CONTRACT.json",
    "evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json",
    "evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json",
    "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
    "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
    "sql/20_TT5D_POST_APPLY_VERIFY.sql",
    "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
    "scripts/verify-phase5d-a.mjs",
    "scripts/harden-phase5d-a1.mjs",
  ]) {
    assert.ok(fs.existsSync(path.join(PKG, f)), f);
  }
});

test("baseline lists exactly 13 TT5D functions and WS_COLLAPSE_V1 metadata", () => {
  const b = readJson("evidence/02_TT5D_EXACT_CATALOG_BASELINE.json");
  assert.equal(b.functionCount, 13);
  assert.equal(b.functions.length, 13);
  assert.equal(b.policyExpressionComparison.version, "WS_COLLAPSE_V1");
  assert.equal(
    b.policyExpressionComparison.scope,
    "tt5d_correction_referee_select.polqual",
  );
  assert.equal(b.policyExpressionComparison.pgGetExprPretty, false);
  assert.equal(
    b.policyExpressionComparison.normalization,
    "COLLAPSE_POSIX_WHITESPACE_TO_SINGLE_SPACE_AND_TRIM",
  );
  assert.equal(b.policyExpressionComparison.comparison, "EXACT_AFTER_NORMALIZATION");
  assert.equal(b.policyExpressionComparison.semanticTokensMayDiffer, false);
  assert.equal(b.policyExpressionComparison.expectedNormalizedUsing, COMPACT_USING);
});

test("semantic findings 1-7 confirmed", () => {
  const d = readJson("evidence/03_TT5D_SEMANTIC_DELTA.json");
  for (let i = 1; i <= 7; i++) {
    const f = d.findings.find((x) => x.id === i);
    assert.ok(f, `finding ${i}`);
    assert.match(String(f.result), /^CONFIRMED/);
  }
});

test("decision READY_FOR_OWNER_STAGING_GO retains blockers and M9 20/4", () => {
  const d = readJson("evidence/05_PHASE5D_A_DECISION.json");
  assert.equal(d.decision, "READY_FOR_OWNER_STAGING_GO");
  assert.equal(d.StagingDatabaseMutations, 0);
  assert.equal(d.ProductionAccess, 0);
  assert.equal(d.m9.executableApplyCount, 20);
  assert.equal(d.m9.nonExecutableCandidateCount, 4);
  assert.equal(d.m9.tt5dDeclaredExecutable, false);
  assert.equal(d.continuingPhase5.executionRunbookAccepted, false);
  assert.equal(d.continuingPhase5.productionExecutionGo, false);
  assert.equal(d.continuingPhase5.PHASE_05_COMPLETE, "NOT_ISSUED");
  assert.equal(d.retainedBlockers.BLOCKED_PHASE5C_TT5D_CERTIFICATION, true);
  assert.equal(d.retainedBlockers.BLOCKED_PHASE5_READINESS, true);
  assert.ok(
    d.markers.includes("PLATFORM_HARD_CUTOVER_01_PHASE5D_READY_FOR_STAGING_GO_REISSUE"),
  );
  assert.ok(
    d.markers.includes(
      "PLATFORM_HARD_CUTOVER_01_PHASE5D_POLICY_GUARD_NORMALIZATION_VERIFIED",
    ),
  );
});

test("WS_COLLAPSE_V1: compact and pretty representations normalize identically", () => {
  assert.equal(wsCollapseV1(COMPACT_USING), wsCollapseV1(PRETTY_USING));
  assert.equal(wsCollapseV1(COMPACT_USING), COMPACT_USING);
});

test("WS_COLLAPSE_V1 collapses whitespace rather than deleting it", () => {
  const spaced = "a   b\n\tc";
  assert.equal(wsCollapseV1(spaced), "a b c");
  assert.notEqual(wsCollapseV1(spaced), "abc");
});

test("WS_COLLAPSE_V1 semantic negatives still differ after normalization", () => {
  const base = wsCollapseV1(COMPACT_USING);
  assert.notEqual(
    base,
    wsCollapseV1(COMPACT_USING.replace("requested_by = auth.uid()", "requested_by <> auth.uid()")),
  );
  assert.notEqual(
    base,
    wsCollapseV1(COMPACT_USING.replace("ra.referee_user_id", "ra.other_user_id")),
  );
  assert.notEqual(
    base,
    wsCollapseV1(COMPACT_USING.replace("team_tournament_can_manage() OR ", "")),
  );
  assert.notEqual(
    base,
    wsCollapseV1(
      COMPACT_USING.replace(
        "EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))",
        "true",
      ),
    ),
  );
});

test("four SQL guards use pg_get_expr(..., false) + POSIX collapse + trim", () => {
  const files = [
    "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
    "sql/20_TT5D_POST_APPLY_VERIFY.sql",
    "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  ];
  let total = 0;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(PKG, f), "utf8");
    const matches = sql.match(NORM_GUARD_RE) || [];
    total += matches.length;
    assert.doesNotMatch(
      sql,
      /pg_get_expr\(\s*pol\.polqual\s*,\s*pol\.polrelid\s*\)\s*=\s*'\(team_tournament_can_manage/,
      `${f} still has raw direct select-policy comparison`,
    );
  }
  assert.equal(total, 4, `expected 4 normalized select-policy guards, got ${total}`);
});

test("no_client_write remains exact false/false", () => {
  for (const f of [
    "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
    "sql/20_TT5D_POST_APPLY_VERIFY.sql",
    "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  ]) {
    const sql = fs.readFileSync(path.join(PKG, f), "utf8");
    assert.match(
      sql,
      /tt5d_correction_no_client_write[\s\S]*pg_get_expr\(pol\.polqual, pol\.polrelid, false\) = 'false'[\s\S]*pg_get_expr\(pol\.polwithcheck, pol\.polrelid, false\) = 'false'/,
    );
  }
});

test("sql/00 is SELECT/catalog-only with normalized policy inventory", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql"), "utf8");
  assert.match(sql, /using_matches_guard/);
  assert.match(sql, /with_check_matches_guard/);
  assert.match(sql, /using_normalized/);
  assert.match(sql, /WS_COLLAPSE_V1|btrim\(regexp_replace/);
  const body = sql
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
  assert.doesNotMatch(body, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i);
});

test("precondition SQL retains fail-closed ACL/fingerprint guards and mutation allowlist", () => {
  const sql = fs.readFileSync(
    path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"),
    "utf8",
  );
  assert.match(sql, /proacl::text/);
  assert.match(sql, /proconfig/);
  assert.match(sql, /has_function_privilege\('public'/);
  assert.match(sql, /pg_get_userbyid/);
  assert.match(sql, /tt5d_correction_referee_select/);
  assert.match(sql, /tt5d_correction_no_client_write/);
  assert.match(sql, /referee_assignments_status_check/);
  assert.match(sql, /matchup_id/);
  assert.match(sql, /sub_match_id/);
  assert.match(sql, /PHASE5D_PROVENANCE_ALREADY_PRESENT|provenance/i);
  assert.match(sql, /ALTER FUNCTION[\s\S]*STABLE/i);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC,\s*anon,\s*authenticated,\s*service_role/i);
  assert.match(sql, /INSERT INTO supabase_migrations\.schema_migrations/);
  assert.equal(
    (sql.match(/ALTER FUNCTION public\.referee_v5_assignment_effective_status/g) || []).length,
    1,
  );
});

test("post-apply verify has definition fingerprints and allowlists", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/20_TT5D_POST_APPLY_VERIFY.sql"), "utf8");
  const fp = readJson("evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json");
  assert.match(sql, new RegExp(fp.postApplyDefMd5));
  assert.match(sql, /STABLE/);
  assert.match(sql, /proacl::text/);
  assert.match(sql, /anon denied|VERIFY anon/i);
  assert.match(sql, /authenticated=r\/postgres|authenticated SELECT/i);
});

test("rollback shares advisory lock and fail-closed target/state guards", () => {
  const apply = fs.readFileSync(
    path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"),
    "utf8",
  );
  const rb = fs.readFileSync(path.join(PKG, "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql"), "utf8");
  assert.match(apply, /hashtextextended\('phase5d_tt5d_controlled_reconciliation'/);
  assert.match(rb, /hashtextextended\('phase5d_tt5d_controlled_reconciliation'/);
  assert.match(rb, /ROLLBACK_TARGET_MISSING_PROVENANCE|VERIFY/);
  assert.match(rb, /ALTER FUNCTION[\s\S]*IMMUTABLE/i);
  assert.match(rb, /ROLLBACK_PROVENANCE_STILL_PRESENT|ROLLBACK_VERIFY|PHASE5D_BASELINE_MISMATCH/);
});

test("canonical IMMUTABLE→STABLE and source/M9 byte-sync", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql"),
    "utf8",
  );
  assert.match(src, /language sql\s*\nstable/i);
  assert.doesNotMatch(src, /language sql\s*\nimmutable/i);
  assert.match(src, /from public, anon, authenticated, service_role/i);
  const sup = readJson("evidence/07_CANONICAL_SOURCE_M9_SUPERSESSION.json");
  assert.equal(sup.m9.executableApplyCount, 20);
  assert.equal(sup.m9.nonExecutableCandidateCount, 4);
  for (const s of sup.supersessions) {
    assert.equal(s.sourceEqualsM9, true);
    assert.equal(shaFile(s.sourcePath), s.newSha256ExactGitBlobBytes);
    assert.equal(shaFile(s.m9Path), s.newSha256ExactGitBlobBytes);
    assert.notEqual(s.oldSha256ExactGitBlobBytes, s.newSha256ExactGitBlobBytes);
  }
});

test("Production promotion contract forbids Staging fingerprint reuse", () => {
  const c = readJson("evidence/06_PRODUCTION_PROMOTION_CONTRACT.json");
  assert.equal(
    c.paths.PREEXISTING_OBJECT_PATH.productionReuseOfPr354StagingFingerprints,
    "FORBIDDEN",
  );
  assert.ok(c.paths.FRESH_ABSENT_OBJECT_PATH);
  assert.equal(c.ProductionAccess, 0);
  assert.equal(c.productionExecutionGo ?? false, false);
});

test("Phase 5D-A verifier script PASS", () => {
  const r = spawnSync(
    process.execPath,
    [path.join(PKG, "scripts/verify-phase5d-a.mjs")],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /PASS Phase 5D-A verifier/);
});

test("historical Phase 5B/5C evidence JSON unchanged vs origin/main", () => {
  const protectedEvidence = [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/evidence/05_PHASE5B_DECISION_2026-07-31.json",
    "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/01_OWNER_GO_TARGET_AND_BACKUP_GATE_2026-07-31.json",
    "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/07_PHASE5C_M9_RECLASSIFICATION_DECISION_2026-07-31.json",
  ];
  for (const p of protectedEvidence) {
    const r = spawnSync("git", ["diff", "--quiet", "origin/main", "--", p], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `historical evidence changed: ${p}`);
  }
});
