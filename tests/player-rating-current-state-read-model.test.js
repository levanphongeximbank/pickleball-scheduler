import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as foundation from "../src/features/player-rating/foundation/index.js";
import {
  PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE,
  PLAYER_RATING_SOURCE_TYPE,
  PLAYER_RATING_SOURCE_SCALE,
  PLAYER_ID_RESOLUTION_STATUS,
  PLAYER_RATING_READ_MODEL_ERROR_CODE,
  PlayerRatingFoundationError,
  normalizeV2Rating,
  normalizeV5Rating,
  normalizeLegacyRating,
  collectRatingCandidates,
  createCurrentStateCandidate,
} from "../src/features/player-rating/foundation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const READ_MODEL_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation/read-model"
);
const FOUNDATION_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation"
);

const FIXED_AT = "2026-07-23T08:00:00.000Z";
const SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-1" });

function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

function readAllJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

test("foundation public exports include Phase 1C read-model API", () => {
  const required = [
    "PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE",
    "PLAYER_RATING_SOURCE_TYPE",
    "PLAYER_RATING_SOURCE_SCALE",
    "PLAYER_ID_RESOLUTION_STATUS",
    "PLAYER_RATING_READ_MODEL_ERROR_CODE",
    "normalizeV2Rating",
    "normalizeV5Rating",
    "normalizeLegacyRating",
    "collectRatingCandidates",
    "createCurrentStateCandidate",
  ];
  for (const name of required) {
    assert.ok(name in foundation, `missing export: ${name}`);
  }
  assert.equal(PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE.id, "1C");
  assert.equal(
    PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE.wiredToProductionRuntime,
    false
  );
  assert.equal(
    PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE.selectsRuntimeSsot,
    false
  );
  assert.equal(PLAYER_RATING_CURRENT_STATE_READ_MODEL_PHASE.convertsScales, false);
});

test("V2 normalization preserves 1.0–8.0 scale and alias auth_user_id", () => {
  const candidate = normalizeV2Rating(
    {
      id: "v2-1",
      auth_user_id: "auth-abc",
      self_declared_rating: 4.5,
      provisional_rating: 4.0,
      verified_rating: 5.0,
      current_rating: 5.0,
      rating_status: "provisional",
      rating_confidence: 0.42,
      last_rating_updated_at: FIXED_AT,
      rating_history: [{ at: FIXED_AT, from: 4.0, to: 4.5 }],
    },
    { scope: SCOPE }
  );

  assert.equal(candidate.sourceType, PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2);
  assert.equal(
    candidate.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0
  );
  assert.equal(candidate.selfAssessedRating, 4.5);
  assert.equal(candidate.provisionalRating, 4.0);
  assert.equal(candidate.verifiedRating, 5.0);
  assert.equal(candidate.displayRating, 5.0);
  assert.equal(candidate.confidence, 0.42);
  assert.equal(candidate.playerId, null);
  assert.equal(
    candidate.playerIdResolutionStatus,
    PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY
  );
  assert.ok(candidate.aliases.some((a) => a.kind === "auth_user_id" && a.value === "auth-abc"));
  assert.ok(candidate.warnings.includes("NO_SCALE_CONVERSION_APPLIED"));
  assert.ok(candidate.warnings.includes("AUTH_USER_ID_IS_ALIAS_ONLY"));
  assert.equal(candidate.authoritativeForPublicPlayerRating, false);
  assert.equal(candidate.effectiveAt, FIXED_AT);
});

test("V2 does not convert values toward V5 band and accepts explicit canonical id", () => {
  const candidate = normalizeV2Rating(
    {
      id: "v2-2",
      auth_user_id: "auth-xyz",
      current_rating: 7.5,
      rating_status: "self_declared",
    },
    { canonicalPlayerId: "player-canonical-1", scope: SCOPE }
  );
  assert.equal(candidate.displayRating, 7.5);
  assert.notEqual(
    candidate.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0
  );
  assert.equal(candidate.playerId, "player-canonical-1");
  assert.equal(
    candidate.playerIdResolutionStatus,
    PLAYER_ID_RESOLUTION_STATUS.RESOLVED
  );
});

