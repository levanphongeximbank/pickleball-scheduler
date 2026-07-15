import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../src/features/club/constants/clubMembershipRequestStatuses.js";
import { resolveClubCardCta } from "../src/features/club/ui/clubCardCtaLogic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const readSrc = (rel) => readFileSync(path.join(root, rel), "utf8");

function sliceFn(src, header) {
  const start = src.indexOf(header);
  assert.ok(start > -1, `missing ${header}`);
  const after = src.indexOf("\nexport ", start + header.length);
  return src.slice(start, after === -1 ? undefined : after);
}

// 1. Rejected applicant sees a re-apply CTA.
test("rejected applicant sees re-apply CTA (Gửi lại)", () => {
  const cta = resolveClubCardCta({
    variant: "rejected",
    requestStatus: CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED,
  });
  assert.deepEqual(cta, { showJoin: true, showCancel: false, joinLabel: "Gửi lại" });
});

// Discover surface wires the rejected re-apply CTA to the existing join dialog.
test("Discover panel opens JoinClubDialog for rejected re-apply", () => {
  const src = readSrc("src/pages/player/myClub/MyClubDiscoverPanel.jsx");
  assert.match(src, /variant = "rejected"/);
  assert.match(src, /onJoin=\{\(\) => setJoinClub\(club\)\}/);
  assert.match(src, /<JoinClubDialog/);
});

// 2 + 5. Dialog submits through the existing membership request service — no new command service.
test("JoinClubDialog submits via submitClubMembershipRequest (no new command service)", () => {
  const src = readSrc("src/pages/player/myClub/JoinClubDialog.jsx");
  assert.match(src, /submitClubMembershipRequest\(/);
  assert.doesNotMatch(src, /supabaseClient/);
  assert.doesNotMatch(src, /\.rpc\(/);
});

// 2 + 3 + 4. Service V2 branch calls the V2 command with club_id and never runs the legacy writer.
test("submitClubMembershipRequest routes rejected re-apply through the V2 command", () => {
  const src = readSrc("src/features/club/services/clubMembershipRequestService.js");
  const fn = sliceFn(src, "export async function submitClubMembershipRequest");

  assert.match(fn, /isClubStorageV2Enabled\(\)/);
  assert.match(fn, /rpcV2ClubSubmitMembershipRequest\(\{/);
  assert.match(fn, /clubId: trimmedClubId/);
  assert.match(fn, /provider: "v2-rpc"/);

  // Legacy blob writer, if present, only runs after the V2 early-return.
  const v2Return = fn.indexOf('provider: "v2-rpc"');
  const legacyWrite = fn.indexOf("saveMembershipRequests");
  assert.ok(v2Return > -1);
  assert.ok(legacyWrite === -1 || v2Return < legacyWrite);

  // No profiles.club_id write anywhere in the submit flow.
  assert.doesNotMatch(fn, /\.from\(\s*["']profiles["']/);
  assert.doesNotMatch(fn, /club_id\s*:/);
});

// 3. V2 command payload carries club_id + message; the authenticated user is derived server-side.
test("rpcV2ClubSubmitMembershipRequest posts club_submit_membership_request", () => {
  const src = readSrc("src/features/club/services/clubStorageV2RpcService.js");
  const fn = sliceFn(src, "export async function rpcV2ClubSubmitMembershipRequest");
  assert.match(fn, /callRpc\("club_submit_membership_request"/);
  assert.match(fn, /p_club_id: clubId/);
  assert.match(fn, /p_message: message/);
});
