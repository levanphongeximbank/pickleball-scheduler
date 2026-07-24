/**
 * CUSTOMER-04 — Consent & Communication Preferences certification.
 * Domain + application + in-memory/durable fake DB + static migration checks.
 * No Production credentials. No live Staging apply. No network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Customer from "../src/features/customer/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const phase4Dir = path.join(root, "docs", "customer-management", "phase-4");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });
const FIXED_NOW = "2026-07-24T12:00:00.000Z";

const MIGRATION_FILES = [
  "10_CUSTOMER_PHASE_4_TABLES.sql",
  "20_CUSTOMER_PHASE_4_INDEXES.sql",
  "30_CUSTOMER_PHASE_4_RLS.sql",
  "40_CUSTOMER_PHASE_4_SAVE_RPC.sql",
  "50_CUSTOMER_PHASE_4_GRANTS.sql",
  "60_CUSTOMER_PHASE_4_HISTORY_IMMUTABLE.sql",
];

const SUPPORTING_FILES = [
  "90_CUSTOMER_PHASE_4_ROLLBACK.sql",
  "99_CUSTOMER_PHASE_4_VERIFICATION.sql",
];

function readMigration(name) {
  return readFileSync(path.join(phase4Dir, name), "utf8");
}

function createMemoryStack() {
  const customerRepository = Customer.createInMemoryCustomerRepository();
  const consentPreferenceRepository =
    Customer.createInMemoryConsentPreferenceRepository();
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
  const consentApp = Customer.createConsentPreferenceApplicationService({
    customerRepository,
    consentPreferenceRepository,
    clock,
    idGenerator,
  });
  return {
    customerRepository,
    consentPreferenceRepository,
    customerApp,
    consentApp,
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
// Public API / additive compatibility
// ---------------------------------------------------------------------------

test("CUSTOMER-04 public exports are present and additive", () => {
  for (const name of Customer.CUSTOMER_PUBLIC_EXPORTS) {
    assert.ok(
      name in Customer,
      `missing public export ${name}`
    );
  }
  assert.equal(
    typeof Customer.createConsentPreferenceApplicationService,
    "function"
  );
  assert.equal(typeof Customer.evaluateCommunicationEligibility, "function");
  assert.ok(Customer.CUSTOMER_CONSENT_STATUS.GRANTED);
  assert.ok(Customer.CUSTOMER_PREFERENCE_STATUS.OPTED_IN);
  assert.ok(Customer.CUSTOMER_COMMUNICATION_PURPOSE.MARKETING);
  assert.ok(Customer.CUSTOMER_PHASE_4_TABLES.CONSENTS);
  // Foundation overlays remain
  assert.ok(Customer.CUSTOMER_CONSENT_STATE.OPT_IN);
  assert.ok(Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL);
});

// ---------------------------------------------------------------------------
// Consent domain
// ---------------------------------------------------------------------------

test("grant consent creates versioned current state", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);

  const granted = await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose: Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE,
    channel: Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL,
    evidenceReference: "ev_1",
    source: Customer.CUSTOMER_CONSENT_SOURCE.STAFF,
  });
  assert.equal(granted.status, Customer.CUSTOMER_CONSENT_STATUS.GRANTED);
  assert.equal(granted.version, 1);
  assert.equal(granted.evidenceReference, "ev_1");

  const denied = await consentApp.denyConsent(
    SCOPE_A,
    customer.customerId,
    {
      purpose: Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE,
      channel: Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL,
    },
    { expectedVersion: 1 }
  );
  assert.equal(denied.status, Customer.CUSTOMER_CONSENT_STATUS.DENIED);
  assert.equal(denied.version, 2);
});

test("grant consent requires evidence; revoke twice rejected; history sequenced", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL;

  await assert.rejects(
    () =>
      consentApp.grantConsent(SCOPE_A, customer.customerId, {
        purpose,
        channel,
      }),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.CONSENT_EVIDENCE_REQUIRED
  );

  const granted = await consentApp.grantConsent(
    SCOPE_A,
    customer.customerId,
    { purpose, channel, evidenceReference: "ev_grant" },
    { expectedVersion: 0 }
  );
  assert.equal(granted.status, Customer.CUSTOMER_CONSENT_STATUS.GRANTED);

  const revoked = await consentApp.revokeConsent(
    SCOPE_A,
    customer.customerId,
    { purpose, channel },
    { expectedVersion: 1 }
  );
  assert.equal(revoked.status, Customer.CUSTOMER_CONSENT_STATUS.REVOKED);
  assert.equal(revoked.version, 2);

  await assert.rejects(
    () =>
      consentApp.revokeConsent(SCOPE_A, customer.customerId, {
        purpose,
        channel,
      }),
    (err) =>
      err.code === Customer.CUSTOMER_ERROR_CODES.CONSENT_ALREADY_REVOKED
  );

  const history = await consentApp.getConsentHistory(
    SCOPE_A,
    customer.customerId,
    purpose,
    channel
  );
  assert.equal(history.length, 2);
  assert.equal(history[0].sequence, 1);
  assert.equal(history[1].sequence, 2);
  assert.equal(history[0].nextStatus, Customer.CUSTOMER_CONSENT_STATUS.GRANTED);
  assert.equal(history[1].nextStatus, Customer.CUSTOMER_CONSENT_STATUS.REVOKED);
});

test("invalid consent transition and expectedVersion conflict", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.BOOKING_UPDATE;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.SMS;

  await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
    evidenceReference: "ev_x",
  });

  await assert.rejects(
    () =>
      consentApp.grantConsent(
        SCOPE_A,
        customer.customerId,
        { purpose, channel, evidenceReference: "ev_y" },
        { expectedVersion: 99 }
      ),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.VERSION_CONFLICT
  );

  await consentApp.expireConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  const expired = await consentApp.getConsent(
    SCOPE_A,
    customer.customerId,
    purpose,
    channel
  );
  assert.equal(expired.status, Customer.CUSTOMER_CONSENT_STATUS.EXPIRED);
});

// ---------------------------------------------------------------------------
// Preference domain
// ---------------------------------------------------------------------------

test("opt in / opt out / unspecified preference with history and uniqueness", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.EVENT_UPDATE;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL;

  const optedIn = await consentApp.optInCommunication(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  assert.equal(optedIn.status, Customer.CUSTOMER_PREFERENCE_STATUS.OPTED_IN);
  assert.equal(optedIn.version, 1);

  const optedOut = await consentApp.optOutCommunication(
    SCOPE_A,
    customer.customerId,
    { purpose, channel },
    { expectedVersion: 1 }
  );
  assert.equal(optedOut.status, Customer.CUSTOMER_PREFERENCE_STATUS.OPTED_OUT);
  assert.equal(optedOut.version, 2);

  const reset = await consentApp.resetCommunicationPreference(
    SCOPE_A,
    customer.customerId,
    { purpose, channel },
    { expectedVersion: 2 }
  );
  assert.equal(reset.status, Customer.CUSTOMER_PREFERENCE_STATUS.UNSPECIFIED);

  const history = await consentApp.getPreferenceHistory(
    SCOPE_A,
    customer.customerId,
    purpose,
    channel
  );
  assert.equal(history.length, 3);

  await assert.rejects(
    () =>
      consentApp.optInCommunication(SCOPE_A, customer.customerId, {
        purpose,
        channel: "FAX",
      }),
    (err) =>
      err.code ===
      Customer.CUSTOMER_ERROR_CODES.UNSUPPORTED_COMMUNICATION_CHANNEL
  );

  await assert.rejects(
    () =>
      consentApp.optInCommunication(SCOPE_A, customer.customerId, {
        purpose: "UNKNOWN_PURPOSE",
        channel,
      }),
    (err) =>
      err.code ===
      Customer.CUSTOMER_ERROR_CODES.UNSUPPORTED_COMMUNICATION_PURPOSE
  );
});

test("preference scope isolation across tenants", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const a = await seedCustomer(customerApp, SCOPE_A);
  const b = await seedCustomer(customerApp, SCOPE_B, {
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "b@example.com",
        primary: true,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
      },
    ],
  });

  await consentApp.optInCommunication(SCOPE_A, a.customerId, {
    purpose: Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE,
    channel: Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL,
  });

  const missing = await consentApp.getPreference(
    SCOPE_B,
    b.customerId,
    Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE,
    Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL
  );
  assert.equal(missing, null);

  await assert.rejects(
    () =>
      consentApp.getPreference(
        SCOPE_B,
        a.customerId,
        Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE,
        Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL
      ),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.NOT_FOUND
  );
});

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

test("eligibility fail-closed reasons and eligible path", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL;

  let view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.equal(
    view.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE
  );
  assert.ok(
    view.reasonCodes.includes(
      Customer.CUSTOMER_ELIGIBILITY_REASON.CONSENT_NOT_RECORDED
    )
  );
  assert.ok(
    view.reasonCodes.includes(
      Customer.CUSTOMER_ELIGIBILITY_REASON.PREFERENCE_UNSPECIFIED
    )
  );

  await consentApp.optOutCommunication(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
    evidenceReference: "ev_elig",
  });
  view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.equal(
    view.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE
  );
  assert.ok(
    view.reasonCodes.includes(
      Customer.CUSTOMER_ELIGIBILITY_REASON.PREFERENCE_OPTED_OUT
    )
  );

  await consentApp.optInCommunication(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.equal(
    view.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.ELIGIBLE
  );
  assert.deepEqual([...view.reasonCodes], []);

  await consentApp.denyConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.ok(
    view.reasonCodes.includes(Customer.CUSTOMER_ELIGIBILITY_REASON.CONSENT_DENIED)
  );

  await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
    evidenceReference: "ev_elig_2",
  });
  await consentApp.revokeConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.ok(
    view.reasonCodes.includes(Customer.CUSTOMER_ELIGIBILITY_REASON.CONSENT_REVOKED)
  );
});

test("marketing requires policy decision; unsupported channel typed", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.MARKETING;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL;

  await consentApp.optInCommunication(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
    evidenceReference: "ev_mkt",
  });

  let view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.equal(
    view.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.REQUIRES_POLICY_DECISION
  );
  assert.ok(
    view.reasonCodes.includes(
      Customer.CUSTOMER_ELIGIBILITY_REASON.REQUIRES_GOVERNANCE_POLICY
    )
  );

  view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel, governancePolicyResolved: true }
  );
  assert.equal(
    view.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.ELIGIBLE
  );

  const pure = Customer.evaluateCommunicationEligibility({
    customer,
    purpose: "NOPE",
    channel: "EMAIL",
  });
  assert.equal(
    pure.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE
  );
  assert.ok(
    pure.reasonCodes.includes(
      Customer.CUSTOMER_ELIGIBILITY_REASON.UNSUPPORTED_COMMUNICATION_PURPOSE
    )
  );
});

test("inactive contact makes eligibility ineligible", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp, SCOPE_A, {
    contactPoints: [
      {
        type: Customer.CONTACT_POINT_TYPE.EMAIL,
        value: "inactive@example.com",
        primary: false,
        status: Customer.CONTACT_POINT_STATUS.INACTIVE,
        verificationState:
          Customer.CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
        trustedEvidence: true,
      },
    ],
  });
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL;
  await consentApp.optInCommunication(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
    evidenceReference: "ev_inactive",
  });
  const view = await consentApp.evaluateCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.equal(
    view.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.INELIGIBLE
  );
  assert.ok(
    view.reasonCodes.includes(
      Customer.CUSTOMER_ELIGIBILITY_REASON.CONTACT_POINT_INACTIVE
    )
  );
});

// ---------------------------------------------------------------------------
// Repository / runtime / adapters
// ---------------------------------------------------------------------------

test("durable fake DB consent/preference transaction + copy-safe projections", async () => {
  const db = Customer.createFakeCustomerDatabaseClient();
  const customerRepository = Customer.createDurableCustomerRepository({ db });
  const consentPreferenceRepository =
    Customer.createDurableConsentPreferenceRepository({ db });
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
  const consentApp = Customer.createConsentPreferenceApplicationService({
    customerRepository,
    consentPreferenceRepository,
    clock,
    idGenerator,
  });

  const customer = await seedCustomer(customerApp);
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.MEMBERSHIP_UPDATE;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.PUSH;

  const pref = await consentApp.optInCommunication(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  const consent = await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
    evidenceReference: "ev_durable",
  });

  const prefView = Customer.projectCustomerCommunicationPreferenceView(pref);
  const consentView = Customer.projectCustomerConsentView(consent);
  assert.ok(Object.isFrozen(prefView));
  assert.ok(Object.isFrozen(consentView));
  assert.equal(prefView.preferenceId, pref.preferenceId);

  const history = await consentApp.getConsentHistory(
    SCOPE_A,
    customer.customerId,
    purpose,
    channel
  );
  assert.equal(history.length, 1);

  await assert.rejects(
    () =>
      db.update({
        table: Customer.CUSTOMER_PHASE_4_TABLES.CONSENT_HISTORY,
        values: { reason: "tamper" },
        filters: { history_id: history[0].historyId },
      }),
    /append-only/
  );
});

test("runtime composes consent application; Production memory rejected", () => {
  const runtime = Customer.createCustomerRuntimeTestHarness({
    clock: { nowIso: () => FIXED_NOW },
  });
  assert.equal(runtime.ready, true);
  assert.ok(runtime.consentPreferenceApplication);
  assert.ok(runtime.application);

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
});

test("Notification and CRM boundary adapters are read-only consumers", async () => {
  const { customerApp, consentApp } = createMemoryStack();
  const customer = await seedCustomer(customerApp);
  const purpose = Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE;
  const channel = Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL;

  await consentApp.optInCommunication(SCOPE_A, customer.customerId, {
    purpose,
    channel,
  });
  await consentApp.grantConsent(SCOPE_A, customer.customerId, {
    purpose,
    channel,
    evidenceReference: "ev_boundary",
  });

  const notification =
    Customer.createCustomerNotificationEligibilityAdapter({
      consentPreferenceApplication: consentApp,
    });
  const crm = Customer.createCustomerCrmConsentPreferenceAdapter({
    consentPreferenceApplication: consentApp,
  });

  const eligibility = await notification.getCommunicationEligibility(
    SCOPE_A,
    customer.customerId,
    { purpose, channel }
  );
  assert.equal(
    eligibility.eligibility,
    Customer.CUSTOMER_COMMUNICATION_ELIGIBILITY.ELIGIBLE
  );

  const summary = await crm.getConsentPreferenceSummary(
    SCOPE_A,
    customer.customerId
  );
  assert.equal(summary.customerId, customer.customerId);
  assert.equal(summary.consents.length, 1);
  assert.equal(summary.preferences.length, 1);
  assert.equal(typeof notification.grantConsent, "undefined");
  assert.equal(typeof crm.grantConsent, "undefined");
});

test("fail-closed consent application without repositories", async () => {
  const app = Customer.createFailClosedConsentPreferenceApplication();
  await assert.rejects(
    () =>
      app.grantConsent(SCOPE_A, "cust_1", {
        purpose: Customer.CUSTOMER_COMMUNICATION_PURPOSE.SERVICE,
        channel: Customer.CUSTOMER_COMMUNICATION_CHANNEL.EMAIL,
        evidenceReference: "ev",
      }),
    (err) => err.code === Customer.CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED
  );
});

// ---------------------------------------------------------------------------
// Static migration / schema
// ---------------------------------------------------------------------------

test("CUSTOMER-04 migration pack files exist in order", () => {
  for (const name of [...MIGRATION_FILES, ...SUPPORTING_FILES]) {
    const full = path.join(phase4Dir, name);
    assert.equal(statSync(full).isFile(), true, `missing ${name}`);
  }
  const names = readdirSync(phase4Dir).filter((n) => n.endsWith(".sql"));
  assert.ok(names.includes("10_CUSTOMER_PHASE_4_TABLES.sql"));
  assert.ok(
    names.indexOf("10_CUSTOMER_PHASE_4_TABLES.sql") <
      names.indexOf("20_CUSTOMER_PHASE_4_INDEXES.sql")
  );
  assert.ok(
    names.indexOf("30_CUSTOMER_PHASE_4_RLS.sql") <
      names.indexOf("40_CUSTOMER_PHASE_4_SAVE_RPC.sql")
  );
});

test("schema declares consent/preference tables, constraints, history, RLS, trusted RPC", () => {
  const tables = readMigration("10_CUSTOMER_PHASE_4_TABLES.sql");
  assert.match(tables, /CREATE TABLE IF NOT EXISTS public\.customer_consents/);
  assert.match(
    tables,
    /CREATE TABLE IF NOT EXISTS public\.customer_communication_preferences/
  );
  assert.match(
    tables,
    /CREATE TABLE IF NOT EXISTS public\.customer_consent_history/
  );
  assert.match(
    tables,
    /CREATE TABLE IF NOT EXISTS public\.customer_preference_history/
  );
  assert.match(tables, /customer_consents_scope_purpose_channel_uq/);
  assert.match(tables, /customer_prefs_scope_purpose_channel_uq/);
  assert.match(tables, /FOREIGN KEY \(tenant_id, venue_id, customer_id\)/);
  assert.match(tables, /customer_consents_granted_requires_evidence/);

  const rls = readMigration("30_CUSTOMER_PHASE_4_RLS.sql");
  assert.match(rls, /ENABLE ROW LEVEL SECURITY/);
  assert.match(rls, /FORCE ROW LEVEL SECURITY/);
  assert.match(rls, /customer_phase3_scope_allows/);
  assert.equal(/\bUSING\s*\(\s*true\s*\)/i.test(rls), false);
  assert.equal(/\bTO anon\b/.test(rls), false);
  assert.equal(/\bFOR INSERT\b/.test(rls), false);
  assert.equal(/\bFOR UPDATE\b/.test(rls), false);
  assert.equal(/\bFOR DELETE\b/.test(rls), false);

  const rpc = readMigration("40_CUSTOMER_PHASE_4_SAVE_RPC.sql");
  assert.match(rpc, /customer_save_consent/);
  assert.match(rpc, /customer_save_preference/);
  assert.match(rpc, /GRANT EXECUTE[\s\S]*TO service_role/);
  assert.match(rpc, /REVOKE ALL[\s\S]*FROM authenticated/);

  const immutable = readMigration("60_CUSTOMER_PHASE_4_HISTORY_IMMUTABLE.sql");
  assert.match(immutable, /customer_consent_history_immutable_trg/);
  assert.match(immutable, /customer_preference_history_immutable_trg/);
  assert.match(immutable, /append-only/);
});
