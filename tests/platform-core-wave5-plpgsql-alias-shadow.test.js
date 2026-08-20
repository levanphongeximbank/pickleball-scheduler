/**
 * Wave5 PL/pgSQL record vs SQL alias shadow regression tests.
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
} from "./helpers/wave5-sql-dollar-quote-audit.js";

function uncommented(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

/**
 * Find DO blocks that DECLARE `r record` and also use SQL alias
 * `pg_roles r` / `pg_catalog.pg_roles r` with r.<col> references.
 */
export function findRecordRRolesAliasCollisions(sql) {
  const src = uncommented(sql);
  const findings = [];
  const doRe = /DO\s+(\$[A-Za-z0-9_]*\$)/gi;
  let m;
  while ((m = doRe.exec(src))) {
    const tag = m[1];
    const start = m.index;
    const endTag = src.indexOf(tag + ";", start + m[0].length);
    if (endTag < 0) continue;
    const block = src.slice(start, endTag + tag.length + 1);
    doRe.lastIndex = endTag + tag.length + 1;

    const declaresR = /\br\s+record\s*;/i.test(block);
    if (!declaresR) continue;

    const rolesAlias =
      /\b(?:LEFT\s+)?JOIN\s+pg_catalog\.pg_roles\s+r\b|\b(?:LEFT\s+)?JOIN\s+pg_roles\s+r\b|\bFROM\s+pg_catalog\.pg_roles\s+r\b|\bFROM\s+pg_roles\s+r\b/i.test(
        block
      );
    if (!rolesAlias) continue;

    const refs = [];
    for (const rm of block.matchAll(/\br\.(oid|rolname)\b/gi)) {
      refs.push(rm[0]);
    }
    if (refs.length) {
      findings.push({
        tag,
        refs: [...new Set(refs)],
        snippet: block.slice(0, 120),
      });
    }
  }
  return findings;
}

test("07A Q1A block no longer joins pg_roles as alias r while declaring r record", () => {
  const sql = fs.readFileSync(
    path.join(WAVE5_PACKAGE_DIR, "sql-design/07A_QUIESCE_WRITES_DESIGN.sql"),
    "utf8"
  );
  const body = uncommented(sql);
  assert.match(body, /\br\s+record\s*;/);
  assert.match(body, /FOR\s+r\s+IN/);
  assert.match(body, /LEFT JOIN pg_catalog\.pg_roles role_row ON role_row\.oid = acl\.grantee/);
  assert.match(body, /role_row\.rolname/);
  assert.doesNotMatch(
    body,
    /LEFT JOIN pg_catalog\.pg_roles r ON r\.oid = acl\.grantee/
  );
  assert.deepEqual(findRecordRRolesAliasCollisions(sql), []);
});

test("07C / 07D Q0A-only-safe blocks rename pg_roles alias away from r record", () => {
  for (const rel of [
    "sql-design/07C_RESTORE_WRITES_DESIGN.sql",
    "sql-design/07D_RESTORE_INTENDED_WRITES_DESIGN.sql",
  ]) {
    const sql = fs.readFileSync(path.join(WAVE5_PACKAGE_DIR, rel), "utf8");
    const body = uncommented(sql);
    assert.match(body, /\br\s+record\s*;/, rel);
    assert.match(body, /pg_roles role_row/, rel);
    assert.doesNotMatch(
      body,
      /JOIN pg_catalog\.pg_roles r ON r\.oid/,
      rel
    );
    assert.deepEqual(findRecordRRolesAliasCollisions(sql), [], rel);
  }
});

test("package-wide: no DO block declares r record and aliases pg_roles as r", () => {
  const all = [];
  for (const file of listWave5SqlFiles()) {
    const sql = fs.readFileSync(file, "utf8");
    for (const f of findRecordRRolesAliasCollisions(sql)) {
      all.push({ file: relWave5Sql(file), ...f });
    }
  }
  assert.deepEqual(all, [], JSON.stringify(all, null, 2));
});

test("shadow detector flags the known defective fixture", () => {
  const fixture = `
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT 1 AS sig LOOP
    NULL;
  END LOOP;
  INSERT INTO t(x)
  SELECT r.rolname
  FROM pg_proc p
  LEFT JOIN pg_catalog.pg_roles r ON r.oid = p.proowner;
END $$;
`;
  const bad = findRecordRRolesAliasCollisions(fixture);
  assert.equal(bad.length, 1);
  assert.ok(bad[0].refs.includes("r.rolname") || bad[0].refs.includes("r.oid"));
});

test("07A semantic invariants remain after shadow fix", () => {
  const src = fs.readFileSync(
    path.join(WAVE5_PACKAGE_DIR, "sql-design/07A_QUIESCE_WRITES_DESIGN.sql"),
    "utf8"
  );
  const body = uncommented(src);
  assert.match(src, /CANONICAL_MUTATION_RPC_COUNT=14/);
  assert.match(body, /INSERT INTO public\.wave5_cutover_rpc_privilege_snapshot/);
  assert.match(body, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC/);
  assert.match(body, /REVOKE EXECUTE ON FUNCTION %s FROM anon/);
  assert.match(body, /REVOKE EXECUTE ON FUNCTION %s FROM authenticated/);
  assert.match(body, /REVOKE EXECUTE ON FUNCTION %s FROM service_role/);
  assert.match(body, /UNKNOWN_MUTATION_RPC_OVERLOAD/);
  assert.match(body, /club_leave_my_membership/);
  assert.match(body, /AS t\(sig, is_canonical\)/);
});
