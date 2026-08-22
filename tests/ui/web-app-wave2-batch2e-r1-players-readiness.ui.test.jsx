/**
 * Batch 2E-R1 — Players live blank-screen regression (readiness).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Players from "../../src/pages/Players.jsx";
import theme from "../../src/theme/theme.js";

const authState = vi.hoisted(() => ({
  user: { id: "u1", role: "CLUB_MANAGER", displayName: "Manager" },
  can: () => true,
  authLoading: false,
  isAuthenticated: true,
  rbacEnabled: true,
}));

const clubState = vi.hoisted(() => ({
  activeClubId: null,
  activeClub: null,
  activeClubReady: false,
  clubs: [],
  revision: 0,
  canonicalClubRead: true,
  clubReadState: "ready",
  clubReadReady: true,
  clubReadError: null,
}));

const readinessState = vi.hoisted(() => ({
  state: "CLUB_REQUIRED",
  message: "Can chon CLB truoc khi xem danh sach nguoi choi.",
}));

const getTodayCheckedInPlayerIds = vi.hoisted(() =>
  vi.fn(() => {
    throw Object.assign(new Error("CLUB_REQUIRED"), {
      name: "ClubContextError",
      code: "CLUB_REQUIRED",
    });
  })
);

const loadPlayersFromStorage = vi.hoisted(() =>
  vi.fn(() => {
    throw Object.assign(new Error("CLUB_REQUIRED"), {
      name: "ClubContextError",
      code: "CLUB_REQUIRED",
    });
  })
);

const loadPlayersForClub = vi.hoisted(() =>
  vi.fn(() => {
    throw Object.assign(new Error("CLUB_REQUIRED"), {
      name: "ClubContextError",
      code: "CLUB_REQUIRED",
    });
  })
);

const getPlatformAthletes = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, players: [], warning: null }))
);

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => authState,
}));

vi.mock("../../src/context/ClubContext.jsx", () => ({
  useClub: () => clubState,
}));

vi.mock("../../src/context/TenantContext.jsx", () => ({
  useTenant: () => ({
    currentTenantId: "tenant-1",
    tenantCheck: { status: "ready" },
    canSwitchTenant: false,
    isSuperAdmin: false,
  }),
}));

vi.mock("../../src/context/VenueContext.jsx", () => ({
  useVenue: () => ({
    currentVenueId: null,
    venues: [],
    venueCheck: { status: "ready" },
  }),
}));

vi.mock("../../src/components/shell/usePlatformContextReadiness.js", () => ({
  usePlatformContextReadiness: () => readinessState,
}));

vi.mock("../../src/utils/playerHelpers.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getTodayCheckedInPlayerIds,
    computePlayerDashboardStats: () => ({
      total: 0,
      male: 0,
      female: 0,
      avgLevel: 0,
      checkedInToday: 0,
      active: 0,
      inactive: 0,
      locked: 0,
    }),
  };
});

vi.mock("../../src/pages/selectPlayers.data", () => ({
  loadPlayersFromStorage,
}));

vi.mock("../../src/domain/clubStorage.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadPlayersForClub,
    savePlayersForClub: vi.fn(),
  };
});

vi.mock("../../src/features/club/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getPlatformAthletes,
  };
});

vi.mock("../../src/features/club/repositories/canonicalPlayerPickerAdapter.js", () => ({
  listPlayersForClubAware: vi.fn(async () => ({ ok: false })),
}));

vi.mock("../../src/features/club/config/canonicalRepositoryFlags.js", () => ({
  isCanonicalPlayerRepositoryEnabled: () => false,
}));

vi.mock("../../src/components/players/PlayerStats.jsx", () => ({
  default: function MockPlayerStats() {
    return <div data-testid="player-stats-stub" />;
  },
}));

vi.mock("../../src/features/player/utils/qaTestIdentityFilter.js", () => ({
  excludeQaTestIdentitiesWithAuthority: async (rows) => ({ rows }),
}));

function renderPlayers() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <Players />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("2E-R1 Players readiness (live blank-screen regression)", () => {
  beforeEach(() => {
    getTodayCheckedInPlayerIds.mockReset();
    loadPlayersFromStorage.mockReset();
    loadPlayersForClub.mockReset();
    getPlatformAthletes.mockReset();
    getTodayCheckedInPlayerIds.mockImplementation(() => {
      throw Object.assign(new Error("CLUB_REQUIRED"), {
        name: "ClubContextError",
        code: "CLUB_REQUIRED",
      });
    });
    loadPlayersFromStorage.mockImplementation(() => {
      throw Object.assign(new Error("CLUB_REQUIRED"), {
        name: "ClubContextError",
        code: "CLUB_REQUIRED",
      });
    });
    loadPlayersForClub.mockImplementation(() => {
      throw Object.assign(new Error("CLUB_REQUIRED"), {
        name: "ClubContextError",
        code: "CLUB_REQUIRED",
      });
    });

    authState.user = { id: "u1", role: "CLUB_MANAGER", displayName: "Manager" };
    authState.can = () => true;
    authState.authLoading = false;
    authState.isAuthenticated = true;
    authState.rbacEnabled = true;

    clubState.activeClubId = null;
    clubState.activeClub = null;
    clubState.activeClubReady = false;
    clubState.clubs = [];
    clubState.revision = 0;

    readinessState.state = "CLUB_REQUIRED";
    readinessState.message = "Can chon CLB truoc khi xem danh sach nguoi choi.";
  });

  it("CASE 1: pending/absent club -> no club-scoped helper, no throw, readiness UI", () => {
    expect(() => renderPlayers()).not.toThrow();
    expect(screen.getByTestId("platform-context-required")).toBeInTheDocument();
    expect(screen.queryByTestId("players-ready-content")).not.toBeInTheDocument();
    expect(getTodayCheckedInPlayerIds).not.toHaveBeenCalled();
    expect(loadPlayersFromStorage).not.toHaveBeenCalled();
    expect(loadPlayersForClub).not.toHaveBeenCalled();
  });

  it("CASE 2: valid clubId -> ready content mounts and loads club roster", async () => {
    readinessState.state = "CONTEXT_READY";
    readinessState.message = "";
    clubState.activeClubId = "club-1";
    clubState.activeClub = { id: "club-1", name: "ACCC", tenantId: "tenant-1" };
    clubState.activeClubReady = true;
    clubState.clubs = [clubState.activeClub];

    getTodayCheckedInPlayerIds.mockImplementation((clubId) => {
      expect(clubId).toBe("club-1");
      return new Set();
    });
    loadPlayersFromStorage.mockImplementation((clubId) => {
      expect(clubId).toBe("club-1");
      return [{ id: 1, name: "An", level: 3.0, gender: "Nam" }];
    });

    expect(() => renderPlayers()).not.toThrow();
    expect(await screen.findByTestId("players-ready-content")).toBeInTheDocument();
    expect(getTodayCheckedInPlayerIds).toHaveBeenCalledWith("club-1");
    expect(loadPlayersFromStorage).toHaveBeenCalledWith("club-1");
  });

  it("CASE 3: platform-wide mode without club -> no CLUB_REQUIRED crash", async () => {
    authState.user = { id: "u-admin", role: "PLATFORM_ADMIN", displayName: "Platform" };
    readinessState.state = "CONTEXT_READY";
    readinessState.message = "";
    clubState.activeClubId = null;
    clubState.activeClub = null;
    clubState.activeClubReady = false;

    getTodayCheckedInPlayerIds.mockImplementation(() => new Set());
    loadPlayersForClub.mockImplementation(() => []);

    expect(() => renderPlayers()).not.toThrow();
    expect(await screen.findByTestId("players-ready-content")).toBeInTheDocument();
    expect(getPlatformAthletes).toHaveBeenCalled();
    expect(getTodayCheckedInPlayerIds).not.toHaveBeenCalled();
    expect(loadPlayersFromStorage).not.toHaveBeenCalled();
  });

  it("CASE 4: club mode without resolved club -> no fake empty roster", () => {
    readinessState.state = "CLUB_REQUIRED";
    clubState.activeClubId = "";
    clubState.activeClub = null;

    renderPlayers();
    expect(screen.getByTestId("platform-context-required")).toBeInTheDocument();
    expect(screen.queryByTestId("players-ready-content")).not.toBeInTheDocument();
    expect(loadPlayersFromStorage).not.toHaveBeenCalled();
    expect(loadPlayersForClub).not.toHaveBeenCalled();
  });
});
