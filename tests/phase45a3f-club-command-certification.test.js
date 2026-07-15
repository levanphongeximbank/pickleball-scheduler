import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { RULES, collectViolations } from "../scripts/ci/ownership-lock.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function read(rel) {
  return readFileSync(join(__dirname, rel), "utf8");
}

function walkSrc(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkSrc(abs, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) out.push(abs);
  }
  return out;
}

function extractFunction(src, name) {
  const start = src.search(new RegExp(`export (?:async )?function ${name}\\(`));
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

test("1: canonicalClubRepository remains read-only", () => {
  const src = read("../src/features/club/repositories/canonicalClubRepository.js");
  assert.doesNotMatch(src, /\bsaveClubs\s*\(/);
  assert.doesNotMatch(src, /\bpersistClubToCloud\s*\(/);
  assert.doesNotMatch(src, /\brpcV2ClubCreate\s*\(/);
  assert.doesNotMatch(src, /\brpcV2ClubUpdate\s*\(/);
  assert.doesNotMatch(src, /callRpc\(\s*["']club_(?:create|update)["']/);
  assert.doesNotMatch(src, /\.from\(\s*["']clubs["']\s*\)[\s\S]{0,200}?\.(insert|update|upsert|delete)\s*\(/);
  assert.match(src, /listClubsForTenant|getClubById|listClubsForCurrentScope/);
});

test("2: clubTenantService is the only entity create/update orchestrator calling rpcV2*", () => {
  const files = walkSrc(join(ROOT, "src"));
  const callers = [];
  for (const abs of files) {
    const rel = relative(ROOT, abs).split("\\").join("/");
    if (rel === "src/features/club/services/clubStorageV2RpcService.js") continue;
    if (rel === "src/features/club/services/clubTenantService.js") continue;
    const c = readFileSync(abs, "utf8");
    if (/\brpcV2ClubCreate\s*\(/.test(c) || /\brpcV2ClubUpdate\s*\(/.test(c)) {
      callers.push(rel);
    }
  }
  assert.deepEqual(callers, [], `unexpected rpcV2 callers: ${callers.join(", ")}`);
});

test("3: clubStorageV2RpcService is the only transport for club_create/club_update", () => {
  const files = walkSrc(join(ROOT, "src"));
  const hits = [];
  const re =
    /(?:callRpc|\.rpc)\(\s*["']club_(?:create|update)["']/g;
  for (const abs of files) {
    const rel = relative(ROOT, abs).split("\\").join("/");
    if (rel === "src/features/club/services/clubStorageV2RpcService.js") continue;
    const c = readFileSync(abs, "utf8");
    if (re.test(c)) hits.push(rel);
  }
  assert.deepEqual(hits, [], `unexpected RPC transport: ${hits.join(", ")}`);
  const transport = read("../src/features/club/services/clubStorageV2RpcService.js");
  assert.match(transport, /callRpc\("club_create"/);
  assert.match(transport, /callRpc\("club_update"/);
});

test("4: UI/context cannot use domain Club entity writers", () => {
  for (const rel of [
    "../src/context/ClubContext.jsx",
    "../src/pages/ClubManagement.jsx",
    "../src/pages/clubs/ClubFormDialog.jsx",
    "../src/pages/clubs/ClubListPage.jsx",
  ]) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /import\s*\{[^}]*\b(createClub|renameClub|deleteClub|updateClubMeta)\b[^}]*\}\s*from\s*["'][^"']*domain\/clubService\.js["']/
    );
  }
  assert.match(read("../src/context/ClubContext.jsx"), /clubOfflineCommandAdapter/);
  assert.match(read("../src/context/ClubContext.jsx"), /clubTenantService/);
});

test("5–7: V2 cloud create/update never saveClubs/persist/upsert; failure maps error (no offline adapter)", () => {
  const tenant = read("../src/features/club/services/clubTenantService.js");
  const create = v2Block(extractFunction(tenant, "createClub"));
  const update = v2Block(extractFunction(tenant, "updateClub"));
  for (const block of [create, update]) {
    assert.doesNotMatch(block, /\bsaveClubs\b/);
    assert.doesNotMatch(block, /\bpersistClubToCloud\b/);
    assert.doesNotMatch(block, /club_upsert_registry/);
    assert.doesNotMatch(block, /clubOfflineCommandAdapter/);
    assert.doesNotMatch(block, /createClubOffline|renameClubOffline|updateClubMeta/);
    assert.match(block, /mapClubCommandError/);
  }
  assert.match(create, /rpcV2ClubCreate/);
  assert.match(update, /rpcV2ClubUpdate/);
});

test("8: Offline adapter is gated for cloud-authoritative writes", () => {
  const src = read("../src/features/club/services/clubOfflineCommandAdapter.js");
  assert.match(src, /assertLegacyClubEntityWriteAllowed/);
  assert.match(src, /createClubDomain|renameClubDomain|deleteClubDomain/);
  assert.match(src, /syncClubsToLegacyRegistry/);
});

test("9: Self-registration V2 has no legacy write", () => {
  const create = v2Block(
    extractFunction(read("../src/features/club/services/clubTenantService.js"), "createClub")
  );
  assert.doesNotMatch(create, /bootstrapSelfRegisteredPresident/);
  assert.doesNotMatch(create, /finalizeSelfRegisteredClubCloud/);
  assert.doesNotMatch(create, /persistClubToCloud/);
  assert.doesNotMatch(create, /rpcClubClaimSelfRegistration/);
});

test("10: Venue-owner V2 has no local entity write", () => {
  const src = read("../src/features/club/services/venueOwnerClubService.js");
  assert.match(src, /createClubCommand/);
  assert.match(src, /isClubStorageV2Enabled\(\)/);
  assert.match(src, /if \(!isClubStorageV2Enabled\(\) && targetClub\?\.id\)/);
  assert.doesNotMatch(
    src,
    /import\s*\{[^}]*\bcreateClub\b[^}]*\}\s*from\s*["'][^"']*domain\/clubService\.js["']/
  );
});

test("11–12: no direct clubs/club_governance table writes outside approved transport", () => {
  const files = walkSrc(join(ROOT, "src"));
  const clubWrites = [];
  const govWrites = [];
  const clubsRe =
    /\.from\(\s*["']clubs["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/;
  const govRe =
    /\.from\(\s*["']club_governance["']\s*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\s*\(/;
  for (const abs of files) {
    const rel = relative(ROOT, abs).split("\\").join("/");
    const c = readFileSync(abs, "utf8");
    if (clubsRe.test(c) && rel !== "src/features/club/services/clubStorageV2RpcService.js") {
      clubWrites.push(rel);
    }
    if (govRe.test(c)) govWrites.push(rel);
  }
  assert.deepEqual(clubWrites, []);
  assert.deepEqual(govWrites, []);
});

test("13–14: archive/delete and VP/governance remain explicitly deferred", () => {
  const ctx = read("../src/context/ClubContext.jsx");
  assert.match(ctx, /isClubCloudCommandAuthoritative/);
  assert.match(ctx, /FEATURE_DISABLED/);
  assert.match(ctx, /archive\/delete|deleteClubOffline/);
  const domainDel = extractFunction(read("../src/domain/clubService.js"), "deleteClub");
  assert.match(domainDel, /deferred:\s*true/);
  const cert = read(
    "../docs/v5/phase45a3f/PHASE_45A3F_CLUB_COMMAND_CANONICAL_CERTIFICATION.md"
  );
  assert.match(cert, /VP \/ owner \/ approve governance writers/);
  assert.match(cert, /Archive \/ hard-delete/);
  assert.match(cert, /NOT EXECUTED BY DESIGN/);
});

test("15: Ownership Lock defines 45A.3F rules and catches negative probes", () => {
  const ids = RULES.map((r) => r.id);
  for (const id of [
    "club-entity-rpc-transport-only",
    "club-entity-rpcV2-orchestrator-only",
    "club-entity-legacy-persist-call-surface",
    "club-entity-repository-readonly",
    "club-entity-command-domain-in-ui",
    "club-entity-direct-table-write",
  ]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }

  const transport = RULES.find((r) => r.id === "club-entity-rpc-transport-only");
  assert.ok(transport.match(`await client.rpc("club_create", {});`).length >= 1);
  assert.equal(
    transport.match(`callRpc("club_list_registry", {});`).length,
    0
  );

  const orch = RULES.find((r) => r.id === "club-entity-rpcV2-orchestrator-only");
  assert.ok(orch.match(`await rpcV2ClubCreate({ tenantId: "x" });`).length >= 1);

  const live = collectViolations();
  for (const rule of [
    "club-entity-rpc-transport-only",
    "club-entity-rpcV2-orchestrator-only",
    "club-entity-legacy-persist-call-surface",
    "club-entity-repository-readonly",
    "club-entity-command-domain-in-ui",
    "club-entity-legacy-dual-write-in-ui",
  ]) {
    const hits = [...live.values()].filter((v) => v.rule === rule);
    assert.equal(hits.length, 0, `${rule}: ${hits.map((v) => v.file).join(", ")}`);
  }
});

test("public barrel does not re-export legacy dual-write writers", () => {
  const idx = read("../src/features/club/index.js");
  assert.doesNotMatch(
    idx,
    /export\s*\{[^}]*\bpersistClubToCloud\b[^}]*\}\s*from\s*["'][^"']*clubRegistryCloudService/
  );
  assert.doesNotMatch(
    idx,
    /export\s*\{[^}]*\bsyncClubsForVenueToCloud\b[^}]*\}\s*from\s*["'][^"']*clubRegistryCloudService/
  );
  assert.doesNotMatch(idx, /\breclaimLocalPresidentClubForUser\b/);
});
