import assert from "node:assert/strict";
import { test } from "node:test";

import { isPasswordRecoveryRoute } from "../src/auth/authService.js";

test("isPasswordRecoveryRoute — matches reset password paths", () => {
  assert.equal(isPasswordRecoveryRoute("/reset-password"), true);
  assert.equal(isPasswordRecoveryRoute("/reset-password/"), true);
  assert.equal(isPasswordRecoveryRoute("/login"), false);
  assert.equal(isPasswordRecoveryRoute("/forgot-password"), false);
});

test("passwordService source — uses ensureRecoverySession before updateUser", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("src/features/identity/services/passwordService.js", "utf8");
  assert.equal(source.includes("ensureRecoverySession"), true);
  const ensureIndex = source.indexOf("ensureRecoverySession");
  const updateIndex = source.indexOf("updateUser");
  assert.ok(ensureIndex > -1 && updateIndex > -1);
  assert.ok(ensureIndex < updateIndex, "ensureRecoverySession must run before updateUser");
});
