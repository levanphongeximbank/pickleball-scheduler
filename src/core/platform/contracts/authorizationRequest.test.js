import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthorizationRequest,
  isAuthorizationRequest,
  AUTHORIZATION_REQUEST_ERROR,
} from "./authorizationRequest.js";
import { createSecurityContext } from "./securityContext.js";
import { createActorReference } from "./actorReference.js";
import { createPlatformScope } from "./platformScope.js";
import { createSubjectReference } from "./subjectReference.js";

function buildSecurityContext() {
  const actor = createActorReference({
    actorType: "USER",
    actorId: "user-1",
  });
  assert.equal(actor.ok, true);
  const context = createSecurityContext({ actor: actor.value });
  assert.equal(context.ok, true);
  return context.value;
}

test("valid minimal authorization request", () => {
  const securityContext = buildSecurityContext();
  const result = createAuthorizationRequest({
    securityContext,
    permissionCode: "match.read",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.permissionCode, "match.read");
  assert.equal(result.value.securityContext, securityContext);
  assert.equal("scope" in result.value, false);
  assert.equal("subject" in result.value, false);
});

test("valid full authorization request", () => {
  const securityContext = buildSecurityContext();
  const scope = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "venue-1",
  });
  assert.equal(scope.ok, true);
  const subject = createSubjectReference({
    subjectType: "MATCH",
    subjectId: "match-1",
  });
  assert.equal(subject.ok, true);

  const result = createAuthorizationRequest({
    securityContext,
    permissionCode: "  match.write  ",
    scope: scope.value,
    subject: subject.value,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.permissionCode, "match.write");
  assert.equal(result.value.scope, scope.value);
  assert.equal(result.value.subject, subject.value);
});

test("permissionCode is trimmed", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
    permissionCode: "  club.manage  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.permissionCode, "club.manage");
});

test("invalid securityContext is rejected", () => {
  const result = createAuthorizationRequest({
    securityContext: { actor: null },
    permissionCode: "match.read",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    AUTHORIZATION_REQUEST_ERROR.SECURITY_CONTEXT_INVALID
  );
  assert.equal(result.error.field, "securityContext");
});

test("missing permissionCode is rejected", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    AUTHORIZATION_REQUEST_ERROR.PERMISSION_CODE_INVALID
  );
});

test("empty permissionCode is rejected", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
    permissionCode: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    AUTHORIZATION_REQUEST_ERROR.PERMISSION_CODE_INVALID
  );
});

test("non-string permissionCode is rejected", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
    permissionCode: 12,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    AUTHORIZATION_REQUEST_ERROR.PERMISSION_CODE_INVALID
  );
});

test("invalid scope is rejected", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
    permissionCode: "match.read",
    scope: { scopeType: "" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_REQUEST_ERROR.SCOPE_INVALID);
});

test("invalid subject is rejected", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
    permissionCode: "match.read",
    subject: { subjectType: "MATCH" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, AUTHORIZATION_REQUEST_ERROR.SUBJECT_INVALID);
});

test("optional fields absent are not auto-created", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
    permissionCode: "match.read",
  });
  assert.equal(result.ok, true);
  assert.equal("scope" in result.value, false);
  assert.equal("subject" in result.value, false);
  assert.equal("role" in result.value, false);
  assert.equal("action" in result.value, false);
  assert.equal("allowed" in result.value, false);
});

test("output is frozen", () => {
  const result = createAuthorizationRequest({
    securityContext: buildSecurityContext(),
    permissionCode: "match.read",
  });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.permissionCode = "other";
  }, TypeError);
});

test("nested references keep the same identity", () => {
  const securityContext = buildSecurityContext();
  const scope = createPlatformScope({ scopeType: "CLUB", scopeId: "c1" });
  assert.equal(scope.ok, true);
  const subject = createSubjectReference({
    subjectType: "TEAM",
    subjectId: "t1",
  });
  assert.equal(subject.ok, true);

  const result = createAuthorizationRequest({
    securityContext,
    permissionCode: "team.view",
    scope: scope.value,
    subject: subject.value,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.securityContext, securityContext);
  assert.equal(result.value.scope, scope.value);
  assert.equal(result.value.subject, subject.value);
});

test("isAuthorizationRequest true/false is correct", () => {
  const securityContext = buildSecurityContext();
  const valid = createAuthorizationRequest({
    securityContext,
    permissionCode: "match.read",
  });
  assert.equal(valid.ok, true);
  assert.equal(isAuthorizationRequest(valid.value), true);
  assert.equal(isAuthorizationRequest(null), false);
  assert.equal(isAuthorizationRequest({ permissionCode: "x" }), false);
});

test("does not run an evaluator or import Business Module", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "authorizationRequest.js"
    ),
    "utf8"
  );
  assert.equal(/evaluateAuthorization|checkPermission|hasPermission/.test(source), false);
  assert.equal(/from ["'].*features\//.test(source), false);
  assert.equal(/supabase/i.test(source), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
});
