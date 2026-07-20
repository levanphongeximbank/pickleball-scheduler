/**
 * Phase 1H-A — Privileged updatePlayerVerificationStatus tests.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  IDENTITY_VERIFICATION_STATUS,
  VERIFICATION_TRANSITION_MATRIX,
  WRITE_ERROR_CODES,
  projectPublicPlayerProfile,
  updatePlayerProfile,
  updatePlayerVerificationStatus,
  validateVerificationTransition,
} from "../src/features/player/index.js";
import { createMemoryPlayerProfileWriteRepository } from "../src/features/player/repositories/playerProfileWriteRepository.js";
import { AUDIT_ACTIONS } from "../src/features/identity/services/auditService.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";

const VENUE_A = "venue-a";
const VENUE_B = "venue-b";
const TARGET_AUTH = "auth-target-1h-a";
const TARGET_PLAYER = `player-auth-${TARGET_AUTH}`;
const ACTOR_ADMIN = "auth-admin-1h-a";
const ACTOR_OWNER = "auth-owner-1h-a";
const ACTOR_STAFF = "auth-staff-1h-a";

function directory(map) {
  return (id) => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null);
}

function targetProfileRow(overrides = {}) {
  return {
    id: TARGET_AUTH,
    player_id: TARGET_PLAYER,
    display_name: "Target Player",
    venue_id: VENUE_A,
    identity_verification_status: IDENTITY_VERIFICATION_STATUS.UNVERIFIED,
    status: "active",
    ...overrides,
  };
}

function makeActors() {
  return {
    superAdmin: createUserRecord({
      id: ACTOR_ADMIN,
      email: "admin@test.local",
      role: ROLES.SUPER_ADMIN,
      venueId: null,
    }),
    tenantOwner: createUserRecord({
      id: ACTOR_OWNER,
      email: "owner@test.local",
      role: ROLES.TENANT_OWNER,
      venueId: VENUE_A,
    }),
    crossVenueOwner: createUserRecord({
      id: "auth-owner-other",
      email: "other-owner@test.local",
      role: ROLES.TENANT_OWNER,
      venueId: VENUE_B,
    }),
    venueManager: createUserRecord({
      id: ACTOR_STAFF,
      email: "manager@test.local",
      role: ROLES.VENUE_MANAGER,
      venueId: VENUE_A,
    }),
    selfTarget: createUserRecord({
      id: TARGET_AUTH,
      email: "self@test.local",
      role: ROLES.TENANT_OWNER,
      venueId: VENUE_A,
    }),
  };
}

function createHarness(overrides = {}) {
  const writes = [];
  const audits = [];
  const profileRow = targetProfileRow(overrides.profileRow);

  const updateProfileRowById = async (userId, patch) => {
    writes.push({ userId, patch });
    if (overrides.writeFails) {
      return { ok: false, error: "write failed", code: "PROFILE_UPDATE_FAILED" };
    }
    const next = {
      ...profileRow,
      ...patch,
      id: userId,
    };
    Object.assign(profileRow, next);
    return { ok: true, profile: { ...profileRow } };
  };

  const writeAuditLog = async (entry) => {
    audits.push(entry);
    return { ok: true, entry, provider: "test" };
  };

  const baseOptions = {
    rbacEnabled: true,
    findPlayerById: directory({
      [TARGET_PLAYER]: { id: TARGET_PLAYER, authUserId: TARGET_AUTH },
    }),
    fetchTargetProfile: async () => ({ ok: true, profile: { ...profileRow } }),
    existingProfileRow: undefined,
    updateProfileRowById,
    writeAuditLog,
    profile: { id: TARGET_AUTH, player_id: TARGET_PLAYER },
    ...overrides.options,
  };

  return {
    profileRow,
    writes,
    audits,
    baseOptions,
    call: (actor, nextStatus, extra = {}) =>
      updatePlayerVerificationStatus(TARGET_PLAYER, nextStatus, {
        ...baseOptions,
        user: actor,
        ...extra,
      }),
  };
}

test("1H-A public export includes updatePlayerVerificationStatus", async () => {
  const api = await import("../src/features/player/index.js");
  assert.equal(typeof api.updatePlayerVerificationStatus, "function");
  assert.ok(api.VERIFICATION_TRANSITION_MATRIX);
  assert.equal(typeof api.validateVerificationTransition, "function");
});

test("1H-A transition matrix is narrow and explicit", () => {
  assert.deepEqual(VERIFICATION_TRANSITION_MATRIX.unverified, ["pending", "verified", "rejected"]);
  assert.deepEqual(VERIFICATION_TRANSITION_MATRIX.pending, ["unverified", "verified", "rejected"]);
  assert.deepEqual(VERIFICATION_TRANSITION_MATRIX.verified, ["unverified"]);
  assert.deepEqual(VERIFICATION_TRANSITION_MATRIX.rejected, ["unverified", "pending"]);

  assert.equal(validateVerificationTransition("verified", "rejected").ok, false);
  assert.equal(validateVerificationTransition("rejected", "verified").ok, false);
  assert.equal(validateVerificationTransition("verified", "pending").ok, false);
  assert.equal(validateVerificationTransition("pending", "verified").ok, true);
});

test("1H-A rejects unauthenticated caller", async () => {
  const harness = createHarness();
  const result = await harness.call(null, "pending");
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.NOT_AUTHENTICATED);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.audits.length, 0);
});

test("1H-A rejects self verification update", async () => {
  const { selfTarget } = makeActors();
  const harness = createHarness();
  const result = await harness.call(selfTarget, "pending");
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.SELF_VERIFICATION_FORBIDDEN);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.audits.length, 0);
});

test("1H-A generic updatePlayerProfile still rejects verification status", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    [TARGET_PLAYER]: {
      playerId: TARGET_PLAYER,
      authUserId: TARGET_AUTH,
      displayName: "Target",
      verificationStatus: "unverified",
    },
  });
  const result = await updatePlayerProfile(
    TARGET_PLAYER,
    { verificationStatus: "verified" },
    {
      writeRepository: repo,
      findPlayerById: directory({
        [TARGET_PLAYER]: { id: TARGET_PLAYER, authUserId: TARGET_AUTH },
      }),
      profile: { id: TARGET_AUTH, player_id: TARGET_PLAYER },
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.FORBIDDEN_FIELD);
});

test("1H-A rejects unauthorized staff without user.manage", async () => {
  const { venueManager } = makeActors();
  const harness = createHarness();
  const result = await harness.call(venueManager, "pending");
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.UNAUTHORIZED);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.audits.length, 0);
});

test("1H-A rejects cross-venue user.manage caller", async () => {
  const { crossVenueOwner } = makeActors();
  const harness = createHarness();
  const result = await harness.call(crossVenueOwner, "pending");
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.UNAUTHORIZED);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.audits.length, 0);
});

test("1H-A SUPER_ADMIN allowed for valid transition", async () => {
  const { superAdmin } = makeActors();
  const harness = createHarness();
  const result = await harness.call(superAdmin, "pending");
  assert.equal(result.ok, true);
  assert.equal(result.fromStatus, "unverified");
  assert.equal(result.toStatus, "pending");
  assert.equal(result.profile.verificationStatus, "pending");
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.writes[0].patch.identity_verification_status, "pending");
});

test("1H-A authorized same-scope user.manage caller allowed", async () => {
  const { tenantOwner } = makeActors();
  const harness = createHarness();
  const result = await harness.call(tenantOwner, "verified");
  assert.equal(result.ok, true);
  assert.equal(result.toStatus, "verified");
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.audits.length, 1);
});

test("1H-A valid transition succeeds", async () => {
  const { tenantOwner } = makeActors();
  const harness = createHarness({
    profileRow: { identity_verification_status: "pending" },
  });
  const result = await harness.call(tenantOwner, "rejected");
  assert.equal(result.ok, true);
  assert.equal(result.fromStatus, "pending");
  assert.equal(result.toStatus, "rejected");
});

test("1H-A invalid transition rejected", async () => {
  const { tenantOwner } = makeActors();
  const harness = createHarness({
    profileRow: { identity_verification_status: "verified" },
  });
  const result = await harness.call(tenantOwner, "rejected");
  assert.equal(result.ok, false);
  assert.equal(result.code, WRITE_ERROR_CODES.INVALID_TRANSITION);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.audits.length, 0);
});

test("1H-A audit written on success", async () => {
  const { tenantOwner } = makeActors();
  const harness = createHarness();
  const result = await harness.call(tenantOwner, "pending");
  assert.equal(result.ok, true);
  assert.equal(harness.audits.length, 1);
  const entry = harness.audits[0];
  assert.equal(entry.action, AUDIT_ACTIONS.PLAYER_VERIFICATION_STATUS_UPDATED);
  assert.equal(entry.resourceType, "player_profile");
  assert.equal(entry.resourceId, TARGET_PLAYER);
  assert.equal(entry.metadata.previousStatus, "unverified");
  assert.equal(entry.metadata.nextStatus, "pending");
  assert.equal(entry.metadata.actorUserId, ACTOR_OWNER);
  assert.equal(entry.metadata.targetAuthUserId, TARGET_AUTH);
  assert.equal(entry.metadata.venueId, VENUE_A);
});

test("1H-A audit not written on failed write", async () => {
  const { tenantOwner } = makeActors();
  const harness = createHarness({ writeFails: true });
  const result = await harness.call(tenantOwner, "pending");
  assert.equal(result.ok, false);
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.audits.length, 0);
});

test("1H-A public projector still hides verification", () => {
  const projected = projectPublicPlayerProfile({
    playerId: TARGET_PLAYER,
    displayName: "Public",
    verificationStatus: "verified",
    privacySettings: {
      publicProfileEnabled: true,
      showDisplayName: true,
      showAvatar: false,
      showGender: false,
      showBirthYear: false,
      showHandedness: false,
      showActivityRegion: false,
      showPhone: false,
      showEmail: false,
      showClubMemberships: false,
    },
  });
  assert.equal(projected.visible, true);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "verificationStatus"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "identity_verification_status"), false);
});
