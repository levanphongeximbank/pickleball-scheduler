import test from "node:test";
import assert from "node:assert/strict";

import { buildSeasonStandingsCsv } from "../src/pages/statistics.season.logic.js";

test("buildSeasonStandingsCsv exports standings with metadata", () => {
  const csv = buildSeasonStandingsCsv(
    [
      {
        playerId: "1",
        name: "An",
        points: 6,
        matches: 2,
        wins: 2,
        losses: 0,
        draws: 0,
        rating: 4.1,
      },
    ],
    {
      seasonName: "Mua 2026",
      leagueName: "Giao luu",
    }
  );

  assert.match(csv, /Mua: Mua 2026/);
  assert.match(csv, /Giai: Giao luu/);
  assert.match(csv, /An/);
  assert.match(csv, /6/);
});
