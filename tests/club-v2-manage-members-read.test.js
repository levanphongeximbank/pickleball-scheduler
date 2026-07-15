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

// Phase 45A.2 — Manage members tab reads the roster through the canonical
// Membership repository (single application read gateway), not a direct RPC.
test("Manage members tab reads member list from canonicalMembershipRepository", () => {
  const src = readSrc(TAB);
  assert.match(src, /canonicalMembershipRepository/);
  assert.match(src, /\.listActiveClubMembers\(\s*club\.id,\s*\{\s*includeInactive:\s*true\s*\}\s*\)/);
  assert.match(src, /\.map\(mapV2MemberRowToUi\)/);
  assert.match(src, /isCanonicalMembershipReadEnabled/);
  // The direct RPC read must be gone from the UI after the cutover.
  assert.doesNotMatch(src, /rpcV2ClubListMembers\s*\(/);
});

test("Manage members tab keeps the legacy blob read behind a !canonical guard only", () => {
  const src = readSrc(TAB);
  assert.match(src, /if \(!canonicalMembershipRead\)\s*\{[\s\S]*getClubMembers\(club\.id, tenantId\)/);
  // Must not read the blob unconditionally as the member SoT.
  assert.doesNotMatch(src, /useMemo\(\s*\(\)\s*=>\s*getClubMembers\(club\.id, tenantId\)/);
});

test("Manage members tab renders loading / empty / error states", () => {
  const src = readSrc(TAB);
  assert.match(src, /membersLoading/);
  assert.match(src, /membersError/);
  assert.match(src, /CircularProgress/);
  assert.match(src, /CLB chưa có thành viên/);
  // Cloud read maps through the explicit snapshot: an error/loading NEVER backfills the blob.
  assert.match(src, /toMembershipReadSnapshot/);
  assert.match(src, /MEMBERSHIP_READ_STATE\.ERROR/);
  assert.match(src, /list:\s*\[\]/);
});

test("Manage members mutations are gated off in canonical mode (read-only, legacy blob)", () => {
  const src = readSrc(TAB);
  assert.match(src, /mutationsEnabled\s*=\s*canManage\s*&&\s*!canonicalMembershipRead/);
  assert.match(src, /\{mutationsEnabled && \(/);
  assert.match(src, /\{mutationsEnabled \? \(/);
});

test("Manage members tab introduces no direct Supabase call and no new gateway", () => {
  const src = readSrc(TAB);
  // hasSupabaseConfig (a config predicate) is allowed; a direct client/rpc is not.
  assert.doesNotMatch(src, /createClient/);
  assert.doesNotMatch(src, /\.rpc\(/);
  assert.doesNotMatch(src, /supabaseClient\.(from|rpc|auth)/);
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
