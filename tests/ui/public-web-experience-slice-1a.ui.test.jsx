import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "../../src/theme/theme.js";
import PublicHeader from "../../src/components/public/PublicHeader.jsx";
import PublicFooter from "../../src/components/public/PublicFooter.jsx";
import TournamentCard from "../../src/components/public/cards/TournamentCard.jsx";
import IndividualPublicExperiencePage from "../../src/features/tournament/experience-a1/pages/IndividualPublicExperiencePage.jsx";

const mockUseAuth = vi.fn();
const mockUseClub = vi.fn();
const mockUseCanonicalTournament = vi.fn();

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../src/context/ClubContext.jsx", () => ({
  useClub: () => mockUseClub(),
}));

vi.mock("../../src/features/tournament/hooks/useCanonicalTournament.js", () => ({
  useCanonicalTournament: (...args) => mockUseCanonicalTournament(...args),
}));

function wrap(ui, initialEntries = ["/home"]) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe("Slice 1A public integrity UI", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      signOut: vi.fn(),
    });
    mockUseClub.mockReturnValue({
      activeClub: null,
      revision: 0,
      clubScopeReady: false,
      clubScopeStatus: "idle",
    });
    mockUseCanonicalTournament.mockReturnValue({
      tournament: null,
      loading: false,
      error: null,
    });
  });

  it("desktop Giải đấu href is /public/tournaments", () => {
    wrap(<PublicHeader />);
    const link = screen.getByRole("link", { name: "Giải đấu" });
    expect(link).toHaveAttribute("href", "/public/tournaments");
  });

  it("mobile drawer Giải đấu href is /public/tournaments", async () => {
    const user = userEvent.setup();
    wrap(<PublicHeader />);
    await user.click(screen.getByLabelText("Mở menu"));
    const links = screen.getAllByRole("link", { name: "Giải đấu" });
    expect(links.some((el) => el.getAttribute("href") === "/public/tournaments")).toBe(true);
  });

  it("PublicHeader does not leak alignItems onto DOM", () => {
    const { container } = wrap(<PublicHeader />);
    expect(container.querySelector("[alignItems]")).toBeNull();
    expect(container.querySelector("[alignitems]")).toBeNull();
  });

  it("mobile drawer does not leak PaperProps onto DOM", async () => {
    const user = userEvent.setup();
    const { container, baseElement } = wrap(<PublicHeader />);
    await user.click(screen.getByLabelText("Mở menu"));
    expect(container.querySelector("[PaperProps]")).toBeNull();
    expect(baseElement.querySelector("[PaperProps]")).toBeNull();
    expect(baseElement.querySelector("[paperprops]")).toBeNull();
  });

  it("mobile menu opens and closes; focus returns to trigger", async () => {
    const user = userEvent.setup();
    wrap(<PublicHeader />);
    const trigger = screen.getByLabelText("Mở menu");
    await user.click(trigger);
    expect(screen.getByTestId("public-mobile-nav-panel")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    await vi.waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("Register CTA remains /login for guests", () => {
    wrap(<PublicHeader />);
    expect(screen.getByRole("link", { name: "Đăng ký miễn phí" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("footer Ban tổ chức giải href is /login", () => {
    wrap(<PublicFooter />);
    const link = screen.getByRole("link", { name: "Ban tổ chức giải" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("TournamentCard with canonicalTournamentId routes to public detail", () => {
    const id = "952a6c15-a3c1-4cd4-9dee-6720bcf5e073";
    wrap(
      <TournamentCard
        tournament={{
          id: "portal-opaque",
          canonicalTournamentId: id,
          name: "Open",
          status: "upcoming",
          statusLabel: "Sắp diễn ra",
          location: "HN",
          date: "01/01/2026",
          participants: 8,
          participantLabel: "VĐV",
        }}
      />
    );
    expect(screen.getByRole("link", { name: /Xem chi tiết/i })).toHaveAttribute(
      "href",
      `/tournament/${id}/public`
    );
  });

  it("TournamentCard without proven canonical ID keeps discovery (no fabricated detail)", () => {
    wrap(
      <TournamentCard
        tournament={{
          id: "t1",
          name: "Mock Open",
          status: "upcoming",
          statusLabel: "Sắp diễn ra",
          location: "HN",
          date: "01/01/2026",
          participants: 8,
          participantLabel: "VĐV",
        }}
      />
    );
    expect(screen.getByRole("link", { name: /Xem chi tiết/i })).toHaveAttribute(
      "href",
      "/public/tournaments"
    );
  });

  it("anonymous #23 does not infinite-load; shows truthful unavailable", () => {
    wrap(
      <Routes>
        <Route path="/tournament/:tournamentId/public" element={<IndividualPublicExperiencePage />} />
      </Routes>,
      ["/tournament/any-id/public"]
    );
    expect(screen.queryByText(/Đang tải trang công khai/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("Thông tin giải đấu hiện chưa khả dụng công khai.")
    ).toBeInTheDocument();
  });
});
