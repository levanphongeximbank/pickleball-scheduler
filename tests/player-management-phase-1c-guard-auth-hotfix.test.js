/**
 * Phase 1C — profile guard SECURITY DEFINER bypass hotfix contracts.
 * Live JWT re-validation remains a Staging apply follow-up.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hotfixPath = path.join(
  root,
  "docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX.sql"
);
const verifyPath = path.join(
  root,
  "docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX_VERIFY.sql"
);
const rollbackPath = path.join(
  root,
  "docs/v5/PHASE_1C_PLAYER_PROFILE_GUARD_AUTH_HOTFIX_ROLLBACK.sql"
);
const foundationPath = path.join(
  root,
  "docs/v5/PHASE_1C_PLAYER_PROFILE_FOUNDATION.sql"
);

function read(p) {
  return fs.readFileSync(p, "utf8");
}

test("hotfix SQL removes current_user=postgres SECURITY DEFINER bypass", () => {
  const sql = read(hotfixPath);
  const bodyMatch = sql.match(/as\s*\$\$([\s\S]*?)\$\$;/i);
  assert.ok(bodyMatch, "function body must exist");
  const body = bodyMatch[1].replace(/--[^\n]*/g, "");
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path\s*=\s*public/i);
  assert.doesNotMatch(
    body,
    /current_user\s*=\s*'postgres'/i,
    "executable function body must not bypass via current_user=postgres"
  );
  assert.match(body, /v_auth_role\s*=\s*'service_role'/);
  assert.match(body, /auth\.uid\(\)\s+is\s+null/i);
  assert.match(body, /Cannot self-modify identity_verification_status/);
  assert.match(body, /user_has_permission\('user\.manage'\)/);
  assert.match(body, /identity_verification_status/);
  assert.match(sql, /profiles_guard_privileged_update_trg/);
});

test("hotfix preserves privileged field protections", () => {
  const sql = read(hotfixPath);
  for (const field of [
    "role",
    "status",
    "venue_id",
    "club_id",
    "identity_verification_status",
    "display_name",
    "phone",
    "avatar_url",
  ]) {
    assert.match(sql, new RegExp(field));
  }
  assert.match(sql, /Cannot modify protected profile fields/);
  assert.match(sql, /Cannot modify another user profile/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /alter table/i);
  assert.doesNotMatch(sql, /drop column/i);
});

test("verify SQL asserts no current_user bypass and self-block present", () => {
  const sql = read(verifyPath);
  assert.match(sql, /no_current_user_postgres_bypass/);
  assert.match(sql, /has_self_verification_block/);
  assert.match(sql, /has_user_manage_path/);
  assert.match(sql, /profiles_guard_privileged_update_trg/);
});

test("rollback restores defective current_user bypass intentionally", () => {
  const sql = read(rollbackPath);
  assert.match(
    sql,
    /current_user\s*=\s*'postgres'/i,
    "rollback must restore pre-hotfix defective body for exact reverse"
  );
  assert.match(sql, /Cannot self-modify identity_verification_status/);
});

test("foundation migration still documents the historical bypass (pre-hotfix)", () => {
  const sql = read(foundationPath);
  assert.match(sql, /current_user\s*=\s*'postgres'/i);
});

test("authorization matrix expectations are explicit for Staging retest", () => {
  const matrix = [
    {
      actor: "authenticated self (non super_admin)",
      action: "set identity_verification_status",
      expected: "DENIED",
    },
    {
      actor: "authenticated self",
      action: "set handedness/birth_date/privacy_settings",
      expected: "ALLOWED",
    },
    {
      actor: "user.manage same venue",
      action: "set other identity_verification_status",
      expected: "ALLOWED",
    },
    {
      actor: "authenticated other venue / no manage",
      action: "set other privileged fields",
      expected: "DENIED",
    },
    {
      actor: "service_role",
      action: "privileged update",
      expected: "ALLOWED (explicit bypass)",
    },
    {
      actor: "direct maintenance auth.uid() null / non-JWT role",
      action: "privileged update",
      expected: "ALLOWED (maintenance path)",
    },
  ];

  assert.equal(matrix.length, 6);
  assert.equal(
    matrix.find((m) => m.action === "set identity_verification_status")
      ?.expected,
    "DENIED"
  );
  assert.ok(
    matrix.every((m) => m.actor && m.action && m.expected),
    "matrix rows must be complete"
  );
});
