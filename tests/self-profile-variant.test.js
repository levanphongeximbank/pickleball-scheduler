import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

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

function makeMembership(overrides = {}) {
  return {
    ok: true,
    clubId: CLUB_ID,
    hasActiveMembership: true,
    club: {
      id: CLUB_ID,
      governance: {
        presidentUserId: PRESIDENT_ID,
        vicePresidentUserId: VICE_ID,
      },
    },
    ...overrides,
  };
}

describe("selfProfileVariant", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("uses athlete profile for PLAYER", () => {
    assert.equal(
      resolveSelfProfileVariant({ id: "p1", role: ROLES.PLAYER }, makeMembership()),
      SELF_PROFILE_VARIANT.ATHLETE
    );
  });

  it("uses athlete profile for club president and vice president", () => {
    assert.equal(
      resolveSelfProfileVariant({ id: PRESIDENT_ID, role: ROLES.CLUB_OWNER }, makeMembership()),
      SELF_PROFILE_VARIANT.ATHLETE
    );
    assert.equal(
      resolveSelfProfileVariant({ id: VICE_ID, role: ROLES.CLUB_OWNER }, makeMembership()),
      SELF_PROFILE_VARIANT.ATHLETE
    );
  });

  it("uses staff profile for club manager without canonical active membership", () => {
    assert.equal(
      resolveSelfProfileVariant(
        { id: STAFF_ID, role: ROLES.CLUB_OWNER, clubId: CLUB_ID, club_id: CLUB_ID },
        makeMembership({ ok: true, clubId: null, hasActiveMembership: false, club: null })
      ),
      SELF_PROFILE_VARIANT.STAFF
    );
  });

  it("shows governance title labels on athlete profile", () => {
    const club = { governance: { presidentUserId: PRESIDENT_ID, vicePresidentUserId: VICE_ID } };
    assert.equal(
      resolveSelfProfileRoleLabel({ id: PRESIDENT_ID }, makeMembership()),
      "Chủ tịch CLB"
    );
    assert.equal(
      resolveClubGovernanceTitle({ id: VICE_ID }, club),
      "Phó chủ tịch CLB"
    );
  });

  it("fails closed when canonical membership lookup is unavailable", () => {
    assert.equal(
      resolveSelfProfileVariant(
        { id: PRESIDENT_ID, role: ROLES.CLUB_OWNER, clubId: CLUB_ID, club_id: CLUB_ID },
        { ok: false, clubId: null, hasActiveMembership: false, club: null, error: "RPC_FAILED" }
      ),
      SELF_PROFILE_VARIANT.STAFF
    );
    assert.equal(
      resolveSelfProfileRoleLabel(
        { id: PRESIDENT_ID, clubId: CLUB_ID, club_id: CLUB_ID },
        { ok: false, clubId: null, hasActiveMembership: false, club: null, error: "RPC_FAILED" }
      ),
      null
    );
  });

  it("SelfProfile surfaces use shared canonical membership interpretation", () => {
    const selfProfilePage = readSrc("src/pages/SelfProfilePage.jsx");
    const athletePage = readSrc("src/pages/player/AthleteSelfProfilePage.jsx");
    assert.match(selfProfilePage, /useMyClubMembershipFromContext/);
    assert.match(selfProfilePage, /resolveSelfProfileVariant\(user, membership\)/);
    assert.match(athletePage, /useMyClubMembershipFromContext/);
    assert.match(athletePage, /buildMyClubSummaryFromClub/);
    assert.doesNotMatch(athletePage, /user\?\.clubId/);
  });
});
