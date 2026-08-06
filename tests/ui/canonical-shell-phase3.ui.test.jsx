import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../src/theme/theme.js";

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "SUPER_ADMIN", email: "admin@test.local" },
    rbacEnabled: true,
    permissions: ["*"],
    hasPermission: () => true,
    isAuthenticated: true,
  }),
}));

vi.mock("../../src/context/TenantContext.jsx", () => ({
  useTenant: () => ({
    isSuperAdmin: true,
    activeTenantId: "t1",
    tenants: [],
  }),
}));

vi.mock("../../src/features/mobile/context/MobileNavProvider.jsx", () => ({
  MobileNavProvider: ({ children }) => children,
}));

vi.mock("../../src/features/mobile/layout/MobileBottomNav.jsx", () => ({
  default: () => null,
}));

vi.mock("../../src/components/auth/RouteAccessGate.jsx", () => ({
  default: ({ children }) => children,
}));

vi.mock("../../src/components/TenantGate.jsx", () => ({
  default: ({ children }) => children,
}));

vi.mock("../../src/components/SubscriptionBanner.jsx", () => ({
  default: () => null,
}));

vi.mock("../../src/features/billing/components/OperationalRouteGate.jsx", () => ({
  default: ({ children }) => children,
}));

vi.mock("../../src/features/mobile/components/OfflineBanner.jsx", () => ({
  default: () => null,
}));

vi.mock("../../src/features/mobile/components/PwaInstallPrompt.jsx", () => ({
  default: () => null,
}));

vi.mock("../../src/components/shell/AccountMenu.jsx", () => ({
  default: () => <div data-testid="account-menu" />,
}));

vi.mock("../../src/components/TenantSwitcher.jsx", () => ({
  default: () => null,
}));

vi.mock("../../src/features/canonical-shell/components/CanonicalNotificationButton.jsx", () => ({
  default: () => null,
}));

import CanonicalAppShell from "../../src/features/canonical-shell/components/CanonicalAppShell.jsx";

function renderShell(initialPath = "/dashboard") {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<CanonicalAppShell />}>
            <Route path="*" element={<div>Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("canonical-shell phase3 ui", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CANONICAL_APP_SHELL_ENABLED", "true");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: String(query).includes("max-width"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders canonical search from registry (not legacy-only marker)", async () => {
    renderShell("/dashboard");
    expect(await screen.findByTestId("canonical-app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("canonical-global-search")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm kiếm...")).toBeInTheDocument();
  });

  it("opens mobile drawer, moves focus in, restores focus on close", async () => {
    const user = userEvent.setup();
    renderShell("/dashboard");

    const trigger = await screen.findByTestId("canonical-mobile-menu-trigger");
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    const closeBtn = await screen.findByTestId("canonical-mobile-drawer-close");
    await waitFor(() => {
      expect(closeBtn).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("applies figure1 font marker on shell after dynamic load", async () => {
    renderShell("/dashboard");
    const shell = await screen.findByTestId("canonical-app-shell");
    await waitFor(() => {
      expect(shell.getAttribute("data-figure1-font")).toMatch(/inter|pending/);
    });
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-figure1-font", "inter");
    });
  });
});
