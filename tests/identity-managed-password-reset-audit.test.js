import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SENTINELS = ["defaultPassword", "newPassword", "temporaryPassword", "access_token", "refreshToken"];

test("requestManagedPasswordReset audit metadata never includes secrets", () => {
  const source = readFileSync(
    path.join(ROOT, "src/features/identity/services/userManagementService.js"),
    "utf8"
  );
  const fnStart = source.indexOf("export async function requestManagedPasswordReset");
  assert.ok(fnStart >= 0);
  const fn = source.slice(fnStart, source.indexOf("export { USER_STATUS", fnStart));
  const auditStart = fn.indexOf("writeAuditLog");
  assert.ok(auditStart >= 0);
  const auditBlock = fn.slice(auditStart, fn.indexOf("});", auditStart) + 3);
  assert.equal(auditBlock.includes("AUDIT_ACTIONS.RESET_PASSWORD"), true);
  assert.equal(auditBlock.includes("step: \"admin_default_reset\""), true);
  for (const secret of SENTINELS) {
    assert.equal(auditBlock.includes(secret), false, `audit metadata leaked ${secret}`);
  }
});
