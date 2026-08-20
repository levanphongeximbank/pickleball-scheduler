import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  WAVE5_PACKAGE_DIR,
  auditSql,
  auditWave5Package,
  listWave5SqlFiles,
  relWave5Sql,
} from "./helpers/wave5-sql-dollar-quote-audit.js";

test("detector flags outer untagged $$ containing inner untagged $$", () => {
  const sql = `DO $$
BEGIN
  IF v_chk_norm IS DISTINCT FROM $$CHECK ((cutover_kind = 'WAVE5_CLUB_TENANT'::text))$$ THEN
    RAISE EXCEPTION 'x';
  END IF;
END
$$;`;
  const r = auditSql(sql, "fixture-unsafe.sql");
  assert.equal(r.parseRisk, "NESTED_SAME_DELIMITER");
  assert.equal(r.nestedSameDelimiterCollision, 1);
  assert.equal(r.doBlocks[0].premature, true);
});

test("detector accepts tagged outer DO with inner untagged $$ literals", () => {
  const sql = `DO $wave5_q0_schema_guard$
BEGIN
  IF v_chk_norm IS DISTINCT FROM $$CHECK ((cutover_kind = 'WAVE5_CLUB_TENANT'::text))$$ THEN
    RAISE EXCEPTION 'x';
  END IF;
END
$wave5_q0_schema_guard$;`;
  const r = auditSql(sql, "fixture-safe.sql");
  assert.equal(r.parseRisk, "NONE");
  assert.equal(r.nestedSameDelimiterCollision, 0);
  assert.equal(r.doBlocks[0].premature, false);
});

test("detector flags nested same tagged delimiter", () => {
  const sql = `DO $foo$
BEGIN
  IF x IS DISTINCT FROM $foo$CHECK$foo$ THEN
    NULL;
  END IF;
END
$foo$;`;
  const r = auditSql(sql, "fixture-same-tag.sql");
  assert.equal(r.parseRisk, "NESTED_SAME_DELIMITER");
  assert.ok(r.nestedSameDelimiterCollision >= 1);
});

test("detector flags unbalanced opening/closing dollar tags", () => {
  const sql = `DO $$
BEGIN
  NULL;
END
$wave5$;`;
  const r = auditSql(sql, "fixture-unbalanced.sql");
  assert.equal(r.parseRisk, "UNBALANCED");
  assert.ok(r.unbalanced.length >= 1);
});

test("Wave5 package SQL files are discovered dynamically from the tree", () => {
  const files = listWave5SqlFiles();
  assert.ok(files.length >= 15, `expected Wave5 SQL artifacts, got ${files.length}`);
  const rels = files.map((f) => relWave5Sql(f));
  assert.ok(rels.includes("sql-design/10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql"));
  assert.ok(rels.includes("sql-design/07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.ok(rels.includes("sql-design/02_APPLY_DESIGN.sql"));
  assert.ok(rels.includes("sql-design/01_PRECHECK.sql"));
  assert.ok(rels.some((r) => r.startsWith("staging-remediation/")));

  const onDisk = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".sql")) {
        onDisk.push(path.relative(WAVE5_PACKAGE_DIR, p).split(path.sep).join("/"));
      }
    }
  }
  walk(WAVE5_PACKAGE_DIR);
  onDisk.sort();
  const discovered = [...rels].sort();
  assert.deepEqual(
    discovered,
    onDisk.sort(),
    "audit scan omitted a Wave5 .sql artifact"
  );
});

test("Wave5 SQL package has no nested same-delimiter dollar-quote collisions", () => {
  const reports = auditWave5Package();
  assert.ok(reports.length >= 15);
  const bad = reports.filter((r) => r.parseRisk !== "NONE");
  assert.deepEqual(
    bad.map((r) => ({
      file: r.file,
      parseRisk: r.parseRisk,
      collisions: r.nestedSameDelimiterCollision,
      unbalanced: r.unbalanced,
    })),
    [],
    "Wave5 SQL dollar-quote parse risk must be NONE"
  );
  for (const r of reports) {
    assert.equal(r.nestedSameDelimiterCollision, 0, r.file);
    assert.equal(r.unbalanced.length, 0, r.file);
    assert.equal(r.action, "NONE", r.file);
  }
});

test("Q0A/Q1A schema-guard outer tags keep exact inner catalog comparator literals", () => {
  const sqlDir = path.join(WAVE5_PACKAGE_DIR, "sql-design");
  const q0a = fs.readFileSync(
    path.join(sqlDir, "10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql"),
    "utf8"
  );
  const q1a = fs.readFileSync(
    path.join(sqlDir, "07A_QUIESCE_WRITES_DESIGN.sql"),
    "utf8"
  );
  assert.match(q0a, /DO \$wave5_q0_schema_guard\$/);
  assert.match(q0a, /END \$wave5_q0_schema_guard\$;/);
  assert.match(q1a, /DO \$wave5_q1a_schema_guard\$/);
  assert.match(q1a, /END \$wave5_q1a_schema_guard\$;/);
  for (const src of [q0a, q1a]) {
    assert.equal(
      src.includes("$$CHECK ((cutover_kind = 'WAVE5_CLUB_TENANT'::text))$$"),
      true
    );
    assert.equal(
      src.includes(
        "$$CHECK ((state = ANY (ARRAY['PREPARED'::text, 'QUIESCED'::text, 'DRAINED'::text, 'APPLYING'::text, 'APPLIED'::text, 'VERIFIED'::text, 'RESTORED'::text, 'ABORTED'::text])))$$"
      ),
      true
    );
    assert.equal(
      src.includes(
        "$$(state <> ALL (ARRAY['RESTORED'::text, 'ABORTED'::text]))$$"
      ),
      true
    );
  }
});
