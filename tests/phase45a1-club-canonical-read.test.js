import test from "node:test";
import assert from "node:assert/strict";

import {
  CLUB_READ_STATE,
  filterAccessibleCanonicalClubs,
  isCanonicalClubReadEnabled,
  mapRepoCodeToClubError,
  resolveActiveClubSelection,
  toClubReadSnapshot,
} from "../src/features/club/context/clubCanonicalReadModel.js";
import { createCanonicalClubRepository } from "../src/features/club/repositories/index.js";
import {
  API_ERROR_CODES,
  isRegisteredApiErrorCode,
} from "../src/features/api/constants/apiErrors.js";
import { RULES, collectViolations } from "../scripts/ci/ownership-lock.mjs";

const CLUB_A = { id: "club-a", name: "Club A", tenant_id: "venue-1", status: "active" };
const CLUB_B = { id: "club-b", name: "Club B", tenant_id: "venue-1", status: "active" };
const CLUB_OTHER = {
  id: "club-other",
  name: "Other Tenant",
  tenant_id: "venue-2",
  status: "active",
};

// --- 1. canonical read mode gate (flag AND cloud) ---
test("isCanonicalClubReadEnabled requires both flag and Supabase backend", () => {
  assert.equal(isCanonicalClubReadEnabled({ canonicalEnabled: true, hasSupabase: true }), true);
  assert.equal(isCanonicalClubReadEnabled({ canonicalEnabled: true, hasSupabase: false }), false);
  assert.equal(isCanonicalClubReadEnabled({ canonicalEnabled: false, hasSupabase: true }), false);
  assert.equal(isCanonicalClubReadEnabled({}), false);
});

// --- 2. ClubContext/ClubSwitcher authorization filter parity ---
test("filterAccessibleCanonicalClubs returns all clubs when rbac/auth off", () => {
  const clubs = [{ id: "club-a" }, { id: "club-b" }];
  assert.deepEqual(
    filterAccessibleCanonicalClubs({
      clubs,
      user: null,
      rbacEnabled: false,
      isAuthenticated: false,
      canAccessClub: () => false,
    }),
    clubs
  );
});

test("filterAccessibleCanonicalClubs filters by canAccessClub when rbac on (multi-club)", () => {
  const clubs = [{ id: "club-a" }, { id: "club-b" }, { id: "club-c" }];
  const allowed = new Set(["club-a", "club-c"]);
  const visible = filterAccessibleCanonicalClubs({
    clubs,
    user: { id: "u1" },
    rbacEnabled: true,
    isAuthenticated: true,
    canAccessClub: (_user, clubId) => allowed.has(clubId),
  });
  assert.deepEqual(visible.map((c) => c.id), ["club-a", "club-c"]);
});

// --- 3 & 4. deterministic active-club selection / stale rejection ---
test("resolveActiveClubSelection keeps a valid preferred id", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: "club-b",
    visibleClubs: [{ id: "club-a" }, { id: "club-b" }],
  });
  assert.equal(sel.activeClubId, "club-b");
  assert.equal(sel.stale, false);
});

test("resolveActiveClubSelection rejects stale local-only id → clear (no first-of-many)", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: "club-local-only",
    visibleClubs: [{ id: "club-a" }, { id: "club-b" }],
  });
  assert.equal(sel.activeClubId, null);
  assert.equal(sel.activeClub, null);
  assert.equal(sel.stale, true);
});

test("resolveActiveClubSelection auto-selects only when exactly one club is visible", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: "club-local-only",
    visibleClubs: [{ id: "club-a" }],
  });
  assert.equal(sel.activeClubId, "club-a");
  assert.equal(sel.stale, true);
});

test("resolveActiveClubSelection clears selection when no clubs visible", () => {
  const sel = resolveActiveClubSelection({ preferredClubId: "club-a", visibleClubs: [] });
  assert.equal(sel.activeClubId, null);
  assert.equal(sel.activeClub, null);
});

// --- 5 & 6. read snapshot: loading/error never leaks legacy clubs ---
test("toClubReadSnapshot maps ok result to READY with clubs", () => {
  const snap = toClubReadSnapshot({ ok: true, data: [{ id: "club-a" }] });
  assert.equal(snap.state, CLUB_READ_STATE.READY);
  assert.equal(snap.clubs.length, 1);
  assert.equal(snap.errorCode, null);
});

test("toClubReadSnapshot maps a cloud error to ERROR with EMPTY clubs (no legacy fallback)", () => {
  const snap = toClubReadSnapshot({ ok: false, code: "CLUB_RPC_FAILED" });
  assert.equal(snap.state, CLUB_READ_STATE.ERROR);
  assert.deepEqual(snap.clubs, []);
  assert.equal(snap.errorCode, API_ERROR_CODES.INTERNAL_ERROR);
});

test("toClubReadSnapshot treats a null/absent result as INTERNAL_ERROR with empty clubs", () => {
  const snap = toClubReadSnapshot(null);
  assert.equal(snap.state, CLUB_READ_STATE.ERROR);
  assert.deepEqual(snap.clubs, []);
  assert.equal(snap.errorCode, API_ERROR_CODES.INTERNAL_ERROR);
});

