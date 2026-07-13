import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_SCORE_BLOCK_CODES,
  REFEREE_OUTBOX_EVENT_TYPES,
  REFEREE_V5_RESULT_SOURCE,
  buildResyncLinkPayload,
  canResyncRefereeLink,
  isLegacyScoreBlocked,
  mapRefereeV5ResultToSubMatch,
  normalizeRefereeOutboxEventType,
  shouldSkipStaleRevision,
  summarizeRefereeLinkStatus,
} from "../src/features/team-tournament/engines/teamRefereeV5BridgeEngine.js";

describe("TT-5C result propagation", () => {
  const matchup = { teamAId: "team-a", teamBId: "team-b" };

  it("maps V5 finalize revision to TT sub-match summary", () => {
    const mapped = mapRefereeV5ResultToSubMatch({
      revision: {
        id: "rev-1",
        revision: 1,
        status: "confirmed",
        officialScore: { teamA: 11, teamB: 8 },
        winnerId: "team-a",
      },
      matchup,
    });
    assert.equal(mapped.ok, true);
    assert.equal(mapped.source, REFEREE_V5_RESULT_SOURCE);
    assert.equal(mapped.status, "completed");
    assert.equal(mapped.winnerTeamId, "team-a");
    assert.deepEqual(mapped.score, { teamA: 11, teamB: 8, games: [] });
  });

  it("rejects winner outside published lineup teams", () => {
    const mapped = mapRefereeV5ResultToSubMatch({
      revision: { winnerId: "team-x", officialScore: { teamA: 11, teamB: 0 } },
      matchup,
    });
    assert.equal(mapped.ok, false);
    assert.equal(mapped.code, "winner_team_mismatch");
  });

  it("maps reopened revision to waiting sub-match", () => {
    const mapped = mapRefereeV5ResultToSubMatch({
      revision: { status: "void", officialScore: { teamA: 11, teamB: 9 } },
      matchup,
    });
    assert.equal(mapped.reopened, true);
    assert.equal(mapped.status, "waiting");
    assert.equal(mapped.winnerTeamId, null);
  });

  it("normalizes outbox event types", () => {
    assert.equal(
      normalizeRefereeOutboxEventType(REFEREE_OUTBOX_EVENT_TYPES.STANDINGS_RECALC, "confirmed"),
      REFEREE_OUTBOX_EVENT_TYPES.MATCH_FINALIZED
    );
    assert.equal(
      normalizeRefereeOutboxEventType(REFEREE_OUTBOX_EVENT_TYPES.STANDINGS_RECALC, "overridden"),
      REFEREE_OUTBOX_EVENT_TYPES.RESULT_REVISED
    );
    assert.equal(
      normalizeRefereeOutboxEventType(REFEREE_OUTBOX_EVENT_TYPES.STANDINGS_RECALC, "void"),
      REFEREE_OUTBOX_EVENT_TYPES.MATCH_REOPENED
    );
  });

  it("skips stale revision numbers", () => {
    assert.equal(shouldSkipStaleRevision(1, 2), true);
    assert.equal(shouldSkipStaleRevision(2, 2), false);
    assert.equal(shouldSkipStaleRevision(3, 2), false);
  });

  it("legacy lock still blocks linked writes", () => {
    assert.equal(
      isLegacyScoreBlocked({ blockCode: LEGACY_SCORE_BLOCK_CODES[0] }),
      true
    );
  });

  it("resync gate follows server canResync", () => {
    assert.equal(canResyncRefereeLink({ canResync: true }), true);
    assert.equal(canResyncRefereeLink({ canResync: false }), false);
  });

  it("buildResyncLinkPayload includes link version", () => {
    assert.deepEqual(
      buildResyncLinkPayload({ subMatchId: "sub-1", linkVersion: 4 }),
      { subMatchId: "sub-1", reason: "TT-5C BTC resync", expectedLinkVersion: 4 }
    );
  });

  it("summarize status for finalized link", () => {
    const meta = summarizeRefereeLinkStatus({ hasLink: true, status: "finalized" });
    assert.equal(meta.label, "Đã finalized");
  });

  it("summarize status for reprovision_required", () => {
    const meta = summarizeRefereeLinkStatus({ hasLink: true, status: "reprovision_required" });
    assert.equal(meta.label, "Cần reprovision");
  });
});
