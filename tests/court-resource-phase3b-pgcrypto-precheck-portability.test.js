import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = path.join(
  root,
  "docs/v5/migrations/court-resource-phase3b-canonical-reservation-01"
);
const ASSIGN_BASELINE =
  "4c751a97d8e8ee8fc658d3b7647fc2d84b870b042f1f0211b23ba1632aa369e5";
const CHANGE_BASELINE =
  "d1b043a29dbee4d6e1d553ac5227052a645c115ded8f07d7cd1034ddb4a8cf59";

function readPkg(name) {
  return readFileSync(path.join(pkg, name), "utf8");
}

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

/**
 * Mirrors PRECHECK pgcrypto + fingerprint fail-closed gates.
 * Catalog rows are the PostgreSQL authority the SQL queries.
 */
function precheckPgcryptoGate({ extensions = [], procedures = [], fingerprints }) {
  const ext = extensions.find((row) => row.extname === "pgcrypto");
  if (!ext || !ext.nspname || String(ext.nspname).trim() === "") {
    return { code: "PGCRYPTO_EXTENSION_MISSING" };
  }
  const digest = procedures.find(
    (row) =>
      row.schema === ext.nspname
      && row.proname === "digest"
      && row.identityArgs === "bytea,text"
  );
  if (!digest) {
    return { code: "PGCRYPTO_DIGEST_MISSING", schema: ext.nspname };
  }
  const digestCall = `SELECT encode(${quoteIdent(ext.nspname)}.digest($1,$2), 'hex')`;
  if (
    fingerprints.assign !== ASSIGN_BASELINE
    || fingerprints.change !== CHANGE_BASELINE
  ) {
    return {
      code: "PREEXISTING_ROUTINE_DRIFT",
      schema: ext.nspname,
      digestCall,
    };
  }
  return {
    code: "PRECHECK_OK",
    schema: ext.nspname,
    digestCall,
    pgCryptoPresent: "YES",
  };
}

