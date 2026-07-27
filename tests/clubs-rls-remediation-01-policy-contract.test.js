/**
 * CLUBS-RLS-REMEDIATION-01 — policy contract + negative-test matrix (static).
 * Does not connect to Supabase. Does not apply SQL. Does not deploy.
 * Run: node --test tests/clubs-rls-remediation-01-policy-contract.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "docs/clubs-rls-remediation-01";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/** Isolate clubs_select CREATE POLICY body from a SQL source. */
function isolateClubsSelect(sql) {
  const body = stripSqlComments(sql);
  const m = body.match(
    /create\s+policy\s+clubs_select\s+on\s+public\.clubs([\s\S]*?)(?=;)/i
  );
  assert.ok(m, "missing create policy clubs_select on public.clubs");
  return m[0] + (m[1] || "");
}

/**
 * Detect BROAD club-row `status = 'active'` (not `cm.status = 'active'`).
 * @param {string} policySql
 */
function hasBroadClubStatusActive(policySql) {
  const s = stripSqlComments(policySql);
  // Remove membership qualifier tokens first
  const withoutCm = s.replace(/cm\.status\s*=\s*'active'/gi, "CM_STATUS_ACTIVE");
  return /(^|[^.\w])status\s*=\s*'active'/i.test(withoutCm);
}

const phase42c = read("docs/v5/PHASE_42C_RLS_RPC.sql");
const forward = read(`${PKG}/sql/10_CLUBS_RLS_REMEDIATION_01_FORWARD.sql`);
const rollback = read(`${PKG}/sql/90_CLUBS_RLS_REMEDIATION_01_ROLLBACK.sql`);
const preflight = read(`${PKG}/sql/00_CLUBS_RLS_REMEDIATION_01_PREFLIGHT.sql`);
const postApply = read(`${PKG}/sql/20_CLUBS_RLS_REMEDIATION_01_POST_APPLY_VERIFY.sql`);
const catalogSql = read(
  "docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql"
);

const phase42cPolicy = isolateClubsSelect(phase42c);
const forwardPolicy = isolateClubsSelect(forward);
const rollbackPolicy = isolateClubsSelect(rollback);

describe("CLUBS-RLS-REMEDIATION-01 package presence", () => {
  it("ships forward, rollback, preflight, post-apply, runbooks, inventory", () => {
    const required = [
      `${PKG}/00_INVENTORY_AND_DESIGN.md`,
      `${PKG}/sql/00_CLUBS_RLS_REMEDIATION_01_PREFLIGHT.sql`,
      `${PKG}/sql/10_CLUBS_RLS_REMEDIATION_01_FORWARD.sql`,
      `${PKG}/sql/20_CLUBS_RLS_REMEDIATION_01_POST_APPLY_VERIFY.sql`,
      `${PKG}/sql/90_CLUBS_RLS_REMEDIATION_01_ROLLBACK.sql`,
      `${PKG}/runbooks/STAGING_APPLY_RUNBOOK.md`,
      `${PKG}/runbooks/PRODUCTION_APPLY_RUNBOOK_DRAFT.md`,
    ];
    for (const rel of required) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
    }
  });

  it("marks Production not applied / Staging Owner-gated or certified", () => {
    assert.match(forward, /Production deployment status:\s*NOT APPLIED/i);
    assert.match(forward, /qyewbxjsiiyufanzcjcq/);
    const runbook = read(`${PKG}/runbooks/STAGING_APPLY_RUNBOOK.md`);
    assert.match(
      runbook,
      /NOT EXECUTED|STAGING_CERTIFIED|EXECUTED.*CERTIFIED/i
    );
    assert.match(
      read(`${PKG}/runbooks/PRODUCTION_APPLY_RUNBOOK_DRAFT.md`),
      /NOT AUTHORIZED|DRAFT/i
    );
  });
});

