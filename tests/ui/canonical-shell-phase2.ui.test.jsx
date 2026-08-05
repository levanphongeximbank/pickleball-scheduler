import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import MainLayout from "../../src/layouts/MainLayout.jsx";
import Dashboard from "../../src/pages/Dashboard.jsx";
import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { PlatformRuntimeProvider } from "../../src/core/platform/app/PlatformRuntimeProvider.jsx";
import theme from "../../src/theme/theme.js";

function ShellProviders({ initialPath = "/", children }) {
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

describe("Canonical App Shell Phase 2 — feature flag runtime", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_RBAC_ENABLED", "false");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "false");

    if (!window.matchMedia) {
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      });
    }
  });

  it("renders legacy shell when flag OFF", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "false");

    render(
      <ShellProviders initialPath="/">
        <Routes>
          <Route path="/login" element={<div data-testid="login-fallback">login</div>} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
        </Routes>
      </ShellProviders>
    );

    expect(await screen.findByTestId("legacy-app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("canonical-app-shell")).not.toBeInTheDocument();
  });

  it("renders canonical shell when flag ON and does not dual-render legacy", async () => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "true");

    render(
      <ShellProviders initialPath="/">
        <Routes>
          <Route path="/login" element={<div data-testid="login-fallback">login</div>} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
        </Routes>
      </ShellProviders>
    );

    expect(await screen.findByTestId("canonical-app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("legacy-app-shell")).not.toBeInTheDocument();
  });
});
