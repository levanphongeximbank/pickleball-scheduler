import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTeamTournamentDataMode,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentDataMode.js";

function withEnv(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

const cloudEnv = {
  VITE_TEAM_TOURNAMENT_SUPABASE: "true",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "eyJhbGci.test",
};

test("memory + cloud_primary → fail", () => {
  withEnv(
    {
      ...cloudEnv,
      VITE_TEAM_TOURNAMENT_STORE_MODE: "memory",
      VITE_TEAM_TOURNAMENT_DATA_MODE: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    },
    () => {
      assert.throws(
        () => resolveTeamTournamentDataMode({ allowFutureModes: true }),
        /memory.*cloud_primary|mâu thuẫn/i
      );
    }
  );
});

test("memory + shadow → fail", () => {
  withEnv(
    {
      ...cloudEnv,
      VITE_TEAM_TOURNAMENT_STORE_MODE: "memory",
      VITE_TEAM_TOURNAMENT_DATA_MODE: TEAM_TOURNAMENT_DATA_MODES.SHADOW,
    },
    () => {
      assert.throws(
        () => resolveTeamTournamentDataMode({ allowFutureModes: true }),
        /memory.*shadow|mâu thuẫn/i
      );
    }
  );
});

test("local + cloud_primary → fail", () => {
  withEnv(
    {
      ...cloudEnv,
      VITE_TEAM_TOURNAMENT_STORE_MODE: "local",
      VITE_TEAM_TOURNAMENT_DATA_MODE: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
    },
    () => {
      assert.throws(
        () => resolveTeamTournamentDataMode({ allowFutureModes: true }),
        /local.*cloud_primary|mâu thuẫn/i
      );
    }
  );
});

test("legacy + memory → pass", () => {
  withEnv(
    {
      VITE_TEAM_TOURNAMENT_STORE_MODE: "memory",
      VITE_TEAM_TOURNAMENT_DATA_MODE: TEAM_TOURNAMENT_DATA_MODES.LEGACY,
    },
    () => {
      assert.equal(
        resolveTeamTournamentDataMode({ allowFutureModes: true }),
        TEAM_TOURNAMENT_DATA_MODES.LEGACY
      );
    }
  );
});
