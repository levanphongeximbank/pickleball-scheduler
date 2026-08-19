/**
 * Wave 5 — Canonical Club context cutover P1 tests.
 * Groups A–R from the Owner implementation package.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_CLUB,
  getActiveClub,
  getActiveClubId,
  getActiveClubIdPreference,
  loadClubs,
  saveClubs,
  setActiveClubId,
  setActiveClubIdPreference,
} from "../src/data/club.js";
import { normalizeClub } from "../src/models/club.js";
import {
  CLUB_PREFERENCE_STATUS,
  isCanonicalClubReadEnabled,
  normalizeCanonicalActiveClub,
  resolveActiveClubSelection,
  resolveExplicitTenantFromCanonicalClub,
} from "../src/features/club/context/clubCanonicalReadModel.js";
import { createCanonicalClubRepository } from "../src/features/club/repositories/index.js";
import {
  CLUB_SCOPE_SEMANTICS,
  detectClubRowScopeSemantics,
  translateLegacyClubVenueScope,
} from "../src/features/club/compat/legacyClubVenueScope.js";
import {
  CLUB_CONTEXT_ERROR_CODE,
  assertExplicitClubId,
  requireExplicitClubId,
} from "../src/features/club/context/requireExplicitClubId.js";
import { listTournaments } from "../src/domain/tournamentService.js";
import { loadAIData } from "../src/ai/storage.js";
import { mapV2ClubToUiClub } from "../src/features/club/services/clubStorageV2RpcService.js";
import { resolveClubOperationalTenantId } from "../src/core/platform/app/platformContextReadiness.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("A. no fabricated default Club when registry is empty", () => {
  globalThis.localStorage = createLocalStorageMock();
  const clubs = loadClubs();
  assert.deepEqual(clubs, []);
  assert.equal(getActiveClubId(), null);
  assert.equal(getActiveClub(), null);
});

test("B. preference does not create Club existence", () => {
  globalThis.localStorage = createLocalStorageMock();
  assert.equal(setActiveClubIdPreference("ghost-club"), true);
  assert.equal(getActiveClubIdPreference(), "ghost-club");
  assert.deepEqual(loadClubs(), []);
  assert.equal(getActiveClub(), null);
});

test("C. no Club preference → explicit CLUB_REQUIRED", () => {
  const required = requireExplicitClubId(null);
  assert.equal(required.ok, false);
  assert.equal(required.code, CLUB_CONTEXT_ERROR_CODE.CLUB_REQUIRED);
  assert.throws(() => assertExplicitClubId(""), (err) => err.code === "CLUB_REQUIRED");
});

test("D. invalid preference stays pending until authority is ready", () => {
  const pending = resolveActiveClubSelection({
    preferredClubId: "club-a",
    visibleClubs: [],
    authorityReady: false,
  });
  assert.equal(pending.preferenceStatus, CLUB_PREFERENCE_STATUS.PENDING_VALIDATION);
  assert.equal(pending.activeClubId, "club-a");

  const invalid = resolveActiveClubSelection({
    preferredClubId: "club-a",
    visibleClubs: [{ id: "club-b", tenantId: "tenant-1" }],
    requireTenant: true,
    selectedTenantId: "tenant-1",
    authorityReady: true,
  });
  assert.equal(invalid.preferenceStatus, CLUB_PREFERENCE_STATUS.INVALID);
  assert.equal(invalid.activeClubId, "club-b");
});

test("E. Tenant switch rejects foreign Club preference", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: "club-foreign",
    visibleClubs: [
      { id: "club-foreign", tenantId: "tenant-a" },
      { id: "club-home", tenantId: "tenant-b" },
    ],
    requireTenant: true,
    selectedTenantId: "tenant-b",
    authorityReady: true,
  });
  assert.equal(sel.activeClubId, "club-home");
  assert.equal(sel.preferenceStatus, CLUB_PREFERENCE_STATUS.INVALID);
});

test("F. unique eligible Club auto-selects as UX preference only", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: null,
    visibleClubs: [{ id: "only-club", tenantId: "tenant-1" }],
    requireTenant: true,
    selectedTenantId: "tenant-1",
  });
  assert.equal(sel.activeClubId, "only-club");
  assert.equal(sel.preferenceStatus, CLUB_PREFERENCE_STATUS.NONE);
});

test("G. multiple eligible Clubs do not silently first-select", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: null,
    visibleClubs: [
      { id: "club-a", tenantId: "tenant-1" },
      { id: "club-b", tenantId: "tenant-1" },
    ],
    requireTenant: true,
    selectedTenantId: "tenant-1",
  });
  assert.equal(sel.activeClubId, null);
  assert.equal(sel.stale, true);
});

test("H. Super Admin with no selected Tenant has no operational Club list", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => {
      throw new Error("unscoped operational fetch must not run");
    },
  });
  const result = await repo.listClubsForCurrentScope({
    user: { id: "admin", role: "SUPER_ADMIN" },
    isPlatformWide: true,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, []);
  assert.equal(result.execution.mode, "operational_unscoped_denied");
});

test("H2. directory opt-in still lists when operationalOnly=false", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async ({ tenantId }) => {
      assert.equal(tenantId, null);
      return {
        ok: true,
        clubs: [{ id: "club-a", name: "A", tenantId: "tenant-1", status: "active" }],
      };
    },
  });
  const result = await repo.listClubsForCurrentScope({
    user: { id: "admin", role: "SUPER_ADMIN" },
    isPlatformWide: true,
    operationalOnly: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.length, 1);
});

test("I/J. Club tenantId and venueId stay distinct — no projection cross-fill", () => {
  const club = normalizeClub({
    id: "club-1",
    name: "Club",
    tenantId: "tenant-canonical",
  });
  assert.equal(club.tenantId, "tenant-canonical");
  assert.equal(club.venueId, null);

  const fromVenueOnly = normalizeClub({
    id: "club-2",
    name: "Club",
    venueId: "venue-legacy",
  });
  assert.equal(fromVenueOnly.tenantId, null);
  assert.equal(fromVenueOnly.venueId, "venue-legacy");

  const ready = normalizeCanonicalActiveClub({
    id: "club-1",
    tenantId: "tenant-canonical",
    venueId: "venue-legacy",
  });
  assert.equal(ready.tenantId, "tenant-canonical");
  assert.equal(ready.venueId, "venue-legacy");
  assert.notEqual(ready.tenantId, ready.venueId);
  assert.equal(resolveExplicitTenantFromCanonicalClub({ venueId: "venue-only" }), null);
  assert.equal(resolveClubOperationalTenantId({ venueId: "venue-only" }), null);
});

test("K. usePageRuntimeAccess source forbids activeClubId as tenant fallback", () => {
  const src = readSrc("src/components/shell/usePageRuntimeAccess.js");
  assert.match(
    src,
    /const resolvedTenantId = tenantId \|\| activeClub\?\.tenantId \|\| user\?\.tenantId \|\| null;/
  );
  assert.doesNotMatch(src, /activeClub\?\.venueId \|\| user\?\.venueId \|\| activeClubId/);
  assert.doesNotMatch(src, /tenantId \|\| activeClub\?\.tenantId \|\| activeClub\?\.venueId/);
});

test("L. legacy RPC shape translates Venue scope → canonical Tenant", () => {
  const venues = {
    "venue-legacy-1": { id: "venue-legacy-1", tenantId: "tenant-canonical-1" },
  };
  const translated = translateLegacyClubVenueScope(
    { id: "club-1", tenant_id: "venue-legacy-1" },
    { resolveVenue: (id) => venues[id] || null }
  );
  assert.equal(translated.scopeSemantics, CLUB_SCOPE_SEMANTICS.LEGACY_VENUE_SCOPE);
  assert.equal(translated.tenantId, "tenant-canonical-1");
  assert.equal(translated.venueId, "venue-legacy-1");
  assert.notEqual(translated.tenantId, translated.venueId);
  assert.equal(detectClubRowScopeSemantics({ tenant_id: "venue-legacy-1" }), CLUB_SCOPE_SEMANTICS.LEGACY_VENUE_SCOPE);
});

test("M. future canonical RPC shape uses canonical Tenant directly", () => {
  const translated = translateLegacyClubVenueScope(
    {
      id: "club-1",
      tenant_id: "tenant-canonical-1",
      scope_semantics: "canonical_platform_tenant",
      canonical_tenant_id: "tenant-canonical-1",
    },
    { resolveVenue: () => ({ id: "should-not-be-used", tenantId: "wrong" }) }
  );
  assert.equal(translated.scopeSemantics, CLUB_SCOPE_SEMANTICS.CANONICAL_PLATFORM_TENANT);
  assert.equal(translated.tenantId, "tenant-canonical-1");
  assert.equal(translated.venueId, null);
});

test("N/P. unresolved Club does not become [] tournament/AI data", () => {
  assert.throws(() => listTournaments(), (err) => err.code === "CLUB_REQUIRED");
  assert.throws(() => loadAIData(), (err) => err.code === "CLUB_REQUIRED");
  const domain = readSrc("src/domain/tournamentService.js");
  assert.doesNotMatch(domain, /listTournaments\(clubId = getActiveClubId/);
  const ai = readSrc("src/ai/storage.js");
  assert.doesNotMatch(ai, /loadAIData\(clubId = getActiveClubId/);
});

test("O. Tournament Home and hub use PlatformContextReadinessGate", () => {
  const home = readSrc("src/pages/tournament/TournamentHome.jsx");
  const hub = readSrc("src/features/tournament/pages/CanonicalTournamentHubPage.jsx");
  assert.match(home, /PlatformContextReadinessGate/);
  assert.match(hub, /PlatformContextReadinessGate/);
  assert.match(hub, /contextReady \? activeClub : null/);
});

test("Q. cloud mode does not silently use blob as Production authority", () => {
  assert.equal(
    isCanonicalClubReadEnabled({ canonicalEnabled: true, hasSupabase: true }),
    true
  );
  assert.equal(
    isCanonicalClubReadEnabled({ canonicalEnabled: true, hasSupabase: false }),
    false
  );
  const ctx = readSrc("src/context/ClubContext.jsx");
  assert.match(ctx, /canonicalClubRepository/);
  assert.match(ctx, /GLOBAL DIRECTORY/);
});

test("R. no-cloud local compatibility still works without default-club fabrication", () => {
  globalThis.localStorage = createLocalStorageMock();
  saveClubs([{ id: "local-1", name: "Local Club", tenantId: "tenant-1" }]);
  setActiveClubId("local-1");
  assert.equal(loadClubs().length, 1);
  assert.equal(loadClubs()[0].id, "local-1");
  assert.equal(getActiveClubIdPreference(), "local-1");
  assert.equal(getActiveClub().id, "local-1");
  assert.equal(loadClubs().some((c) => c.id === DEFAULT_CLUB.id), false);
});

test("mapV2ClubToUiClub uses translator — no tenant_id copied to both fields", () => {
  const mapped = mapV2ClubToUiClub(
    { id: "club-1", name: "A", tenant_id: "venue-legacy-1", status: "active", version: 1 },
    { resolveVenue: (id) => ({ id, tenantId: "tenant-canonical-1" }) }
  );
  assert.equal(mapped.tenantId, "tenant-canonical-1");
  assert.equal(mapped.venueId, "venue-legacy-1");
  assert.notEqual(mapped.tenantId, mapped.venueId);
});

test("canonical repository translates legacy RPC rows with injected venue resolver", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    resolveVenueById: (id) =>
      id === "venue-legacy-1" ? { id: "venue-legacy-1", tenantId: "tenant-canonical-1" } : null,
    listRegistryRpc: async () => ({
      ok: true,
      clubs: [{ id: "club-a", name: "A", tenant_id: "venue-legacy-1", status: "active" }],
    }),
  });
  const result = await repo.listClubsForTenant("tenant-canonical-1", {
    userContext: { isPlatformAdmin: true },
  });
  assert.equal(result.ok, true);
  assert.equal(result.data[0].tenantId, "tenant-canonical-1");
  assert.equal(result.data[0].venueId, "venue-legacy-1");
});

test("Wave5 docs do not claim PC_CLUB_01 closed or SQL applied", () => {
  const readme = readSrc("docs/platform-core-wave5-club-context-closure/README.md");
  assert.match(readme, /PC_CLUB_01=OPEN_PENDING_ACCEPTANCE/);
  assert.match(readme, /SQL_EXECUTED=NO/);
  assert.match(readme, /ROUND2_BLOCKER_01=REMEDIATED/);
  assert.match(readme, /SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW/);
  assert.match(readme, /SQL_DESIGN_REVIEW_ROUND3_REMEDIATION=COMPLETE_PENDING_ROUND4_OWNER_REVIEW/);
  assert.match(readme, /ROUND3_BLOCKER_01_INTERNAL_HELPER_PRIVILEGE=FIXED/);
  assert.doesNotMatch(readme, /\*\*PC_CLUB_01=CLOSED\*\*/);
  assert.doesNotMatch(readme, /SQL_APPLIED=/);
});

