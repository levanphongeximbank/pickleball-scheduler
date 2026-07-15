import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mapV2MemberRowToUi } from "../src/features/club/services/clubMemberService.js";
import {
  countActiveClubMembers,
  isClubMemberStatusActive,
} from "../src/features/club/constants/clubMemberRoles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const readSrc = (rel) => readFileSync(path.join(root, rel), "utf8");

const TAB = "src/pages/clubs/tabs/ClubMembersTab.jsx";

test("Manage members tab reads member list from club_list_members V2 RPC", () => {
  const src = readSrc(TAB);
  assert.match(src, /rpcV2ClubListMembers\(club\.id\)/);
  assert.match(src, /\.map\(mapV2MemberRowToUi\)/);
  assert.match(src, /isClubStorageV2Enabled\(\)/);
});

test("Manage members tab keeps the legacy blob read behind a !v2 guard only", () => {
  const src = readSrc(TAB);
  assert.match(src, /if \(!v2Enabled\)\s*\{[\s\S]*getClubMembers\(club\.id, tenantId\)/);
  // Must not read the blob unconditionally as the member SoT anymore.
  assert.doesNotMatch(src, /useMemo\(\s*\(\)\s*=>\s*getClubMembers\(club\.id, tenantId\)/);
});

test("Manage members tab renders loading / empty / error states", () => {
  const src = readSrc(TAB);
  assert.match(src, /membersLoading/);
  assert.match(src, /membersError/);
  assert.match(src, /CircularProgress/);
  assert.match(src, /CLB chưa có thành viên/);
  // V2 RPC failure must not silently backfill from blob.
  assert.match(src, /status: "error",\s*list: \[\],/);
});

test("Manage members mutations are gated off under V2 (read-only, legacy blob)", () => {
  const src = readSrc(TAB);
  assert.match(src, /mutationsEnabled\s*=\s*canManage\s*&&\s*!v2Enabled/);
  assert.match(src, /\{mutationsEnabled && \(/);
  assert.match(src, /\{mutationsEnabled \? \(/);
});

test("Manage members tab introduces no direct Supabase call and no new gateway", () => {
  const src = readSrc(TAB);
  assert.doesNotMatch(src, /supabaseClient/);
  assert.doesNotMatch(src, /createClient/);
  assert.doesNotMatch(src, /\.rpc\(/);
  assert.doesNotMatch(src, /listClubMembersAsync/);
  assert.doesNotMatch(src, /clubExtensionStorage/);
});

test("left / removed / rejected rows are never counted active on manage surface", () => {
  const rows = [
    { id: "1", user_id: "u1", display_name: "A", status: "active", governance_roles: [] },
    { id: "2", user_id: "u2", display_name: "B", status: "active", governance_roles: [] },
    { id: "3", user_id: "u3", display_name: "C", status: "left", governance_roles: [] },
    { id: "4", user_id: "u4", display_name: "D", status: "removed", governance_roles: [] },
    { id: "5", user_id: "u5", display_name: "E", status: "rejected", governance_roles: [] },
  ].map(mapV2MemberRowToUi);

  assert.equal(countActiveClubMembers(rows), 2);
  assert.equal(isClubMemberStatusActive(rows.find((r) => r.id === "3").status), false);
  assert.equal(isClubMemberStatusActive(rows.find((r) => r.id === "4").status), false);
  assert.equal(isClubMemberStatusActive(rows.find((r) => r.id === "5").status), false);
});
