/**
 * Phase 4D Daily Play interval authority — static package gates.
 * Does not mutate Staging/Production.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg4d = path.join(
  root,
  "docs/v5/migrations/court-resource-phase3b-daily-play-interval-authority-01"
);
const pkg3b = path.join(
  root,
  "docs/v5/migrations/court-resource-phase3b-canonical-reservation-01"
);

const CERTIFIED_3B_HASHES = {
  "01_PRECHECK.sql":
    "528A482CC77EDEA38DC35B9A5323E00B82C4C25894D06B15A27B1E422FE8B13C",
  "02_APPLY.sql":
    "61418ABABBB6B12CF1E956822573154D7588D59C14B9D9603A867C464A87B032",
  "03_VERIFY.sql":
    "7766F80784EE0724626C7D7BF6C4EFF5185D7F1CC59C42F0113DC25400C18934",
  "04_ROLLBACK.sql":
    "43E39245D3698ED21565AE43C2322A64A474122E51730BAABA7B9A5AAC280898",
};

function read(dir, name) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

function sha256File(dir, name) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex").toUpperCase();
}

test("4D package files exist", () => {
  for (const name of [
    "01_PRECHECK.sql",
    "02_APPLY.sql",
    "03_VERIFY.sql",
    "04_ROLLBACK.sql",
    "README.md",
  ]) {
    assert.equal(fs.existsSync(path.join(pkg4d, name)), true, name);
  }
});

test("certified Phase3B SQL files unmodified", () => {
  for (const [name, expected] of Object.entries(CERTIFIED_3B_HASHES)) {
    assert.equal(sha256File(pkg3b, name), expected, name);
  }
});

test("4D APPLY removes arbitrary now()+12h and persists capacity windows", () => {
  const apply = read(pkg4d, "02_APPLY.sql");
  assert.match(apply, /daily_play_court_capacity_windows/);
  assert.match(apply, /court_resource_daily_play_venue_capacity_end/);
  assert.match(apply, /INTERVAL_POLICY|venue_capacity_end|capacity_starts_at/i);
  const acquireStart = apply.indexOf(
    "CREATE OR REPLACE FUNCTION public.court_resource_daily_play_acquire"
  );
  assert.ok(acquireStart >= 0);
  const acquireBody = apply.slice(acquireStart, apply.indexOf("CREATE OR REPLACE FUNCTION public.daily_play_start_match"));
  assert.doesNotMatch(acquireBody, /now\(\)\s*\+\s*interval\s+'12 hours'/);
  assert.match(acquireBody, /daily_play_court_capacity_windows/);
  assert.match(apply, /court_resource_daily_play_extend_capacity_if_needed/);
});

test("4D VERIFY rejects arbitrary horizon and requires cutover false", () => {
  const verify = read(pkg4d, "03_VERIFY.sql");
  assert.match(verify, /now\(\) \+ interval ''12 hours''/);
  assert.match(verify, /SQL cutover must remain false/);
  assert.match(verify, /daily_play_court_capacity_windows/);
});

test("4D ROLLBACK restores pre-4D acquire marker and drops windows", () => {
  const rollback = read(pkg4d, "04_ROLLBACK.sql");
  assert.match(rollback, /now\(\) \+ interval '12 hours'/);
  assert.match(rollback, /DROP TABLE IF EXISTS public\.daily_play_court_capacity_windows/);
  assert.doesNotMatch(rollback, /DROP TABLE.*court_resource_reservations/);
});

test("4D PRECHECK requires Phase3B and cutover false", () => {
  const precheck = read(pkg4d, "01_PRECHECK.sql");
  assert.match(precheck, /court_resource_reservations/);
  assert.match(precheck, /cutover must be false/);
  assert.match(
    precheck,
    /161d3dcc6827cee609fa86e24914abf73937d4362583014f38f06ca648622b34/
  );
  assert.match(
    precheck,
    /973df28374db059755c88c0e9f2df78f1986bbc08c0be907b538a213a4a6b7b4/
  );
});

test("JS cutover default remains false", () => {
  const constants = fs.readFileSync(
    path.join(root, "src/features/court-resource/constants/canonicalReservation.js"),
    "utf8"
  );
  assert.match(constants, /CANONICAL_RESERVATION_CUTOVER_DEFAULT\s*=\s*false/);
});
