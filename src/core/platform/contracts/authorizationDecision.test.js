import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthorizationDecision,
  isAuthorizationDecision,
  AUTHORIZATION_DECISION_ERROR,
} from "./authorizationDecision.js";
import { createPlatformScope } from "./platformScope.js";

test("valid allowed decision", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, true);
  assert.equal(result.value.decisionCode, "ALLOW");
});

test("valid denied decision", () => {
  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "DENY",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, false);
  assert.equal(result.value.decisionCode, "DENY");
});

test("allowed true is preserved", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "MODULE_ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, true);
});

test("allowed false is preserved", () => {
  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "MODULE_DENY",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, false);
});

test("decisionCode is trimmed", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "  PERMITTED  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.decisionCode, "PERMITTED");
});

test("optional reason is trimmed", () => {
  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "DENIED",
    reason: "  missing membership  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.reason, "missing membership");
});

test("decision with valid Platform Scope", () => {
  const scopeResult = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "venue-1",
  });
  assert.equal(scopeResult.ok, true);

  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    scope: scopeResult.value,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scope, scopeResult.value);
});

test("decision without scope is valid", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal("scope" in result.value, false);
});

test("missing allowed is rejected", () => {
  const result = createAuthorizationDecision({
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.ALLOWED_INVALID);
  assert.equal(result.error.field, "allowed");
});

test("non-boolean allowed is rejected", () => {
  for (const allowed of ["true", 1, 0, "false", null, {}, []]) {
    const result = createAuthorizationDecision({
      allowed,
      decisionCode: "ALLOW",
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.error.code,
      AUTHORIZATION_DECISION_ERROR.ALLOWED_INVALID
    );
  }
});

test("missing decisionCode is rejected", () => {
  const result = createAuthorizationDecision({
    allowed: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.CODE_INVALID);
  assert.equal(result.error.field, "decisionCode");
});

test("empty decisionCode is rejected", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.CODE_INVALID);
  assert.equal(result.error.field, "decisionCode");
});

test("whitespace-only decisionCode is rejected", () => {
  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.CODE_INVALID);
  assert.equal(result.error.field, "decisionCode");
});

test("non-string decisionCode is rejected", () => {
  for (const decisionCode of [null, 1, true, {}, []]) {
    const result = createAuthorizationDecision({
      allowed: true,
      decisionCode,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.CODE_INVALID);
  }
});

test("empty reason is rejected when provided", () => {
  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "DENY",
    reason: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.REASON_INVALID);
  assert.equal(result.error.field, "reason");
});

test("non-string reason is rejected", () => {
  for (const reason of [null, 1, true, {}, []]) {
    const result = createAuthorizationDecision({
      allowed: false,
      decisionCode: "DENY",
      reason,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.REASON_INVALID);
  }
});

test("invalid scope is rejected", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    scope: { scopeType: "" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_DECISION_ERROR.SCOPE_INVALID);
  assert.equal(result.error.field, "scope");
});

test("optional reason absent is not auto-created", () => {
  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "DENY",
  });
  assert.equal(result.ok, true);
  assert.equal("reason" in result.value, false);
});

test("optional scope absent is not auto-created", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal("scope" in result.value, false);
});

test("output is frozen", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.allowed = false;
  }, TypeError);
});

test("nested scope keeps the same reference", () => {
  const scopeResult = createPlatformScope({
    scopeType: "CLUB",
    scopeId: "club-1",
  });
  assert.equal(scopeResult.ok, true);
  const scope = scopeResult.value;

  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    scope,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scope, scope);
});

test("isAuthorizationDecision true/false is correct", () => {
  const valid = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(valid.ok, true);
  assert.equal(isAuthorizationDecision(valid.value), true);
  assert.equal(
    isAuthorizationDecision({ allowed: true, decisionCode: "ALLOW" }),
    true
  );
  assert.equal(
    isAuthorizationDecision({ allowed: "yes", decisionCode: "ALLOW" }),
    false
  );
  assert.equal(isAuthorizationDecision(null), false);
  assert.equal(isAuthorizationDecision("ALLOW"), false);
});

test("does not infer allowed from decisionCode", () => {
  const allowedWithDenyCode = createAuthorizationDecision({
    allowed: true,
    decisionCode: "DENY",
  });
  assert.equal(allowedWithDenyCode.ok, true);
  assert.equal(allowedWithDenyCode.value.allowed, true);
  assert.equal(allowedWithDenyCode.value.decisionCode, "DENY");

  const deniedWithAllowCode = createAuthorizationDecision({
    allowed: false,
    decisionCode: "ALLOW",
  });
  assert.equal(deniedWithAllowCode.ok, true);
  assert.equal(deniedWithAllowCode.value.allowed, false);
  assert.equal(deniedWithAllowCode.value.decisionCode, "ALLOW");
});

test("denied decision does not require reason", () => {
  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "FORBIDDEN",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, false);
  assert.equal("reason" in result.value, false);
});

test("does not auto-add role", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal("role" in result.value, false);
});

test("does not auto-add permission", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal("permission" in result.value, false);
});

test("does not auto-add action", () => {
  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(result.ok, true);
  assert.equal("action" in result.value, false);
});

test("does not run an evaluator", () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "authorizationDecision.js"),
    "utf8"
  );
  assert.equal(/evaluat/i.test(source) === false || /Does not evaluate/.test(source), true);
  assert.equal(/evaluateAuthorization|checkPermission|hasPermission/.test(source), false);

  const result = createAuthorizationDecision({
    allowed: false,
    decisionCode: "CUSTOM_MODULE_CODE",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.allowed, false);
});

test("does not import Business Module", () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "authorizationDecision.js"),
    "utf8"
  );
  assert.equal(/from ["'].*features\//.test(source), false);
  assert.equal(/from ["'].*auth\//.test(source), false);
  assert.equal(/competition-core\/role-permission/.test(source), false);
  assert.equal(/crm\/authorization/.test(source), false);
});

test("does not mutate input scope", () => {
  const scopeResult = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "venue-keep",
  });
  assert.equal(scopeResult.ok, true);
  const scope = scopeResult.value;
  const before = { ...scope };

  const result = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    scope,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(scope, before);
  assert.equal(scope.scopeType, "VENUE");
  assert.equal(scope.scopeId, "venue-keep");
});
