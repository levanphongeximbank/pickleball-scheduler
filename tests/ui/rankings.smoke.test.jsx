import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import PublicLayout from "../../src/layouts/public/PublicLayout.jsx";
import RankingsPage from "../../src/pages/public/RankingsPage.jsx";
import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { PlatformRuntimeProvider } from "../../src/core/platform/app/PlatformRuntimeProvider.jsx";
import theme from "../../src/theme/theme.js";

function PublicShell({ initialPath = "/rankings" }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PlatformRuntimeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/rankings" element={<RankingsPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </PlatformRuntimeProvider>
    </ThemeProvider>
  );
}

describe("Public RankingsPage", () => {
  it("renders inside PublicLayout without crashing", () => {
    render(<PublicShell />);

    expect(screen.getByText("Bảng xếp hạng VPR")).toBeInTheDocument();
    expect(screen.getAllByText("PICK_VN").length).toBeGreaterThan(0);
    expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
  });
});
