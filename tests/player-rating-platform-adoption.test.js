/**
 * Player Rating Foundation Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAYER_RATING_PLATFORM_ADAPTER_ERROR,
  projectPlayerRatingSubject,
  projectPlayerRatingOperationIdentity,
  projectPlayerRatingContractVersion,
  projectPlayerRatingCompatibilityDecision,
  projectPlayerRatingErrorDescriptor,
  PLAYER_RATING_FOUNDATION_PHASE,
} from "../src/features/player-rating/foundation/index.js";
import {
  isOk,
  isFail,
  isSubjectReference,
  isOperationIdentity,
  isContractVersion,
  isCompatibilityDecision,
  isPlatformErrorDescriptor,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(
  ROOT,
  "src/features/player-rating/foundation/platform"
);

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("player-rating platform imports only canonical public entry", () => {
  for (const { name, source } of readPlatformSources()) {
    if (name === "index.js") continue;
    assert.match(
      source,
      /from\s+["']\.\.\/\.\.\/\.\.\/\.\.\/core\/platform\/index\.js["']/,
      name
    );
    assert.equal(/core\/platform\/contracts\//.test(source), false, name);
    assert.equal(/core\/platform\/adapters\//.test(source), false, name);
  }
});

test("player-rating subject and operation identity require explicit ids", () => {
  assert.equal(
    projectPlayerRatingSubject({}).error.code,
    PLAYER_RATING_PLATFORM_ADAPTER_ERROR.PLAYER_ID_REQUIRED
  );
  assert.equal(
    projectPlayerRatingOperationIdentity({}).error.code,
    PLAYER_RATING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );

  const subject = projectPlayerRatingSubject({ playerId: "player-r-1" });
  assert.equal(isOk(subject), true);
  assert.equal(isSubjectReference(subject.value), true);

  const input = Object.freeze({ operationId: "rating-op-1" });
  const op = projectPlayerRatingOperationIdentity(input);
  assert.equal(isOk(op), true);
  assert.equal(isOperationIdentity(op.value), true);
  assert.deepEqual(input, { operationId: "rating-op-1" });
});

test("player-rating contract version and compatibility decision", () => {
  const version = projectPlayerRatingContractVersion({
    version: "PLAYER_RATING_FOUNDATION_V1",
  });
  assert.equal(isOk(version), true);
  assert.equal(isContractVersion(version.value), true);

  const decision = projectPlayerRatingCompatibilityDecision({
    compatible: true,
    decisionCode: "COMPATIBLE",
    currentVersion: "PLAYER_RATING_FOUNDATION_V1",
    requiredVersion: "PLAYER_RATING_FOUNDATION_V1",
  });
  assert.equal(isOk(decision), true);
  assert.equal(isCompatibilityDecision(decision.value), true);
  assert.equal(decision.value.compatible, true);
  assert.equal(Object.isFrozen(decision.value), true);
});

test("player-rating error descriptor projection", () => {
  const result = projectPlayerRatingErrorDescriptor({
    code: "RATING_SCOPE_REQUIRED",
    message: "Explicit rating scope required",
    retryable: false,
  });
  assert.equal(isOk(result), true);
  assert.equal(isPlatformErrorDescriptor(result.value), true);
});

test("player-rating platform adapters generate no identifiers and avoid persistence", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/verifyPlayerRating|adjustPlayerRating|appendRatingHistory/.test(source), false, name);
  }
});

test("player-rating foundation exports remain compatible", () => {
  assert.equal(PLAYER_RATING_FOUNDATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(typeof projectPlayerRatingSubject, "function");
  assert.equal(isFail(projectPlayerRatingSubject(null)), true);
});
