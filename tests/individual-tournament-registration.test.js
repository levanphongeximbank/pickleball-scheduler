import test from "node:test";
import assert from "node:assert/strict";

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

import {
  ENTRY_STATUS,
  EVENT_TYPE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  createEntryRecord,
  createEventRecord,
  createTournamentRecord,
} from "../src/models/tournament/index.js";
import {
  approveEntry,
  cancelRegistration,
  canSubmitRegistration,
  confirmPartnerInvite,
  isRegistrationLocked,
  listWaitlistedEntries,
  lockRegistration,
  promoteFromWaitlist,
  rejectEntry,
  resolveEventTypeFromQuery,
  setRegistrationWindow,
  submitRegistration,
  waitlistEntry,
} from "../src/features/individual-tournament/engines/registrationEngine.js";
import { publishDraw, lockDraw } from "../src/tournament/engines/publishDrawEngine.js";

function makeTournament(overrides = {}) {
  const base = createTournamentRecord("club-1", {
    id: "t-reg-1",
    name: "S1-B Reg Test",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.REGISTRATION,
    events: [
      createEventRecord({
        id: "ev-1",
        tournamentId: "t-reg-1",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [],
      }),
    ],
  });
  return {
    ...base,
    ...overrides,
    id: overrides.id || base.id,
    clubId: overrides.clubId || base.clubId || "club-1",
    status: overrides.status || base.status,
    settings: { ...(base.settings || {}), ...(overrides.settings || {}) },
    events: overrides.events || base.events,
  };
}

test("T-S1-B01 Registration window blocks submit outside dates", () => {
  let tournament = makeTournament();
  const windowed = setRegistrationWindow(tournament, {
    opensAt: "2030-01-01T00:00:00.000Z",
    closesAt: "2030-12-31T00:00:00.000Z",
  });
  tournament = windowed.tournament;

  const tooEarly = canSubmitRegistration(tournament, { now: "2026-07-14T00:00:00.000Z" });
  assert.equal(tooEarly.ok, false);
  assert.equal(tooEarly.code, "WINDOW_NOT_OPEN");

  const ok = canSubmitRegistration(tournament, { now: "2030-06-01T00:00:00.000Z" });
  assert.equal(ok.ok, true);

  const tooLate = canSubmitRegistration(tournament, { now: "2031-01-01T00:00:00.000Z" });
  assert.equal(tooLate.ok, false);
  assert.equal(tooLate.code, "WINDOW_CLOSED");
});

