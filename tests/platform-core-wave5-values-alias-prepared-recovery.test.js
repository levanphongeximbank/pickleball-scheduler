/**
 * Wave5 VALUES-alias + PREPARED recovery static regression tests.
 * Local/static only. Does not connect to any database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  WAVE5_PACKAGE_DIR,
  listWave5SqlFiles,
  relWave5Sql,
  auditWave5Package,
} from "./helpers/wave5-sql-dollar-quote-audit.js";

const PG_TYPE_TOKEN =
  /^(text|boolean|bool|integer|int|int2|int4|int8|bigint|smallint|uuid|jsonb|json|timestamptz|timestamp|numeric|decimal|real|double|oid|regprocedure|regclass|regtype|bytea|name|anyarray|anyelement|void|record)(\[\])?$/i;

function readSql(rel) {
  return fs.readFileSync(path.join(WAVE5_PACKAGE_DIR, rel), "utf8");
}

function uncommented(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

/**
 * Find ordinary VALUES/subquery alias lists that illegally embed SQL types.
 * Skips RETURNS TABLE(...) column-definition lists (typed defs are legal there).
 */
export function findInvalidTypedValuesAliases(sql) {
  const src = uncommented(sql);
  const findings = [];
  const re = /(?:RETURNS\s+TABLE\s*\([^;]*?\))|(\)\s*AS\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\))/gi;
  let m;
  while ((m = re.exec(src))) {
    if (!m[1]) continue; // RETURNS TABLE match
    const aliasName = m[2];
    const colsRaw = m[3];
    const cols = colsRaw.split(",").map((c) => c.trim()).filter(Boolean);
    const typed = [];
    for (const col of cols) {
      const parts = col.split(/\s+/).filter(Boolean);
      if (parts.length >= 2 && PG_TYPE_TOKEN.test(parts[1])) {
        typed.push(col);
      } else if (parts.length >= 2 && /\[\]$/.test(parts[1])) {
        typed.push(col);
      }
    }
    if (typed.length) {
      findings.push({
        aliasName,
        expression: `AS ${aliasName}(${colsRaw.trim()})`,
        typedColumns: typed,
        index: m.index,
      });
    }
  }
  return findings;
}

test("Wave5 package has exactly 21 SQL files", () => {
  const files = listWave5SqlFiles();
  assert.equal(files.length, 21);
});

test("VALUES alias regression: 07A / 02_APPLY / 03_VERIFY have no typed VALUES aliases", () => {
  for (const rel of [
    "sql-design/07A_QUIESCE_WRITES_DESIGN.sql",
    "sql-design/02_APPLY_DESIGN.sql",
    "sql-design/03_VERIFY.sql",
  ]) {
    const bad = findInvalidTypedValuesAliases(readSql(rel));
    assert.deepEqual(bad, [], `${rel} still has typed VALUES aliases: ${JSON.stringify(bad)}`);
  }
});

test("VALUES alias regression: package-wide ordinary VALUES/subquery aliases are untyped", () => {
  const allBad = [];
  for (const file of listWave5SqlFiles()) {
    const rel = relWave5Sql(file);
    const bad = findInvalidTypedValuesAliases(fs.readFileSync(file, "utf8"));
    for (const b of bad) allBad.push({ file: rel, ...b });
  }
  assert.deepEqual(allBad, [], JSON.stringify(allBad, null, 2));
});

