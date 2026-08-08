/**
 * INTERNAL-TOURNAMENT-CANONICAL-SCOPE-REMEDIATION-01
 *
 * Owner browser failure:
 *   /tournament/internal/b90c272a-e7a0-483a-994d-fc4aa8f6c88b
 *   "CLB chưa có tenant hợp lệ — không dùng default-tenant."
 *
 * Root cause: ID-only fallback `{ id: tournamentClubId }` into useCanonicalTournament
 * when activeClub was not ready.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  INTERNAL_SETUP_CLUB_NOT_READY,
  resolveInternalSetupCanonicalClubScope,
  resolveInternalSetupRuntimeClubId,
  shouldAlignActiveClubToPersistedTournament,
} from "../src/features/tournament/pages/internalTournamentSetupScope.js";
import {
  requireExplicitTournamentTenant,
  resolveTournamentTenantScope,
} from "../src/features/tournament/guards/tournamentTenant.js";
import { getTournamentQuery } from "../src/features/tournament/services/tournamentQueries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PROD_TOURNAMENT_ID = "b90c272a-e7a0-483a-994d-fc4aa8f6c88b";
const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
const PROD_TENANT_ID = "venue-prod-main";

const PROD_ACTIVE_CLUB = {
  id: PROD_CLUB_ID,
  clubId: PROD_CLUB_ID,
  tenantId: PROD_TENANT_ID,
  venueId: PROD_TENANT_ID,
  name: "CLB ACCC",
};

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("internal-tournament-canonical-scope-remediation-01", () => {
  it("BEFORE pattern: ID-only scope hits exact Owner tenant error", () => {
    const idOnly = { id: PROD_CLUB_ID };
    const scope = resolveTournamentTenantScope(idOnly);
    assert.equal(scope.ok, false);
    assert.match(String(scope.error || ""), /không dùng default-tenant/);

    const explicit = requireExplicitTournamentTenant({
      clubId: PROD_CLUB_ID,
      tenantId: null,
    });
    assert.equal(explicit.ok, false);
    assert.match(String(explicit.error || ""), /không dùng default-tenant/);
  });

  it("AFTER: activeClubReady=false → no canonical query / no tenant error", async () => {
    const resolved = resolveInternalSetupCanonicalClubScope({
      activeClubReady: false,
      clubReadReady: true,
      activeClub: null,
    });
    assert.equal(resolved.ok, false);
    assert.equal(resolved.shouldQuery, false);
    assert.equal(resolved.scope, null);
    assert.equal(resolved.code, "CLUB_NOT_READY");
    assert.equal(resolved.error, INTERNAL_SETUP_CLUB_NOT_READY);
    assert.equal(String(resolved.error || "").includes("default-tenant"), false);

    // Simulate hook contract: null scope ⇒ no cloud get issued.
    let rpcCalls = 0;
    const result = await getTournamentQuery(null, PROD_TOURNAMENT_ID, {
      tenantId: null,
      repository: {
        async get() {
          rpcCalls += 1;
          return { ok: true, tournament: { id: PROD_TOURNAMENT_ID } };
        },
      },
    });
    assert.equal(rpcCalls, 0);
    assert.equal(result.ok, false);
    assert.equal(String(result.error || "").includes("default-tenant"), false);
  });

  it("AFTER: ready ACCC activeClub loads scope successfully (no tenant error)", async () => {
    const resolved = resolveInternalSetupCanonicalClubScope({
      activeClubReady: true,
      clubReadReady: true,
      activeClub: PROD_ACTIVE_CLUB,
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.shouldQuery, true);
    assert.equal(resolved.clubId, PROD_CLUB_ID);
    assert.equal(resolved.tenantId, PROD_TENANT_ID);
    assert.equal(resolved.scope, PROD_ACTIVE_CLUB);

    const tenantScope = resolveTournamentTenantScope(resolved.scope);
    assert.equal(tenantScope.ok, true);
    assert.equal(tenantScope.tenantId, PROD_TENANT_ID);

    let rpcCalls = 0;
    const result = await getTournamentQuery(resolved.scope, PROD_TOURNAMENT_ID, {
      repository: {
        async get(clubId, tournamentId, options) {
          rpcCalls += 1;
          assert.equal(clubId, PROD_CLUB_ID);
          assert.equal(tournamentId, PROD_TOURNAMENT_ID);
          assert.equal(options.tenantId, PROD_TENANT_ID);
          return {
            ok: true,
            tournament: {
              id: PROD_TOURNAMENT_ID,
              clubId: PROD_CLUB_ID,
              tenantId: PROD_TENANT_ID,
              mode: "internal_tournament",
              status: "draft",
              name: "Giải nội bộ 8/8/2026",
            },
          };
        },
      },
    });
    assert.equal(rpcCalls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.tournament.id, PROD_TOURNAMENT_ID);
    assert.equal(String(result.error || "").includes("default-tenant"), false);
  });

  it("never builds id-override scope that keeps foreign tenant", () => {
    const resolved = resolveInternalSetupCanonicalClubScope({
      activeClubReady: true,
      clubReadReady: true,
      activeClub: PROD_ACTIVE_CLUB,
    });
    assert.equal(resolved.scope.id, PROD_CLUB_ID);
    assert.equal(resolved.scope.tenantId, PROD_TENANT_ID);
    // Explicitly reject the removed anti-pattern.
    const antiPattern = {
      ...PROD_ACTIVE_CLUB,
      id: "club-other-without-alignment",
    };
    assert.notEqual(resolved.scope.id, antiPattern.id);
  });

  it("runtime club id prefers persisted tournament.clubId", () => {
    assert.equal(
      resolveInternalSetupRuntimeClubId({
        persistedClubId: PROD_CLUB_ID,
        activeClubId: "club-other",
      }),
      PROD_CLUB_ID
    );
    assert.equal(
      resolveInternalSetupRuntimeClubId({
        persistedClubId: "",
        activeClubId: PROD_CLUB_ID,
      }),
      PROD_CLUB_ID
    );
  });

  it("aligns active club only when persisted host differs", () => {
    assert.equal(
      shouldAlignActiveClubToPersistedTournament({
        activeClubReady: true,
        activeClubId: PROD_CLUB_ID,
        persistedClubId: PROD_CLUB_ID,
      }),
      false
    );
    assert.equal(
      shouldAlignActiveClubToPersistedTournament({
        activeClubReady: true,
        activeClubId: "club-other",
        persistedClubId: PROD_CLUB_ID,
      }),
      true
    );
    assert.equal(
      shouldAlignActiveClubToPersistedTournament({
        activeClubReady: false,
        activeClubId: "club-other",
        persistedClubId: PROD_CLUB_ID,
      }),
      false
    );
  });

  it("static: Internal setup has zero ID-only canonical scope / legacy club lookup authority", () => {
    const src = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(src, /activeClubReady/);
    assert.match(src, /clubReadReady/);
    assert.match(src, /resolveInternalSetupCanonicalClubScope/);
    assert.match(src, /useCanonicalTournament\(\s*\n?\s*clubScope\.shouldQuery \? clubScope\.scope : null/);
    assert.equal(src.includes("findTournamentClubId"), false);
    assert.equal(src.includes("{ id: tournamentClubId }"), false);
    assert.equal(src.includes("{ ...activeClub, id:"), false);
    assert.equal(src.includes("default-tenant"), false);
    assert.equal(src.includes("venue-prod-main"), false);
    assert.equal(/localStorage/.test(src), false);

    // Founder / private pairing RBAC left intact.
    assert.match(src, /FounderPairingConstraintsPanel/);
    assert.match(src, /guardFounderConstraints/);
  });

  it("static: Daily/Official still use activeClub directly (regression lock)", () => {
    const daily = readSrc("src/pages/tournament/DailyPlaySetup.jsx");
    const official = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(daily, /useCanonicalTournament\(activeClub,/);
    assert.match(official, /useCanonicalTournament\(activeClub,/);
    assert.equal(daily.includes("{ id: tournamentClubId }"), false);
    assert.equal(official.includes("{ id: tournamentClubId }"), false);
  });
});