test("V5 normalization preserves 1.5–6.0 and treats profiles.id as alias", () => {
  const candidate = normalizeV5Rating(
    {
      id: "v5-1",
      tenant_id: "tenant-1",
      player_id: "11111111-1111-1111-1111-111111111111",
      rating_mode: "doubles",
      provisional_rating: 3.25,
      open_rating_mean: 3.4,
      verified_rating_mean: 3.6,
      display_rating: 3.6,
      reliability_score: 55,
      rating_status: "provisional",
      last_rated_at: FIXED_AT,
      engine_version: "pick-vn-rating-v5",
      open_rating_deviation: 0.8,
    },
    { scope: SCOPE }
  );

  assert.equal(candidate.sourceType, PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5);
  assert.equal(
    candidate.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0
  );
  assert.equal(candidate.provisionalRating, 3.25);
  assert.equal(candidate.calculatedRating, 3.4);
  assert.equal(candidate.verifiedRating, 3.6);
  assert.equal(candidate.displayRating, 3.6);
  assert.equal(candidate.confidence, 55);
  assert.equal(candidate.ratingMode, "doubles");
  assert.equal(candidate.playerId, null);
  assert.equal(
    candidate.playerIdResolutionStatus,
    PLAYER_ID_RESOLUTION_STATUS.ALIAS_ONLY
  );
  assert.ok(
    candidate.aliases.some(
      (a) =>
        a.kind === "profiles.id" &&
        a.value === "11111111-1111-1111-1111-111111111111"
    )
  );
  assert.ok(
    candidate.warnings.includes(
      "PROFILES_ID_IS_ALIAS_OR_UNRESOLVED_UNLESS_CANONICAL_SUPPLIED"
    )
  );
  assert.ok(candidate.warnings.includes("V5_TABLE_NOT_DECLARED_RUNTIME_SSOT"));
});

test("V5 accepts explicit canonical playerId without inventing one from profiles.id", () => {
  const candidate = normalizeV5Rating(
    {
      id: "v5-2",
      player_id: "22222222-2222-2222-2222-222222222222",
      rating_mode: "singles",
      provisional_rating: 2.1,
      rating_status: "self_assessed",
    },
    { canonicalPlayerId: "pm-player-9", tenantId: "tenant-1" }
  );
  assert.equal(candidate.playerId, "pm-player-9");
  assert.notEqual(candidate.playerId, "22222222-2222-2222-2222-222222222222");
  assert.equal(
    candidate.playerIdResolutionStatus,
    PLAYER_ID_RESOLUTION_STATUS.RESOLVED
  );
});

test("legacy normalization marks non-authoritative and unknown scale", () => {
  const candidate = normalizeLegacyRating(
    {
      id: "legacy-1",
      skillLevel: 3.5,
      level: 3.5,
      rating: 3.5,
      assessment_result: 3.7,
      club_player_id: "club-p-1",
    },
    { sourceType: PLAYER_RATING_SOURCE_TYPE.LEGACY_PLAYER_FIELD, scope: SCOPE }
  );

  assert.equal(
    candidate.sourceType,
    PLAYER_RATING_SOURCE_TYPE.LEGACY_PLAYER_FIELD
  );
  assert.equal(candidate.sourceScale, PLAYER_RATING_SOURCE_SCALE.UNKNOWN);
  assert.ok(candidate.warnings.includes("UNKNOWN_LEGACY_SOURCE_SCALE"));
  assert.ok(candidate.warnings.includes("LEGACY_NON_AUTHORITATIVE"));
  assert.equal(candidate.authoritativeForPublicPlayerRating, false);
  assert.equal(candidate.displayRating, 3.7);
});

test("candidate output is immutable and deterministic", () => {
  const input = {
    id: "v2-det",
    auth_user_id: "auth-det",
    current_rating: 3.0,
    rating_status: "self_declared",
    last_rating_updated_at: FIXED_AT,
  };
  const a = normalizeV2Rating(input, { scope: SCOPE });
  const b = normalizeV2Rating(input, { scope: SCOPE });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.aliases));
  assert.ok(Object.isFrozen(a.warnings));
  assert.ok(Object.isFrozen(a.rawSourceMetadata));
  assert.throws(() => {
    /** @type {any} */ (a).displayRating = 9;
  });
});

