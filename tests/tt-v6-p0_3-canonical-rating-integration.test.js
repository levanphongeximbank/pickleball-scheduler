/**
 * TEAM TOURNAMENT V6 — P0.3 canonical Pick_VN rating integration tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  CANONICAL_RATING_SOURCE,
  buildPickVnRatingIndex,
  listSelectPlayersScopeRows,
  projectCanonicalRatingFields,
  resolveCanonicalAthleteRating,
  toLegacySelectPlayersPlayer,
} from "../src/features/pairing-candidates/index.js";
import { listAvailableAthletes } from "../src/features/team-tournament/services/teamTournamentAthletePoolService.js";
import {
  hydrateTeamRoster,
  normalizeRosterRating,
  ROSTER_MISSING_RATING_LABEL,
} from "../src/features/team-tournament/engines/teamRosterHydration.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Inline 8-athlete MLP pool (mirrors staging fixture shape; no fixture module dependency). */
const P0_3_MLP_CORE_ATHLETES = [
  { n: 1, displayName: "TEST-NAM-01", gender: "male", rating: 4.0, playerId: "qa-mlp-test-nam-01" },
  { n: 2, displayName: "TEST-NAM-02", gender: "male", rating: 3.8, playerId: "qa-mlp-test-nam-02" },
  { n: 3, displayName: "TEST-NAM-03", gender: "male", rating: 3.5, playerId: "qa-mlp-test-nam-03" },
  { n: 4, displayName: "TEST-NAM-04", gender: "male", rating: 3.2, playerId: "qa-mlp-test-nam-04" },
  { n: 5, displayName: "TEST-NU-01", gender: "female", rating: 4.0, playerId: "qa-mlp-test-nu-01" },
  { n: 6, displayName: "TEST-NU-02", gender: "female", rating: 3.8, playerId: "qa-mlp-test-nu-02" },
  { n: 7, displayName: "TEST-NU-03", gender: "female", rating: 3.5, playerId: "qa-mlp-test-nu-03" },
  { n: 8, displayName: "TEST-NU-04", gender: "female", rating: 3.2, playerId: "qa-mlp-test-nu-04" },
];

