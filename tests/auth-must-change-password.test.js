import assert from "node:assert/strict";
import { test } from "node:test";

import { mapProfileRowToUser } from "../src/auth/profileService.js";
import {
  shouldRedirectToForcePasswordChange,
  userMustChangePassword,
  isAuthenticatedOnlyRoute,
} from "../src/auth/authGuard.js";

test("mapProfileRowToUser — maps must_change_password", () => {
  const user = mapProfileRowToUser({
    id: "user-1",
    email: "player@example.com",
    display_name: "Player",
    role: "PLAYER",
    status: "active",
    must_change_password: true,
  });

  assert.equal(user.mustChangePassword, true);
});

test("userMustChangePassword — reads flag from user", () => {
  assert.equal(userMustChangePassword({ mustChangePassword: true }), true);
  assert.equal(userMustChangePassword({ mustChangePassword: false }), false);
  assert.equal(userMustChangePassword(null), false);
});

test("shouldRedirectToForcePasswordChange — guard routing", () => {
  const flagged = { mustChangePassword: true };

  assert.equal(shouldRedirectToForcePasswordChange("/dashboard", flagged), true);
  assert.equal(shouldRedirectToForcePasswordChange("/change-password", flagged), false);
  assert.equal(shouldRedirectToForcePasswordChange("/login", { mustChangePassword: false }), false);
  assert.equal(shouldRedirectToForcePasswordChange("/change-password", { mustChangePassword: false }), true);
});

test("isAuthenticatedOnlyRoute — includes /change-password", () => {
  assert.equal(isAuthenticatedOnlyRoute("/change-password"), true);
});

test("identityAdminCreateService source — temp password without reset email by default", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("src/features/identity/services/identityAdminCreateService.js", "utf8")
  );

  assert.equal(source.includes("must_change_password"), true);
  assert.equal(source.includes("temporaryPassword"), true);
  assert.equal(source.includes("sendPasswordSetupEmail = false"), true);
});

test("passwordService source — completeMandatoryPasswordChange clears flag", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("src/features/identity/services/passwordService.js", "utf8")
  );

  assert.equal(source.includes("completeMandatoryPasswordChange"), true);
  const fnIndex = source.indexOf("completeMandatoryPasswordChange");
  const profileIndex = source.indexOf("must_change_password: false", fnIndex);
  const updateIndex = source.indexOf("updateUser", fnIndex);
  assert.ok(fnIndex > -1 && updateIndex > -1 && profileIndex > -1);
  assert.ok(updateIndex < profileIndex, "updateUser should run before clearing profile flag");
});
