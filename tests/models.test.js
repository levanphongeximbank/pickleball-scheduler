import test from "node:test";
import assert from "node:assert/strict";

import {
  getCourtDisplayName,
  normalizeCourt,
  normalizeCourts,
  normalizePlayer,
  normalizePlayers,
  getPlayerGenderKey,
} from "../src/models/index.js";

test("normalizeCourt keeps raw name and never uses id as display label", () => {
  const court = normalizeCourt({ id: 1782395609019, active: true });

  assert.equal(court.id, 1782395609019);
  assert.equal(court.name, "");
  assert.equal(getCourtDisplayName(court, 0), "Sân 1");
});

test("normalizeCourts normalizes every court in array", () => {
  const courts = normalizeCourts([
    { id: 1, name: "VIP", number: 9, active: true },
    { id: 2, active: false },
  ]);

  assert.equal(courts.length, 2);
  assert.equal(courts[0].name, "VIP");
  assert.equal(courts[0].number, 9);
  assert.equal(courts[1].active, false);
});

test("normalizePlayer standardizes core player fields and keeps extra data", () => {
  const player = normalizePlayer({
    id: 7,
    name: "  Linh  ",
    gender: "Nữ",
    level: "4.25",
    phone: "0900000000",
    active: false,
  });

  assert.equal(player.name, "Linh");
  assert.equal(player.level, 4.5);
  assert.equal(player.rating, 4.5);
  assert.equal(player.ratingInternal, 4.25);
  assert.equal(player.phone, "0900000000");
  assert.equal(player.active, false);
  assert.equal(player.playerType, "member");
  assert.equal(player.genderKey, "female");
});

test("normalizePlayer maps rating from level when rating is missing", () => {
  const player = normalizePlayer({
    id: 2,
    name: "An",
    gender: "Nam",
    level: 4,
  });

  assert.equal(player.rating, 4);
  assert.equal(player.genderKey, "male");
  assert.equal(player.playerType, "member");
});

test("getPlayerGenderKey supports Vietnamese and English values", () => {
  assert.equal(getPlayerGenderKey("Nam"), "male");
  assert.equal(getPlayerGenderKey("Nữ"), "female");
  assert.equal(getPlayerGenderKey("male"), "male");
  assert.equal(getPlayerGenderKey("other"), "unknown");
  assert.equal(getPlayerGenderKey("khác"), "unknown");
});

test("normalizePlayer keeps extended v3.3 fields", () => {
  const player = normalizePlayer({
    id: 3,
    name: "Bình",
    gender: "Nam",
    level: 3.5,
    playerType: "visitor",
    clubName: "CLB Tam Bình",
    unitName: "Công ty A",
    levelLabel: "Khá",
    note: "Khách mời",
    status: "active",
  });

  assert.equal(player.playerType, "visitor");
  assert.equal(player.clubName, "CLB Tam Bình");
  assert.equal(player.unitName, "Công ty A");
  assert.equal(player.levelLabel, "Khá");
  assert.equal(player.note, "Khách mời");
});

test("normalizePlayers drops entries without id", () => {
  const players = normalizePlayers([
    { id: 1, name: "A", level: 3 },
    { name: "Missing id", level: 3 },
  ]);

  assert.equal(players.length, 1);
  assert.equal(players[0].id, 1);
});

test("normalizeCourt preserves explicit finite priority and omits invalid values", () => {
  assert.equal(normalizeCourt({ id: 1, priority: 10 }).priority, 10);
  assert.equal(normalizeCourt({ id: 2, priority: 1.5 }).priority, 1.5);
  assert.equal(normalizeCourt({ id: 3, priority: -2 }).priority, -2);
  assert.equal(normalizeCourt({ id: 4, priority: 0 }).priority, 0);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 5 }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 6, priority: undefined }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 7, priority: null }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 8, priority: "10" }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 9, priority: Number.NaN }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 10, priority: Infinity }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 11, priority: -Infinity }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 12, priority: {} }), "priority"), false);
  assert.equal(Object.hasOwn(normalizeCourt({ id: 13, priority: [1] }), "priority"), false);
});

test("normalizeCourts preserves valid priority per row without inventing defaults", () => {
  const courts = normalizeCourts([
    { id: "a", name: "A", priority: 3 },
    { id: "b", name: "B" },
    { id: "c", name: "C", priority: "9" },
  ]);

  assert.equal(courts[0].priority, 3);
  assert.equal(Object.hasOwn(courts[1], "priority"), false);
  assert.equal(Object.hasOwn(courts[2], "priority"), false);
});
