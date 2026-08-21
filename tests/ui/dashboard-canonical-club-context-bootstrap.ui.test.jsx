import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import Dashboard from "../../src/pages/Dashboard.jsx";
import theme from "../../src/theme/theme.js";
import { CLUB_READ_STATE } from "../../src/features/club/context/clubCanonicalReadModel.js";

const authState = vi.hoisted(() => ({
  user: { id: "u1", role: "CLUB_MANAGER", displayName: "Manager" },
  can: () => true,
  authLoading: false,
  isAuthenticated: true,
}));

const clubState = vi.hoisted(() => ({
  activeClubId: null,
  activeClub: null,
  activeClubReady: false,
  clubReadReady: true,
  clubReadState: "ready",
  canonicalClubRead: true,
  revision: 0,
}));

const loadAIData = vi.hoisted(() =>
  vi.fn(() => {
    throw Object.assign(new Error("CLUB_REQUIRED — should not be called"), {
      name: "ClubContextError",
      code: "CLUB_REQUIRED",
    });
  })
);

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => authState,
}));

vi.mock("../../src/context/ClubContext.jsx", () => ({
  useClub: () => clubState,
}));

vi.mock("../../src/context/SeasonContext.jsx", () => ({
  useSeasonLeague: () => ({
    activeSeason: null,
    activeLeague: null,
  }),
}));

vi.mock("../../src/features/dashboard-analytics/components/DashboardAnalyticsView.jsx", () => ({
  default: function MockAnalytics() {
    return <div data-testid="dashboard-analytics-stub">Tổng quan</div>;
  },
}));

vi.mock("../../src/ai/storage.js", () => ({
  loadAIData,
}));

vi.mock("../../src/components/courtManagement/CourtOperationsPanel.jsx", () => ({
  default: function MockCourtOps() {
    return <div data-testid="court-ops-ok">court</div>;
  },
}));

vi.mock("../../src/features/tournament/hooks/useCanonicalTournament.js", () => ({
  useCanonicalTournamentList: () => ({ tournaments: [] }),
}));

function renderDashboard() {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Dashboard canonical Club context bootstrap UI", () => {
  beforeEach(() => {
    loadAIData.mockReset();
    loadAIData.mockImplementation(() => {
      throw Object.assign(new Error("CLUB_REQUIRED — should not be called"), {
        name: "ClubContextError",
        code: "CLUB_REQUIRED",
      });
    });
    authState.user = { id: "u1", role: "CLUB_MANAGER", displayName: "Manager" };
    authState.can = () => true;
    authState.authLoading = false;
    authState.isAuthenticated = true;
    clubState.activeClubId = null;
    clubState.activeClub = null;
    clubState.activeClubReady = false;
    clubState.clubReadReady = true;
    clubState.clubReadState = CLUB_READ_STATE.READY;
    clubState.canonicalClubRead = true;
    clubState.revision = 0;
  });

  it("A/C/H: renders without throwing when activeClubId is null", () => {
    expect(() => renderDashboard()).not.toThrow();
    expect(screen.getByTestId("dashboard-root")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-analytics-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-club-operations")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-club-operations-placeholder")).toBeInTheDocument();
    expect(loadAIData).not.toHaveBeenCalled();
  });

  it("B: ClubOperations does not mount while club context is loading", () => {
    clubState.clubReadState = CLUB_READ_STATE.LOADING;
    clubState.clubReadReady = false;
    clubState.activeClubId = "pending-hint";
    renderDashboard();
    expect(screen.getByTestId("dashboard-root")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-club-operations")).not.toBeInTheDocument();
    expect(screen.getByText(/Đang tải ngữ cảnh CLB/i)).toBeInTheDocument();
    expect(loadAIData).not.toHaveBeenCalled();
  });

  it("D: mounts ClubOperations when explicit canonical club is ready", () => {
    loadAIData.mockImplementation(() => ({ sessions: [] }));
    clubState.activeClubId = "club-1";
    clubState.activeClub = { id: "club-1", name: "ACCC", tenantId: "tenant-1" };
    clubState.activeClubReady = true;
    clubState.clubReadReady = true;
    clubState.clubReadState = CLUB_READ_STATE.READY;

    expect(() => renderDashboard()).not.toThrow();
    expect(screen.getByTestId("dashboard-club-operations")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-club-operations-placeholder")).not.toBeInTheDocument();
    expect(loadAIData).toHaveBeenCalledWith("club-1");
  });

  it("E: permission alone without clubId does not invoke club-scoped services", () => {
    renderDashboard();
    expect(loadAIData).not.toHaveBeenCalled();
    expect(screen.queryByTestId("dashboard-club-operations")).not.toBeInTheDocument();
  });

  it("I: auth bootstrapping keeps dashboard shell and denies ClubOperations", () => {
    authState.authLoading = true;
    authState.isAuthenticated = false;
    renderDashboard();
    expect(screen.getByTestId("dashboard-root")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-club-operations")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-club-operations-placeholder")).not.toBeInTheDocument();
  });
});
