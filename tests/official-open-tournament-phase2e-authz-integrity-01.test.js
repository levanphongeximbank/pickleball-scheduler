/**
 * Phase 2E authorization integrity — same-principal no-flicker vs fail-closed authz.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildAuthorizationPrincipalFingerprint,
  authorizationPrincipalChanged,
  shouldSkipAuthUiRefreshOnTokenEvent,
} from "../src/auth/authorizationPrincipalFingerprint.js";
import { resolveCanonicalTournamentLoadPolicy } from "../src/features/tournament/index.js";
import { resolvePairingCandidatePoolScopePolicy } from "../src/features/pairing-candidates/index.js";

function read(path) {
  return readFileSync(path, "utf8");
}

function principal(overrides = {}) {
  return {
    id: "user-1",
    role: "CLUB_OWNER",
    status: "active",
    tenantId: "tenant-a",
    venueId: "tenant-a",
    clubId: "club-a",
    tournamentId: null,
    teamId: null,
    playerId: null,
    assignedClusterIds: [],
    ...overrides,
  };
}

describe("official-open-tournament-phase2e-authz-integrity", () => {
  it("A — same user + same authz + TOKEN_REFRESHED skips UI refresh", () => {
    const user = principal();
    const fp = buildAuthorizationPrincipalFingerprint(user, { rbacEnabled: true });
    const skip = shouldSkipAuthUiRefreshOnTokenEvent({
      event: "TOKEN_REFRESHED",
      previousFingerprint: fp,
      nextUser: { ...user },
      rbacEnabled: true,
    });
    assert.equal(skip, true);

    const auth = read("src/context/AuthContext.jsx");
    assert.match(auth, /shouldSkipAuthUiRefreshOnTokenEvent/);
    assert.match(auth, /subscribeToSupabaseAuth/);
    const service = read("src/auth/authService.js");
    assert.match(service, /client\.auth\.onAuthStateChange/);
    assert.match(service, /syncSupabaseUser\(session\.user/);

    const club = read("src/context/ClubContext.jsx");
    assert.match(club, /userSecurityScopeKey/);
    assert.match(club, /buildUserSecurityScopeKey\(user\)/);
    assert.doesNotMatch(
      club,
      /hydrateClubScope[\s\S]{0,500}\}, \[isAuthenticated, user, currentTenantId/
    );
  });

  it("B — same user.id + tenant/venue change must not skip rehydrate", () => {
    const prev = buildAuthorizationPrincipalFingerprint(principal(), { currentTenantId: "tenant-a" });
    const next = buildAuthorizationPrincipalFingerprint(
      principal({ tenantId: "tenant-b", venueId: "tenant-b" }),
      { currentTenantId: "tenant-b" }
    );
    assert.equal(authorizationPrincipalChanged(prev, next), true);
    assert.equal(
      shouldSkipAuthUiRefreshOnTokenEvent({
        event: "TOKEN_REFRESHED",
        previousFingerprint: prev,
        nextUser: principal({ tenantId: "tenant-b", venueId: "tenant-b" }),
        currentTenantId: "tenant-b",
      }),
      false
    );

    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "club-b",
      tournamentId: "t1",
      tenantId: "tenant-b",
      prevClubId: "club-a",
      prevTournamentId: "t1",
      prevTenantId: "tenant-a",
      hasUsableTournament: true,
      usableTournamentId: "t1",
      authzFingerprint: next,
      prevAuthzFingerprint: prev,
    });
    assert.equal(policy.clearTournament, true);
    assert.equal(policy.identityChanged, true);
  });

  it("C — same user.id + role/status change refreshes auth context", () => {
    const prev = buildAuthorizationPrincipalFingerprint(principal());
    const roleChanged = buildAuthorizationPrincipalFingerprint(principal({ role: "PLAYER" }));
    const statusChanged = buildAuthorizationPrincipalFingerprint(
      principal({ status: "suspended" })
    );
    assert.equal(authorizationPrincipalChanged(prev, roleChanged), true);
    assert.equal(authorizationPrincipalChanged(prev, statusChanged), true);
    assert.equal(
      shouldSkipAuthUiRefreshOnTokenEvent({
        event: "TOKEN_REFRESHED",
        previousFingerprint: prev,
        nextUser: principal({ role: "PLAYER" }),
      }),
      false
    );
    assert.equal(
      shouldSkipAuthUiRefreshOnTokenEvent({
        event: "USER_UPDATED",
        previousFingerprint: prev,
        nextUser: principal(),
      }),
      false
    );
  });

  it("D — SIGNED_OUT / empty principal fails closed", () => {
    const prev = buildAuthorizationPrincipalFingerprint(principal());
    assert.equal(
      shouldSkipAuthUiRefreshOnTokenEvent({
        event: "SIGNED_OUT",
        previousFingerprint: prev,
        nextUser: null,
      }),
      false
    );
    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "",
      tournamentId: "t1",
      tenantId: "",
      prevClubId: "club-a",
      prevTournamentId: "t1",
      prevTenantId: "tenant-a",
      hasUsableTournament: true,
      usableTournamentId: "t1",
      authzFingerprint: "",
      prevAuthzFingerprint: prev,
    });
    assert.equal(policy.mode, "hard-clear");
    assert.equal(policy.clearTournament, true);

    const auth = read("src/context/AuthContext.jsx");
    assert.match(auth, /handleSignOut/);
    assert.match(auth, /clearClubScope\(\)/);
    assert.match(auth, /clearGovernanceScope\(\)/);
    const service = read("src/auth/authService.js");
    assert.match(service, /event === "SIGNED_OUT"/);
    assert.match(service, /clearAuthSession\(\)/);
  });

  it("E — different actor fingerprint is not skipped", () => {
    const prev = buildAuthorizationPrincipalFingerprint(principal());
    const other = principal({ id: "user-2", clubId: "club-other" });
    assert.equal(
      shouldSkipAuthUiRefreshOnTokenEvent({
        event: "SIGNED_IN",
        previousFingerprint: prev,
        nextUser: other,
      }),
      false
    );
    assert.equal(
      authorizationPrincipalChanged(prev, buildAuthorizationPrincipalFingerprint(other)),
      true
    );
  });

  it("F — same-principal token rotation skips UI remount; session sync still runs", () => {
    const user = principal();
    const fp = buildAuthorizationPrincipalFingerprint(user);
    assert.equal(
      shouldSkipAuthUiRefreshOnTokenEvent({
        event: "TOKEN_REFRESHED",
        previousFingerprint: fp,
        nextUser: { ...user, displayName: "New Label" },
      }),
      true
    );
    const service = read("src/auth/authService.js");
    assert.match(service, /onAuthStateChange\(\(event, session\)/);
    assert.match(service, /syncSupabaseUser\(session\.user, \{ authEvent: event \}\)/);
    assert.doesNotMatch(
      read("src/context/AuthContext.jsx"),
      /if \(event === "TOKEN_REFRESHED"\) \{\s*return;/
    );
  });

  it("G — candidate pool: empty/real switch clears; same scope may keep", () => {
    assert.equal(
      resolvePairingCandidatePoolScopePolicy({ nextScopeId: "", prevScopeId: "tenant-a" }).keepPlayers,
      false
    );
    assert.equal(
      resolvePairingCandidatePoolScopePolicy({
        nextScopeId: "tenant-b",
        prevScopeId: "tenant-a",
      }).keepPlayers,
      false
    );
    assert.equal(
      resolvePairingCandidatePoolScopePolicy({
        nextScopeId: "tenant-a",
        prevScopeId: "tenant-a",
      }).keepPlayers,
      true
    );
    const pools = read("src/features/pairing-candidates/usePairingCandidatePools.js");
    assert.match(pools, /resolvePairingCandidatePoolScopePolicy/);
    assert.match(pools, /setPlayers\(\[\]\)/);
  });

  it("empty clubId without same fingerprint is not classified transient", () => {
    const policy = resolveCanonicalTournamentLoadPolicy({
      clubId: "",
      tournamentId: "t1",
      hasUsableTournament: true,
      usableTournamentId: "t1",
    });
    assert.equal(policy.mode, "hard-clear");
  });

  it("fingerprint ignores cosmetic fields", () => {
    const a = buildAuthorizationPrincipalFingerprint(principal({ displayName: "A", email: "a@x" }));
    const b = buildAuthorizationPrincipalFingerprint(principal({ displayName: "B", email: "b@x" }));
    assert.equal(a, b);
  });
});
