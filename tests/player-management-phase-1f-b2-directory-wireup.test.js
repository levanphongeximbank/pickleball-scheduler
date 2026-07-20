/**
 * Phase 1F-B2 — Public/directory search facade wire-up tests.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PRIVACY_SETTINGS,
  PLAYER_PROFILE_VIEWER_MODE,
  VIEWER_MODE_ERROR,
  getAuthenticatedSelfPlayerProfile,
  projectPublicPlayerProfile,
  searchDirectoryPlayers,
  searchInternalPlayers,
  searchPlayers,
  searchPublicPlayers,
} from "../src/features/player/index.js";

function privacy(overrides = {}) {
  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    publicProfileEnabled: true,
    showPhone: false,
    showEmail: false,
    showBirthDate: false,
    showBirthYear: false,
    showGender: true,
    showHandedness: false,
    showActivityRegion: false,
    showClubMemberships: false,
    ...overrides,
  };
}

function rosterPlayer(partial) {
  return {
    id: partial.id,
    name: partial.name,
    gender: partial.gender,
    phone: partial.phone,
    email: partial.email,
    birth_date: partial.birthDate,
    birth_year: partial.birthYear,
    handedness: partial.handedness,
    authUserId: partial.authUserId,
    privacy_settings: partial.privacySettings,
    privacySettings: partial.privacySettings,
    ...partial.extra,
  };
}

test("1F-B2 omitted mode fails closed", () => {
  const result = searchPlayers({ query: "a" }, { players: [{ id: "p1", name: "A" }] });
  assert.equal(result.ok, false);
  assert.equal(result.code, VIEWER_MODE_ERROR.MODE_REQUIRED);
  assert.deepEqual(result.data, []);
});

test("1F-B2 unknown mode fails closed", () => {
  const result = searchPlayers(
    {},
    { mode: "admin", players: [{ id: "p1", name: "A" }] }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, VIEWER_MODE_ERROR.MODE_UNSUPPORTED);
  assert.deepEqual(result.data, []);
});

test("1F-B2 public mode uses projectPublicPlayerProfile (allow-list only)", () => {
  const players = [
    rosterPlayer({
      id: "p1",
      name: "Lan",
      gender: "female",
      phone: "0901111222",
      email: "lan@example.com",
      birthDate: "1995-04-12",
      birthYear: 1995,
      handedness: "left",
      authUserId: "auth-secret",
      privacySettings: privacy({ showPhone: true, showGender: true }),
    }),
  ];

  const result = searchPublicPlayers({}, { players });
  assert.equal(result.ok, true);
  assert.equal(result.meta.mode, PLAYER_PROFILE_VIEWER_MODE.PUBLIC);
  assert.equal(result.meta.projected, true);
  assert.equal(result.data.length, 1);

  const row = result.data[0];
  assert.equal(row.visible, true);
  assert.equal(row.playerId, "p1");
  assert.equal(row.displayName, "Lan");
  assert.equal(row.phone, "0901111222");
  assert.equal(row.gender, "female");
  assert.equal(Object.prototype.hasOwnProperty.call(row, "email"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "birthDate"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "authUserId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "privacySettings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "verificationStatus"), false);

  const direct = projectPublicPlayerProfile({
    playerId: "p1",
    displayName: "Lan",
    phone: "0901111222",
    email: "lan@example.com",
    gender: "female",
    birthDate: "1995-04-12",
    birthYear: 1995,
    handedness: "left",
    authUserId: "auth-secret",
    privacySettings: privacy({ showPhone: true, showGender: true }),
  });
  assert.deepEqual(
    { ...row },
    { ...direct }
  );
});

test("1F-B2 directory mode enforces the same fail-closed privacy policy", () => {
  const players = [
    rosterPlayer({
      id: "p1",
      name: "Visible",
      privacySettings: privacy({ showEmail: true, email: undefined }),
      email: "v@example.com",
    }),
    rosterPlayer({
      id: "p2",
      name: "Hidden",
      privacySettings: privacy({ publicProfileEnabled: false, showEmail: true }),
      email: "h@example.com",
    }),
  ];

  const pub = searchPublicPlayers({}, { players });
  const dir = searchDirectoryPlayers({}, { players });
  assert.equal(pub.meta.mode, "public");
  assert.equal(dir.meta.mode, "directory");
  assert.equal(pub.data.length, 1);
  assert.equal(dir.data.length, 1);
  assert.equal(pub.data[0].email, "v@example.com");
  assert.equal(dir.data[0].email, "v@example.com");
  assert.equal(pub.meta.hiddenCount, 1);
  assert.equal(dir.meta.hiddenCount, 1);
  assert.equal(pub.meta.hiddenProfilePolicy, "exclude");
});

test("1F-B2 internal mode remains explicit and returns full normalized profiles", () => {
  const result = searchInternalPlayers(
    { query: "lan" },
    {
      players: [
        rosterPlayer({
          id: "p1",
          name: "Lan",
          phone: "0901111222",
          authUserId: "auth-1",
          privacySettings: null,
        }),
      ],
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.mode, "internal");
  assert.equal(result.meta.projected, false);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].phone, "0901111222");
  assert.equal(result.data[0].authUserId, "auth-1");
  assert.equal(Object.prototype.hasOwnProperty.call(result.data[0], "visible"), false);
});

test("1F-B2 hidden profile is not exposed in public/directory", () => {
  const players = [
    rosterPlayer({
      id: "p1",
      name: "Off",
      phone: "0900000000",
      privacySettings: privacy({ publicProfileEnabled: false, showPhone: true }),
    }),
    rosterPlayer({
      id: "p2",
      name: "MissingPrivacy",
      phone: "0900000001",
      privacySettings: null,
    }),
  ];
  const result = searchPublicPlayers({}, { players });
  assert.equal(result.data.length, 0);
  assert.equal(result.meta.hiddenCount, 2);
});

test("1F-B2 phone/email/DOB/demographics obey privacy flags", () => {
  // activity region on blob — adapt may not map; set via privacy on profile by injecting privacy only
  const result = searchPlayers(
    {},
    {
      mode: "public",
      players: [
        {
          id: "p1",
          name: "Flags",
          phone: "0901",
          email: "a@b.c",
          gender: "female",
          handedness: "right",
          birth_date: "1990-01-02",
          birth_year: 1990,
          privacy_settings: privacy({
            showPhone: true,
            showEmail: false,
            showBirthDate: true,
            showBirthYear: false,
            showGender: false,
            showHandedness: true,
            showActivityRegion: true,
          }),
        },
      ],
    }
  );
  const row = result.data[0];
  assert.equal(row.phone, "0901");
  assert.equal(Object.prototype.hasOwnProperty.call(row, "email"), false);
  assert.equal(row.birthDate, "1990-01-02");
  assert.equal(Object.prototype.hasOwnProperty.call(row, "birthYear"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "gender"), false);
  assert.equal(row.handedness, "right");
});

test("1F-B2 identity_verification_status and raw privacy_settings never appear publicly", () => {
  const result = searchDirectoryPlayers(
    {},
    {
      players: [
        {
          id: "p1",
          name: "V",
          identity_verification_status: "verified",
          privacy_settings: privacy({ showPhone: true }),
          phone: "0902",
          verificationStatus: "verified",
        },
      ],
    }
  );
  const row = result.data[0];
  assert.equal(row.visible, true);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "verificationStatus"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "identity_verification_status"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "privacySettings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "privacy_settings"), false);
});

test("1F-B2 malformed privacy does not leak fields", () => {
  const result = searchPublicPlayers(
    {},
    {
      players: [
        {
          id: "p1",
          name: "Bad",
          phone: "0903",
          privacy_settings: { publicProfileEnabled: "yes", showPhone: true },
        },
      ],
    }
  );
  assert.equal(result.data.length, 0);
  assert.equal(result.meta.hiddenCount, 1);
});

test("1F-B2 public query does not match authUserId", () => {
  const players = [
    {
      id: "p1",
      name: "Visible Name",
      authUserId: "secret-auth-token",
      privacy_settings: privacy(),
    },
  ];
  const byAuth = searchPublicPlayers({ query: "secret-auth" }, { players });
  assert.equal(byAuth.data.length, 0);

  const byName = searchPublicPlayers({ query: "visible" }, { players });
  assert.equal(byName.data.length, 1);
});

test("1F-B2 self-profile read export path remains available and separate", () => {
  assert.equal(typeof getAuthenticatedSelfPlayerProfile, "function");
  // Self reads are not routed through searchPlayers / public projector by default.
  const denied = searchPlayers({}, { players: [] });
  assert.equal(denied.ok, false);
});

test("1F-B2 viewerMode alias works", () => {
  const result = searchPlayers(
    {},
    {
      viewerMode: "internal",
      players: [{ id: "p1", name: "A" }],
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.mode, "internal");
});
