/**
 * COACHING-02 — SQL / RLS static contract tests.
 * Reads authored SQL files only. Does not apply. No database. No secrets.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COACHING_ACTIONS,
  COACHING_ACTION_VALUES,
} from "../src/features/coaching/constants/actions.js";
import {
  COACHING_IDENTITY_PERMISSION_VALUES,
  COACHING_PERMISSION_MANIFEST,
} from "../src/features/coaching/constants/permissions.js";
import { COACHING_02_TABLES, COACHING_02_RPC } from "../src/features/coaching/persistence/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACK = path.join(ROOT, "docs/coaching-training/coaching-02");

function readPack(name) {
  return readFileSync(path.join(PACK, name), "utf8");
}

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const EXPECTED_FILES = [
  "00_COACHING_02_EXECUTIVE_SUMMARY.md",
  "01_DURABLE_PERSISTENCE_ARCHITECTURE.md",
  "02_PHASE_28_DRIFT_AND_DISPOSITION.md",
  "03_RLS_AND_AUTHORIZATION_DESIGN.md",
  "04_IDENTITY_PERMISSION_HANDOFF.md",
  "10_COACHING_02_TABLES.sql",
  "15_COACHING_02_PERMISSION_SEED.sql",
  "20_COACHING_02_INDEXES.sql",
  "30_COACHING_02_RLS.sql",
  "40_COACHING_02_ATTENDANCE_CORRECTION_RPC.sql",
  "45_COACHING_02_ENTITLEMENT_CONSUME_RPC.sql",
  "50_COACHING_02_GRANTS.sql",
  "60_COACHING_02_IMMUTABLE.sql",
  "90_COACHING_02_ROLLBACK.sql",
  "99_COACHING_02_VERIFICATION.sql",
];

const CANONICAL_TABLES = [
  "coaching_programs",
  "coaching_coach_references",
  "coaching_coach_player_relationships",
  "coaching_enrollments",
  "coaching_curricula",
  "coaching_lessons",
  "coaching_training_sessions",
  "coaching_attendance_records",
  "coaching_attendance_corrections",
  "coaching_packages",
  "coaching_package_entitlements",
  "coaching_package_usage_events",
  "coaching_evaluations",
];

describe("COACHING-02 SQL package presence", () => {
  test("all canonical pack files exist", () => {
    for (const file of EXPECTED_FILES) {
      assert.ok(existsSync(path.join(PACK, file)), `missing ${file}`);
    }
  });

  test("Phase 28 is not deleted and is dispositioned as non-canonical", () => {
    assert.ok(existsSync(path.join(ROOT, "docs/v5/PHASE_28_COACHING.sql")));
    const disposition = readPack("02_PHASE_28_DRIFT_AND_DISPOSITION.md");
    assert.match(disposition, /not.*canonical apply source/i);
    assert.match(disposition, /Replace/i);
    assert.doesNotMatch(
      readFileSync(path.join(ROOT, "docs/v5/PHASE_28_COACHING.sql"), "utf8"),
      /coaching_programs/
    );
  });
});

describe("COACHING-02 tables and constraints", () => {
  test("canonical tables and required columns", () => {
    const tables = stripSqlComments(readPack("10_COACHING_02_TABLES.sql"));
    for (const table of CANONICAL_TABLES) {
      assert.match(tables, new RegExp(`CREATE TABLE public\\.${table}\\b`));
      assert.match(tables, new RegExp(`${table}[\\s\\S]*?tenant_id text NOT NULL`));
      assert.match(tables, new RegExp(`${table}[\\s\\S]*?club_id text NOT NULL`));
    }
    assert.match(tables, /version integer NOT NULL/);
    assert.match(tables, /version_positive/);
    assert.match(tables, /created_at timestamptz NOT NULL/);
    assert.match(tables, /updated_at timestamptz NOT NULL/);
    assert.match(tables, /schedule_starts_at/);
    assert.match(tables, /revises_evaluation_id/);
    assert.match(tables, /external_payment_reference/);
    assert.match(tables, /idempotency_key/);
    // No Finance price SoT, no coach name profile columns
    assert.doesNotMatch(tables, /\bprice\b/);
    assert.doesNotMatch(tables, /references public\.venues/);
    assert.doesNotMatch(tables, /CREATE TABLE IF NOT EXISTS/);
  });

  test("lifecycle and version constraints present", () => {
    const tables = stripSqlComments(readPack("10_COACHING_02_TABLES.sql"));
    assert.match(tables, /draft.*active.*suspended.*completed.*archived/s);
    assert.match(tables, /absent.*present.*late.*excused/s);
    assert.match(tables, /coaching_acorr_version_fixed[\s\S]*version = 1/);
    assert.match(tables, /coaching_usage_version_fixed[\s\S]*version = 1/);
  });

  test("indexes cover tenant/club scoped reads", () => {
    const indexes = stripSqlComments(readPack("20_COACHING_02_INDEXES.sql"));
    assert.match(indexes, /coaching_programs_tenant_club_idx/);
    assert.match(indexes, /coaching_attendance_tenant_club_idx/);
    assert.match(indexes, /coaching_entitlements_tenant_club_player_idx/);
  });
});

describe("COACHING-02 RLS and grants", () => {
  test("ENABLE + FORCE RLS, fail-closed helpers, dedicated actions", () => {
    const rls = stripSqlComments(readPack("30_COACHING_02_RLS.sql"));
    for (const table of CANONICAL_TABLES) {
      assert.match(rls, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
      assert.match(rls, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`));
    }
    assert.match(rls, /coaching_02_scope_allows/);
    assert.match(rls, /user_venue_id\(\)/);
    assert.match(rls, /user_club_id\(\)/);
    assert.match(rls, /user_has_permission/);
    assert.match(rls, /is_super_admin/);
    assert.match(rls, /SET search_path = public, pg_temp/);

    for (const action of COACHING_ACTION_VALUES) {
      assert.match(rls, new RegExp(`'${action.replace(/\./g, "\\.")}'`));
    }

    assert.doesNotMatch(rls, /USING\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(rls, /WITH CHECK\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(rls, /TO anon/i);
    assert.doesNotMatch(rls, /FOR ALL/);
  });

  test("append-only tables have no UPDATE/DELETE policies", () => {
    const rls = stripSqlComments(readPack("30_COACHING_02_RLS.sql"));
    assert.doesNotMatch(rls, /coaching_acorr_update/);
    assert.doesNotMatch(rls, /coaching_acorr_delete/);
    assert.doesNotMatch(rls, /coaching_usage_update/);
    assert.doesNotMatch(rls, /coaching_usage_delete/);
  });

  test("grants revoke PUBLIC/anon write and RPC execute from PUBLIC", () => {
    const grants = stripSqlComments(readPack("50_COACHING_02_GRANTS.sql"));
    assert.match(grants, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC/);
    assert.match(grants, /REVOKE ALL ON TABLE[\s\S]*FROM anon/);
    assert.match(grants, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);
    assert.match(grants, /GRANT EXECUTE[\s\S]*TO service_role/);
    assert.doesNotMatch(grants, /GRANT ALL[\s\S]*TO PUBLIC/);
    assert.doesNotMatch(grants, /GRANT[\s\S]*TO anon/);
  });
});

describe("COACHING-02 atomic RPCs and immutability", () => {
  test("attendance correction RPC security + transactional semantics", () => {
    const rpc = stripSqlComments(readPack("40_COACHING_02_ATTENDANCE_CORRECTION_RPC.sql"));
    assert.match(rpc, /CREATE OR REPLACE FUNCTION public\.coaching_apply_attendance_correction/);
    assert.match(rpc, /SECURITY DEFINER/);
    assert.match(rpc, /SET search_path = public, pg_temp/);
    assert.match(rpc, /FOR UPDATE/);
    assert.match(rpc, /COACHING_VERSION_CONFLICT/);
    assert.match(rpc, /coaching\.attendance\.correct/);
    assert.match(rpc, /INSERT INTO public\.coaching_attendance_corrections/);
    assert.match(rpc, /UPDATE public\.coaching_attendance_records/);
    assert.match(rpc, /REVOKE ALL[\s\S]*FROM PUBLIC/);
    assert.match(rpc, /REVOKE ALL[\s\S]*FROM anon/);
    assert.equal(COACHING_02_RPC.APPLY_ATTENDANCE_CORRECTION, "coaching_apply_attendance_correction");
  });

  test("entitlement consume RPC atomicity + idempotency", () => {
    const rpc = stripSqlComments(readPack("45_COACHING_02_ENTITLEMENT_CONSUME_RPC.sql"));
    assert.match(rpc, /CREATE OR REPLACE FUNCTION public\.coaching_consume_entitlement/);
    assert.match(rpc, /SECURITY DEFINER/);
    assert.match(rpc, /SET search_path = public, pg_temp/);
    assert.match(rpc, /idempotency_key/);
    assert.match(rpc, /COACHING_ENTITLEMENT_EXHAUSTED/);
    assert.match(rpc, /COACHING_VERSION_CONFLICT/);
    assert.match(rpc, /coaching\.entitlement\.consume/);
    assert.match(rpc, /INSERT INTO public\.coaching_package_usage_events/);
    assert.match(rpc, /FOR UPDATE/);
    assert.match(rpc, /REVOKE ALL[\s\S]*FROM PUBLIC/);
  });

  test("immutability triggers with fixed search_path", () => {
    const imm = stripSqlComments(readPack("60_COACHING_02_IMMUTABLE.sql"));
    assert.match(imm, /coaching_attendance_corrections_immutable_guard/);
    assert.match(imm, /coaching_package_usage_events_immutable_guard/);
    assert.match(imm, /coaching_evaluations_submitted_immutable_guard/);
    assert.match(imm, /SET search_path = public, pg_temp/);
    assert.match(imm, /BEFORE UPDATE OR DELETE ON public\.coaching_attendance_corrections/);
    assert.match(imm, /BEFORE UPDATE OR DELETE ON public\.coaching_package_usage_events/);
  });
});

describe("COACHING-02 rollback and verification", () => {
  test("rollback drops coaching objects and leaves shared helpers", () => {
    const rollback = stripSqlComments(readPack("90_COACHING_02_ROLLBACK.sql"));
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.coaching_apply_attendance_correction/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.coaching_consume_entitlement/);
    assert.match(rollback, /DROP TRIGGER IF EXISTS coaching_attendance_corrections_immutable_trg/);
    for (const table of CANONICAL_TABLES) {
      assert.match(rollback, new RegExp(`DROP TABLE IF EXISTS public\\.${table}`));
    }
    assert.doesNotMatch(rollback, /DROP FUNCTION[\s\S]*user_has_permission/);
    assert.doesNotMatch(rollback, /DROP FUNCTION[\s\S]*user_venue_id/);
    assert.doesNotMatch(rollback, /DROP TABLE[\s\S]*permissions/);
  });

  test("verification is read-only and covers readiness checks", () => {
    const verify = readPack("99_COACHING_02_VERIFICATION.sql");
    assert.match(verify, /READ-ONLY|read-only/i);
    assert.match(verify, /relrowsecurity/);
    assert.match(verify, /relforcerowsecurity/);
    assert.match(verify, /pg_policies/);
    assert.match(verify, /coaching_apply_attendance_correction/);
    assert.match(verify, /coaching_consume_entitlement/);
    assert.match(verify, /information_schema\.table_privileges/);
    const verifyBody = stripSqlComments(verify);
    assert.doesNotMatch(verifyBody, /^\s*(INSERT|UPDATE|DELETE|DROP|CREATE)\b/im);
    assert.doesNotMatch(verifyBody, /\b(INSERT INTO|UPDATE\s+public|DELETE FROM|DROP TABLE|CREATE TABLE)\b/i);
  });
});

describe("COACHING-02 permission mapping and no-apply safety", () => {
  test("14 actions map 1:1 to Identity permission ids", () => {
    assert.equal(COACHING_ACTION_VALUES.length, 14);
    assert.equal(COACHING_IDENTITY_PERMISSION_VALUES.length, 14);
    for (const action of COACHING_ACTION_VALUES) {
      assert.ok(COACHING_IDENTITY_PERMISSION_VALUES.includes(action));
    }
    assert.equal(COACHING_PERMISSION_MANIFEST.roleGrantsIncluded, false);
    assert.equal(COACHING_PERMISSION_MANIFEST.identityInternalsModified, false);

    const seed = stripSqlComments(readPack("15_COACHING_02_PERMISSION_SEED.sql"));
    for (const action of Object.values(COACHING_ACTIONS)) {
      assert.match(seed, new RegExp(`'${action.replace(/\./g, "\\.")}'`));
    }
    assert.doesNotMatch(seed, /role_permissions/);
    assert.doesNotMatch(seed, /INSERT INTO public\.role_permissions/);
  });

  test("no apply command / no secrets in coaching-02 pack or persistence", () => {
    const packFiles = EXPECTED_FILES.filter((f) => f.endsWith(".sql") || f.endsWith(".md"));
    for (const file of packFiles) {
      const body = readPack(file);
      assert.doesNotMatch(body, /supabase\s+db\s+push/i);
      assert.doesNotMatch(body, /psql\s+/i);
      assert.doesNotMatch(body, /DATABASE_URL\s*=/);
      assert.doesNotMatch(body, /service_role_key\s*=/i);
      assert.doesNotMatch(body, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    }
    assert.deepEqual(
      Object.values(COACHING_02_TABLES).sort(),
      [...CANONICAL_TABLES].sort()
    );
  });

  test("SQL not wired into apply scripts or package.json scripts", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const scripts = JSON.stringify(pkg.scripts || {});
    assert.doesNotMatch(scripts, /COACHING_02/);
    assert.doesNotMatch(scripts, /coaching-02/);
    assert.doesNotMatch(scripts, /PHASE_28_COACHING/);
  });
});
