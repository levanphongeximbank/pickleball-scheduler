import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlatformScope,
  isPlatformScope,
  PLATFORM_SCOPE_ERROR,
} from "./platformScope.js";

test("minimal valid scope has only scopeType", () => {
  const result = createPlatformScope({ scopeType: "GLOBAL" });
  assert.equal(result.ok, true);
  assert.equal(result.value.scopeType, "GLOBAL");
  assert.deepEqual(Object.keys(result.value), ["scopeType"]);
  assert.equal("scopeId" in result.value, false);
  assert.equal("tenantId" in result.value, false);
});

test("scopeType is trimmed", () => {
  const result = createPlatformScope({ scopeType: "  TENANT  " });
  assert.equal(result.ok, true);
  assert.equal(result.value.scopeType, "TENANT");
});

test("scope with valid scopeId is accepted", () => {
  const result = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "venue-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scopeId, "venue-1");
});

test("scope with valid tenantId is accepted", () => {
  const result = createPlatformScope({
    scopeType: "TENANT",
    tenantId: "tenant-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, "tenant-1");
});

test("scope with both scopeId and tenantId is accepted", () => {
  const result = createPlatformScope({
    scopeType: "CLUB",
    scopeId: "club-1",
    tenantId: "tenant-9",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scopeId, "club-1");
  assert.equal(result.value.tenantId, "tenant-9");
});

test("UUID ID is accepted", () => {
  const result = createPlatformScope({
    scopeType: "RESOURCE",
    scopeId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.scopeId,
    "550e8400-e29b-41d4-a716-446655440000"
  );
});

test("prefixed opaque ID is accepted", () => {
  const result = createPlatformScope({
    scopeType: "COMPETITION",
    scopeId: "comp_abc123",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scopeId, "comp_abc123");
});

test("ordinary opaque ID is accepted", () => {
  const result = createPlatformScope({
    scopeType: "MODULE_SCOPE",
    scopeId: "plain-scope",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scopeId, "plain-scope");
});

test("scopeId is trimmed", () => {
  const result = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "  venue-trim  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scopeId, "venue-trim");
});

test("tenantId is trimmed", () => {
  const result = createPlatformScope({
    scopeType: "TENANT",
    tenantId: "  tenant-trim  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, "tenant-trim");
});

test("empty scopeType is rejected", () => {
  const result = createPlatformScope({ scopeType: "" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.TYPE_INVALID);
  assert.equal(result.error.field, "scopeType");
});

test("whitespace-only scopeType is rejected", () => {
  const result = createPlatformScope({ scopeType: "   " });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.TYPE_INVALID);
  assert.equal(result.error.field, "scopeType");
});

test("non-string scopeType is rejected", () => {
  for (const scopeType of [null, undefined, 1, true, {}, []]) {
    const result = createPlatformScope({ scopeType });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.TYPE_INVALID);
    assert.equal(result.error.field, "scopeType");
  }
});

test("empty scopeId is rejected", () => {
  const result = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.ID_INVALID);
  assert.equal(result.error.field, "scopeId");
});

test("non-string scopeId is rejected", () => {
  for (const scopeId of [null, 1, true, {}, []]) {
    const result = createPlatformScope({
      scopeType: "VENUE",
      scopeId,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.ID_INVALID);
    assert.equal(result.error.field, "scopeId");
  }
});

test("empty tenantId is rejected", () => {
  const result = createPlatformScope({
    scopeType: "TENANT",
    tenantId: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.TENANT_ID_INVALID);
  assert.equal(result.error.field, "tenantId");
});

test("non-string tenantId is rejected", () => {
  for (const tenantId of [null, 1, true, {}, []]) {
    const result = createPlatformScope({
      scopeType: "TENANT",
      tenantId,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.TENANT_ID_INVALID);
    assert.equal(result.error.field, "tenantId");
  }
});

test("missing input object is rejected", () => {
  for (const input of [null, undefined, "GLOBAL", 1, true, []]) {
    const result = createPlatformScope(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, PLATFORM_SCOPE_ERROR.INVALID);
  }
});

test("optional fields absent are not auto-created", () => {
  const result = createPlatformScope({ scopeType: "GLOBAL" });
  assert.equal(result.ok, true);
  assert.equal("scopeId" in result.value, false);
  assert.equal("tenantId" in result.value, false);
});

test("output is frozen", () => {
  const result = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "venue-1",
    tenantId: "tenant-1",
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.scopeType = "mutated";
  }, TypeError);
});

test("isPlatformScope true/false is correct", () => {
  const valid = createPlatformScope({ scopeType: "GLOBAL" });
  assert.equal(valid.ok, true);
  assert.equal(isPlatformScope(valid.value), true);
  assert.equal(isPlatformScope({ scopeType: "GLOBAL" }), true);
  assert.equal(isPlatformScope({ scopeType: "" }), false);
  assert.equal(isPlatformScope(null), false);
  assert.equal(isPlatformScope("GLOBAL"), false);
});

test("does not generate IDs", () => {
  const result = createPlatformScope({ scopeType: "GLOBAL" });
  assert.equal(result.ok, true);
  assert.equal("scopeId" in result.value, false);
  assert.equal("tenantId" in result.value, false);
});

test("does not default tenantId", () => {
  const result = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "venue-1",
  });
  assert.equal(result.ok, true);
  assert.equal("tenantId" in result.value, false);
});

test("does not coerce scopeId from tenantId", () => {
  const result = createPlatformScope({
    scopeType: "TENANT",
    tenantId: "tenant-only",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, "tenant-only");
  assert.equal("scopeId" in result.value, false);
});
