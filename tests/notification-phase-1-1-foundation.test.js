import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as notificationsPublicApi from "../src/features/notifications/index.js";
import {
  emitNotificationEvent,
  listInbox,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  validateNotificationEventEnvelope,
  ENVELOPE_ERROR_CODES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_EVENT_CATALOGUE,
  NOTIFICATION_STATUSES,
  createNotificationRepository,
  setNotificationRepository,
  resetNotificationRepository,
  NOTIFICATION_STORE_MODES,
} from "../src/features/notifications/index.js";
import { clearNotificationInboxStorage } from "../src/features/notifications/storage/notificationInboxStorage.js";
import { clearNotificationPreferencesStorage } from "../src/features/notifications/services/notificationPreferencesService.js";
import { clearNotificationStorage } from "../src/features/notifications/storage/notificationStorage.js";
import { clearLocalDeliveryJobsStorage } from "../src/features/notifications/repositories/localNotificationRepository.js";
import {
  sendNotification,
  seedDefaultTemplates,
} from "../src/features/notifications/services/notificationService.js";
import { renderTemplate } from "../src/features/notifications/models/notificationModels.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function walkJsFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkJsFiles(full, out);
    } else if (/\.(js|jsx|ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function fileImportsNotificationProvider(filePath) {
  const content = readFileSync(filePath, "utf8");
  const patterns = [
    /EmailProvider/,
    /SmsProvider/,
    /ZaloOAProvider/,
    /MockNotificationProvider/,
    /resolveNotificationProvider/,
    /features\/notifications\/providers/,
    /notifications\/storage\/notificationStorage/,
    /notifications\/storage\/notificationInboxStorage/,
  ];
  return patterns.some((re) => re.test(content));
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  clearNotificationInboxStorage();
  clearLocalDeliveryJobsStorage();
  clearNotificationPreferencesStorage();
  clearNotificationStorage();
  setNotificationRepository(
    createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY })
  );
});

afterEach(() => {
  resetNotificationRepository();
  clearNotificationInboxStorage();
  clearLocalDeliveryJobsStorage();
  clearNotificationPreferencesStorage();
  clearNotificationStorage();
  delete globalThis.localStorage;
});

