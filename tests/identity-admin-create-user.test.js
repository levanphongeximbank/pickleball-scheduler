import test from "node:test";
import assert from "node:assert/strict";

test("createManagedUser source — không dùng client.auth.signUp", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../src/features/identity/services/userManagementService.js", import.meta.url),
      "utf8"
    )
  );

  assert.equal(source.includes("auth.signUp"), false);
  assert.equal(source.includes("callIdentityAdminCreateUser"), true);
  assert.equal(source.includes("sendPasswordSetupEmail: false"), true);
  assert.equal(source.includes("temporaryPassword"), true);
});

test("identityAdminCreateService source — admin API temp password + must_change_password", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../src/features/identity/services/identityAdminCreateService.js", import.meta.url),
      "utf8"
    )
  );

  assert.equal(source.includes("auth.admin.createUser"), true);
  assert.equal(source.includes("email_confirm: true"), true);
  assert.equal(source.includes("must_change_password"), true);
  assert.equal(source.includes("temporaryPassword"), true);
  assert.equal(source.includes('status: USER_STATUS.ACTIVE'), true);
  assert.equal(source.includes('.from("profiles")'), true);
  assert.equal(source.includes(".upsert(profileRow"), true);
});

test("create-user API source — authorize + temp password default off", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../api/identity/create-user.js", import.meta.url), "utf8")
  );

  assert.equal(source.includes("authorizeUserManage"), true);
  assert.equal(source.includes("getSupabaseServiceRoleKey()"), true);
  assert.equal(source.includes("adminCreateManagedUser"), true);
  assert.equal(source.includes("body.sendPasswordSetupEmail === true"), true);
});
