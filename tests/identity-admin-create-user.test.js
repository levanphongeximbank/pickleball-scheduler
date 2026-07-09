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
  assert.equal(source.includes("emailConfirmed: true"), true);
});

test("identityAdminCreateService source — admin API email_confirm + reset email", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../src/features/identity/services/identityAdminCreateService.js", import.meta.url),
      "utf8"
    )
  );

  assert.equal(source.includes("auth.admin.createUser"), true);
  assert.equal(source.includes("email_confirm: true"), true);
  assert.equal(source.includes("resetPasswordForEmail"), true);
  assert.equal(source.includes('status: USER_STATUS.ACTIVE'), true);
  assert.equal(source.includes('.from("profiles")'), true);
  assert.equal(source.includes(".upsert(profileRow"), true);
});

test("create-user API source — validate caller JWT via service role getUser(token)", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../api/identity/create-user.js", import.meta.url), "utf8")
  );

  assert.equal(source.includes("adminClient.auth.getUser(token)"), true);
  assert.equal(source.includes("getSupabaseServiceRoleKey()"), true);
  assert.equal(source.includes("VITE_SUPABASE_URL"), true);
  assert.equal(source.includes('from("role_permissions")'), true);
});
