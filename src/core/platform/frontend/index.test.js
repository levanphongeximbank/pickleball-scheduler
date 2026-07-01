import test from "node:test";
import assert from "node:assert/strict";

import { PLATFORM_MODULES, getPlatformModulesForUser } from "./moduleRegistry.js";

test("platform module registry exposes permission-based modules", () => {
  const accessService = {
    authorize(user) {
      return { allowed: user?.role === "SUPER_ADMIN" };
    },
  };

  const allowed = getPlatformModulesForUser({ role: "SUPER_ADMIN", tenant_id: "tenant-1" }, accessService);
  const denied = getPlatformModulesForUser({ role: "PLAYER", tenant_id: "tenant-1" }, accessService);

  assert.ok(PLATFORM_MODULES.length >= 3);
  assert.ok(allowed.length >= 1);
  assert.equal(denied.length, 0);
});
