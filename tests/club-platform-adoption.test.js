/**
 * Club Management Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLUB_PLATFORM_ADAPTER_ERROR,
  projectClubActor,
  projectClubScope,
  projectClubSubject,
  projectClubMemberSubject,
  projectClubPermission,
  projectClubSecurityContext,
  projectClubAuthorizationRequest,
  projectClubAuthorizationDecision,
} from "../src/features/club/platform/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isPlatformScope,
  isSubjectReference,
  isPermissionCode,
  isSecurityContext,
  isAuthorizationRequest,
  isAuthorizationDecision,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/club/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("club platform imports only canonical public entry", () => {
  for (const { name, source } of readPlatformSources()) {
    if (name === "index.js") continue;
    assert.match(
      source,
      /from\s+["']\.\.\/\.\.\/\.\.\/core\/platform\/index\.js["']/,
      name
    );
    assert.equal(/core\/platform\/contracts\//.test(source), false, name);
    assert.equal(/core\/platform\/adapters\//.test(source), false, name);
  }
});

test("club actor and scope require explicit identifiers", () => {
  assert.equal(
    projectClubActor({}).error.code,
    CLUB_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectClubScope({}).error.code,
    CLUB_PLATFORM_ADAPTER_ERROR.CLUB_ID_REQUIRED
  );

  const actor = projectClubActor({ userId: "user-club-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);

  const scope = projectClubScope({ clubId: "club-1", tenantId: "tenant-1" });
  assert.equal(isOk(scope), true);
  assert.equal(isPlatformScope(scope.value), true);
  assert.equal(scope.value.scopeId, "club-1");
  assert.equal(scope.value.tenantId, "tenant-1");
});

test("club subject and member subject projections", () => {
  const club = projectClubSubject({ clubId: "club-77" });
  assert.equal(isOk(club), true);
  assert.equal(isSubjectReference(club.value), true);
  assert.equal(club.value.subjectType, "CLUB");
  assert.equal(club.value.subjectId, "club-77");

  const member = projectClubMemberSubject({ memberId: "member-9" });
  assert.equal(isOk(member), true);
  assert.equal(member.value.subjectType, "CLUB_MEMBER");
});

test("club permission and security context do not mutate input", () => {
  const permissionInput = Object.freeze({ permission: "club.manage" });
  const permission = projectClubPermission(permissionInput);
  assert.equal(isOk(permission), true);
  assert.equal(isPermissionCode(permission.value), true);
  assert.deepEqual(permissionInput, { permission: "club.manage" });

  const ctxInput = Object.freeze({
    userId: "user-2",
    tenantId: "tenant-2",
  });
  const ctx = projectClubSecurityContext(ctxInput);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(ctxInput, { userId: "user-2", tenantId: "tenant-2" });
});

test("club authorization request and decision preserve resolved outcomes", () => {
  const securityContext = projectClubSecurityContext({
    userId: "user-3",
    tenantId: "tenant-3",
  }).value;
  const scope = projectClubScope({ clubId: "club-3", tenantId: "tenant-3" }).value;
  const subject = projectClubSubject({ clubId: "club-3" }).value;

  const request = projectClubAuthorizationRequest({
    securityContext,
    permissionCode: "club.manage",
    scope,
    subject,
  });
  assert.equal(isOk(request), true);
  assert.equal(isAuthorizationRequest(request.value), true);

  const allow = projectClubAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(isOk(allow), true);
  assert.equal(isAuthorizationDecision(allow.value), true);
  assert.equal(allow.value.allowed, true);

  const deny = projectClubAuthorizationDecision({
    allowed: false,
    decisionCode: "FORBIDDEN",
    reason: "not owner",
  });
  assert.equal(isOk(deny), true);
  assert.equal(deny.value.allowed, false);
});

test("club platform adapters generate no identifiers and avoid persistence", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/canManageClubGovernance|assignClubOwner|transferClub/.test(source), false, name);
  }
});

test("club public exports remain compatible", () => {
  const barrel = fs.readFileSync(
    path.join(ROOT, "src/features/club/index.js"),
    "utf8"
  );
  assert.match(barrel, /projectClubActor/);
  assert.match(barrel, /from\s+["']\.\/platform\/index\.js["']/);
  assert.equal(typeof projectClubActor, "function");
  assert.equal(isFail(projectClubActor(null)), true);
});
