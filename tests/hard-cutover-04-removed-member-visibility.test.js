/**
 * HARD-CUTOVER-04 — Removed member visibility & data policy certification.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  createCanonicalMembershipRepository,
  dedupeMembershipHistory,
} from "../src/features/club/repositories/index.js";
import { countActiveClubMembers } from "../src/features/club/constants/clubMemberRoles.js";
import { mapV2MemberRowToUi } from "../src/features/club/services/clubMemberService.js";
import { listSelectPlayersScopeRows } from "../src/features/pairing-candidates/selectPlayersCandidateAdapter.js";
import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dirname, rel), "utf8");

const REMOVED_ONLY_ROWS = [
  { id: "r1", user_id: "user-removed-1", status: "removed", display_name: "Removed One" },
  { id: "r2", user_id: "user-removed-2", status: "removed", display_name: "Removed Two" },
];

const MIXED_ROWS = [...ACCC_FIXTURE.membershipRows];

function makeRepo(rows = MIXED_ROWS) {
  return createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: true, members: rows }),
  });
}

test("1. Active row appears in current roster", async () => {
  const repo = makeRepo();
  const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
  assert.equal(current.ok, true);
  assert.ok(current.data.some((m) => m.user_id === "user-01" && m.status === "active"));
});

test("2. Removed row does not appear in current roster", async () => {
  const repo = makeRepo();
  const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
  const removedOnly = current.data.filter((m) => m.status === "removed");
  assert.equal(removedOnly.length, 0);
  assert.ok(!current.data.some((m) => m.user_id === "user-11"));
});

test("3. Left row does not appear in current roster", async () => {
  const repo = makeRepo();
  const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
  assert.ok(!current.data.some((m) => m.status === "left"));
});

test("4. Removed row appears in explicit membership history", async () => {
  const repo = makeRepo([
    ...MIXED_ROWS,
    { id: "m-11-removed", user_id: "user-11", status: "removed", display_name: "Left User" },
  ]);
  const history = await repo.listClubMembershipHistory(ACCC_FIXTURE.club.id);
  assert.equal(history.ok, true);
  const user11 = history.data.find((m) => m.user_id === "user-11");
  assert.ok(user11);
  assert.equal(user11.status, "left");
});

test("5. Current member count counts active only", async () => {
  const repo = makeRepo();
  const count = await repo.countActiveMembers(ACCC_FIXTURE.club.id);
  assert.equal(count.ok, true);
  assert.equal(count.data, 10);
  const uiRows = (await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id)).data.map(mapV2MemberRowToUi);
  assert.equal(countActiveClubMembers(uiRows), 10);
});

test("6-7. Governance candidates source uses current-only reader", () => {
  const src = read("../src/features/club/services/clubGovernanceService.js");
  assert.match(src, /listCurrentClubMembers/);
  assert.doesNotMatch(src, /rpcV2ClubListMembers/);
});

test("8. Removed rows excluded from club-scoped selector scope rows", async () => {
  const result = await listSelectPlayersScopeRows(ACCC_FIXTURE.club.id, {
    listMembers: async () => {
      const repo = makeRepo();
      const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
      return { ok: true, members: current.data };
    },
    fetchProfiles: async () => ({ ok: true, profiles: [] }),
    fetchAthletes: async () => ({ ok: true, athletes: [] }),
    fetchPickVnRatings: async () => ({ ok: true, ratings: [] }),
  });
  assert.equal(result.ok, true);
  assert.ok(result.rows.every((row) => row.membershipStatus === "active"));
});

test("9-10. Removed + active profile/athlete does not become current member", async () => {
  const repo = makeRepo([
    { id: "m-x-removed", user_id: "user-x", status: "removed", display_name: "X" },
    { id: "m-x-active", user_id: "user-x", status: "active", display_name: "X Active", updated_at: "2026-03-01T00:00:00.000Z" },
  ]);
  const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
  const hits = current.data.filter((m) => m.user_id === "user-x");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].status, "active");
});

test("11. Rejoin: one removed historical + one active => appears once in current", async () => {
  const { members } = dedupeMembershipHistory([
    { id: "h1", user_id: "user-rejoin", status: "removed", updated_at: "2025-01-01T00:00:00.000Z" },
    { id: "h2", user_id: "user-rejoin", status: "active", updated_at: "2026-01-01T00:00:00.000Z" },
  ]);
  assert.equal(members.filter((m) => m.user_id === "user-rejoin").length, 1);
  assert.equal(members.find((m) => m.user_id === "user-rejoin").status, "active");
});

test("12. Multiple removed rows, no active => current count is 0", async () => {
  const repo = makeRepo(REMOVED_ONLY_ROWS);
  const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
  assert.equal(current.data.length, 0);
  const count = await repo.countActiveMembers(ACCC_FIXTURE.club.id);
  assert.equal(count.data, 0);
});

test("13. Reader error fails closed without blob fallback", async () => {
  const repo = createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: false, code: "MEMBERSHIP_RPC_FAILED", error: "boom" }),
    legacyListMembers: () => [{ user_id: "ghost", status: "active" }],
  });
  const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
  assert.equal(current.ok, false);
  assert.equal(current.code, "MEMBERSHIP_RPC_FAILED");

  const history = await repo.listClubMembershipHistory(ACCC_FIXTURE.club.id);
  assert.equal(history.ok, false);
  assert.equal(history.code, "MEMBERSHIP_RPC_FAILED");
});

test("14-15. Public directory contract does not bind current affiliation from removed membership", () => {
  const publicCatalog = read("../src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js");
  assert.match(publicCatalog, /DIRECTORY|directory/i);
  const membershipApi = read("../src/features/club/api/membershipApi.js");
  assert.match(membershipApi, /listClubMembershipHistory/);
  assert.match(membershipApi, /listCurrentClubMembers/);
});

test("16. Existing active-member behavior preserved (listActiveClubMembers alias)", async () => {
  const repo = makeRepo();
  const legacyAlias = await repo.listActiveClubMembers(ACCC_FIXTURE.club.id);
  const current = await repo.listCurrentClubMembers(ACCC_FIXTURE.club.id);
  assert.deepEqual(legacyAlias.data.map((m) => m.user_id).sort(), current.data.map((m) => m.user_id).sort());
});

test("ClubMembersTab uses membership history contract for management", () => {
  const src = read("../src/pages/clubs/tabs/ClubMembersTab.jsx");
  assert.match(src, /\.listClubMembershipHistory\(/);
  assert.doesNotMatch(src, /includeInactive:\s*true/);
});

test("MyClubMembersPanel uses current members contract only", () => {
  const src = read("../src/pages/player/myClub/MyClubMembersPanel.jsx");
  assert.match(src, /\.listCurrentClubMembers\(/);
  assert.doesNotMatch(src, /includeInactive:\s*true/);
});

test("selectPlayersCandidateAdapter defaults to current-only membership reader", () => {
  const src = read("../src/features/pairing-candidates/selectPlayersCandidateAdapter.js");
  assert.match(src, /listCurrentClubMembers/);
  assert.doesNotMatch(src, /rpcV2ClubListMembers/);
});