describe("Canonical policy owner + remediation alignment", () => {
  it("PHASE_42C clubs_select is remediating target (no broad status branch)", () => {
    assert.equal(hasBroadClubStatusActive(phase42cPolicy), false);
    assert.match(phase42cPolicy, /phase42_is_platform_super_admin\s*\(\s*\)/i);
    assert.match(phase42cPolicy, /phase42_is_tenant_member\s*\(\s*tenant_id\s*\)/i);
    assert.match(
      phase42cPolicy,
      /phase42_active_club_member_id\s*\(\s*id\s*\)\s+is\s+not\s+null/i
    );
    assert.match(phase42cPolicy, /deleted_at\s+is\s+null/i);
    assert.match(phase42cPolicy, /for\s+select\s+to\s+authenticated/i);
  });

  it("forward SQL matches same allow set and drops broad branch", () => {
    assert.equal(hasBroadClubStatusActive(forwardPolicy), false);
    assert.match(forward, /drop\s+policy\s+if\s+exists\s+clubs_select/i);
    assert.match(forwardPolicy, /phase42_is_platform_super_admin\s*\(\s*\)/i);
    assert.match(forwardPolicy, /phase42_is_tenant_member\s*\(\s*tenant_id\s*\)/i);
    assert.match(
      forwardPolicy,
      /phase42_active_club_member_id\s*\(\s*id\s*\)\s+is\s+not\s+null/i
    );
    assert.doesNotMatch(
      forwardPolicy,
      /exists\s*\(\s*select\s+1\s+from\s+public\.club_members/i
    );
  });

  it("rollback intentionally restores broad branch for Staging abort only", () => {
    assert.equal(hasBroadClubStatusActive(rollbackPolicy), true);
    assert.match(rollbackPolicy, /or\s+status\s*=\s*'active'/i);
  });
});

describe("Negative-test matrix N1–N10 (contract encoding)", () => {
  it("N1/N2: no authenticated full-row discovery via status='active'", () => {
    assert.equal(hasBroadClubStatusActive(forwardPolicy), false);
    assert.equal(hasBroadClubStatusActive(phase42cPolicy), false);
    assert.match(postApply, /N1\/N2/i);
    assert.match(postApply, /EXPECT:\s*0 rows/i);
  });

  it("N3: active club member path retained via SECURITY DEFINER helper", () => {
    assert.match(
      forwardPolicy,
      /phase42_active_club_member_id\s*\(\s*id\s*\)\s+is\s+not\s+null/i
    );
    assert.match(phase42c, /create\s+or\s+replace\s+function\s+public\.phase42_active_club_member_id/i);
    assert.match(phase42c, /security\s+definer/i);
  });

  it("N4: tenant member path retained", () => {
    assert.match(forwardPolicy, /phase42_is_tenant_member\s*\(\s*tenant_id\s*\)/i);
  });

  it("N5: platform super admin path retained", () => {
    assert.match(forwardPolicy, /phase42_is_platform_super_admin\s*\(\s*\)/i);
  });

  it("N6: anon has no clubs_select policy (authenticated-only)", () => {
    assert.match(forwardPolicy, /for\s+select\s+to\s+authenticated/i);
    assert.doesNotMatch(forwardPolicy, /to\s+anon/i);
    assert.match(postApply, /SET ROLE anon/i);
  });

  it("N7: public_catalog_list_clubs allowlisted discovery unchanged", () => {
    const cat = stripSqlComments(catalogSql);
    assert.match(cat, /create\s+or\s+replace\s+function\s+public\.public_catalog_list_clubs/i);
    assert.match(cat, /security\s+definer/i);
    assert.match(cat, /is_publicly_listed\s*=\s*true/i);
    assert.match(cat, /status\s*=\s*'active'/i);
    assert.match(cat, /deleted_at\s+is\s+null/i);
    assert.doesNotMatch(cat, /created_by_user_id|registered_cluster_id|tenant_id/i);
    const forwardExec = stripSqlComments(forward);
    assert.doesNotMatch(
      forwardExec,
      /create\s+or\s+replace\s+function\s+public\.public_catalog_list_clubs/i
    );
    assert.doesNotMatch(forwardExec, /drop\s+function[\s\S]*public_catalog_list_clubs/i);
  });

  it("N8: INSERT/UPDATE/DELETE not expanded", () => {
    const f = stripSqlComments(forward);
    assert.match(f, /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+public\.clubs/i);
    assert.doesNotMatch(f, /create\s+policy\s+\w+\s+on\s+public\.clubs[\s\S]*for\s+insert/i);
    assert.doesNotMatch(f, /create\s+policy\s+\w+\s+on\s+public\.clubs[\s\S]*for\s+update/i);
    assert.doesNotMatch(f, /create\s+policy\s+\w+\s+on\s+public\.clubs[\s\S]*for\s+delete/i);
    assert.match(phase42c, /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+public\.clubs/i);
  });

  it("N9: deleted_at null gate retained for inactive/deleted contract", () => {
    assert.match(forwardPolicy, /deleted_at\s+is\s+null/i);
    assert.match(phase42cPolicy, /deleted_at\s+is\s+null/i);
  });

  it("N10: single clubs_select recreation; preflight/post check competing policies", () => {
    const drops = forward.match(/drop\s+policy\s+if\s+exists\s+clubs_select/gi) || [];
    const creates = forward.match(/create\s+policy\s+clubs_select/gi) || [];
    assert.equal(drops.length, 1);
    assert.equal(creates.length, 1);
    assert.match(preflight, /clubs_select_policy_count|Competing SELECT/i);
    assert.match(postApply, /select_policy_count/i);
    assert.match(postApply, /writer_policy_count/i);
  });
});

describe("Safety markers", () => {
  it("forward does not truncate/drop clubs table or touch Production apply scripts", () => {
    assert.doesNotMatch(forward, /^\s*TRUNCATE\b/im);
    assert.doesNotMatch(forward, /^\s*DROP\s+TABLE\b/im);
    assert.doesNotMatch(forward, /expuvcohlcjzvrrauvud/);
  });

  it("no app direct PostgREST .from('clubs') dependency in src/", () => {
    const srcRoot = path.join(ROOT, "src");
    /** @type {string[]} */
    const hits = [];
    function walk(dir) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(js|jsx|ts|tsx)$/.test(ent.name)) {
          const text = fs.readFileSync(p, "utf8");
          if (/\.from\(\s*['"`]clubs['"`]\s*\)/.test(text)) hits.push(p);
        }
      }
    }
    walk(srcRoot);
    assert.deepEqual(hits, []);
  });
});
