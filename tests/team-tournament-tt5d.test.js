import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  REFEREE_ACCESS_BLOCK_CODES,
  REFEREE_ASSIGNMENT_STATUS,
  buildCorrectionRequestPayload,
  buildCreateAssignmentPayload,
  buildRefereeWorkspaceRoute,
  buildRevokeAssignmentPayload,
  canRefereeWrite,
  formatExpiryCountdown,
  isAssignmentExpired,
  isAssignmentRevoked,
  mapCorrectionStatusLabel,
  shouldShowCorrectionRequest,
  summarizeRefereeAccessState,
} from "../src/features/team-tournament/engines/teamRefereeV5SafetyEngine.js";

describe("TT-5D referee safety", () => {
  it("summarizes active assignment with write access", () => {
    const state = summarizeRefereeAccessState({
      ok: true,
      canWrite: true,
      readOnly: false,
      assignmentStatus: REFEREE_ASSIGNMENT_STATUS.ACTIVE,
    });
    assert.equal(state.canWrite, true);
    assert.equal(state.denied, false);
    assert.equal(state.severity, "success");
  });

  it("blocks expired assignment writes", () => {
    const state = summarizeRefereeAccessState({
      ok: false,
      canWrite: false,
      blockCode: REFEREE_ACCESS_BLOCK_CODES.ASSIGNMENT_EXPIRED,
      assignmentStatus: REFEREE_ASSIGNMENT_STATUS.EXPIRED,
    });
    assert.equal(state.canWrite, false);
    assert.equal(isAssignmentExpired({ blockCode: REFEREE_ACCESS_BLOCK_CODES.ASSIGNMENT_EXPIRED }), true);
  });

  it("blocks revoked assignment", () => {
    const state = summarizeRefereeAccessState({
      ok: false,
      blockCode: REFEREE_ACCESS_BLOCK_CODES.ASSIGNMENT_REVOKED,
      assignmentStatus: REFEREE_ASSIGNMENT_STATUS.REVOKED,
      revokeReason: "BTC thay trọng tài",
    });
    assert.equal(state.denied, true);
    assert.equal(isAssignmentRevoked(state), true);
    assert.match(state.message, /thu hồi/);
  });

  it("read-only finalized match still allows view", () => {
    const state = summarizeRefereeAccessState({
      ok: true,
      canWrite: false,
      readOnly: true,
      matchFinalized: true,
      blockCode: REFEREE_ACCESS_BLOCK_CODES.MATCH_FINALIZED,
      assignmentStatus: REFEREE_ASSIGNMENT_STATUS.ACTIVE,
    });
    assert.equal(state.denied, false);
    assert.equal(state.readOnly, true);
    assert.equal(canRefereeWrite({ canWrite: false }), false);
  });

  it("cross-tenant denied maps message", () => {
    const state = summarizeRefereeAccessState({
      ok: false,
      blockCode: REFEREE_ACCESS_BLOCK_CODES.CROSS_TENANT,
    });
    assert.equal(state.denied, true);
    assert.match(state.message, /tenant/i);
  });

  it("builds workspace route with tournament query", () => {
    assert.equal(
      buildRefereeWorkspaceRoute("sub-1", "tt-probe"),
      "/referee/match/sub-1?tournamentId=tt-probe"
    );
  });

  it("builds assignment + revoke payloads", () => {
    assert.deepEqual(
      buildCreateAssignmentPayload({
        tournamentId: "t1",
        matchupId: "m1",
        subMatchId: "s1",
        refereeUserId: "u1",
      }).tournamentId,
      "t1"
    );
    assert.equal(
      buildRevokeAssignmentPayload({
        tournamentId: "t1",
        assignmentId: "a1",
        expectedVersion: 2,
        reason: "late",
      }).reason,
      "late"
    );
  });

  it("correction request payload includes request id", () => {
    const payload = buildCorrectionRequestPayload({
      tournamentId: "t1",
      matchId: "m1",
      resultRevisionId: "rev-1",
      proposedScore: { teamA: 11, teamB: 9 },
      proposedWinner: "team-a",
      reason: "wrong score",
      requestId: "req-1",
    });
    assert.equal(payload.requestId, "req-1");
    assert.equal(payload.proposedScore.teamA, 11);
  });

  it("shows correction CTA only when finalized without pending", () => {
    assert.equal(
      shouldShowCorrectionRequest({
        ok: true,
        matchFinalized: true,
        pendingCorrectionCount: 0,
        assignmentStatus: "active",
      }),
      true
    );
    assert.equal(
      shouldShowCorrectionRequest({
        ok: true,
        matchFinalized: true,
        pendingCorrectionCount: 1,
      }),
      false
    );
  });

  it("maps correction status labels", () => {
    assert.equal(mapCorrectionStatusLabel("pending"), "Chờ BTC duyệt");
    assert.equal(mapCorrectionStatusLabel("approved"), "Đã duyệt");
  });

  it("formats expiry countdown", () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    assert.match(formatExpiryCountdown(future) || "", /phút/);
    assert.equal(formatExpiryCountdown(new Date(Date.now() - 1000).toISOString()), "Đã hết hạn");
  });
});