function publicDigestHardcodes(sql) {
  const matches = sql.match(/public\.digest|to_regprocedure\(\s*'public\.digest/gi);
  return matches ? matches.length : 0;
}

test("PRECHECK discovers pgcrypto via pg_extension.extnamespace and schema-qualifies digest", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  assert.match(
    precheck,
    /FROM pg_catalog\.pg_extension e\s+JOIN pg_catalog\.pg_namespace n\s+ON n\.oid = e\.extnamespace\s+WHERE e\.extname = 'pgcrypto'/
  );
  assert.match(precheck, /DIGEST_SCHEMA_DISCOVERY=PG_EXTENSION_EXTNAMESPACE/);
  assert.match(precheck, /PGCRYPTO_EXTENSION_PRESENT=YES/);
  assert.match(precheck, /format\('%I\.digest\(bytea,text\)'/);
  assert.match(precheck, /%I\.digest\(\$1,\$2\)/);
  assert.match(precheck, /EXECUTE v_digest_sql/);
  assert.doesNotMatch(precheck, /SET search_path/);
  assert.equal(publicDigestHardcodes(precheck), 0);
  assert.doesNotMatch(precheck, /to_regprocedure\('public\.digest\(bytea,text\)'\)/);
  assert.doesNotMatch(precheck, /to_regprocedure\('extensions\.digest\(bytea,text\)'\)/);
});

test("CASE A: pgcrypto schema = extensions", () => {
  const result = precheckPgcryptoGate({
    extensions: [{ extname: "pgcrypto", nspname: "extensions" }],
    procedures: [
      { schema: "extensions", proname: "digest", identityArgs: "bytea,text" },
    ],
    fingerprints: { assign: ASSIGN_BASELINE, change: CHANGE_BASELINE },
  });
  assert.equal(result.code, "PRECHECK_OK");
  assert.equal(result.schema, "extensions");
  assert.equal(
    result.digestCall,
    'SELECT encode("extensions".digest($1,$2), \'hex\')'
  );
  assert.doesNotMatch(result.digestCall, /public\.digest/);
});

test("CASE B: pgcrypto schema = public", () => {
  const result = precheckPgcryptoGate({
    extensions: [{ extname: "pgcrypto", nspname: "public" }],
    procedures: [
      { schema: "public", proname: "digest", identityArgs: "bytea,text" },
    ],
    fingerprints: { assign: ASSIGN_BASELINE, change: CHANGE_BASELINE },
  });
  assert.equal(result.code, "PRECHECK_OK");
  assert.equal(result.schema, "public");
  assert.equal(
    result.digestCall,
    'SELECT encode("public".digest($1,$2), \'hex\')'
  );
});

test("CASE C: pgcrypto absent fails closed", () => {
  const result = precheckPgcryptoGate({
    extensions: [],
    procedures: [],
    fingerprints: { assign: ASSIGN_BASELINE, change: CHANGE_BASELINE },
  });
  assert.equal(result.code, "PGCRYPTO_EXTENSION_MISSING");
  const precheck = readPkg("01_PRECHECK.sql");
  assert.match(precheck, /PGCRYPTO_EXTENSION_MISSING/);
  assert.match(precheck, /pgcrypto is not installed/);
});

test("CASE D: pgcrypto present but digest(bytea,text) absent fails closed", () => {
  const result = precheckPgcryptoGate({
    extensions: [{ extname: "pgcrypto", nspname: "extensions" }],
    procedures: [
      { schema: "extensions", proname: "digest", identityArgs: "text,text" },
    ],
    fingerprints: { assign: ASSIGN_BASELINE, change: CHANGE_BASELINE },
  });
  assert.equal(result.code, "PGCRYPTO_DIGEST_MISSING");
  const precheck = readPkg("01_PRECHECK.sql");
  assert.match(precheck, /PGCRYPTO_DIGEST_MISSING/);
  assert.match(precheck, /digest\(bytea,text\) absent in schema/);
});

test("CASE E: digest exists but Daily Play fingerprint differs", () => {
  const result = precheckPgcryptoGate({
    extensions: [{ extname: "pgcrypto", nspname: "extensions" }],
    procedures: [
      { schema: "extensions", proname: "digest", identityArgs: "bytea,text" },
    ],
    fingerprints: {
      assign: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      change: CHANGE_BASELINE,
    },
  });
  assert.equal(result.code, "PREEXISTING_ROUTINE_DRIFT");
  const precheck = readPkg("01_PRECHECK.sql");
  assert.match(precheck, /PREEXISTING_ROUTINE_DRIFT daily_play_assign_court fingerprint=/);
  assert.match(precheck, /PREEXISTING_ROUTINE_DRIFT daily_play_change_court fingerprint=/);
  assert.match(precheck, new RegExp(ASSIGN_BASELINE));
  assert.match(precheck, new RegExp(CHANGE_BASELINE));
});

test("Daily Play baseline lock is preserved in PRECHECK", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  const assignExpected = precheck.match(
    /v_assign_expected text := '([0-9a-f]{64})'/
  );
  const changeExpected = precheck.match(
    /v_change_expected text := '([0-9a-f]{64})'/
  );
  assert.equal(assignExpected[1], ASSIGN_BASELINE);
  assert.equal(changeExpected[1], CHANGE_BASELINE);
  assert.match(
    precheck,
    /SELECT 'DAILY_PLAY_ASSIGN_FINGERPRINT' AS check_item,\s+'4c751a97d8e8ee8fc658d3b7647fc2d84b870b042f1f0211b23ba1632aa369e5' AS expected/
  );
  assert.match(
    precheck,
    /SELECT 'DAILY_PLAY_CHANGE_FINGERPRINT' AS check_item,\s+'d1b043a29dbee4d6e1d553ac5227052a645c115ded8f07d7cd1034ddb4a8cf59' AS expected/
  );
});

test("Phase 3B SQL package has zero public.digest hardcodes in executable PRECHECK", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  const apply = readPkg("02_APPLY.sql");
  const verify = readPkg("03_VERIFY.sql");
  const rollback = readPkg("04_ROLLBACK.sql");
  assert.equal(publicDigestHardcodes(precheck), 0);
  assert.equal(publicDigestHardcodes(apply), 0);
  assert.equal(publicDigestHardcodes(verify), 0);
  assert.equal(publicDigestHardcodes(rollback), 0);
});

function extractFunction(sql, name) {
  const needles = [
    `CREATE OR REPLACE FUNCTION public.${name}(`,
    `CREATE FUNCTION public.${name}(`,
  ];
  let start = -1;
  for (const needle of needles) {
    start = sql.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) return "";
  const rest = sql.slice(start);
  const tagMatch = rest.match(/AS\s+(\$[A-Za-z0-9_]*\$)/);
  if (!tagMatch) return "";
  const tag = tagMatch[1];
  const first = rest.indexOf(tag);
  const second = rest.indexOf(tag, first + tag.length);
  let end = second + tag.length;
  if (rest[end] === ";") end += 1;
  return rest.slice(0, end);
}

