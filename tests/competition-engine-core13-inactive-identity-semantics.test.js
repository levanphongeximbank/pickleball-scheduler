/**
 * CORE-13 inactive-referee fixture semantics — Contract #01 active=false.
 * Literal INACTIVE is not required. Dedicated fixture is SUSPENDED REFEREE.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import { CASE_CATALOG } from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  buildAlignedRemoteEvidenceForTests,
  createValidFixtureReceipt,
  evaluateReceiptRemoteReconciliation,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import {
  evaluateExistingQaIdentitySet,
  evaluateInactiveRefereeFixture,
  INACTIVE_REFEREE_ACCEPTANCE_RULE,
} from "../scripts/core13/core13-staging-qa-auth.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const SUBJECT_ID = "55555555-5555-4555-8555-555555555555";
const TENANT_A = "t-a";
const TENANT_B = "t-b";

function contract01(overrides = {}) {
  return {
    subjectId: SUBJECT_ID,
    canonicalSubjectId: SUBJECT_ID,
    role: "REFEREE",
    status: "suspended",
    active: false,
    tenantId: TENANT_A,
    venueId: null,
    source: "identity",
    evidenceVersion: "identity-subject-evidence-v1",
    ...overrides,
  };
}

function activeContract01(userId, tenantId = TENANT_A) {
  return {
    subjectId: userId,
    canonicalSubjectId: userId,
    role: "REFEREE",
    status: "active",
    active: true,
    tenantId,
    venueId: tenantId,
    source: "identity",
    evidenceVersion: "identity-subject-evidence-v1",
  };
}

function readyIdentities(overrides = {}) {
  const refereeAId = "33333333-3333-4333-8333-333333333333";
  const replacementId = "44444444-4444-4444-8444-444444444444";
  return {
    organizerA: { userId: "11111111-1111-4111-8111-111111111111", tenantId: TENANT_A },
    organizerB: { userId: "22222222-2222-4222-8222-222222222222", tenantId: TENANT_B },
    refereeA: {
      userId: refereeAId,
      tenantId: TENANT_A,
      role: "REFEREE",
      status: "ACTIVE",
      credentialPresent: true,
      accessToken: "r",
      contract01Evidence: activeContract01(refereeAId),
    },
    replacementReferee: {
      userId: replacementId,
      role: "REFEREE",
      status: "ACTIVE",
      contract01Evidence: activeContract01(replacementId),
    },
    inactiveReferee: {
      userId: SUBJECT_ID,
      role: "REFEREE",
      status: "suspended",
      tenantId: TENANT_A,
      contract01Evidence: contract01(),
    },
    ...overrides,
  };
}

test("literal INACTIVE is not required for inactive-referee fixture qualification", () => {
  assert.equal(INACTIVE_REFEREE_ACCEPTANCE_RULE.literalInactiveRequired, false);
  assert.equal(INACTIVE_REFEREE_ACCEPTANCE_RULE.authority, "CONTRACT_01_EVIDENCE_ACTIVE_FALSE");
  const qaAuth = read("scripts/core13/core13-staging-qa-auth.mjs");
  assert.doesNotMatch(qaAuth, /toUpperCase\(\)\s*!==\s*"INACTIVE"/);
  assert.doesNotMatch(qaAuth, /USER_STATUS\.INACTIVE/);
  const accepted = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    status: "SUSPENDED",
    contract01Evidence: contract01(),
  }, { requiredTenantId: TENANT_A });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.INACTIVE_REFEREE_EVIDENCE, "SUSPENDED / CONTRACT_01_ACTIVE_FALSE");
});

test("canonical REFEREE status=SUSPENDED active=false correct Tenant is accepted", () => {
  const proof = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    role: "PLAYER",
    status: "INACTIVE",
    tenantId: TENANT_B,
    active: true,
    contract01Evidence: contract01(),
  }, { requiredTenantId: TENANT_A });
  assert.equal(proof.ok, true);
  assert.equal(proof.status, "suspended");
  assert.equal(proof.active, false);
  assert.equal(proof.role, "REFEREE");
  assert.equal(proof.tenantId, TENANT_A);
});

test("REFEREE status=ACTIVE active=true is rejected as inactive fixture", () => {
  const proof = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    role: "REFEREE",
    status: "ACTIVE",
    contract01Evidence: contract01({ status: "active", active: true }),
  }, { requiredTenantId: TENANT_A });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /ACTIVE_NOT_FALSE/);
});

test("wrong role + active=false is rejected", () => {
  const proof = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    contract01Evidence: contract01({ role: "PLAYER" }),
  }, { requiredTenantId: TENANT_A });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /EXISTING_QA_INACTIVE_REFEREE/);
});

test("wrong Tenant + active=false is rejected", () => {
  const proof = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    contract01Evidence: contract01({ tenantId: TENANT_B }),
  }, { requiredTenantId: TENANT_A });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /TENANT/);
});

test("missing Contract #01 evidence fails closed", () => {
  const proof = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    role: "REFEREE",
    status: "suspended",
    tenantId: TENANT_A,
    active: false,
  }, { requiredTenantId: TENANT_A });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /CONTRACT_01_EVIDENCE_MISSING/);
});

test("contradictory local inactive claim cannot override canonical active=true", () => {
  const proof = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    role: "REFEREE",
    status: "INACTIVE",
    active: false,
    tenantId: TENANT_A,
    contract01Evidence: contract01({ status: "suspended", active: true }),
  }, { requiredTenantId: TENANT_A });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /ACTIVE_NOT_FALSE/);
});

test("caller/local fixture data cannot override canonical role or tenant evidence", () => {
  const wrongRole = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    role: "REFEREE",
    tenantId: TENANT_A,
    active: false,
    contract01Evidence: contract01({ role: "VENUE_OWNER" }),
  }, { requiredTenantId: TENANT_A });
  assert.equal(wrongRole.ok, false);
  const wrongTenant = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    role: "REFEREE",
    tenantId: TENANT_A,
    contract01Evidence: contract01({ tenantId: "other-tenant" }),
  }, { requiredTenantId: TENANT_A });
  assert.equal(wrongTenant.ok, false);
});

test("INVITED + active=false is not the dedicated CORE-13 inactive fixture", () => {
  const proof = evaluateInactiveRefereeFixture({
    userId: SUBJECT_ID,
    contract01Evidence: contract01({ status: "invited", active: false }),
  }, { requiredTenantId: TENANT_A });
  assert.equal(proof.ok, false);
  assert.match(proof.detail, /INVITED_NOT_DEDICATED/);
});

test("existing Organizer A/B and Referee A/Replacement remain READY with SUSPENDED inactive fixture", () => {
  const ready = evaluateExistingQaIdentitySet(readyIdentities());
  assert.equal(ready.ok, true);
  assert.equal(ready.EXISTING_QA_IDENTITY_SET_READY, true);
  assert.equal(ready.INACTIVE_REFEREE_EVIDENCE, "SUSPENDED / CONTRACT_01_ACTIVE_FALSE");
});

test("29-case catalog remains exactly 29", () => {
  assert.equal(CASE_CATALOG.length, 29);
  assert.equal(new Set(CASE_CATALOG).size, 29);
});

test("remote receipt reconciliation accepts SUSPENDED / Contract #01 active=false", () => {
  const receipt = createValidFixtureReceipt({ runId: "run-inactive-semantics" });
  assert.equal(String(receipt.users.inactiveReferee.status).toLowerCase(), "suspended");
  const aligned = buildAlignedRemoteEvidenceForTests(receipt);
  assert.equal(aligned.identities.inactiveReferee.contract01Evidence.active, false);
  assert.equal(evaluateReceiptRemoteReconciliation(receipt, aligned).ok, true);
  const missingEvidence = buildAlignedRemoteEvidenceForTests(receipt, {
    identities: {
      inactiveReferee: {
        exists: true,
        role: "REFEREE",
        status: "suspended",
        tenantId: receipt.tenantA.id,
        contract01Evidence: null,
      },
    },
  });
  const denied = evaluateReceiptRemoteReconciliation(receipt, missingEvidence);
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /CONTRACT_01|INACTIVE/);
});

test("CORE-13 QA helper does not import private Identity persistence or profiles DML", () => {
  const qaAuth = read("scripts/core13/core13-staging-qa-auth.mjs");
  assert.doesNotMatch(qaAuth, /subjectIdentityPersistence/);
  assert.doesNotMatch(qaAuth, /\.from\(\s*["']profiles["']\s*\)/);
  assert.doesNotMatch(qaAuth, /auth\.users/);
  assert.doesNotMatch(qaAuth, /USER_STATUS\.INACTIVE/);
});
