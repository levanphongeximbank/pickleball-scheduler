import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../src/theme/theme.js";

const authState = {
  authLoading: false,
  isAuthenticated: true,
  user: { id: "admin-1", role: "SUPER_ADMIN" },
};

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => authState,
}));

vi.mock("../../src/features/pick-vn-rating-v5/config/flags.js", () => ({
  isPickVnRatingV5Enabled: () => flagState.enabled,
}));

vi.mock("../../src/features/pick-vn-rating-v5/services/ratingV5AccessService.js", () => ({
  resolveRatingV5Access: async () => enrollmentState.result,
}));

vi.mock("../../src/features/pick-vn-rating-v5/components/V5AssessmentWorkspace.jsx", () => ({
  default: () => <div data-testid="v5-workspace">WORKSPACE</div>,
}));

const flagState = { enabled: false };
const enrollmentState = {
  result: { ok: false, code: "PILOT_NOT_ENROLLED", visible: false },
};

import SkillAssessmentV5RouteGuard from "../../src/features/pick-vn-rating-v5/guards/SkillAssessmentV5RouteGuard.jsx";
import SkillAssessmentV5Page from "../../src/pages/player/SkillAssessmentV5Page.jsx";

function renderV5() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/player/skill-assessment-v5"]}>
        <Routes>
          <Route
            path="/player/skill-assessment-v5"
            element={
              <SkillAssessmentV5RouteGuard>
                <SkillAssessmentV5Page />
              </SkillAssessmentV5RouteGuard>
            }
          />
          <Route path="/login" element={<div data-testid="login">LOGIN</div>} />
          <Route path="/403" element={<div data-testid="forbidden">FORBIDDEN</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("canonical-shell phase4 B03 authz (behavioral guard + page)", () => {
  beforeEach(() => {
    flagState.enabled = false;
    enrollmentState.result = { ok: false, code: "PILOT_NOT_ENROLLED", visible: false };
    authState.authLoading = false;
    authState.isAuthenticated = true;
    authState.user = { id: "admin-1", role: "SUPER_ADMIN" };
  });

  it("allows SUPER_ADMIN when V5 flag is OFF", async () => {
    flagState.enabled = false;
    authState.user = { id: "admin-1", role: "SUPER_ADMIN" };
    renderV5();
    expect(await screen.findByTestId("v5-workspace")).toBeTruthy();
  });

  it("allows PLATFORM_ADMIN when V5 flag is OFF", async () => {
    flagState.enabled = false;
    authState.user = { id: "admin-2", role: "PLATFORM_ADMIN" };
    renderV5();
    expect(await screen.findByTestId("v5-workspace")).toBeTruthy();
  });

  it("denies PLAYER when V5 flag is OFF (controlled unavailable → page, guard passes)", async () => {
    flagState.enabled = false;
    authState.user = { id: "p1", role: "PLAYER" };
    renderV5();
    await waitFor(() => {
      expect(screen.queryByTestId("v5-workspace")).toBeNull();
    });
    expect(screen.queryByTestId("forbidden")).toBeNull();
  });

  it("allows PLAYER when flag ON + enrolled", async () => {
    flagState.enabled = true;
    enrollmentState.result = { ok: true, code: "OK", visible: true };
    authState.user = { id: "p1", role: "PLAYER" };
    renderV5();
    expect(await screen.findByTestId("v5-workspace")).toBeTruthy();
  });

  it("denies PLAYER when flag ON + not enrolled", async () => {
    flagState.enabled = true;
    enrollmentState.result = { ok: false, code: "PILOT_NOT_ENROLLED", visible: false };
    authState.user = { id: "p1", role: "PLAYER" };
    renderV5();
    expect(await screen.findByTestId("forbidden")).toBeTruthy();
  });

  it("returns 403 for unrelated roles", async () => {
    flagState.enabled = true;
    authState.user = { id: "v1", role: "VENUE_OWNER" };
    renderV5();
    expect(await screen.findByTestId("forbidden")).toBeTruthy();
  });

  it("fail-closes unknown roles", async () => {
    flagState.enabled = true;
    authState.user = { id: "u1", role: "NOT_A_REAL_ROLE" };
    renderV5();
    expect(await screen.findByTestId("forbidden")).toBeTruthy();
  });

  it("sends unauthenticated users to login", async () => {
    authState.isAuthenticated = false;
    authState.user = null;
    renderV5();
    expect(await screen.findByTestId("login")).toBeTruthy();
  });
});
