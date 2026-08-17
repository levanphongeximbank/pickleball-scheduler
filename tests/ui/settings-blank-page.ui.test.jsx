import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { Component } from "react";

import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { ClubProvider } from "../../src/context/ClubContext.jsx";
import { SeasonProvider } from "../../src/context/SeasonContext.jsx";
import { TenantProvider } from "../../src/context/TenantContext.jsx";
import { VenueProvider } from "../../src/context/VenueContext.jsx";
import { PlatformRuntimeProvider } from "../../src/core/platform/app/PlatformRuntimeProvider.jsx";
import SettingsRouteErrorBoundary from "../../src/components/settings/SettingsRouteErrorBoundary.jsx";
import SettingsRoute from "../../src/pages/settings/SettingsRoute.jsx";
import Settings from "../../src/pages/Settings.jsx";

const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";

function seedClub(activeId = PROD_CLUB_ID) {
  localStorage.clear();
  localStorage.setItem(
    "pickleball-clubs-v1",
    JSON.stringify([
      { id: PROD_CLUB_ID, name: "Production Club" },
      { id: "default-club", name: "CLB Mac dinh" },
    ])
  );
  localStorage.setItem("pickleball-active-club-v1", activeId);
}

function Providers({ children }) {
  return (
    <PlatformRuntimeProvider>
      <AuthProvider>
        <TenantProvider>
          <VenueProvider>
          <ClubProvider>
            <SeasonProvider>{children}</SeasonProvider>
          </ClubProvider>
          </VenueProvider>
        </TenantProvider>
      </AuthProvider>
    </PlatformRuntimeProvider>
  );
}

function BoomPanel() {
  throw new Error("nested settings panel boom");
}

class ControllableChild extends Component {
  render() {
    if (this.props.shouldThrow) {
      throw new Error("nested settings panel boom");
    }
    return <div data-testid="nested-ok">Settings nested OK</div>;
  }
}

describe("Settings blank-page UI remediation", () => {
  beforeEach(() => {
    seedClub();
  });

  it("direct render /settings path shows Settings (no blank page) with active clubId", async () => {
    render(
      <Providers>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/settings" element={<SettingsRoute />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );

    expect(await screen.findByTestId("settings-page")).toBeInTheDocument();
    expect(screen.getByText("⚙️ Cài đặt")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-route-error")).not.toBeInTheDocument();
  });

  it("client-side navigation into /settings renders successfully", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <MemoryRouter initialEntries={["/home"]}>
          <Link to="/settings">Go settings</Link>
          <Routes>
            <Route path="/home" element={<div>Home shell</div>} />
            <Route path="/settings" element={<SettingsRoute />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );

    await user.click(screen.getByRole("link", { name: "Go settings" }));
    expect(await screen.findByTestId("settings-page")).toBeInTheDocument();
  });

  it("nested Settings throw is caught by error boundary recovery UI", async () => {
    const user = userEvent.setup();

    function Parent() {
      const [broken, setBroken] = React.useState(true);
      return (
        <>
          <button type="button" data-testid="mark-child-fixed" onClick={() => setBroken(false)}>
            Fix child
          </button>
          <SettingsRouteErrorBoundary>
            <ControllableChild shouldThrow={broken} />
          </SettingsRouteErrorBoundary>
        </>
      );
    }

    render(
      <Providers>
        <Parent />
      </Providers>
    );

    expect(await screen.findByTestId("settings-route-error")).toBeInTheDocument();
    expect(screen.getByText("Không thể hiển thị Cài đặt")).toBeInTheDocument();
    expect(screen.queryByText(/nested settings panel boom/i)).not.toBeInTheDocument();

    await user.click(screen.getByTestId("mark-child-fixed"));
    await user.click(screen.getByTestId("settings-error-retry"));

    expect(await screen.findByTestId("nested-ok")).toBeInTheDocument();
  });

  it("lazy import rejection is caught — no blank page", async () => {
    function LazyBoom() {
      throw new Error("Failed to fetch dynamically imported module: Settings");
    }

    render(
      <Providers>
        <SettingsRouteErrorBoundary>
          <LazyBoom />
        </SettingsRouteErrorBoundary>
      </Providers>
    );

    expect(await screen.findByTestId("settings-route-error")).toBeInTheDocument();
    expect(screen.getByText("Không thể hiển thị Cài đặt")).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch dynamically imported module/i)).not.toBeInTheDocument();
  });

  it("retry recovery does not create an infinite reload loop", async () => {
    const reloadSpy = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, reload: reloadSpy },
    });

    try {
      render(
        <Providers>
          <SettingsRouteErrorBoundary>
            <BoomPanel />
          </SettingsRouteErrorBoundary>
        </Providers>
      );

      expect(await screen.findByTestId("settings-route-error")).toBeInTheDocument();
      expect(reloadSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    }
  });

  it("Settings still renders when active club is missing", async () => {
    localStorage.setItem("pickleball-clubs-v1", JSON.stringify([]));
    localStorage.removeItem("pickleball-active-club-v1");

    render(
      <Providers>
        <Settings />
      </Providers>
    );

    expect(await screen.findByTestId("settings-page")).toBeInTheDocument();
  });

  it("successful Settings path still shows Data health (no regression)", async () => {
    seedClub("default-club");
    localStorage.setItem(
      "pickleball-ai::default-club",
      JSON.stringify({
        schemaVersion: 1,
        history: { p1: { games: 1, partners: {}, opponents: {} } },
        waiting: {},
        sessions: [{ id: 1 }],
        policies: [],
        rules: [],
      })
    );

    render(
      <Providers>
        <Settings />
      </Providers>
    );

    expect(await screen.findByText(/Data health/i)).toBeInTheDocument();
    expect(screen.getByText(/Sessions:/i)).toBeInTheDocument();
  });
});
