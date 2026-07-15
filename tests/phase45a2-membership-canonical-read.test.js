import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MEMBERSHIP_READ_STATE,
  isCanonicalMembershipReadEnabled,
  mapRepoCodeToMembershipError,
  toMembershipReadSnapshot,
} from "../src/features/club/context/membershipCanonicalReadModel.js";
import {
  createCanonicalMembershipRepository,
  canonicalMembershipRepository,
} from "../src/features/club/repositories/index.js";
import { mapV2MemberRowToUi } from "../src/features/club/services/clubMemberService.js";
import { countActiveClubMembers } from "../src/features/club/constants/clubMemberRoles.js";
import {
  API_ERROR_CODES,
  isRegisteredApiErrorCode,
} from "../src/features/api/constants/apiErrors.js";
import { RULES, collectViolations } from "../scripts/ci/ownership-lock.mjs";
import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const readSrc = (rel) => readFileSync(path.join(root, rel), "utf8");

const PANEL = "src/pages/player/myClub/MyClubMembersPanel.jsx";
const TAB = "src/pages/clubs/tabs/ClubMembersTab.jsx";

// --- 7. canonical read gate: V2 storage OR (canonical flag AND Supabase) ---
test("isCanonicalMembershipReadEnabled is ON when Club Storage V2 is on", () => {
  assert.equal(isCanonicalMembershipReadEnabled({ v2StorageEnabled: true }), true);
  // Even with no explicit Supabase flag, V2 already implies a configured backend.
  assert.equal(
    isCanonicalMembershipReadEnabled({ v2StorageEnabled: true, hasSupabase: false }),
    true
  );
});

test("isCanonicalMembershipReadEnabled requires flag AND Supabase when V2 is off", () => {
  assert.equal(
    isCanonicalMembershipReadEnabled({ canonicalEnabled: true, hasSupabase: true }),
    true
  );
  assert.equal(
    isCanonicalMembershipReadEnabled({ canonicalEnabled: true, hasSupabase: false }),
    false
  );
  assert.equal(
    isCanonicalMembershipReadEnabled({ canonicalEnabled: false, hasSupabase: true }),
    false
  );
  assert.equal(isCanonicalMembershipReadEnabled({}), false);
});

// --- 5, 6, 7. read snapshot: loading/error NEVER leaks blob members ---
test("toMembershipReadSnapshot maps ok result to READY with members", () => {
  const snap = toMembershipReadSnapshot({ ok: true, data: [{ user_id: "u1" }] });
  assert.equal(snap.state, MEMBERSHIP_READ_STATE.READY);
  assert.equal(snap.members.length, 1);
  assert.equal(snap.errorCode, null);
});

test("toMembershipReadSnapshot maps a cloud error to ERROR with EMPTY members", () => {
  const snap = toMembershipReadSnapshot({ ok: false, code: "MEMBERSHIP_RPC_FAILED" });
  assert.equal(snap.state, MEMBERSHIP_READ_STATE.ERROR);
  assert.deepEqual(snap.members, []);
  assert.equal(snap.errorCode, API_ERROR_CODES.INTERNAL_ERROR);
});

test("toMembershipReadSnapshot treats a null/absent result as INTERNAL_ERROR with empty members", () => {
  const snap = toMembershipReadSnapshot(null);
  assert.equal(snap.state, MEMBERSHIP_READ_STATE.ERROR);
  assert.deepEqual(snap.members, []);
  assert.equal(snap.errorCode, API_ERROR_CODES.INTERNAL_ERROR);
});

// --- 8. error contract: only registered canonical codes ---
test("mapRepoCodeToMembershipError only ever returns registered canonical codes", () => {
  const codes = [
    "CLUB_OUT_OF_SCOPE",
    "CLUB_REQUIRED",
    "CLUB_ID_REQUIRED",
    "NOT_FOUND",
    "FORBIDDEN",
    "TENANT_FORBIDDEN",
    "CROSS_TENANT_ACCESS",
    "INSUFFICIENT_SCOPE",
    "MEMBERSHIP_RPC_FAILED",
    "SOMETHING_UNKNOWN",
    undefined,
  ];
  for (const code of codes) {
    assert.equal(isRegisteredApiErrorCode(mapRepoCodeToMembershipError(code)), true);
  }
  assert.equal(
    mapRepoCodeToMembershipError("CLUB_OUT_OF_SCOPE"),
    API_ERROR_CODES.CLUB_OUT_OF_SCOPE
  );
  assert.equal(mapRepoCodeToMembershipError("CLUB_ID_REQUIRED"), API_ERROR_CODES.CLUB_REQUIRED);
  assert.equal(mapRepoCodeToMembershipError("TENANT_FORBIDDEN"), API_ERROR_CODES.FORBIDDEN);
  assert.equal(
    mapRepoCodeToMembershipError("MEMBERSHIP_RPC_FAILED"),
    API_ERROR_CODES.INTERNAL_ERROR
  );
});

