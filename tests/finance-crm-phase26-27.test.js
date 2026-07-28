import test from "node:test";
import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROUTE_PERMISSIONS } from "../src/config/navigationConfig.js";
import { FINANCE_MENU_ROOT } from "../src/config/v5Menu/financeMenu.js";
import { CRM_MENU_ROOT } from "../src/config/v5Menu/crmMenu.js";
import { REPORTS_IN_PAGE_NAV } from "../src/config/v5Menu/reportsInPageNav.js";
import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import {
  clearFinanceLedger,
  createDebt,
  createReceipt,
  createRefund,
  listDebtsResult,
  getDebtAgingReport,
  listDebts,
  listReceipts,
  listRefunds,
  recordDebtPayment,
  updateRefundStatus,
} from "../src/features/finance-ledger/services/financeLedgerService.js";
import {
  clearCrmMessages,
  createMessage,
  listMessagesResult,
  listMessages,
  markMessageSent,
} from "../src/features/crm/services/crmMessageService.js";
import {
  clearCrmTemplates,
  createTemplate,
  listTemplates,
} from "../src/features/crm/services/crmTemplateService.js";
import {
  clearCrmCampaigns,
  createCampaign,
  launchCampaign,
  listCampaigns,
} from "../src/features/crm/services/crmCampaignService.js";
import {
  addContactHistory,
  clearCrmContactHistory,
  listContactHistoryResult,
  listContactHistory,
} from "../src/features/crm/services/crmContactHistoryService.js";
import {
  HARD_CUTOVER_FLAG,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  FINANCE_LEDGER_ERROR_CODE,
} from "../src/features/finance-ledger/runtime/constants.js";
import {
  CRM_LEGACY_ERROR_CODE,
} from "../src/features/crm/runtime/constants.js";

const CLUB = "phase26-27-test-club";
const HC_ON = { [HARD_CUTOVER_FLAG]: "true" };
const HC_OFF = { [HARD_CUTOVER_FLAG]: "false" };

function mockLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function setupStorage() {
  const storage = mockLocalStorage();
  globalThis.localStorage = storage;
  return storage;
}

function cleanupClub(clubId) {
  clearFinanceLedger(clubId);
  clearCrmMessages(clubId);
  clearCrmTemplates(clubId);
  clearCrmCampaigns(clubId);
  clearCrmContactHistory(clubId);
}

test("finance ledger HC ON — fail closed, no local/demo persistence", () => {
  setupStorage();
  cleanupClub(CLUB);

  const debt = createDebt(CLUB, {
    customerName: "An",
    amount: 500000,
    dueDate: "2020-01-01",
  }, HC_ON);
  assert.equal(debt.ok, false);
  assert.equal(debt.code, FINANCE_LEDGER_ERROR_CODE.LOCALSTORAGE_FORBIDDEN);

  const receipt = createReceipt(CLUB, {
    customerName: "An",
    amount: 200000,
    method: "cash",
    debtId: "blocked",
  }, HC_ON);
  assert.equal(receipt.ok, false);
  assert.equal(receipt.code, FINANCE_LEDGER_ERROR_CODE.LOCALSTORAGE_FORBIDDEN);

  const debtsAfterReceipt = listDebtsResult(CLUB, {}, HC_ON);
  assert.equal(debtsAfterReceipt.ok, false);
  assert.deepEqual(debtsAfterReceipt.items, []);

  const payment = recordDebtPayment(CLUB, "blocked", { amount: 300000, receiptId: "manual" }, HC_ON);
  assert.equal(payment.ok, false);

  const aging = getDebtAgingReport(CLUB, { asOf: new Date("2026-01-01") }, HC_ON);
  assert.equal(aging.openCount, 0);
  assert.equal(aging.ok, false);

  const blockedSecondDebt = createDebt(CLUB, {
    customerName: "Bình",
    amount: 100000,
    dueDate: "2025-12-01",
  }, HC_ON);
  assert.equal(blockedSecondDebt.ok, false);

  const agingOpen = getDebtAgingReport(CLUB, { asOf: new Date("2026-01-15") }, HC_ON);
  assert.equal(agingOpen.ok, false);
  assert.equal(agingOpen.openCount, 0);
  assert.equal(agingOpen.totalOutstanding, 0);

  const refund = createRefund(CLUB, {
    customerName: "An",
    amount: 50000,
    reason: "Hủy booking",
  }, HC_ON);
  assert.equal(refund.ok, false);
  assert.equal(refund.code, FINANCE_LEDGER_ERROR_CODE.LOCALSTORAGE_FORBIDDEN);
  assert.equal(listReceipts(CLUB, HC_ON).length, 0);

  cleanupClub(CLUB);
});

