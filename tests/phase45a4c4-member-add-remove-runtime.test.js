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
const MEMBER = "../src/features/club/services/clubMemberService.js";
const TRANSPORT = "../src/features/club/services/clubStorageV2RpcService.js";
const TAB = "../src/pages/clubs/tabs/ClubMembersTab.jsx";
const REQ = "../src/features/club/services/clubMembershipRequestService.js";

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
  const from = fnSrc.indexOf("{", idx);
  let depth = 0;
  for (let i = from; i < fnSrc.length; i += 1) {
    if (fnSrc[i] === "{") depth += 1;
    else if (fnSrc[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return fnSrc.slice(idx, i + 1);
      }
    }
  }
  assert.fail("could not isolate V2 early-return block");
}

test("transport defines rpcV2ClubAddMember / rpcV2ClubRemoveMember with deployed signatures", () => {
  const src = read(TRANSPORT);
  assert.match(src, /export async function rpcV2ClubAddMember/);
  assert.match(src, /export async function rpcV2ClubRemoveMember/);
  assert.match(src, /callRpc\("club_add_member"/);
  assert.match(src, /callRpc\("club_remove_member"/);
  assert.match(src, /p_target_user_id:\s*targetUserId/);
  assert.match(src, /p_expected_version:\s*expectedVersion/);
  assert.match(src, /p_membership_type:/);
});

test("V2 add uses rpcV2ClubAddMember — no blob write in V2 block", () => {
  const src = read(MEMBER);
  const fn = extractFunction(src, "addMemberToClub");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubAddMember/);
  assert.match(block, /resolveTargetUserIdForMemberCommand/);
  assert.match(block, /invalidateAfterMemberCommand/);
  assert.doesNotMatch(block, /saveClubExtension/);
  assert.doesNotMatch(block, /addMemberToClubLegacy/);
});

test("V2 remove uses rpcV2ClubRemoveMember — no blob write in V2 block", () => {
  const src = read(MEMBER);
  const fn = extractFunction(src, "removeMemberFromClub");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubRemoveMember/);
  assert.match(block, /resolveTargetUserIdForMemberCommand/);
  assert.doesNotMatch(block, /saveClubExtension/);
});

test("target resolution prefers auth user_id and rejects unlinked blob playerId", () => {
  const src = read(MEMBER);
  assert.match(src, /export function resolveTargetUserIdForMemberCommand/);
  assert.match(src, /player\?\.authUserId/);
  assert.match(src, /findUserIdByPlayerId/);
  assert.match(src, /UUID_RE/);
  assert.match(src, /Player chưa liên kết tài khoản đăng nhập/);
});

test("error map covers VALIDATION, CONFLICT, ALREADY_MEMBER, GOVERNANCE_BLOCK", () => {
  const cases = [
    ["VALIDATION", API_ERROR_CODES.VALIDATION_ERROR],
    ["CONFLICT", API_ERROR_CODES.CONFLICT],
    ["ALREADY_MEMBER", API_ERROR_CODES.CONFLICT],
    ["NOT_MEMBER", API_ERROR_CODES.NOT_FOUND],
    ["GOVERNANCE_BLOCK", API_ERROR_CODES.FORBIDDEN],
    ["VERSION_CONFLICT", API_ERROR_CODES.CONFLICT],
    ["NOT_AUTHENTICATED", API_ERROR_CODES.UNAUTHORIZED],
    ["RPC_NOT_DEPLOYED", API_ERROR_CODES.INTERNAL_ERROR],
  ];
  for (const [server, api] of cases) {
    const mapped = mapClubCommandError({ ok: false, code: server, error: "x" });
    assert.equal(mapped.code, api);
    assert.ok(isRegisteredApiErrorCode(mapped.code));
  }
});

test("role/status updates blocked under V2", () => {
  const src = read(MEMBER);
  assert.match(src, /export function updateClubMemberRole/);
  assert.match(src, /export function updateClubMemberStatus/);
  assert.match(src, /Đổi vai trò thành viên chưa hỗ trợ trên cloud/);
  assert.match(src, /Đổi trạng thái thành viên chưa hỗ trợ trên cloud/);
});

test("ClubMembersTab enables add/remove under V2 probe; role/status stay off", () => {
  const tab = read(TAB);
  assert.match(tab, /probeClubMemberMutationAccess/);
  assert.match(tab, /addRemoveEnabled/);
  assert.match(tab, /roleStatusEnabled/);
  assert.match(tab, /roleStatusEnabled = canManage && !canonicalMembershipRead/);
  assert.match(tab, /await addMemberToClub/);
  assert.match(tab, /await removeMemberFromClub/);
  assert.match(tab, /isProtectedGovernanceMember/);
  assert.doesNotMatch(tab, /rpcV2ClubAddMember/);
  assert.doesNotMatch(tab, /rpcV2ClubRemoveMember/);
  assert.doesNotMatch(tab, /mutationsEnabled/);
});

test("admin-link V2 uses canonical addMemberToClub with targetUserId", () => {
  const src = read(REQ);
  const fn = extractFunction(src, "adminLinkAccountOnlyAthleteToClub");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /addMemberToClub/);
  assert.match(block, /targetUserId:\s*normalizedUser\.id/);
  assert.doesNotMatch(block, /ensurePlayerInClubBlob/);
});

test("ownership-lock rules for member add/remove commands are registered", () => {
  const ids = RULES.map((r) => r.id);
  for (const id of [
    "member-command-rpc-bypass-in-ui",
    "member-command-rpc-transport-only",
    "member-command-rpcV2-orchestrator-only",
  ]) {
    assert.ok(ids.includes(id), `missing rule ${id}`);
  }
  const violations = collectViolations();
  const memberCommandHits = [...violations.values()].filter((v) =>
    String(v.rule?.id || v.ruleId || "").startsWith("member-command")
  );
  assert.equal(memberCommandHits.length, 0);
});

test("V2-OFF legacy add/remove paths remain after V2 early-return", () => {
  const src = read(MEMBER);
  assert.match(src, /function addMemberToClubLegacy/);
  assert.match(src, /function removeMemberFromClubLegacy/);
  const add = extractFunction(src, "addMemberToClub");
  assert.match(add, /return addMemberToClubLegacy/);
  const rem = extractFunction(src, "removeMemberFromClub");
  assert.match(rem, /return removeMemberFromClubLegacy/);
});

test("RPC failure mapping path present — no local success fallback under V2", () => {
  const src = read(MEMBER);
  for (const name of ["addMemberToClub", "removeMemberFromClub"]) {
    const block = v2EarlyReturnBlock(extractFunction(src, name));
    assert.match(block, /if \(!\w+\.ok\)/);
    assert.match(block, /mapMemberCommandError/);
    assert.doesNotMatch(block, /saveClubExtension/);
  }
});
