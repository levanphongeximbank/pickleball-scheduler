import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  API_ERROR_CODES,
  isRegisteredApiErrorCode,
} from "../src/features/api/constants/apiErrors.js";
import { mapClubCommandError } from "../src/features/club/services/clubCommandErrorMap.js";
import { RULES, collectViolations } from "../scripts/ci/ownership-lock.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, rel), "utf8");
}

function extractFunction(src, name) {
  const start = src.search(new RegExp(`export async function ${name}\\(`));
  assert.ok(start >= 0, `function ${name} not found`);
  const sigClose = src.indexOf(") {", start);
  assert.ok(sigClose > start, `signature close for ${name} not found`);
  const braceStart = sigClose + 2;
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }
  assert.fail(`unclosed function ${name}`);
}

function v2EarlyReturnBlock(fnSrc) {
  const idx = fnSrc.search(/if \(isClubStorageV2Enabled\(\)\)/);
  assert.ok(idx >= 0, "V2 gate missing");
  const after = fnSrc.slice(idx);
  const braceStart = after.indexOf("{");
  let depth = 0;
  for (let i = braceStart; i < after.length; i += 1) {
    const ch = after[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return after.slice(0, i + 1);
      }
    }
  }
  assert.fail("could not isolate V2 early-return block");
}

const ORCHESTRATOR = "../src/features/club/services/clubMembershipRequestService.js";
const TRANSPORT = "../src/features/club/services/clubStorageV2RpcService.js";

test("membership error tokens map to registered API codes only", () => {
  const cases = [
    ["ALREADY_MEMBER", API_ERROR_CODES.CONFLICT],
    ["PENDING_EXISTS", API_ERROR_CODES.CONFLICT],
    ["VERSION_CONFLICT", API_ERROR_CODES.CONFLICT],
    ["INVALID_STATUS", API_ERROR_CODES.VALIDATION_ERROR],
    ["INVALID_DECISION", API_ERROR_CODES.VALIDATION_ERROR],
    ["GOVERNANCE_BLOCK", API_ERROR_CODES.FORBIDDEN],
    ["NOT_MEMBER", API_ERROR_CODES.NOT_FOUND],
    ["NOT_FOUND", API_ERROR_CODES.NOT_FOUND],
    ["FORBIDDEN", API_ERROR_CODES.FORBIDDEN],
    ["NO_SUPABASE", API_ERROR_CODES.V2_DISABLED],
    ["RPC_FAILED", API_ERROR_CODES.INTERNAL_ERROR],
    ["TENANT_MISMATCH", API_ERROR_CODES.TENANT_MISMATCH],
    ["CLUB_REQUIRED", API_ERROR_CODES.CLUB_REQUIRED],
    ["CLUB_OUT_OF_SCOPE", API_ERROR_CODES.CLUB_OUT_OF_SCOPE],
  ];
  for (const [server, expected] of cases) {
    const mapped = mapClubCommandError({ code: server, error: "x" });
    assert.equal(mapped.code, expected, server);
    assert.equal(isRegisteredApiErrorCode(mapped.code), true, server);
  }
});