test("multiple candidates preserved with no winner selection", () => {
  const result = collectRatingCandidates({
    scope: SCOPE,
    sources: [
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
        record: {
          id: "v2-m1",
          auth_user_id: "auth-1",
          current_rating: 4.0,
          rating_status: "provisional",
        },
        canonicalPlayerId: "player-same",
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
        record: {
          id: "v5-m1",
          player_id: "33333333-3333-3333-3333-333333333333",
          rating_mode: "doubles",
          provisional_rating: 3.2,
          display_rating: 3.2,
          rating_status: "provisional",
          reliability_score: 10,
        },
        canonicalPlayerId: "player-same",
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.LEGACY_ASSESSMENT,
        record: { id: "leg-m1", skillLevel: 3.0 },
        canonicalPlayerId: "player-same",
      },
    ],
  });

  assert.equal(result.candidates.length, 3);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.candidates));
  assert.ok(result.scaleConflicts.length >= 1);
  assert.ok(
    result.warnings.includes("MULTIPLE_SOURCE_SCALES_PRESENT_NO_CONVERSION")
  );
  // No selectedWinner / authoritative pick fields.
  assert.equal(/** @type {any} */ (result).selectedWinner, undefined);
  assert.equal(/** @type {any} */ (result).authoritativeCandidate, undefined);
  assert.ok(
    result.candidates.every((c) => c.authoritativeForPublicPlayerRating === false)
  );
});

test("identity conflict fails closed when distinct canonical playerIds appear", () => {
  expectCode(
    () =>
      collectRatingCandidates({
        scope: SCOPE,
        sources: [
          {
            sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
            record: { id: "v2-a", current_rating: 3.0, rating_status: "unrated" },
            canonicalPlayerId: "player-a",
          },
          {
            sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
            record: {
              id: "v5-b",
              player_id: "44444444-4444-4444-4444-444444444444",
              rating_mode: "singles",
              provisional_rating: 2.5,
              rating_status: "self_assessed",
            },
            canonicalPlayerId: "player-b",
          },
        ],
      }),
    PLAYER_RATING_READ_MODEL_ERROR_CODE.CANONICAL_PLAYER_ID_CONFLICT
  );
});

test("scale conflict detection without conversion", () => {
  const result = collectRatingCandidates({
    scope: SCOPE,
    sources: [
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
        record: { id: "v2-s", current_rating: 6.5, rating_status: "provisional" },
        canonicalPlayerId: "player-s",
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
        record: {
          id: "v5-s",
          player_id: "55555555-5555-5555-5555-555555555555",
          rating_mode: "doubles",
          display_rating: 4.0,
          rating_status: "provisional",
        },
        canonicalPlayerId: "player-s",
      },
    ],
  });
  assert.equal(result.candidates.length, 2);
  assert.equal(result.scaleConflicts.length, 1);
  const scales = result.candidates.map((c) => c.sourceScale).sort();
  assert.deepEqual(scales, [
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0,
  ]);
});

test("unsupported and non-authoritative sources are rejected", () => {
  const result = collectRatingCandidates({
    scope: SCOPE,
    sources: [
      {
        sourceType: "NOT_A_REAL_SOURCE",
        record: { id: "x" },
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.COMPETITION_ELO_SIGNAL,
        record: { id: "elo-1", elo: 1500 },
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.CLUB_RATING_MIRROR,
        record: { id: "club-1", elo: 1500 },
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.UNKNOWN,
        record: { id: "u1" },
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
        record: {
          id: "v2-ok",
          current_rating: 2.0,
          rating_status: "unrated",
        },
        canonicalPlayerId: "player-ok",
      },
    ],
  });

  assert.equal(result.candidates.length, 1);
  assert.ok(result.rejected.length >= 4);
  assert.ok(
    result.rejected.some((r) => r.reason === "UNSUPPORTED_SOURCE_TYPE")
  );
  assert.ok(
    result.rejected.some(
      (r) => r.reason === "NON_AUTHORITATIVE_SIGNAL_NOT_PUBLIC_PLAYER_RATING"
    )
  );
});

test("missing sourceType fails closed", () => {
  expectCode(
    () =>
      collectRatingCandidates({
        scope: SCOPE,
        sources: [{ record: { id: "missing-type" } }],
      }),
    PLAYER_RATING_READ_MODEL_ERROR_CODE.UNSUPPORTED_SOURCE_TYPE
  );
});

