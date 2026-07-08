import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { saveClubs } from "../src/data/club.js";
import { createClubRecord } from "../src/models/club.js";
import { ROLES } from "../src/auth/roles.js";
import {
  resolveSelfProfileVariant,
  resolveSelfProfileRoleLabel,
  SELF_PROFILE_VARIANT,
} from "../src/features/identity/utils/selfProfileVariant.js";
import { resolveClubGovernanceTitle } from "../src/features/club/services/clubGovernanceService.js";

const CLUB_ID = "club-profile-test";
const PRESIDENT_ID = "user-president";
const VICE_ID = "user-vice";
const STAFF_ID = "user-staff";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function seedClub() {
  saveClubs([
    createClubRecord("CLB Profile Test", {
      id: CLUB_ID,
      tenantId: "tenant-a",
      venueId: "tenant-a",
      governance: {
        presidentUserId: PRESIDENT_ID,
        vicePresidentUserId: VICE_ID,
      },
    }),
  ]);
}

describe("selfProfileVariant", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    seedClub();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("uses athlete profile for PLAYER", () => {
    assert.equal(
      resolveSelfProfileVariant({ id: "p1", role: ROLES.PLAYER, clubId: CLUB_ID }),
      SELF_PROFILE_VARIANT.ATHLETE
    );
  });

  it("uses athlete profile for club president and vice president", () => {
    assert.equal(
      resolveSelfProfileVariant({ id: PRESIDENT_ID, role: ROLES.CLUB_OWNER, clubId: CLUB_ID }),
      SELF_PROFILE_VARIANT.ATHLETE
    );
    assert.equal(
      resolveSelfProfileVariant({ id: VICE_ID, role: ROLES.CLUB_OWNER, clubId: CLUB_ID }),
      SELF_PROFILE_VARIANT.ATHLETE
    );
  });

  it("uses staff profile for club manager without governance title", () => {
    assert.equal(
      resolveSelfProfileVariant({ id: STAFF_ID, role: ROLES.CLUB_OWNER, clubId: CLUB_ID }),
      SELF_PROFILE_VARIANT.STAFF
    );
  });

  it("shows governance title labels on athlete profile", () => {
    const club = { governance: { presidentUserId: PRESIDENT_ID, vicePresidentUserId: VICE_ID } };
    assert.equal(
      resolveSelfProfileRoleLabel({ id: PRESIDENT_ID, clubId: CLUB_ID }),
      "Chủ tịch CLB"
    );
    assert.equal(
      resolveClubGovernanceTitle({ id: VICE_ID }, club),
      "Phó chủ tịch CLB"
    );
  });
});
