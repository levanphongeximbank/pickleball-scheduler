import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../src/theme/theme.js";
import { ROLES } from "../../src/auth/roles.js";
import { createUserRecord } from "../../src/models/user.js";
import { saveClubs } from "../../src/data/club.js";
import { saveClubData } from "../../src/domain/clubStorage.js";
import { createTournamentRecord } from "../../src/models/tournament/tournament.js";

const TENANT_A = "venue-ui-phase4-a";
const TENANT_B = "venue-ui-phase4-b";
const CLUB_A = "club-ui-phase4-a";
const CLUB_B = "club-ui-phase4-b";
const TOURNAMENT_A = "tournament-ui-phase4-a";
const ENGINE_PATH = `/tournaments/${TOURNAMENT_A}/engine`;

const authState = {
  authLoading: false,
  authProductionEnabled: true,
  rbacEnabled: false,
  isAuthenticated: true,
  user: null,
  can: () => true,
};

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => authState,
}));

vi.mock("../../src/context/ClubContext.jsx", () => ({
  useClub: () => ({
    activeClubId: CLUB_A,
    activeClub: { id: CLUB_A, venueId: TENANT_A, tenantId: TENANT_A },
  }),
}));

vi.mock("../../src/context/ClusterContext.jsx", () => ({
  useCluster: () => ({ activeClusterId: null }),
}));

import RouteAccessGate from "../../src/components/auth/RouteAccessGate.jsx";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
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

function seed() {
  saveClubs([
    { id: CLUB_A, name: "CLB A", venueId: TENANT_A, tenantId: TENANT_A },
    { id: CLUB_B, name: "CLB B", venueId: TENANT_B, tenantId: TENANT_B },
  ]);
  const tournament = createTournamentRecord(CLUB_A, {
    id: TOURNAMENT_A,
    name: "Giải A",
    tenantId: TENANT_A,
  });
  saveClubData(CLUB_A, { tournaments: [tournament] });
  saveClubData(CLUB_B, { tournaments: [] });
}

function renderGate(initialPath) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/tournaments/:tournamentId/:tab"
            element={
              <RouteAccessGate>
                <div data-testid="engine-allowed">ENGINE_OK</div>
              </RouteAccessGate>
            }
          />
          <Route
            path="/tournaments"
            element={
              <RouteAccessGate>
                <div data-testid="catalog-public">CATALOG_OK</div>
              </RouteAccessGate>
            }
          />
          <Route path="/login" element={<div data-testid="login">LOGIN</div>} />
          <Route path="/403" element={<div data-testid="forbidden">FORBIDDEN</div>} />
          <Route path="*" element={<Navigate to="/403" replace />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("canonical-shell phase4 engine authz (behavioral RouteAccessGate)", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    seed();
    authState.authLoading = false;
    authState.authProductionEnabled = true;
    authState.rbacEnabled = false;
    authState.isAuthenticated = true;
    authState.user = createUserRecord({
      id: "owner-a",
      role: ROLES.VENUE_OWNER,
      venueId: TENANT_A,
      tenantId: TENANT_A,
      status: "active",
    });
    authState.can = () => true;
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("keeps /tournaments public without auth", async () => {
    authState.isAuthenticated = false;
    authState.user = null;
    renderGate("/tournaments");
    expect(await screen.findByTestId("catalog-public")).toBeTruthy();
  });

  it("denies Engine when auth ON + RBAC OFF and user lacks tournament.update", async () => {
    authState.rbacEnabled = false;
    authState.user = createUserRecord({
      id: "player-1",
      role: ROLES.PLAYER,
      venueId: TENANT_A,
      tenantId: TENANT_A,
      clubId: CLUB_A,
      status: "active",
    });
    renderGate(ENGINE_PATH);
    expect(await screen.findByTestId("forbidden")).toBeTruthy();
    expect(screen.queryByTestId("engine-allowed")).toBeNull();
  });

  it("denies Engine when cross-tenant owner hits club A deep-link (RBAC OFF)", async () => {
    authState.rbacEnabled = false;
    authState.user = createUserRecord({
      id: "owner-b",
      role: ROLES.VENUE_OWNER,
      venueId: TENANT_B,
      tenantId: TENANT_B,
      status: "active",
    });
    renderGate(ENGINE_PATH);
    expect(await screen.findByTestId("forbidden")).toBeTruthy();
    expect(screen.queryByTestId("engine-allowed")).toBeNull();
  });

  it("allows Engine when permission + ownership hold (RBAC OFF)", async () => {
    authState.rbacEnabled = false;
    renderGate(ENGINE_PATH);
    expect(await screen.findByTestId("engine-allowed")).toBeTruthy();
  });

  it("enforces the same requirements when RBAC ON", async () => {
    authState.rbacEnabled = true;
    authState.user = createUserRecord({
      id: "player-1",
      role: ROLES.PLAYER,
      venueId: TENANT_A,
      tenantId: TENANT_A,
      clubId: CLUB_A,
      status: "active",
    });
    // useAuth().can mirrors rbac can when RBAC on for non-engine paths; Engine uses forced can().
    authState.can = () => false;
    renderGate(ENGINE_PATH);
    expect(await screen.findByTestId("forbidden")).toBeTruthy();
  });

  it("redirects unauthenticated Engine deep-link to login", async () => {
    authState.isAuthenticated = false;
    authState.user = null;
    renderGate(ENGINE_PATH);
    await waitFor(() => {
      expect(screen.getByTestId("login")).toBeTruthy();
    });
  });
});
