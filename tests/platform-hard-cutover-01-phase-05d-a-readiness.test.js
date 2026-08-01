/**
 * Phase 5D-A / A.1 / A.2 / A.3 / A.4 / A.5 readiness package static tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  parseAclText,
  aclSetsEqual,
  canonicalizeAclRows,
  parseIndexCatalogFromDef,
  normalizeConstraintExpr,
  sqlIndexCatalogMatch,
  sqlConstraintCatalogMatch,
  sqlColumnDefaultMatch,
  sqlAclSetMatch,
  wsCollapseJs,
  renderJsonbLiteral,
  guardRow,
} from "../docs/platform-hard-cutover-01/phase-05d-tt5d-controlled-reconciliation/scripts/phase5d-a4-guard-contracts.mjs";

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

function wsCollapseV1(s) {
  return wsCollapseJs(s);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(PKG, rel), "utf8"));
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

test("Phase 5D-A package files exist including A.1/A.2/A.4/A.5 artefacts", () => {
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
    "evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json",
    "evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json",
    "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
    "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
    "sql/20_TT5D_POST_APPLY_VERIFY.sql",
    "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
    "scripts/verify-phase5d-a.mjs",
    "scripts/harden-phase5d-a1.mjs",
    "scripts/phase5d-a4-guard-contracts.mjs",
  ]) {
    assert.ok(fs.existsSync(path.join(PKG, f)), f);
  }
  const transportDir = path.join(PKG, "sql/00_transport");
  assert.ok(fs.existsSync(transportDir), "sql/00_transport");
  const batches = fs.readdirSync(transportDir).filter((n) => /^00_PREFLIGHT_BATCH_\d+\.sql$/.test(n));
  assert.ok(batches.length >= 1, "at least one transport batch");
});

test("baseline lists exactly 13 TT5D functions and WS_COLLAPSE_V1 + PROCONFIG_TEXT_ARRAY_V1 metadata", () => {
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
  assert.equal(b.proconfigComparison.version, "PROCONFIG_TEXT_ARRAY_V1");
  assert.equal(b.proconfigComparison.catalogType, "text[]");
  assert.equal(
    b.proconfigComparison.comparison,
    "EXACT_ELEMENTWISE_AFTER_NULL_TO_EMPTY_ARRAY",
  );
  assert.equal(b.proconfigComparison.textSerializationCompared, false);
  assert.equal(b.proconfigComparison.nullHandling, "COALESCE_NULL_TO_EMPTY_TEXT_ARRAY");
  assert.equal(b.proconfigComparison.orderSensitive, true);
  assert.equal(b.proconfigComparison.multiplicitySensitive, true);
  assert.equal(b.proconfigComparison.caseSensitive, true);
  assert.equal(b.proconfigComparison.innerElementNormalization, "NONE");
  assert.equal(b.proconfigComparison.commaContainingElementPreserved, true);
  assert.equal(b.typedCatalogGuardComparison.version, "PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE");
  assert.ok(b.typedCatalogGuardComparison.contracts.includes("ACL_EXPLODED_SET_V1"));
  for (const f of b.functions) {
    assert.ok(Array.isArray(f.proconfig), `${f.name} proconfig must be array`);
  }
  const applyAdmin = b.functions.find((f) => f.name === "referee_v5_apply_admin_result_revision");
  assert.deepEqual(applyAdmin.proconfig, ["search_path=pg_catalog, public"]);
  assert.notDeepEqual(applyAdmin.proconfig, ["search_path=pg_catalog", "public"]);
  const effective = b.functions.find((f) => f.name === "referee_v5_assignment_effective_status");
  assert.deepEqual(effective.proconfig, []);
});

test("PROCONFIG_TEXT_ARRAY_V1 semantic negatives remain significant", () => {
  const one = ["search_path=pg_catalog, public"];
  assert.notDeepEqual(one, ["search_path=public, pg_catalog"]);
  assert.notDeepEqual(one, ["search_path=pg_catalog", "public"]);
  assert.notDeepEqual(one, ["search_path=pg_catalog, public", "extra=1"]);
  assert.notDeepEqual(one, []);
  assert.notDeepEqual(one, ["Search_path=pg_catalog, public"]);
  assert.notDeepEqual(one, ["search_path=pg_catalog,public"]);
});

test("sql/10/20/90 use 13/13/26 semantic text[] proconfig guards and no proconfig::text comparisons", () => {
  const guardRe = /coalesce\(\(SELECT pp\.proconfig FROM pg_proc pp WHERE pp\.oid=/g;
  const castCompareRe =
    /pp\.proconfig::text|proconfig::text\s*FROM|coalesce\(\(SELECT pp\.proconfig::text/;
  const sql10 = fs.readFileSync(path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"), "utf8");
  const sql20 = fs.readFileSync(path.join(PKG, "sql/20_TT5D_POST_APPLY_VERIFY.sql"), "utf8");
  const sql90 = fs.readFileSync(path.join(PKG, "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql"), "utf8");
  assert.equal((sql10.match(guardRe) || []).length, 13);
  assert.equal((sql20.match(guardRe) || []).length, 13);
  assert.equal((sql90.match(guardRe) || []).length, 26);
  for (const [name, sql] of [
    ["sql/10", sql10],
    ["sql/20", sql20],
    ["sql/90", sql90],
  ]) {
    const body = stripComments(sql);
    assert.doesNotMatch(body, castCompareRe, `${name} still compares via proconfig::text`);
    assert.match(sql, /ARRAY\['search_path=pg_catalog, public'\]::text\[\]/);
    assert.match(sql, /ARRAY\[\]::text\[\]/);
  }
});

test("semantic findings 1-7 confirmed", () => {
  const d = readJson("evidence/03_TT5D_SEMANTIC_DELTA.json");
  for (let i = 1; i <= 7; i++) {
    const f = d.findings.find((x) => x.id === i);
    assert.ok(f, `finding ${i}`);
    assert.match(String(f.result), /^CONFIRMED/);
  }
});

test("decision READY_FOR_OWNER_STAGING_GO retains blockers, M9 20/4, and A.5 markers", () => {
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
  assert.equal(d.hardening, "PHASE5D_A5_TRANSPORT_SAFE_BATCHED_SELECT_ONLY_PREFLIGHT");
  assert.equal(d.nextAuth, "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY");
  assert.equal(d.typedCatalogGuardRegistry.preGuardCount, 189);
  assert.equal(d.jsonbLiteralCorrection.helper, "renderJsonbLiteral");
  for (const m of [
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_JSONB_LITERAL_RENDERER_CORRECTED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_TRANSPORT_BATCH_PACKAGE_VERIFIED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_189_GUARD_BATCH_PARITY_VERIFIED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_READY_FOR_BATCHED_SELECT_ONLY_STAGING_GO",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A4_TYPED_CATALOG_GUARD_CLOSURE_VERIFIED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_A3_PROCONFIG_TEXT_ARRAY_GUARDS_VERIFIED",
    "PLATFORM_HARD_CUTOVER_01_PHASE5D_POLICY_GUARD_NORMALIZATION_VERIFIED",
  ]) {
    assert.ok(d.markers.includes(m), m);
  }
  assert.ok(
    !d.markers.includes("PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_CANONICAL_SQL00_UNCHANGED_VERIFIED"),
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

test("A.4 typed guard registry exists with exact sql/00↔sql/10 parity", () => {
  const reg = readJson("evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json");
  assert.equal(reg.nextAuth, "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY");
  assert.equal(reg.preMutation.guardCount, 189);
  assert.equal(reg.parity.guardCount, 189);
  assert.equal(reg.parity.guardIdSetEqual, true);
  const sql10 = fs.readFileSync(path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"), "utf8");
  const sql00 = fs.readFileSync(path.join(PKG, "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql"), "utf8");
  const ids10 = extractGuardIds(sql10);
  const ids00 = [
    ...new Set([...sql00.matchAll(/'([^']+)'\s+AS\s+guard_id/g)].map((m) => m[1])),
  ];
  assert.equal(ids10.length, 189);
  assert.deepEqual(new Set(ids10), new Set(reg.preMutation.guardIds));
  assert.deepEqual(new Set(ids00), new Set(reg.preMutation.guardIds));
});

test("A.5 transport batches preserve 189-guard parity under 28000-byte encoded limit", () => {
  const man = readJson("evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json");
  const reg = readJson("evidence/09_PHASE5D_A4_TYPED_GUARD_REGISTRY.json");
  assert.equal(man.totalGuards, 189);
  assert.notEqual(man.canonicalSql00.gitBlob, "9989e54211a93ba79b8e6e87833e825a7419a24a");
  assert.equal(
    man.supersededInvalidJsonbBlobs.canonicalSql00.gitBlob,
    "9989e54211a93ba79b8e6e87833e825a7419a24a",
  );
  assert.equal(man.encodedPayloadLimit, 28000);
  assert.equal(man.nextAuth, "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY");
  const flat = man.batches.flatMap((b) => b.guard_ids);
  assert.equal(flat.length, 189);
  assert.equal(new Set(flat).size, 189);
  assert.deepEqual(flat, reg.preMutation.guardIds);
  for (const b of man.batches) {
    assert.ok(b.encodedExecuteSqlPayloadByteCount <= 28000, b.batch_id);
    const sql = fs.readFileSync(path.join(PKG, b.path), "utf8");
    const enc = Buffer.byteLength(JSON.stringify({ query: sql }), "utf8");
    assert.equal(enc, b.encodedExecuteSqlPayloadByteCount);
    assert.match(sql, /\bWITH\b/);
    assert.doesNotMatch(stripComments(sql), /\b(BEGIN|COMMIT|INSERT\s+INTO|ALTER\s+|GRANT\s+)\b/i);
  }
  const sql00Blob = spawnSync("git", ["hash-object", path.join(PKG, "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(sql00Blob.stdout.trim(), man.canonicalSql00.gitBlob);
  for (const [rel, oid] of [
    ["sql/10_TT5D_CONTROLLED_RECONCILIATION.sql", "76c269451348d5823ffb275a368fd9ff385f6d08"],
    ["sql/20_TT5D_POST_APPLY_VERIFY.sql", "4e3d02d067b8bc50619cf96a1742fd870637e8bf"],
    ["sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql", "2e5a1cd17c74f7b669757c3a9fd3d7be11c3d2f0"],
  ]) {
    const r = spawnSync("git", ["hash-object", path.join(PKG, rel)], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.stdout.trim(), oid, rel);
  }
});

test("zero forbidden serialized catalog guards in sql/10/20/90", () => {
  const forbidden = [
    [/relacl::text/i, "relacl::text"],
    [/proacl::text/i, "proacl::text"],
    [/pg_get_indexdef\([^)]*\)\s*IS\s+DISTINCT\s+FROM/i, "pg_get_indexdef"],
    [/pg_get_constraintdef\([^)]*\)\s*IS\s+DISTINCT\s+FROM/i, "pg_get_constraintdef"],
    [/column_default\s*=\s*'/i, "column_default="],
  ];
  for (const f of [
    "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql",
    "sql/20_TT5D_POST_APPLY_VERIFY.sql",
    "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql",
  ]) {
    const body = stripComments(fs.readFileSync(path.join(PKG, f), "utf8"));
    for (const [re, label] of forbidden) {
      assert.doesNotMatch(body, re, `${f} still has forbidden ${label}`);
    }
    assert.match(body, /aclexplode/);
  }
});

test("ACL_EXPLODED_SET_V1 positive reorder and negative privilege/grantor/grantee/grantable/PUBLIC", () => {
  const baselineText = "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}";
  const reordered = "{service_role=X/postgres,postgres=X/postgres,authenticated=X/postgres}";
  assert.equal(aclSetsEqual(parseAclText(baselineText), parseAclText(reordered)), true);
  assert.equal(
    aclSetsEqual(parseAclText(baselineText), parseAclText("{postgres=X/postgres,authenticated=X/postgres}")),
    false,
  );
  assert.equal(
    aclSetsEqual(parseAclText("{postgres=X/postgres}"), parseAclText("{postgres=X/alice}")),
    false,
  );
  assert.equal(
    aclSetsEqual(parseAclText("{postgres=X/postgres}"), parseAclText("{alice=X/postgres}")),
    false,
  );
  assert.equal(
    aclSetsEqual(parseAclText("{postgres=X/postgres}"), parseAclText("{postgres=X*/postgres}")),
    false,
  );
  assert.equal(
    aclSetsEqual(parseAclText("{postgres=X/postgres}"), parseAclText("{=X/postgres,postgres=X/postgres}")),
    false,
  );
  const sql = sqlAclSetMatch({
    kind: "function",
    objectSql: "to_regprocedure('public.demo()')",
    expectedAclText: baselineText,
  });
  assert.match(sql, /aclexplode/);
  assert.match(sql, /\(\([\s\S]*EXCEPT[\s\S]*\)\s*UNION ALL\s*\([\s\S]*EXCEPT/);
  assert.doesNotMatch(sql, /proacl::text/);
  assert.deepEqual(canonicalizeAclRows(parseAclText("{=r/postgres}"))[0].grantee, "PUBLIC");
});

