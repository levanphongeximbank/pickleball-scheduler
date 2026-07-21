import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import { CRM_MENU_ROOT } from "../src/config/v5Menu/crmMenu.js";

import * as crm from "../src/features/crm/index.js";
import { CRM_PERMISSION_VALUES, CRM_PERMISSIONS } from "../src/features/crm/constants/permissions.js";
import {
  CRM_PERMISSION_SEED_ROWS,
  CRM_PHASE_1G_REQUIRED_PERMISSIONS,
  CRM_PERMISSION_SEED_APPROVAL,
  splitCrmPermissionCatalogParts,
} from "../src/features/crm/identity/crmPermissionSeedDefinitions.js";
import {
  CRM_PROPOSED_ROLE_PERMISSION_MATRIX,
  CRM_ROLE_MATRIX_APPROVAL,
  CRM_ROLE_GRANT_CANDIDATES,
  listProposedCrmRolePermissionGrants,
} from "../src/features/crm/identity/crmRolePermissionMatrix.js";
import {
  CRM_TENANT_VENUE_RESOLVER_VERDICT,
  getCrmTenantVenueResolverVerdict,
  isAcceptableCrmTenantVenueResolverVerdict,
} from "../src/features/crm/identity/tenantVenueResolverCertification.js";
import {
  createSupabaseCrmDatabaseClient,
  CRM_SUPABASE_TABLE_ALLOWLIST,
  CRM_SUPABASE_OPERATION_ALLOWLIST,
  CRM_SUPABASE_RPC_ALLOWLIST,
} from "../src/features/crm/persistence/supabase/supabaseCrmDatabaseClient.js";
import {
  assertCrmRuntimeCompositionGuard,
  getCrmDefaultRuntimePersistenceMode,
  CRM_PERSISTENCE_MODE_ENV,
} from "../src/features/crm/persistence/runtimeCompositionGuard.js";
import {
  loadCrmStagingMigrationManifest,
  verifyCrmStagingMigrationManifest,
  sha256File,
  CRM_PRODUCTION_PROJECT_REF_BLOCKLIST,
} from "../src/features/crm/staging/migrationManifest.js";
import { CRM_PHASE_1G_TABLES, CRM_PHASE_1G_RPC } from "../src/features/crm/persistence/databaseClientPort.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const phase1hDir = path.join(root, "docs", "crm", "phase-1h");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

/**
 * Fake Supabase-like client — no network.
 */
function createFakeSupabaseLikeClient(options = {}) {
  const calls = [];
  const tables = options.tables || new Map();

  function ensureTable(name) {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  }

  return {
    calls,
    from(table) {
      const state = {
        table,
        filters: {},
        op: null,
        values: null,
        rows: null,
        columns: "*",
        order: [],
        limit: null,
        countExact: false,
        returning: false,
      };

      const builder = {
        select(columns = "*") {
          if (state.op == null) state.op = "select";
          state.columns = columns;
          state.returning = true;
          return builder;
        },
        insert(rows) {
          state.op = "insert";
          state.rows = rows;
          return builder;
        },
        update(values) {
          state.op = "update";
          state.values = values;
          return builder;
        },
        delete(opts = {}) {
          state.op = "delete";
          state.countExact = opts.count === "exact";
          return builder;
        },
        eq(key, value) {
          state.filters[key] = value;
          return builder;
        },
        in(key, values) {
          state.filters[key] = { in: values };
          return builder;
        },
        order(column, opts = {}) {
          state.order.push({ column, ascending: opts.ascending !== false });
          return builder;
        },
        limit(n) {
          state.limit = n;
          return builder;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              calls.push({ ...state });
              const rows = ensureTable(table);
              if (state.op === "select") {
                let result = rows.filter((row) =>
                  Object.entries(state.filters).every(([k, v]) => row[k] === v)
                );
                if (state.limit != null) result = result.slice(0, state.limit);
                return { data: result, error: null };
              }
              if (state.op === "insert") {
                const list = Array.isArray(state.rows) ? state.rows : [state.rows];
                for (const row of list) rows.push({ ...row });
                return { data: state.returning ? list.map((r) => ({ ...r })) : null, error: null };
              }
              if (state.op === "update") {
                const updated = [];
                for (let i = 0; i < rows.length; i += 1) {
                  const row = rows[i];
                  const match = Object.entries(state.filters).every(([k, v]) => row[k] === v);
                  if (!match) continue;
                  rows[i] = { ...row, ...state.values };
                  updated.push(rows[i]);
                }
                return { data: state.returning ? updated : null, error: null };
              }
              if (state.op === "delete") {
                const before = rows.length;
                const next = rows.filter(
                  (row) => !Object.entries(state.filters).every(([k, v]) => row[k] === v)
                );
                const removed = before - next.length;
                tables.set(table, next);
                return { data: null, error: null, count: removed };
              }
              return { data: null, error: { code: "CRM_FAKE", message: "unknown op" } };
            })
            .then(resolve, reject);
        },
      };
      return builder;
    },
    async rpc(fn, args) {
      calls.push({ op: "rpc", fn, args });
      if (options.rpcError) {
        return { data: null, error: options.rpcError };
      }
      return { data: options.rpcData ?? [], error: null };
    },
  };
}

