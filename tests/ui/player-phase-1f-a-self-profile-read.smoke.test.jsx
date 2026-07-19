/**
 * Phase 1F-A — Self foundation read UI states (vitest + Testing Library).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "../../src/theme/theme.js";
import SelfPlayerProfileFoundationRead from "../../src/features/player/components/SelfPlayerProfileFoundationRead.jsx";
import { SELF_PLAYER_PROFILE_READ_STATUS } from "../../src/features/player/services/getAuthenticatedSelfPlayerProfile.js";
import { buildSelfFoundationFieldView } from "../../src/features/player/selectors/selfProfileDisplay.js";
import { DEFAULT_PRIVACY_SETTINGS } from "../../src/features/player/constants/privacy.js";

function wrap(ui) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {ui}
    </ThemeProvider>
  );
}

describe("Phase 1F-A SelfPlayerProfileFoundationRead", () => {
  it("shows loading state", () => {
    wrap(
      <SelfPlayerProfileFoundationRead status={SELF_PLAYER_PROFILE_READ_STATUS.LOADING} />
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Đang tải hồ sơ vận động viên/i);
  });

  it("shows unauthorized state", () => {
    wrap(
      <SelfPlayerProfileFoundationRead
        status={SELF_PLAYER_PROFILE_READ_STATUS.UNAUTHORIZED}
        message="Vui lòng đăng nhập để xem hồ sơ vận động viên."
      />
    );
    expect(screen.getByText(/Vui lòng đăng nhập/i)).toBeTruthy();
  });

  it("shows profile not found state", () => {
    wrap(
      <SelfPlayerProfileFoundationRead
        status={SELF_PLAYER_PROFILE_READ_STATUS.PROFILE_NOT_FOUND}
        message="Không tìm thấy hồ sơ."
      />
    );
    expect(screen.getByText(/Không tìm thấy hồ sơ/i)).toBeTruthy();
  });

  it("shows read error state", () => {
    wrap(
      <SelfPlayerProfileFoundationRead
        status={SELF_PLAYER_PROFILE_READ_STATUS.READ_ERROR}
        message="Lỗi mạng"
      />
    );
    expect(screen.getByText(/Lỗi mạng/i)).toBeTruthy();
  });

  it("renders all six foundation fields with labels (verification read-only)", () => {
    const fields = buildSelfFoundationFieldView({
      birthYear: 1995,
      birthDate: "1995-04-12",
      handedness: "left",
      activityRegion: { provinceName: "Hà Nội", city: "Cầu Giấy" },
      privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
      verificationStatus: "verified",
    });

    wrap(
      <SelfPlayerProfileFoundationRead
        status={SELF_PLAYER_PROFILE_READ_STATUS.LOADED}
        fields={fields}
      />
    );

    expect(screen.getByText("Năm sinh")).toBeTruthy();
    expect(screen.getByText("1995")).toBeTruthy();
    expect(screen.getByText("Ngày sinh")).toBeTruthy();
    expect(screen.getByText("12/04/1995")).toBeTruthy();
    expect(screen.getByText("Tay thuận")).toBeTruthy();
    expect(screen.getByText("Tay trái")).toBeTruthy();
    expect(screen.getByText("Khu vực hoạt động")).toBeTruthy();
    expect(screen.getByText(/Hà Nội/)).toBeTruthy();
    expect(screen.getByText("Quyền riêng tư")).toBeTruthy();
    expect(screen.getByText(/Trạng thái xác minh danh tính/)).toBeTruthy();
    expect(screen.getByText(/chỉ xem/i)).toBeTruthy();
    expect(screen.getByText("Đã xác minh")).toBeTruthy();
    expect(screen.queryByDisplayValue("verified")).toBeNull();
  });
});
