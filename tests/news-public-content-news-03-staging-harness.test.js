/**
 * NEWS-03 — Staging rollout harness safety (mocked transport; no network).
 * Run: node --test tests/news-public-content-news-03-staging-harness.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  NEWS_03_APPLY_CONFIRM_PHRASE,
  NEWS_03_MODES,
  NEWS_03_PERMISSION_KEYS,
  NEWS_03_PREFLIGHT_STATES,
  NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  NEWS_03_ROLLBACK_CONFIRM_PHRASE,
  NEWS_03_STAGING_PROJECT_REF,
  NEWS_03_VERDICTS,
} from "../scripts/news/lib/news03Constants.js";
import {
  evaluateNews03OwnerGoGates,
  evaluateNews03StaticGates,
  inspectNews03EnvironmentIdentity,
} from "../scripts/news/lib/news03Gates.js";
import { redactNews03SecretLike } from "../scripts/news/lib/news03Redact.js";
import {
  NEWS_03_APPLY_SQL_ORDER,
  NEWS_03_ROLLBACK_SQL_ORDER,
  loadNews03ApplyPackage,
} from "../scripts/news/lib/news03SqlPackage.js";
import {
  classifyNews03PreflightState,
  parseNews03Args,
  runNews03StagingRollout,
} from "../scripts/news/news-03-staging-rollout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tempEvidenceDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "news03-evidence-"));
}

function mockTransportFactory({ inventory = null, project = null } = {}) {
  const calls = [];
  const defaultInventory = {
    tables: [],
    rls: [],
    policies: [],
    functions: [],
    triggers: [],
    permissions: [],
    helpers: {
      user_has_permission: true,
      is_super_admin: true,
      user_venue_id: true,
    },
  };
  const transport = async (req) => {
    calls.push({ method: req.method, url: req.url });
    assert.ok(
      req.url.includes(NEWS_03_STAGING_PROJECT_REF),
      "transport must target Staging allowlist ref only"
    );
    assert.ok(
      !NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST.some((r) =>
        req.url.includes(r)
      )
    );
    if (req.method === "GET" && req.url.endsWith(`/${NEWS_03_STAGING_PROJECT_REF}`)) {
      return {
        ok: true,
        status: 200,
        body: project || {
          ref: NEWS_03_STAGING_PROJECT_REF,
          name: "pick-vn-staging",
          status: "ACTIVE_HEALTHY",
        },
      };
    }
    // database/query
    const body = JSON.parse(req.body || "{}");
    const q = String(body.query || "");
    if (q.includes("jsonb_build_object")) {
      return {
        ok: true,
        status: 200,
        body: [{ inventory: inventory || defaultInventory }],
      };
    }
    return { ok: true, status: 200, body: [{ ok: true }] };
  };
  transport.calls = calls;
  return transport;
}

test("NEWS-03 default args are read-only preflight", () => {
  const args = parseNews03Args([]);
  assert.equal(args.mode, NEWS_03_MODES.PREFLIGHT);
  assert.equal(args.execute, false);
});

test("NEWS-03 SQL apply order locked with seed after NEWS-02 60 and verifications last", () => {
  const order = NEWS_03_APPLY_SQL_ORDER;
  assert.equal(order.length, 9);
  assert.match(order[5], /60_NEWS_PHASE_02_IMMUTABLE_REVISIONS\.sql$/);
  assert.match(order[6], /10_NEWS_PHASE_03_PERMISSION_SEED\.sql$/);
  assert.match(order[7], /99_NEWS_PHASE_02_VERIFICATION\.sql$/);
  assert.match(order[8], /99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION\.sql$/);
  assert.ok(!order.some((p) => /90_.*ROLLBACK/.test(p)));
  assert.deepEqual(NEWS_03_ROLLBACK_SQL_ORDER[0].includes("PERMISSION_SEED_ROLLBACK"), true);
});

test("NEWS-03 package inventory loads all apply SQL files", () => {
  const pkg = loadNews03ApplyPackage(ROOT);
  assert.equal(pkg.ok, true);
  assert.equal(pkg.files.length, 9);
  assert.equal(NEWS_03_PERMISSION_KEYS.length, 6);
});

test("NEWS-03 Production ref hard-blocked; only Staging allowlist accepted", () => {
  const prod = inspectNews03EnvironmentIdentity({
    VITE_SUPABASE_URL: `https://${NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST[0]}.supabase.co`,
  });
  assert.equal(prod.isProduction, true);
  assert.equal(prod.ok, false);

  const other = inspectNews03EnvironmentIdentity({
    VITE_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  });
  assert.equal(other.ok, false);

  const staging = inspectNews03EnvironmentIdentity({
    VITE_SUPABASE_URL: `https://${NEWS_03_STAGING_PROJECT_REF}.supabase.co`,
    VITE_APP_ENV: "staging",
  });
  assert.equal(staging.ok, true);
  assert.equal(staging.containsStagingAllowlist, true);
});

test("NEWS-03 apply requires all explicit Owner GO gates", () => {
  const missing = evaluateNews03OwnerGoGates({
    mode: NEWS_03_MODES.APPLY,
    execute: false,
    confirm: null,
    workingTreeClean: true,
    preflightState: NEWS_03_PREFLIGHT_STATES.NOT_APPLIED,
    packageOk: true,
    identityOk: true,
    identityIsProduction: false,
    accessTokenPresent: true,
  });
  assert.equal(missing.canWrite, false);

  const wrongPhrase = evaluateNews03OwnerGoGates({
    mode: NEWS_03_MODES.APPLY,
    execute: true,
    confirm: NEWS_03_ROLLBACK_CONFIRM_PHRASE,
    workingTreeClean: true,
    preflightState: NEWS_03_PREFLIGHT_STATES.NOT_APPLIED,
    packageOk: true,
    identityOk: true,
    identityIsProduction: false,
    accessTokenPresent: true,
  });
  assert.equal(wrongPhrase.canWrite, false);

  const partial = evaluateNews03OwnerGoGates({
    mode: NEWS_03_MODES.APPLY,
    execute: true,
    confirm: NEWS_03_APPLY_CONFIRM_PHRASE,
    workingTreeClean: true,
    preflightState: NEWS_03_PREFLIGHT_STATES.PARTIALLY_APPLIED,
    packageOk: true,
    identityOk: true,
    identityIsProduction: false,
    accessTokenPresent: true,
  });
  assert.equal(partial.canWrite, false);

  const ok = evaluateNews03OwnerGoGates({
    mode: NEWS_03_MODES.APPLY,
    execute: true,
    confirm: NEWS_03_APPLY_CONFIRM_PHRASE,
    workingTreeClean: true,
    preflightState: NEWS_03_PREFLIGHT_STATES.NOT_APPLIED,
    packageOk: true,
    identityOk: true,
    identityIsProduction: false,
    accessTokenPresent: true,
  });
  assert.equal(ok.canWrite, true);
});

test("NEWS-03 rollback requires separate confirmation phrase", () => {
  const bad = evaluateNews03OwnerGoGates({
    mode: NEWS_03_MODES.ROLLBACK,
    execute: true,
    confirm: NEWS_03_APPLY_CONFIRM_PHRASE,
    workingTreeClean: true,
    preflightState: NEWS_03_PREFLIGHT_STATES.FULLY_APPLIED_UNVERIFIED,
    packageOk: true,
    identityOk: true,
    identityIsProduction: false,
    accessTokenPresent: true,
  });
  assert.equal(bad.canWrite, false);

  const good = evaluateNews03OwnerGoGates({
    mode: NEWS_03_MODES.ROLLBACK,
    execute: true,
    confirm: NEWS_03_ROLLBACK_CONFIRM_PHRASE,
    workingTreeClean: true,
    preflightState: NEWS_03_PREFLIGHT_STATES.FULLY_APPLIED_UNVERIFIED,
    packageOk: true,
    identityOk: true,
    identityIsProduction: false,
    accessTokenPresent: true,
  });
  assert.equal(good.canWrite, true);
});

test("NEWS-03 preflight classifications", () => {
  assert.equal(
    classifyNews03PreflightState({
      tables: [],
      functions: [],
      permissions: [],
      rls: [],
      helpers: {},
    }),
    NEWS_03_PREFLIGHT_STATES.NOT_APPLIED
  );
  assert.equal(
    classifyNews03PreflightState({
      tables: ["news_public_content_items"],
      functions: [],
      permissions: [],
      rls: [],
      helpers: {},
    }),
    NEWS_03_PREFLIGHT_STATES.PARTIALLY_APPLIED
  );
  assert.equal(
    classifyNews03PreflightState(null),
    NEWS_03_PREFLIGHT_STATES.STATE_UNKNOWN
  );
});

test("NEWS-03 secret redaction and evidence excludes secrets", () => {
  const redacted = redactNews03SecretLike(
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb password=supersecret"
  );
  assert.doesNotMatch(redacted, /eyJhbGci/);
  assert.doesNotMatch(redacted, /supersecret/);
  assert.match(redacted, /\[REDACTED\]/);
});

test("NEWS-03 plan mode is read-only and writes temp evidence only", async () => {
  const evidenceDir = tempEvidenceDir();
  const result = await runNews03StagingRollout({
    argv: ["--mode=plan"],
    env: {
      VITE_SUPABASE_URL: `https://${NEWS_03_STAGING_PROJECT_REF}.supabase.co`,
    },
    repoRoot: ROOT,
    evidenceDir,
    skipEnvLoad: true,
    gitFacts: { head: "deadbeef", workingTreeClean: true },
    transport: async () => {
      throw new Error("plan must not call transport");
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.sqlApplied, false);
  assert.equal(result.mode, NEWS_03_MODES.PLAN);
  assert.equal(result.migrationsWouldApply.length, 9);
  assert.ok(fs.existsSync(path.join(evidenceDir, "NEWS_03_PLAN.json")));
});

test("NEWS-03 apply without confirmation fails closed (no SQL)", async () => {
  const evidenceDir = tempEvidenceDir();
  const transport = mockTransportFactory();
  const result = await runNews03StagingRollout({
    argv: ["--mode=apply", "--execute"],
    env: {
      VITE_SUPABASE_URL: `https://${NEWS_03_STAGING_PROJECT_REF}.supabase.co`,
      SUPABASE_ACCESS_TOKEN: "test-token-not-real",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: "test-service-not-real",
    },
    repoRoot: ROOT,
    evidenceDir,
    skipEnvLoad: true,
    gitFacts: { head: "deadbeef", workingTreeClean: true },
    transport,
  });
  assert.equal(result.ok, false);
  assert.equal(result.verdict, NEWS_03_VERDICTS.APPLY_BLOCKED);
  assert.equal(result.sqlApplied, false);
  // May have preflight GET/POST but must not have applied migration bodies beyond inventory
  const queryBodies = transport.calls.filter((c) => c.method === "POST");
  assert.ok(queryBodies.length <= 1, "only inventory query allowed before gate fail");
});

test("NEWS-03 apply with full gates runs locked order via mock transport; no auto-rollback", async () => {
  const evidenceDir = tempEvidenceDir();
  const appliedLabels = [];
  const transport = async (req) => {
    assert.ok(req.url.includes(NEWS_03_STAGING_PROJECT_REF));
    if (req.method === "GET") {
      return {
        ok: true,
        status: 200,
        body: {
          ref: NEWS_03_STAGING_PROJECT_REF,
          name: "staging",
          status: "ACTIVE_HEALTHY",
        },
      };
    }
    const body = JSON.parse(req.body || "{}");
    const q = String(body.query || "");
    if (q.includes("jsonb_build_object")) {
      return {
        ok: true,
        status: 200,
        body: [
          {
            inventory: {
              tables: [],
              rls: [],
              policies: [],
              functions: [],
              triggers: [],
              permissions: [],
              helpers: {
                user_has_permission: true,
                is_super_admin: true,
                user_venue_id: true,
              },
            },
          },
        ],
      };
    }
    appliedLabels.push(q.slice(0, 80));
    // Fail on 3rd apply step to prove stop-on-first-error + no auto-rollback
    if (appliedLabels.length === 3) {
      return {
        ok: false,
        status: 400,
        body: { message: "simulated failure token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x.y" },
      };
    }
    return { ok: true, status: 200, body: [{ ok: true }] };
  };

  const result = await runNews03StagingRollout({
    argv: [
      "--mode=apply",
      "--execute",
      `--confirm=${NEWS_03_APPLY_CONFIRM_PHRASE}`,
    ],
    env: {
      VITE_SUPABASE_URL: `https://${NEWS_03_STAGING_PROJECT_REF}.supabase.co`,
      SUPABASE_ACCESS_TOKEN: "test-token-not-real",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: "test-service-not-real",
    },
    repoRoot: ROOT,
    evidenceDir,
    skipEnvLoad: true,
    gitFacts: { head: "deadbeef", workingTreeClean: true },
    transport,
  });

  assert.equal(result.ok, false);
  assert.equal(result.verdict, NEWS_03_VERDICTS.APPLY_PARTIAL_STOPPED);
  assert.equal(result.automaticRollback, false);
  assert.equal(result.steps.length, 2);
  assert.doesNotMatch(String(result.error || ""), /eyJhbGci/);
  const evidence = fs.readFileSync(
    path.join(evidenceDir, "NEWS_03_APPLY_RESULT.json"),
    "utf8"
  );
  assert.doesNotMatch(evidence, /eyJhbGci/);
});

test("NEWS-03 Production URL blocks harness before write", async () => {
  const evidenceDir = tempEvidenceDir();
  const result = await runNews03StagingRollout({
    argv: [
      "--mode=apply",
      "--execute",
      `--confirm=${NEWS_03_APPLY_CONFIRM_PHRASE}`,
    ],
    env: {
      VITE_SUPABASE_URL: `https://${NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST[0]}.supabase.co`,
      SUPABASE_ACCESS_TOKEN: "test-token-not-real",
    },
    repoRoot: ROOT,
    evidenceDir,
    skipEnvLoad: true,
    gitFacts: { head: "deadbeef", workingTreeClean: true },
    transport: async () => {
      throw new Error("must not network on production block");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.verdict, NEWS_03_VERDICTS.BLOCKED_PRODUCTION);
  assert.equal(result.sqlApplied, false);
});

test("NEWS-03 static gates export production blocklist", () => {
  const gates = evaluateNews03StaticGates({
    env: {},
    repoRoot: ROOT,
    mode: NEWS_03_MODES.PREFLIGHT,
    gitFacts: { head: "x", workingTreeClean: true },
  });
  assert.deepEqual(gates.productionBlocklist, [
    NEWS_03_PRODUCTION_PROJECT_REF_BLOCKLIST[0],
  ]);
  assert.equal(gates.allowlistRef, NEWS_03_STAGING_PROJECT_REF);
});
