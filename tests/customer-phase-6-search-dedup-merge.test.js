/**
 * CUSTOMER-06 — Search, Deduplication & Merge certification.
 * Domain + application + in-memory/durable fake DB + static migration checks.
 * No Production credentials. No live Staging apply. No network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Customer from "../src/features/customer/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const phase6Dir = path.join(root, "docs", "customer-management", "phase-6");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });
const FIXED_NOW = "2026-07-24T16:00:00.000Z";

const MIGRATION_FILES = [
  "10_CUSTOMER_PHASE_6_TABLES.sql",
  "20_CUSTOMER_PHASE_6_INDEXES.sql",
  "30_CUSTOMER_PHASE_6_RLS.sql",
  "40_CUSTOMER_PHASE_6_SAVE_RPC.sql",
  "50_CUSTOMER_PHASE_6_GRANTS.sql",
  "60_CUSTOMER_PHASE_6_HISTORY_IMMUTABLE.sql",
];

const SUPPORTING_FILES = [
  "90_CUSTOMER_PHASE_6_ROLLBACK.sql",
  "99_CUSTOMER_PHASE_6_VERIFICATION.sql",
  "00_CUSTOMER_06_SEARCH_DEDUP_MERGE.md",
  "07_CUSTOMER_07_ENTRY_CRITERIA.md",
  "06_STAGING_READINESS_AND_BLOCKERS.md",
];

function readMigration(name) {
  return readFileSync(path.join(phase6Dir, name), "utf8");
}

function createMemoryStack(options = {}) {
  const customerRepository = Customer.createInMemoryCustomerRepository();
  const consentPreferenceRepository =
    Customer.createInMemoryConsentPreferenceRepository();
  const linkageRepository = Customer.createInMemoryCustomerLinkageRepository({
    customerRepository,
  });
  const mergeRepository = Customer.createInMemoryCustomerMergeRepository({
    customerRepository,
  });
  const identityAccountDirectory =
    options.identityAccountDirectory ??
    Customer.createInMemoryIdentityAccountDirectory([
      { accountId: "auth-user-1", active: true },
      { accountId: "auth-user-2", active: true },
    ]);
  const playerDirectory =
    options.playerDirectory ??
    Customer.createInMemoryPlayerDirectory([
      { playerId: "player-1", active: true },
      { playerId: "player-2", active: true },
    ]);
  const crmContactDirectory =
    options.crmContactDirectory ??
    Customer.createInMemoryCrmContactDirectory([
      {
        contactRefId: "cref-1",
        externalSystem: "CRM",
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        active: true,
      },
      {
        contactRefId: "cref-2",
        externalSystem: "CRM",
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        active: true,
      },
    ]);
  let seq = 0;
  const idGenerator = {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${seq}`;
    },
  };
  const clock = { nowIso: () => FIXED_NOW };
  const mergeApprovalPort =
    "mergeApprovalPort" in options
      ? options.mergeApprovalPort
      : Customer.createInMemoryAllowAllMergeApproval();

  const customerApp = Customer.createCustomerApplicationService({
    repository: customerRepository,
    clock,
    idGenerator,
  });
  const linkageApp = Customer.createLinkageApplicationService({
    customerRepository,
    linkageRepository,
    identityAccountDirectory,
    playerDirectory,
    crmContactDirectory,
    clock,
    idGenerator,
  });
  const mergeApp = Customer.createMergeApplicationService({
    customerRepository,
    mergeRepository,
    linkageRepository,
    consentPreferenceRepository,
    mergeApprovalPort,
    clock,
    idGenerator,
  });

  return {
    customerRepository,
    consentPreferenceRepository,
    linkageRepository,
    mergeRepository,
    customerApp,
    linkageApp,
    mergeApp,
    mergeApprovalPort,
    clock,
    idGenerator,
  };
}

async function seedCustomer(customerApp, scope = SCOPE_A, patch = {}) {
  return customerApp.createCustomer({
    ...scope,
    customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
    individualProfile: { givenName: "Lan", familyName: "Nguyen" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "lan@example.com",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84901234567",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
    ],
    ...patch,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

test("CUSTOMER-06 public exports are present and additive", () => {
  for (const name of [
    "createMergeApplicationService",
    "createInMemoryCustomerMergeRepository",
    "createDurableCustomerMergeRepository",
    "createCustomerRedirectAdapter",
    "createInMemoryAllowAllMergeApproval",
    "createFailClosedMergeApproval",
    "CUSTOMER_PHASE_6_TABLES",
    "CUSTOMER_DUPLICATE_SIGNAL",
    "CUSTOMER_DUPLICATE_CLASSIFICATION",
    "CUSTOMER_STATUS",
    "createCustomerMergeProposal",
  ]) {
    assert.equal(name in Customer, true, `missing export ${name}`);
  }
  assert.equal(Customer.CUSTOMER_STATUS.MERGED, "MERGED");
  assert.ok(Customer.CUSTOMER_PUBLIC_EXPORTS.includes("createMergeApplicationService"));
  assert.ok(Customer.CUSTOMER_PUBLIC_EXPORTS.includes("CUSTOMER_PHASE_6_TABLES"));
});

test("createCustomerMergeProposal remains backward compatible", () => {
  const thin = Customer.createCustomerMergeProposal({
    survivorCustomerId: "a",
    duplicateCustomerId: "b",
    matchKinds: [Customer.CUSTOMER_DEDUPE_MATCH_KIND.PRIMARY_EMAIL],
  });
  assert.equal(thin.survivorCustomerId, "a");
  assert.equal(thin.duplicateCustomerId, "b");
  assert.equal(thin.status, Customer.CUSTOMER_MERGE_STATUS.CANDIDATE);
  assert.equal(Object.isFrozen(thin), true);
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

test("search excludes MERGED by default and supports email/phone filters", async () => {
  const { customerApp, mergeApp, customerRepository } = createMemoryStack();
  const a = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Alpha Search",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "alpha@example.com",
        primary: true,
      },
    ],
  });
  const b = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Beta Search",
    individualProfile: { givenName: "Beta", familyName: "User" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "beta@example.com",
        primary: true,
      },
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84901112233",
        primary: true,
      },
    ],
  });

  const byEmail = await mergeApp.searchCustomers(SCOPE_A, {
    email: "alpha@example.com",
  });
  assert.equal(byEmail.length, 1);
  assert.equal(byEmail[0].customerId, a.customerId);

  const byPhone = await mergeApp.searchCustomers(SCOPE_A, {
    phone: "+84901112233",
  });
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].customerId, b.customerId);

  // Mark b as MERGED directly for search exclusion
  const rawB = await customerRepository.getById(SCOPE_A, b.customerId);
  await customerRepository.save({
    ...rawB,
    status: Customer.CUSTOMER_STATUS.MERGED,
    mergedIntoCustomerId: a.customerId,
    mergedAt: FIXED_NOW,
    version: rawB.version + 1,
    updatedAt: FIXED_NOW,
  });

  const defaultSearch = await mergeApp.searchCustomers(SCOPE_A, { text: "Search" });
  assert.equal(defaultSearch.some((r) => r.customerId === b.customerId), false);

  const includeMerged = await mergeApp.searchCustomers(SCOPE_A, {
    text: "Search",
    includeMerged: true,
  });
  assert.equal(includeMerged.some((r) => r.customerId === b.customerId), true);

  // Deterministic sort
  const all = await mergeApp.searchCustomers(SCOPE_A, { includeMerged: true, limit: 50 });
  for (let i = 1; i < all.length; i += 1) {
    const cmp = `${all[i - 1].displayName}|${all[i - 1].customerNumber}|${all[i - 1].customerId}`
      .localeCompare(
        `${all[i].displayName}|${all[i].customerNumber}|${all[i].customerId}`
      );
    assert.ok(cmp <= 0);
  }
});

test("search is scope-safe", async () => {
  const { customerApp, mergeApp } = createMemoryStack();
  await seedCustomer(customerApp, SCOPE_A, { displayName: "Scoped A" });
  const hits = await mergeApp.searchCustomers(SCOPE_B, { text: "Scoped" });
  assert.equal(hits.length, 0);
});

// ---------------------------------------------------------------------------
// Duplicate evaluation
// ---------------------------------------------------------------------------

test("same email + name corroboration yields strong candidate; never auto-merges", async () => {
  const { customerApp, mergeApp, customerRepository } = createMemoryStack();
  const a = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Same Person",
    legalName: "Same Person",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "same-a@example.com",
        primary: true,
      },
    ],
  });
  const b = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Same Person",
    legalName: "Same Person",
    individualProfile: { givenName: "Same", familyName: "Person" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "same-b@example.com",
        primary: true,
      },
    ],
  });

  // Force identical normalized email after create (create blocks same primary email).
  for (const id of [a.customerId, b.customerId]) {
    const row = await customerRepository.getById(SCOPE_A, id);
    await customerRepository.save({
      ...row,
      contactPoints: Object.freeze([
        {
          ...row.contactPoints[0],
          value: "same@example.com",
          displayValue: "same@example.com",
          normalizedValue: "same@example.com",
        },
      ]),
      version: row.version + 1,
      updatedAt: FIXED_NOW,
    });
  }

  const evaluation = await mergeApp.evaluateCustomerPair(
    SCOPE_A,
    a.customerId,
    b.customerId
  );
  assert.equal(
    evaluation.classification,
    Customer.CUSTOMER_DUPLICATE_CLASSIFICATION.STRONG_DUPLICATE_CANDIDATE
  );
  assert.ok(
    evaluation.signals.some(
      (s) => s.code === Customer.CUSTOMER_DUPLICATE_SIGNAL.EMAIL_PLUS_CORROBORATION
    )
  );

  const beforeA = await customerApp.getCustomer(SCOPE_A, a.customerId);
  const beforeB = await customerApp.getCustomer(SCOPE_A, b.customerId);
  assert.notEqual(beforeA.status, Customer.CUSTOMER_STATUS.MERGED);
  assert.notEqual(beforeB.status, Customer.CUSTOMER_STATUS.MERGED);
});

test("same CRM reference signal classifies as EXACT_REFERENCE_MATCH", () => {
  const customerA = {
    customerId: "cust_a",
    displayName: "A",
    contactPoints: [],
    addresses: [],
  };
  const customerB = {
    customerId: "cust_b",
    displayName: "B",
    contactPoints: [],
    addresses: [],
  };
  const linkagesA = [
    {
      linkageType: Customer.CUSTOMER_LINKAGE_TYPE.CRM_CONTACT,
      externalReferenceId: "cref-shared",
      externalSystem: "CRM",
      status: Customer.CUSTOMER_LINKAGE_STATUS.ACTIVE,
    },
  ];
  const linkagesB = [
    {
      linkageType: Customer.CUSTOMER_LINKAGE_TYPE.CRM_CONTACT,
      externalReferenceId: "cref-shared",
      externalSystem: "CRM",
      status: Customer.CUSTOMER_LINKAGE_STATUS.ACTIVE,
    },
  ];
  const evaluation = Customer.evaluateCustomerPair(customerA, customerB, {
    linkagesA,
    linkagesB,
  });
  assert.equal(
    evaluation.classification,
    Customer.CUSTOMER_DUPLICATE_CLASSIFICATION.EXACT_REFERENCE_MATCH
  );
});

test("different active Identity → CONFLICTING_IDENTITIES", async () => {
  const { customerApp, linkageApp, mergeApp } = createMemoryStack();
  const a = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Id A",
    contactPoints: [],
  });
  const b = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Id B",
    individualProfile: { givenName: "Id", familyName: "B" },
    contactPoints: [],
  });
  await linkageApp.linkIdentityAccount(SCOPE_A, a.customerId, "auth-user-1");
  await linkageApp.linkIdentityAccount(SCOPE_A, b.customerId, "auth-user-2");

  const evaluation = await mergeApp.evaluateCustomerPair(
    SCOPE_A,
    a.customerId,
    b.customerId
  );
  assert.equal(
    evaluation.classification,
    Customer.CUSTOMER_DUPLICATE_CLASSIFICATION.CONFLICTING_IDENTITIES
  );
});

test("canonical pair prevents A-B / B-A duplicate candidates", async () => {
  const { customerApp, mergeApp, customerRepository } = createMemoryStack();
  const a = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Pair A",
    legalName: "Pair Name",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "pair-a@example.com",
        primary: true,
      },
    ],
  });
  const b = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Pair B",
    legalName: "Pair Name",
    individualProfile: { givenName: "Pair", familyName: "B" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "pair-b@example.com",
        primary: true,
      },
    ],
  });
  for (const id of [a.customerId, b.customerId]) {
    const row = await customerRepository.getById(SCOPE_A, id);
    await customerRepository.save({
      ...row,
      contactPoints: Object.freeze([
        {
          ...row.contactPoints[0],
          value: "pair@example.com",
          displayValue: "pair@example.com",
          normalizedValue: "pair@example.com",
        },
      ]),
      version: row.version + 1,
      updatedAt: FIXED_NOW,
    });
  }

  const c1 = await mergeApp.createOrRefreshDuplicateCandidate(SCOPE_A, {
    customerIdA: a.customerId,
    customerIdB: b.customerId,
  });
  const c2 = await mergeApp.createOrRefreshDuplicateCandidate(SCOPE_A, {
    customerIdA: b.customerId,
    customerIdB: a.customerId,
  });
  assert.equal(c1.candidateId, c2.candidateId);
  assert.ok(c1.customerIdA < c1.customerIdB);
});

// ---------------------------------------------------------------------------
// Merge proposal + execution
// ---------------------------------------------------------------------------

test("merge requires approval and executes survivor/absorbed correctly", async () => {
  const noApproval = createMemoryStack({
    mergeApprovalPort: null,
  });
  const survivor0 = await seedCustomer(noApproval.customerApp, SCOPE_A, {
    displayName: "Survivor0",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "survivor0@example.com",
        primary: true,
      },
    ],
  });
  const absorbed0 = await seedCustomer(noApproval.customerApp, SCOPE_A, {
    displayName: "Absorbed0",
    individualProfile: { givenName: "Abs", familyName: "Zero" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "absorbed0@example.com",
        primary: true,
      },
    ],
  });
  const draft = await noApproval.mergeApp.createMergeProposal(SCOPE_A, {
    survivorCustomerId: survivor0.customerId,
    absorbedCustomerId: absorbed0.customerId,
  });
  await assert.rejects(
    () => noApproval.mergeApp.mergeCustomers(SCOPE_A, draft.mergeProposalId),
    (err) =>
      err instanceof Customer.CustomerError &&
      (err.code === Customer.CUSTOMER_ERROR_CODES.MERGE_PROPOSAL_NOT_APPROVED ||
        err.code === Customer.CUSTOMER_ERROR_CODES.MERGE_APPROVAL_REQUIRED)
  );

  const { customerApp, mergeApp, customerRepository } = createMemoryStack();
  const survivor = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Survivor",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "survivor@example.com",
        primary: true,
      },
    ],
  });
  const absorbed = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Absorbed",
    individualProfile: { givenName: "Abs", familyName: "Orbed" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "absorbed@example.com",
        primary: true,
      },
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84909998877",
        primary: true,
      },
    ],
  });

  const proposal = await mergeApp.createMergeProposal(SCOPE_A, {
    survivorCustomerId: survivor.customerId,
    absorbedCustomerId: absorbed.customerId,
  });
  assert.equal(proposal.status, Customer.CUSTOMER_MERGE_STATUS.DRAFT);

  const approved = await mergeApp.approveMergeProposal(
    SCOPE_A,
    proposal.mergeProposalId,
    { approvalReference: "APR-1", actorReference: "tester" }
  );
  assert.equal(approved.status, Customer.CUSTOMER_MERGE_STATUS.APPROVED);
  assert.equal(approved.approvalReference, "APR-1");

  const result = await mergeApp.mergeCustomers(SCOPE_A, proposal.mergeProposalId);
  assert.equal(result.survivorCustomerId, survivor.customerId);
  assert.equal(result.absorbedCustomerId, absorbed.customerId);
  assert.equal(result.absorbedStatus, Customer.CUSTOMER_STATUS.MERGED);

  const absorbedRow = await customerRepository.getById(
    SCOPE_A,
    absorbed.customerId
  );
  assert.equal(absorbedRow.status, Customer.CUSTOMER_STATUS.MERGED);
  assert.equal(absorbedRow.mergedIntoCustomerId, survivor.customerId);

  const survivorRow = await customerRepository.getById(
    SCOPE_A,
    survivor.customerId
  );
  assert.ok(
    (survivorRow.contactPoints || []).some(
      (c) => c.normalizedValue === "absorbed@example.com"
    )
  );

  const redirect = await mergeApp.resolveMergedCustomer(
    SCOPE_A,
    absorbed.customerId
  );
  assert.equal(redirect.canonicalCustomerId, survivor.customerId);
  assert.ok(redirect.redirectChain.includes(absorbed.customerId));

  // getById does not silently swap
  assert.equal(absorbedRow.customerId, absorbed.customerId);
});

test("Identity conflict blocks merge by default", async () => {
  const { customerApp, linkageApp, mergeApp } = createMemoryStack();
  const survivor = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Surv",
    contactPoints: [],
  });
  const absorbed = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Abs",
    individualProfile: { givenName: "A", familyName: "B" },
    contactPoints: [],
  });
  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    survivor.customerId,
    "auth-user-1"
  );
  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    absorbed.customerId,
    "auth-user-2"
  );

  const proposal = await mergeApp.createMergeProposal(SCOPE_A, {
    survivorCustomerId: survivor.customerId,
    absorbedCustomerId: absorbed.customerId,
  });
  await mergeApp.approveMergeProposal(SCOPE_A, proposal.mergeProposalId, {
    approvalReference: "APR-BLOCK",
  });

  await assert.rejects(
    () => mergeApp.mergeCustomers(SCOPE_A, proposal.mergeProposalId),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.IDENTITY_MERGE_CONFLICT
  );
});

test("fail-closed merge approval port denies approve/execute", async () => {
  const stack = createMemoryStack({
    mergeApprovalPort: Customer.createFailClosedMergeApproval(),
  });
  const survivor = await seedCustomer(stack.customerApp, SCOPE_A, {
    displayName: "S",
    contactPoints: [],
  });
  const absorbed = await seedCustomer(stack.customerApp, SCOPE_A, {
    displayName: "A",
    individualProfile: { givenName: "A", familyName: "Z" },
    contactPoints: [],
  });
  const proposal = await stack.mergeApp.createMergeProposal(SCOPE_A, {
    survivorCustomerId: survivor.customerId,
    absorbedCustomerId: absorbed.customerId,
  });
  await assert.rejects(
    () =>
      stack.mergeApp.approveMergeProposal(SCOPE_A, proposal.mergeProposalId, {}),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.MERGE_APPROVAL_REQUIRED
  );
});

test("runtime wires mergeApplication; Production rejects memory mode", () => {
  const harness = Customer.createCustomerRuntimeTestHarness({
    mergeApprovalPort: Customer.createInMemoryAllowAllMergeApproval(),
    clock: { nowIso: () => FIXED_NOW },
  });
  assert.equal(harness.ready, true);
  assert.ok(harness.mergeApplication);
  assert.ok(harness.mergeRepository);

  assert.throws(
    () =>
      Customer.createCustomerRuntime(
        {
          enabled: true,
          mode: Customer.CUSTOMER_RUNTIME_MODE.MEMORY,
          environment: "production",
        },
        {}
      ),
    (err) => err instanceof Customer.CustomerError
  );
});

test("redirect adapter resolves canonical id read-only", async () => {
  const { customerApp, mergeApp, customerRepository } = createMemoryStack();
  const survivor = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Canon",
    contactPoints: [],
  });
  const absorbed = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Merged",
    individualProfile: { givenName: "M", familyName: "G" },
    contactPoints: [],
  });
  const proposal = await mergeApp.createMergeProposal(SCOPE_A, {
    survivorCustomerId: survivor.customerId,
    absorbedCustomerId: absorbed.customerId,
  });
  await mergeApp.approveMergeProposal(SCOPE_A, proposal.mergeProposalId, {
    approvalReference: "APR-R",
  });
  await mergeApp.mergeCustomers(SCOPE_A, proposal.mergeProposalId);

  const adapter = Customer.createCustomerRedirectAdapter({
    customerRepository,
    mergeApplication: mergeApp,
  });
  const canonical = await adapter.resolveCanonicalCustomerId(
    SCOPE_A,
    absorbed.customerId
  );
  assert.equal(canonical, survivor.customerId);
  const stored = await adapter.getStoredCustomer(SCOPE_A, absorbed.customerId);
  assert.equal(stored.status, Customer.CUSTOMER_STATUS.MERGED);
});

test("restrictive consent merge prefers REVOKED over GRANTED", () => {
  assert.equal(
    Customer.mergeRestrictiveConsentStatus(
      Customer.CUSTOMER_CONSENT_STATUS.GRANTED,
      Customer.CUSTOMER_CONSENT_STATUS.REVOKED
    ),
    Customer.CUSTOMER_CONSENT_STATUS.REVOKED
  );
  assert.equal(
    Customer.mergeRestrictivePreferenceStatus(
      Customer.CUSTOMER_PREFERENCE_STATUS.OPTED_IN,
      Customer.CUSTOMER_PREFERENCE_STATUS.OPTED_OUT
    ),
    Customer.CUSTOMER_PREFERENCE_STATUS.OPTED_OUT
  );
});

// ---------------------------------------------------------------------------
// Durable fake DB
// ---------------------------------------------------------------------------

test("durable merge repository persists candidate via fake RPC", async () => {
  const db = Customer.createFakeCustomerDatabaseClient();
  const customerRepo = Customer.createDurableCustomerRepository({ db });
  const mergeRepo = Customer.createDurableCustomerMergeRepository({ db });
  const clock = { nowIso: () => FIXED_NOW };
  let seq = 0;
  const idGenerator = {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_d${seq}`;
    },
  };
  const customerApp = Customer.createCustomerApplicationService({
    repository: customerRepo,
    clock,
    idGenerator,
  });
  const a = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Durable A",
    legalName: "Durable Pair",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "durable-a@example.com",
        primary: true,
      },
    ],
  });
  const b = await seedCustomer(customerApp, SCOPE_A, {
    displayName: "Durable B",
    legalName: "Durable Pair",
    individualProfile: { givenName: "Durable", familyName: "B" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "durable-b@example.com",
        primary: true,
      },
    ],
  });

  for (const id of [a.customerId, b.customerId]) {
    const row = await customerRepo.getById(SCOPE_A, id);
    await customerRepo.save({
      ...row,
      contactPoints: Object.freeze([
        {
          ...row.contactPoints[0],
          value: "durable@example.com",
          displayValue: "durable@example.com",
          normalizedValue: "durable@example.com",
        },
      ]),
      version: row.version + 1,
      updatedAt: FIXED_NOW,
    });
  }

  const mergeApp = Customer.createMergeApplicationService({
    customerRepository: customerRepo,
    mergeRepository: mergeRepo,
    mergeApprovalPort: Customer.createInMemoryAllowAllMergeApproval(),
    clock,
    idGenerator,
  });
  const candidate = await mergeApp.createOrRefreshDuplicateCandidate(SCOPE_A, {
    customerIdA: a.customerId,
    customerIdB: b.customerId,
  });
  assert.ok(candidate.candidateId);
  const loaded = await mergeRepo.getCandidateById(SCOPE_A, candidate.candidateId);
  assert.equal(loaded.candidateId, candidate.candidateId);
});

// ---------------------------------------------------------------------------
// Schema static checks
// ---------------------------------------------------------------------------

test("CUSTOMER-06 SQL pack authored with fail-closed RLS and service_role RPCs", () => {
  for (const name of [...MIGRATION_FILES, ...SUPPORTING_FILES]) {
    const sql = readMigration(name);
    assert.ok(sql.length > 20, `${name} should exist`);
  }

  const tables = readMigration("10_CUSTOMER_PHASE_6_TABLES.sql");
  assert.match(tables, /AUTHORED ONLY/);
  assert.match(tables, /customer_duplicate_candidates/);
  assert.match(tables, /customer_merge_proposals/);
  assert.match(tables, /customer_merge_history/);
  assert.match(tables, /MERGED/);
  assert.match(tables, /merged_into_customer_id/);

  const rls = readMigration("30_CUSTOMER_PHASE_6_RLS.sql");
  assert.match(rls, /FORCE ROW LEVEL SECURITY/);
  assert.doesNotMatch(rls, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(rls, /\bTO\s+anon\b/i);
  assert.match(rls, /Intentionally no authenticated write/);

  const rpc = readMigration("40_CUSTOMER_PHASE_6_SAVE_RPC.sql");
  assert.match(rpc, /customer_execute_merge/);
  assert.match(rpc, /SECURITY DEFINER/);
  assert.match(rpc, /GRANT EXECUTE[\s\S]*TO service_role/);
  assert.match(rpc, /REVOKE ALL[\s\S]*FROM authenticated/);

  const hist = readMigration("60_CUSTOMER_PHASE_6_HISTORY_IMMUTABLE.sql");
  assert.match(hist, /append-only/);
});

test("CUSTOMER-06 error codes are registered", () => {
  for (const key of [
    "INVALID_CUSTOMER_SEARCH_QUERY",
    "DUPLICATE_CANDIDATE_NOT_FOUND",
    "MERGE_PROPOSAL_NOT_APPROVED",
    "MERGE_APPROVAL_REQUIRED",
    "IDENTITY_MERGE_CONFLICT",
    "CUSTOMER_ALREADY_MERGED",
    "CUSTOMER_MERGE_CYCLE",
  ]) {
    assert.ok(Customer.CUSTOMER_ERROR_CODES[key], key);
  }
});
