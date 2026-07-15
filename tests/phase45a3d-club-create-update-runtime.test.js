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
  // Skip past the parameter list's closing `)` before counting body braces
  // (default args like `data = {}` would otherwise terminate early).
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

// --- Error mapping ---
test("mapClubCommandError maps server tokens to registered API codes", () => {
  const cases = [
    ["VERSION_CONFLICT", API_ERROR_CODES.CONFLICT],
    ["DUPLICATE_NAME", API_ERROR_CODES.CONFLICT],
    ["DUPLICATE_CODE", API_ERROR_CODES.CONFLICT],
    ["INVALID_STATUS", API_ERROR_CODES.VALIDATION_ERROR],
    ["NAME_REQUIRED", API_ERROR_CODES.VALIDATION_ERROR],
    ["NOT_AUTHENTICATED", API_ERROR_CODES.UNAUTHORIZED],
    ["RPC_NOT_DEPLOYED", API_ERROR_CODES.INTERNAL_ERROR],
    ["NO_SUPABASE", API_ERROR_CODES.V2_DISABLED],
    ["FORBIDDEN", API_ERROR_CODES.FORBIDDEN],
    ["NOT_FOUND", API_ERROR_CODES.NOT_FOUND],
  ];
  for (const [server, expected] of cases) {
    const mapped = mapClubCommandError({ code: server, error: "x" });
    assert.equal(mapped.code, expected);
    assert.equal(isRegisteredApiErrorCode(mapped.code), true);
  }
});

test("rpcV2ClubUpdate transport signature and field-omit semantics", () => {
  const src = read("../src/features/club/services/clubStorageV2RpcService.js");
  assert.match(src, /export async function rpcV2ClubUpdate/);
  assert.match(src, /callRpc\("club_update"/);
  assert.match(src, /p_expected_club_version/);
  assert.match(src, /if \(name !== undefined\) args\.p_name = name/);
  assert.match(src, /if \(code !== undefined\) args\.p_code = code/);
  assert.match(src, /if \(registeredClusterId !== undefined\) args\.p_registered_cluster_id/);
});

test("cloud create early-return uses rpcV2ClubCreate without blob dual-write", () => {
  const fn = extractFunction(read("../src/features/club/services/clubTenantService.js"), "createClub");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubCreate/);
  assert.match(block, /mapClubCommandError/);
  assert.match(block, /invalidateAfterClubCommand/);
  assert.doesNotMatch(block, /saveClubs/);
  assert.doesNotMatch(block, /persistClubToCloud/);
  assert.doesNotMatch(block, /bootstrapSelfRegisteredPresident/);
});

test("cloud update early-return uses rpcV2ClubUpdate with expected version, no blob write", () => {
  const fn = extractFunction(read("../src/features/club/services/clubTenantService.js"), "updateClub");
  const block = v2EarlyReturnBlock(fn);
  assert.match(block, /rpcV2ClubUpdate/);
  assert.match(block, /expectedClubVersion/);
  assert.match(block, /mapClubCommandError/);
  assert.doesNotMatch(block, /\bsaveClubs\b/);
  assert.doesNotMatch(block, /\bupdateClubMeta\b/);
  assert.doesNotMatch(block, /\bpersistClubToCloud\b/);
});

test("self-registration bootstrap is only reachable after V2 early return", () => {
  const fn = extractFunction(read("../src/features/club/services/clubTenantService.js"), "createClub");
  const block = v2EarlyReturnBlock(fn);
  assert.doesNotMatch(block, /bootstrapSelfRegisteredPresident/);
  assert.match(fn, /bootstrapSelfRegisteredPresident/);
});

test("ClubContext routes create/rename via clubTenantService under V2", () => {
  const ctx = read("../src/context/ClubContext.jsx");
  assert.match(ctx, /clubOfflineCommandAdapter/);
  assert.match(ctx, /createClubCommand/);
  assert.match(ctx, /updateClubCommand/);
  assert.match(ctx, /isClubStorageV2Enabled\(\)/);
  assert.doesNotMatch(
    ctx,
    /import\s*\{[^}]*\bcreateClub\b[^}]*\}\s*from\s*["'][^"']*domain\/clubService\.js["']/
  );
  assert.doesNotMatch(
    ctx,
    /import\s*\{[^}]*\brenameClub\b[^}]*\}\s*from\s*["'][^"']*domain\/clubService\.js["']/
  );
});

test("venueOwnerClubService uses clubTenantService under V2", () => {
  const src = read("../src/features/club/services/venueOwnerClubService.js");
  assert.match(src, /createClubCommand/);
  assert.match(src, /isClubStorageV2Enabled/);
  assert.doesNotMatch(
    src,
    /import\s*\{[^}]*\bcreateClub\b[^}]*\}\s*from\s*["'][^"']*domain\/clubService\.js["']/
  );
});

test("ClubFormDialog awaits updateClub and preserves empty-code clear on edit", () => {
  const src = read("../src/pages/clubs/ClubFormDialog.jsx");
  assert.match(src, /await updateClub\(/);
  assert.match(src, /isEdit \? form\.code\.trim\(\) : form\.code\.trim\(\) \|\| null/);
  assert.match(src, /expectedClubVersion: club\?\.version/);
});

test("ClubManagement keeps note on offline adapter updateClubMeta", () => {
  const src = read("../src/pages/ClubManagement.jsx");
  assert.match(src, /updateClubMeta\(activeClubId, \{ note: noteValue \}\)/);
  assert.match(src, /clubOfflineCommandAdapter/);
  assert.match(src, /await createClub\(/);
  assert.match(src, /await renameClub\(/);
});

test("ownership lock includes Phase 45A.3D club command rules", () => {
  const ids = RULES.map((r) => r.id);
  for (const id of [
    "club-entity-command-domain-in-ui",
    "club-entity-command-rpc-bypass-in-ui",
    "club-entity-direct-table-write",
    "club-entity-legacy-dual-write-in-ui",
  ]) {
    assert.ok(ids.includes(id), `missing rule ${id}`);
  }
});

test("ownership lock catches a simulated UI domain createClub import", () => {
  const rule = RULES.find((r) => r.id === "club-entity-command-domain-in-ui");
  const bad = rule.match(
    `import { createClub, getClubSummary } from "../domain/clubService.js";\ncreateClub("x");`
  );
  assert.ok(bad.length >= 1);
  const good = rule.match(
    `import { createClub } from "../features/club/services/clubTenantService.js";\ncreateClub({ name: "x" });`
  );
  assert.equal(good.length, 0);
});

test("ownership lock finds no UI domain create/rename or RPC bypass after cutover", () => {
  const all = collectViolations();
  for (const rule of [
    "club-entity-command-domain-in-ui",
    "club-entity-command-rpc-bypass-in-ui",
    "club-entity-legacy-dual-write-in-ui",
  ]) {
    const hits = [...all.values()].filter((v) => v.rule === rule);
    assert.equal(
      hits.length,
      0,
      `${rule}: ${hits.map((v) => v.file).join(", ")}`
    );
  }
});