test("INDEX_CATALOG_V1 whitespace-stable positives and structural negatives", () => {
  const def =
    "CREATE INDEX referee_assignments_sub_match_idx ON public.referee_assignments USING btree (sub_match_id, status) WHERE (sub_match_id IS NOT NULL)";
  const prettyPred = "sub_match_id   IS\n  NOT NULL";
  const cat = parseIndexCatalogFromDef(def, "postgres");
  assert.deepEqual(cat.keyColumns, ["sub_match_id", "status"]);
  assert.equal(wsCollapseJs(prettyPred), cat.predicateNormalized);
  const ok = sqlIndexCatalogMatch({
    indexName: cat.indexName,
    tableName: cat.tableName,
    keyColumns: cat.keyColumns,
    predicateNormalized: cat.predicateNormalized,
    amname: cat.amname,
    owner: cat.owner,
    unique: cat.unique,
  });
  const swapped = sqlIndexCatalogMatch({
    indexName: cat.indexName,
    tableName: cat.tableName,
    keyColumns: ["status", "sub_match_id"],
    predicateNormalized: cat.predicateNormalized,
    amname: cat.amname,
    owner: cat.owner,
    unique: cat.unique,
  });
  assert.notEqual(ok, swapped);
  assert.match(ok, /ARRAY\['sub_match_id', 'status'\]/);
  assert.match(swapped, /ARRAY\['status', 'sub_match_id'\]/);
  const badPred = sqlIndexCatalogMatch({
    ...cat,
    predicateNormalized: "sub_match_id IS NULL",
  });
  assert.match(badPred, /sub_match_id IS NULL/);
  assert.doesNotMatch(ok, /pg_get_indexdef\([^)]*\)\s+IS DISTINCT FROM/);
  const badOwner = sqlIndexCatalogMatch({ ...cat, owner: "not_postgres" });
  assert.match(badOwner, /not_postgres/);
  const badAm = sqlIndexCatalogMatch({ ...cat, amname: "hash" });
  assert.match(badAm, /'hash'/);
});

