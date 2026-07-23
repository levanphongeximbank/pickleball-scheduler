import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSubjectReference,
  isSubjectReference,
  SUBJECT_REFERENCE_ERROR,
} from "./subjectReference.js";

test("valid UUID subject ID is accepted", () => {
  const result = createSubjectReference({
    subjectType: "RESOURCE",
    subjectId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.subjectType, "RESOURCE");
  assert.equal(result.value.subjectId, "550e8400-e29b-41d4-a716-446655440000");
});

test("valid prefixed subject ID is accepted", () => {
  const result = createSubjectReference({
    subjectType: "RECORD",
    subjectId: "rec_abc123",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.subjectId, "rec_abc123");
});

test("valid ordinary opaque subject ID is accepted", () => {
  const result = createSubjectReference({
    subjectType: "ENTITY",
    subjectId: "plain-subject",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.subjectId, "plain-subject");
});

test("subjectType is trimmed", () => {
  const result = createSubjectReference({
    subjectType: "  DOCUMENT  ",
    subjectId: "doc-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.subjectType, "DOCUMENT");
});

test("subjectId is trimmed", () => {
  const result = createSubjectReference({
    subjectType: "DOCUMENT",
    subjectId: "  subject-77  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.subjectId, "subject-77");
});

test("empty subjectType is rejected", () => {
  const result = createSubjectReference({
    subjectType: "",
    subjectId: "subject-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, SUBJECT_REFERENCE_ERROR.TYPE_INVALID);
  assert.equal(result.error.field, "subjectType");
});

test("empty subjectId is rejected", () => {
  const result = createSubjectReference({
    subjectType: "DOCUMENT",
    subjectId: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, SUBJECT_REFERENCE_ERROR.ID_INVALID);
  assert.equal(result.error.field, "subjectId");
});

test("invalid input is rejected", () => {
  for (const input of [null, undefined, "DOCUMENT", 1, true, []]) {
    const result = createSubjectReference(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, SUBJECT_REFERENCE_ERROR.INVALID);
  }
});

test("output is immutable", () => {
  const result = createSubjectReference({
    subjectType: "DOCUMENT",
    subjectId: "subject-locked",
  });
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.subjectType = "OTHER";
  }, TypeError);
  assert.throws(() => {
    result.value.subjectId = "changed";
  }, TypeError);
  assert.equal(result.value.subjectType, "DOCUMENT");
  assert.equal(result.value.subjectId, "subject-locked");
});

test("isSubjectReference true/false is correct", () => {
  const valid = createSubjectReference({
    subjectType: "DOCUMENT",
    subjectId: "subject-ok",
  }).value;
  assert.equal(isSubjectReference(valid), true);
  assert.equal(isSubjectReference({ subjectType: "", subjectId: "x" }), false);
  assert.equal(isSubjectReference(null), false);
  assert.equal(isSubjectReference({ subjectType: "DOCUMENT" }), false);
});

test("subjectReference does not depend on module-specific types", () => {
  const sourcePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "subjectReference.js"
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.equal(source.includes("features/"), false);
  assert.equal(source.includes("Competition"), false);
  assert.equal(source.includes("Finance"), false);
  assert.equal(source.includes("Player"), false);
  assert.equal(source.includes("Club"), false);
  assert.equal(source.includes("Venue"), false);

  const technical = createSubjectReference({
    subjectType: "ANY_TECHNICAL_TYPE",
    subjectId: "tech-1",
  });
  assert.equal(technical.ok, true);
  assert.equal(technical.value.subjectType, "ANY_TECHNICAL_TYPE");
});
