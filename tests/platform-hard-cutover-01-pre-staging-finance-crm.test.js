import test from "node:test";
import assert from "node:assert/strict";

import {
  HARD_CUTOVER_FLAG,
  getRuntimeAuthorityEntry,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  LEGACY_AUTHORITY_ERROR,
  assertCrmDemoClubFallbackAllowed,
  assertCrmLocalStorageAuthorityAllowed,
  assertFinanceDemoClubFallbackAllowed,
  assertFinanceLocalStorageAuthorityAllowed,
} from "../src/features/platform-hard-cutover/legacyAuthorityPolicy.js";
import {
  FINANCE_LEDGER_RUNTIME_MODE,
  FINANCE_LEDGER_ERROR_CODE,
} from "../src/features/finance-ledger/runtime/constants.js";
import { resolveFinanceLedgerRuntime } from "../src/features/finance-ledger/runtime/resolveFinanceLedgerRuntime.js";
import {
  createDebt,
  createReceipt,
  createRefund,
  listDebtsResult,
} from "../src/features/finance-ledger/services/financeLedgerService.js";
import {
  CRM_LEGACY_RUNTIME_MODE,
  CRM_LEGACY_ERROR_CODE,
} from "../src/features/crm/runtime/constants.js";
import { resolveCrmLegacyRuntime } from "../src/features/crm/runtime/resolveCrmLegacyRuntime.js";
import {
  createMessage,
  listMessagesResult,
} from "../src/features/crm/services/crmMessageService.js";
import { createCampaign, launchCampaign } from "../src/features/crm/services/crmCampaignService.js";

/** Minimal localStorage for Node service tests (HC OFF legacy path). */
function installMemoryLocalStorage() {
  const map = new Map();
  const storage = {
    getItem(key) {
      return map.has(String(key)) ? map.get(String(key)) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  return storage;
}

installMemoryLocalStorage();

const HC_ON = { [HARD_CUTOVER_FLAG]: "true" };
const HC_OFF = { [HARD_CUTOVER_FLAG]: "false" };

test("finance/crm matrix: failClosedError and forbidden fallbacks include local/demo", () => {
  const finance = getRuntimeAuthorityEntry("finance");
  const crm = getRuntimeAuthorityEntry("crm");
  assert.equal(finance.failClosedError, "FINANCE_AUTHORITY_UNAVAILABLE");
  assert.equal(crm.failClosedError, "CRM_AUTHORITY_UNAVAILABLE");
  assert.ok(finance.forbiddenFallback.includes("localStorage finance ledger"));
  assert.ok(finance.forbiddenFallback.includes("demo-club finance fallback"));
  assert.ok(crm.forbiddenFallback.includes("localStorage CRM services"));
  assert.ok(crm.forbiddenFallback.includes("demo-club CRM fallback"));
  assert.match(finance.verificationTest, /finance-crm/);
  assert.match(crm.verificationTest, /finance-crm/);
});

test("finance HC: localStorage authority blocked", () => {
  const blocked = assertFinanceLocalStorageAuthorityAllowed(HC_ON);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, LEGACY_AUTHORITY_ERROR.FINANCE_LOCALSTORAGE_AUTHORITY_FORBIDDEN);

  const open = assertFinanceLocalStorageAuthorityAllowed(HC_OFF);
  assert.equal(open.ok, true);
});

test("finance HC: demo-club fallback blocked", () => {
  const blocked = assertFinanceDemoClubFallbackAllowed("demo-club", HC_ON);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, LEGACY_AUTHORITY_ERROR.FINANCE_DEMO_CLUB_FALLBACK_FORBIDDEN);

  const alsoBlockedOff = assertFinanceDemoClubFallbackAllowed("demo-club", HC_OFF);
  assert.equal(alsoBlockedOff.ok, false);

  const realClub = assertFinanceDemoClubFallbackAllowed("club-real-1", HC_OFF);
  assert.equal(realClub.ok, true);
});

