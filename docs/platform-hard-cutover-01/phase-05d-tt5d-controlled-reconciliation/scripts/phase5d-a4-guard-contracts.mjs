/**
 * Phase 5D-A.4 / A.5 — typed catalog guard contracts (registry + sql/00 shadow + transport batches).
 * Repository-only. No database.
 */
import crypto from "node:crypto";

const PRIV_LETTER = {
  a: "INSERT",
  r: "SELECT",
  w: "UPDATE",
  d: "DELETE",
  D: "TRUNCATE",
  x: "REFERENCES",
  t: "TRIGGER",
  X: "EXECUTE",
  m: "MAINTAIN",
  U: "USAGE",
  C: "CREATE",
};

export function sqlStr(s) {
  if (s == null) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

/**
 * Authoritative PostgreSQL JSONB literal for serialized JS values.
 * Emits a single-quoted SQL string (apostrophes doubled) cast to jsonb.
 * Never emit bare {...}::jsonb / [...]::jsonb from JSON.stringify.
 */
export function renderJsonbLiteral(value) {
  return `${sqlStr(JSON.stringify(value))}::jsonb`;
}

/** WS_COLLAPSE_V1 — collapse POSIX whitespace runs to one space, then trim. */
export function sqlWsCollapseV1(exprSql) {
  return `btrim(regexp_replace((${exprSql})::text, '[[:space:]]+', ' ', 'g'))`;
}

export function asProconfigElements(pc) {
  if (Array.isArray(pc)) return pc;
  throw new Error(
    `proconfig must be a JSON array of exact text[] elements (got ${typeof pc}: ${JSON.stringify(pc)})`,
  );
}

export function sqlTextArrayLiteral(elements) {
  const arr = asProconfigElements(elements);
  if (arr.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${arr.map((e) => sqlStr(e)).join(", ")}]::text[]`;
}

export function sqlProconfigMismatch(procOidExpr, expectedElements) {
  return `coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=${procOidExpr}), ARRAY[]::text[]) IS DISTINCT FROM ${sqlTextArrayLiteral(expectedElements)}`;
}

export function wsCollapseJs(s) {
  return String(s).replace(/[\s]+/g, " ").trim();
}

/** Canonical ACL rows for order-insensitive equality (ACL_EXPLODED_SET_V1). */
export function canonicalizeAclRows(rows) {
  return [...rows]
    .map((r) => ({
      grantee: r.grantee,
      privilege_type: r.privilege_type,
      grantor: r.grantor,
      is_grantable: Boolean(r.is_grantable),
    }))
    .sort((a, b) =>
      `${a.grantee}|${a.privilege_type}|${a.grantor}|${a.is_grantable}`.localeCompare(
        `${b.grantee}|${b.privilege_type}|${b.grantor}|${b.is_grantable}`,
      ),
    );
}

export function aclSetsEqual(a, b) {
  return JSON.stringify(canonicalizeAclRows(a)) === JSON.stringify(canonicalizeAclRows(b));
}

/**
 * Parse PostgreSQL ACL display text into exploded privilege rows.
 * @param {string} aclText e.g. `{postgres=X/postgres,authenticated=arwdDxtm/postgres}`
 */
export function parseAclText(aclText) {
  const text = String(aclText ?? "").trim();
  if (!text || text === "{}" || text === "null") return [];
  const inner = text.replace(/^\{|\}$/g, "");
  if (!inner) return [];
  const rows = [];
  for (const entry of inner.split(",")) {
    const slash = entry.lastIndexOf("/");
    if (slash < 0) continue;
    const grantor = entry.slice(slash + 1);
    const left = entry.slice(0, slash);
    const eq = left.indexOf("=");
    if (eq < 0) continue;
    let grantee = left.slice(0, eq).trim();
    if (grantee === "") grantee = "PUBLIC";
    const privLetters = left.slice(eq + 1);
    for (let i = 0; i < privLetters.length; i++) {
      const letter = privLetters[i];
      if (letter === "*") continue;
      const isGrantable = i + 1 < privLetters.length && privLetters[i + 1] === "*";
      rows.push({
        grantee,
        privilege_type: PRIV_LETTER[letter] ?? letter,
        grantor,
        is_grantable: isGrantable,
      });
      if (isGrantable) i += 1;
    }
  }
  return rows;
}

function sqlAclExpectedValues(expectedAclText) {
  const rows = parseAclText(expectedAclText);
  if (!rows.length) {
    return "SELECT NULL::text AS grantee, NULL::text AS privilege_type, NULL::text AS grantor, NULL::boolean AS is_grantable WHERE false";
  }
  const tuples = rows
    .map(
      (r) =>
        `(${sqlStr(r.grantee)}, ${sqlStr(r.privilege_type)}, ${sqlStr(r.grantor)}, ${r.is_grantable})`,
    )
    .join(",\n      ");
  return `SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES\n      ${tuples}\n    ) AS e(grantee, privilege_type, grantor, is_grantable)`;
}

function sqlAclLiveExploded(aclSourceSql) {
  return `SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode((${aclSourceSql}))`;
}

function sqlAclSetEqual(liveSql, expectedSql) {
  // Parentheses required: EXCEPT/UNION associate left-to-right otherwise.
  return `NOT EXISTS (
    SELECT 1
    FROM (
      ((${liveSql}) EXCEPT (${expectedSql}))
      UNION ALL
      ((${expectedSql}) EXCEPT (${liveSql}))
    ) diff
  )`;
}

/**
 * @param {{ kind: 'relation'|'function', objectSql: string, expectedAclText: string, tableName?: string }} opts
 */
export function sqlAclSetMatch({ kind, objectSql, expectedAclText, tableName }) {
  let aclSourceSql;
  if (kind === "relation") {
    const rel = tableName ?? objectSql;
    aclSourceSql = `(SELECT coalesce(c.relacl, acldefault('r', c.relowner))
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ${sqlStr(rel)})`;
  } else {
    aclSourceSql = `(SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (${objectSql}))`;
  }
  const live = sqlAclLiveExploded(aclSourceSql);
  const expected = sqlAclExpectedValues(expectedAclText);
  return sqlAclSetEqual(live, expected);
}

export function sqlAclDiagnosticText({ kind, objectSql, tableName }) {
  let aclSourceSql;
  if (kind === "relation") {
    const rel = tableName ?? objectSql;
    aclSourceSql = `(SELECT coalesce(c.relacl, acldefault('r', c.relowner))
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ${sqlStr(rel)})`;
  } else {
    aclSourceSql = `(SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (${objectSql}))`;
  }
  return `(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (${sqlAclLiveExploded(aclSourceSql)}) x)`;
}

export function parseIndexCatalogFromDef(def, owner = "postgres") {
  const re =
    /^CREATE (UNIQUE )?INDEX (\S+) ON public\.(\S+) USING (\S+) \(([^)]+)\)(?: WHERE (.+))?$/i;
  const m = String(def).trim().match(re);
  if (!m) throw new Error(`cannot parse index def: ${def}`);
  let predicate = m[6] ?? null;
  if (predicate) {
    predicate = wsCollapseJs(predicate.replace(/^\(|\)$/g, ""));
  }
  return {
    indexName: m[2],
    tableName: m[3],
    amname: m[4].toLowerCase(),
    keyColumns: m[5].split(",").map((s) => s.trim()),
    predicateNormalized: predicate,
    owner,
    unique: Boolean(m[1]),
  };
}

export function sqlIndexCatalogMatch({
  indexName,
  tableName,
  keyColumns,
  predicateNormalized,
  amname = "btree",
  owner = "postgres",
  unique = false,
}) {
  const colsArr = `ARRAY[${keyColumns.map((c) => sqlStr(c)).join(", ")}]::name[]`;
  const predMatch =
    predicateNormalized == null
      ? "idx.indpred IS NULL"
      : `${sqlWsCollapseV1("pg_get_expr(idx.indpred, idx.indrelid, false)")} IS NOT DISTINCT FROM ${sqlWsCollapseV1(sqlStr(predicateNormalized))}`;
  return `EXISTS (
    SELECT 1
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname = 'public'
      AND i.relname = ${sqlStr(indexName)}
      AND t.relname = ${sqlStr(tableName)}
      AND am.amname = ${sqlStr(amname)}
      AND idx.indisunique = ${unique ? "TRUE" : "FALSE"}
      AND pg_get_userbyid(i.relowner) = ${sqlStr(owner)}
      AND (
        SELECT coalesce(array_agg(a.attname ORDER BY k.ord), ARRAY[]::name[])
        FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND k.attnum > 0
      ) = ${colsArr}
      AND ${predMatch}
  )`;
}

export function normalizeConstraintExpr(expr) {
  return wsCollapseJs(String(expr).replace(/^CHECK\s+/i, ""));
}

export function sqlConstraintCatalogMatch({ tableName, constraintName, expectedExprNormalized }) {
  const norm = normalizeConstraintExpr(expectedExprNormalized);
  return `EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = ${sqlStr(tableName)}
      AND c.conname = ${sqlStr(constraintName)}
      AND c.contype = 'c'
      AND c.convalidated IS TRUE
      AND c.condeferrable IS FALSE
      AND c.condeferred IS FALSE
      AND ${sqlWsCollapseV1("pg_get_expr(c.conbin, c.conrelid, false)")} IS NOT DISTINCT FROM ${sqlWsCollapseV1(sqlStr(norm))}
  )`;
}

export function sqlColumnDefaultMatch({
  tableName,
  columnName,
  dataTypeRegtype,
  notNull,
  defaultExprNormalized,
}) {
  const defMatch =
    defaultExprNormalized == null
      ? "ad.adbin IS NULL"
      : `${sqlWsCollapseV1("pg_get_expr(ad.adbin, ad.adrelid, false)")} IS NOT DISTINCT FROM ${sqlWsCollapseV1(sqlStr(defaultExprNormalized))}`;
  return `EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class t ON t.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = t.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND t.relname = ${sqlStr(tableName)}
      AND a.attname = ${sqlStr(columnName)}
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND format_type(a.atttypid, a.atttypmod) = ${sqlStr(dataTypeRegtype)}
      AND a.attnotnull IS ${notNull ? "TRUE" : "FALSE"}
      AND ${defMatch}
  )`;
}

function pushGuard(guards, partial) {
  guards.push({
    guard_order: guards.length + 1,
    diagnosticSql: null,
    ...partial,
  });
}

export function guardRow(g) {
  const actualExpr = g.diagnosticSql
    ? `coalesce(${g.diagnosticSql}, jsonb_build_object('matches', (${g.matchesSql})))`
    : `jsonb_build_object('matches', (${g.matchesSql}))`;
  return `SELECT ${g.guard_order} AS guard_order,
       ${sqlStr(g.guard_id)} AS guard_id,
       ${sqlStr(g.object_class)} AS object_class,
       ${sqlStr(g.object_identity)} AS object_identity,
       ${sqlStr(g.contract_version)} AS contract_version,
       ${renderJsonbLiteral(g.expected_json)} AS expected_json,
       ${actualExpr} AS actual_json,
       (${g.matchesSql}) AS matches_guard`;
}

/** Predicate fingerprint for transport/registry parity (matchesSql + expected_json only). */
export function guardPredicateFingerprint(g) {
  const payload = JSON.stringify({
    guard_id: g.guard_id,
    matchesSql: g.matchesSql,
    expected_json: g.expected_json,
    contract_version: g.contract_version,
  });
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

export function encodedExecuteSqlPayloadBytes(fileText) {
  return Buffer.byteLength(JSON.stringify({ query: fileText }), "utf8");
}

export const TRANSPORT_ENCODED_PAYLOAD_LIMIT = 28000;

/**
 * Single-statement SELECT-only batch shadow for a contiguous guard slice.
 * Includes constant batch_id + manifest_fingerprint columns.
 */
export function shadowPreflightBatchSql(guards, { batchId, manifestFingerprint }) {
  if (!guards.length) throw new Error("shadowPreflightBatchSql requires >=1 guard");
  const rows = guards.map(guardRow).join("\nUNION ALL\n");
  return `-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=${batchId}