test("F. Club governance app path never sends venueId=tenantId", () => {
  const governance = readSrc("src/features/club/services/clubGovernanceService.js");
  const panel = readSrc("src/pages/clubs/ClubGovernancePanel.jsx");
  const list = readSrc("src/pages/clubs/ClubListPage.jsx");
  const nav = readSrc("src/features/club/navigation/clubNavMatrix.js");
  const tenant = readSrc("src/features/club/services/clubTenantService.js");
  const guard = readSrc("src/auth/guardAction.js");
  const venueOwner = readSrc("src/features/club/services/venueOwnerClubService.js");
  const registry = readSrc("src/features/club/services/clubRegistryCloudService.js");
  const membership = readSrc("src/features/club/services/clubMembershipRequestService.js");
  assert.doesNotMatch(governance, /venueId:\s*tenantId/);
  assert.doesNotMatch(panel, /venueId:\s*tenantId/);
  assert.doesNotMatch(list, /venueId:\s*currentTenantId/);
  assert.doesNotMatch(nav, /venueId:\s*tenantId/);
  assert.doesNotMatch(tenant, /venueId:\s*tenantId/);
  assert.doesNotMatch(guard, /venueId:\s*meta\?\.venueId\s*\|\|\s*tenantId/);
  assert.match(guard, /venueId:\s*meta\?\.venueId\s*\|\|\s*null/);
  assert.doesNotMatch(venueOwner, /tenantId:\s*venueId/);
  assert.doesNotMatch(venueOwner, /user\.venueId\s*\|\|\s*user\.tenantId/);
  assert.doesNotMatch(registry, /tenantId:\s*cloudVenueId/);
  assert.doesNotMatch(membership, /club\.venueId\s*\|\|\s*club\.tenantId/);
});

test("G. Club write authz uses canonical Tenant scope", () => {
  const scope = readSrc("src/features/identity/constants/permissionScope.js");
  const rbac = readSrc("src/auth/rbac.js");
  const tenant = readSrc("src/features/club/services/clubTenantService.js");
  assert.match(scope, /TENANT:\s*"tenant"/);
  assert.match(scope, /CLUB_CREATE\]:\s*PERMISSION_SCOPE\.TENANT/);
  assert.match(rbac, /function matchesTenantScope/);
  assert.match(rbac, /PERMISSION_SCOPE\.TENANT/);
  assert.match(tenant, /tenantId \? \{ tenantId \} : \{\}/);
  assert.doesNotMatch(tenant, /venueId:\s*tenantId,\s*tenantId/);
});

test("J. no Contract A change in Wave 5 package", () => {
  const readme = readSrc("docs/platform-core-wave5-club-context-closure/README.md");
  assert.match(readme, /Frozen Competition Contracts 01–16/);
  assert.match(readme, /SEPARATE_COMPETITION_AUTHORITY_GAP=NO/);
  assert.match(readme, /DEAD_CODE_ONLY/);
  assert.match(readme, /AUDIT_METADATA_ONLY/);
});
