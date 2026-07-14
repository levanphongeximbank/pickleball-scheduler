import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProfileGender,
  toProfileGenderFormValue,
  sanitizeProfileWritePayload,
  PROFILE_GENDER,
} from "../src/features/identity/utils/profileGender.js";
import {
  fetchSelfProfile,
  updateSelfProfile,
  updateSelfDemographics,
} from "../src/features/identity/services/selfProfileService.js";
import { createUserRecord } from "../src/models/user.js";
import { ROLES } from "../src/auth/roles.js";
import { signInAs, signOut, enableRbac } from "../src/auth/authService.js";
import { loadAuthSession } from "../src/auth/authStorage.js";
import { SELF_EDITABLE_PROFILE_FIELDS } from "../src/auth/profileService.js";

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

test("normalizeProfileGender maps Vietnamese/English to canonical DB values", () => {
  assert.equal(normalizeProfileGender("Nam"), PROFILE_GENDER.MALE);
  assert.equal(normalizeProfileGender("Nữ"), PROFILE_GENDER.FEMALE);
  assert.equal(normalizeProfileGender("Khác"), PROFILE_GENDER.OTHER);
  assert.equal(normalizeProfileGender("male"), PROFILE_GENDER.MALE);
  assert.equal(normalizeProfileGender("female"), PROFILE_GENDER.FEMALE);
  assert.equal(normalizeProfileGender("other"), PROFILE_GENDER.OTHER);
  assert.equal(normalizeProfileGender(""), null);
  assert.equal(normalizeProfileGender("   "), null);
  assert.equal(normalizeProfileGender(null), null);
  assert.equal(normalizeProfileGender("unknown-xyz"), null);
});

test("toProfileGenderFormValue keeps RadioGroup compatible with option values", () => {
  assert.equal(toProfileGenderFormValue("Nam"), "male");
  assert.equal(toProfileGenderFormValue("male"), "male");
  assert.equal(toProfileGenderFormValue("Nữ"), "female");
  assert.equal(toProfileGenderFormValue(""), "");
  assert.equal(toProfileGenderFormValue(null), "");
});

test("sanitizeProfileWritePayload redacts secrets and keeps gender keys", () => {
  const sanitized = sanitizeProfileWritePayload({
    gender: "female",
    birth_year: 1990,
    password: "secret",
    access_token: "abc",
    display_name: "QA",
  });
  assert.equal(sanitized.gender, "female");
  assert.equal(sanitized.birth_year, 1990);
  assert.equal(sanitized.display_name, "QA");
  assert.equal(sanitized.password, "[redacted]");
  assert.equal(sanitized.access_token, "[redacted]");
});

test("SELF_EDITABLE_PROFILE_FIELDS includes gender and birth_year", () => {
  assert.ok(SELF_EDITABLE_PROFILE_FIELDS.includes("gender"));
  assert.ok(SELF_EDITABLE_PROFILE_FIELDS.includes("birth_year"));
  assert.ok(SELF_EDITABLE_PROFILE_FIELDS.includes("display_name"));
  assert.ok(SELF_EDITABLE_PROFILE_FIELDS.includes("phone"));
});

test("updateSelfProfile includes normalized gender in submit payload (dev)", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signInAs(
    createUserRecord({
      id: "dev-athlete-gender",
      email: "athlete-gender@club.local",
      role: ROLES.PLAYER,
      clubId: "c1",
      playerId: "p1",
      displayName: "Athlete",
      gender: "male",
      birthYear: 1995,
    })
  );

  const result = await updateSelfProfile({
    displayName: "Athlete Updated",
    phone: "0901111222",
    avatarUrl: "",
    gender: "Nữ",
    birthYear: 1996,
  });

  assert.equal(result.ok, true);
  assert.equal(result.user.displayName, "Athlete Updated");
  assert.equal(result.user.phone, "0901111222");
  assert.equal(result.user.gender, "female");
  assert.equal(result.user.birthYear, 1996);

  const session = loadAuthSession();
  assert.equal(session.user.gender, "female");
  assert.equal(session.user.displayName, "Athlete Updated");

  signOut();
});

test("updateSelfProfile preserves gender when only phone changes", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signInAs(
    createUserRecord({
      id: "dev-athlete-preserve",
      email: "preserve@club.local",
      role: ROLES.PLAYER,
      displayName: "Keep Gender",
      gender: "male",
      birthYear: 1990,
      phone: "0900000000",
    })
  );

  const result = await updateSelfProfile({
    displayName: "Keep Gender",
    phone: "0912345678",
    avatarUrl: "",
  });

  assert.equal(result.ok, true);
  assert.equal(result.user.phone, "0912345678");
  assert.equal(result.user.gender, "male");
  assert.equal(result.user.birthYear, 1990);

  signOut();
});

test("empty string gender clears canonical value", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signInAs(
    createUserRecord({
      id: "dev-athlete-clear",
      email: "clear@club.local",
      role: ROLES.PLAYER,
      displayName: "Clear Gender",
      gender: "female",
    })
  );

  const result = await updateSelfProfile({ gender: "" });
  assert.equal(result.ok, true);
  assert.equal(result.user.gender, "");

  signOut();
});

test("updateSelfDemographics delegates to updateSelfProfile with male/female", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signInAs(
    createUserRecord({
      id: "dev-athlete-demo",
      email: "demo@club.local",
      role: ROLES.PLAYER,
      displayName: "Demo",
      gender: "",
    })
  );

  const result = await updateSelfDemographics({ gender: "male", birthYear: 1992 });
  assert.equal(result.ok, true);
  assert.equal(result.user.gender, "male");
  assert.equal(result.user.birthYear, 1992);

  const fetched = await fetchSelfProfile();
  assert.equal(fetched.ok, true);
  assert.equal(fetched.user.gender, "male");

  signOut();
});

test("reload persistence — session gender survives fetchSelfProfile after save", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signInAs(
    createUserRecord({
      id: "dev-athlete-reload",
      email: "reload@club.local",
      role: ROLES.PLAYER,
      displayName: "Reload",
      gender: "male",
    })
  );

  await updateSelfProfile({ gender: "Khác" });
  const after = await fetchSelfProfile();
  assert.equal(after.user.gender, "other");

  // Simulate logout/login session restore from localStorage
  const raw = globalThis.localStorage.getItem("pickleball-auth-session-v1");
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.user.gender, "other");

  signOut();
});
