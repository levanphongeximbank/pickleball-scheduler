/**
 * Batch 2E-R1 — Players readiness architecture lock.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "src/pages/Players.jsx"), "utf8");

const gateName = (src.match(/import (\w+) from "\.\.\/components\/shell\/[^"]+"/) || [])[1];
const childFn = (src.match(/function (Players\w+)\(\{ platformMode \}\)/) || [])[1];
const resolveFn = (src.match(/function (resolve\w+)\(clubId\)/) || [])[1];
const testId = (src.match(/data-testid="([^"]+)"/) || [])[1];
const checkedInName = (src.match(/\b(getToday\w+)\(explicitClubId\)/) || [])[1];

test("Players splits club-dependent content behind readiness gate child", () => {
  assert.ok(gateName, "gate import present");
  assert.ok(childFn, "child content component present");
  assert.ok(resolveFn, "explicit clubId resolver present");
  assert.ok(testId, "ready content test id present");
  assert.match(src, new RegExp(gateName));
  assert.match(src, new RegExp(childFn));
  assert.match(src, /requireClub=\{!platformMode\}/);
  assert.match(src, new RegExp(`data-testid="${testId}"`));
  assert.match(src, new RegExp("function " + childFn));
  assert.match(src, new RegExp(resolveFn));
  assert.match(src, /explicitClubId/);
});

test("Players never invokes club-scoped helpers without explicit clubId", () => {
  assert.ok(checkedInName, "checked-in helper call found");
  assert.doesNotMatch(src, new RegExp(`${checkedInName}\\(activeClubId\\)`));
  assert.doesNotMatch(src, /loadPlayersFromStorage\(\s*\)/);
  assert.doesNotMatch(src, /normalizePlayers\(loadPlayersFromStorage\(\)\)/);
  assert.match(src, new RegExp(`${checkedInName}\\(explicitClubId\\)`));
  assert.match(src, /if \(!explicitClubId\)/);
  assert.match(src, /useState\(\(\) => \[\]\)/);
});

test("Players keeps Wave 2E Auth patterns — no Tournament header/empty leak", () => {
  assert.match(
    src,
    /AuthPageHeader|AuthConfirmDialog|AuthEmptyState|AuthFilterBar|AuthLoadingState/
  );
  assert.match(src, /from "\.\.\/features\/web-app-ui\/index\.js"/);
  assert.doesNotMatch(src, /TournamentPageHeader/);
  assert.doesNotMatch(src, /TournamentEmptyState/);
  assert.doesNotMatch(src, /TOURNAMENT_LAYOUT/);
});

test("No fake club fallback / no new club context system", () => {
  assert.doesNotMatch(src, /visibleClubs\[0\]/);
  assert.doesNotMatch(src, /clubs\[0\]\.id/);
  assert.doesNotMatch(src, /fakeClub|FALLBACK_CLUB|defaultClubId/);
  assert.doesNotMatch(src, /catch\s*\([^)]*CLUB_REQUIRED/);
});
