import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  WAVE5_EXISTING_RPC_TRANSITIONS,
  acceptedPredecessorMd5Set,
  isAcceptedPredecessorMd5,
  extractProsrc,
} from "../scripts/wave5-rpc-prosrc-fingerprint.mjs";

const SQL_DIR = path.join(
  process.cwd(),
  "docs/platform-core-wave5-club-context-closure/sql-design"
);
const APPLY = fs.readFileSync(path.join(SQL_DIR, "02_APPLY_DESIGN.sql"), "utf8");
const CERT = fs.readFileSync(
  path.join(SQL_DIR, "08B_RPC_FINGERPRINT_CERTIFICATION.md"),
  "utf8"
);
const LOCK = fs.readFileSync(
  path.join(SQL_DIR, "08C_PRODUCTION_PREDECESSOR_VARIANT_AND_AUTHZ_LOCK.md"),
  "utf8"
);

const RPC01 = WAVE5_EXISTING_RPC_TRANSITIONS.find(
  (r) => r.name === "phase42_can_transfer_president"
);
const RPC02 = WAVE5_EXISTING_RPC_TRANSITIONS.find(
  (r) => r.name === "club_review_membership_request"
);

const RPC01_SET = [
  "24f9f7e47c2dc0a166c6385811f6c43d",
  "14b3e8e88cc83b1824e3631d718b89e5",
];
const RPC02_SET = [
  "0b8ee11ef23090f8cd6e364ad2e6eb60",
  "cd904d71c508e9ee1e4768396c515ab0",
];
const RANDOM_THIRD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("RPC01 accepted predecessor set is exactly the approved variants", () => {
  assert.ok(RPC01);
  assert.deepEqual(acceptedPredecessorMd5Set(RPC01).sort(), [...RPC01_SET].sort());
  assert.equal(acceptedPredecessorMd5Set(RPC01).length, 2);
  assert.equal(isAcceptedPredecessorMd5(RPC01, RPC01_SET[0]), true);
  assert.equal(isAcceptedPredecessorMd5(RPC01, RPC01_SET[1]), true);
  assert.equal(isAcceptedPredecessorMd5(RPC01, RANDOM_THIRD), false);
  assert.equal(isAcceptedPredecessorMd5(RPC01, RPC01.targetMd5Lf), false);
});

test("RPC02 accepted predecessor set is exactly the approved variants", () => {
  assert.ok(RPC02);
  assert.deepEqual(acceptedPredecessorMd5Set(RPC02).sort(), [...RPC02_SET].sort());
  assert.equal(acceptedPredecessorMd5Set(RPC02).length, 2);
  assert.equal(isAcceptedPredecessorMd5(RPC02, RPC02_SET[0]), true);
  assert.equal(isAcceptedPredecessorMd5(RPC02, RPC02_SET[1]), true);
  assert.equal(isAcceptedPredecessorMd5(RPC02, RANDOM_THIRD), false);
  assert.equal(isAcceptedPredecessorMd5(RPC02, RPC02.targetMd5Lf), false);
});

test("Staging certified predecessors remain accepted; Production variants are accepted", () => {
  assert.equal(isAcceptedPredecessorMd5(RPC01, "24f9f7e47c2dc0a166c6385811f6c43d"), true);
  assert.equal(isAcceptedPredecessorMd5(RPC01, "14b3e8e88cc83b1824e3631d718b89e5"), true);
  assert.equal(isAcceptedPredecessorMd5(RPC02, "0b8ee11ef23090f8cd6e364ad2e6eb60"), true);
  assert.equal(isAcceptedPredecessorMd5(RPC02, "cd904d71c508e9ee1e4768396c515ab0"), true);
});

test("APPLY encodes predecessor SET arrays and aborts unknown hashes", () => {
  assert.match(APPLY, /predecessor_fps/);
  assert.match(APPLY, /NOT \(v_live_fp = ANY \(v_guard\.predecessor_fps\)\)/);
  assert.match(APPLY, /APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED/);
  for (const h of RPC01_SET) {
    assert.match(
      APPLY,
      new RegExp(`'phase42_can_transfer_president'[\\s\\S]{0,500}'${h}'`)
    );
  }
  for (const h of RPC02_SET) {
    assert.match(
      APPLY,
      new RegExp(`'club_review_membership_request'[\\s\\S]{0,500}'${h}'`)
    );
  }
  assert.doesNotMatch(APPLY, /IF\s+.*production.*THEN[\s\S]{0,200}accept/i);
  assert.doesNotMatch(APPLY, /wave5\.target_env[\s\S]{0,120}predecessor/i);
});

test("canonical target MD5s remain unchanged and are not predecessors", () => {
  assert.equal(RPC01.targetMd5Lf, "61dd0458b9240d5407394f6f8d492bf0");
  assert.equal(RPC02.targetMd5Lf, "2ef9e0d87071bba93814ab20344539c1");
  const future01 = extractProsrc(APPLY, "phase42_can_transfer_president");
  const future02 = extractProsrc(APPLY, "club_review_membership_request");
  assert.equal(future01.md5GitLf, RPC01.targetMd5Lf);
  assert.equal(future02.md5GitLf, RPC02.targetMd5Lf);
  assert.equal(RPC01_SET.includes(RPC01.targetMd5Lf), false);
  assert.equal(RPC02_SET.includes(RPC02.targetMd5Lf), false);
});

test("docs lock: live hash is not canonical target authority; no env bypass", () => {
  assert.match(LOCK, /LIVE_HASH_IS_CANONICAL_AUTHORITY=NO/);
  assert.match(LOCK, /REPO_CANONICAL_TARGET_IS_AUTHORITY=YES/);
  assert.match(LOCK, /ENVIRONMENT_NAME_NOT_USED_TO_SELECT_HASH=YES/);
  assert.match(CERT, /LIVE_HASH_IS_AUTHORITY=NO/);
  assert.match(LOCK, /14b3e8e88cc83b1824e3631d718b89e5/);
  assert.match(LOCK, /cd904d71c508e9ee1e4768396c515ab0/);
  assert.match(LOCK, /TRANSFER_PRESIDENT_PROFILES_VENUE_ROLE_FALLBACK=RETIRE/);
});

test("all 10 target MD5 values remain the certified Wave5 targets", () => {
  const expected = {
    phase42_club_canonical: "1dccf73c5ee25b96376371e1f89a9dac",
    club_create: "e847c5d23e51370fe4ef1360efbaa10a",
    club_list_registry: "202fef07f6859107971329412b8beb3b",
    club_list_members: "a497610e6d2d905fe02b7aa2b67724ea",
    phase42_can_update_club: "969ce4b24e48632045ae75f4e8b9ca14",
    phase42_can_assign_club_owner: "17491a5d3df2b96da44f5bececdb257e",
    phase42_can_transfer_president: "61dd0458b9240d5407394f6f8d492bf0",
    club_add_member: "484c609b937c029f03be7cb37fb03005",
    club_restore_member: "8391e0fbafc57917bdfcbd9401242c86",
    club_review_membership_request: "2ef9e0d87071bba93814ab20344539c1",
  };
  assert.equal(WAVE5_EXISTING_RPC_TRANSITIONS.length, 10);
  for (const row of WAVE5_EXISTING_RPC_TRANSITIONS) {
    assert.equal(row.targetMd5Lf, expected[row.name], row.name);
    const body = extractProsrc(APPLY, row.name);
    assert.equal(body.md5GitLf, expected[row.name], row.name);
  }
});