test("CONSTRAINT_CATALOG_V1 whitespace PASS and status/operator negatives", () => {
  const raw =
    "CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'revoked'::text, 'completed'::text])))";
  const multiline =
    "CHECK ((status = ANY (ARRAY['pending'::text,\n  'active'::text, 'expired'::text, 'revoked'::text, 'completed'::text])))";
  assert.equal(normalizeConstraintExpr(raw), normalizeConstraintExpr(multiline));
  const ok = sqlConstraintCatalogMatch({
    tableName: "referee_assignments",
    constraintName: "referee_assignments_status_check",
    expectedExprNormalized: normalizeConstraintExpr(raw),
  });
  assert.match(ok, /pg_get_expr\(c\.conbin, c\.conrelid, false\)/);
  assert.doesNotMatch(ok, /pg_get_constraintdef/);
  const removed = sqlConstraintCatalogMatch({
    tableName: "referee_assignments",
    constraintName: "referee_assignments_status_check",
    expectedExprNormalized: normalizeConstraintExpr(
      raw.replace(", 'completed'::text", ""),
    ),
  });
  assert.notEqual(ok, removed);
  const opChanged = sqlConstraintCatalogMatch({
    tableName: "referee_assignments",
    constraintName: "referee_assignments_status_check",
    expectedExprNormalized: normalizeConstraintExpr(raw.replace(" = ANY ", " <> ALL ")),
  });
  assert.notEqual(ok, opChanged);
});

