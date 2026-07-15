import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { API_ERROR_CODES } from "../src/features/api/constants/apiErrors.js";
import { RULES, collectViolations } from "../scripts/ci/ownership-lock.mjs";
import {
  assertLegacyClubEntityWriteAllowed,
  isClubCloudCommandAuthoritative,
} from "../src/features/club/services/clubLegacyWriteGuard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, rel), "utf8");
}

function extractFunction(src, name) {
  const start = src.search(new RegExp(`export (?:async )?function ${name}\\(`));
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

test("1–6 / 14: V2 create/update never dual-write; RPC failure stays fail", () => {
  const tenant = read("../src/features/club/services/clubTenantService.js");
  const createFn = extractFunction(tenant, "createClub");
  const updateFn = extractFunction(tenant, "updateClub");
  const createBlock = v2EarlyReturnBlock(createFn);
  const updateBlock = v2EarlyReturnBlock(updateFn);

  assert.match(createBlock, /rpcV2ClubCreate/);
  assert.doesNotMatch(createBlock, /\bsaveClubs\b/);
  assert.doesNotMatch(createBlock, /\bpersistClubToCloud\b/);
  assert.doesNotMatch(createBlock, /\bbootstrapSelfRegisteredPresident\b/);
  assert.match(createBlock, /mapClubCommandError/);

  assert.match(updateBlock, /rpcV2ClubUpdate/);
  assert.doesNotMatch(updateBlock, /\bupdateClubMeta\b/);
  assert.doesNotMatch(updateBlock, /\bpersistClubToCloud\b/);
  assert.doesNotMatch(updateBlock, /club_upsert_registry/);
  assert.doesNotMatch(updateBlock, /\bsaveClubs\b/);
  assert.match(updateBlock, /mapClubCommandError/);
});

test("7: UI/context cannot import domain Club writers directly", () => {
  const ctx = read("../src/context/ClubContext.jsx");
  assert.match(ctx, /clubOfflineCommandAdapter/);
  assert.doesNotMatch(
    ctx,
    /import\s*\{[^}]*\b(createClub|renameClub|deleteClub|updateClubMeta)\b[^}]*\}\s*from\s*["'][^"']*domain\/clubService\.js["']/
  );
  const mgmt = read("../src/pages/ClubManagement.jsx");
  assert.match(mgmt, /clubOfflineCommandAdapter/);
  assert.doesNotMatch(
    mgmt,
    /import\s*\{[^}]*\bupdateClubMeta\b[^}]*\}\s*from\s*["'][^"']*domain\/clubService\.js["']/
  );
});

test("8: venue-owner auto-create is canonical-only in V2", () => {
  const src = read("../src/features/club/services/venueOwnerClubService.js");
  assert.match(src, /createClubCommand/);
  assert.match(src, /isClubStorageV2Enabled/);
  assert.match(src, /createClubOffline/);
  // Blob bind only when !V2
  assert.match(src, /if \(!isClubStorageV2Enabled\(\) && targetClub\?\.id\)/);
});

test("9: self-registration V2 flow is canonical-only", () => {
  const fn = extractFunction(read("../src/features/club/services/clubTenantService.js"), "createClub");
  const block = v2EarlyReturnBlock(fn);
  assert.doesNotMatch(block, /bootstrapSelfRegisteredPresident/);
  assert.doesNotMatch(block, /finalizeSelfRegisteredClubCloud/);
  assert.doesNotMatch(block, /persistClubToCloud/);
  const boot = extractFunction(
    read("../src/features/club/services/clubGovernanceService.js"),
    "bootstrapSelfRegisteredPresident"
  );
  assert.match(boot, /assertLegacyClubEntityWriteAllowed/);
});

test("10: V2-OFF/offline adapter still exposes local writers", () => {
  const src = read("../src/features/club/services/clubOfflineCommandAdapter.js");
  assert.match(src, /createClubDomain/);
  assert.match(src, /renameClubDomain/);
  assert.match(src, /updateClubMetaDomain/);
  assert.match(src, /deleteClubDomain/);
  assert.match(src, /syncClubsToLegacyRegistry/);
  assert.match(src, /assertLegacyClubEntityWriteAllowed/);
});

test("11: archive/delete deferred and blocked under V2", () => {
  const ctx = read("../src/context/ClubContext.jsx");
  assert.match(ctx, /isClubCloudCommandAuthoritative/);
  assert.match(ctx, /FEATURE_DISABLED/);
  assert.match(ctx, /deleteClubOffline/);
  const domain = extractFunction(read("../src/domain/clubService.js"), "deleteClub");
  assert.match(domain, /deferred:\s*true/);
});

