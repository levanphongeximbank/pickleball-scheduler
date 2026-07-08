import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import AthleteRatingSummary from "../../src/features/pick-vn-rating/components/AthleteRatingSummary.jsx";
import AthleteSelfProfilePage from "../../src/pages/player/AthleteSelfProfilePage.jsx";
import { AuthProvider } from "../../src/context/AuthContext.jsx";
import { TenantProvider } from "../../src/context/TenantContext.jsx";
import { ClubProvider } from "../../src/context/ClubContext.jsx";
import { SeasonProvider } from "../../src/context/SeasonContext.jsx";
import { PlatformRuntimeProvider } from "../../src/core/platform/app/PlatformRuntimeProvider.jsx";
import { resetPickVnRatingLocalStoreForTests } from "../../src/features/pick-vn-rating/storage/pickVnRatingLocalStore.js";
import { completePickVnOnboarding } from "../../src/features/pick-vn-rating/services/pickVnRatingService.js";
import theme from "../../src/theme/theme.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const onboardingAnswers = {
  gender: "male",
  birth_year: 1992,
  playing_duration: "1_3yr",
  sessions_per_week: "3",
  has_coach: "yes",
  tournament_level: "club_internal",
  best_result: "quarter",
  was_seed: "no",
  prior_sports: ["badminton"],
  prior_sport_level: "club",
  rally_consistency: "pct_80",
  return_stability: "pct_50",
  dink_ability: "10",
  volley_ability: "basic",
  third_shot_drop: "stable",
  reset_ability: "basic",
  play_style: "all_around",
  kitchen_frequency: "often",
  stacking_knowledge: "know",
  nvz_transition: "basic",
  team_coordination: "medium",
  pace_control: "basic",
  doubles_positioning: "none",
  self_rating: "3.5",
};

function ProfilePageShell() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PlatformRuntimeProvider>
        <AuthProvider>
          <TenantProvider>
            <ClubProvider>
              <SeasonProvider>
                <MemoryRouter initialEntries={["/player/profile"]}>
                  <AthleteSelfProfilePage />
                </MemoryRouter>
              </SeasonProvider>
            </ClubProvider>
          </TenantProvider>
        </AuthProvider>
      </PlatformRuntimeProvider>
    </ThemeProvider>
  );
}

function RatingShell({ authUserId }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <AthleteRatingSummary authUserId={authUserId} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("AthleteRatingSummary", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    resetPickVnRatingLocalStoreForTests();
  });

  it("shows onboarding CTA when athlete is unrated", () => {
    render(<RatingShell authUserId="athlete-unrated" />);

    expect(screen.getByText("Trình độ Pick_VN")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bắt đầu đánh giá" })).toHaveAttribute(
      "href",
      "/onboarding/pick-vn-rating"
    );
  });

  it("shows read-only rating and retake CTA after onboarding", async () => {
    const result = await completePickVnOnboarding("athlete-rated", {
      answers: onboardingAnswers,
    });
    expect(result.ok).toBe(true);

    render(<RatingShell authUserId="athlete-rated" />);

    expect(screen.getByText("Trình độ Pick_VN")).toBeInTheDocument();
    expect(
      screen.getByText(/bạn không thể chỉnh tay tại đây/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Làm lại đánh giá" })).toHaveAttribute(
      "href",
      "/onboarding/pick-vn-rating"
    );
  });
});

describe("AthleteSelfProfilePage", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
  });

  it("shows login prompt when user is not authenticated", async () => {
    render(<ProfilePageShell />);
    expect(
      await screen.findByText("Vui lòng đăng nhập để xem hồ sơ.")
    ).toBeInTheDocument();
  });
});