test("COLUMN_DEFAULT_EXPR_V1 formatting PASS and value/type/null negatives", () => {
  const ok = sqlColumnDefaultMatch({
    tableName: "referee_assignments",
    columnName: "version",
    dataTypeRegtype: "integer",
    notNull: true,
    defaultExprNormalized: "1",
  });
  const spaced = sqlColumnDefaultMatch({
    tableName: "referee_assignments",
    columnName: "version",
    dataTypeRegtype: "integer",
    notNull: true,
    defaultExprNormalized: " 1 ",
  });
  assert.match(ok, /pg_get_expr\(ad\.adbin, ad\.adrelid, false\)/);
  assert.doesNotMatch(ok, /column_default/);
  assert.match(spaced, /' 1 '/);
  const changed = sqlColumnDefaultMatch({
    tableName: "referee_assignments",
    columnName: "version",
    dataTypeRegtype: "integer",
    notNull: true,
    defaultExprNormalized: "2",
  });
  assert.notEqual(ok, changed);
  const removed = sqlColumnDefaultMatch({
    tableName: "referee_assignments",
    columnName: "version",
    dataTypeRegtype: "integer",
    notNull: true,
    defaultExprNormalized: null,
  });
  assert.match(removed, /ad\.adbin IS NULL/);
  const nullable = sqlColumnDefaultMatch({
    tableName: "referee_assignments",
    columnName: "version",
    dataTypeRegtype: "integer",
    notNull: false,
    defaultExprNormalized: "1",
  });
  assert.match(nullable, /a\.attnotnull IS FALSE|a\.attnotnull = FALSE|NOT a\.attnotnull/);
});

