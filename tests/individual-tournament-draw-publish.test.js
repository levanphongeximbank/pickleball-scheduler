import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  canRegenerateDraw,
  canPublishDraw,
  canLockDraw,
  forceRedrawDraw,
  getDrawPublishStatus,
  lockDraw,
  publishDraw,
  recordDrawCreated,
  reopenDraw,
  DRAW_PUBLISH_STATUS,
  DRAW_AUDIT_ACTIONS,
} from "../src/tournament/engines/publishDrawEngine.js";
import { appendWorkflowHistoryEntry } from "../src/features/tournament-engine/hooks/workflowHistory.js";
import { appendEngineRun, listEngineRuns, clearEngineRuns } from "../src/features/tournament-engine/services/engineRunLog.js";

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

test.beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

const FIXTURE_GROUPS = [
  {
    id: "g1",
    label: "A",
    entries: [
      { id: "e1", name: "Alpha" },
      { id: "e2", name: "Beta" },
    ],
  },
  {
    id: "g2",
    label: "B",
    entries: [{ id: "e3", name: "Gamma" }],
  },
];

function makeTournament(overrides = {}) {
  return {
    id: "t-s1-a",
    clubId: "club-1",
    settings: {},
    ...overrides,
  };
}

test("T-S1-A01 useTournamentEngine uses real tournament orchestrator", () => {
  const hookPath = path.join("src/features/tournament-engine/hooks/useTournamentEngine.js");
  const source = fs.readFileSync(hookPath, "utf8");

  assert.doesNotMatch(source, /runPlatformEngineWorkflow/);
  assert.match(source, /runSeedEngine/);
  assert.match(source, /runDrawEngine/);
  assert.match(source, /runScheduleEngine/);
  assert.match(source, /runFullTournamentPlan/);
});

test("T-S1-A02 publish draw sets publishedAt and blocks redraw", () => {
  let tournament = makeTournament();

  const locked = lockDraw(tournament, FIXTURE_GROUPS, { userId: "btc-1" });
  assert.equal(locked.ok, true);
  assert.equal(locked.drawPublish.status, DRAW_PUBLISH_STATUS.LOCKED);
  tournament = locked.tournament;

  const published = publishDraw(tournament, FIXTURE_GROUPS, { userId: "btc-1" });
  assert.equal(published.ok, true);
  assert.ok(published.tournament.settings.draw.publishedAt);
  assert.equal(published.tournament.settings.draw.publishedBy, "btc-1");
  assert.equal(published.tournament.settings.draw.status, DRAW_PUBLISH_STATUS.PUBLISHED);
  assert.equal(published.snapshot.length, 2);

  const regen = canRegenerateDraw(published.tournament);
  assert.equal(regen.ok, false);
  assert.match(regen.error, /công bố/i);
});

test("T-S1-A03 force redraw appends audit entry", () => {
  let tournament = makeTournament();
  const locked = lockDraw(tournament, FIXTURE_GROUPS, { userId: "btc-1" });
  const published = publishDraw(locked.tournament, FIXTURE_GROUPS, {
    userId: "btc-1",
    actor: { id: "btc-1", email: "btc@example.com" },
  });

  const denied = forceRedrawDraw(published.tournament, { hasReopenPermission: false });
  assert.equal(denied.ok, false);

  const forced = forceRedrawDraw(published.tournament, {
    userId: "owner-1",
    actor: { id: "owner-1", email: "owner@example.com" },
    hasReopenPermission: true,
  });
  assert.equal(forced.ok, true);
  assert.equal(forced.tournament.settings.draw.status, DRAW_PUBLISH_STATUS.DRAFT);
  assert.equal(forced.tournament.settings.draw.publishedAt, null);

  const auditLog = forced.tournament.settings.draw.auditLog;
  assert.ok(Array.isArray(auditLog));
  assert.ok(auditLog.some((entry) => entry.action === DRAW_AUDIT_ACTIONS.FORCE_REDRAW));
  assert.ok(auditLog.some((entry) => entry.action === DRAW_AUDIT_ACTIONS.PUBLISHED));
});

test("T-S1-A04 workflow history records seed/draw actor", () => {
  const actor = { id: "u1", email: "organizer@example.com", name: "BTC" };
  const history = appendWorkflowHistoryEntry([], {
    action: "seed",
    status: "success",
    detail: "Generated 8 seed entries",
    actor,
    before: { participants: ["p1"] },
    after: { participants: ["p1", "p2"] },
  });

  assert.equal(history.length, 1);
  assert.equal(history[0].actor.id, "u1");
  assert.equal(history[0].actor.email, "organizer@example.com");
  assert.deepEqual(history[0].before.participants, ["p1"]);
});

test("draw lifecycle draft → lock → publish → reopen", () => {
  let tournament = makeTournament();

  const created = recordDrawCreated(tournament, FIXTURE_GROUPS, {
    userId: "btc-1",
    actor: { id: "btc-1", email: "btc@example.com" },
  });
  assert.equal(created.ok, true);
  assert.ok(created.auditEntry.action === DRAW_AUDIT_ACTIONS.CREATED);
  tournament = created.tournament;

  assert.equal(canLockDraw(tournament, FIXTURE_GROUPS).ok, true);
  assert.equal(canPublishDraw(tournament, FIXTURE_GROUPS).ok, false);

  const locked = lockDraw(tournament, FIXTURE_GROUPS, { userId: "btc-1" });
  tournament = locked.tournament;
  assert.equal(getDrawPublishStatus(tournament).status, DRAW_PUBLISH_STATUS.LOCKED);

  const published = publishDraw(tournament, FIXTURE_GROUPS, { userId: "btc-1" });
  tournament = published.tournament;
  assert.equal(getDrawPublishStatus(tournament).status, DRAW_PUBLISH_STATUS.PUBLISHED);

  const reopened = reopenDraw(tournament, {
    userId: "owner-1",
    hasReopenPermission: true,
  });
  assert.equal(reopened.ok, true);
  assert.equal(reopened.tournament.settings.draw.status, DRAW_PUBLISH_STATUS.DRAFT);
  assert.ok(
    reopened.tournament.settings.draw.auditLog.some(
      (entry) => entry.action === DRAW_AUDIT_ACTIONS.REOPENED
    )
  );
});

test("engineRunLog stores actor and before/after diff", () => {
  clearEngineRuns("club-test", "t-engine");

  appendEngineRun("club-test", "t-engine", {
    engineType: "draw",
    action: "draw",
    actor: { id: "u1", email: "a@b.com" },
    before: { groups: 0 },
    after: { groups: 2 },
    inputSummary: { participantCount: 8 },
    output: { groups: FIXTURE_GROUPS },
  });

  const runs = listEngineRuns("club-test", "t-engine");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].actor.email, "a@b.com");
  assert.deepEqual(runs[0].before, { groups: 0 });
  assert.deepEqual(runs[0].after, { groups: 2 });

  clearEngineRuns("club-test", "t-engine");
});
