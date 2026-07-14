import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { getPermissionsForRole, roleHasPermission } from "../src/features/identity/matrix/rolePermissions.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { PRIVATE_PAIRING_PR4_FIXTURE } from "../src/features/private-pairing-rules/testing/pr4SecurityFixture.js";
import {
  PRIVATE_PAIRING_DB_CODE,
  PRIVATE_PAIRING_RPC,
  PRIVATE_PAIRING_TABLES,
} from "../src/features/private-pairing-rules/constants/dbCodes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql");
const sql = readFileSync(sqlPath, "utf8");

describe("PR-4 private pairing — SQL security contract", () => {
  it("creates the four private tables", () => {
    for (const table of PRIVATE_PAIRING_TABLES) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    }
  });

  it("enables RLS and does not grant write to authenticated", () => {
    for (const table of PRIVATE_PAIRING_TABLES) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
    }
    assert.doesNotMatch(sql, /grant insert on public\.private_pairing_/i);
    assert.doesNotMatch(sql, /grant update on public\.private_pairing_/i);
    assert.doesNotMatch(sql, /grant delete on public\.private_pairing_/i);
  });

  it("does not use using (true) policies", () => {
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  });

  it("keeps private tables out of realtime publication", () => {
    assert.doesNotMatch(sql, /alter publication\s+supabase_realtime/i);
    assert.match(sql, /NOT published to supabase_realtime/);
  });

  it("seeds permissions only for SUPER_ADMIN / PLATFORM_ADMIN", () => {
    for (const perm of PRIVATE_PAIRING_PR4_FIXTURE.permissions) {
      assert.match(sql, new RegExp(perm.replace(/\./g, "\\.")));
    }
    assert.match(sql, /\('SUPER_ADMIN'\),\s*\('PLATFORM_ADMIN'\)/);
    assert.match(sql, /delete from public\.role_permissions/);
    assert.match(sql, /SYSTEM_TECHNICIAN/);
    assert.match(sql, /CLUB_OWNER/);
    assert.match(sql, /TOURNAMENT_DIRECTOR/);
  });

  it("defines required RPCs as SECURITY DEFINER with fixed search_path", () => {
    for (const rpc of Object.values(PRIVATE_PAIRING_RPC)) {
      assert.match(sql, new RegExp(`function public\\.${rpc}`));
    }
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = public, pg_temp/);
  });

  it("activates with preflight + content hash (architecture A)", () => {
    assert.match(sql, /p_preflight_ok boolean/);
    assert.match(sql, /p_content_hash text/);
    assert.match(sql, /content_hash mismatch/);
    assert.match(sql, /private_pairing_compute_rule_set_hash/);
  });

  it("enforces append-only audit and soft-delete rules", () => {
    assert.match(sql, /AUDIT_APPEND_ONLY/);
    assert.match(sql, /HARD_DELETE_FORBIDDEN/);
    assert.match(sql, /private_pairing_write_audit/);
  });

  it("documents stable error codes", () => {
    for (const code of [
      PRIVATE_PAIRING_DB_CODE.PERMISSION_DENIED,
      PRIVATE_PAIRING_DB_CODE.CROSS_TENANT_ACCESS,
      PRIVATE_PAIRING_DB_CODE.SELF_TARGET_NOT_ALLOWED,
      PRIVATE_PAIRING_DB_CODE.EMPTY_TARGET_LIST,
      PRIVATE_PAIRING_DB_CODE.RULE_SET_NOT_EDITABLE,
      PRIVATE_PAIRING_DB_CODE.RULE_SET_CONFLICT,
      PRIVATE_PAIRING_DB_CODE.SOFT_WEIGHT_REQUIRED,
      PRIVATE_PAIRING_DB_CODE.HARD_WEIGHT_NOT_ALLOWED,
    ]) {
      assert.match(sql, new RegExp(code));
    }
  });

  it("ensures only one active version per logical_id", () => {
    assert.match(sql, /private_pairing_rule_sets_one_active_uidx/);
    assert.match(sql, /where status = 'active'/);
  });
});

describe("PR-4 private pairing — client RBAC matrix", () => {
  const perms = [
    PERMISSIONS.PAIRING_PRIVATE_RULES_VIEW,
    PERMISSIONS.PAIRING_PRIVATE_RULES_MANAGE,
    PERMISSIONS.PAIRING_PRIVATE_RULES_AUDIT,
    PERMISSIONS.PAIRING_PRIVATE_RULES_SIMULATE,
  ];

  it("PLATFORM_ADMIN / SUPER_ADMIN receive the four permissions", () => {
    for (const role of [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN]) {
      for (const permission of perms) {
        assert.equal(roleHasPermission(role, permission), true, `${role} missing ${permission}`);
      }
    }
  });

  it("does not grant private pairing permissions to blocked roles", () => {
    const probeRoles = [
      ROLES.SYSTEM_TECHNICIAN,
      ROLES.CLUB_OWNER,
      ROLES.CLUB_MANAGER,
      ROLES.TOURNAMENT_MANAGER,
      ROLES.REFEREE,
      ROLES.PLAYER,
      ROLES.VENUE_MANAGER,
      ROLES.COACH,
    ];
    for (const role of probeRoles) {
      for (const permission of perms) {
        assert.equal(
          roleHasPermission(role, permission),
          false,
          `${role} must not have ${permission}`
        );
      }
    }
  });

  it("SYSTEM_TECHNICIAN curated list excludes private pairing permissions", () => {
    const list = getPermissionsForRole(ROLES.SYSTEM_TECHNICIAN);
    for (const permission of perms) {
      assert.equal(list.includes(permission), false);
    }
  });
});