test("submit V2 uses canonical RPC only — no blob write, no profile write, maps errors", () => {
  const fn = extractFunction(read(ORCHESTRATOR), "submitClubMembershipRequest");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubSubmitMembershipRequest/);
  assert.match(block, /mapMembershipCommandError|mapClubCommandError/);
  assert.match(block, /invalidateAfterMembershipCommand/);
  assert.doesNotMatch(block, /saveMembershipRequests/);
  assert.doesNotMatch(block, /\.from\(\s*["']profiles["']/);
  assert.doesNotMatch(block, /rpcSubmitClubMembershipRequest/);
  assert.doesNotMatch(block, /\baddMemberToClub\s*\(/);
});

test("re-apply shares submitClubMembershipRequest (JoinClubDialog + CTA)", () => {
  const dialog = read("../src/pages/player/myClub/JoinClubDialog.jsx");
  assert.match(dialog, /submitClubMembershipRequest\(/);
  assert.doesNotMatch(dialog, /rpcV2ClubSubmitMembershipRequest/);
  assert.doesNotMatch(dialog, /clubMembershipRequestRpcService/);

  const svc = read(ORCHESTRATOR);
  const fn = extractFunction(svc, "submitClubMembershipRequest");
  assert.match(fn, /rpcV2ClubSubmitMembershipRequest/);
  assert.doesNotMatch(fn, /correction/);
});

test("cancel V2 uses club_cancel_membership_request with expected version — no blob mutation", () => {
  const fn = extractFunction(read(ORCHESTRATOR), "cancelClubMembershipRequest");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubCancelMembershipRequest/);
  assert.match(block, /expectedVersion/);
  assert.match(block, /mapMembershipCommandError|mapClubCommandError/);
  assert.doesNotMatch(block, /saveMembershipRequests/);
});

test("approve V2 uses review RPC — no addMemberToClub, no profiles.club_id, no Phase31", () => {
  const fn = extractFunction(read(ORCHESTRATOR), "approveClubMembershipRequest");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubReviewMembershipRequest/);
  assert.match(block, /decision:\s*"approved"/);
  assert.match(block, /invalidateAfterMembershipCommand/);
  assert.doesNotMatch(block, /\baddMemberToClub\s*\(/);
  assert.doesNotMatch(block, /linkAthleteProfile/);
  assert.doesNotMatch(block, /saveMembershipRequests/);
  assert.doesNotMatch(block, /rpcReviewClubMembershipRequest/);
  assert.doesNotMatch(block, /ensurePlayerInClubBlob/);
});

test("reject V2 uses review RPC — no blob mutation under V2", () => {
  const fn = extractFunction(read(ORCHESTRATOR), "rejectClubMembershipRequest");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubReviewMembershipRequest/);
  assert.match(block, /decision:\s*"rejected"/);
  assert.match(block, /invalidateAfterMembershipCommand/);
  assert.doesNotMatch(block, /saveMembershipRequests/);
  assert.doesNotMatch(block, /addMemberToClub/);
});

test("leave V2 uses club_leave_membership — no blob roster, no Phase31 leave", () => {
  const fn = extractFunction(read(ORCHESTRATOR), "leaveMyClub");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubLeaveMembership/);
  assert.match(block, /skipLegacyRpc:\s*true/);
  assert.match(block, /invalidateAfterMembershipCommand/);
  assert.doesNotMatch(block, /removeMemberFromClub/);
  assert.doesNotMatch(block, /rpcLeaveMyClub/);
  assert.doesNotMatch(block, /saveMembershipRequests/);
});

test("RPC failure never falls through to local success under V2", () => {
  for (const name of [
    "submitClubMembershipRequest",
    "cancelClubMembershipRequest",
    "approveClubMembershipRequest",
    "rejectClubMembershipRequest",
    "leaveMyClub",
  ]) {
    const block = v2EarlyReturnBlock(extractFunction(read(ORCHESTRATOR), name));
    assert.match(block, /if\s*\(!\w+\.ok\)/);
    assert.match(block, /return mapMembershipCommandError|return mapClubCommandError|return \{[\s\S]*ok:\s*false/);
    // Success path must not call blob writers inside V2 block.
    assert.doesNotMatch(block, /saveMembershipRequests/);
    assert.doesNotMatch(block, /\baddMemberToClub\s*\(/);
    assert.doesNotMatch(block, /\bremoveMemberFromClub\s*\(/);
  }
});

test("Phase31 path unreachable under V2 approve/leave/submit", () => {
  const src = read(ORCHESTRATOR);
  const approve = v2EarlyReturnBlock(extractFunction(src, "approveClubMembershipRequest"));
  const leave = v2EarlyReturnBlock(extractFunction(src, "leaveMyClub"));
  const submit = v2EarlyReturnBlock(extractFunction(src, "submitClubMembershipRequest"));
  assert.doesNotMatch(approve, /rpcReviewClubMembershipRequest/);
  assert.doesNotMatch(leave, /rpcLeaveMyClub/);
  assert.doesNotMatch(submit, /rpcSubmitClubMembershipRequest/);

  // linkAthleteProfile itself short-circuits Phase31 when V2 is on
  assert.match(src, /Phase 45A\.4B — legacy profile-link RPC is V2-OFF only/);
  assert.match(src, /if \(isClubStorageV2Enabled\(\)\) \{\s*return \{ ok: true, playerId, clubId \};/);
});

test("V2 OFF / blob paths remain after V2 early-return", () => {
  const src = read(ORCHESTRATOR);
  for (const name of [
    "submitClubMembershipRequest",
    "cancelClubMembershipRequest",
    "approveClubMembershipRequest",
    "rejectClubMembershipRequest",
  ]) {
    const fn = extractFunction(src, name);
    const block = v2EarlyReturnBlock(fn);
    assert.ok(fn.indexOf("saveMembershipRequests") > block.length || fn.includes("saveMembershipRequests"));
    // Blob writer only outside V2 block: appear after V2 block end.
    const v2End = fn.indexOf(block) + block.length;
    assert.ok(fn.indexOf("saveMembershipRequests", v2End) > -1 || name === "leaveMyClub");
  }
  const leave = extractFunction(src, "leaveMyClub");
  const leaveBlock = v2EarlyReturnBlock(leave);
  assert.ok(leave.indexOf("removeMemberFromClub") > leave.indexOf(leaveBlock));
});

test("transport wrappers keep exact Membership RPC names", () => {
  const src = read(TRANSPORT);
  assert.match(src, /callRpc\("club_submit_membership_request"/);
  assert.match(src, /callRpc\("club_cancel_membership_request"/);
  assert.match(src, /callRpc\("club_review_membership_request"/);
  assert.match(src, /callRpc\("club_leave_membership"/);
  assert.match(src, /callRpc\("club_list_my_requests"/);
  assert.match(src, /callRpc\("club_list_pending_requests"/);
});

test("UI Discover/Guard go through orchestrator — no direct membership RPC", () => {
  const discover = read("../src/pages/player/myClub/MyClubDiscoverPanel.jsx");
  assert.match(discover, /listMyMembershipRequestsCanonical/);
  assert.doesNotMatch(discover, /rpcV2ClubListMyRequests/);
  assert.doesNotMatch(discover, /rpcV2ClubSubmitMembershipRequest/);

  const guard = read("../src/pages/player/guards/ClubMembershipRequestsGuard.jsx");
  assert.match(guard, /probeMembershipReviewAccess/);
  assert.doesNotMatch(guard, /rpcV2ClubListPendingRequests/);
  assert.doesNotMatch(guard, /clubStorageV2RpcService/);
});

test("ownership locks cover Membership request command surfaces with zero violations", () => {
  const ids = RULES.map((r) => r.id);
  for (const id of [
    "membership-request-command-rpc-bypass-in-ui",
    "membership-request-rpc-transport-only",
    "membership-request-rpcV2-orchestrator-only",
    "membership-request-phase31-ui-ban",
    "membership-request-blob-write-in-ui",
    "membership-request-repository-readonly",
  ]) {
    assert.ok(ids.includes(id), `missing rule ${id}`);
  }

  const violations = collectViolations();
  const membershipKeys = [...violations.keys()].filter((k) =>
    k.startsWith("membership-request")
  );
  assert.deepEqual(
    membershipKeys,
    [],
    `unexpected membership-request ownership violations: ${membershipKeys.join(", ")}`
  );
});

test("canonicalMembershipRepository stays command-free", () => {
  const src = read("../src/features/club/repositories/canonicalMembershipRepository.js");
  assert.doesNotMatch(src, /rpcV2ClubSubmitMembershipRequest/);
  assert.doesNotMatch(src, /rpcV2ClubReviewMembershipRequest/);
  assert.doesNotMatch(src, /addMemberToClub/);
  assert.doesNotMatch(src, /saveMembershipRequests/);
});
