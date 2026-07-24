/**
 * Player Management Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAYER_PLATFORM_ADAPTER_ERROR,
  projectPlayerActor,
  projectPlayerSubject,
  projectPlayerSecurityContext,
  projectPlayerErrorDescriptor,
  projectPlayerOperationIdentity,
  getPlayerProfile,
} from "../src/features/player/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isSubjectReference,
  isSecurityContext,
  isPlatformErrorDescriptor,
  isOperationIdentity,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/player/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("player platform imports only canonical public entry", () => {
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

test("player actor and subject require explicit identifiers", () => {
  assert.equal(
    projectPlayerActor({}).error.code,
    PLAYER_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectPlayerSubject({}).error.code,
    PLAYER_PLATFORM_ADAPTER_ERROR.PLAYER_ID_REQUIRED
  );

  const actor = projectPlayerActor({ authUserId: "auth-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);
  assert.equal(actor.value.actorId, "auth-1");

  const subject = projectPlayerSubject({ playerId: "player-1" });
  assert.equal(isOk(subject), true);
  assert.equal(isSubjectReference(subject.value), true);
  assert.equal(subject.value.subjectType, "PLAYER");
  assert.equal(Object.isFrozen(subject.value), true);
});

test("player security context and error descriptor", () => {
  const input = Object.freeze({
    authUserId: "auth-2",
    tenantId: "tenant-2",
  });
  const ctx = projectPlayerSecurityContext(input);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(input, { authUserId: "auth-2", tenantId: "tenant-2" });

  const error = projectPlayerErrorDescriptor({
    code: "PLAYER_NOT_FOUND",
    message: "Player not found",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);
});

test("player operation identity requires explicit operationId", () => {
  assert.equal(
    projectPlayerOperationIdentity({}).error.code,
    PLAYER_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
  const result = projectPlayerOperationIdentity({
    operationId: "op-player-read-1",
  });
  assert.equal(isOk(result), true);
  assert.equal(isOperationIdentity(result.value), true);
  assert.equal(result.value.operationId, "op-player-read-1");
});

test("player platform adapters generate no identifiers and avoid persistence", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/getPlayerProfile|resolveByAuthUser|updatePlayerProfile/.test(source), false, name);
  }
});

test("player public exports remain compatible", () => {
  assert.equal(typeof getPlayerProfile, "function");
  assert.equal(typeof projectPlayerSubject, "function");
  assert.equal(isFail(projectPlayerSubject(null)), true);
});