-- manifest_fingerprint=${manifestFingerprint}
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

WITH guard_results AS (
${rows}
)
SELECT ${sqlStr(batchId)} AS batch_id,
       ${sqlStr(manifestFingerprint)} AS manifest_fingerprint,
       guard_order,
       guard_id,
       object_class,
       object_identity,
       contract_version,
       expected_json,
       actual_json,
       matches_guard
FROM guard_results
ORDER BY guard_order;
`;
}

/**
 * Partition ordered guards by encoded MCP execute_sql payload size.
 * Never splits a single guard. Stops if one guard alone exceeds the limit.
 */
export function partitionGuardsForTransport(guards, {
  maxEncodedBytes = TRANSPORT_ENCODED_PAYLOAD_LIMIT,
  manifestFingerprint,
  batchIdPrefix = "00_PREFLIGHT_BATCH_",
} = {}) {
  if (!Array.isArray(guards) || guards.length === 0) {
    throw new Error("partitionGuardsForTransport requires non-empty guards");
  }
  const batches = [];
  let current = [];

  const render = (slice, index1) => {
    const batchId = `${batchIdPrefix}${String(index1).padStart(3, "0")}`;
    const sql = shadowPreflightBatchSql(slice, { batchId, manifestFingerprint });
    return { batchId, sql, encodedBytes: encodedExecuteSqlPayloadBytes(sql) };
  };

  for (const g of guards) {
    const alone = render([g], batches.length + 1);
    if (alone.encodedBytes > maxEncodedBytes) {
      throw new Error(
        `PHASE5D_A5_TRANSPORT_PACKAGE_BLOCKED: guard ${g.guard_id} alone encodes to ${alone.encodedBytes} > ${maxEncodedBytes}`,
      );
    }
    const trial = [...current, g];
    const trialRender = render(trial, batches.length + 1);
    if (trialRender.encodedBytes <= maxEncodedBytes) {
      current = trial;
      continue;
    }
    if (current.length === 0) {
      throw new Error(`PHASE5D_A5_TRANSPORT_PACKAGE_BLOCKED: cannot place guard ${g.guard_id}`);
    }
    batches.push(current);
    current = [g];
  }
  if (current.length) batches.push(current);

  return batches.map((slice, i) => {
    const { batchId, sql, encodedBytes } = render(slice, i + 1);
    return {
      batch_id: batchId,
      fileName: `${batchId}.sql`,
      sql,
      encodedBytes,
      rawBytes: Buffer.byteLength(sql, "utf8"),
      first_guard_order: slice[0].guard_order,
      last_guard_order: slice[slice.length - 1].guard_order,
      guard_count: slice.length,
      guard_ids: slice.map((g) => g.guard_id),
      guards: slice,
    };
  });
}

export function buildTransportBatchManifest({
  canonicalSql00,
  canonicalSql00GitBlob,
  canonicalSql00Sha256,
  registryFingerprint,
  preRegistry,
  batches,
  aggregationContract,
}) {
  return {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5D_A5_TRANSPORT_BATCH_MANIFEST",
    nextAuth: "BATCHED_SELECT_ONLY_STAGING_PREFLIGHT_ONLY",
    canonicalSql00: {
      path: "sql/00_TT5D_PRECONDITION_SELECT_ONLY.sql",
      gitBlob: canonicalSql00GitBlob,
      sha256: canonicalSql00Sha256,
      rawBytes: Buffer.byteLength(canonicalSql00, "utf8"),
      byteForByteFrozen: false,
      jsonbLiteralRenderer: "renderJsonbLiteral",
    },
    authoritativeRegistryFingerprint: registryFingerprint,
    totalGuards: preRegistry.length,
    batchCount: batches.length,
    encodedPayloadLimit: TRANSPORT_ENCODED_PAYLOAD_LIMIT,
    aggregationContract,
    batches: batches.map((b) => ({
      batch_id: b.batch_id,
      path: `sql/00_transport/${b.fileName}`,
      contentSha256: crypto.createHash("sha256").update(b.sql, "utf8").digest("hex"),
      gitBlob: null, // filled by writer after git hash-object
      rawByteCount: b.rawBytes,
      encodedExecuteSqlPayloadByteCount: b.encodedBytes,
      first_guard_order: b.first_guard_order,
      last_guard_order: b.last_guard_order,
      guard_count: b.guard_count,
      guard_ids: b.guard_ids,
      predicateFingerprints: b.guards.map((g) => ({
        guard_order: g.guard_order,
        guard_id: g.guard_id,
        fingerprint: guardPredicateFingerprint(g),
      })),
    })),
  };
}

/**
 * Build ordered pre-mutation guard registry mirroring sql/10 $guard$ predicates.
 */
export function buildPreMutationGuardRegistry({
  baseline,
  fnProc,
  parseShort,
  sqlNormalizedUsingEq,
  namesList,
}) {
  const guards = [];
  const ra = baseline.tables.referee_assignments;
  const corr = baseline.tables.team_tournament_referee_correction_requests;
  const raIdx = parseIndexCatalogFromDef(ra.index.def, ra.index.owner);
  const corrIdx = parseIndexCatalogFromDef(corr.index.def, corr.index.owner);
  const statusExpr = normalizeConstraintExpr(ra.statusCheck);
  const selectPol = corr.policies.find((p) => p.name === "tt5d_correction_referee_select");

  pushGuard(guards, {
    guard_id: "provenance.absent",
    object_class: "migration_provenance",
    object_identity: "supabase_migrations.schema_migrations",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { present: false },
    matchesSql: `NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name = 'phase5d_tt5d_controlled_reconciliation' OR version = '20260731150000'
    )`,
  });

  pushGuard(guards, {
    guard_id: "provenance.club_ai_data_absent",
    object_class: "table",
    object_identity: "public.club_ai_data",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { absent: true },
    matchesSql: `to_regclass('public.club_ai_data') IS NULL`,
  });

  pushGuard(guards, {
    guard_id: "table.function_count_13",
    object_class: "function_set",
    object_identity: "public.tt5d_functions",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { count: 13 },
    matchesSql: `(
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN (${namesList})
    ) = 13`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.owner",
    object_class: "table",
    object_identity: "public.referee_assignments",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { owner: "postgres" },
    matchesSql: `(SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres'`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.rls",
    object_class: "table",
    object_identity: "public.referee_assignments",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { relrowsecurity: true },
    matchesSql: `(SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.rls_forced",
    object_class: "table",
    object_identity: "public.referee_assignments",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { relforcerowsecurity: false },
    matchesSql: `(SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.tt5d_columns_count",
    object_class: "table",
    object_identity: "public.referee_assignments",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { tt5d_column_count: 6 },
    matchesSql: `(
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='referee_assignments'
        AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
    ) = 6`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.version_column",
    object_class: "column",
    object_identity: "public.referee_assignments.version",
    contract_version: "COLUMN_DEFAULT_EXPR_V1",
    comparison_class: "NORMALIZED_EXPRESSION",
    expected_json: {
      dataType: "integer",
      notNull: true,
      defaultExprNormalized: "1",
    },
    matchesSql: sqlColumnDefaultMatch({
      tableName: "referee_assignments",
      columnName: "version",
      dataTypeRegtype: "integer",
      notNull: true,
      defaultExprNormalized: "1",
    }),
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.matchup_id_fkey",
    object_class: "foreign_key",
    object_identity: "public.referee_assignments.matchup_id",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: {
      references: "public.team_tournament_matchups(id)",
      onDelete: "SET NULL",
    },
    matchesSql: `EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.sub_match_id_fkey",
    object_class: "foreign_key",
    object_identity: "public.referee_assignments.sub_match_id",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: {
      references: "public.team_tournament_sub_matches(id)",
      onDelete: "SET NULL",
    },
    matchesSql: `EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.status_check",
    object_class: "constraint",
    object_identity: "public.referee_assignments.referee_assignments_status_check",
    contract_version: "CONSTRAINT_CATALOG_V1",
    comparison_class: "NORMALIZED_EXPRESSION",
    expected_json: { exprNormalized: statusExpr },
    matchesSql: sqlConstraintCatalogMatch({
      tableName: "referee_assignments",
      constraintName: "referee_assignments_status_check",
      expectedExprNormalized: statusExpr,
    }),
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.sub_match_index",
    object_class: "index",
    object_identity: `public.${raIdx.indexName}`,
    contract_version: "INDEX_CATALOG_V1",
    comparison_class: "TYPED_COMPARISON",
    expected_json: raIdx,
    matchesSql: sqlIndexCatalogMatch(raIdx),
  });

  pushGuard(guards, {
    guard_id: "table.correction.index",
    object_class: "index",
    object_identity: `public.${corrIdx.indexName}`,
    contract_version: "INDEX_CATALOG_V1",
    comparison_class: "TYPED_COMPARISON",
    expected_json: corrIdx,
    matchesSql: sqlIndexCatalogMatch(corrIdx),
  });

  pushGuard(guards, {
    guard_id: "table.correction.owner",
    object_class: "table",
    object_identity: "public.team_tournament_referee_correction_requests",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { owner: "postgres" },
    matchesSql: `(SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres'`,
  });

  pushGuard(guards, {
    guard_id: "table.correction.acl",
    object_class: "table",
    object_identity: "public.team_tournament_referee_correction_requests",
    contract_version: "ACL_EXPLODED_SET_V1",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { aclExploded: parseAclText(corr.acl) },
    matchesSql: sqlAclSetMatch({
      kind: "relation",
      tableName: "team_tournament_referee_correction_requests",
      expectedAclText: corr.acl,
    }),
    diagnosticSql: sqlAclDiagnosticText({
      kind: "relation",
      tableName: "team_tournament_referee_correction_requests",
    }),
  });

  pushGuard(guards, {
    guard_id: "table.correction.column_count",
    object_class: "table",
    object_identity: "public.team_tournament_referee_correction_requests",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { column_count: 25 },
    matchesSql: `(
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests'
    ) = 25`,
  });

  pushGuard(guards, {
    guard_id: "table.correction.rls",
    object_class: "table",
    object_identity: "public.team_tournament_referee_correction_requests",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { relrowsecurity: true },
    matchesSql: `(SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM TRUE`,
  });

  pushGuard(guards, {
    guard_id: "table.correction.rls_forced",
    object_class: "table",
    object_identity: "public.team_tournament_referee_correction_requests",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { relforcerowsecurity: false },
    matchesSql: `(SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM FALSE`,
  });

  pushGuard(guards, {
    guard_id: "policy.tt5d_correction_referee_select",
    object_class: "policy",
    object_identity: "public.team_tournament_referee_correction_requests.tt5d_correction_referee_select",
    contract_version: "WS_COLLAPSE_V1",
    comparison_class: "NORMALIZED_EXPRESSION",
    expected_json: {
      cmd: "r",
      roles: ["authenticated"],
      usingNormalized: selectPol?.using,
      withCheck: null,
    },
    matchesSql: `EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
        AND pol.polcmd='r'
        AND ${sqlNormalizedUsingEq(selectPol.using)}
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )`,
  });

  pushGuard(guards, {
    guard_id: "policy.tt5d_correction_no_client_write",
    object_class: "policy",
    object_identity: "public.team_tournament_referee_correction_requests.tt5d_correction_no_client_write",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: {
      cmd: "*",
      roles: ["authenticated"],
      using: "false",
      withCheck: "false",
    },
    matchesSql: `EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
        AND pol.polcmd='*'
        AND pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )`,
  });

  for (const f of baseline.functions) {
    const p = fnProc(f);
    const cfg = asProconfigElements(f.proconfig);
    const prefix = `fn.${f.name}`;
    const fnGuards = [
      {
        guard_id: `${prefix}.missing`,
        matchesSql: `${p} IS NOT NULL`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { present: true },
      },
      {
        guard_id: `${prefix}.overload_count`,
        matchesSql: `(
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='${f.name}'
        ) = 1`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { overload_count: 1 },
      },
      {
        guard_id: `${prefix}.def_md5`,
        matchesSql: `md5(pg_get_functiondef(${p})) IS NOT DISTINCT FROM ${sqlStr(f.defMd5)}`,
        contract_version: "INTENTIONAL_EXACT_FINGERPRINT",
        comparison_class: "INTENTIONAL_EXACT_FINGERPRINT",
        expected_json: { defMd5: f.defMd5 },
      },
      {
        guard_id: `${prefix}.volatility`,
        matchesSql: `(
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=${p}
        ) IS NOT DISTINCT FROM ${sqlStr(f.volatility)}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { volatility: f.volatility },
      },
      {
        guard_id: `${prefix}.language`,
        matchesSql: `(
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=${p}
        ) IS NOT DISTINCT FROM ${sqlStr(f.language)}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { language: f.language },
      },
      {
        guard_id: `${prefix}.security_definer`,
        matchesSql: `(SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=${p}) IS NOT DISTINCT FROM ${f.securityDefiner}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { securityDefiner: f.securityDefiner },
      },
      {
        guard_id: `${prefix}.proconfig`,
        matchesSql: `NOT (${sqlProconfigMismatch(p, cfg)})`,
        contract_version: "PROCONFIG_TEXT_ARRAY_V1",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { proconfig: cfg },
      },
      {
        guard_id: `${prefix}.owner`,
        matchesSql: `(SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=${p}) IS NOT DISTINCT FROM ${sqlStr(f.owner)}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { owner: f.owner },
      },
      {
        guard_id: `${prefix}.proacl`,
        matchesSql: sqlAclSetMatch({
          kind: "function",
          objectSql: p,
          expectedAclText: f.acl,
        }),
        contract_version: "ACL_EXPLODED_SET_V1",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { aclExploded: parseAclText(f.acl) },
        diagnosticSql: sqlAclDiagnosticText({ kind: "function", objectSql: p }),
      },
      {
        guard_id: `${prefix}.public_execute`,
        matchesSql: `has_function_privilege('public', ${p}, 'EXECUTE') IS NOT DISTINCT FROM ${f.publicExecute}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { publicExecute: f.publicExecute },
      },
      {
        guard_id: `${prefix}.anon_execute`,
        matchesSql: `has_function_privilege('anon', ${p}, 'EXECUTE') IS NOT DISTINCT FROM ${f.anonExecute}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { anonExecute: f.anonExecute },
      },
      {
        guard_id: `${prefix}.authenticated_execute`,
        matchesSql: `has_function_privilege('authenticated', ${p}, 'EXECUTE') IS NOT DISTINCT FROM ${f.authenticatedExecute}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { authenticatedExecute: f.authenticatedExecute },
      },
      {
        guard_id: `${prefix}.service_role_execute`,
        matchesSql: `has_function_privilege('service_role', ${p}, 'EXECUTE') IS NOT DISTINCT FROM ${f.serviceRoleExecute}`,
        contract_version: "TYPED_COMPARISON",
        comparison_class: "TYPED_COMPARISON",
        expected_json: { serviceRoleExecute: f.serviceRoleExecute },
      },
    ];
    for (const g of fnGuards) {
      pushGuard(guards, {
        object_class: "function",
        object_identity: f.signature,
        ...g,
      });
    }
  }

  return guards;
}

/**
 * Post-apply / rollback-pre guards (post mutation target state).
 */
export function buildPostMutationGuardRegistry({
  baseline,
  fnProc,
  parseShort,
  sqlNormalizedUsingEq,
  namesList,
  postMd5,
  ALLOWLIST,
  expectedPostAcl,
}) {
  const guards = [];
  const ra = baseline.tables.referee_assignments;
  const corr = baseline.tables.team_tournament_referee_correction_requests;
  const raIdx = parseIndexCatalogFromDef(ra.index.def, ra.index.owner);
  const corrIdx = parseIndexCatalogFromDef(corr.index.def, corr.index.owner);
  const statusExpr = normalizeConstraintExpr(ra.statusCheck);
  const selectPol = corr.policies.find((p) => p.name === "tt5d_correction_referee_select");
  const postCorrAcl =
    "{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}";

  pushGuard(guards, {
    guard_id: "table.function_count_13",
    object_class: "function_set",
    object_identity: "public.tt5d_functions",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { count: 13 },
    matchesSql: `(
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN (${namesList})
    ) = 13`,
  });

  // Same table structural guards as pre (indexes/constraints/columns use baseline shapes)
  const tableGuardSpecs = [
    ["table.referee_assignments.owner", "public.referee_assignments", `(SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres'`],
    ["table.referee_assignments.rls", "public.referee_assignments", `(SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE`],
    ["table.referee_assignments.rls_forced", "public.referee_assignments", `(SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE`],
    ["table.referee_assignments.tt5d_columns_count", "public.referee_assignments", `(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='referee_assignments' AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')) = 6`],
    ["table.correction.owner", "public.team_tournament_referee_correction_requests", `(SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres'`],
    ["table.correction.column_count", "public.team_tournament_referee_correction_requests", `(SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests') = 25`],
    ["table.correction.rls", "public.team_tournament_referee_correction_requests", `(SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM TRUE`],
    ["table.correction.rls_forced", "public.team_tournament_referee_correction_requests", `(SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM FALSE`],
  ];
  for (const [guard_id, object_identity, matchesSql] of tableGuardSpecs) {
    pushGuard(guards, {
      guard_id,
      object_class: "table",
      object_identity,
      contract_version: "TYPED_COMPARISON",
      comparison_class: "TYPED_COMPARISON",
      expected_json: {},
      matchesSql,
    });
  }

  pushGuard(guards, {
    guard_id: "table.referee_assignments.version_column",
    object_class: "column",
    object_identity: "public.referee_assignments.version",
    contract_version: "COLUMN_DEFAULT_EXPR_V1",
    comparison_class: "NORMALIZED_EXPRESSION",
    expected_json: { defaultExprNormalized: "1" },
    matchesSql: sqlColumnDefaultMatch({
      tableName: "referee_assignments",
      columnName: "version",
      dataTypeRegtype: "integer",
      notNull: true,
      defaultExprNormalized: "1",
    }),
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.matchup_id_fkey",
    object_class: "foreign_key",
    object_identity: "public.referee_assignments.matchup_id",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: {},
    matchesSql: `EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.sub_match_id_fkey",
    object_class: "foreign_key",
    object_identity: "public.referee_assignments.sub_match_id",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: {},
    matchesSql: `EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )`,
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.status_check",
    object_class: "constraint",
    object_identity: "public.referee_assignments.referee_assignments_status_check",
    contract_version: "CONSTRAINT_CATALOG_V1",
    comparison_class: "NORMALIZED_EXPRESSION",
    expected_json: { exprNormalized: statusExpr },
    matchesSql: sqlConstraintCatalogMatch({
      tableName: "referee_assignments",
      constraintName: "referee_assignments_status_check",
      expectedExprNormalized: statusExpr,
    }),
  });

  pushGuard(guards, {
    guard_id: "table.referee_assignments.sub_match_index",
    object_class: "index",
    object_identity: `public.${raIdx.indexName}`,
    contract_version: "INDEX_CATALOG_V1",
    comparison_class: "TYPED_COMPARISON",
    expected_json: raIdx,
    matchesSql: sqlIndexCatalogMatch(raIdx),
  });

  pushGuard(guards, {
    guard_id: "table.correction.index",
    object_class: "index",
    object_identity: `public.${corrIdx.indexName}`,
    contract_version: "INDEX_CATALOG_V1",
    comparison_class: "TYPED_COMPARISON",
    expected_json: corrIdx,
    matchesSql: sqlIndexCatalogMatch(corrIdx),
  });

  pushGuard(guards, {
    guard_id: "table.correction.acl",
    object_class: "table",
    object_identity: "public.team_tournament_referee_correction_requests",
    contract_version: "ACL_EXPLODED_SET_V1",
    comparison_class: "TYPED_COMPARISON",
    expected_json: { aclExploded: parseAclText(postCorrAcl) },
    matchesSql: sqlAclSetMatch({
      kind: "relation",
      tableName: "team_tournament_referee_correction_requests",
      expectedAclText: postCorrAcl,
    }),
    diagnosticSql: sqlAclDiagnosticText({
      kind: "relation",
      tableName: "team_tournament_referee_correction_requests",
    }),
  });

  pushGuard(guards, {
    guard_id: "policy.tt5d_correction_referee_select",
    object_class: "policy",
    object_identity: "public.team_tournament_referee_correction_requests.tt5d_correction_referee_select",
    contract_version: "WS_COLLAPSE_V1",
    comparison_class: "NORMALIZED_EXPRESSION",
    expected_json: { usingNormalized: selectPol?.using },
    matchesSql: `EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
        AND pol.polcmd='r'
        AND ${sqlNormalizedUsingEq(selectPol.using)}
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )`,
  });

  pushGuard(guards, {
    guard_id: "policy.tt5d_correction_no_client_write",
    object_class: "policy",
    object_identity: "public.team_tournament_referee_correction_requests.tt5d_correction_no_client_write",
    contract_version: "TYPED_COMPARISON",
    comparison_class: "TYPED_COMPARISON",
    expected_json: {},
    matchesSql: `EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
        AND pol.polcmd='*'
        AND pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )`,
  });

  for (const f of baseline.functions) {
    const p = fnProc(f);
    const cfg = asProconfigElements(f.proconfig);
    const grants = ALLOWLIST[f.name];
    const vol = f.name === "referee_v5_assignment_effective_status" ? "STABLE" : f.volatility;
    const defMd5 =
      f.name === "referee_v5_assignment_effective_status" ? postMd5 : f.defMd5;
    const postAcl = expectedPostAcl(f.name);
    const prefix = `fn.${f.name}`;

    const fnPost = [
      { id: "missing", sql: `${p} IS NOT NULL`, cv: "TYPED_COMPARISON", ej: { present: true } },
      {
        id: "def_md5",
        sql: `md5(pg_get_functiondef(${p})) IS NOT DISTINCT FROM ${sqlStr(defMd5)}`,
        cv: "INTENTIONAL_EXACT_FINGERPRINT",
        ej: { defMd5 },
      },
      {
        id: "volatility",
        sql: `(SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=${p}) IS NOT DISTINCT FROM ${sqlStr(vol)}`,
        cv: "TYPED_COMPARISON",
        ej: { volatility: vol },
      },
      {
        id: "language",
        sql: `(SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=${p}) IS NOT DISTINCT FROM ${sqlStr(f.language)}`,
        cv: "TYPED_COMPARISON",
        ej: { language: f.language },
      },
      {
        id: "security_definer",
        sql: `(SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=${p}) IS NOT DISTINCT FROM ${f.securityDefiner}`,
        cv: "TYPED_COMPARISON",
        ej: { securityDefiner: f.securityDefiner },
      },
      {
        id: "proconfig",
        sql: `NOT (${sqlProconfigMismatch(p, cfg)})`,
        cv: "PROCONFIG_TEXT_ARRAY_V1",
        ej: { proconfig: cfg },
      },
      {
        id: "owner",
        sql: `(SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=${p}) IS NOT DISTINCT FROM ${sqlStr(f.owner)}`,
        cv: "TYPED_COMPARISON",
        ej: { owner: f.owner },
      },
      {
        id: "proacl",
        sql: sqlAclSetMatch({ kind: "function", objectSql: p, expectedAclText: postAcl }),
        cv: "ACL_EXPLODED_SET_V1",
        ej: { aclExploded: parseAclText(postAcl) },
        diagnosticSql: sqlAclDiagnosticText({ kind: "function", objectSql: p }),
      },
      {
        id: "public_denied",
        sql: `NOT has_function_privilege('public', ${p}, 'EXECUTE')`,
        cv: "TYPED_COMPARISON",
        ej: { publicExecute: false },
      },
      {
        id: "anon_denied",
        sql: `NOT has_function_privilege('anon', ${p}, 'EXECUTE')`,
        cv: "TYPED_COMPARISON",
        ej: { anonExecute: false },
      },
      {
        id: "authenticated_execute",
        sql: `has_function_privilege('authenticated', ${p}, 'EXECUTE') IS NOT DISTINCT FROM ${grants.includes("authenticated")}`,
        cv: "TYPED_COMPARISON",
        ej: { authenticatedExecute: grants.includes("authenticated") },
      },
      {
        id: "service_role_execute",
        sql: `has_function_privilege('service_role', ${p}, 'EXECUTE') IS NOT DISTINCT FROM ${grants.includes("service_role")}`,
        cv: "TYPED_COMPARISON",
        ej: { serviceRoleExecute: grants.includes("service_role") },
      },
    ];

    for (const g of fnPost) {
      pushGuard(guards, {
        guard_id: `${prefix}.${g.id}`,
        object_class: "function",
        object_identity: f.signature,
        contract_version: g.cv,
        comparison_class: g.cv === "INTENTIONAL_EXACT_FINGERPRINT" ? "INTENTIONAL_EXACT_FINGERPRINT" : "TYPED_COMPARISON",
        expected_json: g.ej,
        matchesSql: g.sql,
        diagnosticSql: g.diagnosticSql ?? null,
      });
    }
  }

  return guards;
}

export function failClosedSql(guards, failPrefix) {
  return guards
    .map(
      (g) => `  -- GUARD_ID: ${g.guard_id}
  IF NOT (${g.matchesSql}) THEN
    RAISE EXCEPTION '${failPrefix} ${g.guard_id}';
  END IF;`,
    )
    .join("\n");
}

export function shadowPreflightSql(guards) {
  const rows = guards.map(guardRow).join("\nUNION ALL\n");
  const cte = `WITH guard_results AS (
${rows}
)`;
  return `-- Phase 5D precondition — SELECT-only typed guard shadow (registry parity with sql/10 pre guards).
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- Returns all guard rows then a deterministic summary. Non-fail-fast. No DDL/DML/BEGIN/COMMIT/DO.

${cte}
SELECT guard_order, guard_id, object_class, object_identity, contract_version, expected_json, actual_json, matches_guard
FROM guard_results
ORDER BY guard_order;

${cte}
SELECT
  count(*)::int AS total_guard_count,
  count(*) FILTER (WHERE matches_guard)::int AS passed_guard_count,
  count(*) FILTER (WHERE NOT matches_guard)::int AS failed_guard_count,
  bool_and(matches_guard) AS preflight_all_pass
FROM guard_results;
`;
}

export function guardInventorySummary(guards) {
  const byContract = {};
  for (const g of guards) {
    byContract[g.contract_version] = (byContract[g.contract_version] ?? 0) + 1;
  }
  return {
    guardCount: guards.length,
    guardIds: guards.map((g) => g.guard_id),
    contracts: byContract,
  };
}