test("12: blob-only metadata stays explicitly separate", () => {
  const mgmt = read("../src/pages/ClubManagement.jsx");
  assert.match(mgmt, /updateClubMeta\(activeClubId, \{ note: noteValue \}\)/);
  assert.match(mgmt, /clubOfflineCommandAdapter/);
  const updateFn = extractFunction(
    read("../src/features/club/services/clubTenantService.js"),
    "updateClub"
  );
  const block = v2EarlyReturnBlock(updateFn);
  assert.match(block, /Blob-only|hasBlobOnlyMeta|note/);
});

test("legacy registry writers hard-block under cloud authority", () => {
  for (const [file, names] of [
    ["../src/features/club/services/clubRegistryCloudService.js", ["persistClubToCloud", "syncClubsForVenueToCloud"]],
    ["../src/features/club/services/clubRegistryRpcService.js", ["rpcClubUpsertRegistry", "rpcClubClaimSelfRegistration"]],
  ]) {
    const src = read(file);
    for (const name of names) {
      const fn = extractFunction(src, name);
      assert.match(fn, /assertLegacyClubEntityWriteAllowed/, `${name} missing gate`);
    }
  }
  const bind = extractFunction(read("../src/domain/clubService.js"), "bindClubVenueRegistry");
  assert.match(bind, /assertLegacyClubEntityWriteAllowed/);
});

test("guardAction skips bindClubVenueRegistry under cloud authority", () => {
  const src = read("../src/auth/guardAction.js");
  assert.match(src, /isClubCloudCommandAuthoritative/);
  assert.match(src, /!isClubCloudCommandAuthoritative\(\)/);
});

test("13: ownership lock catches new legacy write bypasses", () => {
  const ids = RULES.map((r) => r.id);
  for (const id of [
    "club-entity-command-domain-in-ui",
    "club-entity-legacy-dual-write-in-ui",
    "club-entity-saveClubs-outside-offline",
    "club-entity-legacy-upsert-surface",
    "club-governance-table-direct-write",
    "club-entity-pickleball-clubs-key-mutate",
  ]) {
    assert.ok(ids.includes(id), `missing rule ${id}`);
  }

  const domainRule = RULES.find((r) => r.id === "club-entity-command-domain-in-ui");
  assert.ok(
    domainRule.match(
      `import { deleteClub, createClub } from "../domain/clubService.js";`
    ).length >= 2
  );

  const dual = RULES.find((r) => r.id === "club-entity-legacy-dual-write-in-ui");
  assert.ok(dual.match(`persistClubToCloud(x);\nsyncClubsForVenueToCloud(y);`).length >= 2);

  const saveRule = RULES.find((r) => r.id === "club-entity-saveClubs-outside-offline");
  const fauxSave = saveRule.match("export function hack() { saveClubs([]); }");
  assert.ok(fauxSave.length >= 1);

  const upsertRule = RULES.find((r) => r.id === "club-entity-legacy-upsert-surface");
  assert.ok(upsertRule.match(`rpcClubUpsertRegistry({ club: {} });`).length >= 1);
});

test("ownership lock finds no new club-entity write bypasses in UI/src", () => {
  const all = collectViolations();
  for (const rule of [
    "club-entity-command-domain-in-ui",
    "club-entity-command-rpc-bypass-in-ui",
    "club-entity-legacy-dual-write-in-ui",
    "club-entity-legacy-upsert-surface",
    "club-governance-table-direct-write",
  ]) {
    const hits = [...all.values()].filter((v) => v.rule === rule);
    assert.equal(hits.length, 0, `${rule}: ${hits.map((v) => `${v.file}:${v.symbol}`).join("; ")}`);
  }
});

test("legacy guard returns FEATURE_DISABLED when cloud-authoritative", () => {
  // Structural: when flag helpers claim cloud authority, gate rejects.
  // Runtime env in CI is usually non-authoritative; still verify mapping shape.
  const closed = assertLegacyClubEntityWriteAllowed({ operation: "test" });
  if (isClubCloudCommandAuthoritative()) {
    assert.equal(closed.ok, false);
    assert.equal(closed.code, API_ERROR_CODES.FEATURE_DISABLED);
  } else {
    assert.equal(closed.ok, true);
  }
});
