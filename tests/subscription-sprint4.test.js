import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { loadSubscriptions, saveSubscriptions, loadVenues, saveVenues } from "../src/data/venue.js";
import {
  SUBSCRIPTION_STATUS,
  createSubscriptionRecord,
  getDaysUntilPeriodEnd,
  isSubscriptionActive,
  normalizePlanId,
  planIncludesFeature,
} from "../src/models/subscription.js";
import {
  assertSubscriptionOperational,
  getPaymentReminder,
  processSubscriptionExpiry,
  renewSubscriptionPeriod,
  runSubscriptionMaintenance,
  tryAutoRenew,
} from "../src/features/subscription/index.js";
import { GRACE_PERIOD_DAYS } from "../src/features/subscription/constants/subscriptionPolicy.js";

const VENUE_ID = "sub-test-venue";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
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

function resetStorage() {
  saveSubscriptions({});
  saveVenues([]);
}

function seedExpiredSubscription(daysOverdue, planId = "starter") {
  const end = new Date();
  end.setDate(end.getDate() - daysOverdue);

  const subscription = createSubscriptionRecord(VENUE_ID, planId, {
    id: `sub-${VENUE_ID}`,
    currentPeriodEnd: end.toISOString(),
    status: SUBSCRIPTION_STATUS.ACTIVE,
    autoRenew: false,
  });

  saveSubscriptions({ [VENUE_ID]: subscription });
  saveVenues([
    {
      id: VENUE_ID,
      name: "Test Venue",
      slug: "test-venue",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
}

describe("Sprint 4 — Subscription", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    resetStorage();
  });

  afterEach(() => {
    resetStorage();
  });

  test("normalizePlanId — alias legacy basic/pro", () => {
    assert.equal(normalizePlanId("basic"), "starter");
    assert.equal(normalizePlanId("pro"), "professional");
    assert.equal(normalizePlanId("enterprise"), "enterprise");
  });

  test("4 gói: trial, starter, professional, enterprise", () => {
    assert.equal(planIncludesFeature("trial", "statistics"), false);
    assert.equal(planIncludesFeature("starter", "statistics"), true);
    assert.equal(planIncludesFeature("professional", "director_mode"), true);
    assert.equal(planIncludesFeature("enterprise", "api_access"), true);
  });

  test("trial — 14 ngày", () => {
    const sub = createSubscriptionRecord(VENUE_ID, "trial");
    const days = getDaysUntilPeriodEnd(sub);
    assert.ok(days >= 13 && days <= 14);
  });

  test("nhắc thanh toán 7 ngày trước hết hạn", () => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const sub = createSubscriptionRecord(VENUE_ID, "starter", {
      currentPeriodEnd: end.toISOString(),
    });

    const reminder = getPaymentReminder(sub);
    assert.equal(reminder.show, true);
    assert.equal(reminder.code, "SUBSCRIPTION_REMINDER");
    assert.equal(reminder.daysLeft, 7);
  });

  test("past_due trong grace period vẫn active", () => {
    seedExpiredSubscription(2, "starter");

    processSubscriptionExpiry(VENUE_ID);
    const updated = loadSubscriptions()[VENUE_ID];
    assert.equal(updated.status, SUBSCRIPTION_STATUS.PAST_DUE);
    assert.equal(isSubscriptionActive(updated, { graceDays: GRACE_PERIOD_DAYS }), true);
  });

  test("quá grace period → expired + khóa venue", () => {
    seedExpiredSubscription(GRACE_PERIOD_DAYS + 1, "starter");

    processSubscriptionExpiry(VENUE_ID);
    const updated = loadSubscriptions()[VENUE_ID];
    assert.equal(updated.status, SUBSCRIPTION_STATUS.EXPIRED);
    assert.ok(updated.lockedAt);

    const venue = loadVenues().find((item) => item.id === VENUE_ID);
    assert.equal(venue.status, "suspended");

    const check = assertSubscriptionOperational(VENUE_ID);
    assert.equal(check.ok, false);
    assert.equal(check.code, "SUBSCRIPTION_LOCKED");
  });

  test("gia hạn mở khóa subscription", () => {
    seedExpiredSubscription(GRACE_PERIOD_DAYS + 2, "starter");
    processSubscriptionExpiry(VENUE_ID);

    const renewed = renewSubscriptionPeriod(VENUE_ID, { planId: "professional" });
    assert.equal(renewed.ok, true);
    assert.equal(renewed.subscription.planId, "professional");
    assert.equal(renewed.subscription.status, SUBSCRIPTION_STATUS.ACTIVE);
    assert.equal(renewed.subscription.lockedAt, null);

    const venue = loadVenues().find((item) => item.id === VENUE_ID);
    assert.equal(venue.status, "active");
  });

  test("auto renew gói trả phí khi hết kỳ", () => {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const sub = createSubscriptionRecord(VENUE_ID, "starter", {
      currentPeriodEnd: end.toISOString(),
      autoRenew: true,
    });
    saveSubscriptions({ [VENUE_ID]: sub });

    const result = tryAutoRenew(VENUE_ID);
    assert.equal(result.ok, true);
    assert.equal(result.renewed, true);

    const updated = loadSubscriptions()[VENUE_ID];
    assert.equal(updated.status, SUBSCRIPTION_STATUS.ACTIVE);
    assert.ok(getDaysUntilPeriodEnd(updated) > 25);
  });

  test("runSubscriptionMaintenance xử lý tất cả tenant", () => {
    seedExpiredSubscription(1, "starter");
    const result = runSubscriptionMaintenance();
    assert.equal(result.ok, true);
    assert.equal(result.processed, 1);
  });
});
