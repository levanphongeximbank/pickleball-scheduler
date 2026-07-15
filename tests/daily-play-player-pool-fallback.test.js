import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadLegacyClubPlayersSafe,
  resolveClubPlayerPoolFromAwareResult,
} from "../src/features/club/hooks/useClubPlayerPool.js";

describe("Daily Play club player pool fallback", () => {
  it("keeps successful aware result players", () => {
    const resolved = resolveClubPlayerPoolFromAwareResult(
      {
        ok: true,
        legacyPlayers: [{ id: "p1", name: "A" }],
        warnings: [],
        source: "hybrid",
        mappingSummary: { mappedPlayers: 1 },
      },
      "club-1",
      { loadLegacy: () => [{ id: "blob", name: "Blob" }] }
    );
    assert.equal(resolved.usedLegacyFallback, false);
    assert.equal(resolved.players.length, 1);
    assert.equal(resolved.players[0].id, "p1");
    assert.equal(resolved.source, "hybrid");
  });

  it("falls back to club blob when adapter returns !ok (parity with /players)", () => {
    const resolved = resolveClubPlayerPoolFromAwareResult(
      {
        ok: false,
        code: "DEFAULT_CLUB_NOT_ALLOWED",
        message: "default-club is not allowed as a canonical source club.",
        legacyPlayers: [],
        warnings: [{ code: "DEFAULT_CLUB_EXCLUDED" }],
      },
      "default-club",
      {
        loadLegacy: (clubId) => {
          assert.equal(clubId, "default-club");
          return [
            { id: "p1", name: "One" },
            { id: "p2", name: "Two" },
          ];
        },
      }
    );
    assert.equal(resolved.usedLegacyFallback, true);
    assert.equal(resolved.players.length, 2);
    assert.equal(resolved.source, "legacy_fallback");
    assert.ok(
      resolved.warnings.some((item) => item.code === "DEFAULT_CLUB_NOT_ALLOWED")
    );
  });

  it("preserves empty successful canonical list (no silent blob fill)", () => {
    const resolved = resolveClubPlayerPoolFromAwareResult(
      {
        ok: true,
        legacyPlayers: [],
        warnings: [],
        source: "canonical",
      },
      "club-1",
      { loadLegacy: () => [{ id: "blob", name: "ShouldNotAppear" }] }
    );
    assert.equal(resolved.usedLegacyFallback, false);
    assert.equal(resolved.players.length, 0);
  });

  it("loadLegacyClubPlayersSafe returns [] for empty clubId", () => {
    assert.deepEqual(loadLegacyClubPlayersSafe(""), []);
    assert.deepEqual(loadLegacyClubPlayersSafe(null), []);
  });
});