test("T-S1-B02 Entry pending → approved → active path", () => {
  let tournament = makeTournament({
    events: [
      createEventRecord({
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [],
      }),
    ],
  });

  const submitted = submitRegistration(
    tournament,
    { eventId: "ev-1", playerIds: ["p1"], name: "Alpha" },
    { now: "2026-07-14T10:00:00.000Z" }
  );
  assert.equal(submitted.ok, true);
  assert.equal(submitted.entry.status, ENTRY_STATUS.PENDING);
  tournament = submitted.tournament;

  const approved = approveEntry(tournament, submitted.entry.id, {
    eventId: "ev-1",
    userId: "btc-1",
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.entry.status, ENTRY_STATUS.APPROVED);

  const audit = approved.tournament.settings.registration.auditLog;
  assert.ok(audit.some((item) => item.action === "registration_submitted"));
  assert.ok(audit.some((item) => item.action === "registration_approved"));
});

test("T-S1-B03 Waitlist promote ordering", () => {
  let tournament = makeTournament({
    settings: { registration: { maxEntries: 1 } },
    events: [
      createEventRecord({
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [
          createEntryRecord({
            id: "seeded",
            eventId: "ev-1",
            name: "Seeded",
            playerIds: ["seed"],
            status: ENTRY_STATUS.APPROVED,
          }),
        ],
      }),
    ],
  });

  const first = submitRegistration(tournament, {
    eventId: "ev-1",
    playerIds: ["p1"],
    name: "Wait-1",
  });
  assert.equal(first.entry.status, ENTRY_STATUS.WAITLISTED);
  assert.equal(first.entry.waitlistPosition, 1);
  tournament = first.tournament;

  const second = submitRegistration(tournament, {
    eventId: "ev-1",
    playerIds: ["p2"],
    name: "Wait-2",
  });
  assert.equal(second.entry.status, ENTRY_STATUS.WAITLISTED);
  assert.equal(second.entry.waitlistPosition, 2);
  tournament = second.tournament;

  const queue = listWaitlistedEntries(tournament.events[0]);
  assert.equal(queue[0].name, "Wait-1");
  assert.equal(queue[1].name, "Wait-2");

  // Free a seat then promote first
  tournament.events[0].entries = tournament.events[0].entries.map((entry) =>
    entry.id === "seeded" ? { ...entry, status: ENTRY_STATUS.CANCELLED } : entry
  );

  const promoted = promoteFromWaitlist(tournament, { eventId: "ev-1" });
  assert.equal(promoted.ok, true);
  assert.equal(promoted.entry.name, "Wait-1");
  assert.equal(promoted.entry.status, ENTRY_STATUS.APPROVED);
});

test("T-S1-B04 Partner invite token confirm binds player", () => {
  let tournament = makeTournament();
  const submitted = submitRegistration(tournament, {
    eventId: "ev-1",
    playerIds: ["p1"],
    name: "Alpha",
  });
  assert.equal(submitted.ok, true);
  assert.ok(submitted.inviteToken);
  tournament = submitted.tournament;

  const confirmed = confirmPartnerInvite(tournament, submitted.inviteToken, "p2", {
    partnerName: "Beta",
  });
  assert.equal(confirmed.ok, true);
  assert.deepEqual(confirmed.entry.playerIds, ["p1", "p2"]);
  assert.equal(confirmed.entry.partnerInviteToken, "");
});

test("T-S1-B05 Cancel before lock removes entry", () => {
  let tournament = makeTournament({
    events: [
      createEventRecord({
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [],
      }),
    ],
  });
  const submitted = submitRegistration(tournament, {
    eventId: "ev-1",
    playerIds: ["p1"],
    name: "Alpha",
  });
  tournament = submitted.tournament;
  assert.equal(tournament.events[0].entries.length, 1);

  const cancelled = cancelRegistration(tournament, submitted.entry.id, { eventId: "ev-1" });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.tournament.events[0].entries.length, 0);

  // After lock, cancel blocked
  tournament = submitRegistration(cancelled.tournament, {
    eventId: "ev-1",
    playerIds: ["p2"],
    name: "Beta",
  }).tournament;
  const locked = lockRegistration(tournament, { userId: "btc" });
  const blocked = cancelRegistration(locked.tournament, locked.tournament.events[0].entries[0].id, {
    eventId: "ev-1",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "REGISTRATION_LOCKED");
});

test("T-S1-B06 Nav ?event=men_single preselects event type", () => {
  assert.equal(resolveEventTypeFromQuery("men_single"), EVENT_TYPE.MEN_SINGLE);
  assert.equal(resolveEventTypeFromQuery("mixed_double"), EVENT_TYPE.MIXED_DOUBLE);
  assert.equal(resolveEventTypeFromQuery("nope"), null);
});

test("registration locks after draw publish", () => {
  let tournament = makeTournament({
    events: [
      createEventRecord({
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [
          createEntryRecord({
            id: "e1",
            name: "A",
            playerIds: ["p1"],
            status: ENTRY_STATUS.APPROVED,
          }),
        ],
        groups: [{ id: "g1", label: "A", entries: [{ id: "e1", name: "A" }] }],
      }),
    ],
  });

  assert.equal(isRegistrationLocked(tournament), false);
  const groups = tournament.events[0].groups;
  tournament = lockDraw(tournament, groups, { userId: "btc" }).tournament;
  tournament = publishDraw(tournament, groups, { userId: "btc" }).tournament;
  assert.equal(isRegistrationLocked(tournament), true);

  const blocked = submitRegistration(tournament, {
    eventId: "ev-1",
    playerIds: ["p9"],
    name: "Late",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "REGISTRATION_LOCKED");
});

test("organizer reject and waitlist workflow", () => {
  let tournament = makeTournament({
    events: [
      createEventRecord({
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [],
      }),
    ],
  });
  const submitted = submitRegistration(tournament, {
    eventId: "ev-1",
    playerIds: ["p1"],
    name: "Alpha",
  });
  tournament = submitted.tournament;

  const waitlisted = waitlistEntry(tournament, submitted.entry.id, { eventId: "ev-1" });
  assert.equal(waitlisted.ok, true);
  assert.equal(waitlisted.entry.status, ENTRY_STATUS.WAITLISTED);

  const rejected = rejectEntry(waitlisted.tournament, submitted.entry.id, {
    eventId: "ev-1",
    reason: "rating",
  });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.entry.status, ENTRY_STATUS.REJECTED);
});