test("finance ledger HC OFF — debt aging, receipts cấn trừ, refunds workflow", () => {
  setupStorage();
  cleanupClub(CLUB);

  const debt = createDebt(CLUB, {
    customerName: "An",
    amount: 500000,
    dueDate: "2020-01-01",
  }, HC_OFF);
  assert.equal(debt.ok, true);
  assert.equal(debt.data.balance, 500000);

  const receipt = createReceipt(CLUB, {
    customerName: "An",
    amount: 200000,
    method: "cash",
    debtId: debt.data.id,
  }, HC_OFF);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.data.amount, 200000);

  const debtsAfterReceipt = listDebts(CLUB, {}, HC_OFF);
  assert.equal(debtsAfterReceipt[0].paidAmount, 200000);
  assert.equal(debtsAfterReceipt[0].status, "partial");

  const payment = recordDebtPayment(CLUB, debt.data.id, { amount: 300000, receiptId: "manual" }, HC_OFF);
  assert.equal(payment.ok, true);
  assert.equal(listDebts(CLUB, {}, HC_OFF)[0].status, "paid");

  const aging = getDebtAgingReport(CLUB, { asOf: new Date("2026-01-01") }, HC_OFF);
  assert.equal(aging.ok, true);
  assert.equal(aging.openCount, 0);

  createDebt(CLUB, {
    customerName: "Bình",
    amount: 100000,
    dueDate: "2025-12-01",
  }, HC_OFF);
  const agingOpen = getDebtAgingReport(CLUB, { asOf: new Date("2026-01-15") }, HC_OFF);
  assert.equal(agingOpen.ok, true);
  assert.ok(agingOpen.openCount >= 1);
  assert.ok(agingOpen.totalOutstanding >= 100000);

  const refund = createRefund(CLUB, {
    customerName: "An",
    amount: 50000,
    reason: "Hủy booking",
  }, HC_OFF);
  assert.equal(refund.ok, true);
  assert.equal(refund.data.status, "pending");
  const approved = updateRefundStatus(CLUB, refund.data.id, "approved", HC_OFF);
  assert.equal(approved.ok, true);
  assert.equal(listRefunds(CLUB, {}, HC_OFF)[0].status, "approved");
  assert.equal(listReceipts(CLUB, HC_OFF).length, 1);

  cleanupClub(CLUB);
});

test("CRM services HC ON — fail closed, no fake draft/sent data", () => {
  setupStorage();
  cleanupClub(CLUB);

  const template = createTemplate(CLUB, {
    name: "Nhắc booking",
    channel: "sms",
    body: "Xin chào {{ten_khach}}",
  }, HC_ON);
  assert.equal(template.ok, false);
  assert.equal(template.code, CRM_LEGACY_ERROR_CODE.LOCALSTORAGE_FORBIDDEN);

  const draft = createMessage(CLUB, {
    recipientName: "Lan",
    channel: "sms",
    body: "Booking 18h",
  }, HC_ON);
  assert.equal(draft.ok, false);
  assert.equal(draft.code, CRM_LEGACY_ERROR_CODE.LOCALSTORAGE_FORBIDDEN);

  const sent = markMessageSent(CLUB, "blocked", HC_ON);
  assert.equal(sent.ok, false);

  const history = addContactHistory(CLUB, {
    customerName: "Lan",
    channel: "sms",
    direction: "outbound",
    summary: "Đã nhắc booking",
    relatedMessageId: "blocked",
  }, HC_ON);
  assert.equal(history.ok, false);
  assert.equal(listContactHistoryResult(CLUB, {}, HC_ON).ok, false);
  assert.equal(listMessagesResult(CLUB, {}, HC_ON).ok, false);

  const campaign = createCampaign(CLUB, {
    name: "Tết 2026",
    templateId: "blocked",
    targetGroup: "members",
  }, HC_ON);
  assert.equal(campaign.ok, false);

  cleanupClub(CLUB);
});

