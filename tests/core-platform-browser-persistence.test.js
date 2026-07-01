import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserPlatformPersistenceAdapter } from "../src/core/platform/persistence/index.js";

test("browser persistence adapter stores and reads tenant-scoped data", () => {
  const adapter = createBrowserPlatformPersistenceAdapter({ namespace: "core-platform-browser-tests" });

  adapter.write("tenants", [{ tenant_id: "tenant-001", name: "North Club" }]);
  const tenants = adapter.read("tenants");

  assert.equal(tenants[0].tenant_id, "tenant-001");
  assert.equal(tenants[0].name, "North Club");
});
