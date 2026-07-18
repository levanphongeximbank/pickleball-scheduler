import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, rel), "utf8");
}

describe("Phase 1B — RLS / audit / flag ON-OFF regression contracts", () => {
  it("Phase 1B SQL keeps SECURITY DEFINER + grant authenticated only on VP RPCs", () => {
    const sql = read("../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql");
    for (const fn of ["club_assign_vice_president", "club_clear_vice_president"]) {
      const re = new RegExp(
        `create or replace function public\\.${fn}[\\s\\S]*?security definer[\\s\\S]*?set search_path = public`,
        "i"
      );
      assert.match(sql, re);
    }
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /^\s*TRUNCATE\b/im);
    assert.doesNotMatch(sql, /^\s*drop table\b/im);
  });

  it("VP RPCs emit audit actions; whitelist lives in additive prerequisite SQL", () => {
    const vpSql = read("../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql");
    assert.match(vpSql, /PHASE_1B_AUDIT_WHITELIST_ADDITIVE\.sql/);
    assert.doesNotMatch(vpSql, /add constraint\s+audit_logs_action_check/i);
    assert.match(vpSql, /phase42_write_audit\(\s*'club\.assign_vice_president'/);
    assert.match(vpSql, /phase42_write_audit\(\s*'club\.clear_vice_president'/);

    const additive = read("../docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql");
    for (const action of [
      "club.update",
      "club.member.add",
      "club.member.remove",
      "club.member.restore",
      "club.assign_vice_president",
      "club.clear_vice_president",
      "club.vice_president.assign",
      "pairing_override",
      "group_override",
    ]) {
      assert.match(additive, new RegExp(`'${action.replace(/\./g, "\\.")}'`));
    }
    assert.match(additive, /select distinct action/i);
    assert.match(additive, /union/i);
  });

  it("notification bridge uses club_list_members under V2 and blob path under V1", () => {
    const src = read("../src/features/club/services/clubScheduleNotificationBridge.js");
    assert.match(src, /isClubStorageV2Enabled\(\)/);
    assert.match(src, /rpcV2ClubListMembers/);
    assert.match(src, /getClubMembers/);
    assert.match(src, /loadPlayersForClub/);
    const fnStart = src.indexOf("async function listClubMemberAuthUserIds");
    const fn = src.slice(fnStart, fnStart + 1200);
    const v2Idx = fn.indexOf("isClubStorageV2Enabled()");
    const listIdx = fn.indexOf("rpcV2ClubListMembers");
    const legacyIdx = fn.indexOf("getClubMembers");
    assert.ok(v2Idx >= 0 && listIdx > v2Idx);
    assert.ok(legacyIdx > listIdx);
  });

  it("restoreMemberToClub is V2-only; add/remove keep V1 legacy fallbacks", () => {
    const member = read("../src/features/club/services/clubMemberService.js");
    assert.match(member, /export async function restoreMemberToClub/);
    assert.match(member, /rpcV2ClubRestoreMember/);
    assert.match(member, /FEATURE_DISABLED/);

    const add = member.slice(member.indexOf("export async function addMemberToClub"));
    assert.match(add, /isClubStorageV2Enabled\(\)/);
    assert.match(add, /addMemberToClubLegacy/);

    const remove = member.slice(member.indexOf("export async function removeMemberFromClub"));
    assert.match(remove, /removeMemberFromClubLegacy/);
  });

  it("club_update / add / remove / restore client transports remain gated", () => {
    const rpc = read("../src/features/club/services/clubStorageV2RpcService.js");
    assert.match(rpc, /callRpc\("club_update"/);
    assert.match(rpc, /callRpc\("club_add_member"/);
    assert.match(rpc, /callRpc\("club_remove_member"/);
    assert.match(rpc, /callRpc\("club_restore_member"/);

    const tenant = read("../src/features/club/services/clubTenantService.js");
    assert.match(tenant, /rpcV2ClubUpdate/);
    assert.match(tenant, /isClubStorageV2Enabled\(\)/);
  });

  it("Production apply is explicitly not claimed in Phase 1B SQL header", () => {
    const sql = read("../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql");
    assert.match(sql, /DO NOT run on Production/i);
    assert.match(sql, /Production deployment status: NOT APPLIED/i);
  });
});
