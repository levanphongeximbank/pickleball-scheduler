import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { API_ERROR_CODES } from "../src/features/api/constants/apiErrors.js";
import {
  assertLegacyMembershipRosterWriteAllowed,
  isClubMembershipCloudAuthoritative,
} from "../src/features/club/services/clubLegacyWriteGuard.js";
import { RULES, collectViolations } from "../scripts/ci/ownership-lock.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMBER = "../src/features/club/services/clubMemberService.js";
const REQ = "../src/features/club/services/clubMembershipRequestService.js";
const GOV = "../src/features/club/services/clubGovernanceService.js";
const TAB = "../src/pages/clubs/tabs/ClubMembersTab.jsx";
const GUARD = "../src/features/club/services/clubLegacyWriteGuard.js";

function read(rel) {
  return readFileSync(join(__dirname, rel), "utf8");
}

function extractFunction(src, name) {
  const exportAsync = src.search(new RegExp(`export async function ${name}\\(`));
  const plain = src.search(new RegExp(`(?:async )?function ${name}\\(`));
  const start = exportAsync >= 0 ? exportAsync : plain;
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

test("legacy membership roster gate blocks under V2 flag", () => {
  const prevFlag = process.env.VITE_CLUB_STORAGE_V2;
  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_CLUB_STORAGE_V2 = "true";
  process.env.VITE_SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIn0.unit";
  try {
    assert.equal(isClubMembershipCloudAuthoritative(), true);
    const blocked = assertLegacyMembershipRosterWriteAllowed({
      operation: "test-blob-write",
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, API_ERROR_CODES.FEATURE_DISABLED);
  } finally {
    if (prevFlag === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
    else process.env.VITE_CLUB_STORAGE_V2 = prevFlag;
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevKey;
  }
});

test("legacy membership roster gate allows V2-OFF", () => {
  const prev = process.env.VITE_CLUB_STORAGE_V2;
  process.env.VITE_CLUB_STORAGE_V2 = "false";
  try {
    assert.equal(isClubMembershipCloudAuthoritative(), false);
    const allowed = assertLegacyMembershipRosterWriteAllowed({
      operation: "test-blob-write",
    });
    assert.equal(allowed.ok, true);
  } finally {
    if (prev === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
    else process.env.VITE_CLUB_STORAGE_V2 = prev;
  }
});

test("legacy membership roster gate allows no-Supabase even if flag true", () => {
  const prevFlag = process.env.VITE_CLUB_STORAGE_V2;
  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_CLUB_STORAGE_V2 = "true";
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  try {
    assert.equal(isClubMembershipCloudAuthoritative(), false);
    const allowed = assertLegacyMembershipRosterWriteAllowed({
      operation: "offline-blob-write",
    });
    assert.equal(allowed.ok, true);
  } finally {
    if (prevFlag === undefined) delete process.env.VITE_CLUB_STORAGE_V2;
    else process.env.VITE_CLUB_STORAGE_V2 = prevFlag;
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevKey;
  }
});

test("V2 add never writes blob — no saveClubExtension in V2 block", () => {
  const src = read(MEMBER);
  const block = v2EarlyReturnBlock(extractFunction(src, "addMemberToClub"));
  assert.match(block, /rpcV2ClubAddMember/);
  assert.doesNotMatch(block, /saveClubExtension/);
  assert.doesNotMatch(block, /addMemberToClubLegacy/);
});

test("V2 remove never writes blob — no saveClubExtension in V2 block", () => {
  const src = read(MEMBER);
  const block = v2EarlyReturnBlock(extractFunction(src, "removeMemberFromClub"));
  assert.match(block, /rpcV2ClubRemoveMember/);
  assert.doesNotMatch(block, /saveClubExtension/);
  assert.doesNotMatch(block, /removeMemberFromClubLegacy/);
});

test("syncMembersFromBlob does not save under V2", () => {
  const src = read(MEMBER);
  const fn = extractFunction(src, "syncMembersFromBlob");
  assert.match(fn, /if \(isClubStorageV2Enabled\(\)\)/);
  assert.match(fn, /return ext;/);
  const v2Idx = fn.indexOf("isClubStorageV2Enabled()");
  const saveIdx = fn.indexOf("saveClubExtension");
  assert.ok(saveIdx > v2Idx, "saveClubExtension must remain after V2 early return");
});

test("legacy helpers hard-block via assertLegacyMembershipRosterWriteAllowed", () => {
  const src = read(MEMBER);
  assert.match(src, /LEGACY \/ OFFLINE ONLY — blob roster add/);
  assert.match(src, /LEGACY \/ OFFLINE ONLY — blob roster soft-remove/);
  for (const name of ["addMemberToClubLegacy", "removeMemberFromClubLegacy"]) {
    const fn = extractFunction(src, name);
    assert.match(fn, /assertLegacyMembershipRosterWriteAllowed/);
  }
});

test("V2 admin-link never ensures blob player", () => {
  const src = read(REQ);
  const fn = extractFunction(src, "adminLinkAccountOnlyAthleteToClub");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /addMemberToClub/);
  assert.match(block, /targetUserId:\s*normalizedUser\.id/);
  assert.doesNotMatch(block, /ensurePlayerInClubBlob/);
  assert.doesNotMatch(block, /saveClubData/);
});

test("ensurePlayerInClubBlob hard-blocks under Membership V2", () => {
  const src = read(REQ);
  const fn = extractFunction(src, "ensurePlayerInClubBlob");
  assert.match(fn, /assertLegacyMembershipRosterWriteAllowed/);
  assert.match(fn, /ensurePlayerInClubBlob/);
});

test("V2 approve never duplicates member locally", () => {
  const src = read(REQ);
  const block = v2EarlyReturnBlock(extractFunction(src, "approveClubMembershipRequest"));
  assert.match(block, /rpcV2ClubReviewMembershipRequest/);
  assert.doesNotMatch(block, /ensurePlayerInClubBlob/);
  assert.doesNotMatch(block, /addMemberToClub/);
  assert.doesNotMatch(block, /saveMembershipRequests/);
  assert.doesNotMatch(block, /saveClubExtension/);
});

test("V2 failure path maps error — no local success fallback", () => {
  const src = read(MEMBER);
  for (const name of ["addMemberToClub", "removeMemberFromClub"]) {
    const block = v2EarlyReturnBlock(extractFunction(src, name));
    assert.match(block, /if \(!\w+\.ok\)/);
    assert.match(block, /mapMemberCommandError/);
    assert.doesNotMatch(block, /saveClubExtension/);
  }
});

test("V2 self-registration has no blob member insert", () => {
  const src = read(GOV);
  assert.match(src, /Phase 45A\.4C\.5 — under V2, assertLegacyClubEntityWriteAllowed blocks/);
  assert.match(src, /Membership for the president is created by the canonical club_create/);
  const fn = extractFunction(src, "bootstrapSelfRegisteredPresident");
  assert.match(fn, /assertLegacyClubEntityWriteAllowed/);
  // Function body still contains addMemberToClub for V2-OFF, but the gate returns first under V2.
  assert.match(fn, /if \(!legacyGate\.ok\) return legacyGate/);
});

test("profiles.club_id is not Membership SSOT under V2 admin-link / link", () => {
  const src = read(REQ);
  assert.match(src, /profiles\.club_id is NOT written as Membership authority under V2/);
  const link = extractFunction(src, "linkAthleteProfile");
  assert.match(link, /if \(isClubStorageV2Enabled\(\)\)/);
  assert.match(link, /never invoke Phase31/);
});

test("offline/V2-OFF add/remove still wired to legacy adapters", () => {
  const src = read(MEMBER);
  const add = extractFunction(src, "addMemberToClub");
  const rem = extractFunction(src, "removeMemberFromClub");
  assert.match(add, /return addMemberToClubLegacy/);
  assert.match(rem, /return removeMemberFromClubLegacy/);
});

test("role/status remain deferred under V2", () => {
  const src = read(MEMBER);
  assert.match(src, /Đổi vai trò thành viên chưa hỗ trợ trên cloud/);
  assert.match(src, /Đổi trạng thái thành viên chưa hỗ trợ trên cloud/);
  const tab = read(TAB);
  assert.match(tab, /roleStatusEnabled = canManage && !canonicalMembershipRead/);
});

test("ownership-lock registers Phase 45A.4C.5 blob retirement rules", () => {
  const ids = RULES.map((r) => r.id);
  for (const id of [
    "member-blob-legacy-helpers-orchestrator-only",
    "member-blob-ensure-player-offline-only",
    "member-blob-add-remove-bypass-in-ui",
    "member-profiles-club-id-phase31-not-authority",
  ]) {
    assert.ok(ids.includes(id), `missing rule ${id}`);
  }
  const violations = collectViolations();
  const hits = [...violations.values()].filter((v) =>
    String(v.rule || "").startsWith("member-blob") ||
    String(v.rule || "") === "member-profiles-club-id-phase31-not-authority"
  );
  assert.equal(hits.length, 0);
});

test("ownership lock catches a hypothetical UI ensurePlayer bypass", () => {
  const rule = RULES.find((r) => r.id === "member-blob-add-remove-bypass-in-ui");
  assert.ok(rule);
  const fake = 'ensurePlayerInClubBlob({ clubId: "x" });\nsaveClubExtension(id, data);';
  const matches = rule.match(fake);
  assert.ok(matches.length >= 2);
});

test("guard module exports membership cloud authority helpers", () => {
  const src = read(GUARD);
  assert.match(src, /export function isClubMembershipCloudAuthoritative/);
  assert.match(src, /export function assertLegacyMembershipRosterWriteAllowed/);
});
