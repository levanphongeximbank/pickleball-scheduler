import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSeedStats,
  extractTeamTournamentsFromClubBlob,
  extractTeamTournamentsFromJson,
  isTeamTournamentRecord,
  buildLineupEntries,
  summarizeSeedStats,
} from "../scripts/lib/team-tournament-seed-core.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const probeFixturePath = path.join(rootDir, "tests/fixtures/team-tournament-blob-probe.json");

test("extractTeamTournamentsFromJson reads probe fixture", () => {
  const payload = JSON.parse(fs.readFileSync(probeFixturePath, "utf8"));
  const tournaments = extractTeamTournamentsFromJson(payload);

  assert.equal(tournaments.length, 1);
  assert.equal(tournaments[0].id, "phase23d-probe-tournament");
  assert.equal(tournaments[0].tenantId, "venue-staging-a");
  assert.ok(isTeamTournamentRecord(tournaments[0]));
});

test("extractTeamTournamentsFromClubBlob maps venue_id → tenantId", () => {
  const payload = JSON.parse(fs.readFileSync(probeFixturePath, "utf8"));
  const tournaments = extractTeamTournamentsFromClubBlob({
    club_id: payload.club_id,
    venue_id: payload.venue_id,
    data: payload.data,
  });

  assert.equal(tournaments.length, 1);
  assert.equal(tournaments[0].clubId, "club-staging-demo");
  assert.equal(tournaments[0].tenantId, "venue-staging-a");
  assert.equal(tournaments[0].teamData.teams.length, 2);
  assert.equal(tournaments[0].teamData.matchups.length, 1);
});

test("buildLineupEntries expands selections json", () => {
  const entries = buildLineupEntries(
    {
      "disc-men": ["p1", "p2"],
      "disc-women": ["p3", "p4"],
    },
    "venue-staging-a",
    "phase23d-probe-tournament",
    "lineup-uuid-1"
  );

  assert.equal(entries.length, 4);
  assert.deepEqual(entries[0], {
    tenant_id: "venue-staging-a",
    tournament_id: "phase23d-probe-tournament",
    lineup_id: "lineup-uuid-1",
    discipline_external_id: "disc-men",
    player_id: "p1",
    sort_order: 1,
  });
});

test("summarizeSeedStats prints insert/update/skip buckets", () => {
  const stats = createSeedStats();
  stats.teams.insert = 2;
  stats.lineups.skip = 1;
  const summary = summarizeSeedStats(stats);

  assert.match(summary, /teams: insert=2 update=0 skip=0/);
  assert.match(summary, /lineups: insert=0 update=0 skip=1/);
});