test("CRM services HC OFF — messages, templates, campaigns, contact history", () => {
  setupStorage();
  cleanupClub(CLUB);

  const template = createTemplate(CLUB, {
    name: "Nhắc booking",
    channel: "sms",
    body: "Xin chào {{ten_khach}}",
  }, HC_OFF);
  assert.equal(template.ok, true);
  assert.equal(listTemplates(CLUB, {}, HC_OFF).length, 1);

  const draft = createMessage(CLUB, {
    recipientName: "Lan",
    channel: "sms",
    body: "Booking 18h",
  }, HC_OFF);
  assert.equal(draft.ok, true);
  assert.equal(draft.data.status, "draft");

  const sent = markMessageSent(CLUB, draft.data.id, HC_OFF);
  assert.equal(sent.ok, true);
  assert.equal(sent.data.status, "sent");

  const history = addContactHistory(CLUB, {
    customerName: "Lan",
    channel: "sms",
    direction: "outbound",
    summary: "Đã nhắc booking",
    relatedMessageId: draft.data.id,
  }, HC_OFF);
  assert.equal(history.ok, true);
  assert.equal(listContactHistory(CLUB, {}, HC_OFF).length, 1);
  assert.equal(listMessages(CLUB, {}, HC_OFF).length, 1);

  const campaign = createCampaign(CLUB, {
    name: "Tết 2026",
    templateId: template.data.id,
    targetGroup: "members",
  }, HC_OFF);
  assert.equal(campaign.ok, true);
  assert.equal(campaign.data.status, "draft");

  const launched = launchCampaign(CLUB, campaign.data.id, { sentCount: 12 }, HC_OFF);
  assert.equal(launched.ok, true);
  assert.equal(launched.data.status, "completed");
  assert.equal(launched.data.sentCount, 12);
  assert.equal(listCampaigns(CLUB, {}, HC_OFF).length, 1);

  cleanupClub(CLUB);
});

test("finance & CRM menus — paths wired (CRM PARTIAL readiness correction)", () => {
  const financePaths = FINANCE_MENU_ROOT.children
    .filter((item) => item.featureStatus === FEATURE_STATUS.LIVE)
    .map((item) => item.path);

  assert.ok(financePaths.includes("/finance/debt"));
  assert.ok(financePaths.includes("/finance/receipts"));
  assert.ok(financePaths.includes("/finance/refunds"));

  // Phase 1B: CRM route items are PARTIAL (compatibility shell), not LIVE.
  const crmPartial = CRM_MENU_ROOT.children.filter(
    (item) =>
      item.featureStatus === FEATURE_STATUS.PARTIAL &&
      String(item.path || "").startsWith("/crm/")
  );
  const crmPaths = crmPartial.map((item) => item.path);

  assert.ok(crmPaths.includes("/crm/messages"));
  assert.ok(crmPaths.includes("/crm/templates"));
  assert.ok(crmPaths.includes("/crm/campaigns"));
  assert.ok(crmPaths.includes("/crm/history"));
  assert.ok(crmPaths.includes("/crm/reminders/booking"));
});

test("reports in-page nav — finance items LIVE", () => {
  const financeSection = REPORTS_IN_PAGE_NAV.sections.find((section) => section.id === "finance");
  assert.ok(financeSection, "thiếu section finance trong reportsInPageNav");

  for (const item of financeSection.items) {
    assert.equal(item.featureStatus, FEATURE_STATUS.LIVE);
    assert.ok(item.path.startsWith("/finance/"));
  }
});

test("route permissions — finance and CRM paths", () => {
  // Use ROUTE_PERMISSIONS directly to avoid menuAccess → supabase client import in unit tests.
  assert.deepEqual(ROUTE_PERMISSIONS["/finance/debt"], [PERMISSIONS.FINANCE_VIEW]);
  assert.deepEqual(ROUTE_PERMISSIONS["/finance/receipts"], [PERMISSIONS.FINANCE_VIEW]);
  assert.deepEqual(ROUTE_PERMISSIONS["/finance/refunds"], [PERMISSIONS.FINANCE_VIEW]);

  assert.deepEqual(ROUTE_PERMISSIONS["/crm/templates"], [PERMISSIONS.CUSTOMER_VIEW]);
  assert.deepEqual(ROUTE_PERMISSIONS["/crm/messages"], [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
  ]);
  assert.deepEqual(ROUTE_PERMISSIONS["/crm/reminders/booking"], [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
  ]);
});
