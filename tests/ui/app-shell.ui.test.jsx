import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import MainLayout from "../../src/layouts/MainLayout.jsx";
import LoginPage from "../../src/pages/LoginPage.jsx";
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

describe("V5 app shell runtime", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_RBAC_ENABLED", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

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

  it("renders login without crashing when auth is required", async () => {
    render(
      <ShellProviders initialPath="/login">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </ShellProviders>
    );

    expect(await screen.findByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("renders MainLayout shell without crashing when tenant/club context is empty", async () => {
    vi.stubEnv("VITE_RBAC_ENABLED", "false");

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

    expect(await screen.findByRole("heading", { level: 4, name: "Tổng quan" })).toBeInTheDocument();
  });

  it("renders header account area safely when user is undefined", async () => {
    vi.stubEnv("VITE_RBAC_ENABLED", "false");

    render(
      <ShellProviders initialPath="/">
        <Routes>
          <Route path="/login" element={<div data-testid="login-fallback">login</div>} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<div data-testid="page-body">OK</div>} />
          </Route>
        </Routes>
      </ShellProviders>
    );

    expect(await screen.findByTestId("page-body")).toBeInTheDocument();
    expect(screen.queryByLabelText("Menu tài khoản")).not.toBeInTheDocument();
  });
});
