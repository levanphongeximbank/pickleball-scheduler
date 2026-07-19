import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(__dirname, "../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql"),
  "utf8"
);

function isolateFunction(fnName) {
  const re = new RegExp(
    `create or replace function public\\.${fnName}\\([\\s\\S]*?(?=\\ncreate or replace function|\\n-- =+\\n-- END|$)`,
    "i"
  );
  const m = sql.match(re);
  assert.ok(m, `missing function ${fnName}`);
  return m[0];
}

const helper = isolateFunction("phase42_can_manage_vice_presidents");
const assign = isolateFunction("club_assign_vice_president");
const clear = isolateFunction("club_clear_vice_president");

describe("Phase 1B security gate — VP authorization predicates", () => {
  it("defines phase42_can_manage_vice_presidents with exact allow set", () => {
    assert.match(helper, /phase42_is_platform_super_admin\(\)/);
    assert.match(
      helper,
      /phase42_has_gov_role\(p_club_id, array\['club_owner', 'president'\]\)/
    );
    assert.match(helper, /user_has_permission\('club\.update'\)/);
    assert.match(helper, /tm\.role_code = 'tenant_owner'/);
    assert.match(
      helper,
      /'VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER'/
    );
  });

  it("1–2: Owner and President are authorized via gov roles (assign + clear)", () => {
    assert.match(assign, /phase42_can_manage_vice_presidents\(v_club\.id\)/);
    assert.match(clear, /phase42_can_manage_vice_presidents\(v_club\.id\)/);
    assert.match(
      helper,
      /phase42_has_gov_role\(p_club_id, array\['club_owner', 'president'\]\)/
    );
  });

  it("3: Tenant administrator requires tenant_owner + club.update (not bare membership)", () => {
    assert.match(helper, /tm\.role_code = 'tenant_owner'/);
    assert.match(helper, /user_has_permission\('club\.update'\)/);
  });

  it("4: Ordinary tenant member / tenant_staff is NOT authorized solely by tenant_members", () => {
    assert.doesNotMatch(helper, /phase42_is_tenant_member\s*\(/);
    assert.doesNotMatch(assign, /phase42_is_tenant_member\s*\(/);
    assert.doesNotMatch(clear, /phase42_is_tenant_member\s*\(/);
    assert.doesNotMatch(helper, /tenant_staff/);
    assert.match(helper, /tm\.role_code = 'tenant_owner'/);
  });

  it("5–6: Ordinary club member and VP-alone are not in the allow list", () => {
    assert.doesNotMatch(
      helper,
      /phase42_has_gov_role\([^)]*vice_president/
    );
    assert.doesNotMatch(helper, /phase42_active_club_member_id/);
    assert.doesNotMatch(assign, /phase42_active_club_member_id/);
  });

  it("7: Inactive/left/removed targets cannot be assigned (active member required)", () => {
    assert.match(
      assign,
      /from public\.club_members\s+where club_id = v_club\.id and user_id = p_member_user_id and status = 'active'/i
    );
    assert.match(assign, /MEMBER_REQUIRED/);
  });

  it("8: President cannot also be assigned as VP", () => {
    assert.match(assign, /role_code = 'president'/);
    assert.match(assign, /v_president_user = p_member_user_id/);
    assert.match(assign, /Phó chủ tịch không thể trùng Chủ tịch/);
  });

  it("9: Maximum two active VPs is enforced", () => {
    assert.match(assign, /v_vp_count >= 2/);
    assert.match(assign, /Tối đa 2 Phó chủ tịch/);
  });

  it("security comments document the gate explicitly", () => {
    assert.match(sql, /never authorize via bare tenant-member helper/);
    assert.match(sql, /DENY:[\s\S]*bare tenant_members/);
  });
});
