import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCompatibilityDecision,
  isCompatibilityDecision,
  COMPATIBILITY_DECISION_ERROR,
} from "./compatibilityDecision.js";

test("valid minimal compatibility decision", () => {
  const result = createCompatibilityDecision({
    compatible: true,
    decisionCode: "COMPATIBLE",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.compatible, true);
  assert.equal(result.value.decisionCode, "COMPATIBLE");
  assert.equal("currentVersion" in result.value, false);
  assert.equal("requiredVersion" in result.value, false);
  assert.equal("reason" in result.value, false);
});

test("valid full compatibility decision", () => {
  const result = createCompatibilityDecision({
    compatible: false,
    decisionCode: "  INCOMPATIBLE  ",
    currentVersion: "  1.0  ",
    requiredVersion: "  2.0  ",
    reason: "  major mismatch  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.compatible, false);
  assert.equal(result.value.decisionCode, "INCOMPATIBLE");
  assert.equal(result.value.currentVersion, "1.0");
  assert.equal(result.value.requiredVersion, "2.0");
  assert.equal(result.value.reason, "major mismatch");
});

test("compatible true and false are preserved", () => {
  const yes = createCompatibilityDecision({
    compatible: true,
    decisionCode: "OK",
  });
  const no = createCompatibilityDecision({
    compatible: false,
    decisionCode: "NO",
  });
  assert.equal(yes.ok, true);
  assert.equal(yes.value.compatible, true);
  assert.equal(no.ok, true);
  assert.equal(no.value.compatible, false);
});

test("non-boolean compatible is rejected", () => {
  for (const compatible of ["true", 1, 0, "false", null, {}, []]) {
    const result = createCompatibilityDecision({
      compatible,
      decisionCode: "OK",
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.error.code,
      COMPATIBILITY_DECISION_ERROR.COMPATIBLE_INVALID
    );
  }
});

test("empty decisionCode is rejected", () => {
  const result = createCompatibilityDecision({
    compatible: true,
    decisionCode: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMPATIBILITY_DECISION_ERROR.CODE_INVALID);
});

test("non-string decisionCode is rejected", () => {
  const result = createCompatibilityDecision({
    compatible: true,
    decisionCode: 12,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMPATIBILITY_DECISION_ERROR.CODE_INVALID);
});

test("invalid currentVersion is rejected", () => {
  const result = createCompatibilityDecision({
    compatible: true,
    decisionCode: "OK",
    currentVersion: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    COMPATIBILITY_DECISION_ERROR.CURRENT_VERSION_INVALID
  );
});

test("invalid requiredVersion is rejected", () => {
  const result = createCompatibilityDecision({
    compatible: false,
    decisionCode: "NO",
    requiredVersion: 1,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    COMPATIBILITY_DECISION_ERROR.REQUIRED_VERSION_INVALID
  );
});

test("empty reason is rejected when provided", () => {
  const result = createCompatibilityDecision({
    compatible: false,
    decisionCode: "NO",
    reason: "  ",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, COMPATIBILITY_DECISION_ERROR.REASON_INVALID);
});

test("optional fields absent are not auto-created", () => {
  const result = createCompatibilityDecision({
    compatible: true,
    decisionCode: "OK",
  });
  assert.equal(result.ok, true);
  assert.equal("currentVersion" in result.value, false);
  assert.equal("requiredVersion" in result.value, false);
  assert.equal("reason" in result.value, false);
});

test("output is frozen", () => {
  const result = createCompatibilityDecision({
    compatible: true,
    decisionCode: "OK",
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.compatible = false;
  }, TypeError);
});

test("does not infer compatible from versions", () => {
  const result = createCompatibilityDecision({
    compatible: true,
    decisionCode: "FORCED_OK",
    currentVersion: "1.0",
    requiredVersion: "9.0",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.compatible, true);
});

test("does not compare or upgrade versions", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "compatibilityDecision.js"
    ),
    "utf8"
  );
  assert.equal(/compareVersions|autoUpgrade|runMigration/.test(source), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
});

test("isCompatibilityDecision true/false is correct", () => {
  const valid = createCompatibilityDecision({
    compatible: false,
    decisionCode: "NO",
  });
  assert.equal(valid.ok, true);
  assert.equal(isCompatibilityDecision(valid.value), true);
  assert.equal(
    isCompatibilityDecision({ compatible: "yes", decisionCode: "OK" }),
    false
  );
  assert.equal(isCompatibilityDecision(null), false);
});
