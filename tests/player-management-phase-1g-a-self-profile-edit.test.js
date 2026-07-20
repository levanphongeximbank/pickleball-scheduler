/**
 * Phase 1G-A — Self foundation edit form + durable write path tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  applyBirthDateChange,
  buildSelfFoundationFormState,
  buildSelfFoundationUpdatePatch,
  stripVerificationFromSelfPatch,
  SELF_FOUNDATION_PRIVACY_KEYS,
  projectPublicPlayerProfile,
  searchPublicPlayers,
  DEFAULT_PRIVACY_SETTINGS,
  updatePlayerProfile,
} from "../src/features/player/index.js";
import { normalizeAndValidateWritePatch } from "../src/features/player/adapters/writePatchAdapter.js";
import { createMemoryPlayerProfileWriteRepository } from "../src/features/player/repositories/playerProfileWriteRepository.js";
import { WRITE_ERROR_CODES } from "../src/features/player/constants/writableFields.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function sampleProfile(overrides = {}) {
  return {
    playerId: "player-1g-a",
    authUserId: "auth-1g-a",
    displayName: "Lan",
    birthDate: "1995-04-12",
    birthYear: 1995,
    handedness: "left",
    activityRegion: {
      countryCode: "VN",
      provinceName: "Hà Nội",
      city: "Cầu Giấy",
      district: null,
      provinceCode: null,
    },
    privacySettings: { ...DEFAULT_PRIVACY_SETTINGS, showGender: true },
    verificationStatus: "verified",
    ...overrides,
  };
}

test("1G-A public exports include foundation edit helpers", async () => {
  const api = await import("../src/features/player/index.js");
  for (const key of [
    "buildSelfFoundationFormState",
    "buildSelfFoundationUpdatePatch",
    "applyBirthDateChange",
    "stripVerificationFromSelfPatch",
    "SELF_FOUNDATION_PRIVACY_KEYS",
  ]) {
    assert.ok(key in api, `missing export ${key}`);
  }
});

test("1G-A buildSelfFoundationFormState seeds editable fields", () => {
  const form = buildSelfFoundationFormState(sampleProfile());
  assert.equal(form.birthDate, "1995-04-12");
  assert.equal(form.birthYear, "1995");
  assert.equal(form.handedness, "left");
  assert.equal(form.activityRegion.provinceName, "Hà Nội");
  assert.equal(form.privacySettings.showGender, true);
  assert.equal(Object.prototype.hasOwnProperty.call(form, "verificationStatus"), false);
});

test("1G-A applyBirthDateChange derives birthYear from date", () => {
  const next = applyBirthDateChange("2001-08-20", "1990");
  assert.equal(next.birthDate, "2001-08-20");
  assert.equal(next.birthYear, "2001");
});

test("1G-A buildSelfFoundationUpdatePatch edits birth_date and syncs year", () => {
  const form = buildSelfFoundationFormState(sampleProfile());
  form.birthDate = "1998-01-15";
  form.birthYear = "1990"; // stale — must be overridden by date
  const result = buildSelfFoundationUpdatePatch(form);
  assert.equal(result.ok, true);
  assert.equal(result.patch.birthDate, "1998-01-15");
  assert.equal(result.patch.birthYear, 1998);
});

test("1G-A birthYear alone allowed when birthDate empty", () => {
  const form = buildSelfFoundationFormState(
    sampleProfile({ birthDate: null, birthYear: 1992 })
  );
  form.birthDate = "";
  form.birthYear = "1992";
  const result = buildSelfFoundationUpdatePatch(form);
  assert.equal(result.ok, true);
  assert.equal(result.patch.birthDate, null);
  assert.equal(result.patch.birthYear, 1992);
});

test("1G-A rejects future birth_date (validation failure does not build patch)", () => {
  const form = buildSelfFoundationFormState(sampleProfile());
  form.birthDate = "2999-01-01";
  const result = buildSelfFoundationUpdatePatch(form);
  assert.equal(result.ok, false);
  assert.equal(result.code, "FUTURE_BIRTH_DATE");
  assert.equal(result.patch, undefined);
});

test("1G-A edits handedness", () => {
  const form = buildSelfFoundationFormState(sampleProfile());
  form.handedness = "right";
  const result = buildSelfFoundationUpdatePatch(form);
  assert.equal(result.ok, true);
  assert.equal(result.patch.handedness, "right");
});

test("1G-A edits activity_region", () => {
  const form = buildSelfFoundationFormState(sampleProfile());
  form.activityRegion = {
    countryCode: "VN",
    provinceName: "Đà Nẵng",
    city: "Hải Châu",
    district: "",
    provinceCode: "",
  };
  const result = buildSelfFoundationUpdatePatch(form);
  assert.equal(result.ok, true);
  assert.equal(result.patch.activityRegion.provinceName, "Đà Nẵng");
  assert.equal(result.patch.activityRegion.city, "Hải Châu");
});

test("1G-A edits privacy_settings with supported keys only", () => {
  const form = buildSelfFoundationFormState(sampleProfile());
    form.privacySettings = {
      ...DEFAULT_PRIVACY_SETTINGS,
      publicProfileEnabled: true,
      showPhone: true,
      showBirthYear: true,
    };
  const result = buildSelfFoundationUpdatePatch(form);
  assert.equal(result.ok, true);
  assert.equal(result.patch.privacySettings.publicProfileEnabled, true);
  assert.equal(result.patch.privacySettings.showPhone, true);
  for (const key of SELF_FOUNDATION_PRIVACY_KEYS) {
    assert.equal(typeof result.patch.privacySettings[key], "boolean");
  }
});

test("1G-A stripVerificationFromSelfPatch removes verification injection", () => {
  const stripped = stripVerificationFromSelfPatch({
    birthYear: 1995,
    verificationStatus: "verified",
    identityVerificationStatus: "verified",
    identity_verification_status: "verified",
  });
  assert.equal(stripped.birthYear, 1995);
  assert.equal(stripped.verificationStatus, undefined);
  assert.equal(stripped.identityVerificationStatus, undefined);
  assert.equal(stripped.identity_verification_status, undefined);
});

test("1G-A buildSelfFoundationUpdatePatch never includes verification fields", () => {
  const form = buildSelfFoundationFormState(sampleProfile());
  form.verificationStatus = "verified";
  form.identity_verification_status = "pending";
  const result = buildSelfFoundationUpdatePatch(form);
  assert.equal(result.ok, true);
  assert.equal(result.patch.verificationStatus, undefined);
  assert.equal(result.patch.identityVerificationStatus, undefined);
  assert.equal(result.patch.identity_verification_status, undefined);
});

test("1G-A durable write path rejects verification and persists foundation fields", async () => {
  const repo = createMemoryPlayerProfileWriteRepository({
    "player-1g-a": {
      playerId: "player-1g-a",
      authUserId: "auth-1g-a",
      displayName: "Lan",
      birthDate: null,
      birthYear: null,
      handedness: "unknown",
      activityRegion: null,
      privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
      verificationStatus: "unverified",
    },
  });

  const forbidden = await updatePlayerProfile(
    "player-1g-a",
    { verificationStatus: "verified" },
    { writeRepository: repo, trustUnknownExistence: true }
  );
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, WRITE_ERROR_CODES.FORBIDDEN_FIELD);

  const form = buildSelfFoundationFormState(sampleProfile({ verificationStatus: "unverified" }));
  form.birthDate = "1997-06-01";
  form.handedness = "ambidextrous";
  form.privacySettings = {
    ...DEFAULT_PRIVACY_SETTINGS,
    publicProfileEnabled: true,
    showHandedness: true,
  };
  const built = buildSelfFoundationUpdatePatch(form);
  assert.equal(built.ok, true);

  const saved = await updatePlayerProfile("player-1g-a", built.patch, {
    writeRepository: repo,
    trustUnknownExistence: true,
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.profile.birthDate, "1997-06-01");
  assert.equal(saved.profile.birthYear, 1997);
  assert.equal(saved.profile.handedness, "ambidextrous");
  assert.equal(saved.profile.privacySettings.publicProfileEnabled, true);
  assert.equal(saved.profile.verificationStatus, "unverified");
});

test("1G-A normalizeAndValidateWritePatch birth_date/year conflict still rejected", () => {
  const result = normalizeAndValidateWritePatch({
    birthDate: "1995-04-12",
    birthYear: 1990,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === "BIRTH_DATE_YEAR_CONFLICT"));
});

test("1G-A identity selfProfileService still bridges foundation fields", async () => {
  const source = require("fs").readFileSync(
    join(__dirname, "../src/features/identity/services/selfProfileService.js"),
    "utf8"
  );
  assert.match(source, /updateAuthenticatedSelfPlayerProfile/);
  assert.match(source, /birthDate/);
  assert.match(source, /handedness/);
  assert.match(source, /activityRegion/);
  assert.match(source, /privacySettings/);
});

test("1G-A Athlete page uses updateSelfProfile + foundation edit (no direct supabase write)", async () => {
  const source = require("fs").readFileSync(
    join(__dirname, "../src/pages/player/AthleteSelfProfilePage.jsx"),
    "utf8"
  );
  assert.match(source, /updateSelfProfile/);
  assert.match(source, /SelfPlayerProfileFoundationEdit/);
  assert.match(source, /buildSelfFoundationUpdatePatch/);
  assert.match(source, /stripVerificationFromSelfPatch/);
  assert.doesNotMatch(source, /\.from\(['"]profiles['"]\)/);
  assert.doesNotMatch(source, /identity_verification_status/);
});

test("1G-A public projector unchanged — privacy metadata never exposed", () => {
  const projected = projectPublicPlayerProfile({
    playerId: "p1",
    displayName: "Lan",
    birthDate: "1995-04-12",
    birthYear: 1995,
      privacySettings: {
      ...DEFAULT_PRIVACY_SETTINGS,
      publicProfileEnabled: true,
      showBirthYear: true,
    },
    verificationStatus: "verified",
  });
  assert.equal(projected.visible, true);
  assert.equal(projected.birthYear, 1995);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "privacySettings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "verificationStatus"), false);
});

test("1G-A directory search still projects and excludes hidden", () => {
  const result = searchPublicPlayers(
    {},
    {
      players: [
        {
          id: "visible",
          name: "Visible",
          privacySettings: {
            ...DEFAULT_PRIVACY_SETTINGS,
            publicProfileEnabled: true,
            showGender: true,
          },
          gender: "female",
        },
        {
          id: "hidden",
          name: "Hidden",
          privacySettings: { ...DEFAULT_PRIVACY_SETTINGS, publicProfileEnabled: false },
        },
      ],
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].displayName, "Visible");
  assert.equal(Object.prototype.hasOwnProperty.call(result.data[0], "privacySettings"), false);
});

test("1G-A DEFAULT_PRIVACY_SETTINGS still fail-closed", () => {
  assert.equal(DEFAULT_PRIVACY_SETTINGS.publicProfileEnabled, false);
  assert.equal(DEFAULT_PRIVACY_SETTINGS.showPhone, false);
  assert.equal(DEFAULT_PRIVACY_SETTINGS.showEmail, false);
});
