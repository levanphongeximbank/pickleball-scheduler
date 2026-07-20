/**
 * Phase 1G-A — Self foundation edit UI smoke (vitest + Testing Library).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "../../src/theme/theme.js";
import SelfPlayerProfileFoundationEdit from "../../src/features/player/components/SelfPlayerProfileFoundationEdit.jsx";
import { SELF_PLAYER_PROFILE_READ_STATUS } from "../../src/features/player/services/getAuthenticatedSelfPlayerProfile.js";
import { buildSelfFoundationFormState } from "../../src/features/player/utils/selfFoundationForm.js";
import { DEFAULT_PRIVACY_SETTINGS } from "../../src/features/player/constants/privacy.js";

function wrap(ui) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {ui}
    </ThemeProvider>
  );
}

describe("Phase 1G-A SelfPlayerProfileFoundationEdit", () => {
  it("shows loading state", () => {
    wrap(
      <SelfPlayerProfileFoundationEdit status={SELF_PLAYER_PROFILE_READ_STATUS.LOADING} />
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Đang tải hồ sơ vận động viên/i);
  });

  it("renders editable foundation fields and read-only verification", () => {
    const form = buildSelfFoundationFormState({
      birthYear: 1995,
      birthDate: "1995-04-12",
      handedness: "left",
      activityRegion: { provinceName: "Hà Nội", city: "Cầu Giấy" },
      privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
      verificationStatus: "verified",
    });

    wrap(
      <SelfPlayerProfileFoundationEdit
        status={SELF_PLAYER_PROFILE_READ_STATUS.LOADED}
        form={form}
        onChange={vi.fn()}
        verificationLabel="Đã xác minh"
      />
    );

    expect(screen.getByDisplayValue("1995-04-12")).toBeTruthy();
    expect(screen.getByDisplayValue("1995")).toBeTruthy();
    expect(screen.getByDisplayValue("Hà Nội")).toBeTruthy();
    expect(screen.getByDisplayValue("Cầu Giấy")).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy(); // handedness select
    expect(screen.getByText(/^Hồ sơ công khai$/i)).toBeTruthy();
    expect(screen.getByText(/Trạng thái xác minh danh tính \(chỉ xem\)/i)).toBeTruthy();
    expect(screen.getByText("Đã xác minh")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /xác minh/i })).toBeNull();
  });

  it("invokes onChange when privacy toggle flips", () => {
    const form = buildSelfFoundationFormState({
      privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
    });
    const onChange = vi.fn((updater) => {
      if (typeof updater === "function") updater(form);
    });

    wrap(
      <SelfPlayerProfileFoundationEdit
        status={SELF_PLAYER_PROFILE_READ_STATUS.LOADED}
        form={form}
        onChange={onChange}
        verificationLabel="Chưa xác minh"
      />
    );

    const toggle = screen.getByLabelText(/Hồ sơ công khai/i);
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalled();
  });
});