test("VALUES alias regression: known fixed alias shapes are names-only", () => {
  const q1a = uncommented(readSql("sql-design/07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(q1a, /\)\s+AS\s+t\(sig,\s*is_canonical\)/);
  assert.match(q1a, /\)\s+AS\s+t\(sig\)/);
  assert.doesNotMatch(q1a, /AS\s+t\(sig\s+text/);
  assert.doesNotMatch(q1a, /is_canonical\s+boolean/);

  const apply = uncommented(readSql("sql-design/02_APPLY_DESIGN.sql"));
  assert.match(
    apply,
    /\)\s+AS\s+t\(sig,\s*fname,\s*markers,\s*lang,\s*predecessor_fps,\s*certified_owner,\s*certified_volatile,\s*predecessor_gate\)/
  );
  assert.match(apply, /\)\s+AS\s+t\(sig,\s*fname,\s*target_fp\)/);
  assert.doesNotMatch(apply, /AS\s+t\(sig\s+text,/);

  const verify = uncommented(readSql("sql-design/03_VERIFY.sql"));
  assert.match(verify, /\)\s+AS\s+t\(sig,\s*target_fp\)/);
  assert.doesNotMatch(verify, /AS\s+t\(sig\s+text,/);
});

test("VALUES alias detector still flags the known defective fixture shape", () => {
  const fixture = `
    FOR r IN
      SELECT * FROM (
        VALUES ('public.club_create(uuid,text,text,text,text,text)'::text, true)
      ) AS t(sig text, is_canonical boolean)
    LOOP
      NULL;
    END LOOP;
  `;
  const bad = findInvalidTypedValuesAliases(fixture);
  assert.equal(bad.length, 1);
  assert.match(bad[0].expression, /sig text/);
});

test("VALUES alias detector does not flag RETURNS TABLE typed column definitions", () => {
  const fixture = `
    CREATE FUNCTION public.demo()
    RETURNS TABLE(sig text, is_canonical boolean)
    LANGUAGE sql AS $$ SELECT 'x'::text, true $$;
  `;
  const bad = findInvalidTypedValuesAliases(fixture);
  assert.deepEqual(bad, []);
});

test("PREPARED recovery: 07C documents and supports Q0A-only PREPARED", () => {
  const src = readSql("sql-design/07C_RESTORE_WRITES_DESIGN.sql");
  const body = uncommented(src);
  assert.match(src, /Q0A_ONLY_PREPARED_RESTORE=SUPPORTED/);
  assert.match(src, /Q1A_COMMITTED_PRE_APPLY_RESTORE=SUPPORTED/);
  assert.match(body, /v_q0a_only/);
  assert.match(body, /WAVE5_RESTORE_Q0A_ONLY_PREPARED/);
  assert.match(body, /to_regclass\('public\.wave5_cutover_rpc_privilege_snapshot'\)/);
  assert.match(body, /RPC_GRANT_REPLAY=DENIED/);
});

test("PREPARED recovery: QUIESCED/DRAINED without RPC snapshot fail closed", () => {
  const body = uncommented(readSql("sql-design/07C_RESTORE_WRITES_DESIGN.sql"));
  assert.match(body, /v_state IN \('QUIESCED', 'DRAINED'\)/);
  assert.match(body, /requires Q1A RPC privilege snapshot EXECUTE rows/);
});

test("PREPARED recovery: ambiguous non-EXECUTE RPC snapshot rows fail closed", () => {
  const body = uncommented(readSql("sql-design/07C_RESTORE_WRITES_DESIGN.sql"));
  assert.match(body, /ambiguous RPC snapshot/);
  assert.match(body, /execute_rows=0/);
});

test("PREPARED recovery: post-APPLY legacy restore still denied", () => {
  const src = readSql("sql-design/07C_RESTORE_WRITES_DESIGN.sql");
  const body = uncommented(src);
  assert.match(src, /POST_APPLY_LEGACY_ACL_RESTORE=DENIED/);
  assert.match(body, /v_state IN \('APPLIED', 'VERIFIED'\)/);
  assert.match(body, /state IN \('PREPARED', 'QUIESCED', 'DRAINED'\)/);
});

test("PREPARED recovery: explicit batch id required; no latest-batch implicit restore", () => {
  const src = readSql("sql-design/07C_RESTORE_WRITES_DESIGN.sql");
  const body = uncommented(src);
  assert.match(src, /RESTORE_REQUIRES_EXPLICIT_BATCH_ID=YES/);
  assert.match(src, /LATEST_SNAPSHOT_IMPLICIT_RESTORE=DENIED/);
  assert.match(body, /wave5\.restore_batch_id/);
  assert.doesNotMatch(body, /ORDER BY[\s\S]*captured_at[\s\S]*DESC[\s\S]*LIMIT 1/);
  assert.doesNotMatch(src, /e4c5d39b-8e81-4719-a6c2-a9020efcce64/);
});

test("PREPARED recovery: exact table DML snapshot restore; no generic GRANT fallback", () => {
  const src = readSql("sql-design/07C_RESTORE_WRITES_DESIGN.sql");
  const body = uncommented(src);
  assert.match(src, /RESTORE_FINAL_TABLE_DML_EQUALS_SNAPSHOT=YES/);
  assert.match(body, /wave5_cutover_table_privilege_snapshot/);
  assert.match(body, /GRANT %s ON TABLE %I\.%I TO %I/);
  assert.doesNotMatch(body, /GRANT\s+ALL\s+ON\s+TABLE\s+public\.clubs\s+TO\s+service_role/i);
  assert.doesNotMatch(body, /GRANT\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS/i);
  assert.doesNotMatch(body, /ALTER\s+DEFAULT\s+PRIVILEGES/i);
  assert.doesNotMatch(body, /GRANT\s+EXECUTE[\s\S]{0,40}TO\s+authenticated(?!\s)/i);
});

test("PREPARED recovery: RPC snapshot replay only on non-Q0A-only path", () => {
  const body = uncommented(readSql("sql-design/07C_RESTORE_WRITES_DESIGN.sql"));
  assert.match(body, /IF v_q0a_only THEN/);
  assert.match(body, /ELSE/);
  assert.match(body, /GRANT EXECUTE ON FUNCTION %s TO/);
  assert.match(body, /RESTORE_FINAL_ACL_EQUALS_SNAPSHOT=NO/);
  assert.match(body, /state = 'ABORTED'/);
});

test("Q0A does not create RPC privilege snapshot rows; Q1A does", () => {
  const q0a = uncommented(readSql("sql-design/10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql"));
  const q1a = uncommented(readSql("sql-design/07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.doesNotMatch(q0a, /INSERT\s+INTO\s+public\.wave5_cutover_rpc_privilege_snapshot/i);
  assert.match(q0a, /INSERT\s+INTO\s+public\.wave5_cutover_table_privilege_snapshot/i);
  assert.match(q1a, /INSERT\s+INTO\s+public\.wave5_cutover_rpc_privilege_snapshot/i);
});

test("Prior remediations preserved: dollar-quote + indkey[0]", () => {
  const reports = auditWave5Package();
  const bad = reports.filter((r) => r.parseRisk !== "NONE");
  assert.deepEqual(bad, []);
  const q0a = uncommented(readSql("sql-design/10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql"));
  const q1a = uncommented(readSql("sql-design/07A_QUIESCE_WRITES_DESIGN.sql"));
  assert.match(readSql("sql-design/10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql"), /\$wave5_q0_schema_guard\$/);
  assert.match(readSql("sql-design/07A_QUIESCE_WRITES_DESIGN.sql"), /\$wave5_q1a_schema_guard\$/);
  assert.match(q0a, /i\.indkey\[0\]/);
  assert.match(q1a, /i\.indkey\[0\]/);
  assert.doesNotMatch(q0a, /indkey\[1\]/);
  assert.doesNotMatch(q1a, /indkey\[1\]/);
});
