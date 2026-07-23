import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPermissionCode,
  isPermissionCode,
  PERMISSION_CODE_ERROR,
} from "./permissionCode.js";

test("valid minimal permission code", () => {
  const result = createPermissionCode("match.read");
  assert.equal(result.ok, true);
  assert.equal(result.value, "match.read");
  assert.equal(isPermissionCode("match.read"), true);
});

test("valid permission code preserves case and separators", () => {
  const result = createPermissionCode("Tournament_Manage:WRITE");
  assert.equal(result.ok, true);
  assert.equal(result.value, "Tournament_Manage:WRITE");
});

test("surrounding whitespace is trimmed", () => {
  const result = createPermissionCode("  club.edit  ");
  assert.equal(result.ok, true);
  assert.equal(result.value, "club.edit");
});

test("empty string is rejected", () => {
  const result = createPermissionCode("");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PERMISSION_CODE_ERROR.EMPTY);
});

test("whitespace-only string is rejected", () => {
  const result = createPermissionCode("   ");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PERMISSION_CODE_ERROR.EMPTY);
});

test("non-string values are rejected", () => {
  for (const value of [null, undefined, 1, false, {}, []]) {
    const result = createPermissionCode(value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, PERMISSION_CODE_ERROR.NOT_STRING);
    assert.equal(isPermissionCode(value), false);
  }
});

test("does not import permission registry or map actions", () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "permissionCode.js"),
    "utf8"
  );
  assert.equal(/from ["'].*features\//.test(source), false);
  assert.equal(/mapActionToPermissions|permissionRegistry/.test(source), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
});

test("isPermissionCode true/false is correct", () => {
  assert.equal(isPermissionCode("venue.view"), true);
  assert.equal(isPermissionCode("  "), false);
  assert.equal(isPermissionCode(42), false);
});
