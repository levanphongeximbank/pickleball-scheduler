/**
 * Phase 1F-B1 — Public profile projector policy tests (pure).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  projectPublicPlayerProfile,
  PUBLIC_PROFILE_HIDE_REASON,
  DEFAULT_PRIVACY_SETTINGS,
} from "../src/features/player/index.js";
import * as playerPublicApi from "../src/features/player/index.js";

function enabledPrivacy(overrides = {}) {
  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    publicProfileEnabled: true,
    showPhone: false,
    showEmail: false,
    showBirthDate: false,
    showBirthYear: false,
    showGender: false,
    showHandedness: false,
    showActivityRegion: false,
    showClubMemberships: false,
    ...overrides,
  };
}

function fullProfile(overrides = {}) {
  return {
    playerId: "player-1",
    authUserId: "auth-1",
    athleteId: "athlete-1",
    displayName: "Lan Nguyen",
    fullName: "Nguyen Thi Lan",
    avatarUrl: "https://cdn.example/a.png",
    phone: "0901111222",
    email: "lan@example.com",
    gender: "female",
    birthDate: "1995-04-12",
    birthYear: 1995,
    ageGroup: "30+",
    handedness: "left",
    activityRegion: {
      countryCode: "VN",
      provinceName: "Ha Noi",
      city: "Cau Giay",
      district: null,
    },
    clubMembershipReferences: [{ clubId: "club-1", role: "member" }],
    accountStatus: "active",
    profileStatus: "active",
    verificationStatus: "verified",
    privacySettings: enabledPrivacy(),
    sourceReferences: [{ source: "profiles", id: "auth-1" }],
    ratingReferences: [{ rating: 3.5 }],
    rankingReferences: [{ rank: 1 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    role: "PLAYER",
    roles: ["PLAYER"],
    ...overrides,
  };
}

test("1F-B1 exports projector from Player Management public index", () => {
  assert.equal(typeof playerPublicApi.projectPublicPlayerProfile, "function");
  assert.ok("PUBLIC_PROFILE_HIDE_REASON" in playerPublicApi);
});

test("1F-B1 publicProfileEnabled=false hides all fields", () => {
  const out = projectPublicPlayerProfile(
    fullProfile({
      privacySettings: enabledPrivacy({ publicProfileEnabled: false, showPhone: true }),
    })
  );
  assert.deepEqual(out, {
    visible: false,
    reason: PUBLIC_PROFILE_HIDE_REASON.PUBLIC_PROFILE_DISABLED,
  });
  assert.equal(Object.keys(out).includes("playerId"), false);
  assert.equal(Object.keys(out).includes("phone"), false);
});

test("1F-B1 missing privacy settings hides all fields", () => {
  const profile = fullProfile();
  delete profile.privacySettings;
  const out = projectPublicPlayerProfile(profile);
  assert.equal(out.visible, false);
  assert.equal(out.reason, PUBLIC_PROFILE_HIDE_REASON.PRIVACY_MISSING);
});

test("1F-B1 null privacy settings hides all fields", () => {
  const out = projectPublicPlayerProfile(fullProfile({ privacySettings: null }));
  assert.equal(out.visible, false);
  assert.equal(out.reason, PUBLIC_PROFILE_HIDE_REASON.PRIVACY_MISSING);
});

test("1F-B1 malformed privacy settings fails closed", () => {
  const cases = [
    "not-an-object",
    42,
    true,
    [],
    { publicProfileEnabled: "yes" },
    { showPhone: "true", publicProfileEnabled: true },
  ];
  for (const privacySettings of cases) {
    const out = projectPublicPlayerProfile(fullProfile({ privacySettings }));
    assert.equal(out.visible, false, `expected opaque for ${JSON.stringify(privacySettings)}`);
    assert.equal(out.reason, PUBLIC_PROFILE_HIDE_REASON.PRIVACY_MALFORMED);
  }
});

test("1F-B1 enabled profile exposes only always-public identity fields by default flags", () => {
  const out = projectPublicPlayerProfile(
    fullProfile({
      privacySettings: enabledPrivacy({
        // gender/handedness defaults are true in SSOT, but we force false here to isolate identity keys
        showGender: false,
        showHandedness: false,
      }),
    })
  );
  assert.equal(out.visible, true);
  assert.equal(out.playerId, "player-1");
  assert.equal(out.displayName, "Lan Nguyen");
  assert.equal(out.avatarUrl, "https://cdn.example/a.png");
  assert.equal(hasOwn(out, "phone"), false);
  assert.equal(hasOwn(out, "email"), false);
  assert.equal(hasOwn(out, "birthDate"), false);
  assert.equal(hasOwn(out, "birthYear"), false);
  assert.equal(hasOwn(out, "gender"), false);
  assert.equal(hasOwn(out, "handedness"), false);
  assert.equal(hasOwn(out, "activityRegion"), false);
  assert.equal(hasOwn(out, "clubMembershipReferences"), false);
});

test("1F-B1 showPhone controls phone independently", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showPhone: false }) })
  );
  assert.equal(hasOwn(off, "phone"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showPhone: true }) })
  );
  assert.equal(on.phone, "0901111222");
});

test("1F-B1 showEmail controls email independently", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showEmail: false }) })
  );
  assert.equal(hasOwn(off, "email"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showEmail: true }) })
  );
  assert.equal(on.email, "lan@example.com");
});

test("1F-B1 showBirthDate controls birthDate", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showBirthDate: false }) })
  );
  assert.equal(hasOwn(off, "birthDate"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showBirthDate: true }) })
  );
  assert.equal(on.birthDate, "1995-04-12");
});

test("1F-B1 showBirthYear controls birthYear and does not invent from birthDate", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({
      birthYear: null,
      birthDate: "1995-04-12",
      privacySettings: enabledPrivacy({ showBirthYear: true, showBirthDate: false }),
    })
  );
  assert.equal(hasOwn(off, "birthYear"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showBirthYear: true }) })
  );
  assert.equal(on.birthYear, 1995);
});

test("1F-B1 showGender controls gender", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showGender: false }) })
  );
  assert.equal(hasOwn(off, "gender"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showGender: true }) })
  );
  assert.equal(on.gender, "female");
});

test("1F-B1 showHandedness controls handedness", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showHandedness: false }) })
  );
  assert.equal(hasOwn(off, "handedness"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showHandedness: true }) })
  );
  assert.equal(on.handedness, "left");
});

test("1F-B1 showActivityRegion controls activityRegion", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showActivityRegion: false }) })
  );
  assert.equal(hasOwn(off, "activityRegion"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showActivityRegion: true }) })
  );
  assert.deepEqual(on.activityRegion, {
    countryCode: "VN",
    provinceName: "Ha Noi",
    city: "Cau Giay",
  });
  assert.equal(hasOwn(on.activityRegion, "district"), false);
});

test("1F-B1 showClubMemberships controls club memberships", () => {
  const off = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showClubMemberships: false }) })
  );
  assert.equal(hasOwn(off, "clubMembershipReferences"), false);

  const on = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showClubMemberships: true }) })
  );
  assert.deepEqual(on.clubMembershipReferences, [{ clubId: "club-1", role: "member" }]);
});

test("1F-B1 identity_verification_status / verificationStatus is never projected", () => {
  const out = projectPublicPlayerProfile(
    fullProfile({
      verificationStatus: "verified",
      privacySettings: enabledPrivacy({
        showPhone: true,
        showEmail: true,
        showBirthDate: true,
        showBirthYear: true,
        showGender: true,
        showHandedness: true,
        showActivityRegion: true,
        showClubMemberships: true,
      }),
    })
  );
  assert.equal(out.visible, true);
  assert.equal(hasOwn(out, "verificationStatus"), false);
  assert.equal(hasOwn(out, "identityVerificationStatus"), false);
  assert.equal(hasOwn(out, "identity_verification_status"), false);
});

test("1F-B1 internal/auth/database fields are never projected", () => {
  const out = projectPublicPlayerProfile(
    fullProfile({
      privacySettings: enabledPrivacy({
        showPhone: true,
        showEmail: true,
        showBirthDate: true,
        showBirthYear: true,
        showGender: true,
        showHandedness: true,
        showActivityRegion: true,
        showClubMemberships: true,
      }),
    })
  );
  for (const key of [
    "authUserId",
    "athleteId",
    "fullName",
    "ageGroup",
    "accountStatus",
    "profileStatus",
    "privacySettings",
    "sourceReferences",
    "ratingReferences",
    "rankingReferences",
    "createdAt",
    "updatedAt",
    "role",
    "roles",
  ]) {
    assert.equal(hasOwn(out, key), false, `must omit ${key}`);
  }
});

test("1F-B1 projector does not mutate input", () => {
  const input = fullProfile({
    privacySettings: enabledPrivacy({ showPhone: true, showActivityRegion: true }),
  });
  const before = structuredClone(input);
  projectPublicPlayerProfile(input);
  assert.deepEqual(input, before);
});

test("1F-B1 repeated input produces identical output", () => {
  const input = fullProfile({
    privacySettings: enabledPrivacy({
      showPhone: true,
      showGender: true,
      showActivityRegion: true,
    }),
  });
  const a = projectPublicPlayerProfile(input);
  const b = projectPublicPlayerProfile(input);
  assert.deepEqual(a, b);
  assert.deepEqual(a, projectPublicPlayerProfile(structuredClone(input)));
});

test("1F-B1 unknown extra privacy keys do not expand output", () => {
  const out = projectPublicPlayerProfile(
    fullProfile({
      privacySettings: {
        ...enabledPrivacy({ showGender: true }),
        showSecretInternalField: true,
        showRatingSummaryPublic: true,
        showRankingSummaryPublic: true,
        customLeak: "auth-1",
      },
      secretInternalField: "LEAK",
    })
  );
  assert.equal(out.visible, true);
  assert.equal(out.gender, "female");
  assert.equal(hasOwn(out, "secretInternalField"), false);
  assert.equal(hasOwn(out, "customLeak"), false);
  assert.equal(hasOwn(out, "showSecretInternalField"), false);
  assert.equal(hasOwn(out, "ratingReferences"), false);
});

test("1F-B1 invalid profile input fails closed", () => {
  assert.deepEqual(projectPublicPlayerProfile(null), {
    visible: false,
    reason: PUBLIC_PROFILE_HIDE_REASON.INVALID_PROFILE,
  });
  assert.deepEqual(projectPublicPlayerProfile(undefined), {
    visible: false,
    reason: PUBLIC_PROFILE_HIDE_REASON.INVALID_PROFILE,
  });
});

test("1F-B1 options.privacySettings override is supported", () => {
  const out = projectPublicPlayerProfile(
    fullProfile({ privacySettings: enabledPrivacy({ showPhone: false }) }),
    { privacySettings: enabledPrivacy({ showPhone: true }) }
  );
  assert.equal(out.visible, true);
  assert.equal(out.phone, "0901111222");
});

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
