import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";

import CourtEnginePage from "../../src/pages/CourtEnginePage.jsx";
import { saveClubData, CLUB_SCHEMA_VERSION } from "../../src/domain/clubStorage.js";
import { DEFAULT_CLUB, setActiveClubId } from "../../src/data/club.js";
import * as courtEngineContextGuard from "../../src/features/court-engine/guards/courtEngineContextGuard.js";
import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { ClubProvider } from "../../src/context/ClubContext.jsx";
import { SeasonProvider } from "../../src/context/SeasonContext.jsx";
import { TenantProvider } from "../../src/context/TenantContext.jsx";

function seedClubWithSeasonAndLeague() {
  localStorage.clear();
  localStorage.setItem(
    "pickleball-clubs-v1",
    JSON.stringify([DEFAULT_CLUB])
  );
  setActiveClubId(DEFAULT_CLUB.id);

  saveClubData(DEFAULT_CLUB.id, {
    schemaVersion: CLUB_SCHEMA_VERSION,
    players: [
      { id: "p1", name: "An", level: 3.0, active: true },
      { id: "p2", name: "Binh", level: 3.2, active: true },
    ],
    courts: [{ id: "1", name: "Sân 1", number: 1, active: true }],
    seasons: [{ id: "season-1", name: "Mùa 2026", status: "active" }],
    leagues: [{ id: "league-1", seasonId: "season-1", name: "Giải nội bộ", status: "active" }],
    active: { seasonId: "season-1", leagueId: "league-1" },
    sessions: [],
    tournaments: [],
    history: {},
    policies: [],
    rules: [],
    waiting: {},
  });
}

function renderCourtEnginePage() {
  return rtlRender(
    <MemoryRouter>
      <AuthProvider>
        <TenantProvider>
          <ClubProvider>
            <SeasonProvider>
              <CourtEnginePage />
            </SeasonProvider>
          </ClubProvider>
        </TenantProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("CourtEnginePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    seedClubWithSeasonAndLeague();
  });

  it("renders without crash when opening /court-engine after login context", async () => {
    renderCourtEnginePage();

    await waitFor(() => {
      expect(screen.getByText("Court Engine")).toBeInTheDocument();
    });
  });

  it("shows empty state when season is null", async () => {
    vi.spyOn(courtEngineContextGuard, "resolveCourtEngineContextState").mockReturnValue({
      ready: false,
      code: "NO_SEASON",
      message: "Chưa có mùa giải hoặc league để điều phối sân.",
    });
    renderCourtEnginePage();

    expect(
      await screen.findByText(/Chưa có mùa giải hoặc league để điều phối sân/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Tạo mùa giải \/ chọn mùa giải/i })
    ).toHaveAttribute("href", "/club-management");
  });

  it("shows empty state when league is null for active season", async () => {
    vi.spyOn(courtEngineContextGuard, "resolveCourtEngineContextState").mockReturnValue({
      ready: false,
      code: "NO_LEAGUE",
      message: "Chưa có giải/league trong mùa giải hiện tại. Hãy tạo hoặc chọn league trước.",
    });
    renderCourtEnginePage();

    expect(
      await screen.findByText(/Chưa có giải\/league trong mùa giải hiện tại/i)
    ).toBeInTheDocument();
  });

  it("shows tenant error when tenant context is invalid", async () => {
    vi.spyOn(courtEngineContextGuard, "resolveCourtEngineContextState").mockReturnValue({
      ready: false,
      code: "TENANT_ERROR",
      message: "Tài khoản chưa được gán tenant.",
    });
    renderCourtEnginePage();

    expect(await screen.findByText(/Tài khoản chưa được gán tenant/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tạo mùa giải/i })).not.toBeInTheDocument();
  });

  it("shows loading then main UI when league and season exist", async () => {
    renderCourtEnginePage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Check-in" })).toBeInTheDocument();
    });
    expect(screen.getByText("Live Courts (1)")).toBeInTheDocument();
  });
});
