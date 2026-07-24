/**
 * Customer Management Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CUSTOMER_PLATFORM_ADAPTER_ERROR,
  CUSTOMER_SUBJECT_TYPE,
  projectCustomerActor,
  projectCustomerSubject,
  projectCustomerSecurityContext,
  projectCustomerErrorDescriptor,
  projectCustomerOperationIdentity,
  createCustomerApplicationService,
} from "../src/features/customer/index.js";
import {
  isOk,
  isActorReference,
  isSubjectReference,
  isSecurityContext,
  isPlatformErrorDescriptor,
  isOperationIdentity,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/customer/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("customer platform imports only canonical public entry", () => {
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

test("customer actor and subject require explicit identifiers", () => {
  assert.equal(
    projectCustomerActor({}).error.code,
    CUSTOMER_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectCustomerSubject({}).error.code,
    CUSTOMER_PLATFORM_ADAPTER_ERROR.CUSTOMER_ID_REQUIRED
  );

  const actor = projectCustomerActor({ authUserId: "auth-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);
  assert.equal(actor.value.actorId, "auth-1");

  const subject = projectCustomerSubject({ customerId: "cust_1" });
  assert.equal(isOk(subject), true);
  assert.equal(isSubjectReference(subject.value), true);
  assert.equal(subject.value.subjectType, CUSTOMER_SUBJECT_TYPE);
  assert.equal(Object.isFrozen(subject.value), true);
});

test("customer security context and error descriptor", () => {
  const input = Object.freeze({
    authUserId: "auth-2",
    tenantId: "tenant-2",
  });
  const ctx = projectCustomerSecurityContext(input);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(input, { authUserId: "auth-2", tenantId: "tenant-2" });

  const error = projectCustomerErrorDescriptor({
    code: "CUSTOMER_NOT_FOUND",
    message: "Customer not found",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);
});

test("customer operation identity requires explicit operationId", () => {
  assert.equal(
    projectCustomerOperationIdentity({}).error.code,
    CUSTOMER_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
  const result = projectCustomerOperationIdentity({
    operationId: "op-customer-read-1",
  });
  assert.equal(isOk(result), true);
  assert.equal(isOperationIdentity(result.value), true);
  assert.equal(result.value.operationId, "op-customer-read-1");
});

test("customer platform adapters generate no identifiers and avoid persistence", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(
      /createCustomerApplicationService|createInMemoryCustomerRepository/.test(
        source
      ),
      false,
      name
    );
  }
});

test("customer public export remains compatible with platform adoption", () => {
  assert.equal(typeof createCustomerApplicationService, "function");
  assert.equal(typeof projectCustomerSubject, "function");
});