function unqualifiedDigestCalls(sql) {
  return [...sql.matchAll(/(^|[^A-Za-z0-9_.])digest\s*\(/g)];
}

function runtimeDigestSha256Gate({ extensions = [], procedures = [] }) {
  const ext = extensions.find((row) => row.extname === "pgcrypto");
  if (!ext || !ext.nspname || String(ext.nspname).trim() === "") {
    return { code: "PGCRYPTO_EXTENSION_MISSING" };
  }
  const digest = procedures.find(
    (row) =>
      row.schema === ext.nspname
      && row.proname === "digest"
      && row.identityArgs === "bytea,text"
  );
  if (!digest) {
    return { code: "PGCRYPTO_DIGEST_MISSING", schema: ext.nspname };
  }
  return {
    code: "OK",
    schema: ext.nspname,
    digestCall: `SELECT ${quoteIdent(ext.nspname)}.digest($1, 'sha256')`,
    searchPathDependent: false,
    identifierSource: "CATALOG_ONLY",
  };
}

test("APPLY runtime digest helper discovers pgcrypto via pg_extension.extnamespace", () => {
  const apply = readPkg("02_APPLY.sql");
  const helper = extractFunction(apply, "court_resource_digest_sha256");
  assert.match(helper, /CREATE FUNCTION public\.court_resource_digest_sha256\(p_payload bytea\)/);
  assert.match(helper, /SECURITY DEFINER/);
  assert.match(helper, /SET search_path = pg_catalog, public/);
  assert.doesNotMatch(helper, /search_path = [^;]*extensions/);
  assert.match(
    helper,
    /FROM pg_catalog\.pg_extension e\s+JOIN pg_catalog\.pg_namespace n\s+ON n\.oid = e\.extnamespace\s+WHERE e\.extname = 'pgcrypto'/
  );
  assert.match(helper, /format\('%I\.digest\(bytea,text\)'/);
  assert.match(helper, /SELECT %I\.digest\(\$1, %L\)/);
  assert.match(helper, /EXECUTE format\(/);
  assert.match(helper, /PGCRYPTO_EXTENSION_MISSING/);
  assert.match(helper, /PGCRYPTO_DIGEST_MISSING/);
  assert.doesNotMatch(helper, /public\.digest/);
  assert.doesNotMatch(helper, /extensions\.digest/);
  assert.equal(unqualifiedDigestCalls(helper).length, 0);
});

test("reserve and release fingerprints both use court_resource_digest_sha256", () => {
  const apply = readPkg("02_APPLY.sql");
  const fingerprint = extractFunction(apply, "court_resource_reservation_payload_fingerprint");
  const reserve = extractFunction(apply, "court_resource_reserve");
  const release = extractFunction(apply, "court_resource_release");
  assert.match(fingerprint, /public\.court_resource_digest_sha256\(/);
  assert.match(reserve, /court_resource_reservation_payload_fingerprint/);
  assert.match(release, /public\.court_resource_digest_sha256\(/);
  assert.equal(unqualifiedDigestCalls(fingerprint).length, 0);
  assert.equal(unqualifiedDigestCalls(reserve).length, 0);
  assert.equal(unqualifiedDigestCalls(release).length, 0);
  assert.doesNotMatch(fingerprint, /IMMUTABLE/);
});

test("PGCRYPTO_RUNTIME_UNSAFE_OCCURRENCES_AFTER is zero across APPLY function bodies", () => {
  const apply = readPkg("02_APPLY.sql");
  const names = [
    "court_resource_digest_sha256",
    "court_resource_reservation_payload_fingerprint",
    "court_resource_reserve",
    "court_resource_release",
    "court_resource_reserve_core",
    "court_resource_get_availability",
    "daily_play_assign_court",
    "daily_play_change_court",
    "daily_play_submit_score",
    "daily_play_cancel_match",
    "daily_play_close_session",
  ];
  let unsafe = 0;
  for (const name of names) {
    const body = extractFunction(apply, name);
    assert.notEqual(body, "", name);
    unsafe += unqualifiedDigestCalls(body).length;
  }
  assert.equal(unsafe, 0);
  assert.equal(unqualifiedDigestCalls(apply).length, 0);
});

test("RUNTIME digest gate CASE A extensions schema is schema-qualified", () => {
  const result = runtimeDigestSha256Gate({
    extensions: [{ extname: "pgcrypto", nspname: "extensions" }],
    procedures: [
      { schema: "extensions", proname: "digest", identityArgs: "bytea,text" },
    ],
  });
  assert.equal(result.code, "OK");
  assert.equal(result.schema, "extensions");
  assert.equal(result.searchPathDependent, false);
  assert.equal(result.identifierSource, "CATALOG_ONLY");
  assert.equal(result.digestCall, 'SELECT "extensions".digest($1, \'sha256\')');
  assert.doesNotMatch(result.digestCall, /public\.digest/);
});

test("RUNTIME digest gate CASE B public schema is schema-qualified", () => {
  const result = runtimeDigestSha256Gate({
    extensions: [{ extname: "pgcrypto", nspname: "public" }],
    procedures: [
      { schema: "public", proname: "digest", identityArgs: "bytea,text" },
    ],
  });
  assert.equal(result.code, "OK");
  assert.equal(result.schema, "public");
  assert.equal(result.digestCall, 'SELECT "public".digest($1, \'sha256\')');
});

test("RUNTIME digest gate CASE C pgcrypto absent fails closed", () => {
  const result = runtimeDigestSha256Gate({ extensions: [], procedures: [] });
  assert.equal(result.code, "PGCRYPTO_EXTENSION_MISSING");
  const helper = extractFunction(readPkg("02_APPLY.sql"), "court_resource_digest_sha256");
  assert.match(helper, /PGCRYPTO_EXTENSION_MISSING pgcrypto is not installed/);
});

test("RUNTIME digest gate CASE D digest signature absent fails closed", () => {
  const result = runtimeDigestSha256Gate({
    extensions: [{ extname: "pgcrypto", nspname: "extensions" }],
    procedures: [
      { schema: "extensions", proname: "digest", identityArgs: "text,text" },
    ],
  });
  assert.equal(result.code, "PGCRYPTO_DIGEST_MISSING");
  const helper = extractFunction(readPkg("02_APPLY.sql"), "court_resource_digest_sha256");
  assert.match(helper, /PGCRYPTO_DIGEST_MISSING digest bytea,text absent in schema/);
});

test("HARDENED search_path does not include extensions and still schema-qualifies digest", () => {
  const helper = extractFunction(readPkg("02_APPLY.sql"), "court_resource_digest_sha256");
  assert.match(helper, /SET search_path = pg_catalog, public/);
  assert.doesNotMatch(helper, /SET search_path = [^$]*extensions/);
  const result = runtimeDigestSha256Gate({
    extensions: [{ extname: "pgcrypto", nspname: "extensions" }],
    procedures: [
      { schema: "extensions", proname: "digest", identityArgs: "bytea,text" },
    ],
  });
  assert.equal(result.code, "OK");
  assert.match(result.digestCall, /"extensions"\.digest/);
});

test("VERIFY detects runtime pgcrypto schema defect and requires digest helper", () => {
  const verify = readPkg("03_VERIFY.sql");
  assert.match(verify, /READ ONLY/);
  assert.doesNotMatch(verify, /\bINSERT INTO\b|\bUPDATE\s+public\.|\bDELETE FROM\b/i);
  assert.match(verify, /court_resource_digest_sha256\(bytea\)/);
  assert.match(verify, /digest helper security boundary differs from APPLY/);
  assert.match(verify, /digest helper is not fail closed/);
  assert.match(verify, /digest helper is not catalog-schema-qualified/);
  assert.match(verify, /pg_catalog\.pg_extension/);
  assert.match(verify, /extnamespace/);
  assert.match(verify, /position\('%I\.digest\(\$1, %L\)' in v_digest_def\) = 0/);
  assert.match(verify, /\(\^\|\[\^A-Za-z0-9_\.\]\)digest\[\[:space:\]\]\*\\\(/);
  assert.match(verify, /unqualified digest remains in installed package functions/);
  assert.match(verify, /NOT ILIKE '%extensions%'/);
});

test("ROLLBACK drops digest helper and does not mutate pgcrypto extension", () => {
  const rollback = readPkg("04_ROLLBACK.sql");
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.court_resource_digest_sha256\(bytea\)/);
  assert.doesNotMatch(rollback, /DROP EXTENSION/);
  assert.doesNotMatch(rollback, /ALTER EXTENSION/);
  assert.doesNotMatch(rollback, /ALTER SCHEMA/);
  const names = [
    "daily_play_assign_court",
    "daily_play_submit_score",
    "daily_play_cancel_match",
    "daily_play_change_court",
    "daily_play_close_session",
  ];
  for (const name of names) {
    assert.match(rollback, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`));
  }
});