test("sql/00 is SELECT-only registry shadow with preflight_all_pass summary columns", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql"), "utf8");
  assert.match(sql, /preflight_all_pass/);
  assert.match(sql, /total_guard_count/);
  assert.match(sql, /passed_guard_count/);
  assert.match(sql, /failed_guard_count/);
  assert.match(sql, /matches_guard/);
  assert.match(sql, /guard_id/);
  assert.match(sql, /aclexplode/);
  assert.match(sql, /WS_COLLAPSE_V1|btrim\(regexp_replace/);
  assert.match(sql, /ARRAY\['search_path=pg_catalog, public'\]::text\[\]/);
  assert.match(sql, /coalesce\(.*proconfig.*ARRAY\[\]::text\[\]/);
  const body = stripComments(sql);
  assert.doesNotMatch(
    body,
    /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|ALTER\s+|DROP\s+|TRUNCATE\s+TABLE|CREATE\s+|GRANT\s+|REVOKE\s+|BEGIN\b|COMMIT\b|\bDO\s+\$)/i,
  );
  assert.doesNotMatch(body, /relacl::text|proacl::text/);
  // Diagnostic actual_json must not drive matches_guard (matches_guard uses matchesSql only).
  assert.match(sql, /AS matches_guard/);
});

test("precondition SQL retains typed ACL/fingerprint guards and mutation allowlist", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"), "utf8");
  assert.match(sql, /aclexplode/);
  assert.match(sql, /-- GUARD_ID:/);
  assert.match(sql, /coalesce\(\(SELECT pp\.proconfig FROM pg_proc/);
  assert.doesNotMatch(stripComments(sql), /pp\.proconfig::text|proacl::text|relacl::text/);
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
  assert.match(sql, /fn\.referee_v5_assignment_effective_status\.def_md5/);
});

test("post-apply verify has definition fingerprints and typed ACL", () => {
  const sql = fs.readFileSync(path.join(PKG, "sql/20_TT5D_POST_APPLY_VERIFY.sql"), "utf8");
  const fp = readJson("evidence/08_EFFECTIVE_STATUS_POST_APPLY_FINGERPRINT.json");
  assert.match(sql, new RegExp(fp.postApplyDefMd5));
  assert.match(sql, /STABLE/);
  assert.match(sql, /aclexplode/);
  assert.doesNotMatch(stripComments(sql), /proacl::text|relacl::text/);
  assert.match(sql, /anon denied|VERIFY anon|authenticated/i);
});

test("rollback shares advisory lock and typed guard blocks", () => {
  const apply = fs.readFileSync(path.join(PKG, "sql/10_TT5D_CONTROLLED_RECONCILIATION.sql"), "utf8");
  const rb = fs.readFileSync(path.join(PKG, "sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql"), "utf8");
  assert.match(apply, /hashtextextended\('phase5d_tt5d_controlled_reconciliation'/);
  assert.match(rb, /hashtextextended\('phase5d_tt5d_controlled_reconciliation'/);
  assert.match(rb, /ROLLBACK_TARGET_MISSING_PROVENANCE|VERIFY/);
  assert.match(rb, /ALTER FUNCTION[\s\S]*IMMUTABLE/i);
  assert.match(rb, /ROLLBACK_PROVENANCE_STILL_PRESENT|ROLLBACK_VERIFY|PHASE5D_BASELINE_MISMATCH/);
  assert.match(rb, /aclexplode/);
  assert.doesNotMatch(stripComments(rb), /proacl::text|relacl::text/);
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

test("5D-C renderJsonbLiteral produces quoted PostgreSQL JSONB literals", () => {
  assert.equal(renderJsonbLiteral({ a: 1 }), `'{"a":1}'::jsonb`);
  assert.equal(renderJsonbLiteral(["x"]), `'["x"]'::jsonb`);
  assert.equal(renderJsonbLiteral(null), `'null'::jsonb`);
  assert.equal(renderJsonbLiteral(true), `'true'::jsonb`);
  assert.equal(renderJsonbLiteral(0), `'0'::jsonb`);
  assert.equal(renderJsonbLiteral({ note: "O'Reilly" }), `'{"note":"O''Reilly"}'::jsonb`);
  assert.equal(renderJsonbLiteral({ u: "cá-✓" }), `'{"u":"cá-✓"}'::jsonb`);
  assert.equal(renderJsonbLiteral({ p: "a\\b" }), `'{"p":"a\\\\b"}'::jsonb`);
  assert.equal(
    renderJsonbLiteral({ nested: { arr: [1, null, false] } }),
    `'{"nested":{"arr":[1,null,false]}}'::jsonb`,
  );
  // Removing SQL quoting must fail the contract shape.
  const broken = `${JSON.stringify({ a: 1 })}::jsonb`;
  assert.notEqual(broken, renderJsonbLiteral({ a: 1 }));
  assert.match(broken, /^\{/);
  assert.doesNotMatch(renderJsonbLiteral({ a: 1 }), /^\{/);
});

test("5D-C guardRow expected_json is quoted; matches_guard ignores diagnostic", () => {
  const g = {
    guard_order: 1,
    guard_id: "t.apostrophe",
    object_class: "table",
    object_identity: "public.t",
    contract_version: "TYPED_COMPARISON",
    expected_json: { label: "it's" },
    matchesSql: "TRUE",
    diagnosticSql: "jsonb_build_object('diag', 1)",
  };
  const row = guardRow(g);
  assert.match(row, /'\{"label":"it''s"\}'::jsonb AS expected_json/);
  assert.doesNotMatch(row, /^\s*\{/m);
  assert.match(row, /\(TRUE\) AS matches_guard/);
  assert.match(row, /coalesce\(jsonb_build_object\('diag', 1\)/);
});

function countBareExpectedJsonb(sqlText) {
  let bare = 0;
  let quoted = 0;
  for (const m of sqlText.matchAll(/^\s*(.+?)::jsonb AS expected_json/gm)) {
    const expr = m[1].trim();
    if (expr.startsWith("'") || expr.startsWith("$")) quoted += 1;
    else bare += 1;
  }
  return { bare, quoted };
}

test("5D-C zero bare expected_json JSONB casts in sql/00 and transport batches", () => {
  const sql00 = fs.readFileSync(path.join(PKG, "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql"), "utf8");
  const c00 = countBareExpectedJsonb(sql00);
  assert.equal(c00.bare, 0);
  assert.ok(c00.quoted >= 189);
  const man = readJson("evidence/10_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST.json");
  let totalQuoted = 0;
  for (const b of man.batches) {
    const sql = fs.readFileSync(path.join(PKG, b.path), "utf8");
    const c = countBareExpectedJsonb(sql);
    assert.equal(c.bare, 0, b.batch_id);
    assert.equal(c.quoted, b.guard_count, b.batch_id);
    totalQuoted += c.quoted;
  }
  assert.equal(totalQuoted, 189);
});

test("5D-C sql/10 sql/20 sql/90 remain non-executable under SELECT-only auth and frozen", () => {
  for (const [rel, oid] of [
    ["sql/10_TT5D_CONTROLLED_RECONCILIATION.sql", "76c269451348d5823ffb275a368fd9ff385f6d08"],
    ["sql/20_TT5D_POST_APPLY_VERIFY.sql", "4e3d02d067b8bc50619cf96a1742fd870637e8bf"],
    ["sql/90_TT5D_EXACT_BASELINE_ROLLBACK.sql", "2e5a1cd17c74f7b669757c3a9fd3d7be11c3d2f0"],
  ]) {
    const r = spawnSync("git", ["hash-object", path.join(PKG, rel)], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.stdout.trim(), oid, rel);
    const sql = fs.readFileSync(path.join(PKG, rel), "utf8");
    assert.equal(countBareExpectedJsonb(sql).bare, 0);
    assert.match(sql, /\bBEGIN\b|\bDO\s+\$/i);
  }
  const d = readJson("evidence/05_PHASE5D_A_DECISION.json");
  assert.equal(d.nextAuth, "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY");
  assert.equal(d.continuingPhase5.productionExecutionGo, false);
  assert.equal(d.m9.executableApplyCount, 20);
  assert.equal(d.m9.nonExecutableCandidateCount, 4);
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

test("historical Phase 5B/5C evidence JSON unchanged vs d06ad59a", () => {
  const protectedEvidence = [
    "docs/platform-hard-cutover-01/phase-05b-execution-package/evidence/05_PHASE5B_DECISION_2026-07-31.json",
    "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/01_OWNER_GO_TARGET_AND_BACKUP_GATE_2026-07-31.json",
    "docs/platform-hard-cutover-01/phase-05c-tt5d-staging-certification/evidence/07_PHASE5C_M9_RECLASSIFICATION_DECISION_2026-07-31.json",
  ];
  for (const p of protectedEvidence) {
    const r = spawnSync(
      "git",
      ["diff", "--quiet", "d06ad59a689b56ab76e16661015dc768dd6cf991", "--", p],
      { cwd: ROOT, encoding: "utf8" },
    );
    assert.equal(r.status, 0, `historical evidence changed: ${p}`);
  }
});

test("next permitted execution is batched SELECT-only transport preflight, not sql/10", () => {
  const d = readJson("evidence/05_PHASE5D_A_DECISION.json");
  const readiness = readJson("PHASE5D_A_READINESS_MANIFEST.json");
  assert.equal(d.nextAuth, "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY");
  assert.match(JSON.stringify(readiness), /BATCHED_SELECT_ONLY|00_transport|PREFLIGHT/);
  assert.equal(d.continuingPhase5.productionExecutionGo, false);
  assert.equal(d.continuingPhase5.PHASE_05_COMPLETE, "NOT_ISSUED");
});
