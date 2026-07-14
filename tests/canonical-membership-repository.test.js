import test from "node:test";
import assert from "node:assert/strict";

import {
  createCanonicalMembershipRepository,
  dedupeMembershipHistory,
  resolveMembershipStatus,
} from "../src/features/club/repositories/index.js";
import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";

test("resolveMembershipStatus normalizes active/left", () => {
  assert.equal(resolveMembershipStatus({ status: "ACTIVE" }), "active");
  assert.equal(resolveMembershipStatus({ status: "left" }), "left");
});

test("dedupeMembershipHistory prefers active and is deterministic", () => {
  const { members, duplicatesRemoved, warnings } = dedupeMembershipHistory(
    ACCC_FIXTURE.membershipRows
  );
  assert.ok(duplicatesRemoved >= 2);
  assert.ok(warnings.some((w) => w.code === "DUPLICATE_MEMBERSHIP_HISTORY"));
  const user01 = members.find((m) => m.userId === "user-01");
  assert.equal(user01.status, "active");
  assert.equal(user01.id, "m-01-active");
  const userIds = members.map((m) => m.userId);
  assert.equal(new Set(userIds).size, userIds.length);
});

test("listActiveClubMembers returns only active after dedupe (V2)", async () => {
  const repo = createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: true, members: ACCC_FIXTURE.membershipRows }),
  });
  const result = await repo.listActiveClubMembers(ACCC_FIXTURE.club.id);
  assert.equal(result.ok, true);
  assert.equal(result.source, "membership_ssot");
  assert.equal(result.data.length, 10);
  assert.ok(result.data.every((m) => m.status === "active"));
  assert.ok(!result.data.some((m) => m.userId === "user-11"));
  assert.ok(result.mappingSummary.duplicatesRemoved >= 2);
});

test("getActiveMembershipForUser returns one logical membership", async () => {
  const repo = createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: true, members: ACCC_FIXTURE.membershipRows }),
  });
  const result = await repo.getActiveMembershipForUser(ACCC_FIXTURE.club.id, "user-02");
  assert.equal(result.ok, true);
  assert.equal(result.data.userId, "user-02");
  assert.equal(result.data.status, "active");
});

test("legacy mode marks source legacy_blob", async () => {
  const repo = createCanonicalMembershipRepository({
    isV2Enabled: () => false,
    legacyListMembers: () => [
      { user_id: "u1", status: "active", display_name: "A" },
      { user_id: "u1", status: "left", display_name: "A" },
    ],
  });
  const result = await repo.listActiveClubMembers("club-x");
  assert.equal(result.source, "legacy_blob");
  assert.equal(result.data.length, 1);
});
