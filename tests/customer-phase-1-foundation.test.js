/**
 * CUSTOMER-01 — Customer Management domain foundation certification.
 */
import test from "node:test";
import assert from "node:assert/strict";

import * as Customer from "../src/features/customer/index.js";

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });

function createService() {
  const repository = Customer.createInMemoryCustomerRepository();
  const clock = {
    nowIso() {
      return "2026-07-24T00:00:00.000Z";
    },
  };
  let seq = 0;
  const idGenerator = {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${seq}`;
    },
  };
  const service = Customer.createCustomerApplicationService({
    repository,
    clock,
    idGenerator,
  });
  return { service, repository };
}

test("public facade exports foundation API", () => {
  for (const name of Customer.CUSTOMER_PUBLIC_EXPORTS) {
    assert.ok(name in Customer, `missing export: ${name}`);
  }
  assert.equal(typeof Customer.createCustomerProfile, "function");
  assert.equal(typeof Customer.createCustomerApplicationService, "function");
  assert.equal(typeof Customer.createInMemoryCustomerRepository, "function");
  assert.equal(typeof Customer.createFailClosedCustomerApplication, "function");
  assert.ok(Customer.CUSTOMER_ERROR_CODES.NOT_FOUND);
  assert.equal(Customer.CUSTOMER_SUBJECT_TYPE, "CUSTOMER");
});

test("fail-closed when repository adapter is not configured", async () => {
  const service = Customer.createFailClosedCustomerApplication();
  await assert.rejects(
    () =>
      service.createCustomer({
        ...SCOPE_A,
        displayName: "A",
      }),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );
});

test("create valid customer with stable customerId", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Nguyen Van A",
    customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "a@example.com",
        primary: true,
      },
    ],
  });
  assert.ok(created.customerId.startsWith(Customer.CUSTOMER_ID_PREFIX));
  assert.ok(created.customerNumber.startsWith(Customer.CUSTOMER_NUMBER_PREFIX));
  assert.equal(created.status, Customer.CUSTOMER_STATUS.ACTIVE);
  assert.equal(created.displayName, "Nguyen Van A");
  assert.equal(created.version, 1);
  assert.equal(Object.isFrozen(created), true);

  const again = await service.getCustomer(SCOPE_A, created.customerId);
  assert.equal(again.customerId, created.customerId);
  assert.equal(again.customerNumber, created.customerNumber);
});

test("reject invalid customer (missing displayName / scope / type)", () => {
  assert.throws(
    () => Customer.createCustomerProfile({ ...SCOPE_A }),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE ||
      err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_INPUT
  );
  assert.throws(
    () =>
      Customer.createCustomerProfile({
        tenantId: "t1",
        displayName: "X",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_REFERENCE
  );
  assert.throws(
    () =>
      Customer.createCustomerProfile({
        ...SCOPE_A,
        displayName: "X",
        customerType: "walk_in",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_TYPE
  );
});

test("customer type validation helpers", () => {
  assert.equal(Customer.isCustomerType(Customer.CUSTOMER_TYPE.ORGANIZATION), true);
  assert.equal(Customer.isCustomerType("member"), false);
});

test("status transitions valid and invalid", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Status Co",
    customerType: Customer.CUSTOMER_TYPE.ORGANIZATION,
  });

  const suspended = await service.changeStatus(
    SCOPE_A,
    created.customerId,
    Customer.CUSTOMER_STATUS.SUSPENDED
  );
  assert.equal(suspended.status, Customer.CUSTOMER_STATUS.SUSPENDED);
  assert.equal(suspended.version, 2);

  const active = await service.changeStatus(
    SCOPE_A,
    created.customerId,
    Customer.CUSTOMER_STATUS.ACTIVE
  );
  assert.equal(active.status, Customer.CUSTOMER_STATUS.ACTIVE);

  const archived = await service.changeStatus(
    SCOPE_A,
    created.customerId,
    Customer.CUSTOMER_STATUS.ARCHIVED
  );
  assert.equal(archived.status, Customer.CUSTOMER_STATUS.ARCHIVED);

  await assert.rejects(
    () =>
      service.changeStatus(
        SCOPE_A,
        created.customerId,
        Customer.CUSTOMER_STATUS.ACTIVE
      ),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_STATUS_TRANSITION
  );
});

test("contact points: add, primary uniqueness per type, update, remove", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Contact User",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84 90 111 2222",
        primary: true,
      },
    ],
  });

  // CUSTOMER-02: one primary EMAIL and one primary PHONE may coexist.
  const withEmail = await service.addContactPoint(SCOPE_A, created.customerId, {
    type: Customer.CONTACT_POINT_TYPE.EMAIL,
    value: "second@example.com",
    primary: true,
  });
  assert.equal(withEmail.contactPoints.length, 2);
  assert.equal(
    withEmail.contactPoints.filter((c) => c.primary).length,
    2
  );

  await assert.rejects(
    () =>
      service.addContactPoint(SCOPE_A, created.customerId, {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "other@example.com",
        primary: true,
      }),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.PRIMARY_CONTACT_CONFLICT ||
      err.code === Customer.CUSTOMER_ERROR_CODES.CONFLICTING_PRIMARY_CONTACT
  );

  const email = withEmail.contactPoints.find(
    (c) => c.type === Customer.CONTACT_POINT_TYPE.EMAIL
  );
  const updated = await service.updateContactPoint(
    SCOPE_A,
    created.customerId,
    email.contactPointId,
    { value: "updated@example.com" }
  );
  assert.ok(
    updated.contactPoints.some((c) => c.value === "updated@example.com")
  );

  const removed = await service.removeContactPoint(
    SCOPE_A,
    created.customerId,
    email.contactPointId
  );
  assert.equal(removed.contactPoints.length, 1);
});

test("invalid contact point rejected", () => {
  assert.throws(
    () =>
      Customer.createContactPoint({
        contactPointId: "cp1",
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "not-an-email",
      }),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_EMAIL ||
      err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT
  );
});

test("duplicate detection at service/adapter level", async () => {
  const { service } = createService();
  await service.createCustomer({
    ...SCOPE_A,
    displayName: "First",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "dup@example.com",
        primary: true,
      },
    ],
  });

  await assert.rejects(
    () =>
      service.createCustomer({
        ...SCOPE_A,
        displayName: "Second",
        contactPoints: [
          {
            type: Customer.CONTACT_POINT_TYPE.EMAIL,
            value: "dup@example.com",
            primary: true,
          },
        ],
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.DUPLICATE
  );
});

test("account and player linkage + conflict", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Linked Person",
  });

  const withAccount = await service.linkUserAccount(
    SCOPE_A,
    created.customerId,
    "auth-user-1"
  );
  assert.equal(withAccount.accountLinkage.userAccountId, "auth-user-1");

  await assert.rejects(
    () => service.linkUserAccount(SCOPE_A, created.customerId, "auth-user-2"),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.LINKAGE_CONFLICT
  );

  const withPlayer = await service.linkPlayer(
    SCOPE_A,
    created.customerId,
    "player-1"
  );
  assert.equal(withPlayer.playerLinkage.playerId, "player-1");

  await assert.rejects(
    () => service.linkPlayer(SCOPE_A, created.customerId, "player-2"),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.LINKAGE_CONFLICT
  );

  const unlinked = await service.unlinkPlayer(SCOPE_A, created.customerId);
  assert.equal(unlinked.playerLinkage, null);
});

test("repository get/save and tenant isolation", async () => {
  const { service, repository } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Scoped",
  });

  assert.equal(await repository.exists(SCOPE_A, created.customerId), true);
  assert.equal(await repository.getById(SCOPE_B, created.customerId), null);
  assert.equal((await repository.search(SCOPE_B, {})).length, 0);

  const found = await repository.findByCustomerNumber(
    SCOPE_A,
    created.customerNumber
  );
  assert.equal(found.customerId, created.customerId);
});

test("search projection is copy-safe / immutable", async () => {
  const { service } = createService();
  await service.createCustomer({
    ...SCOPE_A,
    displayName: "Searchable Alpha",
  });
  const results = await service.searchCustomers(SCOPE_A, { text: "alpha" });
  assert.equal(results.length, 1);
  assert.equal(Object.isFrozen(results), true);
  assert.equal(Object.isFrozen(results[0]), true);
  assert.equal(results[0].displayName, "Searchable Alpha");
  assert.equal("contactPoints" in results[0], false);

  const details = await service.getCustomer(SCOPE_A, results[0].customerId);
  assert.equal(Object.isFrozen(details), true);
  assert.ok(Array.isArray(details.contactPoints));
});

test("typed errors are CustomerError instances", () => {
  try {
    Customer.createCustomerProfile({ displayName: "x" });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal(Customer.isCustomerError(err), true);
    assert.equal(err.name, "CustomerError");
    assert.ok(Customer.isCustomerErrorCode(err.code));
  }
});

test("merge proposal contract is available (no runtime merge)", () => {
  const proposal = Customer.createCustomerMergeProposal({
    survivorCustomerId: "cust_1",
    duplicateCustomerId: "cust_2",
    matchKinds: [Customer.CUSTOMER_DEDUPE_MATCH_KIND.PRIMARY_EMAIL],
    status: Customer.CUSTOMER_MERGE_STATUS.CANDIDATE,
  });
  assert.equal(proposal.status, Customer.CUSTOMER_MERGE_STATUS.CANDIDATE);
  assert.equal(Object.isFrozen(proposal), true);
});

test("venue customer directory adapter is read-only compatible", async () => {
  const { service, repository } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Directory Row",
  });
  const directory = Customer.createVenueCustomerDirectoryAdapter(repository);
  const row = await directory.getById(SCOPE_A, created.customerId);
  assert.equal(row.customerId, created.customerId);
  const hits = await directory.search(SCOPE_A, { text: "Directory" });
  assert.equal(hits.length, 1);
});

test("legacy venue types are classification overlays, not customerType", () => {
  assert.ok(
    Customer.LEGACY_VENUE_CUSTOMER_TYPE_VALUES.includes("walk_in")
  );
  assert.equal(Customer.isCustomerType("walk_in"), false);
});
