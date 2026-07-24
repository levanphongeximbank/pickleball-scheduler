/**
 * CUSTOMER-02 — Customer Profile & Contact Fast Track certification.
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
      return "2026-07-24T12:00:00.000Z";
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
  return { service, repository, clock };
}

test("CUSTOMER-02 public exports include profile/contact contracts", () => {
  for (const name of Customer.CUSTOMER_PUBLIC_EXPORTS) {
    assert.ok(name in Customer, `missing export: ${name}`);
  }
  assert.equal(typeof Customer.normalizeCustomerEmail, "function");
  assert.equal(typeof Customer.normalizeCustomerPhone, "function");
  assert.equal(typeof Customer.projectCustomerProfileView, "function");
  assert.ok(Customer.CUSTOMER_ERROR_CODES.INVALID_EMAIL);
  assert.ok(Customer.CONTACT_POINT_STATUS.ACTIVE);
  assert.ok(Customer.CUSTOMER_ADDRESS_TYPE.POSTAL);
});

test("individual profile valid + displayName derivation", () => {
  const created = Customer.createCustomerProfile({
    ...SCOPE_A,
    customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
    individualProfile: {
      givenName: "Van A",
      familyName: "Nguyen",
      preferredName: "Alex",
    },
  });
  assert.equal(created.displayName, "Alex");
  assert.equal(created.individualProfile.givenName, "Van A");
  assert.equal(created.organizationProfile, null);
  assert.equal(created.customerId.startsWith(Customer.CUSTOMER_ID_PREFIX), true);
});

test("organization profile valid", () => {
  const created = Customer.createCustomerProfile({
    ...SCOPE_A,
    customerType: Customer.CUSTOMER_TYPE.ORGANIZATION,
    organizationProfile: {
      organizationName: "Pickle Hub Co",
      tradingName: "Pickle Hub",
    },
  });
  assert.equal(created.displayName, "Pickle Hub Co");
  assert.equal(created.organizationProfile.tradingName, "Pickle Hub");
  assert.equal(created.individualProfile, null);
});

test("reject blank display name", () => {
  assert.throws(
    () =>
      Customer.createCustomerProfile({
        ...SCOPE_A,
        displayName: "   ",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE
  );
});

test("reject profile/type mismatch", () => {
  assert.throws(
    () =>
      Customer.createCustomerProfile({
        ...SCOPE_A,
        displayName: "Org",
        customerType: Customer.CUSTOMER_TYPE.ORGANIZATION,
        individualProfile: { givenName: "A" },
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH
  );
  assert.throws(
    () =>
      Customer.createCustomerProfile({
        ...SCOPE_A,
        displayName: "Person",
        customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
        organizationProfile: { organizationName: "X" },
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH
  );
});

test("update profile preserves immutable ids and supports expectedVersion", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Before",
    customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
    givenName: "Before",
    familyName: "User",
  });
  assert.equal(created.version, 1);

  const updated = await service.updateCustomerProfile(
    SCOPE_A,
    created.customerId,
    { displayName: "After", givenName: "After" },
    { expectedVersion: 1 }
  );
  assert.equal(updated.displayName, "After");
  assert.equal(updated.customerId, created.customerId);
  assert.equal(updated.customerNumber, created.customerNumber);
  assert.equal(updated.version, 2);
  assert.equal(updated.individualProfile.givenName, "After");

  await assert.rejects(
    () =>
      service.updateCustomerProfile(
        SCOPE_A,
        created.customerId,
        { displayName: "Nope" },
        { expectedVersion: 1 }
      ),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.VERSION_CONFLICT
  );

  await assert.rejects(
    () =>
      service.updateCustomerProfile(SCOPE_A, created.customerId, {
        customerType: Customer.CUSTOMER_TYPE.ORGANIZATION,
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH
  );
});

test("copy-safe profile projection", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Projection",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "p@example.com",
        primary: true,
      },
    ],
  });
  const profile = await service.getCustomerProfile(SCOPE_A, created.customerId);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(profile.primaryEmail.normalizedValue, "p@example.com");
  assert.equal("accountLinkage" in profile, false);
  assert.equal("metadata" in profile, false);
});

test("email: add, normalize, reject invalid/duplicate, update, primary, deactivate", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Email User",
  });

  const withEmail = await service.addEmail(SCOPE_A, created.customerId, {
    value: "  Mixed.Case@Example.COM ",
    primary: true,
  });
  const email = withEmail.contactPoints[0];
  assert.equal(email.normalizedValue, "mixed.case@example.com");
  assert.equal(email.value, "mixed.case@example.com");
  assert.equal(email.verificationState, Customer.CONTACT_POINT_VERIFICATION_STATE.UNVERIFIED);
  assert.equal(email.status, Customer.CONTACT_POINT_STATUS.ACTIVE);

  assert.throws(
    () => Customer.normalizeCustomerEmail("bad"),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_EMAIL
  );

  await assert.rejects(
    () =>
      service.addEmail(SCOPE_A, created.customerId, {
        value: "mixed.case@example.com",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.DUPLICATE_CONTACT_POINT
  );

  const second = await service.addEmail(SCOPE_A, created.customerId, {
    value: "other@example.com",
    primary: false,
  });
  const other = second.contactPoints.find((c) => c.value === "other@example.com");
  const promoted = await service.setPrimaryEmail(
    SCOPE_A,
    created.customerId,
    other.contactPointId
  );
  const primaries = promoted.contactPoints.filter(
    (c) => c.type === Customer.CONTACT_POINT_TYPE.EMAIL && c.primary
  );
  assert.equal(primaries.length, 1);
  assert.equal(primaries[0].contactPointId, other.contactPointId);

  await assert.rejects(
    () =>
      service.addEmail(SCOPE_A, created.customerId, {
        value: "third@example.com",
        primary: true,
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.PRIMARY_CONTACT_CONFLICT
  );

  const updated = await service.updateEmail(
    SCOPE_A,
    created.customerId,
    other.contactPointId,
    { value: "renamed@example.com" }
  );
  assert.ok(updated.contactPoints.some((c) => c.value === "renamed@example.com"));

  const deactivated = await service.deactivateEmail(
    SCOPE_A,
    created.customerId,
    other.contactPointId
  );
  const inactive = deactivated.contactPoints.find(
    (c) => c.contactPointId === other.contactPointId
  );
  assert.equal(inactive.status, Customer.CONTACT_POINT_STATUS.INACTIVE);
  assert.equal(inactive.primary, false);
});

test("verification state cannot be self-asserted without trusted evidence", () => {
  assert.throws(
    () =>
      Customer.createContactPoint({
        contactPointId: "cp_v",
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "v@example.com",
        verificationState: Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT
  );

  const verified = Customer.createContactPoint({
    contactPointId: "cp_v2",
    type: Customer.CONTACT_POINT_TYPE.EMAIL,
    value: "v2@example.com",
    verificationState: Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
    trustedEvidence: true,
  });
  assert.equal(
    verified.verificationState,
    Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED
  );
});

test("phone: add, normalize, reject invalid/duplicate, update, primary, remove", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Phone User",
  });

  const withPhone = await service.addPhone(SCOPE_A, created.customerId, {
    value: "+84 (90) 333-4444",
    primary: true,
  });
  const phone = withPhone.contactPoints[0];
  assert.equal(phone.normalizedValue, "+84903334444");
  assert.equal(phone.displayValue, "+84 (90) 333-4444");

  assert.throws(
    () => Customer.normalizeCustomerPhone("123"),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_PHONE
  );

  await assert.rejects(
    () =>
      service.addPhone(SCOPE_A, created.customerId, {
        value: "+84 90 333 4444",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.DUPLICATE_CONTACT_POINT
  );

  const second = await service.addPhone(SCOPE_A, created.customerId, {
    value: "0905556666",
    primary: false,
  });
  const other = second.contactPoints.find((c) => c.normalizedValue === "0905556666");
  const promoted = await service.setPrimaryPhone(
    SCOPE_A,
    created.customerId,
    other.contactPointId
  );
  assert.equal(
    promoted.contactPoints.filter(
      (c) => c.type === Customer.CONTACT_POINT_TYPE.PHONE && c.primary
    ).length,
    1
  );

  const updated = await service.updatePhone(
    SCOPE_A,
    created.customerId,
    other.contactPointId,
    { value: "0907778888" }
  );
  assert.ok(updated.contactPoints.some((c) => c.normalizedValue === "0907778888"));

  const removed = await service.removePhone(
    SCOPE_A,
    created.customerId,
    other.contactPointId
  );
  assert.equal(removed.contactPoints.length, 1);
});

test("address create, primary conflict, copy-safe projection", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Address User",
  });

  const withAddr = await service.addAddress(SCOPE_A, created.customerId, {
    addressLine1: "12 Nguyen Hue",
    locality: "Q1",
    adminArea: "HCM",
    countryCode: "VN",
    primary: true,
  });
  assert.equal(withAddr.addresses.length, 1);
  assert.equal(withAddr.addresses[0].addressLine1, "12 Nguyen Hue");

  await assert.rejects(
    () =>
      service.addAddress(SCOPE_A, created.customerId, {
        addressLine1: "99 Le Loi",
        countryCode: "vn",
        primary: true,
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.PRIMARY_CONTACT_CONFLICT
  );

  assert.throws(
    () =>
      Customer.createCustomerAddress({
        addressId: "addr_x",
        addressLine1: "",
        countryCode: "VN",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.INVALID_ADDRESS
  );

  const second = await service.addAddress(SCOPE_A, created.customerId, {
    addressLine1: "99 Le Loi",
    countryCode: "VN",
    primary: false,
  });
  const addr2 = second.addresses.find((a) => a.addressLine1 === "99 Le Loi");
  const promoted = await service.setPrimaryAddress(
    SCOPE_A,
    created.customerId,
    addr2.addressId
  );
  assert.equal(promoted.addresses.filter((a) => a.primary).length, 1);

  const profile = await service.getCustomerProfile(SCOPE_A, created.customerId);
  assert.equal(Object.isFrozen(profile.primaryAddress), true);
  assert.equal(profile.primaryAddress.addressLine1, "99 Le Loi");
});

test("customer not found, scope isolation, contact read model", async () => {
  const { service, repository } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Scoped",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84901112222",
        primary: true,
      },
    ],
  });

  await assert.rejects(
    () => service.getCustomerProfile(SCOPE_A, "missing"),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.NOT_FOUND
  );
  assert.equal(await repository.getById(SCOPE_B, created.customerId), null);

  const contacts = await service.getCustomerContacts(SCOPE_A, created.customerId);
  assert.equal(Object.isFrozen(contacts), true);
  assert.equal(contacts.length, 1);
  assert.equal(Object.isFrozen(contacts[0]), true);
  assert.equal("createdAt" in contacts[0], false);
});

test("deterministic timestamps via injected clock", async () => {
  const { service } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Clocked",
  });
  assert.equal(created.createdAt, "2026-07-24T12:00:00.000Z");
  const updated = await service.updateCustomerProfile(SCOPE_A, created.customerId, {
    displayName: "Clocked 2",
  });
  assert.equal(updated.updatedAt, "2026-07-24T12:00:00.000Z");
});

test("CRM directory adapter remains compatible with enriched profile", async () => {
  const { service, repository } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Directory",
    givenName: "Dir",
    familyName: "User",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "dir@example.com",
        primary: true,
      },
    ],
  });
  const directory = Customer.createVenueCustomerDirectoryAdapter(repository);
  const row = await directory.getById(SCOPE_A, created.customerId);
  assert.equal(row.displayName, "Directory");
  assert.equal(row.individualProfile.givenName, "Dir");
  assert.ok(Array.isArray(row.contactPoints));
  assert.equal(Object.isFrozen(row), true);
});

test("repository optimistic concurrency on save", async () => {
  const { service, repository } = createService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Versioned",
  });
  const loaded = await repository.getById(SCOPE_A, created.customerId);
  await assert.rejects(
    async () => {
      await repository.save({ ...loaded, displayName: "stale", version: 1 });
    },
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.VERSION_CONFLICT
  );
  const saved = await repository.save({
    ...loaded,
    displayName: "fresh",
    version: 2,
  });
  assert.equal(saved.displayName, "fresh");
});
