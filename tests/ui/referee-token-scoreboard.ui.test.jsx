import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../src/theme/theme";
import { AuthProvider } from "../../src/context/AuthContext.jsx";
import RefereeTokenRouteErrorBoundary from "../../src/pages/referee/RefereeTokenRouteErrorBoundary.jsx";
import RefereeScoreboard from "../../src/pages/referee/RefereeScoreboard.jsx";
import { MATCH_LIVE_STATUS } from "../../src/domain/matchLiveSync.js";

const TOKEN = "b0d87cb541da47acb71e059a5ace4901";

vi.mock("../../src/domain/matchLiveSync.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseConfig: () => true,
    subscribeMatchLiveByToken: () => () => {},
    adjustMatchLiveScore: vi.fn(),
    requestMatchLiveFinalize: vi.fn(),
  };
});

vi.mock("../../src/features/tournament/internal/internalRefereeTokenScoreboard.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadRefereeTokenScoreboard: vi.fn(async () => ({
      ok: true,
      source: "internal_canonical_token",
      row: {
        matchId: "GA-R1-M1",
        tournamentName: "Giải nội bộ 14/8/2026",
        refereeName: "Trọng tài 01",
        refereeToken: TOKEN,
        stageLabel: "Vòng bảng · Vòng 1",
        entryALabel: "IT421 Nam 01 / IT421 Nam 02",
        entryBLabel: "IT421 Nam 03 / IT421 Nam 04",
        courtLabel: "TT412 Sân 1",
        scheduledStart: "2026-08-14T08:00:00",
        scoreA: 0,
        scoreB: 0,
        status: MATCH_LIVE_STATUS.PLAYING,
      },
    })),
  };
});

function renderTokenRoute() {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/referee/${TOKEN}`]}>
          <Routes>
            <Route
              path="/referee/:token"
              element={
                <RefereeTokenRouteErrorBoundary>
                  <RefereeScoreboard />
                </RefereeTokenRouteErrorBoundary>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

describe("IT-E2E-BROWSER-015 production-like /referee/:token tree", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  });

  it("renders scorer without ClubProvider and without useClub crash", async () => {
    renderTokenRoute();
    expect(await screen.findByTestId("referee-token-scoreboard")).toBeInTheDocument();
    expect(screen.getByText("Giải nội bộ 14/8/2026")).toBeInTheDocument();
    expect(screen.getAllByText(/IT421 Nam 01/).length).toBeGreaterThan(0);
    expect(screen.getByText("TT412 Sân 1")).toBeInTheDocument();
    expect(screen.getByText("Chốt kết quả")).toBeInTheDocument();
    expect(screen.queryByTestId("referee-token-route-error")).not.toBeInTheDocument();
    expect(screen.queryByText(/useClub must be used within ClubProvider/)).not.toBeInTheDocument();
  });

  it("error boundary catches a child crash instead of a white screen", async () => {
    function Boom() {
      throw new Error("useClub must be used within ClubProvider");
    }
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <RefereeTokenRouteErrorBoundary>
            <Boom />
          </RefereeTokenRouteErrorBoundary>
        </MemoryRouter>
      </ThemeProvider>
    );
    expect(await screen.findByTestId("referee-token-route-error")).toBeInTheDocument();
    expect(
      screen.getByText("Không thể mở màn hình chấm trận. Vui lòng tải lại hoặc liên hệ BTC.")
    ).toBeInTheDocument();
  });
});
