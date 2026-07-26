/**
 * PUBLIC-CATALOG-01 — Adjacent Club + Venue/Court regression (no behavioral change).
 * Run: node --test tests/public-catalog-01-adjacent-regression.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeClub } from "../src/models/club.js";
import { normalizeCourt, getCourtDisplayName } from "../src/models/court.js";
import {
  listCourts,
  getCourtById,
} from "../src/features/venue-court/services/courtInventoryService.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Adjacent: normalizeClub canonical fields unchanged by public-catalog", () => {
  const club = normalizeClub({
    id: "club-1",
    name: "Test Club",
    note: "private note",
    status: "active",
    description: "desc",
  });
  assert.equal(club.id, "club-1");
  assert.equal(club.name, "Test Club");
  assert.equal(club.note, "private note");
  assert.equal(club.status, "active");
  assert.ok("governance" in club);
});

test("Adjacent: normalizeCourt still includes private rate fields for ops", () => {
  const court = normalizeCourt({
    id: "c1",
    name: "Sân 1",
    number: 1,
    defaultHourlyRate: 100,
    peakHourlyRate: 200,
    note: "ops note",
    courtType: "indoor",
  });
  assert.equal(court.defaultHourlyRate, 100);
  assert.equal(court.peakHourlyRate, 200);
  assert.equal(court.note, "ops note");
  assert.equal(getCourtDisplayName(court), "Sân 1");
});

test("Adjacent: venue-court inventory facade exports remain callable", () => {
  assert.equal(typeof listCourts, "function");
  assert.equal(typeof getCourtById, "function");
  const src = fs.readFileSync(
    path.join(
      ROOT,
      "src/features/venue-court/services/courtInventoryService.js"
    ),
    "utf8"
  );
  assert.match(src, /export function listCourts/);
  assert.doesNotMatch(src, /public-catalog/);
});
