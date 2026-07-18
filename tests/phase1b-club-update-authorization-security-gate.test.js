import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const gateSql = readFileSync(
  join(__dirname, "../docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql"),
  "utf8"
);
const updateSql = readFileSync(
  join(__dirname, "../docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql"),
  "utf8"
);
const vpSql = readFileSync(
  join(__dirname, "../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql"),
  "utf8"
);

function isolateFunction(sql, fnName) {
  const re = new RegExp(
    `create or replace function public\\.${fnName}\\([\\s\\S]*?(?=\\ncreate or replace function|\\n-- =+\\n-- END|$)`,
    "i"
  );
  const m = sql.match(re);
  assert.ok(m, `missing function ${fnName}`);
  return m[0];
}

const helper = isolateFunction(gateSql, "phase42_can_update_club");
const clubUpdate = isolateFunction(gateSql, "club_update");
const updateRpcBody = isolateFunction(updateSql, "club_update");
const updateHelper = isolateFunction(updateSql, "phase42_can_update_club");

describe("Phase 1B security gate — club_update authorization predicates", () => {
  it("defines phase42_can_update_club with exact allow set", () => {
    for (const src of [helper, updateHelper]) {
      assert.match(src, /phase42_is_platform_super_admin\(\)/);
      assert.match(
        src,
        /phase42_has_gov_role\(p_club_id, array\['club_owner', 'president'\]\)/
      );
      assert.match(src, /user_has_permission\('club\.update'\)/);
      assert.match(src, /tm\.role_code = 'tenant_owner'/);
      assert.match(src, /'VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER'/);
    }
  });

  it("SUPER_ADMIN / Owner / President are authorized", () => {
    assert.match(helper, /phase42_is_platform_super_admin\(\)/);
    assert.match(
      helper,
      /phase42_has_gov_role\(p_club_id, array\['club_owner', 'president'\]\)/
    );
    assert.match(clubUpdate, /phase42_can_update_club\(v_club\.id\)/);
    assert.match(updateRpcBody, /phase42_can_update_club\(v_club\.id\)/);
  });

  it("Explicit Tenant Owner / Tenant Admin requires club.update + owner role", () => {
    assert.match(helper, /tm\.role_code = 'tenant_owner'/);
    assert.match(helper, /user_has_permission\('club\.update'\)/);
    assert.match(helper, /'VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER'/);
  });

  it("DENY: ordinary tenant member — no bare phase42_is_tenant_member", () => {
    assert.doesNotMatch(helper, /phase42_is_tenant_member\s*\(/);
    assert.doesNotMatch(clubUpdate, /phase42_is_tenant_member\s*\(/);
    assert.doesNotMatch(updateRpcBody, /phase42_is_tenant_member\s*\(/);
    assert.doesNotMatch(helper, /tenant_staff/);
  });

  it("DENY: ordinary club member / Player — not in allow list", () => {
    assert.doesNotMatch(helper, /phase42_active_club_member_id/);
    assert.doesNotMatch(
      helper,
      /phase42_has_gov_role\([^)]*vice_president/
    );
    assert.doesNotMatch(helper, /role_code = 'player'/i);
  });

  it("DENY: Vice President alone — not in gov allow array", () => {
    assert.match(
      helper,
      /phase42_has_gov_role\(p_club_id, array\['club_owner', 'president'\]\)/
    );
    assert.doesNotMatch(
      helper,
      /array\['club_owner',\s*'president',\s*'vice_president'\]/
    );
  });

  it("DENY: unrelated authenticated user — no open authenticated bypass", () => {
    assert.match(clubUpdate, /auth\.uid\(\) is null/);
    assert.match(clubUpdate, /FORBIDDEN/);
    assert.match(clubUpdate, /phase42_can_update_club\(v_club\.id\)/);
  });

  it("does not alter VP authorization helpers or RPCs", () => {
    assert.doesNotMatch(gateSql, /phase42_can_manage_vice_presidents/);
    assert.doesNotMatch(gateSql, /club_assign_vice_president/);
    assert.doesNotMatch(gateSql, /club_clear_vice_president/);
    assert.match(vpSql, /phase42_can_manage_vice_presidents/);
    assert.doesNotMatch(
      isolateFunction(vpSql, "club_assign_vice_president"),
      /phase42_can_update_club/
    );
  });

  it("Staging patch is idempotent CREATE OR REPLACE and Production-not-applied", () => {
    assert.match(gateSql, /create or replace function public\.phase42_can_update_club/i);
    assert.match(gateSql, /create or replace function public\.club_update/i);
    assert.match(gateSql, /Production deployment status: NOT APPLIED/i);
    assert.doesNotMatch(gateSql, /^\s*TRUNCATE\b/im);
    assert.doesNotMatch(gateSql, /^\s*DROP\s+TABLE\b/im);
    assert.doesNotMatch(gateSql, /create policy/i);
  });
});
