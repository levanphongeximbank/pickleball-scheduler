/**
 * CUSTOMER-05 — Identity, Player & CRM Linking certification.
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
const phase5Dir = path.join(root, "docs", "customer-management", "phase-5");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });
const FIXED_NOW = "2026-07-24T14:00:00.000Z";

const MIGRATION_FILES = [
  "10_CUSTOMER_PHASE_5_TABLES.sql",
  "20_CUSTOMER_PHASE_5_INDEXES.sql",
  "30_CUSTOMER_PHASE_5_RLS.sql",
  "40_CUSTOMER_PHASE_5_SAVE_RPC.sql",
  "50_CUSTOMER_PHASE_5_GRANTS.sql",
  "60_CUSTOMER_PHASE_5_HISTORY_IMMUTABLE.sql",
];

const SUPPORTING_FILES = [
  "90_CUSTOMER_PHASE_5_ROLLBACK.sql",
  "99_CUSTOMER_PHASE_5_VERIFICATION.sql",
];

function readMigration(name) {
  return readFileSync(path.join(phase5Dir, name), "utf8");
}

function createMemoryStack(options = {}) {
  const customerRepository = Customer.createInMemoryCustomerRepository();
  const linkageRepository = Customer.createInMemoryCustomerLinkageRepository({
    customerRepository,
  });
  const identityAccountDirectory =
    options.identityAccountDirectory ??
    Customer.createInMemoryIdentityAccountDirectory([
      { accountId: "auth-user-1", active: true },
      { accountId: "auth-user-2", active: true },
      { accountId: "auth-inactive", active: false },
    ]);
  const playerDirectory =
    options.playerDirectory ??
    Customer.createInMemoryPlayerDirectory([
      { playerId: "player-auth-1", active: true },
      { playerId: "player-auth-2", active: true },
      { playerId: "player-inactive", active: false },
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
      {
        contactRefId: "cref-scope-b",
        externalSystem: "CRM",
        tenantId: SCOPE_B.tenantId,
        venueId: SCOPE_B.venueId,
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
  return {
    customerRepository,
    linkageRepository,
    identityAccountDirectory,
    playerDirectory,
    crmContactDirectory,
    customerApp,
    linkageApp,
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

test("CUSTOMER-05 public exports are present and additive", () => {
  for (const name of Customer.CUSTOMER_PUBLIC_EXPORTS) {
    assert.ok(name in Customer, `missing public export ${name}`);
  }
  assert.equal(typeof Customer.createLinkageApplicationService, "function");
  assert.ok(Customer.CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT);
  assert.ok(Customer.CUSTOMER_LINKAGE_TYPE.PLAYER);
  assert.ok(Customer.CUSTOMER_LINKAGE_TYPE.CRM_CONTACT);
  assert.ok(Customer.CUSTOMER_PHASE_5_TABLES.LINKAGES);
  assert.ok(Customer.CUSTOMER_PHASE_4_TABLES.CONSENTS);
  assert.ok(Customer.CUSTOMER_PHASE_3_TABLES.CUSTOMERS);
});

// ---------------------------------------------------------------------------
// Domain linkage
// ---------------------------------------------------------------------------

test("link valid Identity account / Player / CRM reference", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);

  const identity = await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    { source: Customer.CUSTOMER_LINKAGE_SOURCE.MANUAL },
    { expectedVersion: customer.version }
  );
  assert.equal(identity.linkageType, Customer.CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT);
  assert.equal(identity.status, Customer.CUSTOMER_LINKAGE_STATUS.ACTIVE);
  assert.equal(identity.externalReferenceId, "auth-user-1");

  const refreshed = await customerApp.getCustomer(SCOPE_A, customer.customerId);
  const player = await linkageApp.linkPlayer(
    SCOPE_A,
    customer.customerId,
    "player-auth-1",
    {},
    { expectedVersion: refreshed.version }
  );
  assert.equal(player.linkageType, Customer.CUSTOMER_LINKAGE_TYPE.PLAYER);

  const afterPlayer = await customerApp.getCustomer(SCOPE_A, customer.customerId);
  const crm = await linkageApp.linkCrmReference(
    SCOPE_A,
    customer.customerId,
    "cref-1",
    {},
    { expectedVersion: afterPlayer.version }
  );
  assert.equal(crm.linkageType, Customer.CUSTOMER_LINKAGE_TYPE.CRM_CONTACT);
  assert.equal(crm.externalSystem, "CRM");
});

test("idempotent same-link command", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  const first = await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    {},
    { expectedVersion: customer.version }
  );
  const second = await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1"
  );
  assert.equal(second.linkageId, first.linkageId);
  assert.equal(second.version, first.version);
});

test("reject unsupported linkage type at domain factory", () => {
  assert.throws(
    () =>
      Customer.createCustomerLinkageRecord({
        customerId: "cust_1",
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        linkageType: "CLUB_MEMBER",
        externalReferenceId: "x",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.UNSUPPORTED_LINKAGE_TYPE
  );
});

test("unlink active linkage and idempotent second unlink", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    {},
    { expectedVersion: customer.version }
  );
  const unlinked = await linkageApp.unlinkIdentityAccount(
    SCOPE_A,
    customer.customerId
  );
  assert.equal(unlinked.status, Customer.CUSTOMER_LINKAGE_STATUS.UNLINKED);
  assert.ok(unlinked.endedAt);

  const again = await linkageApp.unlinkIdentityAccount(
    SCOPE_A,
    customer.customerId
  );
  assert.equal(again.status, Customer.CUSTOMER_LINKAGE_STATUS.UNLINKED);
  assert.equal(again.linkageId, unlinked.linkageId);
});

test("immutable history with deterministic sequence", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  await linkageApp.linkPlayer(
    SCOPE_A,
    customer.customerId,
    "player-auth-1",
    {},
    { expectedVersion: customer.version }
  );
  await linkageApp.unlinkPlayer(SCOPE_A, customer.customerId);
  const history = await linkageApp.getLinkageHistory(SCOPE_A, customer.customerId);
  assert.equal(history.length, 2);
  assert.equal(history[0].sequence, 1);
  assert.equal(history[1].sequence, 2);
  assert.equal(history[0].action, Customer.CUSTOMER_LINKAGE_ACTION.LINK);
  assert.equal(history[1].action, Customer.CUSTOMER_LINKAGE_ACTION.UNLINK);
});

test("expectedVersion success and conflict", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  await assert.rejects(
    () =>
      linkageApp.linkIdentityAccount(
        SCOPE_A,
        customer.customerId,
        "auth-user-1",
        {},
        { expectedVersion: 999 }
      ),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.VERSION_CONFLICT
  );
  const linked = await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    {},
    { expectedVersion: customer.version }
  );
  assert.equal(linked.status, Customer.CUSTOMER_LINKAGE_STATUS.ACTIVE);
});

// ---------------------------------------------------------------------------
// Conflict / uniqueness / no auto-link
// ---------------------------------------------------------------------------

test("reject Identity/Player linked to another Customer", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const a = await seedCustomer(customerApp);
  const b = await seedCustomer(customerApp, SCOPE_A, {
    individualProfile: { givenName: "Minh", familyName: "Tran" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "minh@example.com",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84907654321",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
    ],
  });

  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    a.customerId,
    "auth-user-1",
    {},
    { expectedVersion: a.version }
  );
  await assert.rejects(
    () =>
      linkageApp.linkIdentityAccount(
        SCOPE_A,
        b.customerId,
        "auth-user-1",
        {},
        { expectedVersion: b.version }
      ),
    (err) =>
      err.code ===
      Customer.CUSTOMER_ERROR_CODES.LINKAGE_TRANSFER_REQUIRES_EXPLICIT_ACTION
  );

  const a2 = await customerApp.getCustomer(SCOPE_A, a.customerId);
  await linkageApp.linkPlayer(
    SCOPE_A,
    a.customerId,
    "player-auth-1",
    {},
    { expectedVersion: a2.version }
  );
  await assert.rejects(
    () =>
      linkageApp.linkPlayer(
        SCOPE_A,
        b.customerId,
        "player-auth-1",
        {},
        { expectedVersion: b.version }
      ),
    (err) =>
      err.code ===
      Customer.CUSTOMER_ERROR_CODES.LINKAGE_TRANSFER_REQUIRES_EXPLICIT_ACTION
  );
});

test("reject Customer with conflicting active Identity/Player link", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    {},
    { expectedVersion: customer.version }
  );
  await assert.rejects(
    () => linkageApp.linkIdentityAccount(SCOPE_A, customer.customerId, "auth-user-2"),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.IDENTITY_LINK_CONFLICT
  );
});

test("CRM uniqueness by external system + reference; customer may have many CRM refs", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const a = await seedCustomer(customerApp);
  const b = await seedCustomer(customerApp, SCOPE_A, {
    individualProfile: { givenName: "Hoa", familyName: "Le" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "hoa@example.com",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84901112233",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
    ],
  });

  await linkageApp.linkCrmReference(
    SCOPE_A,
    a.customerId,
    "cref-1",
    {},
    { expectedVersion: a.version }
  );
  const a2 = await customerApp.getCustomer(SCOPE_A, a.customerId);
  await linkageApp.linkCrmReference(
    SCOPE_A,
    a.customerId,
    "cref-2",
    {},
    { expectedVersion: a2.version }
  );
  const listed = await linkageApp.listCrmReferences(SCOPE_A, a.customerId, {
    activeOnly: true,
  });
  assert.equal(listed.length, 2);

  await assert.rejects(
    () =>
      linkageApp.linkCrmReference(
        SCOPE_A,
        b.customerId,
        "cref-1",
        {},
        { expectedVersion: b.version }
      ),
    (err) =>
      err.code ===
      Customer.CUSTOMER_ERROR_CODES.LINKAGE_TRANSFER_REQUIRES_EXPLICIT_ACTION
  );
});

test("same email/phone does not auto-link", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  // Seed directories with ids that happen to look like emails? No — directories are id-based.
  // Ensure no link is created merely because contact points exist.
  const links = await linkageApp.listCustomerLinkages(SCOPE_A, customer.customerId);
  assert.equal(links.length, 0);
  const byAccount = await linkageApp.findCustomerByIdentityAccount(
    SCOPE_A,
    "lan@example.com"
  );
  assert.equal(byAccount, null);
});

test("reject CRM scope mismatch", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  await assert.rejects(
    () =>
      linkageApp.linkCrmReference(
        SCOPE_A,
        customer.customerId,
        "cref-scope-b",
        {},
        { expectedVersion: customer.version }
      ),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.EXTERNAL_REFERENCE_SCOPE_MISMATCH
  );
});

// ---------------------------------------------------------------------------
// External directories
// ---------------------------------------------------------------------------

test("external reference missing / inactive / directory unavailable", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);

  await assert.rejects(
    () =>
      linkageApp.linkIdentityAccount(
        SCOPE_A,
        customer.customerId,
        "missing-account",
        {},
        { expectedVersion: customer.version }
      ),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.IDENTITY_ACCOUNT_NOT_FOUND
  );

  await assert.rejects(
    () =>
      linkageApp.linkPlayer(
        SCOPE_A,
        customer.customerId,
        "player-inactive",
        {},
        { expectedVersion: customer.version }
      ),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE
  );

  const closed = Customer.createLinkageApplicationService({
    customerRepository: Customer.createInMemoryCustomerRepository(),
    linkageRepository: Customer.createInMemoryCustomerLinkageRepository(),
    // directories intentionally omitted
  });
  await assert.rejects(
    () => closed.linkIdentityAccount(SCOPE_A, customer.customerId, "auth-user-1"),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.LINKAGE_DIRECTORY_UNAVAILABLE ||
      err.code === Customer.CUSTOMER_ERROR_CODES.NOT_FOUND ||
      err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );
});

// ---------------------------------------------------------------------------
// Read / reverse lookup
// ---------------------------------------------------------------------------

test("reverse lookups and copy-safe projections", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    {},
    { expectedVersion: customer.version }
  );
  const after = await customerApp.getCustomer(SCOPE_A, customer.customerId);
  await linkageApp.linkPlayer(
    SCOPE_A,
    customer.customerId,
    "player-auth-1",
    {},
    { expectedVersion: after.version }
  );
  const after2 = await customerApp.getCustomer(SCOPE_A, customer.customerId);
  await linkageApp.linkCrmReference(
    SCOPE_A,
    customer.customerId,
    "cref-1",
    {},
    { expectedVersion: after2.version }
  );

  const byAccount = await linkageApp.findCustomerByIdentityAccount(
    SCOPE_A,
    "auth-user-1"
  );
  assert.equal(byAccount.customerId, customer.customerId);
  assert.equal(byAccount.linkage.externalReferenceId, "auth-user-1");
  assert.equal(byAccount.password, undefined);
  assert.equal(byAccount.credentials, undefined);

  const byPlayer = await linkageApp.findCustomerByPlayerId(
    SCOPE_A,
    "player-auth-1"
  );
  assert.equal(byPlayer.customerId, customer.customerId);

  const byCrm = await linkageApp.findCustomerByCrmReference(SCOPE_A, "cref-1");
  assert.equal(byCrm.customerId, customer.customerId);

  const identityView = await linkageApp.getIdentityLink(
    SCOPE_A,
    customer.customerId
  );
  assert.equal(identityView.accountId, "auth-user-1");
  assert.equal(identityView.email, undefined);

  // Tenant isolation
  const cross = await linkageApp.findCustomerByIdentityAccount(
    SCOPE_B,
    "auth-user-1"
  );
  assert.equal(cross, null);
});

// ---------------------------------------------------------------------------
// Persistence / runtime
// ---------------------------------------------------------------------------

test("durable fake DB linkage + history transaction and customer version bump", async () => {
  const db = Customer.createFakeCustomerDatabaseClient();
  const customerRepository = Customer.createDurableCustomerRepository({ db });
  const linkageRepository = Customer.createDurableCustomerLinkageRepository({
    db,
  });
  const identityAccountDirectory =
    Customer.createInMemoryIdentityAccountDirectory([
      { accountId: "auth-user-1", active: true },
    ]);
  let seq = 0;
  const idGenerator = {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${seq}`;
    },
  };
  const clock = { nowIso: () => FIXED_NOW };
  const customerApp = Customer.createCustomerApplicationService({
    repository: customerRepository,
    clock,
    idGenerator,
  });
  const linkageApp = Customer.createLinkageApplicationService({
    customerRepository,
    linkageRepository,
    identityAccountDirectory,
    playerDirectory: Customer.createInMemoryPlayerDirectory([
      { playerId: "player-auth-1", active: true },
    ]),
    crmContactDirectory: Customer.createInMemoryCrmContactDirectory([
      {
        contactRefId: "cref-1",
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        active: true,
      },
    ]),
    clock,
    idGenerator,
  });

  const customer = await seedCustomer(customerApp);
  assert.equal(customer.version, 1);
  const linked = await linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    {},
    { expectedVersion: 1 }
  );
  assert.equal(linked.status, Customer.CUSTOMER_LINKAGE_STATUS.ACTIVE);
  const refreshed = await customerApp.getCustomer(SCOPE_A, customer.customerId);
  assert.equal(refreshed.version, 2);
  assert.equal(refreshed.accountLinkage?.userAccountId, "auth-user-1");

  const history = await linkageApp.getLinkageHistory(SCOPE_A, customer.customerId);
  assert.equal(history.length, 1);
  assert.equal(history[0].customerVersion, 2);
});

test("rollback when uniqueness conflict occurs in fake DB", async () => {
  const db = Customer.createFakeCustomerDatabaseClient();
  const customerRepository = Customer.createDurableCustomerRepository({ db });
  const linkageRepository = Customer.createDurableCustomerLinkageRepository({
    db,
  });
  const dirs = {
    identityAccountDirectory: Customer.createInMemoryIdentityAccountDirectory([
      { accountId: "auth-user-1", active: true },
    ]),
  };
  let seq = 0;
  const idGenerator = {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${seq}`;
    },
  };
  const clock = { nowIso: () => FIXED_NOW };
  const customerApp = Customer.createCustomerApplicationService({
    repository: customerRepository,
    clock,
    idGenerator,
  });
  const linkageApp = Customer.createLinkageApplicationService({
    customerRepository,
    linkageRepository,
    ...dirs,
    clock,
    idGenerator,
  });
  const a = await seedCustomer(customerApp);
  const b = await seedCustomer(customerApp, SCOPE_A, {
    individualProfile: { givenName: "B", familyName: "B" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "b@example.com",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84909998877",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
    ],
  });
  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    a.customerId,
    "auth-user-1",
    {},
    { expectedVersion: a.version }
  );
  const bBefore = await customerApp.getCustomer(SCOPE_A, b.customerId);
  await assert.rejects(() =>
    linkageApp.linkIdentityAccount(
      SCOPE_A,
      b.customerId,
      "auth-user-1",
      {},
      { expectedVersion: bBefore.version }
    )
  );
  const bAfter = await customerApp.getCustomer(SCOPE_A, b.customerId);
  assert.equal(bAfter.version, bBefore.version);
  assert.equal(bAfter.accountLinkage, null);
});

test("missing directory port and Production memory rejection", () => {
  assert.throws(
    () =>
      Customer.createCustomerRuntime(
        {
          enabled: true,
          mode: Customer.CUSTOMER_RUNTIME_MODE.MEMORY,
          environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.PRODUCTION,
        },
        {}
      ),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );

  assert.throws(
    () =>
      Customer.createCustomerRuntime(
        {
          enabled: true,
          mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
          environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.TEST,
        },
        {}
      ),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );

  const harness = Customer.createCustomerRuntimeTestHarness({
    identityAccountDirectory: Customer.createInMemoryIdentityAccountDirectory([
      { accountId: "auth-user-1", active: true },
    ]),
    playerDirectory: Customer.createInMemoryPlayerDirectory([
      { playerId: "player-auth-1", active: true },
    ]),
    crmContactDirectory: Customer.createInMemoryCrmContactDirectory([
      {
        contactRefId: "cref-1",
        tenantId: SCOPE_A.tenantId,
        venueId: SCOPE_A.venueId,
        active: true,
      },
    ]),
  });
  assert.equal(harness.ready, true);
  assert.ok(harness.linkageApplication);
});

test("memory rollback when forced history failure", async () => {
  const customerRepository = Customer.createInMemoryCustomerRepository();
  const linkageRepository = Customer.createInMemoryCustomerLinkageRepository({
    customerRepository,
  });
  let seq = 0;
  const idGenerator = {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${seq}`;
    },
  };
  const clock = { nowIso: () => FIXED_NOW };
  const customerApp = Customer.createCustomerApplicationService({
    repository: customerRepository,
    clock,
    idGenerator,
  });
  const customer = await seedCustomer(customerApp);
  const linkage = Customer.createCustomerLinkageRecord(
    {
      customerId: customer.customerId,
      tenantId: SCOPE_A.tenantId,
      venueId: SCOPE_A.venueId,
      linkageType: Customer.CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT,
      externalReferenceId: "auth-user-1",
    },
    {
      nowIso: () => FIXED_NOW,
      nextId: (p) => idGenerator.nextId(p),
    }
  );
  const history = Customer.createCustomerLinkageHistoryRecord({
    historyId: idGenerator.nextId("lnk_hist"),
    linkageId: linkage.linkageId,
    customerId: customer.customerId,
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    linkageType: linkage.linkageType,
    externalReferenceId: linkage.externalReferenceId,
    previousStatus: null,
    nextStatus: linkage.status,
    action: Customer.CUSTOMER_LINKAGE_ACTION.LINK,
    source: linkage.source,
    sequence: 1,
    customerVersion: customer.version + 1,
    recordedAt: FIXED_NOW,
  });
  await assert.rejects(() =>
    linkageRepository.saveLinkageWithHistory(linkage, history, {
      expectedLinkageVersion: 0,
      expectedCustomerVersion: customer.version,
      customerVersionAfter: customer.version + 1,
      syncCustomerAccountUserId: "auth-user-1",
      forceHistoryFailure: true,
    })
  );
  const after = await customerApp.getCustomer(SCOPE_A, customer.customerId);
  assert.equal(after.version, customer.version);
  assert.equal(after.accountLinkage, null);
  assert.equal(await linkageRepository.getById(SCOPE_A, linkage.linkageId), null);
});

// ---------------------------------------------------------------------------
// Boundary adapters
// ---------------------------------------------------------------------------

test("Customer-owned Identity/Player/CRM adapters expose reverse lookup only", async () => {
  const stack = createMemoryStack();
  const customer = await seedCustomer(stack.customerApp);
  await stack.linkageApp.linkIdentityAccount(
    SCOPE_A,
    customer.customerId,
    "auth-user-1",
    {},
    { expectedVersion: customer.version }
  );
  const identityAdapter = Customer.createCustomerIdentityLinkageAdapter({
    identityAccountDirectory: stack.identityAccountDirectory,
    linkageApplication: stack.linkageApp,
  });
  const found = await identityAdapter.findCustomerByAccount(
    SCOPE_A,
    "auth-user-1"
  );
  assert.equal(found.customerId, customer.customerId);
  const ref = await identityAdapter.getAccountReference(SCOPE_A, "auth-user-1");
  assert.equal(ref.accountId, "auth-user-1");
  assert.equal(ref.passwordHash, undefined);
});

// ---------------------------------------------------------------------------
// Schema / static migration
// ---------------------------------------------------------------------------

test("CUSTOMER-05 migration pack exists with required artifacts", () => {
  for (const name of [...MIGRATION_FILES, ...SUPPORTING_FILES]) {
    const sql = readMigration(name);
    assert.ok(sql.length > 50, name);
  }
  const tables = readMigration("10_CUSTOMER_PHASE_5_TABLES.sql");
  assert.match(tables, /customer_linkages/);
  assert.match(tables, /customer_linkage_history/);
  assert.match(tables, /IDENTITY_ACCOUNT/);
  assert.match(tables, /PLAYER/);
  assert.match(tables, /CRM_CONTACT/);

  const indexes = readMigration("20_CUSTOMER_PHASE_5_INDEXES.sql");
  assert.match(indexes, /customer_linkages_active_identity_per_customer_uq/);
  assert.match(indexes, /customer_linkages_active_player_external_uq/);
  assert.match(indexes, /customer_linkages_active_crm_external_uq/);

  const rls = readMigration("30_CUSTOMER_PHASE_5_RLS.sql");
  assert.match(rls, /ENABLE ROW LEVEL SECURITY/);
  assert.match(rls, /FORCE ROW LEVEL SECURITY/);
  assert.match(rls, /customer_phase3_scope_allows/);
  assert.doesNotMatch(rls, /USING\s*\(\s*true\s*\)\s*;/i);
  assert.doesNotMatch(rls, /TO anon/i);

  const rpc = readMigration("40_CUSTOMER_PHASE_5_SAVE_RPC.sql");
  assert.match(rpc, /customer_save_linkage/);
  assert.match(rpc, /TO service_role/);
  assert.match(rpc, /REVOKE ALL[\s\S]*FROM authenticated/);

  const grants = readMigration("50_CUSTOMER_PHASE_5_GRANTS.sql");
  assert.match(grants, /GRANT SELECT/);
  assert.match(grants, /REVOKE INSERT, UPDATE, DELETE/);

  const immutable = readMigration("60_CUSTOMER_PHASE_5_HISTORY_IMMUTABLE.sql");
  assert.match(immutable, /append-only/);
});

test("validateLinkageConflict reports transfer requirement", async () => {
  const { customerApp, linkageApp } = createMemoryStack();
  const a = await seedCustomer(customerApp);
  const b = await seedCustomer(customerApp, SCOPE_A, {
    individualProfile: { givenName: "C", familyName: "C" },
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "c@example.com",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84905554433",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
        status: Customer.CONTACT_POINT_STATUS.ACTIVE,
      },
    ],
  });
  await linkageApp.linkIdentityAccount(
    SCOPE_A,
    a.customerId,
    "auth-user-1",
    {},
    { expectedVersion: a.version }
  );
  const result = await linkageApp.validateLinkageConflict(SCOPE_A, {
    linkageType: Customer.CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT,
    externalReferenceId: "auth-user-1",
    customerId: b.customerId,
  });
  assert.equal(result.conflict, true);
  assert.equal(result.transferRequired, true);
  assert.equal(result.existingCustomerId, a.customerId);
});
