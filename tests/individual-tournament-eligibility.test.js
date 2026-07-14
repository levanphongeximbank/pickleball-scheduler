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
  checkPlayerEligibility,
  updateEligibilityRules,
  findCrossEventDuplicates,
  getEligibilityRules,
} from "../src/features/individual-tournament/engines/eligibilityEngine.js";
import {
  setEntryFee,
  canApproveWithFee,
  recordEntryPayment,
  PAYMENT_STATUS,
  FEE_MODE,
} from "../src/features/individual-tournament/engines/entryFeeEngine.js";
import {
  gatedApproveEntry,
  gatedSubmitRegistration,
  validateRegistrationEligibility,
} from "../src/features/individual-tournament/engines/registrationValidation.js";
import {
  getRegulations,
  setRegulations,
  setRegistrationPolicy,
  getRegistrationPolicy,
} from "../src/features/individual-tournament/engines/regulationsEngine.js";
import { submitRegistration } from "../src/features/individual-tournament/engines/registrationEngine.js";

function makeTournament(overrides = {}) {
  const base = createTournamentRecord("club-1", {
    id: "t-elig-1",
    name: "S1-C Eligibility",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.REGISTRATION,
    events: [
      createEventRecord({
        id: "ev-1",
        tournamentId: "t-elig-1",
        name: "Đơn nam",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [],
      }),
    ],
  });
  return {
    ...base,
    ...overrides,
    settings: { ...(base.settings || {}), ...(overrides.settings || {}) },
    events: overrides.events || base.events,
  };
}

test("T-S1-C01 Age rule rejects ineligible player", () => {
  let tournament = makeTournament();
  tournament = updateEligibilityRules(tournament, {
    age: { enabled: true, minAge: 18, maxAge: 40, asOfDate: "2026-07-14" },
  }).tournament;

  const young = checkPlayerEligibility(
    { id: "p1", name: "Kid", birthYear: 2015, gender: "male" },
    getEligibilityRules(tournament)
  );
  assert.equal(young.ok, false);
  assert.ok(young.violations.some((item) => item.code === "age_too_young"));

  const ok = checkPlayerEligibility(
    { id: "p2", name: "Adult", birthYear: 2000, gender: "male" },
    getEligibilityRules(tournament)
  );
  assert.equal(ok.ok, true);
});

test("T-S1-C02 Gender rule rejects wrong gender for event", () => {
  const tournament = makeTournament();
  const female = { id: "p1", name: "A", gender: "female" };
  const result = validateRegistrationEligibility(
    tournament,
    ["p1"],
    [female],
    { event: tournament.events[0], eventId: "ev-1" }
  );
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((item) => item.code === "gender_not_allowed" || /nữ|female|giới/i.test(item.message)));
});

test("T-S1-C03 Cross-event duplicate registration blocked", () => {
  let tournament = makeTournament({
    events: [
      createEventRecord({
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [
          createEntryRecord({
            id: "e1",
            eventId: "ev-1",
            name: "Alpha",
            playerIds: ["p1"],
            status: ENTRY_STATUS.APPROVED,
          }),
        ],
      }),
      createEventRecord({
        id: "ev-2",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [],
      }),
    ],
  });

  const hits = findCrossEventDuplicates(tournament, ["p1"], null);
  assert.ok(hits.some((hit) => hit.eventId === "ev-1"));

  const gate = validateRegistrationEligibility(
    tournament,
    ["p1"],
    [{ id: "p1", name: "Alpha", gender: "male", birthYear: 1990 }],
    { eventId: "ev-2", event: tournament.events[1] }
  );
  assert.equal(gate.ok, false);
  assert.ok(gate.violations.some((item) => item.code === "cross_event_duplicate"));
});

test("T-S1-C04 Fee status unpaid blocks approve (if configured)", () => {
  let tournament = makeTournament({
    events: [
      createEventRecord({
        id: "ev-1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [
          createEntryRecord({
            id: "e-pending",
            eventId: "ev-1",
            name: "Alpha",
            playerIds: ["p1"],
            status: ENTRY_STATUS.PENDING,
          }),
        ],
      }),
    ],
  });

  tournament = setEntryFee(tournament, {
    enabled: true,
    mode: FEE_MODE.FIXED,
    amount: 100000,
    requirePaidToApprove: true,
  }).tournament;

  const blocked = canApproveWithFee(tournament, "e-pending");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "FEE_UNPAID");

  const gated = gatedApproveEntry(tournament, "e-pending", {
    eventId: "ev-1",
    players: [{ id: "p1", name: "Alpha", gender: "male", birthYear: 1990 }],
  });
  assert.equal(gated.ok, false);

  tournament = recordEntryPayment(tournament, "e-pending", {
    status: PAYMENT_STATUS.PAID,
    amountPaid: 100000,
  }).tournament;

  const allowed = gatedApproveEntry(tournament, "e-pending", {
    eventId: "ev-1",
    players: [{ id: "p1", name: "Alpha", gender: "male", birthYear: 1990 }],
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.entry.status, ENTRY_STATUS.APPROVED);
});

test("T-S1-C05 Config page round-trip persist on blob", () => {
  let tournament = makeTournament();
  tournament = updateEligibilityRules(tournament, {
    age: { enabled: true, minAge: 16, maxAge: 55 },
    skill: { enabled: true, minLevel: 2.5, maxLevel: 5 },
  }).tournament;
  tournament = setEntryFee(tournament, {
    enabled: true,
    mode: FEE_MODE.EARLY_BIRD,
    amount: 200000,
    earlyBirdAmount: 150000,
    earlyBirdUntil: "2026-08-01T00:00:00.000Z",
    requirePaidToApprove: true,
  }).tournament;
  tournament = setRegulations(tournament, {
    templateId: "open",
    body: "Test regulations body",
  }).tournament;
  tournament = setRegistrationPolicy(tournament, {
    confirmationMessage: "Thanks for registering",
  }).tournament;

  assert.equal(getEligibilityRules(tournament).age.minAge, 16);
  assert.equal(tournament.settings.entryFee.earlyBirdAmount, 150000);
  assert.equal(getRegulations(tournament).body, "Test regulations body");
  assert.equal(getRegistrationPolicy(tournament).confirmationMessage, "Thanks for registering");
});

test("gated submit blocks when eligibility fails and audits", () => {
  let tournament = makeTournament();
  tournament = updateEligibilityRules(tournament, {
    age: { enabled: true, minAge: 30, asOfDate: "2026-07-14" },
  }).tournament;

  const result = gatedSubmitRegistration(
    tournament,
    { eventId: "ev-1", playerIds: ["p1"], name: "Young" },
    {
      players: [{ id: "p1", name: "Young", gender: "male", birthYear: 2010 }],
      clubId: "club-1",
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "ELIGIBILITY_FAILED");
  assert.ok(result.tournament.settings.eligibilityAuditLog?.length >= 1);

  // S1-B submit still works when bypassing gate (engine unchanged)
  const raw = submitRegistration(tournament, {
    eventId: "ev-1",
    playerIds: ["p2"],
    name: "Raw",
  });
  assert.equal(raw.ok, true);
});
