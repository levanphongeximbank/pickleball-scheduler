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
  listContactHistory,
} from "../src/features/crm/services/crmContactHistoryService.js";

const CLUB = "phase26-27-test-club";

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

test("finance ledger — debt aging, receipts cấn trừ, refunds workflow", () => {
  setupStorage();
  cleanupClub(CLUB);

  const debt = createDebt(CLUB, {
    customerName: "An",
    amount: 500000,
    dueDate: "2020-01-01",
  });
  assert.equal(debt.balance, 500000);

  const receipt = createReceipt(CLUB, {
    customerName: "An",
    amount: 200000,
    method: "cash",
    debtId: debt.id,
  });
  assert.equal(receipt.amount, 200000);

  const debtsAfterReceipt = listDebts(CLUB);
  assert.equal(debtsAfterReceipt[0].paidAmount, 200000);
  assert.equal(debtsAfterReceipt[0].status, "partial");

  recordDebtPayment(CLUB, debt.id, { amount: 300000, receiptId: "manual" });
  assert.equal(listDebts(CLUB)[0].status, "paid");

  const aging = getDebtAgingReport(CLUB, { asOf: new Date("2026-01-01") });
  assert.equal(aging.openCount, 0);

  createDebt(CLUB, {
    customerName: "Bình",
    amount: 100000,
    dueDate: "2025-12-01",
  });
  const agingOpen = getDebtAgingReport(CLUB, { asOf: new Date("2026-01-15") });
  assert.ok(agingOpen.openCount >= 1);
  assert.ok(agingOpen.totalOutstanding >= 100000);

  const refund = createRefund(CLUB, {
    customerName: "An",
    amount: 50000,
    reason: "Hủy booking",
  });
  assert.equal(refund.status, "pending");
  updateRefundStatus(CLUB, refund.id, "approved");
  assert.equal(listRefunds(CLUB)[0].status, "approved");
  assert.equal(listReceipts(CLUB).length, 1);

  cleanupClub(CLUB);
});

test("CRM services — messages, templates, campaigns, contact history", () => {
  setupStorage();
  cleanupClub(CLUB);

  const template = createTemplate(CLUB, {
    name: "Nhắc booking",
    channel: "sms",
    body: "Xin chào {{ten_khach}}",
  });
  assert.equal(listTemplates(CLUB).length, 1);

  const draft = createMessage(CLUB, {
    recipientName: "Lan",
    channel: "sms",
    body: "Booking 18h",
  });
  assert.equal(draft.status, "draft");

  const sent = markMessageSent(CLUB, draft.id);
  assert.equal(sent.status, "sent");

  addContactHistory(CLUB, {
    customerName: "Lan",
    channel: "sms",
    direction: "outbound",
    summary: "Đã nhắc booking",
    relatedMessageId: draft.id,
  });
  assert.equal(listContactHistory(CLUB).length, 1);
  assert.equal(listMessages(CLUB).length, 1);

  const campaign = createCampaign(CLUB, {
    name: "Tết 2026",
    templateId: template.id,
    targetGroup: "members",
  });
  assert.equal(campaign.status, "draft");

  const launched = launchCampaign(CLUB, campaign.id, { sentCount: 12 });
  assert.equal(launched.status, "completed");
  assert.equal(launched.sentCount, 12);
  assert.equal(listCampaigns(CLUB).length, 1);

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
