import test from "node:test";
import assert from "node:assert/strict";

import {
  EVENT_TYPE,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  createEventRecord,
  normalizeEvent,
} from "../src/models/tournament/index.js";
import {
  validateEntryForEvent,
  validateOpenRegistrationPlayers,
  suggestEntriesFromPlayers,
} from "../src/tournament/engines/index.js";

const players = [
  { id: 1, name: "Nam A", gender: "Nam", level: 4 },
  { id: 2, name: "Nam B", gender: "Nam", level: 3.5 },
  { id: 3, name: "Nu A", gender: "Nữ", level: 4 },
  { id: 4, name: "Nu B", gender: "Nữ", level: 3.5 },
];

test("EVENT_TYPE_OPTIONS lists all 6 tournament categories", () => {
  assert.equal(EVENT_TYPE_OPTIONS.length, 6);
  assert.deepEqual(
    EVENT_TYPE_OPTIONS.map((option) => option.value),
    [
      EVENT_TYPE.MEN_SINGLE,
      EVENT_TYPE.WOMEN_SINGLE,
      EVENT_TYPE.MEN_DOUBLE,
      EVENT_TYPE.WOMEN_DOUBLE,
      EVENT_TYPE.MIXED_DOUBLE,
      EVENT_TYPE.OPEN_DOUBLE,
    ]
  );
});

test("open double label is Doi tu do", () => {
  assert.equal(EVENT_TYPE_LABELS[EVENT_TYPE.OPEN_DOUBLE], "Đôi tự do");
  assert.equal(EVENT_TYPE_LABELS[EVENT_TYPE.MIXED_DOUBLE], "Đôi nam nữ");
});

test("normalizeEvent accepts open_doubles alias for backward compatibility", () => {
  const event = normalizeEvent({
    id: "e1",
    eventType: "open_doubles",
  });

  assert.equal(event.eventType, EVENT_TYPE.OPEN_DOUBLE);
});

test("legacy mixed_double events remain valid after open_double addition", () => {
  const event = createEventRecord({ eventType: EVENT_TYPE.MIXED_DOUBLE });
  assert.equal(event.eventType, EVENT_TYPE.MIXED_DOUBLE);
});

test("open_double allows male + male pair", () => {
  const result = validateEntryForEvent(
    { id: "e1", name: "Cap nam", playerIds: ["1", "2"] },
    players,
    EVENT_TYPE.OPEN_DOUBLE
  );
  assert.equal(result.ok, true);
});

test("open_double allows female + female pair", () => {
  const result = validateEntryForEvent(
    { id: "e2", name: "Cap nu", playerIds: ["3", "4"] },
    players,
    EVENT_TYPE.OPEN_DOUBLE
  );
  assert.equal(result.ok, true);
});

test("open_double allows male + female pair", () => {
  const result = validateEntryForEvent(
    { id: "e3", name: "Cap hon hop", playerIds: ["1", "3"] },
    players,
    EVENT_TYPE.OPEN_DOUBLE
  );
  assert.equal(result.ok, true);
});

test("open_double rejects team with fewer than 2 players", () => {
  const result = validateEntryForEvent(
    { id: "e4", name: "Thieu nguoi", playerIds: ["1"] },
    players,
    EVENT_TYPE.OPEN_DOUBLE
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /2 VDV/);
});

test("open_double rejects team with more than 2 players", () => {
  const result = validateEntryForEvent(
    { id: "e5", name: "Thua nguoi", playerIds: ["1", "2", "3"] },
    players,
    EVENT_TYPE.OPEN_DOUBLE
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /2 VDV/);
});

test("mixed_double still requires exactly one male and one female", () => {
  const valid = validateEntryForEvent(
    { id: "e6", name: "Cap hop le", playerIds: ["1", "3"] },
    players,
    EVENT_TYPE.MIXED_DOUBLE
  );
  assert.equal(valid.ok, true);

  const invalidSameGender = validateEntryForEvent(
    { id: "e7", name: "Cap nam", playerIds: ["1", "2"] },
    players,
    EVENT_TYPE.MIXED_DOUBLE
  );
  assert.equal(invalidSameGender.ok, false);
  assert.match(invalidSameGender.errors.join(" "), /1 nam \+ 1 nu/);
});

test("validateOpenRegistrationPlayers enforces mixed double pair rule", () => {
  const invalid = validateOpenRegistrationPlayers(
    [players[0], players[1]],
    EVENT_TYPE.MIXED_DOUBLE
  );
  assert.equal(invalid.ok, false);

  const valid = validateOpenRegistrationPlayers(
    [players[0], players[2]],
    EVENT_TYPE.MIXED_DOUBLE
  );
  assert.equal(valid.ok, true);
});

test("validateOpenRegistrationPlayers allows any gender mix for open_double", () => {
  assert.equal(
    validateOpenRegistrationPlayers([players[0], players[1]], EVENT_TYPE.OPEN_DOUBLE).ok,
    true
  );
  assert.equal(
    validateOpenRegistrationPlayers([players[2], players[3]], EVENT_TYPE.OPEN_DOUBLE).ok,
    true
  );
  assert.equal(
    validateOpenRegistrationPlayers([players[0], players[2]], EVENT_TYPE.OPEN_DOUBLE).ok,
    true
  );
});

test("suggestEntriesFromPlayers pairs open_double without gender restriction", () => {
  const entries = suggestEntriesFromPlayers(players.slice(0, 4), EVENT_TYPE.OPEN_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  assert.equal(entries.length, 2);
  entries.forEach((entry) => {
    assert.equal(entry.playerIds.length, 2);
  });
});
