import test from "node:test";
import assert from "node:assert/strict";

import { API_ERROR_CODES } from "../src/features/api/constants/apiErrors.js";
import {
  MEMBERSHIP_AUDIT_EVENTS,
  JOIN_REQUEST_AUDIT_EVENTS,
  resolveServerMembershipAuditAction,
  resolveFreezeMembershipAuditEvents,
} from "../src/features/club/constants/membershipAuditEvents.js";
import {
  CANONICAL_MEMBERSHIP_STATUSES,
  assertMembershipTransition,
  toCanonicalMembershipStatus,
  toActiveRosterMemberDto,
  isCanonicalMembershipActive,
} from "../src/features/club/membership/membershipLifecycle.js";
import { canAddClubMembers, canDeleteClubMembers } from "../src/features/club/services/clubGovernanceService.js";
import {
  rpcReviewClubMembershipRequest,
  rpcSubmitClubMembershipRequest,
  rpcLeaveMyClub,
} from "../src/features/club/services/clubMembershipRequestRpcService.js";
import { membershipListActiveRoster } from "../src/features/club/api/membershipApi.js";

function withV2Env(fn) {
  const prev = {
    flag: process.env.VITE_CLUB_STORAGE_V2,
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_ANON_KEY,
    rbac: process.env.VITE_RBAC_ENABLED,
  };
  process.env.VITE_CLUB_STORAGE_V2 = "true";
  process.env.VITE_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIn0.unit";
  process.env.VITE_RBAC_ENABLED = "true";
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev.flag === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
      else process.env.VITE_CLUB_STORAGE_V2 = prev.flag;
      if (prev.url === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prev.url;
      if (prev.key === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
      else process.env.VITE_SUPABASE_ANON_KEY = prev.key;
      if (prev.rbac === undefined) delete process.env.VITE_RBAC_ENABLED;
      else process.env.VITE_RBAC_ENABLED = prev.rbac;
    });
}

test("Phase 2C — canonical membership status + transitions", () => {
  assert.equal(toCanonicalMembershipStatus("active"), CANONICAL_MEMBERSHIP_STATUSES.ACTIVE);
  assert.equal(toCanonicalMembershipStatus("LEFT"), CANONICAL_MEMBERSHIP_STATUSES.LEFT);
  assert.equal(toCanonicalMembershipStatus("removed"), CANONICAL_MEMBERSHIP_STATUSES.REMOVED);
  assert.equal(toCanonicalMembershipStatus("inactive"), "inactive");
  assert.equal(isCanonicalMembershipActive("active"), true);
  assert.equal(isCanonicalMembershipActive("left"), false);

  assert.equal(assertMembershipTransition(null, "add").ok, true);
  assert.equal(assertMembershipTransition("left", "add").ok, true);
  assert.equal(assertMembershipTransition("active", "leave").ok, true);
  assert.equal(assertMembershipTransition("active", "remove").ok, true);
  assert.equal(assertMembershipTransition("removed", "restore").ok, true);
  assert.equal(assertMembershipTransition("active", "restore").ok, false);
  assert.equal(assertMembershipTransition("left", "remove").code, "INVALID_STATE");
});

test("Phase 2C — active roster DTO strips to minimal PII", () => {
  const dto = toActiveRosterMemberDto({
    user_id: "u-1",
    player_id: "p-1",
    display_name: "A",
    email: "secret@example.com",
    phone: "0900",
    status: "active",
    version: 3,
  });
  assert.equal(dto.userId, "u-1");
  assert.equal(dto.playerId, "p-1");
  assert.equal(dto.displayName, "A");
  assert.equal(dto.status, "active");
  assert.equal(dto.email, undefined);
  assert.equal(dto.phone, undefined);
});

test("Phase 2C — audit freeze aliases map to server actions", () => {
  assert.equal(
    resolveServerMembershipAuditAction(MEMBERSHIP_AUDIT_EVENTS.ADDED),
    "club.member.add"
  );
  assert.equal(
    resolveServerMembershipAuditAction(JOIN_REQUEST_AUDIT_EVENTS.CREATED),
    "club.membership_request.submit"
  );
  assert.deepEqual(resolveFreezeMembershipAuditEvents("club.member.remove"), [
    MEMBERSHIP_AUDIT_EVENTS.REMOVED,
  ]);
});

test("Phase 2C — VP cannot add or remove members", () => {
  const club = {
    id: "club-1",
    tenantId: "tenant-1",
    governance: {
      ownerUserId: "owner-1",
      presidentUserId: "pres-1",
      vicePresidentUserIds: ["vp-1"],
    },
  };
  const vp = { id: "vp-1", role: "PLAYER" };
  const president = { id: "pres-1", role: "PLAYER" };
  const owner = { id: "owner-1", role: "PLAYER" };

  return withV2Env(() => {
    assert.equal(canDeleteClubMembers(vp, club), false);
    assert.equal(canAddClubMembers(vp, club), false);
    assert.equal(canDeleteClubMembers(president, club), true);
    assert.equal(canAddClubMembers(president, club), true);
    assert.equal(canAddClubMembers(owner, club), true);
  });
});

test("Phase 2C — Phase 31 RPC client hard-dead under V2 ON", async () => {
  await withV2Env(async () => {
    const review = await rpcReviewClubMembershipRequest({
      userId: "u",
      clubId: "c",
      playerId: "p",
      action: "approved",
    });
    assert.equal(review.ok, false);
    assert.equal(review.code, API_ERROR_CODES.FEATURE_DISABLED);

    const submit = await rpcSubmitClubMembershipRequest({ clubId: "c" });
    assert.equal(submit.ok, false);
    assert.equal(submit.code, API_ERROR_CODES.FEATURE_DISABLED);

    const leave = await rpcLeaveMyClub();
    assert.equal(leave.ok, false);
    assert.equal(leave.code, API_ERROR_CODES.FEATURE_DISABLED);
  });
});

test("Phase 2C — membership.listActiveRoster returns ok shape from legacy repo", async () => {
  const prevFlag = process.env.VITE_CLUB_STORAGE_V2;
  const prevCanon = process.env.VITE_CANONICAL_CLUB_REPOSITORY_ENABLED;
  delete process.env.VITE_CLUB_STORAGE_V2;
  delete process.env.VITE_CANONICAL_CLUB_REPOSITORY_ENABLED;
  try {
    const result = await membershipListActiveRoster("club-empty-x");
    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.members));
  } finally {
    if (prevFlag === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
    else process.env.VITE_CLUB_STORAGE_V2 = prevFlag;
    if (prevCanon === undefined) delete process.env.VITE_CANONICAL_CLUB_REPOSITORY_ENABLED;
    else process.env.VITE_CANONICAL_CLUB_REPOSITORY_ENABLED = prevCanon;
  }
});