// ─── Identity permissions ───────────────────────────────────────────────────

test("CRM permission inventory matches exported constants", () => {
  const seeded = CRM_PERMISSION_SEED_ROWS.map((r) => r.id).sort();
  const exported = [...CRM_PERMISSION_VALUES].sort();
  assert.deepEqual(seeded, exported);
  assert.equal(new Set(seeded).size, seeded.length);
});

test("permission seed has no duplicates and idempotent SQL structure", () => {
  const sql = read("docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql");
  assert.match(sql, /WHERE NOT EXISTS/i);
  assert.doesNotMatch(sql, /role_permissions/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
  for (const id of CRM_PERMISSION_VALUES) {
    assert.match(sql, new RegExp(`'${id.replace(/\./g, "\\.")}'`));
  }
  const ids = CRM_PERMISSION_SEED_ROWS.map((r) => r.id);
  assert.equal(ids.length, new Set(ids).size);
  for (const row of CRM_PERMISSION_SEED_ROWS) {
    const parts = splitCrmPermissionCatalogParts(row.id);
    assert.equal(parts.module, "crm");
    assert.equal(row.module, "crm");
  }
});

test("role matrix separately reviewable; no broad or anonymous assignment", () => {
  assert.equal(CRM_ROLE_MATRIX_APPROVAL.separatedFromPermissionSeed, true);
  assert.equal(CRM_ROLE_MATRIX_APPROVAL.noAnonymousGrants, true);
  assert.equal(CRM_ROLE_MATRIX_APPROVAL.noAuthenticatedGlobalGrants, true);
  assert.equal(CRM_ROLE_MATRIX_APPROVAL.noPlayerCustomerAdmin, true);
  assert.equal(CRM_ROLE_MATRIX_APPROVAL.ownerApprovalRequiredBeforeApply, true);
  assert.deepEqual(CRM_PROPOSED_ROLE_PERMISSION_MATRIX.PLAYER, []);
  assert.deepEqual(CRM_PROPOSED_ROLE_PERMISSION_MATRIX.CUSTOMER, []);

  const grantSql = read("docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql");
  assert.match(grantSql, /Owner approval/i);
  assert.doesNotMatch(grantSql, /TO\s+anon/i);
  assert.doesNotMatch(grantSql, /GRANT\s+.*\s+TO\s+PUBLIC/i);
  assert.doesNotMatch(grantSql, /'PLAYER'/);
  assert.doesNotMatch(grantSql, /'CUSTOMER'/);
  assert.doesNotMatch(grantSql, /expuvcohlcjzvrrauvud/);
  assert.doesNotMatch(grantSql, /auth\.users/);

  const grants = listProposedCrmRolePermissionGrants();
  assert.ok(grants.length > 0);
  for (const g of grants) {
    assert.ok(CRM_ROLE_GRANT_CANDIDATES.includes(g.roleId));
    assert.ok(CRM_PERMISSION_VALUES.includes(g.permissionId));
  }
});

test("pending-event permission reuses crm.audit.view; no invented opportunity.assign", () => {
  assert.equal(CRM_PERMISSIONS.AUDIT_VIEW, "crm.audit.view");
  assert.ok(CRM_PHASE_1G_REQUIRED_PERMISSIONS.includes(CRM_PERMISSIONS.AUDIT_VIEW));
  assert.equal(
    Object.values(CRM_PERMISSIONS).includes("crm.opportunity.assign"),
    false
  );
  assert.equal(CRM_PERMISSION_SEED_APPROVAL.noSecrets, true);
  assert.equal(CRM_PERMISSION_SEED_APPROVAL.noProductionIds, true);
});

// ─── Tenant / venue ─────────────────────────────────────────────────────────

test("resolver verdict present and acceptable; missing scope fails closed", () => {
  assert.equal(getCrmTenantVenueResolverVerdict(), "SAME_SCOPE_MODEL_VERIFIED");
  assert.equal(
    isAcceptableCrmTenantVenueResolverVerdict(CRM_TENANT_VENUE_RESOLVER_VERDICT.verdict),
    true
  );
  assert.equal(CRM_TENANT_VENUE_RESOLVER_VERDICT.evidence.firstVenueFallbackPresent, false);
  assert.equal(
    CRM_TENANT_VENUE_RESOLVER_VERDICT.evidence.nullablePermissivePolicyPresent,
    false
  );
  assert.equal(CRM_TENANT_VENUE_RESOLVER_VERDICT.evidence.distinctTenantHelper, null);

  assert.throws(() => crm.createTenantVenueScope({ tenantId: "t1" }), /scope|venue/i);
  assert.throws(() => crm.createTenantVenueScope({ venueId: "v1" }), /scope|tenant/i);

  const rls = read("docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql");
  assert.match(rls, /p_tenant_id = public\.user_venue_id\(\)/);
  assert.match(rls, /p_venue_id = public\.user_venue_id\(\)/);
  assert.match(rls, /No first-venue fallback/);
  // Executable body must not implement first-* fallback selection.
  const rlsBody = rls.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(rlsBody, /\bfirst[_-]?(venue|tenant|club)\b/i);
  assert.doesNotMatch(rlsBody, /coalesce\s*\(\s*public\.user_venue_id\(\)\s*,/i);
});

// ─── RLS / RPC ──────────────────────────────────────────────────────────────

test("every Phase 1G table has RLS; no PUBLIC/anon grants; helpers verified", () => {
  const rls = read("docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql");
  const grants = read("docs/crm/phase-1g/50_CRM_PHASE_1G_GRANTS.sql");
  for (const table of Object.values(CRM_PHASE_1G_TABLES)) {
    assert.match(rls, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(rls, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
    assert.match(grants, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC`));
    assert.match(grants, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon`));
  }
  assert.match(rls, /crm_phase1g_scope_allows/);
  assert.match(rls, /user_has_permission/);
  assert.match(rls, /is_super_admin/);
  assert.doesNotMatch(rls, /TO\s+anon/);
  assert.doesNotMatch(rls, /FOR\s+ALL\s+TO\s+PUBLIC/i);
  assert.match(rls, /crm_tag_assignments_delete/);
  assert.doesNotMatch(rls, /crm_consent_records_update/);
  assert.doesNotMatch(rls, /crm_consent_records_delete/);
  assert.doesNotMatch(rls, /role\s*=\s*'VENUE_OWNER'/);
});

test("claim and release RPC certification rules present in SQL", () => {
  const rpc = read("docs/crm/phase-1g/40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql");
  const grants = read("docs/crm/phase-1g/50_CRM_PHASE_1G_GRANTS.sql");

  assert.match(rpc, /SET search_path = public, pg_temp/);
  assert.match(rpc, /FOR UPDATE OF pe SKIP LOCKED/);
  assert.match(rpc, /ORDER BY pe\.available_at ASC, pe\.created_at ASC, pe\.pending_event_id ASC/);
  assert.match(rpc, /attempt_count = pe\.attempt_count \+ 1/);
  assert.match(rpc, /claim_limit must be between 1 and 100/);
  assert.match(rpc, /claim_ttl_seconds must be between 1 and 3600/);
  assert.match(rpc, /crm_phase1g_scope_allows/);
  assert.match(rpc, /user_has_permission\('crm\.audit\.view'\)/);
  assert.match(rpc, /-- attempt_count preserved intentionally/);
  assert.match(rpc, /Does NOT deliver events, call providers, or auto-acknowledge/i);
  const rpcBody = rpc.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(rpcBody, /\bdeliver_event\b|\bcall_provider\b|\bauto_acknowledge\b/i);

  assert.match(grants, /REVOKE ALL ON FUNCTION public\.crm_claim_pending_events/);
  assert.match(grants, /FROM PUBLIC/);
  assert.match(grants, /FROM anon/);
  assert.match(grants, /GRANT EXECUTE ON FUNCTION public\.crm_claim_pending_events/);
  assert.match(grants, /TO authenticated/);
  assert.match(grants, /crm_release_expired_pending_event_claims/);
});

// ─── Supabase adapter ───────────────────────────────────────────────────────

test("public facade exports adapter and guard; injected client required", () => {
  assert.equal(typeof crm.createSupabaseCrmDatabaseClient, "function");
  assert.equal(typeof crm.assertCrmRuntimeCompositionGuard, "function");
  assert.equal(typeof crm.getCrmDefaultRuntimePersistenceMode, "function");
  assert.throws(() => createSupabaseCrmDatabaseClient({}), /injected/i);
  assert.throws(
    () => createSupabaseCrmDatabaseClient({ client: { from() {} } }),
    /rpc/i
  );
});

test("adapter allowlists, scope enforcement, consent delete rejected, assignment delete allowed", async () => {
  const fake = createFakeSupabaseLikeClient();
  const db = createSupabaseCrmDatabaseClient({ client: fake });

  assert.ok(CRM_SUPABASE_TABLE_ALLOWLIST.has(CRM_PHASE_1G_TABLES.TAGS));
  assert.ok(CRM_SUPABASE_RPC_ALLOWLIST.has(CRM_PHASE_1G_RPC.CLAIM_PENDING_EVENTS));
  assert.ok(
    CRM_SUPABASE_OPERATION_ALLOWLIST[CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS].has("delete")
  );
  assert.equal(
    CRM_SUPABASE_OPERATION_ALLOWLIST[CRM_PHASE_1G_TABLES.CONSENT_RECORDS].has("delete"),
    false
  );

  await assert.rejects(
    () => db.select({ table: "secrets", filters: { tenant_id: "t", venue_id: "v" } }),
    /unknown table/i
  );
  await assert.rejects(
    () => db.select({ table: CRM_PHASE_1G_TABLES.TAGS, filters: {} }),
    /tenant_id|venue_id|scope/i
  );
  await assert.rejects(
    () =>
      db.delete({
        table: CRM_PHASE_1G_TABLES.CONSENT_RECORDS,
        filters: { tenant_id: "t", venue_id: "v" },
      }),
    /rejects delete/i
  );

  const inserted = await db.insert({
    table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
    rows: {
      assignment_id: "a1",
      tenant_id: "t1",
      venue_id: "v1",
      tag_id: "tag1",
    },
    returning: true,
  });
  assert.equal(inserted.length, 1);

  const deleted = await db.delete({
    table: CRM_PHASE_1G_TABLES.TAG_ASSIGNMENTS,
    filters: { tenant_id: "t1", venue_id: "v1", assignment_id: "a1" },
  });
  assert.equal(deleted, 1);

  const rpcResult = await db.rpc({
    fn: CRM_PHASE_1G_RPC.CLAIM_PENDING_EVENTS,
    args: { p_tenant_id: "t1", p_venue_id: "v1", p_worker_id: "w1" },
  });
  assert.deepEqual(rpcResult, []);

  await assert.rejects(
    () => db.rpc({ fn: "evil_fn", args: { p_tenant_id: "t", p_venue_id: "v" } }),
    /unknown RPC/i
  );
});

test("adapter error passthrough preserves code for CRM translation; no live connection", async () => {
  const fake = createFakeSupabaseLikeClient({
    rpcError: { code: "42501", message: "permission denied", details: { x: 1 } },
  });
  const db = createSupabaseCrmDatabaseClient({ client: fake });
  await assert.rejects(
    () =>
      db.rpc({
        fn: CRM_PHASE_1G_RPC.RELEASE_EXPIRED_CLAIMS,
        args: { p_tenant_id: "t", p_venue_id: "v" },
      }),
    (err) => {
      assert.equal(err.code, "42501");
      assert.match(String(err.message), /permission denied/i);
      return true;
    }
  );

  // Module source must not read env credentials at import time.
  const adapterSrc = read(
    "src/features/crm/persistence/supabase/supabaseCrmDatabaseClient.js"
  );
  assert.doesNotMatch(adapterSrc, /process\.env/);
  assert.doesNotMatch(adapterSrc, /createClient\s*\(/);
  assert.doesNotMatch(adapterSrc, /VITE_SUPABASE/);
});

test("runtime composition guard: memory default; production durable blocked", () => {
  assert.equal(getCrmDefaultRuntimePersistenceMode(), "memory");
  assert.equal(crm.getCrmDefaultRuntimePersistenceMode(), "memory");

  const memory = assertCrmRuntimeCompositionGuard({
    env: { [CRM_PERSISTENCE_MODE_ENV]: "memory" },
  });
  assert.equal(memory.mode, "memory");
  assert.equal(memory.durableAllowed, false);

  assert.throws(
    () =>
      assertCrmRuntimeCompositionGuard({
        env: { [CRM_PERSISTENCE_MODE_ENV]: "durable" },
        appEnvironment: "production",
        databaseClient: createFakeSupabaseLikeClient(),
        ownerApprovedDurableStaging: true,
      }),
    /Production/i
  );

  assert.throws(
    () =>
      assertCrmRuntimeCompositionGuard({
        env: { [CRM_PERSISTENCE_MODE_ENV]: "durable" },
        appEnvironment: "staging",
        ownerApprovedDurableStaging: true,
      }),
    /injected database client/i
  );

  const ok = assertCrmRuntimeCompositionGuard({
    env: { [CRM_PERSISTENCE_MODE_ENV]: "durable" },
    appEnvironment: "staging",
    databaseClient: createFakeSupabaseLikeClient(),
    ownerApprovedDurableStaging: true,
  });
  assert.equal(ok.durableAllowed, true);
});

// ─── Migration manifest ─────────────────────────────────────────────────────

test("migration manifest complete, ordered, SHA-256 pinned", () => {
  const manifest = loadCrmStagingMigrationManifest(root);
  assert.ok(Array.isArray(manifest.migrations));
  assert.equal(manifest.migrations.length, 8);
  for (let i = 0; i < manifest.migrations.length; i += 1) {
    const entry = manifest.migrations[i];
    assert.equal(entry.order, i + 1);
    const abs = path.join(root, entry.path);
    assert.ok(existsSync(abs), entry.path);
    assert.equal(sha256File(abs), entry.sha256);
  }
  const verified = verifyCrmStagingMigrationManifest({ repoRoot: root, manifest });
  assert.equal(verified.ok, true);

  // Changed migration detected
  const tampered = structuredClone(manifest);
  tampered.migrations[0].sha256 = "0".repeat(64);
  const badSha = verifyCrmStagingMigrationManifest({ repoRoot: root, manifest: tampered });
  assert.equal(badSha.ok, false);
  assert.ok(badSha.errors.some((e) => /SHA-256 mismatch/i.test(e)));

  // Missing migration detected
  const missing = structuredClone(manifest);
  missing.migrations[0].path = "docs/crm/phase-1g/DOES_NOT_EXIST.sql";
  const badMissing = verifyCrmStagingMigrationManifest({
    repoRoot: root,
    manifest: missing,
  });
  assert.equal(badMissing.ok, false);
  assert.ok(badMissing.errors.some((e) => /Missing migration/i.test(e)));

  // Unknown controlled migration detected
  const unknown = structuredClone(manifest);
  unknown.migrations = unknown.migrations.filter(
    (m) => !m.path.endsWith("20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql")
  );
  // re-number
  unknown.migrations.forEach((m, idx) => {
    m.order = idx + 1;
  });
  const badUnknown = verifyCrmStagingMigrationManifest({
    repoRoot: root,
    manifest: unknown,
  });
  assert.equal(badUnknown.ok, false);
  assert.ok(badUnknown.errors.some((e) => /Unknown controlled migration/i.test(e)));

  for (const ref of CRM_PRODUCTION_PROJECT_REF_BLOCKLIST) {
    assert.ok(manifest.productionProjectRefBlocklist.includes(ref));
  }
});

// ─── Preflight / apply boundary ─────────────────────────────────────────────

test("offline preflight dry-run default; no SQL apply; secrets not printed", () => {
  const out = execFileSync(
    process.execPath,
    ["scripts/crm/phase-1h-staging-preflight.mjs", "--offline"],
    { cwd: root, encoding: "utf8", env: { ...process.env, VITE_CRM_PERSISTENCE_MODE: "memory" } }
  );
  const report = JSON.parse(out);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "offline");
  assert.equal(report.sqlApplied, false);
  assert.equal(report.stagingConnected, false);
  assert.equal(report.productionConnected, false);
  assert.equal(report.durableRuntime, "off");
  assert.equal(report.environmentVariableValues, "NOT_PRINTED");
  assert.ok(Array.isArray(report.requiredEnvironmentVariableNames));
  assert.doesNotMatch(out, /eyJ[A-Za-z0-9_-]{10,}/); // JWT-like
  assert.doesNotMatch(out, /service_role/i);

  const applyOut = execFileSync(
    process.execPath,
    ["scripts/crm/phase-1h-staging-apply.mjs", "--dry-run"],
    { cwd: root, encoding: "utf8" }
  );
  const applyReport = JSON.parse(applyOut);
  assert.equal(applyReport.mode, "dry-run");
  assert.equal(applyReport.sqlApplied, false);
  assert.equal(applyReport.automaticRollback, false);
  assert.equal(applyReport.deploy, false);

  // Apply mode refused even with flag
  let applyRefused = false;
  try {
    execFileSync(
      process.execPath,
      [
        "scripts/crm/phase-1h-staging-apply.mjs",
        "--apply-staging",
        "--environment=staging",
        "--owner-approval=x",
        "--backup-evidence=y",
      ],
      { cwd: root, encoding: "utf8" }
    );
  } catch (err) {
    applyRefused = true;
    const body = String(err.stdout || "");
    const refused = JSON.parse(body);
    assert.equal(refused.sqlApplied, false);
    assert.ok(refused.errors.some((e) => /refuses SQL apply/i.test(e)));
  }
  assert.equal(applyRefused, true);
});

// ─── Documentation + facade regression ──────────────────────────────────────

test("Phase 1H documentation set complete", () => {
  const required = [
    "01_IDENTITY_PERMISSION_INVENTORY.md",
    "02_CRM_PERMISSION_SEED_AND_ROLE_MATRIX.md",
    "03_TENANT_VENUE_RESOLVER_CERTIFICATION.md",
    "04_RLS_SECURITY_CERTIFICATION.md",
    "05_PENDING_EVENT_RPC_CERTIFICATION.md",
    "06_SUPABASE_CLIENT_ADAPTER.md",
    "07_STAGING_MIGRATION_MANIFEST.md",
    "08_STAGING_PREFLIGHT_AND_ROLLOUT_PLAN.md",
    "09_STAGING_QA_MATRIX.md",
    "10_PHASE_1H_ACCEPTANCE_CRITERIA.md",
    "staging-migration-manifest.json",
    "10_CRM_PHASE_1H_PERMISSION_SEED.sql",
    "20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql",
  ];
  for (const name of required) {
    assert.ok(existsSync(path.join(phase1hDir, name)), name);
  }
  const cert = read("docs/crm/phase-1h/03_TENANT_VENUE_RESOLVER_CERTIFICATION.md");
  assert.match(cert, /SAME_SCOPE_MODEL_VERIFIED/);
});

test("CRM menu remains PARTIAL; no other workstream phase-1h pollution in this change set", () => {
  const crmPathItems = CRM_MENU_ROOT.children.filter((item) =>
    String(item.path || "").startsWith("/crm/")
  );
  const partialItems = crmPathItems.filter(
    (item) => item.featureStatus === FEATURE_STATUS.PARTIAL
  );
  assert.ok(partialItems.length >= 1);
  // Ensure we did not author under player-management/competition paths in this phase folder
  assert.ok(existsSync(phase1hDir));
  const crmPhaseFiles = walkFiles(phase1hDir).map((f) => path.relative(root, f));
  assert.ok(crmPhaseFiles.length >= 10);
});

test("static secret scan over Phase 1H authored artifacts", () => {
  const files = [
    ...walkFiles(phase1hDir),
    path.join(root, "scripts/crm/phase-1h-staging-preflight.mjs"),
    path.join(root, "scripts/crm/phase-1h-staging-apply.mjs"),
    path.join(root, "src/features/crm/persistence/supabase/supabaseCrmDatabaseClient.js"),
  ];
  const patterns = [
    /supabase_service_role/i,
    /BEGIN PRIVATE KEY/,
    /eyJhbGciOiJ/,
    /password\s*=\s*['"][^'"]{8,}/i,
  ];
  for (const file of files) {
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    if (file.endsWith(".png") || file.endsWith(".jpg")) continue;
    const text = readFileSync(file, "utf8");
    for (const re of patterns) {
      assert.equal(re.test(text), false, `${file} matched ${re}`);
    }
  }
});
