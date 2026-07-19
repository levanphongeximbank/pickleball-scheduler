import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";
import { getVicePresidentUserIds } from "../src/features/club/models/clubGovernance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql");
const sql = readFileSync(sqlPath, "utf8");
const govPath = join(__dirname, "../src/features/club/services/clubGovernanceService.js");
const govSrc = readFileSync(govPath, "utf8");
const rpcPath = join(__dirname, "../src/features/club/services/clubStorageV2RpcService.js");
const rpcSrc = readFileSync(rpcPath, "utf8");

function extractFunction(src, name) {
  const start = src.search(new RegExp(`export async function ${name}\\(`));
  assert.ok(start >= 0, `function ${name} not found`);
  const sigClose = src.indexOf(") {", start);
  const braceStart = sigClose + 2;
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unclosed ${name}`);
}

function v2Block(fnSrc) {
  const idx = fnSrc.search(/if \(isClubStorageV2Enabled\(\)\)/);
  assert.ok(idx >= 0, "V2 gate missing");
  const after = fnSrc.slice(idx);
  const braceStart = after.indexOf("{");
  let depth = 0;
  for (let i = braceStart; i < after.length; i += 1) {
    if (after[i] === "{") depth += 1;
    else if (after[i] === "}") {
      depth -= 1;
      if (depth === 0) return after.slice(0, i + 1);
    }
  }
  assert.fail("V2 block");
}

describe("Phase 1B — VP SQL + hydrate + V2 cutover", () => {
  it("authors club_assign_vice_president and club_clear_vice_president", () => {
    assert.match(sql, /create or replace function public\.club_assign_vice_president\(/i);
    assert.match(sql, /create or replace function public\.club_clear_vice_president\(/i);
    assert.match(
      sql,
      /grant execute on function public\.club_assign_vice_president\(uuid, text, uuid, integer\) to authenticated;/i
    );
    assert.match(
      sql,
      /grant execute on function public\.club_clear_vice_president\(uuid, text, integer, uuid\) to authenticated;/i
    );
    assert.match(sql, /'club\.assign_vice_president'/);
    assert.match(sql, /'club\.clear_vice_president'/);
    assert.match(sql, /v_vp_count >= 2/);
    assert.doesNotMatch(sql, /^\s*TRUNCATE\b/im);
  });

  it("hydrates VP arrays in phase42_club_canonical", () => {
    assert.match(sql, /'vice_president_user_ids', v_vp_user_ids/);
    assert.match(sql, /'vice_president_labels', v_vp_labels/);
    assert.match(sql, /role_code = 'vice_president'/);
  });

  it("mapV2ClubToUiClub maps VP ids and labels for reload parity", () => {
    const club = mapV2ClubToUiClub({
      id: "c1",
      tenant_id: "t1",
      name: "VP Club",
      status: "active",
      version: 2,
      active_member_count: 5,
      vice_president_user_ids: ["vp-1", "vp-2"],
      vice_president_labels: ["VP One", "VP Two"],
      vice_president_user_id: "vp-1",
      vice_president_label: "VP One",
      president_user_id: "pres-1",
      president_label: "Pres",
    });
    assert.deepEqual(club.governance.vicePresidentUserIds, ["vp-1", "vp-2"]);
    assert.equal(club.governance.vicePresidentUserId, "vp-1");
    assert.deepEqual(club.vicePresidentLabels, ["VP One", "VP Two"]);
    assert.equal(club.vicePresidentLabel, "VP One");
    assert.deepEqual(getVicePresidentUserIds(club.governance), ["vp-1", "vp-2"]);

    const cleared = mapV2ClubToUiClub({
      id: "c1",
      tenant_id: "t1",
      name: "VP Club",
      status: "active",
      version: 3,
      active_member_count: 5,
      vice_president_user_ids: [],
      vice_president_labels: [],
      president_user_id: "pres-1",
    });
    assert.deepEqual(cleared.governance.vicePresidentUserIds, []);
    assert.equal(cleared.governance.vicePresidentUserId, null);
  });

  it("client transport exposes assign/clear VP RPCs", () => {
    assert.match(rpcSrc, /callRpc\("club_assign_vice_president"/);
    assert.match(rpcSrc, /callRpc\("club_clear_vice_president"/);
    assert.match(rpcSrc, /export async function rpcV2ClubAssignVicePresident/);
    assert.match(rpcSrc, /export async function rpcV2ClubClearVicePresident/);
  });

  it("setClubVicePresidents V2 block uses VP RPCs; V1 fallback keeps updateClubGovernance", () => {
    const fn = extractFunction(govSrc, "setClubVicePresidents");
    const cloud = v2Block(fn);
    assert.match(cloud, /rpcV2ClubAssignVicePresident/);
    assert.match(cloud, /rpcV2ClubClearVicePresident/);
    assert.match(cloud, /resolveClubForGovernance/);
    assert.doesNotMatch(cloud, /updateClubGovernance\s*\(/);

    const afterV2 = fn.slice(fn.indexOf(cloud) + cloud.length);
    assert.match(afterV2, /updateClubGovernance\s*\(/);
  });

  it("assignClubVicePresident delegates to setClubVicePresidents (assign/remove via list)", () => {
    const fn = extractFunction(govSrc, "assignClubVicePresident");
    assert.match(fn, /setClubVicePresidents\(clubId, trimmed \? \[trimmed\] : \[\]/);
  });
});
