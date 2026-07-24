/**
 * CUSTOMER-03 — Durable persistence & runtime foundation certification.
 * Static migration checks + durable adapter contract (fake DB client).
 * No Production credentials. No live Staging apply.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Customer from "../src/features/customer/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const phase3Dir = path.join(root, "docs", "customer-management", "phase-3");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });
const FIXED_NOW = "2026-07-24T12:00:00.000Z";

const MIGRATION_FILES = [
  "10_CUSTOMER_PHASE_3_TABLES.sql",
  "20_CUSTOMER_PHASE_3_INDEXES.sql",
  "30_CUSTOMER_PHASE_3_RLS.sql",
  "40_CUSTOMER_PHASE_3_SAVE_RPC.sql",
  "50_CUSTOMER_PHASE_3_GRANTS.sql",
];

const SUPPORTING_FILES = [
  "90_CUSTOMER_PHASE_3_ROLLBACK.sql",
  "99_CUSTOMER_PHASE_3_VERIFICATION.sql",
];

function readMigration(name) {
  return readFileSync(path.join(phase3Dir, name), "utf8");
}

function allSql() {
  return [...MIGRATION_FILES, ...SUPPORTING_FILES].map(readMigration).join("\n\n");
}

function createDurableService() {
  const db = Customer.createFakeCustomerDatabaseClient();
  const repository = Customer.createDurableCustomerRepository({ db });
  let seq = 0;
  const service = Customer.createCustomerApplicationService({
    repository,
    clock: { nowIso: () => FIXED_NOW },
    idGenerator: {
      nextId(prefix) {
        seq += 1;
        return `${prefix}_${seq}`;
      },
    },
  });
  return { service, repository, db };
}

// ---------------------------------------------------------------------------
// Static migration / schema certification
// ---------------------------------------------------------------------------

test("CUSTOMER-03 migration pack files exist in order", () => {
  for (const name of [...MIGRATION_FILES, ...SUPPORTING_FILES]) {
    const full = path.join(phase3Dir, name);
    assert.equal(statSync(full).isFile(), true, `missing ${name}`);
  }
  const names = readdirSync(phase3Dir).filter((n) => n.endsWith(".sql"));
  assert.ok(names.includes("10_CUSTOMER_PHASE_3_TABLES.sql"));
  assert.ok(names.indexOf("10_CUSTOMER_PHASE_3_TABLES.sql") < names.indexOf("20_CUSTOMER_PHASE_3_INDEXES.sql"));
  assert.ok(names.indexOf("20_CUSTOMER_PHASE_3_INDEXES.sql") < names.indexOf("30_CUSTOMER_PHASE_3_RLS.sql"));
  assert.ok(names.indexOf("30_CUSTOMER_PHASE_3_RLS.sql") < names.indexOf("40_CUSTOMER_PHASE_3_SAVE_RPC.sql"));
  assert.ok(names.indexOf("40_CUSTOMER_PHASE_3_SAVE_RPC.sql") < names.indexOf("50_CUSTOMER_PHASE_3_GRANTS.sql"));
});

test("schema declares required tables, columns, version, and FKs", () => {
  const tables = readMigration("10_CUSTOMER_PHASE_3_TABLES.sql");
  assert.match(tables, /CREATE TABLE IF NOT EXISTS public\.customers/);
  assert.match(tables, /CREATE TABLE IF NOT EXISTS public\.customer_contact_points/);
  assert.match(tables, /CREATE TABLE IF NOT EXISTS public\.customer_addresses/);
  assert.match(tables, /customer_id text PRIMARY KEY/);
  assert.match(tables, /customer_number text NOT NULL/);
  assert.match(tables, /tenant_id text NOT NULL/);
  assert.match(tables, /venue_id text NOT NULL/);
  assert.match(tables, /version integer NOT NULL DEFAULT 1/);
  assert.match(tables, /customers_version_positive/);
  assert.match(tables, /customers_tenant_venue_customer_number_uq/);
  assert.match(tables, /FOREIGN KEY \(tenant_id, venue_id, customer_id\)/);
  assert.match(tables, /ON DELETE CASCADE/);
});

test("indexes include partial uniqueness for contacts and primary address", () => {
  const indexes = readMigration("20_CUSTOMER_PHASE_3_INDEXES.sql");
  assert.match(indexes, /customer_contact_points_active_normalized_uq/);
  assert.match(indexes, /customer_contact_points_primary_email_uq/);
  assert.match(indexes, /customer_contact_points_primary_phone_uq/);
  assert.match(indexes, /customer_addresses_primary_active_uq/);
  assert.match(indexes, /WHERE status = 'ACTIVE'/);
  assert.doesNotMatch(indexes, /UNIQUE \(tenant_id, venue_id, contact_type, normalized_value\)/);
});

test("RLS is fail-closed with verified helpers and no anon / write policies", () => {
  const rls = readMigration("30_CUSTOMER_PHASE_3_RLS.sql");
  assert.match(rls, /customer_phase3_scope_allows/);
  assert.match(rls, /user_venue_id\(\)/);
  assert.match(rls, /user_has_permission/);
  assert.match(rls, /is_super_admin\(\)/);
  assert.match(rls, /ENABLE ROW LEVEL SECURITY/);
  assert.match(rls, /FORCE ROW LEVEL SECURITY/);
  assert.match(rls, /FOR SELECT/);
  assert.doesNotMatch(rls, /TO anon/);
  assert.doesNotMatch(rls, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(rls, /FOR INSERT/);
  assert.doesNotMatch(rls, /FOR UPDATE/);
  assert.doesNotMatch(rls, /FOR DELETE/);
  assert.match(rls, /tenant_id = public\.user_venue_id\(\)/);
  assert.match(rls, /EXISTS \([\s\S]*FROM public\.customers c/);
});

test("save RPC enforces optimistic concurrency and service_role-only execute", () => {
  const rpc = readMigration("40_CUSTOMER_PHASE_3_SAVE_RPC.sql");
  const grants = readMigration("50_CUSTOMER_PHASE_3_GRANTS.sql");
  assert.match(rpc, /customer_save_aggregate/);
  assert.match(rpc, /CUSTOMER_VERSION_CONFLICT/);
  assert.match(rpc, /FOR UPDATE/);
  assert.match(rpc, /SECURITY DEFINER/);
  assert.match(rpc, /REVOKE ALL[\s\S]*FROM authenticated/);
  assert.match(grants, /GRANT EXECUTE[\s\S]*TO service_role/);
  assert.match(grants, /GRANT SELECT ON TABLE public\.customers TO authenticated/);
  assert.doesNotMatch(grants, /GRANT INSERT[\s\S]*TO authenticated/);
  assert.doesNotMatch(grants, /TO anon/);
});

test("migration pack documents authored-only and has rollback + verification", () => {
  const sql = allSql();
  assert.match(sql, /AUTHORED ONLY/);
  assert.match(readMigration("90_CUSTOMER_PHASE_3_ROLLBACK.sql"), /DROP TABLE IF EXISTS public\.customers/);
  assert.match(readMigration("99_CUSTOMER_PHASE_3_VERIFICATION.sql"), /relrowsecurity/);
});

test("public facade exports CUSTOMER-03 persistence and runtime APIs", () => {
  for (const name of Customer.CUSTOMER_PUBLIC_EXPORTS) {
    assert.ok(name in Customer, `missing export: ${name}`);
  }
  assert.equal(typeof Customer.createDurableCustomerRepository, "function");
  assert.equal(typeof Customer.createCustomerRuntime, "function");
  assert.equal(typeof Customer.createFakeCustomerDatabaseClient, "function");
  assert.equal(Customer.CUSTOMER_PHASE_3_TABLES.CUSTOMERS, "customers");
  assert.equal(Customer.CUSTOMER_RUNTIME_MODE.DURABLE, "durable");
});

// ---------------------------------------------------------------------------
// Durable repository adapter
// ---------------------------------------------------------------------------

test("durable create and read round-trip", async () => {
  const { service } = createDurableService();
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
    addresses: [
      {
        addressType: Customer.CUSTOMER_ADDRESS_TYPE.POSTAL,
        addressLine1: "1 Nguyen Hue",
        locality: "HCM",
        primary: true,
      },
    ],
  });
  assert.equal(created.version, 1);
  assert.equal(created.contactPoints.length, 1);
  assert.equal(created.addresses.length, 1);

  const loaded = await service.getCustomer(SCOPE_A, created.customerId);
  assert.equal(loaded.displayName, "Nguyen Van A");
  assert.equal(loaded.contactPoints[0].normalizedValue, "a@example.com");
  assert.equal(loaded.addresses[0].addressLine1, "1 Nguyen Hue");
});

test("durable update and expectedVersion success", async () => {
  const { service } = createDurableService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Before",
  });
  const updated = await service.updateCustomerProfile(
    SCOPE_A,
    created.customerId,
    { displayName: "After" },
    { expectedVersion: created.version }
  );
  assert.equal(updated.displayName, "After");
  assert.equal(updated.version, created.version + 1);
});

test("durable expectedVersion conflict", async () => {
  const { service, repository } = createDurableService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "V1",
  });
  await service.updateCustomerProfile(
    SCOPE_A,
    created.customerId,
    { displayName: "V2" },
    { expectedVersion: created.version }
  );

  const current = await repository.getById(SCOPE_A, created.customerId);
  await assert.rejects(
    () =>
      repository.save({
        ...current,
        displayName: "Stale",
        version: created.version,
        updatedAt: FIXED_NOW,
      }),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.VERSION_CONFLICT
  );
});

test("durable customer number uniqueness within scope", async () => {
  const { repository } = createDurableService();
  const first = Customer.createCustomerProfile(
    {
      ...SCOPE_A,
      customerId: "cust_1",
      customerNumber: "CN-1",
      displayName: "One",
    },
    { nowIso: () => FIXED_NOW, nextId: (p) => `${p}_x` }
  );
  await repository.save(first);
  const second = Customer.createCustomerProfile(
    {
      ...SCOPE_A,
      customerId: "cust_2",
      customerNumber: "CN-1",
      displayName: "Two",
    },
    { nowIso: () => FIXED_NOW, nextId: (p) => `${p}_y` }
  );
  await assert.rejects(
    () => repository.save(second),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.DUPLICATE
  );
});

test("durable normalized email/phone duplicate within customer and primary uniqueness", async () => {
  const { repository } = createDurableService();
  const root = {
    customerId: "cust_dup",
    customerNumber: "CN-DUP",
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    displayName: "Dup",
    legalName: null,
    individualProfile: null,
    organizationProfile: null,
    customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
    status: Customer.CUSTOMER_STATUS.ACTIVE,
    addresses: [],
    locale: null,
    accountLinkage: null,
    playerLinkage: null,
    organizationLinkage: null,
    classification: [],
    segmentReferences: [],
    tags: [],
    communicationPreferences: [],
    consentReferences: [],
    metadata: {},
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    version: 1,
  };

  const withTwoPrimaries = {
    ...root,
    contactPoints: [
      {
        contactPointId: "cp_a",
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "a@example.com",
        normalizedValue: "a@example.com",
        displayValue: "a@example.com",
        purpose: "GENERAL",
        primary: true,
        verificationState: "UNVERIFIED",
        status: "ACTIVE",
        version: 1,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      {
        contactPointId: "cp_b",
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "b@example.com",
        normalizedValue: "b@example.com",
        displayValue: "b@example.com",
        purpose: "GENERAL",
        primary: true,
        verificationState: "UNVERIFIED",
        status: "ACTIVE",
        version: 1,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
    ],
  };

  await assert.rejects(
    () => repository.save(withTwoPrimaries),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.DUPLICATE
  );

  const withDupNormalized = {
    ...root,
    customerId: "cust_dup2",
    customerNumber: "CN-DUP2",
    contactPoints: [
      {
        contactPointId: "cp_c",
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84901234567",
        normalizedValue: "+84901234567",
        displayValue: "+84 901 234 567",
        purpose: "GENERAL",
        primary: true,
        verificationState: "UNVERIFIED",
        status: "ACTIVE",
        version: 1,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
      {
        contactPointId: "cp_d",
        type: Customer.CONTACT_POINT_TYPE.PHONE,
        value: "+84901234567",
        normalizedValue: "+84901234567",
        displayValue: "0901234567",
        purpose: "BILLING",
        primary: false,
        verificationState: "UNVERIFIED",
        status: "ACTIVE",
        version: 1,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
    ],
  };
  await assert.rejects(
    () => repository.save(withDupNormalized),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.DUPLICATE
  );
});

test("durable address persistence and contact deactivation", async () => {
  const { service } = createDurableService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Addr",
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "addr@example.com",
        primary: true,
      },
    ],
    addresses: [
      {
        addressType: Customer.CUSTOMER_ADDRESS_TYPE.BUSINESS,
        addressLine1: "2 Le Loi",
        countryCode: "VN",
        primary: true,
      },
    ],
  });

  const deactivated = await service.deactivateEmail(
    SCOPE_A,
    created.customerId,
    created.contactPoints[0].contactPointId,
    { expectedVersion: created.version }
  );
  assert.equal(deactivated.contactPoints[0].status, Customer.CONTACT_POINT_STATUS.INACTIVE);
  assert.equal(deactivated.contactPoints[0].primary, false);
  assert.equal(deactivated.addresses[0].addressLine1, "2 Le Loi");
});

test("durable profile and search projection", async () => {
  const { service } = createDurableService();
  await service.createCustomer({
    ...SCOPE_A,
    displayName: "Search Target",
    customerType: Customer.CUSTOMER_TYPE.INDIVIDUAL,
    contactPoints: [
      { type: Customer.CONTACT_POINT_TYPE.EMAIL, value: "search@example.com", primary: true },
    ],
  });
  await service.createCustomer({
    ...SCOPE_A,
    displayName: "Other",
  });

  const hits = await service.searchCustomers(SCOPE_A, { text: "Search" });
  assert.equal(hits.length, 1);
  const profile = await service.getCustomerProfile(SCOPE_A, hits[0].customerId);
  assert.equal(profile.displayName, "Search Target");

  const byEmail = await service.searchCustomers(SCOPE_A, { text: "search@" });
  assert.equal(byEmail.length, 1);
  assert.equal(byEmail[0].displayName, "Search Target");
});

test("durable tenant/venue isolation", async () => {
  const { service, repository } = createDurableService();
  const created = await service.createCustomer({
    ...SCOPE_A,
    displayName: "Scoped",
  });
  assert.equal(await repository.getById(SCOPE_B, created.customerId), null);
  assert.equal((await repository.search(SCOPE_B, {})).length, 0);
  assert.equal((await service.searchCustomers(SCOPE_B, {})).length, 0);
});

test("missing durable configuration is fail-closed", () => {
  assert.throws(
    () => Customer.createDurableCustomerRepository({}),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );

  assert.throws(
    () =>
      Customer.createCustomerRuntime({
        enabled: true,
        mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
        environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.STAGING,
      }),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );
});

test("runtime rejects Production memory fallback", () => {
  assert.throws(
    () =>
      Customer.validateCustomerRuntimeConfig({
        enabled: true,
        mode: Customer.CUSTOMER_RUNTIME_MODE.MEMORY,
        environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.PRODUCTION,
      }),
    (err) =>
      err instanceof Customer.CustomerError &&
      err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED &&
      /never silently fall back to an in-memory repository in Production/i.test(
        err.message
      )
  );
});

test("runtime memory harness and durable runtime compose", async () => {
  const harness = Customer.createCustomerRuntimeTestHarness();
  assert.equal(harness.ready, true);
  assert.equal(harness.persistenceMode, Customer.CUSTOMER_RUNTIME_MODE.MEMORY);
  const created = await harness.application.createCustomer({
    ...SCOPE_A,
    displayName: "Harness",
  });
  assert.ok(created.customerId);

  const db = Customer.createFakeCustomerDatabaseClient();
  const durableRuntime = Customer.createCustomerRuntime(
    {
      enabled: true,
      mode: Customer.CUSTOMER_RUNTIME_MODE.DURABLE,
      environment: Customer.CUSTOMER_RUNTIME_ENVIRONMENT.STAGING,
    },
    { db }
  );
  assert.equal(durableRuntime.ready, true);
  assert.equal(durableRuntime.persistenceMode, Customer.CUSTOMER_RUNTIME_MODE.DURABLE);
  const durableCreated = await durableRuntime.application.createCustomer({
    ...SCOPE_A,
    displayName: "Durable Runtime",
  });
  assert.equal(durableCreated.displayName, "Durable Runtime");
});

test("typed persistence error mapping for unique and version conflicts", async () => {
  const db = Customer.createFakeCustomerDatabaseClient();
  const repository = Customer.createDurableCustomerRepository({ db });
  const customer = Customer.createCustomerProfile(
    {
      ...SCOPE_A,
      customerId: "cust_map",
      customerNumber: "CN-MAP",
      displayName: "Map",
    },
    { nowIso: () => FIXED_NOW, nextId: (p) => `${p}_m` }
  );
  await repository.save(customer);

  await assert.rejects(
    () => repository.save({ ...customer, version: 1, displayName: "Stale" }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.VERSION_CONFLICT
  );
});