test("treatAliasAsCanonical fails closed", () => {
  expectCode(
    () =>
      normalizeV2Rating(
        { id: "v2-bad", auth_user_id: "auth-1", current_rating: 3 },
        { treatAliasAsCanonical: true, scope: SCOPE }
      ),
    PLAYER_RATING_READ_MODEL_ERROR_CODE.ALIAS_TREATED_AS_CANONICAL
  );
  expectCode(
    () =>
      normalizeV5Rating(
        {
          id: "v5-bad",
          player_id: "66666666-6666-6666-6666-666666666666",
          rating_mode: "doubles",
        },
        { treatAliasAsCanonical: true, scope: SCOPE }
      ),
    PLAYER_RATING_READ_MODEL_ERROR_CODE.ALIAS_TREATED_AS_CANONICAL
  );
});

test("malformed scope fails closed", () => {
  expectCode(
    () =>
      normalizeV2Rating(
        { id: "v2-scope", current_rating: 3, rating_status: "unrated" },
        { scope: { kind: "ambiguous" } }
      ),
    foundation.PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED
  );
});

test("invalid individual records may be rejected without aborting collection", () => {
  const result = collectRatingCandidates({
    scope: SCOPE,
    sources: [
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
        record: { current_rating: 3 },
        canonicalPlayerId: "player-x",
      },
      {
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
        record: {
          id: "v2-good",
          current_rating: 3.5,
          rating_status: "self_declared",
        },
        canonicalPlayerId: "player-x",
      },
    ],
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, "NORMALIZATION_FAILED");
});

test("no random or wall-clock dependent output", () => {
  const before = Date.now();
  const c1 = normalizeLegacyRating(
    { id: "leg-time", skillLevel: 2.5 },
    { scope: SCOPE }
  );
  const c2 = normalizeLegacyRating(
    { id: "leg-time", skillLevel: 2.5 },
    { scope: SCOPE }
  );
  const after = Date.now();
  assert.deepEqual(c1, c2);
  assert.equal(c1.effectiveAt, null);
  assert.ok(!String(c1.candidateId).includes(String(before)));
  assert.ok(!String(c1.candidateId).includes(String(after)));
});

test("createCurrentStateCandidate rejects inventing resolved id without playerId", () => {
  expectCode(
    () =>
      createCurrentStateCandidate({
        sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
        sourceRecordId: "r1",
        sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
        ratingMode: "overall",
        playerIdResolutionStatus: PLAYER_ID_RESOLUTION_STATUS.RESOLVED,
      }),
    PLAYER_RATING_READ_MODEL_ERROR_CODE.INVALID_SOURCE_RECORD
  );
});

test("read-model has no Competition Engine, Ranking, Club runtime, or Supabase imports", () => {
  const files = readAllJsFiles(READ_MODEL_ROOT);
  assert.ok(files.length > 0);
  const forbidden = [
    "competition-core",
    "vpr-ranking",
    "features/club/",
    "@supabase",
    "supabase/",
    "pick-vn-rating-v5",
    "pick-vn-rating/",
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.ok(
        !text.includes(needle),
        `${path.relative(FOUNDATION_ROOT, file)} contains forbidden import marker: ${needle}`
      );
    }
  }
});

test("ordering is deterministic across shuffled inputs", () => {
  const sourcesAsc = [
    {
      sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V5,
      record: {
        id: "z-v5",
        player_id: "77777777-7777-7777-7777-777777777777",
        rating_mode: "singles",
        provisional_rating: 2.0,
        rating_status: "self_assessed",
      },
      canonicalPlayerId: "player-ord",
    },
    {
      sourceType: PLAYER_RATING_SOURCE_TYPE.PICK_VN_V2,
      record: {
        id: "a-v2",
        current_rating: 3.0,
        rating_status: "self_declared",
      },
      canonicalPlayerId: "player-ord",
    },
  ];
  const sourcesDesc = [...sourcesAsc].reverse();
  const a = collectRatingCandidates({ scope: SCOPE, sources: sourcesAsc });
  const b = collectRatingCandidates({ scope: SCOPE, sources: sourcesDesc });
  assert.deepEqual(
    a.candidates.map((c) => c.candidateId),
    b.candidates.map((c) => c.candidateId)
  );
});