describe("Notification Phase 1.1 — event envelope validation", () => {
  it("accepts a valid envelope and fills optional defaults", () => {
    const result = validateNotificationEventEnvelope({
      eventType: NOTIFICATION_EVENT_TYPES.MATCH_SCHEDULED,
      tenantId: "tenant-1",
      idempotencyKey: "match-sched-1",
      competitionId: "comp-9",
    });

    assert.equal(result.ok, true);
    assert.equal(result.event.eventType, NOTIFICATION_EVENT_TYPES.MATCH_SCHEDULED);
    assert.equal(result.event.tenantId, "tenant-1");
    assert.equal(result.event.idempotencyKey, "match-sched-1");
    assert.equal(result.event.competitionId, "comp-9");
    assert.equal(result.event.venueId, null);
    assert.equal(result.event.clubId, null);
    assert.equal(result.event.actorUserId, null);
    assert.ok(result.event.eventId);
    assert.ok(result.event.occurredAt);
    assert.deepEqual(result.event.payload, {});
    assert.deepEqual(result.event.recipientHints, {
      userIds: [],
      roles: [],
      entryIds: [],
    });
  });

  it("rejects missing tenantId", () => {
    const result = validateNotificationEventEnvelope({
      eventType: NOTIFICATION_EVENT_TYPES.BOOKING_CREATED,
      idempotencyKey: "book-1",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, ENVELOPE_ERROR_CODES.MISSING_TENANT_ID);
  });

  it("rejects missing eventType", () => {
    const result = validateNotificationEventEnvelope({
      tenantId: "tenant-1",
      idempotencyKey: "book-1",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, ENVELOPE_ERROR_CODES.MISSING_EVENT_TYPE);
  });

  it("rejects missing idempotencyKey", () => {
    const result = validateNotificationEventEnvelope({
      tenantId: "tenant-1",
      eventType: NOTIFICATION_EVENT_TYPES.PAYMENT_CONFIRMED,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, ENVELOPE_ERROR_CODES.MISSING_IDEMPOTENCY_KEY);
  });
});

describe("Notification Phase 1.1 — emit + idempotency + inbox", () => {
  it("emitNotificationEvent creates a CREATED inbox record", async () => {
    const result = await emitNotificationEvent({
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENT_TYPES.REGISTRATION_CONFIRMED,
      idempotencyKey: "reg-42",
      recipientHints: { userIds: ["u-1"], roles: ["PLAYER"], entryIds: ["e-1"] },
      payload: { entryId: "e-1" },
    });

    assert.equal(result.ok, true);
    assert.equal(result.duplicate, false);
    assert.equal(result.notification.status, NOTIFICATION_STATUSES.CREATED);
    assert.equal(result.notification.idempotencyKey, "reg-42");

    const inbox = await listInbox({ tenantId: "tenant-a" });
    assert.equal(inbox.ok, true);
    assert.equal(inbox.items.length, 1);
  });

  it("same tenantId + idempotencyKey does not create duplicate records", async () => {
    const first = await emitNotificationEvent({
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENT_TYPES.COURT_CHANGED,
      idempotencyKey: "court-change-7",
      payload: { courtId: "c1" },
    });
    const second = await emitNotificationEvent({
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENT_TYPES.COURT_CHANGED,
      idempotencyKey: "court-change-7",
      payload: { courtId: "c2" },
    });

    assert.equal(first.ok, true);
    assert.equal(first.duplicate, false);
    assert.equal(second.ok, true);
    assert.equal(second.duplicate, true);
    assert.equal(second.notification.id, first.notification.id);

    const inbox = await listInbox({ tenantId: "tenant-a" });
    assert.equal(inbox.items.length, 1);
  });

  it("different tenants may reuse the same idempotencyKey", async () => {
    await emitNotificationEvent({
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED,
      idempotencyKey: "pay-dup-key",
    });
    await emitNotificationEvent({
      tenantId: "tenant-b",
      eventType: NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED,
      idempotencyKey: "pay-dup-key",
    });

    assert.equal((await listInbox({ tenantId: "tenant-a" })).items.length, 1);
    assert.equal((await listInbox({ tenantId: "tenant-b" })).items.length, 1);
  });

  it("markNotificationRead and markAllNotificationsRead update status to READ", async () => {
    const a = await emitNotificationEvent({
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENT_TYPES.MATCH_STARTING_SOON,
      idempotencyKey: "soon-1",
      recipientHints: { userIds: ["u-1"] },
    });
    await emitNotificationEvent({
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENT_TYPES.SCORE_SUBMITTED,
      idempotencyKey: "score-1",
      recipientHints: { userIds: ["u-1"] },
    });

    const marked = await markNotificationRead({
      tenantId: "tenant-a",
      notificationId: a.notification.id,
      userId: "u-1",
    });
    assert.equal(marked.ok, true);
    assert.equal(marked.notification.status, NOTIFICATION_STATUSES.READ);

    const all = await markAllNotificationsRead({ tenantId: "tenant-a", userId: "u-1" });
    assert.equal(all.ok, true);
    assert.equal(all.updatedCount, 1);

    const unread = await listInbox({
      tenantId: "tenant-a",
      userId: "u-1",
      status: NOTIFICATION_STATUSES.CREATED,
    });
    assert.equal(unread.items.length, 0);
  });

  it("getNotificationPreferences returns skeleton defaults", () => {
    const result = getNotificationPreferences({
      tenantId: "tenant-a",
      userId: "u-1",
    });
    assert.equal(result.ok, true);
    assert.equal(result.preferences.channels.inApp, true);
    assert.equal(result.preferences.channels.email, false);
    assert.deepEqual(result.preferences.mutedEventTypes, []);
  });

  it("catalogue includes required Phase 1.1 events", () => {
    const required = [
      "COMPETITION_PUBLISHED",
      "REGISTRATION_CONFIRMED",
      "LINEUP_DEADLINE_APPROACHING",
      "LINEUP_LOCKED",
      "MATCH_SCHEDULED",
      "MATCH_STARTING_SOON",
      "COURT_CHANGED",
      "SCORE_SUBMITTED",
      "RESULT_CONFIRMED",
      "COMPETITION_COMPLETED",
      "CLUB_INVITATION_CREATED",
      "CLUB_SCHEDULE_UPDATED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_FAILED",
      "SUBSCRIPTION_EXPIRING",
      "BOOKING_CREATED",
      "BOOKING_CANCELLED",
    ];
    for (const key of required) {
      assert.equal(NOTIFICATION_EVENT_TYPES[key], key);
      assert.ok(NOTIFICATION_EVENT_CATALOGUE.includes(key));
    }
  });
});

describe("Notification Phase 1.1 — public API boundary", () => {
  it("public API exports required functions and does not expose providers", () => {
    assert.equal(typeof notificationsPublicApi.emitNotificationEvent, "function");
    assert.equal(typeof notificationsPublicApi.listInbox, "function");
    assert.equal(typeof notificationsPublicApi.markNotificationRead, "function");
    assert.equal(typeof notificationsPublicApi.markAllNotificationsRead, "function");
    assert.equal(typeof notificationsPublicApi.getNotificationPreferences, "function");

    const forbidden = [
      "EmailProvider",
      "SmsProvider",
      "ZaloOAProvider",
      "MockNotificationProvider",
      "emailProvider",
      "smsProvider",
      "zaloOAProvider",
      "resolveNotificationProvider",
      "loadInboxRecords",
      "saveInboxRecords",
      "loadNotificationJobs",
      "clearNotificationInboxStorage",
      "notificationInboxStorage",
    ];
    for (const name of forbidden) {
      assert.equal(
        notificationsPublicApi[name],
        undefined,
        `public API must not export ${name}`
      );
    }
  });
});

describe("Notification Phase 1.1 — Competition Engine boundary", () => {
  it("Competition Engine does not import notification providers or storage", () => {
    const dirs = [
      path.join(ROOT, "src", "features", "competition-core"),
      path.join(ROOT, "src", "features", "tournament-engine"),
    ];
    const offenders = [];
    for (const dir of dirs) {
      for (const file of walkJsFiles(dir)) {
        if (fileImportsNotificationProvider(file)) {
          offenders.push(path.relative(ROOT, file).split(path.sep).join("/"));
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});

describe("Notification Phase 1.1 — existing notification regression", () => {
  it("legacy mock email send still works", async () => {
    seedDefaultTemplates();
    const result = await sendNotification({
      tenantId: "tenant-regression",
      channel: "email",
      templateKey: "payment_success",
      recipientId: "user-1",
      variables: { name: "A", message: "OK" },
      forceMock: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.log.status, "sent");
  });

  it("legacy template render still works", () => {
    const rendered = renderTemplate(
      { title: "Hi {{name}}", subject: "S", body: "Msg: {{message}}" },
      { name: "Lan", message: "Done" }
    );
    assert.equal(rendered.title, "Hi Lan");
    assert.equal(rendered.body, "Msg: Done");
  });
});
