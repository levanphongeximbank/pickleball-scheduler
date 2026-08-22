/**
 * Wave 1 Batch 1A — exclusive Canonical / Legacy app chrome (runtime UI).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import MainLayout from "../../src/layouts/MainLayout.jsx";
import Dashboard from "../../src/pages/Dashboard.jsx";
import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { PlatformRuntimeProvider } from "../../src/core/platform/app/PlatformRuntimeProvider.jsx";
import theme from "../../src/theme/theme.js";

function ShellProviders({ initialPath = "/dashboard", children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PlatformRuntimeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
        </AuthProvider>
      </PlatformRuntimeProvider>
    </ThemeProvider>
  );
}

function AuthedAppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<div data-testid="login-surface">login</div>} />
      <Route path="/403" element={<div data-testid="forbidden-surface">403</div>} />
      <Route path="/referee/:token" element={<div data-testid="referee-token-surface">ref</div>} />
      <Route
        path="/tournament/:tournamentId/public"
        element={<div data-testid="public-tournament-surface">public</div>}
      />
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tournament" element={<div data-testid="tournament-center-body">Tournament Center</div>} />
      </Route>
    </Routes>
  );
}

function stubMatchMedia(matchesMobile = false) {
  window.matchMedia = (query) => {
    const isMax899 = String(query).includes("max-width: 899") || String(query).includes("max-width:899");
    return {
      matches: matchesMobile ? isMax899 || String(query).includes("max-width") : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
}

describe("Wave 1 Batch 1A — shell exclusivity", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_RBAC_ENABLED", "false");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    stubMatchMedia(false);
  });

  it("A. flag ON → canonical shell only", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "true");

    render(
      <ShellProviders>
        <AuthedAppRoutes />
      </ShellProviders>
    );

    expect(await screen.findByTestId("canonical-app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("canonical-app-shell")).toHaveLength(1);
  });

  it("B. flag OFF → legacy shell only", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "false");

    render(
      <ShellProviders>
        <AuthedAppRoutes />
      </ShellProviders>
    );

    expect(await screen.findByTestId("legacy-app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("canonical-app-shell")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("legacy-app-shell")).toHaveLength(1);
  });

  it("C/D. flag ON → no double sidebar / no double topbar", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "true");

    render(
      <ShellProviders>
        <AuthedAppRoutes />
      </ShellProviders>
    );

    const shell = await screen.findByTestId("canonical-app-shell");
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("canonical-topbar")).toHaveLength(1);
    expect(within(shell).getAllByTestId("canonical-topbar")).toHaveLength(1);
    // Legacy Header switchers must not appear under canonical chrome.
    expect(screen.queryByTestId("desktop-venue-switcher")).not.toBeInTheDocument();
  });

  it("C/D. flag OFF → legacy chrome only (no canonical topbar)", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "false");

    render(
      <ShellProviders>
        <AuthedAppRoutes />
      </ShellProviders>
    );

    expect(await screen.findByTestId("legacy-app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("canonical-topbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canonical-app-shell")).not.toBeInTheDocument();
  });

  it("E. flag ON mobile → single MobileBottomNav; no legacy shell", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "true");
    stubMatchMedia(true);

    render(
      <ShellProviders>
        <AuthedAppRoutes />
      </ShellProviders>
    );

    const shell = await screen.findByTestId("canonical-app-shell");
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
    const bottomNavs = within(shell).queryAllByRole("navigation");
    // BottomNavigation exposes a navigation role; at most one bottom strip.
    expect(bottomNavs.length).toBeLessThanOrEqual(2);
  });

  it("F. intentional public / referee routes remain outside authenticated shell", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "true");

    const { unmount } = render(
      <ShellProviders initialPath="/referee/demo-token">
        <AuthedAppRoutes />
      </ShellProviders>
    );
    expect(await screen.findByTestId("referee-token-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("canonical-app-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
    unmount();

    render(
      <ShellProviders initialPath="/tournament/t1/public">
        <AuthedAppRoutes />
      </ShellProviders>
    );
    expect(await screen.findByTestId("public-tournament-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("canonical-app-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
  });

  it("G. Wave 0 organizer auth module remains importable / unchanged by Batch 1A", async () => {
    const access = await import("../../src/auth/tournamentExperienceRouteAccess.js");
    expect(typeof access.isTournamentExperienceOrganizerPath).toBe("function");
    expect(typeof access.resolveTournamentExperienceRoutePermissions).toBe("function");
    expect(access.isTournamentExperiencePublicPath("/tournament/t1/public")).toBe(true);
    expect(access.isTournamentExperienceOrganizerPath("/tournament/t1/overview")).toBe(true);
  });

  it("SIMULTANEOUS_APP_SHELL_RENDER=NO on dashboard and tournament center", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "true");

    const { unmount } = render(
      <ShellProviders initialPath="/dashboard">
        <AuthedAppRoutes />
      </ShellProviders>
    );
    expect(await screen.findByTestId("canonical-app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
    expect(screen.getAllByText("Tổng quan").length).toBeGreaterThan(0);
    unmount();

    render(
      <ShellProviders initialPath="/tournament">
        <AuthedAppRoutes />
      </ShellProviders>
    );
    expect(await screen.findByTestId("canonical-app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
    expect(screen.getByTestId("tournament-center-body")).toBeInTheDocument();
  });
});
