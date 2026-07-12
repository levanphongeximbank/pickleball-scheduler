import test from "node:test";
import assert from "node:assert/strict";
import {
  TT1B_COMMAND_RPCS,
} from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import {
  buildProvisionCommandPayload,
  buildRefereeWorkspaceRoute,
  canConfirmLegacyResult,
  canRevokeRefereeLink,
  canSaveLegacyDraft,
  isLegacyScoreBlocked,
  resolveRefereeMatchId,
  summarizeRefereeLinkStatus,
} from "../src/features/team-tournament/engines/teamRefereeV5BridgeEngine.js";
import { canProvisionRefereeLink as canProvisionPermission } from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";

test("TT-5B identity: external_sub_match_id maps to V5 match_id", () => {
  assert.equal(resolveRefereeMatchId("phase23d-sub-1"), "phase23d-sub-1");
  assert.equal(buildRefereeWorkspaceRoute("phase23d-sub-1"), "/referee/match/phase23d-sub-1");
});

test("TT-5B legacy lock: blocked when scoreOps has link block code", () => {
  const ops = {
    canSaveDraft: false,
    canConfirm: false,
    blockCode: "referee_v5_linked_legacy_write_blocked",
  };
  assert.equal(isLegacyScoreBlocked(ops), true);
  assert.equal(canSaveLegacyDraft(ops), false);
  assert.equal(canConfirmLegacyResult(ops), false);
});

test("TT-5B legacy lock: allowed when no link", () => {
  const ops = { canSaveDraft: true, canConfirm: true, blockCode: null };
  assert.equal(canSaveLegacyDraft(ops), true);
  assert.equal(canConfirmLegacyResult(ops), true);
});

test("TT-5B provision payload builder", () => {
  const payload = buildProvisionCommandPayload({
    matchupId: "m1",
    subMatchId: "sm1",
    refereeAssignmentId: "00000000-0000-4000-8000-000000000001",
    subMatchVersion: 2,
  });
  assert.equal(payload.matchupId, "m1");
  assert.equal(payload.subMatchId, "sm1");
  assert.equal(payload.expectedSubMatchVersion, 2);
});

test("TT-5B eligibility UI: assignment required message", () => {
  const summary = summarizeRefereeLinkStatus({
    hasLink: false,
    blockCode: "assignment_required",
  });
  assert.match(summary.label, /phân công/i);
});

test("TT-5B eligibility UI: can provision", () => {
  const summary = summarizeRefereeLinkStatus({
    hasLink: false,
    canProvision: true,
  });
  assert.match(summary.label, /Đủ điều kiện/i);
});

test("TT-5B refereeLinkOps revoke gate", () => {
  assert.equal(canRevokeRefereeLink({ canRevoke: true }), true);
  assert.equal(canRevokeRefereeLink({ canRevoke: false }), false);
});

test("TT-5B permission: only BTC/Director can provision", () => {
  assert.equal(
    canProvisionPermission({ permissions: [PERMISSIONS.TOURNAMENT_UPDATE] }),
    true
  );
  assert.equal(
    canProvisionPermission({ permissions: [PERMISSIONS.TEAM_MATCH_RESULT_MANAGE] }),
    false
  );
});

test("TT-5B RPC registry includes provision + revoke", () => {
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_provision_referee_match"));
  assert.ok(TT1B_COMMAND_RPCS.includes("team_tournament_revoke_referee_link"));
  assert.equal(TT1B_COMMAND_RPCS.length, 9);
});
