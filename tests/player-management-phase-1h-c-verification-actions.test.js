/**
 * Phase 1H-C — Admin verification actions UI + controller tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  IDENTITY_VERIFICATION_STATUS,
  VERIFICATION_QUEUE_DEFAULT_STATUS,
  VERIFICATION_QUEUE_ERROR_CODES,
  VERIFICATION_TRANSITION_MATRIX,
} from "../src/features/player/index.js";
import {
  buildVerificationConfirmation,
  getAvailableVerificationActions,
  isVerificationActionAvailable,
  VERIFICATION_ACTION_LABELS,
} from "../src/features/player/utils/verificationAdminActions.js";
import {
  createAdminVerificationQueueController,
  VERIFICATION_QUEUE_UI_STATUS,
} from "../src/features/player/utils/adminVerificationQueueController.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function queueItem(overrides = {}) {
  return {
    playerId: "player-auth-target-1",
    authUserId: "auth-target-1",
    displayName: "Nguyen Van A",
    activityRegion: { provinceName: "Hà Nội", city: null },
    verificationStatus: IDENTITY_VERIFICATION_STATUS.PENDING,
    venueId: "venue-a",
    updatedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

function createListMock(items, options = {}) {
  const calls = [];
  const listPlayerVerificationQueue = async (opts = {}) => {
    calls.push(opts);
    if (options.denied) {
      return {
        ok: false,
        code: VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED,
        message: "Not authorized to list the verification queue",
        data: [],
        meta: { status: opts.status || VERIFICATION_QUEUE_DEFAULT_STATUS, readOnly: true },
        errors: [],
      };
    }
    if (options.error) {
      return {
        ok: false,
        code: VERIFICATION_QUEUE_ERROR_CODES.PERSISTENCE_ERROR,
        message: options.error,
        data: [],
        meta: {},
        errors: [],
      };
    }
    let data = [...items];
    const status = opts.status || VERIFICATION_QUEUE_DEFAULT_STATUS;
    data = data.filter((i) => i.verificationStatus === status);
    const q = String(opts.query || opts.q || opts.search || "")
      .trim()
      .toLowerCase();
    if (q) {
      data = data.filter((i) =>
        `${i.displayName} ${i.playerId} ${i.authUserId}`.toLowerCase().includes(q)
      );
    }
    return {
      ok: true,
      data,
      meta: {
        count: data.length,
        status,
        statusDefaulted: opts.status === undefined,
        query: q,
        readOnly: true,
      },
      errors: [],
    };
  };
  return { listPlayerVerificationQueue, calls };
}

function createUpdateMock(options = {}) {
  const calls = [];
  let resolveNext;
  const gate = options.gate
    ? new Promise((resolve) => {
        resolveNext = resolve;
      })
    : null;

  const updatePlayerVerificationStatus = async (playerId, nextStatus, opts) => {
    const entry = { playerId, nextStatus, opts };
    calls.push(entry);
    if (gate) await gate;
    if (options.fail) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: options.failMessage || "Write failed",
        errors: [{ code: "PERSISTENCE_ERROR", message: options.failMessage || "Write failed" }],
      };
    }
    return {
      ok: true,
      playerId,
      fromStatus: options.fromStatus || IDENTITY_VERIFICATION_STATUS.PENDING,
      toStatus: nextStatus,
      profile: null,
      errors: [],
    };
  };

  return {
    updatePlayerVerificationStatus,
    calls,
    release: () => resolveNext && resolveNext(),
  };
}

test("1H-C available actions match transition matrix for every status", () => {
  for (const [from, allowed] of Object.entries(VERIFICATION_TRANSITION_MATRIX)) {
    const actions = getAvailableVerificationActions(from);
    assert.deepEqual(
      actions.map((a) => a.nextStatus),
      [...allowed]
    );
    for (const next of allowed) {
      assert.equal(isVerificationActionAvailable(from, next), true);
      assert.ok(VERIFICATION_ACTION_LABELS[next]);
    }
  }
});

test("1H-C invalid actions are not shown for current status", () => {
  const pendingActions = getAvailableVerificationActions("pending").map((a) => a.nextStatus);
  assert.ok(!pendingActions.includes("pending"));
  assert.ok(pendingActions.includes("verified"));
  assert.ok(pendingActions.includes("rejected"));
  assert.ok(pendingActions.includes("unverified"));

  const verifiedActions = getAvailableVerificationActions("verified").map((a) => a.nextStatus);
  assert.deepEqual(verifiedActions, ["unverified"]);
  assert.equal(isVerificationActionAvailable("verified", "rejected"), false);
  assert.equal(isVerificationActionAvailable("verified", "pending"), false);
  assert.equal(isVerificationActionAvailable("rejected", "verified"), false);
});

test("1H-C confirmation payload maps friendly labels to canonical statuses", () => {
  const built = buildVerificationConfirmation({
    item: queueItem({ verificationStatus: "pending" }),
    nextStatus: "verified",
  });
  assert.equal(built.ok, true);
  assert.equal(built.payload.fromStatus, "pending");
  assert.equal(built.payload.toStatus, "verified");
  assert.equal(built.payload.rejectionReasonSupported, false);
  assert.match(built.payload.fromStatusLabel, /chờ/i);
  assert.match(built.payload.toStatusLabel, /xác minh/i);
});

test("1H-C confirmation rejects invalid transition", () => {
  const built = buildVerificationConfirmation({
    item: queueItem({ verificationStatus: "verified" }),
    nextStatus: "rejected",
  });
  assert.equal(built.ok, false);
  assert.equal(built.code, "INVALID_TRANSITION");
});

test("1H-C authorized admin can load the queue (default pending)", async () => {
  const items = [
    queueItem({ verificationStatus: "pending" }),
    queueItem({
      playerId: "player-2",
      authUserId: "auth-2",
      verificationStatus: "verified",
      displayName: "Other",
    }),
  ];
  const list = createListMock(items);
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: createUpdateMock().updatePlayerVerificationStatus,
  });

  const state = await ctrl.load({});
  assert.equal(state.uiStatus, VERIFICATION_QUEUE_UI_STATUS.READY);
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].verificationStatus, "pending");
  assert.equal(list.calls[0].status, VERIFICATION_QUEUE_DEFAULT_STATUS);
  assert.equal(state.meta.status, VERIFICATION_QUEUE_DEFAULT_STATUS);
  assert.equal(state.statusFilter, VERIFICATION_QUEUE_DEFAULT_STATUS);
});

test("1H-C unauthorized caller sees denied state", async () => {
  const list = createListMock([], { denied: true });
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: createUpdateMock().updatePlayerVerificationStatus,
  });
  const state = await ctrl.load({});
  assert.equal(state.uiStatus, VERIFICATION_QUEUE_UI_STATUS.DENIED);
  assert.equal(state.items.length, 0);
  assert.ok(state.loadError?.message);
});

test("1H-C supported status filter works", async () => {
  const items = [
    queueItem({ verificationStatus: "pending" }),
    queueItem({
      playerId: "p-rej",
      authUserId: "a-rej",
      verificationStatus: "rejected",
      displayName: "Rejected",
    }),
  ];
  const list = createListMock(items);
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: createUpdateMock().updatePlayerVerificationStatus,
  });
  const state = await ctrl.load({ status: "rejected" });
  assert.equal(state.uiStatus, VERIFICATION_QUEUE_UI_STATUS.READY);
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].verificationStatus, "rejected");
  assert.equal(list.calls[0].status, "rejected");
});

test("1H-C search is wired to listPlayerVerificationQueue query option", async () => {
  const items = [
    queueItem({ displayName: "Alpha Player" }),
    queueItem({
      playerId: "player-beta",
      authUserId: "auth-beta",
      displayName: "Beta Player",
      verificationStatus: "pending",
    }),
  ];
  const list = createListMock(items);
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: createUpdateMock().updatePlayerVerificationStatus,
  });
  const state = await ctrl.load({ query: "beta" });
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].displayName, "Beta Player");
  assert.equal(list.calls[0].query, "beta");
});

test("1H-C empty queue yields empty UI state", async () => {
  const list = createListMock([]);
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: createUpdateMock().updatePlayerVerificationStatus,
  });
  const state = await ctrl.load({});
  assert.equal(state.uiStatus, VERIFICATION_QUEUE_UI_STATUS.EMPTY);
});

test("1H-C confirmation required before mutation; cancel writes nothing", async () => {
  const item = queueItem();
  const list = createListMock([item]);
  const update = createUpdateMock();
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: update.updatePlayerVerificationStatus,
  });
  await ctrl.load({});

  const withoutConfirm = await ctrl.confirmAction();
  assert.equal(withoutConfirm.ok, false);
  assert.equal(withoutConfirm.code, "CONFIRMATION_REQUIRED");
  assert.equal(update.calls.length, 0);

  const opened = ctrl.requestAction(item, "verified");
  assert.equal(opened.ok, true);
  assert.equal(ctrl.getState().pendingConfirm.toStatus, "verified");

  const cancelled = ctrl.cancelConfirm();
  assert.equal(cancelled.wrote, false);
  assert.equal(ctrl.getState().pendingConfirm, null);
  assert.equal(update.calls.length, 0);
});

test("1H-C confirm calls updatePlayerVerificationStatus exactly once", async () => {
  const item = queueItem();
  const list = createListMock([item]);
  const update = createUpdateMock();
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: update.updatePlayerVerificationStatus,
  });
  await ctrl.load({});
  ctrl.requestAction(item, "verified");
  const result = await ctrl.confirmAction();
  assert.equal(result.ok, true);
  assert.equal(update.calls.length, 1);
  assert.equal(update.calls[0].playerId, item.playerId);
  assert.equal(update.calls[0].nextStatus, "verified");
});

test("1H-C duplicate submission is blocked while mutation pending", async () => {
  const item = queueItem();
  const list = createListMock([item]);
  const update = createUpdateMock({ gate: true });
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: update.updatePlayerVerificationStatus,
  });
  await ctrl.load({});
  ctrl.requestAction(item, "verified");

  const firstPromise = ctrl.confirmAction();
  // Allow first call to set mutating=true
  await Promise.resolve();
  const duplicate = await ctrl.confirmAction();
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "DUPLICATE_SUBMISSION");

  update.release();
  const first = await firstPromise;
  assert.equal(first.ok, true);
  assert.equal(update.calls.length, 1);
});

test("1H-C successful mutation refreshes queue deterministically", async () => {
  let current = [queueItem({ verificationStatus: "pending" })];
  const listCalls = [];
  const listPlayerVerificationQueue = async (opts = {}) => {
    listCalls.push(opts);
    const status = opts.status || VERIFICATION_QUEUE_DEFAULT_STATUS;
    const data = current.filter((i) => i.verificationStatus === status);
    return {
      ok: true,
      data,
      meta: { count: data.length, status, readOnly: true },
      errors: [],
    };
  };
  const updatePlayerVerificationStatus = async (playerId, nextStatus) => {
    current = current.map((i) =>
      i.playerId === playerId ? { ...i, verificationStatus: nextStatus } : i
    );
    return {
      ok: true,
      playerId,
      fromStatus: "pending",
      toStatus: nextStatus,
      errors: [],
    };
  };
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue,
    updatePlayerVerificationStatus,
  });
  await ctrl.load({ status: "pending" });
  assert.equal(ctrl.getState().items.length, 1);
  ctrl.requestAction(current[0], "verified");
  const result = await ctrl.confirmAction();
  assert.equal(result.ok, true);
  // Initial load + post-mutation refresh
  assert.ok(listCalls.length >= 2);
  assert.equal(ctrl.getState().items.length, 0);
  assert.equal(ctrl.getState().uiStatus, VERIFICATION_QUEUE_UI_STATUS.EMPTY);
  assert.match(ctrl.getState().successMessage || "", /pending → verified/);
});

test("1H-C failed mutation retains queue row and shows normalized error", async () => {
  const item = queueItem();
  const list = createListMock([item]);
  const update = createUpdateMock({ fail: true, failMessage: "Normalized write failure" });
  const ctrl = createAdminVerificationQueueController({
    listPlayerVerificationQueue: list.listPlayerVerificationQueue,
    updatePlayerVerificationStatus: update.updatePlayerVerificationStatus,
  });
  await ctrl.load({});
  ctrl.requestAction(item, "verified");
  const result = await ctrl.confirmAction();
  assert.equal(result.ok, false);
  assert.equal(result.itemsUnchanged, true);
  const state = ctrl.getState();
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].playerId, item.playerId);
  assert.equal(state.items[0].verificationStatus, "pending");
  assert.equal(state.mutationError.message, "Normalized write failure");
  assert.equal(state.successMessage, null);
});

test("1H-C page/component use authorized APIs only — no direct db / audit / profile verification write", () => {
  const files = [
    "src/pages/AdminPlayerVerificationPage.jsx",
    "src/features/player/components/AdminPlayerVerificationQueue.jsx",
    "src/features/player/utils/adminVerificationQueueController.js",
    "src/features/player/utils/verificationAdminActions.js",
  ];
  for (const rel of files) {
    const src = readSrc(rel);
    assert.match(
      src,
      /listPlayerVerificationQueue|AdminPlayerVerificationQueue|VERIFICATION_TRANSITION_MATRIX|createAdminVerificationQueueController/
    );
    assert.doesNotMatch(src, /from\s+['"][^'"]*supabase[^'"]*['"]/i);
    assert.doesNotMatch(src, /\.from\(['"]profiles['"]\)/);
    assert.doesNotMatch(src, /createClient\s*\(/);
    assert.doesNotMatch(src, /writeAuditLog/);
    assert.doesNotMatch(src, /AUDIT_ACTIONS/);
    assert.doesNotMatch(src, /updatePlayerProfile\s*\(/);
  }

  const page = readSrc("src/pages/AdminPlayerVerificationPage.jsx");
  assert.match(page, /AdminPlayerVerificationQueue/);
  assert.match(page, /USER_MANAGE/);

  const component = readSrc(
    "src/features/player/components/AdminPlayerVerificationQueue.jsx"
  );
  assert.match(component, /createAdminVerificationQueueController/);
  assert.match(component, /confirmAction/);
  assert.match(component, /requestAction/);
  assert.match(component, /cancelConfirm/);

  const controller = readSrc(
    "src/features/player/utils/adminVerificationQueueController.js"
  );
  assert.match(controller, /listPlayerVerificationQueue/);
  assert.match(controller, /updatePlayerVerificationStatus/);
  assert.doesNotMatch(controller, /updatePlayerProfile\s*\(/);
  assert.doesNotMatch(controller, /from\s+['"].*updatePlayerProfile/);
});

test("1H-C route + admin menu entry exist; no sensitive DTO fields in UI source", () => {
  const router = readSrc("src/router.jsx");
  assert.match(router, /\/users\/verification/);
  assert.match(router, /AdminPlayerVerificationPage/);

  const nav = readSrc("src/config/navigationConfig.js");
  assert.match(nav, /"\/users\/verification"/);
  assert.match(nav, /USER_MANAGE/);

  const menu = readSrc("src/config/v5Menu/adminMenu.js");
  assert.match(menu, /\/users\/verification/);
  assert.match(menu, /player-verification/);

  const ui = readSrc("src/features/player/components/AdminPlayerVerificationQueue.jsx");
  // Sensitive fields must not be read/rendered from queue items or props.
  const forbiddenAccess = [
    /item\.privacy_settings|item\.privacySettings/,
    /item\.email\b/,
    /item\.phone\b/,
    /item\.birth_date|item\.birthDate|item\.birth_year|item\.birthYear/,
    /item\.handedness\b/,
    /item\.avatar_url|item\.avatarUrl/,
    /item\.roles?\b/,
    /item\.permissions\b/,
    /item\.password\b/,
    /item\.token\b|item\.accessToken|item\.refreshToken/,
  ];
  for (const pattern of forbiddenAccess) {
    assert.doesNotMatch(ui, pattern);
  }
  assert.doesNotMatch(ui, /privacy_settings/);
  assert.doesNotMatch(ui, /handedness/);

  // Allowed DTO fields are referenced
  assert.match(ui, /displayName/);
  assert.match(ui, /verificationStatus/);
  assert.match(ui, /activityRegion/);
  assert.match(ui, /venueId/);
  assert.match(ui, /updatedAt/);
  assert.match(ui, /playerId/);
});

test("1H-C rejection reason remains deferred (no unaudited reason field)", () => {
  const actions = readSrc("src/features/player/utils/verificationAdminActions.js");
  assert.match(actions, /rejectionReasonSupported:\s*false/);
  assert.match(actions, /deferred/i);

  const ui = readSrc("src/features/player/components/AdminPlayerVerificationQueue.jsx");
  assert.match(ui, /deferred/i);
  assert.doesNotMatch(ui, /rejectionReason\s*[:=]/);
  assert.doesNotMatch(ui, /reasonText|freeTextReason/);
});

test("1H-C no SQL / schema artifacts added for this phase", () => {
  const evidence = readSrc(
    "docs/player-management/phase-1h/05_PHASE_1H_C_ACTIONS_IMPLEMENTATION_EVIDENCE.md"
  );
  assert.match(evidence, /SQL/);
  assert.match(evidence, /None|none|Không/);
});
