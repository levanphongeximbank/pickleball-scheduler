import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPlatformErrorDescriptor,
  isPlatformErrorDescriptor,
  PLATFORM_ERROR_DESCRIPTOR_ERROR,
} from "./platformErrorDescriptor.js";

test("valid minimal platform error descriptor", () => {
  const result = createPlatformErrorDescriptor({
    code: "E_REQUIRED",
    message: "Field is required",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.code, "E_REQUIRED");
  assert.equal(result.value.message, "Field is required");
  assert.equal("category" in result.value, false);
  assert.equal("field" in result.value, false);
  assert.equal("retryable" in result.value, false);
});

test("valid full platform error descriptor", () => {
  const result = createPlatformErrorDescriptor({
    code: "  E_RETRY  ",
    message: "  temporary failure  ",
    category: "  transient  ",
    field: "  email  ",
    retryable: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.code, "E_RETRY");
  assert.equal(result.value.message, "temporary failure");
  assert.equal(result.value.category, "transient");
  assert.equal(result.value.field, "email");
  assert.equal(result.value.retryable, true);
});

test("retryable false is preserved", () => {
  const result = createPlatformErrorDescriptor({
    code: "E_FATAL",
    message: "fatal",
    retryable: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.retryable, false);
});

test("non-boolean retryable is rejected", () => {
  for (const retryable of ["true", 1, 0, "false", null, {}, []]) {
    const result = createPlatformErrorDescriptor({
      code: "E",
      message: "m",
      retryable,
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.error.code,
      PLATFORM_ERROR_DESCRIPTOR_ERROR.RETRYABLE_INVALID
    );
  }
});

test("empty code is rejected", () => {
  const result = createPlatformErrorDescriptor({
    code: "   ",
    message: "m",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PLATFORM_ERROR_DESCRIPTOR_ERROR.CODE_INVALID);
});

test("empty message is rejected", () => {
  const result = createPlatformErrorDescriptor({
    code: "E",
    message: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    PLATFORM_ERROR_DESCRIPTOR_ERROR.MESSAGE_INVALID
  );
});

test("non-string code is rejected", () => {
  const result = createPlatformErrorDescriptor({
    code: 12,
    message: "m",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PLATFORM_ERROR_DESCRIPTOR_ERROR.CODE_INVALID);
});

test("empty category is rejected when provided", () => {
  const result = createPlatformErrorDescriptor({
    code: "E",
    message: "m",
    category: "  ",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    PLATFORM_ERROR_DESCRIPTOR_ERROR.CATEGORY_INVALID
  );
});

test("empty field is rejected when provided", () => {
  const result = createPlatformErrorDescriptor({
    code: "E",
    message: "m",
    field: "",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    PLATFORM_ERROR_DESCRIPTOR_ERROR.FIELD_INVALID
  );
});

test("optional fields absent are not auto-created", () => {
  const result = createPlatformErrorDescriptor({
    code: "E",
    message: "m",
  });
  assert.equal(result.ok, true);
  assert.equal("category" in result.value, false);
  assert.equal("field" in result.value, false);
  assert.equal("retryable" in result.value, false);
});

test("output is frozen", () => {
  const result = createPlatformErrorDescriptor({
    code: "E",
    message: "m",
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.code = "X";
  }, TypeError);
});

test("is not an Error class and has no stack/HTTP mapping", () => {
  const result = createPlatformErrorDescriptor({
    code: "E",
    message: "m",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value instanceof Error, false);
  assert.equal("stack" in result.value, false);
  assert.equal("status" in result.value, false);
  assert.equal("httpStatus" in result.value, false);

  const source = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "platformErrorDescriptor.js"
    ),
    "utf8"
  );
  assert.equal(/extends\s+Error|API_ERROR_CODES|supabase/.test(source), false);
  assert.equal(/from ["'].*features\//.test(source), false);
});

test("isPlatformErrorDescriptor true/false is correct", () => {
  const valid = createPlatformErrorDescriptor({
    code: "E",
    message: "m",
  });
  assert.equal(valid.ok, true);
  assert.equal(isPlatformErrorDescriptor(valid.value), true);
  assert.equal(isPlatformErrorDescriptor({ code: "E" }), false);
  assert.equal(isPlatformErrorDescriptor(null), false);
});