// --- 8. error contract: only registered canonical codes ---
test("mapRepoCodeToClubError only ever returns registered canonical codes", () => {
  const codes = [
    "CLUB_OUT_OF_SCOPE",
    "CLUB_REQUIRED",
    "CLUB_ID_REQUIRED",
    "NOT_FOUND",
    "DEFAULT_CLUB_NOT_ALLOWED",
    "FORBIDDEN",
    "TENANT_FORBIDDEN",
    "CROSS_TENANT_ACCESS",
    "SOMETHING_UNKNOWN",
    undefined,
  ];
  for (const code of codes) {
    assert.equal(isRegisteredApiErrorCode(mapRepoCodeToClubError(code)), true);
  }
  assert.equal(mapRepoCodeToClubError("CLUB_OUT_OF_SCOPE"), API_ERROR_CODES.CLUB_OUT_OF_SCOPE);
  assert.equal(mapRepoCodeToClubError("TENANT_FORBIDDEN"), API_ERROR_CODES.FORBIDDEN);
  assert.equal(mapRepoCodeToClubError("SOMETHING_UNKNOWN"), API_ERROR_CODES.INTERNAL_ERROR);
});

// --- 6 (cont). repository listClubsForCurrentScope contract ---
test("listClubsForCurrentScope platform-wide reads whole registry (tenantId=null)", async () => {
  let seenTenantId = "unset";
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async ({ tenantId }) => {
      seenTenantId = tenantId;
      return { ok: true, clubs: [CLUB_A, CLUB_B, CLUB_OTHER] };
    },
  });
  const result = await repo.listClubsForCurrentScope({
    user: { id: "admin", role: "SUPER_ADMIN" },
    isPlatformWide: true,
  });
  assert.equal(result.ok, true);
  assert.equal(seenTenantId, null);
  assert.equal(result.data.length, 3);
});

test("listClubsForCurrentScope tenant-scoped user only sees own-tenant clubs", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({ ok: true, clubs: [CLUB_A, CLUB_B, CLUB_OTHER] }),
  });
  const result = await repo.listClubsForCurrentScope({
    user: { id: "u1", role: "CLUB_ADMIN", tenantId: "venue-1", venueId: "venue-1" },
    tenantId: "venue-1",
    rbacEnabled: true,
    isPlatformWide: false,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.map((c) => c.id).sort(), ["club-a", "club-b"]);
});

test("canonical mapper preserves governance/UI shape for ClubContext consumers", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({
      ok: true,
      clubs: [
        {
          ...CLUB_A,
          governance: { ownerUserId: "owner-1", presidentUserId: "pres-1" },
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  });
  const result = await repo.listClubsForCurrentScope({ isPlatformWide: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data[0].governance, {
    ownerUserId: "owner-1",
    presidentUserId: "pres-1",
  });
  assert.equal(result.data[0].createdAt, "2026-01-01T00:00:00.000Z");
});

test("cloud read error surfaces as error snapshot with no legacy leakage", async () => {
  const repo = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({ ok: false, code: "CLUB_RPC_FAILED", error: "boom" }),
    // Even if a legacy blob exists, it must NOT appear when the cloud read fails.
    loadLocalClubs: () => [CLUB_A, CLUB_B],
    listLocalClubsForTenant: () => [CLUB_A, CLUB_B],
  });
  const result = await repo.listClubsForCurrentScope({ isPlatformWide: true });
  assert.equal(result.ok, false);
  const snap = toClubReadSnapshot(result);
  assert.equal(snap.state, CLUB_READ_STATE.ERROR);
  assert.deepEqual(snap.clubs, []);
});

// --- 3 (cont). stale local-only club not displayed under cloud read ---
test("stale local-only club is neither visible nor selectable in cloud mode", () => {
  const canonicalClubs = [CLUB_A, CLUB_B].map((c) => ({ id: c.id, venueId: c.tenant_id }));
  const visible = filterAccessibleCanonicalClubs({
    clubs: canonicalClubs,
    user: { id: "u1" },
    rbacEnabled: true,
    isAuthenticated: true,
    canAccessClub: () => true,
  });
  assert.ok(!visible.some((c) => c.id === "club-local-ghost"));
  const sel = resolveActiveClubSelection({
    preferredClubId: "club-local-ghost",
    visibleClubs: visible,
  });
  assert.equal(sel.activeClubId, null);
  assert.equal(sel.stale, true);
});

// --- 9 & 15 & 16. CI ownership lock detects new UI Club-entity reads ---
test("ownership lock defines the club-entity-registry-read-in-ui rule", () => {
  const rule = RULES.find((r) => r.id === "club-entity-registry-read-in-ui");
  assert.ok(rule, "rule must exist");
  assert.deepEqual(rule.onlyIn, ["src/context/", "src/pages/", "src/components/"]);
});

test("ownership lock detects a NEW loadClubs()/registry RPC read but not loadClubData()", () => {
  const rule = RULES.find((r) => r.id === "club-entity-registry-read-in-ui");
  assert.equal(rule.match("const list = loadClubs();").length, 1);
  assert.equal(rule.match('localStorage.getItem("pickleball-clubs-v1")').length, 1);
  assert.equal(rule.match("await rpcV2ClubListRegistry({ tenantId });").length, 1);
  assert.equal(rule.match("await rpcV2ClubGet(id);").length, 1);
  // Must NOT flag the club-data domain read (players/courts blob).
  assert.equal(rule.match("const data = loadClubData(clubId);").length, 0);
});

test("ownership lock baseline records ClubContext legacy read as debt (not a new violation)", () => {
  const found = collectViolations();
  assert.ok(found.has("club-entity-registry-read-in-ui::src/context/ClubContext.jsx"));
});
