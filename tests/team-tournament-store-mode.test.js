import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTeamTournamentStoreMode,
  TEAM_TOURNAMENT_STORE_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepository.js";

test("team tournament cloud requires explicit VITE_TEAM_TOURNAMENT_SUPABASE=true", () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "eyJ-test";
    import.meta.env.VITE_TEAM_TOURNAMENT_SUPABASE = "";
    import.meta.env.VITE_TEAM_TOURNAMENT_STORE_MODE = "";
    import.meta.env.NODE_ENV = "production";
    import.meta.env.VITEST = "";
    assert.equal(resolveTeamTournamentStoreMode(), TEAM_TOURNAMENT_STORE_MODES.LOCAL);

    import.meta.env.VITE_TEAM_TOURNAMENT_SUPABASE = "true";
    assert.equal(resolveTeamTournamentStoreMode(), TEAM_TOURNAMENT_STORE_MODES.SUPABASE);
  }
});