function mlpPickVnRow(n, currentRating) {
  const userId = `a0000000-7e57-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    id: `pvn-qa-mlp-${n}`,
    auth_user_id: userId,
    current_rating: currentRating,
    provisional_rating: currentRating,
    self_declared_rating: currentRating,
    rating_status: "self_declared",
    last_rating_updated_at: `2026-07-16T0${n}:00:00.000Z`,
    updated_at: `2026-07-16T0${n}:00:00.000Z`,
  };
}

function buildMlpDeps() {
  const members = P0_3_MLP_CORE_ATHLETES.map((row) => ({
    id: `mem-${row.n}`,
    user_id: `a0000000-7e57-4000-8000-${String(row.n).padStart(12, "0")}`,
    athlete_id: `a1000000-7e57-4000-8000-${String(row.n).padStart(12, "0")}`,
    status: "active",
    tenant_id: "venue-staging-a",
    club_id: "club-test-mlp-qa",
  }));
  const profiles = P0_3_MLP_CORE_ATHLETES.map((row) => ({
    id: `a0000000-7e57-4000-8000-${String(row.n).padStart(12, "0")}`,
    player_id: row.playerId,
    display_name: row.displayName,
    gender: row.gender,
  }));
  const athletes = P0_3_MLP_CORE_ATHLETES.map((row) => ({
    id: `a1000000-7e57-4000-8000-${String(row.n).padStart(12, "0")}`,
    user_id: `a0000000-7e57-4000-8000-${String(row.n).padStart(12, "0")}`,
    display_name: row.displayName,
    status: "active",
    tenant_id: "venue-staging-a",
  }));
  const ratings = P0_3_MLP_CORE_ATHLETES.map((row) => mlpPickVnRow(row.n, row.rating));

  return {
    listMembers: async () => ({ ok: true, members }),
    fetchProfiles: async () => ({ ok: true, profiles }),
    fetchAthletes: async () => ({ ok: true, athletes }),
    fetchPickVnRatings: async () => ({ ok: true, ratings }),
  };
}

describe("P0.3 canonical rating resolver", () => {
  it("current_rating is selected first", () => {
    const resolved = resolveCanonicalAthleteRating({
      current_rating: 4,
      provisional_rating: 3.5,
      self_declared_rating: 3,
      rating: 2.5,
    });
    assert.equal(resolved.ratingValue, 4);
    assert.equal(resolved.ratingSource, CANONICAL_RATING_SOURCE.PICK_VN_CURRENT);
  });

  it("provisional fallback when current missing", () => {
    const resolved = resolveCanonicalAthleteRating({
      provisional_rating: 3.8,
      self_declared_rating: 3.2,
      rating: 2,
    });
    assert.equal(resolved.ratingValue, 3.8);
    assert.equal(resolved.ratingSource, CANONICAL_RATING_SOURCE.PICK_VN_PROVISIONAL);
  });

  it("self-declared fallback when current and provisional missing", () => {
    const resolved = resolveCanonicalAthleteRating({
      self_declared_rating: 3.5,
      level: 2,
    });
    assert.equal(resolved.ratingValue, 3.5);
    assert.equal(resolved.ratingSource, CANONICAL_RATING_SOURCE.PICK_VN_SELF_DECLARED);
  });

  it("rating 0 is preserved", () => {
    const resolved = resolveCanonicalAthleteRating({ current_rating: 0 });
    assert.equal(resolved.ratingValue, 0);
    assert.equal(resolved.ratingLabel, "0");
    assert.deepEqual(normalizeRosterRating({ currentRating: 0 }), {
      ratingValue: 0,
      ratingLabel: "0",
    });
  });

  it("duplicate/history rows resolved deterministically", () => {
    const index = buildPickVnRatingIndex([
      {
        id: "old",
        auth_user_id: "user-1",
        current_rating: 2,
        last_rating_updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "new",
        auth_user_id: "user-1",
        current_rating: 4,
        last_rating_updated_at: "2026-07-01T00:00:00.000Z",
      },
    ]);
    assert.equal(index.get("user-1")?.current_rating, 4);
  });
});

describe("P0.3 shared repository integration", () => {
  it("listSelectPlayersScopeRows joins pick_vn ratings by auth_user_id", async () => {
    const result = await listSelectPlayersScopeRows("club-test-mlp-qa", buildMlpDeps());
    assert.equal(result.ok, true);
    assert.equal(result.rows.length, 8);
    const nam01 = result.rows.find((r) => r.displayName === "TEST-NAM-01");
    assert.equal(nam01.ratingValue, 4);
    assert.equal(nam01.ratingSource, CANONICAL_RATING_SOURCE.PICK_VN_CURRENT);
  });

  it("no duplicate athletes after join", async () => {
    const result = await listSelectPlayersScopeRows("club-test-mlp-qa", buildMlpDeps());
    const ids = result.rows.map((r) => r.athleteId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("Team Tournament pool exposes ratingValue for all 8 MLP athletes", async () => {
    const pool = await listAvailableAthletes({
      clubId: "club-test-mlp-qa",
      tenantId: "venue-staging-a",
      scopeMode: "club",
      callerName: "tt-v6-p0_3-rating",
      deps: buildMlpDeps(),
    });
    assert.equal(pool.ok, true);
    assert.equal(pool.athletes.length, 8);
    const byName = new Map(pool.athletes.map((a) => [a.name, a]));
    assert.equal(byName.get("TEST-NAM-01")?.ratingValue, 4);
    assert.equal(byName.get("TEST-NAM-02")?.ratingValue, 3.8);
    assert.equal(byName.get("TEST-NAM-03")?.ratingValue, 3.5);
    assert.equal(byName.get("TEST-NAM-04")?.ratingValue, 3.2);
    assert.equal(byName.get("TEST-NU-01")?.ratingValue, 4);
    assert.equal(byName.get("TEST-NU-02")?.ratingValue, 3.8);
    assert.equal(byName.get("TEST-NU-03")?.ratingValue, 3.5);
    assert.equal(byName.get("TEST-NU-04")?.ratingValue, 3.2);
  });

  it("roster hydration shows canonical ratings", () => {
    const poolAthletes = P0_3_MLP_CORE_ATHLETES.map((row) => {
      const id = `a1000000-7e57-4000-8000-${String(row.n).padStart(12, "0")}`;
      return {
        id,
        athleteId: id,
        displayName: row.displayName,
        gender: row.gender,
        ...projectCanonicalRatingFields({ current_rating: row.rating }),
      };
    });
    const team = {
      id: "team-1",
      playerIds: poolAthletes.map((a) => a.id),
    };
    const hydrated = hydrateTeamRoster({
      team,
      athletePool: poolAthletes,
      setupReady: true,
      athletePoolLoading: false,
    });
    assert.equal(hydrated.status, "ready");
    assert.deepEqual(
      hydrated.members.map((m) => m.ratingLabel),
      ["4", "3.8", "3.5", "3.2", "4", "3.8", "3.5", "3.2"]
    );
  });

  it("Portal and Referee use shared pool service (no separate rating query)", () => {
    for (const file of [
      "src/pages/tournament/TeamPortal.jsx",
      "src/pages/tournament/TeamRefereePortal.jsx",
      "src/components/tournament/TeamRosterPanel.jsx",
    ]) {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      assert.match(src, /useTeamTournamentAthletePool|listAvailableAthletes/);
      assert.doesNotMatch(src, /pick_vn_player_ratings/);
      assert.doesNotMatch(src, /fetchPickVnRatings/);
    }
  });

  it("toLegacySelectPlayersPlayer projects canonical rating fields once", () => {
    const player = toLegacySelectPlayersPlayer({
      athleteId: "ath-1",
      pairingIdentityId: "ath-1",
      displayName: "A",
      gender: "male",
      currentRating: 4,
      ratingValue: 4,
      ratingLabel: "4",
      ratingSource: CANONICAL_RATING_SOURCE.PICK_VN_CURRENT,
      athleteStatus: "active",
    });
    assert.equal(player.ratingValue, 4);
    assert.equal(player.ratingSource, CANONICAL_RATING_SOURCE.PICK_VN_CURRENT);
  });

  it("missing all rating sources → Chưa có trình", () => {
    assert.deepEqual(normalizeRosterRating({}), {
      ratingValue: null,
      ratingLabel: ROSTER_MISSING_RATING_LABEL,
    });
  });
});

describe("P0.3 wiring regression", () => {
  it("selectPlayersCandidateAdapter batch-fetches pick_vn ratings", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/pairing-candidates/selectPlayersCandidateAdapter.js"),
      "utf8"
    );
    assert.match(src, /fetchPickVnRatingsForPairingCandidates/);
    assert.match(src, /buildPickVnRatingIndex/);
    assert.match(src, /attachCanonicalRatingToScopeRow/);
  });

  it("hydrator delegates to canonical rating projection", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/team-tournament/engines/teamRosterHydration.js"),
      "utf8"
    );
    assert.match(src, /projectCanonicalRatingFields/);
    assert.doesNotMatch(src, /vprRating,\s*\n\s*athlete\.vpr_rating/);
  });
});