test("finance HC: runtime resolves UNAVAILABLE — no club, no writes", () => {
  const runtime = resolveFinanceLedgerRuntime({
    env: HC_ON,
    clubId: "club-real-1",
  });
  assert.equal(runtime.mode, FINANCE_LEDGER_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(runtime.code, "FINANCE_AUTHORITY_UNAVAILABLE");
  assert.equal(runtime.allowsLocalStorage, false);
  assert.equal(runtime.allowsWrites, false);
  assert.equal(runtime.clubId, null);
  assert.ok(runtime.userMessage.includes("Tài chính"));
});

test("finance without HC: missing club / demo-club → MISSING_SCOPE (no silent demo)", () => {
  const missing = resolveFinanceLedgerRuntime({ env: HC_OFF, clubId: null });
  assert.equal(missing.mode, FINANCE_LEDGER_RUNTIME_MODE.MISSING_SCOPE);
  assert.equal(missing.code, FINANCE_LEDGER_ERROR_CODE.MISSING_CLUB_SCOPE);

  const demo = resolveFinanceLedgerRuntime({ env: HC_OFF, clubId: "demo-club" });
  assert.equal(demo.mode, FINANCE_LEDGER_RUNTIME_MODE.MISSING_SCOPE);
});

test("finance without HC: real club → LEGACY_LOCAL with demo banner", () => {
  const runtime = resolveFinanceLedgerRuntime({
    env: HC_OFF,
    clubId: "club-a",
  });
  assert.equal(runtime.mode, FINANCE_LEDGER_RUNTIME_MODE.LEGACY_LOCAL);
  assert.equal(runtime.clubId, "club-a");
  assert.equal(runtime.isDemoMode, true);
  assert.ok(runtime.demoBanner);
});

test("finance HC: service mutations do not write and do not success", () => {
  const debt = createDebt("club-a", { customerName: "A", amount: 100 }, HC_ON);
  assert.equal(debt.ok, false);
  assert.equal(debt.legacyBlocked, true);
  assert.equal(debt.code, LEGACY_AUTHORITY_ERROR.FINANCE_LOCALSTORAGE_AUTHORITY_FORBIDDEN);

  const receipt = createReceipt("club-a", { customerName: "A", amount: 50 }, HC_ON);
  assert.equal(receipt.ok, false);

  const refund = createRefund("club-a", { customerName: "A", amount: 10 }, HC_ON);
  assert.equal(refund.ok, false);

  const listed = listDebtsResult("club-a", {}, HC_ON);
  assert.equal(listed.ok, false);
  assert.deepEqual(listed.items, []);
});

test("finance without HC: demo-club service access blocked (tenant honesty)", () => {
  const debt = createDebt("demo-club", { customerName: "A", amount: 100 }, HC_OFF);
  assert.equal(debt.ok, false);
  assert.equal(debt.code, LEGACY_AUTHORITY_ERROR.FINANCE_DEMO_CLUB_FALLBACK_FORBIDDEN);
});

test("finance without HC: club isolation — writes scoped by clubId", () => {
  const createdA = createDebt("club-iso-a", { customerName: "A", amount: 10 }, HC_OFF);
  assert.equal(createdA.ok, true);
  const listedB = listDebtsResult("club-iso-b", {}, HC_OFF);
  assert.equal(listedB.ok, true);
  assert.equal(
    listedB.items.some((row) => row.id === createdA.data.id),
    false
  );
  const listedA = listDebtsResult("club-iso-a", {}, HC_OFF);
  assert.equal(
    listedA.items.some((row) => row.id === createdA.data.id),
    true
  );
});

test("crm HC: localStorage authority blocked", () => {
  const blocked = assertCrmLocalStorageAuthorityAllowed(HC_ON);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, LEGACY_AUTHORITY_ERROR.CRM_LOCALSTORAGE_AUTHORITY_FORBIDDEN);
  assert.equal(assertCrmLocalStorageAuthorityAllowed(HC_OFF).ok, true);
});

test("crm HC: demo-club fallback blocked", () => {
  assert.equal(assertCrmDemoClubFallbackAllowed("demo-club", HC_ON).ok, false);
  assert.equal(assertCrmDemoClubFallbackAllowed("demo-club", HC_OFF).ok, false);
  assert.equal(assertCrmDemoClubFallbackAllowed("club-crm-1", HC_OFF).ok, true);
});

test("crm HC: runtime UNAVAILABLE — no false success surface", () => {
  const runtime = resolveCrmLegacyRuntime({ env: HC_ON, clubId: "club-crm-1" });
  assert.equal(runtime.mode, CRM_LEGACY_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(runtime.code, "CRM_AUTHORITY_UNAVAILABLE");
  assert.equal(runtime.allowsWrites, false);
  assert.ok(runtime.userMessage.includes("CRM"));
});

test("crm without HC: missing/demo club → MISSING_SCOPE", () => {
  assert.equal(
    resolveCrmLegacyRuntime({ env: HC_OFF, clubId: "" }).mode,
    CRM_LEGACY_RUNTIME_MODE.MISSING_SCOPE
  );
  assert.equal(
    resolveCrmLegacyRuntime({ env: HC_OFF, clubId: "demo-club" }).code,
    CRM_LEGACY_ERROR_CODE.MISSING_CLUB_SCOPE
  );
});

test("crm HC: create/send/launch blocked — no durable success", () => {
  const msg = createMessage(
    "club-crm-1",
    { recipientName: "A", body: "Hi", sendNow: true },
    HC_ON
  );
  assert.equal(msg.ok, false);
  assert.equal(msg.legacyBlocked, true);

  const campaign = createCampaign("club-crm-1", { name: "C1" }, HC_ON);
  assert.equal(campaign.ok, false);

  const launch = launchCampaign("club-crm-1", "cmp-x", { sentCount: 9 }, HC_ON);
  assert.equal(launch.ok, false);

  const listed = listMessagesResult("club-crm-1", {}, HC_ON);
  assert.equal(listed.ok, false);
  assert.deepEqual(listed.items, []);
});

test("crm without HC: legacy local with demo banner; tenant isolation", () => {
  const runtime = resolveCrmLegacyRuntime({ env: HC_OFF, clubId: "club-crm-a" });
  assert.equal(runtime.mode, CRM_LEGACY_RUNTIME_MODE.LEGACY_LOCAL);
  assert.equal(runtime.isDemoMode, true);
  assert.ok(runtime.demoBanner.includes("demo"));

  const created = createMessage(
    "club-crm-a",
    { recipientName: "A", body: "hello" },
    HC_OFF
  );
  assert.equal(created.ok, true);
  const other = listMessagesResult("club-crm-b", {}, HC_OFF);
  assert.equal(
    other.items.some((row) => row.id === created.data.id),
    false
  );
});
