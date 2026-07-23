import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createActorReference,
  isActorReference,
  ACTOR_REFERENCE_ERROR,
} from "./actorReference.js";

test("valid UUID actor ID is accepted", () => {
  const result = createActorReference({
    actorType: "USER",
    actorId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.actorType, "USER");
  assert.equal(result.value.actorId, "550e8400-e29b-41d4-a716-446655440000");
});

test("valid prefixed actor ID is accepted", () => {
  const result = createActorReference({
    actorType: "SERVICE",
    actorId: "svc_billing_01",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.actorId, "svc_billing_01");
});

test("valid ordinary opaque actor ID is accepted", () => {
  const result = createActorReference({
    actorType: "SYSTEM",
    actorId: "plain-actor",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.actorId, "plain-actor");
});

test("actorType is trimmed", () => {
  const result = createActorReference({
    actorType: "  ANONYMOUS  ",
    actorId: "anon-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.actorType, "ANONYMOUS");
});

test("actorId is trimmed", () => {
  const result = createActorReference({
    actorType: "USER",
    actorId: "  actor-77  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.actorId, "actor-77");
});

test("empty actorType is rejected", () => {
  const result = createActorReference({
    actorType: "",
    actorId: "actor-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ACTOR_REFERENCE_ERROR.TYPE_INVALID);
  assert.equal(result.error.field, "actorType");
});

test("whitespace-only actorType is rejected", () => {
  const result = createActorReference({
    actorType: "   \t  ",
    actorId: "actor-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ACTOR_REFERENCE_ERROR.TYPE_INVALID);
});

test("empty actorId is rejected", () => {
  const result = createActorReference({
    actorType: "USER",
    actorId: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ACTOR_REFERENCE_ERROR.ID_INVALID);
  assert.equal(result.error.field, "actorId");
});

test("non-string actorId is rejected", () => {
  const result = createActorReference({
    actorType: "USER",
    actorId: 42,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ACTOR_REFERENCE_ERROR.ID_INVALID);
});

test("invalid input object is rejected", () => {
  for (const input of [null, undefined, "USER", 1, true, []]) {
    const result = createActorReference(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, ACTOR_REFERENCE_ERROR.INVALID);
  }
});

test("output is immutable", () => {
  const result = createActorReference({
    actorType: "USER",
    actorId: "actor-locked",
  });
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.actorType = "SYSTEM";
  }, TypeError);
  assert.throws(() => {
    result.value.actorId = "changed";
  }, TypeError);
  assert.equal(result.value.actorType, "USER");
  assert.equal(result.value.actorId, "actor-locked");
});

test("isActorReference true/false is correct", () => {
  const valid = createActorReference({
    actorType: "USER",
    actorId: "actor-ok",
  }).value;
  assert.equal(isActorReference(valid), true);
  assert.equal(isActorReference({ actorType: "", actorId: "x" }), false);
  assert.equal(isActorReference(null), false);
  assert.equal(isActorReference({ actorType: "USER" }), false);
});

test("actorReference does not generate actor IDs", () => {
  const sourcePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "actorReference.js"
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(/function\s+generate/i.test(source), false);
  assert.equal(source.includes("crypto"), false);

  const withoutId = createActorReference({ actorType: "USER" });
  assert.equal(withoutId.ok, false);
  assert.equal(withoutId.error.code, ACTOR_REFERENCE_ERROR.ID_INVALID);
});
