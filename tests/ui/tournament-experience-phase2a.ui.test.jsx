import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import TournamentExperiencePrototypeLayout from "../../src/features/tournament-experience-ui/TournamentExperiencePrototypeLayout.jsx";
import TournamentCenterPage from "../../src/features/tournament-experience-ui/pages/TournamentCenterPage.jsx";
import TournamentOverviewPage from "../../src/features/tournament-experience-ui/pages/TournamentOverviewPage.jsx";
import RegistrationPublicationPage from "../../src/features/tournament-experience-ui/pages/RegistrationPublicationPage.jsx";
import { publicationPrimaryActionLabel } from "../../src/features/tournament-experience-ui/publicationSemantics.js";
import {
  TOURNAMENT_COLOR,
  TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE,
} from "../../src/features/tournament-experience-ui/design/tournamentDesignTokens.js";

function renderAt(routePath) {
  return render(
    <MemoryRouter initialEntries={[routePath]}>
      <Routes>
        <Route path="/ux-prototype/tournament-experience" element={<TournamentExperiencePrototypeLayout />}>
          <Route index element={<TournamentCenterPage />} />
          <Route path="t/:tournamentId" element={<TournamentOverviewPage />} />
          <Route path="t/:tournamentId/registration" element={<RegistrationPublicationPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("Phase 2A tournament experience visual calibration", () => {
  it("uses a single Tournament Blue primary token", () => {
    expect(TOURNAMENT_COLOR.primary).toBe("#2563EB");
    expect(TOURNAMENT_COLOR.primaryLight).toBe("#3B82F6");
    expect(TOURNAMENT_COLOR.live).toBe("#DC2626");
    expect(TOURNAMENT_COLOR.success).toBe("#059669");
  });

  it("renders Screen 01 Tournament Center", () => {
    renderAt("/ux-prototype/tournament-experience");
    expect(screen.getByText("Trung tâm giải đấu")).toBeTruthy();
    expect(screen.getByText("PICK VN OPEN 2026")).toBeTruthy();
    expect(screen.getByText("Nguyên mẫu UX Giải đấu — chỉ dùng dữ liệu mẫu. Không ghi dữ liệu môi trường thật.")).toBeTruthy();
  });

  it("renders Screen 02 Tournament Overview", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026");
    expect(screen.getByText("Tổng quan giải đấu")).toBeTruthy();
    expect(screen.getByText("Đôi nam 3.5")).toBeTruthy();
    expect(screen.getByText("Vòng đời giải đấu")).toBeTruthy();
    expect(screen.getByText("Chính thức / Mở rộng")).toBeTruthy();
  });

  it("renders Screen 04 Registration & Publication", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/registration");
    expect(screen.getByText("Đăng ký & Công bố")).toBeTruthy();
    expect(screen.getByText("Quản lý công bố")).toBeTruthy();
    expect(screen.queryByText("Công bố đăng ký")).toBeNull();
    expect(screen.getByText("Đóng đăng ký")).toBeTruthy();
    expect(screen.getByText("Thêm VĐV")).toBeTruthy();
  });

  it("keeps notification in the shared app header, not the page-action cluster", () => {
    renderAt("/ux-prototype/tournament-experience/t/pick-vn-open-2026/registration");
    const headerRow = document.querySelector('[data-testid="tournament-app-header-row"]');
    const notification = document.querySelector('[data-testid="tournament-header-notification"]');
    const pageActions = document.querySelector('[data-testid="tournament-header-page-actions"]');
    expect(headerRow?.contains(notification)).toBe(true);
    expect(pageActions?.contains(notification) ?? false).toBe(false);
    expect(screen.getByLabelText("Thông báo")).toBeTruthy();
  });

  it("maps publication CTA from presentation status only", () => {
    expect(publicationPrimaryActionLabel("PUBLISHED")).toBe("Quản lý công bố");
    expect(publicationPrimaryActionLabel("NOT_PUBLISHED")).toBe("Công bố đăng ký");
  });

  it("does not statically load the production App graph from main.jsx", () => {
    const main = readFileSync(path.join(process.cwd(), "src/main.jsx"), "utf8");
    expect(main).toContain("TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE");
    expect(main).toContain("mountPrototype.jsx");
    expect(main).not.toMatch(/import App from/);
    expect(main).not.toContain("bindTournamentAccessPortFromDomain");
    expect(TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE).toBe("/ux-prototype/tournament-experience");
  });
});
