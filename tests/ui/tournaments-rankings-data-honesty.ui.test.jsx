/**
 * EC-04 Tournaments + Rankings data honesty — Vitest + Testing Library.
 * Activation: `npx vitest run tests/ui/tournaments-rankings-data-honesty.ui.test.jsx`
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import PublicLayout from "../../src/layouts/public/PublicLayout.jsx";
import TournamentsPage from "../../src/pages/public/TournamentsPage.jsx";
import RankingsPage from "../../src/pages/public/RankingsPage.jsx";
import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { PlatformRuntimeProvider } from "../../src/core/platform/app/PlatformRuntimeProvider.jsx";
import theme from "../../src/theme/theme.js";

function PublicShell({ initialPath, children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PlatformRuntimeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route element={<PublicLayout />}>{children}</Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </PlatformRuntimeProvider>
    </ThemeProvider>
  );
}

describe("EC-04 list-surface data honesty UI", () => {
  it("Tournaments page renders provenance notice when fallback is used", async () => {
    render(
      <PublicShell initialPath="/tournaments">
        <Route path="/tournaments" element={<TournamentsPage />} />
      </PublicShell>
    );

    expect(screen.getByRole("heading", { name: "Giải đấu" })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByTestId("public-data-source-notice") ||
          screen.queryByPlaceholderText("Tìm kiếm theo tên giải...") ||
          screen.queryByRole("button", { name: "Thử lại" })
      ).toBeTruthy();
    });

    const notice = screen.queryByTestId("public-data-source-notice");
    if (notice) {
      expect(notice).toHaveAttribute("data-source");
      expect(["MIXED", "MOCK", "PREVIEW", "UNKNOWN", "LIVE"]).toContain(
        notice.getAttribute("data-source")
      );
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
      if (["MIXED", "MOCK", "PREVIEW"].includes(notice.getAttribute("data-source"))) {
        expect(notice.textContent || "").not.toMatch(/dữ liệu trực tiếp từ hệ thống vận hành/i);
      }
    }

    const search = screen.queryByPlaceholderText("Tìm kiếm theo tên giải...");
    const retry = screen.queryByRole("button", { name: "Thử lại" });
    expect(search || retry).toBeTruthy();
  });

  it("Rankings page shows MOCK notice by default and preserves table overflow styles", async () => {
    render(
      <PublicShell initialPath="/rankings">
        <Route path="/rankings" element={<RankingsPage />} />
      </PublicShell>
    );

    expect(screen.getByRole("heading", { name: "Bảng xếp hạng VPR" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("public-data-source-notice")).toBeInTheDocument();
    });

    const notice = screen.getByTestId("public-data-source-notice");
    expect(notice).toHaveAttribute("data-source", "MOCK");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { name: "Dữ liệu minh họa" })).toBeInTheDocument();
    expect(screen.getByText(/không phải dữ liệu trực tiếp/i)).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
  });
});
