import test from "node:test";
import assert from "node:assert/strict";

import { ADMIN_DEFAULT_RESET_PASSWORD } from "../src/config/authConfig.js";

test("authConfig — admin default reset password", () => {
  assert.equal(ADMIN_DEFAULT_RESET_PASSWORD, "123456789");
});

test("identityAdminResetPasswordService source — admin API updateUserById + must_change_password", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../src/features/identity/services/identityAdminResetPasswordService.js", import.meta.url),
      "utf8"
    )
  );

  assert.equal(source.includes("auth.admin.updateUserById"), true);
  assert.equal(source.includes("ADMIN_DEFAULT_RESET_PASSWORD"), true);
  assert.equal(source.includes("must_change_password: true"), true);
});

test("requestManagedPasswordReset source — uses admin reset API on Supabase", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../src/features/identity/services/userManagementService.js", import.meta.url),
      "utf8"
    )
  );

  assert.equal(source.includes("callIdentityAdminResetPassword"), true);
  assert.equal(source.includes("admin_default_reset"), true);
});

test("reset-password API source — validate caller JWT via shared authorizeUserManage", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../api/identity/reset-password.js", import.meta.url), "utf8")
  );

  assert.equal(source.includes("authorizeUserManage"), true);
  assert.equal(source.includes("adminResetManagedUserPassword"), true);
});

test("create-user API source — uses shared authorizeUserManage", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../api/identity/create-user.js", import.meta.url), "utf8")
  );

  assert.equal(source.includes('from "./authorizeUserManage.js"'), true);
  assert.equal(source.includes("adminClient.auth.getUser(token)"), false);
});
