/**
 * Wave 1 — mounted AuthProvider / TenantProvider / ClubProvider F5 lifecycle.
 * Pure simulateF5ClubPreferenceLifecycle is insufficient; this mounts real providers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";

import { AUTH_SESSION_KEY } from "../../src/auth/config.js";
import {
  getActiveClubIdPreference,
  setActiveClubIdPreference,
} from "../../src/data/club.js";
import { saveActiveTenantId } from "../../src/data/tenantSession.js";
import { CLUB_READ_STATE } from "../../src/features/club/context/clubCanonicalReadModel.js";
import { PLATFORM_CONTEXT_STATE } from "../../src/core/platform/app/platformContextReadiness.js";

const SUPER_ADMIN = {
  id: "user-sa-1",
  role: "SUPER_ADMIN",
  email: "sa@example.com",
  status: "active",
};

const CLUB_A = {
  id: "club-a",
  name: "CLB Venue Staging A",
  tenantId: "tenant-a",
  venueId: "tenant-a",
  status: "active",
};

const CLUB_A2 = {
  id: "club-a2",
  name: "CLB Venue Staging A2",
  tenantId: "tenant-a",
  venueId: "tenant-a",
  status: "active",
};

let clubListResolver = null;

vi.mock("../../src/auth/supabaseClient.js", () => ({
  hasSupabaseConfig: () => true,
  getSupabaseConfigError: () => null,
  getSupabaseAuthClient: () => null,
}));

vi.mock("../../src/features/club/config/canonicalRepositoryFlags.js", () => ({
  isCanonicalClubRepositoryEnabled: () => true,
  isCanonicalPlayerRepositoryEnabled: () => false,
  CANONICAL_REPOSITORY_FLAG_KEYS: { CLUB: "VITE_CANONICAL_CLUB_REPOSITORY_ENABLED" },
  readCanonicalFlag: () => true,
}));

vi.mock("../../src/auth/authService.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    restoreSupabaseSession: vi.fn(async () => {
      const { saveAuthSessionFromCloudProfile } = await import(
        "../../src/auth/authStorage.js"
      );
      saveAuthSessionFromCloudProfile(SUPER_ADMIN, { provider: "supabase" });
      return { ok: true, user: SUPER_ADMIN, provider: "supabase" };
    }),
    subscribeToSupabaseAuth: () => () => {},
  };
});

vi.mock("../../src/features/club/repositories/index.js", () => ({
  canonicalClubRepository: {
    listClubsForCurrentScope: vi.fn(
      () =>
        new Promise((resolve) => {
          clubListResolver = resolve;
        })
    ),
  },
}));

vi.mock("../../src/auth/clubScopeResolver.js", () => ({
  hydrateClubScope: async () => ({ ok: true }),
  clearClubScope: () => {},
}));

vi.mock("../../src/auth/governanceScopeResolver.js", () => ({
  hydrateGovernanceScope: async () => ({ ok: true }),
  clearGovernanceScope: () => {},
}));

vi.mock("../../src/features/tenant/services/profileVenueService.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hydrateProfileVenueToLocalRegistry: async () => ({ ok: true, hydrated: false }),
    hydrateSupabaseVenuesToLocalRegistry: async () => ({
      ok: true,
      tenantIds: ["tenant-a"],
    }),
  };
});

describe("Wave1 mounted provider F5 club preference lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    clubListResolver = null;
    process.env.VITE_RBAC_ENABLED = "true";
    localStorage.setItem("pickleball-storage-schema-version", "42");
    localStorage.setItem(
      "pickleball-clubs-v1",
      JSON.stringify([{ id: "default-club", name: "CLB Mac dinh", isDefault: true }])
    );
    localStorage.setItem(
      "pickleball-venues-v1",
      JSON.stringify([{ id: "tenant-a", name: "Venue Staging A", status: "active" }])
    );
    // Leftover "dev" session — Auth bootstrap IDENTITY_REPLACE must keep club hint.
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        user: SUPER_ADMIN,
        provider: "dev",
        loggedInAt: new Date().toISOString(),
      })
    );
    saveActiveTenantId("tenant-a", SUPER_ADMIN.id);
    setActiveClubIdPreference("club-a");
  });

  it("preserves Club A through auth identity replace + LOADING → READY (N clubs)", async () => {
    const snaps = [];
    const { AuthProvider } = await import("../../src/context/AuthContext.jsx");
    const { TenantProvider } = await import("../../src/context/TenantContext.jsx");
    const { ClubProvider, useClub } = await import("../../src/context/ClubContext.jsx");
    const { usePlatformContextReadiness } = await import(
      "../../src/components/shell/usePlatformContextReadiness.js"
    );

    function LiveProbe() {
      const club = useClub();
      const readiness = usePlatformContextReadiness({ requireClub: true });
      useEffect(() => {
        snaps.push({
          preference: getActiveClubIdPreference(),
          activeClubId: club.activeClubId,
          clubReadState: club.clubReadState,
          readyState: readiness.state,
        });
      }, [club.activeClubId, club.clubReadState, readiness.state]);
      return <div data-testid="probe" />;
    }

    render(
      <AuthProvider>
        <TenantProvider>
          <ClubProvider>
            <LiveProbe />
          </ClubProvider>
        </TenantProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getActiveClubIdPreference()).toBe("club-a");
    });

    await waitFor(() => {
      expect(typeof clubListResolver).toBe("function");
    });

    expect(getActiveClubIdPreference()).toBe("club-a");

    clubListResolver({
      ok: true,
      data: [CLUB_A, CLUB_A2],
    });

    await waitFor(() => {
      const last = snaps[snaps.length - 1];
      expect(last?.clubReadState).toBe(CLUB_READ_STATE.READY);
      expect(last?.activeClubId).toBe("club-a");
      expect(getActiveClubIdPreference()).toBe("club-a");
      expect(last?.readyState).toBe(PLATFORM_CONTEXT_STATE.CONTEXT_READY);
    });

    const wipedWhileLoading = snaps.some(
      (s) =>
        s.clubReadState === CLUB_READ_STATE.LOADING &&
        !s.preference &&
        !s.activeClubId
    );
    expect(wipedWhileLoading).toBe(false);
  });
});
