import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRoleCode,
  isRoleCode,
  ROLE_CODE_ERROR,
} from "./roleCode.js";

test("valid minimal role code", () => {
  const result = createRoleCode("DIRECTOR");
  assert.equal(result.ok, true);
  assert.equal(result.value, "DIRECTOR");
  assert.equal(isRoleCode("DIRECTOR"), true);
});

test("valid role code preserves case and separators", () => {
  const result = createRoleCode("Club_Admin-Role");
  assert.equal(result.ok, true);
  assert.equal(result.value, "Club_Admin-Role");
});

test("surrounding whitespace is trimmed", () => {
  const result = createRoleCode("  REFEREE  ");
  assert.equal(result.ok, true);
  assert.equal(result.value, "REFEREE");
});

test("empty string is rejected", () => {
  const result = createRoleCode("");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ROLE_CODE_ERROR.EMPTY);
});

test("whitespace-only string is rejected", () => {
  const result = createRoleCode("   \t  ");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ROLE_CODE_ERROR.EMPTY);
});

test("non-string values are rejected", () => {
  for (const value of [null, undefined, 12, true, {}, [], Symbol("x")]) {
    const result = createRoleCode(value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, ROLE_CODE_ERROR.NOT_STRING);
    assert.equal(isRoleCode(value), false);
  }
});

test("does not auto-generate role codes", () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "roleCode.js"),
    "utf8"
  );
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(/function\s+generate/i.test(source), false);
});

test("does not import Identity or Business Module roles", () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "roleCode.js"),
    "utf8"
  );
  assert.equal(/from ["'].*features\//.test(source), false);
  assert.equal(/from ["'].*auth\//.test(source), false);
  assert.equal(/identity/i.test(source) === false || /Does not import Identity/.test(source), true);
  assert.equal(/competitionRoles|ROLE_HIERARCHY/.test(source), false);
});

test("isRoleCode true/false is correct", () => {
  assert.equal(isRoleCode("PLAYER"), true);
  assert.equal(isRoleCode(""), false);
  assert.equal(isRoleCode(null), false);
});
