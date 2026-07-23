import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createContractVersion,
  isContractVersion,
  CONTRACT_VERSION_ERROR,
} from "./contractVersion.js";

test("valid minimal contract version", () => {
  const result = createContractVersion("1.0.0");
  assert.equal(result.ok, true);
  assert.equal(result.value, "1.0.0");
});

test("non-semver representation is preserved", () => {
  const result = createContractVersion("phase-1e");
  assert.equal(result.ok, true);
  assert.equal(result.value, "phase-1e");
});

test("surrounding whitespace is trimmed", () => {
  const result = createContractVersion("  v2  ");
  assert.equal(result.ok, true);
  assert.equal(result.value, "v2");
});

test("empty string is rejected", () => {
  const result = createContractVersion("");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, CONTRACT_VERSION_ERROR.EMPTY);
});

test("whitespace-only string is rejected", () => {
  const result = createContractVersion("   ");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, CONTRACT_VERSION_ERROR.EMPTY);
});

test("non-string values are rejected", () => {
  for (const value of [null, undefined, 1, true, {}, []]) {
    const result = createContractVersion(value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, CONTRACT_VERSION_ERROR.NOT_STRING);
    assert.equal(isContractVersion(value), false);
  }
});

test("does not parse, compare, or auto-upgrade versions", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "contractVersion.js"
    ),
    "utf8"
  );
  assert.equal(/require\(["']semver["']\)/.test(source), false);
  assert.equal(/compareVersions|autoUpgrade|versionRegistry/.test(source), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
});

test("isContractVersion true/false is correct", () => {
  assert.equal(isContractVersion("1"), true);
  assert.equal(isContractVersion(""), false);
  assert.equal(isContractVersion(null), false);
});