// --- 8 & 9 (count parity). Active-only count consistent My Club ↔ Manage Club ---
test("active-only count is identical for My Club and Manage Club (same repo contract)", async () => {
  const repo = createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: true, members: ACCC_FIXTURE.membershipRows }),
  });
  // Manage Club header derives the count from the mapped canonical rows.
  const list = await repo.listActiveClubMembers(ACCC_FIXTURE.club.id, { includeInactive: true });
  const manageCount = countActiveClubMembers(list.data.map(mapV2MemberRowToUi));
  // My Club uses the same repository count contract.
  const myClubCount = await repo.countActiveMembers(ACCC_FIXTURE.club.id);
  assert.equal(manageCount, myClubCount.data);
  assert.equal(manageCount, 10);
});

// --- app singleton is wired (dormant → active gateway) ---
test("app singleton exposes the full membership read contract", () => {
  for (const method of [
    "listActiveClubMembers",
    "listMembersByClub",
    "getActiveMembershipForUser",
    "getMemberByUserId",
    "countActiveMembers",
  ]) {
    assert.equal(typeof canonicalMembershipRepository[method], "function", method);
  }
});

// --- 9, 15, 16. CI ownership lock catches a NEW direct membership read bypass ---
test("ownership lock defines the membership-roster-read-in-ui rule", () => {
  const rule = RULES.find((r) => r.id === "membership-roster-read-in-ui");
  assert.ok(rule, "rule must exist");
  assert.deepEqual(rule.onlyIn, ["src/context/", "src/pages/", "src/components/"]);
});

test("ownership lock detects a NEW membership read bypass but not the canonical repo call", () => {
  const rule = RULES.find((r) => r.id === "membership-roster-read-in-ui");
  assert.equal(rule.match("await rpcV2ClubListMembers(club.id);").length, 1);
  assert.equal(rule.match("const rows = getClubMembers(clubId, tenantId);").length, 1);
  assert.equal(rule.match('.from("club_members").select("*")').length, 1);
  assert.equal(rule.match("loadClubExtension(clubId).members").length, 1);
  // Going through the canonical gateway must NOT be flagged.
  assert.equal(
    rule.match("await canonicalMembershipRepository.listActiveClubMembers(clubId);").length,
    0
  );
});

test("ownership lock baseline records the retained offline membership reads as debt", () => {
  const found = collectViolations();
  assert.ok(found.has("membership-roster-read-in-ui::src/pages/clubs/tabs/ClubMembersTab.jsx"));
  assert.ok(
    found.has("membership-roster-read-in-ui::src/pages/player/myClub/MyClubMembersPanel.jsx")
  );
});

// --- 1, 2, 4, 5. migrated UI surfaces read the canonical repository ---
test("MyClubMembersPanel reads the canonical repository, no direct RPC", () => {
  const src = readSrc(PANEL);
  assert.match(src, /canonicalMembershipRepository/);
  assert.match(src, /\.listActiveClubMembers\(/);
  assert.match(src, /toMembershipReadSnapshot/);
  assert.doesNotMatch(src, /rpcV2ClubListMembers\s*\(/);
});

test("ClubMembersTab reads the canonical repository, no direct RPC", () => {
  const src = readSrc(TAB);
  assert.match(src, /canonicalMembershipRepository/);
  assert.match(src, /\.listActiveClubMembers\(/);
  assert.match(src, /toMembershipReadSnapshot/);
  assert.doesNotMatch(src, /rpcV2ClubListMembers\s*\(/);
});

test("migrated surfaces gate the blob read on canonical mode (never unconditional SoT)", () => {
  // ClubMembersTab uses an explicit `if (!canonicalMembershipRead)` offline branch.
  const tab = readSrc(TAB);
  assert.match(tab, /if \(!canonicalMembershipRead\)\s*\{[\s\S]*getClubMembers\(/);

  // MyClubMembersPanel returns [] (no blob) whenever canonical read is on, so the
  // blob join only runs in the offline branch.
  const panel = readSrc(PANEL);
  assert.match(panel, /if \(canonicalMembershipRead[\s\S]*return \[\];/);
  assert.match(panel, /getClubMembers\(clubId, tenantId\)/);
  assert.doesNotMatch(panel, /useMemo\(\s*\(\)\s*=>\s*getClubMembers\(clubId, tenantId\)/);
});
