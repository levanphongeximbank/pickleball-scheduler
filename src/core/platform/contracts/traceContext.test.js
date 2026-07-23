import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createTraceContext,
  isTraceContext,
  TRACE_CONTEXT_ERROR,
} from "./traceContext.js";

test("valid correlationId is accepted", () => {
  const result = createTraceContext({
    correlationId: "corr-flow-01",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "corr-flow-01");
  assert.equal("causationId" in result.value, false);
});

test("valid causationId is accepted", () => {
  const result = createTraceContext({
    causationId: "cause-event-01",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.causationId, "cause-event-01");
  assert.equal("correlationId" in result.value, false);
});

test("both IDs are accepted together", () => {
  const result = createTraceContext({
    correlationId: "corr-both",
    causationId: "cause-both",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "corr-both");
  assert.equal(result.value.causationId, "cause-both");
});

test("prefixed opaque IDs are accepted", () => {
  const result = createTraceContext({
    correlationId: "corr_prefixed_01",
    causationId: "cause_prefixed_01",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "corr_prefixed_01");
  assert.equal(result.value.causationId, "cause_prefixed_01");
});

test("ordinary opaque IDs are accepted", () => {
  const result = createTraceContext({
    correlationId: "plain-corr",
    causationId: "plain-cause",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "plain-corr");
  assert.equal(result.value.causationId, "plain-cause");
});

test("surrounding whitespace is trimmed", () => {
  const result = createTraceContext({
    correlationId: "  corr-trim  ",
    causationId: "  cause-trim  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "corr-trim");
  assert.equal(result.value.causationId, "cause-trim");
});

test("empty correlationId is rejected", () => {
  const result = createTraceContext({ correlationId: "" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRACE_CONTEXT_ERROR.CORRELATION_ID_INVALID);
  assert.equal(result.error.field, "correlationId");
});

test("whitespace-only causationId is rejected", () => {
  const result = createTraceContext({ causationId: "   \t  " });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRACE_CONTEXT_ERROR.CAUSATION_ID_INVALID);
  assert.equal(result.error.field, "causationId");
});

test("non-string ID is rejected", () => {
  const correlation = createTraceContext({ correlationId: 42 });
  assert.equal(correlation.ok, false);
  assert.equal(
    correlation.error.code,
    TRACE_CONTEXT_ERROR.CORRELATION_ID_INVALID
  );

  const causation = createTraceContext({ causationId: null });
  assert.equal(causation.ok, false);
  assert.equal(causation.error.code, TRACE_CONTEXT_ERROR.CAUSATION_ID_INVALID);
});

test("absent optional fields are not auto-added", () => {
  const empty = createTraceContext({});
  assert.equal(empty.ok, true);
  assert.deepEqual(Object.keys(empty.value), []);
  assert.equal("correlationId" in empty.value, false);
  assert.equal("causationId" in empty.value, false);
  assert.equal(JSON.stringify(empty.value), "{}");

  const correlationOnly = createTraceContext({
    correlationId: "corr-only",
  });
  assert.equal(correlationOnly.ok, true);
  assert.deepEqual(Object.keys(correlationOnly.value), ["correlationId"]);
});

test("output is frozen", () => {
  const result = createTraceContext({
    correlationId: "corr-locked",
  });
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.correlationId = "changed";
  }, TypeError);
  assert.throws(() => {
    result.value.causationId = "injected";
  }, TypeError);
  assert.equal(result.value.correlationId, "corr-locked");
});

test("isTraceContext true/false is correct", () => {
  const valid = createTraceContext({
    correlationId: "corr-check",
  }).value;
  assert.equal(isTraceContext(valid), true);
  assert.equal(isTraceContext({}), true);
  assert.equal(isTraceContext({ correlationId: "" }), false);
  assert.equal(isTraceContext(null), false);
  assert.equal(isTraceContext([]), false);
  assert.equal(isTraceContext("corr"), false);
});

test("traceContext does not generate IDs", () => {
  const sourcePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "traceContext.js"
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(/function\s+generate/i.test(source), false);

  const result = createTraceContext({});
  assert.equal(result.ok, true);
  assert.equal("correlationId" in result.value, false);
  assert.equal("causationId" in result.value, false);
});

test("non-object input is rejected", () => {
  const result = createTraceContext(null);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRACE_CONTEXT_ERROR.INVALID);
});
