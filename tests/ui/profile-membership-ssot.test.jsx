import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { SELF_PLAYER_PROFILE_READ_STATUS } from "../../src/features/player/services/getAuthenticatedSelfPlayerProfile.js";
import AthleteSelfProfilePage from "../../src/pages/player/AthleteSelfProfilePage.jsx";

const authState = {
  user: {
    id: "user-1",
    role: "PLAYER",
    email: "user@example.com",
    displayName: "Lan",
    clubId: null,
    club_id: null,
  },
  refresh: vi.fn(),
};

const membershipState = {
  ok: true,
  loading: false,
  hasActiveMembership: false,
  clubId: null,
  club: null,
  error: null,
  phase: "NONE",
};

const fetchSelfProfile = vi.fn();
const updateSelfProfile = vi.fn();
const changePassword = vi.fn();
const reloadPlayerProfile = vi.fn();

vi.mock("../../src/context/AuthContext.jsx", () => ({
  useAuth: () => authState,
}));

vi.mock("../../src/features/club/hooks/MyClubMembershipContext.jsx", () => ({
  useMyClubMembershipFromContext: () => membershipState,
}));

vi.mock("../../src/features/identity/services/selfProfileService.js", () => ({
  fetchSelfProfile: (...args) => fetchSelfProfile(...args),
  updateSelfProfile: (...args) => updateSelfProfile(...args),
}));

vi.mock("../../src/features/identity/services/passwordService.js", () => ({
  changePassword: (...args) => changePassword(...args),
}));

vi.mock("../../src/features/player/hooks/useAuthenticatedSelfPlayerProfile.js", () => ({
  useAuthenticatedSelfPlayerProfile: () => ({
    status: SELF_PLAYER_PROFILE_READ_STATUS.EMPTY,
    profile: {},
    message: "",
    reload: reloadPlayerProfile,
  }),
}));

vi.mock("../../src/features/identity/components/AvatarPicker.jsx", () => ({
  default: () => <div>AvatarPicker</div>,
}));

vi.mock("../../src/features/pick-vn-rating/components/AthleteRatingSummary.jsx", () => ({
  default: () => <div>AthleteRatingSummary</div>,
}));

vi.mock("../../src/features/pick-vn-rating/components/PickVnRatingBadge.jsx", () => ({
  default: () => <div>PickVnRatingBadge</div>,
}));

vi.mock("../../src/features/player/components/SelfPlayerProfileFoundationEdit.jsx", () => ({
  default: () => <div>SelfPlayerProfileFoundationEdit</div>,
}));

vi.mock("../../src/features/pick-vn-rating/services/pickVnRatingService.js", () => ({
  getPickVnRatingByAuthUserId: () => null,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AthleteSelfProfilePage />
    </MemoryRouter>
  );
}

describe("AthleteSelfProfilePage membership SSOT", () => {
  beforeEach(() => {
    authState.user = {
      id: "user-1",
      role: "PLAYER",
      email: "user@example.com",
      displayName: "Lan",
      clubId: null,
      club_id: null,
    };
    authState.refresh.mockReset();
    fetchSelfProfile.mockReset();
    updateSelfProfile.mockReset();
    changePassword.mockReset();
    reloadPlayerProfile.mockReset();
    Object.assign(membershipState, {
      ok: true,
      loading: false,
      hasActiveMembership: false,
      clubId: null,
      club: null,
      error: null,
      phase: "NONE",
    });
    fetchSelfProfile.mockResolvedValue({
      ok: true,
      user: {
        displayName: "Lan",
        phone: "",
        gender: "female",
        avatarUrl: "",
      },
    });
    updateSelfProfile.mockResolvedValue({ ok: true, user: {} });
    changePassword.mockResolvedValue({ ok: true, message: "ok" });
    reloadPlayerProfile.mockResolvedValue(undefined);
  });

  it("treats canonical active membership as joined even when legacy club fields are null", async () => {
    Object.assign(membershipState, {
      ok: true,
      hasActiveMembership: true,
      clubId: "club-1",
      club: {
        id: "club-1",
        name: "CLB Canonical",
        status: "active",
        activeMemberCount: 12,
        governance: {},
      },
      phase: "ACTIVE",
    });

    renderPage();

    expect((await screen.findAllByText(/CLB Canonical/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Chưa gia nhập CLB")).not.toBeInTheDocument();
  });

  it("shows not joined when canonical active membership is absent", async () => {
    renderPage();

    expect(await screen.findByText("Chưa gia nhập CLB")).toBeInTheDocument();
  });

  it("shows unavailable state when canonical membership lookup fails", async () => {
    Object.assign(membershipState, {
      ok: false,
      hasActiveMembership: false,
      clubId: null,
      club: null,
      error: "RPC_FAILED",
      phase: "ERROR",
    });

    renderPage();

    expect(await screen.findByText("Không tải được thông tin CLB")).toBeInTheDocument();
    expect(screen.queryByText("Chưa gia nhập CLB")).not.toBeInTheDocument();
  });

  it("ignores user.clubId when canonical membership says no active club", async () => {
    authState.user = {
      ...authState.user,
      clubId: "legacy-club",
      club_id: "legacy-club",
    };

    renderPage();

    expect(await screen.findByText("Chưa gia nhập CLB")).toBeInTheDocument();
    expect(screen.queryByText(/legacy-club/i)).not.toBeInTheDocument();
  });
});
